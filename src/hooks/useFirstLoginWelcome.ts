/**
 * useFirstLoginWelcome — tracks first login and shows onboarding modal
 *
 * On first login:
 *   - Show welcome modal with app features
 *   - Indicate that background sync is happening
 *   - Auto-dismiss after sync completes (or allow manual dismiss)
 *
 * Key: We check if lastFullSync exists in metadata to determine first login.
 */

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { OfflineManager } from '../services/OfflineManager';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LOGIN_KEY = 'first_login_modal_shown';

export interface SyncProgress {
  loaded: number;
  total: number;
}

export function useFirstLoginWelcome() {
  const { session } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress | undefined>();

  const lastUserIdRef = useRef<string | null>(null);
  const checkInitializedRef = useRef(false);

  useEffect(() => {
    if (checkInitializedRef.current) return; // Only run once per session
    
    (async () => {
      const userId = session?.user?.id;

      // No user = no welcome modal
      if (!userId) {
        lastUserIdRef.current = null;
        return;
      }

      // Different user signed in = check for first login
      if (userId !== lastUserIdRef.current) {
        lastUserIdRef.current = userId;

        try {
          // Check if we've already shown welcome for this user in this session
          const userWelcomeKey = `${FIRST_LOGIN_KEY}_${userId}`;
          const shown = await AsyncStorage.getItem(userWelcomeKey);

          if (!shown) {
            // Check metadata to see if this is truly first sync
            const meta = await OfflineManager.getMetadata();
            
            if (!meta.lastFullSync) {
              // First sync - show welcome modal and indicate sync in progress
              setShowWelcome(true);
              setSyncInProgress(true);
              
              // Mark that we've shown the modal (don't show again)
              await AsyncStorage.setItem(userWelcomeKey, 'true');
              
              // In the background, sync will happen via useOfflineBootstrap
              // Once sync completes, we'll detect it and auto-close the modal
              // Check periodically if sync completed
              const checkInterval = setInterval(async () => {
                const updatedMeta = await OfflineManager.getMetadata();
                if (updatedMeta.lastFullSync) {
                  setSyncInProgress(false);
                  clearInterval(checkInterval);
                }
              }, 2000); // Check every 2 seconds
              
              return () => clearInterval(checkInterval);
            }
          }
        } catch (e) {
          console.warn('[FirstLoginWelcome] check failed', e);
        } finally {
          checkInitializedRef.current = true;
        }
      }
    })();
  }, [session?.user?.id]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
  };

  return {
    showWelcome,
    syncInProgress,
    syncProgress,
    onCloseWelcome: handleCloseWelcome,
  };
}
