/**
 * flashcards.repo — local-first CRUD for flashcards via KVStore.
 *
 * All reads are synchronous from MMKV. All writes update MMKV immediately
 * and enqueue a SyncQueue job so the change pushes to Supabase when online.
 *
 * Uses the existing SyncQueue's 'card_review' kind for upserts. For creates
 * we use the generic upsert approach since the existing queue supports it.
 */
import { KVStore } from '../lib/kvStore';
import { SyncQueue } from '../services/SyncQueue';

const CARDS_KEY = '@user_cards_flashcards';

// Register sync callback to invalidate cache after card deletions are synced
SyncQueue.onFlush((kind, payload) => {
  if (kind === 'card_delete') {
    // After card deletion syncs, clear cache to force refresh from Supabase
    KVStore.delete(CARDS_KEY);
    KVStore.delete('@cards_all');
  }
});

export type Flashcard = {
  id: string;
  user_id: string;
  front: string;
  back: string;
  tag_ids?: string[];
  deck_id?: string | null;
  deleted?: boolean;
  _dirty?: boolean;
  updated_at: string;
  created_at?: string;
  [key: string]: any;  // allow extra fields from Supabase
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const getFlashcards = (): Flashcard[] =>
  (KVStore.getJson<Flashcard[]>(CARDS_KEY) ?? []).filter(c => !c.deleted);

export const getAllFlashcardsRaw = (): Flashcard[] =>
  KVStore.getJson<Flashcard[]>(CARDS_KEY) ?? [];

export const upsertFlashcard = (input: Partial<Flashcard> & { user_id: string }) => {
  const list = KVStore.getJson<Flashcard[]>(CARDS_KEY) ?? [];
  const now = new Date().toISOString();
  const id = input.id ?? generateId();
  const existing = list.find(c => c.id === id);
  const next: Flashcard = {
    ...(existing ?? { created_at: now, front: '', back: '' }),
    ...input,
    id,
    updated_at: now,
    _dirty: true,
  } as Flashcard;
  const merged = [...list.filter(c => c.id !== id), next];
  KVStore.setJson(CARDS_KEY, merged);

  // Also sync with OfflineManager's cards cache (@cards_all)
  const offlineCards = KVStore.getJson<Flashcard[]>('@cards_all') ?? [];
  const offlineMerged = [...offlineCards.filter(c => c.id !== id), next];
  KVStore.setJson('@cards_all', offlineMerged);

  // Enqueue for remote sync — strip _dirty before sending
  const { _dirty, ...payload } = next;
  SyncQueue.enqueue('card_review', payload);
  return next;
};

export const deleteFlashcard = (id: string) => {
  const list = KVStore.getJson<Flashcard[]>(CARDS_KEY) ?? [];
  const now = new Date().toISOString();
  // Update local cache to mark as deleted
  const updated = list.map(c => (c.id === id ? { ...c, deleted: true, _dirty: true, updated_at: now } : c));
  KVStore.setJson(CARDS_KEY, updated);

  // Also update the OfflineManager's cards cache (@cards_all)
  const offlineCards = KVStore.getJson<Flashcard[]>('@cards_all') ?? [];
  const updatedOffline = offlineCards.map(c => (c.id === id ? { ...c, deleted: true, updated_at: now } : c));
  KVStore.setJson('@cards_all', updatedOffline);

  // Enqueue sync to Supabase — use card_delete to properly update cards.is_deleted
  SyncQueue.enqueue('card_delete', { id, updated_at: now });
};

/** Clear the flashcard cache to force a refresh from Supabase on next read. */
export const invalidateFlashcardCache = () => {
  KVStore.delete(CARDS_KEY);
  KVStore.delete('@cards_all');
};
