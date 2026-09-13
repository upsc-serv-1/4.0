import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KVStore } from '../lib/kvStore';
import { fetchAllPilotV2Nodes } from '../repositories/pilotV2Repo';

export interface DailyTask {
  id: string;
  title: string;
  time_slot: string;
  is_completed: boolean;
  task_date?: string;
}

export interface StudyStreak {
  current_streak: number;
  weekly_history: boolean[]; // 7 elements for Mon-Sun
  last_activity_date: string;
}

export interface DailyInsight {
  id: string;
  quote_text: string;
  author: string;
  category: string;
  image_url?: string;
}

const DEFAULT_TASKS: DailyTask[] = [
  { id: '1', title: 'Read Laxmikanth – Parliament', time_slot: '9:00 – 10:00 AM', is_completed: true },
  { id: '2', title: 'Solve Prelims Test (Polity)', time_slot: '11:00 – 12:00 PM', is_completed: false },
  { id: '3', title: 'Make Notes – S&T (AI)', time_slot: '2:00 – 3:00 PM', is_completed: false },
  { id: '4', title: 'Revise Flashcards (Environment)', time_slot: '7:00 – 8:00 PM', is_completed: false },
];

const DEFAULT_RECENT_NOTES = [
  { id: '1', title: 'Federalism – Key Points (Mains)', updated_at: 'Today, 6:30 PM' },
  { id: '2', title: 'Climate Change – Impacts', updated_at: 'Today, 4:12 PM' },
  { id: '3', title: 'Ethics Case Study – Integrity', updated_at: 'Yesterday, 9:20 PM' },
  { id: '4', title: 'India–US Relations – Recent Developments', updated_at: 'Yesterday, 5:15 PM' },
];

const DEFAULT_INSIGHTS: DailyInsight[] = [
  {
    id: '1',
    quote_text: '“Governance is not about power, but about enabling people.”',
    author: '— Dr. A.P.J. Abdul Kalam',
    category: 'Governance',
  },
  {
    id: '2',
    quote_text: '“Success in UPSC is not a sprint, but a well-paced marathon.”',
    author: '— Dr. A.P.J. Abdul Kalam',
    category: 'Motivation',
  },
  {
    id: '3',
    quote_text: '“You have to dream before your dreams can come true.”',
    author: '— Dr. A.P.J. Abdul Kalam',
    category: 'Inspiration',
  },
];

export const HomescreenService = {
  async getTodayTasks(userId?: string): Promise<DailyTask[]> {
    const unifiedKey = `daily_tasks_${userId || 'guest'}`;
    
    try {
      // 1. Try MMKV (ultra-fast synchronous)
      const mmkvTasks = KVStore.getJson<DailyTask[]>(unifiedKey);
      if (mmkvTasks && Array.isArray(mmkvTasks) && mmkvTasks.length > 0) {
        HomescreenService.syncFromCloud(userId, unifiedKey);
        return mmkvTasks;
      }

      // 2. Try AsyncStorage unified key
      const cached = await AsyncStorage.getItem(unifiedKey);
      if (cached !== null) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          KVStore.setJson(unifiedKey, parsed);
          HomescreenService.syncFromCloud(userId, unifiedKey);
          return parsed;
        }
      }

      // 3. RECOVERY: Check older date-based keys (e.g. daily_tasks_*_2026-09-12 from yesterday!)
      const allKeys = await AsyncStorage.getAllKeys();
      const taskKeys = allKeys.filter(k => k.startsWith('daily_tasks_'));
      const recoveredMap = new Map<string, DailyTask>();

      for (const k of taskKeys) {
        try {
          const raw = await AsyncStorage.getItem(k);
          if (raw) {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr)) {
              arr.forEach((t: any) => {
                if (t && t.id && t.title) {
                  recoveredMap.set(t.id, {
                    id: String(t.id),
                    title: String(t.title),
                    time_slot: String(t.time_slot || ''),
                    is_completed: !!t.is_completed,
                    task_date: t.task_date
                  });
                }
              });
            }
          }
        } catch {}
      }

      if (recoveredMap.size > 0) {
        const recovered = Array.from(recoveredMap.values());
        await AsyncStorage.setItem(unifiedKey, JSON.stringify(recovered));
        KVStore.setJson(unifiedKey, recovered);
        HomescreenService.syncToCloud(userId, recovered);
        return recovered;
      }

      // 4. Check Supabase
      if (userId) {
        // First try user_notes backup (rock-solid, no RLS issue)
        const { data: noteBackup } = await supabase
          .from('user_notes')
          .select('content')
          .eq('user_id', userId)
          .eq('subject', '__daily_tasks__')
          .maybeSingle();

        if (noteBackup?.content) {
          try {
            const parsed = JSON.parse(noteBackup.content);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await AsyncStorage.setItem(unifiedKey, JSON.stringify(parsed));
              KVStore.setJson(unifiedKey, parsed);
              return parsed;
            }
          } catch {}
        }

        // Second try daily_tasks table without restricting to today only
        const { data: dbTasks, error } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });
        
        if (!error && dbTasks && dbTasks.length > 0) {
          const formatted: DailyTask[] = dbTasks.map(t => ({
            id: String(t.id),
            title: t.title,
            time_slot: t.time_slot || '',
            is_completed: !!t.is_completed,
            task_date: t.task_date
          }));
          await AsyncStorage.setItem(unifiedKey, JSON.stringify(formatted));
          KVStore.setJson(unifiedKey, formatted);
          return formatted;
        }
      }
    } catch (e) {
      console.log('Error loading tasks:', e);
    }
    
    return userId ? [] : DEFAULT_TASKS;
  },

  async syncToCloud(userId?: string, tasks?: DailyTask[]) {
    if (!userId || !tasks) return;
    try {
      // 1. Guaranteed cloud backup in user_notes with subject '__daily_tasks__'
      const { data: existing } = await supabase
        .from('user_notes')
        .select('id')
        .eq('user_id', userId)
        .eq('subject', '__daily_tasks__')
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('user_notes')
          .update({ content: JSON.stringify(tasks), updated_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('user_notes')
          .insert({
            user_id: userId,
            subject: '__daily_tasks__',
            title: 'Daily Tasks',
            content: JSON.stringify(tasks)
          });
      }

      // 2. Also attempt daily_tasks table sync
      for (const t of tasks) {
        if (!t.id.startsWith('default')) {
          supabase.from('daily_tasks').upsert({
            id: t.id.length > 20 ? t.id : undefined,
            user_id: userId,
            title: t.title,
            time_slot: t.time_slot || '',
            is_completed: !!t.is_completed,
            task_date: t.task_date || new Date().toISOString().split('T')[0]
          }).then();
        }
      }
    } catch (e) {
      console.log('Error syncing tasks to cloud:', e);
    }
  },

  async syncFromCloud(userId?: string, unifiedKey?: string) {
    if (!userId || !unifiedKey) return;
    try {
      const { data: noteBackup } = await supabase
        .from('user_notes')
        .select('content')
        .eq('user_id', userId)
        .eq('subject', '__daily_tasks__')
        .maybeSingle();

      if (noteBackup?.content) {
        const cloudTasks: DailyTask[] = JSON.parse(noteBackup.content);
        if (Array.isArray(cloudTasks) && cloudTasks.length > 0) {
          KVStore.setJson(unifiedKey, cloudTasks);
          await AsyncStorage.setItem(unifiedKey, JSON.stringify(cloudTasks));
        }
      }
    } catch {}
  },

  async toggleTaskCompletion(taskId: string, userId?: string, currentTasks?: DailyTask[]): Promise<DailyTask[]> {
    const unifiedKey = `daily_tasks_${userId || 'guest'}`;
    const updated = (currentTasks || DEFAULT_TASKS).map(t =>
      t.id === taskId ? { ...t, is_completed: !t.is_completed } : t
    );
    
    KVStore.setJson(unifiedKey, updated);
    await AsyncStorage.setItem(unifiedKey, JSON.stringify(updated));
    HomescreenService.syncToCloud(userId, updated);
    
    return updated;
  },

  async deleteTask(taskId: string, userId?: string, currentTasks?: DailyTask[]): Promise<DailyTask[]> {
    const unifiedKey = `daily_tasks_${userId || 'guest'}`;
    const updated = (currentTasks || []).filter(t => t.id !== taskId);
    
    KVStore.setJson(unifiedKey, updated);
    await AsyncStorage.setItem(unifiedKey, JSON.stringify(updated));
    HomescreenService.syncToCloud(userId, updated);
    
    if (userId && !taskId.startsWith('default')) {
      supabase
        .from('daily_tasks')
        .delete()
        .eq('id', taskId)
        .then();
    }
    
    return updated;
  },

  async addTask(title: string, timeSlot: string, userId?: string, currentTasks?: DailyTask[]): Promise<DailyTask[]> {
    const todayStr = new Date().toISOString().split('T')[0];
    const unifiedKey = `daily_tasks_${userId || 'guest'}`;
    const newTask: DailyTask = {
      id: Date.now().toString(),
      title,
      time_slot: timeSlot || '',
      is_completed: false,
      task_date: todayStr
    };
    
    const updated = [...(currentTasks || []), newTask];
    KVStore.setJson(unifiedKey, updated);
    await AsyncStorage.setItem(unifiedKey, JSON.stringify(updated));
    HomescreenService.syncToCloud(userId, updated);
    
    return updated;
  },

  async getStudyStreak(userId?: string): Promise<StudyStreak> {
    const storageKey = `study_streak_${userId || 'guest'}`;
    try {
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached) return JSON.parse(cached);

      if (userId) {
        const { data } = await supabase
          .from('user_study_streaks')
          .select('*')
          .eq('user_id', userId)
          .single();
        if (data) {
          const streakObj = {
            current_streak: data.current_streak || 7,
            weekly_history: data.weekly_history || [true, true, true, true, false, false, false],
            last_activity_date: data.last_activity_date || new Date().toISOString()
          };
          await AsyncStorage.setItem(storageKey, JSON.stringify(streakObj));
          return streakObj;
        }
      }
    } catch (e) {}
    
    return {
      current_streak: 7,
      weekly_history: [true, true, true, true, false, false, false],
      last_activity_date: new Date().toISOString()
    };
  },

  async saveStudyStreak(streak: StudyStreak, userId?: string): Promise<void> {
    const storageKey = `study_streak_${userId || 'guest'}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(streak));
    if (userId) {
      supabase.from('user_study_streaks').upsert({
        user_id: userId,
        current_streak: streak.current_streak,
        weekly_history: streak.weekly_history,
        last_activity_date: streak.last_activity_date,
      }).then();
    }
  },

  async getRecentNotes(userId?: string): Promise<any[]> {
    if (!userId) return [];
    const storageKey = `user_notes_v2_${userId}`;
    let fallbackData = DEFAULT_RECENT_NOTES;
    
    try {
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          fallbackData = parsed.slice(0, 4);
        }
      }
      
      if (userId) {
        const nodes = await fetchAllPilotV2Nodes(userId, false);
        
        if (nodes && nodes.length > 0) {
          const v2Notes = nodes.filter((n: any) => n.type === 'note' && !n.is_archived);
          v2Notes.sort((a: any, b: any) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());
          
          const finalNotes = v2Notes.slice(0, 4);
          if (finalNotes.length > 0) {
            await AsyncStorage.setItem(storageKey, JSON.stringify(finalNotes));
            return finalNotes;
          }
        }
        
        // If nodes empty but we have cache, return cache
        if (fallbackData !== DEFAULT_RECENT_NOTES) {
          return fallbackData;
        }
        return [];
      }
    } catch (e) {
      console.log('Error in getRecentNotes:', e);
    }
    
    return userId ? [] : fallbackData;
  },

  async getDailyInsights(): Promise<DailyInsight[]> {
    try {
      const { data } = await supabase
        .from('daily_insights')
        .select('*')
        .eq('is_active', true);
      if (data && data.length > 0) return data;
    } catch (e) {}
    return DEFAULT_INSIGHTS;
  }
};
