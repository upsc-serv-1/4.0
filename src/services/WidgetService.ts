import { supabase } from '../lib/supabase';
import { OfflineManager } from './OfflineManager';

export const ALL_WIDGET_KEYS = [
  'daily_goal', 'exam_countdown', 'questions_today', 'study_time_today',
  'weekly_streak', 'accuracy_trend', 'correct_incorrect', 'speed_meter',
  'due_cards', 'mastery_ring', 'pyq_coverage', 'recent_notes',
  'tagged_count', 'quick_practice', 'last_test', 'test_scores',
  'study_heatmap'
];

export type Widget = {
  id: string;
  widget_key: string;
  position: number;
  is_archived: boolean;
};

class WidgetSvcImpl {
  async ensureSeeded(userId: string) {
    const { data, error } = await supabase
      .from('user_widgets').select('widget_key').eq('user_id', userId);
    if (error) throw error;
    const have = new Set((data || []).map((r: any) => r.widget_key));
    const missing = ALL_WIDGET_KEYS.filter(k => !have.has(k));
    if (!missing.length) return;
    const rows = missing.map((k, i) => ({
      user_id: userId, widget_key: k, position: (data?.length || 0) + i, is_archived: false,
    }));
    await supabase.from('user_widgets').insert(rows);
  }

  async list(userId: string): Promise<Widget[]> {
    const cached = (OfflineManager.getCollectionSync('user_widgets', userId) as Widget[])
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    try {
      await this.ensureSeeded(userId);
      const { data, error } = await supabase
        .from('user_widgets').select('*').eq('user_id', userId)
        .order('position', { ascending: true });
      if (error) throw error;
      return (data as Widget[]) || cached || [];
    } catch (err) {
      if (cached.length > 0) return cached;
      throw err;
    }
  }

  async archive(userId: string, id: string) {
    await supabase.from('user_widgets').update({ is_archived: true })
      .eq('id', id).eq('user_id', userId);
  }

  async restore(userId: string, id: string) {
    await supabase.from('user_widgets').update({ is_archived: false })
      .eq('id', id).eq('user_id', userId);
  }

  async reorder(userId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, idx) =>
      supabase.from('user_widgets').update({ position: idx })
        .eq('id', id).eq('user_id', userId)
    );
    await Promise.all(updates);
  }
}

export const WidgetService = new WidgetSvcImpl();
