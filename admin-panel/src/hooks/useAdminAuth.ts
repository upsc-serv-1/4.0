// ==========================================================================
// useAdminAuth — session + role + permission hook
// Minimal: any logged-in user is admin, always shows login if no session
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

  useEffect(() => {
    let isMounted = true;

    // 1. Try to get existing session
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!isMounted) return;
      if (s?.user) {
        setSession(s);
        setUserId(s.user.id);
        setIsAdmin(true);
        setRole('super_admin');
        setLoading(false);
      }
    });

    // 2. Listen for auth changes (handles login + restore)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!isMounted) return;
      if (s?.user) {
        setSession(s);
        setUserId(s.user.id);
        setIsAdmin(true);
        setRole('super_admin');
      } else {
        setSession(null);
        setIsAdmin(false);
        setRole(null);
        setUserId(null);
      }
      setLoading(false);
    });

    // 3. Safety — stop loading after 2 seconds no matter what
    setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2000);

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { session, loading, isAdmin, role, userId, signOut };
}
