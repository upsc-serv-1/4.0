/**
 * pilotV2LocalStore — Notability-style local-first cache
 * -------------------------------------------------------
 * Every Pilot V2 note (blocks + pencil strokes) is mirrored to the device
 * via the existing `KVStore` primitive (MMKV when available, AsyncStorage
 * fallback on Expo Go / web). Reads are synchronous; writes are persisted
 * immediately so the editor never loses an edit even if the user kills the
 * app.
 *
 * Crash recovery:
 *   On boot, every cached note is hydrated into `useNoteHydration()` which
 *   then merges with the server snapshot via "newer-wins" on `updatedAt`.
 *
 * Rolling backup:
 *   On every save we also push a snapshot into a rotating ring buffer of
 *   the last 5 saves (so we can offer "restore previous version").
 */

import { KVStore } from '../../lib/kvStore';
import { PilotV2NoteContent } from './types';

const NOTE_KEY = (noteId: string) => `pilot-v2:note:${noteId}`;
const NOTE_BACKUP_KEY = (noteId: string) => `pilot-v2:note-backup:${noteId}`;
const NOTE_DIRTY_KEY = (noteId: string) => `pilot-v2:note-dirty:${noteId}`;
const NOTE_INDEX_KEY = 'pilot-v2:note-index';
const SNAPSHOT_LIMIT = 5;

interface CachedNote {
  noteId: string;
  content: PilotV2NoteContent;
  updatedAt: string;
  /** True when the local copy is ahead of what the server has confirmed. */
  dirty: boolean;
}

interface BackupRing {
  snapshots: { content: PilotV2NoteContent; takenAt: string }[];
}

const readIndex = (): string[] => {
  return KVStore.getJson<string[]>(NOTE_INDEX_KEY) ?? [];
};
const writeIndex = (ids: string[]) => {
  KVStore.setJson(NOTE_INDEX_KEY, Array.from(new Set(ids)));
};

export const PilotV2LocalStore = {
  /** Get a cached note (sync). Returns null when not present. */
  get(noteId: string): CachedNote | null {
    return KVStore.getJson<CachedNote>(NOTE_KEY(noteId));
  },

  /** Save the latest content for a note locally + push into the rolling backup. */
  save(noteId: string, content: PilotV2NoteContent, opts: { dirty?: boolean } = {}): void {
    const next: CachedNote = {
      noteId,
      content,
      updatedAt: new Date().toISOString(),
      dirty: opts.dirty ?? true,
    };
    KVStore.setJson(NOTE_KEY(noteId), next);

    // Mark dirty for the sync queue
    if (next.dirty) {
      KVStore.setJson(NOTE_DIRTY_KEY(noteId), { dirty: true, at: next.updatedAt });
    } else {
      KVStore.delete(NOTE_DIRTY_KEY(noteId));
    }

    // Update index
    const ids = readIndex();
    if (!ids.includes(noteId)) writeIndex([...ids, noteId]);

    // Push into the backup ring
    const ring = KVStore.getJson<BackupRing>(NOTE_BACKUP_KEY(noteId)) ?? { snapshots: [] };
    ring.snapshots.push({ content, takenAt: next.updatedAt });
    if (ring.snapshots.length > SNAPSHOT_LIMIT) {
      ring.snapshots = ring.snapshots.slice(-SNAPSHOT_LIMIT);
    }
    KVStore.setJson(NOTE_BACKUP_KEY(noteId), ring);
  },

  /** Mark a note as in-sync with server (called once `savePilotV2NoteContent` succeeds). */
  markClean(noteId: string): void {
    const cur = PilotV2LocalStore.get(noteId);
    if (!cur) return;
    KVStore.setJson(NOTE_KEY(noteId), { ...cur, dirty: false });
    KVStore.delete(NOTE_DIRTY_KEY(noteId));
  },

  /** Returns IDs of every note we still owe to the server. */
  listDirty(): string[] {
    return readIndex().filter(id => {
      const cur = KVStore.getJson<{ dirty: boolean }>(NOTE_DIRTY_KEY(id));
      return cur?.dirty;
    });
  },

  /** Last 5 saves of a note — for "restore previous version" UI. */
  getBackups(noteId: string): { content: PilotV2NoteContent; takenAt: string }[] {
    return KVStore.getJson<BackupRing>(NOTE_BACKUP_KEY(noteId))?.snapshots ?? [];
  },

  /** Wipe a note from the cache (call on hard delete). */
  remove(noteId: string): void {
    KVStore.delete(NOTE_KEY(noteId));
    KVStore.delete(NOTE_BACKUP_KEY(noteId));
    KVStore.delete(NOTE_DIRTY_KEY(noteId));
    writeIndex(readIndex().filter(id => id !== noteId));
  },

  /** All cached note IDs — used by crash-recovery hydration. */
  listAll(): string[] {
    return readIndex();
  },

  /** Backend identifier ("MMKV" or "AsyncStorage") — useful in dev banners. */
  backendName(): string {
    return KVStore.isMMKV() ? 'MMKV' : 'AsyncStorage';
  },
};

export type { CachedNote };
