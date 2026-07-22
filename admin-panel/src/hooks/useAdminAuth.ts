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

    // Check dev bypass mode first
    const isBypass = sessionStorage.getItem('admin_dev_bypass') === 'true';
    if (isBypass) {
      setSession({ user: { email: 'admin@upsc.com', id: 'dev-admin-user-id' } });
      setUserId('dev-admin-user-id');
      setIsAdmin(true);
      setRole('super_admin');
      setLoading(false);
      return;
    }

    // 1. Try to get existing session from Supabase
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!isMounted) return;
      if (s?.user) {
        setSession(s);
        setUserId(s.user.id);
        setIsAdmin(true);
        setRole('super_admin');
      }
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!isMounted) return;
      if (s?.user) {
        setSession(s);
        setUserId(s.user.id);
        setIsAdmin(true);
        setRole('super_admin');
      } else if (!sessionStorage.getItem('admin_dev_bypass')) {
        setSession(null);
        setIsAdmin(false);
        setRole(null);
        setUserId(null);
      }
      setLoading(false);
    });

    // 3. Safety timeout
    setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 1500);

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    sessionStorage.removeItem('admin_dev_bypass');
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return { session, loading, isAdmin, role, userId, signOut };
}
