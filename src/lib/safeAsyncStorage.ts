/**
 * safeAsyncStorage — KVStore-backed cache writes for "fat" derived caches.
 *
 * Background: AsyncStorage on Android is backed by a single SQLite database
 * with a default ~6 MB ceiling. Several caches in this app (Vault, analytics,
 * notes, branch service) can grow well beyond that for power users, after
 * which every subsequent setItem throws and propagates as
 *   `Vault Engine Error: [Error: database or disk is full (code 13 SQLITE_FULL)]`
 *
 * Fix: these caches are *derived* data — recomputed from the local question bank
 * and the user's own rows. There is no reason for them to consume the scarce
 * AsyncStorage/SQLite budget. They now go to KVStore (MMKV), which:
 *   • is not subject to the SQLite size ceiling,
 *   • is ~30× faster and synchronous, and
 *   • lives in the `upsc-offline-v1` namespace, so "Clear offline data" wipes
 *     them instead of leaving stale copies behind.
 *
 * The function names (`safeSetItem` / `safeMultiSet`) are unchanged so every
 * existing caller migrates without edits.
 *
 * READ PATH: use `cacheGetString` / `cacheGetJson` rather than AsyncStorage,
 * otherwise a value written here won't be found on the next launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KVStore } from './kvStore';

// Cache key prefixes that belong in KVStore rather than AsyncStorage.
// All of these are recomputed from the local bank / Supabase on next launch.
const KV_CACHE_PREFIXES = [
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
  'mains_tagged_vault_cache_',
  'g1:',                   // generic cache wrapper
];

/** True when this key is a derived fat cache that belongs in KVStore. */
export const isKvCacheKey = (key: string): boolean =>
  KV_CACHE_PREFIXES.some((p) => key.startsWith(p));

// Retained for the small number of keys that still legitimately live in
// AsyncStorage and may need evicting on a full-disk recovery.
const EVICTABLE_PREFIXES = KV_CACHE_PREFIXES;

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
  // Also drop legacy copies that predate the KVStore migration.
  try {
    for (const prefix of KV_CACHE_PREFIXES) {
      KVStore.deletePrefix(prefix);
    }
  } catch {
    // best-effort
  }
};

export const safeSetItem = async (
  key: string,
  value: string,
): Promise<void> => {
  // Fat caches go to MMKV — no SQLite ceiling, no SQLITE_FULL.
  if (isKvCacheKey(key)) {
    try {
      KVStore.setString(key, value);
      return;
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[safeAsyncStorage] KVStore set failed', key, err);
      }
      return;
    }
  }

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
  const kvPairs = pairs.filter(([k]) => isKvCacheKey(k));
  const asyncPairs = pairs.filter(([k]) => !isKvCacheKey(k));

  for (const [k, v] of kvPairs) {
    try { KVStore.setString(k, v); } catch { /* best-effort */ }
  }

  if (asyncPairs.length === 0) return;

  try {
    await AsyncStorage.multiSet(asyncPairs);
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
      await AsyncStorage.multiSet(asyncPairs);
    } catch {
      // swallow
    }
  }
};

/**
 * Read a cached string. Checks KVStore first (where fat caches now live), then
 * falls back to AsyncStorage so pre-migration values remain readable.
 */
export const cacheGetString = async (key: string): Promise<string | null> => {
  const fromKv = KVStore.getString(key);
  if (fromKv !== null) return fromKv;
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Read + parse a cached JSON value. */
export const cacheGetJson = async <T = any>(key: string): Promise<T | null> => {
  const raw = await cacheGetString(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

/** Remove a cached value from both backends. */
export const cacheRemove = async (key: string): Promise<void> => {
  KVStore.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // best-effort
  }
};
