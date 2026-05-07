import { useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FlashcardSvc } from '../services/FlashcardService';

export interface FlashcardHint {
  subject: string;
  section_group: string;
  microtopic: string;
}

export interface FlashcardFlowState {
  visible: boolean;
  cardId: string | null;
  hint: FlashcardHint;
}

export function useFlashcardAction(userId: string | undefined) {
  const [savingFlashcard, setSavingFlashcard] = useState<Record<string, boolean>>({});
  const [flashcardedIds, setFlashcardedIds] = useState<Set<string>>(new Set());
  const [aff, setAff] = useState<FlashcardFlowState>({
    visible: false,
    cardId: null,
    hint: { subject: 'General', section_group: 'General', microtopic: 'General' },
  });

  const handleAddToFlashcards = async (q: any, activeAnswerText?: string) => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setSavingFlashcard(prev => ({ ...prev, [q.id]: true }));
    
    try {
      // 1. Create or resolve the flashcard
      const cardId = await FlashcardSvc.createFromQuestion(userId, q, activeAnswerText);
      
      // 2. Update local state
      setFlashcardedIds(prev => new Set([...prev, q.id]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      // 3. Open the directory selection popup (AddToFlashcardSheet)
      setAff({
        visible: true,
        cardId,
        hint: {
          subject: q.subject || 'General',
          section_group: q.section_group || q.sectionGroup || 'General',
          microtopic: q.micro_topic || q.microtopic || q.microTopic || 'General',
        },
      });
      
      return cardId;
    } catch (err: any) {
      console.error("Flashcard Error:", err);
      Alert.alert("Error", "Failed to add to Flashcards. " + (err.message || ''));
    } finally {
      setSavingFlashcard(prev => ({ ...prev, [q.id]: false }));
    }
  };

  const fetchFlashcardedStatus = async (qIds: string[]) => {
    if (!userId || qIds.length === 0) return;
    try {
      const { supabase } = await import('../lib/supabase');
      const CHUNK = 100;
      const allFound = new Set<string>();
      for (let i = 0; i < qIds.length; i += CHUNK) {
        const chunk = qIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from('user_cards')
          .select('cards!inner(question_id)')
          .eq('user_id', userId)
          .in('cards.question_id', chunk);
        if (data) {
          data.forEach((d: any) => allFound.add(d.cards.question_id));
        }
      }
      setFlashcardedIds(prev => {
        const next = new Set(prev);
        allFound.forEach(id => next.add(id));
        return next;
      });
    } catch (e) {
      console.warn("Flashcard check failed", e);
    }
  };

  return {
    savingFlashcard,
    flashcardedIds,
    setFlashcardedIds,
    aff,
    setAff,
    handleAddToFlashcards,
    fetchFlashcardedStatus,
  };
}
