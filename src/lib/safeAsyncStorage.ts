/**
 * safeAsyncStorage — a thin wrapper around AsyncStorage that survives the
 * Android `SQLITE_FULL` (code 13) failure mode reported in production.
 *
 * Background: AsyncStorage on Android is backed by a single SQLite database
 * with a default ~6 MB ceiling.  Several caches in this app (Vault, analytics,
 * notes, branch service) can grow well beyond that for power users, after
 * which every subsequent setItem throws and propagates as
 *   `Vault Engine Error: [Error: database or disk is full (code 13 SQLITE_FULL)]`
 *
 * Behaviour:
 *   - safeSetItem(key, value)
 *       Tries to write. If we hit SQLITE_FULL we evict known transient cache
 *       keys and retry once. If that also fails the call resolves silently —
 *       the caller is encouraged to treat caching as best-effort.
 *
 * The set of evictable keys lives here; add to it whenever you introduce a
 * new fat cache.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache key prefixes that are safe to drop on a full-disk recovery.
// All of these are recomputed from Supabase / network on next launch.
const EVICTABLE_PREFIXES = [
  'tagged_vault_cache_',   // useTaggedQuestions cache (largest culprit)
  'review_tag_catalog_',
  'analytics_cache_',      // useTestAnalytics
  'notes_pilot_vault_',    // useNotesPilotVault
  'branch_cache_',         // BranchService
  'branch_links_cache_',
  'branch_user_cards_cache_',
  'syllabus_cache_',
  'recent_searches',
  'ai_search_history',
  'recent_notes_v',
  'note_tag_catalog_',
  'pyq_filters_cache_',
  'g1:',                   // generic cache wrapper
];

const isQuotaError = (err: unknown): boolean => {
  const msg = String((err as any)?.message || err || '').toLowerCase();
  return (
    msg.includes('sqlite_full') ||
    msg.includes('database or disk is full') ||
    msg.includes('code 13') ||
    msg.includes('quotaexceeded')
  );
};

const evictTransientCaches = async (preserveKey?: string): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const victims = keys.filter(
      (k) =>
        k !== preserveKey &&
        EVICTABLE_PREFIXES.some((p) => k.startsWith(p))
    );
    if (victims.length > 0) {
      await AsyncStorage.multiRemove(victims);
    }
  } catch {
    // best-effort
  }
};

export const safeSetItem = async (
  key: string,
  value: string,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, value);
  } catch (err) {
    if (!isQuotaError(err)) {
      // not a disk-full issue — surface the original failure quietly
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[safeAsyncStorage] setItem failed', key, err);
      }
      return;
    }
    // Try to make room and retry once.
    await evictTransientCaches(key);
    try {
      await AsyncStorage.setItem(key, value);
    } catch (err2) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[safeAsyncStorage] setItem still failed after evict', key, err2);
      }
      // Caller is using AsyncStorage as a cache – swallow.
    }
  }
};

export const safeMultiSet = async (
  pairs: [string, string][],
): Promise<void> => {
  try {
    await AsyncStorage.multiSet(pairs);
  } catch (err) {
    if (!isQuotaError(err)) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[safeAsyncStorage] multiSet failed', err);
      }
      return;
    }
    await evictTransientCaches();
    try {
      await AsyncStorage.multiSet(pairs);
    } catch {
      // swallow
    }
  }
};
