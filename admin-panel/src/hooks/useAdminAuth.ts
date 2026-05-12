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
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        setUserId(s.user.id);
        await checkAdmin(s.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
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

    return () => sub?.subscription?.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, loading, isAdmin, role, userId, signOut };
}