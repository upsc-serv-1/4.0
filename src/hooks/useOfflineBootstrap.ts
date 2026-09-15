/**
 * OfflineBootstrap — wires offline-first behaviour into the app lifecycle.
 *
 * Responsibilities (invoked once from app/_layout.tsx at root):
 *   1. Ensure KVStore is ready (matters only when running the AsyncStorage
 *      fallback on web / Expo Go — native MMKV is always ready).
 *   2. When a user signs in, run a *user-data only* incremental sync:
 *        notes, tags, question_states, attempts, cards metadata, progress.
 *      These are small JSON rows and are what cross-device sync depends on.
 *   3. Start the SyncQueue worker so any offline mutations drain when online.
 *   4. On sign-out, stop workers and let the profile handler wipe the KVStore.
 *
 * IMPORTANT — what this hook deliberately does NOT do:
 *   It never calls `OfflineManager.syncAllContent`. That path downloads the
 *   entire `questions` catalogue and used to fire automatically whenever the
 *   local cache merely *looked* empty (e.g. after "Clear Offline Data"). That
 *   single call was the largest source of Supabase egress. Downloading the
 *   bank is now strictly an explicit user action from Profile → "Download for
 *   offline"; catalog top-ups happen only via Profile → "Check for updates".
 */

import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { KVStore } from '../lib/kvStore';
import { OfflineManager } from '../services/OfflineManager';
import { startSyncQueueWorker, stopSyncQueueWorker, SyncQueue } from '../services/SyncQueue';
import { useCourse } from '../context/CourseContext';
import { isCatalogLocalReady } from '../services/CatalogSource';

export function useOfflineBootstrap() {
  const { session } = useAuth();
  const { selectedCourse } = useCourse();
  const lastUserIdRef = useRef<string | null>(null);

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

      // User-scoped sync only. No catalog fetch — ever.
      try {
        const meta = await OfflineManager.getMetadata();

        if (!meta.lastFullSync) {
          // No download has ever completed. Do NOT auto-download the bank:
          // the welcome / Profile UI prompts the user to tap Download.
          console.log(
            '[OfflineBootstrap] No completed download yet — skipping auto sync.',
            'Catalog ready:', isCatalogLocalReady(selectedCourse)
          );
        } else {
          OfflineManager.syncUserData(userId).catch((e) =>
            console.warn('[OfflineBootstrap] user sync failed', e)
          );
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
  }, [session?.user?.id, selectedCourse]);
}
