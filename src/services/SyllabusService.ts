import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkStatus } from '../lib/networkStatus';
import { SyncQueue } from './SyncQueue';

export interface SyllabusProgress {
  ncert: boolean;
  pyqs: boolean;
  books: boolean;
  test: boolean;
  mastered: boolean;
  ansWriting?: boolean;
}

export class SyllabusService {
  private static STORAGE_KEY = 'upsc_syllabus_progress';

  static async getProgress(userId: string) {
    const cacheKey = `${this.STORAGE_KEY}_${userId}`;
    // Offline-first: read cache immediately.
    const local = await AsyncStorage.getItem(cacheKey);
    const cached = local ? JSON.parse(local) : {};

    if (!NetworkStatus.isOnline()) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('user_syllabus_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const progress: Record<string, SyllabusProgress> = {};
      data.forEach((row: any) => {
        progress[row.path] = row.status;
      });

      await AsyncStorage.setItem(cacheKey, JSON.stringify(progress));
      return progress;
    } catch {
      return cached;
    }
  }

  static async getCachedProgress(userId: string) {
    const cacheKey = `${this.STORAGE_KEY}_${userId}`;
    const local = await AsyncStorage.getItem(cacheKey);
    return local ? JSON.parse(local) : {};
  }

  static async updateProgress(userId: string, path: string, status: SyllabusProgress) {
    const cacheKey = `${this.STORAGE_KEY}_${userId}`;
    // 1. Always update local cache first so UI reflects the change instantly.
    const local = await AsyncStorage.getItem(cacheKey);
    const data = local ? JSON.parse(local) : {};
    data[path] = status;
    await AsyncStorage.setItem(cacheKey, JSON.stringify(data));

    const payload = {
      user_id: userId,
      path,
      status,
      updated_at: new Date().toISOString(),
    };

    // 2. Push to Supabase if online. If offline, enqueue for sync on reconnect.
    if (!NetworkStatus.isOnline()) {
      SyncQueue.enqueue('syllabus_progress_upsert', payload);
      return;
    }
    try {
      const { error } = await supabase
        .from('user_syllabus_progress')
        .upsert(payload, { onConflict: 'user_id,path' });
      if (error) throw error;
    } catch {
      // Network call failed (real device dropped offline mid-call). Queue it.
      SyncQueue.enqueue('syllabus_progress_upsert', payload);
    }
  }
}
