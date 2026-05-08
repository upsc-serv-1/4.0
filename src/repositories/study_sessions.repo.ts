/**
 * study_sessions is a daily aggregate, one row per user per date.
 * Per-card audit rows belong in card_reviews.
 */
import { KVStore } from '../lib/kvStore';
import { SyncQueue } from '../services/SyncQueue';

const STORE_KEY = '@user_study_sessions_offline';

export type StudySession = {
  id: string;
  user_id: string;
  date: string;
  cards_reviewed: number;
  cards_correct: number;
  duration_seconds: number;
  created_at?: string;
  updated_at: string;
  _dirty?: boolean;
};

const today = () => new Date().toISOString().slice(0, 10);
const load = (): StudySession[] => KVStore.getJson<StudySession[]>(STORE_KEY) ?? [];
const save = (rows: StudySession[]) => KVStore.setJson(STORE_KEY, rows);

export const StudySessionsRepo = {
  list(userId?: string): StudySession[] {
    const all = load();
    return userId ? all.filter((r) => r.user_id === userId) : all;
  },

  recordCardReview(userId: string, opts: { correct: boolean; durationSeconds?: number }) {
    const date = today();
    const id = `${userId}:${date}`;
    const rows = load();
    const idx = rows.findIndex((r) => r.id === id);
    const now = new Date().toISOString();
    const base: StudySession = idx >= 0 ? rows[idx] : {
      id,
      user_id: userId,
      date,
      cards_reviewed: 0,
      cards_correct: 0,
      duration_seconds: 0,
      created_at: now,
      updated_at: now,
    };

    const next: StudySession = {
      ...base,
      cards_reviewed: base.cards_reviewed + 1,
      cards_correct: base.cards_correct + (opts.correct ? 1 : 0),
      duration_seconds: base.duration_seconds + Math.max(0, Math.round(opts.durationSeconds ?? 0)),
      updated_at: now,
      _dirty: true,
    };

    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    save(rows);

    SyncQueue.enqueue('study_session_upsert', {
      user_id: userId,
      date,
      cards_reviewed: next.cards_reviewed,
      cards_correct: next.cards_correct,
      duration_seconds: next.duration_seconds,
      updated_at: now,
    });

    return next;
  },

  pendingCount(): number {
    return load().filter((r) => r._dirty).length;
  },
};

export default StudySessionsRepo;
