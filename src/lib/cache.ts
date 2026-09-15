/**
 * cache.ts — tiny timestamped JSON cache.
 *
 * Backed by KVStore (MMKV) instead of AsyncStorage. The old `g1:` prefix lived
 * in AsyncStorage, which is SQLITE-backed and was contributing to the
 * "SQLITE_FULL" pressure on device. KVStore keeps these entries in MMKV and —
 * critically — inside the same namespace that "Clear offline data" wipes, so a
 * stale cache can no longer survive a clear.
 *
 * The public API is unchanged.
 */
import { KVStore } from './kvStore';

const PREFIX = 'g1:';

export async function cacheSet<T>(key: string, value: T) {
  try {
    KVStore.setJson(`${PREFIX}${key}`, { v: value, t: Date.now() });
  } catch {}
}

export async function cacheGet<T>(key: string, maxAgeMs = 1000 * 60 * 60 * 24): Promise<T | null> {
  try {
    const parsed = KVStore.getJson<{ v: T; t: number }>(`${PREFIX}${key}`);
    if (!parsed) return null;
    if (Date.now() - parsed.t > maxAgeMs) return null;
    return parsed.v as T;
  } catch {
    return null;
  }
}

/** Remove every cache entry written through this helper. */
export function cacheClearAll() {
  KVStore.deletePrefix(PREFIX);
}
