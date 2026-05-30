import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL!;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Check if a storage type is available
const isStorageAvailable = (storage: Storage) => {
  try {
    const test = '__storage_test__';
    storage.setItem(test, test);
    storage.removeItem(test);
    return true;
  } catch {
    return false;
  }
};

// Memory-based storage for fallback
const memoryStorage: Record<string, string> = {};

const customStorage = {
  getItem: (key: string) => {
    // Try sessionStorage first (persists across refresh, works in Incognito)
    if (isStorageAvailable(sessionStorage)) {
      const value = sessionStorage.getItem(key);
      if (value) {
        console.log(`[Storage] sessionStorage.getItem(${key}) - found`);
        return value;
      }
    }
    
    // Try localStorage (persists across sessions, doesn't work in Incognito)
    if (isStorageAvailable(localStorage)) {
      const value = localStorage.getItem(key);
      if (value) {
        console.log(`[Storage] localStorage.getItem(${key}) - found`);
        return value;
      }
    }
    
    // Fall back to memory
    if (memoryStorage[key]) {
      console.log(`[Storage] memory.getItem(${key}) - found`);
      return memoryStorage[key];
    }
    
    console.log(`[Storage] getItem(${key}) - not found in any storage`);
    return null;
  },
  setItem: (key: string, value: string) => {
    // Try sessionStorage first (works in Incognito)
    if (isStorageAvailable(sessionStorage)) {
      try {
        sessionStorage.setItem(key, value);
        console.log(`[Storage] sessionStorage.setItem(${key}) - OK`);
        return;
      } catch (e) {
        console.log(`[Storage] sessionStorage.setItem failed:`, e);
      }
    }
    
    // Try localStorage
    if (isStorageAvailable(localStorage)) {
      try {
        localStorage.setItem(key, value);
        console.log(`[Storage] localStorage.setItem(${key}) - OK`);
        return;
      } catch (e) {
        console.log(`[Storage] localStorage.setItem failed:`, e);
      }
    }
    
    // Fall back to memory
    memoryStorage[key] = value;
    console.log(`[Storage] memory.setItem(${key}) - OK`);
  },
  removeItem: (key: string) => {
    if (isStorageAvailable(sessionStorage)) {
      try {
        sessionStorage.removeItem(key);
        console.log(`[Storage] sessionStorage.removeItem(${key}) - OK`);
      } catch {}
    }
    
    if (isStorageAvailable(localStorage)) {
      try {
        localStorage.removeItem(key);
        console.log(`[Storage] localStorage.removeItem(${key}) - OK`);
      } catch {}
    }
    
    delete memoryStorage[key];
    console.log(`[Storage] memory.removeItem(${key}) - OK`);
  },
};

console.log('[Supabase Init] sessionStorage available:', isStorageAvailable(sessionStorage));
console.log('[Supabase Init] localStorage available:', isStorageAvailable(localStorage));

export const supabase = createClient(url, key, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
