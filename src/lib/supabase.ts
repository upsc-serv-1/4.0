import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { NetworkStatus } from './networkStatus';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ngwsuqzkndlxfoantnlf.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_jvMJygEAm0GdUAiz4RvlYQ_DCTOBApa';

// AsyncStorage accesses window on web — safe-guard during SSR/static render.
const isBrowserOrNative = Platform.OS !== 'web' || typeof window !== 'undefined';

/**
 * Offline-aware fetch wrapper.
 *
 * If `NetworkStatus.isOffline()` is true (real device offline OR the diagnostic
 * "Simulate Offline" switch is on), we short-circuit Supabase REST + Auth calls
 * with a synthetic "Network request failed" error.
 *
 * Why? When the diagnostic toggles offline mode it only patches `global.fetch`,
 * but the Supabase JS client uses its own fetch (passed at create time). Going
 * through a single guard here means EVERY call site — even ones that don't
 * check `useNetwork()` — automatically stops generating network requests when
 * offline, which is exactly what airplane mode does on a real device.
 *
 * Local (non-Supabase) requests are allowed through. We only intercept the
 * configured Supabase host so unrelated `fetch()` traffic (e.g. asset loads,
 * Cloudflare images) is not impacted.
 */
const supabaseFetch: typeof fetch = (input, init) => {
  const url = typeof input === 'string'
    ? input
    : (input as any)?.url || '';
  const isSupabaseUrl = typeof url === 'string' && url.includes(supabaseUrl);

  if (isSupabaseUrl && NetworkStatus.isOffline()) {
    // Track for the offline diagnostic log so the user can see what was blocked.
    try {
      const g: any = globalThis as any;
      if (Array.isArray(g.__offlineDiagBlocked)) {
        const short = String(url).replace(/https:\/\/[^/]+\//, '').substring(0, 200);
        g.__offlineDiagBlocked.push({ ts: Date.now(), url: short, screen: 'supabase-client' });
      }
    } catch { /* ignore */ }
    return Promise.reject(new TypeError('Network request failed (offline)'));
  }

  // Defer to the platform fetch (which may itself be patched by the diagnostic).
  return (globalThis as any).fetch(input as any, init as any);
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isBrowserOrNative ? (AsyncStorage as any) : undefined,
    autoRefreshToken: isBrowserOrNative,
    persistSession: isBrowserOrNative,
    detectSessionInUrl: false,
  },
  global: {
    fetch: supabaseFetch,
  },
});

// Public delivery URL prefix from Cloudflare Images (fill once you have CF account)
export const CF_IMAGE_PREFIX = 'https://imagedelivery.net/<YOUR_CF_HASH>';
