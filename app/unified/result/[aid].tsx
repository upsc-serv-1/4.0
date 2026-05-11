import React, { useEffect, useState, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Share, Platform, Alert, Dimensions, Animated, Switch } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { spacing, radius } from '../../../src/theme';
import {
  ChevronLeft,
  Share2,
  Trophy,
  Target,
  ArrowRight,
  Zap,
  ArrowDownCircle,
  HelpCircle as HelpIcon,
  MinusCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  RefreshCcw,
  Search,
  BarChart3,
  BookOpen,
  Sparkles
} from 'lucide-react-native';
import { useSingleTestAnalytics } from '../../../src/hooks/useTestAnalytics';
import { ReviewSection } from '../../../src/components/unified/ReviewSection';
import { StudentSync } from '../../../src/services/StudentSync';
import { FlashcardSvc } from '../../../src/services/FlashcardService';
import { AddToFlashcardSheet } from '../../../src/components/flashcards/AddToFlashcardSheet';
import { supabase } from '../../../src/lib/supabase';
import { useAuth } from '../../../src/context/AuthContext';
import { UnifiedExportSheet } from '../../../src/components/export/UnifiedExportSheet';
import { FileDown } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { aiExplainQuestion } from '../../../src/services/GeminiService';
import { SharedQuestionCard } from '../../../src/components/unified/SharedQuestionCard';
import { getPYQCategorization, buildCanonicalExplanations } from '../../../src/utils/questionUtils';
import { PilotV2SaveSheet } from '../../../src/components/pilot-v2/PilotV2SaveSheet';
import { QuizCaptureSheet } from '../../../src/components/hardnotes/QuizCaptureSheet';
import { MyVitaminEditorSheet } from '../../../src/components/unified/MyVitaminEditorSheet';
import { fetchBestAnswer, saveBestAnswer, deleteBestAnswer } from '../../../src/services/BestAnswerService';
import { DetailedBreakdown } from '../../../src/components/unified/DetailedBreakdown';
import { TrendingUp, BarChart2 } from 'lucide-react-native';
import { markdownToHtml } from '../../../src/utils/textUtils';
import { AnalyseSection } from '../../../src/components/unified/AnalyseSection';
import { PilotV2AIChat } from '../../../src/components/pilot-v2/PilotV2AIChat';
import { Modal, Pressable } from 'react-native';

export default function ResultScreen() {
  const { aid } = useLocalSearchParams<{ aid: string }>();
  const { colors } = useTheme();

  const [activeExplSources, setActiveExplSources] = useState<Record<string, string>>({});
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});

  // Pilot V2 Save states
  const [pilotV2SaveOpen, setPilotV2SaveOpen] = useState(false);
  const [pilotSaveTargetQuestion, setPilotSaveTargetQuestion] = useState<any>(null);
  const [pilotSaveHtml, setPilotSaveHtml] = useState('');

  // Export states
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportPayload, setExportPayload] = useState<any>(null);

  // Hardnotes states
  const [hardnotesPickerVisible, setHardnotesPickerVisible] = useState(false);
  const [hardnotesPayload, setHardnotesPayload] = useState<{ markdown: string; title: string } | null>(null);

  // AI Chat FAB states
  const [activeAiQuestion, setActiveAiQuestion] = useState<any>(null);
  const [aiChatTrigger, setAiChatTrigger] = useState(0);

  // My Vitamin states
  const [bestAnswers, setBestAnswers] = useState<Record<string, any>>({});
  const [savingBest, setSavingBest] = useState<Record<string, boolean>>({});
  const [vitaminEditorVisible, setVitaminEditorVisible] = useState(false);
  const [vitaminEditorContent, setVitaminEditorContent] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  const ensureBestAnswerLoaded = async (qid: string) => {
    if (bestAnswers[qid] !== undefined) return;
    try {
      const best = await fetchBestAnswer(qid);
      setBestAnswers(prev => ({ ...prev, [qid]: best || null }));
    } catch (e) {
      console.error('[Result] Error fetching best answer:', e);
    }
  };

  const handleEditVitamin = (item: any) => {
    const id = item.id || item.question_id;
    const existing = bestAnswers[id];
    setEditingQuestion(item);
    setVitaminEditorContent(existing?.answer_text || aiExplanations[id] || '');
    setVitaminEditorVisible(true);
  };

  const handleSaveVitamin = async (content: string) => {
    if (!editingQuestion) return;
    const id = editingQuestion.id || editingQuestion.question_id;
    setSavingBest(prev => ({ ...prev, [id]: true }));
    try {
      const saved = await saveBestAnswer(id, content, null, null);
      if (saved) {
        setBestAnswers(prev => ({ ...prev, [id]: saved }));
        setActiveExplSources(prev => ({ ...prev, [id]: 'vitamin' }));
        if (Platform.OS === 'android') {
          (global as any).ToastAndroid?.show('My Vitamin saved!', (global as any).ToastAndroid?.SHORT);
        }
      }
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save My Vitamin.');
    } finally {
      setSavingBest(prev => ({ ...prev, [id]: false }));
      setVitaminEditorVisible(false);
    }
  };
  const openNotebookFromQuestion = (
    q: any,
    explanationText?: string,
    optsOrMode?: { closeExplanation?: boolean } | string
  ) => {
    const activeText = explanationText || q.explanation_markdown || '';
    setPilotSaveTargetQuestion(q);
    setPilotSaveHtml(markdownToHtml(activeText));
    setPilotV2SaveOpen(true);
  };

  const openHardnoteFromQuestion = (
    q: any,
    explanationText?: string,
    opts?: { closeExplanation?: boolean }
  ) => {
    const activeText = explanationText || q.explanation_markdown || '';
    setHardnotesPayload({
      markdown: activeText,
      title: q.question_text?.slice(0, 50) || 'Question Explanation'
    });
    setHardnotesPickerVisible(true);
  };

  const handleAiChat = useCallback((item: any) => {
    setActiveAiQuestion(item);
    setAiChatTrigger(prev => prev + 1);
  }, []);

  const handleAiExplain = async (question: any) => {
    if (aiLoading[question.id]) return;
    setAiLoading(prev => ({ ...prev, [question.id]: true }));
    try {
      const rawOptions = question.options || {};
      const optionsMap: Record<string, string> = {
        A: rawOptions.a || rawOptions.A || '',
        B: rawOptions.b || rawOptions.B || '',
        C: rawOptions.c || rawOptions.C || '',
        D: rawOptions.d || rawOptions.D || '',
      };
      const context = (question._explanations && Array.isArray(question._explanations) && question._explanations.length > 0)
        ? question._explanations.map((e: any) => ({
          source: e.source || e.institute || 'Source',
          text: e.text || e.explanation || e.explanation_markdown || '',
          answer: e.answer || e.correct_answer
        }))
        : (question.explanation_markdown ? [{ source: 'Analysis', text: question.explanation_markdown }] : []);

      const res = await aiExplainQuestion(
        question.question_text || '',
        optionsMap,
        question.correctAnswer || '',
        context
      );
      setAiExplanations(prev => ({ ...prev, [question.id]: res.text }));
      setActiveExplSources(prev => ({ ...prev, [question.id]: 'ai' }));
    } catch (e: any) {
      Alert.alert('AI Error', e?.message || 'Failed to generate explanation');
    } finally {
      setAiLoading(prev => ({ ...prev, [question.id]: false }));
    }
  };

  const { session } = useAuth();
  const { loading, error, scoreData, questions, testId, testTitle, hierarchicalPerformance, confidenceMetrics } = useSingleTestAnalytics(aid);
  const [activeTab, setActiveTab] = useState<'review' | 'analysis' | 'detailed'>('review');
  const [filterType, setFilterType] = useState<'all' | 'attempted' | 'correct' | 'incorrect' | 'skipped' | 'pyq' | 'imp_fact' | 'must_revise'>('all');
  const [localTags, setLocalTags] = useState<Record<string, string>>({});
  const [localReviewTags, setLocalReviewTags] = useState<Record<string, string[]>>({});
  const [savingFlashcard, setSavingFlashcard] = useState<Record<string, boolean>>({});
  const [inFlashcardDeck, setInFlashcardDeck] = useState<Record<string, boolean>>({});
  const [aff, setAff] = useState<{ visible: boolean; cardId: string | null; hint: { subject?: string; section_group?: string; microtopic?: string }; questionId?: string | null }>({ visible: false, cardId: null, hint: {}, questionId: null });

  const scrollY = React.useRef(new Animated.Value(0)).current;
  const [showPYQTags] = useState(true); // Always follow rule from search bar
  const [showTrends, setShowTrends] = useState(false);
  const [showMistakes, setShowMistakes] = useState(true);

  const handleAddToFlashcards = async (item: any) => {
    if (!session?.user?.id || savingFlashcard[item.id]) return;
    setSavingFlashcard(prev => ({ ...prev, [item.id]: true }));
    try {
      const qText = item.question_text || item.text || '';
      const { data, error } = await FlashcardSvc.createFromQuestion(session.user.id, {
        questionId: item.id,
        questionText: qText,
        answerText: item.correctAnswer || item.correct_answer || '',
        explanationText: aiExplanations[item.id] || item.explanation_markdown || '',
        subject: item.subject,
        section: item.section_group || item.sectionGroup,
        topic: item.micro_topic || item.microTopic
      });

      if (error) throw error;
      setInFlashcardDeck(prev => ({ ...prev, [item.id]: true }));
      setAff({
        visible: true,
        cardId: data.id,
        hint: {
          subject: item.subject,
          section_group: item.section_group || item.sectionGroup,
          microtopic: item.micro_topic || item.microTopic
        },
        questionId: item.id
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add to flashcards');
    } finally {
      setSavingFlashcard(prev => ({ ...prev, [item.id]: false }));
    }
  };

  const userTags = useMemo(() => {
    const s = new Set<string>();
    (questions || []).forEach(q => {
      const tags = localReviewTags[q.id] || q.reviewTags || [];
      tags.forEach((t: string) => s.add(t));
    });
    return Array.from(s);
  }, [questions, localReviewTags]);

  const prepareExportPayload = () => {
    if (!filteredQuestions || filteredQuestions.length === 0) {
      Alert.alert("No Questions", "The current filter has no questions to export.");
      return;
    }
    const rows = filteredQuestions.map((q: any) => ({
      id: q.id,
      question_text: q.question_text || q.text || q.statement || '',
      options: q.options,
      correct_answer: q.correctAnswer || q.correct_answer,
      selected_answer: q.selectedAnswer || q.selected_answer,
      is_correct: (q.selectedAnswer || q.selected_answer) ? (q.selectedAnswer === q.correctAnswer) : undefined,
      explanation_markdown: q.explanation_markdown || q.explanation,
      subject: q.subject,
      section_group: q.section_group || q.sectionGroup,
      micro_topic: q.micro_topic || q.microTopic,
      exam_year: q.exam_year || q.examYear,
      is_pyq: !!(q.isPyq || q.is_pyq),
      is_ncert: !!(q.isNcert || q.is_ncert),
      review_tags: localReviewTags[q.id] || q.reviewTags || [],
      time_taken_seconds: q.timeTakenSeconds || q.time_taken_seconds,
      // Include merged explanations from all institutes (dedup merger)
      _explanations: Array.isArray(q._explanations) ? q._explanations : [],
    }));
    setExportPayload({ kind: 'questions' as const, rows });
    setExportSheetVisible(true);
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const filteredQuestions = useMemo(() => {
    if (!questions) return [];
    return questions.filter(q => {
      const isCorrect = q.selectedAnswer === q.correctAnswer;
      const isSkipped = !q.selectedAnswer;
      const tags = localReviewTags[q.id] || q.reviewTags || [];

      if (filterType === 'all') return true;
      if (filterType === 'attempted') return !isSkipped;
      if (filterType === 'correct') return isCorrect;
      if (filterType === 'incorrect') return !isCorrect && !isSkipped;
      if (filterType === 'skipped') return isSkipped;
      if (filterType === 'pyq') return q.isPyq;
      if (filterType.startsWith('tag:')) {
        const tagName = filterType.replace('tag:', '');
        return tags.includes(tagName);
      }
      return true;
    });
  }, [questions, filterType, localReviewTags]);

  const [allUserTags, setAllUserTags] = useState<string[]>(['Guessed', 'Silly Mistake', 'Must Revise', 'Time Mgmt', 'Imp. Fact']);

  useEffect(() => {
    const fetchAllTags = async () => {
      if (!session?.user?.id) return;
      const tags = new Set<string>(['Guessed', 'Silly Mistake', 'Must Revise', 'Time Mgmt', 'Imp. Fact']);

      try {
        const catalogKey = `review_tag_catalog_${session.user.id}`;
        const raw = await AsyncStorage.getItem(catalogKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) parsed.forEach(t => t && tags.add(t));
        }
      } catch { }

      const { data } = await supabase
        .from('question_states')
        .select('review_tags')
        .eq('user_id', session.user.id)
        .not('review_tags', 'is', null);

      if (data) {
        data.forEach(row => {
          if (Array.isArray(row.review_tags)) {
            row.review_tags.forEach(t => tags.add(t));
          }
        });
      }
      setAllUserTags(Array.from(tags).sort());
    };
    fetchAllTags();
  }, [session?.user?.id]);

  const userStudyTags = useMemo(() => {
    const s = new Set<string>(allUserTags);
    Object.values(localReviewTags).flat().forEach(tag => {
      if (tag) s.add(tag);
    });
    return Array.from(s).sort();
  }, [allUserTags, localReviewTags]);

  const handleShare = async () => {
    if (!scoreData) return;
    try {
      const message = `I just scored ${scoreData.totalMarks} in ${testTitle || 'a test'} on Noji! 🚀\nAccuracy: ${scoreData.accuracy}%\nCheck it out!`;
      await Share.share({
        message,
        url: 'https://noji.app',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleRePractice = (mode: 'learning' | 'exam') => {
    if (!questions || questions.length === 0) return;
    const allIds = questions.map(q => q.id);
    router.push({
      pathname: '/unified/engine',
      params: {
        testId: testId || 'manual',
        resultIds: allIds.join(','),
        mode: mode,
        view: mode === 'learning' ? 'card' : 'list'
      }
    });
  };

  const handleReviewFiltered = () => {
    const targetIds = filteredQuestions.map(q => q.id);

    if (targetIds.length === 0) {
      Alert.alert("No Questions", "There are no questions in the current filter to review.");
      return;
    }

    router.push({
      pathname: '/unified/engine',
      params: {
        testId: testId || 'manual',
        resultIds: targetIds.join(','),
        mode: 'learning',
        view: 'card'
      }
    });
  };

  const mdStyles = React.useMemo(() => ({
    body: { fontSize: 13, color: colors.textPrimary, lineHeight: 22 },
    heading1: { fontSize: 18, fontWeight: 'bold' as const, color: colors.textPrimary, marginBottom: 8 },
    heading2: { fontSize: 16, fontWeight: 'bold' as const, color: colors.textPrimary, marginBottom: 8 },
    strong: { fontWeight: 'bold' as const },
    em: { fontStyle: 'italic' as const },
    list_item: { flexDirection: 'row' as const, marginBottom: 4 },
    bullet_list: { marginBottom: 12 },
    ordered_list: { marginBottom: 12 },
    code_inline: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: colors.surfaceStrong, paddingHorizontal: 4, borderRadius: 4 },
    code_block: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', backgroundColor: colors.surfaceStrong, padding: 8, borderRadius: 8, marginBottom: 12 },
    table: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden' as const, marginBottom: 12, minWidth: '100%' },
    th: { backgroundColor: colors.surfaceStrong, padding: 8, borderWidth: 1, borderColor: colors.border },
    td: { padding: 8, borderWidth: 1, borderColor: colors.border },
    tr: { flexDirection: 'row' as const },
    paragraph: { marginBottom: 12 },
  }), [colors]);

  const mdRules = React.useMemo(() => ({
    table: (node: any, children: any) => (
      <ScrollView key={node.key} horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: '100%' }} style={{ marginVertical: 8 }}>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', minWidth: 280 }}>
          {children}
        </View>
      </ScrollView>
    ),
    thead: (node: any, children: any) => (
      <View key={node.key} style={{ backgroundColor: colors.surfaceStrong, borderBottomWidth: 1, borderBottomColor: colors.border }}>{children}</View>
    ),
    tbody: (node: any, children: any) => (
      <View key={node.key}>{children}</View>
    ),
    tr: (node: any, children: any) => (
      <View key={node.key} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>{children}</View>
    ),
    th: (node: any, children: any) => (
      <View key={node.key} style={{ flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: colors.border, justifyContent: 'center' }}>{children}</View>
    ),
    td: (node: any, children: any) => (
      <View key={node.key} style={{ flex: 1, padding: 8, borderRightWidth: 1, borderRightColor: colors.border }}>{children}</View>
    )
  }), [colors]);

  const handleRetakeIncorrect = () => {
    const incorrectIds = questions
      ?.filter(q => q.selectedAnswer && q.selectedAnswer !== q.correctAnswer)
      .map(q => q.id);

    if (!incorrectIds || incorrectIds.length === 0) {
      Alert.alert("All Correct!", "No incorrect questions found to retake.");
      return;
    }

    router.push({
      pathname: '/unified/engine',
      params: {
        testId: `${testId}_retake_err`,
        resultIds: incorrectIds.join(','),
        mode: 'exam',
        view: 'list'
      }
    });
  };

  const handleRetakePYQ = () => {
    const pyqIds = questions?.filter(q => q.isPyq).map(q => q.id);

    if (!pyqIds || pyqIds.length === 0) {
      Alert.alert("No PYQs", "This test doesn't contain any Previous Year Questions.");
      return;
    }

    router.push({
      pathname: '/unified/engine',
      params: {
        testId: `${testId}_retake_pyq`,
        resultIds: pyqIds.join(','),
        mode: 'exam',
        view: 'list'
      }
    });
  };

  const handleTagError = async (questionId: string, errorType: string) => {
    if (!aid || !session?.user?.id) return;
    setLocalTags(prev => ({ ...prev, [questionId]: errorType }));

    try {
      await supabase.rpc('update_attempt_error_category', {
        attempt_id: aid,
        q_id: questionId,
        new_cat: errorType,
      });

      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: questionId,
        testId: testId,
        attemptId: aid,
        patch: { error_category: errorType }
      });
    } catch (err) {
      console.error('Failed to save error tag', err);
    }
  };

  const toggleReviewTag = async (questionId: string, tag: string) => {
    if (!aid || !session?.user?.id) return;

    const q = questions?.find(x => x.id === questionId);
    const existingTags = localReviewTags[questionId] || q?.reviewTags || [];
    const newTags = existingTags.includes(tag)
      ? existingTags.filter(t => t !== tag)
      : [...existingTags, tag];

    setLocalReviewTags(prev => ({ ...prev, [questionId]: newTags }));

    try {
      await supabase.rpc('update_attempt_review_tags', {
        attempt_id: aid,
        q_id: questionId,
        new_tags: newTags,
      });

      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: questionId,
        testId: testId,
        attemptId: aid,
        patch: { review_tags: newTags }
      });
    } catch (err) {
      console.error('Failed to toggle review tag', err);
    }
  };

  const handleAddToFlashcard = async (q: any) => {
    if (!session?.user?.id) return;
    if (inFlashcardDeck[q.id]) {
      Alert.alert('Info', 'Already in your deck.');
      return;
    }

    setSavingFlashcard(prev => ({ ...prev, [q.id]: true }));
    try {
      const cardId = await FlashcardSvc.createCard(session.user.id, {
        question_id: q.id,
        test_id: testId,
        front_text: q.question_text,
        back_text: `Correct Answer: ${q.correctAnswer}\n\n${q.explanation_markdown || ''}`,
        subject: q.subject || 'General',
        section_group: q.sectionGroup || 'General',
        microtopic: q.microTopic || (q as any).micro_topic || 'General',
        card_type: 'qa',
        source: { kind: 'question', question_id: q.id, options: q.options }
      } as any);
      // NOTE: Do NOT mark as in-deck yet. Icon should activate only AFTER
      // the user picks a destination AND placement succeeds (onPlaced).
      setAff({
        visible: true,
        cardId,
        hint: {
          subject: q.subject || 'General',
          section_group: q.sectionGroup || 'General',
          microtopic: q.microTopic || (q as any).micro_topic || 'General',
        },
        questionId: q.id,
      });
    } catch (err) {
      console.error('Flashcard error:', err);
      Alert.alert('Error', 'Failed to create flashcard');
    } finally {
      setSavingFlashcard(prev => ({ ...prev, [q.id]: false }));
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Crunching your numbers...</Text>
      </View>
    );
  }

  if (error || !scoreData) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, padding: spacing.xl }]}>
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>
          {typeof error === 'string' ? error : (error as any)?.message || "We couldn't load this result."}
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.primary, marginTop: spacing.xl }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Dynamic Header */}
      <Animated.View style={[styles.header, {
        backgroundColor: colors.surface,
        borderBottomColor: colors.border,
        opacity: headerOpacity,
        zIndex: 10,
      }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <ChevronLeft color={colors.textPrimary} size={24} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {testTitle || 'Test Result'}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={() => setShowTrends(true)}
              style={[styles.headerIcon, { backgroundColor: colors.primary + '15', borderRadius: 8, marginRight: 8 }]}
            >
              <BarChart2 color={colors.primary} size={18} />
            </TouchableOpacity>
            <TouchableOpacity testID="analysis-export-button" onPress={prepareExportPayload} style={styles.headerIcon}>
              <FileDown color={colors.textPrimary} size={20} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.headerIcon}>
              <Share2 color={colors.textPrimary} size={20} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <Animated.FlatList
        data={activeTab === 'review' ? filteredQuestions : []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <SharedQuestionCard
            key={item.id}
            item={{
              ...item,
              correct_answer: item.correctAnswer || item.correct_answer,
              question_text: item.question_text || item.statement_line || item.text,
              _explanations: item._explanations || []
            }}
            index={index}
            arenaMode="learning"
            colors={colors}
            isRevealed={!!revealedExplanations[item.id]}
            activeExplSource={activeExplSources[item.id] || 'all'}
            onExplSourceChange={(src) => setActiveExplSources(prev => ({ ...prev, [item.id]: src }))}
            aiExplanation={aiExplanations[item.id]}
            isAiLoading={aiLoading[item.id]}
            onAiExplain={handleAiExplain}
            onAiChat={handleAiChat}
            onAddFlashcard={() => handleAddToFlashcards(item)}
            isFlashcarded={inFlashcardDeck[item.id]}
            isSavingFlashcard={savingFlashcard[item.id]}
            openNotebookFromQuestion={openNotebookFromQuestion}
            openHardnoteFromQuestion={openHardnoteFromQuestion}
            onEditVitamin={handleEditVitamin}
            bestAnswers={bestAnswers}
            ensureBestAnswerLoaded={ensureBestAnswerLoaded}
            savingBest={savingBest}
            onRevealExplanation={() => setRevealedExplanations(prev => ({ ...prev, [item.id]: true }))}
            onOptionSelect={() => { }}
            mdStyles={mdStyles}
            mdRules={mdRules}
            showPYQTags={showPYQTags}
            userStudyTags={userStudyTags}
            toggleStudyTag={(qid: string, tags: string[], tag: string) => toggleReviewTag(qid, tag)}
            showMistakes={showMistakes}
          />
        )}
        ListHeaderComponent={
          <>
            {/* Score Hero Section */}
            <View style={[styles.hero, { backgroundColor: colors.surfaceStrong }]}>
              <TouchableOpacity onPress={() => router.back()} style={styles.floatingBack}>
                <ChevronLeft color={colors.textPrimary} size={24} />
              </TouchableOpacity>

              <View style={styles.trophyContainer}>
                <Trophy size={48} color={colors.primary} />
              </View>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                {scoreData.accuracy > 80 ? 'Exceptional Work!' : scoreData.accuracy > 50 ? 'Good Effort!' : 'Keep Practicing!'}
              </Text>

              <View style={styles.scoreRow}>
                <View style={styles.scoreItem}>
                  <Text style={[styles.scoreValue, { color: colors.primary }]}>{scoreData.totalMarks}</Text>
                  <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>SCORE</Text>
                </View>
                <View style={[styles.scoreDivider, { backgroundColor: colors.border }]} />
                <View style={styles.scoreItem}>
                  <Text style={[styles.scoreValue, { color: colors.textPrimary }]}>{scoreData.accuracy}%</Text>
                  <Text style={[styles.scoreLabel, { color: colors.textTertiary }]}>ACCURACY</Text>
                </View>
              </View>

              <View style={styles.metricGrid}>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <CheckCircle2 size={16} color={colors.success} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.correct}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Correct</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <XCircle size={16} color={colors.error} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.incorrect}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Wrong</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <HelpCircle size={16} color={colors.textTertiary} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.unattempted}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Skipped</Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Clock size={16} color={colors.primary} />
                  <Text style={[styles.metricValue, { color: colors.textPrimary }]}>{scoreData.avgTimePerQuestion}s</Text>
                  <Text style={[styles.metricLabel, { color: colors.textTertiary }]}>Avg Time</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryAction, { backgroundColor: colors.primary }]}
                onPress={handleReviewFiltered}
              >
                <RefreshCcw size={18} color="#fff" />
                <Text style={styles.primaryActionText}>Review Results</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryAction, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleRePractice('exam')}
              >
                <RefreshCcw size={18} color={colors.textPrimary} />
                <Text style={[styles.secondaryActionText, { color: colors.textPrimary }]}>Retake Full</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.retakeRow}>
              <TouchableOpacity
                style={[styles.retakeBtn, { backgroundColor: colors.surface, borderColor: colors.error + '40' }]}
                onPress={handleRetakeIncorrect}
              >
                <XCircle size={16} color={colors.error} />
                <Text style={[styles.retakeBtnText, { color: colors.error }]}>RETAKE MISTAKES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.retakeBtn, { backgroundColor: colors.surface, borderColor: colors.success + '40' }]}
                onPress={handleRetakePYQ}
              >
                <Zap size={16} color={colors.success} />
                <Text style={[styles.retakeBtnText, { color: colors.success }]}>RETAKE PYQs</Text>
              </TouchableOpacity>
            </View>

            {/* Tabs */}
            <View style={[styles.tabContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'review' && { backgroundColor: colors.surfaceStrong }]}
                onPress={() => setActiveTab('review')}
              >
                <Search size={18} color={activeTab === 'review' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabText, { color: activeTab === 'review' ? colors.textPrimary : colors.textTertiary }]}>Review</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'analysis' && { backgroundColor: colors.surfaceStrong }]}
                onPress={() => setActiveTab('analysis')}
              >
                <BarChart3 size={18} color={activeTab === 'analysis' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabText, { color: activeTab === 'analysis' ? colors.textPrimary : colors.textTertiary }]}>Analysis</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, activeTab === 'detailed' && { backgroundColor: colors.surfaceStrong }]}
                onPress={() => setActiveTab('detailed')}
              >
                <TrendingUp size={18} color={activeTab === 'detailed' ? colors.primary : colors.textTertiary} />
                <Text style={[styles.tabText, { color: activeTab === 'detailed' ? colors.textPrimary : colors.textTertiary }]}>Breakdown</Text>
              </TouchableOpacity>
            </View>

            {activeTab === 'review' ? (
              <View style={styles.reviewContent}>
                {/* Filter Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'attempted', label: 'Attempted' },
                    { id: 'correct', label: 'Correct' },
                    { id: 'incorrect', label: 'Incorrect' },
                    { id: 'skipped', label: 'Skipped' },
                    { id: 'pyq', label: 'PYQ' },
                    ...allUserTags.map(tag => ({ id: `tag:${tag}`, label: tag }))
                  ].map(type => (
                    <TouchableOpacity
                      key={type.id}
                      onPress={() => setFilterType(type.id as any)}
                      style={[
                        styles.filterPill,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        filterType === type.id && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                    >
                      <Text style={[
                        styles.filterPillText,
                        { color: colors.textSecondary },
                        filterType === type.id && { color: '#fff' }
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Revision Mode Toggle */}
                <View style={[styles.revisionToggleRow, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.revisionToggleTitle, { color: colors.textPrimary }]}>Revision Mode</Text>
                    <Text style={[styles.revisionToggleSub, { color: colors.textTertiary }]}>
                      {showMistakes ? "Showing original answers & mistakes" : "Practice Mode: Answers hidden for re-attempt"}
                    </Text>
                  </View>
                  <Switch
                    value={showMistakes}
                    onValueChange={setShowMistakes}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              </View>
            ) : activeTab === 'analysis' ? (
              <ReviewSection
                testAttemptId={aid || ''}
                externalTags={localTags}
                onExternalTagUpdate={handleTagError}
                preComputedScoreData={scoreData}
                preComputedQuestions={questions}
                preComputedHierarchy={hierarchicalPerformance}
                preComputedConfidence={confidenceMetrics}
              />
            ) : (
              <DetailedBreakdown performance={hierarchicalPerformance} />
            )}
          </>
        }
        ListEmptyComponent={
          activeTab === 'review' ? (
            <View style={styles.emptyState}>
              <BookOpen size={48} color={colors.textTertiary} opacity={0.5} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No questions found for this filter.</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={5}
      />

      {/* Trends Modal */}
      <Modal
        visible={showTrends}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTrends(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border
          }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textPrimary }}>Overall Trends</Text>
            <Pressable onPress={() => setShowTrends(false)} style={{ padding: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textSecondary }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView>
            {session?.user?.id && <AnalyseSection userId={session.user.id} />}
          </ScrollView>
        </View>
      </Modal>

      <AddToFlashcardSheet
        visible={aff.visible}
        onClose={() => setAff(s => ({ ...s, visible: false }))}
        userId={session?.user?.id || ''}
        cardId={aff.cardId}
        hint={aff.hint}
        onPlaced={() => {
          // Only mark as in-deck after successful placement (server-confirmed)
          if (aff.questionId) {
            setInFlashcardDeck(prev => ({ ...prev, [aff.questionId as string]: true }));
          }
        }}
      />

      <UnifiedExportSheet
        visible={exportSheetVisible}
        onClose={() => setExportSheetVisible(false)}
        payload={exportPayload}
        title={testTitle || 'Test Analysis'}
        initialOptions={{
          title: testTitle || 'Test Analysis Report',
          moduleName: 'Full Analysis Report',
          headerText: 'UPSC Preparation Analytics',
          footerText: 'Generated by Noji AI Analytics'
        }}
        renderExtraFilters={(o, setO) => (
          userTags.length > 0 ? (
            <View style={{ marginTop: 6 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 6 }}>REVISION TAGS</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {userTags.map(tag => {
                  const isActive = (o.revisionTags || []).includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => setO(prev => ({ ...prev, revisionTags: isActive ? (prev.revisionTags || []).filter(t => t !== tag) : [...(prev.revisionTags || []), tag] }))}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, backgroundColor: isActive ? colors.primary : colors.surfaceStrong, borderColor: isActive ? colors.primary : colors.border }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '800', color: isActive ? '#fff' : colors.textPrimary }}>{tag}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : null
        )}
      />

      <MyVitaminEditorSheet
        visible={vitaminEditorVisible}
        onClose={() => setVitaminEditorVisible(false)}
        onSave={handleSaveVitamin}
        initialContent={vitaminEditorContent}
        questionText={editingQuestion?.question_text || editingQuestion?.question || ''}
        seedQuestion={editingQuestion}
      />

      {/* Floating See Your Response Toggle */}
      <TouchableOpacity
        onPress={() => setShowMistakes(!showMistakes)}
        activeOpacity={0.8}
        style={[
          styles.floatingBtn,
          { backgroundColor: showMistakes ? colors.primary : colors.surfaceStrong, borderColor: showMistakes ? colors.primary : colors.border, borderWidth: 1 }
        ]}
      >
        <Zap color={showMistakes ? '#fff' : colors.primary} size={18} />
        <Text style={[styles.floatingBtnText, { color: showMistakes ? '#fff' : colors.textPrimary }]}>
          See Your Response
        </Text>
      </TouchableOpacity>

      <PilotV2AIChat 
        activeQuestion={activeAiQuestion}
        externalOpenTrigger={aiChatTrigger}
        onSaveResponse={(text: string) => {
          if (!activeAiQuestion) return;
          setPilotSaveTargetQuestion(activeAiQuestion);
          setPilotSaveHtml(markdownToHtml(text || ''));
          setPilotV2SaveOpen(true);
        }}
      />

      <PilotV2SaveSheet
        visible={pilotV2SaveOpen}
        onClose={() => setPilotV2SaveOpen(false)}
        initialHtml={pilotSaveHtml}
        questionId={pilotSaveTargetQuestion?.id}
      />

      <QuizCaptureSheet
        visible={hardnotesPickerVisible}
        onClose={() => setHardnotesPickerVisible(false)}
        initialMarkdown={hardnotesPayload?.markdown || ''}
        initialTitle={hardnotesPayload?.title || ''}
      />
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontWeight: '600',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  floatingBack: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: spacing.xl,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: 30,
  },
  scoreItem: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  scoreLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  scoreDivider: {
    width: 1,
    height: 40,
    opacity: 0.3,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  skippedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 6,
  },
  skippedBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  primaryAction: {
    flex: 2,
    flexDirection: 'row',
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryAction: {
    flex: 1,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  retakeRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  retakeBtnText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    padding: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  reviewContent: {
    paddingHorizontal: spacing.lg,
  },
  filterRow: {
    gap: 10,
    marginBottom: spacing.lg,
    paddingRight: 20,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  questionCard: {
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  qHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  qIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qIndexText: {
    fontSize: 12,
    fontWeight: '900',
  },
  qMeta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subjectTag: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  pyqTag: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    letterSpacing: 0.5,
  },
  qStatusIcon: {
    padding: 4,
  },
  qText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 16,
  },
  optList: {
    gap: 8,
    marginBottom: 16,
  },
  optRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optCircleText: {
    fontSize: 11,
    fontWeight: '900',
  },
  optText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  lbl: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '900',
    marginTop: 12,
    textTransform: 'uppercase',
  },
  ans: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '700',
  },
  exp: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 16,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  flashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 20,
    borderStyle: 'dashed',
  },
  flashBtnText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    fontWeight: '600',
  },
  backBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  revisionToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 20,
  },
  revisionToggleTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  revisionToggleSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  floatingBtn: {
    position: 'absolute',
    top: 110,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1000,
  },
  floatingBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
