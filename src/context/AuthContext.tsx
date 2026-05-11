import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { KVStore } from '../lib/kvStore';
import { OfflineManager } from '../services/OfflineManager';
import { SyncQueue, stopSyncQueueWorker, startSyncQueueWorker } from '../services/SyncQueue';

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Auth Timeout')), 5000));
        const { data } = await Promise.race([supabase.auth.getSession(), timeout]) as any;
        setSession(data?.session || null);

      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
    
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // Start SyncQueue worker when user logs in
      if (s?.user?.id) {
        startSyncQueueWorker();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
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
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, loading, signIn, signUp, signOut }}>{children}</Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
