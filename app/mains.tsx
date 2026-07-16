import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import FeatureGate from '../src/components/FeatureGate';
import MainsDataFactsCard from '../src/components/mains/MainsDataFactsCard';
import MainsIntroConclusionCard from '../src/components/mains/MainsIntroConclusionCard';
import MainsQuotesCard from '../src/components/mains/MainsQuotesCard';
import MainsMnemonicsCard from '../src/components/mains/MainsMnemonicsCard';
import MainsFrameworksCard from '../src/components/mains/MainsFrameworksCard';
import MainsEthicsCard from '../src/components/mains/MainsEthicsCard';
import MainsTagsView from '../src/components/mains/MainsTagsView';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  useWindowDimensions,
  Image,
  Modal,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  AppState,
  AppStateStatus,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Search,
  Bookmark,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  X,
  Check,
  Copy,
  Sparkles,
  BookOpen,
  Layers,
  ShieldCheck,
  Quote,
  AlignLeft,
  Info,
  Library,
  Map,
  BarChart3,
  Brain,
  Zap,
  Target,
  SlidersHorizontal,
  Filter,
  Flame,
  Plus,
  ExternalLink,
  Tag,
  PenTool,
  Flag,
  Clock,
  Palette,
  FileDown,
  Hash,
  Briefcase,
  Scale,
  Star,
} from 'lucide-react-native';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import Markdown from 'react-native-markdown-display';
import { aiExpandSearchQuery } from '../src/services/GeminiService';
import { AIModelSwitcher } from '../src/components/ai/AIModelSwitcher';
import { supabase } from '../src/lib/supabase';
import { useFlashcardAction } from '../src/hooks/useFlashcardAction';
import { AddToFlashcardSheet } from '../src/components/flashcards/AddToFlashcardSheet';
import { StudentSync } from '../src/services/StudentSync';
import { useTagStore } from '../src/store/tagStore';
import * as Haptics from 'expo-haptics';
import { PinchGestureHandler, PanGestureHandler, State as GHState } from 'react-native-gesture-handler';
import { PilotV2Provider } from '../src/context/PilotV2Context';
import { PilotV2AIChat } from '../src/components/pilot-v2/PilotV2AIChat';
import { PilotV2SaveSheet } from '../src/components/pilot-v2/PilotV2SaveSheet';
import { MyVitaminEditorSheet } from '../src/components/unified/MyVitaminEditorSheet';
import { fetchBestAnswer, saveBestAnswer, deleteBestAnswer, BestAnswer } from '../src/services/BestAnswerService';
import { markdownToHtml } from '../src/utils/textUtils';

const naturalCompare = (() => {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return (a: string, b: string) => collator.compare(a, b);
})();

/**
 * Returns markdown-display rules with theme-aware table / image renderers.
 * Call once per component with the current colors + isDark values.
 */
export const getMarkdownRules = (colors: any, isDark: boolean, onImagePress?: (uri: string) => void) => ({
  table: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        marginVertical: 10,
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#d1d5db',
        borderRadius: 6,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      {children}
    </View>
  ),
  thead: (node: any, children: any) => (
    <View key={node.key} style={{ backgroundColor: isDark ? '#1e2a3a' : '#f0f4ff' }}>
      {children}
    </View>
  ),
  tbody: (node: any, children: any) => (
    <View key={node.key}>{children}</View>
  ),
  th: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        flex: 1,
        padding: 10,
        borderRightWidth: 1,
        borderColor: isDark ? '#374151' : '#d1d5db',
        justifyContent: 'flex-start',
      }}
    >
      {children}
    </View>
  ),
  td: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        flex: 1,
        padding: 10,
        borderRightWidth: 1,
        borderColor: isDark ? '#374151' : '#d1d5db',
        justifyContent: 'flex-start',
      }}
    >
      {children}
    </View>
  ),
  tr: (node: any, children: any) => (
    <View
      key={node.key}
      style={{
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderColor: isDark ? '#374151' : '#d1d5db',
        width: '100%',
      }}
    >
      {children}
    </View>
  ),
  image: (node: any) => {
    const src = node.attributes?.src || '';
    if (!src) return null;
    return (
      <TouchableOpacity
        key={node.key}
        activeOpacity={0.9}
        onPress={() => onImagePress?.(src)}
        style={{ width: '100%', alignItems: 'center', marginVertical: 12 }}
      >
        <Image
          source={{ uri: src }}
          style={{ width: '100%', height: Dimensions.get('window').width >= 768 ? 320 : 220 }}
          resizeMode="contain"
        />
      </TouchableOpacity>
    );
  },
});

/** @deprecated use getMarkdownRules(colors, isDark) */
export const markdownRules = getMarkdownRules({ border: '#d1d5db' }, false);

import {
  mainsConsolidatedQuestions,
  ConsolidatedQuestion,
  fetchMainsQuestionsFromSupabase
} from '../src/data/mainsConsolidatedLoader';
import {
  mainsConsolidatedValueAdd,
  ValueAdditionItem,
  fetchValueAdditionFromSupabase
} from '../src/data/mainsValueAdditionLoader';
import { buildPredictive, probableHotsFor2026 } from '../src/lib/pyqPredictive';
import { UnifiedExportSheet } from '../src/components/export/UnifiedExportSheet';


const getQuestionSection = (q: any): string => q.sectionGroup || q.section_group || q.sectiongroup || '';
const getQuestionMicro = (q: any): string => q.microTopic || q.microtopic || q.micro_topic || '';
const getQuestionSub = (q: any): string => q.subTopic || q.subtopic || q.sub_topic || '';
const getQuestionNano = (q: any): string => q.nanoTopic || q.nanotopic || q.nano_topic || '';

const truncateText = (text: string, maxLen: number = 40): string => {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen).trim() + '...';
};

const getValueAddSection = (va: any): string => va.sectionGroup || va.section_group || va.sectiongroup || '';
const getValueAddMicro = (va: any): string => va.microtopic || va.microTopic || va.micro_topic || '';
const getValueAddSub = (va: any): string => va.subtopic || va.subTopic || va.sub_topic || '';
const getValueAddNano = (va: any): string => va.nanotopic || va.nanoTopic || va.nano_topic || '';

interface MainsFilters {
  searchAcross: ('Questions' | 'Answers' | 'Value Additions')[];
  pyqFilter: 'All' | 'PYQ Only' | 'Non-PYQ';
  revisionTags: string;
  institutes: string;
  program: string;
  paper: string;
  subjects: string;
  sections: string;
  microtopics: string;
  subtopics: string;
  nanotopics: string;
  macrotags: string;
  microtags: string;
  years: string;
}

const DEFAULT_MAINS_FILTERS: MainsFilters = {
  searchAcross: ['Questions', 'Answers', 'Value Additions'],
  pyqFilter: 'All',
  revisionTags: 'All',
  institutes: 'All',
  program: 'All',
  // Default to GS papers only — Optional questions should only show when explicitly selected
  paper: 'All',
  subjects: 'All',
  sections: 'All',
  microtopics: 'All',
  subtopics: 'All',
  nanotopics: 'All',
  macrotags: 'All',
  microtags: 'All',
  years: 'All',
};


export function MainsScreenInner() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const { session } = useAuth();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const insets = useSafeAreaInsets();

  const params = useLocalSearchParams<{
    paper?: string;
    subject?: string;
    section?: string;
    microtopic?: string;
    year?: string;
    initialScreen?: string;
    from?: string;
    category?: string;
    questionId?: string;
    vaId?: string;
  }>();

  const [currentScreen, setCurrentScreen] = useState<'hub' | 'questions' | 'value-add' | 'search' | 'detailed-question' | 'revision-tags'>('hub');
  const [sessionFilters, setSessionFilters] = useState<MainsFilters | null>(null);

  useEffect(() => {
    if (params.initialScreen === 'questions') {
      if (params.questionId) {
        const q = mainsConsolidatedQuestions.find(item => String(item.id) === String(params.questionId));
        if (q) {
          setDetailedQuestion(q);
          setCurrentScreen('detailed-question');
          setPreviousScreen('questions');
          return;
        }
      }
      setCurrentScreen('questions');
    } else if (params.initialScreen === 'value-add' || params.initialScreen === 'value-addition') {
      setCurrentScreen('value-add');
      if (params.category) {
        setValueAddCategory(params.category);
      } else {
        setValueAddCategory(null);
      }
    }
  }, [params.initialScreen, params.category, params.questionId]);

  const initialFiltersFromParams = useMemo(() => {
    if (!params.initialScreen) return null;

    const cleanParam = (val: string | undefined | null) => {
      if (!val) return 'All';
      return val;
    };

    const cleanYearsParam = (val: string | undefined | null) => {
      if (!val) return 'All';
      return val.replace(/,/g, '|');
    };

    let mappedPaper = 'All';
    if (params.paper) {
      const p = params.paper;
      if (p === 'GS Paper 1') mappedPaper = 'GS1';
      else if (p === 'GS Paper 2') mappedPaper = 'GS2';
      else if (p === 'GS Paper 3') mappedPaper = 'GS3';
      else if (p === 'GS Paper 4') mappedPaper = 'GS4';
      else if (p === 'Optional') mappedPaper = 'Optional';
      else mappedPaper = cleanParam(p);
    }

    return {
      ...DEFAULT_MAINS_FILTERS,
      paper: mappedPaper,
      subjects: cleanParam(params.subject),
      sections: cleanParam(params.section),
      microtopics: cleanParam(params.microtopic),
      subtopics: cleanParam(params.subtopic),
      years: cleanYearsParam(params.year),
    };
  }, [params.initialScreen, params.paper, params.subject, params.section, params.microtopic, params.subtopic, params.year]);

  const [previousScreen, setPreviousScreen] = useState<'questions' | 'search'>('questions');
  const [detailedQuestion, setDetailedQuestion] = useState<ConsolidatedQuestion | null>(null);
  const [valueAddCategory, setValueAddCategory] = useState<string | null>(null);
  const [detailedStudyTags, setDetailedStudyTags] = useState<string[]>([]);
  const [detailedConfidence, setDetailedConfidence] = useState<string | null>(null);
  const [detailedDifficulty, setDetailedDifficulty] = useState<string | null>(null);

  const isNotAtRoot = currentScreen !== 'hub' || (currentScreen === 'value-add' && valueAddCategory !== null);

  usePreventRemove(
    isNotAtRoot,
    () => {
      if (currentScreen === 'value-add' && valueAddCategory !== null) {
        setValueAddCategory(null);
      } else if (currentScreen === 'questions' && params.from === 'pyq') {
        router.back();
      } else if (currentScreen === 'detailed-question') {
        setCurrentScreen(previousScreen);
        setDetailedQuestion(null);
      } else if (currentScreen === 'revision-tags') {
        setCurrentScreen('hub');
      } else if (currentScreen === 'search') {
        setCurrentScreen('hub');
      } else if (currentScreen === 'questions') {
        setCurrentScreen('hub');
      } else if (currentScreen === 'value-add') {
        setCurrentScreen('hub');
      } else {
        setCurrentScreen('hub');
      }
    }
  );

  useEffect(() => {
    navigation.setOptions({
      gestureEnabled: !isNotAtRoot,
    });
  }, [isNotAtRoot, navigation]);

  const onGestureStateChange = (event: any) => {
    if (event.nativeEvent.state === GHState.END) {
      const { translationX, x, velocityX } = event.nativeEvent;
      const startX = x - translationX;
      if (startX < 50 && translationX > 80 && velocityX > 100) {
        if (currentScreen === 'value-add' && valueAddCategory !== null) {
          setValueAddCategory(null);
        } else if (currentScreen === 'questions' && params.from === 'pyq') {
          router.back();
        } else if (currentScreen === 'detailed-question') {
          setCurrentScreen(previousScreen);
          setDetailedQuestion(null);
        } else if (currentScreen === 'revision-tags') {
          setCurrentScreen('hub');
        } else if (currentScreen === 'search') {
          setCurrentScreen('hub');
        } else if (currentScreen === 'questions') {
          setCurrentScreen('hub');
        } else if (currentScreen === 'value-add') {
          setCurrentScreen('hub');
        }
      }
    }
  };

  // Pilot V2 & Vitamin & AI Chat states
  const [pilotV2SaveOpen, setPilotV2SaveOpen] = useState(false);
  const [pilotSaveTargetQuestion, setPilotSaveTargetQuestion] = useState<any>(null);
  const [pilotSaveHtml, setPilotSaveHtml] = useState('');
  const [aiChatQuestion, setAiChatQuestion] = useState<any>(null);
  const [aiChatTrigger, setAiChatTrigger] = useState(0);
  const [vitaminEditorVisible, setVitaminEditorVisible] = useState(false);
  const [vitaminEditorContent, setVitaminEditorContent] = useState('');
  const [detailedBestAnswer, setDetailedBestAnswer] = useState<BestAnswer | null>(null);
  const [savingBest, setSavingBest] = useState(false);

  // User question state map for fast local filtering
  const [userQuestionStates, setUserQuestionStates] = useState<Record<string, { reviewTags: string[], confidence: string | null, difficulty: string | null }>>({});

  // Fetch all user question states on mount to populate userQuestionStates map
  useEffect(() => {
    if (!session?.user?.id) return;
    const fetchAllStates = async () => {
      try {
        const { data } = await supabase
          .from('mains_question_states')
          .select('question_id, review_tags, confidence, difficulty_level')
          .eq('user_id', session.user.id);
        if (data) {
          const stateMap: Record<string, any> = {};
          data.forEach(row => {
            stateMap[row.question_id] = {
              reviewTags: row.review_tags || [],
              confidence: row.confidence || null,
              difficulty: row.difficulty_level || row.review_difficulty || null,
            };
          });
          setUserQuestionStates(stateMap);
        }
      } catch (err) {
        console.error('Failed to load user question states map:', err);
      }
    };
    fetchAllStates();
  }, [session?.user?.id]);


  // User Revision Tags (Landed at top level to be shared)
  const [userTags, setUserTags] = useState<string[]>([]);
  const [valueAddTags, setValueAddTags] = useState<Record<string, string[]>>({});
  // VA Favorites (saved to Supabase)
  const [vaFavorites, setVaFavorites] = useState<Set<string>>(new Set());

  // Flashcards Integration hook
  const {
    savingFlashcard,
    flashcardedIds,
    setFlashcardedIds,
    aff,
    setAff,
    handleAddToFlashcards,
    handleFlashcardPlaced,
    fetchFlashcardedStatus
  } = useFlashcardAction(session?.user?.id);

  // Sync tags and flashcard status when detailed question changes
  useEffect(() => {
    if (detailedQuestion && session?.user?.id) {
      fetchFlashcardedStatus([detailedQuestion.id]);

      const loadStates = async () => {
        try {
          const { data } = await supabase
            .from('mains_question_states')
            .select('review_tags, confidence, difficulty_level')
            .eq('user_id', session.user.id)
            .eq('question_id', detailedQuestion.id)
            .maybeSingle();

          if (data) {
            setDetailedStudyTags(data.review_tags || []);
            setDetailedConfidence(data.confidence || null);
            setDetailedDifficulty(data.difficulty_level || data.review_difficulty || null);
          } else {
            setDetailedStudyTags([]);
            setDetailedConfidence(null);
            setDetailedDifficulty(null);
          }
        } catch (err) {
          console.error('Failed to load detailed question states:', err);
        }
      };

      const loadVitamin = async () => {
        try {
          const saved = await fetchBestAnswer(detailedQuestion.id);
          setDetailedBestAnswer(saved);
        } catch (err) {
          console.error('Failed to load detailed question vitamin:', err);
        }
      };

      loadStates();
      loadVitamin();
    }
  }, [detailedQuestion?.id, session?.user?.id]);


  const handleSetConfidence = async (level: string) => {
    if (!detailedQuestion || !session?.user?.id) return;
    const nextVal = detailedConfidence === level ? null : level;
    setDetailedConfidence(nextVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setUserQuestionStates(prev => ({
      ...prev,
      [detailedQuestion.id]: {
        reviewTags: prev[detailedQuestion.id]?.reviewTags || [],
        difficulty: prev[detailedQuestion.id]?.difficulty || null,
        confidence: nextVal,
      }
    }));

    try {
      await StudentSync.enqueue('mains_question_state', {
        userId: session.user.id,
        questionId: detailedQuestion.id,
        testId: 'manual',
        patch: { confidence: nextVal || '' }
      });
    } catch (err) {
      console.error("Confidence Sync Error:", err);
    }
  };

  const handleSetDifficulty = async (level: string) => {
    if (!detailedQuestion || !session?.user?.id) return;
    const nextVal = detailedDifficulty === level ? null : level;
    setDetailedDifficulty(nextVal);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setUserQuestionStates(prev => ({
      ...prev,
      [detailedQuestion.id]: {
        reviewTags: prev[detailedQuestion.id]?.reviewTags || [],
        confidence: prev[detailedQuestion.id]?.confidence || null,
        difficulty: nextVal,
      }
    }));

    try {
      await StudentSync.enqueue('mains_question_state', {
        userId: session.user.id,
        questionId: detailedQuestion.id,
        testId: 'manual',
        patch: { review_difficulty: nextVal || '' }
      });
    } catch (err) {
      console.error("Difficulty Sync Error:", err);
    }
  };

  const handleToggleDetailedTag = async (tag: string) => {
    if (!detailedQuestion || !session?.user?.id) return;
    const currentTags = detailedStudyTags;
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];

    setDetailedStudyTags(newTags);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    setUserQuestionStates(prev => ({
      ...prev,
      [detailedQuestion.id]: {
        confidence: prev[detailedQuestion.id]?.confidence || null,
        difficulty: prev[detailedQuestion.id]?.difficulty || null,
        reviewTags: newTags,
      }
    }));

    try {
      await StudentSync.enqueue('mains_question_state', {
        userId: session.user.id,
        questionId: detailedQuestion.id,
        testId: 'manual',
        patch: { review_tags: newTags }
      });
      useTagStore.getState().bump({ type: 'add', tag, at: Date.now() });
    } catch (err) {
      console.error("Tag Sync Error:", err);
    }
  };


  const handleCreateDetailedTag = async (createdTag: string) => {
    if (!createdTag.trim() || !session?.user?.id) return;
    const cleanTag = createdTag.trim();
    if (userTags.includes(cleanTag)) {
      if (!detailedStudyTags.includes(cleanTag)) {
        await handleToggleDetailedTag(cleanTag);
      }
      return;
    }

    const updatedUserTags = [...userTags, cleanTag].sort();
    setUserTags(updatedUserTags);

    try {
      await supabase.rpc('add_user_tag', { p_tag: cleanTag }).then(({ error }) => {
        if (error) console.warn('[tags] add_user_tag RPC failed', error.message);
      });
      const catalogKey = `review_tag_catalog_${session.user.id}`;
      const existing = await AsyncStorage.getItem(catalogKey);
      const parsed: string[] = existing ? JSON.parse(existing) : [];
      const newList = Array.from(new Set([...parsed, cleanTag]));
      await AsyncStorage.setItem(catalogKey, JSON.stringify(newList));
    } catch {}

    useTagStore.getState().bump({ type: 'add', tag: cleanTag, at: Date.now() });
    await handleToggleDetailedTag(cleanTag);
  };

  const handleOpenPilot = (q: any) => {
    const html = markdownToHtml(q.answers?.[0]?.answerText || `**Question:** ${q.questionText || 'Question'}`);
    setPilotSaveTargetQuestion({
      id: q.id,
      subject: q.subject || null,
      section_group: q.sectionGroup || q.section_group || null,
      micro_topic: q.microTopic || q.micro_topic || null,
      exam_year: q.year || null,
      question_text: q.questionText || '',
      explanation_markdown: q.answers?.[0]?.answerText || '',
    });
    setPilotSaveHtml(html);
    setPilotV2SaveOpen(true);
  };

  const handleActiveQuestionChange = useCallback((q: ConsolidatedQuestion | null, activeAnswerText?: string, activeInstName?: string, allAnswers?: any[]) => {
    if (!q) {
      setAiChatQuestion(null);
      return;
    }
    
    let explanationContext = '';
    
    if (activeAnswerText && activeInstName) {
      explanationContext += `[SELECTED MODEL ANSWER (${activeInstName.toUpperCase()})]\n${activeAnswerText}\n\n`;
    }
    
    const cleanAnsList = allAnswers && allAnswers.length > 0 ? allAnswers : (q.answers ? getCleanAvailableAnswers(q.answers) : []);
    if (cleanAnsList.length > 0) {
      if (!activeAnswerText || !activeInstName) {
        const currentInst = activeInstName || cleanAnsList[0].institute;
        const activeAnswer = cleanAnsList.find(ans => ans.institute === currentInst) || cleanAnsList[0];
        explanationContext += `[SELECTED MODEL ANSWER (${currentInst.toUpperCase()})]\n${activeAnswer.answerText || ''}\n\n`;
      }
      
      explanationContext += `[ALL COMPILED MODEL ANSWERS FOR CONTEXT]\n`;
      cleanAnsList.forEach((ans: any) => {
        const inst = ans.institute || 'Unknown';
        const isCurrent = inst.toLowerCase() === activeInstName?.toLowerCase() ? ' (Currently Selected)' : '';
        explanationContext += `--- Answer from ${inst}${isCurrent} ---\n${ans.answerText || ans.answer_text || ''}\n\n`;
      });
    } else {
      explanationContext = q.answers?.[0]?.answerText || 'No answers available.';
    }

    setAiChatQuestion({
      id: q.id,
      question_text: q.questionText || '',
      statement_line: q.questionText || '',
      options: {},
      correct_answer: explanationContext,
      explanation: explanationContext,
      subject: q.subject || '',
    });
  }, []);

  const handleOpenAIChat = useCallback((q: any, activeAnswerText?: string, activeInstName?: string, allAnswers?: any[]) => {
    handleActiveQuestionChange(q, activeAnswerText, activeInstName, allAnswers);
    setAiChatTrigger(prev => prev + 1);
  }, [handleActiveQuestionChange]);

  const handleDetailedQuestionActiveAnswerChange = useCallback((activeText: string, activeInstName: string, allAns: any[]) => {
    if (detailedQuestion) {
      handleActiveQuestionChange(detailedQuestion, activeText, activeInstName, allAns);
    }
  }, [detailedQuestion, handleActiveQuestionChange]);

  const handleValueAddFlashcard = useCallback((item: any, front: string, back: string) => {
    const dummyQuestion = {
      id: `value_add_${item.id}_${Date.now()}`,
      questionText: front,
      subject: item.subject || 'General',
      section_group: item.sectionGroup || item.section_group || 'General',
      microtopic: item.microtopic || item.microTopic || item.title || 'General',
    };
    handleAddToFlashcards(dummyQuestion, back, true);
  }, [handleAddToFlashcards]);

  const handleDeleteBestAnswer = () => {
    if (!detailedQuestion) return;
    Alert.alert(
      'Delete saved answer?',
      'This removes your saved best answer ("My Vitamin") for this question.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBestAnswer(detailedQuestion.id);
              setDetailedBestAnswer(null);
            } catch (err) {
              Alert.alert('Delete failed', 'Could not delete My Vitamin.');
            }
          },
        },
      ]
    );
  };


  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const DEFAULT_TAGS = ['Imp. Fact', 'Imp. Concept', 'Trap Question', 'Must Revise', 'Memorize'];
    const loadTags = async () => {
      const allTags = new Set<string>(DEFAULT_TAGS);
      try {
        const catalogKey = `review_tag_catalog_${userId}`;
        const raw = await AsyncStorage.getItem(catalogKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) parsed.forEach((t: string) => t && allTags.add(t));
        }
      } catch {}
      try {
        const { data } = await supabase
          .from('mains_question_states')
          .select('review_tags')
          .eq('user_id', userId)
          .not('review_tags', 'is', null);

        data?.forEach(row => {
          if (Array.isArray(row.review_tags)) {
            row.review_tags.forEach((t: string) => t && allTags.add(t));
          }
        });
      } catch (err) {
        console.warn('Failed to load user tags from Supabase:', err);
      }
      const list = Array.from(allTags).sort();
      setUserTags(list.length > 0 ? list : DEFAULT_TAGS);
    };
    const loadValueAddTags = async () => {
      let localTags: Record<string, string[]> = {};
      try {
        const raw = await AsyncStorage.getItem('mains_value_add_tags');
        if (raw) {
          localTags = JSON.parse(raw);
          setValueAddTags(localTags);
        }
      } catch (err) {
        console.error('Failed to load mains_value_add_tags:', err);
      }

      if (session?.user?.id) {
        try {
          const { data, error } = await supabase
            .from('mains_value_add_states')
            .select('card_id, review_tags')
            .eq('user_id', session.user.id);
          
          if (!error && data) {
            const vaTagsMap: Record<string, string[]> = {};
            data.forEach(row => {
              if (row.review_tags && row.review_tags.length > 0) {
                vaTagsMap[row.card_id] = row.review_tags;
              }
            });

            // Overlay pending local offline writes for mains_value_add_state
            try {
              const queue = await StudentSync.getQueue();
              queue.forEach(item => {
                if (item.kind === 'mains_value_add_state') {
                  const { cardId, patch } = item.payload;
                  if (patch && patch.hasOwnProperty('review_tags')) {
                    if (patch.review_tags && patch.review_tags.length > 0) {
                      vaTagsMap[cardId] = patch.review_tags;
                    } else {
                      delete vaTagsMap[cardId];
                    }
                  }
                }
              });
            } catch (queueErr) {
              console.warn('[loadValueAddTags] Failed to read sync queue:', queueErr);
            }

            setValueAddTags(vaTagsMap);
            await AsyncStorage.setItem('mains_value_add_tags', JSON.stringify(vaTagsMap));
            console.log('[MainsScreen] Synced value add tags from Supabase:', data.length);
          }
        } catch (err) {
          console.warn('Failed to sync mains_value_add_states from Supabase:', err);
        }
      }
    };
    const loadVaFavorites = async () => {
      if (!session?.user?.id) return;
      try {
        const cached = await AsyncStorage.getItem('user_va_favorites');
        if (cached) {
          setVaFavorites(new Set(JSON.parse(cached)));
        }
      } catch (err) {
        console.warn('Failed to load user_va_favorites from AsyncStorage:', err);
      }
      try {
        const { data, error } = await supabase
          .from('user_va_favorites')
          .select('card_id')
          .eq('user_id', session.user.id);
        if (!error && data) {
          const cardIds = data.map((r: any) => r.card_id);
          setVaFavorites(new Set(cardIds));
          await AsyncStorage.setItem('user_va_favorites', JSON.stringify(cardIds));
        }
      } catch (err) {
        console.error('[VA Favorites] Failed to load from Supabase:', err);
      }
    };
    loadTags();
    loadValueAddTags();
    loadVaFavorites();

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[MainsScreen] App foregrounded, reloading sync state...');
        loadTags();
        loadValueAddTags();
        loadVaFavorites();
      }
    };
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      appStateSub.remove();
    };
  }, [session?.user?.id, currentScreen]);

  const handleToggleVaFavorite = async (cardId: string) => {
    if (!session?.user?.id) return;
    const isFav = vaFavorites.has(cardId);
    
    // Optimistic update
    const nextSet = new Set(vaFavorites);
    if (isFav) nextSet.delete(cardId); else nextSet.add(cardId);
    setVaFavorites(nextSet);
    await AsyncStorage.setItem('user_va_favorites', JSON.stringify(Array.from(nextSet))).catch(() => {});

    try {
      if (isFav) {
        await supabase
          .from('user_va_favorites')
          .delete()
          .eq('user_id', session.user.id)
          .eq('card_id', cardId);
      } else {
        await supabase
          .from('user_va_favorites')
          .upsert({ user_id: session.user.id, card_id: cardId }, { onConflict: 'user_id,card_id' });
      }
    } catch (err) {
      console.error('[VA Favorites] Failed to sync Supabase:', err);
      // Revert on error
      const revertSet = new Set(vaFavorites);
      if (isFav) revertSet.add(cardId); else revertSet.delete(cardId);
      setVaFavorites(revertSet);
      await AsyncStorage.setItem('user_va_favorites', JSON.stringify(Array.from(revertSet))).catch(() => {});
    }
  };

  const getMainsCardContentString = (item: ValueAdditionItem): string => {
    if (!item) return '';
    const { category } = item;
    if (category === 'data_facts') {
      return [
        item.metric ? `Metric: ${item.metric}` : '',
        item.context ? `Context: ${item.context}` : '',
        item.source ? `Source: ${item.source}` : ''
      ].filter(Boolean).join('\n');
    }
    if (category === 'intro_conclusion') {
      return [
        item.introduction ? `Introduction: ${item.introduction}` : '',
        item.conclusion ? `Conclusion: ${item.conclusion}` : ''
      ].filter(Boolean).join('\n');
    }
    if (category === 'quotes') {
      return [
        item.quoteText ? `Quote: "${item.quoteText}"` : '',
        item.author ? `- ${item.author}` : '',
        item.usageGuide ? `Usage Guide: ${item.usageGuide}` : ''
      ].filter(Boolean).join('\n');
    }
    if (category === 'mnemonics') {
      const expansionStr = Array.isArray(item.mnemonicExpansion)
        ? item.mnemonicExpansion.map(e => `${e.letter}: ${e.meaning}${e.detail ? ` (${e.detail})` : ''}`).join(', ')
        : '';
      return [
        item.mnemonicKeyword ? `Mnemonic Keyword: ${item.mnemonicKeyword}` : '',
        expansionStr ? `Expansion: ${expansionStr}` : ''
      ].filter(Boolean).join('\n');
    }
    if (category === 'frameworks') {
      const boxesStr = Array.isArray(item.frameworkBoxes)
        ? item.frameworkBoxes.map(b => `${b.label}: ${b.description}`).join('\n')
        : '';
      return [
        item.frameworkGuide ? `Guide: ${item.frameworkGuide}` : '',
        boxesStr ? `Boxes:\n${boxesStr}` : ''
      ].filter(Boolean).join('\n');
    }
    if (category === 'ethics') {
      const ethicsDetails: string[] = [];
      if (item.ethicsType) {
        ethicsDetails.push(`Ethics Type: ${item.ethicsType}`);
      }
      const data = item.ethicsData;
      if (data) {
        if (data.diagramType) ethicsDetails.push(`Diagram Type: ${data.diagramType}`);
        if (data.diagramDescription) ethicsDetails.push(`Diagram Description: ${data.diagramDescription}`);
        if (Array.isArray(data.dimensionsList)) ethicsDetails.push(`Dimensions: ${data.dimensionsList.join(', ')}`);
        if (Array.isArray(data.comparisonPoints)) {
          const points = data.comparisonPoints.map(p => `${p.criteria}: ${p.termA} vs ${p.termB}`).join('\n');
          ethicsDetails.push(`Comparison:\n${points}`);
        }
        if (data.officerName) ethicsDetails.push(`Officer: ${data.officerName}`);
        if (data.initiative) ethicsDetails.push(`Initiative: ${data.initiative}`);
        if (data.impact) ethicsDetails.push(`Impact: ${data.impact}`);
        if (data.values) ethicsDetails.push(`Values: ${data.values}`);
        if (data.keywordDefinition) ethicsDetails.push(`Definition: ${data.keywordDefinition}`);
        if (data.keywordExample) ethicsDetails.push(`Example: ${data.keywordExample}`);
      }
      if (item.rawContent) {
        ethicsDetails.push(`Raw Content: ${item.rawContent}`);
      }
      return ethicsDetails.filter(Boolean).join('\n');
    }
    return item.rawContent || '';
  };

  const handleToggleValueAddTag = async (cardId: string, tag: string) => {
    const currentTags = valueAddTags[cardId] || [];
    const nextTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];

    const nextValueAddTags = {
      ...valueAddTags,
      [cardId]: nextTags,
    };
    setValueAddTags(nextValueAddTags);
    try {
      await AsyncStorage.setItem('mains_value_add_tags', JSON.stringify(nextValueAddTags));
    } catch (err) {
      console.error('Failed to save mains_value_add_tags:', err);
    }

    if (session?.user?.id) {
      const cardItem = valueAddItems.find(item => item.id === cardId);
      const cardContent = cardItem ? {
        category: cardItem.category,
        title: cardItem.title,
        paper: cardItem.paper || null,
        subject: cardItem.subject || null,
        details: getMainsCardContentString(cardItem)
      } : null;

      StudentSync.enqueue('mains_value_add_state', {
        userId: session.user.id,
        cardId,
        patch: {
          review_tags: nextTags,
          content: cardContent
        }
      });
    }
  };
  
  // Saved questions / syllabus progress
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Theme state: 'gradient' or 'white'
  const [mainsTheme, setMainsTheme] = useState<'gradient' | 'white'>('gradient');

  // Live Supabase synced states (fallback to local constants instantly)
  const [questions, setQuestions] = useState<ConsolidatedQuestion[]>(mainsConsolidatedQuestions);
  const [valueAddItems, setValueAddItems] = useState<ValueAdditionItem[]>(mainsConsolidatedValueAdd);

  // Load state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedQ = await AsyncStorage.getItem('mains_saved_questions');
        if (savedQ) setSavedQuestionIds(JSON.parse(savedQ));

        const savedTheme = await AsyncStorage.getItem('mains_theme');
        if (savedTheme === 'white') setMainsTheme('white');
      } catch (err) {
        console.error('Failed to load saved states:', err);
      }
    };
    
    const syncSupabaseData = async () => {
      try {
        const liveQuestions = await fetchMainsQuestionsFromSupabase();
        if (liveQuestions && liveQuestions.length > 0) {
          setQuestions(liveQuestions);
          console.log('[MainsScreen] Loaded live questions from Supabase:', liveQuestions.length);
        }
      } catch (err) {
        console.log('[MainsScreen] Failed to load live questions, using offline fallback:', err);
      }

      try {
        const liveValueAdd = await fetchValueAdditionFromSupabase();
        if (liveValueAdd && liveValueAdd.length > 0) {
          const merged = liveValueAdd.map(item => {
            if (item.category === 'ethics') {
              const cleanText = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
              const targetTitle = cleanText(item.title);
              const localMatch = mainsConsolidatedValueAdd.find(
                l => l.category === 'ethics' && cleanText(l.title) === targetTitle
              );
              if (localMatch) {
                const nextItem = { ...item };
                if (localMatch.diagramImagePath) {
                  nextItem.diagramImagePath = localMatch.diagramImagePath;
                }
                if (localMatch.ethicsData?.diagramsList) {
                  nextItem.ethicsData = {
                    ...nextItem.ethicsData,
                    diagramsList: localMatch.ethicsData.diagramsList
                  };
                }
                return nextItem;
              }
            }
            return item;
          });
          setValueAddItems(merged);
          console.log('[MainsScreen] Loaded live value additions from Supabase (with offline diagram falls):', liveValueAdd.length);
        }
      } catch (err) {
        console.log('[MainsScreen] Failed to load live value additions, using offline fallback:', err);
      }
    };

    loadState();
    syncSupabaseData();
  }, []);

  const toggleBookmark = async (id: string) => {
    try {
      const next = savedQuestionIds.includes(id)
        ? savedQuestionIds.filter(qId => qId !== id)
        : [...savedQuestionIds, id];
      setSavedQuestionIds(next);
      await AsyncStorage.setItem('mains_saved_questions', JSON.stringify(next));
    } catch (err) {
      console.error('Failed to save bookmark:', err);
    }
  };


  const toggleMainsTheme = async () => {
    try {
      const nextTheme = mainsTheme === 'gradient' ? 'white' : 'gradient';
      setMainsTheme(nextTheme);
      await AsyncStorage.setItem('mains_theme', nextTheme);
    } catch (err) {
      console.error('Failed to save mains theme:', err);
    }
  };

  const handleCopy = useCallback(async (id: string, text: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const Provider = PilotV2Provider as any;
  return (
    <Provider>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {!isDark && mainsTheme === 'gradient' && (
          <LinearGradient
            colors={['#e0f2fe', '#fef3c7', '#fce7f3', '#d1fae5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        <PanGestureHandler
          onHandlerStateChange={onGestureStateChange}
          activeOffsetX={[-20, 20]}
          failOffsetY={[-20, 20]}
        >
          <View style={styles.safeArea}>
          {currentScreen === 'hub' ? (
            <View style={[styles.header, { borderBottomWidth: 0, backgroundColor: 'transparent', paddingTop: insets.top, height: 64 + insets.top }]}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={[styles.backButton, { backgroundColor: colors.surface + '88', borderColor: colors.border }]}
              >
                <ChevronLeft size={20} color={colors.textPrimary} />
                <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Back</Text>
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>UPSC Mains</Text>
                <View style={styles.premiumBadge}>
                  <Sparkles size={11} color="#f59e0b" style={{ marginRight: 2 }} />
                  <Text style={styles.premiumText}>PREMIUM</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={toggleMainsTheme}
                style={[
                  styles.backButton,
                  {
                    backgroundColor: colors.surface + '88',
                    borderColor: colors.border,
                    paddingHorizontal: isTablet ? 10 : 12,
                    minWidth: isTablet ? undefined : 40,
                    height: 34,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }
                ]}
              >
                <Palette size={16} color={mainsTheme === 'gradient' ? colors.primary : colors.textSecondary} />
                {isTablet && (
                  <Text style={[styles.backButtonText, { color: mainsTheme === 'gradient' ? colors.primary : colors.textSecondary, marginLeft: 4 }]}>
                    {mainsTheme === 'gradient' ? 'Theme 1' : 'Theme 2'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (currentScreen !== 'detailed-question' && currentScreen !== 'revision-tags') ? (
            <TouchableOpacity
              onPress={() => {
                if (currentScreen === 'value-add' && valueAddCategory !== null) {
                  setTimeout(() => setValueAddCategory(null), 0);
                } else if (currentScreen === 'questions' && params.from === 'pyq') {
                  router.back();
                } else {
                  setCurrentScreen('hub');
                }
              }}
              style={[styles.floatingBackButton, { backgroundColor: colors.surface + 'b3', borderColor: colors.border, top: Math.max(insets.top, 12) }]}
            >
              <ChevronLeft size={20} color={colors.textPrimary} />
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>
                {currentScreen === 'value-add' && valueAddCategory !== null 
                  ? 'Back' 
                  : (currentScreen === 'questions' && params.from === 'pyq') ? 'Back' : 'Hub'}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* Screen Switching */}
          {currentScreen === 'hub' && (
            <HubView
              onSelect={setCurrentScreen}
              onSelectVaHub={() => {
                setValueAddCategory('va_hub');
                setCurrentScreen('value-add');
              }}
              colors={colors}
              isTablet={isTablet}
            />
          )}
          {currentScreen === 'questions' && (
          <QuestionBankView
              colors={colors}
              savedIds={savedQuestionIds}
              onToggleSaved={toggleBookmark}
              isTablet={isTablet}
              insets={insets}
              questions={questions}
              valueAddItems={valueAddItems}
              copiedId={copiedId}
              onCopy={handleCopy}
              onAddFlashcardClick={handleValueAddFlashcard}
              userTags={userTags}
              userQuestionStates={userQuestionStates}
              onOpenDetailed={(q) => {
                setPreviousScreen('questions');
                setDetailedQuestion(q);
                setCurrentScreen('detailed-question');
              }}
              onActiveQuestionChange={handleActiveQuestionChange}
              initialFilters={sessionFilters || initialFiltersFromParams}
              onFilterChange={setSessionFilters}
              valueAddTags={valueAddTags}
              onToggleValueAddTag={handleToggleValueAddTag}
              onCreateTag={handleCreateDetailedTag}
              vaFavorites={vaFavorites}
              onToggleVaFavorite={handleToggleVaFavorite}
            />
          )}
          {currentScreen === 'value-add' && (
            <ValueAdditionView
              colors={colors}
              copiedId={copiedId}
              onCopy={handleCopy}
              isTablet={isTablet}
              insets={insets}
              valueAddItems={valueAddItems}
              activeCategory={valueAddCategory}
              setActiveCategory={setValueAddCategory}
              onAddFlashcardClick={handleValueAddFlashcard}
              valueAddTags={valueAddTags}
              userTags={userTags}
              onToggleValueAddTag={handleToggleValueAddTag}
              onCreateTag={handleCreateDetailedTag}
              vaFavorites={vaFavorites}
              onToggleVaFavorite={handleToggleVaFavorite}
            />
          )}
          {currentScreen === 'revision-tags' && (
            <MainsTagsView
              colors={colors}
              isTablet={isTablet}
              insets={insets}
              onBack={() => setCurrentScreen('hub')}
              onOpenDetailed={(q) => {
                setPreviousScreen('questions');
                setDetailedQuestion(q as any);
              }}
              onOpenQuestionBank={() => {}}
              valueAddItems={valueAddItems}
              valueAddTags={valueAddTags}
              onToggleValueAddTag={handleToggleValueAddTag}
              onCreateTag={handleCreateDetailedTag}
              userTags={userTags}
              questions={questions}
              vaFavorites={vaFavorites}
              onToggleVaFavorite={handleToggleVaFavorite}
            />
          )}
          {currentScreen === 'search' && (
            <MainsAISearchView
              colors={colors}
              isTablet={isTablet}
              insets={insets}
              onToggleBookmark={toggleBookmark}
              savedQuestionIds={savedQuestionIds}
              onCopy={handleCopy}
              copiedId={copiedId}
              questions={questions}
              valueAddItems={valueAddItems}
              userTags={userTags}
              setUserTags={setUserTags}
              userQuestionStates={userQuestionStates}
              onOpenDetailed={(q) => {
                setPreviousScreen('search');
                setDetailedQuestion(q);
                setCurrentScreen('detailed-question');
              }}
              onActiveQuestionChange={handleActiveQuestionChange}
              onAddFlashcardClick={handleValueAddFlashcard}
              valueAddTags={valueAddTags}
              onToggleValueAddTag={handleToggleValueAddTag}
              onCreateTag={handleCreateDetailedTag}
              vaFavorites={vaFavorites}
              onToggleVaFavorite={handleToggleVaFavorite}
            />
          )}
          {currentScreen === 'detailed-question' && detailedQuestion && (
            <DetailedQuestionView
              question={detailedQuestion}
              onBack={() => {
                setCurrentScreen(previousScreen);
                setDetailedQuestion(null);
              }}
              colors={colors}
              isDark={isDark}
              isTablet={isTablet}
              insets={insets}
              savedIds={savedQuestionIds}
              onToggleSaved={toggleBookmark}
              userTags={userTags}
              onToggleTag={handleToggleDetailedTag}
              onCreateTag={handleCreateDetailedTag}
              isFlashcarded={flashcardedIds.has(detailedQuestion.id)}
              isSavingFlashcard={savingFlashcard[detailedQuestion.id] || false}
              onAddFlashcard={() => handleAddToFlashcards(detailedQuestion, detailedQuestion.answers?.[0]?.answerText, true)}
              studyTags={detailedStudyTags}
              confidence={detailedConfidence}
              onSetConfidence={handleSetConfidence}
              difficulty={detailedDifficulty}
              onSetDifficulty={handleSetDifficulty}
              onSaveToPilot={() => handleOpenPilot(detailedQuestion)}
              onOpenAIChat={(activeText, activeInstName, allAns) => handleOpenAIChat(detailedQuestion, activeText, activeInstName, allAns)}
              onOpenVitaminEditor={() => {
                setVitaminEditorContent(detailedBestAnswer?.answer_text || detailedQuestion.answers?.[0]?.answerText || '');
                setVitaminEditorVisible(true);
              }}
              detailedBestAnswer={detailedBestAnswer}
              onDeleteBestAnswer={handleDeleteBestAnswer}
              onActiveAnswerChange={handleDetailedQuestionActiveAnswerChange}
            />
          )}
        </View>
      </PanGestureHandler>

        <AddToFlashcardSheet
          visible={aff.visible}
          cardId={aff.cardId}
          onClose={() => setAff(prev => ({ ...prev, visible: false }))}
          userId={session?.user?.id || ''}
          hint={aff.hint}
          onPlaced={(deckId) => {
            if (detailedQuestion) {
              handleFlashcardPlaced(aff.cardId!, detailedQuestion.id);
            }
            setAff(prev => ({ ...prev, visible: false }));
          }}
        />

        <PilotV2AIChat
          isMains={true}
          activeQuestion={aiChatQuestion}
          externalOpenTrigger={aiChatTrigger}
          onSaveResponse={(text: string) => {
            if (!detailedQuestion) return;
            setPilotSaveTargetQuestion(detailedQuestion);
            setPilotSaveHtml(markdownToHtml(text || ''));
            setPilotV2SaveOpen(true);
          }}
          onOpenVitaminEditor={(text: string) => {
            if (!detailedQuestion) return;
            setVitaminEditorContent(text || '');
            setVitaminEditorVisible(true);
          }}
        />

        <PilotV2SaveSheet
          visible={pilotV2SaveOpen}
          userId={session?.user?.id || ''}
          onClose={() => {
            setPilotV2SaveOpen(false);
            setPilotSaveTargetQuestion(null);
            setPilotSaveHtml('');
          }}
          autoSeed={pilotSaveTargetQuestion ? {
            subject: pilotSaveTargetQuestion.subject || null,
            topic: pilotSaveTargetQuestion.sectionGroup || pilotSaveTargetQuestion.section_group || null,
            subtopic: pilotSaveTargetQuestion.microTopic || pilotSaveTargetQuestion.micro_topic || null,
            notebookTitle: pilotSaveTargetQuestion.microTopic || pilotSaveTargetQuestion.micro_topic || pilotSaveTargetQuestion.subject || null,
          } as any : undefined}
          seedQuestion={pilotSaveTargetQuestion || null}
          initialBody={pilotSaveHtml}
          source={pilotSaveTargetQuestion ? `Mains / ${pilotSaveTargetQuestion.subject || ''}`.trim() : 'Mains'}
        />

        <MyVitaminEditorSheet
          visible={vitaminEditorVisible}
          onClose={() => setVitaminEditorVisible(false)}
          onSave={async (content: string) => {
            if (!detailedQuestion) return;
            setSavingBest(true);
            try {
              const saved = await saveBestAnswer(detailedQuestion.id, content, null, null);
              if (saved) {
                setDetailedBestAnswer(saved);
                if (Platform.OS === 'android') {
                  (global as any).ToastAndroid?.show('My Vitamin saved!', (global as any).ToastAndroid?.SHORT);
                } else {
                  Alert.alert('Saved', 'My Vitamin saved successfully.');
                }
              }
            } catch (e: any) {
              Alert.alert('Save failed', e?.message || 'Could not save My Vitamin.');
            } finally {
              setSavingBest(false);
              setVitaminEditorVisible(false);
            }
          }}
          initialContent={vitaminEditorContent}
          questionText={detailedQuestion?.questionText || ''}
          seedQuestion={detailedQuestion}
        />
      </View>
    </Provider>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// 1. DASHBOARD / HUB VIEW (Figma: Master UPSC Mains)
// ─────────────────────────────────────────────────────────────────────────────
function HubView({
  onSelect,
  onSelectVaHub,
  colors,
  isTablet,
}: {
  onSelect: (s: any) => void;
  onSelectVaHub?: () => void;
  colors: any;
  isTablet: boolean;
}) {
  const router = useRouter();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();

  const primaryCards = [
    {
      id: 'questions',
      title: 'Question Bank',
      description: 'Official PYQs & model answers',
      color: '#3b82f6',
      icon: Library,
    },
    {
      id: 'va-hub',
      title: 'VA Hub',
      description: 'Consolidated value additions hub',
      color: '#7c3aed',
      icon: Zap,
    },
    {
      id: 'value-add',
      title: 'Value Addition',
      description: 'Ready-made answer enhancement tools',
      color: '#f59e0b',
      icon: Sparkles,
    },
    {
      id: 'syllabus',
      title: 'Syllabus',
      description: 'Interactive UPSC syllabus explorer',
      color: '#10b981',
      icon: Map,
    },
    {
      id: 'pyq-trends',
      title: 'PYQ Analysis',
      description: 'Trend analysis of previous year questions',
      color: '#8b5cf6',
      icon: BarChart3,
    },
    {
      id: 'revision-tags',
      title: 'Revision Tags',
      description: 'Tag & track questions for revision',
      color: '#ec4899',
      icon: Tag,
    },
  ];

  const recentTopics = [
    'Federalism',
    'Parliament',
    'Pressure Groups',
    'Judiciary',
    'Local Government',
  ];

  return (
    <ScrollView contentContainerStyle={styles.hubScroll} showsVerticalScrollIndicator={false}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Text style={[styles.heroHeading, { color: colors.textPrimary }]}>
          Master UPSC Mains
        </Text>
        <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
          Everything required for answer writing in one place.
        </Text>

        {/* Large Figma Search Input */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => onSelect('search')}
          style={[
            styles.largeSearchInput, 
            { 
              backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(30, 41, 59, 0.7)', 
              borderColor: !isDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.15)',
              height: isTablet ? 64 : 54,
              borderRadius: isTablet ? 32 : 27,
            }
          ]}
        >
          <Search size={isTablet ? 22 : 18} color="#94a3b8" style={{ marginRight: 10 }} />
          <TextInput
            placeholder="Search questions, topics, quotes..."
            placeholderTextColor="#94a3b8"
            style={[styles.largeSearchText, { color: colors.textPrimary }]}
            editable={false}
            pointerEvents="none"
          />
        </TouchableOpacity>
      </View>

      {/* Spacious Cards Grid */}
      <View style={styles.cardsGrid}>
        {primaryCards.map(card => {
          const Icon = card.icon;
          return (
            <TouchableOpacity
              key={card.id}
              activeOpacity={0.8}
              onPress={() => {
                if (card.id === 'pyq-trends') {
                  router.push({
                    pathname: '/pyq',
                    params: { fromTab: 'mains' }
                  });
                } else if (card.id === 'syllabus') {
                  router.push({
                    pathname: '/tracker',
                    params: { defaultMode: 'mains' }
                  });
                } else if (card.id === 'va-hub') {
                  onSelectVaHub?.();
                } else {
                  onSelect(card.id as any);
                }
              }}
              style={[
                styles.figmaCard,
                { 
                  backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(30, 41, 59, 0.55)', 
                  borderColor: !isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                  width: isTablet ? '48%' : (width - 52) / 2,
                  padding: isTablet ? 24 : 14,
                }
              ]}
            >
              <View style={styles.cardContentLayoutVertical}>
                <View style={[
                  styles.figmaIconBox, 
                  { 
                    backgroundColor: card.color,
                    width: isTablet ? 64 : 48,
                    height: isTablet ? 64 : 48,
                  }
                ]}>
                  <Icon size={isTablet ? 30 : 22} color="#ffffff" />
                </View>
                <View style={styles.cardTextContainerVertical}>
                  <Text style={[
                    styles.figmaCardTitle, 
                    { 
                      color: colors.textPrimary,
                      fontSize: isTablet ? 18 : 13.5,
                      marginTop: 4,
                    }
                  ]}>
                    {card.title}
                  </Text>
                  <Text style={[
                    styles.figmaCardDesc, 
                    { 
                      color: colors.textSecondary,
                      fontSize: isTablet ? 12 : 9.5,
                      lineHeight: isTablet ? 16 : 12,
                    }
                  ]}>
                    {card.description}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Recent Topics */}
      <View style={styles.recentTopicsContainer}>
        <Text style={[styles.recentTitle, { color: colors.textSecondary, textAlign: 'center' }]}>Recent Topics</Text>
        <View style={styles.topicsRowCentered}>
          {recentTopics.map(topic => (
            <TouchableOpacity
              key={topic}
              style={[
                styles.topicChip, 
                { 
                  backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(30, 41, 59, 0.55)', 
                  borderColor: !isDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.15)' 
                }
              ]}
            >
              <Text style={[styles.topicChipText, { color: colors.textSecondary, fontSize: isTablet ? 13 : 11 }]}>{topic}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. QUESTION BANK VIEW
// ─────────────────────────────────────────────────────────────────────────────
// Helper functions for Markdown Answer rendering
const cleanMarkdown = (text: string) => {
  if (!text) return '';
  const r2BaseUrl = 'https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev';
  
  // Clean all HTML entities, standard markdown images, bullet points and bold/italics
  let cleaned = cleanMarkdownContent(text);
  
  // Replace relative Markdown images to point to R2 Bucket
  cleaned = cleaned.replace(/!\[(.*?)\]\(((?!https?:\/\/|data:)[^\)]+)\)/gi, (match, alt, path) => {
    let cleanPath = path.trim();
    if (cleanPath.startsWith('/')) {
      cleanPath = cleanPath.substring(1);
    }
    return `![${alt}](${r2BaseUrl}/${cleanPath})`;
  });

  return cleaned;
};

// Helper to clean and build image URIs for R2 bucket
export const getDiagramUri = (path: string | undefined | null): string => {
  if (!path) return '';
  const r2BaseUrl = 'https://pub-cfb8b9095d7d4914990dbb6f73afeb92.r2.dev';
  let cleanPath = path.trim();
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://') || cleanPath.startsWith('data:')) {
    return cleanPath;
  }
  if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.substring(1);
  }
  return `${r2BaseUrl}/${cleanPath}`;
};

/**
 * Strip <br> tags from ALL table rows (lines starting with |) and merge
 * any continuation lines that don't end with |.  This must run BEFORE
 * the global <br> → \n replacement so that cells like
 *   | Technology<br>requirement | … |
 * don't get split into multiple rows.
 */
const preProcessMarkdownTables = (text: string): string => {
  if (!text) return '';
  const lines = text.split(/\r?\n/);
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const trimmed = line.trim();

    // Detect table row: starts with | (or separator like |---|)
    const isTableRow =
      trimmed.startsWith('|') ||
      (i > 0 && result[result.length - 1]?.trim().startsWith('|') && trimmed.includes('|'));

    if (isTableRow) {
      // Strip ALL <br> tags in this line → replace with a single space
      line = line.replace(/<br\s*\/?>/gi, ' ');

      // If the row doesn't close with |, merge subsequent continuation lines
      if (!line.trim().endsWith('|')) {
        while (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextTrimmed = nextLine.trim();

          // Stop at a separator row or a row that is already complete
          if (
            nextTrimmed.startsWith('|') &&
            (nextTrimmed.match(/^\|[\s\-:]+\|/) || nextTrimmed.endsWith('|'))
          ) {
            break;
          }

          const cleanedNext = nextTrimmed.replace(/<br\s*\/?>/gi, ' ');
          line = line.trimEnd() + ' ' + cleanedNext;
          i++;

          if (cleanedNext.endsWith('|')) break;
        }
      }
    }

    result.push(line);
  }
  return result.join('\n');
};

const getQuestionTaxonomy = (q: any): string[] => {
  if (Array.isArray(q.hierarchy_path) && q.hierarchy_path.length > 0) {
    return q.hierarchy_path.filter((p: any) => p && p !== 'Unknown' && p !== 'undefined' && p !== 'null');
  }
  const path: string[] = [];
  if (q.paper) path.push(q.paper);
  if (q.subject) path.push(q.subject);
  if (q.sectionGroup) path.push(q.sectionGroup);
  if (q.microTopic) path.push(q.microTopic);
  if (q.subTopic) path.push(q.subTopic);
  if (q.nanoTopic) path.push(q.nanoTopic);
  return path.filter((p: any) => p && p !== 'Unknown' && p !== 'undefined' && p !== 'null');
};

const renderTaxonomyStrip = (q: any, colors: any, isDark: boolean) => {
  const levels = getQuestionTaxonomy(q);
  if (levels.length === 0) return null;

  return (
    <View style={{
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Layers size={13} color={colors.textSecondary} />
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 }}>
          TAXONOMY HIERARCHY
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
        {levels.map((lvl, index) => {
          const colorsList = [
            { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }, // Paper (blue)
            { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6' }, // Subject (purple)
            { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }, // Section Group (amber)
            { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' }, // Micro Topic (green)
            { bg: '#ecfeff', border: '#a5f3fc', text: '#075985' }, // Sub Topic (cyan)
            { bg: '#fff5f5', border: '#fed7d7', text: '#9b1c1c' }, // Nano Topic (red)
          ];
          const style = colorsList[Math.min(index, colorsList.length - 1)];
          
          return (
            <React.Fragment key={lvl}>
              {index > 0 && (
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginHorizontal: 2 }}>&gt;</Text>
              )}
              <View style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : style.bg,
                borderColor: isDark ? 'rgba(255,255,255,0.15)' : style.border,
                borderWidth: 1,
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: isDark ? colors.textPrimary : style.text,
                }}>
                  {lvl}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
};

export const cleanMarkdownContent = (text: string | undefined | null): string => {
  if (!text) return '';
  let cleaned = preProcessMarkdownTables(text);

  // Convert HTML img tags to Markdown image syntax (react-native-markdown-display compatible)
  cleaned = cleaned.replace(/<img([\s\S]*?)src=["']([^"']+)["']([\s\S]*?)\/?>/gi, (match, before, src, after) => {
    const altMatch = /alt=["']([^"']+)["']/i.exec(before) || /alt=["']([^"']+)["']/i.exec(after);
    const alt = altMatch ? altMatch[1] : 'Diagram';
    return `\n\n![${alt}](${src})\n\n`;
  });

  // Strip align wrappers around standard markdown/converted markdown images
  cleaned = cleaned.replace(/<p\s+align=["']center["']>\s*(!\[[^\]]*\]\([^)]+\))\s*<\/p>/gi, '\n\n$1\n\n');
  cleaned = cleaned.replace(/<p[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/p>/gi, '\n');

  // 0. Strip leading empty bullet points (Issue 3 fix)
  cleaned = cleaned.replace(/^\s*[-*•]\s*$/gm, '');

  // Replace HTML entities
  cleaned = cleaned.replace(/&nbsp;/gi, ' ');
  cleaned = cleaned.replace(/&rarr;/gi, '→');
  cleaned = cleaned.replace(/&rupee;/gi, '₹');
  cleaned = cleaned.replace(/&amp;/gi, '&');
  cleaned = cleaned.replace(/&lt;/gi, '<');
  cleaned = cleaned.replace(/&gt;/gi, '>');
  cleaned = cleaned.replace(/&quot;/gi, '"');
  cleaned = cleaned.replace(/&#39;/gi, "'");

  // Replace br tags
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');

  // Replace bold tags
  cleaned = cleaned.replace(/<\/?b>/gi, '**');
  cleaned = cleaned.replace(/<\/?strong>/gi, '**');

  // Replace underline/italic tags
  cleaned = cleaned.replace(/<\/?u>/gi, '');
  cleaned = cleaned.replace(/<\/?i>/gi, '*');
  cleaned = cleaned.replace(/<\/?em>/gi, '*');

  // Normalize consecutive asterisks (e.g., **** -> **)
  cleaned = cleaned.replace(/\*{3,}/g, '**');

  // Normalize leading horizontal spaces/&nbsp; to prevent markdown indented code block parsing (symmetric to cleanDataFactsMarkdown)
  cleaned = cleaned.replace(/^(?:[ \t]|&nbsp;){8,}/gm, '    ');
  cleaned = cleaned.replace(/^(?:[ \t]|&nbsp;){4,7}/gm, '  ');

  // Collapse spaces between lists (Issue 3 & 4 fix)
  cleaned = cleaned.replace(/\n{2,}(\s*)(?=[-*•\d])/g, '\n$1');

  return cleaned.trim();
};

const getCleanAvailableAnswers = (answers: any[]) => {
  const seen = new Set<string>();
  return (answers || []).filter(ans => {
    if (!ans.institute) return false;
    const name = ans.institute.trim().toLowerCase();
    if (seen.has(name)) return false;
    
    // Check if the answer text is valid/available
    const text = ans.answerText || ans.answer_text || '';
    const lower = text.toLowerCase();
    if (!text.trim() || lower.includes('not covered') || lower.includes('no answer compiled') || lower.includes('no answer text available')) {
      return false;
    }
    
    seen.add(name);
    return true;
  });
};
const splitSubThemes = (text: string | undefined | null) => {
  if (!text) return [];
  const parts = text.split(/<!--\s*Sub-Theme:\s*([^-]+?)\s*-->/i);
  const subThemes: { title: string; content: string }[] = [];

  const firstPreamble = parts[0]?.trim();
  if (firstPreamble && parts.length > 1) {
    subThemes.push({ title: '', content: firstPreamble });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    let content = parts[i + 1] || '';
    // Strip duplicate leading title
    const titleEscaped = title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^(?:<br\\s*/?>|\\s)*(?:[•-]\\s*)?(?:<b><u>|<u><b>|\\*\\*|<b>|<u>)?(${titleEscaped})(?:</u></b>|</b></u>|\\*\\*|</b>|</u>)?(?:<br\\s*/?>|\\s)*`, 'i');
    content = content.replace(regex, '');
    subThemes.push({ title, content });
  }

  if (subThemes.length === 0 && text) {
    subThemes.push({ title: '', content: text });
  }
  return subThemes;
};

const splitSubSubThemes = (text: string | undefined | null): string[] => {
  if (!text) return [];
  const matches = text.matchAll(/<!--\s*Sub-Sub-Theme:\s*([^-]+?)\s*-->/gi);
  const titles: string[] = [];
  for (const match of matches) {
    if (match[1]) {
      titles.push(match[1].trim());
    }
  }
  return Array.from(new Set(titles)).filter(Boolean);
};

const splitSubSubThemeBlocks = (text: string | undefined | null) => {
  if (!text) return [];
  const parts = text.split(/<!--\s*Sub-Sub-Theme:\s*([^-]+?)\s*-->/i);
  const blocks: { title: string; content: string }[] = [];

  const firstPreamble = parts[0]?.trim();
  if (firstPreamble && parts.length > 1) {
    blocks.push({ title: '', content: firstPreamble });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    let content = parts[i + 1] || '';
    // Strip duplicate leading sub-sub-theme title
    const titleEscaped = title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`^(?:<br\\s*/?>|\\s)*(?:[•-]\\s*)?(?:<b><u>|<u><b>|\\*\\*|<b>|<u>)?(${titleEscaped})(?:</u></b>|</b></u>|\\*\\*|</b>|</u>)?(?:<br\\s*/?>|\\s)*`, 'i');
    content = content.replace(regex, '');
    blocks.push({ title, content });
  }

  if (blocks.length === 0 && text) {
    blocks.push({ title: '', content: text });
  }
  return blocks;
};

const getFrameworkPaths = (item: any): any[] => {
  const paths: any[] = [];
  if (Array.isArray(item.hierarchies)) {
    item.hierarchies.forEach((h: any) => {
      if (h) {
        paths.push({
          paper: h.paper || '',
          subject: h.subject || '',
          sectionGroup: h.sectionGroup || h.section_group || '',
          microtopic: h.microtopic || '',
          subtopic: h.subtopic || ''
        });
      }
    });
  }
  for (let idx = 1; idx <= 5; idx++) {
    const path = item[`hierarchy_${idx}_path`];
    if (path && Array.isArray(path) && path.length > 0) {
      paths.push({
        paper: path[0] || '',
        subject: path[1] || '',
        sectionGroup: path[2] || '',
        microtopic: path[3] || '',
        subtopic: path[4] || ''
      });
    }
  }
  return paths;
};

const getItemPaths = (item: any): any[] => {
  if (item.category === 'frameworks') {
    return getFrameworkPaths(item);
  }
  return [{
    paper: item.paper || '',
    subject: item.subject || '',
    sectionGroup: item.sectionGroup || '',
    microtopic: item.microtopic || (Array.isArray(item.hierarchy_path) && item.hierarchy_path.length >= 4 ? item.hierarchy_path[3] : ''),
    subtopic: item.subtopic || (Array.isArray(item.hierarchy_path) && item.hierarchy_path.length >= 5 ? item.hierarchy_path[4] : ''),
    nanotopic: item.nanotopic || item.nanoTopic || item.nano_topic || (Array.isArray(item.hierarchy_path) && item.hierarchy_path.length >= 6 ? item.hierarchy_path[5] : '')
  }];
};


const getFilteredContext = (item: any, searchWord: string, subThemeFilter: string, subSubThemeFilter: string) => {
  const activeSubThemes = subThemeFilter && subThemeFilter !== 'All' ? subThemeFilter.split('|') : [];
  const activeSubSubThemes = subSubThemeFilter && subSubThemeFilter !== 'All' ? subSubThemeFilter.split('|') : [];
  
  if (!searchWord && activeSubThemes.length === 0 && activeSubSubThemes.length === 0) {
    return item.cleanedFullContext || cleanDataFactsMarkdown(item.context, item);
  }
  
  const subThemes = item.parsedSubThemes || splitSubThemes(item.context);
  const matchedSubThemes = subThemes.filter((st: any) => {
    const matchSearchWord = !searchWord || 
      st.title.toLowerCase().includes(searchWord.toLowerCase()) ||
      st.content.toLowerCase().includes(searchWord.toLowerCase());
      
    const matchSubThemeFilter = activeSubThemes.length === 0 || activeSubThemes.includes(st.title);
    
    const matchSubSubThemeFilter = activeSubSubThemes.length === 0 || 
      splitSubSubThemes(st.content).some(sst => activeSubSubThemes.includes(sst));
    
    return matchSearchWord && matchSubThemeFilter && matchSubSubThemeFilter;
  });
  
  if (matchedSubThemes.length === 0) return '';
  
  return matchedSubThemes.map((st: any) => {
    let contentToClean = st.content;
    if (activeSubSubThemes.length > 0 || searchWord) {
      const sstBlocks = splitSubSubThemeBlocks(st.content);
      const matchedSstBlocks = sstBlocks.filter(sst => {
        const matchSearch = !searchWord || 
          sst.title.toLowerCase().includes(searchWord.toLowerCase()) ||
          sst.content.toLowerCase().includes(searchWord.toLowerCase());
        const matchFilter = activeSubSubThemes.length === 0 || activeSubSubThemes.includes(sst.title);
        return matchSearch && matchFilter;
      });
      if (matchedSstBlocks.length > 0) {
        contentToClean = matchedSstBlocks.map(sst => {
          if (!sst.title) return sst.content;
          return `<!-- Sub-Sub-Theme: ${sst.title} -->\n${sst.content}`;
        }).join('\n\n');
      } else {
        return '';
      }
    }

    if (!st.title) return cleanDataFactsMarkdown(contentToClean, item);
    return cleanDataFactsMarkdown(`<!-- Sub-Theme: ${st.title} -->\n${contentToClean}`, item);
  }).filter(Boolean).join('\n\n');
};

const getUniqueValueAddItems = (items: any[]): any[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const fingerprint = [
      item.category,
      item.title || '',
      item.context || '',
      item.introduction || '',
      item.conclusion || '',
      item.quoteText || '',
      item.mnemonicKeyword || ''
    ].join('||');
    if (seen.has(fingerprint)) {
      return false;
    }
    seen.add(fingerprint);
    return true;
  });
};

export const parseIntroductoryBox = (rawText: string | undefined | null) => {
  if (!rawText) return null;
  const tableRegex = /^\s*(\|\s*[^\n]*\|\s*(?:\r?\n\s*\|\s*---+\s*\|)?(?:\r?\n\s*\|\s*[^\n]*\|\s*)*)/i;
  const match = rawText.match(tableRegex);
  if (!match) {
    return null;
  }
  
  const fullTableText = match[1];
  
  // Parse rows of the table
  const lines = fullTableText.split(/\r?\n/);
  const cellTexts: string[] = [];
  
  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) return;
    
    // Ignore separator row (e.g. | --- |)
    if (/^\|\s*:-*-*:?\s*(?:\|\s*:-*-*:?\s*)*\|$/.test(trimmed) || /^\|\s*---+\s*\|$/.test(trimmed)) {
      return;
    }
    
    // Extract cell contents by splitting by '|' and filtering out empty elements
    const cells = trimmed.split('|')
      .map(c => c.trim())
      .filter((c, idx, arr) => idx > 0 && idx < arr.length - 1); // remove outer empty elements
      
    if (cells.length > 0) {
      cellTexts.push(cells.join(' '));
    }
  });
  
  if (cellTexts.length === 0) return null;
  
  // Combine cell texts. If there are multiple rows, we can join them with newlines
  const combinedContent = cellTexts.join('\n');
  
  // Extract title and body from the combined content
  // Look for bold text at the beginning of the combined content
  const headerRegex = /^\s*(?:\*\*|__)?\s*([^*:\n]+?)\s*(?:\*\*|__)?\s*:\s*(?:<br\s*\/?>|\n)?\s*([\s\S]*)$/i;
  let title = 'APPROACH';
  let body = combinedContent;
  
  const headerMatch = combinedContent.match(headerRegex);
  if (headerMatch) {
    title = headerMatch[1].trim().toUpperCase();
    body = headerMatch[2].trim();
  } else {
    // If no colon separator, check if it starts with a bold header followed by <br> or newline
    const boldHeaderRegex = /^\s*(?:\*\*|__)\s*([^\n*]+?)\s*(?:\*\*|__)\s*(?:<br\s*\/?>|\n)\s*([\s\S]*)$/i;
    const boldMatch = combinedContent.match(boldHeaderRegex);
    if (boldMatch) {
      title = boldMatch[1].trim().toUpperCase();
      body = boldMatch[2].trim();
    }
  }
  
  // Clean up body (e.g. remove leading/trailing <br> or newlines)
  body = body.replace(/^(?:<br\s*\/?>|\s)+/gi, '').replace(/(?:<br\s*\/?>|\s)+$/gi, '').trim();
  
  return {
    rawMatch: fullTableText,
    title,
    body,
  };
};

export const cleanDataFactsMarkdown = (text: string | undefined | null, item: any): string => {
  if (!text) return '';
  let cleaned = text;

  // 0. Clean up single-column table borders (Issue 3 fix)
  cleaned = cleaned.replace(/^(\s*(?:[-*•]\s*)?)\|\s*([^|\r\n]*?)\s*\|\s*$/gm, '$1$2');

  // 1. Remove HTML theme comments
  cleaned = cleaned.replace(/<!--\s*Theme:\s*(.*?)\s*-->/gi, '');

  // 2. Replace Sub-Theme comment + title pattern with markdown heading 3
  cleaned = cleaned.replace(/<!--\s*Sub-Theme:\s*(.*?)\s*-->(?:\s*<br\s*\/?>)*\s*(?:•\s*)?(?:<b><u>|\*\*|<u><b>)?[^\n<]*(?:<\/u><\/b>|<\/b><\/u>|\*\*|<\/b>|<\/u>)?(?:\s*<br\s*\/?>)*/gi, '\n\n### $1\n\n');

  // 2.1 Replace Sub-Sub-Theme comment + title pattern with markdown heading 4 (purple)
  cleaned = cleaned.replace(/<!--\s*Sub-Sub-Theme:\s*(.*?)\s*-->(?:\s*<br\s*\/?>)*\s*(?:•\s*)?(?:<b><u>|\*\*|<u><b>)?[^\n<]*(?:<\/u><\/b>|<\/b><\/u>|\*\*|<\/b>|<\/u>)?(?:\s*<br\s*\/?>)*/gi, '\n\n#### $1\n\n');

  // 3. Fallback: replace any remaining Sub-Theme comments
  cleaned = cleaned.replace(/<!--\s*Sub-Theme:\s*(.*?)\s*-->/gi, '\n\n### $1\n\n');

  // 3.1 Fallback: replace any remaining Sub-Sub-Theme comments
  cleaned = cleaned.replace(/<!--\s*Sub-Sub-Theme:\s*(.*?)\s*-->/gi, '\n\n#### $1\n\n');

  // 4. Replace <br> tags with \n
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');

  // 5. Replace 12 or more horizontal spaces/&nbsp; with 4 spaces and a bullet (nested level 2 list item)
  cleaned = cleaned.replace(/^(?:[ \t]|&nbsp;){12,}\s*-\s*/gm, '    - ');

  // 6. Replace 8 or more horizontal spaces/&nbsp; with a bullet (level 1 list item under the sub-theme heading)
  cleaned = cleaned.replace(/^(?:[ \t]|&nbsp;){8,11}\s*-\s*/gm, '- ');

  // 6.1 Normalize leading horizontal spaces/&nbsp; to prevent markdown indented code block parsing
  cleaned = cleaned.replace(/^(?:[ \t]|&nbsp;){8,}/gm, '    ');
  cleaned = cleaned.replace(/^(?:[ \t]|&nbsp;){4,7}/gm, '  ');

  // 7. Replace any other remaining &nbsp; with spaces
  cleaned = cleaned.replace(/&nbsp;/gi, ' ');

  // 8. Replace other HTML entities
  cleaned = cleaned.replace(/&rarr;/gi, '→');
  cleaned = cleaned.replace(/&rupee;/gi, '₹');
  cleaned = cleaned.replace(/&amp;/gi, '&');
  cleaned = cleaned.replace(/&lt;/gi, '<');
  cleaned = cleaned.replace(/&gt;/gi, '>');
  cleaned = cleaned.replace(/&quot;/gi, '"');
  cleaned = cleaned.replace(/&#39;/gi, "'");

  // 9. Replace bold tags
  cleaned = cleaned.replace(/<\/?b>/gi, '**');
  cleaned = cleaned.replace(/<\/?strong>/gi, '**');

  // 10. Replace underline/italic tags
  cleaned = cleaned.replace(/<\/?u>/gi, '');
  cleaned = cleaned.replace(/<\/?i>/gi, '*');
  cleaned = cleaned.replace(/<\/?em>/gi, '*');

  // 11. Normalize consecutive asterisks
  cleaned = cleaned.replace(/\*{3,}/g, '**');

  // 12. Strip starting theme title if matches item.metric
  const metricEscaped = item?.metric ? item.metric.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : '';
  if (metricEscaped) {
    const themeRegex = new RegExp(`^\\s*(?:<b><u>|\\*\\*|<u><b>|#\\s+)?` + metricEscaped + `(?:</u></b>|\\*\\*|</b></u>)?\\s*`, 'i');
    cleaned = cleaned.replace(themeRegex, '');
  }

  return cleaned.trim();
};

interface MarkdownSection {
  heading: string;
  content: string;
}

const parseMarkdownToSections = (text: string | undefined | null): MarkdownSection[] => {
  if (!text) return [];
  const sections: MarkdownSection[] = [];
  const regex = /(?:^|\n)(?:\*\s*)?\*\*([^*]+?):\*\*/g;
  
  let match;
  let lastIndex = 0;
  let currentHeading = '';
  
  while ((match = regex.exec(text)) !== null) {
    if (lastIndex > 0 || currentHeading) {
      const content = text.slice(lastIndex, match.index).trim();
      if (content || currentHeading) {
        sections.push({ heading: currentHeading || 'General', content });
      }
    }
    currentHeading = match[1].trim();
    lastIndex = regex.lastIndex;
  }
  
  const content = text.slice(lastIndex).trim();
  if (content || currentHeading) {
    sections.push({ heading: currentHeading || 'General', content });
  }
  
  return sections;
};

const getThemeForHeading = (heading: string, colors: any) => {
  const h = heading.toLowerCase();
  if (h.includes('quote')) {
    return {
      textColor: '#d97706',
      bgColor: 'rgba(251, 191, 36, 0.08)',
      borderColor: '#fef3c7',
      label: 'QUOTE'
    };
  }
  if (h.includes('intro') || h.includes('concept')) {
    return {
      textColor: '#1d4ed8',
      bgColor: 'rgba(59, 130, 246, 0.08)',
      borderColor: '#dbeafe',
      label: 'INTRODUCTION'
    };
  }
  if (h.includes('example') || h.includes('practice') || h.includes('case study') || h.includes('case studies')) {
    return {
      textColor: '#7c3aed',
      bgColor: 'rgba(139, 92, 246, 0.08)',
      borderColor: '#ddd6fe',
      label: 'EXAMPLES / CASE STUDIES'
    };
  }
  if (h.includes('conclusion') || h.includes('way forward')) {
    return {
      textColor: '#047857',
      bgColor: 'rgba(16, 185, 129, 0.08)',
      borderColor: '#d1fae5',
      label: 'CONCLUSION'
    };
  }
  if (h.includes('data') || h.includes('fact')) {
    return {
      textColor: '#0d9488',
      bgColor: 'rgba(20, 184, 166, 0.08)',
      borderColor: '#ccfbf1',
      label: 'DATA & FACTS'
    };
  }
  return {
    textColor: '#475569',
    bgColor: 'rgba(100, 116, 139, 0.08)',
    borderColor: '#e2e8f0',
    label: heading.toUpperCase()
  };
};

export function ValueAddCardBody({
  item,
  colors,
  ethicsTab,
  templateFilter,
  onAddFlashcardClick,
  zoomScale,
  onImagePress
}: {
  item: any;
  colors: any;
  ethicsTab?: string;
  templateFilter?: string;
  onAddFlashcardClick?: (front: string, back: string) => void;
  zoomScale?: number;
  onImagePress?: (uri: string) => void;
}) {
  const scale = zoomScale || 1.0;

  return (
    <View style={styles.vCardBody}>
      {item.category === 'data_facts' && (
        <MainsDataFactsCard
          item={item}
          colors={colors}
          filters={DEFAULT_MAINS_FILTERS}
          search=""
          zoomScale={scale}
        />
      )}

      {item.category === 'intro_conclusion' && (
        <MainsIntroConclusionCard
          item={item}
          colors={colors}
          templateFilter={templateFilter || 'All'}
          zoomScale={scale}
          onImagePress={onImagePress}
        />
      )}

      {item.category === 'quotes' && (
        <MainsQuotesCard
          item={item}
          colors={colors}
          zoomScale={scale}
        />
      )}

      {item.category === 'mnemonics' && (
        <MainsMnemonicsCard
          item={item}
          colors={colors}
          zoomScale={scale}
        />
      )}

      {item.category === 'frameworks' && (
        <MainsFrameworksCard
          item={item}
          colors={colors}
          zoomScale={scale}
          onImagePress={onImagePress}
        />
      )}

      {item.category === 'ethics' && (
        <MainsEthicsCard
          item={item}
          colors={colors}
          ethicsTab={ethicsTab || item.ethicsType || 'diagrams'}
          zoomScale={scale}
          onImagePress={onImagePress}
        />
      )}

      {(item.category === 'keywords_hub' || item.category === 'case_studies_hub' || item.category === 'sc_judgments_hub') && (
        <MainsEthicsCard
          item={item}
          colors={colors}
          ethicsTab="keywords"
          zoomScale={scale}
          onImagePress={onImagePress}
        />
      )}
    </View>
  );
}



export const ValueAdditionCard = React.memo(function ValueAdditionCard({
  item,
  colors,
  isDark,
  copiedId,
  onCopy,
  width = '100%',
  ethicsTab,
  forceExpandCollapse = null,
  onAddFlashcardClick,
  templateFilter,
  zoomScale,
  activeCategory,
  onImagePress,
  initialCollapsed = true,
  userTags,
  valueAddTags,
  onToggleValueAddTag,
  onCreateTag,
  vaFavorites,
  onToggleVaFavorite,
}: {
  item: any;
  colors: any;
  isDark: boolean;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  width?: string | number;
  ethicsTab?: string;
  forceExpandCollapse?: 'expand' | 'collapse' | null;
  onAddFlashcardClick?: (item: any, front: string, back: string) => void;
  templateFilter?: string;
  zoomScale?: number;
  activeCategory?: string | null;
  onImagePress?: (uri: string) => void;
  initialCollapsed?: boolean;
  userTags?: string[];
  valueAddTags?: Record<string, string[]>;
  onToggleValueAddTag?: (cardId: string, tag: string) => void;
  onCreateTag?: (tag: string) => void;
  vaFavorites?: Set<string>;
  onToggleVaFavorite?: (cardId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed ?? true);
  const [showTagsSelector, setShowTagsSelector] = useState(false);
  const isCopied = copiedId === item.id;

  useEffect(() => {
    if (forceExpandCollapse === 'expand') {
      setCollapsed(false);
    } else if (forceExpandCollapse === 'collapse') {
      setCollapsed(true);
    }
  }, [forceExpandCollapse]);

  const submodules = [
    { id: 'data_facts', title: 'Data & Facts', color: '#3b82f6' },
    { id: 'intro_conclusion', title: 'Intro & Conclusion', color: '#10b981' },
    { id: 'quotes', title: 'Quotes & Anecdotes', color: '#8b5cf6' },
    { id: 'mnemonics', title: 'Mnemonics', color: '#f59e0b' },
    { id: 'frameworks', title: 'Frameworks', color: '#f43f5e' },
    { id: 'ethics', title: 'Ethics Specific Hub', color: '#06b6d4' },
    { id: 'keywords_hub', title: 'Keywords', color: '#ec4899' },
    { id: 'case_studies_hub', title: 'Case Studies', color: '#f97316' },
    { id: 'sc_judgments_hub', title: 'SC Judgments', color: '#ef4444' },
    { id: 'va_hub', title: 'VA Hub', color: '#7c3aed' },
  ];
  const categoryTitle = submodules.find(s => s.id === item.category)?.title || item.category;

  return (
    <View
      style={[
        styles.figmaQuestionCard,
        {
          backgroundColor: isDark ? 'rgba(30, 41, 59, 0.65)' : 'rgba(255, 255, 255, 0.65)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.85)',
          marginBottom: 12,
          width: width as any,
        }
      ]}
    >
      <View style={styles.vCardHeader}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => setCollapsed(!collapsed)}
          style={{ flex: 1, marginRight: 8 }}
        >
          {activeCategory === 'va_hub' && (
            <View style={{
              alignSelf: 'flex-start',
              backgroundColor: (submodules.find(s => s.id === item.category)?.color || colors.primary) + '22',
              borderColor: (submodules.find(s => s.id === item.category)?.color || colors.primary) + '55',
              borderWidth: 0.5,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderRadius: 4,
              marginBottom: 6
            }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: submodules.find(s => s.id === item.category)?.color || colors.primary }}>
                {(submodules.find(s => s.id === item.category)?.title || item.category).toUpperCase()}
              </Text>
            </View>
          )}
          <Text
            style={[
              styles.vCardFigmaTitle,
              item.category === 'data_facts'
                ? { color: '#ef4444', fontSize: 18, fontWeight: '800' }
                : { color: colors.textPrimary }
            ]}
          >
            {item.category === 'data_facts' ? item.metric : item.title}
          </Text>
          {item.source && item.category !== 'data_facts' && item.category !== 'intro_conclusion' && item.category !== 'quotes' && item.category !== 'mnemonics' && item.category !== 'frameworks' && item.category !== 'ethics' && <Text style={styles.vCardSource}>{item.source}</Text>}
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/* Star / Favorite button — always visible */}
          {onToggleVaFavorite && (
            <TouchableOpacity
              onPress={() => onToggleVaFavorite(item.id)}
              style={[
                styles.copyButton,
                {
                  borderColor: vaFavorites?.has(item.id) ? '#f59e0b' : (isDark ? 'rgba(255,255,255,0.15)' : '#e2e8f0'),
                  backgroundColor: vaFavorites?.has(item.id) ? '#f59e0b18' : 'transparent',
                  paddingHorizontal: 8,
                  paddingVertical: 6,
                  minHeight: 28,
                  justifyContent: 'center',
                  alignItems: 'center',
                }
              ]}
            >
              <Star
                size={14}
                color={vaFavorites?.has(item.id) ? '#f59e0b' : colors.textSecondary}
                fill={vaFavorites?.has(item.id) ? '#f59e0b' : 'none'}
              />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setCollapsed(!collapsed)}
            style={[
              styles.copyButton, 
              { 
                borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#e2e8f0', 
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc',
                paddingHorizontal: 8,
                paddingVertical: 6,
                minHeight: 28,
                justifyContent: 'center',
                alignItems: 'center'
              }
            ]}
          >
            {collapsed ? (
              <ChevronDown size={14} color={colors.textSecondary} />
            ) : (
              <ChevronUp size={14} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {!collapsed && (
        <View style={{ paddingBottom: 6 }}>
          <ValueAddCardBody
            item={item}
            colors={colors}
            ethicsTab={ethicsTab}
            templateFilter={templateFilter}
            onAddFlashcardClick={(front, back) => onAddFlashcardClick?.(item, front, back)}
            zoomScale={zoomScale}
            onImagePress={onImagePress}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10, paddingRight: 4, gap: 8 }}>
            <TouchableOpacity
              onPress={() => {
                const cardTitle = item.category === 'data_facts' ? (item.metric || '') : (item.title || '');
                // Build back content: for ethics dimensions use the dimensions list text; otherwise use rawContent
                let backContent = item.rawContent || item.context || item.quoteText || '';
                if (item.category === 'ethics' && item.ethicsType === 'dimension' && item.ethicsData?.dimensionsList?.length > 0) {
                  const dimLines = (item.ethicsData.dimensionsList as string[]).map((d: string) => `- ${d}`).join('\n');
                  backContent = `**Dimensions of ${cardTitle}:**\n${dimLines}\n\n${item.ethicsData.diagramDescription || ''}`.trim();
                } else if (item.category === 'data_facts') {
                  // Strip HTML comments (<!-- ... -->) from data_facts content
                  backContent = (item.rawContent || item.context || '').replace(/<!--[\s\S]*?-->/g, '').trim();
                }
                onAddFlashcardClick?.(item, cardTitle, backContent);
              }}
              style={[styles.copyButton, { borderColor: '#8b5cf6', backgroundColor: '#8b5cf612' }]}
            >
              <Zap size={12} color="#8b5cf6" />
            </TouchableOpacity>

            {userTags && onToggleValueAddTag && (
              <TouchableOpacity
                onPress={() => setShowTagsSelector(!showTagsSelector)}
                style={[
                  styles.copyButton,
                  {
                    borderColor: (valueAddTags?.[item.id] || []).length > 0 ? colors.primary : colors.border,
                    backgroundColor: (valueAddTags?.[item.id] || []).length > 0 ? colors.primary + '12' : 'transparent',
                  }
                ]}
              >
                <Tag size={12} color={(valueAddTags?.[item.id] || []).length > 0 ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => onCopy(item.id, item.rawContent || item.context || item.quoteText || '')}
              style={[styles.copyButton, isCopied && { backgroundColor: '#10b981', borderColor: '#10b981' }]}
            >
              {isCopied ? (
                <>
                  <Check size={12} color="#ffffff" style={{ marginRight: 4 }} />
                  <Text style={styles.copyBtnText}>Copied</Text>
                </>
              ) : (
                <>
                  <Copy size={12} color="#3b82f6" style={{ marginRight: 4 }} />
                  <Text style={[styles.copyBtnText, { color: '#3b82f6' }]}>Copy</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {showTagsSelector && userTags && onToggleValueAddTag && (
            <View style={{ marginTop: 10, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: 10, paddingHorizontal: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>SELECT REVISION TAGS</Text>
                <TouchableOpacity onPress={() => setShowTagsSelector(false)}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>Close</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 6 }}>
                {userTags.map(tag => {
                  const activeTags = valueAddTags?.[item.id] || [];
                  const isSelected = activeTags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => onToggleValueAddTag(item.id, tag)}
                      style={{
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: isSelected ? colors.primary + '12' : colors.surface,
                        marginRight: 6,
                      }}
                    >
                      <Text style={{ fontSize: 10, color: isSelected ? colors.primary : colors.textSecondary, fontWeight: isSelected ? '700' : '400' }}>
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

export const getMarkdownStyles = (colors: any): any => ({
  body: {
    color: colors.textSecondary,
    fontSize: 14.5,
    lineHeight: 22,
  },
  heading1: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 18,
    marginBottom: 8,
  },
  heading2: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 16,
    marginBottom: 6,
  },
  heading3: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  heading4: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  paragraph: {
    marginTop: 6,
    marginBottom: 10,
  },
  strong: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  bullet_list: {
    marginTop: 6,
    marginBottom: 10,
  },
  ordered_list: {
    marginTop: 6,
    marginBottom: 10,
  },
  list_item: {
    marginVertical: 3,
  },
  link: {
    color: '#3b82f6',
  },
  code_inline: {
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  table: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginVertical: 12,
    overflow: 'hidden',
  },
  tr: {
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
  },
  th: {
    padding: 10,
    backgroundColor: colors.surface + 'cc',
    fontWeight: '800',
    flex: 1,
    minWidth: 110,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  td: {
    padding: 10,
    flex: 1,
    minWidth: 110,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  image: {
    width: '100%',
    height: 220,
    resizeMode: 'contain',
    marginVertical: 12,
  },
});

const toggleFilterValue = (currentVal: string, valueToToggle: string, delimiter: string = '|'): string => {
  if (!currentVal || currentVal === 'All') {
    return valueToToggle;
  }
  const parts = currentVal.split(delimiter);
  if (parts.includes(valueToToggle)) {
    const updated = parts.filter(p => p !== valueToToggle);
    return updated.length === 0 ? 'All' : updated.join(delimiter);
  } else {
    return [...parts, valueToToggle].join(delimiter);
  }
};

/**
 * Reusable sidebar filter row — mirrors arena's FilterRow but styled for the mains sidebar.
 * Supports both pipe-delimited and comma-delimited values via the `delimiter` prop.
 */
interface SidebarFilterRowProps {
  label: string;
  items: string[];
  selected: string;          // current filter string, e.g. 'GS1|GS2' or 'All'
  onSelect: (val: string) => void;
  colors: any;
  delimiter?: string;        // '|' (default) or ',' for flat fields
  showSelectAll?: boolean;
  showAll?: boolean;
  visible?: boolean;
  itemPrefix?: string;       // e.g. '#' for tags
  defaultExpanded?: boolean;
}

function SidebarFilterRow({
  label, items, selected, onSelect, colors,
  delimiter = '|', showSelectAll = false, showAll = true,
  visible = true, itemPrefix = '', defaultExpanded = false,
}: SidebarFilterRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  React.useEffect(() => {
    if (defaultExpanded) {
      setExpanded(true);
    }
  }, [defaultExpanded]);

  if (!visible || !items || items.length === 0) return null;

  const selectedList = selected === 'All' ? [] : selected.split(delimiter).filter(Boolean);
  const isAll = selectedList.length === 0;
  const allSelected = items.length > 0 && selectedList.length === items.length;

  // Compact summary of active selections when collapsed
  const activeLabel = isAll
    ? null
    : selectedList.length <= 2
      ? selectedList.map(s => `${itemPrefix}${s}`).join(', ')
      : `${selectedList.map(s => `${itemPrefix}${s}`).slice(0, 2).join(', ')} +${selectedList.length - 2}`;

  return (
    <View style={{ marginVertical: 2 }}>
      {/* Collapsible Header */}
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={[
          styles.sidebarSectionHeader,
          (expanded || !isAll) && styles.sidebarSectionHeaderActive,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
          {/* Label */}
          <Text style={[styles.panelLabel, { color: isAll ? colors.textTertiary : colors.primary, fontSize: 10, marginBottom: 0, letterSpacing: 1 }]}>
            {label}
          </Text>
          {/* Badge count */}
          <View style={{ backgroundColor: isAll ? colors.border + '60' : colors.primary, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: isAll ? colors.textTertiary : '#ffffff' }}>
              {isAll ? items.length : `${selectedList.length}/${items.length}`}
            </Text>
          </View>
        </View>

        {/* Active label + chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: expanded ? colors.primary + '15' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {expanded
              ? <ChevronUp size={13} color={colors.textSecondary} />
              : <ChevronDown size={13} color={colors.textTertiary} />
            }
          </View>
        </View>
      </TouchableOpacity>

      {/* Expandable Content */}
      {expanded && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingTop: 8, paddingBottom: 6, paddingHorizontal: 2 }}>
          {showAll && (
            <TouchableOpacity
              onPress={() => onSelect('All')}
              activeOpacity={0.8}
              style={[styles.sidebarFchip, isAll && [styles.sidebarFchipSel, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
            >
              <Text style={[styles.sidebarFchipText, { color: isAll ? '#fff' : colors.textSecondary }]}>All</Text>
            </TouchableOpacity>
          )}
          {showSelectAll && items.length > 1 && (
            <TouchableOpacity
              onPress={() => onSelect(allSelected ? 'All' : items.join(delimiter))}
              activeOpacity={0.8}
              style={[styles.sidebarFchip, allSelected && [styles.sidebarFchipSel, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
            >
              <Text style={[styles.sidebarFchipText, { color: allSelected ? '#fff' : colors.textSecondary }]}>Select All</Text>
            </TouchableOpacity>
          )}
          {items.map(item => {
            const isSelected = selectedList.includes(item);
            return (
              <TouchableOpacity
                key={item}
                onPress={() => onSelect(toggleFilterValue(selected, item, delimiter))}
                activeOpacity={0.8}
                style={[styles.sidebarFchip, isSelected && [styles.sidebarFchipSel, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
              >
                <Text style={[styles.sidebarFchipText, { color: isSelected ? '#fff' : colors.textSecondary }]} numberOfLines={1}>
                  {itemPrefix}{item}
                </Text>
                {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

/** PYQ filter with collapse/expand — separate because it's single-select, not chip-based multi */
function SidebarPYQFilter({ filters, onUpdateFilters, colors }: { filters: MainsFilters; onUpdateFilters: (f: MainsFilters) => void; colors: any }) {
  const [expanded, setExpanded] = useState(true);
  const activeLabel = filters.pyqFilter !== 'All' ? filters.pyqFilter : null;

  return (
    <View style={{ marginVertical: 2 }}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        style={[
          styles.sidebarSectionHeader,
          (expanded || !!activeLabel) && styles.sidebarSectionHeaderActive,
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={[styles.panelLabel, { color: colors.textTertiary, fontSize: 10, marginBottom: 0, letterSpacing: 1 }]}>
            PYQ FILTER
          </Text>
          <View style={{ backgroundColor: activeLabel ? colors.primary : colors.border + '60', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 8, fontWeight: '800', color: activeLabel ? '#ffffff' : colors.textTertiary }}>
              {activeLabel ? '1/3' : '3'}
            </Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: expanded ? colors.primary + '15' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {expanded
              ? <ChevronUp size={13} color={colors.textSecondary} />
              : <ChevronDown size={13} color={colors.textTertiary} />
            }
          </View>
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingTop: 8, paddingBottom: 6, paddingHorizontal: 2 }}>
          {(['All', 'PYQ Only', 'Non-PYQ'] as const).map(opt => {
            const isSelected = filters.pyqFilter === opt;
            return (
              <TouchableOpacity
                key={opt}
                onPress={() => onUpdateFilters({ ...filters, pyqFilter: opt })}
                activeOpacity={0.8}
                style={[styles.sidebarFchip, isSelected && [styles.sidebarFchipSel, { backgroundColor: colors.primary, borderColor: colors.primary }]]}
              >
                <Text style={[styles.sidebarFchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

interface MainsLeftPanelProps {
  colors: any;
  insets: any;
  isTablet: boolean;
  filters: MainsFilters;
  onUpdateFilters: (next: MainsFilters) => void;
  allPapers: string[];
  subjectOptions: string[];
  sectionOptions: string[];
  microtopicOptions: string[];
  subtopicOptions: string[];
  nanotopicOptions: string[];
  macrotagOptions: string[];
  microtagOptions: string[];
  isSearchView?: boolean;
  keywords?: string[];
  excludedKeywords?: Set<string>;
  toggleExcludedKeyword?: (kw: string) => void;
  keywordsExpanded?: boolean;
  setKeywordsExpanded?: React.Dispatch<React.SetStateAction<boolean>>;
  results?: any[];
  hasSearched?: boolean;
  allSearchSubjects?: string[];
  sidebarSubjectFilter?: string | null;
  toggleSidebarSubject?: (sub: string | null) => void;
  totalCount?: number;
  allInstitutes?: string[];
  allPrograms?: string[];
  userTags?: string[];
  onCloseSidebar?: () => void;
  allYears?: string[];
}

function MainsLeftPanel({
  colors,
  insets,
  isTablet,
  filters,
  onUpdateFilters,
  allPapers,
  subjectOptions,
  sectionOptions,
  microtopicOptions,
  subtopicOptions,
  nanotopicOptions,
  macrotagOptions,
  microtagOptions,
  isSearchView = false,
  keywords = [],
  excludedKeywords = new Set(),
  toggleExcludedKeyword = () => {},
  keywordsExpanded = true,
  setKeywordsExpanded = () => {},
  results = [],
  hasSearched = false,
  allSearchSubjects = [],
  sidebarSubjectFilter = null,
  toggleSidebarSubject = () => {},
  totalCount = 0,
  allInstitutes = [],
  allPrograms = [],
  userTags = [],
  onCloseSidebar,
  allYears = [],
}: MainsLeftPanelProps) {
  const { isDark } = useTheme();
  const isOptional = filters.paper !== 'All' && !filters.paper.split('|').some(p => ['GS1', 'GS2', 'GS3', 'GS4', 'Essay'].includes(p));

  return (
    <ScrollView
      style={[
        styles.leftPanel,
        { backgroundColor: isDark ? 'rgba(15, 23, 42, 0.45)' : 'rgba(255, 255, 255, 0.45)', borderRightColor: colors.border },
      ]}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 100, paddingTop: insets.top + 50 }}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled
    >
      {/* Excludable keywords for search */}
      {isSearchView && keywords.length > 0 && (
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setKeywordsExpanded(!keywordsExpanded)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
          >
            <Sparkles size={11} color="#7c3aed" />
            <Text style={[styles.panelLabel, { color: '#7c3aed', marginBottom: 0, flex: 1 }]}>
              {keywords.length - excludedKeywords.size}/{keywords.length} KEYWORDS
            </Text>
            {keywordsExpanded
              ? <ChevronUp size={13} color={colors.textTertiary} />
              : <ChevronDown size={13} color={colors.textTertiary} />
            }
          </TouchableOpacity>
          <Text style={[styles.pillText, { color: colors.textTertiary, fontSize: 11, marginTop: 4, marginBottom: 6 }]}>
            💡 Tap to exclude keywords
          </Text>
          {keywordsExpanded && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {keywords.map((kw, i) => {
                const isExcluded = excludedKeywords.has(kw);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => toggleExcludedKeyword(kw)}
                    style={[styles.pill, {
                      backgroundColor: isExcluded ? '#f1f5f9' : '#ede9fe',
                      borderColor: isExcluded ? colors.border : '#c4b5fd',
                      opacity: isExcluded ? 0.5 : 1,
                    }]}
                  >
                    <Text style={[styles.pillText, {
                      color: isExcluded ? colors.textTertiary : '#7c3aed',
                      textDecorationLine: isExcluded ? 'line-through' : 'none',
                    }]}>{kw}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* ── HEADER ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 6, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 3, height: 16, borderRadius: 2, backgroundColor: colors.primary }} />
          <Text style={[styles.panelLabel, { color: colors.textPrimary, marginBottom: 0, fontSize: 11 }]}>
            FILTERS
          </Text>
          <View style={{ backgroundColor: colors.border + '60', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textTertiary }}>{totalCount}</Text>
          </View>
        </View>
        {onCloseSidebar && (
          <TouchableOpacity onPress={onCloseSidebar} style={{ padding: 4, borderRadius: 6, backgroundColor: colors.surfaceStrong }}>
            <ChevronLeft size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── GROUP: SOURCE ── */}
      <View style={{ marginBottom: 4, marginTop: 2 }}>
        <Text style={{ fontSize: 8, fontWeight: '900', color: colors.textTertiary + '80', letterSpacing: 1.5, paddingHorizontal: 4, marginBottom: 2 }}>
          SOURCE
        </Text>
        <SidebarPYQFilter filters={filters} onUpdateFilters={onUpdateFilters} colors={colors} />
      </View>

      {/* ── GROUP: HIERARCHY ── */}
      <View style={{ marginBottom: 4, marginTop: 8 }}>
        <Text style={{ fontSize: 8, fontWeight: '900', color: colors.textTertiary + '80', letterSpacing: 1.5, paddingHorizontal: 4, marginBottom: 2 }}>
          SYLLABUS
        </Text>

        <SidebarFilterRow
          label="PAPER"
          items={allPapers}
          selected={filters.paper}
          defaultExpanded={true}
          onSelect={(val) => onUpdateFilters({
            ...filters,
            paper: val,
            subjects: 'All',
            sections: 'All',
            microtopics: 'All',
            subtopics: 'All',
            macrotags: 'All',
            microtags: 'All',
          })}
          colors={colors}
        />

        <SidebarFilterRow
          label="SUBJECT"
          items={subjectOptions}
          selected={filters.subjects}
          defaultExpanded={filters.paper !== 'All'}
          onSelect={(val) => onUpdateFilters({
            ...filters,
            subjects: val,
            sections: 'All',
            microtopics: 'All',
            subtopics: 'All',
            macrotags: 'All',
            microtags: 'All',
          })}
          colors={colors}
          visible={filters.paper !== 'All'}
        />

        <SidebarFilterRow
          label={isOptional ? 'OPTIONAL PAPER' : 'SECTION GROUP'}
          items={sectionOptions}
          selected={filters.sections}
          defaultExpanded={filters.subjects !== 'All'}
          onSelect={(val) => onUpdateFilters({
            ...filters,
            sections: val,
            microtopics: 'All',
            subtopics: 'All',
            macrotags: 'All',
            microtags: 'All',
          })}
          colors={colors}
          visible={filters.subjects !== 'All'}
        />

        <SidebarFilterRow
          label={isOptional ? 'UNIT' : 'MICROTOPIC'}
          items={microtopicOptions}
          selected={filters.microtopics}
          defaultExpanded={filters.sections !== 'All'}
          onSelect={(val) => onUpdateFilters({
            ...filters,
            microtopics: val,
            subtopics: 'All',
            macrotags: 'All',
            microtags: 'All',
          })}
          colors={colors}
          visible={filters.subjects !== 'All' && filters.sections !== 'All'}
        />

        <SidebarFilterRow
          label={isOptional ? 'SUB-UNIT' : 'SUB-TOPIC'}
          items={subtopicOptions}
          selected={filters.subtopics}
          defaultExpanded={filters.microtopics !== 'All'}
          onSelect={(val) => onUpdateFilters({
            ...filters,
            subtopics: val,
            nanotopics: 'All',
            macrotags: 'All',
            microtags: 'All',
          })}
          colors={colors}
          visible={filters.subjects !== 'All' && filters.sections !== 'All' && filters.microtopics !== 'All'}
        />

        <SidebarFilterRow
          label={isOptional ? 'TOPIC' : 'NANOTOPIC'}
          items={nanotopicOptions}
          selected={filters.nanotopics}
          defaultExpanded={filters.subtopics !== 'All'}
          onSelect={(val) => onUpdateFilters({
            ...filters,
            nanotopics: val,
            macrotags: 'All',
            microtags: 'All',
          })}
          colors={colors}
          visible={filters.subjects !== 'All' && filters.sections !== 'All' && filters.microtopics !== 'All' && filters.subtopics !== 'All'}
        />
      </View>

      {/* ── GROUP: TAGS ── */}
      <View style={{ marginBottom: 4, marginTop: 8 }}>
        <Text style={{ fontSize: 8, fontWeight: '900', color: colors.textTertiary + '80', letterSpacing: 1.5, paddingHorizontal: 4, marginBottom: 2 }}>
          TAGS
        </Text>

        <SidebarFilterRow
          label="MACRO TAG"
          items={macrotagOptions}
          selected={filters.macrotags}
          onSelect={(val) => onUpdateFilters({ ...filters, macrotags: val, microtags: 'All' })}
          colors={colors}
          itemPrefix="#"
        />

        <SidebarFilterRow
          label="MICRO TAG"
          items={microtagOptions}
          selected={filters.microtags}
          onSelect={(val) => onUpdateFilters({ ...filters, microtags: val })}
          colors={colors}
          itemPrefix="#"
          visible={filters.macrotags !== 'All'}
        />

        <SidebarFilterRow
          label="REVISION TAGS"
          items={userTags}
          selected={filters.revisionTags}
          onSelect={(val) => onUpdateFilters({ ...filters, revisionTags: val })}
          colors={colors}
          delimiter=","
        />
      </View>

      {/* ── GROUP: INSTITUTE ── */}
      <View style={{ marginBottom: 4, marginTop: 8 }}>
        <Text style={{ fontSize: 8, fontWeight: '900', color: colors.textTertiary + '80', letterSpacing: 1.5, paddingHorizontal: 4, marginBottom: 2 }}>
          INSTITUTE
        </Text>

        <SidebarFilterRow
          label="INSTITUTE"
          items={allInstitutes}
          selected={filters.institutes}
          onSelect={(val) => onUpdateFilters({ ...filters, institutes: val })}
          colors={colors}
          delimiter=","
        />

        <SidebarFilterRow
          label="PROGRAMMES"
          items={allPrograms}
          selected={filters.program}
          onSelect={(val) => onUpdateFilters({ ...filters, program: val })}
          colors={colors}
          delimiter=","
        />

        <SidebarFilterRow
          label="YEAR"
          items={allYears}
          selected={filters.years}
          onSelect={(val) => onUpdateFilters({ ...filters, years: val })}
          colors={colors}
        />
      </View>

      {/* Search Subject list client-side filter */}
      {isSearchView && allSearchSubjects.length >= 1 && (
        <View style={{ marginTop: 14 }}>
          <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>BY SUBJECT IN RESULTS</Text>
          {sidebarSubjectFilter && (
            <TouchableOpacity
              style={[styles.subjectChip, { borderColor: '#ef4444', backgroundColor: '#fee2e2' }]}
              onPress={() => toggleSidebarSubject(null)}
            >
              <X size={10} color="#ef4444" />
              <Text style={[styles.subjectChipText, { color: '#ef4444' }]}>Clear: {sidebarSubjectFilter}</Text>
            </TouchableOpacity>
          )}
          {allSearchSubjects.map(sub => {
            const count = results.filter(r => r.subject === sub).length;
            const isSelected = sidebarSubjectFilter === sub;
            return (
              <TouchableOpacity
                key={sub}
                style={[styles.subjectChip, {
                  borderColor: isSelected ? '#7c3aed' : colors.border,
                  backgroundColor: isSelected ? '#ede9fe' : colors.surface,
                }]}
                onPress={() => toggleSidebarSubject(isSelected ? null : sub)}
              >
                <View style={[styles.subjectDot, { backgroundColor: '#7c3aed' }]} />
                <Text style={[styles.subjectChipText, { color: isSelected ? '#7c3aed' : colors.textSecondary }]} numberOfLines={1}>{sub}</Text>
                <Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{count}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

interface HierarchyModalProps {
  visible: boolean;
  onClose: () => void;
  colors: any;
  filters: MainsFilters;
  onUpdateFilters: (f: MainsFilters) => void;
  allPapers: string[];
  subjectOptions: string[];
  sectionOptions: string[];
  microtopicOptions: string[];
  subtopicOptions: string[];
  macrotagOptions: string[];
  microtagOptions: string[];
  isTablet: boolean;
  columnLabels?: {
    paper?: string;
    subject?: string;
    section?: string;
    microtopic?: string;
    subtopic?: string;
  };
  isMainsValueAdd?: boolean;
  isIntroConclusion?: boolean;
  isQuotes?: boolean;
  isMnemonics?: boolean;
  activeCategoryItems?: any[];
  activeCategory?: string;
  questions?: ConsolidatedQuestion[];
}

function HierarchyModal({
  visible,
  onClose,
  colors,
  filters,
  onUpdateFilters,
  allPapers,
  subjectOptions,
  sectionOptions,
  microtopicOptions,
  subtopicOptions,
  macrotagOptions,
  microtagOptions,
  isTablet,
  columnLabels,
  isMainsValueAdd,
  isIntroConclusion,
  isQuotes,
  isMnemonics,
  activeCategoryItems,
  activeCategory,
  questions,
}: HierarchyModalProps) {
  const [localFilters, setLocalFilters] = React.useState<MainsFilters>(filters);

  React.useEffect(() => {
    if (visible) {
      setLocalFilters(filters);
    }
  }, [visible, filters]);

  const localSubjectOptions = React.useMemo(() => {
    const items = activeCategoryItems || questions;
    if (!items) return [];

    const paperFilter = localFilters.paper !== 'All' ? localFilters.paper.split('|') : [];
    const subSet = new Set<string>();

    if (activeCategoryItems && activeCategoryItems.length > 0) {
      activeCategoryItems.forEach(item => {
        getItemPaths(item).forEach(path => {
          if (paperFilter.length === 0 || paperFilter.includes(path.paper)) {
            if (path.subject) subSet.add(path.subject);
          }
        });
      });
    } else {
      questions?.forEach(q => {
        if (q && q.paper && (paperFilter.length === 0 || paperFilter.includes(q.paper))) {
          if (q.subject) subSet.add(q.subject);
        }
      });
    }
    return Array.from(subSet).sort();
  }, [activeCategoryItems, questions, localFilters.paper]);

  const localSectionOptions = React.useMemo(() => {
    const items = activeCategoryItems || questions;
    if (!items) return [];

    const paperFilter = localFilters.paper !== 'All' ? localFilters.paper.split('|') : [];
    const subjectFilter = localFilters.subjects !== 'All' ? localFilters.subjects.split('|') : [];
    const secSet = new Set<string>();

    if (activeCategoryItems && activeCategoryItems.length > 0) {
      activeCategoryItems.forEach(item => {
        getItemPaths(item).forEach(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          if (matchPaper && matchSubject && path.sectionGroup) {
            secSet.add(path.sectionGroup);
          }
        });
      });
    } else {
      questions?.forEach(q => {
        if (q) {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
          if (matchPaper && matchSubject) {
            const sGroup = getQuestionSection(q);
            if (sGroup) secSet.add(sGroup);
          }
        }
      });
    }
    return Array.from(secSet).sort(naturalCompare);
  }, [activeCategoryItems, questions, localFilters.paper, localFilters.subjects]);

  const localMicrotopicOptions = React.useMemo(() => {
    const items = activeCategoryItems || questions;
    if (!items) return [];

    const paperFilter = localFilters.paper !== 'All' ? localFilters.paper.split('|') : [];
    const subjectFilter = localFilters.subjects !== 'All' ? localFilters.subjects.split('|') : [];
    const sectionFilter = localFilters.sections !== 'All' ? localFilters.sections.split('|') : [];
    const mtSet = new Set<string>();

    if (activeCategoryItems && activeCategoryItems.length > 0) {
      activeCategoryItems.forEach(item => {
        getItemPaths(item).forEach(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          const matchSection = sectionFilter.length === 0 || sectionFilter.includes(path.sectionGroup);
          if (matchPaper && matchSubject && matchSection) {
            const currentCat = activeCategory === 'va_hub' ? item.category : activeCategory;
            const isStandardHierarchyCat = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat || '');
            if (isStandardHierarchyCat) {
              if (path.microtopic) mtSet.add(path.microtopic);
            } else {
              const themeName = item.category === 'data_facts' ? item.metric : item.title;
              if (themeName) mtSet.add(themeName);
            }
          }
        });
      });
    } else {
      questions?.forEach(q => {
        if (q) {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
          const matchSection = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
          if (matchPaper && matchSubject && matchSection) {
            const micro = getQuestionMicro(q);
            if (micro) mtSet.add(micro);
          }
        }
      });
    }
    return Array.from(mtSet).sort(naturalCompare);
  }, [activeCategoryItems, questions, localFilters.paper, localFilters.subjects, localFilters.sections, activeCategory]);

  const localSubtopicOptions = React.useMemo(() => {
    const items = activeCategoryItems || questions;
    if (!items) return [];

    const selectedMicrotopic = localFilters.microtopics !== 'All' ? localFilters.microtopics : null;
    if (!selectedMicrotopic) return [];

    const stSet = new Set<string>();
    const paperFilter = localFilters.paper !== 'All' ? localFilters.paper.split('|') : [];
    const subjectFilter = localFilters.subjects !== 'All' ? localFilters.subjects.split('|') : [];
    const sectionFilter = localFilters.sections !== 'All' ? localFilters.sections.split('|') : [];
    const microtopicFilter = selectedMicrotopic.split('|');

    if (activeCategoryItems && activeCategoryItems.length > 0) {
      activeCategoryItems.forEach(item => {
        getItemPaths(item).forEach(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          const matchSection = sectionFilter.length === 0 || sectionFilter.includes(path.sectionGroup);
          if (matchPaper && matchSubject && matchSection) {
            const currentCat = activeCategory === 'va_hub' ? item.category : activeCategory;
            const isStandardHierarchyCat = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat || '');
            if (isStandardHierarchyCat) {
              if (path.microtopic && microtopicFilter.includes(path.microtopic)) {
                if (path.subtopic) stSet.add(path.subtopic);
              }
            } else {
              const themeName = item.category === 'data_facts' ? item.metric : item.title;
              if (themeName === selectedMicrotopic) {
                const subThemes = item.parsedSubThemes || splitSubThemes(item.context);
                subThemes.forEach((st: any) => {
                  if (st.title) stSet.add(st.title);
                });
              }
            }
          }
        });
      });
    } else {
      questions?.forEach(q => {
        if (q) {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
          const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
          const matchMicro = microtopicFilter.includes(getQuestionMicro(q));
          if (matchPaper && matchSubject && matchSec && matchMicro) {
            const sub = getQuestionSub(q);
            if (sub) stSet.add(sub);
          }
        }
      });
    }
    return Array.from(stSet).sort(naturalCompare);
  }, [activeCategoryItems, questions, localFilters.paper, localFilters.subjects, localFilters.sections, localFilters.microtopics, activeCategory]);

  const localNanotopicOptions = React.useMemo(() => {
    const items = activeCategoryItems || questions;
    if (!items) return [];

    const selectedSubTheme = localFilters.subtopics !== 'All' ? localFilters.subtopics : null;
    if (!selectedSubTheme) return [];

    const ntSet = new Set<string>();
    const paperFilter = localFilters.paper !== 'All' ? localFilters.paper.split('|') : [];
    const subjectFilter = localFilters.subjects !== 'All' ? localFilters.subjects.split('|') : [];
    const sectionFilter = localFilters.sections !== 'All' ? localFilters.sections.split('|') : [];
    const microtopicFilter = localFilters.microtopics !== 'All' ? localFilters.microtopics.split('|') : [];
    const subtopicFilter = selectedSubTheme.split('|');

    if (activeCategoryItems && activeCategoryItems.length > 0) {
      activeCategoryItems.forEach(item => {
        getItemPaths(item).forEach(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          const matchSection = sectionFilter.length === 0 || sectionFilter.includes(path.sectionGroup);
          const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(path.microtopic);
          if (matchPaper && matchSubject && matchSection && matchMicro) {
            if (path.subtopic && subtopicFilter.includes(path.subtopic)) {
              if (path.nanotopic) ntSet.add(path.nanotopic);
            }
          }
        });
      });
    } else {
      questions?.forEach(q => {
        if (q) {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
          const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
          const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
          const matchSub = subtopicFilter.includes(getQuestionSub(q));
          if (matchPaper && matchSubject && matchSec && matchMicro && matchSub) {
            const nano = getQuestionNano(q);
            if (nano) ntSet.add(nano);
          }
        }
      });
    }
    return Array.from(ntSet).sort(naturalCompare);
  }, [activeCategoryItems, questions, localFilters.paper, localFilters.subjects, localFilters.sections, localFilters.microtopics, localFilters.subtopics]);

  const localMacrotagOptions = React.useMemo(() => {
    const items = activeCategoryItems || questions;
    if (!items) return [];

    const paperFilter = localFilters.paper !== 'All' ? localFilters.paper.split('|') : [];
    const subjectFilter = localFilters.subjects !== 'All' ? localFilters.subjects.split('|') : [];
    const sectionFilter = localFilters.sections !== 'All' ? localFilters.sections.split('|') : [];
    const microtopicFilter = localFilters.microtopics !== 'All' ? localFilters.microtopics.split('|') : [];
    const subtopicFilter = localFilters.subtopics !== 'All' ? localFilters.subtopics.split('|') : [];
    const nanotopicFilter = localFilters.nanotopics !== 'All' ? localFilters.nanotopics.split('|') : [];

    const sstSet = new Set<string>();

    if (activeCategoryItems && activeCategoryItems.length > 0) {
      activeCategoryItems.forEach(item => {
        getItemPaths(item).forEach(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          const matchSec = sectionFilter.length === 0 || sectionFilter.includes(path.sectionGroup);
          const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(path.microtopic);
          const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(path.subtopic);

          if (matchPaper && matchSubject && matchSec && matchMicro && matchSub) {
            const itemCat = activeCategory === 'va_hub' ? item.category : activeCategory;
            if (itemCat === 'intro_conclusion') {
              if (path.subtopic && (subtopicFilter.length === 0 || subtopicFilter.includes(path.subtopic))) {
                if (item.title) sstSet.add(item.title);
              }
            } else if (['quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(itemCat || '')) {
              if (path.subtopic && (subtopicFilter.length === 0 || subtopicFilter.includes(path.subtopic))) {
                const cardTitleName = itemCat === 'data_facts' ? item.metric : item.title;
                if (cardTitleName) sstSet.add(cardTitleName);
              }
            } else {
              const subThemes = item.parsedSubThemes || splitSubThemes(item.context);
              subThemes.forEach((st: any) => {
                if (nanotopicFilter.length === 0 || nanotopicFilter.includes(st.title)) {
                  const sstMatches = splitSubSubThemes(st.content);
                  sstMatches.forEach(sst => sstSet.add(sst));
                }
              });
            }
          }
        });
      });
    } else {
      questions?.forEach(q => {
        if (q) {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
          const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
          const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
          const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
          const matchNano = nanotopicFilter.length === 0 || nanotopicFilter.includes(getQuestionNano(q));
          if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && matchNano) {
            if (q.macrotag) {
              q.macrotag.split(',').forEach(t => sstSet.add(t.trim()));
            }
          }
        }
      });
    }
    return Array.from(sstSet).sort();
  }, [activeCategoryItems, questions, localFilters.paper, localFilters.subjects, localFilters.sections, localFilters.microtopics, localFilters.subtopics, localFilters.nanotopics, activeCategory]);

  const localMicrotagOptions = React.useMemo(() => {
    if (localFilters.macrotags === 'All') return [];
    const paperFilter = localFilters.paper !== 'All' ? localFilters.paper.split('|') : [];
    const subjectFilter = localFilters.subjects !== 'All' ? localFilters.subjects.split('|') : [];
    const sectionFilter = localFilters.sections !== 'All' ? localFilters.sections.split('|') : [];
    const microtopicFilter = localFilters.microtopics !== 'All' ? localFilters.microtopics.split('|') : [];
    const subtopicFilter = localFilters.subtopics !== 'All' ? localFilters.subtopics.split('|') : [];
    const nanotopicFilter = localFilters.nanotopics !== 'All' ? localFilters.nanotopics.split('|') : [];
    const macrotagFilter = localFilters.macrotags.split('|');

    const tagSet = new Set<string>();
    questions?.forEach(q => {
      if (q) {
        const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
        const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
        const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
        const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
        const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
        const matchNano = nanotopicFilter.length === 0 || nanotopicFilter.includes(getQuestionNano(q));
        const qMacros = (q.macrotag || '').split(',').map(t => t.trim());
        const hasMacroMatch = qMacros.some(m => macrotagFilter.includes(m));

        if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && matchNano && hasMacroMatch && q.microtag) {
          q.microtag.split(',').forEach(t => tagSet.add(t.trim()));
        }
      }
    });
    return Array.from(tagSet).sort();
  }, [questions, localFilters.paper, localFilters.subjects, localFilters.sections, localFilters.microtopics, localFilters.subtopics, localFilters.nanotopics, localFilters.macrotags]);

  const subjects = localSubjectOptions;
  const sections = localSectionOptions;
  const microtopics = localMicrotopicOptions;
  const subtopics = localSubtopicOptions;
  const nanotopics = localNanotopicOptions;
  const macrotags = localMacrotagOptions;
  const microtags = localMicrotagOptions;

  const isOptional = localFilters.paper !== 'All' && !localFilters.paper.split('|').some(p => ['GS1', 'GS2', 'GS3', 'GS4', 'Essay'].includes(p));
  const labels = {
    paper: columnLabels?.paper || 'Paper',
    subject: columnLabels?.subject || 'Subject',
    section: isOptional ? 'Optional Paper' : (columnLabels?.section || 'Section Group'),
    microtopic: isOptional ? 'Unit' : (columnLabels?.microtopic || 'Microtopic'),
    subtopic: isOptional ? 'Sub-unit' : (columnLabels?.subtopic || 'Sub-topic'),
    nanotopic: isOptional ? 'Topic' : 'Nanotopic',
  };

  const renderColumn = (
    label: string,
    items: string[],
    selectedValue: string,
    onSelect: (val: string) => void,
    activeColor: string,
    width: number
  ) => {
    return (
      <View style={[styles.hierarchyColumn, { borderRightColor: colors.border, width, alignSelf: 'stretch' }]}>
        <Text style={[styles.hierarchyColumnTitle, { color: activeColor }]}>{label.toUpperCase()}</Text>
        <ScrollView style={{ flex: 1 }} nestedScrollEnabled={true} contentContainerStyle={{ width: '100%', paddingBottom: 16 }}>
          {items.length === 0 ? (
            <Text style={{ color: colors.textTertiary, fontStyle: 'italic', fontSize: 11, padding: 12 }}>—</Text>
          ) : (
            items.map(item => {
              const isSelected = selectedValue.split('|').includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.hierarchyItemBtn,
                    isSelected && { backgroundColor: activeColor + '15' },
                    { opacity: pressed ? 0.6 : 1 }
                  ]}
                >
                  <Text style={[
                    styles.hierarchyItemText,
                    { color: isSelected ? activeColor : colors.textSecondary, fontWeight: isSelected ? '700' : '400' }
                  ]}>
                    {item}
                  </Text>
                  {isSelected && <Check size={12} color={activeColor} />}
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </View>
    );
  };

  const handleApply = () => {
    onUpdateFilters(localFilters);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable 
        style={[
          styles.overlay, 
          { 
            justifyContent: 'flex-start', 
            alignItems: 'flex-start',
            paddingTop: isTablet ? 120 : 80,
            paddingLeft: isTablet ? 24 : 10,
            paddingRight: isTablet ? 24 : 10,
          }
        ]} 
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.hierarchyPopup,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              width: isTablet ? '96%' : '95%',
              height: '65%',
              maxWidth: 1600,
            }
          ]}
          onPress={e => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.popupHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginRight: 8 }}>Drill Down Topics:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ alignItems: 'center', gap: 6 }}
                style={{ flex: 1 }}
              >
                {/* Paper breadcrumb — only for non-quotes */}
                {!isQuotes && (localFilters.paper !== 'All' ? (
                  localFilters.paper.split('|').map(val => (
                    <View key={`modal-crumb-paper-${val}`} style={[styles.crumbBadge, { backgroundColor: '#dbeafe' }]}>
                      <Text style={[styles.crumbText, { color: '#1e40af' }]}>{val}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' }}>Select paper to begin</Text>
                ))}

                {/* Subject breadcrumb */}
                {!isQuotes && localFilters.subjects !== 'All' && (
                  <>
                    <ChevronRight size={12} color="#94a3b8" />
                    {localFilters.subjects.split('|').map(val => (
                      <View key={`modal-crumb-subject-${val}`} style={[styles.crumbBadge, { backgroundColor: '#f3e8ff' }]}>
                        <Text style={[styles.crumbText, { color: '#6b21a8' }]}>{val}</Text>
                      </View>
                    ))}
                  </>
                )}

                {/* Quotes: Subject shown as first breadcrumb */}
                {isQuotes && (localFilters.subjects !== 'All' ? (
                  localFilters.subjects.split('|').map(val => (
                    <View key={`modal-crumb-subject-${val}`} style={[styles.crumbBadge, { backgroundColor: '#f3e8ff' }]}>
                      <Text style={[styles.crumbText, { color: '#6b21a8' }]}>{val}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontStyle: 'italic' }}>Select subject to begin</Text>
                ))}

                {!isQuotes && localFilters.sections !== 'All' && (
                  <>
                    <ChevronRight size={12} color="#94a3b8" />
                    {localFilters.sections.split('|').map(val => (
                      <View key={`modal-crumb-section-${val}`} style={[styles.crumbBadge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.crumbText, { color: '#92400e' }]}>{val}</Text>
                      </View>
                    ))}
                  </>
                )}

                {isQuotes && localFilters.sections !== 'All' && (
                  <>
                    <ChevronRight size={12} color="#94a3b8" />
                    {localFilters.sections.split('|').map(val => (
                      <View key={`modal-crumb-section-${val}`} style={[styles.crumbBadge, { backgroundColor: '#fef3c7' }]}>
                        <Text style={[styles.crumbText, { color: '#92400e' }]}>{val}</Text>
                      </View>
                    ))}
                  </>
                )}

                {localFilters.microtopics !== 'All' && (
                  <>
                    <ChevronRight size={12} color="#94a3b8" />
                    {localFilters.microtopics.split('|').map(val => (
                      <View key={`modal-crumb-micro-${val}`} style={[styles.crumbBadge, { backgroundColor: '#d1fae5' }]}>
                        <Text style={[styles.crumbText, { color: '#065f46' }]}>{val}</Text>
                      </View>
                    ))}
                  </>
                )}

                {localFilters.subtopics !== 'All' && (
                  <>
                    <ChevronRight size={12} color="#94a3b8" />
                    {localFilters.subtopics.split('|').map(val => (
                      <View key={`modal-crumb-sub-${val}`} style={[styles.crumbBadge, { backgroundColor: '#ffe4e6' }]}>
                        <Text style={[styles.crumbText, { color: '#be123c' }]}>{val}</Text>
                      </View>
                    ))}
                  </>
                )}

                {localFilters.macrotags !== 'All' && (
                  <>
                    <ChevronRight size={12} color="#94a3b8" />
                    {localFilters.macrotags.split('|').map(val => (
                      <View key={`modal-crumb-macro-${val}`} style={[styles.crumbBadge, { backgroundColor: isIntroConclusion ? '#d1fae5' : (isMainsValueAdd ? '#f3e8ff' : '#e0f7fa') }]}>
                        <Text style={[styles.crumbText, { color: isIntroConclusion ? '#065f46' : (isMainsValueAdd ? '#6b21a8' : '#006064') }]}>{val}</Text>
                      </View>
                    ))}
                  </>
                )}

                {!isMainsValueAdd && localFilters.microtags !== 'All' && (
                  <>
                    <ChevronRight size={12} color="#94a3b8" />
                    {localFilters.microtags.split('|').map(val => (
                      <View key={`modal-crumb-microtag-${val}`} style={[styles.crumbBadge, { backgroundColor: '#fce4ec' }]}>
                        <Text style={[styles.crumbText, { color: '#880e4f' }]}>{val}</Text>
                      </View>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceStrong }]}>
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Cascading Columns in Horizontal ScrollView */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            contentContainerStyle={{ paddingVertical: 12 }}
            style={{ flex: 1 }}
          >
            {/* COLUMN 1: Paper (hidden for quotes since all entries are Essay paper) */}
            {!isQuotes && renderColumn(labels.paper, ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'], localFilters.paper, (p) => {
              const currentVal = localFilters.paper;
              const nextVal = toggleFilterValue(currentVal, p);
              const isRemoval = nextVal === 'All' || (currentVal !== 'All' && nextVal.split('|').length < currentVal.split('|').length);
              setLocalFilters({
                ...localFilters,
                paper: nextVal,
                ...(isRemoval ? { subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' } : {})
              });
            }, '#3b82f6', isTablet ? 150 : 130)}

            {/* COLUMN 2: Subject — for quotes shows all subjects; for others requires paper selection */}
            {renderColumn(labels.subject, isQuotes ? subjects : (localFilters.paper === 'All' ? [] : subjects), localFilters.subjects, (sub) => {
              const currentVal = localFilters.subjects;
              const nextVal = toggleFilterValue(currentVal, sub);
              const isRemoval = nextVal === 'All' || (currentVal !== 'All' && nextVal.split('|').length < currentVal.split('|').length);
              setLocalFilters({
                ...localFilters,
                subjects: nextVal,
                ...(isRemoval ? { sections: 'All', microtopics: 'All', subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' } : {})
              });
            }, '#8b5cf6', isTablet ? 180 : 140)}

            {/* COLUMN 3: Section Group — for quotes: always show all options; for others: requires subject selection */}
            {renderColumn(labels.section, (isQuotes || isMnemonics) ? sections : (localFilters.subjects === 'All' ? [] : sections), localFilters.sections, (sec) => {
              const currentVal = localFilters.sections;
              const nextVal = toggleFilterValue(currentVal, sec);
              const isRemoval = nextVal === 'All' || (currentVal !== 'All' && nextVal.split('|').length < currentVal.split('|').length);
              setLocalFilters({
                ...localFilters,
                sections: nextVal,
                ...(isRemoval ? { microtopics: 'All', subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' } : {})
              });
            }, '#f59e0b', isTablet ? 250 : 200)}

            {/* COLUMN 4: Microtopic / Theme */}
            {renderColumn(labels.microtopic, localFilters.sections === 'All' ? [] : microtopics, localFilters.microtopics, (mt) => {
              const currentVal = localFilters.microtopics;
              const nextVal = toggleFilterValue(currentVal, mt);
              const isRemoval = nextVal === 'All' || (currentVal !== 'All' && nextVal.split('|').length < currentVal.split('|').length);
              setLocalFilters({
                ...localFilters,
                microtopics: nextVal,
                ...(isRemoval ? { subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' } : {})
              });
            }, '#10b981', isTablet ? 320 : 250)}

            {/* COLUMN 5: Sub-topic / Sub-theme */}
            {renderColumn(labels.subtopic, localFilters.microtopics === 'All' ? [] : subtopics, localFilters.subtopics, (st) => {
              const currentVal = localFilters.subtopics;
              const nextVal = toggleFilterValue(currentVal, st);
              const isRemoval = nextVal === 'All' || (currentVal !== 'All' && nextVal.split('|').length < currentVal.split('|').length);
              setLocalFilters({
                ...localFilters,
                subtopics: nextVal,
                ...(isRemoval ? { nanotopics: 'All', macrotags: 'All', microtags: 'All' } : {})
              });
            }, '#f43f5e', isTablet ? 250 : 200)}

            {/* COLUMN 6: Nanotopic / Sub-microtopic */}
            {renderColumn(labels.nanotopic, localFilters.subtopics === 'All' ? [] : nanotopics, localFilters.nanotopics, (nt) => {
              const currentVal = localFilters.nanotopics;
              const nextVal = toggleFilterValue(currentVal, nt);
              const isRemoval = nextVal === 'All' || (currentVal !== 'All' && nextVal.split('|').length < currentVal.split('|').length);
              setLocalFilters({
                ...localFilters,
                nanotopics: nextVal,
                ...(isRemoval ? { macrotags: 'All', microtags: 'All' } : {})
              });
            }, '#ec4899', isTablet ? 250 : 200)}

            {/* COLUMN 7: Macro tag / Sub-sub-theme */}
            {(!isMainsValueAdd || macrotags.length > 0) && renderColumn(
              activeCategory === 'data_facts' ? "Theme" :
              isIntroConclusion ? "Card Title" : 
              isQuotes ? "Title" : 
              isMnemonics ? "Mnemonic Title" : 
              activeCategory === 'sc_judgments_hub' ? "Judgment Title" : 
              activeCategory === 'keywords_hub' ? "Keyword" : 
              activeCategory === 'case_studies_hub' ? "Case Study Title" : 
              isMainsValueAdd ? "Sub-sub-theme" : "Macro tag",
              macrotags,
              localFilters.macrotags,
              (mat) => {
                const currentVal = localFilters.macrotags;
                const nextVal = toggleFilterValue(currentVal, mat);
                const isRemoval = nextVal === 'All' || (currentVal !== 'All' && nextVal.split('|').length < currentVal.split('|').length);
                setLocalFilters({
                  ...localFilters,
                  macrotags: nextVal,
                  ...(isRemoval ? { microtags: 'All' } : {})
                });
              },
              isIntroConclusion ? '#10b981' : (isMainsValueAdd ? '#8b5cf6' : '#06b6d4'),
              isTablet ? 250 : 200
            )}

            {/* COLUMN 8: Micro tag */}
            {!isMainsValueAdd && renderColumn("Micro tag", microtags, localFilters.microtags, (mit) => {
              setLocalFilters({
                ...localFilters,
                microtags: toggleFilterValue(localFilters.microtags, mit)
              });
            }, '#ec4899', isTablet ? 200 : 160)}
          </ScrollView>

          {/* Footer */}
          <View style={[styles.popupFooter, { borderTopColor: colors.border, justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}>
            <TouchableOpacity
              onPress={() => setLocalFilters({ ...DEFAULT_MAINS_FILTERS })}
              style={{ paddingVertical: 8, paddingHorizontal: 12 }}
            >
              <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Clear Selection</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleApply} style={[styles.applyBtn, { backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 8 }]}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Apply</Text>
            </TouchableOpacity>

          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}


function QuestionBankView({
  colors,
  savedIds,
  onToggleSaved,
  isTablet,
  insets,
  questions,
  valueAddItems = [],
  copiedId = null,
  onCopy = () => {},
  onAddFlashcardClick,
  onOpenDetailed,
  userTags,
  userQuestionStates,
  onActiveQuestionChange,
  initialFilters,
  onFilterChange,
  valueAddTags = {},
  onToggleValueAddTag,
  onCreateTag,
  vaFavorites = new Set<string>(),
  onToggleVaFavorite,
}: {
  colors: any;
  savedIds: string[];
  onToggleSaved: (id: string) => void;
  isTablet: boolean;
  insets: any;
  questions: ConsolidatedQuestion[];
  valueAddItems?: ValueAdditionItem[];
  copiedId?: string | null;
  onCopy?: (id: string, text: string) => void;
  onAddFlashcardClick?: (item: any, front: string, back: string) => void;
  onOpenDetailed: (q: ConsolidatedQuestion) => void;
  userTags: string[];
  userQuestionStates: Record<string, { reviewTags: string[], confidence: string | null, difficulty: string | null }>;
  onActiveQuestionChange?: (q: ConsolidatedQuestion | null, activeInst?: string) => void;
  initialFilters?: MainsFilters | null;
  onFilterChange?: (filters: MainsFilters) => void;
  valueAddTags?: Record<string, string[]>;
  onToggleValueAddTag?: (cardId: string, tag: string) => void;
  onCreateTag?: (tag: string) => void;
  vaFavorites?: Set<string>;
  onToggleVaFavorite?: (cardId: string) => void;
}) {
  const { isDark } = useTheme();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedInstitutes, setSelectedInstitutes] = useState<Record<string, string>>({});
  const flatListRef = useRef<FlatList>(null);
  const cardYOffsets = useRef<Record<string, number>>({});
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportPayload, setExportPayload] = useState<any>(null);

  // Pinch-to-zoom state for QuestionBankView
  const [zoomFontSize, setZoomFontSize] = useState<number>(16);
  const baseFontSizeRef = React.useRef<number>(16);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimerRef = React.useRef<any>(null);

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    let next = baseFontSizeRef.current * scale;
    next = Math.max(12, Math.min(32, next));
    setZoomFontSize(Math.round(next));
    setShowZoomIndicator(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1200);
  };

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GHState.END || event.nativeEvent.state === GHState.CANCELLED) {
      baseFontSizeRef.current = zoomFontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const zoomScale = zoomFontSize / 16;

  // Dynamically scaled markdown styles for expanded model answers
  const dynamicMarkdownStyles = React.useMemo(() => {
    const base = getMarkdownStyles(colors);
    const ratio = zoomFontSize / 16;
    return {
      ...base,
      body: {
        ...base.body,
        fontSize: Math.round(14 * ratio),
        lineHeight: Math.round(14 * ratio * 1.5),
      },
      heading1: { ...base.heading1, fontSize: Math.round(18 * ratio) },
      heading2: { ...base.heading2, fontSize: Math.round(16 * ratio) },
      heading3: { ...base.heading3, fontSize: Math.round(15 * ratio) },
      heading4: { ...base.heading4, fontSize: Math.round(14 * ratio) },
    };
  }, [colors, zoomFontSize]);

  // View mode selector state: 'all' | 'questions' | 'valueAdd'
  const [viewMode, setViewMode] = useState<'all' | 'questions' | 'valueAdd'>('all');

  useEffect(() => {
    if (expandedId) {
      const q = questions.find(item => item.id === expandedId);
      if (q) {
        const cleanAnsList = getCleanAvailableAnswers(q.answers);
        const currentInst = cleanAnsList.length > 0 ? (selectedInstitutes[q.id] || cleanAnsList[0].institute) : undefined;
        onActiveQuestionChange?.(q, currentInst);
      }
    } else {
      onActiveQuestionChange?.(null);
    }
    return () => onActiveQuestionChange?.(null);
  }, [expandedId, selectedInstitutes, questions, onActiveQuestionChange]);

  const [filters, setFilters] = useState<MainsFilters>(() => {
    return initialFilters || DEFAULT_MAINS_FILTERS;
  });

  useEffect(() => {
    onFilterChange?.(filters);
  }, [filters, onFilterChange]);

  const setFiltersDeferred = useCallback((updater: MainsFilters | ((prev: MainsFilters) => MainsFilters)) => {
    setTimeout(() => {
      setFilters(prev => {
        const next = typeof updater === 'function' ? (updater as Function)(prev) : updater;
        return next;
      });
    }, 16);
  }, []);

  useEffect(() => {
    if (initialFilters) {
      setFilters(initialFilters);
    }
  }, [initialFilters]);

  const [hierarchyModalVisible, setHierarchyModalVisible] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allInstitutes = useMemo(() => {
    const instSet = new Set<string>();
    questions.forEach(q => {
      if (q.institute) {
        instSet.add(q.institute.trim());
      } else if (q.is_pyq) {
        instSet.add('UPSC');
      }
    });
    return Array.from(instSet).sort();
  }, [questions]);

  const allPrograms = useMemo(() => {
    if (filters.institutes === 'All') return [];
    const progSet = new Set<string>();
    const selectedInsts = filters.institutes.split(',');
    questions.forEach(q => {
      const instName = q.institute || (q.is_pyq ? 'UPSC' : '');
      if (instName && selectedInsts.includes(instName)) {
        if (q.program_name) {
          progSet.add(q.program_name.trim());
        }
      }
    });
    return Array.from(progSet).sort();
  }, [questions, filters.institutes]);

  const allYears = useMemo(() => {
    const yearSet = new Set<string>();
    questions.forEach(q => {
      const yr = q.year;
      if (yr) yearSet.add(String(yr));
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [questions]);


  const allPapers = useMemo(() => {
    const paperSet = new Set<string>();
    questions.forEach(q => { if (q.paper) paperSet.add(q.paper); });
    valueAddItems.forEach(va => { if (va.paper) paperSet.add(va.paper); });
    return Array.from(paperSet).sort();
  }, [questions, valueAddItems]);

  const subjectOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subSet = new Set<string>();
    questions.forEach(q => {
      if (paperFilter.length === 0 || paperFilter.includes(q.paper)) {
        if (q.subject) subSet.add(q.subject);
      }
    });
    valueAddItems.forEach(va => {
      if (paperFilter.length === 0 || paperFilter.includes(va.paper || '')) {
        if (va.subject) subSet.add(va.subject);
      }
    });
    return Array.from(subSet).sort();
  }, [questions, valueAddItems, filters.paper]);

  const sectionOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const secSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const sGroup = getQuestionSection(q);
      if (matchPaper && matchSubject && sGroup) {
        secSet.add(sGroup);
      }
    });
    valueAddItems.forEach(va => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(va.paper || '');
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(va.subject || '');
      const sGroup = getValueAddSection(va);
      if (matchPaper && matchSubject && sGroup) {
        secSet.add(sGroup);
      }
    });
    return Array.from(secSet).sort(naturalCompare);
  }, [questions, valueAddItems, filters.paper, filters.subjects]);

  const microtopicOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
    const mtSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const micro = getQuestionMicro(q);
      if (matchPaper && matchSubject && matchSec && micro) {
        mtSet.add(micro);
      }
    });
    valueAddItems.forEach(va => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(va.paper || '');
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(va.subject || '');
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getValueAddSection(va));
      const micro = getValueAddMicro(va);
      if (matchPaper && matchSubject && matchSec && micro) {
        mtSet.add(micro);
      }
    });
    return Array.from(mtSet).sort(naturalCompare);
  }, [questions, valueAddItems, filters.paper, filters.subjects, filters.sections]);

  const subtopicOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
    const microtopicFilter = filters.microtopics !== 'All' ? filters.microtopics.split('|') : [];
    const subSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const sub = getQuestionSub(q);
      if (matchPaper && matchSubject && matchSec && matchMicro && sub) {
        subSet.add(sub);
      }
    });
    valueAddItems.forEach(va => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(va.paper || '');
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(va.subject || '');
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getValueAddSection(va));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getValueAddMicro(va));
      const sub = getValueAddSub(va);
      if (matchPaper && matchSubject && matchSec && matchMicro && sub) {
        subSet.add(sub);
      }
    });
    return Array.from(subSet).sort(naturalCompare);
  }, [questions, valueAddItems, filters.paper, filters.subjects, filters.sections, filters.microtopics]);

  const nanotopicOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
    const microtopicFilter = filters.microtopics !== 'All' ? filters.microtopics.split('|') : [];
    const subtopicFilter = filters.subtopics !== 'All' ? filters.subtopics.split('|') : [];
    const ntSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
      const nano = getQuestionNano(q);
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && nano) {
        ntSet.add(nano);
      }
    });
    valueAddItems.forEach(va => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(va.paper || '');
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(va.subject || '');
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getValueAddSection(va));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getValueAddMicro(va));
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getValueAddSub(va));
      const nano = getValueAddNano(va);
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && nano) {
        ntSet.add(nano);
      }
    });
    return Array.from(ntSet).sort(naturalCompare);
  }, [questions, valueAddItems, filters.paper, filters.subjects, filters.sections, filters.microtopics, filters.subtopics]);

  const macrotagOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
    const microtopicFilter = filters.microtopics !== 'All' ? filters.microtopics.split('|') : [];
    const subtopicFilter = filters.subtopics !== 'All' ? filters.subtopics.split('|') : [];
    const nanotopicFilter = filters.nanotopics !== 'All' ? filters.nanotopics.split('|') : [];
    const tagSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
      const matchNano = nanotopicFilter.length === 0 || nanotopicFilter.includes(getQuestionNano(q));
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && matchNano && q.macrotag) {
        q.macrotag.split(',').forEach(t => tagSet.add(t.trim()));
      }
    });
    return Array.from(tagSet).sort();
  }, [questions, filters.paper, filters.subjects, filters.sections, filters.microtopics, filters.subtopics, filters.nanotopics]);

  const microtagOptions = useMemo(() => {
    if (filters.macrotags === 'All') return [];
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
    const microtopicFilter = filters.microtopics !== 'All' ? filters.microtopics.split('|') : [];
    const subtopicFilter = filters.subtopics !== 'All' ? filters.subtopics.split('|') : [];
    const nanotopicFilter = filters.nanotopics !== 'All' ? filters.nanotopics.split('|') : [];
    const macrotagFilter = filters.macrotags !== 'All' ? filters.macrotags.split('|') : [];
    const tagSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
      const matchNano = nanotopicFilter.length === 0 || nanotopicFilter.includes(getQuestionNano(q));
      const matchMacro = macrotagFilter.length === 0 || (q.macrotag || '').split(',').map(t => t.trim()).some(t => macrotagFilter.includes(t));
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && matchNano && matchMacro && q.microtag) {
        q.microtag.split(',').forEach(t => tagSet.add(t.trim()));
      }
    });
    return Array.from(tagSet).sort();
  }, [questions, filters.paper, filters.subjects, filters.sections, filters.microtopics, filters.subtopics, filters.nanotopics, filters.macrotags]);

  const papers = ['All', ...allPapers];

  // ─── ASYNC FILTER ENGINE ───
  // The naive useMemo blocks React rendering for 40+ seconds on large question sets.
  // Instead we run filtering asynchronously and show chip visual feedback instantly.
  const [filteredQuestions, setFilteredQuestions] = useState<ConsolidatedQuestion[]>([]);
  const [filteredValueAdds, setFilteredValueAdds] = useState<ValueAdditionItem[]>([]);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterVersionRef = useRef(0);

  useEffect(() => {
    const version = ++filterVersionRef.current;
    
    // Clear any pending filter
    if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    
    // Schedule filter on next frame so chip UI updates immediately
    filterTimerRef.current = setTimeout(() => {
      const startTs = Date.now();

      // Optimize: Extract filter split operations outside the inner loop!
      const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
      const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
      const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
      const microtopicFilter = filters.microtopics !== 'All' ? filters.microtopics.split('|') : [];
      const subtopicFilter = filters.subtopics !== 'All' ? filters.subtopics.split('|') : [];
      const nanotopicFilter = filters.nanotopics !== 'All' ? filters.nanotopics.split('|') : [];
      const macroFilter = filters.macrotags !== 'All' ? filters.macrotags.split('|') : [];
      const microFilter = filters.microtags !== 'All' ? filters.microtags.split('|') : [];
      const yearFilter = filters.years !== 'All' ? filters.years.split('|') : [];
      
      const selectedInsts = filters.institutes !== 'All' ? filters.institutes.split(',') : null;
      const selectedProgs = filters.program !== 'All' ? filters.program.split(',') : null;
      const selectedTags = filters.revisionTags !== 'All' ? filters.revisionTags.split(',') : null;
      const searchLower = search.trim().toLowerCase();

      // Filter Questions
      const result = questions.filter(q => {
        if (version !== filterVersionRef.current) return false; // stale, abort early

        // PYQ Filter
        if (filters.pyqFilter === 'PYQ Only' && !q.is_pyq) return false;
        if (filters.pyqFilter === 'Non-PYQ' && q.is_pyq) return false;

        // Institute filter
        if (selectedInsts) {
          const instName = q.institute || (q.is_pyq ? 'UPSC' : '');
          if (!instName || !selectedInsts.includes(instName)) return false;
        }

        // Program filter
        if (selectedProgs) {
          if (!q.program_name || !selectedProgs.includes(q.program_name)) return false;
        }

        // Revision tags local filter
        if (selectedTags) {
          const tagsForQ = userQuestionStates[q.id]?.reviewTags || [];
          const hasMatch = selectedTags.some(t => tagsForQ.includes(t));
          if (!hasMatch) return false;
        }

        const subtopicVal = getQuestionSub(q);
        const matchSearch = !searchLower ||
          (q.questionText?.toLowerCase() || '').includes(searchLower) ||
          (subtopicVal.toLowerCase() || '').includes(searchLower) ||
          (q.subject?.toLowerCase() || '').includes(searchLower);

        if (!matchSearch) return false;

        // 1. by default dont show optional question unless chose optional in stage filter in sidebar
        const matchPaper = paperFilter.length === 0
          ? q.paper !== 'Optional'
          : paperFilter.includes(q.paper);
        if (!matchPaper) return false;

        const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
        if (!matchSubject) return false;

        const matchSection = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
        if (!matchSection) return false;

        const matchMicrotopic = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
        if (!matchMicrotopic) return false;

        const matchSubtopic = subtopicFilter.length === 0 || subtopicFilter.includes(subtopicVal);
        if (!matchSubtopic) return false;

        const matchNanotopic = nanotopicFilter.length === 0 || nanotopicFilter.includes(getQuestionNano(q));
        if (!matchNanotopic) return false;

        const matchMacro = macroFilter.length === 0 || (q.macrotag || '').split(',').map(t => t.trim()).some(t => macroFilter.includes(t));
        if (!matchMacro) return false;

        const matchMicroTag = microFilter.length === 0 || (q.microtag || '').split(',').map(t => t.trim()).some(t => microFilter.includes(t));
        if (!matchMicroTag) return false;

        const matchYear = yearFilter.length === 0 || yearFilter.includes(String(q.year || ''));
        if (!matchYear) return false;

        return true;
      });

      // Filter Value Additions
      const valAddResult = valueAddItems.filter(va => {
        if (version !== filterVersionRef.current) return false; // stale, abort early

        // PYQ Filter: Value additions are not PYQs, so if pyqFilter is 'PYQ Only', we hide them
        if (filters.pyqFilter === 'PYQ Only') return false;

        // Paper filter
        if (paperFilter.length > 0) {
          const matchPaper = paperFilter.includes(va.paper || '');
          if (!matchPaper) return false;
        } else {
          if (va.paper === 'Optional') return false;
        }

        // Subject filter
        if (subjectFilter.length > 0) {
          const matchSubject = subjectFilter.includes(va.subject || '');
          if (!matchSubject) return false;
        }

        // Section group filter
        if (sectionFilter.length > 0) {
          const matchSection = sectionFilter.includes(getValueAddSection(va));
          if (!matchSection) return false;
        }

        // Microtopic filter
        if (microtopicFilter.length > 0) {
          const matchMicro = microtopicFilter.includes(getValueAddMicro(va));
          if (!matchMicro) return false;
        }

        // Subtopic filter
        if (subtopicFilter.length > 0) {
          const matchSub = subtopicFilter.includes(getValueAddSub(va));
          if (!matchSub) return false;
        }

        // Nanotopic filter
        if (nanotopicFilter.length > 0) {
          const matchNano = nanotopicFilter.includes(getValueAddNano(va));
          if (!matchNano) return false;
        }

        // Search text matching
        if (searchLower) {
          const matchSearch = (va.title?.toLowerCase() || '').includes(searchLower) ||
            (va.subject?.toLowerCase() || '').includes(searchLower) ||
            (getValueAddSub(va).toLowerCase() || '').includes(searchLower);
          if (!matchSearch) return false;
        }

        return true;
      });

      if (version === filterVersionRef.current) {
        const elapsed = Date.now() - startTs;
        if (elapsed > 100) {
          console.log(`[QuestionBank] filter took ${elapsed}ms for ${questions.length} questions → ${result.length} results`);
        }
        // Sort: PYQ first → Non-PYQ, year descending, GS1→GS2→GS3→GS4, same-subject together
        const paperOrder: Record<string, number> = { GS1: 0, GS2: 1, GS3: 2, GS4: 3, Essay: 4, Optional: 5 };
        result.sort((a, b) => {
          // 1. PYQ before Non-PYQ
          if (a.is_pyq && !b.is_pyq) return -1;
          if (!a.is_pyq && b.is_pyq) return 1;
          // 2. Year descending
          const yearA = a.year || 0;
          const yearB = b.year || 0;
          if (yearA !== yearB) return yearB - yearA;
          // 3. GS paper order
          const orderA = paperOrder[a.paper] ?? 99;
          const orderB = paperOrder[b.paper] ?? 99;
          if (orderA !== orderB) return orderA - orderB;
          // 4. Same subject together
          const subA = a.subject || '';
          const subB = b.subject || '';
          if (subA !== subB) return subA.localeCompare(subB);
          // 5. Same section together
          const secA = getQuestionSection(a);
          const secB = getQuestionSection(b);
          if (secA !== secB) return secA.localeCompare(secB);
          return 0;
        });
        setFilteredQuestions(result);
        setFilteredValueAdds(valAddResult);
      }
    }, 0); // defer to next frame

    return () => {
      if (filterTimerRef.current) clearTimeout(filterTimerRef.current);
    };
  }, [search, filters, questions, valueAddItems, userQuestionStates]);

  const activeContent = useMemo(() => {
    let list: any[] = [];
    if (viewMode === 'questions') {
      list = filteredQuestions;
    } else if (viewMode === 'valueAdd') {
      list = filteredValueAdds;
    } else {
      list = [...filteredQuestions, ...filteredValueAdds];
    }

    // Sort: favorites first for value addition cards
    const sorted = [...list].sort((a, b) => {
      const isAValAdd = !a.hasOwnProperty('questionText');
      const isBValAdd = !b.hasOwnProperty('questionText');
      
      const aFav = (isAValAdd && vaFavorites.has(a.id)) ? 1 : 0;
      const bFav = (isBValAdd && vaFavorites.has(b.id)) ? 1 : 0;
      
      if (aFav !== bFav) {
        return bFav - aFav;
      }
      return 0;
    });

    return sorted;
  }, [viewMode, filteredQuestions, filteredValueAdds, vaFavorites]);

  return (
    <View style={styles.subContainer}>
      <View style={styles.ipadBody}>
        {sidebarOpen && (
          <View style={{ width: 260, borderRightWidth: 0.5, borderRightColor: colors.border }}>
            <MainsLeftPanel
              colors={colors}
              insets={insets}
              isTablet={isTablet}
              filters={filters}
              onUpdateFilters={setFiltersDeferred}
              allPapers={allPapers}
              subjectOptions={subjectOptions}
              sectionOptions={sectionOptions}
              microtopicOptions={microtopicOptions}
              subtopicOptions={subtopicOptions}
              nanotopicOptions={nanotopicOptions}
              macrotagOptions={macrotagOptions}
              microtagOptions={microtagOptions}
              isSearchView={false}
              totalCount={filteredQuestions.length + filteredValueAdds.length}
              allInstitutes={allInstitutes}
              allPrograms={allPrograms}
              userTags={userTags}
              onCloseSidebar={() => setSidebarOpen(false)}
              allYears={allYears}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          {showZoomIndicator && (
            <View style={{
              position: 'absolute',
              top: insets.top + 60,
              alignSelf: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              zIndex: 9999,
            }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>ZOOM: {Math.round(zoomScale * 100)}%</Text>
            </View>
          )}

          <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
            <View style={{ flex: 1 }}>
              <FlatList
                ref={flatListRef}
          data={activeContent}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listScroll}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            ListHeaderComponent={
              <View style={{ paddingBottom: 10 }}>
                {/* Spacer for floating back button */}
                <View style={{ height: insets.top + 48 }} />

                {/* Large Input & Filter Scroll */}
                <View style={styles.filterSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => {
                        if (!filteredQuestions || filteredQuestions.length === 0) {
                          Alert.alert('No Questions', 'There are no questions to export.');
                          return;
                        }
                        const rows = filteredQuestions.map((q: ConsolidatedQuestion) => ({
                          id: q.id,
                          question_text: q.questionText,
                          statement: q.questionText,
                          subject: q.subject,
                          section_group: q.sectionGroup,
                          micro_topic: q.microTopic,
                          sub_topic: q.subTopic,
                          exam_year: q.year,
                          is_pyq: q.is_pyq,
                          marks: q.marks,
                          paper: q.paper,
                          macrotag: q.macrotag,
                          microtag: q.microtag,
                          _explanations: (q.answers || []).map((a: any) => ({
                            source: a.institute,
                            text: a.answerText,
                          })),
                        }));
                        setExportPayload({ kind: 'questions', rows });
                        setExportSheetVisible(true);
                      }}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileDown size={20} color={colors.primary} />
                    </TouchableOpacity>
                    {!sidebarOpen && (
                      <TouchableOpacity
                        onPress={() => setSidebarOpen(true)}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          alignItems: 'center',
                          justifyContent: 'center',
                          shadowColor: colors.primary,
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          shadowOffset: { width: 0, height: 2 },
                          elevation: 3,
                        }}
                      >
                        <ChevronRight size={20} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                    <View style={[styles.largeSearchInput, { flex: 1, backgroundColor: colors.surface + '66', borderColor: 'rgba(255,255,255,0.7)', height: 60, borderRadius: 20, marginBottom: 0 }]}>
                      <Search size={20} color="#94a3b8" style={{ marginRight: 12 }} />
                      <TextInput
                        placeholder="Search questions, topics, themes..."
                        placeholderTextColor="#94a3b8"
                        value={search}
                        onChangeText={setSearch}
                        style={[styles.largeSearchText, { color: colors.textPrimary, fontSize: 15 }]}
                      />
                      {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                          <X size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* ─── VIEW MODE SWITCHER ─── */}
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 2 }}>
                    {(['all', 'questions', 'valueAdd'] as const).map(mode => {
                      const labels: Record<string, string> = { all: 'All', questions: 'Questions Only', valueAdd: 'Value Additions Only' };
                      const counts: Record<string, number> = { all: filteredQuestions.length + filteredValueAdds.length, questions: filteredQuestions.length, valueAdd: filteredValueAdds.length };
                      const colors_map: Record<string, string> = { all: '#7c3aed', questions: '#3b82f6', valueAdd: '#10b981' };
                      const isActive = viewMode === mode;
                      return (
                        <TouchableOpacity
                          key={mode}
                          onPress={() => setViewMode(mode)}
                          style={[
                            styles.filterPill,
                            {
                              backgroundColor: isActive ? colors_map[mode] : (colors.surface + 'b3'),
                              borderColor: isActive ? colors_map[mode] : colors.border,
                              paddingVertical: 5,
                              paddingHorizontal: 10,
                            }
                          ]}
                        >
                          <Text style={[styles.filterPillText, { color: isActive ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 11 }]}>
                            {labels[mode]}
                          </Text>
                          <View style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.border, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 5 }}>
                            <Text style={{ fontSize: 9, fontWeight: '900', color: isActive ? '#fff' : colors.textTertiary }}>{counts[mode]}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {(() => {
                    const hasHierarchyActive = filters.paper !== 'All' || filters.subjects !== 'All' || filters.sections !== 'All' || filters.microtopics !== 'All' || filters.subtopics !== 'All' || filters.nanotopics !== 'All' || filters.macrotags !== 'All' || filters.microtags !== 'All';
                    const activeHierarchyLabel = filters.nanotopics !== 'All' ? filters.nanotopics : (filters.subtopics !== 'All' ? filters.subtopics : (filters.microtopics !== 'All' ? filters.microtopics : (filters.sections !== 'All' ? filters.sections : (filters.subjects !== 'All' ? filters.subjects : (filters.paper !== 'All' ? filters.paper : 'Browse Topics')))));
                    
                    return (
                      <View style={{ gap: 8, paddingHorizontal: 2 }}>
                        <ScrollView 
                          horizontal 
                          showsHorizontalScrollIndicator={false} 
                          contentContainerStyle={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}
                        >
                          {/* Browse Topics Pill */}
                          <TouchableOpacity
                            onPress={() => setHierarchyModalVisible(true)}
                            style={[
                              styles.filterPill,
                              hasHierarchyActive
                                ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                                : { backgroundColor: colors.surface + 'b3', borderColor: colors.border }
                            ]}
                          >
                            <BookOpen size={12} color={hasHierarchyActive ? '#fff' : '#3b82f6'} style={{ marginRight: 4 }} />
                            <Text style={[styles.filterPillText, { color: hasHierarchyActive ? '#fff' : colors.textSecondary, fontWeight: '700' }]}>
                              {hasHierarchyActive ? truncateText(activeHierarchyLabel, 40) : 'Browse Topics'}
                            </Text>
                            <ChevronDown size={12} color={hasHierarchyActive ? '#fff' : colors.textTertiary} style={{ marginLeft: 4 }} />
                          </TouchableOpacity>

                          <View style={{ width: 1, height: 16, backgroundColor: colors.border }} />

                          {/* Dynamic Cascading Pills */}
                          {(() => {
                            if (filters.paper === 'All') {
                              // Level 1: Paper Selection
                              return (
                                <>
                                  {papers.map(p => {
                                    const isActive = p === 'All' ? filters.paper === 'All' : filters.paper.split('|').includes(p);
                                    return (
                                      <TouchableOpacity
                                        key={p}
                                        onPress={() => {
                                          if (p === 'All') {
                                            setFiltersDeferred(prev => ({ ...prev, paper: 'All', subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' }));
                                          } else {
                                            setFiltersDeferred(prev => ({ ...prev, paper: p }));
                                          }
                                        }}
                                        style={[
                                          styles.tabFilterPill,
                                          isActive
                                            ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                                            : { backgroundColor: colors.surface + 'b3', borderColor: colors.border }
                                        ]}
                                      >
                                        <Text style={[styles.tabFilterPillText, isActive ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                                          {p}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </>
                              );
                            }

                            if (filters.subjects === 'All') {
                              // Level 2: Subject Selection
                              return (
                                <>
                                  <TouchableOpacity
                                    onPress={() => setFiltersDeferred(prev => ({ ...prev, paper: 'All' }))}
                                    style={[styles.tabFilterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                                  >
                                    <Text style={[styles.tabFilterPillText, { color: '#ef4444', fontWeight: '800' }]}>← Back</Text>
                                  </TouchableOpacity>
                                  {subjectOptions.map(sub => (
                                    <TouchableOpacity
                                      key={sub}
                                      onPress={() => setFiltersDeferred(prev => ({ ...prev, subjects: sub }))}
                                      style={[styles.tabFilterPill, { backgroundColor: colors.surface + 'b3', borderColor: '#8b5cf6' }]}
                                    >
                                      <Text style={[styles.tabFilterPillText, { color: '#8b5cf6' }]}>{sub}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </>
                              );
                            }

                            if (filters.sections === 'All') {
                              // Level 3: Section Selection
                              return (
                                <>
                                  <TouchableOpacity
                                    onPress={() => setFiltersDeferred(prev => ({ ...prev, subjects: 'All' }))}
                                    style={[styles.tabFilterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                                  >
                                    <Text style={[styles.tabFilterPillText, { color: '#ef4444', fontWeight: '800' }]}>← Back</Text>
                                  </TouchableOpacity>
                                  {sectionOptions.map(sec => (
                                    <TouchableOpacity
                                      key={sec}
                                      onPress={() => setFiltersDeferred(prev => ({ ...prev, sections: sec }))}
                                      style={[styles.tabFilterPill, { backgroundColor: colors.surface + 'b3', borderColor: '#f59e0b' }]}
                                    >
                                      <Text style={[styles.tabFilterPillText, { color: '#f59e0b' }]}>{sec}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </>
                              );
                            }

                            if (filters.microtopics === 'All') {
                              // Level 4: Microtopic Selection
                              return (
                                <>
                                  <TouchableOpacity
                                    onPress={() => setFiltersDeferred(prev => ({ ...prev, sections: 'All' }))}
                                    style={[styles.tabFilterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                                  >
                                    <Text style={[styles.tabFilterPillText, { color: '#ef4444', fontWeight: '800' }]}>← Back</Text>
                                  </TouchableOpacity>
                                  {microtopicOptions.map(mt => (
                                    <TouchableOpacity
                                      key={mt}
                                      onPress={() => setFiltersDeferred(prev => ({ ...prev, microtopics: mt }))}
                                      style={[styles.tabFilterPill, { backgroundColor: colors.surface + 'b3', borderColor: '#10b981' }]}
                                    >
                                      <Text style={[styles.tabFilterPillText, { color: '#10b981' }]}>{mt}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </>
                              );
                            }

                            if (filters.subtopics === 'All') {
                              // Level 5: Subtopic Selection
                              return (
                                <>
                                  <TouchableOpacity
                                    onPress={() => setFiltersDeferred(prev => ({ ...prev, microtopics: 'All' }))}
                                    style={[styles.tabFilterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                                  >
                                    <Text style={[styles.tabFilterPillText, { color: '#ef4444', fontWeight: '800' }]}>← Back</Text>
                                  </TouchableOpacity>
                                  {subtopicOptions.map(st => (
                                    <TouchableOpacity
                                      key={st}
                                      onPress={() => setFiltersDeferred(prev => ({ ...prev, subtopics: st }))}
                                      style={[styles.tabFilterPill, { backgroundColor: colors.surface + 'b3', borderColor: '#f43f5e' }]}
                                    >
                                      <Text style={[styles.tabFilterPillText, { color: '#f43f5e' }]}>{st}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </>
                              );
                            }

                            if (filters.nanotopics === 'All') {
                              // Level 6: Nanotopic Selection
                              return (
                                <>
                                  <TouchableOpacity
                                    onPress={() => setFiltersDeferred(prev => ({ ...prev, subtopics: 'All' }))}
                                    style={[styles.tabFilterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                                  >
                                    <Text style={[styles.tabFilterPillText, { color: '#ef4444', fontWeight: '800' }]}>← Back</Text>
                                  </TouchableOpacity>
                                  {nanotopicOptions.map(nt => (
                                    <TouchableOpacity
                                      key={nt}
                                      onPress={() => setFiltersDeferred(prev => ({ ...prev, nanotopics: nt }))}
                                      style={[styles.tabFilterPill, { backgroundColor: colors.surface + 'b3', borderColor: '#ec4899' }]}
                                    >
                                      <Text style={[styles.tabFilterPillText, { color: '#ec4899' }]}>{nt}</Text>
                                    </TouchableOpacity>
                                  ))}
                                </>
                              );
                            }

                            // Fully selected up to Level 6
                            return (
                              <TouchableOpacity
                                onPress={() => setFiltersDeferred(prev => ({ ...prev, nanotopics: 'All' }))}
                                style={[styles.tabFilterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                              >
                                <Text style={[styles.tabFilterPillText, { color: '#ef4444', fontWeight: '800' }]}>← Back</Text>
                              </TouchableOpacity>
                            );
                          })()}

                          {hasHierarchyActive && (
                            <>
                              <View style={{ width: 1, height: 16, backgroundColor: colors.border }} />
                              <TouchableOpacity
                                onPress={() => setFiltersDeferred({ ...DEFAULT_MAINS_FILTERS })}
                                style={[styles.filterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                              >
                                <X size={12} color="#ef4444" style={{ marginRight: 4 }} />
                                <Text style={[styles.filterPillText, { color: '#ef4444', fontWeight: '700' }]}>Clear All</Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </ScrollView>

                        {/* Active Breadcrumb Badges — tap anywhere on chip to remove that layer */}
                        {hasHierarchyActive && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4, paddingBottom: 2 }}>
                            {filters.paper !== 'All' && filters.paper.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-paper-${val}`}
                                onPress={() => {
                                  const updated = filters.paper.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    paper: updated, 
                                    subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#1e40af' }}>{val}</Text>
                                <X size={10} color="#1e40af" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                            {filters.subjects !== 'All' && filters.subjects.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-subject-${val}`}
                                onPress={() => {
                                  const updated = filters.subjects.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    subjects: updated, 
                                    sections: 'All', microtopics: 'All', subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#6b21a8' }}>{val}</Text>
                                <X size={10} color="#6b21a8" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                            {filters.sections !== 'All' && filters.sections.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-section-${val}`}
                                onPress={() => {
                                  const updated = filters.sections.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    sections: updated, 
                                    microtopics: 'All', subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400e' }}>{val}</Text>
                                <X size={10} color="#92400e" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                            {filters.microtopics !== 'All' && filters.microtopics.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-micro-${val}`}
                                onPress={() => {
                                  const updated = filters.microtopics.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    microtopics: updated, 
                                    subtopics: 'All', nanotopics: 'All', macrotags: 'All', microtags: 'All' 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#d1fae5', borderColor: '#a7f3d0' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#065f46' }}>{val}</Text>
                                <X size={10} color="#065f46" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                            {filters.subtopics !== 'All' && filters.subtopics.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-sub-${val}`}
                                onPress={() => {
                                  const updated = filters.subtopics.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    subtopics: updated, 
                                    nanotopics: 'All', macrotags: 'All', microtags: 'All' 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#be123c' }}>{val}</Text>
                                <X size={10} color="#be123c" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                            {filters.nanotopics !== 'All' && filters.nanotopics.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-nanotopic-${val}`}
                                onPress={() => {
                                  const updated = filters.nanotopics.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    nanotopics: updated, 
                                    macrotags: 'All', microtags: 'All' 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#fce4ec', borderColor: '#f8bbd0' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#880e4f' }}>{val}</Text>
                                <X size={10} color="#880e4f" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                            {filters.macrotags !== 'All' && filters.macrotags.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-macro-${val}`}
                                onPress={() => {
                                  const updated = filters.macrotags.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    macrotags: updated, 
                                    microtags: 'All' 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#e0f7fa', borderColor: '#b2ebf2' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#006064' }}>{val}</Text>
                                <X size={10} color="#006064" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                            {filters.microtags !== 'All' && filters.microtags.split('|').map(val => (
                              <TouchableOpacity
                                key={`crumb-microtag-${val}`}
                                onPress={() => {
                                  const updated = filters.microtags.split('|').filter(x => x !== val).join('|') || 'All';
                                  setFiltersDeferred(prev => ({ 
                                    ...prev, 
                                    microtags: updated 
                                  }));
                                }}
                                activeOpacity={0.7}
                                style={[styles.breadcrumbChip, { backgroundColor: '#fce4ec', borderColor: '#f8bbd0' }]}
                              >
                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#880e4f' }}>{val}</Text>
                                <X size={10} color="#880e4f" style={{ marginLeft: 4 }} />
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })()}
                </View>
              </View>
            }
            renderItem={({ item }) => {
              // ── VALUE ADDITION CARD ──
              if ((item as any).category !== undefined && !(item as any).questionText) {
                const va = item as ValueAdditionItem;
                return (
                  <View key={va.id} style={[styles.figmaQuestionCard, { backgroundColor: 'rgba(236,253,245,0.7)', borderColor: 'rgba(16,185,129,0.3)', marginBottom: 12, borderWidth: 1.5 }]}>
                    {/* VA Header badge */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
                      <View style={{ backgroundColor: '#d1fae5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#059669', letterSpacing: 0.5 }}>VALUE ADDITION</Text>
                      </View>
                      <View style={{ backgroundColor: '#f0fdf4', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#bbf7d0' }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#047857' }}>{va.paper || ''}{va.paper && va.subject ? ' · ' : ''}{va.subject || ''}</Text>
                      </View>
                    </View>
                    <ValueAdditionCard
                      item={va}
                      colors={colors}
                      isDark={isDark}
                      copiedId={copiedId}
                      onCopy={onCopy}
                      width="100%"
                      onAddFlashcardClick={onAddFlashcardClick}
                      zoomScale={zoomScale}
                      userTags={userTags}
                      valueAddTags={valueAddTags}
                      onToggleValueAddTag={onToggleValueAddTag}
                      onCreateTag={onCreateTag}
                      vaFavorites={vaFavorites}
                      onToggleVaFavorite={onToggleVaFavorite}
                    />
                  </View>
                );
              }

              // ── QUESTION CARD ──
              const q = item as ConsolidatedQuestion;
              const isExpanded = expandedId === q.id;
              const isBookmarked = savedIds.includes(q.id);

              return (
                <View
                  key={q.id}
                  onLayout={(event) => {
                    cardYOffsets.current[q.id] = event.nativeEvent.layout.y;
                  }}
                  style={[
                    styles.figmaQuestionCard,
                    { backgroundColor: 'rgba(255, 255, 255, 0.45)', borderColor: 'rgba(255, 255, 255, 0.65)', marginBottom: 12 },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      if (isExpanded) {
                        setExpandedId(null);
                      } else {
                        setExpandedId(q.id);
                        const y = cardYOffsets.current[q.id];
                        if (typeof y === 'number') {
                          setTimeout(() => {
                            flatListRef.current?.scrollToOffset({ offset: Math.max(0, y - 10), animated: true });
                          }, 120);
                        }
                      }
                    }}
                    style={styles.qCardHeaderSpacious}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.badgeRow}>
                        <Text style={[styles.paperBadgeText, { color: '#3b82f6', fontSize: Math.round(zoomFontSize * 0.65) }]}>{q.paper}</Text>
                        <Text style={[styles.metaTextDot, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>•</Text>
                        <Text style={[styles.metaText, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>{q.year}</Text>
                        <Text style={[styles.metaTextDot, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>•</Text>
                        <Text style={[styles.metaText, { color: colors.textTertiary, fontSize: Math.round(zoomFontSize * 0.7) }]}>{q.marks} Marks</Text>
                      </View>
                      <Text style={[styles.questionTitleText, { color: colors.textPrimary, fontSize: zoomFontSize, lineHeight: Math.round(zoomFontSize * 1.35) }]}>
                        {q.questionText}
                      </Text>
                    </View>
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity onPress={() => onOpenDetailed(q)} style={styles.actionIconButton}>
                        <ExternalLink size={20} color={colors.textTertiary} />
                      </TouchableOpacity>
                      <ChevronDown
                        size={22}
                        color={colors.textTertiary}
                        style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] as any }}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[
                      styles.answerContainerSpacious,
                      {
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                        borderTopWidth: 1,
                      }
                    ]}>
                      {q.answers && q.answers.length > 0 ? (() => {
                        const cleanAnsList = getCleanAvailableAnswers(q.answers);
                        if (cleanAnsList.length === 0) {
                          return (
                            <View style={{ padding: 12 }}>
                              <Text style={{ fontSize: 13, color: colors.textTertiary, fontStyle: 'italic' }}>
                                No solved answers available for this question.
                              </Text>
                            </View>
                          );
                        }
                        
                        const currentInst = selectedInstitutes[q.id] || cleanAnsList[0].institute;
                        const activeAnswer = cleanAnsList.find(ans => ans.institute === currentInst) || cleanAnsList[0];

                        return (
                          <View>
                            {/* Horizontal Tab Bar of Institutes */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                              {cleanAnsList.map(ans => (
                                <TouchableOpacity
                                  key={ans.institute}
                                  onPress={() => setSelectedInstitutes(prev => ({ ...prev, [q.id]: ans.institute }))}
                                  style={[
                                    styles.segmentButton,
                                    {
                                      marginRight: 6,
                                      paddingHorizontal: 12,
                                      paddingVertical: 6,
                                      borderRadius: 8,
                                      borderWidth: 0.5,
                                      borderColor: currentInst === ans.institute ? '#3b82f6' : colors.border
                                    },
                                    currentInst === ans.institute
                                      ? { backgroundColor: '#3b82f6' }
                                      : { backgroundColor: colors.surface + '88' }
                                  ]}
                                >
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: '800',
                                      color: currentInst === ans.institute ? '#ffffff' : colors.textTertiary
                                    }}
                                  >
                                    {ans.institute}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>

                            {/* Render Answer Text in Markdown */}
                            {(() => {
                              const parsed = parseIntroductoryBox(activeAnswer.answerText);
                              if (parsed) {
                                const approachZoom = Math.round(14 * zoomScale);
                                return (
                                  <View style={{ marginTop: 8 }}>
                                    <ApproachBox content={parsed.body} title={parsed.title} colors={colors} zoomFontSize={approachZoom} isDark={isDark} />
                                    <Markdown style={dynamicMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
                                      {cleanMarkdown(activeAnswer.answerText.replace(parsed.rawMatch, '').trim())}
                                    </Markdown>
                                  </View>
                                );
                              }
                              return (
                                <View style={{ marginTop: 8 }}>
                                  <Markdown style={dynamicMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
                                    {cleanMarkdown(activeAnswer.answerText)}
                                  </Markdown>
                                </View>
                              );
                            })()}
                          </View>
                        );
                      })() : (
                        <View style={{ padding: 12 }}>
                          <Text style={{ fontSize: 13, color: colors.textTertiary, fontStyle: 'italic' }}>
                            No solved answers available for this question.
                          </Text>
                        </View>
                      )}
                      {renderTaxonomyStrip(q, colors, isDark)}
                    </View>
                  )}
                </View>
              );
            }}
          />
            </View>
          </PinchGestureHandler>
        </View>
      </View>



      <HierarchyModal
        visible={hierarchyModalVisible}
        onClose={() => setHierarchyModalVisible(false)}
        colors={colors}
        filters={filters}
        onUpdateFilters={setFilters}
        allPapers={allPapers}
        subjectOptions={subjectOptions}
        sectionOptions={sectionOptions}
        microtopicOptions={microtopicOptions}
        subtopicOptions={subtopicOptions}
        macrotagOptions={macrotagOptions}
        microtagOptions={microtagOptions}
        isTablet={isTablet}
        questions={questions}
      />

      <UnifiedExportSheet
        visible={exportSheetVisible}
        onClose={() => setExportSheetVisible(false)}
        payload={exportPayload}
        title="Mains Question Bank"
        initialOptions={{
          title: 'Mains Question Bank Export',
          moduleName: 'Mains PYQ',
          headerText: 'Dr. UPSC · Mains PYQ',
          footerText: 'Generated by Dr. UPSC',
        }}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. VALUE ADDITION VIEW
// ─────────────────────────────────────────────────────────────────────────────
function ValueAdditionView({
  colors,
  copiedId,
  onCopy,
  isTablet,
  insets,
  valueAddItems,
  activeCategory,
  setActiveCategory,
  onAddFlashcardClick,
  valueAddTags = {},
  onToggleValueAddTag,
  onCreateTag,
  userTags = [],
  vaFavorites = new Set<string>(),
  onToggleVaFavorite,
}: {
  colors: any;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  isTablet: boolean;
  insets: any;
  valueAddItems: ValueAdditionItem[];
  activeCategory: string | null;
  setActiveCategory: (cat: string | null) => void;
  onAddFlashcardClick?: (item: any, front: string, back: string) => void;
  valueAddTags?: Record<string, string[]>;
  onToggleValueAddTag?: (cardId: string, tag: string) => void;
  onCreateTag?: (tag: string) => void;
  userTags?: string[];
  vaFavorites?: Set<string>;
  onToggleVaFavorite?: (cardId: string) => void;
}) {
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [ethicsTab, setEthicsTab] = useState<'diagrams' | 'dimensions' | 'comparisons' | 'innovations' | 'pyq_quotes' | 'keywords' | 'philosophies' | 'dilemmas' | 'phrases' | 'khemka_toolkit' | 'all_formats'>('diagrams');
  const [khemkaSubTab, setKhemkaSubTab] = useState<'skeleton' | 'rules' | 'toolkit' | 'cases'>('cases');
  const [vaHubCategories, setVaHubCategories] = useState<string[]>([]);
  const [chipVaHubCategories, setChipVaHubCategories] = useState<string[]>([]);
  const [chipEthicsTab, setChipEthicsTab] = useState<any>('diagrams');
  const [chipKhemkaSubTab, setChipKhemkaSubTab] = useState<any>('cases');
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);
  const [imageCopying, setImageCopying] = useState(false);

  const handleCopyImage = async (uri: string) => {
    setImageCopying(true);
    try {
      if (uri.startsWith('http')) {
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            const base64data = reader.result as string;
            const base64 = base64data.split(',')[1];
            await Clipboard.setImageAsync(base64);
            Alert.alert('Success', 'Image copied to clipboard!');
          } catch (err) {
            await Clipboard.setStringAsync(uri);
            Alert.alert('Copied', 'Image URL copied to clipboard!');
          } finally {
            setImageCopying(false);
          }
        };
        reader.readAsDataURL(blob);
      } else {
        await Clipboard.setStringAsync(uri);
        Alert.alert('Copied', 'Image path copied to clipboard!');
        setImageCopying(false);
      }
    } catch (e) {
      await Clipboard.setStringAsync(uri);
      Alert.alert('Copied', 'Image link copied to clipboard!');
      setImageCopying(false);
    }
  };

  // Sync deferred chip states when actual state changes to avoid lag
  useEffect(() => {
    setChipEthicsTab(ethicsTab);
  }, [ethicsTab]);

  useEffect(() => {
    setChipKhemkaSubTab(khemkaSubTab);
  }, [khemkaSubTab]);

  // Actual filter states — used in filteredItems useMemo (may trigger heavy recompute)
  const [templateFilter, setTemplateFilter] = useState<'All' | 'Templates' | 'IntroConclusionOnly'>('All');
  const [quotesEntryTypeTab, setQuotesEntryTypeTab] = useState<'All' | 'quote' | 'anecdote' | 'connecting_words'>('All');

  // Immediate chip UI states — update instantly on press so chip appears selected without waiting for filteredItems recompute
  const [chipTemplateFilter, setChipTemplateFilter] = useState<'All' | 'Templates' | 'IntroConclusionOnly'>('All');
  const [chipQuotesEntryTypeTab, setChipQuotesEntryTypeTab] = useState<'All' | 'quote' | 'anecdote' | 'connecting_words'>('All');

  // Pinch-to-zoom state for Value Additions (ranges from 12 to 32, default 16, representing font size base)
  const [zoomFontSize, setZoomFontSize] = useState<number>(16);
  const baseFontSizeRef = React.useRef<number>(16);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimerRef = React.useRef<any>(null);

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    let next = baseFontSizeRef.current * scale;
    next = Math.max(12, Math.min(32, next));
    setZoomFontSize(Math.round(next));
    setShowZoomIndicator(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1200);
  };

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GHState.END || event.nativeEvent.state === GHState.CANCELLED) {
      baseFontSizeRef.current = zoomFontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const zoomScale = zoomFontSize / 16;
  
  // Per-category Hierarchy Filters state — each tab maintains its own independent filters
  const [categoryFilters, setCategoryFilters] = useState<Record<string, MainsFilters>>({});
  const _catKey: string = activeCategory ?? 'root';
  const filters: MainsFilters = categoryFilters[_catKey] || DEFAULT_MAINS_FILTERS;
  const setFilters = (updater: MainsFilters | ((prev: MainsFilters) => MainsFilters)) => {
    setTimeout(() => {
      setCategoryFilters(prev => {
        const current = prev[_catKey] || DEFAULT_MAINS_FILTERS;
        const next = typeof updater === 'function' ? (updater as (p: MainsFilters) => MainsFilters)(current) : updater;
        return { ...prev, [_catKey]: next };
      });
    }, 0);
  };

  const [hierarchyModalVisible, setHierarchyModalVisible] = useState(false);
  const [showVaTagsDropdown, setShowVaTagsDropdown] = useState(false);
  
  // Layout columns state (1 or 2 columns on Tablet)
  const [layoutColumns, setLayoutColumns] = useState<number>(isTablet ? 2 : 1);

  // Lazy loading state for performance optimization
  const [visibleLimit, setVisibleLimit] = useState<number>(5);

  useEffect(() => {
    setVisibleLimit(5);
    const timer = setTimeout(() => {
      setVisibleLimit(15);
    }, 50);
    return () => clearTimeout(timer);
  }, [activeCategory, ethicsTab, search, filters]);

  const submodules = [
    { id: 'data_facts', title: 'Data & Facts', subtitle: 'Sunya IAS & Metrics', icon: BarChart3, color: '#3b82f6', desc: 'Muted stats, percentages, and indicators sorted for instant citation.' },
    { id: 'intro_conclusion', title: 'Intro & Conclusion', subtitle: 'Readymade Templates', icon: AlignLeft, color: '#10b981', desc: 'Pre-crafted hooks and forward-looking administrative closures for major themes.' },
    { id: 'quotes', title: 'Quotes & Anecdotes', subtitle: 'Thinkers & Essay Hooks', icon: Quote, color: '#8b5cf6', desc: 'Thinker quotes and moral stories sorted by theme with usage guidelines.' },
    { id: 'mnemonics', title: 'Mnemonics', subtitle: 'Memory Hooks', icon: Brain, color: '#f59e0b', desc: 'Abbreviations and memory structures for quick syllabus topic recovery.' },
    { id: 'frameworks', title: 'Frameworks', subtitle: 'Argument Structures', icon: Layers, color: '#f43f5e', desc: 'Socio-political and administrative boxes (PESTLE, SWOT) to structure arguments.' },
    { id: 'ethics', title: 'Ethics Specific Hub', subtitle: 'GS4 X-Factor Value Add', icon: ShieldCheck, color: '#06b6d4', desc: 'Ethics diagrams, comparisons, innovations, and keyword toolkits.' },
    { id: 'keywords_hub', title: 'Keywords', subtitle: 'Mains Keywords Hub', icon: Hash, color: '#ec4899', desc: 'Core vocabulary and definition keys to elevate your writing.' },
    { id: 'case_studies_hub', title: 'Case Studies', subtitle: 'Landmark Examples', icon: Briefcase, color: '#f97316', desc: 'Real-world case studies and examples to validate arguments.' },
    { id: 'sc_judgments_hub', title: 'SC Judgments', subtitle: 'Supreme Court Rulings', icon: Scale, color: '#ef4444', desc: 'Landmark court judgments and articles for legal arguments.' },
    { id: 'va_hub', title: 'VA Hub', subtitle: 'Consolidated Value Additions', icon: Zap, color: '#7c3aed', desc: 'A unified view of data facts, templates, quotes, frameworks, ethics, mnemonics, keywords, case studies, and SC judgments.' }
  ];

  const activeVaTags = useMemo(() => {
    const tags = new Set<string>();
    const DEFAULT_TAGS = ['Imp. Fact', 'Imp. Concept', 'Trap Question', 'Must Revise', 'Memorize'];
    DEFAULT_TAGS.forEach(t => tags.add(t));
    (userTags || []).forEach(t => tags.add(t));
    Object.values(valueAddTags || {}).forEach((list: string[]) => {
      (list || []).forEach(t => tags.add(t));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [userTags, valueAddTags]);

  const uniqueValueAddItems = useMemo(() => {
    const uniques = getUniqueValueAddItems(valueAddItems);
    return uniques.map(item => {
      const parsedSubThemes = splitSubThemes(item.context);
      const parsedSubSubThemes = splitSubSubThemes(item.context);
      
      const cleanedFullContext = cleanDataFactsMarkdown(item.context, item);
      
      const searchableText = [
        item.title || '',
        item.category === 'data_facts' ? item.metric || '' : '',
        item.introduction || '',
        item.conclusion || '',
        item.quoteText || '',
        item.usageGuide || '',
        item.mnemonicKeyword || '',
        item.microtopic || '',
        item.subtopic || '',
        item.examples || '',
        parsedSubThemes.map(s => `${s.title} ${s.content}`).join(' ')
      ].join(' ').toLowerCase();

      return {
        ...item,
        parsedSubThemes,
        parsedSubSubThemes,
        cleanedFullContext,
        searchableText
      };
    });
  }, [valueAddItems]);

  // Dynamic Options extraction for HierarchyModal based on value addition items
  const activeCategoryItems = useMemo(() => {
    return uniqueValueAddItems.filter(item => {
      if (activeCategory !== 'va_hub' && item.category !== activeCategory) return false;

      // If we are in Ethics, filter by the active sub-tab (or Khemka sub-tab) to only show relevant hierarchy options
      if (activeCategory === 'ethics') {
        if (ethicsTab === 'khemka_toolkit') {
          if (khemkaSubTab === 'skeleton') {
            return item.title === "Khemka Sir's 5 Step Answer Skeleton (GS-4)";
          }
          if (khemkaSubTab === 'rules') {
            return item.title.toLowerCase().startsWith('rule ') || item.title === "khemka ethical rules";
          }
          if (khemkaSubTab === 'toolkit') {
            return item.title === "1. Keyword Toolkit for Answers";
          }
          if (khemkaSubTab === 'cases') {
            return item.ethicsType === 'situation';
          }
          return false;
        }
        if (ethicsTab === 'philosophies') {
          return item.ethicsType === 'keyword' && item.core_values === 'philosophy';
        }
        if (ethicsTab === 'dilemmas') {
          return item.ethicsType === 'keyword' && item.core_values === 'dilemma';
        }
        if (ethicsTab === 'phrases') {
          return item.ethicsType === 'keyword' && item.core_values === 'phrase';
        }
        if (ethicsTab === 'keywords') {
          return item.ethicsType === 'keyword' && !['philosophy', 'dilemma', 'phrase'].includes(item.core_values);
        }
        const mappedTab = 
          ethicsTab === 'diagrams' ? 'diagram' :
          ethicsTab === 'dimensions' ? 'dimension' :
          ethicsTab === 'comparisons' ? 'comparison' :
          ethicsTab === 'innovations' ? 'innovation' :
          ethicsTab === 'pyq_quotes' ? 'pyq_quote' : ethicsTab;
        return item.ethicsType === mappedTab;
      }

      if (activeCategory === 'quotes') {
        if (quotesEntryTypeTab !== 'All') {
          return item.entry_type === quotesEntryTypeTab;
        }
      }

      return true;
    });
  }, [uniqueValueAddItems, activeCategory, ethicsTab, khemkaSubTab, quotesEntryTypeTab]);

  const allPapers = useMemo(() => {
    const paperSet = new Set<string>();
    activeCategoryItems.forEach(item => {
      if (item.category === 'frameworks') {
        getFrameworkPaths(item).forEach(path => {
          if (path.paper) paperSet.add(path.paper);
        });
      } else {
        const p = item.paper;
        if (p) paperSet.add(p);
      }
    });
    return Array.from(paperSet).sort();
  }, [activeCategoryItems]);

  const [forceExpandCollapse, setForceExpandCollapse] = useState<'expand' | 'collapse' | null>(null);

  useEffect(() => {
    setForceExpandCollapse(null);
  }, [activeCategory, filters, search]);

  const subjectOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subSet = new Set<string>();
    activeCategoryItems.forEach(item => {
      if (item.category === 'frameworks') {
        getFrameworkPaths(item).forEach(path => {
          if (paperFilter.length === 0 || paperFilter.includes(path.paper)) {
            if (path.subject) subSet.add(path.subject);
          }
        });
      } else {
        const p = item.paper || '';
        if (paperFilter.length === 0 || paperFilter.includes(p)) {
          const s = item.subject || '';
          if (s) subSet.add(s);
        }
      }
    });
    return Array.from(subSet).sort();
  }, [activeCategoryItems, filters.paper]);

  const sectionOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const secSet = new Set<string>();
    activeCategoryItems.forEach(item => {
      if (item.category === 'frameworks') {
        getFrameworkPaths(item).forEach(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          if (matchPaper && matchSubject && path.sectionGroup) {
            secSet.add(path.sectionGroup);
          }
        });
      } else {
        const p = item.paper || '';
        const matchPaper = paperFilter.length === 0 || paperFilter.includes(p);
        if (matchPaper) {
          const s = item.subject || '';
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(s);
          if (matchSubject) {
            const sg = item.sectionGroup || '';
            if (sg) secSet.add(sg);
          }
        }
      }
    });
    return Array.from(secSet).sort(naturalCompare);
  }, [activeCategoryItems, filters.paper, filters.subjects]);

  const microtopicOptions = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
    const mtSet = new Set<string>();
    activeCategoryItems.forEach(item => {
      if (item.category === 'frameworks') {
        getFrameworkPaths(item).forEach(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          const matchSection = sectionFilter.length === 0 || sectionFilter.includes(path.sectionGroup);
          if (matchPaper && matchSubject && matchSection) {
            if (path.microtopic) mtSet.add(path.microtopic);
          }
        });
      } else {
        const p = item.paper || '';
        const matchPaper = paperFilter.length === 0 || paperFilter.includes(p);
        if (matchPaper) {
          const s = item.subject || '';
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(s);
          if (matchSubject) {
            const sg = item.sectionGroup || '';
            const matchSection = sectionFilter.length === 0 || sectionFilter.includes(sg);
            if (matchSection) {
              const currentCat = activeCategory === 'va_hub' ? item.category : activeCategory;
              const isStandardHierarchyCat = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat);
              if (isStandardHierarchyCat) {
                const mt = item.microtopic || '';
                if (mt) mtSet.add(mt);
              } else {
                const themeName = item.category === 'data_facts' ? item.metric : item.title;
                if (themeName) mtSet.add(themeName);
              }
            }
          }
        }
      }
    });
    return Array.from(mtSet).sort(naturalCompare);
  }, [activeCategoryItems, filters.paper, filters.subjects, filters.sections, activeCategory]);

  const subtopicOptions = useMemo(() => {
    const selectedMicrotopic = filters.microtopics !== 'All' ? filters.microtopics : null;
    if (!selectedMicrotopic) return [];
    const stSet = new Set<string>();
    const microFilter = selectedMicrotopic.split('|');
    activeCategoryItems.forEach(item => {
      if (item.category === 'frameworks') {
        getFrameworkPaths(item).forEach(path => {
          if (path.microtopic && microFilter.includes(path.microtopic)) {
            if (path.subtopic) stSet.add(path.subtopic);
          }
        });
      } else {
        const currentCat = activeCategory === 'va_hub' ? item.category : activeCategory;
        const isStandardHierarchyCat = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat);
        if (isStandardHierarchyCat) {
          const mt = item.microtopic || '';
          if (mt && microFilter.includes(mt)) {
            const st = item.subtopic || '';
            if (st) stSet.add(st);
          }
        } else {
          const themeName = item.category === 'data_facts' ? item.metric : item.title;
          if (themeName && microFilter.includes(themeName)) {
            const subThemes = item.parsedSubThemes || splitSubThemes(item.context);
            subThemes.forEach((st: any) => {
              if (st.title) stSet.add(st.title);
            });
          }
        }
      }
    });
    return Array.from(stSet).sort(naturalCompare);
  }, [activeCategoryItems, filters.microtopics, activeCategory]);

  const macrotagOptions = useMemo(() => {
    const selectedSubTheme = filters.subtopics !== 'All' ? filters.subtopics : null;
    if (!selectedSubTheme) return [];
    const sstSet = new Set<string>();
    const subThemeFilter = selectedSubTheme.split('|');
    activeCategoryItems.forEach(item => {
      if (item.category === 'frameworks') {
        getFrameworkPaths(item).forEach(path => {
          if (path.subtopic && subThemeFilter.includes(path.subtopic)) {
            if (item.title) sstSet.add(item.title);
          }
        });
      } else {
        const currentCat = activeCategory === 'va_hub' ? item.category : activeCategory;
        const isStandardHierarchyCat = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat);
        if (isStandardHierarchyCat) {
          const st = item.subtopic || '';
          if (st && subThemeFilter.includes(st)) {
            const cardTitleName = currentCat === 'data_facts' ? item.metric : item.title;
            if (cardTitleName) sstSet.add(cardTitleName);
          }
        } else {
          const subThemes = item.parsedSubThemes || splitSubThemes(item.context);
          subThemes.forEach((st: any) => {
            if (st.title && subThemeFilter.includes(st.title)) {
              const sstMatches = splitSubSubThemes(st.content);
              sstMatches.forEach(sst => sstSet.add(sst));
            }
          });
        }
      }
    });
    return Array.from(sstSet).sort();
  }, [activeCategoryItems, filters.subtopics, activeCategory]);

  const microtagOptions: string[] = [];


  const filteredItems = useMemo(() => {
    const paperFilter = filters.paper !== 'All' ? filters.paper.split('|') : [];
    const subjectFilter = filters.subjects !== 'All' ? filters.subjects.split('|') : [];
    const sectionFilter = filters.sections !== 'All' ? filters.sections.split('|') : [];
    const themeFilter = filters.microtopics !== 'All' ? filters.microtopics.split('|') : [];
    const subThemeFilter = filters.subtopics !== 'All' ? filters.subtopics.split('|') : [];
    const subSubThemeFilter = filters.macrotags !== 'All' ? filters.macrotags.split('|') : [];

    return uniqueValueAddItems.filter(item => {
      const matchCat = !activeCategory || activeCategory === 'va_hub' || item.category === activeCategory;
      const matchSearch = !search || item.searchableText.includes(search.toLowerCase());

      let matchHubCat = true;
      if (activeCategory === 'va_hub' && vaHubCategories.length > 0) {
        matchHubCat = vaHubCategories.includes(item.category);
      }

      let matchesAnyPath = false;
      if (item.category === 'frameworks') {
        matchesAnyPath = getFrameworkPaths(item).some(path => {
          const matchPaper = paperFilter.length === 0 || paperFilter.includes(path.paper);
          const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(path.subject);
          const matchSection = sectionFilter.length === 0 || sectionFilter.includes(path.sectionGroup);
          
          let matchTheme = true;
          if (themeFilter.length > 0) {
            matchTheme = !!path.microtopic && themeFilter.includes(path.microtopic);
          }

          let matchSubTheme = true;
          if (subThemeFilter.length > 0) {
            matchSubTheme = !!path.subtopic && subThemeFilter.includes(path.subtopic);
          }

          let matchSubSubTheme = true;
          if (subSubThemeFilter.length > 0) {
            matchSubSubTheme = !!item.title && subSubThemeFilter.includes(item.title);
          }

          return matchPaper && matchSubject && matchSection && matchTheme && matchSubTheme && matchSubSubTheme;
        });
      } else {
        const matchPaper = paperFilter.length === 0 || paperFilter.includes(item.paper || '');
        const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(item.subject || '');
        const matchSection = sectionFilter.length === 0 || sectionFilter.includes(item.sectionGroup || '');
        
        let matchTheme = true;
        if (themeFilter.length > 0) {
          const currentCat = activeCategory === 'va_hub' ? item.category : activeCategory;
          const isStandardHierarchyCatTheme = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat);
          if (isStandardHierarchyCatTheme) {
            matchTheme = !!item.microtopic && themeFilter.includes(item.microtopic);
          } else {
            const themeName = item.category === 'data_facts' ? item.metric : item.title;
            matchTheme = !!themeName && themeFilter.includes(themeName);
          }
        }

        let matchSubTheme = true;
        if (subThemeFilter.length > 0) {
          const currentCat2 = activeCategory === 'va_hub' ? item.category : activeCategory;
          const isStandardHierarchyCatSubTheme = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat2);
          if (isStandardHierarchyCatSubTheme) {
            matchSubTheme = !!item.subtopic && subThemeFilter.includes(item.subtopic);
          } else {
            matchSubTheme = !!item.parsedSubThemes && item.parsedSubThemes.some((st: any) => 
              subThemeFilter.includes(st.title)
            );
          }
        }

        let matchSubSubTheme = true;
        if (subSubThemeFilter.length > 0) {
          const currentCat3 = activeCategory === 'va_hub' ? item.category : activeCategory;
          const isStandardHierarchyCatSubSubTheme = ['intro_conclusion', 'quotes', 'mnemonics', 'frameworks', 'ethics', 'keywords_hub', 'case_studies_hub', 'sc_judgments_hub', 'data_facts'].includes(currentCat3);
          if (isStandardHierarchyCatSubSubTheme) {
            const cardTitleName = currentCat3 === 'data_facts' ? item.metric : item.title;
            matchSubSubTheme = !!cardTitleName && subSubThemeFilter.includes(cardTitleName);
          } else {
            matchSubSubTheme = !!item.parsedSubSubThemes && item.parsedSubSubThemes.some((sst: any) => 
              subSubThemeFilter.includes(sst)
            );
          }
        }

        matchesAnyPath = matchPaper && matchSubject && matchSection && matchTheme && matchSubTheme && matchSubSubTheme;
      }

      let matchTemplate = true;
      if (activeCategory === 'intro_conclusion') {
        const titleLower = (item.title || '').toLowerCase();
        if (templateFilter === 'Templates') {
          matchTemplate = titleLower.includes('template');
        } else if (templateFilter === 'IntroConclusionOnly') {
          matchTemplate = !titleLower.includes('template');
        }
      }

      let matchRevisionTag = true;
      if (filters.revisionTags !== 'All') {
        const itemTags = valueAddTags[item.id] || [];
        matchRevisionTag = itemTags.includes(filters.revisionTags);
      }

      return matchCat && matchHubCat && matchSearch && matchesAnyPath && matchTemplate && matchRevisionTag;
    });
  }, [activeCategory, search, uniqueValueAddItems, filters, templateFilter, vaHubCategories, valueAddTags]);


  const ethicsMappedItems = useMemo(() => {
    const list = filteredItems.filter(item => {
      const isEthicsTabActive = activeCategory === 'ethics' || (activeCategory === 'va_hub' && (filters.paper === 'GS-4' || vaHubCategories.includes('ethics')));
      if (isEthicsTabActive) {
        if (ethicsTab === 'all_formats') return true;
        if (item.category !== 'ethics') {
          return false;
        }
        if (ethicsTab === 'khemka_toolkit') {
          if (khemkaSubTab === 'skeleton') {
            return item.title === "Khemka Sir's 5 Step Answer Skeleton (GS-4)";
          }
          if (khemkaSubTab === 'rules') {
            return item.title.toLowerCase().startsWith('rule ') || item.title === "khemka ethical rules";
          }
          if (khemkaSubTab === 'toolkit') {
            return item.title === "1. Keyword Toolkit for Answers";
          }
          if (khemkaSubTab === 'cases') {
            return item.ethicsType === 'situation';
          }
          return false;
        }
        if (ethicsTab === 'philosophies') {
          return item.ethicsType === 'keyword' && item.core_values === 'philosophy';
        }
        if (ethicsTab === 'dilemmas') {
          return item.ethicsType === 'keyword' && item.core_values === 'dilemma';
        }
        if (ethicsTab === 'phrases') {
          return item.ethicsType === 'keyword' && item.core_values === 'phrase';
        }
        if (ethicsTab === 'keywords') {
          return item.ethicsType === 'keyword' && !['philosophy', 'dilemma', 'phrase'].includes(item.core_values);
        }
        const mappedTab = 
          ethicsTab === 'diagrams' ? 'diagram' :
          ethicsTab === 'dimensions' ? 'dimension' :
          ethicsTab === 'comparisons' ? 'comparison' :
          ethicsTab === 'innovations' ? 'innovation' :
          ethicsTab === 'pyq_quotes' ? 'pyq_quote' : ethicsTab;
        return item.ethicsType === mappedTab;
      }
      if (activeCategory === 'quotes') {
        if (quotesEntryTypeTab !== 'All') {
          return item.entry_type === quotesEntryTypeTab;
        }
      }
      return true;
    });

    // Sort: favorites first, then tagged, then rest — all filter-aware
    const sorted = [...list].sort((a, b) => {
      const aFav = vaFavorites.has(a.id) ? 2 : 0;
      const bFav = vaFavorites.has(b.id) ? 2 : 0;
      const aTags = (valueAddTags[a.id] || []).length > 0 ? 1 : 0;
      const bTags = (valueAddTags[b.id] || []).length > 0 ? 1 : 0;
      const aScore = aFav + aTags;
      const bScore = bFav + bTags;
      if (aScore > bScore) return -1;
      if (aScore < bScore) return 1;
      return 0; // maintain relative order
    });
    return sorted;
  }, [filteredItems, activeCategory, ethicsTab, quotesEntryTypeTab, khemkaSubTab, vaHubCategories, filters.paper, valueAddTags, vaFavorites]);

  // Calculate counts for Khemka sub-tabs dynamically based on current hierarchy/search filters
  const khemkaTabCounts = useMemo(() => {
    const counts = {
      skeleton: 0,
      rules: 0,
      toolkit: 0,
      cases: 0,
    };
    
    filteredItems.forEach(item => {
      if (item.category === 'ethics') {
        if (item.title === "Khemka Sir's 5 Step Answer Skeleton (GS-4)") counts.skeleton++;
        else if (item.title.toLowerCase().startsWith('rule ') || item.title === "khemka ethical rules") counts.rules++;
        else if (item.title === "1. Keyword Toolkit for Answers") counts.toolkit++;
        else if (item.ethicsType === 'situation') counts.cases++;
      }
    });
    
    return counts;
  }, [filteredItems]);

  // Calculate counts for each ethics tab based on the current hierarchy/search filters (filteredItems)
  const ethicsTabCounts = useMemo(() => {
    const counts = {
      diagrams: 0,
      dimensions: 0,
      comparisons: 0,
      innovations: 0,
      pyq_quotes: 0,
      keywords: 0,
      philosophies: 0,
      dilemmas: 0,
      phrases: 0,
      khemka_toolkit: 0,
    };
    
    filteredItems.forEach(item => {
      if (item.category === 'ethics') {
        // Check other tabs
        if (item.ethicsType === 'diagram') counts.diagrams++;
        if (item.ethicsType === 'dimension') counts.dimensions++;
        if (item.ethicsType === 'comparison') counts.comparisons++;
        if (item.ethicsType === 'innovation') counts.innovations++;
        if (item.ethicsType === 'pyq_quote') counts.pyq_quotes++;
        if (item.ethicsType === 'keyword') {
          if (item.core_values === 'philosophy') counts.philosophies++;
          else if (item.core_values === 'dilemma') counts.dilemmas++;
          else if (item.core_values === 'phrase') counts.phrases++;
          else counts.keywords++;
        }
      }
    });

    // Khemka toolkit total count is the sum of its individual sub-tabs
    counts.khemka_toolkit = khemkaTabCounts.skeleton + khemkaTabCounts.rules + khemkaTabCounts.toolkit + khemkaTabCounts.cases;
    
    return counts;
  }, [filteredItems, khemkaTabCounts]);

  useEffect(() => {
    if (activeCategory === 'ethics') {
      const currentCount = ethicsTab === 'all_formats' ? 0 : ((ethicsTabCounts as any)[ethicsTab] || 0);
      if (currentCount === 0) {
        const tabsOrder: string[] = [
          'diagrams', 'dimensions', 'comparisons', 'innovations', 'pyq_quotes', 'keywords', 'khemka_toolkit'
        ];
        const firstActiveTab = tabsOrder.find(t => (ethicsTabCounts as any)[t] > 0);
        if (firstActiveTab) {
          setEthicsTab(firstActiveTab as any);
        }
      }
    }
  }, [ethicsTabCounts, activeCategory, ethicsTab]);

  // Automatically switch to the first Khemka sub-tab that has >0 items if current sub-tab is empty
  useEffect(() => {
    if (activeCategory === 'ethics' && ethicsTab === 'khemka_toolkit') {
      const currentCount = khemkaTabCounts[khemkaSubTab] || 0;
      if (currentCount === 0) {
        const subTabsOrder: (keyof typeof khemkaTabCounts)[] = ['cases', 'rules', 'toolkit', 'skeleton'];
        const firstActiveSubTab = subTabsOrder.find(t => khemkaTabCounts[t] > 0);
        if (firstActiveSubTab) {
          setKhemkaSubTab(firstActiveSubTab);
        }
      }
    }
  }, [khemkaTabCounts, activeCategory, ethicsTab, khemkaSubTab]);

  // Split data into two columns for masonry
  const leftCol: any[] = [];
  const rightCol: any[] = [];
  const visibleItems = ethicsMappedItems.slice(0, visibleLimit);
  if (layoutColumns === 2) {
    visibleItems.forEach((item, index) => {
      if (index % 2 === 0) leftCol.push(item);
      else rightCol.push(item);
    });
  }

  return (
    <View style={styles.subContainer}>
      {showZoomIndicator && (
        <View style={{
          position: 'absolute',
          top: insets.top + 12,
          alignSelf: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          zIndex: 1000,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>ZOOM: {Math.round((zoomFontSize / 16) * 100)}%</Text>
        </View>
      )}

      {activeCategory ? (
        <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
          <FlatList
          key={layoutColumns}
          numColumns={1}
          data={layoutColumns === 2 ? [1] : visibleItems}
          keyExtractor={(item, index) => (layoutColumns === 2 ? 'masonry-root' : (item as any).id)}
          contentContainerStyle={styles.listScroll}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={5}
          ListHeaderComponent={
            <View style={{ paddingBottom: 10 }}>
              {/* Spacer for floating back button */}
              <View style={{ height: insets.top + 48 }} />

              {/* Header Row */}
              <View style={styles.subAppHeaderRow}>
                <Text style={[styles.subAppHeaderTitle, { color: colors.textPrimary }]}>
                  {submodules.find(s => s.id === activeCategory)?.title}
                </Text>
              </View>

              {/* Search bar + Layout columns toggle side-by-side */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={[styles.largeSearchInput, { flex: 1, backgroundColor: colors.surface + '66', borderColor: 'rgba(255,255,255,0.7)', height: 52, borderRadius: 16, marginBottom: 0 }]}>
                  <Search size={18} color="#94a3b8" style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder="Search by keywords..."
                    placeholderTextColor="#94a3b8"
                    value={search}
                    onChangeText={setSearch}
                    style={[styles.largeSearchText, { color: colors.textPrimary, fontSize: 14 }]}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} style={{ marginRight: 6 }}>
                      <X size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {isTablet && (
                  <View style={{ flexDirection: 'row', backgroundColor: colors.surface + '88', borderRadius: 8, borderWidth: 1, borderColor: colors.border, padding: 2, height: 52, alignItems: 'center' }}>
                    <TouchableOpacity
                      onPress={() => setLayoutColumns(1)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 6,
                        backgroundColor: layoutColumns === 1 ? '#7c3aed' : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: layoutColumns === 1 ? '#ffffff' : colors.textSecondary }}>1 Col</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setLayoutColumns(2)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: 6,
                        backgroundColor: layoutColumns === 2 ? '#7c3aed' : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: layoutColumns === 2 ? '#ffffff' : colors.textSecondary }}>2 Cols</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Global Expand All / Collapse All controls */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, paddingHorizontal: 2 }}>
                <TouchableOpacity 
                  onPress={() => setForceExpandCollapse('expand')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: colors.surface + 'b3',
                    borderWidth: 0.5,
                    borderColor: colors.border
                  }}
                >
                  <ChevronsDown size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Expand All</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => setForceExpandCollapse('collapse')}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    backgroundColor: colors.surface + 'b3',
                    borderWidth: 0.5,
                    borderColor: colors.border
                  }}
                >
                  <ChevronsUp size={14} color={colors.textSecondary} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textSecondary }}>Collapse All</Text>
                </TouchableOpacity>
              </View>

              {/* Category Filter Chips for VA Hub */}
              {activeCategory === 'va_hub' && (
                <View style={{ marginBottom: 12, paddingHorizontal: 2 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                    {[
                      { id: null, label: 'All', color: '#6366f1' },
                      { id: 'data_facts', label: 'Data & Facts', color: '#3b82f6' },
                      { id: 'intro_conclusion', label: 'Intro & Conclusion', color: '#10b981' },
                      { id: 'quotes', label: 'Quotes & Anecdotes', color: '#8b5cf6' },
                      { id: 'mnemonics', label: 'Mnemonics', color: '#f59e0b' },
                      { id: 'frameworks', label: 'Frameworks', color: '#f43f5e' },
                      { id: 'ethics', label: 'Ethics Specific', color: '#06b6d4' },
                      { id: 'keywords_hub', label: 'Keywords', color: '#ec4899' },
                      { id: 'case_studies_hub', label: 'Case Studies', color: '#f97316' },
                      { id: 'sc_judgments_hub', label: 'SC Judgments', color: '#ef4444' },
                    ].map(cat => {
                      const isActive = cat.id === null 
                        ? chipVaHubCategories.length === 0 
                        : chipVaHubCategories.includes(cat.id);
                      return (
                        <TouchableOpacity
                          key={String(cat.id)}
                          onPress={() => {
                            let nextCats: string[];
                            if (cat.id === null) {
                              nextCats = [];
                            } else {
                              if (chipVaHubCategories.includes(cat.id)) {
                                nextCats = chipVaHubCategories.filter(id => id !== cat.id);
                              } else {
                                nextCats = [...chipVaHubCategories, cat.id];
                              }
                            }
                            setChipVaHubCategories(nextCats);
                            setTimeout(() => setVaHubCategories(nextCats), 0);
                            Haptics.selectionAsync().catch(() => {});
                          }}
                          activeOpacity={0.75}
                          style={[
                            styles.tabFilterPill,
                            isActive
                              ? { backgroundColor: cat.color, borderColor: cat.color }
                              : { backgroundColor: colors.surface + 'b3', borderColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.tabFilterPillText, isActive ? { color: '#ffffff', fontWeight: '700' } : { color: colors.textSecondary }]}>
                            {cat.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
              {activeCategoryItems.length > 0 && (() => {
                const hasHierarchyActive = filters.paper !== 'All' || filters.subjects !== 'All' || filters.sections !== 'All' || filters.microtopics !== 'All' || filters.subtopics !== 'All';
                const activeHierarchyLabel = filters.subtopics !== 'All' ? filters.subtopics : (filters.microtopics !== 'All' ? filters.microtopics : (filters.sections !== 'All' ? filters.sections : (filters.subjects !== 'All' ? filters.subjects : (filters.paper !== 'All' ? filters.paper : 'Browse Topics'))));
                return (
                  <View style={{ gap: 8, paddingHorizontal: 2, marginBottom: 12 }}>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      contentContainerStyle={{ alignItems: 'center', gap: 8, paddingVertical: 4 }}
                    >
                      {/* Browse Topics Pill */}
                      <Pressable
                        onPress={() => setHierarchyModalVisible(true)}
                        style={({ pressed }) => [
                          styles.filterPill,
                          hasHierarchyActive
                            ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                            : { backgroundColor: colors.surface + 'b3', borderColor: colors.border },
                          { opacity: pressed ? 0.6 : 1 }
                        ]}
                      >
                        <BookOpen size={12} color={hasHierarchyActive ? '#fff' : '#3b82f6'} style={{ marginRight: 4 }} />
                        <Text style={[styles.filterPillText, { color: hasHierarchyActive ? '#fff' : colors.textSecondary, fontWeight: '700' }]}>
                          {hasHierarchyActive ? activeHierarchyLabel : 'Browse Topics'}
                        </Text>
                        <ChevronDown size={12} color={hasHierarchyActive ? '#fff' : colors.textTertiary} style={{ marginLeft: 4 }} />
                      </Pressable>

                      {/* Revision Tags Pill */}
                      <Pressable
                        onPress={() => setShowVaTagsDropdown(true)}
                        style={({ pressed }) => [
                          styles.filterPill,
                          filters.revisionTags !== 'All'
                            ? { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }
                            : { backgroundColor: colors.surface + 'b3', borderColor: colors.border },
                          { opacity: pressed ? 0.6 : 1 }
                        ]}
                      >
                        <Tag size={12} color={filters.revisionTags !== 'All' ? '#fff' : '#8b5cf6'} style={{ marginRight: 4 }} />
                        <Text style={[styles.filterPillText, { color: filters.revisionTags !== 'All' ? '#fff' : colors.textSecondary, fontWeight: '700' }]}>
                          {filters.revisionTags !== 'All' ? filters.revisionTags : 'Revision Tags'}
                        </Text>
                        <ChevronDown size={12} color={filters.revisionTags !== 'All' ? '#fff' : colors.textTertiary} style={{ marginLeft: 4 }} />
                      </Pressable>

                      <View style={{ width: 1, height: 16, backgroundColor: colors.border }} />

                      {/* Progressive selector replacing simple paper pills */}
                      {(() => {
                        let options: string[] = [];
                        let selectFn: (val: string) => void = () => {};
                        let backFn: (() => void) | null = null;
                        let layerLabel = 'Paper';

                        const isQuotes = activeCategory === 'quotes';

                        if (isQuotes) {
                          if (filters.subjects === 'All') {
                            options = subjectOptions;
                            layerLabel = 'Subject';
                            selectFn = (val) => setFilters(prev => ({ ...prev, subjects: val }));
                          } else if (filters.sections === 'All') {
                            options = sectionOptions;
                            layerLabel = 'Section Group';
                            selectFn = (val) => setFilters(prev => ({ ...prev, sections: val }));
                            backFn = () => setFilters(prev => ({ ...prev, subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All' }));
                          } else if (filters.microtopics === 'All') {
                            options = microtopicOptions;
                            layerLabel = 'Microtopic';
                            selectFn = (val) => setFilters(prev => ({ ...prev, microtopics: val }));
                            backFn = () => setFilters(prev => ({ ...prev, sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All' }));
                          } else if (filters.subtopics === 'All') {
                            options = subtopicOptions;
                            layerLabel = 'Category';
                            selectFn = (val) => setFilters(prev => ({ ...prev, subtopics: val }));
                            backFn = () => setFilters(prev => ({ ...prev, microtopics: 'All', subtopics: 'All', macrotags: 'All' }));
                          } else if (filters.macrotags === 'All') {
                            options = macrotagOptions;
                            layerLabel = 'Title';
                            selectFn = (val) => setFilters(prev => ({ ...prev, macrotags: val }));
                            backFn = () => setFilters(prev => ({ ...prev, subtopics: 'All', macrotags: 'All' }));
                          } else {
                            return null;
                          }
                        } else {
                          if (filters.paper === 'All') {
                            options = allPapers;
                            layerLabel = 'Paper';
                            selectFn = (p) => setFilters(prev => ({ ...prev, paper: p }));
                          } else if (filters.subjects === 'All') {
                            options = subjectOptions;
                            layerLabel = 'Subject';
                            selectFn = (sub) => setFilters(prev => ({ ...prev, subjects: sub }));
                            backFn = () => setFilters(prev => ({ ...prev, paper: 'All', subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All' }));
                          } else if (filters.sections === 'All') {
                            options = sectionOptions;
                            layerLabel = 'Section Group';
                            selectFn = (sec) => setFilters(prev => ({ ...prev, sections: sec }));
                            backFn = () => setFilters(prev => ({ ...prev, subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All' }));
                          } else if (filters.microtopics === 'All') {
                            options = microtopicOptions;
                            layerLabel = activeCategory === 'data_facts' ? 'Theme' : 'Microtopic';
                            selectFn = (mt) => setFilters(prev => ({ ...prev, microtopics: mt }));
                            backFn = () => setFilters(prev => ({ ...prev, sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All' }));
                          } else if (filters.subtopics === 'All') {
                            options = subtopicOptions;
                            layerLabel = activeCategory === 'data_facts' ? 'Sub-theme' : 'Subtopic';
                            selectFn = (st) => setFilters(prev => ({ ...prev, subtopics: st }));
                            backFn = () => setFilters(prev => ({ ...prev, microtopics: 'All', subtopics: 'All', macrotags: 'All' }));
                          } else if (filters.macrotags === 'All') {
                            options = macrotagOptions;
                            layerLabel = activeCategory === 'mnemonics' ? 'Mnemonic Title' : (activeCategory === 'intro_conclusion' ? 'Card Title' : 'Title');
                            selectFn = (mat) => setFilters(prev => ({ ...prev, macrotags: mat }));
                            backFn = () => setFilters(prev => ({ ...prev, subtopics: 'All', macrotags: 'All' }));
                          } else {
                            return null;
                          }
                        }

                        return (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {backFn && (
                              <Pressable
                                onPress={backFn}
                                style={({ pressed }) => [
                                  styles.tabFilterPill,
                                  { backgroundColor: colors.surfaceStrong, borderColor: colors.border },
                                  { opacity: pressed ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }
                                ]}
                              >
                                <ChevronLeft size={12} color={colors.textSecondary} style={{ marginRight: 2 }} />
                                <Text style={[styles.tabFilterPillText, { color: colors.textSecondary, fontWeight: '700' }]}>
                                  Back
                                </Text>
                              </Pressable>
                            )}

                            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, textTransform: 'uppercase', marginRight: 4 }}>
                              {layerLabel}:
                            </Text>

                            {options.slice(0, 15).map(p => (
                              <Pressable
                                key={p}
                                onPress={() => selectFn(p)}
                                style={({ pressed }) => [
                                  styles.tabFilterPill,
                                  { backgroundColor: colors.surface + 'b3', borderColor: colors.border },
                                  { opacity: pressed ? 0.6 : 1 }
                                ]}
                              >
                                <Text style={[styles.tabFilterPillText, { color: colors.textSecondary }]}>
                                  {p}
                                </Text>
                              </Pressable>
                            ))}
                            {options.length > 15 && (
                              <Pressable
                                onPress={() => setHierarchyModalVisible(true)}
                                style={({ pressed }) => [
                                  styles.tabFilterPill,
                                  { backgroundColor: colors.surfaceStrong, borderColor: '#3b82f6', borderWidth: 0.5 },
                                  { opacity: pressed ? 0.6 : 1 }
                                ]}
                              >
                                <Text style={[styles.tabFilterPillText, { color: '#3b82f6', fontWeight: '700' }]}>
                                  + {options.length - 15} More
                                </Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })()}


                      {hasHierarchyActive && (
                        <>
                          <View style={{ width: 1, height: 16, backgroundColor: colors.border }} />
                          <Pressable
                            onPress={() => setFilters({ ...DEFAULT_MAINS_FILTERS })}
                            style={({ pressed }) => [
                              styles.filterPill, 
                              { backgroundColor: '#fee2e2', borderColor: '#fca5a5' },
                              { opacity: pressed ? 0.6 : 1 }
                            ]}
                          >
                            <X size={12} color="#ef4444" style={{ marginRight: 4 }} />
                            <Text style={[styles.filterPillText, { color: '#ef4444', fontWeight: '700' }]}>Clear All</Text>
                          </Pressable>
                        </>
                      )}
                    </ScrollView>

                    {/* Active Breadcrumb Badges */}
                    {/* Active Breadcrumb Badges */}
                    {hasHierarchyActive && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4, paddingBottom: 2 }}>
                        {filters.paper !== 'All' && filters.paper.split('|').map(val => (
                          <Pressable 
                            key={`crumb-paper-${val}`} 
                            onPress={() => {
                              const updated = filters.paper.split('|').filter(x => x !== val).join('|') || 'All';
                              setFilters(prev => ({ 
                                ...prev, 
                                paper: updated, 
                                subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' 
                              }));
                            }}
                            style={({ pressed }) => [
                              styles.breadcrumbChip, 
                              { backgroundColor: '#dbeafe', borderColor: '#bfdbfe', opacity: pressed ? 0.6 : 1 }
                            ]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#1e40af' }}>{val}</Text>
                            <X size={10} color="#1e40af" style={{ marginLeft: 4 }} />
                          </Pressable>
                        ))}
                        {filters.subjects !== 'All' && filters.subjects.split('|').map(val => (
                          <Pressable 
                            key={`crumb-subject-${val}`} 
                            onPress={() => {
                              const updated = filters.subjects.split('|').filter(x => x !== val).join('|') || 'All';
                              setFilters(prev => ({ 
                                ...prev, 
                                subjects: updated, 
                                sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' 
                              }));
                            }}
                            style={({ pressed }) => [
                              styles.breadcrumbChip, 
                              { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff', opacity: pressed ? 0.6 : 1 }
                            ]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#6b21a8' }}>{val}</Text>
                            <X size={10} color="#6b21a8" style={{ marginLeft: 4 }} />
                          </Pressable>
                        ))}
                        {filters.sections !== 'All' && filters.sections.split('|').map(val => (
                          <Pressable 
                            key={`crumb-section-${val}`} 
                            onPress={() => {
                              const updated = filters.sections.split('|').filter(x => x !== val).join('|') || 'All';
                              setFilters(prev => ({ 
                                ...prev, 
                                sections: updated, 
                                microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' 
                              }));
                            }}
                            style={({ pressed }) => [
                              styles.breadcrumbChip, 
                              { backgroundColor: '#e0f2fe', borderColor: '#bae6fd', opacity: pressed ? 0.6 : 1 }
                            ]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#0369a1' }}>{val}</Text>
                            <X size={10} color="#0369a1" style={{ marginLeft: 4 }} />
                          </Pressable>
                        ))}
                        {filters.microtopics !== 'All' && filters.microtopics.split('|').map(val => (
                          <Pressable 
                            key={`crumb-micro-${val}`} 
                            onPress={() => {
                              const updated = filters.microtopics.split('|').filter(x => x !== val).join('|') || 'All';
                              setFilters(prev => ({ 
                                ...prev, 
                                microtopics: updated, 
                                subtopics: 'All', macrotags: 'All', microtags: 'All' 
                              }));
                            }}
                            style={({ pressed }) => [
                              styles.breadcrumbChip, 
                              { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', opacity: pressed ? 0.6 : 1 }
                            ]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#166534' }}>{val}</Text>
                            <X size={10} color="#166534" style={{ marginLeft: 4 }} />
                          </Pressable>
                        ))}
                        {filters.subtopics !== 'All' && filters.subtopics.split('|').map(val => (
                          <Pressable 
                            key={`crumb-sub-${val}`} 
                            onPress={() => {
                              const updated = filters.subtopics.split('|').filter(x => x !== val).join('|') || 'All';
                              setFilters(prev => ({ 
                                ...prev, 
                                subtopics: updated, 
                                macrotags: 'All', microtags: 'All' 
                              }));
                            }}
                            style={({ pressed }) => [
                              styles.breadcrumbChip, 
                              { backgroundColor: '#ffe4e6', borderColor: '#fecdd3', opacity: pressed ? 0.6 : 1 }
                            ]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#be123c' }}>{val}</Text>
                            <X size={10} color="#be123c" style={{ marginLeft: 4 }} />
                          </Pressable>
                        ))}
                        {filters.macrotags !== 'All' && filters.macrotags.split('|').map(val => (
                          <Pressable 
                            key={`crumb-macro-${val}`} 
                            onPress={() => {
                              const updated = filters.macrotags.split('|').filter(x => x !== val).join('|') || 'All';
                              setFilters(prev => ({ 
                                ...prev, 
                                macrotags: updated, 
                                microtags: 'All' 
                              }));
                            }}
                            style={({ pressed }) => [
                              styles.breadcrumbChip, 
                              { backgroundColor: activeCategory === 'intro_conclusion' ? '#d1fae5' : '#f3e8ff', borderColor: activeCategory === 'intro_conclusion' ? '#bbf7d0' : '#e9d5ff', opacity: pressed ? 0.6 : 1 }
                            ]}
                          >
                            <Text style={{ fontSize: 10, fontWeight: '700', color: activeCategory === 'intro_conclusion' ? '#166534' : '#6b21a8' }}>{val}</Text>
                            <X size={10} color={activeCategory === 'intro_conclusion' ? '#166534' : '#6b21a8'} style={{ marginLeft: 4 }} />
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })()}

              {/* Template filter bar for Intro/Conclusion tab — 3 chips */}
              {activeCategory === 'intro_conclusion' && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, paddingVertical: 4 }}>
                  {[
                    { id: 'All' as const, label: 'All Entries' },
                    { id: 'Templates' as const, label: 'Templates' },
                    { id: 'IntroConclusionOnly' as const, label: 'Intro-Conclusion' },
                  ].map(tab => (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => {
                        // Update chip UI immediately, defer heavy filteredItems recompute
                        setChipTemplateFilter(tab.id);
                        setTimeout(() => setTemplateFilter(tab.id), 0);
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.tabFilterPill,
                        chipTemplateFilter === tab.id
                          ? { backgroundColor: '#10b981', borderColor: '#10b981' }
                          : { backgroundColor: colors.surface + 'b3', borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.tabFilterPillText, chipTemplateFilter === tab.id ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Entry-type filter bar for Quotes & Anecdotes tab */}
              {activeCategory === 'quotes' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ alignItems: 'center', gap: 6, paddingVertical: 4 }}>
                  {[
                    { id: 'All', label: 'All Entries' },
                    { id: 'quote', label: 'Quotes Only' },
                    { id: 'anecdote', label: 'Anecdotes Only' },
                    { id: 'connecting_words', label: 'Connecting Words / Statements' },
                  ].map(tab => (
                    <TouchableOpacity
                      key={tab.id}
                      onPress={() => {
                        // Update chip UI immediately, defer heavy filteredItems recompute
                        setChipQuotesEntryTypeTab(tab.id as any);
                        setTimeout(() => setQuotesEntryTypeTab(tab.id as any), 0);
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.tabFilterPill,
                        chipQuotesEntryTypeTab === tab.id
                          ? { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }
                          : { backgroundColor: colors.surface + 'b3', borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.tabFilterPillText, chipQuotesEntryTypeTab === tab.id ? { color: '#ffffff' } : { color: colors.textSecondary }]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Special sub-navigation for Ethics */}
              {(activeCategory === 'ethics' || (activeCategory === 'va_hub' && (filters.paper === 'GS-4' || chipVaHubCategories.includes('ethics')))) && (
                <View style={{ gap: 4 }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ethicsTabsScroll} contentContainerStyle={{ paddingBottom: 8 }}>
                    {[
                      ...(activeCategory === 'va_hub' ? [{ id: 'all_formats', label: 'All Formats' }] : []),
                      { id: 'diagrams', label: 'Diagrams' },
                      { id: 'dimensions', label: 'Dimensions' },
                      { id: 'comparisons', label: 'Comparisons' },
                      { id: 'innovations', label: 'Innovations' },
                      { id: 'pyq_quotes', label: 'PYQ Quotes' },
                      { id: 'keywords', label: 'Keywords' },
                      { id: 'philosophies', label: 'Religious Philosophy' },
                      { id: 'dilemmas', label: 'Ethical Dilemmas' },
                      { id: 'phrases', label: 'Ethics Phrases' },
                      { id: 'khemka_toolkit', label: "Khemka Sir's Hub" }
                    ].map(tab => {
                      const isActive = chipEthicsTab === tab.id;
                      const countText = tab.id === 'all_formats' 
                        ? '' 
                        : ` (${ethicsTabCounts[tab.id as keyof typeof ethicsTabCounts] || 0})`;
                      return (
                        <TouchableOpacity
                          key={tab.id}
                          onPress={() => {
                            setChipEthicsTab(tab.id as any);
                            setTimeout(() => setEthicsTab(tab.id as any), 0);
                          }}
                          activeOpacity={1}
                          style={[
                            styles.tabFilterPill,
                            isActive
                              ? { backgroundColor: '#06b6d4', borderColor: '#06b6d4' }
                              : { backgroundColor: 'rgba(255,255,255,0.5)', borderColor: 'rgba(255,255,255,0.6)' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tabFilterPillText,
                              isActive ? { color: '#ffffff' } : { color: colors.textSecondary },
                            ]}
                          >
                            {`${tab.label}${countText}`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Option 6: Secondary sub-tabs bar when Khemka Sir's Hub is active */}
                  {chipEthicsTab === 'khemka_toolkit' && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                      {[
                        { id: 'skeleton', label: 'Answer Skeleton' },
                        { id: 'rules', label: 'Ethical Rules' },
                        { id: 'toolkit', label: 'Keyword Toolkit' },
                        { id: 'cases', label: 'Case Situations' }
                      ].map(tab => (
                        <TouchableOpacity
                          key={tab.id}
                          onPress={() => {
                            setChipKhemkaSubTab(tab.id as any);
                            setTimeout(() => setKhemkaSubTab(tab.id as any), 0);
                          }}
                          activeOpacity={1}
                          style={[
                            styles.tabFilterPill,
                            chipKhemkaSubTab === tab.id
                              ? { backgroundColor: '#8b5cf6', borderColor: '#8b5cf6' }
                              : { backgroundColor: colors.surface + 'b3', borderColor: colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.tabFilterPillText,
                              chipKhemkaSubTab === tab.id ? { color: '#ffffff' } : { color: colors.textSecondary },
                            ]}
                          >
                            {`${tab.label} (${khemkaTabCounts[tab.id as keyof typeof khemkaTabCounts] || 0})`}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}

              {/* Issue 4 Fix: Subtopic-grouped Innovations Tables (matches MD file structure) */}
              {activeCategory === 'ethics' && ethicsTab === 'innovations' && (() => {
                if (visibleItems.length === 0) {
                  return (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <Text style={{ color: colors.textSecondary, fontSize: 13 * zoomScale }}>No innovations match current filters.</Text>
                    </View>
                  );
                }
                // Group visibleItems by subtopic preserving order
                const groups: { subtopic: string; items: any[] }[] = [];
                const seenSubtopics: Map<string, number> = new globalThis.Map();
                visibleItems.forEach(item => {
                  const sub = item.subtopic || item.sectionGroup || 'General';
                  if (!seenSubtopics.has(sub)) {
                    seenSubtopics.set(sub, groups.length);
                    groups.push({ subtopic: sub, items: [] });
                  }
                  groups[seenSubtopics.get(sub)!].items.push(item);
                });

                return groups.map((group, gIdx) => (
                  <View key={group.subtopic} style={{ marginBottom: gIdx < groups.length - 1 ? 16 : 0 }}>
                    {/* Subtopic header label */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: gIdx > 0 ? 12 : 4 }}>
                      <View style={{ width: 4, height: 20, borderRadius: 2, backgroundColor: '#0891b2' }} />
                      <Text style={{ color: colors.textPrimary, fontSize: 16 * zoomScale, fontWeight: '800', letterSpacing: 0.3 }}>
                        {group.subtopic}
                      </Text>
                    </View>

                    {/* Per-subtopic table */}
                    <View style={{
                      backgroundColor: colors.isDark ? '#0f172acc' : '#ffffff',
                      borderColor: colors.border,
                      borderRadius: 14,
                      overflow: 'hidden',
                      borderWidth: 1.5,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: colors.isDark ? 0.25 : 0.04,
                      shadowRadius: 8,
                      elevation: 3
                    }}>
                      {/* Table Header */}
                      <View style={{ flexDirection: 'row', backgroundColor: colors.isDark ? '#1e293b' : '#f8fafc', borderBottomColor: colors.border, borderBottomWidth: 1.5 }}>
                        <Text style={{ flex: 2, color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '900', paddingVertical: 10, paddingHorizontal: 6 }}>Officer</Text>
                        <Text style={{ flex: 2.5, color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '900', borderLeftColor: colors.border, borderLeftWidth: 1, paddingVertical: 10, paddingHorizontal: 8 }}>Initiative</Text>
                        <Text style={{ flex: 3.5, color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '900', borderLeftColor: colors.border, borderLeftWidth: 1, paddingVertical: 10, paddingHorizontal: 8 }}>Impact</Text>
                        <Text style={{ flex: 2, color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '900', borderLeftColor: colors.border, borderLeftWidth: 1, paddingVertical: 10, paddingHorizontal: 8 }}>Values</Text>
                        <Text style={{ flex: 1.5, color: colors.textPrimary, fontSize: 11 * zoomScale, fontWeight: '900', borderLeftColor: colors.border, borderLeftWidth: 1, paddingVertical: 10, paddingHorizontal: 8 }}>PYQs</Text>
                      </View>

                      {/* Table Body Rows */}
                      {group.items.map((item: any, idx: number) => (
                        <View
                          key={item.id}
                          style={{
                            flexDirection: 'row',
                            backgroundColor: idx % 2 === 0
                              ? (colors.isDark ? 'rgba(255,255,255,0.015)' : 'rgba(248,250,252,0.5)')
                              : 'transparent',
                            borderBottomColor: colors.border,
                            borderBottomWidth: idx === (group.items.length - 1) ? 0 : 1
                          }}
                        >
                          <View style={{ flex: 2, paddingVertical: 10, paddingHorizontal: 6, justifyContent: 'center' }}>
                            <Text style={{ fontWeight: '800', color: colors.textPrimary, fontSize: 11 * zoomScale }}>
                              {item.ethicsData?.officerName || 'N/A'}
                            </Text>
                          </View>
                          <View style={{ flex: 2.5, borderLeftWidth: 1, borderLeftColor: colors.border, paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11 * zoomScale, fontWeight: '600' }}>
                              {item.ethicsData?.initiative || 'N/A'}
                            </Text>
                          </View>
                          <View style={{ flex: 3.5, borderLeftWidth: 1, borderLeftColor: colors.border, paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: 11 * zoomScale, lineHeight: 15 * zoomScale }}>
                              {item.ethicsData?.impact || 'N/A'}
                            </Text>
                          </View>
                          <View style={{ flex: 2, borderLeftWidth: 1, borderLeftColor: colors.border, paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center' }}>
                            <Text style={{ color: '#0891b2', fontSize: 10 * zoomScale, fontWeight: '700' }}>
                              {item.ethicsData?.values || 'N/A'}
                            </Text>
                          </View>
                          <View style={{ flex: 1.5, borderLeftWidth: 1, borderLeftColor: colors.border, paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center' }}>
                            <Text style={{ color: '#0284c7', fontSize: 10 * zoomScale, fontWeight: '800' }}>
                              {item.pyqs && item.pyqs.length > 0 ? item.pyqs.join(', ') : 'None'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                ));
              })()}
            </View>
          }
          renderItem={({ item }) => {
            if (activeCategory === 'ethics' && ethicsTab === 'innovations') {
              return null;
            }
            if (layoutColumns === 2) {
              return (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%' }}>
                  <View style={{ width: '49.2%' }}>
                    {leftCol.map(cardItem => (
                      <ValueAdditionCard
                        key={cardItem.id}
                        item={cardItem}
                        colors={colors}
                        isDark={isDark}
                        copiedId={copiedId}
                        onCopy={onCopy}
                        width="100%"
                        ethicsTab={ethicsTab}
                        forceExpandCollapse={forceExpandCollapse}
                        onAddFlashcardClick={onAddFlashcardClick}
                        templateFilter={templateFilter}
                        zoomScale={zoomScale}
                        activeCategory={activeCategory}
                        onImagePress={setZoomImageUri}
                        initialCollapsed={false}
                        userTags={userTags}
                        valueAddTags={valueAddTags}
                        onToggleValueAddTag={onToggleValueAddTag}
                        onCreateTag={onCreateTag}
                        vaFavorites={vaFavorites}
                        onToggleVaFavorite={onToggleVaFavorite}
                      />
                    ))}
                  </View>
                  <View style={{ width: '49.2%' }}>
                    {rightCol.map(cardItem => (
                      <ValueAdditionCard
                        key={cardItem.id}
                        item={cardItem}
                        colors={colors}
                        isDark={isDark}
                        copiedId={copiedId}
                        onCopy={onCopy}
                        width="100%"
                        ethicsTab={ethicsTab}
                        forceExpandCollapse={forceExpandCollapse}
                        onAddFlashcardClick={onAddFlashcardClick}
                        templateFilter={templateFilter}
                        zoomScale={zoomScale}
                        activeCategory={activeCategory}
                        onImagePress={setZoomImageUri}
                        initialCollapsed={false}
                        userTags={userTags}
                        valueAddTags={valueAddTags}
                        onToggleValueAddTag={onToggleValueAddTag}
                        onCreateTag={onCreateTag}
                        vaFavorites={vaFavorites}
                        onToggleVaFavorite={onToggleVaFavorite}
                      />
                    ))}
                  </View>
                </View>
              );
            }

            return (
              <ValueAdditionCard
                item={item}
                colors={colors}
                isDark={isDark}
                copiedId={copiedId}
                onCopy={onCopy}
                width="100%"
                ethicsTab={ethicsTab}
                forceExpandCollapse={forceExpandCollapse}
                onAddFlashcardClick={onAddFlashcardClick}
                templateFilter={templateFilter}
                zoomScale={zoomScale}
                activeCategory={activeCategory}
                onImagePress={setZoomImageUri}
                initialCollapsed={false}
                userTags={userTags}
                valueAddTags={valueAddTags}
                onToggleValueAddTag={onToggleValueAddTag}
                onCreateTag={onCreateTag}
                vaFavorites={vaFavorites}
                onToggleVaFavorite={onToggleVaFavorite}
              />
            );
          }}
          onEndReached={() => setVisibleLimit(prev => prev + 20)}
          onEndReachedThreshold={0.5}
        />
        </PinchGestureHandler>
      ) : (
        <ScrollView contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
          {/* Spacer for floating back button */}
          <View style={{ height: insets.top + 48 }} />
          <Text style={[styles.secTitleHeader, { color: colors.textPrimary }]}>Choose Category</Text>
          <View style={styles.cardsGrid}>
            {submodules.map(sub => {
              const Icon = sub.icon;
              return (
                <TouchableOpacity
                  key={sub.id}
                  activeOpacity={0.8}
                  onPress={() => {
                    setActiveCategory(sub.id);
                    if (sub.id === 'va_hub') {
                      setEthicsTab('all_formats');
                      setVaHubCategories([]);
                      setChipVaHubCategories([]);
                    } else if (sub.id === 'ethics') {
                      setEthicsTab('diagrams');
                    }
                  }}
                  style={[
                    styles.submoduleItemCard,
                    { 
                      backgroundColor: !isDark ? 'rgba(255, 255, 255, 0.55)' : 'rgba(30, 41, 59, 0.55)', 
                      borderColor: !isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.15)',
                      width: isTablet ? '48%' : (width - 44) / 2,
                      padding: isTablet ? 24 : 14,
                    }
                  ]}
                >
                  <View style={styles.cardContentLayoutVertical}>
                    <View style={[
                      styles.figmaIconBox, 
                      { 
                        backgroundColor: sub.color,
                        width: isTablet ? 64 : 48,
                        height: isTablet ? 64 : 48,
                      }
                    ]}>
                      <Icon size={isTablet ? 28 : 20} color="#ffffff" />
                    </View>
                    <View style={styles.cardTextContainerVertical}>
                      <Text style={[
                        styles.figmaCardTitle, 
                        { 
                          color: colors.textPrimary, 
                          fontSize: isTablet ? 18 : 13.5, 
                          marginTop: 4 
                        }
                      ]}>
                        {sub.title}
                      </Text>
                      <Text style={[
                        styles.figmaCardDesc, 
                        { 
                          color: colors.textSecondary, 
                          fontSize: isTablet ? 12 : 9.5, 
                          lineHeight: isTablet ? 16 : 12 
                        }
                      ]}>
                        {sub.desc}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <HierarchyModal
        visible={hierarchyModalVisible}
        onClose={() => setHierarchyModalVisible(false)}
        colors={colors}
        filters={filters}
        onUpdateFilters={setFilters}
        allPapers={allPapers}
        subjectOptions={subjectOptions}
        sectionOptions={sectionOptions}
        microtopicOptions={microtopicOptions}
        subtopicOptions={subtopicOptions}
        macrotagOptions={macrotagOptions}
        microtagOptions={microtagOptions}
        isTablet={isTablet}
        columnLabels={
          activeCategory === 'quotes'
            ? { paper: 'Paper', subject: 'Subject', section: 'Section Group', microtopic: 'Microtopic', subtopic: 'Category' }
            : (activeCategory === 'mnemonics' || activeCategory === 'intro_conclusion' || activeCategory === 'keywords_hub' || activeCategory === 'case_studies_hub' || activeCategory === 'sc_judgments_hub')
            ? { paper: 'Paper', subject: 'Subject', section: 'Section Group', microtopic: 'Microtopic', subtopic: 'Subtopic' }
            : { microtopic: 'Theme', subtopic: 'Sub-theme' }
        }
        isMainsValueAdd={true}
        isIntroConclusion={activeCategory === 'intro_conclusion'}
        isQuotes={activeCategory === 'quotes'}
        isMnemonics={activeCategory === 'mnemonics'}
        activeCategory={activeCategory || undefined}
        activeCategoryItems={activeCategoryItems || []}
      />

      {/* Revision Tags Selection Modal */}
      <Modal
        transparent
        visible={showVaTagsDropdown}
        animationType="fade"
        onRequestClose={() => setShowVaTagsDropdown(false)}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            justifyContent: 'center',
            alignItems: 'center',
          }} 
          onPress={() => setShowVaTagsDropdown(false)}
        >
          <View style={{
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 16,
            width: 250,
            maxHeight: 350,
            padding: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSecondary, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              Filter by Revision Tag
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  gap: 8,
                  backgroundColor: filters.revisionTags === 'All' ? colors.primary + '15' : 'transparent'
                }}
                onPress={() => {
                  setFilters(prev => ({ ...prev, revisionTags: 'All' }));
                  setShowVaTagsDropdown(false);
                }}
              >
                <Tag size={14} color={filters.revisionTags === 'All' ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: 13, fontWeight: '600', color: filters.revisionTags === 'All' ? colors.primary : colors.textPrimary }}>All Tags</Text>
              </TouchableOpacity>
              
              {activeVaTags.map(tag => {
                const isSelected = filters.revisionTags === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      gap: 8,
                      backgroundColor: isSelected ? colors.primary + '15' : 'transparent',
                      marginTop: 2
                    }}
                    onPress={() => {
                      setFilters(prev => ({ ...prev, revisionTags: tag }));
                      setShowVaTagsDropdown(false);
                    }}
                  >
                    <Tag size={14} color={isSelected ? colors.primary : colors.textSecondary} />
                    <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? colors.primary : colors.textPrimary }} numberOfLines={1}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Image Zoom Modal */}
      <Modal
        visible={!!zoomImageUri}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setZoomImageUri(null)}
      >
        <Pressable 
          style={{
            flex: 1,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20
          }}
          onPress={() => setZoomImageUri(null)}
        >
          {zoomImageUri && (
            <Pressable 
              style={{
                width: '92%',
                height: '78%',
                backgroundColor: '#ffffff',
                borderRadius: 24,
                padding: 20,
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.3,
                shadowRadius: 20,
                elevation: 10,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)'
              }}
              onPress={() => {} /* Capture touch to prevent modal close */}
            >
              <Image
                source={{ uri: zoomImageUri }}
                style={{
                  width: '100%',
                  height: '100%',
                }}
                resizeMode="contain"
              />
            </Pressable>
          )}

          {/* Floating Action Buttons */}
          <View 
            style={{
              position: 'absolute',
              top: insets.top + 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              zIndex: 100
            }}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={async () => {
                if (zoomImageUri) {
                  await handleCopyImage(zoomImageUri);
                }
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                paddingVertical: 10,
                paddingHorizontal: 20,
                borderRadius: 30,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
                gap: 8
              }}
            >
              {imageCopying ? (
                <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 13 }}>Copying...</Text>
              ) : (
                <>
                  <Copy size={16} color="#ffffff" />
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 13 }}>Copy Image</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setZoomImageUri(null)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                width: 44,
                height: 44,
                borderRadius: 22,
                justifyContent: 'center',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
              }}
            >
              <X size={20} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

    </View>
  );
}


function countActiveMainsFilters(f: MainsFilters): number {
  let count = 0;
  if (f.searchAcross.length < 3) count++;
  if (f.pyqFilter !== 'All') count++;
  if (f.revisionTags !== 'All') count++;
  if (f.institutes !== 'All') count++;
  if (f.program !== 'All') count++;
  if (f.paper !== 'All') count++;
  if (f.subjects !== 'All') count++;
  if (f.sections !== 'All') count++;
  if (f.microtopics !== 'All') count++;
  if (f.subtopics !== 'All') count++;
  return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. AI MAINS CONCEPTUAL SEARCH VIEW
// ─────────────────────────────────────────────────────────────────────────────
function MainsAISearchView({
  colors,
  isTablet,
  insets,
  onToggleBookmark,
  savedQuestionIds,
  onCopy,
  copiedId,
  questions,
  valueAddItems,
  onOpenDetailed,
  userTags,
  setUserTags,
  userQuestionStates,
  onActiveQuestionChange,
  onAddFlashcardClick,
  valueAddTags = {},
  onToggleValueAddTag,
  onCreateTag,
  vaFavorites = new Set<string>(),
  onToggleVaFavorite,
}: {
  colors: any;
  isTablet: boolean;
  insets: any;
  onToggleBookmark: (id: string) => void;
  savedQuestionIds: string[];
  onCopy: (id: string, text: string) => void;
  copiedId: string | null;
  questions: ConsolidatedQuestion[];
  valueAddItems: ValueAdditionItem[];
  onOpenDetailed: (q: ConsolidatedQuestion) => void;
  userTags: string[];
  setUserTags: React.Dispatch<React.SetStateAction<string[]>>;
  userQuestionStates: Record<string, { reviewTags: string[], confidence: string | null, difficulty: string | null }>;
  onActiveQuestionChange?: (q: ConsolidatedQuestion | null, activeInst?: string) => void;
  onAddFlashcardClick?: (item: any, front: string, back: string) => void;
  valueAddTags?: Record<string, string[]>;
  onToggleValueAddTag?: (cardId: string, tag: string) => void;
  onCreateTag?: (tag: string) => void;
  vaFavorites?: Set<string>;
  onToggleVaFavorite?: (cardId: string) => void;
}) {
  const { isDark } = useTheme();
  const { session } = useAuth();

  const [query, setQuery] = useState('');
  const [searchEngineMode, setSearchEngineMode] = useState<'AI' | 'AI+Fuzzy' | 'Matching' | 'Exact'>('AI');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [masterResults, setMasterResults] = useState<any[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<Set<string>>(new Set());
  const [keywordsExpanded, setKeywordsExpanded] = useState(true);

  // Search History States
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Switchers & Modal states
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<MainsFilters>(DEFAULT_MAINS_FILTERS);
  const [hierarchyModalVisible, setHierarchyModalVisible] = useState(false);
  const [pendingFilters, setPendingFilters] = useState<MainsFilters>(DEFAULT_MAINS_FILTERS);

  // Sidebar specific subject filter (client-side)
  const [sidebarSubjectFilter, setSidebarSubjectFilter] = useState<string | null>(null);

  const sortedResults = useMemo(() => {
    return [...results].sort((a, b) => {
      const aFav = (a.type === 'value_add' && vaFavorites?.has(a.id)) ? 1 : 0;
      const bFav = (b.type === 'value_add' && vaFavorites?.has(b.id)) ? 1 : 0;
      return bFav - aFav;
    });
  }, [results, vaFavorites]);

  const allYears = useMemo(() => {
    const yearSet = new Set<string>();
    questions.forEach(q => {
      const yr = q.year;
      if (yr) yearSet.add(String(yr));
    });
    return Array.from(yearSet).sort((a, b) => Number(b) - Number(a));
  }, [questions]);

  // User Revision Tags (passed as props)

  // Expanded ID & answers selections
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localSelectedAnswerInst, setLocalSelectedAnswerInst] = useState<Record<string, string>>({});
  const scrollViewRef = useRef<ScrollView>(null);
  const cardYOffsets = useRef<Record<string, number>>({});

  useEffect(() => {
    if (expandedId) {
      const q = questions.find(item => item.id === expandedId);
      if (q) {
        const cleanAnsList = getCleanAvailableAnswers(q.answers);
        const currentInst = cleanAnsList.length > 0 ? (localSelectedAnswerInst[q.id] || cleanAnsList[0].institute) : undefined;
        onActiveQuestionChange?.(q, currentInst);
      }
    } else {
      onActiveQuestionChange?.(null);
    }
    return () => onActiveQuestionChange?.(null);
  }, [expandedId, localSelectedAnswerInst, questions, onActiveQuestionChange]);



  // PYQ Widget — hot topics from predictive analysis
  const [pyqHotTopics, setPyqHotTopics] = useState<any[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allSearchSubjects = useMemo(() => {
    const subjects = new Set<string>();
    masterResults.forEach(r => {
      if (r.subject) subjects.add(r.subject);
    });
    return Array.from(subjects).sort();
  }, [masterResults]);


  // 1. Fetch options dynamically from props questions and value additions
  const allPapers = useMemo(() => {
    const paperSet = new Set<string>();
    questions.forEach(q => { if (q.paper) paperSet.add(q.paper); });
    valueAddItems.forEach(va => { if (va.paper) paperSet.add(va.paper); });
    return Array.from(paperSet).sort();
  }, [questions, valueAddItems]);

  const subjectOptions = useMemo(() => {
    const paperFilter = pendingFilters.paper !== 'All' ? pendingFilters.paper.split('|') : [];
    const subSet = new Set<string>();
    questions.forEach(q => {
      if (paperFilter.length === 0 || paperFilter.includes(q.paper)) {
        if (q.subject) subSet.add(q.subject);
      }
    });
    valueAddItems.forEach(va => {
      if (paperFilter.length === 0 || paperFilter.includes(va.paper || '')) {
        if (va.subject) subSet.add(va.subject);
      }
    });
    return Array.from(subSet).sort();
  }, [questions, valueAddItems, pendingFilters.paper]);

  const sectionOptions = useMemo(() => {
    const paperFilter = pendingFilters.paper !== 'All' ? pendingFilters.paper.split('|') : [];
    const subjectFilter = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split('|') : [];
    const secSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const sGroup = getQuestionSection(q);
      if (matchPaper && matchSubject && sGroup) {
        secSet.add(sGroup);
      }
    });
    valueAddItems.forEach(va => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(va.paper || '');
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(va.subject || '');
      const vaSec = getValueAddSection(va);
      if (matchPaper && matchSubject && vaSec) {
        secSet.add(vaSec);
      }
    });
    return Array.from(secSet).sort(naturalCompare);
  }, [questions, valueAddItems, pendingFilters.paper, pendingFilters.subjects]);

  const microtopicOptions = useMemo(() => {
    const paperFilter = pendingFilters.paper !== 'All' ? pendingFilters.paper.split('|') : [];
    const subjectFilter = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split('|') : [];
    const sectionFilter = pendingFilters.sections !== 'All' ? pendingFilters.sections.split('|') : [];
    const mtSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const micro = getQuestionMicro(q);
      if (matchPaper && matchSubject && matchSec && micro) {
        mtSet.add(micro);
      }
    });
    valueAddItems.forEach(va => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(va.paper || '');
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(va.subject || '');
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getValueAddSection(va));
      const micro = getValueAddMicro(va);
      if (matchPaper && matchSubject && matchSec && micro) {
        mtSet.add(micro);
      }
    });
    return Array.from(mtSet).sort(naturalCompare);
  }, [questions, valueAddItems, pendingFilters.paper, pendingFilters.subjects, pendingFilters.sections]);

  const subtopicOptions = useMemo(() => {
    const paperFilter = pendingFilters.paper !== 'All' ? pendingFilters.paper.split('|') : [];
    const subjectFilter = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split('|') : [];
    const sectionFilter = pendingFilters.sections !== 'All' ? pendingFilters.sections.split('|') : [];
    const microtopicFilter = pendingFilters.microtopics !== 'All' ? pendingFilters.microtopics.split('|') : [];
    const subSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const sub = getQuestionSub(q);
      if (matchPaper && matchSubject && matchSec && matchMicro && sub) {
        subSet.add(sub);
      }
    });
    valueAddItems.forEach(va => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(va.paper || '');
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(va.subject || '');
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getValueAddSection(va));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getValueAddMicro(va));
      const sub = getValueAddSub(va);
      if (matchPaper && matchSubject && matchSec && matchMicro && sub) {
        subSet.add(sub);
      }
    });
    return Array.from(subSet).sort(naturalCompare);
  }, [questions, valueAddItems, pendingFilters.paper, pendingFilters.subjects, pendingFilters.sections, pendingFilters.microtopics]);

  const nanotopicOptions = useMemo(() => {
    const paperFilter = pendingFilters.paper !== 'All' ? pendingFilters.paper.split('|') : [];
    const subjectFilter = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split('|') : [];
    const sectionFilter = pendingFilters.sections !== 'All' ? pendingFilters.sections.split('|') : [];
    const microtopicFilter = pendingFilters.microtopics !== 'All' ? pendingFilters.microtopics.split('|') : [];
    const subtopicFilter = pendingFilters.subtopics !== 'All' ? pendingFilters.subtopics.split('|') : [];
    const ntSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
      const nano = getQuestionNano(q);
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && nano) {
        ntSet.add(nano);
      }
    });
    return Array.from(ntSet).sort(naturalCompare);
  }, [questions, pendingFilters.paper, pendingFilters.subjects, pendingFilters.sections, pendingFilters.microtopics, pendingFilters.subtopics]);

  const macrotagOptions = useMemo(() => {
    const paperFilter = pendingFilters.paper !== 'All' ? pendingFilters.paper.split('|') : [];
    const subjectFilter = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split('|') : [];
    const sectionFilter = pendingFilters.sections !== 'All' ? pendingFilters.sections.split('|') : [];
    const microtopicFilter = pendingFilters.microtopics !== 'All' ? pendingFilters.microtopics.split('|') : [];
    const subtopicFilter = pendingFilters.subtopics !== 'All' ? pendingFilters.subtopics.split('|') : [];
    const tagSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && q.macrotag) {
        q.macrotag.split(',').forEach(t => tagSet.add(t.trim()));
      }
    });
    return Array.from(tagSet).sort();
  }, [questions, pendingFilters.paper, pendingFilters.subjects, pendingFilters.sections, pendingFilters.microtopics, pendingFilters.subtopics]);

  const microtagOptions = useMemo(() => {
    if (pendingFilters.macrotags === 'All') return [];
    const paperFilter = pendingFilters.paper !== 'All' ? pendingFilters.paper.split('|') : [];
    const subjectFilter = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split('|') : [];
    const sectionFilter = pendingFilters.sections !== 'All' ? pendingFilters.sections.split('|') : [];
    const microtopicFilter = pendingFilters.microtopics !== 'All' ? pendingFilters.microtopics.split('|') : [];
    const subtopicFilter = pendingFilters.subtopics !== 'All' ? pendingFilters.subtopics.split('|') : [];
    const macrotagFilter = pendingFilters.macrotags !== 'All' ? pendingFilters.macrotags.split('|') : [];
    const tagSet = new Set<string>();
    questions.forEach(q => {
      const matchPaper = paperFilter.length === 0 || paperFilter.includes(q.paper);
      const matchSubject = subjectFilter.length === 0 || subjectFilter.includes(q.subject);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(getQuestionSub(q));
      const matchMacro = macrotagFilter.length === 0 || (q.macrotag || '').split(',').map(t => t.trim()).some(t => macrotagFilter.includes(t));
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && matchMacro && q.microtag) {
        q.microtag.split(',').forEach(t => tagSet.add(t.trim()));
      }
    });
    return Array.from(tagSet).sort();
  }, [questions, pendingFilters.paper, pendingFilters.subjects, pendingFilters.sections, pendingFilters.microtopics, pendingFilters.subtopics, pendingFilters.macrotags]);

  const allInstitutes = useMemo(() => {
    const instSet = new Set<string>();
    questions.forEach(q => {
      if (q.institute) {
        instSet.add(q.institute.trim());
      } else if (q.is_pyq) {
        instSet.add('UPSC');
      }
    });
    return Array.from(instSet).sort();
  }, [questions]);

  const allPrograms = useMemo(() => {
    if (pendingFilters.institutes === 'All') return [];
    const progSet = new Set<string>();
    const selectedInsts = pendingFilters.institutes.split(',');
    questions.forEach(q => {
      const instName = q.institute || (q.is_pyq ? 'UPSC' : '');
      if (instName && selectedInsts.includes(instName)) {
        if (q.program_name) {
          progSet.add(q.program_name.trim());
        }
      }
    });
    return Array.from(progSet).sort();
  }, [questions, pendingFilters.institutes]);

  const activeFilterCount = useMemo(() => countActiveMainsFilters(filters), [filters]);

  useEffect(() => {
    if (questions && questions.length > 0) {
      const mapped = questions.map(q => ({
        ...q,
        exam_year: q.year,
        micro_topic: q.microTopic || ''
      }));
      const predictive = buildPredictive(mapped, (q: any) => q.exam_year ?? null, { level: 'micro_topic' });
      const hots = probableHotsFor2026(predictive, 2, 8);
      setPyqHotTopics(hots);
    }
  }, [questions]);

  // 2. Load search history and tags on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const raw = await AsyncStorage.getItem('mains_search_history');
        if (raw) setSearchHistory(JSON.parse(raw));
      } catch (err) {
        console.warn('Failed to load search history:', err);
      }
    };
    initData();
  }, []);

  // 3. Local filtering helper for excluded keywords and sidebar subject
  const applyLocalKeywordExclusions = (
    rawList: any[],
    excluded: Set<string>,
    kws: string[],
    subFilter: string | null
  ) => {
    let filtered = rawList;

    // Filter by excluded keywords
    if (excluded.size > 0) {
      filtered = filtered.filter(item => {
        let text = '';
        if (item.type === 'question') {
          text = (
            (item.questionText || '') + ' ' +
            (item.answers || []).map((a: any) => a.answerText || '').join(' ')
          ).toLowerCase();
        } else {
          text = (
            (item.title || '') + ' ' +
            (item.rawContent || '') + ' ' +
            (item.context || '')
          ).toLowerCase();
        }
        // Keep result if it matches at least one active (non-excluded) keyword
        return kws.some(k => !excluded.has(k) && text.includes(k.toLowerCase()));
      });
    }

    // Filter by sidebar subject
    if (subFilter) {
      filtered = filtered.filter(item => item.subject === subFilter);
    }

    return filtered;
  };

  const toggleExcludedKeyword = (kw: string) => {
    const next = new Set(excludedKeywords);
    if (next.has(kw)) {
      next.delete(kw);
    } else {
      next.add(kw);
    }
    setExcludedKeywords(next);
    const filtered = applyLocalKeywordExclusions(masterResults, next, keywords, sidebarSubjectFilter);
    setResults(filtered);
  };

  const toggleSidebarSubject = (sub: string | null) => {
    setSidebarSubjectFilter(sub);
    const filtered = applyLocalKeywordExclusions(masterResults, excludedKeywords, keywords, sub);
    setResults(filtered);
  };

  // 4. Run Mains Search execution
  const runMainsSearch = async (overrideQuery?: string, overrideFilters?: MainsFilters, overrideEngineMode?: 'AI' | 'AI+Fuzzy' | 'Matching' | 'Exact') => {
    const currentQuery = (overrideQuery ?? query).trim();
    if (!currentQuery) return;

    const activeFilters = overrideFilters ?? filters;
    const engineMode = overrideEngineMode ?? searchEngineMode;

    setLoading(true);
    setHasSearched(true);
    setExpandedId(null);
    setExcludedKeywords(new Set());
    setSidebarSubjectFilter(null);

    // Save query to history
    if (!overrideQuery) {
      setSearchHistory(prev => {
        const next = [currentQuery, ...prev.filter(q => q !== currentQuery)].slice(0, 10);
        AsyncStorage.setItem('mains_search_history', JSON.stringify(next)).catch(() => {});
        return next;
      });
    }

    try {
      let keywordsList: string[] = [currentQuery.toLowerCase()];
      let displayKeywords: string[] = [];
      if (engineMode === 'AI' || engineMode === 'AI+Fuzzy') {
        try {
          const res = await aiExpandSearchQuery(currentQuery);
          if (res && res.keywords && res.keywords.length > 0) {
            displayKeywords = res.keywords.map(k => k.toLowerCase());
            const userWords = currentQuery.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
            keywordsList = [...new Set([currentQuery.toLowerCase(), ...userWords, ...displayKeywords])];
          }
        } catch (err) {
          console.warn('Gemini query expansion failed, falling back to exact:', err);
        }
      }
      setKeywords(displayKeywords.length > 0 ? displayKeywords : [currentQuery.toLowerCase()]);

      // ── LOCAL FILTERING & SCORING ──
      const matchedResults: any[] = [];
 
      // A. Search subjective questions
      const showQuestions = activeFilters.pyqFilter === 'All' || activeFilters.pyqFilter === 'PYQ Only';
      const searchQuestions = activeFilters.searchAcross.includes('Questions');
      const searchAnswers = activeFilters.searchAcross.includes('Answers');
 
      if (showQuestions && (searchQuestions || searchAnswers)) {
        questions.forEach(q => {
          // Hard Filters
          if (activeFilters.paper !== 'All' && !activeFilters.paper.split('|').includes(q.paper)) return;
          if (activeFilters.subjects !== 'All' && !activeFilters.subjects.split('|').includes(q.subject)) return;
          if (activeFilters.sections !== 'All' && !activeFilters.sections.split('|').includes(getQuestionSection(q))) return;
          if (activeFilters.microtopics !== 'All' && !activeFilters.microtopics.split('|').includes(getQuestionMicro(q))) return;
          if (activeFilters.subtopics !== 'All' && !activeFilters.subtopics.split('|').includes(getQuestionSub(q))) return;
          
          if (activeFilters.revisionTags !== 'All') {
            const selectedTags = activeFilters.revisionTags.split(',');
            const tagsForQ = userQuestionStates[q.id]?.reviewTags || [];
            const hasMatch = selectedTags.some(t => tagsForQ.includes(t));
            if (!hasMatch) return;
          }

          if (activeFilters.macrotags !== 'All') {
            const macroFilter = activeFilters.macrotags.split('|');
            const qMacros = (q.macrotag || '').split(',').map(t => t.trim());
            const hasMatch = qMacros.some(t => macroFilter.includes(t));
            if (!hasMatch) return;
          }
          if (activeFilters.microtags !== 'All') {
            const microFilter = activeFilters.microtags.split('|');
            const qMicros = (q.microtag || '').split(',').map(t => t.trim());
            const hasMatch = qMicros.some(t => microFilter.includes(t));
            if (!hasMatch) return;
          }

          // Institute filter
          if (activeFilters.institutes !== 'All') {
            const selectedInsts = activeFilters.institutes.split(',');
            const instName = q.institute || (q.is_pyq ? 'UPSC' : '');
            if (!instName || !selectedInsts.includes(instName)) return;
          }

          // Program filter
          if (activeFilters.program !== 'All') {
            const selectedProgs = activeFilters.program.split(',');
            if (!q.program_name || !selectedProgs.includes(q.program_name)) return;
          }

          // Match keywords
          let score = 0;
          const qText = (q.questionText || '').toLowerCase();
          const qSub = (q.subject || '').toLowerCase();
          const qSec = (getQuestionSection(q) || '').toLowerCase();
          const qMicro = (getQuestionMicro(q) || '').toLowerCase();
          const qSubTopic = (getQuestionSub(q) || '').toLowerCase();
          const ansText = (q.answers || []).map(a => a.answerText || '').join(' ').toLowerCase();

          keywordsList.forEach((kw, index) => {
            const weight = index === 0 ? 3 : 1;
            let kwMatched = false;

            // Match in question details
            if (searchQuestions) {
              if (qText.includes(kw)) {
                score += 2 * weight;
                kwMatched = true;
              }
              if (qSub.includes(kw) || qSec.includes(kw) || qMicro.includes(kw) || qSubTopic.includes(kw)) {
                score += 1.5 * weight;
                kwMatched = true;
              }
            }

            // Match in answers details
            if (searchAnswers) {
              if (ansText.includes(kw)) {
                score += 0.5 * weight;
                kwMatched = true;
              }
            }

            if (!kwMatched && engineMode === 'AI+Fuzzy') {
              // Fuzzy checks
              if (qText.length > 5 && kw.length > 3 && (qText.includes(kw.substring(0, 4)) || kw.includes(qText.substring(0, 4)))) {
                score += 0.2 * weight;
              }
            }
          });

          if (score > 0) {
            matchedResults.push({ ...q, type: 'question', score });
          }
        });
      }

      // B. Search value additions
      const showValueAdd = activeFilters.pyqFilter === 'All' || activeFilters.pyqFilter === 'Non-PYQ';
      const searchValAdd = activeFilters.searchAcross.includes('Value Additions');

      if (showValueAdd && searchValAdd) {
        valueAddItems.forEach(item => {
          // Hard Filters
          if (item.category === 'frameworks') {
            const fwHierarchies = item.hierarchies || [];
            const parsedHiers = [...fwHierarchies];
            for (let idx = 1; idx <= 5; idx++) {
              const path = item[`hierarchy_${idx}_path`];
              if (path && Array.isArray(path) && path.length > 0) {
                parsedHiers.push({
                  paper: path[0] || '',
                  subject: path[1] || '',
                  sectionGroup: path[2] || '',
                  microtopic: path[3] || '',
                  subtopic: path[4] || ''
                });
              }
            }
            if (parsedHiers.length > 0) {
              if (activeFilters.paper !== 'All' && !parsedHiers.some((h: any) => h.paper && activeFilters.paper.split('|').includes(h.paper))) return;
              if (activeFilters.subjects !== 'All' && !parsedHiers.some((h: any) => h.subject && activeFilters.subjects.split('|').includes(h.subject))) return;
              if (activeFilters.sections !== 'All' && !parsedHiers.some((h: any) => (h.sectionGroup || h.section_group) && activeFilters.sections.split('|').includes(h.sectionGroup || h.section_group))) return;
              if (activeFilters.microtopics !== 'All' && !parsedHiers.some((h: any) => h.microtopic && activeFilters.microtopics.split('|').includes(h.microtopic))) return;
              if (activeFilters.subtopics !== 'All' && !parsedHiers.some((h: any) => h.subtopic && activeFilters.subtopics.split('|').includes(h.subtopic))) return;
              if (activeFilters.nanotopics !== 'All') return;
            } else {
              if (activeFilters.paper !== 'All' || activeFilters.subjects !== 'All' || activeFilters.sections !== 'All' || activeFilters.microtopics !== 'All' || activeFilters.subtopics !== 'All' || activeFilters.nanotopics !== 'All') return;
            }
          } else {
            if (activeFilters.paper !== 'All' && !activeFilters.paper.split('|').includes(item.paper || '')) return;
            if (activeFilters.subjects !== 'All' && !activeFilters.subjects.split('|').includes(item.subject || '')) return;
            if (activeFilters.sections !== 'All' && !activeFilters.sections.split('|').includes(getValueAddSection(item))) return;
            if (activeFilters.microtopics !== 'All' && !activeFilters.microtopics.split('|').includes(getValueAddMicro(item))) return;
            if (activeFilters.subtopics !== 'All' && !activeFilters.subtopics.split('|').includes(getValueAddSub(item))) return;
            if (activeFilters.nanotopics !== 'All' && !activeFilters.nanotopics.split('|').includes(getValueAddNano(item))) return;
          }
          if (activeFilters.revisionTags !== 'All') return;
          if (activeFilters.macrotags !== 'All') return;
          if (activeFilters.microtags !== 'All') return; // value additions have no custom tags in public states
          if (activeFilters.institutes !== 'All') return; // value additions have no answer institutes

          if (activeFilters.program !== 'All') {
            if (!item.source || !activeFilters.program.split(',').includes(item.source)) return;
          }

          // Match keywords
          let score = 0;
          const title = (item.title || '').toLowerCase();
          const sub = (item.subject || '').toLowerCase();
          const sec = (getValueAddSection(item) || '').toLowerCase();
          const micro = (getValueAddMicro(item) || '').toLowerCase();
          const subtopic = (getValueAddSub(item) || '').toLowerCase();

          const context = (item.context || '').toLowerCase();
          const quote = (item.quoteText || '').toLowerCase();
          const author = (item.author || '').toLowerCase();
          const mnemonicKw = (item.mnemonicKeyword || '').toLowerCase();
          const mnemExpansion = (item.mnemonicExpansion || []).map(e => `${e.letter} ${e.meaning} ${e.detail || ''}`).join(' ').toLowerCase();
          const fwBoxes = (item.frameworkBoxes || []).map(b => `${b.label} ${b.description}`).join(' ').toLowerCase();
          const fwGuide = (item.frameworkGuide || '').toLowerCase();
          const rawContent = (item.rawContent || '').toLowerCase();
          const ethData = item.ethicsData ? `${item.ethicsData.diagramType || ''} ${item.ethicsData.diagramDescription || ''} ${(item.ethicsData.dimensionsList || []).join(' ')} ${item.ethicsData.officerName || ''} ${item.ethicsData.initiative || ''} ${item.ethicsData.values || ''}`.toLowerCase() : '';

          const allText = `${context} ${quote} ${author} ${mnemonicKw} ${mnemExpansion} ${fwBoxes} ${fwGuide} ${rawContent} ${ethData}`;

          keywordsList.forEach((kw, index) => {
            const weight = index === 0 ? 3 : 1;
            if (title.includes(kw)) {
              score += 2 * weight;
            }
            if (sub.includes(kw) || sec.includes(kw) || micro.includes(kw) || subtopic.includes(kw)) {
              score += 1.5 * weight;
            }
            if (allText.includes(kw)) {
              score += 0.5 * weight;
            }
          });

          if (score > 0) {
            matchedResults.push({ ...item, type: 'value_add', score });
          }
        });
      }

      matchedResults.sort((a, b) => b.score - a.score);
      setMasterResults(matchedResults);
      setResults(matchedResults);
    } catch (error) {
      Alert.alert('Search Error', 'Failed to perform search. Please try again.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    setFilterOpen(false);
    if (hasSearched && query.trim()) {
      runMainsSearch(query, pendingFilters);
    }
  };

  const clearAllFilters = () => {
    setPendingFilters(DEFAULT_MAINS_FILTERS);
  };

  const handleUpdateFilters = (newFilters: MainsFilters) => {
    setFilters(newFilters);
    setPendingFilters(newFilters);
    if (hasSearched && query.trim()) {
      runMainsSearch(query, newFilters);
    }
  };

  const renderEmptyState = () => {
    const trendPool = [
      'Discretionary powers of Governor',
      'Parliamentary committees accountability',
      'Fiscal federalism GST challenges',
      'Self Help Groups rural development',
      'NGOs and foreign funding regulations',
      'E-governance models and limitations',
      'Indo-Pacific geopolitical significance',
      'Climate change mitigation strategies India',
      'Inclusive growth and employment challenges',
      'Land reforms impact on agriculture',
      'Food processing industry constraints',
      'Ethical dilemmas in public administration',
      'Corporate governance principles',
      'AI ethics and regulation',
      'Secularism in Indian Constitution',
      'Urbanization issues and solutions',
      'Women empowerment schemes evaluation'
    ];
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const ROTATE = 4;
    const offset = (dayOfYear * ROTATE) % trendPool.length;
    const suggestedFromTrend = [
      trendPool[offset % trendPool.length],
      trendPool[(offset + 1) % trendPool.length],
      trendPool[(offset + 2) % trendPool.length],
      trendPool[(offset + 3) % trendPool.length],
    ];
    const historyItems = searchHistory.slice(0, 3);

    return (
      <View style={styles.emptyState}>
        <View style={[styles.figmaIconBox, { backgroundColor: '#7c3aed', width: 56, height: 56, borderRadius: 16, marginBottom: 12, alignItems: 'center', justifyContent: 'center' }]}>
          <Brain size={28} color="#fff" />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>AI Mains Search</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Enter a topic, question, or concept to retrieve subjective model answers and value addition resources.
        </Text>

        {/* Recent searches section */}
        {historyItems.length > 0 && (
          <View style={{ width: '100%', marginBottom: 14 }}>
            <Text style={[styles.examplesLabel, { color: colors.textTertiary }]}>CONTINUE WHERE YOU LEFT OFF</Text>
            {historyItems.map((h) => (
              <TouchableOpacity
                key={`h-${h}`}
                onPress={() => { setQuery(h); runMainsSearch(h, filters); }}
                style={[styles.exampleChip, { backgroundColor: colors.surface, borderColor: '#7c3aed30' }]}
              >
                <Clock size={12} color="#7c3aed" />
                <Text style={[styles.exampleText, { color: colors.textSecondary }]} numberOfLines={1}>{h}</Text>
                <ChevronRight size={12} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Smart trending suggestions */}
        <View style={{ width: '100%', marginBottom: 14 }}>
          <Text style={[styles.examplesLabel, { color: colors.textTertiary }]}>
            SMART SUGGESTIONS
          </Text>
          {suggestedFromTrend.map((ex) => (
            <TouchableOpacity
              key={ex}
              onPress={() => { setQuery(ex); runMainsSearch(ex, filters); }}
              style={[styles.exampleChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Sparkles size={12} color="#7c3aed" />
              <Text style={[styles.exampleText, { color: colors.textSecondary }]}>{ex}</Text>
              <ChevronRight size={12} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* PYQ Hot Topics Widget */}
        {pyqHotTopics.length > 0 && (
          <View style={{ width: '100%', marginTop: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Flame size={14} color="#ef4444" />
              <Text style={[styles.examplesLabel, { color: colors.textTertiary, marginBottom: 0 }]}>
                PYQ FORECAST 2026 — PROBABLE HOT TOPICS
              </Text>
            </View>
            {pyqHotTopics.slice(0, 5).map((topic, i) => (
              <TouchableOpacity
                key={topic.key}
                onPress={() => {
                  const q = topic.key;
                  setQuery(q);
                  const newFilters = { ...filters, pyqFilter: 'PYQ Only' as const };
                  setFilters(newFilters);
                  runMainsSearch(q, newFilters);
                }}
                style={[styles.exampleChip, {
                  backgroundColor: i < 3 ? '#fef2f2' : colors.surface,
                  borderColor: i < 3 ? '#fca5a5' : colors.border,
                }]}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: i < 3 ? '#ef4444' : '#94a3b8',
                }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>{i + 1}</Text>
                </View>
                <Text style={[styles.exampleText, { flex: 1, color: i < 3 ? '#dc2626' : colors.textSecondary }]} numberOfLines={1}>{topic.key}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#ef4444' }}>🔥 {topic.hotScore}</Text>
                  <Text style={{ fontSize: 9, color: colors.textTertiary }}>{topic.totalQuestions}Q</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const isOptionalSearch = pendingFilters.paper !== 'All' && !pendingFilters.paper.split('|').some(p => ['GS1', 'GS2', 'GS3', 'GS4', 'Essay'].includes(p));

  const FilterPopup = (
    <Modal
      visible={filterOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setFilterOpen(false)}
    >
      <Pressable style={styles.overlay} onPress={() => setFilterOpen(false)}>
        <Pressable
          style={[styles.popup, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1, flexDirection: 'column' }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.popupHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <TouchableOpacity
                onPress={() => setFilterOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceStrong }]}
              >
                <X size={12} color={colors.textSecondary} />
              </TouchableOpacity>
              <Filter size={15} color={colors.textSecondary} />
              <Text style={[styles.popupTitle, { color: colors.textPrimary }]}>Mains Search Filters</Text>
            </View>
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={[styles.clearBtn, { color: colors.textTertiary }]}>Clear all</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.aiNote, { backgroundColor: '#ede9fe' }]}>
            <Brain size={13} color="#7c3aed" />
            <Text style={[styles.aiNoteText, { color: '#7c3aed' }]}>
              Narrow down conceptual Mains results. Parent selections filter child dropdown menus dynamically.
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.popupBody} showsVerticalScrollIndicator={true}>
            
            {/* Search Across */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SEARCH ACROSS</Text>
              <View style={styles.chipsWrap}>
                {(['Questions', 'Answers', 'Value Additions'] as const).map(opt => {
                  const isSelected = pendingFilters.searchAcross.includes(opt);
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => {
                        const list = [...pendingFilters.searchAcross];
                        const next = isSelected ? list.filter(i => i !== opt) : [...list, opt];
                        setPendingFilters(p => ({ ...p, searchAcross: next.length > 0 ? next : ['Questions'] }));
                      }}
                      style={[styles.fchip, isSelected && styles.fchipSel]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* PYQ MODE */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>PYQ FILTER</Text>
              <View style={styles.chipsWrap}>
                {(['All', 'PYQ Only', 'Non-PYQ'] as const).map(opt => {
                  const isSelected = pendingFilters.pyqFilter === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setPendingFilters(p => ({ ...p, pyqFilter: opt }))}
                      style={[styles.fchip, isSelected && styles.fchipSel]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Revision Tags */}
            {userTags.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>REVISION TAGS</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, revisionTags: 'All' }))}
                    style={[styles.fchip, pendingFilters.revisionTags === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.revisionTags === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {userTags.map(tag => {
                    const isSelected = pendingFilters.revisionTags.split(',').includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => {
                          const list = pendingFilters.revisionTags === 'All' ? [] : pendingFilters.revisionTags.split(',').filter(Boolean);
                          const next = isSelected ? list.filter(t => t !== tag) : [...list, tag];
                          setPendingFilters(p => ({ ...p, revisionTags: next.length ? next.join(',') : 'All' }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{tag}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Institutes */}
            {allInstitutes.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>INSTITUTES</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, institutes: 'All' }))}
                    style={[styles.fchip, pendingFilters.institutes === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.institutes === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {allInstitutes.map(inst => {
                    const isSelected = pendingFilters.institutes.split(',').includes(inst);
                    return (
                      <TouchableOpacity
                        key={inst}
                        onPress={() => {
                          const list = pendingFilters.institutes === 'All' ? [] : pendingFilters.institutes.split(',').filter(Boolean);
                          const next = isSelected ? list.filter(i => i !== inst) : [...list, inst];
                          setPendingFilters(p => ({ ...p, institutes: next.length ? next.join(',') : 'All' }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{inst}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Programs */}
            {allPrograms.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>PROGRAMMES</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, program: 'All' }))}
                    style={[styles.fchip, pendingFilters.program === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.program === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {allPrograms.map(prog => {
                    const isSelected = pendingFilters.program.split(',').includes(prog);
                    return (
                      <TouchableOpacity
                        key={prog}
                        onPress={() => {
                          const list = pendingFilters.program === 'All' ? [] : pendingFilters.program.split(',').filter(Boolean);
                          const next = isSelected ? list.filter(p => p !== prog) : [...list, prog];
                          setPendingFilters(p => ({ ...p, program: next.length ? next.join(',') : 'All' }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{prog}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* HIERARCHICAL DRILL DOWN FILTER */}
            <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textPrimary, marginVertical: 6, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingBottom: 4 }}>
              HIERARCHICAL CURRICULUM DRILL DOWN
            </Text>

            {/* Paper Selector */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>STAGE/PAPER</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => setPendingFilters(p => ({ ...p, paper: 'All', subjects: 'All', sections: 'All', microtopics: 'All' }))}
                  style={[styles.fchip, pendingFilters.paper === 'All' && styles.fchipSel]}
                >
                  <Text style={[styles.fchipText, { color: pendingFilters.paper === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                </TouchableOpacity>
                {allPapers.map(pName => {
                  const isSelected = pendingFilters.paper.split('|').includes(pName);
                  return (
                    <TouchableOpacity
                      key={pName}
                      onPress={() => {
                        const list = pendingFilters.paper === 'All' ? [] : pendingFilters.paper.split('|').filter(Boolean);
                        const next = isSelected ? list.filter(p => p !== pName) : [...list, pName];
                        setPendingFilters(p => ({
                          ...p,
                          paper: next.length ? next.join('|') : 'All',
                          subjects: 'All',
                          sections: 'All',
                          microtopics: 'All',
                          subtopics: 'All'
                        }));
                      }}
                      style={[styles.fchip, isSelected && styles.fchipSel]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{pName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Subject Selector */}
            {pendingFilters.paper !== 'All' && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SUBJECT</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, subjects: 'All', sections: 'All', microtopics: 'All' }))}
                    style={[styles.fchip, pendingFilters.subjects === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.subjects === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {subjectOptions.map(subName => {
                    const isSelected = pendingFilters.subjects.split('|').includes(subName);
                    return (
                      <TouchableOpacity
                        key={subName}
                        onPress={() => {
                          const list = pendingFilters.subjects === 'All' ? [] : pendingFilters.subjects.split('|').filter(Boolean);
                          const next = isSelected ? list.filter(s => s !== subName) : [...list, subName];
                          setPendingFilters(p => ({
                            ...p,
                            subjects: next.length ? next.join('|') : 'All',
                            sections: 'All',
                            microtopics: 'All',
                            subtopics: 'All'
                          }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{subName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Section Selector */}
            {pendingFilters.paper !== 'All' && pendingFilters.subjects !== 'All' && sectionOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>{isOptionalSearch ? 'OPTIONAL PAPER' : 'SECTION / CHAPTER'}</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, sections: 'All', microtopics: 'All' }))}
                    style={[styles.fchip, pendingFilters.sections === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.sections === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {sectionOptions.map(secName => {
                    const isSelected = pendingFilters.sections.split('|').includes(secName);
                    return (
                      <TouchableOpacity
                        key={secName}
                        onPress={() => {
                          const list = pendingFilters.sections === 'All' ? [] : pendingFilters.sections.split('|').filter(Boolean);
                          const next = isSelected ? list.filter(s => s !== secName) : [...list, secName];
                          setPendingFilters(p => ({
                            ...p,
                            sections: next.length ? next.join('|') : 'All',
                            microtopics: 'All',
                            subtopics: 'All'
                          }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{secName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Microtopic Selector */}
            {pendingFilters.paper !== 'All' && pendingFilters.subjects !== 'All' && pendingFilters.sections !== 'All' && microtopicOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>{isOptionalSearch ? 'UNIT' : 'MICROTOPIC'}</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' }))}
                    style={[styles.fchip, pendingFilters.microtopics === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.microtopics === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {microtopicOptions.map(mtName => {
                    const isSelected = pendingFilters.microtopics.split('|').includes(mtName);
                    return (
                      <TouchableOpacity
                        key={mtName}
                        onPress={() => {
                          const list = pendingFilters.microtopics === 'All' ? [] : pendingFilters.microtopics.split('|').filter(Boolean);
                          const next = isSelected ? list.filter(m => m !== mtName) : [...list, mtName];
                          setPendingFilters(p => ({
                            ...p,
                            microtopics: next.length ? next.join('|') : 'All',
                            subtopics: 'All',
                            macrotags: 'All',
                            microtags: 'All'
                          }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{mtName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Sub-topic Selector */}
            {pendingFilters.paper !== 'All' && pendingFilters.subjects !== 'All' && pendingFilters.sections !== 'All' && pendingFilters.microtopics !== 'All' && subtopicOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>{isOptionalSearch ? 'MICROTOPIC' : 'SUB-TOPIC'}</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, subtopics: 'All', macrotags: 'All', microtags: 'All' }))}
                    style={[styles.fchip, pendingFilters.subtopics === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.subtopics === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {subtopicOptions.map(stName => {
                    const isSelected = pendingFilters.subtopics.split('|').includes(stName);
                    return (
                      <TouchableOpacity
                        key={stName}
                        onPress={() => {
                          const list = pendingFilters.subtopics === 'All' ? [] : pendingFilters.subtopics.split('|').filter(Boolean);
                          const next = isSelected ? list.filter(s => s !== stName) : [...list, stName];
                          setPendingFilters(p => ({
                            ...p,
                            subtopics: next.length ? next.join('|') : 'All',
                            macrotags: 'All',
                            microtags: 'All'
                          }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{stName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Macrotag Selector */}
            {macrotagOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>MACRO TAG</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, macrotags: 'All', microtags: 'All' }))}
                    style={[styles.fchip, pendingFilters.macrotags === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.macrotags === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {macrotagOptions.map(matName => {
                    const isSelected = pendingFilters.macrotags.split('|').includes(matName);
                    return (
                      <TouchableOpacity
                        key={matName}
                        onPress={() => {
                          const list = pendingFilters.macrotags === 'All' ? [] : pendingFilters.macrotags.split('|').filter(Boolean);
                          const next = isSelected ? list.filter(m => m !== matName) : [...list, matName];
                          setPendingFilters(p => ({
                            ...p,
                            macrotags: next.length ? next.join('|') : 'All',
                            microtags: 'All'
                          }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{matName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Microtag Selector */}
            {pendingFilters.macrotags !== 'All' && microtagOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>MICRO TAG</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, microtags: 'All' }))}
                    style={[styles.fchip, pendingFilters.microtags === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.microtags === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {microtagOptions.map(mitName => {
                    const isSelected = pendingFilters.microtags.split('|').includes(mitName);
                    return (
                      <TouchableOpacity
                        key={mitName}
                        onPress={() => {
                          const list = pendingFilters.microtags === 'All' ? [] : pendingFilters.microtags.split('|').filter(Boolean);
                          const next = isSelected ? list.filter(m => m !== mitName) : [...list, mitName];
                          setPendingFilters(p => ({
                            ...p,
                            microtags: next.length ? next.join('|') : 'All'
                          }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{mitName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

          </ScrollView>

          <View style={[styles.popupFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={applyFilters} style={styles.applyBtn}>
              <Filter size={14} color="#fff" />
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <View style={styles.subContainer}>
      <View style={styles.ipadBody}>
        {sidebarOpen && (
          <View style={{ width: 260, borderRightWidth: 0.5, borderRightColor: colors.border }}>
            <MainsLeftPanel
              colors={colors}
              insets={insets}
              isTablet={isTablet}
              filters={filters}
              onUpdateFilters={handleUpdateFilters}
              allPapers={allPapers}
              subjectOptions={subjectOptions}
              sectionOptions={sectionOptions}
              microtopicOptions={microtopicOptions}
              subtopicOptions={subtopicOptions}
              nanotopicOptions={nanotopicOptions}
              macrotagOptions={macrotagOptions}
              microtagOptions={microtagOptions}
              isSearchView={true}
              keywords={keywords}
              excludedKeywords={excludedKeywords}
              toggleExcludedKeyword={toggleExcludedKeyword}
              keywordsExpanded={keywordsExpanded}
              setKeywordsExpanded={setKeywordsExpanded}
              results={results}
              hasSearched={hasSearched}
              allSearchSubjects={allSearchSubjects}
              sidebarSubjectFilter={sidebarSubjectFilter}
              toggleSidebarSubject={toggleSidebarSubject}
              totalCount={results.length}
              allInstitutes={allInstitutes}
              allPrograms={allPrograms}
              userTags={userTags}
              onCloseSidebar={() => setSidebarOpen(false)}
              allYears={allYears}
            />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <ScrollView ref={scrollViewRef} contentContainerStyle={styles.listScroll} showsVerticalScrollIndicator={false}>
            {/* Spacer for floating back button */}
            <View style={{ height: insets.top + 48 }} />

            {/* Header Info */}
            <View style={styles.subAppHero}>
              <Text style={[styles.subAppTitle, { color: colors.textPrimary }]}>AI Mains Search</Text>
              <Text style={[styles.subAppSubtitle, { color: colors.textSecondary }]}>
                Search conceptually across Mains Question Bank and Value Addition.
              </Text>
            </View>

            {/* 3-Mode Engine Toggle */}
            <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }}>
              {([
                { mode: 'AI' as const, icon: <Brain size={10} color={searchEngineMode === 'AI' ? '#fff' : '#7c3aed'} />, label: 'AI Semantic' },
                { mode: 'AI+Fuzzy' as const, icon: <Zap size={10} color={searchEngineMode === 'AI+Fuzzy' ? '#fff' : '#06b6d4'} />, label: 'AI+Fuzzy' },
                { mode: 'Matching' as const, icon: <Zap size={10} color={searchEngineMode === 'Matching' ? '#fff' : colors.textSecondary} />, label: 'Fuzzy' },
                { mode: 'Exact' as const, icon: <Target size={10} color={searchEngineMode === 'Exact' ? '#fff' : colors.textSecondary} />, label: 'Exact' },
              ]).map(({ mode, icon, label }) => (
                <TouchableOpacity
                  key={mode}
                  onPress={() => {
                    setSearchEngineMode(mode);
                    if (hasSearched && query.trim()) runMainsSearch(query, filters, mode);
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 3,
                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14,
                    backgroundColor: searchEngineMode === mode
                      ? (mode === 'AI' ? '#7c3aed' : (mode === 'AI+Fuzzy' ? '#06b6d4' : (mode === 'Matching' ? '#0ea5e9' : '#f59e0b')))
                      : colors.surface,
                    borderWidth: 1,
                    borderColor: searchEngineMode === mode ? 'transparent' : colors.border,
                  }}
                >
                  {icon}
                  <Text style={{ fontSize: 10, fontWeight: '800', color: searchEngineMode === mode ? '#fff' : colors.textSecondary }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* AI Search Input Row */}
            <View style={[styles.searchRow, { paddingHorizontal: 10, paddingVertical: 6, gap: 5 }]}>
              {!sidebarOpen && (
                <TouchableOpacity
                  onPress={() => setSidebarOpen(true)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: colors.surface,
                    borderWidth: 1,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: colors.primary,
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 2 },
                    elevation: 3,
                  }}
                >
                  <ChevronRight size={20} color={colors.primary} />
                </TouchableOpacity>
              )}
              <View style={[styles.searchWrap, {
                flex: 1,
                backgroundColor: colors.surface,
                borderColor: searchEngineMode === 'AI' ? '#7c3aed60' : searchEngineMode === 'Matching' ? '#0ea5e940' : '#f59e0b40',
                marginBottom: 0
              }]}>
                <Search size={18} color="#94a3b8" />
                <TextInput
                  placeholder={searchEngineMode === 'AI' ? "Ask in plain language..." : "Type exact phrase..."}
                  placeholderTextColor="#94a3b8"
                  value={query}
                  onChangeText={setQuery}
                  onFocus={() => { if (searchHistory.length > 0) setShowHistory(true); }}
                  onBlur={() => setTimeout(() => setShowHistory(false), 150)}
                  returnKeyType="search"
                  onSubmitEditing={() => runMainsSearch(query, filters)}
                  style={[styles.searchInput, { color: colors.textPrimary }]}
                />
                {query.length > 0 && (
                  <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); }} style={{ marginRight: 6 }}>
                    <X size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => runMainsSearch(query, filters)}
                  disabled={loading || !query.trim()}
                  style={[styles.goBtn, { backgroundColor: '#7c3aed' }]}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ChevronRight size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => setShowModelSwitcher(true)}
                style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Brain size={16} color="#7c3aed" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setFilterOpen(true)}
                style={[styles.filterBtn, {
                  backgroundColor: activeFilterCount > 0 ? '#ede9fe' : colors.surface,
                  borderColor: activeFilterCount > 0 ? '#c4b5fd' : colors.border,
                }]}
              >
                <SlidersHorizontal size={14} color={activeFilterCount > 0 ? '#7c3aed' : colors.textSecondary} />
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Horizontal Browse Topics pill bar and breadcrumbs */}
            {(() => {
              const hasHierarchyActive = filters.paper !== 'All' || filters.subjects !== 'All' || filters.sections !== 'All' || filters.microtopics !== 'All' || filters.subtopics !== 'All' || filters.macrotags !== 'All' || filters.microtags !== 'All';
              const activeHierarchyLabel = filters.microtags !== 'All' ? filters.microtags : (filters.macrotags !== 'All' ? filters.macrotags : (filters.subtopics !== 'All' ? filters.subtopics : (filters.microtopics !== 'All' ? filters.microtopics : (filters.sections !== 'All' ? filters.sections : (filters.subjects !== 'All' ? filters.subjects : (filters.paper !== 'All' ? filters.paper : 'Browse Topics'))))));
              
              return (
                <View style={{ gap: 8, paddingHorizontal: 12, paddingVertical: 4 }}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={{ alignItems: 'center', gap: 8, paddingVertical: 2 }}
                  >
                    {/* Browse Topics Pill */}
                    <TouchableOpacity
                      onPress={() => setHierarchyModalVisible(true)}
                      style={[
                        styles.filterPill,
                        hasHierarchyActive
                          ? { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                          : { backgroundColor: colors.surface + 'b3', borderColor: colors.border }
                      ]}
                    >
                      <BookOpen size={12} color={hasHierarchyActive ? '#fff' : '#3b82f6'} style={{ marginRight: 4 }} />
                      <Text style={[styles.filterPillText, { color: hasHierarchyActive ? '#fff' : colors.textSecondary, fontWeight: '700' }]}>
                        {hasHierarchyActive ? activeHierarchyLabel : 'Browse Topics'}
                      </Text>
                      <ChevronDown size={12} color={hasHierarchyActive ? '#fff' : colors.textTertiary} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>

                    {hasHierarchyActive && (
                      <TouchableOpacity
                        onPress={() => handleUpdateFilters({ ...filters, paper: 'All', subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' })}
                        style={[styles.filterPill, { backgroundColor: '#fee2e2', borderColor: '#fca5a5' }]}
                      >
                        <X size={12} color="#ef4444" style={{ marginRight: 4 }} />
                        <Text style={[styles.filterPillText, { color: '#ef4444', fontWeight: '700' }]}>Clear All</Text>
                      </TouchableOpacity>
                    )}
                  </ScrollView>

                  {/* Active Breadcrumb Badges — tap anywhere on chip to remove that layer */}
                  {hasHierarchyActive && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4, paddingBottom: 2 }}>
                      {filters.paper !== 'All' && filters.paper.split('|').map(val => (
                        <TouchableOpacity
                          key={`crumb-paper-${val}`}
                          onPress={() => {
                            const updated = filters.paper.split('|').filter(x => x !== val).join('|') || 'All';
                            handleUpdateFilters({ 
                              ...filters, 
                              paper: updated, 
                              subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' 
                            });
                          }}
                          activeOpacity={0.7}
                          style={[styles.breadcrumbChip, { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' }]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#1e40af' }}>{val}</Text>
                          <X size={10} color="#1e40af" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                      {filters.subjects !== 'All' && filters.subjects.split('|').map(val => (
                        <TouchableOpacity
                          key={`crumb-subject-${val}`}
                          onPress={() => {
                            const updated = filters.subjects.split('|').filter(x => x !== val).join('|') || 'All';
                            handleUpdateFilters({ 
                              ...filters, 
                              subjects: updated, 
                              sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' 
                            });
                          }}
                          activeOpacity={0.7}
                          style={[styles.breadcrumbChip, { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#6b21a8' }}>{val}</Text>
                          <X size={10} color="#6b21a8" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                      {filters.sections !== 'All' && filters.sections.split('|').map(val => (
                        <TouchableOpacity
                          key={`crumb-section-${val}`}
                          onPress={() => {
                            const updated = filters.sections.split('|').filter(x => x !== val).join('|') || 'All';
                            handleUpdateFilters({ 
                              ...filters, 
                              sections: updated, 
                              microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' 
                            });
                          }}
                          activeOpacity={0.7}
                          style={[styles.breadcrumbChip, { backgroundColor: '#fef3c7', borderColor: '#fde68a' }]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#92400e' }}>{val}</Text>
                          <X size={10} color="#92400e" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                      {filters.microtopics !== 'All' && filters.microtopics.split('|').map(val => (
                        <TouchableOpacity
                          key={`crumb-micro-${val}`}
                          onPress={() => {
                            const updated = filters.microtopics.split('|').filter(x => x !== val).join('|') || 'All';
                            handleUpdateFilters({ 
                              ...filters, 
                              microtopics: updated, 
                              subtopics: 'All', macrotags: 'All', microtags: 'All' 
                            });
                          }}
                          activeOpacity={0.7}
                          style={[styles.breadcrumbChip, { backgroundColor: '#d1fae5', borderColor: '#a7f3d0' }]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#065f46' }}>{val}</Text>
                          <X size={10} color="#065f46" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                      {filters.subtopics !== 'All' && filters.subtopics.split('|').map(val => (
                        <TouchableOpacity
                          key={`crumb-sub-${val}`}
                          onPress={() => {
                            const updated = filters.subtopics.split('|').filter(x => x !== val).join('|') || 'All';
                            handleUpdateFilters({ 
                              ...filters, 
                              subtopics: updated, 
                              macrotags: 'All', microtags: 'All' 
                            });
                          }}
                          activeOpacity={0.7}
                          style={[styles.breadcrumbChip, { backgroundColor: '#ffe4e6', borderColor: '#fecdd3' }]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#be123c' }}>{val}</Text>
                          <X size={10} color="#be123c" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                      {filters.macrotags !== 'All' && filters.macrotags.split('|').map(val => (
                        <TouchableOpacity
                          key={`crumb-macro-${val}`}
                          onPress={() => {
                            const updated = filters.macrotags.split('|').filter(x => x !== val).join('|') || 'All';
                            handleUpdateFilters({ 
                              ...filters, 
                              macrotags: updated, 
                              microtags: 'All' 
                            });
                          }}
                          activeOpacity={0.7}
                          style={[styles.breadcrumbChip, { backgroundColor: '#e0f7fa', borderColor: '#b2ebf2' }]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#006064' }}>{val}</Text>
                          <X size={10} color="#006064" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                      {filters.microtags !== 'All' && filters.microtags.split('|').map(val => (
                        <TouchableOpacity
                          key={`crumb-microtag-${val}`}
                          onPress={() => {
                            const updated = filters.microtags.split('|').filter(x => x !== val).join('|') || 'All';
                            handleUpdateFilters({ 
                              ...filters, 
                              microtags: updated 
                            });
                          }}
                          activeOpacity={0.7}
                          style={[styles.breadcrumbChip, { backgroundColor: '#fce4ec', borderColor: '#f8bbd0' }]}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '700', color: '#880e4f' }}>{val}</Text>
                          <X size={10} color="#880e4f" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              );
            })()}

            {/* History Dropdown */}
            {showHistory && searchHistory.length > 0 && (
              <View style={[styles.historyDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border, backgroundColor: colors.surfaceStrong }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary }}>RECENT SEARCHES</Text>
                  <TouchableOpacity onPress={async () => {
                    setSearchHistory([]);
                    await AsyncStorage.removeItem('mains_search_history');
                    setShowHistory(false);
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#ef4444' }}>Clear All</Text>
                  </TouchableOpacity>
                </View>
                {searchHistory.map((h, idx) => (
                  <View
                    key={idx}
                    style={[styles.historyItem, { borderBottomColor: colors.border }]}
                  >
                    <TouchableOpacity
                      style={{ flex: 1 }}
                      onPress={() => {
                        setQuery(h);
                        setShowHistory(false);
                        runMainsSearch(h, filters);
                      }}
                    >
                      <Text style={[styles.historyText, { color: colors.textSecondary }]} numberOfLines={1}>{h}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        const next = searchHistory.filter((_, i) => i !== idx);
                        setSearchHistory(next);
                        await AsyncStorage.setItem('mains_search_history', JSON.stringify(next));
                      }}
                      style={{ padding: 4 }}
                    >
                      <X size={12} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Quick Filters on Mobile */}
            {!isTablet && (
              <View style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.8 }}>QUICK:</Text>
                  {(['All', 'PYQ Only', 'Non-PYQ'] as const).map(opt => {
                    const isActive = filters.pyqFilter === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        onPress={() => {
                          const nextF = { ...filters, pyqFilter: opt };
                          setFilters(nextF);
                          if (hasSearched && query.trim()) runMainsSearch(query, nextF);
                        }}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
                          backgroundColor: isActive ? '#7c3aed' : colors.surfaceStrong,
                          borderWidth: 1, borderColor: isActive ? '#7c3aed' : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? '#fff' : colors.textSecondary }}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                  
                  {allPapers.slice(0, 4).map(paperOpt => {
                    const isActive = filters.paper.split('|').includes(paperOpt);
                    return (
                      <TouchableOpacity
                        key={paperOpt}
                        onPress={() => {
                          const list = filters.paper === 'All' ? [] : filters.paper.split('|').filter(Boolean);
                          const next = isActive ? list.filter(p => p !== paperOpt) : [...list, paperOpt];
                          const nextF = { ...filters, paper: next.length > 0 ? next.join('|') : 'All', subjects: 'All', sections: 'All', microtopics: 'All', subtopics: 'All', macrotags: 'All', microtags: 'All' };
                          setFilters(nextF);
                          if (hasSearched && query.trim()) runMainsSearch(query, nextF);
                        }}
                        style={{
                          paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
                          backgroundColor: isActive ? '#06b6d4' : colors.surfaceStrong,
                          borderWidth: 1, borderColor: isActive ? '#06b6d4' : colors.border,
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '700', color: isActive ? '#fff' : colors.textSecondary }}>{paperOpt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Keyword excluder pills on Mobile */}
            {!isTablet && keywords.length > 0 && (
              <View style={styles.phoneKeywordsPanel}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginVertical: 6 }}>
                  {keywords.map((kw, i) => {
                    const isExcluded = excludedKeywords.has(kw);
                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={() => toggleExcludedKeyword(kw)}
                        style={[styles.pill, {
                          backgroundColor: isExcluded ? '#f1f5f9' : '#ede9fe',
                          borderColor: isExcluded ? colors.border : '#c4b5fd',
                          opacity: isExcluded ? 0.5 : 1,
                        }]}
                      >
                        <Text style={[styles.pillText, {
                          color: isExcluded ? colors.textTertiary : '#7c3aed',
                          textDecorationLine: isExcluded ? 'line-through' : 'none',
                        }]}>{kw}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Results List */}
            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#7c3aed" />
                <Text style={{ marginTop: 12, color: colors.textSecondary, fontSize: 14 }}>Expanding query using AI...</Text>
              </View>
            ) : !hasSearched ? (
              renderEmptyState()
            ) : sortedResults.length === 0 ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '600' }}>No matches found</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4 }}>Try using different keywords or clearing filters.</Text>
              </View>
            ) : (
              sortedResults.map((item, idx) => {
                if (item.type === 'question') {
                  const isExpanded = expandedId === item.id;
                  const isBookmarked = savedQuestionIds.includes(item.id);

                  return (
                    <View
                      key={item.id}
                      onLayout={(event) => {
                        cardYOffsets.current[item.id] = event.nativeEvent.layout.y;
                      }}
                      style={[
                        styles.figmaQuestionCard,
                        { backgroundColor: 'rgba(255, 255, 255, 0.45)', borderColor: 'rgba(255, 255, 255, 0.65)', marginBottom: 12 },
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (isExpanded) {
                            setExpandedId(null);
                          } else {
                            setExpandedId(item.id);
                            const y = cardYOffsets.current[item.id];
                            if (typeof y === 'number') {
                              setTimeout(() => {
                                scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
                              }, 120);
                            }
                          }
                        }}
                        style={styles.qCardHeaderSpacious}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={styles.badgeRow}>
                            <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ fontSize: 9, fontWeight: '900', color: '#2563eb' }}>MAINS QUESTION</Text>
                            </View>
                            <Text style={[styles.paperBadgeText, { color: '#3b82f6', marginLeft: 6 }]}>{item.paper}</Text>
                            <Text style={[styles.metaTextDot, { color: colors.textTertiary }]}>•</Text>
                            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.year}</Text>
                            <Text style={[styles.metaTextDot, { color: colors.textTertiary }]}>•</Text>
                            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.marks} Marks</Text>
                          </View>
                          <Text style={[styles.questionTitleText, { color: colors.textPrimary }]}>
                            {item.questionText}
                          </Text>
                        </View>
                        <View style={styles.cardActionsRow}>
                          <TouchableOpacity onPress={() => onOpenDetailed(item)} style={styles.actionIconButton}>
                            <ExternalLink size={20} color={colors.textTertiary} />
                          </TouchableOpacity>
                          {isExpanded ? (
                            <ChevronUp size={22} color={colors.textTertiary} />
                          ) : (
                            <ChevronDown size={22} color={colors.textTertiary} />
                          )}
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (
                        <View style={[
                          styles.answerContainerSpacious,
                          {
                            backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                            borderTopWidth: 1,
                          }
                        ]}>
                          {item.answers && item.answers.length > 0 ? (() => {
                            const cleanAnsList = getCleanAvailableAnswers(item.answers);
                            if (cleanAnsList.length === 0) {
                              return (
                                <View style={{ padding: 12 }}>
                                  <Text style={{ fontSize: 13, color: colors.textTertiary, fontStyle: 'italic' }}>
                                    No solved answers available for this question.
                                  </Text>
                                </View>
                              );
                            }
                            const currentInst = localSelectedAnswerInst[item.id] || cleanAnsList[0].institute;
                            const activeAnswer = cleanAnsList.find((ans: any) => ans.institute === currentInst) || cleanAnsList[0];

                            return (
                              <View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                                  {cleanAnsList.map((ans: any) => (
                                    <TouchableOpacity
                                      key={ans.institute}
                                      onPress={() => setLocalSelectedAnswerInst(prev => ({ ...prev, [item.id]: ans.institute }))}
                                      style={[
                                        styles.segmentButton,
                                        {
                                          marginRight: 6,
                                          paddingHorizontal: 12,
                                          paddingVertical: 6,
                                          borderRadius: 8,
                                          borderWidth: 0.5,
                                          borderColor: currentInst === ans.institute ? '#3b82f6' : colors.border
                                        },
                                        currentInst === ans.institute
                                          ? { backgroundColor: '#3b82f6' }
                                          : { backgroundColor: colors.surface + '88' }
                                      ]}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 12,
                                          fontWeight: '800',
                                          color: currentInst === ans.institute ? '#ffffff' : colors.textTertiary
                                        }}
                                      >
                                        {ans.institute}
                                      </Text>
                                    </TouchableOpacity>
                                  ))}
                                </ScrollView>

                                {(() => {
                                  const parsed = parseIntroductoryBox(activeAnswer.answerText);
                                  if (parsed) {
                                    return (
                                      <View style={{ marginTop: 8 }}>
                                        <ApproachBox content={parsed.body} title={parsed.title} colors={colors} zoomFontSize={14} isDark={isDark} />
                                        <Markdown style={getMarkdownStyles(colors)} rules={getMarkdownRules(colors, isDark)}>
                                          {cleanMarkdown(activeAnswer.answerText.replace(parsed.rawMatch, '').trim())}
                                        </Markdown>
                                      </View>
                                    );
                                  }
                                  return (
                                    <View style={{ marginTop: 8 }}>
                                      <Markdown style={getMarkdownStyles(colors)} rules={getMarkdownRules(colors, isDark)}>
                                        {cleanMarkdown(activeAnswer.answerText)}
                                      </Markdown>
                                    </View>
                                  );
                                })()}
                              </View>
                            );
                          })() : (
                            <View style={{ padding: 12 }}>
                              <Text style={{ fontSize: 13, color: colors.textTertiary, fontStyle: 'italic' }}>
                                No solved answers available for this question.
                              </Text>
                            </View>
                          )}
                          {renderTaxonomyStrip(item, colors, isDark)}
                        </View>
                      )}
                    </View>
                  );
                } else {
                  return (
                    <ValueAdditionCard
                      key={item.id}
                      item={item}
                      colors={colors}
                      isDark={isDark}
                      copiedId={copiedId}
                      onCopy={onCopy}
                      width="100%"
                      onAddFlashcardClick={onAddFlashcardClick}
                      userTags={userTags}
                      valueAddTags={valueAddTags}
                      onToggleValueAddTag={onToggleValueAddTag}
                      onCreateTag={onCreateTag}
                      vaFavorites={vaFavorites}
                      onToggleVaFavorite={onToggleVaFavorite}
                    />
                  );
                }
              })
            )}
          </ScrollView>
        </View>
      </View>



      <AIModelSwitcher visible={showModelSwitcher} onClose={() => setShowModelSwitcher(false)} />
      {FilterPopup}
      <HierarchyModal
        visible={hierarchyModalVisible}
        onClose={() => setHierarchyModalVisible(false)}
        colors={colors}
        filters={filters}
        onUpdateFilters={handleUpdateFilters}
        allPapers={allPapers}
        subjectOptions={subjectOptions}
        sectionOptions={sectionOptions}
        microtopicOptions={microtopicOptions}
        subtopicOptions={subtopicOptions}
        macrotagOptions={macrotagOptions}
        microtagOptions={microtagOptions}
        isTablet={isTablet}
        questions={questions}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hierarchyPopup: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    padding: 6,
  },
  crumbBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  crumbText: {
    fontSize: 10,
    fontWeight: '800',
  },
  hierarchyColumn: {
    borderRightWidth: 1,
    paddingHorizontal: 8,
  },
  hierarchyColumnTitle: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingLeft: 12,
  },
  hierarchyItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 1,
    width: '100%',
  },
  hierarchyItemText: {
    fontSize: 12,
    flex: 1,
    marginRight: 6,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
  },
  breadcrumbChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  searchModeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  searchModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchGoBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  bgOrb: {
    position: 'absolute',
    borderRadius: 999,
  },
  safeArea: {
    flex: 1,
  },
  floatingBackButton: {
    position: 'absolute',
    left: 20,
    top: Platform.OS === 'ios' ? 12 : 12,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingSidebarButton: {
    position: 'absolute',
    left: 20,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    zIndex: 50,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 2,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  premiumBadge: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumText: {
    color: '#b45309',
    fontSize: 8,
    fontWeight: '900',
  },
  hubScroll: {
    padding: 16,
    paddingBottom: 60,
  },
  heroSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  heroHeading: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 24,
  },
  largeSearchInput: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: Platform.OS === 'ios' ? 2 : 0,
    marginBottom: 8,
  },
  largeSearchText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardsGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  figmaCard: {
    borderRadius: 24,
    borderWidth: 1.2,
    elevation: Platform.OS === 'ios' ? 3 : 0,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  figmaCardTablet: {
    width: '48%',
  },
  cardContentLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  cardContentLayoutVertical: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  figmaIconBox: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: Platform.OS === 'ios' ? 2 : 0,
    marginBottom: 2,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTextContainerVertical: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  figmaCardTitle: {
    fontWeight: '800',
    textAlign: 'center',
  },
  figmaCardDesc: {
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  recentTopicsContainer: {
    marginTop: 32,
  },
  recentTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
    marginLeft: 4,
  },
  topicsRow: {
    gap: 8,
  },
  topicsRowCentered: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  topicChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  topicChipText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Question Bank Styles
  subContainer: {
    flex: 1,
  },
  subAppHero: {
    marginVertical: 16,
    paddingHorizontal: 4,
  },
  subAppTitle: {
    fontSize: 26,
    fontWeight: '900',
  },
  subAppSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  filterSection: {
    marginBottom: 16,
  },
  tabsScroll: {
    marginTop: 12,
  },
  tabFilterPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFilterPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
  listScroll: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },
  figmaQuestionCard: {
    borderRadius: 24,
    borderWidth: 1.2,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  qCardHeaderSpacious: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  paperBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
  },
  metaTextDot: {
    marginHorizontal: 6,
    fontSize: 11,
  },
  questionTitleText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  actionIconButton: {
    marginRight: 10,
    padding: 6,
  },
  answerContainerSpacious: {
    borderTopWidth: 1,
    padding: 16,
  },
  segmentedTabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonText: {
    fontSize: 12,
    fontWeight: '800',
  },
  compTabBody: {
    paddingHorizontal: 4,
  },
  answerBodyTextText: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
  },
  bodyPointGroup: {
    marginBottom: 12,
  },
  bodyPointHeaderTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  bulletItem: {
    flexDirection: 'row',
    paddingLeft: 8,
    marginBottom: 4,
  },
  bulletDot: {
    fontSize: 14,
    marginRight: 8,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    fontWeight: '600',
  },

  // Value Addition Layouts
  secTitleHeader: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 16,
    marginLeft: 4,
  },
  subAppHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  pillBackBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  subAppHeaderTitle: {
    fontSize: 20,
    fontWeight: '900',
  },
  ethicsTabsScroll: {
    marginBottom: 12,
  },
  vCardFigmaTitle: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#3b82f6',
  },
  vCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.4)',
  },
  vCardSource: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '800',
    marginTop: 4,
  },
  copyButton: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  vCardBody: {
    padding: 16,
  },
  metricRow: {
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3b82f6',
    marginBottom: 4,
  },
  metricContext: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  templateBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 0.5,
  },
  subPartHeader: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  subPartBody: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  quoteTextVal: {
    fontSize: 15,
    fontStyle: 'italic',
    lineHeight: 20,
    fontWeight: '700',
    marginBottom: 6,
  },
  quoteAuthor: {
    fontSize: 12,
    fontWeight: '800',
  },
  usageWrapper: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  usageTitle: {
    fontSize: 8,
    fontWeight: '900',
    color: '#94a3b8',
    marginBottom: 4,
  },
  usageText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  mnemonicKeywordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#fffbeb',
    padding: 8,
    borderRadius: 10,
    borderColor: '#f59e0b',
    borderWidth: 0.5,
  },
  mnemonicLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#b45309',
    marginRight: 6,
  },
  mnemonicValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#b45309',
  },
  expansionList: {
    gap: 8,
  },
  expansionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  letterWrapper: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letterText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  exMeaning: {
    fontSize: 12,
    fontWeight: '800',
  },
  exDetail: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  fwBox: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  fwBoxLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f43f5e',
    marginBottom: 4,
  },
  fwBoxDesc: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
  },
  submoduleItemCard: {
    borderRadius: 32,
    borderWidth: 1.5,
    padding: 32,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
  },
  dimensionItemText: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  compareRow: {
    borderBottomWidth: 0.5,
    paddingBottom: 8,
    marginBottom: 6,
  },
  compareCriteria: {
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 4,
  },
  comparePointsText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  diagLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 6,
  },
  ethicsOfficer: {
    fontSize: 16,
    fontWeight: '900',
    color: '#06b6d4',
    marginBottom: 4,
  },
  ethicsInitiative: {
    fontSize: 12,
    fontWeight: '800',
  },
  ethicsImpact: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  ethicsValues: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '800',
    marginTop: 6,
  },

  // Syllabus Explorer Layouts
  figmaProgressCard: {
    borderRadius: 24,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  figmaProgressBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
    marginBottom: 8,
  },
  figmaProgressBarFilled: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  progressStats: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '900',
  },
  paperStatsText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 4,
  },
  figmaPaperCollapsible: {
    borderRadius: 24,
    borderWidth: 1.5,
    marginBottom: 12,
    overflow: 'hidden',
  },
  paperCollapsibleHeaderSpacious: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paperTitleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  paperCollapsibleBody: {
    borderTopWidth: 1,
    padding: 16,
  },
  topicSectionSpacious: {
    marginBottom: 20,
  },
  topicTitleHeader: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtopicCheckboxRowSpacious: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  checkboxCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  subtopicCheckLabelText: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
  },
  // AI Search Layout and Sidebar Styles
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 26,
    borderWidth: 1.5,
    height: 48,
    paddingLeft: 14,
    paddingRight: 6,
    shadowColor: '#7c3aed',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  goBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fff',
  },
  ipadBody: {
    flex: 1,
    flexDirection: 'row',
  },
  leftPanel: {
    width: 260,
    maxWidth: 260,
    flexGrow: 0,
    borderRightWidth: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  sidebarFchip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    backgroundColor: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  sidebarFchipSel: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sidebarFchipText: {
    fontSize: 10,
    fontWeight: '700',
  },
  sidebarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'transparent',
    marginVertical: 1,
  },
  sidebarSectionHeaderActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    borderColor: 'rgba(124, 58, 237, 0.12)',
  },
  sidebarBadge: {
    fontSize: 8,
    fontWeight: '700',
    color: '#7c3aed',
    backgroundColor: 'rgba(124,58,237,0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
    maxWidth: 120,
  },
  phoneKeywordsPanel: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  panelLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 7,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    borderWidth: 0.5,
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 5,
    paddingHorizontal: 7,
    borderRadius: 7,
    borderWidth: 1,
    marginBottom: 4,
  },
  subjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subjectChipText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  subjectCount: {
    fontSize: 10,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  popup: {
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 0.5,
  },
  popupTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  clearBtn: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popupBody: {
    padding: 14,
    gap: 14,
    paddingBottom: 4,
  },
  popupFooter: {
    padding: 14,
    borderTopWidth: 0.5,
  },
  applyBtn: {
    backgroundColor: '#7c3aed',
    borderRadius: 12,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  applyBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  aiNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    padding: 10,
    margin: 12,
    marginBottom: 0,
    borderRadius: 10,
  },
  aiNoteText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 17,
    flex: 1,
  },
  filterGroup: {
    gap: 6,
    marginBottom: 10,
  },
  filterGroupTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  fchip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  fchipSel: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  fchipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  historyDropdown: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 10,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  historyText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  emptyState: {
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  examplesLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  exampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  exampleText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
});

function ApproachBox({ content, title = 'APPROACH', colors, zoomFontSize, isDark }: { content: string; title?: string; colors: any; zoomFontSize: number; isDark: boolean }) {
  const cleaned = content.replace(/<br\s*\/?>/gi, '\n').trim();
  
  const base = getMarkdownStyles(colors);
  const ratio = (zoomFontSize - 2.5) / 16;
  const approachMarkdownStyles = {
    ...base,
    body: {
      ...base.body,
      fontSize: zoomFontSize - 2.5,
      lineHeight: Math.round((zoomFontSize - 2.5) * 1.55),
      color: colors.textSecondary,
    },
    heading1: {
      ...base.heading1,
      fontSize: Math.round(18 * ratio),
    },
    heading2: {
      ...base.heading2,
      fontSize: Math.round(16 * ratio),
    },
    heading3: {
      ...base.heading3,
      fontSize: Math.round(15 * ratio),
    },
    heading4: {
      ...base.heading4,
      fontSize: Math.round(14 * ratio),
    },
    bullet_list: {
      ...base.bullet_list,
      marginVertical: 4,
    },
    list_item: {
      ...base.list_item,
      marginVertical: 2,
    }
  };

  return (
    <View style={{
      backgroundColor: isDark ? 'rgba(30, 41, 59, 0.45)' : '#f8fafc',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
        <Sparkles size={14} color="#3b82f6" />
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#3b82f6', letterSpacing: 1 }}>{title}</Text>
      </View>
      <Markdown style={approachMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
        {cleaned}
      </Markdown>
    </View>
  );
}

export interface DetailedQuestionViewProps {
  question: ConsolidatedQuestion;
  onBack: () => void;
  colors: any;
  isDark: boolean;
  isTablet: boolean;
  insets: any;
  savedIds: string[];
  onToggleSaved: (id: string) => void;
  userTags: string[];
  onToggleTag: (tag: string) => void;
  onCreateTag: (tag: string) => void;
  isFlashcarded: boolean;
  isSavingFlashcard: boolean;
  onAddFlashcard: () => void;
  studyTags: string[];
  confidence: string | null;
  onSetConfidence: (level: string) => void;
  difficulty: string | null;
  onSetDifficulty: (level: string) => void;
  onSaveToPilot: () => void;
  onOpenAIChat: (activeAnswerText: string, activeInstName: string, allAnswers: any[]) => void;
  onOpenVitaminEditor: () => void;
  detailedBestAnswer: BestAnswer | null;
  onDeleteBestAnswer: () => void;
  onActiveAnswerChange?: (activeText: string, activeInst: string, allAnswers: any[]) => void;
}

export function DetailedQuestionView({
  question,
  onBack,
  colors,
  isDark,
  isTablet,
  insets,
  savedIds,
  onToggleSaved,
  userTags,
  onToggleTag,
  onCreateTag,
  isFlashcarded,
  isSavingFlashcard,
  onAddFlashcard,
  studyTags,
  confidence,
  onSetConfidence,
  difficulty,
  onSetDifficulty,
  onSaveToPilot,
  onOpenAIChat,
  onOpenVitaminEditor,
  detailedBestAnswer,
  onDeleteBestAnswer,
  onActiveAnswerChange,
}: DetailedQuestionViewProps) {
  const isBookmarked = savedIds.includes(question.id);
  const answers = useMemo(() => getCleanAvailableAnswers(question.answers || []), [question.answers]);
  const [activeInst, setActiveInst] = useState<string>(answers[0]?.institute || 'Vision IAS');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [note, setNote] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);

  useEffect(() => {
    if (answers.length > 0) {
      const activeAns = answers.find(a => a.institute === activeInst) || answers[0];
      onActiveAnswerChange?.(activeAns.answerText || '', activeAns.institute || '', answers);
    } else {
      onActiveAnswerChange?.('', '', []);
    }
    return () => onActiveAnswerChange?.('', '', []);
  }, [activeInst, answers, onActiveAnswerChange]);

  // Zoom level state (12 to 32, default 16)
  const [zoomFontSize, setZoomFontSize] = useState<number>(16);
  const baseFontSizeRef = React.useRef<number>(16);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimerRef = React.useRef<any>(null);

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    let next = baseFontSizeRef.current * scale;
    next = Math.max(12, Math.min(32, next));
    setZoomFontSize(Math.round(next));
    setShowZoomIndicator(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1200);
  };

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GHState.END || event.nativeEvent.state === GHState.CANCELLED) {
      baseFontSizeRef.current = zoomFontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // Dynamically scaled markdown styles
  const dynamicMarkdownStyles = useMemo(() => {
    const base = getMarkdownStyles(colors);
    const ratio = zoomFontSize / 16;
    return {
      ...base,
      body: {
        ...base.body,
        fontSize: zoomFontSize,
        lineHeight: Math.round(zoomFontSize * 1.5),
      },
      heading1: {
        ...base.heading1,
        fontSize: Math.round(18 * ratio),
      },
      heading2: {
        ...base.heading2,
        fontSize: Math.round(16 * ratio),
      },
      heading3: {
        ...base.heading3,
        fontSize: Math.round(15 * ratio),
      },
      heading4: {
        ...base.heading4,
        fontSize: Math.round(14 * ratio),
      },
    };
  }, [colors, zoomFontSize]);
  
  useEffect(() => {
    if (detailedBestAnswer) {
      setActiveInst('My Vitamin');
    } else {
      setActiveInst(answers[0]?.institute || 'Vision IAS');
    }
  }, [question.id, detailedBestAnswer]);

  useEffect(() => {
    AsyncStorage.getItem(`mains_note_${question.id}`).then(val => {
      if (val) setNote(val);
    });
  }, [question.id]);

  const handleSaveNote = async () => {
    await AsyncStorage.setItem(`mains_note_${question.id}`, note);
    Alert.alert('Saved', 'Personal study note saved successfully.');
  };
  
  // Find current answer text
  const activeAnswer = activeInst === 'My Vitamin' && detailedBestAnswer
    ? { answerText: detailedBestAnswer.answer_text, institute: 'My Vitamin' }
    : answers.find(a => a.institute === activeInst) || answers[0] || { answerText: 'No answer text available.' };

  // Parse approach box from answer text using parseIntroductoryBox
  const { approachBox, remainingAnswerText } = useMemo(() => {
    const rawText = activeAnswer.answerText || '';
    const parsed = parseIntroductoryBox(rawText);
    if (parsed) {
      return {
        approachBox: parsed,
        remainingAnswerText: rawText.replace(parsed.rawMatch, '').trim(),
      };
    }
    return {
      approachBox: null,
      remainingAnswerText: rawText,
    };
  }, [activeAnswer.answerText]);
  
  const handleCreateTagLocal = () => {
    if (!newTagText.trim()) return;
    onCreateTag(newTagText.trim());
    setNewTagText('');
    setIsAddingTag(false);
  };

  const handleCopyQuestion = () => {
    setShowCopyModal(true);
  };

  const handleCopyOnlyQuestion = async () => {
    await Clipboard.setStringAsync(question.questionText);
    setShowCopyModal(false);
    Alert.alert('Copied', 'Question copied to clipboard.');
  };

  const handleCopyQuestionAndCurrentAnswer = async () => {
    const textToCopy = `Question:\n${question.questionText}\n\nModel Answer (${activeInst}):\n${activeAnswer.answerText}`;
    await Clipboard.setStringAsync(textToCopy);
    setShowCopyModal(false);
    Alert.alert('Copied', 'Question and selected answer copied.');
  };

  const handleCopyQuestionAndAllAnswers = async () => {
    let textToCopy = `Question:\n${question.questionText}\n\n`;
    answers.forEach((ans, i) => {
      textToCopy += `--- Model Answer ${i+1} (${ans.institute || 'Vision IAS'}) ---\n${ans.answerText}\n\n`;
    });
    if (detailedBestAnswer) {
      textToCopy += `--- My Vitamin Answer ---\n${detailedBestAnswer.answer_text}\n\n`;
    }
    await Clipboard.setStringAsync(textToCopy.trim());
    setShowCopyModal(false);
    Alert.alert('Copied', 'Question and all model answers copied.');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      <View style={{ flex: 1 }}>
      {/* Copy Options Modal */}
      <Modal
        visible={showCopyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCopyModal(false)}
      >
        <Pressable 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}
          onPress={() => setShowCopyModal(false)}
        >
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, width: '100%', maxWidth: 340, padding: 20, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 16, textAlign: 'center' }}>Copy Options</Text>
            
            <TouchableOpacity 
              onPress={handleCopyOnlyQuestion}
              style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Copy Question Only</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleCopyQuestionAndCurrentAnswer}
              style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Copy Question & Current Answer</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleCopyQuestionAndAllAnswers}
              style={{ paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Copy Question & All Answers</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setShowCopyModal(false)}
              style={{ marginTop: 12, paddingVertical: 8, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Floating Back Button */}
      <TouchableOpacity
        onPress={onBack}
        style={{
          position: 'absolute',
          top: insets.top + 12,
          left: 16,
          zIndex: 999,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.surface + 'cc',
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: colors.border,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        }}
      >
        <ChevronLeft size={20} color={colors.textPrimary} />
      </TouchableOpacity>

      {showZoomIndicator && (
        <View style={{
          position: 'absolute',
          top: insets.top + 12,
          alignSelf: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 20,
          zIndex: 1000,
        }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>ZOOM: {Math.round((zoomFontSize / 16) * 100)}%</Text>
        </View>
      )}

      <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingTop: insets.top + 64, paddingBottom: 60 }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question Text */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginBottom: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Quote size={14} color={colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>QUESTION</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={handleCopyQuestion} style={{ padding: 4 }}>
                  <Copy size={14} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={{ fontSize: zoomFontSize, fontWeight: '700', color: colors.textPrimary, lineHeight: Math.round(zoomFontSize * 1.5) }} selectable={true}>
              {question.questionText}
            </Text>
          </View>

          {/* Model Answer Section */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}>
            {/* Institute Selector Tabs */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 12, marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AlignLeft size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>MODEL ANSWER</Text>
              </View>
              
              {(answers.length > 1 || detailedBestAnswer) && (
                <View style={{ flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceStrong, borderRadius: 8, padding: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  {detailedBestAnswer && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: activeInst === 'My Vitamin' ? colors.surface : 'transparent', borderRadius: 6, paddingRight: 4 }}>
                      <TouchableOpacity
                        onPress={() => setActiveInst('My Vitamin')}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: activeInst === 'My Vitamin' ? '700' : '500', color: activeInst === 'My Vitamin' ? colors.primary : colors.textSecondary }}>
                          My Vitamin ✨
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={onDeleteBestAnswer} style={{ padding: 2 }}>
                        <X size={12} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                  {answers.map(ans => {
                    const isTabActive = ans.institute === activeInst;
                    return (
                      <TouchableOpacity
                        key={ans.institute}
                        onPress={() => setActiveInst(ans.institute)}
                        style={{
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 6,
                          backgroundColor: isTabActive ? colors.surface : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 11, fontWeight: isTabActive ? '700' : '500', color: isTabActive ? colors.textPrimary : colors.textTertiary }}>
                          {ans.institute}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Render Approach Box if present */}
            {approachBox ? (
              <ApproachBox content={approachBox.body} title={approachBox.title} colors={colors} zoomFontSize={zoomFontSize} isDark={isDark} />
            ) : null}

            {/* Model Answer Body */}
            <Markdown style={dynamicMarkdownStyles} rules={getMarkdownRules(colors, isDark)}>
              {cleanMarkdown(remainingAnswerText)}
            </Markdown>
          </View>

          {/* Personal Notes Section */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <PenTool size={14} color="#f59e0b" />
              <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>MY STUDY NOTES</Text>
            </View>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Type your notes, pointers, or enhancements here..."
              placeholderTextColor={colors.textTertiary}
              multiline={true}
              style={{
                backgroundColor: colors.surfaceStrong,
                borderRadius: 12,
                padding: 12,
                fontSize: 13,
                color: colors.textPrimary,
                minHeight: 80,
                textAlignVertical: 'top',
                marginBottom: 10,
              }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                onPress={handleSaveNote}
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Workspace Card */}
          <View style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            marginTop: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}>
            {/* Revision Tags Picker (Horizontal scroll) */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>REVISION TAGS</Text>
                {!isAddingTag ? (
                  <TouchableOpacity onPress={() => setIsAddingTag(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Plus size={12} color={colors.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>Add Tag</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TextInput
                      value={newTagText}
                      onChangeText={setNewTagText}
                      placeholder="New tag..."
                      placeholderTextColor={colors.textTertiary}
                      style={{
                        backgroundColor: colors.surfaceStrong,
                        borderRadius: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        fontSize: 11,
                        color: colors.textPrimary,
                        width: 100,
                      }}
                      autoFocus={true}
                    />
                    <TouchableOpacity onPress={handleCreateTagLocal} style={{ backgroundColor: colors.primary, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsAddingTag(false)}>
                      <X size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                {userTags.length === 0 ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 11, fontStyle: 'italic' }}>No tags created yet</Text>
                ) : (
                  userTags.map(tag => {
                    const selected = studyTags.includes(tag);
                    return (
                      <TouchableOpacity
                        key={tag}
                        onPress={() => onToggleTag(tag)}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + '15' : colors.surface,
                        }}
                      >
                        <Text style={{ fontSize: 11, color: selected ? colors.primary : colors.textSecondary, fontWeight: selected ? '700' : '400' }}>
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>

            {/* Side-by-Side Confidence & Difficulty Selectors */}
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {/* Confidence Selector (Left Half) */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textTertiary, marginBottom: 6, letterSpacing: 0.5 }}>CONFIDENCE</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[
                    { label: 'High', value: 'high', color: '#10b981' },
                    { label: 'Med', value: 'medium', color: '#3b82f6' },
                    { label: 'Low', value: 'low', color: '#f59e0b' },
                    { label: 'Guess', value: 'guess', color: '#8b5cf6' }
                  ].map(level => {
                    const isSelected = confidence === level.value;
                    return (
                      <TouchableOpacity
                        key={level.value}
                        onPress={() => onSetConfidence(level.value)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          alignItems: 'center',
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? level.color : colors.border,
                          backgroundColor: isSelected ? level.color + '15' : colors.surfaceStrong,
                        }}
                      >
                        <Text style={{
                          fontSize: 9,
                          fontWeight: '700',
                          color: isSelected ? level.color : colors.textSecondary
                        }}>
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Difficulty Selector (Right Half) */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textTertiary, marginBottom: 6, letterSpacing: 0.5 }}>DIFFICULTY</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {[
                    { label: 'Easy', value: 'easy', color: '#10b981' },
                    { label: 'Med', value: 'medium', color: '#f59e0b' },
                    { label: 'Hard', value: 'hard', color: '#ef4444' }
                  ].map(diff => {
                    const isSelected = difficulty === diff.value;
                    return (
                      <TouchableOpacity
                        key={diff.value}
                        onPress={() => onSetDifficulty(diff.value)}
                        style={{
                          flex: 1,
                          paddingVertical: 8,
                          alignItems: 'center',
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isSelected ? diff.color : colors.border,
                          backgroundColor: isSelected ? diff.color + '15' : colors.surfaceStrong,
                        }}
                      >
                        <Text style={{
                          fontSize: 9,
                          fontWeight: '700',
                          color: isSelected ? diff.color : colors.textSecondary
                        }}>
                          {diff.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* 2x2 Option Buttons Grid */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* Save to Pilot */}
                <TouchableOpacity
                  onPress={onSaveToPilot}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    height: 40,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <ExternalLink size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                    Save to Pilot
                  </Text>
                </TouchableOpacity>

                {/* Add to Flashcard */}
                <TouchableOpacity
                  onPress={onAddFlashcard}
                  disabled={isSavingFlashcard}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    height: 40,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isFlashcarded ? '#8b5cf6' : colors.border,
                    backgroundColor: isFlashcarded ? '#8b5cf615' : colors.surface,
                  }}
                >
                  {isSavingFlashcard ? (
                    <ActivityIndicator size="small" color="#8b5cf6" />
                  ) : (
                    <>
                      <Zap size={14} color={isFlashcarded ? '#8b5cf6' : colors.textSecondary} />
                      <Text style={{ fontSize: 12, fontWeight: '600', color: isFlashcarded ? '#7c3aed' : colors.textSecondary }}>
                        {isFlashcarded ? 'In Flashcards' : 'Add Flashcard'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                {/* My Vitamin */}
                <TouchableOpacity
                  onPress={onOpenVitaminEditor}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    height: 40,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: detailedBestAnswer ? '#10b981' : colors.border,
                    backgroundColor: detailedBestAnswer ? '#10b98115' : colors.surface,
                  }}
                >
                  <Sparkles size={14} color={detailedBestAnswer ? '#10b981' : colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: detailedBestAnswer ? '#059669' : colors.textSecondary }}>
                    {detailedBestAnswer ? 'Edit Vitamin' : 'My Vitamin'}
                  </Text>
                </TouchableOpacity>

                {/* AI Chatbot */}
                <TouchableOpacity
                  onPress={() => onOpenAIChat(activeAnswer.answerText, activeInst, answers)}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    height: 40,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Brain size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }}>
                    Ask AI Chat
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </PinchGestureHandler>
      </View>
    </KeyboardAvoidingView>
  );
}

export default function MainsScreen() {
  return (
    <FeatureGate feature="mains" featureLabel="Mains Hub">
      <MainsScreenInner />
    </FeatureGate>
  );
}

