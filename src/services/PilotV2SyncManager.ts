/**
 * PilotV2SyncManager — local-first sync, crash-recovery and offline retry
 * queue for Pilot V2 notes.
 *
 * Responsibilities (per PILOT_V2_COMPLETE_ARCHITECTURE.md §"Sync Architecture"):
 *
 *   1. **saveLocal(noteId, content)** — instant write to KVStore (MMKV on
 *      device, AsyncStorage fallback on Expo Go / web). Marks the note dirty.
 *
 *   2. **scheduleSync(noteId)** — enqueues a debounced server push. The push
 *      runs on a 600 ms tail window OR immediately when the user
 *      navigates away (`syncToServer` exposed for explicit flushes).
 *
 *   3. **syncToServer(noteId)** — pushes the dirty content to Supabase via
 *      `pilotV2Repo.savePilotV2NoteContent`. On failure, the note stays in the
 *      retry queue and the dirty flag stays on.
 *
 *   4. **Retry queue** — every saveLocal also pushes the noteId into a
 *      persistent queue keyed by user. A NetInfo listener drains the queue as
 *      soon as connectivity is restored, with exponential backoff and a hard
 *      cap of 6 retries per item.
 *
 *   5. **Rolling backups** — every successful saveLocal snapshots the note
 *      under a timestamped key. Only the last 5 backups per note are kept.
 *      `recoverFromCrash(noteId)` returns the most recent backup so the
 *      editor can offer "restore" after a crash.
 *
 *   6. **Crash recovery** — on app boot, callers can iterate
 *      `getPendingDirtyNotes()` to surface a banner asking to retry / restore.
 *
 * Storage layout (KVStore):
 *
 *   pv2:note:<id>:content          → JSON PilotV2NoteContent (current local state)
 *   pv2:note:<id>:dirty            → "1" | absent
 *   pv2:note:<id>:lastSyncedAt     → ISO string
 *   pv2:note:<id>:backup:<ts>      → JSON PilotV2NoteContent (rolling backup)
 *   pv2:queue                      → JSON SyncQueueEntry[]   (global, ordered)
 *   pv2:openNotes                  → JSON string[]           (currently-open noteIds)
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { KVStore } from '../lib/kvStore';
import { PilotV2NoteContent } from '../components/pilot-v2/types';
import { savePilotV2NoteContent } from '../repositories/pilotV2Repo';

/* ------------------------------------------------------------------------- */
/* Storage keys                                                               */
/* ------------------------------------------------------------------------- */

const K_NOTE_CONTENT   = (id: string) => `pv2:note:${id}:content`;
const K_NOTE_DIRTY     = (id: string) => `pv2:note:${id}:dirty`;
const K_NOTE_SYNCED    = (id: string) => `pv2:note:${id}:lastSyncedAt`;
const K_NOTE_BACKUP_PFX = (id: string) => `pv2:note:${id}:backup:`;
const K_QUEUE          = 'pv2:queue';
const K_OPEN_NOTES     = 'pv2:openNotes';

const MAX_BACKUPS_PER_NOTE = 5;
const MAX_RETRY_ATTEMPTS   = 6;
const SYNC_DEBOUNCE_MS     = 600;

/* ------------------------------------------------------------------------- */
/* Types                                                                      */
/* ------------------------------------------------------------------------- */

interface SyncQueueEntry {
  noteId: string;
  enqueuedAt: number;
  attempts: number;
  /** Last error message (for diagnostics in the UI). */
  lastError?: string;
  /** Earliest retry time (ms epoch) — exponential backoff. */
  nextAttemptAt: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'queued' | 'failed' | 'synced';

export interface SyncStateSnapshot {
  noteId: string;
  status: SyncStatus;
  lastSyncedAt?: string;
  attempts?: number;
  lastError?: string;
}

type SyncListener = (snapshot: SyncStateSnapshot) => void;

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

const now = () => Date.now();
const nowIso = () => new Date().toISOString();

function readQueue(): SyncQueueEntry[] {
  return KVStore.getJson<SyncQueueEntry[]>(K_QUEUE) ?? [];
}

function writeQueue(items: SyncQueueEntry[]) {
  KVStore.setJson(K_QUEUE, items);
}

function backoffMs(attempts: number): number {
  // 1s, 2s, 5s, 10s, 30s, 60s, 120s+
  const ladder = [1000, 2000, 5000, 10000, 30000, 60000];
  return ladder[Math.min(attempts, ladder.length - 1)];
}

function pruneOldBackups(noteId: string) {
  const prefix = K_NOTE_BACKUP_PFX(noteId);
  const keys = KVStore.getAllKeys()
    .filter(k => k.startsWith(prefix))
    .sort(); // ascending by timestamp suffix
  if (keys.length <= MAX_BACKUPS_PER_NOTE) return;
  const drop = keys.slice(0, keys.length - MAX_BACKUPS_PER_NOTE);
  drop.forEach(k => KVStore.delete(k));
}

/* ------------------------------------------------------------------------- */
/* Public manager — singleton                                                 */
/* ------------------------------------------------------------------------- */

class PilotV2SyncManagerImpl {
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<string, Set<SyncListener>>();
  private netUnsub: (() => void) | null = null;
  private isOnline: boolean = true;

  /** Wire the NetInfo listener — drain the queue when connectivity returns. */
  start() {
    if (this.netUnsub) return;
    try {
      this.netUnsub = NetInfo.addEventListener((state: NetInfoState) => {
        const online = !!state.isConnected && state.isInternetReachable !== false;
        if (online && !this.isOnline) {
          // Just came back online — drain immediately.
          this.isOnline = true;
          this.tickQueue();
        } else if (!online) {
          this.isOnline = false;
        }
      });
    } catch {
      this.isOnline = true; // Fail-open — assume online so we still try to sync.
    }
  }

  stop() {
    if (this.netUnsub) {
      try { this.netUnsub(); } catch { /* ignore */ }
      this.netUnsub = null;
    }
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
    this.listeners.clear();
  }

  /* ------- Local state ------- */

  saveLocal(noteId: string, content: PilotV2NoteContent): void {
    KVStore.setJson(K_NOTE_CONTENT(noteId), content);
    KVStore.setString(K_NOTE_DIRTY(noteId), '1');
    this.snapshotBackup(noteId, content);
    this.markOpen(noteId);
    this.emit({ noteId, status: 'queued' });
  }

  /** Read the local cached content (post-edit, possibly unsynced). */
  getLocal(noteId: string): PilotV2NoteContent | null {
    return KVStore.getJson<PilotV2NoteContent>(K_NOTE_CONTENT(noteId));
  }

  /** True if this note has unsynced local edits. */
  isDirty(noteId: string): boolean {
    return KVStore.getString(K_NOTE_DIRTY(noteId)) === '1';
  }

  /** Schedule a debounced server push — the public happy-path. */
  scheduleSync(noteId: string): void {
    const existing = this.debounceTimers.get(noteId);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      this.debounceTimers.delete(noteId);
      void this.syncToServer(noteId);
    }, SYNC_DEBOUNCE_MS);
    this.debounceTimers.set(noteId, t);
    this.emit({ noteId, status: 'queued' });
  }

  /** Immediate flush — used on editor-close / app-background. */
  async flushAll(): Promise<void> {
    // Cancel any debounced timers — we're forcing synchronous flush.
    this.debounceTimers.forEach(t => clearTimeout(t));
    this.debounceTimers.clear();
    const dirtyIds = this.getPendingDirtyNotes();
    for (const id of dirtyIds) {
      // eslint-disable-next-line no-await-in-loop
      await this.syncToServer(id);
    }
  }

  async syncToServer(noteId: string): Promise<boolean> {
    const content = this.getLocal(noteId);
    if (!content) {
      this.emit({ noteId, status: 'idle' });
      return true; // nothing to push
    }
    this.emit({ noteId, status: 'syncing' });

    let ok = false;
    try {
      ok = await savePilotV2NoteContent(noteId, content);
    } catch (e) {
      ok = false;
      this.recordFailure(noteId, (e as Error)?.message || 'network error');
      return false;
    }

    if (ok) {
      KVStore.delete(K_NOTE_DIRTY(noteId));
      KVStore.setString(K_NOTE_SYNCED(noteId), nowIso());
      this.removeFromQueue(noteId);
      this.emit({
        noteId,
        status: 'synced',
        lastSyncedAt: KVStore.getString(K_NOTE_SYNCED(noteId)) ?? undefined,
      });
      return true;
    }

    this.recordFailure(noteId, 'save returned false');
    return false;
  }

  /* ------- Retry queue ------- */

  private recordFailure(noteId: string, errMsg: string) {
    const queue = readQueue();
    const idx = queue.findIndex(q => q.noteId === noteId);
    if (idx >= 0) {
      const entry = queue[idx];
      entry.attempts = Math.min(MAX_RETRY_ATTEMPTS, entry.attempts + 1);
      entry.lastError = errMsg;
      entry.nextAttemptAt = now() + backoffMs(entry.attempts);
      queue[idx] = entry;
    } else {
      queue.push({
        noteId,
        enqueuedAt: now(),
        attempts: 1,
        lastError: errMsg,
        nextAttemptAt: now() + backoffMs(0),
      });
    }
    writeQueue(queue);
    this.emit({ noteId, status: 'failed', lastError: errMsg, attempts: queue[idx >= 0 ? idx : queue.length - 1].attempts });
    this.armRetryTimer();
  }

  private removeFromQueue(noteId: string) {
    const queue = readQueue().filter(q => q.noteId !== noteId);
    writeQueue(queue);
  }

  private armRetryTimer() {
    if (this.retryTimer) return;
    const queue = readQueue();
    if (queue.length === 0) return;
    const earliest = queue.reduce((m, q) => Math.min(m, q.nextAttemptAt), Number.POSITIVE_INFINITY);
    const delay = Math.max(500, earliest - now());
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.tickQueue();
    }, delay);
  }

  private async tickQueue(): Promise<void> {
    if (!this.isOnline) {
      this.armRetryTimer();
      return;
    }
    const queue = readQueue();
    const due = queue.filter(q => q.nextAttemptAt <= now() && q.attempts < MAX_RETRY_ATTEMPTS);
    for (const entry of due) {
      // eslint-disable-next-line no-await-in-loop
      await this.syncToServer(entry.noteId);
    }
    this.armRetryTimer();
  }

  /* ------- Crash recovery / backups ------- */

  private snapshotBackup(noteId: string, content: PilotV2NoteContent) {
    try {
      KVStore.setJson(K_NOTE_BACKUP_PFX(noteId) + now().toString(36), content);
      pruneOldBackups(noteId);
    } catch {
      /* backups are best-effort; never block the save path */
    }
  }

  /** Returns the most-recent backup snapshot (or null). */
  recoverFromCrash(noteId: string): PilotV2NoteContent | null {
    const prefix = K_NOTE_BACKUP_PFX(noteId);
    const keys = KVStore.getAllKeys().filter(k => k.startsWith(prefix)).sort();
    const latest = keys[keys.length - 1];
    if (!latest) return null;
    return KVStore.getJson<PilotV2NoteContent>(latest);
  }

  /** All locally-cached note IDs that still need a server push. */
  getPendingDirtyNotes(): string[] {
    return KVStore.getAllKeys()
      .filter(k => k.startsWith('pv2:note:') && k.endsWith(':dirty'))
      .map(k => k.slice('pv2:note:'.length, -':dirty'.length));
  }

  /** Diagnostics — current retry queue state for a status banner. */
  getQueueSnapshot(): SyncQueueEntry[] {
    return readQueue();
  }

  /** Public sync-status snapshot for one note (drives the "Pending sync" badge). */
  getSyncState(noteId: string): SyncStateSnapshot {
    if (this.isDirty(noteId)) {
      const entry = readQueue().find(q => q.noteId === noteId);
      if (entry) {
        return { noteId, status: 'failed', attempts: entry.attempts, lastError: entry.lastError };
      }
      return { noteId, status: 'queued' };
    }
    const lastSyncedAt = KVStore.getString(K_NOTE_SYNCED(noteId)) ?? undefined;
    return { noteId, status: 'synced', lastSyncedAt };
  }

  /* ------- Open-note registry (powers crash banner) ------- */

  markOpen(noteId: string) {
    const list = KVStore.getJson<string[]>(K_OPEN_NOTES) ?? [];
    if (!list.includes(noteId)) {
      list.push(noteId);
      KVStore.setJson(K_OPEN_NOTES, list);
    }
  }

  markClosed(noteId: string) {
    const list = KVStore.getJson<string[]>(K_OPEN_NOTES) ?? [];
    KVStore.setJson(K_OPEN_NOTES, list.filter(id => id !== noteId));
  }

  /* ------- Listener API ------- */

  subscribe(noteId: string, fn: SyncListener): () => void {
    let bucket = this.listeners.get(noteId);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(noteId, bucket);
    }
    bucket.add(fn);
    // Emit current state immediately for new subscribers.
    fn(this.getSyncState(noteId));
    return () => {
      const set = this.listeners.get(noteId);
      if (!set) return;
      set.delete(fn);
      if (set.size === 0) this.listeners.delete(noteId);
    };
  }

  private emit(snapshot: SyncStateSnapshot) {
    const set = this.listeners.get(snapshot.noteId);
    if (!set) return;
    set.forEach(fn => {
      try { fn(snapshot); } catch { /* listener errors must not break sync */ }
    });
  }
}

export const PilotV2SyncManager = new PilotV2SyncManagerImpl();
PilotV2SyncManager.start();

/* ------------------------------------------------------------------------- */
/* Test-only export — never use in app code (lets unit tests reset state).   */
/* ------------------------------------------------------------------------- */

export const __PilotV2SyncManagerInternals = {
  K_NOTE_CONTENT,
  K_NOTE_DIRTY,
  K_QUEUE,
  K_OPEN_NOTES,
  K_NOTE_BACKUP_PFX,
  MAX_RETRY_ATTEMPTS,
  SYNC_DEBOUNCE_MS,
  backoffMs,
};
