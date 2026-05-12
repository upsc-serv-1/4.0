import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
  Modal,
  Platform,
  Pressable,
  Keyboard,
  KeyboardAvoidingView,
  StatusBar,
  Animated,
  BackHandler
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { 
  ChevronLeft, 
  ChevronDown,
  ChevronRight, 
  Clock, 
  Target,
  Check, 
  X, 
  XCircle,
  Info, 
  HelpCircle, 
  Save, 
  Trash2,
  BookOpen,
  Tag as TagIcon,
  Zap,
  LayoutGrid,
  List as ListIcon,
  Flag,
  Lightbulb,
  MoreVertical,
  ArrowRight,
  ArrowLeft,
  Plus,
  Book,
  Scissors,
  Layout,
  Filter,
  Share2,
  Maximize2,
  Minimize2,
  Trash,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Sparkles,
  Type,
  List,
  PenTool,
  Eraser,
  ExternalLink,
  Brain,
  ChevronUp,
  Star,
  Edit2,
  Save as SaveIcon,
  Send,
  RotateCcw,
  MessageSquare,
  Rocket,
  Copy,
  Wand2,
  Undo2,
  Redo2,
  FileDown
} from 'lucide-react-native';
import { UnifiedExportSheet } from '../../src/components/export/UnifiedExportSheet';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import RichNoteEditor from '../../src/components/RichNoteEditor';
import { aiTransformNoteContent } from '../../src/services/GeminiService';
import { AIModelSwitcher } from '../../src/components/ai/AIModelSwitcher';
import { PilotV2AIChat } from '../../src/components/pilot-v2/PilotV2AIChat';
import { PilotV2Provider } from '../../src/context/PilotV2Context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PinchGestureHandler, State as GHState } from 'react-native-gesture-handler';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useQuizStore } from '../../src/store/quizStore';
import { useTagStore } from '../../src/store/tagStore';
import { mergeQuestions } from '../../src/utils/merger';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';
import { StudentSync } from '../../src/services/StudentSync';
import { uuidv4 } from '../../src/utils/uuid';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { AddToFlashcardSheet } from '../../src/components/flashcards/AddToFlashcardSheet';
import { PilotV2SaveSheet } from '../../src/components/pilot-v2/PilotV2SaveSheet';
import { QuizCaptureSheet } from '../../src/components/hardnotes/QuizCaptureSheet';
import { OfflineManager } from '../../src/services/OfflineManager';
import { LocalQuery } from '../../src/services/LocalQuery';
import { useFlashcardAction } from '../../src/hooks/useFlashcardAction';
import { SharedQuestionCard } from '../../src/components/unified/SharedQuestionCard';
import { MyVitaminEditorSheet } from '../../src/components/unified/MyVitaminEditorSheet';
import {
  aiExplainQuestion,
  aiSummarizeExplanation,
  aiImproveAnswer,
  aiAskDoubt,
  InstituteExplanation,
} from '../../src/services/GeminiService';
import { renderAIText } from '../../src/utils/renderAIText';
import {
  fetchBestAnswer,
  saveBestAnswer,
  deleteBestAnswer,
  BestAnswer,
} from '../../src/services/BestAnswerService';
import { markdownToHtml } from '../../src/utils/textUtils';
import { buildMarkdownStyles, buildMarkdownRules } from '../../src/utils/markdownUtils';

import { OptionButton } from '../../src/components/unified/OptionButton';
const ThemeSwitcher = require('../../src/components/ThemeSwitcher').ThemeSwitcher;

const { width, height } = Dimensions.get('window');
const isTablet = width >= 768;


// Shared Markdown utilities are now imported from src/utils/markdownUtils.tsx


/** Recursively extract plain text from a markdown-it AST node */
function flattenChildren(node: any): string {
  if (!node) return '';
  if (node.type === 'softbreak' || node.type === 'hardbreak') return '\n';
  if (node.content != null) return String(node.content);
  if (node.children && node.children.length > 0) {
    return node.children.map(flattenChildren).join('');
  }
  return '';
}

// --- Types ---

interface Question {
  id: string;
  question_text: string;
  statement_line?: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation_markdown?: string;
  subject?: string;
  section_group?: string;
  micro_topic?: string;
  tests?: {
    id: string;
    title: string;
    institute?: string;
    program_name?: string;
  };
  test_id?: string;
  is_pyq?: boolean;
  is_ncert?: boolean;
  is_upsc_cse?: boolean;
  is_allied?: boolean;
  is_others?: boolean;
  exam_year?: string;
  launch_year?: string;
  exam_category?: string;
  exam_group?: string;
  exam_info?: any;
  source?: any;
  _explanations?: any[];
  question_number?: number;
}

const CONFIDENCE_LEVELS = [
  { label: '100% Sure', value: 'sure' },
  { label: 'Logical Elimination', value: 'logical' },
  { label: 'Guess', value: 'guess' },
  { label: 'UPSC Funda', value: 'funda' }
];

const DIFFICULTIES = [
  { label: 'Easy', value: 'easy', color: '#22c55e' },
  { label: 'Medium', value: 'medium', color: '#f59e0b' },
  { label: 'Hard', value: 'hard', color: '#ef4444' }
];

const ERROR_TYPES = [
  'Fact Mistake',
  'Concept Gap',
  'Silly Mistake',
  'Overthinking',
  'Skipped'
];
const DEFAULT_STUDY_TAGS = [
  'Imp. Fact', 
  'Imp. Concept', 
  'Trap Question',
  'Must Revise',
  'Memorize'
];

// --- Sub-Components ---

// Shared OptionButton is now imported from src/components/unified/OptionButton.tsx

// --- Main Screen ---

const toBool = (value: any) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
};

const getExamInfo = (item: any) => {
  if (item?.exam_info && typeof item.exam_info === 'object' && !Array.isArray(item.exam_info)) return item.exam_info;
  if (item?.source && typeof item.source === 'object' && !Array.isArray(item.source)) return item.source;
  return {} as any;
};

const normalizeInstituteLabel = (value: any) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Primary';
  const compact = raw.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return compact
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const extractYearFromText = (value: any): string => {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
};

const normalizeProgramLabel = (value: any): string => {
  const raw = String(value || '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  // Program-level uniqueness: "Revision – PYQ Workbook – 2026" and
  // "Revision – PYQ Workbook" should resolve to one canonical program label.
  const withoutYear = raw
    .replace(/\b(19|20)\d{2}\b/g, '')
    .replace(/[\-–—|:]\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return withoutYear || raw;
};

const normalizeExplText = (value: any): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const buildCanonicalExplanations = (item: any) => {
  const list = Array.isArray(item?._explanations) ? item._explanations : [];
  const out: any[] = [];
  const seen = new Map<string, number>();

  const pushEntry = (entry: any) => {
    const source = normalizeInstituteLabel(entry?.source || entry?.institute || entry?.provider || entry?.tests?.institute || item?.tests?.institute || item?.source?.institute || 'Primary');
    const sourceKey = source.toLowerCase();
    const rawProgram = String(entry?.program || item?.tests?.program_name || '').trim();
    const program = normalizeProgramLabel(rawProgram);
    const year = String(entry?.year || item?.exam_year || extractYearFromText(rawProgram) || '').trim();
    const answer = String(entry?.answer || item?.correct_answer || '').trim().toUpperCase();
    const text = String(entry?.text || entry?.explanation || '').trim();

    if (!text && !answer) return;

    const dedupeKey = `${sourceKey}__${program.toLowerCase()}__${answer}__${normalizeExplText(text)}`;
    const existingIdx = seen.get(dedupeKey);

    if (existingIdx !== undefined) {
      const existing = out[existingIdx];
      if (!existing.year && year) existing.year = year;
      if (!existing.text && text) existing.text = text;
      return;
    }

    seen.set(dedupeKey, out.length);
    out.push({ source, sourceKey, program, year, answer, text });
  };

  list.forEach((e: any) => pushEntry(e));

  if (item?.explanation_markdown) {
    pushEntry({
      source: item?.tests?.institute || item?.source?.institute || 'Primary',
      program: item?.tests?.program_name || '',
      year: item?.exam_year || '',
      answer: item?.correct_answer || '',
      text: item?.explanation_markdown,
    });
  }

  return out;
};

export const getPYQCategorization = (item: any) => {
  // Strict tagging contract (branch 5.8):
  //   • Show a PYQ chip ONLY when item.is_pyq === true (the canonical
  //     boolean column on questions). Stale exam_info.is_pyq blobs are
  //     not trusted because they leak onto non-PYQ rows.
  //   • Exam name comes ONLY from exam_info.group / exam_info.exam_name.
  //   • Year      comes ONLY from exam_info.year.
  //   • Never read tests.launch_year, item.exam_year or item.exam_group.
  //   • If both name and year are missing, render NO chip.
  const examInfo = getExamInfo(item);
  const isPYQ = toBool(item?.is_pyq);

  // 🐛 FIX #40: Non-PYQ questions MUST NEVER show PYQ tags.
  // Even if examInfo has stale UPSC data, we return hasPYQData: false immediately.
  if (!isPYQ) {
    return {
      hasPYQData: false,
      isUPSC: false,
      isAllied: false,
      isOther: false,
      isGenericPYQ: false,
      groupName: '',
      year: '',
    };
  }

  // Only read exam_group / exam_info from the source field, never from item.exam_group
  // which may contain stale data for non-PYQ rows that weren't cleaned at import.
  let rawGroup = String(examInfo?.group || examInfo?.exam_name || '').trim();
  // Strict fix: Do NOT fall back to item.exam_group for non-PYQ questions
  // as this field can contain "UPSC CSE" text even when is_pyq is false.
  const groupNameUpper = rawGroup.toUpperCase();

  const isUPSC = toBool(examInfo?.is_upsc_cse) || toBool(item?.is_upsc_cse) || groupNameUpper === 'UPSC' || groupNameUpper.includes('UPSC CSE') || groupNameUpper.includes('IAS');
  const isAllied = toBool(examInfo?.is_allied) || toBool(item?.is_allied) || ['CAPF', 'CDS', 'NDA', 'EPFO', 'CISF', 'ALLIED'].some(g => groupNameUpper.includes(g));
  const isOther = toBool(examInfo?.is_others) || toBool(item?.is_others) || ['UPPCS', 'BPSC', 'MPSC', 'RPSC', 'UKPSC', 'MPPSC', 'CGPSC', 'STATE PSC', 'OTHER'].some(g => groupNameUpper.includes(g));

  const rawYear = examInfo?.year ?? '';
  let year = typeof rawYear === 'string' ? rawYear.trim() : String(rawYear).trim();

  // FIX 1 — strict fallback chain for the chip year:
  //   exam_info.year  →  questions.exam_year column  →  nothing.
  // Never read tests.launch_year, tests.exam_year, item.exam_group, or any
  // other source. The exam_year column is the canonical denormalisation of
  // exam_info.year written at JSON import, so it is safe to fall back to.
  if (!year) {
    const colYear = item?.exam_year;
    if (colYear !== undefined && colYear !== null && String(colYear).trim()) {
      year = String(colYear).trim();
    }
  }

  // Without a usable group/year there is nothing meaningful to show.
  if (!rawGroup && !year) {
    return {
      hasPYQData: false,
      isUPSC: false,
      isAllied: false,
      isOther: false,
      isGenericPYQ: false,
      groupName: '',
      year: '',
    };
  }

  const groupName = rawGroup || (isUPSC ? 'UPSC CSE' : isAllied ? 'Allied' : isOther ? 'Other' : 'PYQ');
  const isGenericPYQ = !isUPSC && !isAllied && !isOther;

  return {
    hasPYQData: true,
    isUPSC,
    isAllied,
    isOther,
    isGenericPYQ,
    groupName,
    year,
  };
};

export default function UnifiedQuizEngine() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ 
    subject?: string, 
    mode?: string, 
    view?: string, 
    timer?: string,
    showPYQTags?: string,
    questionId?: string,
    revealAll?: string,
    fromTags?: string,
    institute?: string,
    program?: string,
    section?: string,
    microtopic?: string,
    pyqMaster?: string,
    examCategory?: string,
    query?: string,
    searchMode?: string,
    searchFields?: string,
    testId?: string,
    tags?: string,
    institutes?: string,
    programs?: string,
    microTopics?: string,
    pyqFilter?: string,
    pyqCategory?: string,
    specificYear?: string,
    stage?: string,
    paper?: string,
    year_start?: string,
    year_end?: string
    resultIds?: string,
    examStage?: string,
    series?: string,
    subjects?: string,
    ncertFilter?: string
  }>();
  const routeParams = params as any;
  const router = useRouter();
  const { session } = useAuth();
  const store = useQuizStore();
  const navigation = useNavigation();
  const isNavigatingAway = useRef(false);
  const richNoteRef = useRef<any>(null);
  const sessionStartRef = useRef<number>(Date.now()); // Wall-clock start for accurate duration

  // 🆕 Declare arenaMode FIRST — fixes TDZ crash
  const [arenaMode, setArenaMode] = useState<'learning' | 'exam'>((params.mode as 'learning' | 'exam') || 'learning');
  const [vitaminEditorVisible, setVitaminEditorVisible] = useState(false);
  const [vitaminEditorContent, setVitaminEditorContent] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<any>(null);

  // 3. Store Selectors — must be before hasUnsavedLearningProgress
  const currentAnswers = store.answers;
  const clearStoredAnswers = store.clearAnswers;

  // ── AI Explain / Summarize state (per-question) ───────────────
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiSummaries, setAiSummaries]       = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading]           = useState<Record<string, boolean>>({});
  const [aiSumLoading, setAiSumLoading]     = useState<Record<string, boolean>>({});
  const [aiExpanded, setAiExpanded]         = useState<Record<string, boolean>>({});
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);

  // ── Best Answer ("My Vitamin") + Modify-and-Save state ───────────
  const [bestAnswers, setBestAnswers]       = useState<Record<string, BestAnswer | null>>({});
  const [savingBest, setSavingBest]         = useState<Record<string, boolean>>({});
  const [savedFlash, setSavedFlash]         = useState<Record<string, boolean>>({});
  const [modifyOpen, setModifyOpen]         = useState<Record<string, boolean>>({});
  const [modifyText, setModifyText]         = useState<Record<string, string>>({});
  const [improvePromptOpen, setImprovePromptOpen] = useState<Record<string, boolean>>({});
  const [improvePromptText, setImprovePromptText] = useState<Record<string, string>>({});
  const [improving, setImproving]           = useState<Record<string, boolean>>({});

  // AI Chat FAB states
  const [activeAiQuestion, setActiveAiQuestion] = useState<any>(null);
  const [aiChatTrigger, setAiChatTrigger] = useState(0);

  const handleAiChat = useCallback((item: any) => {
    setActiveAiQuestion(item);
    setAiChatTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const currentQ = questions[currentIndex];
    if (currentQ) {
      setActiveAiQuestion(currentQ);
    }
  }, [currentIndex, questions]);

  // Build the InstituteExplanation[] payload for AI prompts from the question's
  // _explanations array (already built by merger.ts at fetch time).
  const buildInstExplPayload = (item: any): InstituteExplanation[] => {
    const list: any[] = Array.isArray(item?._explanations) ? item._explanations : [];
    return list
      .filter((e) => e && (e.text || '').trim())
      .map((e) => ({
        source:  String(e.source || '').trim(),
        program: String(e.program || '').trim(),
        text:    String(e.text || ''),
        answer:  String(e.answer || '').trim().toUpperCase(),
      }));
  };

  const handleAiExplain = async (item: any) => {
    const id = item.id || item.question_id;
    // Cached → just switch chip selection so the unified explanation
    // viewer renders the AI text. No re-fetch.
    if (aiExplanations[id]) {
      setActiveExplSource(prev => ({ ...prev, [id]: 'ai' }));
      setActiveExplIndex(prev => ({ ...prev, [id]: -1 }));
      return;
    }
    setAiLoading(prev => ({ ...prev, [id]: true }));
    setActiveExplSource(prev => ({ ...prev, [id]: 'ai' }));
    setActiveExplIndex(prev => ({ ...prev, [id]: -1 }));
    try {
      const rawOptions = item.options || {};
      const optionsMap: Record<string, string> = {
        A: rawOptions.a || rawOptions.A || '',
        B: rawOptions.b || rawOptions.B || '',
        C: rawOptions.c || rawOptions.C || '',
        D: rawOptions.d || rawOptions.D || '',
      };
      const result = await aiExplainQuestion(
        item.question_text || item.question || '',
        optionsMap,
        item.correct_answer || '',
        buildInstExplPayload(item),
      );
      setAiExplanations(prev => ({ ...prev, [id]: result }));
    } catch (e: any) {
      const msg: string = e?.message || 'Unknown error';
      if (msg.includes('404')) {
        Alert.alert('Model not found', 'Go to Settings → AI Settings and switch model.');
      } else if (msg.includes('429')) {
        Alert.alert('Quota exceeded', 'This key has hit its limit. Go to Settings → AI Settings and switch to another key, or switch provider.');
      } else if (msg.includes('No Gemini API key found')) {
        Alert.alert('Gemini key needed', 'Go to Settings → AI Settings and paste your Gemini key.');
      } else if (msg.includes('No Groq API key found')) {
        Alert.alert('Groq key needed', 'Go to Settings → AI Settings and paste your Groq key.\nFree at console.groq.com');
      } else if (msg.includes('No DeepSeek API key found')) {
        Alert.alert('DeepSeek key needed', 'Go to Settings → AI Settings and paste your DeepSeek key.\nGet keys at platform.deepseek.com');
      } else {
        Alert.alert('AI Error', msg);
      }
      // Revert source so user is not stuck on a broken AI tab.
      setActiveExplSource(prev => ({ ...prev, [id]: 'all' }));
    } finally {
      setAiLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAiSummarize = async (item: any) => {
    const id = item.id || item.question_id;
    const explanation = aiExplanations[id] || bestAnswers[id]?.answer_text || '';
    if (!explanation) return;
    setAiSumLoading(prev => ({ ...prev, [id]: true }));
    try {
      const result = await aiSummarizeExplanation(explanation);
      setAiSummaries(prev => ({ ...prev, [id]: result }));
    } catch (e: any) {
      Alert.alert('AI Error', e?.message || 'Could not summarize.');
    } finally {
      setAiSumLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // Save / Modify-and-Save / Edit / Delete handlers for the "My Vitamin" flow.
  const handleSaveBest = async (item: any) => {
    const id = item.id || item.question_id;
    const text = (modifyOpen[id] && modifyText[id])
      ? modifyText[id]
      : (aiExplanations[id] || bestAnswers[id]?.answer_text || '');
    if (!text) return;
    setSavingBest(prev => ({ ...prev, [id]: true }));
    try {
      const saved = await saveBestAnswer(id, text, aiSummaries[id] || null, null);
      if (saved) {
        setBestAnswers(prev => ({ ...prev, [id]: saved }));
        setSavedFlash(prev => ({ ...prev, [id]: true }));
        setTimeout(() => setSavedFlash(prev => ({ ...prev, [id]: false })), 1500);
        // Critical: Set activeExplSource to 'vitamin' so SharedQuestionCard updates viewerKind
        setActiveExplSource(prev => ({ ...prev, [id]: 'vitamin' }));
        setModifyOpen(prev => ({ ...prev, [id]: false }));
        console.log('[Engine] MyVitamin saved successfully:', id);
      } else {
        Alert.alert('Save failed', 'Could not save answer. Please try again.');
      }
    } catch (e: any) {
      console.error('[Engine] Save error:', e);
      Alert.alert('Save failed', e?.message || 'Could not save best answer.');
    } finally {
      setSavingBest(prev => ({ ...prev, [id]: false }));
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
      const saved = await saveBestAnswer(id, content, aiSummaries[id] || null, null);
      if (saved) {
        setBestAnswers(prev => ({ ...prev, [id]: saved }));
        setActiveExplSource(prev => ({ ...prev, [id]: 'vitamin' }));
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

  const handleDeleteBest = (item: any) => {
    const id = item.id || item.question_id;
    Alert.alert('Delete saved answer?', 'This removes your saved best answer for this question.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteBestAnswer(id);
          setBestAnswers(prev => ({ ...prev, [id]: null }));
          setActiveExplSource(prev => ({ ...prev, [id]: 'all' }));
        },
      },
    ]);
  };

  const handleOpenModify = (item: any) => {
    const id = item.id || item.question_id;
    const baseText = aiExplanations[id] || bestAnswers[id]?.answer_text || '';
    setModifyText(prev => ({ ...prev, [id]: baseText }));
    setModifyOpen(prev => ({ ...prev, [id]: true }));
  };

  const handleImproveSubmit = async (item: any) => {
    const id = item.id || item.question_id;
    const inst = (improvePromptText[id] || '').trim();
    if (!inst) return;
    setImproving(prev => ({ ...prev, [id]: true }));
    try {
      const newText = await aiImproveAnswer(
        inst,
        modifyText[id] || aiExplanations[id] || '',
        item.question_text || item.question || '',
        buildInstExplPayload(item),
      );
      setModifyText(prev => ({ ...prev, [id]: newText }));
      setImprovePromptText(prev => ({ ...prev, [id]: '' }));
      setImprovePromptOpen(prev => ({ ...prev, [id]: false }));
    } catch (e: any) {
      Alert.alert('AI Error', e?.message || 'Could not improve answer.');
    } finally {
      setImproving(prev => ({ ...prev, [id]: false }));
    }
  };

  const ensureBestAnswerLoaded = (qid: string) => {
    if (!qid || qid in bestAnswers) return;
    fetchBestAnswer(qid).then((row) => {
      setBestAnswers(prev => ({ ...prev, [qid]: row }));
      // Auto-select MyVitamin tab when a saved answer exists,
      // but only if the user hasn't manually chosen a source yet this session.
      if (row) {
        setActiveExplSource(prev => {
          if (prev[qid]) return prev; // user already picked a source, don't override
          return { ...prev, [qid]: 'vitamin' };
        });
      }
    });
  };

  // Moved earlier to fix declaration order error
  const hasUnsavedLearningProgress = useMemo(() => {
    if (arenaMode !== 'learning') return false;
    const values = Object.values(currentAnswers || {});
    return values.some((entry: any) => {
      if (!entry) return false;
      return Boolean(
        entry.selectedAnswer ||
        entry.confidence ||
        entry.difficulty ||
        entry.errorCategory ||
        (Array.isArray(entry.studyTags) && entry.studyTags.length > 0) ||
        (entry.note && String(entry.note).trim().length > 0) ||
        (entry.timeSpentSeconds || 0) > 0 ||
        entry.isReview ||
        entry.isBookmarked
      );
    });
  }, [arenaMode, currentAnswers]);

  // Store the pending navigation action so SaveNameModal / SaveSessionModal can dispatch it
  const pendingNavActionRef = useRef<any>(null);

  // Prevent accidental exit during formal exams and unsaved learning sessions
  usePreventRemove(
    !isNavigatingAway.current && (arenaMode === 'exam' || (arenaMode === 'learning' && hasUnsavedLearningProgress)),
    ({ data }) => {
      const isLearningExit = arenaMode === 'learning';
      // Store the navigation action so modals can complete the exit after saving
      pendingNavActionRef.current = data.action;
      Alert.alert(
        isLearningExit ? 'Exit Learn Session?' : 'Exit Exam?',
        isLearningExit
          ? 'You have unsaved progress. What would you like to do?'
          : 'Your attempt is in progress. What would you like to do?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => { pendingNavActionRef.current = null; },
          },
          {
            text: 'Exit without saving',
            style: 'destructive',
            onPress: () => {
              if (isLearningExit) {
                clearStoredAnswers();
                setRevealedExplanations({});
              }
              pendingNavActionRef.current = null;
              isNavigatingAway.current = true;
              navigation.dispatch(data.action);
            },
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              if (isLearningExit) {
                setShowSaveNameModal(true);
              } else {
                setShowSaveSessionModal(true);
              }
            },
          },
        ],
        { cancelable: false }
      );
    }
  );

  useEffect(() => {
    const shouldGuardBack = arenaMode === 'exam' || (arenaMode === 'learning' && hasUnsavedLearningProgress);
    if (!shouldGuardBack) return;

    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isNavigatingAway.current) {
        navigation.dispatch({ type: 'GO_BACK' } as any);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [arenaMode, hasUnsavedLearningProgress]);

  // 1. Config from Params
  const showPYQTagsParam = params.showPYQTags !== 'false';
  // viewMode: 'list' | 'card' | 'paper'
  // 'paper' is the new Simulated Exam Mode (printed-paper layout, 2-column grid).
  // When the student launches in Exam mode from Arena, we default to 'paper'.
  const initialView: 'list' | 'card' | 'paper' = (params.view as any)
    || (arenaMode === 'exam' ? 'paper' : 'list');
  const [viewMode, setViewMode] = useState<'list' | 'card' | 'paper'>(initialView);
  const isPaperMode = viewMode === 'paper';
  const timerType = (params.timer as 'countdown' | 'stopwatch' | 'none') || 'none';
  const [showModeSelection, setShowModeSelection] = useState(params.mode === 'choice');

  // 2. State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReady, setIsReady] = useState(false); // New: track when index is loaded
  const [seconds, setSeconds] = useState(timerType === 'countdown' ? 3600 : 0);
  const [isTimerActive, setIsTimerActive] = useState(timerType !== 'none');
  const [showExitModal, setShowExitModal] = useState(false);
  const [customTestName, setCustomTestName] = useState(`Custom Practice - ${new Date().toLocaleDateString()}`);
  const [revealedExplanations, setRevealedExplanations] = useState<Record<string, boolean>>({});
  const [hasJumped, setHasJumped] = useState(false);

  // ── Search context (when opened from AI Search results) ─────────
  const isFromSearch = !!params.resultIds;
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  // Preserve scroll position across panel open/close
  const searchPanelScrollRef = React.useRef<any>(null);
  const searchPanelScrollOffset = React.useRef<number>(0);

  // Hardnotes bridge (Phase 3) — send quiz explanation into a Skia canvas note
  const [hardnotesPickerVisible, setHardnotesPickerVisible] = useState(false);
  const [hardnotesPayload, setHardnotesPayload] = useState<{ markdown: string; title: string } | null>(null);
  const [showPYQTags, setShowPYQTags] = useState(showPYQTagsParam);
  const [activeExplIndex, setActiveExplIndex] = useState<Record<string, number>>({});
  const [activeExplSource, setActiveExplSource] = useState<Record<string, string>>({});
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const indexPanelScrollRef = useRef<ScrollView>(null);
  const indexPanelScrollOffset = useRef(0);
  const {
    savingFlashcard,
    flashcardedIds,
    setFlashcardedIds,
    aff,
    setAff,
    handleAddToFlashcards,
    handleFlashcardPlaced,
    handleFlashcardDeleted,
    fetchFlashcardedStatus
  } = useFlashcardAction(session?.user?.id);
  // Sync flashcard state when screen gains focus — picks up cards that were
  // deleted from the flashcards screen while this engine was in the background.
  useFocusEffect(
    useCallback(() => {
      const ids = questions.map(q => q.id);
      if (ids.length > 0) fetchFlashcardedStatus(ids);
    }, [questions, fetchFlashcardedStatus])
  );
  const [lastNoteTap, setLastNoteTap] = useState(0);
  const [fontSize, setFontSize] = useState(16);

  // ── General Doubt Clearing state (pop up) ───────────────
  const [doubtModalVisible, setDoubtModalVisible] = useState(false);
  const [doubtQuestion, setDoubtQuestion] = useState('');
  const [doubtAnswer, setDoubtAnswer] = useState('');
  const [askingDoubt, setAskingDoubt] = useState(false);

  const handleAskDoubt = async () => {
    if (!doubtQuestion.trim()) return;
    const currentItem = questions[currentIndex];
    if (!currentItem) return;

    setAskingDoubt(true);
    setDoubtAnswer('');
    try {
      const q = currentItem.question_text || (currentItem as any).question || '';
      const opts = JSON.stringify(currentItem.options || {});
      
      // Get the currently selected explanation if any
      const id = currentItem.id;
      const expl = aiExplanations[id] || bestAnswers[id]?.answer_text || currentItem.explanation_markdown || '';
      
      const result = await aiAskDoubt(doubtQuestion, {
        question: q,
        options: opts,
        explanation: expl
      });
      setDoubtAnswer(result);
    } catch (e: any) {
      Alert.alert('AI Error', e?.message || 'Could not answer doubt.');
    } finally {
      setAskingDoubt(false);
    }
  };
  const baseFontSizeRef = useRef(16);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const zoomTimerRef = useRef<any>(null);
  const FONT_SIZE_KEY = 'engine_font_size_v1';

  // Load saved font size on mount
  useEffect(() => {
    AsyncStorage.getItem(FONT_SIZE_KEY).then((saved) => {
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 12 && n <= 32) {
          setFontSize(n);
          baseFontSizeRef.current = n;
        }
      }
    }).catch(() => {});
  }, []);

  // Persist whenever font size changes (debounced via setItem fire-and-forget)
  useEffect(() => {
    AsyncStorage.setItem(FONT_SIZE_KEY, String(fontSize)).catch(() => {});
  }, [fontSize]);

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    // Map gesture scale to 0.8x – 2.0x of base size
    let next = baseFontSizeRef.current * scale;
    next = Math.max(12, Math.min(32, next)); // 0.75x – 2.0x of 16
    setFontSize(Math.round(next));
    setShowZoomIndicator(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1200);
  };
  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GHState.END || event.nativeEvent.state === GHState.CANCELLED) {
      baseFontSizeRef.current = fontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  const handleClockButtonPress = () => {
    if (timerType === 'none') setShowTimerPicker(true);
    else setShowClockControl(true);
  };

  const prepareExportPayload = () => {
    if (!questions || questions.length === 0) {
      Alert.alert("No Questions", "There are no questions to export.");
      return;
    }
    const rows = questions.map((q: any) => ({
      id: q.id,
      question_text: q.question_text || q.text || q.statement || '',
      options: q.options,
      correct_answer: q.correct_answer || q.correctAnswer,
      selected_answer: currentAnswers[q.id]?.selectedAnswer || null,
      is_correct: currentAnswers[q.id]?.selectedAnswer ? (currentAnswers[q.id]?.selectedAnswer === q.correct_answer) : undefined,
      explanation_markdown: q.explanation_markdown || q.explanation,
      subject: q.subject,
      section_group: q.section_group,
      micro_topic: q.micro_topic,
      exam_year: q.exam_year,
      is_pyq: q.is_pyq,
      is_upsc_cse: q.is_upsc_cse,
      is_allied: q.is_allied,
      is_others: q.is_others,
      exam_group: q.exam_group,
      is_ncert: q.is_ncert,
      source: q.source,
      exam_info: q.exam_info,
      _explanations: Array.isArray(q._explanations) ? q._explanations : []
    }));

    // Inject My Vitamin (best answer) into _explanations for each question
    rows.forEach((row: any) => {
      const best = bestAnswers[row.id];
      if (best?.answer_text) {
        if (!Array.isArray(row._explanations)) {
          row._explanations = [];
        }
        row._explanations.push({
          source: 'My Vitamin',
          text: best.answer_text,
          year: '',
        });
      }
    });

    // Extract available institute names for the filter chips
    const instituteSet = new Set<string>();
    rows.forEach((row: any) => {
      if (Array.isArray(row._explanations)) {
        row._explanations.forEach((expl: any) => {
          if (expl.source) instituteSet.add(expl.source);
        });
      }
    });
    setAvailableInstitutes(Array.from(instituteSet).sort());

    setExportPayload({
      kind: 'questions',
      rows,
    });
    setExportSheetVisible(true);
    setShowQuickMenu(false);
    setShowPaperQuickMenu(false);
  };
  const [availableInstitutes, setAvailableInstitutes] = useState<string[]>([]);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showPaperQuickMenu, setShowPaperQuickMenu] = useState(false);
  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportPayload, setExportPayload] = useState<any>(null);
  const [showPaperPagination, setShowPaperPagination] = useState(false);
  // Simulated Exam Mode (paper view) state
  const [paperPage, setPaperPage] = useState(0); // current paper page (0-indexed)
  const [explanationModalQId, setExplanationModalQId] = useState<string | null>(null); // open explanation modal for this question id
  const [paperPageSize, setPaperPageSize] = useState(6); // 6 questions/page (can fall back to 4–5 visually)
  const [showFontSlider, setShowFontSlider] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showIndex, setShowIndex] = useState(
    // Skip arena index when coming from search (resultIds present) — show question directly
    arenaMode === 'learning' && !params.resultIds
  );
  // FIX #5: State for side panel index (40% width, right side, non-navigating)
  const [showIndexPanel, setShowIndexPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [showTimerPicker, setShowTimerPicker] = useState(false);
  const [showClockControl, setShowClockControl] = useState(false);
  const [customTimeInput, setCustomTimeInput] = useState('');
  const [showSaveSessionModal, setShowSaveSessionModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [userStudyTags, setUserStudyTags] = useState(DEFAULT_STUDY_TAGS);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [summary, setSummary] = useState<null | {
    totalQuestions: number;
    attempted: number;
    skipped: number;
    durationSec: number;
    attemptId?: string;
  }>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pilotV2SaveOpen, setPilotV2SaveOpen] = useState(false);
  const [pilotSaveTargetQuestion, setPilotSaveTargetQuestion] = useState<Question | null>(null);
  const [pilotSaveHtml, setPilotSaveHtml] = useState('');
  
  // Personalized Notes (Quiz Engine)
  const [editNoteQId, setEditNoteQId] = useState<string | null>(null);
  const [noteEditorText, setNoteEditorText] = useState('');
  const [isAiRefiningNote, setIsAiRefiningNote] = useState(false);

  // Track viewable items via a ref to avoid triggering re-renders during scroll.
  // We only update currentIndex when the user has been on a question long enough
  // (minimumViewTime) to prevent rapid index jumping during fast scrolling.
  const pendingIndexRef = useRef<number>(-1);
  const viewabilityTimerRef = useRef<any>(null);

  const viewabilityConfig = useRef({
    // Require 30% of the item to be visible – lower threshold to avoid
    // triggering premature detection during fast scroll
    itemVisiblePercentThreshold: 30,
    // Wait 250ms before reporting – this prevents rapid setCurrentIndex calls
    // that create cascading re-renders and scroll jitter.
    minimumViewTime: 250,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      const newIndex = viewableItems[0].index;
      // Only update if actually different – avoid unnecessary re-renders
      if (newIndex !== pendingIndexRef.current) {
        pendingIndexRef.current = newIndex;
        // Debounce the actual state update to after scroll momentum ends
        if (viewabilityTimerRef.current) clearTimeout(viewabilityTimerRef.current);
        viewabilityTimerRef.current = setTimeout(() => {
          setCurrentIndex(newIndex);
        }, 100);
      }
    }
  }).current;

  // ZEN MODE STATE
  const [isZenMode, setIsZenMode] = useState(false);
  const zenAnim = useRef(new Animated.Value(0)).current;

  const toggleZenMode = () => {
    if (!isZenMode) {
      setIsZenMode(true);
      Animated.timing(zenAnim, { toValue: 1, duration: 600, useNativeDriver: false }).start();
    } else {
      Animated.timing(zenAnim, { toValue: 0, duration: 400, useNativeDriver: false }).start(() => setIsZenMode(false));
    }
  };

  // AUTO-HIDING HEADER STATE
  const [headerHidden, setHeaderHidden] = useState(false);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);

  const toggleHeader = useCallback((hidden: boolean) => {
    if (hidden === headerHidden) return;
    setHeaderHidden(hidden);
    Animated.timing(headerTranslateY, {
      toValue: hidden ? -100 : 0, // Header height is approx 60-80px
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [headerHidden]);

  // Auto-hiding header: track scroll direction via ref only (no state change during scroll).
  // We use requestAnimationFrame to batch header animation updates and prevent
  // any layout thrashing that contributes to scroll jitter.
  const scrollDirectionRef = useRef<'up' | 'down' | null>(null);
  const headerAnimPendingRef = useRef<any>(null);

  const handleScroll = useCallback((event: any) => {
    const currentY = event.nativeEvent.contentOffset.y;
    const diff = currentY - lastScrollY.current;
    lastScrollY.current = currentY;

    // Ignore micro-movements to avoid jitter
    if (Math.abs(diff) < 8) return;

    const newDirection: 'up' | 'down' = diff > 0 ? 'down' : 'up';

    // Only act when direction changes and we've scrolled past the header zone
    if (newDirection !== scrollDirectionRef.current) {
      scrollDirectionRef.current = newDirection;

      if (headerAnimPendingRef.current) return; // Animation already queued

      headerAnimPendingRef.current = requestAnimationFrame(() => {
        headerAnimPendingRef.current = null;
        if (newDirection === 'down' && currentY > 80) {
          toggleHeader(true);
        } else if (newDirection === 'up') {
          toggleHeader(false);
        }
      });
    }
  }, [toggleHeader]);

  const zenBg = isZenMode ? '#F4ECD8' : colors.bg;
  const zenTextColor = isZenMode ? '#433422' : colors.textPrimary;
  const zenPaperColor = isZenMode ? '#F4ECD8' : colors.surface;

  // ── Shared Markdown styles & table rules ─────────────────────────────────
  // Memoised so they're only re-computed when theme or fontSize changes,
  // not on every keystroke / answer selection.
  const mdStyles = useMemo(() => buildMarkdownStyles(
    colors.textPrimary,
    fontSize,
    colors.surface,
    colors.border,
    colors.primary,
    Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' })
  ), [colors.textPrimary, colors.surface, colors.border, colors.primary, fontSize]);

  const mdRules = useMemo(() => buildMarkdownRules(
    colors.border,
    colors.primary,
    colors.textPrimary,
    fontSize,
  ), [colors.border, colors.primary, colors.textPrimary, fontSize]);

  // Zen-mode variant (sepia tone) for question-stem Markdown
  const mdStylesZen = useMemo(() => buildMarkdownStyles(
    zenTextColor,
    fontSize - 1,
    zenPaperColor,
    isZenMode ? 'rgba(67,52,34,0.2)' : colors.border,
    colors.primary,
    Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' })
  ), [zenTextColor, zenPaperColor, isZenMode, colors.border, colors.primary, fontSize]);

  const mdRulesZen = useMemo(() => buildMarkdownRules(
    isZenMode ? 'rgba(67,52,34,0.2)' : colors.border,
    colors.primary,
    zenTextColor,
    fontSize - 1,
  ), [isZenMode, colors.border, colors.primary, zenTextColor, fontSize]);

  const sessionTestId = useMemo(() => {
    return routeParams.testId || `custom_${routeParams.subject || 'all'}_${new Date().toISOString().split('T')[0]}`;
  }, [routeParams.testId, routeParams.subject]);
  // Issue 54: Stable attempt ID across re-renders (useRef so mode switches don't wipe answers)
  const attemptIdRef = useRef<string | null>(null);
  if (!attemptIdRef.current || !attemptIdRef.current.startsWith(sessionTestId)) {
    attemptIdRef.current = `${sessionTestId}__${Date.now()}`;
  }
  const sessionAttemptId = attemptIdRef.current;

  // 0. Persistence: Load and Save currentIndex
  const INDEX_PERSIST_KEY = useMemo(() => `quiz_index_${sessionTestId}`, [sessionTestId]);

  useEffect(() => {
    const loadIndex = async () => {
      try {
        const saved = await AsyncStorage.getItem(INDEX_PERSIST_KEY);
        if (saved !== null) {
          const idx = parseInt(saved, 10);
          if (!isNaN(idx)) setCurrentIndex(idx);
        }
      } catch (e) {
        console.warn("Failed to load index", e);
      } finally {
        setIsReady(true);
      }
    };
    loadIndex();
  }, [INDEX_PERSIST_KEY]);

  useEffect(() => {
    if (isReady && currentIndex >= 0) {
      AsyncStorage.setItem(INDEX_PERSIST_KEY, currentIndex.toString());
    }
  }, [currentIndex, isReady, INDEX_PERSIST_KEY]);

  // Fetch unique tags from previous sessions + persisted catalog
  useEffect(() => {
    const fetchExistingTags = async () => {
      if (!session?.user?.id) return;
      const allTags = new Set<string>(DEFAULT_STUDY_TAGS);

      // 1. Load from persisted custom tag catalog (shared with Tags tab)
      try {
        const catalogKey = `review_tag_catalog_${session.user.id}`;
        const raw = await AsyncStorage.getItem(catalogKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((t: string) => {
              if (t && typeof t === 'string' && t.trim()) {
                allTags.add(t.trim());
              }
            });
          }
        }
      } catch (e) {
        console.warn('Failed to load custom tags from AsyncStorage:', e);
      }

      // 2. Also pull tags from question_states (legacy / cross-device data)
      try {
        const { data } = await supabase
          .from('question_states')
          .select('review_tags')
          .eq('user_id', session.user.id)
          .not('review_tags', 'is', null);

        if (data) {
          data.forEach(row => {
            if (Array.isArray(row.review_tags)) {
              row.review_tags.forEach((t: string) => {
                if (t && typeof t === 'string' && t.trim()) {
                  allTags.add(t.trim());
                }
              });
            }
          });
        }
      } catch (e) {
        console.warn('Failed to load tags from Supabase:', e);
      }

      // Always ensure we have at least DEFAULT_STUDY_TAGS
      const finalTags = Array.from(allTags).sort();
      console.log('[Engine] Final userStudyTags loaded:', finalTags);
      setUserStudyTags(finalTags.length > 0 ? finalTags : DEFAULT_STUDY_TAGS);
    };
    fetchExistingTags();
  }, [session?.user?.id]);

  const toggleStudyTag = (qId: string, currentTags: string[], tag: string) => {
    const tags = currentTags || [];
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    store.setMetadata(qId, { studyTags: newTags }, false);
    // Explicitly trigger sync with the *newest* data to prevent the "one step behind" race condition
    if (session?.user?.id) {
      StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: qId,
        testId: questions.find(q => q.id === qId)?.tests?.id || 'manual',
        patch: { review_tags: newTags }
      });
      // Notify Tags tab to refresh when tags change
      useTagStore.getState().bump({ type: 'add', tag, at: Date.now() });
    }
  };

  const toggleGuess = (qId: string, selectedAnswer: string | null | undefined, guessValue: string) => {
    const currentGuess = currentAnswers[qId]?.confidence || null;
    const newVal = currentGuess === guessValue ? null : guessValue;
    store.setAnswer(qId, selectedAnswer ?? null, newVal, false);
    if (session?.user?.id) {
      StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: qId,
        testId: questions.find(q => q.id === qId)?.tests?.id || 'manual',
        patch: { confidence: newVal, selected_answer: selectedAnswer ?? null }
      });
    }
  };

  const toggleDifficulty = (qId: string, difficultyValue: string) => {
    const currentDifficulty = currentAnswers[qId]?.difficulty || null;
    const newVal = currentDifficulty === difficultyValue ? null : difficultyValue;
    store.setMetadata(qId, { difficulty: newVal }, false);
    if (session?.user?.id) {
      StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: qId,
        testId: questions.find(q => q.id === qId)?.tests?.id || 'manual',
        patch: { review_difficulty: newVal }
      });
    }
  };

  const toggleMistakeType = (qId: string, errorType: string) => {
    const currentError = currentAnswers[qId]?.errorCategory || null;
    const newVal = currentError === errorType ? null : errorType;
    store.setMetadata(qId, { errorCategory: newVal }, false);
    if (session?.user?.id) {
      StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: qId,
        testId: questions.find(q => q.id === qId)?.tests?.id || 'manual',
        patch: { error_category: newVal }
      });
    }
  };

  const NOTE_PREFS_KEY = 'notebook_save_prefs';
  const listRef = useRef<FlatList>(null);

  // Robust scroll helper for list view palette/navigator jumps.
  // Uses scrollToIndex (which works without getItemLayout via a small delay
  // to let the list measure items first). Falls back to offset estimate.
  // Tracks last requested target so onScrollToIndexFailed can use it.
  const lastScrollTargetRef = useRef<number>(-1);
  const scrollToIndexRobust = useCallback((targetIndex: number) => {
    if (viewMode !== 'list') return;
    lastScrollTargetRef.current = targetIndex;

    // Cancel any pending viewability-driven setCurrentIndex so it doesn't
    // race with our explicit jump and snap us back to the previous question.
    if (viewabilityTimerRef.current) {
      clearTimeout(viewabilityTimerRef.current);
      viewabilityTimerRef.current = null;
    }
    pendingIndexRef.current = targetIndex;

    const attemptScroll = () => {
      const list = listRef.current;
      if (!list) return;
      try {
        list.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        // scrollToIndex doesn't usually throw; rely on onScrollToIndexFailed.
        const estimatedOffset = targetIndex * 280;
        list.scrollToOffset({
          offset: Math.max(0, estimatedOffset),
          animated: true,
        });
      }
    };

    // Small delay so modal close animation doesn't compete with the scroll
    setTimeout(attemptScroll, 80);
  }, [viewMode]);

  // 4. Fetch Questions
  useEffect(() => {
    if (session?.user?.id) {
      fetchQuestions();
      store.startTest(sessionTestId, session.user.id, sessionAttemptId);
    }
    // We only want to run this once per sessionTestId
  }, [sessionTestId, sessionAttemptId, session?.user?.id]);

  // ── Scroll to currentIndex when entering list mode ────────────────
  // When the user switches from card → list mode (or palette jumps into
  // card then toggles to list), the FlatList re-mounts fresh. Without
  // an explicit scroll, it shows Question 1.  `initialScrollIndex` alone
  // is unreliable without `getItemLayout`, so we scroll programmatically.
  React.useEffect(() => {
    if (viewMode !== 'list') return;
    const idx = currentIndex;
    // Small delay so FlatList can render before we ask it to scroll.
    const t = setTimeout(() => scrollToIndexRobust(idx), 80);
    return () => clearTimeout(t);
  }, [viewMode]);

  useEffect(() => {
    if (!isPaperMode) {
      setShowPaperQuickMenu(false);
      setShowPaperPagination(false);
    }
  }, [isPaperMode]);

  const fetchQuestions = async () => {
    setLoading(true);
    let tagList: string[] = [];
    const SELECT_COLS = 'id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_allied, is_others, source, test_id, tests(*)';
    
    // Helper to process results
    const processResults = (data: any[], originalTestIds?: Set<string>) => {
      const rawQs = data || [];
      const useExactPaperSequence = !!params.testId;
      const isUpscPyqInPaper = useExactPaperSequence && rawQs.some((q: any) => {
        const groupName = String(q?.source?.group || q?.exam_group || q?.tests?.series || q?.tests?.title || '').toUpperCase();
        return Boolean(q?.is_pyq) && (Boolean(q?.is_upsc_cse) || groupName.includes('UPSC'));
      });
      const shouldMerge = !useExactPaperSequence || isUpscPyqInPaper;

      let mergedQs: any[] = rawQs;
      let idToMergedId = new Map<string, string>();

      if (shouldMerge) {
        const merged = mergeQuestions(rawQs);
        mergedQs = merged.mergedQs;
        idToMergedId = merged.idToMergedId;
      } else {
        mergedQs = rawQs;
        rawQs.forEach((q: any) => idToMergedId.set(q.id, q.id));
      }

      let finalQs = mergedQs;
      
      // DEBUG: Log merged questions to verify _explanations
      if (shouldMerge && mergedQs.length > 0) {
        console.log('[Merge Debug] Sample merged question:', {
          id: mergedQs[0].id,
          hasExplanations: !!mergedQs[0]._explanations,
          explanationsCount: mergedQs[0]._explanations?.length || 0,
          institutes: mergedQs[0]._institutes,
          sampleExpl: mergedQs[0]._explanations?.[0]
        });
      }
      
      const resIds = typeof params.resultIds === 'string' ? params.resultIds.split(',').filter((id: string) => id.trim().length > 0) : null;
      const parseQuestionNumber = (q: any) => {
        const raw = q?.question_number;
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
        const text = String(raw ?? '').trim();
        if (!text) return Number.MAX_SAFE_INTEGER;
        const numeric = Number(text);
        if (Number.isFinite(numeric)) return numeric;
        const match = text.match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
      };

      if (resIds && resIds.length > 0) {
        const orderedMergedIds = resIds.map(id => idToMergedId.get(id) || id);
        const uniqueOrderedIds = Array.from(new Set(orderedMergedIds));
        finalQs = uniqueOrderedIds.map(id => mergedQs.find(q => q.id === id)).filter(Boolean);
      } else if (useExactPaperSequence) {
        // Paper-wise learn/exam must keep deterministic paper sequence.
        // For merged UPSC sessions, preserve base paper order by mapping each
        // paper row to its merged cluster id and keeping first occurrence.
        const orderedBase = [...rawQs]
          .map((q: any, idx: number) => ({ q, idx, qNo: parseQuestionNumber(q) }))
          .sort((a, b) => {
            if (a.qNo !== b.qNo) return a.qNo - b.qNo;
            const idA = String(a.q?.id ?? '');
            const idB = String(b.q?.id ?? '');
            if (idA && idB && idA !== idB) return idA < idB ? -1 : 1;
            return a.idx - b.idx;
          })
          .map(({ q }) => q);
        const orderedMergedIds = orderedBase.map((q: any) => idToMergedId.get(q.id) || q.id);
        const uniqueOrderedIds = Array.from(new Set(orderedMergedIds));
        finalQs = uniqueOrderedIds.map(id => mergedQs.find(q => q.id === id)).filter(Boolean);
      } else {
        // Apply priority sorting: Relevance → UPSC Priority → Newest Year.
        finalQs = [...finalQs].sort((a: any, b: any) => {
          // A. Relevance Tie-break: Check if the exact term is present
          const term = (params.query || '').toLowerCase().trim();
          const aText = (a.question_text + ' ' + (a.explanation_markdown || '')).toLowerCase();
          const bText = (b.question_text + ' ' + (b.explanation_markdown || '')).toLowerCase();
          const aExact = term && aText.includes(term);
          const bExact = term && bText.includes(term);
          
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;

          const getRank = (q: any) => {
            const src = (q.source?.group || q.exam_group || q.tests?.series || q.tests?.title || '').toUpperCase();
            if (q.is_upsc_cse || src.includes('UPSC CSE') || src.includes('IAS') || src.includes('CIVIL SERVICES')) return 3;
            if (q.is_allied || src.includes('ALLIED')) return 2;
            if (q.is_pyq || q.is_others || src.includes('PYQ')) return 1;
            return 0;
          };
          const rA = getRank(a), rB = getRank(b);
          if (rA !== rB) return rB - rA;
          const yA = parseInt(a.exam_year || a.tests?.exam_year || '0'), yB = parseInt(b.exam_year || b.tests?.exam_year || '0');
          if (yA !== yB) return yB - yA;
          return String(a.subject || '').localeCompare(String(b.subject || ''));
        });
      }

      // Filter to original testId questions only if siblings were added for enrichment
      if (originalTestIds && originalTestIds.size > 0) {
        // Keep only cluster heads that map back to original test questions
        const originalMergedHeads = new Set<string>();
        for (const originalId of Array.from(originalTestIds)) {
          const mergedHeadId = idToMergedId.get(originalId);
          if (mergedHeadId) originalMergedHeads.add(mergedHeadId);
        }
        const preFilterCount = finalQs.length;
        finalQs = finalQs.filter(q => originalMergedHeads.has(q.id));
        console.log('[Merge Debug] After filtering to original questions:', {
          preFilterCount,
          postFilterCount: finalQs.length,
          originalMergedHeadsSize: originalMergedHeads.size
        });
      }

      setQuestions(finalQs);
      
      // 🐛 FIX #41: Direct question navigation - use Card Mode as default during jump
      // Scroll to correct question without resetting to Question 1
      if (params.questionId && !hasJumped) {
        const jumpId = params.questionId;
        const targetId = idToMergedId.get(jumpId) || jumpId;
        const index = finalQs.findIndex(item => item.id === targetId);
        if (index !== -1) {
          // Set current index BEFORE marking as jumped to prevent race condition
          setCurrentIndex(index);
          setShowIndex(false);
          setViewMode('card'); // Default to Card Mode for direct navigation
          setHasJumped(true);
          // If revealAll is passed (from Tags tab), auto-reveal the explanation
          if (routeParams.revealAll === '1' || routeParams.fromTags === 'true') {
            const q = finalQs[index];
            if (q) {
              setRevealedExplanations(prev => ({ ...prev, [q.id]: true }));
            }
          }
        }
      }
      
      if (session?.user?.id && finalQs.length > 0) {
        // Issue 54: Always load persisted answers so they survive mode switches
        const shouldLoadAnswers = !!params.testId && !params.testId.startsWith('custom_');
        store.loadStates(mergedQs.map(q => q.id), shouldLoadAnswers);
        checkFlashcards(finalQs.map(q => q.id));
      }
    };

    let localFound = false;
    try {
      // ──────── 1. FAST: Load from Local Cache First ────────
      if (params.testId) {
        const cached = await OfflineManager.getOfflineQuestions(params.testId);
        if (cached && cached.length > 0) {
          processResults(cached);
          localFound = true;
          setLoading(false);
        }
      } else if (params.resultIds) {
        const ids = params.resultIds.split(',').filter((id: string) => Boolean(id));
        const cached = await OfflineManager.getOfflineQuestionsByIds(ids);
        if (cached && cached.length > 0) {
          processResults(cached);
          localFound = true;
          setLoading(false);
        }
      } else {
        // ──────── 1b. OFFLINE-FALLBACK: Filter all cached questions ────────
        const allOffline = OfflineManager.getOfflineQuestionsAllSync() || [];
        if (allOffline.length > 0) {
          let filtered = [...allOffline];

          // Apply subject filter
          const subs = params.subjects || params.subject;
          if (subs && subs !== 'All' && subs !== '' && subs !== '[]') {
            const subList = typeof subs === 'string' ? subs.split(',').filter(Boolean) : [];
            if (subList.length > 0) filtered = filtered.filter((q: any) => subList.includes(q.subject));
          }

          // Apply pyq filter
          const pyqM = params.pyqMaster || params.pyqFilter;
          if (pyqM === 'PYQ Only') filtered = filtered.filter((q: any) => q.is_pyq);
          else if (pyqM === 'Non-PYQ' || pyqM === 'Non PYQ') filtered = filtered.filter((q: any) => !q.is_pyq);

          // Apply year range
          if (params.year_start) filtered = filtered.filter((q: any) => q.exam_year >= params.year_start);
          if (params.year_end) filtered = filtered.filter((q: any) => q.exam_year <= params.year_end);

          // Apply micro_topic
          const mt = params.microTopics || params.microtopic;
          if (mt && mt !== 'All' && mt !== '' && mt !== '[]') {
            const mtList = typeof mt === 'string' ? mt.split('|').filter(Boolean) : [];
            if (mtList.length > 0) filtered = filtered.filter((q: any) => mtList.includes(q.micro_topic));
          }

          // Apply section_group
          const sectionVal = params.section;
          if (sectionVal && sectionVal !== 'All' && sectionVal !== '' && sectionVal !== '[]') {
            const sectionList = typeof sectionVal === 'string' ? sectionVal.split('|').filter(Boolean) : [];
            if (sectionList.length > 0) filtered = filtered.filter((q: any) => sectionList.includes(q.section_group || 'General'));
          }

          // 🐛 FIX #30: Apply tags filter to offline cache path
          const tagsRaw = params.tags;
          if (tagsRaw && tagsRaw !== 'All' && tagsRaw !== '' && tagsRaw !== '[]' && session?.user?.id) {
            const tagList = typeof tagsRaw === 'string' ? tagsRaw.split('|').filter(Boolean) : [];
            if (tagList.length > 0) {
              // Build a Set of question IDs that have matching tags from question_states
              const { data: tagStates } = await supabase
                .from('question_states')
                .select('question_id')
                .eq('user_id', session.user.id)
                .or(tagList.map(t => `review_tags.cs.["${t}"]`).join(','));
              const allowedIds = new Set((tagStates || []).map((t: any) => t.question_id));
              if (allowedIds.size > 0) {
                filtered = filtered.filter((q: any) => allowedIds.has(q.id));
              } else {
                filtered = [];
              }
            }
          }

          // Apply NCERT/curriculum filter — was missing, same issue:
          // without it, ALL cached questions flow into mergeQuestions
          const ncertFilter = params.ncertFilter;
          if (ncertFilter === 'NCERT Only') {
            filtered = filtered.filter((q: any) => {
              const v = q.is_ncert;
              return v === true || v === 1 || (typeof v === 'string' && ['true','1','yes'].includes(v.trim().toLowerCase()));
            });
          } else if (ncertFilter === 'Non-NCERT') {
            filtered = filtered.filter((q: any) => {
              const v = q.is_ncert;
              return !(v === true || v === 1 || (typeof v === 'string' && ['true','1','yes'].includes(v.trim().toLowerCase())));
            });
          }

          // Apply institute filter (critical — prevents mergeQuestions from
          // scanning ALL cached questions when a specific institute is selected)
          const insts = params.institutes || params.institute;
          if (insts && insts !== 'All' && insts !== '' && insts !== '[]') {
            const instList = typeof insts === 'string' ? insts.split(',').filter(Boolean) : [];
            if (instList.length > 0) {
              filtered = filtered.filter((q: any) => {
                const tests = Array.isArray(q?.tests) ? q.tests[0] : q?.tests;
                const inst = tests?.institute || q?.provider || q?.source?.institute || '';
                return instList.includes(inst);
              });
            }
          }

          // Apply program filter
          const progs = params.programs || params.program;
          if (progs && progs !== 'All' && progs !== '' && progs !== '[]') {
            const progList = typeof progs === 'string' ? progs.split(',').filter(Boolean) : [];
            if (progList.length > 0) {
              filtered = filtered.filter((q: any) => {
                const tests = Array.isArray(q?.tests) ? q.tests[0] : q?.tests;
                const prog = tests?.program_name || q?.program_name || '';
                return progList.includes(prog);
              });
            }
          }

          if (filtered.length > 0) {
            processResults(filtered);
            localFound = true;
            setLoading(false);
          }
        }
      }

      // ──────── 2. FRESH: Background fetch from Server (Chunked to bypass limits) ────────
      let allFreshData: any[] = [];
      let from = 0;
      const CHUNK = 1000;
      const MAX_TOTAL = 10000; // Safety cap to prevent memory issues
      
      while (from < MAX_TOTAL) {
        let query = supabase.from('questions').select(SELECT_COLS);
        const resIds = typeof params.resultIds === 'string' ? params.resultIds.split(',').filter((id: string) => id.trim().length > 0) : null;
        
        if (resIds && resIds.length > 0) {
          // If we have specific IDs, chunk those IDs specifically
          const idChunk = resIds.slice(from, from + CHUNK);
          if (idChunk.length === 0) break;
          query = query.in('id', idChunk);
        } else if (params.questionId) {
          if (from > 0) break; // Only one question (cluster head)
          // PARITY FIX: fetch sibling rows so the merger can rebuild the full
          // multi-institute explanation cluster, exactly like the index path.
          const { data: tgt } = await supabase
            .from('questions')
            .select(SELECT_COLS)
            .eq('id', params.questionId);
          const target: any = tgt && tgt[0];
          if (!target) break;
          let siblings: any[] = [];
          const groupName = String(target.source?.group || target.exam_group || target.tests?.series || '').toUpperCase();
          const isUpsc = !!target.is_upsc_cse || groupName.includes('UPSC');
          const examYear = String(target.exam_year || '').trim();
          if (target.is_pyq && isUpsc && examYear) {
            const { data: sibs } = await supabase
              .from('questions')
              .select(SELECT_COLS)
              .eq('exam_year', examYear)
              .eq('is_pyq', true)
              .eq('is_upsc_cse', true)
              .neq('id', target.id)
              .limit(2000);
            siblings = sibs || [];
          }
          allFreshData.push(target, ...siblings);
          break;
        } else {
          // General filters
          const term = typeof params.query === 'string' ? params.query.trim() : '';
          if (term) {
            const fields = typeof params.searchFields === 'string' ? params.searchFields.split(',') : ['Questions'];
            const mode = params.searchMode || 'Matching';
            
            if (mode === 'Exact') {
              const termPattern = `%${term}%`;
              const filters = [];
              if (fields.includes('Questions') || fields.includes('question_text')) filters.push(`question_text.ilike.${termPattern}`);
              if (fields.includes('Explanations') || fields.includes('explanation_markdown')) filters.push(`explanation_markdown.ilike.${termPattern}`);
              if (filters.length > 0) query = query.or(filters.join(','));
            } else {
              const words = term.split(/\s+/).filter(w => w.length > 1 || /\d/.test(w));
              if (words.length > 1) {
                words.forEach(word => {
                  const wordFilters = [];
                  if (fields.includes('Questions') || fields.includes('question_text')) wordFilters.push(`question_text.ilike.%${word}%`);
                  if (fields.includes('Explanations') || fields.includes('explanation_markdown')) wordFilters.push(`explanation_markdown.ilike.%${word}%`);
                  if (wordFilters.length > 0) wordFilters.push(`question_text.ilike.%${word}%`);
                  if (wordFilters.length > 0) query = query.or(wordFilters.join(','));
                });
              } else {
                const termPattern = `%${term}%`;
                const filters = [];
                if (fields.includes('Questions') || fields.includes('question_text')) filters.push(`question_text.ilike.${termPattern}`);
                if (fields.includes('Explanations') || fields.includes('explanation_markdown')) filters.push(`explanation_markdown.ilike.${termPattern}`);
                if (filters.length > 0) query = query.or(filters.join(','));
              }
            }
          }

          if (params.testId) {
            query = query.eq('test_id', params.testId);
          } else {
            const insts = params.institutes || params.institute;
            const progs = params.programs || params.program;
            const stage = params.stage || params.examStage || params.series;
            const paper = params.paper;

            if ((insts && insts !== 'All' && insts !== '' && insts !== '[]') || 
                (progs && progs !== 'All' && progs !== '' && progs !== '[]') ||
                (stage && stage !== 'All' && stage !== '' && stage !== '[]')) {
              
              let tQuery = LocalQuery.from('tests').select('id');
              
              if (insts && insts !== 'All' && insts !== '' && insts !== '[]') {
                const instList = typeof insts === 'string' ? insts.split(',').filter(Boolean) : [];
                if (instList.length > 0) tQuery = tQuery.in('institute', instList);
              }
              
              if (progs && progs !== 'All' && progs !== '' && progs !== '[]') {
                const progList = typeof progs === 'string' ? progs.split(',').filter(Boolean) : [];
                if (progList.length > 0) tQuery = tQuery.in('program_name', progList);
              }

              if (stage && stage !== 'All' && stage !== '' && stage !== '[]') {
                tQuery = tQuery.ilike('series', `%${stage}%`);
              }

              if (paper && paper !== 'All' && paper !== '' && paper !== '[]') {
                // Map "GS Paper 1" to "Paper 1" or similar for broader matching
                const paperNorm = paper.replace('GS ', '');
                tQuery = tQuery.or(`title.ilike.%${paper}%,title.ilike.%${paperNorm}%,series.ilike.%${paper}%`);
              }
              
              const { data: testRows } = await tQuery;
              const tIds = (testRows || []).map((t: any) => t.id);
              if (tIds.length > 0) query = query.in('test_id', tIds);
              else break;
            }
          }

          const subs = params.subjects || params.subject;
          if (subs && subs !== 'All' && subs !== '' && subs !== '[]') {
            const subList = typeof subs === 'string' ? subs.split(',').filter(Boolean) : [];
            if (subList.length > 0) query = query.in('subject', subList);
          }
          const sectionVal = params.section;
          if (sectionVal && sectionVal !== 'All' && sectionVal !== '' && sectionVal !== '[]') {
            const sectionList = typeof sectionVal === 'string' ? sectionVal.split('|').filter(Boolean) : [];
            const sections = sectionList.map(s => s === "General" ? null : s);
            if (sections.includes(null)) {
              const nonNulls = sections.filter(s => s !== null);
              if (nonNulls.length > 0) {
                const inStr = `section_group.in.(${nonNulls.map(s => `"${s}"`).join(',')})`;
                query = query.or(`${inStr},section_group.is.null`);
              } else {
                query = query.is('section_group', null);
              }
            } else {
              if (sections.length > 0) query = query.in('section_group', sections);
            }
          }
          const mt = params.microTopics || params.microtopic;
          if (mt && mt !== 'All' && mt !== '' && mt !== '[]') {
            const mtList = typeof mt === 'string' ? mt.split('|').filter(Boolean) : [];
            if (mtList.length > 0) query = query.in('micro_topic', mtList);
          }

          const pyqM = params.pyqMaster || params.pyqFilter;
          if (pyqM === 'PYQ Only') {
            query = query.eq('is_pyq', true);
            const pyqCat = params.examCategory || params.pyqCategory;
            if (pyqCat && pyqCat !== 'All' && pyqCat !== '' && pyqCat !== '[]') {
              const cats = typeof pyqCat === 'string' ? pyqCat.split(',').filter(Boolean) : [];
              if (cats.length > 0) {
                const orFilters = [];
                if (cats.includes('UPSC CSE') || cats.includes('UPSC')) orFilters.push('is_upsc_cse.eq.true');
                if (cats.includes('Allied Exams') || cats.includes('Allied')) orFilters.push('is_allied.eq.true');
                if (cats.includes('Others')) orFilters.push('is_others.eq.true');
                if (orFilters.length > 0) query = query.or(orFilters.join(','));
              }
            }
          } else if (pyqM === 'Non-PYQ' || pyqM === 'Non PYQ') {
            query = query.eq('is_pyq', false);
          }

          if (params.specificYear) {
            if (params.specificYear.includes(',')) {
              query = query.in('exam_year', params.specificYear.split(','));
            } else {
              query = query.eq('exam_year', params.specificYear);
            }
          } else if (params.year_start && params.year_end) {
            query = query.gte('exam_year', params.year_start).lte('exam_year', params.year_end);
          }

          if (params.ncertFilter === 'NCERT Only') {
            query = query.eq('is_ncert', true);
          } else if (params.ncertFilter === 'Non-NCERT') {
            query = query.or('is_ncert.is.null,is_ncert.eq.false');
          }

          if (params.testId) {
            query = query.order('question_number', { ascending: true }).order('id', { ascending: true });
          }

          const tagsRaw = params.tags;
          if (tagsRaw && tagsRaw !== 'All' && tagsRaw !== '' && tagsRaw !== '[]' && session?.user?.id) {
            // Tag filtering requires separate fetch of IDs
            const tagList = typeof tagsRaw === 'string' ? tagsRaw.split('|').filter(Boolean) : [];
            const orQuery = tagList.map(t => `review_tags.cs.["${t}"]`).join(',');
            // Use live server state for revision tags so deletions in Supabase
            // are reflected immediately and no stale local snapshot leaks in.
            const { data: tagIds } = await supabase.from('question_states').select('question_id').eq('user_id', session.user.id).or(orQuery);
            if (tagIds && tagIds.length > 0) {
               const slicedTagIds = tagIds.map((t: any) => t.question_id).slice(from, from + CHUNK);
               if (slicedTagIds.length === 0) break;
               query = query.in('id', slicedTagIds);
            } else break;
          } else {
             // If no specific IDs/tags, use standard range pagination
             query = query.range(from, from + CHUNK - 1);
          }
        }

        let { data, error } = await query;
        if (error) throw error;

        // ΓöÇ FUZZY FALLBACK (Search Tab Parity): If results are sparse, try 1-char tolerance
        const term = typeof params.query === 'string' ? params.query.trim() : '';
        if (params.searchMode !== 'Exact' && term && term.length > 3) {
           const words = term.split(/\s+/).filter(Boolean);
           if (words.length === 1) {
             const word = words[0];
             const fuzzyPatterns = [];
             const fields = typeof params.searchFields === 'string' ? params.searchFields.split(',') : ['Questions'];

             for (let i = 0; i < word.length; i++) {
               const pattern = word.substring(0, i) + '%' + word.substring(i + 1);
               if (fields.includes('Questions') || fields.includes('question_text')) {
                 fuzzyPatterns.push(`question_text.ilike.%${pattern}%`);
               }
               if (fields.includes('Explanations') || fields.includes('explanation_markdown')) {
                 fuzzyPatterns.push(`explanation_markdown.ilike.%${pattern}%`);
               }
             }
             
             let fuzzyQ = LocalQuery.from('questions').select('id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_allied, is_others, source, test_id, tests(*)').or(fuzzyPatterns.join(',')).limit(100);
             // Re-apply same filters
             const insts = params.institutes || params.institute;
             const progs = params.programs || params.program;
             const stage = params.stage || params.examStage || params.series;
             if ((insts && insts !== 'All' && insts !== '' && insts !== '[]') || (progs && progs !== 'All' && progs !== '' && progs !== '[]') || (stage && stage !== 'All' && stage !== '' && stage !== '[]')) {
                let tQuery = LocalQuery.from('tests').select('id');
                if (insts && insts !== 'All' && insts !== '' && insts !== '[]') tQuery = tQuery.in('institute', insts.split(',').filter(Boolean));
                if (progs && progs !== 'All' && progs !== '' && progs !== '[]') tQuery = tQuery.in('program_name', progs.split(',').filter(Boolean));
                if (stage && stage !== 'All' && stage !== '' && stage !== '[]') tQuery = tQuery.ilike('series', '%' + stage + '%');
                const { data: tRows } = await tQuery;
                const tIds = (tRows || []).map((t: any) => t.id);
                if (tIds.length > 0) fuzzyQ = fuzzyQ.in('test_id', tIds);
                else fuzzyQ = fuzzyQ.in('test_id', ['__NO_MATCH__']);
             }
             const subs = params.subjects || params.subject;
             if (subs && subs !== 'All' && subs !== '' && subs !== '[]') {
                const subList = typeof subs === 'string' ? subs.split(',').filter(Boolean) : [];
                if (subList.length > 0) fuzzyQ = fuzzyQ.in('subject', subList);
             }
             const pyqM = params.pyqMaster || params.pyqFilter;
             if (pyqM === 'PYQ Only') {
               fuzzyQ = fuzzyQ.eq('is_pyq', true);
               const pyqCat = params.examCategory || params.pyqCategory;
               if (pyqCat && pyqCat !== 'All' && pyqCat !== '' && pyqCat !== '[]') {
                 const cats = typeof pyqCat === 'string' ? pyqCat.split(',').filter(Boolean) : [];
                 const fOr = [];
                 if (cats.includes('UPSC CSE') || cats.includes('UPSC')) fOr.push('is_upsc_cse.eq.true');
                 if (cats.includes('Allied Exams') || cats.includes('Allied')) fOr.push('is_allied.eq.true');
                 if (cats.includes('Others')) fOr.push('is_others.eq.true');
                 if (fOr.length > 0) fuzzyQ = fuzzyQ.or(fOr.join(','));
               }
             } else if (pyqM === 'Non-PYQ' || pyqM === 'Non PYQ') {
               fuzzyQ = fuzzyQ.eq('is_pyq', false);
             }

             if (params.ncertFilter === 'NCERT Only') {
               fuzzyQ = fuzzyQ.eq('is_ncert', true);
             } else if (params.ncertFilter === 'Non-NCERT') {
               fuzzyQ = fuzzyQ.or('is_ncert.is.null,is_ncert.eq.false');
             }

             const { data: fData } = await fuzzyQ;
             if (fData && fData.length > 0) {
               const existingIds = new Set((data || []).map((d: any) => d.id));
               const merged = [...(data || [])];
               fData.forEach((fd: any) => {
                 if (!existingIds.has(fd.id)) merged.push(fd);
               });
               data = merged;
             }
           }
        }
        
        if (!data || data.length === 0) break;
        
        allFreshData.push(...data);
        if (data.length < CHUNK) break;
        from += CHUNK;
      }

const isPyqUpscsearch = params.pyqFilter === 'PYQ Only' && params.year_start && params.year_end;
        let trackedOriginalIds: Set<string> | undefined;
        
        console.log('[Fetch Debug] PYQ enrichment check:', {
          isPyqUpscsearch,
          params: { pyqFilter: params.pyqFilter, year_start: params.year_start, year_end: params.year_end },
        allFreshDataLength: allFreshData.length
      });
      
      if ((params.testId || isPyqUpscsearch) && allFreshData.length > 0) {
        // UPSC CSE PYQ Enrichment: Fetch sibling versions for merged explanations
        // Keep count at original testId count, but enrich with all institute explanations
        const isUpscPaperSession = allFreshData.some((q: any) => {
          const groupName = String(q?.source?.group || q?.exam_group || q?.tests?.series || q?.tests?.title || '').toUpperCase();
          return Boolean(q?.is_pyq) && (Boolean(q?.is_upsc_cse) || groupName.includes('UPSC'));
        });
        if (isUpscPaperSession) {
          const originalIds = new Set(allFreshData.map((q: any) => q.id));
          trackedOriginalIds = originalIds; // Track for later filtering
          const years = Array.from(new Set(
            allFreshData
              .filter((q: any) => Boolean(q?.is_pyq) && (Boolean(q?.is_upsc_cse) || String(q?.source?.group || q?.exam_group || q?.tests?.series || '').toUpperCase().includes('UPSC')))
              .map((q: any) => String(q?.exam_year || '').trim())
              .filter(Boolean)
          ));
          if (years.length > 0) {
            const { data: siblings } = await supabase
              .from('questions')
              .select(SELECT_COLS)
              .in('exam_year', years)
              .eq('is_pyq', true)
              .eq('is_upsc_cse', true)
              .limit(5000);
            if (siblings && siblings.length > 0) {
              // Add siblings for merging explanations, but remember original IDs
              siblings.forEach((q: any) => {
                if (!originalIds.has(q.id)) allFreshData.push(q);
              });
            }
          }
        }
      }

      // Only process fresh data if we actually got some rows.
      // Never blow away cached questions with empty server response.
      if (allFreshData.length > 0) {
        // For enrichment filtering: use tracked original IDs from enrichment block
        let originalQuestionIds: Set<string> | undefined;
        
        if (params.testId) {
          // Test mode: keep only questions with matching test_id
          originalQuestionIds = new Set(
            allFreshData
              .filter((q: any) => q.test_id === params.testId)
              .map((q: any) => q.id)
          );
        } else if (isPyqUpscsearch && trackedOriginalIds) {
          // PYQ search mode: use tracked original IDs
          originalQuestionIds = trackedOriginalIds;
          console.log('[Fetch Debug] Using trackedOriginalIds for PYQ search:', {
            trackedOriginalIdsSize: trackedOriginalIds.size,
            sampleIds: Array.from(trackedOriginalIds).slice(0, 3)
          });
        }
        
        console.log('[Fetch Debug] Before processResults:', {
          allFreshDataLength: allFreshData.length,
          hasOriginalQuestionIds: !!originalQuestionIds,
          originalQuestionIdsSize: originalQuestionIds?.size || 0
        });
        
        processResults(allFreshData, originalQuestionIds);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      // If we didn't find local data and server failed, show empty.
      // But if localFound=true, keep the cached questions rendered.
      if (!localFound) {
        setQuestions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  // 5. Timer Logic
  useEffect(() => {
    if (timerType === 'countdown' && questions.length > 0 && seconds === 3600) {
      setSeconds(questions.length * 120); // 2 mins per question default
    }
  }, [questions.length, timerType]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isTimerActive) {
      interval = setInterval(() => {
        setSeconds(prev => {
          if (timerType === 'countdown') {
            if (prev <= 1) {
              setIsTimerActive(false);
              Alert.alert('Time Up!', 'Your session timer has ended.', [{ text: 'OK' }]);
              return 0;
            }
            return prev - 1;
          }
          return prev + 1;
        });
        const current = questions[currentIndex];
        if (current?.id) {
          store.incrementTime(current.id);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, currentIndex, questions, viewMode, timerType]);

  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 6. Action Handlers
  const handleOptionSelect = (qId: string, label: string) => {
    store.setAnswer(qId, label, undefined, true); // Issue 54: Always autoSync so answers persist across mode switches
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // REDUNDANT: store.setAnswer already triggers sync via store.syncAnswer
    // Removing the direct StudentSync.enqueue here to prevent double-processing
    // and potential session-refresh loops.
  };

  const checkFlashcards = async (qIds: string[]) => {
    if (!session?.user?.id || qIds.length === 0) return;
    try {
      const CHUNK = 100;
      const allFound = new Set<string>();
      for (let i = 0; i < qIds.length; i += CHUNK) {
        const chunk = qIds.slice(i, i + CHUNK);
        const { data } = await supabase
          .from('user_cards')
          .select('cards!inner(question_id)')
          .eq('user_id', session.user.id)
          .in('cards.question_id', chunk);
        if (data) {
          data.forEach((d: any) => allFound.add(d.cards.question_id));
        }
      }
      setFlashcardedIds(allFound);
    } catch (e) {
      console.warn("Flashcard check failed", e);
    }
  };

  const handleQuickSave = async (q: Question) => {
    if (!session?.user?.id) return;
    const rawPrefs = await AsyncStorage.getItem(NOTE_PREFS_KEY);
    if (!rawPrefs) {
      Alert.alert("Setup Required", "Please use 'Notebook' once to set save preferences.");
      return;
    }
    const prefs = JSON.parse(rawPrefs);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // 1. Fetch current items from user_notes
      const { data: noteData, error: fetchError } = await supabase
        .from('user_notes')
        .select('items')
        .eq('id', prefs.notebookId)
        .single();
      
      if (fetchError) throw fetchError;

      const currentItems = Array.isArray(noteData?.items) ? noteData.items : [];
      const heading = prefs.subheading || 'Quick Saves';
      
      // 2. Ensure heading exists
      const newItems = [...currentItems];
      const headingExists = newItems.some((i: any) => i.type === 'microTopicHeading' && i.text === heading);
      if (!headingExists) {
        newItems.push({
          id: Date.now().toString() + '-h',
          type: 'microTopicHeading',
          text: heading,
          addedAt: new Date().toISOString()
        });
      }

      // 3. Add the quick save point
      newItems.push({
        id: (Date.now() + 1).toString(),
        type: 'highlight',
        text: q.explanation_markdown || 'No explanation available',
        color: '#4FC3F7',
        source: `Quick Save: Q${currentIndex + 1} / ${q.source?.group || q.exam_group || (q.is_pyq ? 'PYQ' : 'Practice')} ${q.source?.year || q.exam_year || ''}`.trim(),
        addedAt: new Date().toISOString()
      });

      // 4. Update the table
      const { error: updateError } = await supabase
        .from('user_notes')
        .update({ items: newItems, updated_at: new Date().toISOString() })
        .eq('id', prefs.notebookId);

      if (updateError) throw updateError;

      Alert.alert("Saved", "Quickly added to your last notebook.");
    } catch (err) {
      console.error("Quick save failed details:", err);
      Alert.alert("Error", "Failed to save to notebook. Please try opening the Notebook manually once to reset preferences.");
    }
  };

  // Flashcard handler is now provided by useFlashcardAction hook

  // Secondary navigation: jump to the original source (test / book / paper)
  // that contained this question.  Loads the full source set with the tapped
  // question pre-selected.  Skips no-op when we are already in that source.
  const handleViewSource = (q: Question) => {
    if (!q?.test_id) {
      Alert.alert('No source available', 'This question has no original source attached.');
      return;
    }
    if (params.testId === q.test_id) {
      // Already viewing in source context — just jump to that question.
      const idx = questions.findIndex(item => item.id === q.id);
      if (idx >= 0) {
        setCurrentIndex(idx);
        setShowIndex(false);
      }
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    isNavigatingAway.current = true;
    router.push({
      pathname: '/unified/engine',
      params: {
        testId: q.test_id,
        questionId: q.id,
        mode: 'learning',
        view: 'list',
      },
    } as any);
  };

  const runAfterPaperOverlayClose = (
    callback: () => void,
    opts?: { closeExplanation?: boolean; delayMs?: number }
  ) => {
    if (opts?.closeExplanation) {
      setExplanationModalQId(null);
    }

    setShowPaperQuickMenu(false);

    const delay = opts?.closeExplanation
      ? (opts?.delayMs ?? 280)
      : (opts?.delayMs ?? 0);

    requestAnimationFrame(() => {
      setTimeout(callback, delay);
    });
  };

  const openNotebookFromQuestion = (
    q: Question,
    explanationText?: string,
    optsOrMode?: { closeExplanation?: boolean } | string
  ) => {
    const closeOpts = typeof optsOrMode === 'object' ? optsOrMode : undefined;

    runAfterPaperOverlayClose(() => {
      // Ensure we always have content: prefer passed explanation, fallback to question's explanation, then use question text
      const activeText = (explanationText && explanationText.trim()) 
        ? explanationText 
        : (q.explanation_markdown || `**Question:** ${q.question_text || 'Question'}`);
      setPilotSaveTargetQuestion(q);
      setPilotSaveHtml(markdownToHtml(activeText));
      setPilotV2SaveOpen(true);
    }, closeOpts);
  };

  const openHardnoteFromQuestion = (
    q: Question,
    explanationText?: string,
    opts?: { closeExplanation?: boolean }
  ) => {
    runAfterPaperOverlayClose(() => {
      const activeText = explanationText || q.explanation_markdown || '';
      setHardnotesPayload({ markdown: activeText, title: q.micro_topic || q.question_text?.slice(0, 40) || 'Quiz Note' });
      setHardnotesPickerVisible(true);
    }, opts);
  };

  // Paper mode helper: close transient overlays first, then execute the same
  // add-to-flashcard flow used by list/card modes.
  const handlePaperAddToFlashcards = (q: Question, opts?: { closeExplanation?: boolean }) => {
    runAfterPaperOverlayClose(() => {
      handleAddToFlashcards(q);
    }, opts);
  };





  const handleCommitToMemory = async (qId: string) => {
    store.syncAnswer(qId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Success", "Note saved successfully.");
    if (currentIndex < questions.length - 1) {
       setCurrentIndex(currentIndex + 1);
       setRevealedExplanations({});
    } else {
        setShowExitModal(true);
    }
  };

  const handleSavePersonalNote = async (qId: string, html: string) => {
    store.setMetadata(qId, { note: html }, true); // Issue 54: persist notes across mode switches
    store.syncAnswer(qId);
    setEditNoteQId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Auto-switch to the "My Note" tab after saving
    const explanations = buildCanonicalExplanations(questions.find(qq => qq.id === qId));
    setActiveExplIndex(prev => ({ ...prev, [qId]: explanations.length })); // Index of the newly added "My Note"
  };

  const handleCloneToNote = (qId: string, text: string) => {
    setNoteEditorText(text);
    setEditNoteQId(qId);
  };

  const handleAiRefineNote = async () => {
    if (!noteEditorText.trim()) return;
    setIsAiRefiningNote(true);
    try {
      const refined = await aiTransformNoteContent(
        noteEditorText.replace(/<[^>]+>/g, ''), 
        "Refine this UPSC study note to be more concise, add mnemonics if possible, and ensure it's easy to memorize."
      );
      setNoteEditorText(refined);
    } catch (e: any) {
      Alert.alert("AI Refinement Failed", e.message);
    } finally {
      setIsAiRefiningNote(false);
    }
  };

  const buildAttemptQuestions = () => {
    return questions.map(q => {
      const answerData = store.answers[q.id] || {};
      const selected = answerData.selectedAnswer;
      return {
        question_id: q.id,
        selected_answer: selected || null,
        confidence: answerData.confidence || null,
        difficulty_level: answerData.difficulty || null,
        error_category: answerData.errorCategory || null,
        review_tags: answerData.studyTags || [],
        time_spent_seconds: answerData.timeSpentSeconds || 0,
        is_correct: selected ? selected === q.correct_answer : false,
      };
    });
  };

  const getSessionDurationSeconds = () => {
    // Always use wall-clock elapsed time as primary source — state ticks can lag or be 0
    const wallClockElapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    if (timerType === 'countdown') {
      // For countdown: cap at original duration
      const maxDuration = questions.length * 120;
      return Math.min(wallClockElapsed, maxDuration);
    }
    // Stopwatch or no-timer: use wall clock, fall back to seconds state
    return wallClockElapsed > 0 ? wallClockElapsed : (seconds || 1);
  };

  const handleFinalSubmit = async () => {
    setShowExitModal(false);
    if (submitting) return;
    setSubmitting(true);
    
    // Auto-save test attempt for Quiz Mode
    if (session?.user?.id && sessionTestId) {
       try {
         // 1. Prepare Version 2 attempt_payload
         const attemptQuestions = buildAttemptQuestions();
         const attempted = attemptQuestions.filter(row => row.selected_answer !== null).length;
         const skipped = questions.length - attempted;
         const correct = attemptQuestions.filter(row => row.is_correct).length;
         const durationSec = getSessionDurationSeconds();
         
         const attempt_payload = {
           version: 2,
           test_id: sessionTestId,
           title: customTestName || 'Practice Session',
           total_questions: questions.length,
           attempted,
           skipped,
           score: correct,
           duration_seconds: durationSec,
           questions: questions.map(q => {
             const answerData = store.answers[q.id] || {};
             return {
               question_id: q.id,
               selected_answer: answerData.selectedAnswer || null,
               correct_answer: q.correct_answer,
               is_correct: answerData.selectedAnswer === q.correct_answer,
               time_spent_seconds: answerData.timeSpentSeconds || 0,
               subject: q.subject || null,
               micro_topic: q.micro_topic || null,
               is_pyq: !!q.is_pyq,
               confidence: answerData.confidence || null,
               error_category: answerData.errorCategory || null,
               review_tags: answerData.studyTags || [],
             };
           }),
         };

         // 2. Synchronous submission to get the real attemptId
         const attemptId = await StudentSync.submitAttemptNow({
           userId: session.user.id,
           testId: sessionTestId,
           attempt: { 
             score: correct,
             attempt_payload, 
             started_at: new Date(sessionStartRef.current).toISOString(),
             submitted_at: new Date().toISOString(),
           }
         });

         // 3. Per-question question_state writes (with real attemptId)
         questions.forEach(q => {
           const answerData = store.answers[q.id] || {};
           StudentSync.enqueue('question_state', {
             userId: session.user.id,
             questionId: q.id,
             testId: sessionTestId,
             attemptId: attemptId,
             patch: {
               selected_answer: answerData.selectedAnswer || null,
               time_spent_seconds: answerData.timeSpentSeconds || 0,
               confidence: answerData.confidence || null,
               review_tags: answerData.studyTags || [],
               error_category: answerData.errorCategory || null,
               status: answerData.selectedAnswer === q.correct_answer ? 'Correct' : 'Incorrect',
             },
           });
         });

         // Clear persistence
         await AsyncStorage.removeItem(INDEX_PERSIST_KEY);

         setSummary({
           totalQuestions: questions.length,
           attempted,
           skipped,
           durationSec,
           attemptId: attemptId
         });
       } catch (err) {
         console.error('Final submit error:', err);
         Alert.alert("Error", "Failed to submit attempt.");
       } finally {
         setSubmitting(false);
       }
    } else {
      isNavigatingAway.current = true;
      router.replace('/analyse');
    }
  };

  const handleDiscard = () => {
    setShowExitModal(false);
    isNavigatingAway.current = true;
    router.back();
  };

  const handleCreateTag = async () => {
    if (!newTagText.trim()) return;
    if (userStudyTags.includes(newTagText.trim())) {
      setIsAddingTag(false);
      setNewTagText('');
      return;
    }
    const newTag = newTagText.trim();
    const updated = [...userStudyTags, newTag];
    setUserStudyTags(updated);
    setIsAddingTag(false);
    setNewTagText('');

    // Persist the updated catalog to AsyncStorage (shared with Tags tab and Light Engine)
    if (session?.user?.id) {
      try {
        await supabase.rpc('add_user_tag', { p_tag: newTag }).then(({ error }) => {
          if (error) console.warn('[tags] add_user_tag RPC failed', error.message);
        });
        const catalogKey = `review_tag_catalog_${session.user.id}`;
        const existing = await AsyncStorage.getItem(catalogKey);
        const parsed: string[] = existing ? JSON.parse(existing) : [];
        const newList = Array.from(new Set([...parsed, newTag]));
        await AsyncStorage.setItem(catalogKey, JSON.stringify(newList));
      } catch {}
      // Notify Tags tab to refresh
      useTagStore.getState().bump({ type: 'add', tag: newTag, at: Date.now() });
    }
  };

  const handleStartCountdown = (customMins?: string) => {
    const mins = customMins || customTimeInput;
    router.setParams({ timer: 'countdown' });
    if (mins && !isNaN(parseInt(mins))) {
      setSeconds(parseInt(mins) * 60);
    } else if (questions.length > 0) {
      setSeconds(questions.length * 120); 
    }
    setIsTimerActive(true);
    setShowTimerPicker(false);
    Keyboard.dismiss();
  };

  const handleExit = () => {
    // Back button — If learn mode and NOT already on the Arena Index, show it first.
    // This way the user sees the question grid before being thrown out of the engine.
    if (arenaMode === 'exam') {
      setShowSaveSessionModal(true);
      return;
    }

    if (arenaMode === 'learning' && !showIndex && !isPaperMode) {
      setShowIndex(true);
      setShowIndexPanel(false);
      return;
    }

    if (!hasUnsavedLearningProgress) {
      isNavigatingAway.current = true;
      router.back();
      return;
    }

    Alert.alert(
      'Exit Learn Session?',
      'You have unsaved progress. What would you like to do?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {},
        },
        {
          text: 'Exit without saving',
          style: 'destructive',
          onPress: () => {
            clearStoredAnswers();
            setRevealedExplanations({});
            isNavigatingAway.current = true;
            router.back();
          },
        },
        {
          text: 'Save & Exit',
          onPress: async () => {
            await handleSaveAndExit();
          },
        },
      ],
      { cancelable: false }
    );
  };

  const commitManualSave = async (customName: string) => {
    if (isSavingAttempt) return;
    setIsSavingAttempt(true);
    
    try {
      questions.forEach(q => store.syncAnswer(q.id));
      const submissionTime = new Date().toISOString();
      const testId = params.testId || (questions[0]?.test_id) || `unified_${Date.now()}`;
      
      // Build V2 payload (same as handleFinalSubmit)
      const attemptQuestions = buildAttemptQuestions();
      const attempted = attemptQuestions.filter(row => row.selected_answer !== null).length;
      const skipped = questions.length - attempted;
      const correct = attemptQuestions.filter(row => row.is_correct).length;
      const durationSec = getSessionDurationSeconds();

      // Ensure test row exists for custom IDs
      if (testId && testId.startsWith('unified_')) {
        await supabase.from('tests').upsert({
          id: testId,
          title: customName || params.subject || 'Unified Arena Test',
          provider: 'Unified Arena'
        }, { onConflict: 'id' });
      }

      // Use StudentSync for a real UUID (same as exam submit)
      const newAttemptId = uuidv4();
      const attemptId = await StudentSync.submitAttemptNow({
        userId: session!.user.id,
        testId: testId,
        attempt: {
          id: newAttemptId,
          score: correct,
          attempt_payload: {
            version: 2,
            test_id: testId,
            title: customName || 'Arena Attempt',
            total_questions: questions.length,
            attempted,
            skipped,
            score: correct,
            duration_seconds: durationSec,
            questions: attemptQuestions,
          },
          started_at: new Date(sessionStartRef.current).toISOString(),
          submitted_at: submissionTime,
        } as any
      });

      // Per-question state sync (with real attemptId)
      questions.forEach(q => {
        const answerData = store.answers[q.id] || {};
        StudentSync.enqueue('question_state', {
          userId: session!.user.id,
          questionId: q.id,
          testId: testId,
          attemptId: attemptId,
          patch: {
            selected_answer: answerData.selectedAnswer || null,
            time_spent_seconds: answerData.timeSpentSeconds || 0,
            confidence: answerData.confidence || null,
            review_tags: answerData.studyTags || [],
            error_category: answerData.errorCategory || null,
            status: answerData.selectedAnswer === q.correct_answer ? 'Correct' : 'Incorrect',
          },
        });
      });

      setIsTimerActive(false);
      setShowSaveSessionModal(false);
      setShowSaveNameModal(false);
      setCustomTestName('');
      
      // Clear persisted index
      await AsyncStorage.removeItem(INDEX_PERSIST_KEY);
      
      // Show summary modal (same as exam submit) — navigation happens from the modal
      setSummary({
        totalQuestions: questions.length,
        attempted,
        skipped,
        durationSec,
        attemptId: attemptId
      });

      // 🐛 FIX: Complete the pending exit navigation that was blocked by usePreventRemove
      // The SaveNameModal / SaveSessionModal was triggered by usePreventRemove's Save & Exit.
      // After saving, tell the guard we've navigated away and dispatch the pending action.
      if (pendingNavActionRef.current) {
        isNavigatingAway.current = true;
        navigation.dispatch(pendingNavActionRef.current);
        pendingNavActionRef.current = null;
      }
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert("Error", "Failed to save session.");
    } finally {
      setIsSavingAttempt(false);
    }
  };

  const handleSaveAndExit = async () => {
    const fallbackName = arenaMode === 'learning'
      ? `Learn Session - ${new Date().toLocaleDateString()}`
      : 'Exam Session';
    await commitManualSave(sessionName || fallbackName);
    await AsyncStorage.removeItem(INDEX_PERSIST_KEY);
    router.back();
  };

  // --- Renderers ---

  const renderQuestionIndex = () => {
    const pageSize = questions.length <= 1000 ? questions.length : 100;
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const pageQuestions = questions.slice(start, end);
    const totalPages = Math.ceil(questions.length / pageSize);
    // Tablet / iPad (>= 768 logical px) shows the full 40-word snippet.
    // Phones keep the compact 2-line truncation.
    const isWideIndex = width >= 768;

    return (
      <View style={{ flex: 1, backgroundColor: zenBg }}>
        <View style={[styles.indexHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.indexTitle, { color: colors.textPrimary }]}>Question Index</Text>
          <Text style={[styles.indexSubtitle, { color: colors.textTertiary }]}>{questions.length} Questions Targeted</Text>
        </View>

        <FlatList
          data={pageQuestions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          renderItem={({ item, index }) => {
            const actualIndex = start + index;
            const cleanText = (item.statement_line || item.question_text || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            const words = cleanText ? cleanText.split(' ') : [];
            const snippet = words.slice(0, 40).join(' ') + (words.length > 40 ? '...' : '');
            const isAnswered = !!store.answers[item.id];
            
            return (
              <TouchableOpacity
                onPress={() => {
                  setCurrentIndex(actualIndex);
                  setShowIndex(false);
                  // Switch to Card mode so the selected question opens directly
                  // without FlatList scroll-position issues. The user can still
                  // switch back to List mode via the view toggle.
                  if (viewMode === 'list') setViewMode('card');
                }}
                style={[styles.indexItem, { backgroundColor: colors.surface, borderColor: colors.border }, isAnswered && { borderColor: colors.primary + '40' }]}
              >
                <View style={[styles.indexNum, { backgroundColor: isAnswered ? colors.primary : colors.surfaceStrong }]}>
                  <Text style={{ color: isAnswered ? colors.buttonText : colors.textSecondary, fontWeight: '900', fontSize: 12 }}>{actualIndex + 1}</Text>
                </View>
                
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text
                    style={[styles.indexSnippet, { color: colors.textPrimary }]}
                    numberOfLines={isWideIndex ? undefined : 2}
                  >{snippet}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                    {(() => {
                      if (!showPYQTags) return null;
                      const pyq = getPYQCategorization(item);
                      if (!pyq.hasPYQData) return null;
                      return (
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {pyq.isUPSC && (
                            <View style={[styles.inlineBadge, { backgroundColor: '#dcfce7', borderColor: '#22c55e' }]}>
                              <Text style={{ color: '#15803d', fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                            </View>
                          )}
                          {pyq.isAllied && (
                            <View style={[styles.inlineBadge, { backgroundColor: '#fef9c3', borderColor: '#eab308' }]}>
                              <Text style={{ color: '#a16207', fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                            </View>
                          )}
                          {pyq.isOther && (
                            <View style={[styles.inlineBadge, { backgroundColor: '#f1f5f9', borderColor: '#94a3b8' }]}>
                              <Text style={{ color: '#475569', fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                            </View>
                          )}
                          {pyq.isGenericPYQ && (
                             <View style={[styles.inlineBadge, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                               <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 9 }}>{`${pyq.groupName} ${pyq.year}`.trim()}</Text>
                             </View>
                          )}
                        </View>
                      );
                    })()}
                    {item.is_ncert && (
                      <View style={[styles.inlineBadge, { backgroundColor: '#e0f2fe', borderColor: '#0ea5e9' }]}>
                        <Text style={{ color: '#0369a1', fontWeight: '900', fontSize: 9 }}>NCERT</Text>
                      </View>
                    )}
                  </View>
                </View>
                <ChevronRight size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            );
          }}
        />

        {totalPages > 1 && (
          <View style={[styles.pagination, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
            <TouchableOpacity 
              disabled={currentPage === 0} 
              onPress={() => setCurrentPage(p => p - 1)}
              style={[styles.pageBtn, currentPage === 0 && { opacity: 0.3 }]}
            >
              <ArrowLeft size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            
            <Text style={{ color: colors.textPrimary, fontWeight: '900' }}>Page {currentPage + 1} of {totalPages}</Text>

            <TouchableOpacity 
              disabled={currentPage >= totalPages - 1} 
              onPress={() => setCurrentPage(p => p + 1)}
              style={[styles.pageBtn, currentPage >= totalPages - 1 && { opacity: 0.3 }]}
            >
              <ArrowRight size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: Platform.OS === 'ios' ? 32 : 16, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
           <TouchableOpacity 
             style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
             onPress={() => {
               setArenaMode('learning');
               setShowIndex(false);
             }}
           >
             <BookOpen size={18} color={colors.primary} />
             <Text style={{ color: colors.primary, fontWeight: '900' }}>LEARN MODE</Text>
           </TouchableOpacity>

           <TouchableOpacity 
             style={{ flex: 1, height: 50, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
             onPress={() => {
               setArenaMode('exam');
               setShowIndex(false);
               setViewMode('card'); 
             }}
           >
             <Target size={18} color="#fff" />
             <Text style={{ color: '#fff', fontWeight: '900' }}>EXAM MODE</Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderQuestionBlock = ({ item, index }: { item: Question, index: number }) => {
    if (!item) return null;
    const answerData = currentAnswers[item.id] || { selectedAnswer: null, confidence: null, difficulty: null, errorCategory: null, note: '' };
    const showExplanation = arenaMode === 'learning' && revealedExplanations[item.id];

    return (
      <SharedQuestionCard
        item={item}
        index={index}
        answerData={answerData}
        isRevealed={showExplanation}
        arenaMode={arenaMode}
        isZenMode={isZenMode}
        colors={colors}
        activeExplSource={activeExplSource[item.id]}
        onExplSourceChange={(src: string) => setActiveExplSource(prev => ({ ...prev, [item.id]: src }))}
        aiExplanation={aiExplanations[item.id]}
        isAiLoading={aiLoading[item.id]}
        isSavingFlashcard={savingFlashcard[item.id]}
        isFlashcarded={flashcardedIds.has(item.id)}
        onEditVitamin={handleEditVitamin}
        onRevealExplanation={() => setRevealedExplanations(prev => ({ ...prev, [item.id]: true }))}
        onOptionSelect={handleOptionSelect}
        onAddFlashcard={handleAddToFlashcards}
        onAiExplain={handleAiExplain}
        onAiChat={handleAiChat}
        onViewSource={handleViewSource}
        onToggleReview={(qid: string) => store.setMetadata(qid, { isReview: !answerData.isReview }, true)}
        userStudyTags={userStudyTags}
        toggleStudyTag={toggleStudyTag}
        toggleGuess={toggleGuess}
        toggleDifficulty={toggleDifficulty}
        showMistakes={arenaMode !== 'exam'}
        toggleMistakeType={toggleMistakeType}
        activeExplIndex={activeExplIndex}
        setActiveExplIndex={setActiveExplIndex}
        bestAnswers={bestAnswers}
        ensureBestAnswerLoaded={ensureBestAnswerLoaded}
        handleSaveBest={handleSaveBest}
        handleOpenModify={handleOpenModify}
        handleDeleteBest={handleDeleteBest}
        handleImproveSubmit={handleImproveSubmit}
        modifyOpen={modifyOpen}
        setModifyOpen={setModifyOpen}
        modifyText={modifyText}
        setModifyText={setModifyText}
        improving={improving}
        improvePromptOpen={improvePromptOpen}
        setImprovePromptOpen={setImprovePromptOpen}
        improvePromptText={improvePromptText}
        setImprovePromptText={setImprovePromptText}
        savingBest={savingBest}
        aiSummaries={aiSummaries}
        aiSumLoading={aiSumLoading}
        handleAiSummarize={handleAiSummarize}
        openNotebookFromQuestion={openNotebookFromQuestion}
        openHardnoteFromQuestion={openHardnoteFromQuestion}
        savedFlash={savedFlash}
        fontSize={fontSize}
        mdStyles={mdStyles}
        mdRules={mdRules}
        onCreateTag={() => setIsAddingTag(true)}
        onNoteDraft={(qid: string, text: string) => {
          setEditNoteQId(qid);
          setNoteEditorText(text);
        }}
        onNoteChange={(qid: string, noteText: string) => {
          store.setMetadata(qid, { note: noteText });
        }}
        onQuickSave={(qid: string) => {
          store.setMetadata(qid, {}, true);
        }}
        onCommitToMemory={(qid: string) => {
          store.setMetadata(qid, {}, true);
        }}
      />
    );
  };

  // ============================================================
  // SIMULATED EXAM MODE — "PAPER" VIEW
  // 6 questions per page on tablets in a 2-column grid (printed-paper feel).
  // Falls back to 1 column on phones (< 768 logical px).
  // Tap on the explanation pill opens a centered modal (see render below).
  // ============================================================
  const isPaperWide = width >= 768; // iPad / large screen → 2 columns
  const totalPaperPages = Math.max(1, Math.ceil(questions.length / paperPageSize));

  const renderPaperQuestion = (item: Question, globalIdx: number) => {
    if (!item) return null;
    const answerData = currentAnswers[item.id] || { selectedAnswer: null, confidence: null, difficulty: null, errorCategory: null, note: '' };
    return (
      <View
        key={`paper-q-${item.id}`}
        style={[
          stylesPaper.qCard,
          {
            backgroundColor: isZenMode ? 'transparent' : colors.surface,
            borderColor: isZenMode ? 'rgba(67,52,34,0.15)' : colors.border,
          },
        ]}
        testID={`paper-question-${globalIdx}`}
      >
        {/* Q number badge + per-question icons row */}
        <View style={stylesPaper.qHeaderRow}>
          <View style={[stylesPaper.qNum, { backgroundColor: isZenMode ? '#433422' : colors.primary }]}>
            <Text style={{ color: isZenMode ? '#F4ECD8' : colors.buttonText, fontWeight: '900', fontSize: 12 }}>
              {globalIdx + 1}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              onPress={() => store.setMetadata(item.id, { isReview: !answerData.isReview }, true)}
              testID={`paper-review-${item.id}`}
            >
              <Flag size={16} color={answerData.isReview ? '#eab308' : colors.textTertiary} fill={answerData.isReview ? '#eab308' : 'transparent'} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handlePaperAddToFlashcards(item)}
              disabled={savingFlashcard[item.id]}
              testID={`paper-flashcard-${item.id}`}
            >
              {savingFlashcard[item.id] ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Zap size={16} color={flashcardedIds.has(item.id) ? colors.primary : colors.textTertiary} fill={flashcardedIds.has(item.id) ? colors.primary : 'transparent'} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                openNotebookFromQuestion(
                  item,
                  item.explanation_markdown || ''
                )
              }
              testID={`paper-pilot-save-${item.id}`}
            >
              <Rocket size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Question stem */}
        <Markdown style={mdStylesZen} rules={mdRulesZen}>
          {item.statement_line || item.question_text}
        </Markdown>

        {/* Options — compact */}
        <View style={{ marginTop: 8 }}>
          {Object.entries(item.options || {}).map(([label, text]) => {
            const isSelected = answerData.selectedAnswer === label;
            const isCorrect = label.toLowerCase() === item.correct_answer?.toLowerCase();
            const isWrong = isSelected && !isCorrect;
            return (
              <OptionButton
                key={label}
                label={label}
                text={text}
                isSelected={isSelected}
                isCorrect={isCorrect}
                isWrong={isWrong}
                showResult={arenaMode === 'learning' && !!answerData.selectedAnswer}
                onSelect={() => handleOptionSelect(item.id, label)}
                disabled={false}
                fontSize={fontSize}
              />
            );
          })}
        </View>

        {/* Inline chips: Confidence (Guess), Difficulty, Study Tags, Mistake type */}
        <View style={{ marginTop: 10, gap: 6 }}>
          {/* Confidence */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5, marginRight: 4 }}>GUESS</Text>
            {CONFIDENCE_LEVELS.map(level => (
              <TouchableOpacity
                key={level.value}
                onPress={() => toggleGuess(item.id, answerData.selectedAnswer, level.value)}
                style={[stylesPaper.miniChip, { borderColor: colors.border, backgroundColor: colors.bg }, answerData.confidence === level.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: answerData.confidence === level.value ? colors.buttonText : colors.textSecondary }}>{level.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Difficulty */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5, marginRight: 4 }}>DIFFICULTY</Text>
            {DIFFICULTIES.map(diff => (
              <TouchableOpacity
                key={diff.value}
                onPress={() => toggleDifficulty(item.id, diff.value)}
                style={[stylesPaper.miniChip, { borderColor: colors.border }, answerData.difficulty === diff.value && { backgroundColor: diff.color + '20', borderColor: diff.color }]}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: answerData.difficulty === diff.value ? diff.color : colors.textSecondary }}>{diff.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/* Study Tags (Revision tags) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: colors.textTertiary, letterSpacing: 0.5, marginRight: 4 }}>TAGS</Text>
            {[...userStudyTags].slice(0, 6).map(tag => {
              const selected = (answerData.studyTags || []).includes(tag);
              return (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleStudyTag(item.id, answerData.studyTags || [], tag)}
                  style={[stylesPaper.miniChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, selected && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                >
                  <Text style={{ fontSize: 10, fontWeight: '700', color: selected ? colors.primary : colors.textSecondary }}>{tag}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              onPress={() => setIsAddingTag(true)}
              style={[stylesPaper.miniChip, { borderColor: colors.primary + '40', backgroundColor: colors.primary + '10', paddingHorizontal: 8 }]}
              testID="create-tag-inline-btn"
            >
              <Plus size={10} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Show Explanation pill — opens centered modal */}
        {arenaMode === 'learning' && (
          <TouchableOpacity
            style={[stylesPaper.explBtn, { borderColor: colors.primary }]}
            onPress={() => {
              setExplanationModalQId(item.id);
              setRevealedExplanations(prev => ({ ...prev, [item.id]: true }));
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            }}
            testID={`paper-explanation-btn-${item.id}`}
          >
            <Lightbulb size={14} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>Explanation</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderPaperPage = () => {
    const startIdx = paperPage * paperPageSize;
    const pageQuestions = questions.slice(startIdx, startIdx + paperPageSize);
    if (pageQuestions.length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: colors.textTertiary }}>No questions on this page.</Text>
        </View>
      );
    }
    // Build columns for 2-column grid; on narrow screens, single column.
    const columns: Question[][] = isPaperWide ? [[], []] : [[]];
    pageQuestions.forEach((q, i) => {
      const colIdx = isPaperWide ? i % 2 : 0;
      columns[colIdx].push(q);
    });

    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: isPaperWide ? 22 : 12,
            paddingTop: isPaperWide ? 2 : 0,
            paddingBottom: 110,
          }}
          testID="paper-scroll"
        >
          <View style={{ flexDirection: 'row', gap: isPaperWide ? 28 : 0 }}>
            {columns.map((col, colIdx) => (
              <View key={`col-${colIdx}`} style={{ flex: 1, gap: isPaperWide ? 20 : 14 }}>
                {col.map((q) => {
                  const globalIdx = questions.findIndex(qq => qq.id === q.id);
                  return renderPaperQuestion(q, globalIdx);
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Floating pagination: hidden by default, toggle from bottom-right */}
        <View pointerEvents="box-none" style={stylesPaper.paginationDock}>
          {showPaperPagination && (
            <View style={[stylesPaper.paginationPopup, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <View style={stylesPaper.paginationTopRow}>
                <TouchableOpacity
                  onPress={() => setPaperPage(p => Math.max(0, p - 1))}
                  disabled={paperPage === 0}
                  style={[stylesPaper.pagerBtn, { backgroundColor: colors.surfaceStrong, opacity: paperPage === 0 ? 0.4 : 1 }]}
                  testID="paper-prev"
                >
                  <ArrowLeft size={16} color={colors.textPrimary} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Prev</Text>
                </TouchableOpacity>

                <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 11 }}>
                  Page {paperPage + 1} / {totalPaperPages}
                </Text>

                <TouchableOpacity
                  onPress={() => setPaperPage(p => Math.min(totalPaperPages - 1, p + 1))}
                  disabled={paperPage >= totalPaperPages - 1}
                  style={[stylesPaper.pagerBtn, { backgroundColor: colors.primary, opacity: paperPage >= totalPaperPages - 1 ? 0.4 : 1 }]}
                  testID="paper-next"
                >
                  <Text style={{ color: colors.buttonText, fontWeight: '800', fontSize: 12 }}>Next</Text>
                  <ArrowRight size={16} color={colors.buttonText} />
                </TouchableOpacity>
              </View>

              {/* Horizontal scrolling for large page counts (50+, etc.) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator
                style={stylesPaper.paginationScroller}
                contentContainerStyle={stylesPaper.paginationScrollerContent}
              >
                {Array.from({ length: totalPaperPages }).map((_, p) => (
                  <TouchableOpacity
                    key={`pgnum-${p}`}
                    onPress={() => setPaperPage(p)}
                    style={[stylesPaper.pageDot, p === paperPage && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    testID={`paper-page-${p}`}
                  >
                    <Text style={{ color: p === paperPage ? colors.buttonText : colors.textSecondary, fontWeight: '900', fontSize: 11 }}>{p + 1}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setShowPaperPagination(v => !v)}
            style={[stylesPaper.paginationToggle, { backgroundColor: colors.primary }]}
            testID="paper-pagination-toggle"
          >
            <Layout size={16} color={colors.buttonText} />
            <Text style={{ color: colors.buttonText, fontWeight: '900', fontSize: 11 }}>
              {showPaperPagination ? 'Hide Pages' : `Pages ${paperPage + 1}/${totalPaperPages}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };


  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: zenBg }]}>
        <StatusBar hidden={isZenMode || isPaperMode} barStyle={isZenMode ? 'dark-content' : 'default'} />
        {isZenMode && (
          <TouchableOpacity 
            style={styles.floatingZenExit} 
            onPress={() => setIsZenMode(false)}
            activeOpacity={0.7}
          >
            <Minimize2 size={24} color="#433422" />
          </TouchableOpacity>
        )}
        {!isPaperMode && (
        <Animated.View style={[
          styles.header, 
          { 
            borderBottomColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border,
            transform: [{ translateY: headerTranslateY }],
            position: 'absolute',
            top: 0, left: 0, right: 0,
            zIndex: 100,
            backgroundColor: isZenMode ? '#F4ECD8' : colors.surface
          }
        ]}>
          <TouchableOpacity
            onPress={handleExit}
            style={styles.headerBtn}
            testID="engine-top-left-nav-btn"
          >
            <ChevronLeft size={24} color={isZenMode ? '#433422' : colors.textPrimary} />
          </TouchableOpacity>

          {/* Search panel button — grouped with the back button for navigation clarity */}
          {isFromSearch && (
            <TouchableOpacity
              onPress={() => setShowSearchPanel(true)}
              testID="engine-search-panel-btn"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 5,
                backgroundColor: colors.primary + '15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
              }}
            >
              <ListIcon size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>
                {currentIndex + 1}/{questions.length}
              </Text>
            </TouchableOpacity>
          )}

          {/* FIX #16: Removed duplicate Arena Index button (already in left button state) */}

          <View style={styles.headerTitleContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {!isFromSearch && (
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  {showIndex ? 'Arena Index' : `Q${currentIndex + 1}/${questions.length}`}
                </Text>
              )}

              <TouchableOpacity 
                onPress={() => setShowSaveNameModal(true)}
                style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 6, 
                  backgroundColor: colors.primary + '15',
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: 12,
                  marginLeft: 8
                }}
              >
                <Save size={14} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 11 }}>SAVE</Text>
              </TouchableOpacity>
              
            </View>
          </View>



          <View style={styles.headerActions}>
            {isTablet && (
              <TouchableOpacity onPress={toggleZenMode} style={styles.headerBtn}>
                <Sparkles size={20} color={isZenMode ? '#433422' : colors.primary} />
              </TouchableOpacity>
            )}
            {/* FIX #11: Exam Simulation Mode button — opens paper view with 6 q/page, 2-col layout */}
            {isTablet && (
              <TouchableOpacity
                onPress={() => {
                  setViewMode('paper');
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                }}
                style={styles.headerBtn}
                testID="engine-exam-sim-btn"
              >
                <BookOpen size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
              </TouchableOpacity>
            )}
            {/* Palette / Navigator — promoted out of the quick menu so it's
                always one tap away (essential during a paper-style exam). */}
            <TouchableOpacity
              onPress={() => setShowNavigator(true)}
              style={styles.headerBtn}
              testID="engine-palette-btn"
            >
              <LayoutGrid size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
            </TouchableOpacity>

            {/* View mode toggle — switches between single-card and scrollable-list view */}
            {!isPaperMode && (
              <View style={{ flexDirection: 'row', gap: 2, backgroundColor: colors.surfaceStrong, borderRadius: 8, padding: 2 }}>
                <TouchableOpacity
                  onPress={() => { if (viewMode !== 'list') { setViewMode('list'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } }}
                  style={[styles.toggleMiniBtn, viewMode === 'list' && { backgroundColor: colors.primary }]}
                  testID="engine-view-list-btn"
                >
                  <ListIcon size={14} color={viewMode === 'list' ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { if (viewMode !== 'card') { setViewMode('card'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); } }}
                  style={[styles.toggleMiniBtn, viewMode === 'card' && { backgroundColor: colors.primary }]}
                  testID="engine-view-card-btn"
                >
                  <Layout size={14} color={viewMode === 'card' ? '#fff' : colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {/* FIX #15: Removed AI Settings button from top bar (moved to Quick Menu) */}
            <TouchableOpacity
              onPress={handleClockButtonPress}
              style={[styles.headerBtn, timerType !== 'none' && { flexDirection: 'row', gap: 4 }]}
              testID="engine-clock-btn"
            >
              <Clock 
                size={timerType === 'none' ? 20 : 16} 
                color={timerType !== 'none' && isTimerActive ? colors.primary : (isZenMode ? '#433422' : (timerType === 'none' ? colors.textPrimary : colors.textTertiary))} 
              />
              {timerType !== 'none' && (
                <Text style={{ color: isZenMode ? '#433422' : colors.textSecondary, fontSize: 10, fontWeight: '800' }}>{formatTime(seconds)}</Text>
              )}
            </TouchableOpacity>
            {!showIndex && (
              <TouchableOpacity onPress={() => setShowIndexPanel(true)} style={styles.headerBtn}>
                <ListIcon size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowQuickMenu(!showQuickMenu)} style={styles.headerBtn}>
              <MoreVertical size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </Animated.View>
        )}

        {/* Floating "Show Header" button when hidden */}
        {headerHidden && !isPaperMode && !showIndex && (
          <TouchableOpacity 
            onPress={() => toggleHeader(false)}
            style={{
              position: 'absolute',
              top: Platform.OS === 'ios' ? 50 : 20,
              right: 20,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              elevation: 5,
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 5,
              shadowOffset: { width: 0, height: 2 }
            }}
          >
            <ChevronDown size={24} color="#fff" />
          </TouchableOpacity>
        )}

        {isPaperMode && (
          <View pointerEvents="box-none" style={stylesPaper.topRightDock}>
            <TouchableOpacity
              onPress={() => setShowPaperQuickMenu(v => !v)}
              style={[stylesPaper.topRightToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
              testID="paper-top-toggle"
            >
              <MoreVertical size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        <Modal
          visible={isPaperMode && showPaperQuickMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPaperQuickMenu(false)}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowPaperQuickMenu(false)}>
            <View style={[stylesPaper.paperQuickMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              {/* Exit Simulation — toggles paper view off and returns to List
                  view inside the same engine session. From there, the regular
                  header Back button (with save/cancel prompt) is reachable. */}
              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={() => {
                  setShowPaperQuickMenu(false);
                  setViewMode('list');
                }}
                testID="paper-quick-exit-sim"
              >
                <Minimize2 size={16} color="#ef4444" />
                <Text style={{ color: '#ef4444', fontWeight: '800', fontSize: 12 }}>Exit Sim</Text>
              </TouchableOpacity>

              {/* Back — always prompts the save/cancel/exit dialog so the user
                  never loses progress accidentally. */}
              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={() => {
                  setShowPaperQuickMenu(false);
                  // Force a confirmation prompt regardless of arena mode by
                  // routing through the same modal used for exam saves when
                  // there is any answered question, otherwise fall back to
                  // the standard exit handler (which itself prompts on
                  // unsaved learning progress).
                  if (arenaMode === 'exam') {
                    setShowSaveSessionModal(true);
                  } else if (hasUnsavedLearningProgress) {
                    handleExit();
                  } else {
                    Alert.alert(
                      'Leave Quiz Engine?',
                      'You are about to exit the current quiz session.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Exit',
                          style: 'destructive',
                          onPress: () => {
                            isNavigatingAway.current = true;
                            router.back();
                          },
                        },
                      ],
                      { cancelable: true }
                    );
                  }
                }}
                testID="paper-quick-back"
              >
                <ChevronLeft size={16} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={() => { setShowPaperQuickMenu(false); handleClockButtonPress(); }}
                testID="paper-quick-clock"
              >
                <Clock size={16} color={timerType !== 'none' && isTimerActive ? colors.primary : colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Clock</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={() => { setShowPaperQuickMenu(false); setShowSaveNameModal(true); }}
              >
                <Save size={16} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={() => { setShowPYQTags(!showPYQTags); setShowPaperQuickMenu(false); }}
              >
                <TagIcon size={16} color={showPYQTags ? colors.primary : colors.textPrimary} />
                <Text style={{ color: showPYQTags ? colors.primary : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>PYQ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={() => { setShowNavigator(true); setShowPaperQuickMenu(false); }}
              >
                <LayoutGrid size={16} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Palette</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={prepareExportPayload}
                testID="paper-quick-export"
              >
                <FileDown size={16} color={colors.textPrimary} />
                <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 12 }}>Export PDF</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={{ color: colors.textTertiary, marginTop: 12 }}>Syncing Arena...</Text>
          </View>
        ) : (
          <>
            {/* Quick Menu Modal */}
            <Modal visible={showQuickMenu} transparent animationType="none" onRequestClose={() => setShowQuickMenu(false)}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowQuickMenu(false)}>
                <View style={[styles.verticalMenu, { backgroundColor: colors.surface, borderColor: colors.border, top: Platform.OS === 'ios' ? 100 : 80 }]}>
                    <TouchableOpacity 
                      style={styles.utilBtn} 
                      onPress={() => { setShowFontSlider(true); setShowQuickMenu(false); }}
                    >
                      <Text style={{ fontWeight: '900', color: colors.textPrimary, fontSize: 16 }}>Aa</Text>
                    </TouchableOpacity>

                    {!isTablet && (
                      <>
                        <TouchableOpacity 
                          style={styles.utilBtn} 
                          onPress={() => { setShowModelSwitcher(true); setShowQuickMenu(false); }}
                        >
                          <Brain size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.utilBtn} 
                          onPress={() => { setDoubtModalVisible(true); setShowQuickMenu(false); }}
                        >
                          <MessageSquare size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.utilBtn} 
                          onPress={() => { toggleZenMode(); setShowQuickMenu(false); }}
                        >
                          <Sparkles size={20} color={isZenMode ? colors.primary : colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={styles.utilBtn} 
                          onPress={() => { 
                            setViewMode(prev => prev === 'card' ? 'list' : 'card');
                            setShowQuickMenu(false); 
                          }}
                        >
                          <BookOpen size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                      </>
                    )}


                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={() => { setShowPYQTags(!showPYQTags); setShowQuickMenu(false); }}
                  >
                    <Text style={{ fontWeight: '900', color: showPYQTags ? colors.primary : colors.textTertiary, fontSize: 10 }}>PYQ</Text>
                  </TouchableOpacity>


                  
                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={prepareExportPayload}
                  >
                    <FileDown size={20} color={colors.textPrimary} />
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: colors.border, width: '100%', marginVertical: 4 }} />
                  
                  <ThemeSwitcher />
                </View>
              </Pressable>
            </Modal>

            {/* Font Slider Modal */}
            <Modal visible={showFontSlider} transparent animationType="fade" onRequestClose={() => setShowFontSlider(false)}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowFontSlider(false)}>
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                  <View style={[styles.fontPanel, { backgroundColor: colors.surface, paddingBottom: Platform.OS === 'ios' ? 40 : 20 }]}>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, textAlign: 'center', marginBottom: 16 }}>ADJUST FONT SIZE</Text>
                    <View style={styles.sliderRow}>
                      {[10, 12, 14, 16, 18, 20, 22, 24, 28].map(s => (
                        <TouchableOpacity key={s} onPress={() => setFontSize(s)} style={[styles.sizeBubble, fontSize === s && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                          <Text style={{ color: fontSize === s ? '#fff' : colors.textPrimary, fontWeight: '800' }}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              </Pressable>
            </Modal>

            <Modal visible={showNavigator} animationType="fade" transparent>
              <View style={[styles.modalOverlay, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '85%' }]}>
                  <View style={styles.modalHeader}>
                    <View>
                      <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Navigator</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>Jump to any question</Text>
                    </View>
                    <TouchableOpacity 
                      onPress={() => setShowNavigator(false)}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                   <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Answered</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Missed</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#f59e0b' }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Review</Text>
                    </View>
                  </View>

                  <ScrollView 
                    contentContainerStyle={[styles.paletteGrid, { paddingBottom: 40 }]}
                    showsVerticalScrollIndicator={true}
                  >
                    {questions.map((q, idx) => {
                      const answerData = store.answers[q.id];
                      const isAnswered = !!answerData?.selectedAnswer;
                      const isReview = !!answerData?.isReview;
                      const isMissed = !isAnswered && !isReview && currentIndex > idx;
                      const isActive = currentIndex === idx;

                      let itemBg = colors.surface;
                      let itemBorder = colors.border;
                      let itemText = colors.textPrimary;

                      if (isAnswered) { itemBg = '#22c55e'; itemBorder = '#22c55e'; itemText = '#fff'; }
                      else if (isReview) { itemBg = '#f59e0b'; itemBorder = '#f59e0b'; itemText = '#fff'; }
                      else if (isMissed) { itemBg = '#ef4444'; itemBorder = '#ef4444'; itemText = '#fff'; }

                      return (
                        <TouchableOpacity
                          key={q.id}
                          onPress={() => {
                            setShowNavigator(false);
                            // Switch to card mode for reliable direct navigation.
                            // FlatList scroll-position issues prevented restoring list mode.
                            setCurrentIndex(idx);
                            if (viewMode === 'paper') {
                              setPaperPage(Math.floor(idx / paperPageSize));
                            } else {
                              setViewMode('card');
                            }
                          }}
                          style={[
                            styles.paletteItem, 
                            { backgroundColor: itemBg, borderColor: itemBorder },
                            isActive && { borderWidth: 3, borderColor: colors.primary }
                          ]}
                        >
                          <Text style={{ color: itemText, fontWeight: '900' }}>{idx + 1}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </Modal>

            {/* ── Search Results Panel ─────────────────────────────────────────
                Slide-in panel (60-70% of screen) showing all searched questions.
                Available only when engine was opened from AI Search (resultIds).    */}
            <Modal
              visible={showSearchPanel && isFromSearch}
              transparent
              animationType="fade"
              onRequestClose={() => setShowSearchPanel(false)}
            >
              <View style={{ flex: 1, flexDirection: 'row' }}>
                {/* Dim overlay on the right — tap to close */}
                <Pressable
                  style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
                  onPress={() => setShowSearchPanel(false)}
                />
                  {/* Panel — takes 75% of screen width for better readability */}
                <View style={{
                  width: Math.min(width * 0.75, 500),
                  backgroundColor: colors.surface,
                  height: '100%',
                  paddingTop: 16,
                  borderLeftWidth: 1,
                  borderLeftColor: colors.border,
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>Search Results</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>{questions.length} questions</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowSearchPanel(false)} style={{ padding: 6 }}>
                      <X size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    ref={searchPanelScrollRef}
                    showsVerticalScrollIndicator={false}
                    onScroll={e => { searchPanelScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                    scrollEventThrottle={100}
                    onLayout={() => {
                      // Restore scroll position after panel renders
                      if (searchPanelScrollOffset.current > 0) {
                        searchPanelScrollRef.current?.scrollTo({ y: searchPanelScrollOffset.current, animated: false });
                      }
                    }}
                  >
                    {questions.map((q, idx) => {
                      const isActive = idx === currentIndex;
                      const ans = store.answers[q.id];
                      const isAnswered = !!ans?.selectedAnswer;
                      return (
                        <TouchableOpacity
                          key={q.id}
                          onPress={() => {
                            setCurrentIndex(idx);
                            setShowSearchPanel(false);
                            if (viewMode === 'list') {
                              // Use scrollToIndexRobust so we don't assume fixed item heights
                              setTimeout(() => requestAnimationFrame(() => scrollToIndexRobust(idx)), 150);
                            }
                          }}
                          style={{
                            paddingHorizontal: 16, paddingVertical: 12,
                            borderBottomWidth: 1, borderBottomColor: colors.border,
                            backgroundColor: isActive ? colors.primary + '12' : 'transparent',
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <View style={{
                              width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                              backgroundColor: isAnswered ? '#22c55e' : (isActive ? colors.primary : colors.surfaceStrong),
                            }}>
                              <Text style={{ fontSize: 10, fontWeight: '900', color: isAnswered || isActive ? '#fff' : colors.textTertiary }}>{idx + 1}</Text>
                            </View>
                            {q.subject && (
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#7c3aed', backgroundColor: '#ede9fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{q.subject}</Text>
                            )}
                          {/* Real exam label — same as search results & card chips */}
                          {(() => {
                            const synthInfo = {
                              group: q.exam_group,
                              year: q.exam_year ?? (q.exam_info?.year),
                              is_upsc_cse: q.is_upsc_cse,
                              is_allied: q.is_allied,
                              is_others: q.is_others,
                            };
                            const pyqCat = getPYQCategorization({ ...q, exam_info: { ...q.exam_info, ...synthInfo } });
                            if (!pyqCat.hasPYQData) return null;
                            const chipColor =
                              pyqCat.isUPSC   ? { bg: '#dbeafe', color: '#1d4ed8' } :
                              pyqCat.isAllied ? { bg: '#dcfce7', color: '#15803d' } :
                              pyqCat.isOther  ? { bg: '#ffedd5', color: '#c2410c' } :
                                               { bg: '#fef3c7', color: '#b45309' };
                            return (
                              <Text style={{
                                fontSize: 9, fontWeight: '800',
                                color: chipColor.color, backgroundColor: chipColor.bg,
                                paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
                              }}>
                                {`${pyqCat.groupName} ${pyqCat.year ?? ''}`.trim()}
                              </Text>
                            );
                          })()}
                          </View>
                          <Text numberOfLines={4} style={{ fontSize: 12, fontWeight: isActive ? '700' : '500', color: isActive ? colors.textPrimary : colors.textSecondary }}>
                            {q.question_text?.replace(/<[^>]*>/g, '')}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <View style={{ height: 40 }} />
                  </ScrollView>
                </View>
              </View>
            </Modal>

            {/* Timer Picker Modal */}
            <Modal visible={showTimerPicker} transparent animationType="fade" onRequestClose={() => setShowTimerPicker(false)}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => Keyboard.dismiss()}>
                <View style={styles.modalOverlay}>
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 12 }]}>Timer Setup</Text>
                      <Text style={{ color: colors.textTertiary, marginBottom: 24, fontSize: 13 }}>Choose how you want to track your time.</Text>
                      
                      <View style={{ gap: 12 }}>
                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                          onPress={() => { 
                            router.setParams({ timer: 'stopwatch' });
                            setIsTimerActive(true);
                            setShowTimerPicker(false);
                          }}
                        >
                           <Clock size={20} color={colors.primary} style={{ marginRight: 12 }} />
                           <View>
                             <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Stopwatch</Text>
                             <Text style={{ fontSize: 11, color: colors.textTertiary }}>Count upwards from zero</Text>
                           </View>
                        </TouchableOpacity>

                        <View 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                        >
                           <Target size={20} color={colors.primary} style={{ marginRight: 12 }} />
                           <View style={{ flex: 1 }}>
                             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Exam Timer</Text>
                                <TextInput 
                                  style={{ width: 80, height: 36, backgroundColor: colors.bg, borderRadius: 8, textAlign: 'center', fontSize: 14, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border }}
                                  placeholder="Mins"
                                  keyboardType="number-pad"
                                  value={customTimeInput}
                                  onChangeText={setCustomTimeInput}
                                  placeholderTextColor={colors.textTertiary}
                                  returnKeyType="done"
                                  onSubmitEditing={(e) => handleStartCountdown(e.nativeEvent.text)}
                                />
                             </View>
                             <Text style={{ fontSize: 11, color: colors.textTertiary }}>{customTimeInput ? `${customTimeInput} mins total` : '2 mins per question (Default)'}</Text>
                           </View>
                        </View>

                        <TouchableOpacity 
                          style={{ flex: 1, height: 50, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
                          onPress={() => handleStartCountdown()}
                        >
                          <Text style={{ color: '#fff', fontWeight: '900' }}>START TIMER</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                          onPress={() => { 
                            router.setParams({ timer: 'none' });
                            setIsTimerActive(false);
                            setShowTimerPicker(false);
                          }}
                        >
                           <XCircle size={20} color={colors.textTertiary} style={{ marginRight: 12 }} />
                           <View>
                             <Text style={{ fontWeight: '800', color: colors.textPrimary }}>No Timer</Text>
                             <Text style={{ fontSize: 11, color: colors.textTertiary }}>Hide all time tracking</Text>
                           </View>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity onPress={() => setShowTimerPicker(false)} style={{ marginTop: 24, alignItems: 'center' }}>
                        <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </KeyboardAvoidingView>
                </View>
              </Pressable>
            </Modal>

            {showIndex ? renderQuestionIndex() : (
              <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
                <View style={{ flex: 1 }}>
              {viewMode === 'paper' ? (
                renderPaperPage()
              ) : viewMode === 'list' ? (
                <FlatList
                  ref={listRef}
                  data={questions}
                  renderItem={renderQuestionBlock}
                  keyExtractor={(item) => item.id}
                  extraData={currentAnswers}
                  // initialScrollIndex only used for first mount from Navigator/Index jump.
                  // DO NOT remove – but we rely on onScrollToIndexFailed to handle
                  // out-of-range gracefully rather than crashing.
                  initialScrollIndex={currentIndex > 0 ? currentIndex : undefined}
                  // NO getItemLayout: questions have variable heights (explanations,
                  // tables, merged blocks). A fixed height causes scroll position
                  // miscalculations that produce the observed jump-back behavior.
                  contentContainerStyle={[styles.listContent, { paddingTop: 80 }]}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  // Generous render window to prevent items unmounting/remounting
                  // during normal reading scroll (which causes flicker & jitter).
                  initialNumToRender={12}
                  maxToRenderPerBatch={8}
                  windowSize={11}
                  // Android: do NOT remove clipped subviews – it causes re-layouts
                  // that trigger scroll position corrections.
                  removeClippedSubviews={false}
                  onScroll={handleScroll}
                  scrollEventThrottle={32}
                  // Natural deceleration – no snapping, no paging.
                  decelerationRate="normal"
                  // Prevent pan responder conflicts that cause the FlatList to
                  // "steal" the scroll position from the user.
                  disableScrollViewPanResponder={false}
                  onScrollToIndexFailed={(info) => {
                    // First fallback: scroll to a computed offset using
                    // averageItemLength so the list at least lands near the
                    // target. This is essential for palette/navigator jumps
                    // in List View, where the target index may be far outside
                    // the currently rendered window.
                    const approxOffset =
                      Math.max(0, info.averageItemLength * info.index);
                    try {
                      listRef.current?.scrollToOffset({
                        offset: approxOffset,
                        animated: false,
                      });
                    } catch {}
                    // Second fallback: after layout settles, retry scrollToIndex
                    // for an exact landing on the question.
                    const wait = new Promise(resolve => setTimeout(resolve, 350));
                    wait.then(() => {
                      try {
                        listRef.current?.scrollToIndex({
                          index: info.index,
                          animated: false,
                          viewPosition: 0,
                        });
                      } catch {
                        // Nothing more we can do – user can scroll manually.
                      }
                    });
                  }}
                />
              ) : (
                <View style={{ flex: 1 }}>
                  <ScrollView 
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    contentContainerStyle={!isPaperMode && { paddingTop: 80 }}
                  >{renderQuestionBlock({ item: questions[currentIndex], index: currentIndex })}</ScrollView>
                  <View style={[styles.cardNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TouchableOpacity onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))} style={[styles.navBtn, { backgroundColor: colors.surfaceStrong }]} disabled={currentIndex === 0}>
                      <ArrowLeft size={20} color={colors.textPrimary} />
                      <Text style={{ color: colors.textPrimary }}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))} style={[styles.navBtn, { backgroundColor: colors.primary }]} disabled={currentIndex === questions.length - 1}>
                      <Text style={{ color: colors.buttonText }}>Next</Text>
                      <ArrowRight size={20} color={colors.buttonText} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              {showZoomIndicator && (
                <View pointerEvents="none" style={{ position: 'absolute', top: 16, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, zIndex: 999 }}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 }}>Aa  {fontSize}px</Text>
                </View>
              )}
                </View>
              </PinchGestureHandler>
              </KeyboardAvoidingView>
            )}
          </>
        )}

        {/* ============================================================
            FIX #5: INDEX SIDE PANEL — Floating 40% width right panel
            Opens without navigation, preserving the current question view.
        ============================================================ */}
        {showIndexPanel && (
          <Modal
            visible={true}
            transparent
            animationType="fade"
            onRequestClose={() => setShowIndexPanel(false)}
          >
            <View style={{ flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.3)' }}>
              {/* Main content (left 60%) — slightly dimmed */}
              <Pressable
                onPress={() => setShowIndexPanel(false)}
                style={{ flex: 1, backgroundColor: 'transparent' }}
              />
              {/* Index panel (right 40%) — card format matches Search Results panel exactly */}
              <View style={{ width: '40%', backgroundColor: colors.surface, borderLeftWidth: 1, borderLeftColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: colors.textPrimary }}>Arena Index</Text>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>{questions.length} questions</Text>
                  </View>
                  <TouchableOpacity onPress={() => setShowIndexPanel(false)} style={{ padding: 6 }}>
                    <X size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  ref={indexPanelScrollRef}
                  style={{ flex: 1 }}
                  scrollEventThrottle={32}
                  onScroll={(e) => { indexPanelScrollOffset.current = e.nativeEvent.contentOffset.y; }}
                  onContentSizeChange={() => {
                    // Restore scroll offset after content renders
                    if (indexPanelScrollOffset.current > 0) {
                      indexPanelScrollRef.current?.scrollTo({ y: indexPanelScrollOffset.current, animated: false });
                    }
                  }}
                >
                  {questions.map((q, idx) => {
                    const isActive = idx === currentIndex;
                    const ans = store.answers[q.id];
                    const isAnswered = !!ans?.selectedAnswer;
                    return (
                      <TouchableOpacity
                        key={q.id}
                        onPress={() => {
                          setShowIndexPanel(false);
                          setCurrentIndex(idx);
                          // Switch to card mode for reliable direct navigation
                          // (same pattern as the palette navigator)
                          if (viewMode === 'list') setViewMode('card');
                        }}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 12,
                          borderBottomWidth: 1, borderBottomColor: colors.border,
                          backgroundColor: isActive ? colors.primary + '12' : 'transparent',
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <View style={{
                            width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
                            backgroundColor: isAnswered ? '#22c55e' : (isActive ? colors.primary : colors.surfaceStrong),
                          }}>
                            <Text style={{ fontSize: 10, fontWeight: '900', color: isAnswered || isActive ? '#fff' : colors.textTertiary }}>{idx + 1}</Text>
                          </View>
                          {q.subject && (
                            <Text style={{ fontSize: 10, fontWeight: '700', color: '#7c3aed', backgroundColor: '#ede9fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{q.subject}</Text>
                          )}
                          {(() => {
                            const synthInfo = {
                              group: q.exam_group,
                              year: q.exam_year ?? (q.exam_info?.year),
                              is_upsc_cse: q.is_upsc_cse,
                              is_allied: q.is_allied,
                              is_others: q.is_others,
                            };
                            const pyqCat = getPYQCategorization({ ...q, exam_info: { ...q.exam_info, ...synthInfo } });
                            if (!pyqCat.hasPYQData) return null;
                            const chipColor =
                              pyqCat.isUPSC   ? { bg: '#dbeafe', color: '#1d4ed8' } :
                              pyqCat.isAllied ? { bg: '#dcfce7', color: '#15803d' } :
                              pyqCat.isOther  ? { bg: '#ffedd5', color: '#c2410c' } :
                                               { bg: '#fef3c7', color: '#b45309' };
                            return (
                              <Text style={{
                                fontSize: 9, fontWeight: '800',
                                color: chipColor.color, backgroundColor: chipColor.bg,
                                paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
                              }}>
                                {`${pyqCat.groupName} ${pyqCat.year ?? ''}`.trim()}
                              </Text>
                            );
                          })()}
                        </View>
                        <Text numberOfLines={4} style={{ fontSize: 12, fontWeight: isActive ? '700' : '500', color: isActive ? colors.textPrimary : colors.textSecondary }}>
                          {q.question_text?.replace(/<[^>]*>/g, '')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                  <View style={{ height: 40 }} />
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

        {/* ============================================================
            SIMULATED EXAM MODE — Centered Explanation Modal
            Opens when student taps "Explanation" in paper view.
            • backdrop blur, • scrollable body, • sticky action bar with
            full-text labels (Notebook, Hardnotes, Flashcard, Save,
            Review, Commit-to-Memory).
        ============================================================ */}
        <Modal
          visible={!!explanationModalQId}
          transparent
          animationType="fade"
          onRequestClose={() => setExplanationModalQId(null)}
        >
          {(() => {
            const q = questions.find(qq => qq.id === explanationModalQId);
            if (!q) return null;
            const ans = currentAnswers[q.id] || { selectedAnswer: null, isReview: false, note: '' };
            // Build the explanation list (same logic as inline)
            const explanations: any[] = buildCanonicalExplanations(q);
            
            // Add "My Note" to the tabs if it exists
            if (ans.note) {
              explanations.push({
                source: 'My Note',
                sourceKey: 'my_note',
                text: ans.note,
                isUserNote: true
              });
            }
            const activeIdx = activeExplIndex[q.id] ?? -1;
            const safeIdx = activeIdx >= 0 && activeIdx < explanations.length ? activeIdx : -1;
            const text = safeIdx === -1
              ? (explanations.length === 0
                  ? 'No explanation available.'
                  : explanations.map(e => `**${e.source}${e.year ? ' · ' + e.year : ''}${e.answer ? ' · Ans: ' + e.answer : ''}**\n\n${e.text || '*No explanation provided.*'}`).join('\n\n---\n\n'))
              : (explanations[safeIdx]?.text || 'No explanation provided.');

            return (
              <View
                style={[stylesPaper.modalBackdrop, Platform.OS !== 'android' && ({ backdropFilter: 'blur(8px)' } as any)]}
                testID="paper-explanation-modal"
              >
                <Pressable
                  style={StyleSheet.absoluteFill}
                  onPress={() => setExplanationModalQId(null)}
                />
                <View
                  style={[stylesPaper.modalCard, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                >
                  {/* Header */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1.5 }}>EXPLANATION</Text>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginTop: 2 }} numberOfLines={1}>
                        Q{questions.findIndex(qq => qq.id === q.id) + 1} · Correct: {String(q.correct_answer || '').toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setExplanationModalQId(null)}
                      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                      testID="paper-explanation-close"
                    >
                      <X size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  {/* Source tabs */}
                  {explanations.length > 1 && (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 10 }}
                      style={{ borderBottomWidth: 1, borderBottomColor: colors.border + '30', flexGrow: 0 }}
                    >
                      <TouchableOpacity
                        onPress={() => setActiveExplIndex(prev => ({ ...prev, [q.id]: -1 }))}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: safeIdx === -1 ? colors.primary : colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: safeIdx === -1 ? colors.buttonText : colors.textTertiary }}>
                          ALL ({explanations.length})
                        </Text>
                      </TouchableOpacity>
                      {explanations.map((e: any, i: number) => (
                        <TouchableOpacity
                          key={`m-tab-${i}`}
                          onPress={() => setActiveExplIndex(prev => ({ ...prev, [q.id]: i }))}
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: safeIdx === i ? (e.isUserNote ? '#10b981' : colors.primary) : colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '900', color: safeIdx === i ? colors.buttonText : colors.textTertiary }}>
                            {e.isUserNote ? '📝 ' : ''}{String(e.source).toUpperCase()}{e.year ? ' · ' + e.year : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {/* Plus button to add/edit note */}
                      <TouchableOpacity
                        onPress={() => {
                          setEditNoteQId(q.id);
                          setNoteEditorText(ans.note || '');
                        }}
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, alignSelf: 'center' }}
                      >
                        <Plus size={16} color={colors.primary} />
                      </TouchableOpacity>
                    </ScrollView>
                  )}

                  {/* Scrollable body */}
                  <ScrollView
                    style={{ flex: 1, minHeight: 0 }}
                    contentContainerStyle={{ padding: 18, paddingBottom: 24 }}
                    showsVerticalScrollIndicator
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                        <Markdown style={mdStyles} rules={mdRules}>
                          {text}
                        </Markdown>

                        {/* Clone to My Note shortcut */}
                        {safeIdx !== -1 && !explanations[safeIdx].isUserNote && (
                          <TouchableOpacity
                            onPress={() => handleCloneToNote(q.id, text)}
                            style={{ 
                              flexDirection: 'row', 
                              alignItems: 'center', 
                              gap: 6, 
                              marginTop: 12, 
                              padding: 8, 
                              borderRadius: 8, 
                              backgroundColor: colors.primary + '10',
                              alignSelf: 'flex-start'
                            }}
                          >
                            <Copy size={14} color={colors.primary} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>Clone to My Note</Text>
                          </TouchableOpacity>
                        )}

                    {/* Mistake type chips inside modal */}
                    <View style={{ marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border + '40' }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: 8 }}>MISTAKE TYPE</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {ERROR_TYPES.map(type => (
                          <TouchableOpacity
                            key={type}
                            onPress={() => toggleMistakeType(q.id, type)}
                            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: ans.errorCategory === type ? colors.primary + '20' : colors.surfaceStrong }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: ans.errorCategory === type ? colors.primary : colors.textSecondary }}>{type}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Commit-to-Memory text box */}
                    <View style={{ marginTop: 16 }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: 8 }}>COMMIT TO MEMORY</Text>
                      <TextInput
                        style={{
                          backgroundColor: colors.surfaceStrong,
                          color: colors.textPrimary,
                          padding: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: colors.border,
                          minHeight: 80,
                          textAlignVertical: 'top',
                          fontSize: 14,
                        }}
                        placeholder="Capture your strategy / mnemonic..."
                        placeholderTextColor={colors.textTertiary}
                        multiline
                        value={ans.note || ''}
                        onChangeText={(val) => store.setMetadata(q.id, { note: val }, false)}
                        testID="paper-modal-note-input"
                      />
                      <TouchableOpacity
                        onPress={() => handleCommitToMemory(q.id)}
                        style={{ marginTop: 10 }}
                        testID="paper-modal-commit-btn"
                      >
                        <LinearGradient
                          colors={['#FF6B6B', '#7B2CBF']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={{ height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}
                        >
                          <Save size={18} color="#fff" />
                          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Commit to Memory</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </ScrollView>

                  {/* Sticky action bar — full-text labels */}
                  <View style={[stylesPaper.stickyBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                    <TouchableOpacity
                      onPress={() => store.setMetadata(q.id, { isReview: !ans.isReview }, true)}
                      style={[stylesPaper.stickyBtn, { backgroundColor: ans.isReview ? '#fef9c3' : colors.surfaceStrong, borderColor: ans.isReview ? '#eab308' : colors.border }]}
                      testID="paper-modal-review"
                    >
                      <Flag size={14} color={ans.isReview ? '#a16207' : colors.textPrimary} fill={ans.isReview ? '#eab308' : 'transparent'} />
                      <Text style={[stylesPaper.stickyBtnText, { color: ans.isReview ? '#a16207' : colors.textPrimary }]}>{ans.isReview ? 'Marked for Review' : 'Mark for Review'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handlePaperAddToFlashcards(q, { closeExplanation: true })}
                      disabled={savingFlashcard[q.id]}
                      style={[stylesPaper.stickyBtn, { backgroundColor: flashcardedIds.has(q.id) ? colors.primary + '15' : colors.surfaceStrong, borderColor: flashcardedIds.has(q.id) ? colors.primary : colors.border }]}
                      testID="paper-modal-flashcard"
                    >
                      {savingFlashcard[q.id] ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Zap size={14} color={flashcardedIds.has(q.id) ? colors.primary : colors.textPrimary} fill={flashcardedIds.has(q.id) ? colors.primary : 'transparent'} />
                      )}
                      <Text style={[stylesPaper.stickyBtnText, { color: flashcardedIds.has(q.id) ? colors.primary : colors.textPrimary }]}>{flashcardedIds.has(q.id) ? 'Flashcard Saved' : 'Add to Flashcards'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        openHardnoteFromQuestion(
                          q,
                          text,
                          { closeExplanation: true }
                        );
                      }}
                      style={[stylesPaper.stickyBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}
                      testID="paper-modal-hardnote"
                    >
                      <PenTool size={14} color={colors.textPrimary} />
                      <Text style={[stylesPaper.stickyBtnText, { color: colors.textPrimary }]}>Hardnote</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        runAfterPaperOverlayClose(() => {
                          handleQuickSave(q);
                        }, { closeExplanation: true });
                      }}
                      style={[stylesPaper.stickyBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}
                      testID="paper-modal-quicksave"
                    >
                      <Save size={14} color={colors.textPrimary} />
                      <Text style={[stylesPaper.stickyBtnText, { color: colors.textPrimary }]}>Quick Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })()}
        </Modal>


        <AIModelSwitcher
          visible={showModelSwitcher}
          onClose={() => setShowModelSwitcher(false)}
        />

        {/* Clock Control Modal */}
        <Modal visible={showClockControl} transparent animationType="fade" onRequestClose={() => setShowClockControl(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 20 }]}>Timer Controls</Text>
              
              <View style={{ gap: 12 }}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong }}
                  onPress={() => { setIsTimerActive(!isTimerActive); setShowClockControl(false); }}
                >
                   {isTimerActive ? <XCircle size={20} color={colors.primary} /> : <Target size={20} color={colors.primary} />}
                   <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 12 }}>{isTimerActive ? 'Pause Timer' : 'Resume Timer'}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong }}
                  onPress={() => { 
                    if (timerType === 'countdown') {
                      if (customTimeInput) setSeconds(parseInt(customTimeInput) * 60);
                      else setSeconds(questions.length * 120);
                    } else setSeconds(0);
                    setIsTimerActive(true);
                    setShowClockControl(false);
                  }}
                >
                   <Clock size={20} color={colors.primary} />
                   <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 12 }}>Reset Timer</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong }}
                  onPress={() => { setShowClockControl(false); setShowTimerPicker(true); }}
                >
                   <Target size={20} color={colors.primary} />
                   <Text style={{ fontWeight: '800', color: colors.textPrimary, marginLeft: 12 }}>Change Setup</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => setShowClockControl(false)} style={{ marginTop: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Save Session Modal */}
        <Modal visible={showSaveSessionModal} transparent animationType="fade" onRequestClose={() => setShowSaveSessionModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 12 }]}>Finish Session</Text>
              <Text style={{ color: colors.textTertiary, marginBottom: 20, fontSize: 13 }}>Give your session a name to save your progress.</Text>
              
              <TextInput 
                style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 16, fontSize: 16, color: colors.textPrimary, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                placeholder="e.g. Agriculture Practice #1"
                placeholderTextColor={colors.textTertiary}
                value={sessionName}
                onChangeText={setSessionName}
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                  onPress={() => { setShowSaveSessionModal(false); router.back(); }}
                >
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                  onPress={() => setShowSaveSessionModal(false)}
                >
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 1.2, padding: 16, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                  onPress={handleSaveAndExit}
                >
                  <Text style={{ fontWeight: '800', color: '#fff' }}>Save & Exit</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* New Tag Modal */}
        <Modal visible={isAddingTag} transparent animationType="fade" onRequestClose={() => setIsAddingTag(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary, marginBottom: 12 }]}>New Study Tag</Text>
              <TextInput 
                style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 16, fontSize: 16, color: colors.textPrimary, marginBottom: 20, borderWidth: 1, borderColor: colors.border }}
                placeholder="e.g. TRAP"
                autoFocus
                placeholderTextColor={colors.textTertiary}
                value={newTagText}
                onChangeText={setNewTagText}
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity 
                  style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                  onPress={() => setIsAddingTag(false)}
                >
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={{ flex: 2, padding: 16, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' }}
                  onPress={handleCreateTag}
                >
                  <Text style={{ fontWeight: '800', color: '#fff' }}>Create Tag</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <SaveNameModal 
          visible={showSaveNameModal}
          onClose={() => setShowSaveNameModal(false)}
          onSave={commitManualSave}
          value={customTestName}
          setValue={setCustomTestName}
          isSaving={isSavingAttempt}
        />

        {/* Personalized Rich Note Editor Modal */}
        <Modal
          visible={!!editNoteQId}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setEditNoteQId(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%' }}
            >
              <View style={{ 
                backgroundColor: colors.surface, 
                borderTopLeftRadius: 24, 
                borderTopRightRadius: 24, 
                padding: 20,
                height: height * 0.85,
                borderWidth: 1,
                borderColor: colors.border
              }}>
                {/* Modal Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#10b98115', alignItems: 'center', justifyContent: 'center' }}>
                      <Edit2 size={20} color="#10b981" />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>Personalized Note</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700' }}>Rich Text & AI Refined</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => setEditNoteQId(null)}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Rich Toolbar */}
                <View style={{ backgroundColor: colors.surfaceStrong, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
                  <RichToolbar
                    getEditor={() => (richNoteRef.current)}
                    selectedIconTint={colors.primary}
                    iconTint={colors.textSecondary}
                    style={{ backgroundColor: 'transparent' }}
                    actions={[
                      actions.undo,
                      actions.redo,
                      actions.setBold,
                      actions.setItalic,
                      actions.insertBulletsList,
                      actions.insertOrderedList,
                      'highlight',
                      'aiRefine'
                    ]}
                    iconMap={{
                      [actions.undo]: ({ tintColor }: any) => <Undo2 size={18} color={tintColor} />,
                      [actions.redo]: ({ tintColor }: any) => <Redo2 size={18} color={tintColor} />,
                      highlight: ({ tintColor }: any) => <Highlighter size={18} color={tintColor} />,
                      aiRefine: ({ tintColor }: any) => (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.primary }}>
                          <Brain size={14} color="#fff" />
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>REFINE</Text>
                        </View>
                      )
                    }}
                    onPress={(action: any) => {
                      if (action === 'aiRefine') {
                        handleAiRefineNote();
                        return;
                      }
                      if (action === 'highlight') {
                        richNoteRef.current?.commandDOM?.("document.execCommand('hiliteColor', false, '#FFF59D')");
                        return;
                      }
                    }}
                  />
                </View>

                {/* Editor Shell */}
                <View style={{ flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
                  <RichNoteEditor
                    ref={richNoteRef}
                    html={noteEditorText}
                    onChange={setNoteEditorText}
                    themeColors={{
                      bg: colors.surface,
                      surface: colors.surface,
                      textPrimary: colors.textPrimary,
                      border: colors.border,
                      primary: colors.primary
                    }}
                    editorStyle={{ minHeight: 400 }}
                    placeholder="Type your personal tricks, mnemonics, or refined explanation here..."
                  />
                </View>

                {/* Action Buttons */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: Platform.OS === 'ios' ? 20 : 0 }}>
                  <TouchableOpacity 
                    style={{ flex: 1, height: 54, borderRadius: 16, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                    onPress={() => setEditNoteQId(null)}
                  >
                    <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 2, height: 54, borderRadius: 16, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }}
                    onPress={() => editNoteQId && handleSavePersonalNote(editNoteQId, noteEditorText)}
                  >
                    <Check size={20} color="#fff" />
                    <Text style={{ fontWeight: '900', color: '#fff', fontSize: 16 }}>Save Note</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        {/* POST-SUBMISSION SUMMARY MODAL */}
        <Modal visible={!!summary} transparent animationType="fade" onRequestClose={() => {}}>
          <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, padding: 30 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <Clock color={colors.primary} size={32} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: 24 }]}>Session Completed</Text>
              </View>
              
              <View style={{ gap: 16, marginBottom: 32 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Questions</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>{summary?.totalQuestions}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Attempted</Text>
                  <Text style={{ color: '#22c55e', fontWeight: '800', fontSize: 18 }}>{summary?.attempted}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Skipped</Text>
                  <Text style={{ color: colors.textTertiary, fontWeight: '800', fontSize: 18 }}>{summary?.skipped}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Duration</Text>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800', fontSize: 18 }}>
                    {Math.floor((summary?.durationSec ?? 0) / 60)}m {((summary?.durationSec ?? 0) % 60)}s
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={{ backgroundColor: colors.primary, padding: 18, borderRadius: 16, alignItems: 'center' }}
                onPress={() => {
                  isNavigatingAway.current = true;
                  if (summary?.attemptId) {
                    router.replace({
                      pathname: '/unified/result/[aid]',
                      params: { aid: summary.attemptId }
                    });
                  } else {
                    router.replace('/analyse');
                  }
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>VIEW ANALYTICS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Add-to-Flashcard sheet (universal) */}
        <AddToFlashcardSheet
          visible={aff.visible}
          onClose={() => setAff(s => ({ ...s, visible: false }))}
          userId={session?.user?.id || ''}
          cardId={aff.cardId}
          hint={aff.hint}
        />

        {/* Notebook location picker (tree) */}
        {/* Doubt Clearing Modal */}
        <Modal
          visible={doubtModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDoubtModalVisible(false)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%' }}
            >
              <View style={{ 
                backgroundColor: colors.surface, 
                borderTopLeftRadius: 24, 
                borderTopRightRadius: 24, 
                padding: 20,
                maxHeight: height * 0.8,
                borderWidth: 1,
                borderColor: colors.border
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                      <MessageSquare size={20} color={colors.primary} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>Ask AI Doubt</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700' }}>UPSC Exam Contextual Support</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      setDoubtModalVisible(false);
                      setDoubtQuestion('');
                      setDoubtAnswer('');
                    }}
                    style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={{ marginBottom: 20 }} showsVerticalScrollIndicator={false}>
                  {doubtAnswer ? (
                    <View style={{ backgroundColor: colors.primary + '08', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.primary + '20', marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <Brain size={14} color={colors.primary} />
                        <Text style={{ fontSize: 10, fontWeight: '900', color: colors.primary, letterSpacing: 1 }}>AI RESPONSE</Text>
                      </View>
                      <Markdown style={mdStyles} rules={mdRules}>
                        {doubtAnswer}
                      </Markdown>
                      <TouchableOpacity 
                        onPress={() => setDoubtAnswer('')}
                        style={{ alignSelf: 'flex-end', marginTop: 12 }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '800' }}>Ask another question</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.surfaceStrong, padding: 12, borderRadius: 12, marginBottom: 16 }}>
                      <Text style={{ fontSize: 11, color: colors.textSecondary, lineHeight: 16 }}>
                        <Text style={{ fontWeight: '900' }}>TIP:</Text> You can ask about the logic, terms, or context of this specific question.
                      </Text>
                    </View>
                  )}
                  
                  {!doubtAnswer && (
                    <View style={{ 
                      backgroundColor: colors.surfaceStrong, 
                      borderRadius: 16, 
                      padding: 12,
                      borderWidth: 1,
                      borderColor: colors.border
                    }}>
                      <TextInput
                        placeholder="Type your doubt here..."
                        placeholderTextColor={colors.textTertiary}
                        style={{ 
                          color: colors.textPrimary,
                          fontSize: 14,
                          minHeight: 100,
                          textAlignVertical: 'top'
                        }}
                        multiline
                        value={doubtQuestion}
                        onChangeText={setDoubtQuestion}
                      />
                    </View>
                  )}
                </ScrollView>

                {!doubtAnswer && (
                  <TouchableOpacity 
                    onPress={handleAskDoubt}
                    disabled={askingDoubt || !doubtQuestion.trim()}
                    style={{ 
                      backgroundColor: colors.primary, 
                      height: 54, 
                      borderRadius: 16, 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: 10,
                      opacity: (askingDoubt || !doubtQuestion.trim()) ? 0.6 : 1,
                      shadowColor: colors.primary,
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                      elevation: 4
                    }}
                  >
                    {askingDoubt ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Send size={18} color="#fff" />
                        <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>SEND QUESTION</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
                
                <View style={{ height: Platform.OS === 'ios' ? 20 : 0 }} />
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
        <PilotV2SaveSheet
          visible={pilotV2SaveOpen}
          userId={session?.user?.id || ''}
          onClose={() => {
            setPilotV2SaveOpen(false);
            setPilotSaveTargetQuestion(null);
            setPilotSaveHtml('');
          }}
          autoSeed={(pilotSaveTargetQuestion || questions[currentIndex]) ? {
            subject: (pilotSaveTargetQuestion || questions[currentIndex])!.subject || null,
            topic: ((pilotSaveTargetQuestion || questions[currentIndex]) as any).section_group || null,
            subtopic: (pilotSaveTargetQuestion || questions[currentIndex])!.micro_topic || null,
            notebookTitle: (pilotSaveTargetQuestion || questions[currentIndex])!.micro_topic || (pilotSaveTargetQuestion || questions[currentIndex])!.subject || null,
          } : { subject: null, topic: null, subtopic: null, notebookTitle: null }}
          seedQuestion={pilotSaveTargetQuestion || questions[currentIndex] || null}
          initialBody={
            pilotSaveHtml ||
            markdownToHtml(
              (pilotSaveTargetQuestion || questions[currentIndex])?.explanation_markdown || ''
            )
          }
          source={
            (pilotSaveTargetQuestion || questions[currentIndex])
              ? `Quiz / ${(pilotSaveTargetQuestion || questions[currentIndex])!.subject || ''} ${(pilotSaveTargetQuestion || questions[currentIndex])!.exam_year || ''}`.trim()
              : 'Quiz'
          }
        />

        {session?.user?.id && hardnotesPayload && (
          <QuizCaptureSheet
            visible={hardnotesPickerVisible}
            userId={session.user.id}
            explanationMarkdown={hardnotesPayload.markdown}
            suggestedTitle={hardnotesPayload.title}
            onClose={() => setHardnotesPickerVisible(false)}
          />
        )}
        <AddToFlashcardSheet
          visible={aff.visible}
          onClose={() => setAff((prev: any) => ({ ...prev, visible: false }))}
          userId={session?.user?.id || ''}
          cardId={aff.cardId}
          hint={aff.hint}
          onPlaced={(pathLabel: string) => {
            // Add to flashcardedIds only when successfully placed
            if (aff.cardId && questions[currentIndex]) {
              handleFlashcardPlaced(aff.cardId, questions[currentIndex].id);
            }
          }}
        />

        {/* Floating Context-Aware AI Chat Card overlay */}
        <PilotV2Provider>
          <PilotV2AIChat
            activeQuestion={activeAiQuestion || questions[currentIndex]}
            externalOpenTrigger={aiChatTrigger}
            onSaveResponse={(text: string) => {
              const q = activeAiQuestion || questions[currentIndex];
              if (!q) return;
              setPilotSaveTargetQuestion(q);
              setPilotSaveHtml(markdownToHtml(text || ''));
              setPilotV2SaveOpen(true);
            }}
            onOpenVitaminEditor={(text: string) => {
              const q = activeAiQuestion || questions[currentIndex];
              if (!q) return;
              setEditingQuestion(q);
              setVitaminEditorContent(markdownToHtml(text || ''));
              setVitaminEditorVisible(true);
            }}
          />
        </PilotV2Provider>

        <UnifiedExportSheet
          visible={exportSheetVisible}
          onClose={() => setExportSheetVisible(false)}
          payload={exportPayload}
          title={sessionName || customTestName || 'Practice Session'}
          initialOptions={{
            title: sessionName || customTestName || 'Practice Session Report',
            moduleName: 'Quiz Engine Export',
            headerText: 'Noji AI Quiz Engine',
            footerText: 'Generated by Noji AI'
          }}
          renderExtraFilters={(o, setO) => (
            <>
              {userStudyTags.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 6 }}>REVISION TAGS</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {userStudyTags.map(tag => {
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
              )}
              {availableInstitutes.length > 0 && (
                <View style={{ marginTop: 10 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 6 }}>INSTITUTE EXPLANATIONS</Text>
                  <Text style={{ fontSize: 9, color: colors.textTertiary, marginBottom: 6 }}>Multi-select — only chosen institutes will appear in the PDF</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {availableInstitutes.map(inst => {
                      const isActive = (o.instituteFilters || []).includes(inst);
                      return (
                        <TouchableOpacity
                          key={inst}
                          onPress={() => setO(prev => ({ ...prev, instituteFilters: isActive ? (prev.instituteFilters || []).filter(i => i !== inst) : [...(prev.instituteFilters || []), inst] }))}
                          style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, backgroundColor: isActive ? colors.primary : colors.surfaceStrong, borderColor: isActive ? colors.primary : colors.border }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '800', color: isActive ? '#fff' : colors.textPrimary }}>{inst}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
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
      </SafeAreaView>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  progressText: { fontSize: 12, fontWeight: '800' },
  menuBtn: { padding: 8, borderRadius: 10 },
  exitBtn: { padding: 8 },
  listContent: { padding: 16 },
  questionCard: { borderRadius: 24, padding: 20, borderWidth: 1, marginBottom: 16 },
  qHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  qNumberBadge: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qNumberText: { fontWeight: '900' },
  qMetaText: { fontSize: 10, fontWeight: '800' },
  inlineBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  optionsContainer: { marginVertical: 20, gap: 12 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderTopWidth: 1 },
  optionBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },
  optionLabel: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  optionLabelText: { fontSize: 14, fontWeight: '900' },
  optionText: { fontSize: 15, flex: 1 },
  revealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', marginBottom: 20, gap: 8 },
  revealBtnText: { fontWeight: '800' },
  controls: { borderTopWidth: 1, paddingTop: 16 },
  controlRow: { marginBottom: 16 },
  controlLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  chipScroll: { gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 11, fontWeight: '700' },
  difficultyRow: { flexDirection: 'row', gap: 10 },
  difficultyBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10, borderWidth: 1 },
  difficultyText: { fontSize: 11, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 10, marginVertical: 16 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, gap: 6 },
  actionBtnText: { fontSize: 12, fontWeight: '800' },
  noteSection: { marginBottom: 20 },
  noteInputWrapper: { padding: 12, borderRadius: 12, borderWidth: 1, minHeight: 60 },
  noteInput: { fontSize: 14 },
  commitBtnContainer: { height: 50, borderRadius: 12, overflow: 'hidden', marginBottom: 20 },
  commitBtnGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  commitBtnText: { color: '#fff', fontWeight: '900' },
  explanationBox: { padding: 16, borderRadius: 16, gap: 8 },
  explanationHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  explanationTitle: { fontSize: 11, fontWeight: '900' },
  verticalMenu: { position: 'absolute', top: 70, right: 16, width: 50, borderRadius: 20, padding: 10, gap: 16, alignItems: 'center', elevation: 15, zIndex: 9999 },
  utilBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  fontPanel: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, borderTopLeftRadius: 30, borderTopRightRadius: 30, elevation: 20 },
  sliderRow: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  sizeBubble: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 16 },
  paletteItem: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cardNav: { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, borderRadius: 12, gap: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 30, padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalLabel: { fontSize: 10, fontWeight: '900', marginBottom: 8 },
  modalInput: { borderRadius: 12, padding: 12, fontSize: 14, marginBottom: 16 },
  modalChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, marginRight: 8 },
  modalToolBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  launchBtn: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  indexHeader: { padding: 20, borderBottomWidth: 1 },
  indexTitle: { fontSize: 20, fontWeight: '900' },
  indexSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  indexItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  indexNum: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  indexSnippet: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  pageBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  headerBtn: { padding: 8, borderRadius: 12 },
  toggleMiniBtn: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 4 },
  floatingZenExit: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 9999,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(67, 52, 34, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  }
});

// Simulated Exam Mode (paper view) styles
const stylesPaper = StyleSheet.create({
  qCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  qHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  qNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
  },
  explBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  pagerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 12,
  },
  paginationDock: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  paginationPopup: {
    width: Math.min(width - 24, 560),
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  paginationTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  paginationScroller: {
    maxHeight: 46,
  },
  paginationScrollerContent: {
    gap: 8,
    paddingRight: 6,
  },
  paginationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  topRightDock: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 18 : 12,
    right: 12,
    zIndex: 999,
  },
  topRightToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperQuickMenu: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 66 : 56,
    right: 12,
    width: 168,
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    gap: 6,
  },
  paperQuickMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  pageDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    height: Math.min(height * 0.9, 780),
    minHeight: 320,
    borderRadius: 24,
    overflow: 'hidden',
  },
  stickyBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  stickyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  stickyBtnText: {
    fontSize: 12,
    fontWeight: '800',
  },
});

const SaveNameModal = ({ visible, onClose, onSave, value, setValue, isSaving }: any) => {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, width: '85%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Save Session</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
          
          <Text style={{ color: colors.textSecondary, marginBottom: 16, fontSize: 13 }}>Give this attempt a name to find it in your history later.</Text>
          
          <TextInput 
            style={{ backgroundColor: colors.surfaceStrong, color: colors.textPrimary, borderColor: colors.border, height: 50, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1 }}
            placeholder="e.g. Modern History Revision"
            placeholderTextColor={colors.textTertiary}
            value={value}
            onChangeText={setValue}
            autoFocus
          />

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity 
              style={{ flex: 1, padding: 14, alignItems: 'center' }} 
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={{ color: colors.textTertiary, fontWeight: 'bold' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={{ flex: 2, padding: 14, backgroundColor: isSaving ? colors.primary + '80' : colors.primary, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }} 
              onPress={() => onSave(value)}
              disabled={isSaving}
            >
              {isSaving && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ color: '#fff', fontWeight: '900' }}>{isSaving ? 'Saving...' : 'Save Attempt'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
