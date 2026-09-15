import AsyncStorage from '@react-native-async-storage/async-storage';
import { KVStore } from '../lib/kvStore';

const KEY = 'dr_upsc_search_history';
const LEGACY_ASYNC = ['integrated_search_history', 'ai_search_history', 'mains_search_history', 'recent_searches'];
const LEGACY_KV = ['@unified_search_history'];
const CAP = 10;

const parseList = (raw: any): string[] => {
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter((x: any) => typeof x === 'string' && x.trim()) : [];
  } catch {
    return [];
  }
};

export async function loadSearchHistory(): Promise<string[]> {
  const primary = parseList(await AsyncStorage.getItem(KEY));
  if (primary.length > 0) return primary;

  const merged: string[] = [];
  const seen = new Set<string>();

  const pushAll = (list: string[]) => {
    list.forEach(t => {
      const trimmed = t.trim();
      if (!trimmed) return;
      const k = trimmed.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        merged.push(trimmed);
      }
    });
  };

  for (const k of LEGACY_ASYNC) {
    try {
      const raw = await AsyncStorage.getItem(k);
      pushAll(parseList(raw));
    } catch {}
  }

  try {
    await KVStore.ready();
    for (const k of LEGACY_KV) {
      pushAll(parseList(KVStore.getJson<string[]>(k)));
    }
  } catch {}

  const capped = merged.slice(0, CAP);
  if (capped.length > 0) {
    await AsyncStorage.setItem(KEY, JSON.stringify(capped));
    for (const k of LEGACY_ASYNC) {
      AsyncStorage.removeItem(k).catch(() => {});
    }
    for (const k of LEGACY_KV) {
      try {
        KVStore.delete(k);
      } catch {}
    }
  }
  return capped;
}

export async function saveSearch(term: string): Promise<string[]> {
  const t = term.trim();
  if (!t) return loadSearchHistory();
  const current = parseList(await AsyncStorage.getItem(KEY));
  const next = [t, ...current.filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, CAP);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function removeSearchItem(term: string): Promise<string[]> {
  const t = term.trim().toLowerCase();
  const current = parseList(await AsyncStorage.getItem(KEY));
  const next = current.filter(x => x.toLowerCase() !== t);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export async function clearSearchHistory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
