/**
 * Local persistence for flashcard branch colors.
 * The Supabase `flashcard_branches` table does not currently store a color
 * column, so we persist user-selected palette colors per branch in
 * AsyncStorage. This makes the color palette UI in folder/deck creation
 * actually functional and persistent across launches.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from './safeAsyncStorage';

const STORAGE_KEY = 'flashcard_branch_colors_v1';

type ColorMap = Record<string, string>;

let cache: ColorMap | null = null;
const subscribers = new Set<() => void>();

async function ensureLoaded(): Promise<ColorMap> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as ColorMap) : {};
  } catch {
    cache = {};
  }
  return cache;
}

async function persist() {
  if (!cache) return;
  try {
    await safeSetItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
}

export const BranchColors = {
  async loadAll(): Promise<ColorMap> {
    return { ...(await ensureLoaded()) };
  },

  async getColor(branchId: string): Promise<string | undefined> {
    const map = await ensureLoaded();
    return map[branchId];
  },

  async setColor(branchId: string, color: string): Promise<void> {
    const map = await ensureLoaded();
    map[branchId] = color;
    await persist();
    subscribers.forEach((cb) => {
      try { cb(); } catch {}
    });
  },

  async removeColor(branchId: string): Promise<void> {
    const map = await ensureLoaded();
    delete map[branchId];
    await persist();
    subscribers.forEach((cb) => {
      try { cb(); } catch {}
    });
  },

  subscribe(cb: () => void): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },
};

export const DEFAULT_BRANCH_COLORS = ['#bae6fd', '#e0e7ff', '#fef3c7', '#fee2e2', '#dcfce7'];
