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
import { QuestionCache } from './QuestionCache';

// ─── Storage Keys ────────────────────────────────────────────────
const OFFLINE_META_KEY     = '@offline_meta';
const OFFLINE_TESTS_KEY    = '@offline_tests';
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
const CARD_FOLDER_MAP_KEY = '@card_folder_map_all';
const OFFLINE_SYNC_VERSION = 3;

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
};

// ─── Types ───────────────────────────────────────────────────────
export interface OfflineMetadata {
  lastFullSync: number | null;
  lastIncrementalSync: number | null;
  syncVersion?: number;
  totalQuestions: number;
  totalTests: number;
  totalStates: number;
  totalNotes: number;
  totalAttempts: number;
  totalCards: number;
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

// ─── Service ─────────────────────────────────────────────────────
class OfflineManagerService {
  private _cancelled = false;
  private _fullSyncPromise: Promise<void> | null = null;

  private async fetchAllRows(
    table: string,
    applyFilters?: (query: any) => any,
    chunk = 1000
  ): Promise<any[]> {
    const rows: any[] = [];
    let from = 0;

    while (true) {
      if (this._cancelled) return rows;

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
  cancelSync() { this._cancelled = true; }

  // ── FULL SYNC ─────────────────────────────────────────────────
  async syncAllContent(
    userId: string,
    onProgress: (p: SyncProgress) => void
  ) {
    if (this._fullSyncPromise) return this._fullSyncPromise;

    this._fullSyncPromise = this.runFullSync(userId, onProgress).finally(() => {
      this._fullSyncPromise = null;
    });
    return this._fullSyncPromise;
  }

  private async runFullSync(
    userId: string,
    onProgress: (p: SyncProgress) => void
  ) {
    this._cancelled = false;
    let totalQuestions = 0;

    // ──────── 1. TESTS ──────────────────────────────────────────
    onProgress({ phase: 'tests', current: 0, total: 1, detail: 'Fetching test catalogue...' });

    const tests = await this.fetchAllRows('tests');
    if (!tests || tests.length === 0) throw new Error('No tests found on server');

    KVStore.setJson(OFFLINE_TESTS_KEY, tests);
    onProgress({ phase: 'tests', current: 1, total: 1, detail: `${tests.length} tests saved` });
    if (this._cancelled) return;

    // ──────── 2. QUESTIONS (chunked by test) ────────────────────
    const totalTests = tests.length;
    for (let i = 0; i < totalTests; i++) {
      if (this._cancelled) return;
      const test = tests[i];
      onProgress({
        phase: 'questions',
        current: i,
        total: totalTests,
        detail: `${test.title || test.id}  (${i + 1}/${totalTests})`,
      });

      try {
        const questions = await this.fetchAllRows(
          'questions',
          (query) => query.eq('test_id', test.id)
        );

        if (questions && questions.length > 0) {
          await QuestionCache.cacheQuestions(test.id, questions);
          totalQuestions += questions.length;
        }
      } catch (err) {
        console.warn(`[Offline] Failed to cache test ${test.id}`, err);
      }
    }
    onProgress({ phase: 'questions', current: totalTests, total: totalTests, detail: `${totalQuestions} questions saved` });
    if (this._cancelled) return;

    // ──────── 3. USER QUESTION STATES (paginated) ───────────────
    onProgress({ phase: 'states', current: 0, total: 1, detail: 'Fetching your tags, bookmarks & notes...' });
    let totalStates = 0;
    try {
      const allStates: any[] = [];
      let from = 0;
      const CHUNK = 1000;
      while (true) {
        if (this._cancelled) return;
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
    onProgress({ phase: 'states', current: 1, total: 1, detail: `${totalStates} question states saved` });
    if (this._cancelled) return;

    // ──────── 4. USER NOTES ─────────────────────────────────────
    onProgress({ phase: 'notes', current: 0, total: 1, detail: 'Fetching your notebooks...' });
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
    onProgress({ phase: 'notes', current: 1, total: 1, detail: `${totalNotes} notebooks saved` });
    if (this._cancelled) return;

    // ──────── 5. TEST ATTEMPTS ──────────────────────────────────
    onProgress({ phase: 'attempts', current: 0, total: 1, detail: 'Fetching your test attempts...' });
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
    onProgress({ phase: 'attempts', current: 1, total: 1, detail: `${totalAttempts} attempts saved` });
    if (this._cancelled) return;

    // ──────── 6. FLASHCARD DATA ─────────────────────────────────
    onProgress({ phase: 'cards', current: 0, total: 1, detail: 'Fetching your flashcards...' });
    let totalCards = 0;
    try {
      const cards = await this.fetchAllRows('cards');
      if (cards) KVStore.setJson(CARDS_PREFIX, cards);

      const userCards = await this.fetchAllRows(
        'user_cards',
        (query) => query.eq('user_id', userId)
      );
      if (userCards) {
        KVStore.setJson(`${USER_CARDS_PREFIX}${userId}`, userCards);
        totalCards = userCards.length;
      }

      const userTables: Array<[string, string]> = [
        ['card_reviews', `${USER_CARD_REVIEWS_PREFIX}${userId}`],
        ['study_sessions', `${USER_STUDY_SESSIONS_PREFIX}${userId}`],
        ['user_note_nodes', `${USER_NOTE_NODES_PREFIX}${userId}`],
        ['folders', `${USER_FOLDERS_PREFIX}${userId}`],
        ['flashcard_branches', `${USER_BRANCHES_PREFIX}${userId}`],
        ['flashcard_branch_cards', `${USER_BRANCH_CARDS_PREFIX}${userId}`],
        ['draft_attempts', `${USER_DRAFT_ATTEMPTS_PREFIX}${userId}`],
        ['user_settings', `${USER_SETTINGS_PREFIX}${userId}`],
        ['user_widgets', `${USER_WIDGETS_PREFIX}${userId}`],
      ];
      for (const [table, key] of userTables) {
        const data = await this.fetchAllRows(
          table,
          (query) => query.eq('user_id', userId)
        );
        if (data) KVStore.setJson(key, data);
      }

      const cardFolderMap = await this.fetchAllRows('card_folder_map');
      if (cardFolderMap) KVStore.setJson(CARD_FOLDER_MAP_KEY, cardFolderMap);
    } catch (err) {
      console.warn('[Offline] Failed to fetch flashcard data', err);
    }
    onProgress({ phase: 'cards', current: 1, total: 1, detail: `${totalCards} flashcards saved` });

    // ──────── FINALIZE ──────────────────────────────────────────
    await this.setMetadata({
      lastFullSync: Date.now(),
      lastIncrementalSync: Date.now(),
      syncVersion: OFFLINE_SYNC_VERSION,
      totalQuestions,
      totalTests: tests.length,
      totalStates,
      totalNotes,
      totalAttempts,
      totalCards,
    });
    onProgress({ phase: 'done', current: 1, total: 1, detail: 'All data downloaded!' });
  }

  // ── INCREMENTAL SYNC ──────────────────────────────────────────
  async incrementalSync(userId: string) {
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

      await this.setMetadata({ lastIncrementalSync: Date.now() });
    } catch (err) {
      console.warn('[Offline] Incremental sync failed (will retry later)', err);
    }
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
    const tests = await this.getOfflineTests();
    if (!tests || tests.length === 0) return [];
    const flattened: any[] = [];
    for (const t of tests) {
      const questions = await this.getOfflineQuestions(t.id);
      if (questions.length === 0) {
        flattened.push({
          subject: null, section_group: null, micro_topic: null,
          test_id: t.id, institute: t.institute, program_name: t.program_name,
          series: t.series, title: t.title,
        });
      } else {
        for (const q of questions) {
          flattened.push({
            subject: q.subject || null,
            section_group: q.section_group || null,
            micro_topic: q.micro_topic || null,
            test_id: t.id, institute: t.institute, program_name: t.program_name,
            series: t.series, title: t.title,
          });
        }
      }
    }
    return flattened;
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
  async clearAllOfflineData() {
    await QuestionCache.clearCache();
    KVStore.delete(OFFLINE_META_KEY);
    KVStore.delete(OFFLINE_TESTS_KEY);
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
