import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { KVStore } from '../lib/kvStore';
import { NetworkStatus } from '../lib/networkStatus';
import { OfflineManager } from '../services/OfflineManager';
import { SyncQueue, stopSyncQueueWorker, startSyncQueueWorker } from '../services/SyncQueue';

export const AUTH_SESSION_KEY = 'auth:cached_session';
export const AUTH_IS_ADMIN_KEY = 'auth:cached_is_admin';

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Synchronous read from KVStore (MMKV) on mount so session is ready immediately
  const [session, setSession] = useState<Session | null>(() => {
    try {
      const cached = KVStore.getJson<Session>(AUTH_SESSION_KEY);
      if (cached?.user?.id) return cached;
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    try {
      const cached = KVStore.getJson<boolean>(AUTH_IS_ADMIN_KEY);
      if (cached !== null && cached !== undefined) return cached;
    } catch {}
    return false;
  });

  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;

  const checkAdminStatus = async (userId: string, email: string) => {
    const hardcodedAdmins = ['dryogeshkumar@gmail.com', 'admin@sunyaias.com', 'yogesh@sunyaias.com'];
    if (hardcodedAdmins.includes(email || '')) {
      setIsAdmin(true);
      KVStore.setJson(AUTH_IS_ADMIN_KEY, true);
      return;
    }

    if (NetworkStatus.isOffline()) {
      const cached = KVStore.getJson<boolean>(AUTH_IS_ADMIN_KEY);
      if (cached !== null && cached !== undefined) {
        setIsAdmin(cached);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin');

      if (data && data.length > 0) {
        setIsAdmin(true);
        KVStore.setJson(AUTH_IS_ADMIN_KEY, true);
      } else if (!error) {
        setIsAdmin(false);
        KVStore.setJson(AUTH_IS_ADMIN_KEY, false);
      }
    } catch (err) {
      console.warn('[AuthContext] Error checking admin status:', err);
      const cached = KVStore.getJson<boolean>(AUTH_IS_ADMIN_KEY);
      if (cached !== null && cached !== undefined) {
        setIsAdmin(cached);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // 1. Recover previously persisted session from KVStore or AsyncStorage
        let existingSession = sessionRef.current;
        if (!existingSession?.user?.id) {
          const cached = KVStore.getJson<Session>(AUTH_SESSION_KEY);
          if (cached?.user?.id) {
            existingSession = cached;
          } else {
            try {
              const storageKey = (supabase.auth as any).storageKey || 'sb-rnelxupyiejsqekmcrcz-auth-token';
              const raw = await AsyncStorage.getItem(storageKey);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.user?.id) {
                  existingSession = parsed;
                  KVStore.setJson(AUTH_SESSION_KEY, parsed);
                }
              }
            } catch {}
          }
        }

        if (existingSession?.user?.id && isMounted) {
          setSession(existingSession);
          const cachedAdmin = KVStore.getJson<boolean>(AUTH_IS_ADMIN_KEY);
          if (cachedAdmin !== null && cachedAdmin !== undefined) {
            setIsAdmin(cachedAdmin);
          }
          checkAdminStatus(existingSession.user.id, existingSession.user.email || '');
        }

        // 2. If offline, keep the existing session and finish loading without calling network
        if (NetworkStatus.isOffline()) {
          console.log('[AuthContext] Booting offline, preserving session:', !!existingSession);
          if (isMounted) setLoading(false);
          return;
        }

        // 3. If online, verify/refresh session with Supabase
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth Timeout')), 5000));
        const { data, error } = (await Promise.race([supabase.auth.getSession(), timeout])) as any;

        if (data?.session?.user?.id && isMounted) {
          const freshSession = data.session;
          setSession(freshSession);
          KVStore.setJson(AUTH_SESSION_KEY, freshSession);
          checkAdminStatus(freshSession.user.id, freshSession.user.email || '');
        } else if (error) {
          console.warn('[AuthContext] getSession returned error during init:', error);
          // If network failed, do NOT wipe an existing session!
          if (!existingSession?.user?.id && isMounted) {
            setSession(null);
            setIsAdmin(false);
          }
        } else if (!data?.session && !existingSession?.user?.id && isMounted) {
          // Genuinely no session in storage
          setSession(null);
          setIsAdmin(false);
          KVStore.delete(AUTH_SESSION_KEY);
        }
      } catch (err) {
        console.warn('[AuthContext] Auth init timeout or network error:', err);
        // On timeout/error, do NOT wipe existing session if present
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Listen to Supabase auth state changes
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[AuthContext] onAuthStateChange:', event, 'session exists:', !!s);

      if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setSession(null);
          setIsAdmin(false);
        }
        KVStore.delete(AUTH_SESSION_KEY);
        KVStore.delete(AUTH_IS_ADMIN_KEY);
        stopSyncQueueWorker();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (s?.user?.id && isMounted) {
          setSession(s);
          KVStore.setJson(AUTH_SESSION_KEY, s);
          startSyncQueueWorker();
          checkAdminStatus(s.user.id, s.user.email || '');
        }
        return;
      }

      if (event === 'INITIAL_SESSION') {
        if (s?.user?.id && isMounted) {
          setSession(s);
          KVStore.setJson(AUTH_SESSION_KEY, s);
          startSyncQueueWorker();
          checkAdminStatus(s.user.id, s.user.email || '');
        } else if (!s) {
          // Supabase emitted INITIAL_SESSION null (happens offline when expired token refresh fails).
          // If we have a cached session, PRESERVE IT so the user is not kicked to login screen!
          const cached = sessionRef.current || KVStore.getJson<Session>(AUTH_SESSION_KEY);
          if (cached?.user?.id) {
            console.log('[AuthContext] INITIAL_SESSION null offline, preserving cached session');
            if (isMounted) setSession(cached);
          } else if (isMounted) {
            setSession(null);
            setIsAdmin(false);
          }
        }
        return;
      }
    });

    // When connection is restored, background-refresh session with Supabase
    const unsubNetwork = NetworkStatus.subscribe(async (online) => {
      if (online) {
        const cur = sessionRef.current;
        if (cur?.user?.id) {
          try {
            console.log('[AuthContext] Device reconnected online, refreshing session in background...');
            const { data } = await supabase.auth.getSession();
            if (data?.session?.user?.id && isMounted) {
              setSession(data.session);
              KVStore.setJson(AUTH_SESSION_KEY, data.session);
              checkAdminStatus(data.session.user.id, data.session.user.email || '');
            }
          } catch (e) {
            console.warn('[AuthContext] Background refresh on reconnect failed:', e);
          }
        }
      }
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
      unsubNetwork();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data?.session) {
      setSession(data.session);
      KVStore.setJson(AUTH_SESSION_KEY, data.session);
      if (data.session.user?.id) {
        checkAdminStatus(data.session.user.id, data.session.user.email || '');
      }
    }
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (!error && data?.session) {
      setSession(data.session);
      KVStore.setJson(AUTH_SESSION_KEY, data.session);
      if (data.session.user?.id) {
        checkAdminStatus(data.session.user.id, data.session.user.email || '');
      }
    }
    return { error: error?.message };
  };

  const signOut = async () => {
    // Flush pending mutations before clearing cache
    try {
      await SyncQueue.drain();
    } catch {
      // Best-effort — don't block sign-out if drain fails
    }
    stopSyncQueueWorker();
    await OfflineManager.clearAllOfflineData();
    SyncQueue.clearAll();
    KVStore.delete(AUTH_SESSION_KEY);
    KVStore.delete(AUTH_IS_ADMIN_KEY);
    setSession(null);
    setIsAdmin(false);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('[AuthContext] Error during supabase.auth.signOut:', e);
    }
  };

  return (
    <Ctx.Provider value={{ session, loading, isAdmin, signIn, signUp, signOut }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
