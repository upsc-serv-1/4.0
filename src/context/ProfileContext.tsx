import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type ProfileCtx = {
  displayName: string;
  avatarId: string;
  updateProfile: (name: string, avatarId: string) => Promise<void>;
};

const Ctx = createContext<ProfileCtx>({
  displayName: '',
  avatarId: '',
  updateProfile: async () => {},
});

export function ProfileProvider({ children, session }: { children: React.ReactNode; session: Session | null }) {
  const [displayName, setDisplayName] = useState<string>(
    (session?.user?.user_metadata as any)?.display_name || session?.user?.email?.split('@')[0] || 'Aspirant'
  );
  const [avatarId, setAvatarId] = useState<string>((session?.user?.user_metadata as any)?.avatar_id || '');
  const [loaded, setLoaded] = useState(false);

  // Load profile from cache on mount (only once)
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const name = await AsyncStorage.getItem('profile_display_name');
        const avatar = await AsyncStorage.getItem('profile_avatar_id');
        
        if (name) setDisplayName(name.trim());
        if (avatar) setAvatarId(avatar);
      } catch (err) {
        console.error('[ProfileContext] Failed to load profile:', err);
      } finally {
        setLoaded(true);
      }
    };

    loadProfile();
  }, []);

  // Fetch name from users table in database when session is loaded or changed
  useEffect(() => {
    if (!session?.user?.id) return;

    const fetchNameFromDb = async () => {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('name')
          .eq('id', session.user.id)
          .single();
        
        if (error) {
          console.warn('[ProfileContext] Error fetching name from users table:', error);
          return;
        }

        if (data && data.name) {
          const dbName = data.name.trim();
          setDisplayName(dbName);
          await AsyncStorage.setItem('profile_display_name', dbName);
        } else {
          // If name is null/empty in database users table, sync it from auth metadata display_name
          const metadataName = (session?.user?.user_metadata as any)?.display_name || session?.user?.email?.split('@')[0] || 'Aspirant';
          if (metadataName && metadataName !== 'Aspirant') {
            await supabase
              .from('users')
              .update({ name: metadataName })
              .eq('id', session.user.id);
            setDisplayName(metadataName);
            await AsyncStorage.setItem('profile_display_name', metadataName);
          }
        }
      } catch (err) {
        console.error('[ProfileContext] Failed to fetch name from users table:', err);
      }
    };

    fetchNameFromDb();
  }, [session?.user?.id]);

  const updateProfile = useCallback(async (name: string, avatar: string) => {
    setDisplayName(name);
    setAvatarId(avatar);
    
    try {
      await AsyncStorage.setItem('profile_display_name', name.trim());
      await AsyncStorage.setItem('profile_avatar_id', avatar);

      // Save name column to users table in database
      if (session?.user?.id) {
        const { error: dbErr } = await supabase
          .from('users')
          .update({ name: name.trim() })
          .eq('id', session.user.id);
        
        if (dbErr) {
          console.warn('[ProfileContext] Error updating name in users table:', dbErr);
        }
      }
    } catch (err) {
      console.error('[ProfileContext] Failed to save profile:', err);
    }
  }, [session?.user?.id]);

  return (
    <Ctx.Provider value={{ displayName, avatarId, updateProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export const useProfile = () => {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return ctx;
};
