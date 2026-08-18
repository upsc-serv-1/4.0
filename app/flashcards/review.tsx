import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Animated, Dimensions, Modal, TextInput, ScrollView, Alert,
  KeyboardAvoidingView, Platform, Pressable, Image as RNImage
} from 'react-native';
import { Image } from 'expo-image';
import ImageViewer from 'react-native-image-zoom-viewer';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { 
  X, RotateCcw, Check, MoreVertical, Snowflake, Maximize2, ChevronLeft, Search, 
  Share2, Pencil, Plus, MoreHorizontal, Type, CheckCircle2, Minus, Sparkles,
  Send, Trash2, Edit2, Save, MessageSquare, Brain
} from 'lucide-react-native';
import { GestureHandlerRootView, PinchGestureHandler, State, PanGestureHandler } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { FlashcardSvc, QueueCard } from '../../src/services/FlashcardService';
import { Grade, previewAllGrades, formatDuration, DEFAULT_SETTINGS } from '../../src/services/sm2';
import { FolderSettingsSvc } from '../../src/services/FolderSettingsService';
import { PageWrapper } from '../../src/components/PageWrapper';
import { supabase } from '../../src/lib/supabase';
import { CardOverflowMenu, CardMenuAction } from '../../src/components/flashcards/CardOverflowMenu';
import { parseImageUrls } from '../../src/utils/imageHelpers';
import { BranchSvc, BranchNode } from '../../src/services/BranchService';
import { PremiumMoveModal } from '../../src/components/flashcards/PremiumMoveModal';
import { OfflineManager } from '../../src/services/OfflineManager';
import { NetworkStatus } from '../../src/lib/networkStatus';
import { buildCanonicalExplanations } from '../unified/engine';
import { fetchBestAnswer, saveBestAnswer, BestAnswer } from '../../src/services/BestAnswerService';
import { aiExplainQuestion, aiImproveAnswer, aiAskDoubt } from '../../src/services/GeminiService';
import { SkeletonFlashcardReview } from '../../src/components/common/SkeletonLoader';
import { renderAIText } from '../../src/utils/renderAIText';
import Markdown from 'react-native-markdown-display';
import { getMarkdownStyles, getMarkdownRules, cleanMarkdownContent } from '../mains';

const { width, height } = Dimensions.get('window');

export default function ReviewScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { microtopic, subject, section, mode, cardId, branchId, recursive } = useLocalSearchParams<any>();
  const uid = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showCorrect, setShowCorrect] = useState(false);
  const [preview, setPreview] = useState<Record<Grade, { label: string }>>({
    again: { label: '<1m' }, hard: { label: '10m' }, good: { label: '4d' }, easy: { label: '7d' },
  });

  // session stats
  const [sessionSummary, setSessionSummary] = useState<{ reviewed: number; correct: number; elapsed: number } | null>(null);
  const sessionStart = useRef<number>(Date.now());
  const cardStart = useRef<number>(Date.now());
  const reviewedCount = useRef(0);
  const correctCount = useRef(0);

  // zoom
  const [editorFontSize, setEditorFontSize] = useState(18);
  const baseFontSize = useRef(18);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimer = useRef<any>(null);

  // image zoom
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  
  const [showEditModal, setShowEditModal] = useState(false);
  const [personalNote, setPersonalNote] = useState('');
  
  // full overflow menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);
  const [isAdjustingTextSize, setIsAdjustingTextSize] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [branchTree, setBranchTree] = useState<BranchNode[]>([]);
  const [sliderWidth, setSliderWidth] = useState(200);

  // alt sources / vitamin
  const [altSources, setAltSources] = useState<any[]>([]);
  const [altActive, setAltActive] = useState<string>('saved'); // 'saved' | 'vitamin' | <institute_key>
  const [altVitamin, setAltVitamin] = useState<BestAnswer | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [modifyOpen, setModifyOpen] = useState(false);
  const [modifyText, setModifyText] = useState('');
  const [improvePromptOpen, setImprovePromptOpen] = useState(false);
  const [improvePromptText, setImprovePromptText] = useState('');
  const [improving, setImproving] = useState(false);
  const [savingBest, setSavingBest] = useState(false);
  const [doubtModalVisible, setDoubtModalVisible] = useState(false);
  const [doubtQuestion, setDoubtQuestion] = useState('');
  const [doubtAnswer, setDoubtAnswer] = useState('');
  const [askingDoubt, setAskingDoubt] = useState(false);

  const revealAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const answerYRef = useRef<number>(0);
  const { height: windowHeight } = Dimensions.get('window');

  useEffect(() => { if (uid) { loadQueue(); loadZoomSetting(); } }, [uid]);

  // Refresh current card when screen comes back into focus (e.g. after editing card in new.tsx)
  useFocusEffect(
    useCallback(() => {
      if (queue.length > 0 && currentIndex < queue.length) {
        const cId = queue[currentIndex].id;
        FlashcardSvc.getCardDetails(cId).then(updatedCard => {
          if (updatedCard) {
            setQueue(prevQueue => {
              if (prevQueue.length === 0 || currentIndex >= prevQueue.length) return prevQueue;
              const nq = [...prevQueue];
              const idx = nq.findIndex(c => c.id === cId);
              if (idx !== -1) {
                nq[idx] = {
                  ...nq[idx],
                  front_text: updatedCard.front_text || updatedCard.question_text || '',
                  back_text: updatedCard.back_text || updatedCard.answer_text || '',
                  front_image_url: updatedCard.front_image_url || null,
                  back_image_url: updatedCard.back_image_url || null,
                };
              }
              return nq;
            });
          }
        }).catch(() => {});
      }
    }, [currentIndex, queue.length])
  );

  // ── FIX 8 — institute / vitamin chips on the flashcard review screen ─────
  // Must be here (before early returns) to satisfy Rules of Hooks.
  useEffect(() => {
    setAltActive('saved');
    setAltSources([]);
    setAltVitamin(null);

    const qId = (queue[currentIndex] as any)?.question_id || (queue[currentIndex]?.source as any)?.question_id;
    if (!qId) return;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('questions')
          .select('id, explanation_markdown, source, exam_year, exam_group, correct_answer, tests(*)')
          .eq('id', qId)
          .maybeSingle();
        if (cancelled || !data) return;
        const expl = buildCanonicalExplanations(data);
        setAltSources(expl);
        const vit = await fetchBestAnswer(qId);
        if (!cancelled) setAltVitamin(vit);
      } catch {
        /* swallow — chips just don't render */
      }
    })();

    return () => { cancelled = true; };
  }, [queue[currentIndex]?.id]);

  const loadZoomSetting = async () => {
    try {
      const saved = await AsyncStorage.getItem('flashcard_font_size');
      if (saved) { const size = parseInt(saved, 10); setEditorFontSize(size); baseFontSize.current = size; }
    } catch {}
  };

  const loadQueue = useCallback(async () => {
    if (!uid) return;
    // Only show skeleton if queue is empty (first load)
    if (queue.length === 0) setLoading(true);
    try {
      let cards: QueueCard[] = [];
      if (cardId) {
        // Single-card mode — study that specific card regardless of due state
        const userCards = ((OfflineManager as any).getCollectionSync('user_cards', uid) ?? [])
          .filter((u: any) => u.user_id === uid);
        const allCards = ((OfflineManager as any).getCollectionSync('cards') ?? [])
          .filter((c: any) => !c.deleted && !c.is_deleted);
        let row: any = userCards.find((u: any) => u.card_id === cardId);
        let c: any = allCards.find((card: any) => card.id === cardId);

        // If card not found in cache, fetch it
        if (!c) {
          const { data: remoteCard, error: cErr } = await supabase
            .from('cards')
            .select('*')
            .eq('id', cardId)
            .maybeSingle();
          if (remoteCard) c = remoteCard;
        }

        // If progress not found in cache, try fetching it
        if (!row && NetworkStatus.isOnline()) {
          const { data: remoteRow } = await supabase
            .from('user_cards')
            .select('*')
            .eq('user_id', uid)
            .eq('card_id', cardId)
            .maybeSingle();
          if (remoteRow) row = remoteRow;
        }

        if (c) {
          const settings = await FolderSettingsSvc.resolve(uid!, c.subject, c.section_group, c.microtopic, branchId);
          cards = [{
            id: c.id,
            front_text: c.front_text || c.question_text || '',
            back_text: c.back_text || c.answer_text || '',
            front_image_url: c.front_image_url, back_image_url: c.back_image_url,
            subject: c.subject, section_group: c.section_group, microtopic: c.microtopic,
            card_type: c.card_type || 'qa', source: c.source || {},
            correct_answer: c.correct_answer,
            state: {
              status: row?.status || 'active', 
              learning_status: row?.learning_status || 'not_studied',
              next_review: row?.next_review || null, 
              last_reviewed: row?.last_reviewed || null,
              user_note: row?.user_note || '',
              repetitions: row?.repetitions ?? 0, 
              interval_days: row?.interval_days ?? 0,
              ease_factor: row?.ease_factor ?? settings.starting_ease,
              lapses: row?.lapses ?? 0, 
              learning_step: row?.learning_step ?? null,
              is_relearning: row?.is_relearning ?? false,
            },
            queue: (row?.learning_status === 'not_studied' || !row) ? 'new' : 'learning',
          }];
        }
      } else if (branchId) {
        cards = await FlashcardSvc.getStudyQueue(uid, {
          branch_id: String(branchId),
          recursive: recursive === '1',
        });
      } else {
        cards = await FlashcardSvc.getStudyQueue(uid, {
          subject: subject ? String(subject) : undefined,
          section: section ? String(section) : undefined,
          microtopic: microtopic ? String(microtopic) : undefined,
        });
      }

      // Filter by mode if specified
      if (mode === 'new') {
        cards = cards.filter(c => c.queue === 'new');
      } else if (mode === 'due') {
        cards = cards.filter(c => c.queue === 'learning' || c.queue === 'review');
      }

      setQueue(cards);
      sessionStart.current = Date.now();
      cardStart.current = Date.now();
      reviewedCount.current = 0;
      correctCount.current = 0;
      if (cards.length > 0) await updatePreview(cards[0]);

      // Prefetch images for the next few cards so they load instantly on swipe
      const PREFETCH_COUNT = 5;
      const toPrefetch = cards.slice(0, PREFETCH_COUNT);
      toPrefetch.forEach(c => {
        parseImageUrls(c.front_image_url).forEach(url => Image.prefetch(url).catch(() => {}));
        parseImageUrls(c.back_image_url).forEach(url => Image.prefetch(url).catch(() => {}));
      });
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Could not load queue');
    } finally { setLoading(false); }
  }, [uid, subject, section, microtopic, cardId]);

  const updatePreview = useCallback(async (c: QueueCard) => {
    const settings = await FolderSettingsSvc.resolve(uid!, c.subject, c.section_group, c.microtopic, branchId);
    const p = previewAllGrades({
      ease_factor: c.state.ease_factor ?? settings.starting_ease,
      interval_days: c.state.interval_days ?? 0,
      repetitions: c.state.repetitions ?? 0,
      lapses: c.state.lapses ?? 0,
      learning_step: c.state.learning_step ?? ((c.state.repetitions ?? 0) > 0 ? -1 : 0),
      is_relearning: Boolean(c.state.is_relearning),
    }, settings);
    setPreview({
      again: { label: p.again.label },
      hard:  { label: p.hard.label },
      good:  { label: p.good.label },
      easy:  { label: p.easy.label },
    });
  }, [uid]);

  const handleReveal = () => {
    if (isFlipped) return;
    setIsFlipped(true);
    Animated.timing(revealAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Auto-scroll to answer
    setTimeout(() => {
      if (answerYRef.current > 0) {
        scrollViewRef.current?.scrollTo({ y: answerYRef.current - 20, animated: true });
      } else {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 100);
  };

  const nextCard = async () => {
    if (currentIndex < queue.length - 1) {
      revealAnim.setValue(0); setIsFlipped(false); setSelectedOption(null); setShowCorrect(false);
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      cardStart.current = Date.now();
      await updatePreview(queue[nextIdx]);
      // Prefetch images for upcoming cards
      for (let i = nextIdx + 1; i < Math.min(nextIdx + 4, queue.length); i++) {
        if (queue[i]) {
          parseImageUrls(queue[i].front_image_url).forEach(url => Image.prefetch(url).catch(() => {}));
          parseImageUrls(queue[i].back_image_url).forEach(url => Image.prefetch(url).catch(() => {}));
        }
      }
    } else {
      // Session complete
      setSessionSummary({
        reviewed: reviewedCount.current,
        correct: correctCount.current,
        elapsed: Math.round((Date.now() - sessionStart.current) / 1000),
      });
    }
  };

  const rate = async (grade: Grade) => {
    const card = queue[currentIndex];
    if (!card || !uid) return;
    try {
      reviewedCount.current += 1;
      if (grade === 'good' || grade === 'easy') correctCount.current += 1;
      const durationSeconds = Math.max(0, Math.round((Date.now() - cardStart.current) / 1000));
      await FlashcardSvc.reviewCard(uid, card.id, grade, { 
        durationSeconds, 
        currentState: card.state,
        branchId: branchId || undefined,
      });
      setIsFlipped(false); setShowCorrect(false); revealAnim.setValue(0);
      await nextCard();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not save review.');
      console.error(err);
    }
  };

  const freezeCard = async () => {
    const card = queue[currentIndex]; if (!card || !uid) return;
    try {
      await FlashcardSvc.freezeCard(uid, card.id);
      const nextQueue = queue.filter((_, i) => i !== currentIndex);
      setQueue(nextQueue);
      setShowEditModal(false);
      if (nextQueue.length === 0) {
        setSessionSummary({ reviewed: reviewedCount.current, correct: correctCount.current, elapsed: Math.round((Date.now() - sessionStart.current) / 1000) });
      } else if (currentIndex >= nextQueue.length) {
        setCurrentIndex(0); await updatePreview(nextQueue[0]);
      } else {
        await updatePreview(nextQueue[currentIndex]);
      }
      setIsFlipped(false); revealAnim.setValue(0);
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const savePersonalNote = async () => {
    const card = queue[currentIndex]; if (!card || !uid) return;
    try {
      await FlashcardSvc.saveNote(uid, card.id, personalNote);
      setShowEditModal(false);
      const nq = [...queue]; nq[currentIndex] = { ...nq[currentIndex], state: { ...nq[currentIndex].state, user_note: personalNote } };
      setQueue(nq);
    } catch (e: any) { Alert.alert('Failed', e?.message); }
  };

  const handleMenuAction = async (action: CardMenuAction) => {
    const card = queue[currentIndex];
    if (!card || !uid) return;

    try {
      setMenuBusy(true);
      switch (action) {
        case 'edit':
          setMenuVisible(false);
          router.push({ pathname: '/flashcards/new', params: { cardId: card.id } });
          break;
        case 'freeze':
          await FlashcardSvc.toggleFreeze(uid, card.id, card.state.status);
          const newQueue = [...queue];
          newQueue[currentIndex].state.status = card.state.status === 'frozen' ? 'active' : 'frozen';
          setQueue(newQueue);
          setMenuVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'reverse':
          setMenuVisible(false);
          Alert.alert('Reverse card?', 'Front and back will be swapped.', [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Reverse', 
              onPress: async () => { 
                try { 
                  await FlashcardSvc.reverseCardForUser(uid, card.id); 
                  await loadQueue(); // Refresh the whole queue to get reversed text
                } catch (e: any) { Alert.alert('Failed', e?.message); } 
              } 
            },
          ]);
          break;
        case 'duplicate':
          await FlashcardSvc.duplicateCardForUser(uid, card.id);
          setMenuVisible(false);
          Alert.alert('Success', 'Card duplicated.');
          break;
        case 'history':
          setMenuVisible(false);
          router.push({ pathname: '/flashcards/history', params: { cardId: card.id, title: card.front_text?.slice(0, 40) || 'Card history' } });
          break;
        case 'showSlider':
          setMenuVisible(false);
          setIsAdjustingTextSize(true);
          break;
        case 'move':
          setMenuVisible(false);
          const tree = await BranchSvc.buildTree(uid);
          setBranchTree(tree);
          setShowMoveModal(true);
          break;
        case 'delete':
          setMenuVisible(false);
          Alert.alert('Delete card?', 'This will remove it from your deck.', [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Delete', 
              style: 'destructive', 
              onPress: async () => { 
                try { 
                  await FlashcardSvc.softDeleteCardForUser(uid, card.id); 
                  const nq = queue.filter((_, i) => i !== currentIndex);
                  setQueue(nq);
                  if (nq.length === 0) setSessionSummary({ reviewed: reviewedCount.current, correct: correctCount.current, elapsed: Math.round((Date.now() - sessionStart.current) / 1000) });
                  else if (currentIndex >= nq.length) setCurrentIndex(0);
                } catch (e: any) { Alert.alert('Failed', e?.message); } 
              } 
            },
          ]);
          break;
        default:
          setMenuVisible(false);
          break;
      }
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Please try again');
    } finally {
      setMenuBusy(false);
    }
  };

  const handleMove = async (targetBranchId: string | null) => {
    const card = queue[currentIndex];
    if (!card || !uid) return;
    try {
      setMenuBusy(true);
      await BranchSvc.moveCardToBranch(uid, card.id, targetBranchId);
      setShowMoveModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Card moved.');
      // Remove from current queue since it's now in a different branch
      const nq = queue.filter((_, i) => i !== currentIndex);
      setQueue(nq);
      if (nq.length === 0) setSessionSummary({ reviewed: reviewedCount.current, correct: correctCount.current, elapsed: Math.round((Date.now() - sessionStart.current) / 1000) });
      else if (currentIndex >= nq.length) setCurrentIndex(0);
    } catch (e: any) {
      Alert.alert('Failed', e?.message);
    } finally {
      setMenuBusy(false);
    }
  };

  const onPinchGestureEvent = (event: any) => {
    if (zoomImageUrl) return; 
    const scaleValue = event.nativeEvent.scale;
    let nextSize = baseFontSize.current * scaleValue;
    nextSize = Math.max(12, Math.min(40, nextSize));
    setEditorFontSize(Math.round(nextSize));
    setShowZoomIndicator(true);
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    zoomTimer.current = setTimeout(() => setShowZoomIndicator(false), 1500);
  };
  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      baseFontSize.current = editorFontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      AsyncStorage.setItem('flashcard_font_size', editorFontSize.toString()).catch(() => {});
    }
  };

  const onSliderGesture = (event: any) => {
    const { x } = event.nativeEvent;
    const percentage = Math.max(0, Math.min(1, x / sliderWidth));
    const newSize = Math.round(12 + percentage * (40 - 12));
    if (newSize !== editorFontSize) {
      setEditorFontSize(newSize);
      baseFontSize.current = newSize;
    }
  };

  const onSliderStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      AsyncStorage.setItem('flashcard_font_size', editorFontSize.toString()).catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const handleAiExplain = async () => {
    const card = queue[currentIndex];
    if (!card) return;
    const qId = (card as any)?.question_id || (card?.source as any)?.question_id;
    if (!qId) {
      Alert.alert('Not available', 'This card is not linked to a question.');
      return;
    }

    if (aiExplanations[qId]) {
      setAltActive('ai');
      return;
    }

    try {
      setAiGenerating(true);
      const opts = (card.source as any)?.options ?? {};
      const optionsMap: Record<string, string> = {};
      Object.entries(opts).forEach(([k, v]) => { optionsMap[String(k)] = String(v); });
      const instituteExpls = altSources.map((e: any) => ({
        source: e.source || e.sourceKey || '',
        text: e.text || '',
        answer: card.correct_answer || '',
      }));
      const explanation = await aiExplainQuestion(
        card.front_text || '',
        optionsMap,
        card.correct_answer || '',
        instituteExpls,
      );
      setAiExplanations(prev => ({ ...prev, [qId]: explanation }));
      setAltActive('ai');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('AI Error', e?.message || 'Could not generate explanation.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSaveBestFromAi = async () => {
    const card = queue[currentIndex];
    const qId = (card as any)?.question_id || (card?.source as any)?.question_id;
    const text = qId ? aiExplanations[qId] : null;
    if (!qId || !text) return;

    setSavingBest(true);
    try {
      const saved = await saveBestAnswer(qId, text, null, null);
      setAltVitamin(saved);
      setAltActive('vitamin');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSavingBest(false);
    }
  };

  const handleOpenModify = () => {
    setModifyText(resolvedAnswerText);
    setModifyOpen(true);
    setImprovePromptOpen(false);
  };

  const handleImproveSubmit = async () => {
    const card = queue[currentIndex];
    const qId = (card as any)?.question_id || (card?.source as any)?.question_id;
    if (!qId || !improvePromptText.trim()) return;

    setImproving(true);
    try {
      const improved = await aiImproveAnswer(
        improvePromptText,
        modifyText,
        card.front_text || '',
        altSources
      );
      setModifyText(improved);

      if (altActive === 'ai') {
        setAiExplanations(prev => ({ ...prev, [qId]: improved }));
      }

      setImprovePromptOpen(false);
      setImprovePromptText('');
    } catch (e: any) {
      Alert.alert('AI Refinement Failed', e.message);
    } finally {
      setImproving(false);
    }
  };

  const commitModification = async () => {
    const card = queue[currentIndex];
    const qId = (card as any)?.question_id || (card?.source as any)?.question_id;
    if (!qId) return;

    setSavingBest(true);
    try {
      const saved = await saveBestAnswer(qId, modifyText, null, null);
      setAltVitamin(saved);
      setModifyOpen(false);
      setAltActive('vitamin');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Save Failed', e.message);
    } finally {
      setSavingBest(false);
    }
  };

  const handleDeleteBest = async () => {
    const card = queue[currentIndex];
    const qId = (card as any)?.question_id || (card?.source as any)?.question_id;
    if (!qId || !altVitamin?.id) return;

    Alert.alert('Delete My Vitamin?', 'This will remove your custom/AI explanation.', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('user_best_answers').delete().eq('id', altVitamin.id);
            setAltVitamin(null);
            setAltActive('saved');
          } catch (e: any) {
            Alert.alert('Delete Failed', e.message);
          }
        }
      }
    ]);
  };

  const handleAskDoubt = async () => {
    if (!doubtQuestion.trim()) return;
    setAskingDoubt(true);
    setDoubtAnswer('');
    try {
      const card = queue[currentIndex];
      const opts = (card.source as any)?.options ?? {};
      const optionLines = Object.entries(opts).map(([k, v]) => `${k}) ${v}`).join('\n');
      
      const answer = await aiAskDoubt(doubtQuestion, {
        question: card.front_text || '',
        options: optionLines,
        explanation: resolvedAnswerText,
      });
      setDoubtAnswer(answer);
    } catch (e: any) {
      Alert.alert('AI Error', e.message);
    } finally {
      setAskingDoubt(false);
    }
  };

  // ===== render states =====

  if (loading) {
    return <SkeletonFlashcardReview colors={colors} />;
  }

  if (sessionSummary) {
    const acc = sessionSummary.reviewed > 0 ? Math.round((sessionSummary.correct / sessionSummary.reviewed) * 100) : 0;
    const mins = Math.floor(sessionSummary.elapsed / 60), secs = sessionSummary.elapsed % 60;
    return (
      <PageWrapper>
        <SafeAreaView style={[styles.container, { backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' }]}>
          <View style={{ alignItems: 'center', padding: 40 }}>
            <Check size={64} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary, marginTop: 16 }]}>Session complete</Text>
            <View style={{ flexDirection: 'row', gap: 28, marginTop: 28 }}>
              <Summary num={sessionSummary.reviewed} label="Reviewed" color={colors.textPrimary} />
              <Summary num={`${acc}%`} label="Accuracy" color="#22c55e" />
              <Summary num={`${mins}:${secs.toString().padStart(2, '0')}`} label="Time" color="#3b82f6" />
            </View>
            <TouchableOpacity style={[styles.doneBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()} testID="btn-summary-done">
              <Text style={[styles.doneBtnText, { color: '#04223a' }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </PageWrapper>
    );
  }

  if (queue.length === 0) {
    return (
      <PageWrapper>
        <View style={styles.center}>
          <View style={[styles.emptyPopup, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Check size={48} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.textPrimary, marginTop: 16 }]}>All caught up!</Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary, marginTop: 8 }]}>No cards are due right now.</Text>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
                onPress={() => router.back()}
                testID="btn-empty-done"
              >
                <Text style={[styles.doneBtnText, { color: '#04223a' }]}>Return</Text>
              </TouchableOpacity>
            </View>
        </View>
      </PageWrapper>
    );
  }

  const currentCard = queue[currentIndex];
  const opts = (currentCard.source as any)?.options ?? {};
  const hasOptions = currentCard.card_type === 'qa' && Object.keys(opts).length > 0;

  // Resolved answer text given the active alt source key (currentCard may be undefined before queue loads).
  const resolvedAnswerText = (() => {
    const card = queue[currentIndex];
    if (!card) return '';
    const qId = (card as any)?.question_id || (card?.source as any)?.question_id;
    
    if (altActive === 'vitamin' && altVitamin) {
      const kp = altVitamin.key_points ? `\n\n**✨ Key Points**\n\n${altVitamin.key_points}` : '';
      return `${altVitamin.answer_text}${kp}`;
    }
    if (altActive === 'ai' && qId && aiExplanations[qId]) {
      return aiExplanations[qId];
    }
    if (altActive !== 'saved' && altSources.length) {
      const hit = altSources.find((e: any) => e.sourceKey === altActive);
      if (hit) return hit.text || '';
    }
    return card.back_text || '';
  })();
  
  function stripQuestionOptions(frontText: string, optionKeys: string[]) {
    if (!frontText?.trim()) return '';
    const keys = optionKeys.map(k => k.toLowerCase());
    const lines = frontText.split(/\r?\n/);
    const kept = lines.filter((line) => {
      const trimmed = line.trim();
      // Match prefixes like (a), a., a), (1), 1., etc. with flexible separators and spaces
      const m = trimmed.match(/^\(?([a-z0-9]+)\)?[\.:\-\)]?\s*/i);
      if (!m || !m[1]) return true;
      
      const key = m[1].toLowerCase();
      // Only strip if the prefix matches one of our known option keys
      return !keys.includes(key);
    });
    return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  const questionText = hasOptions
    ? stripQuestionOptions(currentCard.front_text || '', Object.entries(opts).map(([k]) => String(k)))
    : (currentCard.front_text || '');

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} testID="btn-exit">
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={[styles.progressPill, { backgroundColor: colors.surfaceStrong }]}>
            <Text style={[styles.progressText, { color: colors.textPrimary }]}>
              {currentIndex + 1}/{queue.length} cards
            </Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.headerBtn, { marginRight: 10 }]} 
              onPress={() => {
                setDoubtQuestion('');
                setDoubtAnswer('');
                setDoubtModalVisible(true);
              }}
              testID="btn-ask-ai"
            >
              <MessageSquare size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setMenuVisible(true)} testID="btn-more">
              <MoreHorizontal size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* CARD AREA */}
        <GestureHandlerRootView style={{ flex: 1 }} pointerEvents="box-none">
          <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
            <ScrollView 
              ref={scrollViewRef}
              style={{ flex: 1, width: '100%' }} 
              contentContainerStyle={{ padding: 12, paddingBottom: 100, width: '100%', alignItems: 'center' }}
              showsVerticalScrollIndicator={false}
              maximumZoomScale={5}
              minimumZoomScale={1}
              pinchGestureEnabled={true}
              bouncesZoom={true}
            >
              <Pressable 
                onPress={handleReveal}
                style={[styles.immersiveCard, { backgroundColor: colors.surface }]}
              >
              {/* QUESTION SECTION */}
              {!currentCard.front_image_url && (
                <View style={styles.sectionHeader}>
                  <Text style={[styles.cardSideLabel, { color: colors.textTertiary }]}>QUESTION</Text>
                </View>
              )}
              
              {parseImageUrls(currentCard.front_image_url).map((url, idx) => (
                <TouchableOpacity key={url + idx} activeOpacity={0.9} onPress={() => setZoomImageUrl(url)} style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <Image 
                    source={{ uri: url }} 
                    contentFit="contain"
                    contentPosition="center"
                    cachePolicy="memory-disk"
                    allowDownscaling={false}
                    style={{ width: '100%', height: Math.max(400, windowHeight * 0.65), borderRadius: 12, marginBottom: 16 }} 
                  />
                </TouchableOpacity>
              ))}

              <Text style={[styles.cardText, { color: colors.textPrimary, fontSize: editorFontSize, lineHeight: editorFontSize * 1.5 }]}>
                {questionText}
              </Text>

              {hasOptions && Object.entries(opts).map(([k, v]) => {
                const isSelected = selectedOption === k;
                const isCorrectOption = (currentCard.correct_answer || '').toLowerCase() === String(k).toLowerCase();
                let optBg = colors.surface;
                let optBorder = colors.border;
                if (showCorrect) {
                  if (isCorrectOption) { optBg = '#22c55e20'; optBorder = '#22c55e'; }
                  else if (isSelected) { optBg = '#ef444420'; optBorder = '#ef4444'; }
                } else if (isSelected) { optBg = colors.primary + '15'; optBorder = colors.primary; }

                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => {
                      if (!isFlipped && !showCorrect) {
                        setSelectedOption(k); 
                        setShowCorrect(true);
                        handleReveal();
                        Haptics.notificationAsync(isCorrectOption ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
                      }
                    }}
                    style={{ flexDirection: 'row', marginTop: 10, gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, backgroundColor: optBg, borderColor: optBorder }}
                    testID={`opt-${k}`}
                  >
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: isSelected ? (showCorrect ? (isCorrectOption ? '#22c55e' : '#ef4444') : colors.primary) : colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontWeight: '900', color: isSelected ? '#fff' : colors.textTertiary, fontSize: 12 }}>{String(k).toUpperCase()}</Text>
                    </View>
                    <Text style={{ flex: 1, color: colors.textPrimary, fontSize: editorFontSize - 4, fontWeight: isSelected ? '700' : '400' }}>{v as string}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* REVEAL HINT */}
              {!isFlipped && (
                <View style={[styles.flipHint, { marginTop: 40 }]}>
                  <RotateCcw size={16} color={colors.textTertiary} />
                  <Text style={[styles.flipHintText, { color: colors.textTertiary }]}>
                    {hasOptions && !showCorrect ? 'Select an option or tap to reveal' : 'Tap to reveal answer'}
                  </Text>
                </View>
              )}

              {/* ANSWER SECTION (Conditional) */}
              {isFlipped && (
                <Animated.View 
                  style={{ opacity: revealAnim, marginTop: 24, width: '100%' }}
                  onLayout={(e) => { answerYRef.current = e.nativeEvent.layout.y; }}
                >
                  <View style={[styles.divider, { backgroundColor: colors.border, marginBottom: 24 }]} />
                  
                  {parseImageUrls(currentCard.back_image_url).map((url, idx) => (
                    <TouchableOpacity key={url + idx} activeOpacity={0.9} onPress={() => setZoomImageUrl(url)} style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                      <Image 
                        source={{ uri: url }} 
                        contentFit="contain"
                        contentPosition="center"
                        cachePolicy="memory-disk"
                        allowDownscaling={false}
                        style={{ width: '100%', height: Math.max(400, windowHeight * 0.65), borderRadius: 12, marginBottom: 16 }} 
                      />
                    </TouchableOpacity>
                  ))}

                  <Text style={[styles.cardSideLabel, { color: '#34c759', textAlign: 'left', marginBottom: 12 }]}>ANSWER & EXPLANATION</Text>

                  {/* ── Source / Vitamin chips (only when card has a question_id) ── */}
                  {(altSources.length > 0 || altVitamin) && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 6, paddingBottom: 4, marginBottom: 12 }}
                    >
                      {/* My Vitamin first */}
                      {altVitamin && (
                        <TouchableOpacity
                          onPress={() => setAltActive('vitamin')}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 12, paddingVertical: 6,
                            borderRadius: 20, borderWidth: 1.5,
                            backgroundColor: altActive === 'vitamin' ? '#f59e0b' : '#f59e0b18',
                            borderColor:     altActive === 'vitamin' ? '#f59e0b' : '#f59e0b40',
                          }}
                          testID="flash-vitamin-chip"
                        >
                          <Text style={{ fontSize: 10, fontWeight: '900', color: altActive === 'vitamin' ? '#fff' : '#f59e0b' }}>
                            ⭐ MY VITAMIN
                          </Text>
                        </TouchableOpacity>
                      )}
                      {/* Saved (the actual stored back_text — what was hardwired at save time) */}
                      <TouchableOpacity
                        onPress={() => setAltActive('saved')}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                          backgroundColor: altActive === 'saved' ? colors.primary : colors.surfaceStrong,
                          borderWidth: 1, borderColor: colors.border,
                        }}
                        testID="flash-saved-chip"
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: altActive === 'saved' ? '#fff' : colors.textTertiary }}>
                          SAVED
                        </Text>
                      </TouchableOpacity>
                      {/* Each institute / source */}
                      {altSources
                        .filter((e: any) => e?.sourceKey && e?.text)
                        .map((e: any) => (
                          <TouchableOpacity
                            key={`flash-src-${e.sourceKey}`}
                            onPress={() => setAltActive(e.sourceKey)}
                            activeOpacity={0.7}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                              backgroundColor: altActive === e.sourceKey ? colors.primary : colors.surfaceStrong,
                              borderWidth: 1, borderColor: colors.border,
                            }}
                            testID={`flash-src-chip-${e.sourceKey}`}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '900', color: altActive === e.sourceKey ? '#fff' : colors.textTertiary }}>
                              {String(e.source || e.sourceKey).toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}

                      {/* AI Explain chip — matches Quiz Engine placement */}
                      {(() => {
                        const qId = (currentCard as any)?.question_id || (currentCard?.source as any)?.question_id;
                        if (!qId) return null;
                        const hasAi = !!aiExplanations[qId];
                        return (
                          <TouchableOpacity
                            onPress={handleAiExplain}
                            activeOpacity={0.7}
                            disabled={aiGenerating}
                            testID="flash-ai-chip"
                            style={{
                              flexDirection: 'row', alignItems: 'center', gap: 5,
                              paddingHorizontal: 12, paddingVertical: 6,
                              borderRadius: 20, borderWidth: 1,
                              backgroundColor: altActive === 'ai' ? '#7c3aed' : '#7c3aed18',
                              borderColor:     altActive === 'ai' ? '#7c3aed' : '#7c3aed40',
                            }}
                          >
                            {aiGenerating ? (
                              <ActivityIndicator size="small" color={altActive === 'ai' ? '#fff' : '#7c3aed'} />
                            ) : (
                              <Sparkles size={11} color={altActive === 'ai' ? '#fff' : '#7c3aed'} />
                            )}
                            <Text style={{ fontSize: 10, fontWeight: '900', color: altActive === 'ai' ? '#fff' : '#7c3aed' }}>
                               {aiGenerating ? 'THINKING...' : hasAi ? '🧠 AI' : '+ AI EXPLAIN'}
                            </Text>
                          </TouchableOpacity>
                        );
                      })()}
                    </ScrollView>
                  )}

                  {/* ── Modify / Edit Buttons (Quiz Engine Style) ── */}
                  {(altActive === 'vitamin' || altActive === 'ai') && !modifyOpen && (
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                      {altActive === 'ai' && (
                        <TouchableOpacity
                          onPress={handleSaveBestFromAi}
                          disabled={savingBest}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                            backgroundColor: colors.surfaceStrong,
                            borderWidth: 1, borderColor: colors.border,
                          }}
                        >
                          {savingBest ? <ActivityIndicator size="small" color={colors.primary} /> : <Save size={12} color={colors.primary} />}
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>Save to My Vitamin</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        onPress={handleOpenModify}
                        activeOpacity={0.7}
                        style={{
                          flexDirection: 'row', alignItems: 'center', gap: 5,
                          paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                          backgroundColor: colors.surfaceStrong,
                          borderWidth: 1, borderColor: colors.border,
                        }}
                      >
                        <Edit2 size={12} color={altActive === 'vitamin' ? colors.primary : colors.textSecondary} />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: altActive === 'vitamin' ? colors.primary : colors.textSecondary }}>Modify & Save</Text>
                      </TouchableOpacity>

                      {altActive === 'vitamin' && (
                        <TouchableOpacity
                          onPress={handleDeleteBest}
                          activeOpacity={0.7}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
                            backgroundColor: colors.surfaceStrong,
                            borderWidth: 1, borderColor: colors.border,
                          }}
                        >
                          <Trash2 size={12} color={colors.textTertiary} />
                          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary }}>Delete</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* ── Modification Panel ── */}
                  {modifyOpen && (
                    <View style={{ marginBottom: 20, padding: 12, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, gap: 10 }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1 }}>
                        EDIT YOUR BEST ANSWER
                      </Text>
                      
                      <View style={{ position: 'relative' }}>
                        <TextInput
                          value={modifyText}
                          onChangeText={setModifyText}
                          multiline
                          textAlignVertical="top"
                          editable={!improving}
                          style={{
                            minHeight: 180,
                            padding: 12,
                            fontSize: 14, color: colors.textPrimary, lineHeight: 22,
                            backgroundColor: colors.bg,
                            borderRadius: 10, borderWidth: 1, borderColor: colors.border,
                          }}
                        />
                        {improving && (
                          <View style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: '#7c3aed18',
                            borderRadius: 10,
                            alignItems: 'center', justifyContent: 'center', gap: 8,
                          }}>
                            <ActivityIndicator size="small" color="#7c3aed" />
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#7c3aed' }}>REWRITING...</Text>
                          </View>
                        )}
                      </View>

                      {/* Improve with AI strip */}
                      {improvePromptOpen && (
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: '#7c3aed10', borderRadius: 10, padding: 6 }}>
                          <Sparkles size={14} color="#7c3aed" />
                          <TextInput
                            value={improvePromptText}
                            onChangeText={setImprovePromptText}
                            placeholder="Ask a doubt or give an instruction..."
                            placeholderTextColor={colors.textTertiary}
                            onSubmitEditing={handleImproveSubmit}
                            editable={!improving}
                            style={{ flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 4 }}
                          />
                          <TouchableOpacity
                            onPress={handleImproveSubmit}
                            disabled={improving || !improvePromptText.trim()}
                            style={{
                              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                              backgroundColor: '#7c3aed',
                              opacity: (improving || !improvePromptText.trim()) ? 0.5 : 1,
                            }}
                          >
                            <Send size={12} color="#fff" />
                          </TouchableOpacity>
                        </View>
                      )}

                      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                        <TouchableOpacity onPress={() => setModifyOpen(false)}>
                          <Text style={{ color: colors.textTertiary, fontWeight: '800', padding: 8 }}>Cancel</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => setImprovePromptOpen(!improvePromptOpen)}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 4,
                            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
                            backgroundColor: improvePromptOpen ? '#7c3aed' : '#7c3aed18',
                          }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '900', color: improvePromptOpen ? '#fff' : '#7c3aed' }}>
                            🤖 Improve with AI
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={commitModification}
                          disabled={savingBest}
                          style={{
                            flexDirection: 'row', alignItems: 'center', gap: 6,
                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
                            backgroundColor: colors.primary,
                            opacity: savingBest ? 0.6 : 1,
                          }}
                        >
                          {savingBest ? <ActivityIndicator size="small" color="#fff" /> : <Save size={14} color="#fff" />}
                          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  <View style={{ minHeight: 40, width: '100%' }}>
                    <Markdown
                      style={{
                        ...getMarkdownStyles(colors),
                        body: {
                          ...getMarkdownStyles(colors).body,
                          fontSize: editorFontSize - 2,
                          lineHeight: (editorFontSize - 2) * 1.5,
                        }
                      }}
                      rules={getMarkdownRules(colors, isDark, (uri) => setZoomImageUrl(uri))}
                    >
                      {cleanMarkdownContent(resolvedAnswerText || '')}
                    </Markdown>
                  </View>

                  {currentCard.state?.user_note ? (
                    <View style={[styles.noteBox, { backgroundColor: colors.primary + '10', marginTop: 24 }]}>
                      <Text style={[styles.noteLabel, { color: colors.primary }]}>PERSONAL NOTE</Text>
                      <Text style={[styles.noteText, { color: colors.textSecondary }]}>{currentCard.state.user_note}</Text>
                    </View>
                  ) : null}

                  {/* AI button removed from here, now in chips above */}
                </Animated.View>
              )}
              </Pressable>
            </ScrollView>
          </PinchGestureHandler>
        </GestureHandlerRootView>

        {showZoomIndicator && (
          <View style={styles.zoomIndicator}>
            <Maximize2 size={16} color="#fff" />
            <Text style={styles.zoomText}>{editorFontSize}px</Text>
          </View>
        )}

        {/* ACTIONS */}
        <View style={[styles.actions, { backgroundColor: colors.bg }]}>
          {isFlipped ? (
            <View style={styles.qualityRow}>
              {[
                { g: 'again' as Grade, label: 'Again', color: '#ef4444' },
                { g: 'hard'  as Grade, label: 'Hard',  color: '#f59e0b' },
                { g: 'good'  as Grade, label: 'Good',  color: colors.primary },
                { g: 'easy'  as Grade, label: 'Easy',  color: '#22c55e' },
              ].map(({ g, label, color }) => (
                <TouchableOpacity key={g} style={[styles.qBtn, { borderColor: color }]} onPress={() => rate(g)} testID={`btn-grade-${g}`}>
                  <Text style={[styles.qBtnLabel, { color }]}>{label}</Text>
                  <Text style={[styles.qBtnSub, { color: colors.textTertiary }]}>{preview[g]?.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.showAnswerContainer}>
              <TouchableOpacity 
                style={[styles.showBtn, { backgroundColor: colors.surfaceStrong }]} 
                onPress={handleReveal} 
                testID="btn-show-answer"
              >
                <Text style={[styles.showBtnText, { color: colors.textPrimary }]}>Show Answer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* EDIT / NOTE MODAL */}
        <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 20}
          >
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Card tools</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}><X size={24} color={colors.textPrimary} /></TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={styles.modalScrollContent}
              >
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Personal Notes / Tricks</Text>
                <TextInput
                  style={[styles.noteInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                  multiline
                  placeholder="Add your own memory aids..."
                  placeholderTextColor={colors.textTertiary}
                  value={personalNote}
                  onChangeText={setPersonalNote}
                  textAlignVertical="top"
                  testID="review-note-input"
                />

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#ef444420' }]} onPress={freezeCard} testID="btn-freeze">
                    <Snowflake size={20} color="#ef4444" />
                    <Text style={{ color: '#ef4444', fontWeight: '700' }}>Freeze Card</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={savePersonalNote} testID="btn-save-note">
                    <Text style={{ color: '#04223a', fontWeight: '900' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* IMAGE ZOOM MODAL */}
        <Modal visible={!!zoomImageUrl} transparent={true} onRequestClose={() => setZoomImageUrl(null)}>
          <ImageViewer
            imageUrls={zoomImageUrl ? [{ url: zoomImageUrl }] : []}
            enableSwipeDown={true}
            onSwipeDown={() => setZoomImageUrl(null)}
            renderIndicator={() => <View />}
          />
        </Modal>

        <CardOverflowMenu 
          visible={menuVisible} 
          frozen={currentCard.state.status === 'frozen'} 
          busy={menuBusy}
          onClose={() => setMenuVisible(false)}
          onAction={handleMenuAction}
          selectLabel="Reset text size"
        />

        {/* IMMERSIVE TEXT SIZE SLIDER */}
        {isAdjustingTextSize && (
          <View style={[styles.textSizeBar, { backgroundColor: colors.surfaceStrong }]}>
            <View style={styles.textSizeRow}>
              <Type size={20} color={colors.textPrimary} />
              <View style={styles.sliderContainer}>
                <PanGestureHandler onGestureEvent={onSliderGesture} onHandlerStateChange={onSliderStateChange}>
                  <View 
                    style={[styles.sliderTrack, { backgroundColor: colors.border }]}
                    onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width)}
                  >
                    <View style={[styles.sliderFill, { backgroundColor: colors.primary, width: `${((editorFontSize - 12) / (40 - 12)) * 100}%` }]} />
                    <View style={[styles.sliderThumb, { left: `${((editorFontSize - 12) / (40 - 12)) * 100}%` }]} />
                  </View>
                </PanGestureHandler>
              </View>
              <Text style={[styles.pxLabel, { color: colors.textPrimary }]}>{editorFontSize}px</Text>
              <TouchableOpacity 
                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                onPress={() => setIsAdjustingTextSize(false)}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <PremiumMoveModal 
          visible={showMoveModal}
          tree={branchTree}
          node={currentCard ? { id: currentCard.id, name: currentCard.front_text } as any : null}
          onClose={() => setShowMoveModal(false)}
          onConfirm={handleMove}
          title="Select location"
        />

        {/* ── Doubt Clearing Modal ── */}
        <Modal
          visible={doubtModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDoubtModalVisible(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
          >
            <View style={{ backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Brain size={24} color={colors.primary} />
                  <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textPrimary }}>Clear Your Doubt</Text>
                </View>
                <TouchableOpacity onPress={() => setDoubtModalVisible(false)}>
                  <X size={24} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, marginBottom: 8, letterSpacing: 1 }}>ASK AI ANYTHING ABOUT THIS CARD</Text>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.surfaceStrong, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <TextInput
                      value={doubtQuestion}
                      onChangeText={setDoubtQuestion}
                      placeholder="Type your question..."
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      style={{ flex: 1, fontSize: 14, color: colors.textPrimary, minHeight: 40, maxHeight: 100 }}
                    />
                    <TouchableOpacity 
                      onPress={handleAskDoubt}
                      disabled={askingDoubt || !doubtQuestion.trim()}
                      style={{ 
                        width: 36, height: 36, borderRadius: 18, 
                        backgroundColor: colors.primary, 
                        alignItems: 'center', justifyContent: 'center',
                        opacity: (askingDoubt || !doubtQuestion.trim()) ? 0.6 : 1
                      }}
                    >
                      {askingDoubt ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
                    </TouchableOpacity>
                  </View>
                </View>

                {doubtAnswer ? (
                  <View style={{ marginTop: 10, padding: 16, backgroundColor: colors.primary + '08', borderRadius: 16, borderWidth: 1, borderColor: colors.primary + '20' }}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, marginBottom: 10 }}>AI RESPONSE</Text>
                    <Text style={{ fontSize: 14, color: colors.textPrimary, lineHeight: 24 }}>
                      {renderAIText(doubtAnswer, { fontSize: 14, color: colors.textPrimary, lineHeight: 24 })}
                    </Text>
                  </View>
                ) : askingDoubt ? (
                  <View style={{ marginTop: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 12, fontSize: 14, color: colors.textTertiary, fontWeight: '700' }}>Consulting AI Mentor...</Text>
                  </View>
                ) : (
                  <View style={{ marginTop: 40, alignItems: 'center', opacity: 0.5 }}>
                    <MessageSquare size={48} color={colors.textTertiary} />
                    <Text style={{ marginTop: 12, fontSize: 14, color: colors.textTertiary, textAlign: 'center' }}>
                      Ask about specific terms, historical context, or why an option is correct.
                    </Text>
                  </View>
                )}
              </ScrollView>
              <View style={{ height: 40 }} />
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </PageWrapper>
  );
}

function Summary({ num, label, color }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ color, fontSize: 28, fontWeight: '900' }}>{num}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '700', marginTop: 4 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, justifyContent: 'space-between' },
  headerBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  progressPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
  progressText: { fontSize: 14, fontWeight: '900' },
  immersiveCard: { padding: 16, borderRadius: 28, minHeight: 400, width: '100%', alignSelf: 'center' },
  sectionHeader: { alignItems: 'center', marginBottom: 16 },
  cardSideLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, textAlign: 'center', color: '#8e8e93' },
  cardText: { fontWeight: '700', textAlign: 'left' },
  answerText: { fontWeight: '600', textAlign: 'left' },
  divider: { height: 1, width: '100%' },
  zoomIndicator: { position: 'absolute', top: 100, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoomText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  flipHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  flipHintText: { fontSize: 14, fontWeight: '700' },
  noteBox: { marginTop: 30, padding: 16, borderRadius: 16 },
  noteLabel: { fontSize: 10, fontWeight: '900', marginBottom: 8 },
  noteText: { fontSize: 14, fontWeight: '500', lineHeight: 22 },
  actions: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  showAnswerContainer: { marginBottom: 20 },
  showBtn: { height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  showBtnText: { fontSize: 18, fontWeight: '900' },
  utilityBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  utilBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  utilAddBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 25 },
  utilAddText: { fontSize: 15, fontWeight: '800' },
  emptyTitle: { fontSize: 26, fontWeight: '900' },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8 },
  doneBtn: { marginTop: 32, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  doneBtnText: { fontWeight: '900', fontSize: 16 },
  qualityRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  qBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 2, alignItems: 'center' },
  qBtnLabel: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  qBtnSub: { fontSize: 11, marginTop: 4, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 30, maxHeight: '82%', width: '100%', maxWidth: 600 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  modalScrollContent: { paddingBottom: 14 },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  noteInput: { minHeight: 150, borderRadius: 20, borderWidth: 1, padding: 16, textAlignVertical: 'top', fontSize: 16 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  modalBtn: { flex: 1, height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  textSizeBar: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    height: 70,
    borderRadius: 35,
    paddingHorizontal: 20,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textSizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 15,
  },
  sliderContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'visible',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: -12,
    marginLeft: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderTouchArea: {
    position: 'absolute',
    top: -20,
    left: 0,
    right: 0,
    bottom: -20,
  },
  pxLabel: {
    fontSize: 14,
    fontWeight: '900',
    width: 45,
    textAlign: 'center',
  },
  doneButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  doneButtonText: {
    color: '#04223a',
    fontWeight: '900',
    fontSize: 14,
  },
  emptyPopup: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 280,
    maxWidth: 320,
  },
});
