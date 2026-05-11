/**
 * SyncQueue — persistent queue of offline mutations.
 *
 * When the user takes a test, renames a tag, adds a flashcard rating while
 * offline (or network is flaky), we don't block the UI or lose data. We push
 * the mutation onto this queue. When the app later detects the server is
 * reachable (via a successful query or explicit ping), the queue is drained
 * in FIFO order with retry/backoff.
 *
 * Each queue item is:
 *   - idempotent (every item carries a client-generated UUID)
 *   - typed by `kind` so a single handler can dispatch the right Supabase call
 *   - retried up to MAX_RETRIES; after that it's moved to the dead-letter list
 *
 * Stored in KVStore under two keys:
 *   sync:pending      → array of active items
 *   sync:deadletter   → array of items that gave up after MAX_RETRIES
 */
import { KVStore } from '../lib/kvStore';
import { supabase } from '../lib/supabase';

const PENDING_KEY = 'sync:pending';
const DEADLETTER_KEY = 'sync:deadletter';
const MAX_RETRIES = 5;

export type SyncKind =
  | 'test_attempt'           // payload = full test_attempts row
  | 'test_attempt_upsert'    // payload = test_attempts row
  | 'question_state_upsert'  // payload = question_states row
  | 'tag_rename'             // payload = { oldTag, newTag }
  | 'tag_add'                // payload = { tag }
  | 'tag_remove'             // payload = { tag }
  | 'note_upsert'            // payload = user_notes row
  | 'card_review'            // payload = { user_id, card_id, ...srs fields }
  | 'user_card_upsert'       // payload = user_cards row
  | 'card_delete'            // payload = { id, updated_at } - mark card as deleted
  | 'card_review_insert'     // payload = card_reviews row
  | 'study_session_upsert';  // payload = study_sessions daily aggregate row

export interface SyncItem {
  id: string;               // client uuid; also used for idempotent writes
  kind: SyncKind;
  payload: any;
  created_at: number;
  attempts: number;
  last_error?: string;
}

function uuid(): string {
  // Avoid adding a dependency; Math.random is OK for idempotency keys.
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function loadPending(): SyncItem[] {
  return KVStore.getJson<SyncItem[]>(PENDING_KEY) ?? [];
}
function savePending(list: SyncItem[]) {
  KVStore.setJson(PENDING_KEY, list);
}
function loadDead(): SyncItem[] {
  return KVStore.getJson<SyncItem[]>(DEADLETTER_KEY) ?? [];
}
function saveDead(list: SyncItem[]) {
  KVStore.setJson(DEADLETTER_KEY, list);
}

// Callbacks invoked after a successful sync — allows dependent services to refresh
type SyncCallback = (kind: SyncKind, payload: any) => void;
const syncCallbacks: SyncCallback[] = [];

export const SyncQueue = {
  /** Register a callback to be invoked after successful sync of a particular kind. */
  onFlush(callback: SyncCallback): () => void {
    syncCallbacks.push(callback);
    return () => {
      const idx = syncCallbacks.indexOf(callback);
      if (idx !== -1) syncCallbacks.splice(idx, 1);
    };
  },

  /** Enqueue a new mutation for eventual sync. Returns the assigned id. */
  enqueue(kind: SyncKind, payload: any): string {
    const item: SyncItem = {
      id: uuid(),
      kind,
      payload,
      created_at: Date.now(),
      attempts: 0,
    };
    const list = loadPending();
    list.push(item);
    savePending(list);
    return item.id;
  },

  /** How many items are waiting — useful for a "pending sync" UI badge. */
  pendingCount(): number {
    return loadPending().length;
  },

  /** For debug / diagnostics. */
  peek(): SyncItem[] {
    return loadPending();
  },
  peekDead(): SyncItem[] {
    return loadDead();
  },

  /** Clear everything — used on sign-out. */
  clearAll() {
    KVStore.delete(PENDING_KEY);
    KVStore.delete(DEADLETTER_KEY);
  },

  /**
   * Attempt to push every pending item to Supabase. Items that fail are kept
   * in the queue with their `attempts` counter incremented. Items that fail
   * MAX_RETRIES times move to the dead-letter list (user needs to resolve).
   * Returns { flushed, failed, dead }.
   */
  async drain(): Promise<{ flushed: number; failed: number; dead: number }> {
    const list = loadPending();
    if (list.length === 0) return { flushed: 0, failed: 0, dead: 0 };

    const remaining: SyncItem[] = [];
    const dead: SyncItem[] = [];
    let flushed = 0;
    let failed = 0;

    for (const item of list) {
      try {
        await dispatch(item);
        flushed += 1;
        // Invoke callbacks for successful sync
        syncCallbacks.forEach(cb => {
          try {
            cb(item.kind, item.payload);
          } catch (e) {
            console.warn('[SyncQueue] callback error', e);
          }
        });
      } catch (e: any) {
        item.attempts += 1;
        item.last_error = e?.message || String(e);
        if (item.attempts >= MAX_RETRIES) {
          dead.push(item);
        } else {
          remaining.push(item);
          failed += 1;
        }
      }
    }

    savePending(remaining);
    if (dead.length > 0) {
      const prevDead = loadDead();
      saveDead([...prevDead, ...dead]);
    }

    return { flushed, failed, dead: dead.length };
  },
};

// ─── Dispatcher ─────────────────────────────────────────────────
async function dispatch(item: SyncItem) {
  switch (item.kind) {
    case 'test_attempt':
    case 'test_attempt_upsert': {
      const { error } = await supabase
        .from('test_attempts')
        .upsert(item.payload, { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'question_state_upsert': {
      const { error } = await supabase
        .from('question_states')
        .upsert(item.payload, { onConflict: 'user_id,question_id' });
      if (error) throw error;
      return;
    }
    case 'tag_rename': {
      const { error } = await supabase.rpc('rename_user_tag', {
        p_old_tag: item.payload.oldTag,
        p_new_tag: item.payload.newTag,
      });
      if (error) throw error;
      return;
    }
    case 'tag_add': {
      const { error } = await supabase.rpc('add_user_tag', { p_tag: item.payload.tag });
      if (error) throw error;
      return;
    }
    case 'tag_remove': {
      const { error } = await supabase.rpc('remove_user_tag', { p_tag: item.payload.tag });
      if (error) throw error;
      return;
    }
    case 'note_upsert': {
      const { error } = await supabase
        .from('user_notes')
        .upsert(item.payload, { onConflict: 'id' });
      if (error) throw error;
      return;
    }
    case 'card_review': {
      const { error } = await supabase
        .from('user_cards')
        .upsert(item.payload, { onConflict: 'user_id,card_id' });
      if (error) throw error;
      return;
    }
    case 'card_delete': {
      // Mark card as deleted in the cards table by setting is_deleted = true
      const { error } = await supabase
        .from('cards')
        .update({ is_deleted: true, updated_at: item.payload.updated_at })
        .eq('id', item.payload.id);
      if (error) throw error;
      return;
    }
    case 'user_card_upsert': {
      const { error } = await supabase
        .from('user_cards')
        .upsert(item.payload, { onConflict: 'user_id,card_id' });
      if (error) throw error;
      return;
    }
    case 'card_review_insert': {
      const { error } = await supabase
        .from('card_reviews')
        .insert(item.payload);
      if (error) throw error;
      return;
    }
    case 'study_session_upsert': {
      const { error } = await supabase
        .from('study_sessions')
        .upsert(item.payload, { onConflict: 'user_id,date' });
      if (error) throw error;
      return;
    }
    default:
      throw new Error(`Unknown sync kind: ${(item as any).kind}`);
  }
}

/**
 * Best-effort connectivity probe. Used in lieu of @react-native-community/netinfo
 * (which is not in package.json). If this lightweight call succeeds we assume
 * we have network and drain the queue.
 */
export async function isOnline(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.getSession();
    return !error;
  } catch {
    return false;
  }
}

/**
 * Start a background drain loop. Safe to call once at app bootstrap.
 * Every `periodMs` we check online-ness and try to drain.
 */
let _loop: ReturnType<typeof setInterval> | null = null;
export function startSyncQueueWorker(periodMs = 30_000) {
  if (_loop) return;
  _loop = setInterval(async () => {
    if (SyncQueue.pendingCount() === 0) return;
    if (!(await isOnline())) return;
    try {
      await SyncQueue.drain();
    } catch (e) {
      // swallow — next tick will retry
      console.warn('[SyncQueue] drain tick failed', e);
    }
  }, periodMs);
}

export function stopSyncQueueWorker() {
  if (_loop) {
    clearInterval(_loop);
    _loop = null;
  }
}
