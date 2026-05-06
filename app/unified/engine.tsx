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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventRemove, useNavigation } from '@react-navigation/native';
import { 
  ChevronLeft, 
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
  ChevronDown,
  ChevronUp,
} from 'lucide-react-native';
import { AIModelSwitcher } from '../../src/components/ai/AIModelSwitcher';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PinchGestureHandler, State as GHState } from 'react-native-gesture-handler';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useQuizStore } from '../../src/store/quizStore';
import { mergeQuestions } from '../../src/utils/merger';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';
import { StudentSync } from '../../src/services/StudentSync';
import { uuidv4 } from '../../src/utils/uuid';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { AddToFlashcardSheet } from '../../src/components/flashcards/AddToFlashcardSheet';
import { NotebookLocationPicker } from '../../src/components/NotebookLocationPicker';
import { QuizCaptureSheet } from '../../src/components/hardnotes/QuizCaptureSheet';
import { OfflineManager } from '../../src/services/OfflineManager';
import { LocalQuery } from '../../src/services/LocalQuery';
import RichNoteEditor from '../../src/components/RichNoteEditor';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import {
  aiExplainQuestion,
  aiSummarizeExplanation,
} from '../../src/services/GeminiService';

const ThemeSwitcher = require('../../src/components/ThemeSwitcher').ThemeSwitcher;

const { width, height } = Dimensions.get('window');

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

const OptionButton = ({ label, text, isSelected, isCorrect, isWrong, showResult, onSelect, disabled, fontSize = 16 }: any) => {
  const { colors } = useTheme();
  
  let borderColor = colors.border;
  let backgroundColor = colors.surface;
  let textColor = colors.textPrimary;
  let letterBg = colors.surfaceStrong;
  let letterColor = colors.textSecondary;

  if (isSelected) {
    borderColor = colors.primary;
    backgroundColor = colors.primary + '10';
    letterBg = colors.primary;
    letterColor = colors.buttonText;
  }

  if (showResult) {
    if (isCorrect) {
      borderColor = '#22c55e';
      backgroundColor = '#dcfce7';
      textColor = '#15803d';
      letterBg = '#22c55e';
      letterColor = '#fff';
    } else if (isWrong) {
      borderColor = '#ef4444';
      backgroundColor = '#fee2e2';
      textColor = '#b91c1c';
      letterBg = '#ef4444';
      letterColor = '#fff';
    }
  }

  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={disabled}
      style={[
        styles.optionBtn,
        { backgroundColor, borderColor, borderWidth: isSelected || showResult ? 2 : 1 },
      ]}
    >
      <View style={[styles.optionLabel, { backgroundColor: letterBg }]}>
        <Text style={[styles.optionLabelText, { color: letterColor }]}>
          {label}
        </Text>
      </View>
      <Text style={[styles.optionText, { color: textColor, fontWeight: (isCorrect && showResult) || isSelected ? '700' : '500', fontSize: Math.max(12, fontSize - 1), lineHeight: Math.max(18, (fontSize - 1) * 1.35) }]}>{text}</Text>
      {showResult && isCorrect && <Check size={18} color="#22c55e" style={{ marginLeft: 'auto' }} />}
      {showResult && isWrong && <X size={18} color="#ef4444" style={{ marginLeft: 'auto' }} />}
    </TouchableOpacity>
  );
};

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

const buildCanonicalExplanations = (item: any) => {
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

  const rawGroup = String(examInfo?.group || examInfo?.exam_name || '').trim();
  const groupNameUpper = rawGroup.toUpperCase();

  const isUPSC = toBool(examInfo?.is_upsc_cse) || groupNameUpper === 'UPSC' || groupNameUpper.includes('UPSC CSE');
  const isAllied = toBool(examInfo?.is_allied) || ['CAPF', 'CDS', 'NDA', 'EPFO', 'CISF', 'ALLIED'].some(g => groupNameUpper.includes(g));
  const isOther = toBool(examInfo?.is_others) || ['UPPCS', 'BPSC', 'MPSC', 'RPSC', 'UKPSC', 'MPPSC', 'CGPSC', 'STATE PSC', 'OTHER'].some(g => groupNameUpper.includes(g));

  const rawYear = examInfo?.year ?? '';
  const year = typeof rawYear === 'string' ? rawYear.trim() : String(rawYear).trim();

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
  const sessionStartRef = useRef<number>(Date.now()); // Wall-clock start for accurate duration

  // 🆕 Declare arenaMode FIRST — fixes TDZ crash
  const [arenaMode, setArenaMode] = useState<'learning' | 'exam'>((params.mode as 'learning' | 'exam') || 'learning');

  // ── AI Explain / Summarize state (per-question) ───────────────
  const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
  const [aiSummaries, setAiSummaries]       = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading]           = useState<Record<string, boolean>>({});
  const [aiSumLoading, setAiSumLoading]     = useState<Record<string, boolean>>({});
  const [aiExpanded, setAiExpanded]         = useState<Record<string, boolean>>({});
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);

  const handleAiExplain = async (item: any) => {
    const id = item.id || item.question_id;
    if (aiExplanations[id]) {
      setAiExpanded(prev => ({ ...prev, [id]: !prev[id] }));
      return;
    }
    setAiLoading(prev => ({ ...prev, [id]: true }));
    setAiExpanded(prev => ({ ...prev, [id]: true }));
    try {
      // options is a jsonb object: { "a": "...", "b": "...", "c": "...", "d": "..." }
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
      );
      setAiExplanations(prev => ({ ...prev, [id]: result }));
    } catch (e: any) {
      const msg: string = e?.message || 'Unknown error';
      if (msg.includes('404')) {
        Alert.alert('Model not found', 'Go to Settings → AI Settings and switch model.');
      } else if (msg.includes('429')) {
        Alert.alert(
          'Quota exceeded',
          'This key has hit its limit. Go to Settings → AI Settings and switch to another key, or switch provider.',
        );
      } else if (msg.includes('No Gemini API key found')) {
        Alert.alert('Gemini key needed', 'Go to Settings → AI Settings and paste your Gemini key.');
      } else if (msg.includes('No Groq API key found')) {
        Alert.alert('Groq key needed', 'Go to Settings → AI Settings and paste your Groq key.\nFree at console.groq.com');
      } else {
        Alert.alert('AI Error', msg);
      }
      setAiExpanded(prev => ({ ...prev, [id]: false }));
    } finally {
      setAiLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleAiSummarize = async (item: any) => {
    const id = item.id || item.question_id;
    const explanation = aiExplanations[id];
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

  // Prevent accidental exit during formal exams and unsaved learning sessions
  usePreventRemove(
    !isNavigatingAway.current && (arenaMode === 'exam' || (arenaMode === 'learning' && hasUnsavedLearningProgress)),
    ({ data }) => {
      const isLearningExit = arenaMode === 'learning';
      Alert.alert(
        isLearningExit ? 'Exit Learn Session?' : 'Exit Exam?',
        isLearningExit
          ? 'You have unsaved progress. What would you like to do?'
          : 'Your attempt is in progress. What would you like to do?',
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
              if (isLearningExit) {
                clearStoredAnswers();
                setRevealedExplanations({});
              }
              isNavigatingAway.current = true;
              navigation.dispatch(data.action);
            },
          },
          {
            text: 'Save & Exit',
            onPress: async () => {
              try {
                if (isLearningExit) {
                  await commitManualSave(`Learn Session - ${new Date().toLocaleDateString()}`);
                } else {
                  await handleFinalSubmit();
                }
              } catch (e) {
                console.warn('Save on exit failed', e);
              } finally {
                isNavigatingAway.current = true;
                navigation.dispatch(data.action);
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

  // Notebook System State
  const [notebookModalVisible, setNotebookModalVisible] = useState(false);
  // Hardnotes bridge (Phase 3) — send quiz explanation into a Skia canvas note
  const [hardnotesPickerVisible, setHardnotesPickerVisible] = useState(false);
  const [hardnotesPayload, setHardnotesPayload] = useState<{ markdown: string; title: string } | null>(null);  const notebookRichEditorRef = useRef<any>(null);
  const [noteDraftBullets, setNoteDraftBullets] = useState(['']);
  const [activeInputIndex, setActiveInputIndex] = useState(0);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [folders, setFolders] = useState<any[]>([]);
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [subheadings, setSubheadings] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<any>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<any>(null);
  const [selectedSubheading, setSelectedSubheading] = useState('');
  const [isSavingToNotebook, setIsSavingToNotebook] = useState(false);
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewNotebookInput, setShowNewNotebookInput] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [showCustomSubheadingInput, setShowCustomSubheadingInput] = useState(false);
  const [customSubheading, setCustomSubheading] = useState('');
  const [showPYQTags, setShowPYQTags] = useState(showPYQTagsParam);
  const [activeExplIndex, setActiveExplIndex] = useState<Record<string, number>>({});
  const [activeExplSource, setActiveExplSource] = useState<Record<string, string>>({});
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [showSaveNameModal, setShowSaveNameModal] = useState(false);
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [savingFlashcard, setSavingFlashcard] = useState<Record<string, boolean>>({});
  const [lastNoteTap, setLastNoteTap] = useState(0);
  const [fontSize, setFontSize] = useState(16);
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
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showPaperQuickMenu, setShowPaperQuickMenu] = useState(false);
  const [showPaperPagination, setShowPaperPagination] = useState(false);
  // Simulated Exam Mode (paper view) state
  const [paperPage, setPaperPage] = useState(0); // current paper page (0-indexed)
  const [explanationModalQId, setExplanationModalQId] = useState<string | null>(null); // open explanation modal for this question id
  const [paperPageSize, setPaperPageSize] = useState(6); // 6 questions/page (can fall back to 4–5 visually)
  const [showFontSlider, setShowFontSlider] = useState(false);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showIndex, setShowIndex] = useState(arenaMode === 'learning');
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
  const [lastUsedSubheading, setLastUsedSubheading] = useState('');
  const [flashcardedIds, setFlashcardedIds] = useState<Set<string>>(new Set());
  const [aff, setAff] = useState<{ visible: boolean; cardId: string | null; hint: { subject?: string; section_group?: string; microtopic?: string } }>({ visible: false, cardId: null, hint: {} });
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
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

  const zenBg = isZenMode ? '#F4ECD8' : colors.bg;
  const zenTextColor = isZenMode ? '#433422' : colors.textPrimary;
  const zenPaperColor = isZenMode ? '#F4ECD8' : colors.surface;

  const sessionTestId = useMemo(() => {
    return routeParams.testId || `custom_${routeParams.subject || 'all'}_${new Date().toISOString().split('T')[0]}`;
  }, [routeParams.testId, routeParams.subject]);
  const sessionAttemptId = useMemo(() => `${sessionTestId}__${Date.now()}`, [sessionTestId]);

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

  // Notebook Subheading Initialization
  useEffect(() => {
    if (notebookModalVisible) {
      fetchHierarchy();
    }
  }, [notebookModalVisible]);

  // Fetch unique tags from previous sessions
  useEffect(() => {
    const fetchExistingTags = async () => {
      if (!session?.user?.id) return;
      const { data } = await supabase
        .from('question_states')
        .select('review_tags')
        .eq('user_id', session.user.id)
        .not('review_tags', 'is', null);
      
      if (data) {
        const allTags = new Set(DEFAULT_STUDY_TAGS);
        data.forEach(row => {
          if (Array.isArray(row.review_tags)) {
            row.review_tags.forEach(t => allTags.add(t));
          }
        });
        setUserStudyTags(Array.from(allTags));
      }
    };
    fetchExistingTags();
  }, [session?.user?.id]);

  const toggleStudyTag = (qId: string, currentTags: string[], tag: string) => {
    const tags = currentTags || [];
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];
    store.setMetadata(qId, { studyTags: newTags }, false);
    // Explicitly trigger sync with the *newest* data to prevent the "one step behind" race condition
    if (arenaMode === 'exam' && session?.user?.id) {
      StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: qId,
        testId: questions.find(q => q.id === qId)?.tests?.id || 'manual',
        patch: { review_tags: newTags }
      });
    }
  };

  const toggleGuess = (qId: string, selectedAnswer: string | null | undefined, guessValue: string) => {
    const currentGuess = currentAnswers[qId]?.confidence || null;
    store.setAnswer(qId, selectedAnswer ?? null, currentGuess === guessValue ? null : guessValue, arenaMode === 'exam');
  };

  const toggleDifficulty = (qId: string, difficultyValue: string) => {
    const currentDifficulty = currentAnswers[qId]?.difficulty || null;
    store.setMetadata(qId, { difficulty: currentDifficulty === difficultyValue ? null : difficultyValue }, arenaMode === 'exam');
  };

  const toggleMistakeType = (qId: string, errorType: string) => {
    const currentError = currentAnswers[qId]?.errorCategory || null;
    store.setMetadata(qId, { errorCategory: currentError === errorType ? null : errorType }, arenaMode === 'exam');
  };

  const NOTE_PREFS_KEY = 'notebook_save_prefs';
  const listRef = useRef<FlatList>(null);

  // Robust scroll helper for list view palette jumps
  const scrollToIndexRobust = useCallback((targetIndex: number) => {
    if (viewMode !== 'list') return;
    
    const AVERAGE_ITEM_HEIGHT = 220;
    
    const attemptScroll = () => {
      try {
        listRef.current?.scrollToIndex({ 
          index: targetIndex, 
          animated: true, 
          viewPosition: 0 
        });
      } catch (e) {
        // Fall back to offset-based scroll if index fails
        listRef.current?.scrollToOffset({ 
          offset: Math.max(0, targetIndex * AVERAGE_ITEM_HEIGHT), 
          animated: true 
        });
        // Retry scrollToIndex after layout settles
        setTimeout(() => {
          try {
            listRef.current?.scrollToIndex({ 
              index: targetIndex, 
              animated: false, 
              viewPosition: 0 
            });
          } catch {}
        }, 300);
      }
    };
    
    // Small delay to let modal close animation complete
    setTimeout(attemptScroll, 50);
  }, [viewMode]);

  // 3. Store Selectors
  const currentAnswers = store.answers;
  const clearStoredAnswers = store.clearAnswers;

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

  // 4. Fetch Questions
  useEffect(() => {
    if (session?.user?.id) {
      fetchQuestions();
      store.startTest(sessionTestId, session.user.id, sessionAttemptId);
    }
    // We only want to run this once per sessionTestId
  }, [sessionTestId, sessionAttemptId, session?.user?.id]);

  useEffect(() => {
  if (!showIndex && viewMode === 'list' && currentIndex >= 0) {
      const scrollTimer = setTimeout(() => {
        try {
          listRef.current?.scrollToIndex({ 
            index: currentIndex, 
            animated: true,
            viewPosition: 0 
          });
        } catch (e) {
          console.warn("Scroll to index failed", e);
        }
      }, 300); // Increased delay for stability
      return () => clearTimeout(scrollTimer);
    }
  }, [showIndex, viewMode, currentIndex]); // Added currentIndex dependency

  useEffect(() => {
    if (!isPaperMode) {
      setShowPaperQuickMenu(false);
      setShowPaperPagination(false);
    }
  }, [isPaperMode]);

  const fetchQuestions = async () => {
    setLoading(true);
    let tagList: string[] = [];
    
    // Helper to process results
    const processResults = (data: any[]) => {
      const rawQs = data || [];
      const useExactPaperSequence = !!params.testId;

      let mergedQs: any[] = rawQs;
      let idToMergedId = new Map<string, string>();

      if (useExactPaperSequence) {
        mergedQs = rawQs;
        rawQs.forEach((q: any) => idToMergedId.set(q.id, q.id));
      } else {
        const merged = mergeQuestions(rawQs);
        mergedQs = merged.mergedQs;
        idToMergedId = merged.idToMergedId;
      }

      let finalQs = mergedQs;
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
        // Paper-wise learn/exam must keep the exact uploaded book order.
        // Sort strictly by `question_number`; use stable `id` as the
        // secondary key so even cached/offline data (which may arrive in
        // arbitrary order) still produces the deterministic book sequence.
        finalQs = [...finalQs]
          .map((q: any, idx: number) => ({ q, idx, qNo: parseQuestionNumber(q) }))
          .sort((a, b) => {
            if (a.qNo !== b.qNo) return a.qNo - b.qNo;
            const idA = String(a.q?.id ?? '');
            const idB = String(b.q?.id ?? '');
            if (idA && idB && idA !== idB) return idA < idB ? -1 : 1;
            return a.idx - b.idx;
          })
          .map(({ q }) => q);
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

      setQuestions(finalQs);
      
      if (params.questionId && !hasJumped) {
        const jumpId = params.questionId;
        const targetId = idToMergedId.get(jumpId) || jumpId;
        const index = finalQs.findIndex(item => item.id === targetId);
        if (index !== -1) {
          setCurrentIndex(index);
          setShowIndex(false);
          setHasJumped(true);
        }
      }
      
      if (session?.user?.id && finalQs.length > 0) {
        const shouldLoadAnswers = arenaMode === 'exam' && params.testId && !params.testId.startsWith('custom_');
        store.loadStates(mergedQs.map(q => q.id), !!shouldLoadAnswers);
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
      }

      // ──────── 2. FRESH: Background fetch from Server (Chunked to bypass limits) ────────
      let allFreshData: any[] = [];
      let from = 0;
      const CHUNK = 1000;
      const MAX_TOTAL = 10000; // Safety cap to prevent memory issues
      
      while (from < MAX_TOTAL) {
        let query = supabase.from('questions').select('id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_allied, is_others, source, test_id, tests(*)');
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
          const SELECT_COLS = 'id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_allied, is_others, source, test_id, tests(*)';
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
            const { data: tagIds } = await LocalQuery.from('question_states').select('question_id').eq('user_id', session.user.id).or(orQuery);
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

      // Only process fresh data if we actually got some rows.
      // Never blow away cached questions with empty server response.
      if (allFreshData.length > 0) {
        processResults(allFreshData);
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
    let interval: NodeJS.Timeout;
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
        if (questions[currentIndex]) {
          store.incrementTime(questions[currentIndex].id);
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

  // 6. Notebook Hierarchy Logic
  const fetchFolders = async () => {
    if (!session?.user?.id) return;
    const { data } = await LocalQuery.from('user_note_nodes').select('*').eq('user_id', session.user.id).eq('type', 'folder');
    setFolders(data || []);
  };

  const createNewFolder = async () => {
    if (!newFolderName.trim() || !session?.user?.id) return;
    const { data, error } = await supabase.from('user_note_nodes').insert({
      user_id: session.user.id,
      title: newFolderName.trim(),
      type: 'folder'
    }).select().single();
    if (!error && data) {
      setFolders(prev => [...prev, data]);
      setNewFolderName('');
      setShowNewFolderInput(false);
      setSelectedFolder(data);
    }
  };

  const createNewNotebook = async () => {
    if (!newNotebookName.trim() || !selectedFolder || !session?.user?.id) return;
    
    // First, create the actual note document
    const { data: noteData, error: noteError } = await supabase.from('user_notes').insert({
      user_id: session.user.id,
      title: newNotebookName.trim(),
      subject: selectedFolder.title || "General",
      items: []
    }).select().single();

    if (noteError || !noteData) return;

    // Then create the node reference
    const { data, error } = await supabase.from('user_note_nodes').insert({
      user_id: session.user.id,
      title: newNotebookName.trim(),
      type: 'note',
      parent_id: selectedFolder.id,
      note_id: noteData.id
    }).select().single();

    if (!error && data) {
      setNotebooks(prev => [...prev, data]);
      setNewNotebookName('');
      setShowNewNotebookInput(false);
      setSelectedNotebook(data);
    }
  };

  const fetchHierarchy = async () => {
    if (!session?.user?.id) return;
    
    // 1. Load Folders
    const { data: folderData } = await LocalQuery.from('user_note_nodes').select('*').eq('user_id', session.user.id).eq('type', 'folder');
    setFolders(folderData || []);

    // 2. Load Prefs
    const rawPrefs = await AsyncStorage.getItem(NOTE_PREFS_KEY);
    const prefs = rawPrefs ? JSON.parse(rawPrefs) : null;

    if (prefs) {
      // 3. Restore Folder
      if (prefs.folderId) {
        const lastFolder = folderData?.find((f: any) => f.id === prefs.folderId);
        if (lastFolder) {
          setSelectedFolder(lastFolder);
          
          // 4. Load Notebooks for this folder
          const { data: notebookData } = await LocalQuery.from('user_note_nodes').select('*').eq('parent_id', lastFolder.id).eq('type', 'note');
          setNotebooks(notebookData || []);

          // 5. Restore Notebook
          if (prefs.notebookId) {
            const lastNotebook = notebookData?.find((n: any) => n.id === prefs.notebookId || n.note_id === prefs.notebookId);
            if (lastNotebook) {
              setSelectedNotebook(lastNotebook);
              // 6. Fetch existing subheadings in this notebook
              fetchSubheadings(lastNotebook.note_id);
            }
          }
        }
      }

      // 7. Restore Subheading
      if (prefs.subheading) {
        setLastUsedSubheading(prefs.subheading);
        setSelectedSubheading(prefs.subheading);
        setCustomSubheading('');
      } else {
        setSelectedSubheading('');
        setCustomSubheading(questions[currentIndex]?.micro_topic || '');
      }
    } else {
      // Default to microtopic if no prefs
      setSelectedSubheading('');
      setCustomSubheading(questions[currentIndex]?.micro_topic || '');
    }
  };

  const fetchSubheadings = async (noteId: string) => {
    if (!noteId) return;
    const { data } = await LocalQuery.from('user_notes').select('items').eq('id', noteId).single();
    if (data?.items && Array.isArray(data.items)) {
      const headings = data.items.filter((i: any) => i.type === 'microTopicHeading').map((i: any) => i.text);
      const unique = Array.from(new Set(headings));
      setSubheadings(unique as string[]);
    } else {
      setSubheadings([]);
    }
  };

  const updateBullet = (idx: number, text: string) => {
    const next = [...noteDraftBullets];
    next[idx] = text;
    setNoteDraftBullets(next);
  };

  const addBullet = (idx: number) => {
    const next = [...noteDraftBullets];
    next.splice(idx + 1, 0, '');
    setNoteDraftBullets(next);
  };

  const removeBullet = (idx: number) => {
    if (noteDraftBullets.length === 1) return;
    const next = [...noteDraftBullets];
    next.splice(idx, 1);
    setNoteDraftBullets(next);
  };

  const splitBullet = (idx: number) => {
    const content = noteDraftBullets[idx];
    const before = content.slice(0, selection.start);
    const after = content.slice(selection.start);
    const next = [...noteDraftBullets];
    next[idx] = before;
    next.splice(idx + 1, 0, after);
    setNoteDraftBullets(next);
  };

  const applyFormatting = (type: 'bold' | 'italic' | 'underline' | 'bullet' | 'number' | 'highlight') => {
    const idx = activeInputIndex;
    const content = noteDraftBullets[idx] || '';
    const { start, end } = selection;
    
    const before = content.substring(0, start);
    const selected = content.substring(start, end);
    const after = content.substring(end);
    
    let formatted = selected;
    switch(type) {
      case 'bold': formatted = `<b>${selected}</b>`; break;
      case 'italic': formatted = `<i>${selected}</i>`; break;
      case 'underline': formatted = `<u>${selected}</u>`; break;
      case 'bullet': formatted = `<ul><li>${selected}</li></ul>`; break;
      case 'number': formatted = `<ol><li>${selected}</li></ol>`; break;
      case 'highlight': formatted = `<mark>${selected}</mark>`; break;
    }
    
    const next = [...noteDraftBullets];
    next[idx] = before + formatted + after;
    setNoteDraftBullets(next);
    
    // Update selection to be inside the tags if it was empty, or after if it was selection
    const newPos = start + formatted.length;
    setSelection({ start: newPos, end: newPos });
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const commitToNotebook = async () => {
    if (!selectedNotebook || !selectedNotebook.note_id || isSavingToNotebook) return;
    setIsSavingToNotebook(true);
    try {
      const finalSub = showCustomSubheadingInput ? customSubheading : selectedSubheading;
      
      const { data: noteData, error: fetchError } = await LocalQuery.from('user_notes').select('items').eq('id', selectedNotebook.note_id).single();
      if (fetchError) throw fetchError;
      
      const currentItems = Array.isArray(noteData?.items) ? noteData.items : [];
      const newItemsToAdd = [];
      
      if (finalSub && finalSub !== 'General') {
        const headingExists = currentItems.some((i: any) => i.type === 'microTopicHeading' && i.text === finalSub);
        if (!headingExists) {
           newItemsToAdd.push({
             id: Date.now().toString() + '-h',
             type: 'microTopicHeading',
             text: finalSub,
             addedAt: new Date().toISOString()
           });
        }
      }
      
      const bullets = noteDraftBullets.filter(b => b.trim()).map((b, i) => ({
        id: (Date.now() + i).toString(),
        type: 'highlight',
        text: b.trim(),
        color: '#FFB74D',
        source: `Q${currentIndex + 1} / ${questions[currentIndex]?.source?.group || questions[currentIndex]?.exam_group || (questions[currentIndex]?.is_pyq ? 'PYQ' : 'Practice')} ${questions[currentIndex]?.source?.year || questions[currentIndex]?.exam_year || ''}`.trim(),
        addedAt: new Date().toISOString()
      }));

      newItemsToAdd.push(...bullets);
      
      const { error } = await supabase.from('user_notes').update({
        items: [...currentItems, ...newItemsToAdd],
        updated_at: new Date().toISOString()
      }).eq('id', selectedNotebook.note_id);

      if (!error) {
        await AsyncStorage.setItem(NOTE_PREFS_KEY, JSON.stringify({
          folderId: selectedFolder?.id,
          notebookId: selectedNotebook?.note_id, // Save the real UUID for Quick Save compatibility
          subheading: finalSub
        }));
        setNotebookModalVisible(false);
        setNoteDraftBullets(['']);
      }
    } finally {
      setIsSavingToNotebook(false);
    }
  };

  // 7. Action Handlers
  const handleOptionSelect = (qId: string, label: string) => {
    store.setAnswer(qId, label, undefined, arenaMode === 'exam');
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

  const handleAddToFlashcards = async (q: Question) => {
    if (!session?.user?.id) return;
    setSavingFlashcard(prev => ({ ...prev, [q.id]: true }));
    try {
      const cardId = await FlashcardSvc.createFromQuestion(session.user.id, q);
      setFlashcardedIds(prev => new Set([...prev, q.id]));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setAff({
        visible: true,
        cardId,
        hint: {
          subject: q.subject || 'General',
          section_group: (q as any).section_group || (q as any).sectionGroup || 'General',
          microtopic: (q as any).micro_topic || (q as any).microtopic || (q as any).microTopic || 'General',
        },
      });
    } catch (err: any) {
      console.error("Flashcard Error:", err);
      Alert.alert("Error", "Failed to add to Flashcards. " + (err.message || ''));
    } finally {
      setSavingFlashcard(prev => ({ ...prev, [q.id]: false }));
    }
  };

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
    opts?: { closeExplanation?: boolean }
  ) => {
    runAfterPaperOverlayClose(() => {
      const activeText = explanationText || q.explanation_markdown || '';
      setNoteDraftBullets([activeText]);
      setCustomSubheading(q.micro_topic || '');
      setNotebookModalVisible(true);
      fetchHierarchy();
    }, opts);
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
      router.replace('/(tabs)/analyse');
    }
  };

  const handleDiscard = () => {
    setShowExitModal(false);
    isNavigatingAway.current = true;
    router.back();
  };

  const handleCreateTag = () => {
    if (!newTagText.trim()) return;
    if (userStudyTags.includes(newTagText.trim())) {
      setIsAddingTag(false);
      setNewTagText('');
      return;
    }
    const updated = [...userStudyTags, newTagText.trim()];
    setUserStudyTags(updated);
    setIsAddingTag(false);
    setNewTagText('');
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
    if (arenaMode === 'exam') {
      setShowSaveSessionModal(true);
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

    const normalizedExplanations = buildCanonicalExplanations(item);

    // Standardised single-line metadata: "INSTITUTE NAME – PROGRAM NAME – YEAR"
    // Hide any segment that is empty (per spec).
    const formatMetaLine = (e: any): string => {
      const segs = [
        String(e?.source || '').toUpperCase().trim(),
        normalizeProgramLabel(String(e?.program || '')).toUpperCase().trim(),
        String(e?.year || '').trim(),
      ].filter(Boolean);
      return segs.join(' – ');
    };

    const inferredInstitutes = (() => {
      const list = Array.isArray((item as any)._institutes)
        ? (item as any)._institutes
        : [];
      const normalized = list
        .map((value: any) => normalizeInstituteLabel(value))
        .filter(Boolean);
      const primary = normalizeInstituteLabel(item.tests?.institute || item.source?.institute || '');
      if (primary && !normalized.includes(primary)) normalized.push(primary);
      return Array.from(new Set(normalized));
    })();

    const availableExplSourceMap = new Map<string, string>();
    normalizedExplanations.forEach((e: any) => {
      availableExplSourceMap.set(e.sourceKey, e.source);
    });
    inferredInstitutes.forEach((label: string) => {
      const key = String(label || '').toLowerCase();
      if (key && !availableExplSourceMap.has(key)) {
        availableExplSourceMap.set(key, label);
      }
    });

    const availableExplSources = Array.from(availableExplSourceMap.entries()).map(([key, label]) => ({ key, label }));

    const selectedExplSourceRaw = activeExplSource[item.id] || 'all';
    const selectedExplSource = selectedExplSourceRaw === 'all' || availableExplSourceMap.has(selectedExplSourceRaw)
      ? selectedExplSourceRaw
      : 'all';

    const sourceFilteredExplanations = selectedExplSource === 'all'
      ? normalizedExplanations
      : normalizedExplanations.filter((e: any) => e.sourceKey === selectedExplSource);

    const displayExplanations = sourceFilteredExplanations.length > 0
      ? sourceFilteredExplanations
      : (selectedExplSource !== 'all'
          ? [{
              source: availableExplSourceMap.get(selectedExplSource) || selectedExplSource,
              sourceKey: selectedExplSource,
              program: String(item.tests?.program_name || '').trim(),
              year: String(item.exam_year || '').trim(),
              answer: String(item.correct_answer || '').trim().toUpperCase(),
              text: '',
            }]
          : normalizedExplanations);

    const rawIdx = activeExplIndex[item.id] ?? -1;
    const safeIdx = rawIdx >= 0 && rawIdx < displayExplanations.length ? rawIdx : -1;
    const activeExplanationText = safeIdx === -1
      ? (displayExplanations.length > 1
          ? displayExplanations
              .map((e: any) => `**${formatMetaLine(e) || e.source}${e.answer ? ' · Ans: ' + e.answer : ''}:**\n\n${e.text || '*No explanation provided.*'}`)
              .join('\n\n---\n\n')
          : (displayExplanations[0]?.text || item.explanation_markdown || 'No explanation available.'))
      : (displayExplanations[safeIdx]
          ? (displayExplanations[safeIdx].text || '*No explanation provided by this source.*')
          : (item.explanation_markdown || 'No explanation available.'));

    const activeExplanationMeta = safeIdx >= 0 && displayExplanations[safeIdx]
      ? formatMetaLine(displayExplanations[safeIdx])
      : '';


    return (
      <View style={[styles.questionCard, { backgroundColor: isZenMode ? 'transparent' : colors.surface, borderColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border, borderWidth: isZenMode ? 0 : 1 }]}>
        <View style={styles.qHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <View style={[styles.qNumberBadge, { backgroundColor: isZenMode ? '#433422' : colors.primary }]}>
                <Text style={[styles.qNumberText, { color: isZenMode ? '#F4ECD8' : colors.buttonText }]}>{index + 1}</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {(() => {
              const pyq = getPYQCategorization(item);
              const hasTags = showPYQTags && (pyq.hasPYQData || item.is_ncert || item.exam_info?.is_ncert || item.source?.is_ncert);
              if (!hasTags) return null;

              const chips: { label: string; bg: string; fg: string; border: string }[] = [];
              if (pyq.hasPYQData && pyq.isUPSC) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#dcfce7', fg: isZenMode ? '#433422' : '#15803d', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#22c55e' });
              if (pyq.hasPYQData && pyq.isAllied) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#fef9c3', fg: isZenMode ? '#433422' : '#a16207', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#eab308' });
              if (pyq.hasPYQData && pyq.isOther) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#f1f5f9', fg: isZenMode ? '#433422' : '#475569', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#94a3b8' });
              if (pyq.hasPYQData && pyq.isGenericPYQ) chips.push({ label: `${pyq.groupName} ${pyq.year}`.trim(), bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : colors.primary + '10', fg: isZenMode ? '#433422' : colors.primary, border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : colors.primary });
              if (item.is_ncert || item.exam_info?.is_ncert || item.source?.is_ncert || item.micro_topic === 'NCERT') chips.push({ label: 'NCERT', bg: isZenMode ? 'rgba(67, 52, 34, 0.05)' : '#e0f2fe', fg: isZenMode ? '#433422' : '#0369a1', border: isZenMode ? 'rgba(67, 52, 34, 0.2)' : '#0ea5e9' });

              if (chips.length === 0) return null;

              // NOTE: Institute chips intentionally omitted here. Institute/program/year
              // metadata is rendered as a single canonical line inside the explanation
              // card (see formatMetaLine usage below) to avoid multi-layer duplication.

              return (
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {chips.map((chip, idx) => (
                    <View key={`chip-${item.id}-${idx}`} style={[styles.inlineBadge, { backgroundColor: chip.bg, borderColor: chip.border, paddingHorizontal: 6, paddingVertical: 2, height: 20 }]}> 
                      <Text style={{ color: chip.fg, fontWeight: '900', fontSize: 9 }}>{chip.label}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
            
            <TouchableOpacity 
              onPress={() => store.setMetadata(item.id, { isReview: !answerData.isReview }, arenaMode === 'exam')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: answerData.isReview ? (isZenMode ? '#43342220' : '#fef9c3') : 'transparent' }}
            >
               <Flag size={18} color={answerData.isReview ? (isZenMode ? '#433422' : '#eab308') : (isZenMode ? '#43342240' : colors.textTertiary)} fill={answerData.isReview ? (isZenMode ? '#433422' : '#eab308') : 'transparent'} />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                const activeText = activeExplanationText || item.explanation_markdown || '';
                setNoteDraftBullets([activeText || '']); 
                setCustomSubheading(item.micro_topic || '');
                setNotebookModalVisible(true);
                fetchHierarchy();
              }}
            >
               <BookOpen 
                 size={20} 
                 color={isZenMode ? '#43342240' : colors.textTertiary} 
               />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleAddToFlashcards(item)}
              disabled={savingFlashcard[item.id]}
            >
               {savingFlashcard[item.id] ? (
                 <ActivityIndicator size="small" color={colors.primary} />
               ) : (
                 <Zap 
                   size={20} 
                   color={flashcardedIds.has(item.id) ? (isZenMode ? '#433422' : colors.primary) : (isZenMode ? '#43342240' : colors.textTertiary)} 
                   fill={flashcardedIds.has(item.id) ? (isZenMode ? '#433422' : colors.primary) : 'transparent'} 
                 />
               )}
            </TouchableOpacity>
            {!!item.test_id && params.testId !== item.test_id && (
              <TouchableOpacity
                testID={`engine-view-source-header-${item.id}`}
                onPress={() => handleViewSource(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                 <ExternalLink
                   size={20}
                   color={isZenMode ? '#43342240' : colors.textTertiary}
                 />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Markdown style={{ body: { color: zenTextColor, fontSize: fontSize, lineHeight: fontSize * 1.5, fontWeight: '500', fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) } }}>
          {item.statement_line || item.question_text}
        </Markdown>


        <View style={styles.optionsContainer}>
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
                disabled={arenaMode === 'learning' && showExplanation}
                fontSize={fontSize}
              />
            );
          })}
        </View>

        {arenaMode === 'learning' && !showExplanation && (
          <TouchableOpacity 
            style={[styles.revealBtn, { borderColor: colors.primary }]}
            onPress={() => { setRevealedExplanations(prev => ({ ...prev, [item.id]: true })); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <Lightbulb size={16} color={colors.primary} />
            <Text style={[styles.revealBtnText, { color: colors.primary }]}>Show Answer & Explanation</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.controls, { borderTopColor: colors.border }]}>
          {arenaMode === 'exam' && (
            <>
              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>CONFIDENCE</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                  {CONFIDENCE_LEVELS.map(level => (
                    <TouchableOpacity
                      key={level.value}
                      onPress={() => toggleGuess(item.id, answerData.selectedAnswer, level.value)}
                      style={[styles.chip, { backgroundColor: colors.bg, borderColor: colors.border }, answerData.confidence === level.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    >
                      <Text style={[styles.chipText, { color: answerData.confidence === level.value ? colors.buttonText : colors.textSecondary }]}>{level.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.controlRow}>
                <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>DIFFICULTY</Text>
                <View style={styles.difficultyRow}>
                  {DIFFICULTIES.map(diff => (
                    <TouchableOpacity
                      key={diff.value}
                      onPress={() => toggleDifficulty(item.id, diff.value)}
                      style={[styles.difficultyBtn, { borderColor: colors.border }, answerData.difficulty === diff.value && { backgroundColor: diff.color + '20', borderColor: diff.color }]}
                    >
                      <Text style={[styles.difficultyText, { color: answerData.difficulty === diff.value ? diff.color : colors.textSecondary }]}>{diff.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.controlRow}>
            <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>STUDY TAGS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
              {[...userStudyTags].sort((a, b) => {
                const aSelected = (answerData.studyTags || []).includes(a);
                const bSelected = (answerData.studyTags || []).includes(b);
                if (aSelected && !bSelected) return -1;
                if (!aSelected && bSelected) return 1;
                return 0;
              }).map(tag => (
                <TouchableOpacity
                  key={tag}
                  onPress={() => toggleStudyTag(item.id, answerData.studyTags || [], tag)}
                  style={[styles.chip, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, (answerData.studyTags || []).includes(tag) && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                >
                  <Text style={[styles.chipText, { color: (answerData.studyTags || []).includes(tag) ? colors.primary : colors.textSecondary }]}>{tag}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity 
                onPress={() => setIsAddingTag(true)}
                style={[styles.chip, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderStyle: 'dashed' }]}
              >
                <Plus size={14} color={colors.textTertiary} />
              </TouchableOpacity>
            </ScrollView>
          </View>

          {arenaMode === 'learning' && showExplanation && (
            <>
              <View style={[styles.explanationBox, { backgroundColor: colors.bg, marginBottom: 16 }]}>
                <View style={styles.explanationHeader}>
                   <Info size={16} color={colors.primary} />
                   <Text style={[styles.explanationTitle, { color: colors.primary }]}>EXPLANATION</Text>
                </View>

                {availableExplSources.length > 1 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={() => {
                        setActiveExplSource(prev => ({ ...prev, [item.id]: 'all' }));
                        setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }));
                      }}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: selectedExplSource === 'all' ? colors.primary : colors.surfaceStrong,
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === 'all' ? '#fff' : colors.textTertiary }}>
                        ALL INSTITUTES
                      </Text>
                    </TouchableOpacity>
                    {availableExplSources.map(({ key, label }: any) => (
                      <TouchableOpacity
                        key={`src-${item.id}-${key}`}
                        onPress={() => {
                          setActiveExplSource(prev => ({ ...prev, [item.id]: key }));
                          setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }));
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: selectedExplSource === key ? colors.primary : colors.surfaceStrong,
                          borderWidth: 1,
                          borderColor: colors.border
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: selectedExplSource === key ? '#fff' : colors.textTertiary }}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {displayExplanations.length > 1 && (
                  <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '30', flexWrap: 'wrap' }}>
                    <TouchableOpacity
                      onPress={() => setActiveExplIndex(prev => ({ ...prev, [item.id]: -1 }))}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 20,
                        backgroundColor: safeIdx === -1 ? colors.primary : colors.surfaceStrong,
                        borderWidth: 1,
                        borderColor: colors.border
                      }}
                    >
                      <Text style={{ fontSize: 10, fontWeight: '900', color: safeIdx === -1 ? '#fff' : colors.textTertiary }}>
                        COMBINED ({displayExplanations.length})
                      </Text>
                    </TouchableOpacity>
                    {displayExplanations.map((expl: any, idx: number) => (
                      <TouchableOpacity
                        key={`expl-${item.id}-${idx}`}
                        onPress={() => setActiveExplIndex(prev => ({ ...prev, [item.id]: idx }))}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 20,
                          backgroundColor: safeIdx === idx ? colors.primary : colors.surfaceStrong,
                          borderWidth: 1,
                          borderColor: colors.border
                        }}
                      >
                        <Text style={{ fontSize: 10, fontWeight: '900', color: safeIdx === idx ? '#fff' : colors.textTertiary }}>
                          {formatMetaLine(expl) || expl.source || `Source ${idx + 1}`}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Markdown style={{ body: { color: colors.textPrimary, fontSize: fontSize, lineHeight: fontSize * 1.5, fontWeight: '500', fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }) } }}>
                  {activeExplanationText}
                </Markdown>
              </View>

              {/* ── AI EXPLAIN / SUMMARIZE ─────────────────────────── */}
              <View style={{ marginTop: 4, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() => handleAiExplain(item)}
                  testID={`ai-explain-btn-${item.id}`}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 7,
                    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12,
                    backgroundColor: '#7c3aed18', borderWidth: 1, borderColor: '#7c3aed30',
                  }}
                >
                  {aiLoading[item.id] ? (
                    <ActivityIndicator size="small" color="#7c3aed" />
                  ) : (
                    <Brain size={15} color="#7c3aed" />
                  )}
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#7c3aed', flex: 1 }}>
                    {aiExplanations[item.id] ? 'AI EXPLANATION' : 'AI EXPLAIN'}
                  </Text>
                  {aiExplanations[item.id] && (
                    aiExpanded[item.id]
                      ? <ChevronUp size={14} color="#7c3aed" />
                      : <ChevronDown size={14} color="#7c3aed" />
                  )}
                </TouchableOpacity>

                {aiExpanded[item.id] && aiExplanations[item.id] && (
                  <View style={{
                    marginTop: 8, padding: 14,
                    backgroundColor: colors.surface, borderRadius: 12,
                    borderWidth: 1, borderColor: '#7c3aed20',
                  }}>
                    <Text style={{ fontSize: 13, color: colors.textPrimary, lineHeight: 20 }}>
                      {aiExplanations[item.id]}
                    </Text>

                    {!aiSummaries[item.id] && (
                      <TouchableOpacity
                        onPress={() => handleAiSummarize(item)}
                        testID={`ai-summarize-btn-${item.id}`}
                        style={{
                          marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6,
                          paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10,
                          backgroundColor: '#f59e0b18', borderWidth: 1, borderColor: '#f59e0b30',
                          alignSelf: 'flex-start',
                        }}
                      >
                        {aiSumLoading[item.id] ? (
                          <ActivityIndicator size="small" color="#f59e0b" />
                        ) : (
                          <Sparkles size={13} color="#f59e0b" />
                        )}
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b' }}>
                          ✨ SUMMARIZE INTO BULLETS
                        </Text>
                      </TouchableOpacity>
                    )}

                    {aiSummaries[item.id] && (
                      <View style={{
                        marginTop: 12, padding: 12,
                        backgroundColor: '#fef3c720', borderRadius: 10,
                        borderWidth: 1, borderColor: '#f59e0b25',
                      }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b', marginBottom: 6 }}>
                          ✨ KEY POINTS
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.textPrimary, lineHeight: 20 }}>
                          {aiSummaries[item.id]}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              <View style={styles.actionRow}>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => {
                     const activeText = activeExplanationText || item.explanation_markdown || '';
                     openNotebookFromQuestion(item, activeText);
                   }}
                 >
                    <BookOpen size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Notebook</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => {
                     const activeText = activeExplanationText || item.explanation_markdown || '';
                     openHardnoteFromQuestion(item, activeText);
                   }}
                   data-testid={`engine-hardnotes-btn-${item.id}`}
                 >
                    <PenTool size={16} color={colors.primary} />
                    <Text style={[styles.actionBtnText, { color: colors.primary }]}>Hardnotes</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.primary + '15' }]}
                   onPress={() => handleAddToFlashcards(item)}
                   disabled={savingFlashcard[item.id]}
                 >
                    {savingFlashcard[item.id] ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Zap size={16} color={colors.primary} />
                        <Text style={[styles.actionBtnText, { color: colors.primary }]}>Flashcard</Text>
                      </>
                    )}
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.actionBtn, { backgroundColor: colors.surfaceStrong }]}
                   onPress={() => handleQuickSave(item)}
                 >
                    <Save size={16} color={colors.textPrimary} />
                    <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>Save</Text>
                 </TouchableOpacity>
                 {!!item.test_id && params.testId !== item.test_id && (
                   <TouchableOpacity
                     testID={`engine-view-source-action-${item.id}`}
                     style={[styles.actionBtn, { backgroundColor: colors.surfaceStrong }]}
                     onPress={() => handleViewSource(item)}
                   >
                      <ExternalLink size={16} color={colors.textPrimary} />
                      <Text style={[styles.actionBtnText, { color: colors.textPrimary }]}>View Source</Text>
                   </TouchableOpacity>
                 )}
              </View>

              <View style={[styles.noteSection, { marginTop: 24, padding: 20, borderRadius: 24, backgroundColor: colors.surfaceStrong + '50', borderWidth: 1, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                    <View style={{ width: 3, height: 16, backgroundColor: colors.primary, marginRight: 8, borderRadius: 2 }} />
                    <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1 }}>YOUR INSIGHTS</Text>
                  </View>

                  <View style={[styles.controlRow, { marginBottom: 16 }]}>
                    <Text style={[styles.controlLabel, { color: colors.textTertiary }]}>MISTAKE TYPE</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
                      {ERROR_TYPES.map(type => (
                        <TouchableOpacity
                          key={type}
                          onPress={() => toggleMistakeType(item.id, type)}
                          style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }, answerData.errorCategory === type && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}
                        >
                          <Text style={[styles.chipText, { color: answerData.errorCategory === type ? colors.primary : colors.textSecondary }]}>{type}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  <View style={[styles.noteInputWrapper, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 16, borderStyle: 'dashed' }]}>
                      <TextInput
                        style={[styles.noteInput, { color: colors.textPrimary, padding: 16, minHeight: 80 }]}
                        placeholder="Double-tap to record your strategy..."
                        multiline
                        placeholderTextColor={colors.textSecondary || '#6B7280'}
                        value={answerData.note || ''}
                        onChangeText={(val) => store.setMetadata(item.id, { note: val }, false)}
                      />
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleCommitToMemory(item.id)}
                    style={{ marginTop: 16 }}
                  >
                    <LinearGradient 
                      colors={['#FF6B6B', '#7B2CBF']} 
                      locations={[0, 1]}
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 0 }} 
                      style={{ height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, shadowColor: '#7B2CBF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
                    >
                       <Save size={20} color="#fff" />
                       <Text style={{ color: '#fff', fontSize: 16, fontWeight: '900' }}>Commit to Memory</Text>
                    </LinearGradient>
                  </TouchableOpacity>
              </View>

              <View style={{ marginTop: 32, padding: 16, borderTopWidth: 1, borderTopColor: colors.border + '50' }}>
                 {(() => {
                   // Single-layer canonical metadata: INSTITUTE – PROGRAM – YEAR
                   const primaryEntry = displayExplanations[0] || {
                     source: normalizeInstituteLabel(item.tests?.institute || ''),
                     program: normalizeProgramLabel(String(item.tests?.program_name || '').trim()),
                     year: String(item.exam_year || '').trim(),
                   };
                   const line = formatMetaLine(primaryEntry);
                   if (!line) return null;
                   return (
                     <Text style={{ fontSize: 10, color: colors.textTertiary, textAlign: 'center', lineHeight: 16, fontWeight: '700', letterSpacing: 0.5 }}>
                        {line}
                     </Text>
                   );
                 })()}
              </View>
            </>
          )}
        </View>
      </View>
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
              onPress={() => store.setMetadata(item.id, { isReview: !answerData.isReview }, arenaMode === 'exam')}
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
          </View>
        </View>

        {/* Question stem */}
        <Markdown
          style={{
            body: {
              color: zenTextColor,
              fontSize: fontSize - 1,
              lineHeight: (fontSize - 1) * 1.5,
              fontWeight: '500',
              fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' }),
            },
          }}
        >
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



  const renderNotebookModal = () => {
    return (
      <NotebookModal
        visible={notebookModalVisible}
        onClose={() => setNotebookModalVisible(false)}
        onSave={commitToNotebook}
        folders={folders}
        notebooks={notebooks}
        subheadings={subheadings}
        selectedFolder={selectedFolder}
        setSelectedFolder={(f: any) => {
          setSelectedFolder(f);
          LocalQuery.from('user_note_nodes').select('*').eq('parent_id', f.id).eq('type', 'note').then(({ data }) => setNotebooks(data || []));
        }}
        selectedNotebook={selectedNotebook}
        setSelectedNotebook={(n: any) => {
          setSelectedNotebook(n);
          fetchSubheadings(n.note_id);
        }}
        selectedSubheading={selectedSubheading}
        setSelectedSubheading={setSelectedSubheading}
        isSaving={isSavingToNotebook}
        colors={colors}
        noteDraftBullets={noteDraftBullets}
        updateBullet={updateBullet}
        splitBullet={splitBullet}
        addBullet={addBullet}
        removeBullet={removeBullet}
        setSelection={setSelection}
        selection={selection}
        setActiveInputIndex={setActiveInputIndex}
        activeInputIndex={activeInputIndex}
        showNewFolderInput={showNewFolderInput}
        setShowNewFolderInput={setShowNewFolderInput}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        createNewFolder={createNewFolder}
        showNewNotebookInput={showNewNotebookInput}
        setShowNewNotebookInput={setShowNewNotebookInput}
        newNotebookName={newNotebookName}
        setNewNotebookName={setNewNotebookName}
        createNewNotebook={createNewNotebook}
        showCustomSubheadingInput={showCustomSubheadingInput}
        setShowCustomSubheadingInput={setShowCustomSubheadingInput}
        customSubheading={customSubheading}
        setCustomSubheading={setCustomSubheading}
        microtopic={questions[currentIndex]?.micro_topic}
        applyFormatting={applyFormatting}
        openLocationPicker={() => setLocationPickerVisible(true)}
        richEditorRef={notebookRichEditorRef}
      />
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
        <View style={[styles.header, { borderBottomColor: isZenMode ? 'rgba(67, 52, 34, 0.1)' : colors.border }]}>
          <TouchableOpacity onPress={handleExit} style={styles.headerBtn}>
            <ChevronLeft size={24} color={isZenMode ? '#433422' : colors.textPrimary} />
          </TouchableOpacity>
          
          <View style={styles.headerTitleContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                {showIndex ? 'Arena Index' : `Q${currentIndex + 1}/${questions.length}`}
              </Text>

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
            <TouchableOpacity onPress={toggleZenMode} style={styles.headerBtn}>
              <Sparkles size={20} color={isZenMode ? '#433422' : colors.primary} />
            </TouchableOpacity>
            {/* Paper / List view toggle (always visible). 'paper' = Simulated Exam Mode. */}
            <TouchableOpacity
              onPress={() => {
                setViewMode(prev => prev === 'paper' ? 'list' : 'paper');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              }}
              style={[styles.headerBtn, viewMode === 'paper' && { backgroundColor: (isZenMode ? '#43342220' : colors.primary + '15'), borderRadius: 10 }]}
              testID="engine-paper-toggle"
            >
              <BookOpen size={20} color={viewMode === 'paper' ? (isZenMode ? '#433422' : colors.primary) : (isZenMode ? '#433422' : colors.textPrimary)} />
            </TouchableOpacity>
            {/* Palette / Navigator — promoted out of the quick menu so it's
                always one tap away (essential during a paper-style exam). */}
            <TouchableOpacity
              onPress={() => setShowNavigator(true)}
              style={styles.headerBtn}
              testID="engine-palette-btn"
            >
              <LayoutGrid size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowModelSwitcher(true)}
              style={styles.headerBtn}
              testID="engine-ai-switcher-btn"
            >
              <Brain size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
            </TouchableOpacity>
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
              <TouchableOpacity onPress={() => setShowIndex(true)} style={styles.headerBtn}>
                <ListIcon size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setShowQuickMenu(!showQuickMenu)} style={styles.headerBtn}>
              <MoreVertical size={20} color={isZenMode ? '#433422' : colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
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
              <TouchableOpacity
                style={stylesPaper.paperQuickMenuItem}
                onPress={() => { setShowPaperQuickMenu(false); handleExit(); }}
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


                  <TouchableOpacity 
                    style={styles.utilBtn} 
                    onPress={() => { setShowPYQTags(!showPYQTags); setShowQuickMenu(false); }}
                  >
                    <Text style={{ fontWeight: '900', color: showPYQTags ? colors.primary : colors.textTertiary, fontSize: 10 }}>PYQ</Text>
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
                            setTimeout(() => {
                              if (viewMode === 'paper') {
                                setPaperPage(Math.floor(idx / paperPageSize));
                                setCurrentIndex(idx);
                              } else if (viewMode === 'card') { 
                                setCurrentIndex(idx); 
                              } else {
                                // List view: use robust scroll helper
                                setCurrentIndex(idx);
                                scrollToIndexRobust(idx);
                              }
                            }, 100);
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
                  initialScrollIndex={currentIndex >= 0 ? currentIndex : undefined}
                  contentContainerStyle={styles.listContent}
                  onViewableItemsChanged={onViewableItemsChanged}
                  viewabilityConfig={viewabilityConfig}
                  initialNumToRender={10}
                  maxToRenderPerBatch={5}
                  windowSize={5}
                  removeClippedSubviews={Platform.OS === 'android'}
                  onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                      listRef.current?.scrollToIndex({ index: info.index, animated: false });
                    });
                  }}
                />
              ) : (
                <View style={{ flex: 1 }}>
                  <ScrollView>{renderQuestionBlock({ item: questions[currentIndex], index: currentIndex })}</ScrollView>
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
            )}
          </>
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
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: safeIdx === i ? colors.primary : colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text style={{ fontSize: 10, fontWeight: '900', color: safeIdx === i ? colors.buttonText : colors.textTertiary }}>
                            {String(e.source).toUpperCase()}{e.year ? ' · ' + e.year : ''}
                          </Text>
                        </TouchableOpacity>
                      ))}
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
                    <Markdown
                      style={{
                        body: {
                          color: colors.textPrimary,
                          fontSize: fontSize,
                          lineHeight: fontSize * 1.55,
                          fontWeight: '500',
                          fontFamily: Platform.select({ ios: 'System', android: 'sans-serif', default: 'System' }),
                        },
                      }}
                    >
                      {text}
                    </Markdown>

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
                      onPress={() => store.setMetadata(q.id, { isReview: !ans.isReview }, arenaMode === 'exam')}
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
                        openNotebookFromQuestion(
                          q,
                          text,
                          { closeExplanation: true }
                        );
                      }}
                      style={[stylesPaper.stickyBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}
                      testID="paper-modal-notebook"
                    >
                      <BookOpen size={14} color={colors.textPrimary} />
                      <Text style={[stylesPaper.stickyBtnText, { color: colors.textPrimary }]}>Save to Notebook</Text>
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

        {renderNotebookModal()}
        <SaveNameModal 
          visible={showSaveNameModal}
          onClose={() => setShowSaveNameModal(false)}
          onSave={commitManualSave}
          value={customTestName}
          setValue={setCustomTestName}
          isSaving={isSavingAttempt}
        />

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
                    router.replace('/(tabs)/analyse');
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
        <NotebookLocationPicker
          visible={locationPickerVisible}
          onClose={() => setLocationPickerVisible(false)}
          userId={session?.user?.id || ''}
          onPickNotebook={async ({ node_id, note_id, title, folder_id }) => {
            // Resolve folder node (or null) for the existing chip-driven flow
            let folderNode: any = null;
            if (folder_id) {
              const { data } = await LocalQuery.from('user_note_nodes').select('*').eq('id', folder_id).maybeSingle();
              folderNode = data;
            }
            if (folderNode) {
              setSelectedFolder(folderNode);
              const { data: nbList } = await LocalQuery.from('user_note_nodes').select('*').eq('parent_id', folderNode.id).eq('type', 'note');
              setNotebooks(nbList || []);
            } else {
              setSelectedFolder(null);
              setNotebooks([]);
            }
            const notebookNode = { id: node_id, title, note_id };
            setSelectedNotebook(notebookNode as any);
            fetchSubheadings(note_id);
          }}
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
      </SafeAreaView>
    </PageWrapper>
  );
}

const NotebookModal = (props: any) => {
  const { colors } = props;
  const [showPicker, setShowPicker] = React.useState(false);
  const HIGHLIGHT_COLORS = ['transparent', '#FF6A88', '#6A5BFF', '#4FC3F7', '#81C784', '#FFB74D', '#BA68C8'];
  const [highlightColor, setHighlightColor] = React.useState('#FFF59D');

  React.useEffect(() => {
    AsyncStorage.getItem('notes_editor_highlight_color').then(v => { if (v) setHighlightColor(v); });
  }, []);

  return (
    <Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={props.onClose} />
        
        <SafeAreaView style={{ flex: 1 }} pointerEvents="box-none">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            style={{ flex: 1 }}
            pointerEvents="box-none"
          >
            <View style={{ flex: 1, backgroundColor: colors.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: 60, overflow: 'hidden' }}>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <TouchableOpacity onPress={props.onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                  <X size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary }}>Notebook Editor</Text>
                  <Text style={{ fontSize: 10, color: colors.textTertiary }}>Drafting insights...</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                   <TouchableOpacity 
                     onPress={() => props.openLocationPicker?.()}
                     style={{ height: 36, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '15', borderRadius: 12, flexDirection: 'row', gap: 4 }}
                   >
                      <BookOpen size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 11 }} numberOfLines={1}>
                        {props.selectedNotebook?.title ? props.selectedNotebook.title.slice(0, 10) : 'LOCATION'}
                      </Text>
                   </TouchableOpacity>
                </View>
              </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 80 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, margin: 12, marginBottom: 0, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
              <RichToolbar
                editor={props.richEditorRef}
                getEditor={() => props.richEditorRef?.current}
                selectedIconTint={colors.primary}
                iconTint={colors.textPrimary}
                style={{ backgroundColor: colors.surface }}
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.setStrikethrough,
                  actions.heading1,
                  actions.heading2,
                  actions.insertBulletsList,
                  actions.insertOrderedList,
                  actions.checkboxList,
                  actions.blockquote,
                  'highlight',
                  actions.undo,
                  actions.redo,
                ]}
                iconMap={{
                  [actions.heading1]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '900', fontSize: 14 }}>H1</Text>,
                  [actions.heading2]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '800', fontSize: 12 }}>H2</Text>,
                  highlight: ({ tintColor }: any) => (
                    <View style={{ padding: 4, borderRadius: 4, backgroundColor: highlightColor === 'transparent' ? 'transparent' : highlightColor }}>
                      <Highlighter size={16} color={tintColor} />
                    </View>
                  ),
                }}
                highlight={() => {
                  setShowPicker(v => !v);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              />
              {showPicker && (
                <View style={{ flexDirection: 'row', gap: 12, padding: 12, borderTopWidth: 1, borderTopColor: colors.border, justifyContent: 'center', backgroundColor: colors.surface, flexWrap: 'wrap' }}>
                  {HIGHLIGHT_COLORS.map(c => (
                    <TouchableOpacity 
                      key={c} 
                      onPress={async () => {
                        setHighlightColor(c);
                        await AsyncStorage.setItem('notes_editor_highlight_color', c);
                        setShowPicker(false);
                        props.richEditorRef?.current?.focusContentEditor?.();
                        setTimeout(() => {
                          if (c === 'transparent') {
                            props.richEditorRef?.current?.commandDOM?.("document.execCommand('hiliteColor', false, 'transparent'); document.execCommand('backColor', false, 'transparent')");
                          } else {
                            props.richEditorRef?.current?.commandDOM?.(`document.execCommand('hiliteColor', false, '${c}')`);
                          }
                        }, 50);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }} 
                      style={{ 
                        width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
                        borderWidth: 2, backgroundColor: c === 'transparent' ? colors.surfaceStrong : c, 
                        borderColor: c === highlightColor ? colors.primary : 'transparent' 
                      }} 
                    >
                      {c === 'transparent' && <Eraser size={14} color={colors.textSecondary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={{ padding: 16, minHeight: 300 }}>
              <RichNoteEditor
                ref={props.richEditorRef}
                html={props.noteDraftBullets?.[0] || ''}
                onChange={(html: string) => props.updateBullet(0, html)}
                themeColors={{
                  bg: colors.bg,
                  surface: colors.surface,
                  textPrimary: colors.textPrimary,
                  border: colors.border,
                  primary: colors.primary,
                }}
                placeholder="Capture your insight... Use the toolbar above for formatting."
              />
            </View>

              <View style={{ height: 24 }} />
              <Text style={[styles.modalLabel, { color: colors.textTertiary, letterSpacing: 1 }]}>SAVE LOCATION</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 10 }}>
                {props.selectedNotebook?.title
                  ? `Selected: ${props.selectedFolder?.title ? props.selectedFolder.title + ' / ' : ''}${props.selectedNotebook.title}`
                  : 'Tap LOCATION at top, or pick below'}
              </Text>
              <ScrollView horizontal style={{ marginBottom: 16 }}>
                {props.folders.map((f: any) => (
                  <TouchableOpacity key={f.id} onPress={() => props.setSelectedFolder(f)} style={[styles.modalChip, { borderColor: colors.border }, props.selectedFolder?.id === f.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={{ color: props.selectedFolder?.id === f.id ? '#fff' : colors.textPrimary }}>{f.title}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => props.setShowNewFolderInput(true)} style={[styles.modalChip, { borderColor: colors.border, borderStyle: 'dashed', paddingHorizontal: 12, justifyContent: 'center' }]}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>+ New Folder</Text>
                </TouchableOpacity>
              </ScrollView>

              {props.showNewFolderInput && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                  <TextInput 
                    style={{ flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, color: colors.textPrimary }}
                    placeholder="Folder Name"
                    placeholderTextColor={colors.textTertiary}
                    value={props.newFolderName}
                    onChangeText={props.setNewFolderName}
                  />
                  <TouchableOpacity onPress={props.createNewFolder} style={{ width: 40, height: 40, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {props.selectedFolder && (
                <>
                  <Text style={[styles.modalLabel, { color: colors.textTertiary }]}>NOTEBOOK</Text>
                  <ScrollView horizontal style={{ marginBottom: 16 }}>
                    {props.notebooks.map((n: any) => (
                      <TouchableOpacity key={n.id} onPress={() => props.setSelectedNotebook(n)} style={[styles.modalChip, { borderColor: colors.border }, props.selectedNotebook?.id === n.id && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                        <Text style={{ color: props.selectedNotebook?.id === n.id ? '#fff' : colors.textPrimary }}>{n.title}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity onPress={() => props.setShowNewNotebookInput(true)} style={[styles.modalChip, { borderColor: colors.border, borderStyle: 'dashed', paddingHorizontal: 12, justifyContent: 'center' }]}>
                      <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>+ New Notebook</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {props.showNewNotebookInput && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                      <TextInput 
                        style={{ flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, color: colors.textPrimary }}
                        placeholder="Notebook Name"
                        placeholderTextColor={colors.textTertiary}
                        value={props.newNotebookName}
                        onChangeText={props.setNewNotebookName}
                      />
                      <TouchableOpacity onPress={props.createNewNotebook} style={{ width: 40, height: 40, backgroundColor: colors.primary, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={16} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {props.selectedNotebook && (
                <>
                  <Text style={[styles.modalLabel, { color: colors.textTertiary }]}>SUBHEADING</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                    {(() => {
                      const micro = props.microtopic;
                      const last = props.selectedSubheading;
                      const others = (props.subheadings || []).filter((s: string) => s !== micro && s !== last);
                      
                      const list = [];
                      if (micro) list.push(micro);
                      if (last && last !== micro) list.push(last);
                      list.push(...others);
                      
                      return list.map((s: string) => (
                        <TouchableOpacity 
                          key={s} 
                          onPress={() => { props.setSelectedSubheading(s); props.setCustomSubheading(''); }} 
                          style={[
                            styles.modalChip, 
                            { borderColor: colors.border }, 
                            props.selectedSubheading === s && { backgroundColor: colors.primary, borderColor: colors.primary },
                            s === props.microtopic && props.selectedSubheading !== s && { borderColor: colors.primary + '50', borderStyle: 'dashed' }
                          ]}
                        >
                          <Text style={{ color: props.selectedSubheading === s ? '#fff' : colors.textPrimary, fontWeight: s === props.microtopic ? '900' : '500' }}>
                            {s} {s === props.microtopic ? '(Topic)' : ''}
                          </Text>
                        </TouchableOpacity>
                      ));
                    })()}
                    <TouchableOpacity onPress={() => props.setShowCustomSubheadingInput(true)} style={[styles.modalChip, { borderColor: colors.border, borderStyle: 'dashed', paddingHorizontal: 12, justifyContent: 'center' }]}>
                      <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>+ Custom</Text>
                    </TouchableOpacity>
                  </ScrollView>

                  {(props.showCustomSubheadingInput || props.customSubheading || props.subheadings.length === 0) && (
                    <View style={{ marginBottom: 16 }}>
                      <TextInput 
                        style={{ flex: 1, height: 40, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, color: colors.textPrimary }}
                        placeholder="Custom Subheading (e.g. Microtopic)"
                        placeholderTextColor={colors.textTertiary}
                        value={props.customSubheading}
                        onChangeText={(t) => { props.setCustomSubheading(t); props.setSelectedSubheading(''); }}
                      />
                    </View>
                  )}
                </>
              )}

              <TouchableOpacity onPress={props.onSave} style={[styles.launchBtn, { backgroundColor: colors.primary }]}>
                {props.isSaving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900' }}>SAVE</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
      </View>
    </Modal>
  );
};

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
