import { useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { FlashcardSvc } from '../services/FlashcardService';

export interface FlashcardHint {
  subject: string;
  section_group: string;
  microtopic: string;
  isMains?: boolean;
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

  const handleAddToFlashcards = async (q: any, activeAnswerText?: string, isMains = false) => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setSavingFlashcard(prev => ({ ...prev, [q.id]: true }));
    
    try {
      // 1. Create or resolve the flashcard
      const cardId = await FlashcardSvc.createFromQuestion(userId, q, activeAnswerText);
      
      // 2. DO NOT add to flashcardedIds yet - only add after successful placement
      // (handled by onPlaced callback)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      
      // 3. Open the directory selection popup (AddToFlashcardSheet)
      // The onPlaced callback will add the card to flashcardedIds
      setAff({
        visible: true,
        cardId,
        hint: {
          subject: q.subject || 'General',
          section_group: q.section_group || q.sectionGroup || 'General',
          microtopic: q.micro_topic || q.microtopic || q.microTopic || 'General',
          isMains,
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

  const handleFlashcardPlaced = (cardId: string, questionId: string) => {
    // Called when flashcard is successfully placed in a deck
    setFlashcardedIds(prev => new Set([...prev, questionId]));
  };

  const handleFlashcardDeleted = (questionId: string) => {
    // Called when flashcard is deleted
    setFlashcardedIds(prev => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });
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
        // Replace rather than merge — this removes IDs for cards that
        // were deleted (from the flashcards screen) so the button
        // immediately loses its sparkled/highlighted state.
        const next = new Set(allFound);
        // Preserve any IDs that weren't in the checked batch (e.g. from
        // external navigation) to avoid dropping them.
        for (const id of prev) {
          if (!qIds.includes(id)) next.add(id);
        }
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
    handleFlashcardPlaced,
    handleFlashcardDeleted,
    fetchFlashcardedStatus,
  };
}
