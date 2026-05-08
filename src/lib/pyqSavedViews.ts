/**
 * pyqSavedViews — Persist & retrieve "Saved Views" presets.
 *
 * A SavedView captures a (stage + paper + range + custom range + selected subjects)
 * combination so a user can switch contexts in one tap.
 *
 * Storage key: `pyq_saved_views` (KVStore)
 */
import { KVStore } from './kvStore';

export interface SavedView {
  id: string;
  name: string;
  examStage: string;
  selectedPaper: string;
  selectedRange: string;
  customYearStart?: string;
  customYearEnd?: string;
  subjects?: string[];
  createdAt: number;
}

const KEY = 'pyq_saved_views';

export function listSavedViews(): SavedView[] {
  try {
    const v = KVStore.getJson(KEY);
    return Array.isArray(v) ? (v as SavedView[]) : [];
  } catch { return []; }
}

export function upsertSavedView(view: Omit<SavedView, 'id' | 'createdAt'> & { id?: string }): SavedView {
  const all = listSavedViews();
  const id = view.id || `sv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const next: SavedView = { id, createdAt: Date.now(), ...view };
  const filtered = all.filter((v) => v.id !== id);
  filtered.unshift(next);
  KVStore.setJson(KEY, filtered.slice(0, 30));
  return next;
}

export function removeSavedView(id: string) {
  const all = listSavedViews().filter((v) => v.id !== id);
  KVStore.setJson(KEY, all);
}

export function clearSavedViews() {
  KVStore.setJson(KEY, []);
}
