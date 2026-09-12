/**
 * pilotV2SyncQueue — background retry queue for unsynced Pilot V2 notes.
 * ---------------------------------------------------------------------
 * On every save, we mark the note dirty in `pilotV2LocalStore`. This module
 * watches network state and replays the dirty notes to Supabase whenever
 * connectivity is available, with exponential backoff.
 *
 * It's a thin wrapper — the heavy lifting is in pilotV2LocalStore + the
 * existing `savePilotV2NoteContent` repository function.
 */

import NetInfo from '@react-native-community/netinfo';
import { savePilotV2NoteContent } from '../../repositories/pilotV2Repo';
import { PilotV2LocalStore } from './pilotV2LocalStore';

let online = true;
let processing = false;
let retryDelay = 2000;
const MAX_DELAY = 30_000;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const flushOnce = async (): Promise<void> => {
  if (processing) return;
  processing = true;
  try {
    const dirty = PilotV2LocalStore.listDirty();
    for (const noteId of dirty) {
      const cached = PilotV2LocalStore.get(noteId);
      if (!cached) continue;
      try {
        const ok = await savePilotV2NoteContent(noteId, cached.content);
        if (ok) {
          PilotV2LocalStore.markClean(noteId);
          retryDelay = 2000; // reset on success
        }
      } catch (e) {
        // network error → keep dirty, will retry next tick
        // eslint-disable-next-line no-console
        console.warn('[pilot-v2] sync retry will run later', noteId, (e as Error).message);
      }
    }
  } finally {
    processing = false;
  }
};

/** Public — called whenever the user makes an edit. Best-effort flush + schedule. */
export const triggerSync = async (): Promise<void> => {
  if (!online) return; // wait for NetInfo to flip
  await flushOnce();
};

/** Subscribe to NetInfo and start the retry loop. Idempotent. */
let started = false;
export const startPilotV2SyncQueue = (): (() => void) => {
  if (started) return () => undefined;
  started = true;

  const unsub = NetInfo.addEventListener((state) => {
    const next = !!(state.isConnected && state.isInternetReachable !== false);
    if (next && !online) {
      // network came back → retry immediately
      retryDelay = 1000;
      flushOnce().catch(() => undefined);
    }
    online = next;
  });

  // Periodic retry timer for stragglers (covers the case where the server is
  // online but a transient 5xx happened).
  const tick = setInterval(async () => {
    if (!online) return;
    if (PilotV2LocalStore.listDirty().length === 0) return;
    await flushOnce();
    retryDelay = Math.min(retryDelay * 1.5, MAX_DELAY);
  }, 8000);

  return () => {
    unsub();
    clearInterval(tick);
    started = false;
  };
};
