/**
 * OfflineBootstrap — wires offline-first behaviour into the app lifecycle.
 *
 * Responsibilities (invoked once from app/_layout.tsx at root):
 *   1. Ensure KVStore is ready (matters only when running the AsyncStorage
 *      fallback on web / Expo Go — native MMKV is always ready).
 *   2. When a user signs in:
 *        - If no full sync has ever happened, kick off OfflineManager.syncAllContent
 *          in the background (non-blocking — the UI is free to render from
 *          whatever cache exists).
 *        - Otherwise, run an incrementalSync in the background.
 *   3. Start the SyncQueue worker so any offline mutations drain when online.
 *   4. On sign-out, stop workers and wipe the offline KVStore for that user.
 *
 * This component renders nothing. It's mounted near the top of the tree.
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { KVStore } from '../lib/kvStore';
import { OfflineManager } from '../services/OfflineManager';
import { startSyncQueueWorker, stopSyncQueueWorker, SyncQueue } from '../services/SyncQueue';

export function useOfflineBootstrap() {
  const { session } = useAuth();
  const lastUserIdRef = useRef<string | null>(null);
  const fullSyncInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await KVStore.ready();
      if (cancelled) return;

      const userId = session?.user?.id ?? null;
      const prevUserId = lastUserIdRef.current;
      lastUserIdRef.current = userId;

      // User signed out
      if (!userId) {
        if (prevUserId) {
          stopSyncQueueWorker();
          // don't wipe offline data on every layout re-run — only if we
          // had a previous user. The user might just be on login screen.
          // (Full wipe happens from the profile sign-out handler.)
        }
        return;
      }

      // Start background queue worker (idempotent)
      startSyncQueueWorker(30_000);

      // Check if questions are actually cached (not just metadata).
      // This handles the case where the user cleared the download cache: even if
      // metadata.lastFullSync is set, the actual question data is gone, so we must
      // re-run a full sync to repopulate MMKV.
      try {
        const meta = await OfflineManager.getMetadata();
        const cachedQuestions = OfflineManager.getOfflineQuestionsAllSync();
        const hasQuestions = cachedQuestions.length > 0;

        if ((!meta.lastFullSync || !hasQuestions) && !fullSyncInFlight.current) {
          fullSyncInFlight.current = true;
          console.log('[OfflineBootstrap] Starting full sync', { 
            reason: !meta.lastFullSync ? 'no lastFullSync' : 'no cached questions',
            cachedCount: cachedQuestions.length 
          });
          // fire-and-forget — progress is surfaced by any screen that cares
          OfflineManager.syncAllContent(userId)
            .catch((e) => console.warn('[OfflineBootstrap] initial full sync failed', e))
            .finally(() => {
              fullSyncInFlight.current = false;
            });
        } else {
          // Incremental pull to catch up on anything that changed while offline.
          OfflineManager.incrementalSync(userId).catch(() => {});
        }
      } catch (e) {
        console.warn('[OfflineBootstrap] metadata check failed', e);
      }

      // Opportunistically drain the sync queue now that we're (probably) online.
      if (SyncQueue.pendingCount() > 0) {
        SyncQueue.drain().catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);
}
