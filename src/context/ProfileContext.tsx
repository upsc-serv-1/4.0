import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';

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

  const updateProfile = useCallback(async (name: string, avatar: string) => {
    setDisplayName(name);
    setAvatarId(avatar);
    
    try {
      await AsyncStorage.setItem('profile_display_name', name.trim());
      await AsyncStorage.setItem('profile_avatar_id', avatar);
    } catch (err) {
      console.error('[ProfileContext] Failed to save profile:', err);
    }
  }, []);

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
