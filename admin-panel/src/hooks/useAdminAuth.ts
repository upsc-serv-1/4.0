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
      console.log('Checking admin status for user:', uid);
      const { data, error } = await supabase
        .from('admin_users')
        .select('role')
        .eq('user_id', uid)
        .maybeSingle();
      
      console.log('Admin check result:', { data, error });
      
      if (data) {
        console.log('Admin found with role:', data.role);
        setIsAdmin(true);
        setRole(data.role);
      } else {
        console.log('No admin record found for user:', uid);
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
      console.log('=== Auth Init Starting ===');
      
      // Safety timeout: Force loading off after 5 seconds if Supabase hangs
      const timeoutId = setTimeout(() => {
        if (isMounted) {
          console.warn('Supabase session request timed out. Safety-breaking the loading screen.');
          setLoading(false);
        }
      }, 5000);

      try {
        // First, get the current session
        console.log('Attempting to get session...');
        const { data: { session: s }, error } = await supabase.auth.getSession();
        
        console.log('Session response:', { session: s?.user?.id, error });
        
        if (error) {
          console.error('Error getting session:', error);
          clearTimeout(timeoutId);
          if (isMounted) {
            setLoading(false);
          }
          return;
        }

        clearTimeout(timeoutId);
        if (!isMounted) return;
        
        setSession(s);
        
        if (s?.user) {
          console.log('Session found for user:', s.user.id);
          setUserId(s.user.id);
          await checkAdmin(s.user.id);
          console.log('=== Auth Init Complete (With Session) ===');
        } else {
          console.log('No session found');
          console.log('=== Auth Init Complete (No Session) ===');
        }
        
        // IMPORTANT: Only set loading to false AFTER admin check completes
        if (isMounted) setLoading(false);
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Supabase init session error:', error);
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    // Set up real-time listener for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, s) => {
      console.log('Auth state changed event:', event, 'User:', s?.user?.id);
      if (!isMounted) return;
      
      setSession(s);
      if (s?.user) {
        console.log('Auth state update - user found:', s.user.id);
        setUserId(s.user.id);
        await checkAdmin(s.user.id);
      } else {
        console.log('Auth state update - no user');
        setIsAdmin(false);
        setRole(null);
        setUserId(null);
      }
    });

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