/**
 * card_reviews is the insert-only per-review SM-2 audit log.
 */
import { KVStore } from '../lib/kvStore';
import { SyncQueue } from '../services/SyncQueue';

const STORE_KEY = '@user_card_reviews_offline';

export type CardReview = {
  id: string;
  user_id: string;
  card_id: string;
  reviewed_at: string;
  quality: number;
  prev_interval?: number;
  new_interval?: number;
  prev_ef?: number;
  new_ef?: number;
  rating?: 'again' | 'hard' | 'good' | 'easy' | string;
  learning_step?: number | null;
  prev_minutes?: number;
  new_minutes?: number;
  _dirty?: boolean;
};

const load = (): CardReview[] => KVStore.getJson<CardReview[]>(STORE_KEY) ?? [];
const save = (rows: CardReview[]) => KVStore.setJson(STORE_KEY, rows);
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
  const r = Math.floor(Math.random() * 16);
  const v = c === 'x' ? r : (r & 0x3) | 0x8;
  return v.toString(16);
});

export const CardReviewsRepo = {
  insert(input: Omit<CardReview, 'id' | '_dirty'>): CardReview {
    const row: CardReview = { ...input, id: uuid(), _dirty: true };
    save([...load(), row]);

    const { _dirty, ...payload } = row;
    SyncQueue.enqueue('card_review_insert', payload);
    return row;
  },

  byCard(cardId: string) {
    return load().filter((r) => r.card_id === cardId);
  },

  list(userId?: string) {
    const all = load();
    return userId ? all.filter((r) => r.user_id === userId) : all;
  },
};

export default CardReviewsRepo;
