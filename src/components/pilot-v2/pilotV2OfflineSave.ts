/**
 * pilotV2OfflineSave — local-first save wrapper for Pilot V2.
 * -----------------------------------------------------------
 * Replace direct calls to `savePilotV2NoteContent` with this function so:
 *   1. Edits land in the device cache instantly (KVStore / MMKV).
 *   2. A best-effort server save fires immediately.
 *   3. If offline, the note is marked dirty and the sync queue retries
 *      automatically when the network comes back.
 */

import { PilotV2LocalStore } from './pilotV2LocalStore';
import { triggerSync } from './pilotV2SyncQueue';
import { savePilotV2NoteContent as remoteSave } from '../../repositories/pilotV2Repo';
import { PilotV2NoteContent } from './types';

export async function savePilotV2NoteOfflineFirst(
  noteId: string,
  content: PilotV2NoteContent,
): Promise<{ savedLocal: boolean; savedRemote: boolean }> {
  // 1. Always write locally first — this is what makes the editor crash-safe.
  PilotV2LocalStore.save(noteId, content, { dirty: true });

  // 2. Try the server in parallel; mark clean on success.
  let savedRemote = false;
  try {
    savedRemote = await remoteSave(noteId, content);
    if (savedRemote) PilotV2LocalStore.markClean(noteId);
  } catch (e) {
    // intentional swallow — sync queue will retry
    // eslint-disable-next-line no-console
    console.warn('[pilot-v2] remote save failed, queued for retry', (e as Error).message);
  }

  // 3. Kick the queue (covers any other dirty notes from this session).
  triggerSync().catch(() => undefined);

  return { savedLocal: true, savedRemote };
}

/** Hydrate a note from local storage with newer-wins merge against the
 *  given remote snapshot (passed in by the caller after a Supabase fetch). */
export function hydratePilotV2Note(
  noteId: string,
  remote: { content: PilotV2NoteContent; updatedAt: string } | null,
): { content: PilotV2NoteContent; source: 'local' | 'remote' | 'empty' } {
  const local = PilotV2LocalStore.get(noteId);
  if (!local && !remote) {
    return { content: { blocks: [], version: 1 }, source: 'empty' };
  }
  if (!local) return { content: remote!.content, source: 'remote' };
  if (!remote) return { content: local.content, source: 'local' };
  // newer-wins
  const localT = Date.parse(local.updatedAt) || 0;
  const remoteT = Date.parse(remote.updatedAt) || 0;
  if (localT > remoteT || local.dirty) {
    return { content: local.content, source: 'local' };
  }
  // server has the latest → also refresh local copy so subsequent reads are
  // consistent without a fresh fetch
  PilotV2LocalStore.save(noteId, remote.content, { dirty: false });
  return { content: remote.content, source: 'remote' };
}
