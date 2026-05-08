/**
 * QuestionCache — stores PYQ rows per test_id.
 *
 * Migrated from AsyncStorage → KVStore (MMKV-backed) so that:
 *   • Cache reads during search are synchronous and hit memory (~0.2 ms)
 *   • Opening the app offline can render question lists before any await
 *   • Each test's payload is stored under its own key to keep writes O(1)
 *
 * Public API is unchanged so every caller (OfflineManager, Arena, Engine)
 * keeps working without modification.
 */
import { KVStore } from '../lib/kvStore';

const CACHE_INDEX_KEY = '@cached_test_ids';
const QUESTION_CACHE_PREFIX = '@questions_';

export interface CachedQuestion {
  id: string;
  test_id: string;
  question_text: string;
  explanation_markdown: string;
  subject: string;
  section_group: string;
  exam_stage: string;
  is_pyq: boolean;
  provider?: string;
}

class QuestionCacheService {
  /** Saves questions for a specific test ID to local storage. */
  async cacheQuestions(testId: string, questions: any[]) {
    if (!testId || !questions.length) return;
    try {
      KVStore.setJson(`${QUESTION_CACHE_PREFIX}${testId}`, questions);
      const index = await this.getCachedTestIds();
      if (!index.includes(testId)) {
        KVStore.setJson(CACHE_INDEX_KEY, [...index, testId]);
      }
    } catch (err) {
      console.error('[Cache] Failed to cache questions', err);
    }
  }

  async getCachedTestIds(): Promise<string[]> {
    return KVStore.getJson<string[]>(CACHE_INDEX_KEY) ?? [];
  }

  getCachedTestIdsSync(): string[] {
    return KVStore.getJson<string[]>(CACHE_INDEX_KEY) ?? [];
  }

  /** Search across all locally cached questions. */
  async searchLocal(
    query: string,
    mode: 'Matching' | 'Exact',
    fields: string[] = ['Questions', 'Explanations']
  ): Promise<CachedQuestion[]> {
    const term = query.toLowerCase().trim();
    if (!term) return [];

    const testIds = await this.getCachedTestIds();
    const results: CachedQuestion[] = [];
    const keywords = term.split(/\s+/).filter(Boolean);

    const searchQuestions = fields.includes('Questions');
    const searchExplanations = fields.includes('Explanations');

    for (const testId of testIds) {
      const questions = KVStore.getJson<CachedQuestion[]>(`${QUESTION_CACHE_PREFIX}${testId}`);
      if (!questions) continue;

      for (const q of questions) {
        const text = searchQuestions ? (q.question_text || '').toLowerCase() : '';
        const expl = searchExplanations ? (q.explanation_markdown || '').toLowerCase() : '';

        if (mode === 'Exact') {
          if ((text && text.includes(term)) || (expl && expl.includes(term))) {
            results.push(q);
          }
        } else {
          const matches = keywords.every(
            (kw) => (text && text.includes(kw)) || (expl && expl.includes(kw))
          );
          if (matches) results.push(q);
        }
      }
    }

    // Fuzzy fallback (1-char tolerance) for single-word long queries.
    if (mode !== 'Exact' && keywords.length === 1 && term.length > 3) {
      const word = keywords[0];
      const existingIds = new Set(results.map((r) => r.id));
      const fuzzyRegexes: RegExp[] = [];
      for (let i = 0; i < word.length; i++) {
        fuzzyRegexes.push(new RegExp(word.substring(0, i) + '.*' + word.substring(i + 1), 'i'));
      }

      for (const testId of testIds) {
        if (results.length >= 25) break;
        const questions = KVStore.getJson<CachedQuestion[]>(`${QUESTION_CACHE_PREFIX}${testId}`);
        if (!questions) continue;

        for (const q of questions) {
          if (existingIds.has(q.id)) continue;
          const text = searchQuestions ? (q.question_text || '') : '';
          const expl = searchExplanations ? (q.explanation_markdown || '') : '';
          if (fuzzyRegexes.some((re) => re.test(text) || re.test(expl))) {
            results.push(q);
            existingIds.add(q.id);
            if (results.length >= 25) break;
          }
        }
      }
    }

    return results;
  }

  /** Returns parsed questions for a single cached test. */
  async getCachedQuestions(testId: string): Promise<any[]> {
    return KVStore.getJson<any[]>(`${QUESTION_CACHE_PREFIX}${testId}`) ?? [];
  }

  /** Synchronous sibling of getCachedQuestions — useful inside React render paths. */
  getCachedQuestionsSync(testId: string): any[] {
    return KVStore.getJson<any[]>(`${QUESTION_CACHE_PREFIX}${testId}`) ?? [];
  }

  /** Returns the total number of questions across all cached tests. */
  async getCachedQuestionCount(): Promise<number> {
    const testIds = await this.getCachedTestIds();
    let count = 0;
    for (const testId of testIds) {
      const questions = KVStore.getJson<any[]>(`${QUESTION_CACHE_PREFIX}${testId}`);
      if (questions) count += questions.length;
    }
    return count;
  }

  async clearCache() {
    const testIds = await this.getCachedTestIds();
    for (const id of testIds) {
      KVStore.delete(`${QUESTION_CACHE_PREFIX}${id}`);
    }
    KVStore.delete(CACHE_INDEX_KEY);
  }
}

export const QuestionCache = new QuestionCacheService();
