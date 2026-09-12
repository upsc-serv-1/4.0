/**
 * attempts.repo — offline exam result persistence via KVStore.
 *
 * When the user takes a test offline, results are saved here immediately.
 * The SyncQueue pushes them to Supabase when connectivity returns.
 */
import { KVStore } from '../lib/kvStore';
import { SyncQueue } from '../services/SyncQueue';

const ATTEMPTS_KEY = '@user_attempts_offline';

export type Attempt = {
  id: string;
  user_id: string;
  test_id: string;
  answers: Record<string, any>;
  score?: number;
  total?: number;
  correct?: number;
  started_at: string;
  finished_at?: string;
  taken_offline: boolean;
  _dirty?: boolean;
  updated_at: string;
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export const getAttempts = (): Attempt[] =>
  KVStore.getJson<Attempt[]>(ATTEMPTS_KEY) ?? [];

export const saveAttempt = (
  input: Omit<Attempt, 'id' | 'updated_at' | '_dirty'>
): Attempt => {
  const list = KVStore.getJson<Attempt[]>(ATTEMPTS_KEY) ?? [];
  const now = new Date().toISOString();
  const row: Attempt = { ...input, id: generateId(), updated_at: now, _dirty: true };
  KVStore.setJson(ATTEMPTS_KEY, [...list, row]);

  // Use existing SyncQueue's 'test_attempt' kind
  const { _dirty, ...payload } = row;
  SyncQueue.enqueue('test_attempt', payload);
  return row;
};

export const getPendingAttempts = () =>
  (KVStore.getJson<Attempt[]>(ATTEMPTS_KEY) ?? []).filter(a => a._dirty);
