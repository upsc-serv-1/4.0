// ==========================================================================
// useAdminAuth — session + role + permission hook
// ==========================================================================

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface AdminAuthState {
  session: any;
  loading: boolean;
  isAdmin: boolean;
  role: string | null;
  userId: string | null;
  signOut: () => Promise<void>;
}

export function useAdminAuth(): AdminAuthState {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const checkAdmin = async (uid: string) => {
    try {
      const { data } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle();
      if (data) {
        setIsAdmin(true);
        setRole(data.role);
      } else {
        setIsAdmin(false);
        setRole(null);
      }
    } catch (error) {
      console.error('Error checking admin role:', error);
      setIsAdmin(false);
      setRole(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const initSession = async () => {
      // Safety timeout: Force loading off after 3.5 seconds if Supabase hangs
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Supabase session request timed out. Safety-breaking the loading screen.');
          setLoading(false);
        }
      }, 3500);

      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        clearTimeout(timeoutId);
        if (!isMounted) return;
        setSession(s);
        if (s?.user) {
          setUserId(s.user.id);
          await checkAdmin(s.user.id);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Supabase init session error:', error);
      } finally {
        clearTimeout(timeoutId);
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      if (!isMounted) return;
      setSession(s);
      if (s?.user) {
        setUserId(s.user.id);
        await checkAdmin(s.user.id);
      } else {
        setIsAdmin(false);
        setRole(null);
        setUserId(null);
      }
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, loading, isAdmin, role, userId, signOut };
}