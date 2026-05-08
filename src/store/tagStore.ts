/**
 * TagStore — central Zustand store for tag-catalog events.
 *
 * Every tag rename / add / remove bumps `version`. Any screen that
 * displays tags can subscribe to `version` and re-derive its data, so
 * renaming a tag on one screen is reflected everywhere instantly.
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
  bump: (event: TagStore['lastEvent']) => void;
}

export const useTagStore = create<TagStore>((set) => ({
  version: 0,
  lastEvent: null,
  bump: (event) =>
    set((s) => ({ version: s.version + 1, lastEvent: event })),
}));
