/**
 * TagStore — central Zustand store for tag-catalog events.
 *
 * Provides:
 *   - `version` counter that bumps on every rename/add/remove for cheap
 *     re-render subscriptions across screens.
 *   - `allTags` global registry — single source of truth for every unique
 *     tag the user has ever applied, regardless of how many questions still
 *     reference it. Consumers (export filters, AI search, quiz engine, tags
 *     tab, revision filters, flashcards, notes, analytics, review modes)
 *     should read from this list to avoid partial local lists.
 */
import { create } from 'zustand';

interface TagStore {
  /** Monotonically increasing counter. Every write bumps it. */
  version: number;
  /** Last mutation descriptor — useful for optimistic UI / toasts. */
  lastEvent: null | {
    type: 'rename' | 'add' | 'remove';
    oldTag?: string;
    newTag?: string;
    tag?: string;
    at: number;
  };
  /** Global tag registry — every tag the user has ever applied. */
  allTags: string[];
  bump: (event: TagStore['lastEvent']) => void;
  /** Replace the registry (e.g. after fetching from server). */
  setAllTags: (tags: string[]) => void;
  /** Add a tag to the registry (idempotent, case-insensitive). */
  registerTag: (tag: string) => void;
  /** Rename a tag globally in the registry. */
  renameTag: (oldTag: string, newTag: string) => void;
  /** Remove a tag from the registry. */
  unregisterTag: (tag: string) => void;
}

const norm = (s: string) => (s || '').trim().toLowerCase();

export const useTagStore = create<TagStore>((set) => ({
  version: 0,
  lastEvent: null,
  allTags: [],
  bump: (event) =>
    set((s) => ({ version: s.version + 1, lastEvent: event })),
  setAllTags: (tags) =>
    set((s) => {
      const seen = new Set<string>();
      const unique: string[] = [];
      tags.forEach((t) => {
        const trimmed = (t || '').trim();
        if (!trimmed) return;
        const k = norm(trimmed);
        if (seen.has(k)) return;
        seen.add(k);
        unique.push(trimmed);
      });
      unique.sort((a, b) => a.localeCompare(b));
      return { allTags: unique };
    }),
  registerTag: (tag) =>
    set((s) => {
      const trimmed = (tag || '').trim();
      if (!trimmed) return s;
      if (s.allTags.some((t) => norm(t) === norm(trimmed))) return s;
      const next = [...s.allTags, trimmed].sort((a, b) => a.localeCompare(b));
      return {
        allTags: next,
        version: s.version + 1,
        lastEvent: { type: 'add', tag: trimmed, at: Date.now() },
      };
    }),
  renameTag: (oldTag, newTag) =>
    set((s) => {
      const next = s.allTags
        .map((t) => (norm(t) === norm(oldTag) ? newTag.trim() : t))
        .filter(Boolean);
      // Deduplicate after rename
      const seen = new Set<string>();
      const unique = next.filter((t) => {
        const k = norm(t);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      unique.sort((a, b) => a.localeCompare(b));
      return {
        allTags: unique,
        version: s.version + 1,
        lastEvent: { type: 'rename', oldTag, newTag, at: Date.now() },
      };
    }),
  unregisterTag: (tag) =>
    set((s) => ({
      allTags: s.allTags.filter((t) => norm(t) !== norm(tag)),
      version: s.version + 1,
      lastEvent: { type: 'remove', tag, at: Date.now() },
    })),
}));
