import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `daily_tasks_${userId || 'guest'}_${todayStr}`;
    
    try {
      const cached = await AsyncStorage.getItem(storageKey);
      if (cached !== null) {
        return JSON.parse(cached);
      }

      if (userId) {
        const { data, error } = await supabase
          .from('daily_tasks')
          .select('*')
          .eq('user_id', userId)
          .eq('task_date', todayStr)
          .order('created_at', { ascending: true });
        
        if (!error && data) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(data));
          return data;
        }
        return [];
      }
    } catch (e) {
      console.log('Error loading tasks:', e);
    }
    
    return userId ? [] : DEFAULT_TASKS;
  },

  async toggleTaskCompletion(taskId: string, userId?: string, currentTasks?: DailyTask[]): Promise<DailyTask[]> {
    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `daily_tasks_${userId || 'guest'}_${todayStr}`;
    
    const updated = (currentTasks || DEFAULT_TASKS).map(t =>
      t.id === taskId ? { ...t, is_completed: !t.is_completed } : t
    );
    
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    
    if (userId && !taskId.startsWith('default')) {
      const target = updated.find(t => t.id === taskId);
      if (target) {
        supabase
          .from('daily_tasks')
          .update({ is_completed: target.is_completed })
          .eq('id', taskId)
          .then();
      }
    }
    
    return updated;
  },

  async deleteTask(taskId: string, userId?: string, currentTasks?: DailyTask[]): Promise<DailyTask[]> {
    const todayStr = new Date().toISOString().split('T')[0];
    const storageKey = `daily_tasks_${userId || 'guest'}_${todayStr}`;
    
    const updated = (currentTasks || []).filter(t => t.id !== taskId);
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    
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
    const storageKey = `daily_tasks_${userId || 'guest'}_${todayStr}`;
    const newTask: DailyTask = {
      id: Date.now().toString(),
      title,
      time_slot: timeSlot || '',
      is_completed: false,
      task_date: todayStr
    };
    
    const updated = [...(currentTasks || []), newTask];
    await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
    
    if (userId) {
      supabase.from('daily_tasks').insert({
        user_id: userId,
        title,
        time_slot: timeSlot,
        is_completed: false,
        task_date: todayStr
      }).then();
    }
    
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
