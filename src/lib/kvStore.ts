/**
 * kvStore — generic MMKV-backed key-value store with graceful AsyncStorage fallback.
 *
 * This is the low-level primitive used by every offline-first feature in the app:
 *   - QuestionCache           → caches PYQ rows by test_id
 *   - OfflineManager          → caches tests, question_states, notes, attempts, cards
 *   - SyncQueue               → persists pending offline mutations
 *   - useOfflineData hooks    → read-first reads for UI
 *
 * Why extract it from localStore.ts?
 *   localStore is flashcard-specific (typed to user_cards + dirty sets). We want
 *   a *generic* JSON-in / JSON-out cache that every feature can use.
 *
 * MMKV is ~30× faster than AsyncStorage for synchronous reads and instantly
 * hydrates on boot — critical for an "open-the-app-and-just-work" offline UX.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

type KVBackend = {
  getString: (k: string) => string | null | undefined;
  set: (k: string, v: string) => void;
  delete: (k: string) => void;
  getAllKeys: () => string[];
  clearAll?: () => void;
};

let backend: KVBackend | null = null;
let isNativeMMKV = false;

try {
  if (Platform.OS !== 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { MMKV } = require('react-native-mmkv');
    const mmkv = new MMKV({ id: 'upsc-offline-v1' });
    backend = {
      getString: (k) => mmkv.getString(k) ?? null,
      set: (k, v) => mmkv.set(k, v),
      delete: (k) => mmkv.delete(k),
      getAllKeys: () => mmkv.getAllKeys(),
      clearAll: () => mmkv.clearAll(),
    };
    isNativeMMKV = true;
  }
} catch {
  backend = null;
}

// --- AsyncStorage fallback (Expo Go / web) --------------------------------
// A small in-memory mirror keeps reads synchronous. AsyncStorage is written
// asynchronously in the background.
const memCache = new Map<string, string>();

// Preload relevant keys on first import so reads right after startup hit memory.
let _preloadPromise: Promise<void> | null = null;
if (!backend) {
  _preloadPromise = (async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      if (keys.length === 0) return;
      const pairs = await AsyncStorage.multiGet(keys);
      pairs.forEach(([k, v]) => { if (v !== null) memCache.set(k, v); });
    } catch {
      /* ignore */
    }
  })();
}

const asyncBackend: KVBackend = {
  getString: (k) => memCache.get(k) ?? null,
  set: (k, v) => { memCache.set(k, v); AsyncStorage.setItem(k, v).catch(() => {}); },
  delete: (k) => { memCache.delete(k); AsyncStorage.removeItem(k).catch(() => {}); },
  getAllKeys: () => Array.from(memCache.keys()),
  clearAll: () => {
    const keys = Array.from(memCache.keys());
    memCache.clear();
    AsyncStorage.multiRemove(keys).catch(() => {});
  },
};

const kv: KVBackend = backend ?? asyncBackend;

// --- Public API -----------------------------------------------------------

export const KVStore = {
  /** True on native builds with MMKV installed. False on Expo Go / web (fallback). */
  isMMKV: () => isNativeMMKV,

  /** Await this once on app bootstrap if you need the AsyncStorage fallback to be fully hydrated. */
  ready: async () => {
    if (_preloadPromise) await _preloadPromise;
  },

  getString(key: string): string | null {
    return kv.getString(key) ?? null;
  },

  setString(key: string, value: string) {
    kv.set(key, value);
  },

  getJson<T = any>(key: string): T | null {
    const raw = kv.getString(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  },

  setJson(key: string, value: unknown) {
    kv.set(key, JSON.stringify(value));
  },

  delete(key: string) {
    kv.delete(key);
  },

  getAllKeys(): string[] {
    return kv.getAllKeys();
  },

  /** Delete every key whose name starts with `prefix`. */
  deletePrefix(prefix: string) {
    kv.getAllKeys()
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => kv.delete(k));
  },

  /** Nuke everything. Use on sign-out only. */
  clearAll() {
    if (kv.clearAll) kv.clearAll();
    else kv.getAllKeys().forEach((k) => kv.delete(k));
  },
};
