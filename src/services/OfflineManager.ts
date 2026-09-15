/**
 * OfflineManager — full offline sync orchestrator.
 *
 * Phase 2 (Offline-first) upgrade — migrated from AsyncStorage to KVStore.
 *
 * Responsibilities:
 *   1. Full sync on login/app-open — downloads tests, questions, states, notes,
 *      attempts, flashcards and writes to KVStore (MMKV on device, AsyncStorage
 *      fallback on web/Expo Go).
 *   2. Incremental sync — pulls rows updated since last sync.
 *   3. Read API — every hook/screen in the app reads offline data through here.
 *   4. Clear-all on sign-out.
 *
 * The public API is unchanged so all existing callers continue to work.
 */
import { supabase } from '../lib/supabase';
import { KVStore } from '../lib/kvStore';
import { NetworkStatus } from '../lib/networkStatus';
import { QuestionCache } from './QuestionCache';
import { MediaCacheService, collectQuestionMediaUrls, collectCardMediaUrls, collectValueAddMediaUrls } from './MediaCacheService';
import { TopperImageCacheService } from './TopperImageCacheService';
import { MAINS_QUESTIONS_CACHE_KEY, fetchMainsQuestionsFromSupabase } from '../data/mainsConsolidatedLoader';
import {
  MAINS_VALUE_ADD_CACHE_KEY,
  fetchValueAdditionFromSupabase,
  fetchValueAddFingerprint,
  hashFingerprint,
} from '../data/mainsValueAdditionLoader';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ────────────────────────────────────────────────
const OFFLINE_META_KEY     = '@offline_meta';
const OFFLINE_TESTS_KEY    = '@offline_tests';
const OFFLINE_METADATA_CONSOLIDATED_KEY = '@offline_metadata_consolidated_v1';
const USER_STATES_PREFIX   = '@user_states_';
const USER_NOTES_PREFIX    = '@user_notes_';
const USER_NOTE_NODES_PREFIX = '@user_note_nodes_';
const USER_ATTEMPTS_PREFIX = '@user_attempts_';
const USER_CARDS_PREFIX    = '@user_cards_';
const CARDS_PREFIX         = '@cards_all';
const USER_CARD_REVIEWS_PREFIX = '@user_card_reviews_';
const USER_STUDY_SESSIONS_PREFIX = '@user_study_sessions_';
const USER_FOLDERS_PREFIX = '@user_folders_';
const USER_BRANCHES_PREFIX = '@user_flashcard_branches_';
const USER_BRANCH_CARDS_PREFIX = '@user_flashcard_branch_cards_';
const USER_DRAFT_ATTEMPTS_PREFIX = '@user_draft_attempts_';
const USER_SETTINGS_PREFIX = '@user_settings_';
const USER_WIDGETS_PREFIX = '@user_widgets_';
const USER_TAGS_PREFIX = '@user_tags_';
const USER_SYLLABUS_PROGRESS_PREFIX = '@user_syllabus_progress_';
const USER_PROMPT_TEMPLATES_PREFIX = '@user_prompt_templates_';
const USER_FOLDER_ALGO_SETTINGS_PREFIX = '@user_folder_algo_settings_';
const USER_BEST_ANSWERS_PREFIX = '@user_best_answers_';
const CARD_FOLDER_MAP_KEY = '@card_folder_map_all';
const OFFLINE_SYNC_VERSION = 4;

export const TABLES = {
  questions: 'questions',
  tests: 'tests',
  question_states: 'question_states',
  test_attempts: 'test_attempts',
  cards: 'cards',
  user_cards: 'user_cards',
  card_reviews: 'card_reviews',
  study_sessions: 'study_sessions',
  user_notes: 'user_notes',
  user_note_nodes: 'user_note_nodes',
  folders: 'folders',
  flashcard_branches: 'flashcard_branches',
  flashcard_branch_cards: 'flashcard_branch_cards',
  card_folder_map: 'card_folder_map',
  draft_attempts: 'draft_attempts',
  user_settings: 'user_settings',
  user_widgets: 'user_widgets',
  user_tags: 'user_tags',
  user_syllabus_progress: 'user_syllabus_progress',
  prompt_templates: 'prompt_templates',
  folder_algorithm_settings: 'folder_algorithm_settings',
  user_best_answers: 'user_best_answers',
};

// ─── Types ───────────────────────────────────────────────────────
export interface OfflineMetadata {
  lastFullSync: number | null;
  lastIncrementalSync: number | null;
  /** Last time the lightweight tests index was checked (Refresh button only). */
  lastCatalogScan?: number | null;
  syncVersion?: number;
  totalQuestions: number;
  totalTests: number;
  totalStates: number;
  totalNotes: number;
  totalAttempts: number;
  totalCards: number;
  /** Media (image) phase bookkeeping. */
  totalMedia?: number;
  totalMediaCached?: number;
  mediaPhaseCancelled?: boolean;

  // ── Per-category bookkeeping (drives the three Profile download rows) ──
  /** Questions + value-adds. */
  lastCatalogSync?: number | null;
  totalValueAdds?: number;
  /** Mains questions (separate corpus from the prelims question bank). */
  totalMainsQuestions?: number;
  /** Mains topper answer-sheet images (+ question-embedded images). */
  lastTopperImageSync?: number | null;
  totalTopperImages?: number;
  topperImageCount?: number;
  /** Flashcard front/back photos. */
  lastCardImageSync?: number | null;
  totalCardImages?: number;
  cardImageCount?: number;
  /** Fingerprint of the value-add id set, used to detect author changes. */
  valueAddFingerprint?: string | null;
}

export interface SyncProgress {
  phase: string;       // 'tests' | 'questions' | 'states' | 'notes' | 'attempts' | 'cards' | 'done'
  current: number;
  total: number;
  detail: string;
}

const DEFAULT_META: OfflineMetadata = {
  lastFullSync: null,
  lastIncrementalSync: null,
  syncVersion: 0,
  totalQuestions: 0,
  totalTests: 0,
  totalStates: 0,
  totalNotes: 0,
  totalAttempts: 0,
  totalCards: 0,
};

// ─── Sync categories ─────────────────────────────────────────────
/**
 * Offline content is downloaded in independent categories so the user can
 * control what they pull (and how much space it costs). Each category has its
 * own cancellation flag and in-flight promise: cancelling a slow topper-image
 * download must not abort a card-image download running alongside it.
 */
export type SyncCategory = 'catalog' | 'topperImages' | 'cardImages';

interface CategoryState {
  cancelled: boolean;
  promise: Promise<any> | null;
}

/** Progress phases that belong to a given category, for UI labelling. */
export const CATEGORY_PHASES: Record<SyncCategory, string[]> = {
  catalog: ['tests', 'questions', 'valueadds', 'states', 'notes', 'attempts', 'cards', 'media'],
  topperImages: ['topper', 'media'],
  cardImages: ['media'],
};

// ─── Service ─────────────────────────────────────────────────────
class OfflineManagerService {
  private _categories: Record<SyncCategory, CategoryState> = {
    catalog: { cancelled: false, promise: null },
    topperImages: { cancelled: false, promise: null },
    cardImages: { cancelled: false, promise: null },
  };
  currentSyncProgress: SyncProgress | null = null;

  /** True when the given category has been asked to stop. */
  private _isCancelled(cat: SyncCategory): boolean {
    return this._categories[cat].cancelled;
  }

  /**
   * Run `work` as the category's exclusive in-flight operation. A second call
   * while one is running subscribes to the existing promise instead of
   * starting a duplicate download.
   */
  private _runCategory<T>(
    cat: SyncCategory,
    work: (report: (p: SyncProgress) => void) => Promise<T>,
    onProgress?: (p: SyncProgress) => void
  ): Promise<T> {
    const state = this._categories[cat];
    if (state.promise) {
      if (onProgress) {
        const unsub = this.onSyncProgress(onProgress);
        if (this.currentSyncProgress) {
          try { onProgress(this.currentSyncProgress); } catch {}
        }
        (state.promise as Promise<any>).finally(unsub);
      }
      return state.promise as Promise<T>;
    }

    state.cancelled = false;
    if (onProgress) this._syncListeners.add(onProgress);

    const report = (p: SyncProgress) => {
      this.currentSyncProgress = p;
      this._notifyListeners(p);
    };

    const promise = work(report)
      .finally(() => {
        state.promise = null;
        if (onProgress) this._syncListeners.delete(onProgress);
      });
    state.promise = promise;
    return promise;
  }

  /** True when any category currently has a download in flight. */
  isCategoryRunning(cat: SyncCategory): boolean {
    return this._categories[cat].promise !== null;
  }

  private async fetchAllRows(
    table: string,
    applyFilters?: (query: any) => any,
    chunk = 1000,
    cat: SyncCategory = 'catalog'
  ): Promise<any[]> {
    const rows: any[] = [];
    let from = 0;

    while (true) {
      if (this._isCancelled(cat)) return rows;

      let query = supabase
        .from(table)
        .select('*')
        .range(from, from + chunk - 1);

      if (applyFilters) query = applyFilters(query);

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) break;

      rows.push(...data);
      if (data.length < chunk) break;
      from += chunk;
    }

    return rows;
  }

  private async fetchServerCount(
    table: string,
    applyFilters?: (query: any) => any
  ): Promise<number | null> {
    let query = supabase
      .from(table)
      .select('id', { count: 'exact', head: true });

    if (applyFilters) query = applyFilters(query);

    const { count, error } = await query;
    if (error) throw error;
    return count;
  }

  // ── Metadata ──────────────────────────────────────────────────
  async getMetadata(): Promise<OfflineMetadata> {
    return KVStore.getJson<OfflineMetadata>(OFFLINE_META_KEY) ?? { ...DEFAULT_META };
  }

  private async setMetadata(patch: Partial<OfflineMetadata>) {
    const current = await this.getMetadata();
    KVStore.setJson(OFFLINE_META_KEY, { ...current, ...patch });
  }

  // ── Cancel support ────────────────────────────────────────────
  /** Cancel one category, leaving the others running. */
  cancelCategory(cat: SyncCategory) {
    this._categories[cat].cancelled = true;
  }

  /** Cancel every in-flight category and clear the progress indicator. */
  cancelSync() {
    (Object.keys(this._categories) as SyncCategory[]).forEach((c) => {
      this._categories[c].cancelled = true;
    });
    this.currentSyncProgress = null;
  }

  // ── Multi-listener support ────────────────────────────────────
  private _syncListeners: Set<(p: SyncProgress) => void> = new Set();

  /** Subscribe to sync progress updates. Returns an unsubscribe function. */
  onSyncProgress(cb: (p: SyncProgress) => void): () => void {
    this._syncListeners.add(cb);
    return () => { this._syncListeners.delete(cb); };
  }

  private _notifyListeners(p: SyncProgress) {
    this._syncListeners.forEach((cb) => { try { cb(p); } catch {} });
  }

  // ── FULL SYNC ─────────────────────────────────────────────────
  async syncAllContent(
    userId: string,
    onProgress?: (p: SyncProgress) => void,
    selectedCourse?: string
  ) {
    return this._runCategory(
      'catalog',
      (report) => this.runFullSync(userId, report, selectedCourse),
      onProgress
    );
  }

  /**
   * Download the tests catalogue and every question for the active course,
   * skipping tests that are already fully cached. Returns the question count.
   *
   * Extracted from `runFullSync` so the standalone "Download questions" action
   * and the full download share one code path.
   */
  private async downloadCourseCatalog(
    userId: string,
    report: (p: SyncProgress) => void,
    selectedCourse?: string
  ): Promise<number> {
    const cancelled = () => this._isCancelled('catalog');
    let totalQuestions = 0;

    // ──────── 1. TESTS ──────────────────────────────────────────
    report({ phase: 'tests', current: 0, total: 1, detail: 'Fetching test catalogue...' });

    const allTests = await this.fetchAllRows('tests');
    if (!allTests || allTests.length === 0) throw new Error('No tests found on server');

    KVStore.setJson(OFFLINE_TESTS_KEY, allTests);
    report({ phase: 'tests', current: 1, total: 1, detail: `${allTests.length} tests saved` });
    if (cancelled()) return totalQuestions;

    // Resolve course preference
    let course = selectedCourse;
    if (!course) {
      try {
        const stored = await AsyncStorage.getItem('selectedCourse');
        if (stored) course = stored;
      } catch {}
    }
    if (!course) course = 'Civil Services';

    // Only download questions for the active course
    const testsToSync = allTests.filter((t: any) => t.course === course);

    // ──────── 2. QUESTIONS (chunked by test) ────────────────────
    const totalTests = testsToSync.length;
    for (let i = 0; i < totalTests; i++) {
      if (cancelled()) return totalQuestions;
      const test = testsToSync[i];
      report({
        phase: 'questions',
        current: i,
        total: totalTests,
        detail: `${test.title || test.id}  (${i + 1}/${totalTests})`,
      });

      try {
        const cachedQs = QuestionCache.getCachedQuestionsSync(test.id);
        const expectedCount = test.question_count || 0;
        const isAlreadyCached = cachedQs.length > 0 && (expectedCount === 0 || cachedQs.length === expectedCount);

        if (isAlreadyCached) {
          console.log(`[OfflineSync] Test ${test.id} is already cached (${cachedQs.length} Qs), skipping download.`);
          totalQuestions += cachedQs.length;
          continue;
        }

        // Preserve the originally uploaded sequence so paper-wise learn/exam
        // can render the exact book order even from MMKV cache.
        const questions = await this.fetchAllRows(
          'questions',
          (query) =>
            query
              .eq('test_id', test.id)
              .order('question_number', { ascending: true })
              .order('id', { ascending: true })
        );

        if (questions && questions.length > 0) {
          await QuestionCache.cacheQuestions(test.id, questions);
          totalQuestions += questions.length;
        }
      } catch (err) {
        console.warn(`[Offline] Failed to cache test ${test.id}`, err);
      }
    }
    report({ phase: 'questions', current: totalTests, total: totalTests, detail: `${totalQuestions} questions saved` });
    return totalQuestions;
  }

  private async runFullSync(
    userId: string,
    report: (p: SyncProgress) => void,
    selectedCourse?: string
  ) {
    this.currentSyncProgress = null;
    const cancelled = () => this._isCancelled('catalog');

    // ──────── 1+2. TESTS & QUESTIONS ────────────────────────────
    const totalQuestions = await this.downloadCourseCatalog(userId, report, selectedCourse);
    if (cancelled()) return;

    // Mains questions + value-adds (separate corpus from the prelims bank).
    await this.downloadMainsCorpus(report);
    if (cancelled()) return;

    // Re-read for the media phase and metadata below.
    const allTests = this.getOfflineTestsSync();
    let course = selectedCourse;
    if (!course) {
      try {
        const stored = await AsyncStorage.getItem('selectedCourse');
        if (stored) course = stored;
      } catch {}
    }
    if (!course) course = 'Civil Services';
    const testsToSync = allTests.filter((t: any) => t.course === course);

    // ──────── 3. USER QUESTION STATES (paginated) ───────────────
    report({ phase: 'states', current: 0, total: 1, detail: 'Fetching your tags, bookmarks & notes...' });
    let totalStates = 0;
    try {
      const allStates: any[] = [];
      let from = 0;
      const CHUNK = 1000;
      while (true) {
        if (cancelled()) return;
        const { data, error } = await supabase
          .from('question_states')
          .select('*')
          .eq('user_id', userId)
          .range(from, from + CHUNK - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allStates.push(...data);
        from += CHUNK;
        if (data.length < CHUNK) break;
      }
      KVStore.setJson(`${USER_STATES_PREFIX}${userId}`, allStates);
      totalStates = allStates.length;
    } catch (err) {
      console.warn('[Offline] Failed to fetch question_states', err);
    }
    report({ phase: 'states', current: 1, total: 1, detail: `${totalStates} question states saved` });
    if (cancelled()) return;

    // ──────── 4. USER NOTES ─────────────────────────────────────
    report({ phase: 'notes', current: 0, total: 1, detail: 'Fetching your notebooks...' });
    let totalNotes = 0;
    try {
      const notes = await this.fetchAllRows(
        'user_notes',
        (query) => query.eq('user_id', userId)
      );
      if (notes) {
        KVStore.setJson(`${USER_NOTES_PREFIX}${userId}`, notes);
        totalNotes = notes.length;
      }
    } catch (err) {
      console.warn('[Offline] Failed to fetch user_notes', err);
    }
    report({ phase: 'notes', current: 1, total: 1, detail: `${totalNotes} notebooks saved` });
    if (cancelled()) return;

    // ──────── 5. TEST ATTEMPTS ──────────────────────────────────
    report({ phase: 'attempts', current: 0, total: 1, detail: 'Fetching your test attempts...' });
    let totalAttempts = 0;
    try {
      const { data: attempts, error: aErr } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .order('submitted_at', { ascending: false })
        .limit(500);
      if (!aErr && attempts) {
        KVStore.setJson(`${USER_ATTEMPTS_PREFIX}${userId}`, attempts);
        totalAttempts = attempts.length;
      }
    } catch (err) {
      console.warn('[Offline] Failed to fetch test_attempts', err);
    }
    report({ phase: 'attempts', current: 1, total: 1, detail: `${totalAttempts} attempts saved` });
    if (cancelled()) return;

    // ──────── 6. FLASHCARD DATA ─────────────────────────────────
    report({ phase: 'cards', current: 0, total: 1, detail: 'Fetching your flashcards...' });
    let totalCards = 0;
    try {
      // Fetch only non-deleted cards from Supabase
      const cards = await this.fetchAllRows('cards', (query) => query.eq('is_deleted', false));
      if (cards) {
        KVStore.setJson(CARDS_PREFIX, cards);
        // Also update the application flashcard cache to reflect deletions from server
        const filtered = cards.filter(c => !c.is_deleted);
        KVStore.setJson('@user_cards_flashcards', filtered.map(c => ({
          ...c,
          deleted: c.is_deleted === true ? true : false
        })));
      }

      const userCards = await this.fetchAllRows(
        'user_cards',
        (query) => query.eq('user_id', userId).neq('status', 'deleted')
      );
      if (userCards) {
        // Filter to only include user_cards for non-deleted cards
        const validCardIds = new Set((cards ?? []).map(c => c.id));
        const filtered = (userCards ?? []).filter(uc => validCardIds.has(uc.card_id));
        KVStore.setJson(`${USER_CARDS_PREFIX}${userId}`, filtered);
        totalCards = filtered.length;
      }

      const validCardIds = new Set((cards ?? []).map(c => c.id));
      const userTables: Array<[string, string, (q: any) => any]> = [
        ['card_reviews', `${USER_CARD_REVIEWS_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['study_sessions', `${USER_STUDY_SESSIONS_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['user_note_nodes', `${USER_NOTE_NODES_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['folders', `${USER_FOLDERS_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['flashcard_branches', `${USER_BRANCHES_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['flashcard_branch_cards', `${USER_BRANCH_CARDS_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['draft_attempts', `${USER_DRAFT_ATTEMPTS_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['user_settings', `${USER_SETTINGS_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        ['user_widgets', `${USER_WIDGETS_PREFIX}${userId}`, 
          (q) => q.eq('user_id', userId)],
        // Added in v4 — these were missing and caused background refresh
        // calls to Supabase even when offline (see NEW LOG OFFLINE TEST 2.txt).
        ['user_tags', `${USER_TAGS_PREFIX}${userId}`,
          (q) => q.eq('user_id', userId)],
        ['user_syllabus_progress', `${USER_SYLLABUS_PROGRESS_PREFIX}${userId}`,
          (q) => q.eq('user_id', userId)],
        ['prompt_templates', `${USER_PROMPT_TEMPLATES_PREFIX}${userId}`,
          (q) => q.eq('user_id', userId)],
        ['folder_algorithm_settings', `${USER_FOLDER_ALGO_SETTINGS_PREFIX}${userId}`,
          (q) => q.eq('user_id', userId)],
        ['user_best_answers', `${USER_BEST_ANSWERS_PREFIX}${userId}`,
          (q) => q.eq('user_id', userId)],
      ];
      
      for (const [table, key, queryFn] of userTables) {
        let data = await this.fetchAllRows(table, queryFn);
        // Filter card_reviews to only include reviews for non-deleted cards
        if (table === 'card_reviews' && data) {
          data = (data as any[]).filter(cr => validCardIds.has(cr.card_id));
        }
        if (data) KVStore.setJson(key, data);
      }

      const cardFolderMap = await this.fetchAllRows('card_folder_map');
      if (cardFolderMap) KVStore.setJson(CARD_FOLDER_MAP_KEY, cardFolderMap);
    } catch (err) {
      console.warn('[Offline] Failed to fetch flashcard data', err);
    }
    report({ phase: 'cards', current: 1, total: 1, detail: `${totalCards} flashcards saved` });

    // ──────── 7. MEDIA (images inside questions, explanations & cards) ───
    // R2/Cloudflare URLs — caching them is what makes answers and flashcard
    // photos readable in airplane mode. Runs LAST so a cancel here never costs
    // question re-downloads.
    let totalMedia = 0;
    try {
      if (!cancelled()) {
        await MediaCacheService.init();
        const rows: any[] = [];
        for (const test of testsToSync) {
          if (cancelled()) break;
          rows.push(...QuestionCache.getCachedQuestionsSync(test.id));
        }
        const urls = collectQuestionMediaUrls(rows);
        // Flashcard front/back photos are stored on `cards`, which was fetched
        // earlier in this same sync.
        const cards = KVStore.getJson<any[]>(CARDS_PREFIX) ?? [];
        for (const u of collectCardMediaUrls(cards)) {
          if (!urls.includes(u)) urls.push(u);
        }
        totalMedia = urls.length;
        report({ phase: 'media', current: 0, total: totalMedia, detail: 'Caching images...' });

        const result = await MediaCacheService.cacheUrls(
          urls,
          (done, total, skipped) => {
            report({
              phase: 'media',
              current: done,
              total,
              detail: skipped > 0
                ? `Images ${done}/${total} (${skipped} already saved)`
                : `Images ${done}/${total}`,
            });
          },
          cancelled
        );
        report({
          phase: 'media',
          current: totalMedia,
          total: totalMedia,
          detail: cancelled()
            ? `Image download stopped — ${result.skipped} cached`
            : `${result.done} new images cached (${result.skipped} already present)`,
        });
      }
    } catch (err) {
      console.warn('[Offline] Media cache phase failed', err);
    }
    if (cancelled()) {
      // Media is resumable and cheap to re-run; record that so Profile can
      // offer "Download remaining images" without re-fetching questions.
      await this.setMetadata({
        mediaPhaseCancelled: true,
        totalMedia,
        totalMediaCached: MediaCacheService.cachedCount(),
      });
      return;
    }

    // ──────── FINALIZE ──────────────────────────────────────────
    await this.setMetadata({
      lastFullSync: Date.now(),
      lastIncrementalSync: Date.now(),
      lastCatalogScan: Date.now(),
      syncVersion: OFFLINE_SYNC_VERSION,
      totalQuestions,
      totalTests: allTests.length,
      totalStates,
      totalNotes,
      totalAttempts,
      totalCards,
      totalMedia,
      totalMediaCached: MediaCacheService.cachedCount(),
      mediaPhaseCancelled: false,
    });
    report({ phase: 'done', current: 1, total: 1, detail: 'All data downloaded!' });
  }

  /**
   * Mains corpus: questions + value-adds (+ their diagram images).
   *
   * Kept as a private step of the catalog category rather than a separate
   * public method, because calling another catalog-category method while the
   * category lock is held would make `_runCategory` return the caller's own
   * in-flight promise (an await-itself deadlock).
   */
  private async downloadMainsCorpus(
    report: (p: SyncProgress) => void
  ): Promise<{ mainsQuestions: number; valueAdds: number }> {
    let mainsQuestions = 0;
    let valueAdds = 0;

    report({ phase: 'questions', current: 0, total: 1, detail: 'Fetching mains questions...' });
    try {
      const mains = await fetchMainsQuestionsFromSupabase();
      if (mains.length > 0) {
        KVStore.setJson(MAINS_QUESTIONS_CACHE_KEY, mains);
        mainsQuestions = mains.length;
      }
    } catch (err) {
      console.warn('[Offline] Mains question download failed', err);
    }

    try {
      report({ phase: 'valueadds', current: 0, total: 1, detail: 'Fetching value-adds...' });
      const items = await fetchValueAdditionFromSupabase();
      KVStore.setJson(MAINS_VALUE_ADD_CACHE_KEY, items);
      valueAdds = items.length;

      const urls = collectValueAddMediaUrls(items);
      if (urls.length > 0 && !this._isCancelled('catalog')) {
        await MediaCacheService.init();
        await MediaCacheService.cacheUrls(
          urls,
          (done, total) => {
            report({
              phase: 'valueadds',
              current: done,
              total,
              detail: `Value-add images ${done}/${total}`,
            });
          },
          () => this._isCancelled('catalog')
        );
      }
    } catch (err) {
      console.warn('[Offline] Value-add download failed', err);
    }

    let fingerprint: string | null = null;
    try {
      fingerprint = hashFingerprint(await fetchValueAddFingerprint());
    } catch { /* offline — leave unset */ }

    await this.setMetadata({
      totalMainsQuestions: mainsQuestions,
      totalValueAdds: valueAdds,
      valueAddFingerprint: fingerprint,
    });

    return { mainsQuestions, valueAdds };
  }

  /** Independently sync flashcards incrementally (used by pull-to-refresh and auto-sync) */
  async syncFlashcards(userId: string): Promise<void> {
    if (NetworkStatus.isOffline()) return;
    try {
      const meta = await this.getMetadata();
      const since = meta.lastFullSync ? (meta.lastIncrementalSync || meta.lastFullSync) : null;
      const sinceStr = since ? new Date(since).toISOString() : null;

      // 1. Cards (Incremental)
      let cardsQuery = supabase.from('cards').select('*');
      if (sinceStr) cardsQuery = cardsQuery.gte('updated_at', sinceStr);
      const { data: newCards } = await cardsQuery;
      
      if (newCards && newCards.length > 0) {
        const existingCards = KVStore.getJson<any[]>(CARDS_PREFIX) ?? [];
        const map = new Map(existingCards.map(c => [c.id, c]));
        newCards.forEach(c => map.set(c.id, c));
        // Filter out deleted cards before saving
        const finalCards = Array.from(map.values()).filter(c => !c.is_deleted && !c.deleted);
        KVStore.setJson(CARDS_PREFIX, finalCards);
      }

      // 2. User Cards (Incremental)
      let userCardsQuery = supabase.from('user_cards').select('*').eq('user_id', userId);
      if (sinceStr) userCardsQuery = userCardsQuery.gte('updated_at', sinceStr);
      const { data: newUserCards } = await userCardsQuery;

      if (newUserCards && newUserCards.length > 0) {
        const existingUC = KVStore.getJson<any[]>(`${USER_CARDS_PREFIX}${userId}`) ?? [];
        const map = new Map(existingUC.map(uc => [uc.card_id, uc]));
        newUserCards.forEach(uc => map.set(uc.card_id, uc));
        const finalUC = Array.from(map.values()).filter(uc => uc.status !== 'deleted');
        KVStore.setJson(`${USER_CARDS_PREFIX}${userId}`, finalUC);
      }
      
      // 3. Branches / Folders (Incremental)
      let branchesQuery = supabase.from('flashcard_branches').select('*').eq('user_id', userId);
      if (sinceStr) branchesQuery = branchesQuery.gte('updated_at', sinceStr);
      const { data: newBranches } = await branchesQuery;
      
      if (newBranches && newBranches.length > 0) {
        const existingBranches = KVStore.getJson<any[]>(`${USER_BRANCHES_PREFIX}${userId}`) ?? [];
        const map = new Map(existingBranches.map(b => [b.id, b]));
        newBranches.forEach(b => map.set(b.id, b));
        KVStore.setJson(`${USER_BRANCHES_PREFIX}${userId}`, Array.from(map.values()));
      }
      
      // 4. Branch Links (Always fetch all, small payload and may lack updated_at)
      const branchCards = await this.fetchAllRows('flashcard_branch_cards', (q) => q.eq('user_id', userId));
      if (branchCards) KVStore.setJson(`${USER_BRANCH_CARDS_PREFIX}${userId}`, branchCards);
      
      const folderAlgos = await this.fetchAllRows('folder_algorithm_settings', (q) => q.eq('user_id', userId));
      if (folderAlgos) KVStore.setJson(`${USER_FOLDER_ALGO_SETTINGS_PREFIX}${userId}`, folderAlgos);
      
      // Update last sync time so future auto-syncs are fast
      await this.setMetadata({ ...meta, lastIncrementalSync: Date.now() });
    } catch (err) {
      console.warn('syncFlashcards error:', err);
    }
  }

  // ── INCREMENTAL SYNC (USER DATA ONLY) ─────────────────────────
  /**
   * Pulls *only* per-user rows (states, notes, attempts, cards, tags,
   * progress). It NEVER touches `questions` or `tests` — those are catalog
   * tables and are refreshed exclusively by the explicit "Check for updates"
   * action (`refreshCatalogDelta`).
   *
   * This is the safe-to-run-on-every-login / every-foreground path: a few KB
   * of JSON, no hundreds-of-MB egress.
   */
  async incrementalSync(userId: string) {
    return this.syncUserData(userId);
  }

  async syncUserData(userId: string) {
    const meta = await this.getMetadata();
    if (!meta.lastFullSync) return;

    const since = meta.lastIncrementalSync
      ? new Date(meta.lastIncrementalSync).toISOString()
      : new Date(meta.lastFullSync).toISOString();

    try {
      // 1. Refresh question_states
      const { data: newStates } = await supabase
        .from('question_states')
        .select('*')
        .eq('user_id', userId)
        .gte('updated_at', since);
      if (newStates && newStates.length > 0) {
        const existing = KVStore.getJson<any[]>(`${USER_STATES_PREFIX}${userId}`) ?? [];
        const map = new Map(existing.map((s) => [s.question_id, s]));
        newStates.forEach((s) => map.set(s.question_id, s));
        KVStore.setJson(`${USER_STATES_PREFIX}${userId}`, Array.from(map.values()));
      }

      // 2. Refresh user_notes
      const { data: newNotes } = await supabase
        .from('user_notes')
        .select('*')
        .eq('user_id', userId)
        .gte('updated_at', since);
      if (newNotes && newNotes.length > 0) {
        const existing = KVStore.getJson<any[]>(`${USER_NOTES_PREFIX}${userId}`) ?? [];
        const map = new Map(existing.map((n) => [n.id, n]));
        newNotes.forEach((n) => map.set(n.id, n));
        KVStore.setJson(`${USER_NOTES_PREFIX}${userId}`, Array.from(map.values()));
      }

      // 3. Refresh test_attempts
      const { data: newAttempts } = await supabase
        .from('test_attempts')
        .select('*')
        .eq('user_id', userId)
        .gte('submitted_at', since);
      if (newAttempts && newAttempts.length > 0) {
        const existing = KVStore.getJson<any[]>(`${USER_ATTEMPTS_PREFIX}${userId}`) ?? [];
        const map = new Map(existing.map((a) => [a.id, a]));
        newAttempts.forEach((a) => map.set(a.id, a));
        KVStore.setJson(`${USER_ATTEMPTS_PREFIX}${userId}`, Array.from(map.values()));
      }

      // 4. Refresh user_cards
      const { data: newUserCards } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userId)
        .gte('updated_at', since);
      if (newUserCards && newUserCards.length > 0) {
        const existing = KVStore.getJson<any[]>(`${USER_CARDS_PREFIX}${userId}`) ?? [];
        const map = new Map(existing.map((c) => [c.card_id, c]));
        newUserCards.forEach((c) => map.set(c.card_id, c));
        KVStore.setJson(`${USER_CARDS_PREFIX}${userId}`, Array.from(map.values()));
      }

      // 5. Refresh cards
      const { data: newCards } = await supabase
        .from('cards')
        .select('*')
        .gte('updated_at', since);
      if (newCards && newCards.length > 0) {
        const existingCards = KVStore.getJson<any[]>(CARDS_PREFIX) ?? [];
        const cardMap = new Map(existingCards.map((c) => [c.id, c]));
        newCards.forEach((c) => cardMap.set(c.id, c));
        KVStore.setJson(CARDS_PREFIX, Array.from(cardMap.values()));
      }

      // 6. Refresh user_tags / syllabus_progress / prompt_templates /
      //    folder_algorithm_settings — these are small per-user tables so a
      //    full refresh is acceptable and saves us from incremental bookkeeping.
      const smallTables: Array<[string, string]> = [
        ['user_tags', `${USER_TAGS_PREFIX}${userId}`],
        ['user_syllabus_progress', `${USER_SYLLABUS_PROGRESS_PREFIX}${userId}`],
        ['prompt_templates', `${USER_PROMPT_TEMPLATES_PREFIX}${userId}`],
        ['folder_algorithm_settings', `${USER_FOLDER_ALGO_SETTINGS_PREFIX}${userId}`],
        ['user_best_answers', `${USER_BEST_ANSWERS_PREFIX}${userId}`],
        ['user_note_nodes', `${USER_NOTE_NODES_PREFIX}${userId}`],
      ];
      for (const [table, key] of smallTables) {
        try {
          const { data } = await supabase.from(table).select('*').eq('user_id', userId);
          if (data) KVStore.setJson(key, data);
        } catch {
          /* offline or table missing — leave cache as-is */
        }
      }

      await this.setMetadata({ lastIncrementalSync: Date.now() });
    } catch (err) {
      console.warn('[Offline] Incremental sync failed (will retry later)', err);
    }
  }

  // ── CATALOG DELTA (Refresh button only) ───────────────────────
  /**
   * Cheap catalog refresh. Fetches ONLY the lightweight test index
   * (id, course, question_count, updated_at) — never `select('*')` on
   * `questions`, never the whole table.
   *
   * A test's questions are re-downloaded only when:
   *   • the local cache has no rows for it, or
   *   • the cached row count differs from the server's `question_count`, or
   *   • the server `updated_at` is newer than the last catalog scan.
   *
   * Everything else is skipped, so "Refresh with no author changes" costs a
   * single small tests-index query plus the user sync.
   */
  async refreshCatalogDelta(
    userId: string,
    onProgress?: (p: SyncProgress) => void,
    selectedCourse?: string
  ): Promise<{ newTests: number; updatedTests: number; unchangedTests: number }> {
    return this._runCategory(
      'catalog',
      (report) => this.runCatalogDelta(userId, report, selectedCourse),
      onProgress
    );
  }

  private async runCatalogDelta(
    userId: string,
    report: (p: SyncProgress) => void,
    selectedCourse?: string
  ): Promise<{ newTests: number; updatedTests: number; unchangedTests: number }> {
    const cancelled = () => this._isCancelled('catalog');
    const meta = await this.getMetadata();

    let course = selectedCourse;
    if (!course) {
      try {
        const stored = await AsyncStorage.getItem('selectedCourse');
        if (stored) course = stored;
      } catch {}
    }
    if (!course) course = 'Civil Services';

    report({ phase: 'tests', current: 0, total: 1, detail: 'Checking for new tests...' });

    // Lightweight index — 4 small columns, no question payload.
    const { data: testIndex, error: idxErr } = await supabase
      .from('tests')
      .select('id, course, question_count, updated_at');
    if (idxErr) throw idxErr;

    const allTests = testIndex ?? [];
    const courseTests = allTests.filter((t: any) => t.course === course);

    // Merge the index into the locally cached test catalogue so titles etc.
    // (already fetched during Download) are preserved for tests we skip.
    const cachedTests = this.getOfflineTestsSync();
    const cachedById = new Map(cachedTests.map((t: any) => [t.id, t]));
    const mergedTests = cachedTests.map((t: any) => {
      const fresh = courseTests.find((c: any) => c.id === t.id);
      return fresh ? { ...t, question_count: fresh.question_count, updated_at: fresh.updated_at } : t;
    });
    for (const fresh of courseTests) {
      if (!cachedById.has(fresh.id)) mergedTests.push(fresh);
    }
    KVStore.setJson(OFFLINE_TESTS_KEY, mergedTests);

    let newTests = 0;
    let updatedTests = 0;
    let unchangedTests = 0;
    let downloadedQuestions = 0;

    const total = courseTests.length;
    for (let i = 0; i < total; i++) {
      if (cancelled()) return { newTests, updatedTests, unchangedTests };
      const test = courseTests[i];
      report({
        phase: 'questions',
        current: i,
        total,
        detail: `Checking ${test.id}  (${i + 1}/${total})`,
      });

      const cachedQs = QuestionCache.getCachedQuestionsSync(test.id);
      const expectedCount = test.question_count || 0;
      const isKnown = cachedById.has(test.id);
      const cachedUpdatedAt = cachedById.get(test.id)?.updated_at ?? null;

      const countChanged = cachedQs.length > 0 && expectedCount > 0 && cachedQs.length !== expectedCount;
      const contentChanged =
        isKnown && cachedQs.length > 0 && cachedUpdatedAt && test.updated_at && test.updated_at !== cachedUpdatedAt;
      const neverCached = cachedQs.length === 0;

      if (!neverCached && !countChanged && !contentChanged) {
        unchangedTests += 1;
        continue;
      }

      if (neverCached) newTests += 1;
      else updatedTests += 1;

      try {
        const questions = await this.fetchAllRows(
          'questions',
          (query) =>
            query
              .eq('test_id', test.id)
              .order('question_number', { ascending: true })
              .order('id', { ascending: true })
        );
        if (questions && questions.length > 0) {
          await QuestionCache.cacheQuestions(test.id, questions);
          downloadedQuestions += questions.length;
        }
      } catch (err) {
        console.warn(`[Offline] Catalog delta failed for test ${test.id}`, err);
      }
    }

    report({
      phase: 'questions',
      current: total,
      total,
      detail: `${downloadedQuestions} questions fetched (${unchangedTests} tests unchanged)`,
    });
    if (cancelled()) return { newTests, updatedTests, unchangedTests };

    // Pull user rows too so tags/notes/progress land in the same pass.
    await this.syncUserData(userId);

    // ── New media only ────────────────────────────────────────────
    // Author edits can introduce fresh images; cache just the URLs that are not
    // already on disk. Already-cached ones are skipped, so a no-change refresh
    // costs nothing here.
    let totalMedia = meta.totalMedia ?? 0;
    try {
      if (!cancelled()) {
        await MediaCacheService.init();
        const rows: any[] = [];
        for (const test of courseTests) {
          if (cancelled()) break;
          rows.push(...QuestionCache.getCachedQuestionsSync(test.id));
        }
        const urls = collectQuestionMediaUrls(rows);
        const cards = KVStore.getJson<any[]>(CARDS_PREFIX) ?? [];
        for (const u of collectCardMediaUrls(cards)) {
          if (!urls.includes(u)) urls.push(u);
        }
        totalMedia = urls.length;

        const result = await MediaCacheService.cacheUrls(
          urls,
          (done, t, skipped) => {
            report({
              phase: 'media',
              current: done,
              total: t,
              detail: `Images ${done}/${t} (${skipped} already saved)`,
            });
          },
          cancelled
        );
        if (result.done > 0) {
          console.log(`[Offline] Refresh cached ${result.done} new image(s)`);
        }
      }
    } catch (err) {
      console.warn('[Offline] Refresh media phase failed', err);
    }

    await this.setMetadata({
      lastCatalogScan: Date.now(),
      lastIncrementalSync: Date.now(),
      totalTests: mergedTests.length,
      totalQuestions: QuestionCache.getCachedTestIdsSync().length > 0
        ? this.getOfflineQuestionsAllSync().length
        : meta.totalQuestions,
      totalMedia,
      totalMediaCached: MediaCacheService.cachedCount(),
    });
    report({ phase: 'done', current: 1, total: 1, detail: 'Up to date!' });

    return { newTests, updatedTests, unchangedTests };
  }

  /** True when a previously-completed download exists for this course. */
  hasCompletedDownload(course?: string): boolean {
    const meta = KVStore.getJson<OfflineMetadata>(OFFLINE_META_KEY);
    if (!meta?.lastFullSync) return false;
    if (course) return this.getOfflineQuestionsForCourseSync(course).length > 0;
    return this.getOfflineQuestionsAllSync().length > 0;
  }

  /**
   * Resume the image phase only. Reuses the already-cached questions — it
   * never re-fetches rows from Supabase, so the cost is purely R2 bandwidth.
   *
   * Kept for the existing Profile "Download remaining images" row; new UI
   * should prefer `downloadTopperImages` / `downloadCardImages`.
   */
  async downloadRemainingMedia(
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ done: number; skipped: number; failed: number }> {
    return this.downloadTopperImages(onProgress);
  }

  // ── PER-CATEGORY IMAGE DOWNLOADS ──────────────────────────────
  /**
   * Topper copies (mains answer sheets) plus any images embedded in question
   * explanations. Idempotent: URLs already on disk are skipped, so this doubles
   * as the "Download remaining images" resume path.
   */
  async downloadTopperImages(
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ done: number; skipped: number; failed: number }> {
    return this._runCategory(
      'topperImages',
      async (report) => {
        const cancelled = () => this._isCancelled('topperImages');
        await MediaCacheService.init();

        // 1. Mains topper answer-sheet pages (multi-page A4 images).
        const mainsQuestions = KVStore.getJson<any[]>(MAINS_QUESTIONS_CACHE_KEY) ?? [];
        let topperDone = 0;
        let topperFailed = 0;
        if (mainsQuestions.length > 0 && !cancelled()) {
          try {
            const res = await TopperImageCacheService.syncAllTopperImages(
              mainsQuestions,
              (current, total) => {
                report({
                  phase: 'topper',
                  current,
                  total,
                  detail: `Topper copies ${current}/${total}`,
                });
              }
            );
            topperDone = res.success;
            topperFailed = res.failed;
          } catch (err) {
            console.warn('[Offline] Topper image sync failed', err);
          }
        }

        // 2. Images embedded in question text/explanations.
        const urls = collectQuestionMediaUrls(this.getOfflineQuestionsAllSync());
        const mediaResult = await MediaCacheService.cacheUrls(
          urls,
          (done, total, skipped) => {
            report({
              phase: 'media',
              current: done,
              total,
              detail: `Question images ${done}/${total} (${skipped} already saved)`,
            });
          },
          cancelled
        );

        await this.setMetadata({
          lastTopperImageSync: Date.now(),
          totalTopperImages: topperDone + topperFailed,
          topperImageCount: TopperImageCacheService.cachedCount(),
          totalMedia: urls.length,
          totalMediaCached: MediaCacheService.cachedCount(),
          mediaPhaseCancelled: false,
        });
        report({ phase: 'done', current: 1, total: 1, detail: 'Topper images downloaded!' });
        return mediaResult;
      },
      onProgress
    );
  }

  /**
   * Flashcard front/back photos. Reads `@cards_all` only — never hits Supabase,
   * so the cost is purely R2 bandwidth. Skips URLs already on disk.
   */
  async downloadCardImages(
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ done: number; skipped: number; failed: number }> {
    return this._runCategory(
      'cardImages',
      async (report) => {
        const cancelled = () => this._isCancelled('cardImages');
        await MediaCacheService.init();

        const cards = KVStore.getJson<any[]>(CARDS_PREFIX) ?? [];
        const urls = collectCardMediaUrls(cards);

        report({
          phase: 'media',
          current: 0,
          total: urls.length,
          detail: urls.length === 0 ? 'No flashcard images found' : 'Caching flashcard images...',
        });

        const result = await MediaCacheService.cacheUrls(
          urls,
          (done, total, skipped) => {
            report({
              phase: 'media',
              current: done,
              total,
              detail: `Flashcard images ${done}/${total} (${skipped} already saved)`,
            });
          },
          cancelled
        );

        await this.setMetadata({
          lastCardImageSync: Date.now(),
          totalCardImages: urls.length,
          cardImageCount: urls.filter((u) => MediaCacheService.isCached(u)).length,
        });
        report({ phase: 'done', current: 1, total: 1, detail: 'Flashcard images downloaded!' });
        return result;
      },
      onProgress
    );
  }

  /**
   * Topper-image delta. Only downloads URLs that are not already on disk, so a
   * no-change refresh transfers nothing beyond the local index lookup.
   */
  async refreshTopperImagesDelta(onProgress?: (p: SyncProgress) => void) {
    return this.downloadTopperImages(onProgress);
  }

  /** Flashcard-image delta. `cacheUrls` skips cached URLs by construction. */
  async refreshCardImagesDelta(onProgress?: (p: SyncProgress) => void) {
    return this.downloadCardImages(onProgress);
  }

  // ── VALUE-ADDS ────────────────────────────────────────────────
  /**
   * Download the question bank for the active course, plus the mains value-add
   * corpus. Reuses `downloadCourseCatalog` so already-cached tests are skipped —
   * this doubles as a top-up for a partially-downloaded bank.
   */
  async downloadQuestions(
    userId: string,
    selectedCourse?: string,
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ questions: number; valueAdds: number; mainsQuestions: number }> {
    return this._runCategory(
      'catalog',
      async (report) => {
        const questions = await this.downloadCourseCatalog(userId, report, selectedCourse);
        // Mains corpus (questions + value-adds + diagram images).
        const { mainsQuestions, valueAdds } = await this.downloadMainsCorpus(report);

        await this.setMetadata({ lastCatalogSync: Date.now() });
        return { questions, valueAdds, mainsQuestions };
      },
      onProgress
    );
  }

  /**
   * Download (or force re-download) the mains value-add corpus. Value-adds are
   * small JSON rows, so this is cheap compared to the question bank — the only
   * expensive part is their diagram images, which are cached via MediaCacheService.
   */
  async downloadValueAdds(
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ total: number }> {
    return this._runCategory(
      'catalog',
      async (report) => {
        const cancelled = () => this._isCancelled('catalog');
        report({ phase: 'valueadds', current: 0, total: 1, detail: 'Fetching value-adds...' });

        const items = await fetchValueAdditionFromSupabase();
        if (cancelled()) return { total: items.length };

        KVStore.setJson(MAINS_VALUE_ADD_CACHE_KEY, items);

        // Cache their diagram images so ethics/framework visuals work offline.
        let imageCount = 0;
        try {
          const urls = collectValueAddMediaUrls(items);
          if (urls.length > 0) {
            await MediaCacheService.init();
            const res = await MediaCacheService.cacheUrls(
              urls,
              (done, total) => {
                report({
                  phase: 'valueadds',
                  current: done,
                  total,
                  detail: `Value-add images ${done}/${total}`,
                });
              },
              cancelled
            );
            imageCount = res.done + res.skipped;
          }
        } catch (err) {
          console.warn('[Offline] Value-add image caching failed', err);
        }

        let fingerprint: string | null = null;
        try {
          fingerprint = hashFingerprint(await fetchValueAddFingerprint());
        } catch { /* offline — leave fingerprint unset */ }

        await this.setMetadata({
          lastCatalogSync: Date.now(),
          totalValueAdds: items.length,
          valueAddFingerprint: fingerprint,
          totalMedia: MediaCacheService.cachedCount(),
        });
        report({
          phase: 'done',
          current: 1,
          total: 1,
          detail: `${items.length} value-adds saved (${imageCount} images)`,
        });
        return { total: items.length };
      },
      onProgress
    );
  }

  /**
   * Value-add delta. Compares a cheap id-only fingerprint against the stored one
   * and only re-fetches the corpus when something was added or removed.
   *
   * These tables have no `updated_at`, so an in-place edit preserving the id set
   * is undetectable — use `downloadValueAdds` to force a full refresh.
   */
  async refreshValueAddsDelta(
    onProgress?: (p: SyncProgress) => void
  ): Promise<{ changed: boolean; total: number }> {
    return this._runCategory(
      'catalog',
      async (report) => {
        const meta = await this.getMetadata();
        const cached = KVStore.getJson<any[]>(MAINS_VALUE_ADD_CACHE_KEY) ?? [];
        report({ phase: 'valueadds', current: 0, total: 1, detail: 'Checking value-adds...' });

        let remoteFingerprint = '';
        try {
          remoteFingerprint = hashFingerprint(await fetchValueAddFingerprint());
        } catch {
          // Offline / probe failed: keep whatever we have.
          return { changed: false, total: cached.length };
        }

        if (remoteFingerprint === meta.valueAddFingerprint) {
          report({ phase: 'done', current: 1, total: 1, detail: 'Value-adds already up to date' });
          return { changed: false, total: cached.length };
        }

        const items = await fetchValueAdditionFromSupabase();
        KVStore.setJson(MAINS_VALUE_ADD_CACHE_KEY, items);

        try {
          const urls = collectValueAddMediaUrls(items);
          if (urls.length > 0) {
            await MediaCacheService.init();
            await MediaCacheService.cacheUrls(urls, undefined, () => this._isCancelled('catalog'));
          }
        } catch (err) {
          console.warn('[Offline] Value-add image refresh failed', err);
        }

        await this.setMetadata({
          lastCatalogSync: Date.now(),
          totalValueAdds: items.length,
          valueAddFingerprint: remoteFingerprint,
        });
        report({
          phase: 'done',
          current: 1,
          total: 1,
          detail: `${items.length} value-adds updated`,
        });
        return { changed: true, total: items.length };
      },
      onProgress
    );
  }

  // ── READERS (all synchronous via KVStore) ─────────────────────
  async getOfflineTests(): Promise<any[]> {
    return KVStore.getJson<any[]>(OFFLINE_TESTS_KEY) ?? [];
  }

  getOfflineTestsSync(): any[] {
    return KVStore.getJson<any[]>(OFFLINE_TESTS_KEY) ?? [];
  }

  getCollectionSync(table: string, userId?: string): any[] {
    switch (table) {
      case 'tests':
        return this.getOfflineTestsSync();
      case 'questions':
        return this.getOfflineQuestionsAllSync();
      case 'cards':
        return KVStore.getJson<any[]>(CARDS_PREFIX) ?? [];
      case 'card_folder_map':
        return KVStore.getJson<any[]>(CARD_FOLDER_MAP_KEY) ?? [];
      case 'question_states':
        return this.readUserScoped(USER_STATES_PREFIX, userId);
      case 'test_attempts':
        return this.readUserScoped(USER_ATTEMPTS_PREFIX, userId);
      case 'user_cards':
        return this.readUserScoped(USER_CARDS_PREFIX, userId);
      case 'card_reviews':
        return this.readUserScoped(USER_CARD_REVIEWS_PREFIX, userId, '@user_card_reviews_offline');
      case 'study_sessions':
        return this.readUserScoped(USER_STUDY_SESSIONS_PREFIX, userId, '@user_study_sessions_offline');
      case 'user_notes':
        return this.readUserScoped(USER_NOTES_PREFIX, userId);
      case 'user_note_nodes':
        return this.readUserScoped(USER_NOTE_NODES_PREFIX, userId);
      case 'folders':
        return this.readUserScoped(USER_FOLDERS_PREFIX, userId);
      case 'flashcard_branches':
        return this.readUserScoped(USER_BRANCHES_PREFIX, userId);
      case 'flashcard_branch_cards':
        return this.readUserScoped(USER_BRANCH_CARDS_PREFIX, userId);
      case 'draft_attempts':
        return this.readUserScoped(USER_DRAFT_ATTEMPTS_PREFIX, userId);
      case 'user_settings':
        return this.readUserScoped(USER_SETTINGS_PREFIX, userId);
      case 'user_widgets':
        return this.readUserScoped(USER_WIDGETS_PREFIX, userId);
      case 'user_tags':
        return this.readUserScoped(USER_TAGS_PREFIX, userId);
      case 'user_syllabus_progress':
        return this.readUserScoped(USER_SYLLABUS_PROGRESS_PREFIX, userId);
      case 'prompt_templates':
        return this.readUserScoped(USER_PROMPT_TEMPLATES_PREFIX, userId);
      case 'folder_algorithm_settings':
        return this.readUserScoped(USER_FOLDER_ALGO_SETTINGS_PREFIX, userId);
      case 'user_best_answers':
        return this.readUserScoped(USER_BEST_ANSWERS_PREFIX, userId);
      default:
        return [];
    }
  }

  private readUserScoped(prefix: string, userId?: string, fallbackKey?: string): any[] {
    if (userId) return KVStore.getJson<any[]>(`${prefix}${userId}`) ?? [];
    const rows = KVStore.getAllKeys()
      .filter((k) => k.startsWith(prefix))
      .flatMap((k) => KVStore.getJson<any[]>(k) ?? []);
    if (rows.length > 0) return rows;
    return fallbackKey ? (KVStore.getJson<any[]>(fallbackKey) ?? []) : [];
  }

  getOfflineQuestionsAllSync(): any[] {
    const tests = this.getOfflineTestsSync();
    const cachedTestIds = QuestionCache.getCachedTestIdsSync();
    const testIds = Array.from(new Set([
      ...tests.map((t: any) => t.id).filter(Boolean),
      ...cachedTestIds,
    ]));
    const out: any[] = [];
    for (const testId of testIds) {
      out.push(...QuestionCache.getCachedQuestionsSync(testId));
    }
    return out;
  }

  getOfflineQuestionsForCourseSync(course: string): any[] {
    const tests = this.getOfflineTestsSync().filter((t: any) => t.course === course);
    const cachedTestIds = QuestionCache.getCachedTestIdsSync();
    // Filter test IDs by matching tests for this course
    const testIds = Array.from(new Set([
      ...tests.map((t: any) => t.id).filter(Boolean),
    ])).filter(id => cachedTestIds.includes(id));
    const out: any[] = [];
    for (const testId of testIds) {
      out.push(...QuestionCache.getCachedQuestionsSync(testId));
    }
    return out;
  }

  getOfflineQuestionsEnrichedSync() {
    const questions = this.getOfflineQuestionsAllSync();
    const tests = this.getOfflineTestsSync();
    const tById = new Map(tests.map((t: any) => [t.id, t]));
    return questions.map((q: any) => {
      const t = tById.get(q.test_id);
      return {
        ...q,
        tests: t ?? null,
        _institute: t?.institute ?? null,
        _program_id: t?.program_id ?? null,
        _program_name: t?.program_name ?? null,
        _series: t?.series ?? null,
        _level: t?.level ?? null,
        _launch_year: t?.launch_year ?? null,
        _paper_type: t?.paper_type ?? null,
        _provider: t?.provider ?? null,
      };
    });
  }

  getOfflineFacets() {
    const tests = this.getOfflineTestsSync();
    const uniq = (arr: any[]) => Array.from(new Set(arr.filter(Boolean))).sort();
    return {
      institutes: uniq(tests.map((t: any) => t.institute)),
      program_ids: uniq(tests.map((t: any) => t.program_id)),
      program_names: uniq(tests.map((t: any) => t.program_name)),
      series: uniq(tests.map((t: any) => t.series)),
      levels: uniq(tests.map((t: any) => t.level)),
      paper_types: uniq(tests.map((t: any) => t.paper_type)),
      launch_years: uniq(tests.map((t: any) => t.launch_year)),
    };
  }

  async getOfflineQuestions(testId: string): Promise<any[]> {
    return KVStore.getJson<any[]>(`@questions_${testId}`) ?? [];
  }

  async getOfflineQuestionsByIds(ids: string[]): Promise<any[]> {
    const testIds = await QuestionCache.getCachedTestIds();
    const results: any[] = [];
    const idSet = new Set(ids);
    for (const tid of testIds) {
      const questions = await this.getOfflineQuestions(tid);
      for (const q of questions) {
        if (idSet.has(q.id)) {
          results.push(q);
          idSet.delete(q.id);
        }
      }
      if (idSet.size === 0) break;
    }
    return results;
  }

  async getOfflineUserStates(userId: string): Promise<any[]> {
    return KVStore.getJson<any[]>(`${USER_STATES_PREFIX}${userId}`) ?? [];
  }

  async getOfflineNotes(userId: string): Promise<any[]> {
    return KVStore.getJson<any[]>(`${USER_NOTES_PREFIX}${userId}`) ?? [];
  }

  async getOfflineAttempts(userId: string): Promise<any[]> {
    if (!userId) return [];
    return KVStore.getJson<any[]>(`${USER_ATTEMPTS_PREFIX}${userId}`) ?? [];
  }

  async getConsolidatedMetadata(): Promise<any[]> {
    // Try MMKV cache first for instant return
    const cached = KVStore.getJson<any[]>(OFFLINE_METADATA_CONSOLIDATED_KEY);
    
    // Rebuild in background
    const buildMetadata = async () => {
      const tests = await this.getOfflineTests();
      if (!tests || tests.length === 0) return [];
      const flattened: any[] = [];
      for (const t of tests) {
        const questions = await this.getOfflineQuestions(t.id);
        // Determine course from test or fallback to first question's course
        const testCourse = t.course || 'Civil Services';
        if (questions.length === 0) {
          const cat = String(t.program_id || '').toLowerCase();
          let derivedInst = t.institute || (cat === 'inicet' ? 'AIIMS' : cat === 'neetpg' ? 'NBE' : cat === 'cms' ? 'UPSC' : null);
          const derivedProg = t.program_name || (cat === 'inicet' ? 'INI-CET' : cat === 'neetpg' ? 'NEET PG' : cat === 'cms' ? 'CMS' : null);

          flattened.push({
            course: testCourse,
            subject: null, section_group: null, micro_topic: null,
            is_ncert: null,
            test_id: t.id, institute: derivedInst, program_name: derivedProg,
            series: t.series, title: t.title,
            exam_category: t.program_id || null,
            exam_stage: null,
          });
        } else {
          for (const q of questions) {
            const cat = String(q.exam_category || t.program_id || '').toLowerCase();
            let derivedInst = t.institute || (
              cat === 'inicet' || q.is_inicet ? 'AIIMS' :
              cat === 'neetpg' || q.is_neetpg ? 'NBE' :
              cat === 'cms' || q.is_upsc_cms ? 'UPSC' : null
            );
            const derivedProg = t.program_name || (
              cat === 'inicet' || q.is_inicet ? 'INI-CET' :
              cat === 'neetpg' || q.is_neetpg ? 'NEET PG' :
              cat === 'cms' || q.is_upsc_cms ? 'CMS' : null
            );

            const qCourse = q.course || testCourse;

            flattened.push({
              course: qCourse,
              subject: q.subject || null,
              section_group: q.section_group || null,
              micro_topic: q.micro_topic || null,
              is_ncert: q.is_ncert ?? null,
              test_id: t.id, institute: derivedInst, program_name: derivedProg,
              series: t.series, title: t.title,
              exam_category: q.exam_category || t.program_id || null,
              exam_stage: q.exam_stage || null,
              is_inicet: q.is_inicet,
              is_neetpg: q.is_neetpg,
              is_upsc_cms: q.is_upsc_cms,
            });
          }
        }
      }
      // Persist to MMKV for next cold start
      if (flattened.length > 0) {
        KVStore.setJson(OFFLINE_METADATA_CONSOLIDATED_KEY, flattened);
      }
      return flattened;
    };

    if (cached && Array.isArray(cached) && cached.length > 0) {
      const firstItem = cached[0];
      // If the first item has the 'exam_stage' property, the cache is up-to-date.
      if (firstItem && 'exam_stage' in firstItem) {
        // Return cached immediately, refresh in background
        buildMetadata().catch(console.error);
        return cached;
      }
      console.log('[OfflineManager] Old cached metadata schema detected. Rebuilding consolidated metadata synchronously...');
    }

    // No cache, empty cache, or old schema: build synchronously
    return buildMetadata();
  }

  async getOfflineCards(userId: string): Promise<any[]> {
    return KVStore.getJson<any[]>(`${USER_CARDS_PREFIX}${userId}`) ?? [];
  }

  async getOfflineFilterLists() {
    const tests = await this.getOfflineTests();
    const institutes = Array.from(new Set(tests.map((t) => t.institute).filter(Boolean))).sort();
    const programs = Array.from(new Set(tests.map((t) => t.program_name).filter(Boolean))).sort();
    return { institutes, programs, tests };
  }

  // ── CLEAR ─────────────────────────────────────────────────────
  /**
   * Remove the mains caches that live outside the generic prefixes.
   *
   * These were previously missed by `clearAllOfflineData`, so mains questions and
   * value-adds kept loading offline after a clear — the data was still in MMKV.
   */
  private clearMainsCaches() {
    KVStore.delete(MAINS_QUESTIONS_CACHE_KEY);
    KVStore.delete(MAINS_VALUE_ADD_CACHE_KEY);
    KVStore.deletePrefix('@mains_');
  }

  /**
   * Clear one category's on-disk cache without touching the others. Lets a user
   * reclaim space from the (large) topper pages while keeping questions offline.
   */
  async clearCategoryCache(category: 'topperImages' | 'cardImages') {
    if (category === 'topperImages') {
      await TopperImageCacheService.clearCache();
      // Topper pages are referenced by the mains question rows; clearing the
      // images must not leave the (large) mains catalogue behind either, or the
      // user sees "cleared" but still has mains content offline.
      this.clearMainsCaches();
      await this.setMetadata({
        lastTopperImageSync: null,
        totalTopperImages: 0,
        topperImageCount: 0,
        totalMediaCached: MediaCacheService.cachedCount(),
      });
      return;
    }
    // Flashcard images share the general media cache with question images, so we
    // only forget the card-owned entries rather than wiping the whole folder.
    const cards = KVStore.getJson<any[]>(CARDS_PREFIX) ?? [];
    const urls = collectCardMediaUrls(cards);
    MediaCacheService.forget(urls);
    await this.setMetadata({
      lastCardImageSync: null,
      totalCardImages: 0,
      cardImageCount: 0,
    });
  }

  async clearAllOfflineData() {
    await QuestionCache.clearCache();
    try { await MediaCacheService.clearCache(); } catch { /* best-effort */ }
    try { await TopperImageCacheService.clearCache(); } catch { /* best-effort */ }
    this.clearMainsCaches();
    KVStore.delete(OFFLINE_META_KEY);
    KVStore.delete(OFFLINE_TESTS_KEY);
    KVStore.delete(OFFLINE_METADATA_CONSOLIDATED_KEY);
    KVStore.deletePrefix(USER_STATES_PREFIX);
    KVStore.deletePrefix(USER_NOTES_PREFIX);
    KVStore.deletePrefix(USER_NOTE_NODES_PREFIX);
    KVStore.deletePrefix(USER_ATTEMPTS_PREFIX);
    KVStore.deletePrefix(USER_CARDS_PREFIX);
    KVStore.deletePrefix(CARDS_PREFIX);
    KVStore.deletePrefix(USER_CARD_REVIEWS_PREFIX);
    KVStore.deletePrefix(USER_STUDY_SESSIONS_PREFIX);
    KVStore.deletePrefix(USER_FOLDERS_PREFIX);
    KVStore.deletePrefix(USER_BRANCHES_PREFIX);
    KVStore.deletePrefix(USER_BRANCH_CARDS_PREFIX);
    KVStore.deletePrefix(USER_DRAFT_ATTEMPTS_PREFIX);
    KVStore.deletePrefix(USER_SETTINGS_PREFIX);
    KVStore.deletePrefix(USER_WIDGETS_PREFIX);
    KVStore.deletePrefix(USER_TAGS_PREFIX);
    KVStore.deletePrefix(USER_SYLLABUS_PROGRESS_PREFIX);
    KVStore.deletePrefix(USER_PROMPT_TEMPLATES_PREFIX);
    KVStore.deletePrefix(USER_FOLDER_ALGO_SETTINGS_PREFIX);
    KVStore.deletePrefix(USER_BEST_ANSWERS_PREFIX);
    KVStore.delete(CARD_FOLDER_MAP_KEY);
  }

  // ── HELPERS ───────────────────────────────────────────────────
  formatSyncAge(timestamp: number | null): string {
    if (!timestamp) return 'Never synced';
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
}

export const OfflineManager = new OfflineManagerService();
