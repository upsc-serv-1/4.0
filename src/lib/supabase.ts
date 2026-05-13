import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { NetworkStatus } from '../services/NetworkStatus';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

// AsyncStorage accesses window on web — safe-guard during SSR/static render.
const isBrowserOrNative = Platform.OS !== 'web' || typeof window !== 'undefined';

/**
 * offline-aware fetch wrapper.
 * When NetworkStatus reports offline, all Supabase calls fail immediately
 * so that every existing try/catch handler falls back to KVStore cache.
 * Auth token refreshes are exempt so the session stays alive.
 */
const offlineAwareFetch: typeof fetch = (input, init) => {
  if (!NetworkStatus.isOnline()) {
    const url = typeof input === 'string' ? input : (input as Request)?.url ?? '';
    // Allow auth token refresh even when offline (keeps session valid)
    if (!url.includes('/auth/v1/token')) {
      return Promise.reject(new Error('[Offline] Network request blocked — device is offline'));
    }
  }
  return fetch(input as any, init);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: offlineAwareFetch,
  },
  auth: {
    storage: isBrowserOrNative ? (AsyncStorage as any) : undefined,
    autoRefreshToken: isBrowserOrNative,
    persistSession: isBrowserOrNative,
    detectSessionInUrl: false,
  },
});

// Public delivery URL prefix from Cloudflare Images (fill once you have CF account)
export const CF_IMAGE_PREFIX = 'https://imagedelivery.net/<YOUR_CF_HASH>';

