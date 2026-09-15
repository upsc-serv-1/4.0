import { supabase } from '../lib/supabase';
import { NetworkStatus } from '../lib/networkStatus';
import { KVStore } from '../lib/kvStore';
import { SyncQueue } from './SyncQueue';
import { OfflineManager } from './OfflineManager';

export interface SyllabusProgress {
  ncert: boolean;
  pyqs: boolean;
  books: boolean;
  test: boolean;
  mastered: boolean;
  ansWriting?: boolean;
}

/**
 * Local progress lives in the OfflineManager MMKV collection
 * (`@user_syllabus_progress_<uid>`), which is populated by the user-data sync
 * and wiped by "Clear offline data". This service previously kept a *second*
 * copy in AsyncStorage under `upsc_syllabus_progress_*`; that duplicate could
 * drift from the MMKV copy and survived a cache clear. It is now single-source.
 */
export class SyllabusService {
  private static toMap(rows: any[]): Record<string, SyllabusProgress> {
    const progress: Record<string, SyllabusProgress> = {};
    (rows || []).forEach((row: any) => {
      if (row?.path) progress[row.path] = row.status;
    });
    return progress;
  }

  static async getProgress(userId: string) {
    if (!userId) return {};

    // Offline-first: the MMKV copy is synchronous and authoritative on device.
    const localRows = OfflineManager.getCollectionSync('user_syllabus_progress', userId);
    const cached = this.toMap(localRows);

    if (!NetworkStatus.isOnline()) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('user_syllabus_progress')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      const progress = this.toMap(data || []);
      // Keep the shared MMKV collection in step with the server response.
      if (data) {
        KVStore.setJson(`@user_syllabus_progress_${userId}`, data);
      }
      return progress;
    } catch {
      return cached;
    }
  }

  static async getCachedProgress(userId: string) {
    if (!userId) return {};
    return this.toMap(OfflineManager.getCollectionSync('user_syllabus_progress', userId));
  }

  static async updateProgress(userId: string, path: string, status: SyllabusProgress) {
    // 1. Update the shared MMKV collection first so UI reflects the change
    //    instantly and "Clear offline data" cannot miss it.
    const rows = OfflineManager.getCollectionSync('user_syllabus_progress', userId) as any[];
    const next = [...rows];
    const idx = next.findIndex((r: any) => r?.path === path);
    const record = {
      id: idx >= 0 ? next[idx].id : undefined,
      user_id: userId,
      path,
      status,
      updated_at: new Date().toISOString(),
    };
    if (idx >= 0) next[idx] = { ...next[idx], ...record };
    else next.push(record);
    KVStore.setJson(`@user_syllabus_progress_${userId}`, next);

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
