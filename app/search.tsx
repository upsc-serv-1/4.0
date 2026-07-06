import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Image,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  SlidersHorizontal,
  BookOpen,
  Target,
  Zap,
  Brain,
  Layers,
  Filter,
  Check,
  Palette,
  Flag,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PinchGestureHandler, State } from 'react-native-gesture-handler';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { useCourse } from '../src/context/CourseContext';
import { OfflineManager } from '../src/services/OfflineManager';
import { aiExpandSearchQuery } from '../src/services/GeminiService';
import { SharedQuestionCard } from '../src/components/unified/SharedQuestionCard';
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
import { DetailedQuestionView, ValueAddCardBody, getMarkdownRules, parseIntroductoryBox } from './mains';
import { buildMarkdownStyles } from '../src/utils/markdownUtils';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { getPYQCategorization } from '../src/utils/questionUtils';
import { fetchBestAnswer, BestAnswer } from '../src/services/BestAnswerService';
import { supabase } from '../src/lib/supabase';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IPAD = SCREEN_WIDTH >= 768;

type UnifiedSearchResult = {
  id: string;
  type: 'prelims' | 'mains' | 'value_add';
  title: string;
  subtitle?: string;
  subject?: string;
  paper?: string;
  year?: number;
  score: number;
  rawItem: any;
};

type UnifiedFilters = {
  showPrelims: boolean;
  showMains: boolean;
  showValueAdd: boolean;
  pyqFilter: 'All' | 'PYQ Only' | 'Non-PYQ';
  examCategory: 'All' | 'UPSC' | 'Allied' | 'Others';
  ncertFilter: 'All' | 'NCERT Only' | 'Non-NCERT';
  subjects: string[];
  mainsPapers: string[];
  institutes: string[];
  programmes: string[];
  searchAcross: ('Question' | 'Explanation' | 'Options')[];
};

const DEFAULT_FILTERS: UnifiedFilters = {
  showPrelims: true,
  showMains: true,
  showValueAdd: true,
  pyqFilter: 'All',
  examCategory: 'All',
  ncertFilter: 'All',
  subjects: [],
  mainsPapers: [],
  institutes: [],
  programmes: [],
  searchAcross: ['Question'],
};

// Subject color mapper from Prelims AI search
function getSubjectColor(sub: string): string {
  const map: Record<string, string> = {
    history: '#b91c1c',
    polity: '#1d4ed8',
    economy: '#059669',
    geography: '#d97706',
    science: '#7c3aed',
    environment: '#0891b2',
    international: '#db2777',
    current: '#4b5563',
  };
  const key = (sub || '').toLowerCase();
  for (const [k, v] of Object.entries(map)) if (key.includes(k)) return v;
  return '#94a3b8';
}

function getStageIndicatorColor(type: 'prelims' | 'mains' | 'value_add'): string {
  if (type === 'prelims') return '#3b82f6'; // Blue
  if (type === 'mains') return '#f97316';   // Amber/Orange (not pink!)
  return '#22c55e';                         // Green
}

function getPYQChipStyle(pyq: any) {
  if (!pyq.hasPYQData) return null;
  if (pyq.isUPSC)    return { bg: '#dcfce7', color: '#15803d' };
  if (pyq.isAllied)  return { bg: '#fef9c3', color: '#a16207' };
  if (pyq.isOther)   return { bg: '#f1f5f9', color: '#475569' };
  return { bg: '#ede9fe', color: '#7c3aed' };
}

const getQuestionSortTier = (item: UnifiedSearchResult): number => {
  const raw = item.rawItem;
  const isPyq = item.type === 'prelims' ? raw.is_pyq : (raw.is_pyq || raw.isPyq);
  if (!isPyq) return 3; // Non-PYQ is lowest tier

  if (item.type === 'prelims') {
    if (raw.is_upsc_cse) return 0; // UPSC PYQ
    if (raw.is_allied) return 1;   // UPSC Allied PYQ
    if (raw.is_others) return 2;   // Other PYQ
    return 0; // default PYQ is UPSC
  } else {
    // Mains question
    return 0; // default Mains PYQ is UPSC
  }
};

const cleanMainsMarkdownText = (text: string | undefined | null): string => {
  if (!text) return '';
  
  // 1. Convert HTML img tags to Markdown images
  let cleaned = text.replace(
    /<img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*\/?>|<img\s+[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']+)["'][^>]*\/?>|<img\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi,
    (match, src1, alt1, alt2, src2, src3) => {
      const src = src1 || src2 || src3 || '';
      const alt = alt1 || alt2 || 'Image';
      return `![${alt}](${src})`;
    }
  );

  // 2. Replace <br> tags with newlines
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');

  // 3. Replace &nbsp; with spaces
  cleaned = cleaned.replace(/&nbsp;/gi, ' ');

  return cleaned.trim();
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

function getValueAddTypeLabel(va: any): string {
  const cat = va.category;
  if (cat === 'data_facts') return 'Data & Facts';
  if (cat === 'intro_conclusion') return 'Intro & Conclusion';
  if (cat === 'quotes') return 'Quotes';
  if (cat === 'mnemonics') return 'Mnemonics';
  if (cat === 'frameworks') return 'Frameworks';
  if (cat === 'ethics') {
    const et = va.ethicsType || '';
    return et ? `Ethics (${et.toUpperCase()})` : 'Ethics';
  }
  return cat || 'Value Add';
}

function getValueAddItemTextContent(va: any): string {
  const parts = [
    va.title || '',
    va.metric || '',
    va.context || '',
    va.source || '',
    va.introduction || '',
    va.conclusion || '',
    va.quoteText || '',
    va.author || '',
    va.usageGuide || '',
    va.mnemonicKeyword || '',
    va.frameworkGuide || '',
    va.rawContent || '',
    va.examples || '',
    va.data_points || '',
  ];
  
  if (va.mnemonicExpansion) {
    va.mnemonicExpansion.forEach((item: any) => {
      parts.push(item.letter || '', item.meaning || '', item.detail || '');
    });
  }
  
  if (va.frameworkBoxes) {
    va.frameworkBoxes.forEach((box: any) => {
      parts.push(box.label || '', box.description || '');
    });
  }
  
  if (va.ethicsData) {
    const ed = va.ethicsData;
    parts.push(
      ed.diagramDescription || '',
      ed.officerName || '',
      ed.initiative || '',
      ed.impact || '',
      ed.values || '',
      ed.keywordDefinition || '',
      ed.keywordExample || ''
    );
    if (ed.dimensionsList) {
      parts.push(...ed.dimensionsList);
    }
    if (ed.comparisonPoints) {
      ed.comparisonPoints.forEach((p: any) => {
        parts.push(p.criteria || '', p.termA || '', p.termB || '');
      });
    }
  }

  return parts.join(' ');
}

const wholeWordRegex = (word: string): RegExp =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

const hasWholeWord = (text: string, word: string): boolean =>
  wholeWordRegex(word).test(text);

function highlightKeywords(text: string, allKeywords: string[]): React.ReactNode {
  const matchingKws = allKeywords.filter(k => k.length > 2 && hasWholeWord(text, k));
  if (!matchingKws.length) return <Text>{text}</Text>;
  const escaped = matchingKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part)
      ? <Text key={i} style={{ fontWeight: '800', color: '#f59e0b', backgroundColor: '#fef3c720' }}>{part}</Text>
      : <Text key={i}>{part}</Text>
  );
}

function buildContextSnippet(
  text: string,
  keywords: string[],
  options?: Record<string, string> | null,
  explanation?: string | null,
  rawTerm?: string,
  maxContextWords: number = 12,
): React.ReactNode {
  if (!text && !options && !explanation) return null;

  if (rawTerm && rawTerm.length > 2) {
    const rawWords = rawTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    for (const word of rawWords) {
      if (hasWholeWord(text || '', word)) {
        return buildSnippetFromField(text || '', word, '', maxContextWords);
      }
    }
  }

  const textKw = keywords.find(k => k.length > 2 && hasWholeWord(text || '', k));
  if (textKw) {
    return buildSnippetFromField(text || '', textKw, '', maxContextWords);
  }

  if (options) {
    const optsText = Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(' ');
    const optsKw = keywords.find(k => k.length > 2 && hasWholeWord(optsText, k));
    if (optsKw) {
      return buildSnippetFromField(optsText, optsKw, '(Options)', maxContextWords);
    }
  }

  if (explanation) {
    const explKw = keywords.find(k => k.length > 2 && hasWholeWord(explanation, k));
    if (explKw) {
      return buildSnippetFromField(explanation, explKw, '(Explanation)', maxContextWords);
    }
  }

  const fallbackText = (text || '').slice(0, 120);
  return <Text>{fallbackText}{fallbackText.length >= 120 ? '...' : ''}</Text>;
}

function buildSnippetFromField(
  fieldText: string,
  keyword: string,
  label: string,
  maxContextWords: number,
): React.ReactNode {
  const match = fieldText.match(wholeWordRegex(keyword));
  if (!match || match.index === undefined) {
    return <Text>{fieldText.slice(0, 120)}</Text>;
  }
  const matchIdx = match.index;
  const matchEnd = matchIdx + match[0].length;
  const beforeText = fieldText.slice(0, matchIdx);
  const beforeWords = beforeText.split(/\s+/).filter(Boolean);
  const contextBefore = beforeWords.slice(-maxContextWords).join(' ');
  const hasMoreBefore = beforeWords.length > maxContextWords;

  const afterText = fieldText.slice(matchEnd);
  const afterWords = afterText.split(/\s+/).filter(Boolean);
  const contextAfter = afterWords.slice(0, maxContextWords).join(' ');
  const hasMoreAfter = afterWords.length > maxContextWords;

  const prefix = hasMoreBefore ? '... ' : '';
  const suffix = hasMoreAfter ? ' ...' : '';
  const labelPrefix = label ? `${label} ` : '';
  const snippet = `${labelPrefix}${prefix}${contextBefore} ${keyword} ${contextAfter}${suffix}`;

  return highlightKeywords(snippet, [keyword]);
}

const getCleanAvailableAnswers = (answers: any[]): any[] => {
  return (answers || []).filter(a => a && a.answerText && a.answerText.trim().length > 0);
};

const MainsResultAnswerPanel = ({
  rawItem,
  colors,
  isDark,
  mdStyles,
  mdRules,
  router,
}: {
  rawItem: any;
  colors: any;
  isDark: boolean;
  mdStyles: any;
  mdRules: any;
  router: any;
}) => {
  const cleanAnswers = getCleanAvailableAnswers(rawItem.answers || []);
  const [activeTab, setActiveTab] = React.useState(cleanAnswers[0]?.institute || '');

  if (cleanAnswers.length === 0) return null;

  const activeAns = cleanAnswers.find(a => a.institute === activeTab) || cleanAnswers[0];
  if (!activeAns) return null;

  const parsedApproach = parseIntroductoryBox(activeAns.answerText);
  const remainingText = parsedApproach 
    ? (activeAns.answerText || '').replace(parsedApproach.rawMatch, '').trim()
    : (activeAns.answerText || '');

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <BookOpen size={12} color={colors.textTertiary} />
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>MODEL ANSWER</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {cleanAnswers.length > 1 && (
            <View style={{ flexDirection: 'row', gap: 4, backgroundColor: colors.surfaceStrong, borderRadius: 8, padding: 2 }}>
              {cleanAnswers.map(ans => {
                const isTabActive = ans.institute === activeTab;
                return (
                  <TouchableOpacity
                    key={ans.institute}
                    onPress={() => setActiveTab(ans.institute)}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 6,
                      backgroundColor: isTabActive ? colors.primary + '15' : 'transparent',
                      borderWidth: 1,
                      borderColor: isTabActive ? colors.primary + '30' : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: isTabActive ? '700' : '500', color: isTabActive ? colors.primary : colors.textTertiary }}>
                      {ans.institute}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <TouchableOpacity
            onPress={() => {
              router.push({
                pathname: '/mains',
                params: {
                  initialScreen: 'questions',
                  questionId: rawItem.id,
                }
              } as any);
            }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          >
            <ExternalLink size={12} color={colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Open in QB</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.inlineMainsAnswer}>
        {parsedApproach && (
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
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#3b82f6', letterSpacing: 1 }}>{parsedApproach.title}</Text>
            </View>
            <Markdown style={mdStyles} rules={mdRules}>
              {cleanMainsMarkdownText(parsedApproach.body)}
            </Markdown>
          </View>
        )}
        <Markdown style={mdStyles} rules={mdRules}>
          {cleanMainsMarkdownText(remainingText)}
        </Markdown>
      </View>
    </View>
  );
};

export default function IntegratedSearchScreen() {
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { selectedCourse } = useCourse();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Core Search States
  const [query, setQuery] = useState('');
  const [searchEngineMode, setSearchEngineMode] = useState<'AI' | 'AI+Fuzzy' | 'Matching' | 'Exact'>('AI');
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<UnifiedSearchResult[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [excludedKeywords, setExcludedKeywords] = useState<Set<string>>(new Set());

  // Sorting
  const [sortMode, setSortMode] = useState<'Relevance' | 'Year' | 'Subject'>('Relevance');

  // Inline Expand / Collapse State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Active answer tab selected for each Mains question ID
  const [activeMainsTabs, setActiveMainsTabs] = useState<Record<string, string>>({});

  // Collapsible Filters states (stages & PYQ open, rest collapsed by default)
  const [collapsedFilters, setCollapsedFilters] = useState<Record<string, boolean>>({
    searchStages: false,
    pyqStatus: false,
    searchScope: true,
    subject: true,
    ncert: true,
    mainsPaper: true,
    institute: true,
    programme: true,
  });

  const landingScrollRef = useRef<ScrollView>(null);

  // Search History dropdown states
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Zoom Image State
  const [zoomImageUri, setZoomImageUri] = useState<string | null>(null);

  // Mains Theme State (Theme 1: Gradient vs Theme 2: White)
  const [mainsTheme, setMainsTheme] = useState<'gradient' | 'white'>('gradient');

  useEffect(() => {
    AsyncStorage.getItem('mains_theme')
      .then(val => {
        if (val === 'white' || val === 'gradient') {
          setMainsTheme(val);
        }
      })
      .catch(() => {});
  }, []);

  const toggleMainsTheme = async () => {
    try {
      const nextTheme = mainsTheme === 'gradient' ? 'white' : 'gradient';
      setMainsTheme(nextTheme);
      await AsyncStorage.setItem('mains_theme', nextTheme);
    } catch (err) {
      console.error('Failed to save mains theme:', err);
    }
  };
  // Keyboard Visibility State
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const showSubscription = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
      if (!hasSearched && showHistory) {
        if (Platform.OS === 'ios') {
          landingScrollRef.current?.scrollToEnd({ animated: true });
        } else {
          setTimeout(() => {
            landingScrollRef.current?.scrollToEnd({ animated: true });
          }, 30);
        }
      }
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [hasSearched, showHistory]);
  // Filter Panel States
  const [filterOpen, setFilterOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filters, setFilters] = useState<UnifiedFilters>(DEFAULT_FILTERS);

  // Live Sync / Offline Loader States
  const [mainsQuestions, setMainsQuestions] = useState<ConsolidatedQuestion[]>(mainsConsolidatedQuestions);
  const [mainsValueAdd, setMainsValueAdd] = useState<ValueAdditionItem[]>(mainsConsolidatedValueAdd);

  // Load search history from local storage
  useEffect(() => {
    AsyncStorage.getItem('integrated_search_history')
      .then(raw => {
        if (raw) setSearchHistory(JSON.parse(raw));
      })
      .catch(() => {});
  }, []);

  // Modal Preview States
  const [previewPrelimsQuestion, setPreviewPrelimsQuestion] = useState<any>(null);
  const [previewPrelimsRevealed, setPreviewPrelimsRevealed] = useState(false);
  const [previewPrelimsAnswer, setPreviewPrelimsAnswer] = useState<string | null>(null);
  const [previewPrelimsStudyTags, setPreviewPrelimsStudyTags] = useState<string[]>([]);
  const [previewPrelimsExplSource, setPreviewPrelimsExplSource] = useState<string>('UPSC');
  const [previewFontSize, setPreviewFontSize] = useState(16);
  const [previewNotes, setPreviewNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const [previewMainsQuestion, setPreviewMainsQuestion] = useState<ConsolidatedQuestion | null>(null);
  const [detailedBestAnswer, setDetailedBestAnswer] = useState<BestAnswer | null>(null);
  
  const [previewValueAddItem, setPreviewValueAddItem] = useState<ValueAdditionItem | null>(null);

  const baseFontSizeRef = useRef(16);
  const previewScrollRef = useRef<ScrollView>(null);

  // Load Mains data from Supabase if online
  useEffect(() => {
    const syncData = async () => {
      try {
        const liveQ = await fetchMainsQuestionsFromSupabase();
        if (liveQ && liveQ.length > 0) setMainsQuestions(liveQ);
      } catch {}
      try {
        const liveVA = await fetchValueAdditionFromSupabase();
        if (liveVA && liveVA.length > 0) setMainsValueAdd(liveVA);
      } catch {}
    };
    syncData();
  }, []);

  // Fetch best answer for Mains detailed preview
  useEffect(() => {
    if (previewMainsQuestion?.id) {
      fetchBestAnswer(previewMainsQuestion.id)
        .then(res => setDetailedBestAnswer(res))
        .catch(() => setDetailedBestAnswer(null));
    } else {
      setDetailedBestAnswer(null);
    }
  }, [previewMainsQuestion?.id]);

  const toggleExcludedKeyword = (kw: string) => {
    setExcludedKeywords(prev => {
      const next = new Set(prev);
      if (next.has(kw)) next.delete(kw);
      else next.add(kw);
      return next;
    });
  };

  // Aggregate subjects dynamically - ONLY for the selected course!
  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>();
    // Prelims source
    const allPre = OfflineManager.getOfflineQuestionsEnrichedSync() || [];
    const coursePre = allPre.filter((q: any) => q.course === selectedCourse);
    coursePre.forEach((q: any) => { if (q.subject) subjects.add(q.subject); });

    // Mains source
    mainsQuestions.forEach(q => { if (q.subject) subjects.add(q.subject); });
    mainsValueAdd.forEach(va => { if (va.subject) subjects.add(va.subject); });

    return ['All', ...Array.from(subjects).sort()];
  }, [mainsQuestions, mainsValueAdd, selectedCourse]);

  // Aggregate unique institutes dynamically
  const instituteOptions = useMemo(() => {
    const insts = new Set<string>();
    const allPre = OfflineManager.getOfflineQuestionsEnrichedSync() || [];
    const coursePre = allPre.filter((q: any) => q.course === selectedCourse);
    coursePre.forEach((q: any) => {
      const tests = Array.isArray(q.tests) ? q.tests[0] : q.tests;
      const inst = tests?.institute || q.provider || q.source?.institute || '';
      if (inst) insts.add(inst);
    });

    mainsQuestions.forEach(q => { if (q.institute) insts.add(q.institute); });

    return ['All', ...Array.from(insts).sort()];
  }, [mainsQuestions, selectedCourse]);

  const programmeOptions = useMemo(() => {
    const progs = new Set<string>();
    
    // 1. Prelims questions
    const allPre = OfflineManager.getOfflineQuestionsEnrichedSync() || [];
    const coursePre = allPre.filter((q: any) => q.course === selectedCourse);
    coursePre.forEach((q: any) => {
      const tests = Array.isArray(q.tests) ? q.tests[0] : q.tests;
      const inst = tests?.institute || q.provider || q.source?.institute || '';
      
      if (filters.institutes.length > 0 && !filters.institutes.includes(inst)) {
        return;
      }
      
      const prog = tests?.program_name || q.program_name || '';
      if (prog) progs.add(prog);
    });

    // 2. Mains questions
    mainsQuestions.forEach((q: any) => {
      const inst = q.institute || '';
      if (filters.institutes.length > 0 && !filters.institutes.includes(inst)) {
        return;
      }
      const prog = q.program_name || '';
      if (prog) progs.add(prog);
    });

    return ['All', ...Array.from(progs).sort()];
  }, [selectedCourse, filters.institutes, mainsQuestions]);

  // Execute integrated search
  const runIntegratedSearch = async (
    overrideQuery?: string, 
    overrideFilters?: UnifiedFilters, 
    overrideEngineMode?: typeof searchEngineMode
  ) => {
    const currentQuery = (overrideQuery ?? query).trim();
    if (!currentQuery) return;

    const activeFilters = overrideFilters ?? filters;
    const mode = overrideEngineMode ?? searchEngineMode;

    setLoading(true);
    setHasSearched(true);
    setExcludedKeywords(new Set());
    setExpandedIds(new Set());

    try {
      let keywordsList: string[] = [currentQuery.toLowerCase()];
      let displayKeywords: string[] = [];
      
      if (mode === 'AI' || mode === 'AI+Fuzzy') {
        try {
          const aiResult = await aiExpandSearchQuery(currentQuery);
          if (aiResult && aiResult.keywords && aiResult.keywords.length > 0) {
            displayKeywords = aiResult.keywords.map(k => k.toLowerCase());
            const userWords = currentQuery.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
            keywordsList = [...new Set([currentQuery.toLowerCase(), ...userWords, ...displayKeywords])];
          }
        } catch (err) {
          console.warn('[UnifiedSearch] query expansion failed:', err);
        }
      }
      setKeywords(displayKeywords.length > 0 ? displayKeywords : [currentQuery.toLowerCase()]);

      const matchedResults: UnifiedSearchResult[] = [];

      const searchQuestion = activeFilters.searchAcross.includes('Question');
      const searchExplanation = activeFilters.searchAcross.includes('Explanation');
      const searchOptions = activeFilters.searchAcross.includes('Options');

      // A. PRELIMS SEARCH (Offline-First)
      const allPre = OfflineManager.getOfflineQuestionsEnrichedSync() || [];
      const preQs = allPre.filter((q: any) => q.course === selectedCourse);

      preQs.forEach((q: any) => {
        let score = 0;
        const qText = searchQuestion ? String(q.question_text || '').toLowerCase() : '';
        const qExpl = searchExplanation ? String(q.explanation_markdown || q.explanation || '').toLowerCase() : '';
        const optsObj = q.options || {};
        const optsText = searchOptions
          ? `${q.option_a || ''} ${q.option_b || ''} ${q.option_c || ''} ${q.option_d || ''} ${Object.values(optsObj).join(' ')}`.toLowerCase()
          : '';

        keywordsList.forEach((kw, index) => {
          const weight = index === 0 ? 3 : 1;
          if (qText && qText.includes(kw)) score += 2 * weight;
          if (qExpl && qExpl.includes(kw)) score += 0.5 * weight;
          if (optsText && optsText.includes(kw)) score += 0.5 * weight;
        });

        if (score > 0) {
          matchedResults.push({
            id: `prelims_${q.id}`,
            type: 'prelims',
            title: q.question_text,
            subtitle: q.explanation_markdown || '',
            subject: q.subject,
            year: q.exam_year,
            score,
            rawItem: q,
          });
        }
      });

      // B. MAINS SEARCH
      mainsQuestions.forEach((q) => {
        let score = 0;
        const qText = searchQuestion ? String(q.questionText || '').toLowerCase() : '';
        const ansText = searchExplanation ? (q.answers || []).map(a => a.answerText || '').join(' ').toLowerCase() : '';

        keywordsList.forEach((kw, index) => {
          const weight = index === 0 ? 3 : 1;
          if (qText && qText.includes(kw)) score += 2 * weight;
          if (ansText && ansText.includes(kw)) score += 0.5 * weight;
        });

        if (score > 0) {
          matchedResults.push({
            id: `mains_${q.id}`,
            type: 'mains',
            title: q.questionText,
            subtitle: (q.answers || []).map(a => a.answerText || '').join(' '),
            subject: q.subject,
            paper: q.paper,
            year: q.year,
            score,
            rawItem: q,
          });
        }
      });

      // C. VALUE ADDITION SEARCH (Comprehensive field index search)
      const uniqueVA = getUniqueValueAddItems(mainsValueAdd);
      uniqueVA.forEach((va) => {
        let score = 0;
        const titleLower = (va.title || '').toLowerCase();
        const textContent = getValueAddItemTextContent(va).toLowerCase();

        keywordsList.forEach((kw, index) => {
          const weight = index === 0 ? 3 : 1;
          if (titleLower.includes(kw)) score += 2 * weight;
          if (textContent.includes(kw)) score += 0.5 * weight;
        });

        if (score > 0) {
          matchedResults.push({
            id: `valueadd_${va.id}`,
            type: 'value_add',
            title: va.title || 'Untitled Value Add',
            subtitle: va.rawContent || va.context || '',
            subject: va.subject,
            paper: va.paper,
            score,
            rawItem: va,
          });
        }
      });

      setResults(matchedResults);

      // Save query to history
      if (currentQuery) {
        setSearchHistory(prev => {
          const next = [currentQuery, ...prev.filter(h => h.toLowerCase() !== currentQuery.toLowerCase())].slice(0, 10);
          AsyncStorage.setItem('integrated_search_history', JSON.stringify(next));
          return next;
        });
      }
      setShowHistory(false);
    } catch (err) {
      Alert.alert('Search Error', 'Failed to execute query.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Open active list in Quiz Engine Lite (Learn or Exam Mode)
  const openBatchQuiz = (openInQuizMode?: 'learning' | 'exam') => {
    const prelimsOnly = activeResults.filter(r => r.type === 'prelims');
    if (prelimsOnly.length === 0) {
      Alert.alert('No Prelims Questions', 'Only Prelims questions can be loaded into the Quiz Engine.');
      return;
    }
    const resultIdList = prelimsOnly.map(r => r.rawItem.id).join(',');
    router.push({
      pathname: '/unified/engine',
      params: {
        resultIds: resultIdList,
        questionId: prelimsOnly[0].rawItem.id,
        mode: openInQuizMode || 'learning',
        sourceLabel: 'Global Search',
      },
    } as any);
  };

  // Dynamically apply filters instantly on the client side!
  const sortedAndFilteredResults = useMemo(() => {
    let list = [...results];

    // Filter by search stages
    list = list.filter(item => {
      if (item.type === 'prelims' && !filters.showPrelims) return false;
      if (item.type === 'mains' && !filters.showMains) return false;
      if (item.type === 'value_add' && !filters.showValueAdd) return false;
      return true;
    });

    // Filter by subject
    if (filters.subjects.length > 0) {
      list = list.filter(item => item.subject && filters.subjects.includes(item.subject));
    }

    // Filter by PYQ status
    if (filters.pyqFilter === 'PYQ Only') {
      list = list.filter(item => {
        if (item.type === 'prelims') return item.rawItem.is_pyq;
        if (item.type === 'mains') return item.rawItem.is_pyq || item.rawItem.isPyq;
        return false;
      });
    } else if (filters.pyqFilter === 'Non-PYQ') {
      list = list.filter(item => {
        if (item.type === 'prelims') return !item.rawItem.is_pyq;
        if (item.type === 'mains') return !(item.rawItem.is_pyq || item.rawItem.isPyq);
        return true;
      });
    }

    // Filter by NCERT (prelims)
    if (filters.ncertFilter === 'NCERT Only') {
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const v = item.rawItem.is_ncert;
          return v === true || v === 1 || ['true', '1', 'yes'].includes(String(v).trim().toLowerCase());
        }
        return false;
      });
    } else if (filters.ncertFilter === 'Non-NCERT') {
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const v = item.rawItem.is_ncert;
          return !(v === true || v === 1 || ['true', '1', 'yes'].includes(String(v).trim().toLowerCase()));
        }
        return true;
      });
    }

    // Filter by Mains Paper
    if (filters.mainsPapers.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'value_add') {
          return item.paper && filters.mainsPapers.includes(item.paper);
        }
        return false;
      });
    }

    // Filter by Exam Category (prelims)
    if (filters.examCategory === 'UPSC') {
      list = list.filter(item => item.type === 'prelims' && item.rawItem.is_upsc_cse);
    } else if (filters.examCategory === 'Allied') {
      list = list.filter(item => item.type === 'prelims' && item.rawItem.is_allied);
    } else if (filters.examCategory === 'Others') {
      list = list.filter(item => item.type === 'prelims' && item.rawItem.is_others);
    }

    // Filter by institute
    if (filters.institutes.length > 0) {
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const tests = Array.isArray(item.rawItem.tests) ? item.rawItem.tests[0] : item.rawItem.tests;
          const inst = tests?.institute || item.rawItem.provider || item.rawItem.source?.institute || '';
          return filters.institutes.includes(inst);
        }
        if (item.type === 'mains') {
          return item.rawItem.institute && filters.institutes.includes(item.rawItem.institute);
        }
        return false;
      });
    }

    // Filter by programme
    if (filters.programmes.length > 0) {
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const tests = Array.isArray(item.rawItem.tests) ? item.rawItem.tests[0] : item.rawItem.tests;
          const prog = tests?.program_name || item.rawItem.program_name || '';
          return filters.programmes.includes(prog);
        }
        if (item.type === 'mains') {
          const prog = item.rawItem.program_name || '';
          return filters.programmes.includes(prog);
        }
        return false;
      });
    }
    // Excluded keywords filter
    if (excludedKeywords.size > 0) {
      list = list.filter(r => {
        const titleLower = r.title.toLowerCase();
        const subLower = (r.subtitle || '').toLowerCase();
        return !Array.from(excludedKeywords).some(ek => 
          titleLower.includes(ek) || subLower.includes(ek)
        );
      });
    }

    // Sort logic from Mains Question Bank (Primary & Secondary fallbacks)
    const paperOrder: Record<string, number> = { GS1: 0, GS2: 1, GS3: 2, GS4: 3, Essay: 4, Optional: 5 };

    list.sort((a, b) => {
      // Primary sort criteria based on user selection
      if (sortMode === 'Year') {
        const yearA = a.year || 0;
        const yearB = b.year || 0;
        if (yearA !== yearB) return yearB - yearA;
      } else if (sortMode === 'Subject') {
        const subA = a.subject || '';
        const subB = b.subject || '';
        if (subA !== subB) return subA.localeCompare(subB);
      } else {
        // Relevance sorting
        if (a.score !== b.score) return b.score - a.score;
      }

      // ── Secondary / Fallback sorting order ──
      
      // 1. PYQ tier (UPSC PYQ -> UPSC Allied PYQ -> Other PYQ -> Non-PYQ)
      const tierA = getQuestionSortTier(a);
      const tierB = getQuestionSortTier(b);
      if (tierA !== tierB) return tierA - tierB;

      // 2. Latest year on top (if not already sorted by Year)
      const yA = a.year || 0;
      const yB = b.year || 0;
      if (yA !== yB) return yB - yA;

      // 3. GS paper order
      const orderA = paperOrder[a.paper || ''] ?? 99;
      const orderB = paperOrder[b.paper || ''] ?? 99;
      if (orderA !== orderB) return orderA - orderB;

      // 4. Same subject together (if not already sorted by Subject)
      const sA = a.subject || '';
      const sB = b.subject || '';
      if (sA !== sB) return sA.localeCompare(sB);

      return 0;
    });

    return list;
  }, [results, filters, excludedKeywords, sortMode]);

  const activeResults = sortedAndFilteredResults;

  // Toggle expanded state for Mains & Value Addition items
  const toggleExpanded = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpandedIds(next);
  };

  // Prelims detailed preview handoff
  const handleOpenPrelimsDetail = (item: any) => {
    setPreviewPrelimsAnswer(null);
    setPreviewPrelimsRevealed(false);
    setPreviewPrelimsStudyTags([]);
    setPreviewNotes('');
    setPreviewPrelimsQuestion(item);

    if (session?.user?.id && item.id) {
      supabase
        .from('question_states')
        .select('user_notes')
        .eq('user_id', session.user.id)
        .eq('question_id', item.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.user_notes) setPreviewNotes(data.user_notes);
        });
    }
  };

  const handleTogglePrelimsTag = async (tag: string) => {
    if (!previewPrelimsQuestion?.id) return;
    const next = previewPrelimsStudyTags.includes(tag)
      ? previewPrelimsStudyTags.filter(t => t !== tag)
      : [...previewPrelimsStudyTags, tag];
    setPreviewPrelimsStudyTags(next);
  };

  // Mains bookmark handler
  const handleToggleMainsSaved = async (id: string) => {
    Alert.alert('Bookmarked', 'Bookmarked state updated successfully.');
  };

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    const next = Math.max(12, Math.min(32, baseFontSizeRef.current * scale));
    setPreviewFontSize(next);
  };

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      baseFontSizeRef.current = previewFontSize;
    }
  };

  // Rendering individual card - replica of Prelims search design
  const renderItem = ({ item, index }: { item: UnifiedSearchResult; index: number }) => {
    const isFeatured = index === 0;
    const isExpanded = expandedIds.has(item.id);
    const subColor = getSubjectColor(item.subject || '');
    
    // Type badge details
    const typeLabel = item.type === 'prelims' ? 'Prelims' : item.type === 'mains' ? 'Mains' : 'Value Add';
    const typeBg = item.type === 'prelims' ? '#e0e7ff' : item.type === 'mains' ? '#fee2e2' : '#d1fae5';
    const typeTxt = item.type === 'prelims' ? '#4338ca' : item.type === 'mains' ? '#b91c1c' : '#047857';

    let displayTitle = item.type === 'prelims' 
      ? item.rawItem.question_text || item.title 
      : item.type === 'mains' 
        ? item.rawItem.questionText || item.title 
        : item.title;

    if (item.type === 'value_add' && displayTitle.includes(' - ')) {
      const parts = displayTitle.split(' - ');
      if (parts[0] && parts[1] && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
        displayTitle = parts[0].trim();
      }
    }

    // Build context snippet depending on type (no answer/explanation leaked beforehand)
    let snippetComponent: React.ReactNode;
    if (item.type === 'prelims') {
      snippetComponent = buildContextSnippet(item.rawItem.question_text, keywords, item.rawItem.options, null, query);
    } else if (item.type === 'mains') {
      snippetComponent = buildContextSnippet(item.rawItem.questionText, keywords, null, null, query);
    } else {
      snippetComponent = buildContextSnippet(item.rawItem.title, keywords, null, null, query);
    }

    // Build PYQ details for Prelims questions
    let pyqLabel = '';
    let pyqChipStyle: any = null;
    if (item.type === 'prelims') {
      const synthExamInfo = {
        is_upsc_cse: item.rawItem.is_upsc_cse,
        is_allied: item.rawItem.is_allied,
        is_others: item.rawItem.is_others,
        group: item.rawItem.exam_group,
        exam_name: item.rawItem.exam_group,
        year: item.rawItem.exam_year,
      };
      const pyq = getPYQCategorization({
        ...item.rawItem,
        exam_info: synthExamInfo,
      });
      pyqLabel = pyq.hasPYQData ? `${pyq.groupName} ${pyq.year}`.trim() : '';
      pyqChipStyle = getPYQChipStyle(pyq);
    }

    // Retrieve institute and programme names
    const prelimsInst = item.type === 'prelims' 
      ? (item.rawItem.tests?.[0]?.institute || item.rawItem.provider || item.rawItem.source?.institute || '')
      : (item.rawItem.institute || '');
    const prelimsProg = item.type === 'prelims'
      ? (item.rawItem.tests?.[0]?.program_name || item.rawItem.program_name || '')
      : (item.rawItem.programName || item.rawItem.program_name || item.rawItem.programme || '');

    return (
      <View
        style={[
          styles.cardContainer,
          {
            backgroundColor: colors.surface,
            borderColor: isFeatured ? colors.primary + '40' : colors.border,
            borderWidth: isFeatured ? 1.5 : 1,
            flexDirection: 'row',
          }
        ]}
      >
        <View style={{ width: 5, backgroundColor: getStageIndicatorColor(item.type) }} />
        <View style={{ flex: 1 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (item.type === 'prelims') {
                handleOpenPrelimsDetail(item.rawItem);
              } else {
                toggleExpanded(item.id);
              }
            }}
            style={styles.cardHeaderArea}
          >
          {/* Left card index number */}
          <View style={[styles.cardNum, { backgroundColor: isFeatured ? '#7c3aed15' : colors.surfaceStrong }]}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: isFeatured ? '#7c3aed' : colors.textTertiary }}>
              {index + 1}
            </Text>
          </View>

          <View style={{ flex: 1 }}>
            {isExpanded ? (
              <Text style={[styles.cardText, { color: colors.textPrimary }]}>
                {highlightKeywords(displayTitle, keywords)}
              </Text>
            ) : (
              <Text style={[styles.cardText, { color: colors.textPrimary }]} numberOfLines={3}>
                {highlightKeywords(displayTitle, keywords)}
              </Text>
            )}

            <View style={styles.cardChips}>
              <View style={[styles.chip, { backgroundColor: typeBg }]}>
                <Text style={[styles.chipText, { color: typeTxt }]}>{typeLabel}</Text>
              </View>

              {item.type === 'value_add' && (
                <View style={[styles.chip, { backgroundColor: '#fee2e2' }]}>
                  <Text style={[styles.chipText, { color: '#991b1b' }]}>
                    {getValueAddTypeLabel(item.rawItem)}
                  </Text>
                </View>
              )}

              {item.subject && (
                <View style={[styles.chip, { backgroundColor: subColor + '18' }]}>
                  <Text style={[styles.chipText, { color: subColor }]}>{item.subject}</Text>
                </View>
              )}

              {item.type === 'prelims' && item.rawItem.is_pyq && pyqLabel && pyqChipStyle && (
                <View style={[styles.chip, { backgroundColor: pyqChipStyle.bg }]}>
                  <Text style={[styles.chipText, { color: pyqChipStyle.color }]}>{pyqLabel}</Text>
                </View>
              )}

              {prelimsInst ? (
                <View style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[styles.chipText, { color: '#1d4ed8' }]}>{prelimsInst}</Text>
                </View>
              ) : (
                !(item.rawItem.is_pyq || item.rawItem.isPyq) && (
                  <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                    <Text style={[styles.chipText, { color: colors.textTertiary }]}>Practice</Text>
                  </View>
                )
              )}

              {prelimsProg ? (
                <View style={[styles.chip, { backgroundColor: '#f3e8ff' }]}>
                  <Text style={[styles.chipText, { color: '#6b21a8' }]}>{prelimsProg}</Text>
                </View>
              ) : null}

              {item.type === 'mains' && (item.rawItem.is_pyq || item.rawItem.isPyq) && (
                <View style={[styles.chip, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[styles.chipText, { color: '#15803d' }]}>UPSC MAINS {item.year}</Text>
                </View>
              )}

              {item.year && !(item.rawItem.is_pyq || item.rawItem.isPyq) && (
                <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                  <Text style={[styles.chipText, { color: colors.textTertiary }]}>{item.year}</Text>
                </View>
              )}

              {item.type === 'mains' && item.paper && (
                <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                  <Text style={[styles.chipText, { color: colors.textSecondary }]}>{item.paper}</Text>
                </View>
              )}
            </View>
          </View>

          {item.type === 'prelims' ? (
            <ChevronRight size={15} color={colors.textTertiary} />
          ) : isExpanded ? (
            <ChevronUp size={15} color={colors.textTertiary} />
          ) : (
            <ChevronDown size={15} color={colors.textTertiary} />
          )}
        </TouchableOpacity>

        {/* Inline Expandable Panel (Mains & Value Addition) */}
        {isExpanded && (
          <View style={[styles.expandedPanel, { borderTopColor: colors.border }]}>
            {item.type === 'value_add' ? (
              <View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>VALUE ADDITION DETAILS</Text>
                  <TouchableOpacity
                    onPress={() => {
                      router.push({
                        pathname: '/mains',
                        params: {
                          initialScreen: 'value-add',
                          category: item.rawItem.category,
                          vaId: item.rawItem.id,
                        }
                      } as any);
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                  >
                    <ExternalLink size={12} color={colors.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Open in Hub</Text>
                  </TouchableOpacity>
                </View>
                <ValueAddCardBody item={item.rawItem} colors={colors} onImagePress={setZoomImageUri} />
              </View>
            ) : (
              <MainsResultAnswerPanel
                rawItem={item.rawItem}
                colors={colors}
                isDark={isDark}
                mdStyles={mdStyles}
                mdRules={mdRules}
                router={router}
              />
            )}
          </View>
        )}
        </View>
      </View>
    );
  };

  const toggleFilterChip = (key: 'subjects' | 'mainsPapers' | 'institutes' | 'programmes', value: string) => {
    setFilters(p => {
      if (value === 'All') {
        return { ...p, [key]: [] };
      }
      const current = p[key];
      const next = current.includes(value)
        ? current.filter(x => x !== value)
        : [...current, value];
      return { ...p, [key]: next };
    });
  };

  const mdStyles = buildMarkdownStyles(
    colors.textPrimary,
    14,
    colors.surface,
    colors.border,
    colors.primary
  );
  const mdRules = getMarkdownRules(colors, isDark, setZoomImageUri);

  const renderFilterGroupHeader = (key: string, label: string) => {
    const isCollapsed = collapsedFilters[key] ?? true;
    return (
      <TouchableOpacity
        onPress={() => setCollapsedFilters(p => ({ ...p, [key]: !isCollapsed }))}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border, marginBottom: isCollapsed ? 12 : 8 }}
      >
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>{label}</Text>
        {isCollapsed ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronUp size={14} color={colors.textTertiary} />}
      </TouchableOpacity>
    );
  };

  const LeftPanelFilters = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
      {/* 1. Search Stages (Always open by default) */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader('searchStages', 'SEARCH STAGES')}
        {!collapsedFilters.searchStages && (
          <View>
            <TouchableOpacity
              onPress={() => setFilters(p => ({ ...p, showPrelims: !p.showPrelims }))}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, filters.showPrelims && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {filters.showPrelims && <Check size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>Prelims Questions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilters(p => ({ ...p, showMains: !p.showMains }))}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, filters.showMains && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {filters.showMains && <Check size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>Mains Questions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setFilters(p => ({ ...p, showValueAdd: !p.showValueAdd }))}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, filters.showValueAdd && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {filters.showValueAdd && <Check size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>Value Additions</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. PYQ Status */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader('pyqStatus', 'PYQ STATUS')}
        {!collapsedFilters.pyqStatus && (
          <View style={styles.chipsWrap}>
            {(['All', 'PYQ Only', 'Non-PYQ'] as const).map(opt => {
              const isSelected = filters.pyqFilter === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => setFilters(p => ({ ...p, pyqFilter: opt }))}
                  style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 3. Subject Filter */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader('subject', 'SUBJECT')}
        {!collapsedFilters.subject && (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              onPress={() => toggleFilterChip('subjects', 'All')}
              style={[styles.fchip, filters.subjects.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.fchipText, { color: filters.subjects.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
            </TouchableOpacity>
            {subjectOptions.filter(x => x !== 'All').map(sub => {
              const isSelected = filters.subjects.includes(sub);
              return (
                <TouchableOpacity
                  key={sub}
                  onPress={() => toggleFilterChip('subjects', sub)}
                  style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sub}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 4. Paper (Mains) filter */}
      {filters.showMains && (
        <View style={styles.filterGroup}>
          {renderFilterGroupHeader('mainsPaper', 'PAPER (MAINS)')}
          {!collapsedFilters.mainsPaper && (
            <View style={styles.chipsWrap}>
              <TouchableOpacity
                onPress={() => toggleFilterChip('mainsPapers', 'All')}
                style={[styles.fchip, filters.mainsPapers.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.fchipText, { color: filters.mainsPapers.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
              </TouchableOpacity>
              {(['GS1', 'GS2', 'GS3', 'GS4', 'Essay'] as const).map(opt => {
                const isSelected = filters.mainsPapers.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => toggleFilterChip('mainsPapers', opt)}
                    style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* 5. Institute Filter */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader('institute', 'INSTITUTE')}
        {!collapsedFilters.institute && (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              onPress={() => toggleFilterChip('institutes', 'All')}
              style={[styles.fchip, filters.institutes.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.fchipText, { color: filters.institutes.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
            </TouchableOpacity>
            {instituteOptions.filter(x => x !== 'All').map(inst => {
              const isSelected = filters.institutes.includes(inst);
              return (
                <TouchableOpacity
                  key={inst}
                  onPress={() => toggleFilterChip('institutes', inst)}
                  style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{inst}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 6. Programme Filter */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader('programme', 'PROGRAMME')}
        {!collapsedFilters.programme && (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              onPress={() => toggleFilterChip('programmes', 'All')}
              style={[styles.fchip, filters.programmes.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.fchipText, { color: filters.programmes.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
            </TouchableOpacity>
            {programmeOptions.filter(x => x !== 'All').map(prog => {
              const isSelected = filters.programmes.includes(prog);
              return (
                <TouchableOpacity
                  key={prog}
                  onPress={() => toggleFilterChip('programmes', prog)}
                  style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{prog}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 7. Search Scope ("SEARCH IN") */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader('searchScope', 'SEARCH IN')}
        {!collapsedFilters.searchScope && (
          <View style={styles.chipsWrap}>
            {([
              { key: 'Question', label: 'Question body' },
              { key: 'Explanation', label: 'Explanation / Model Answers' },
              { key: 'Options', label: 'Options (Prelims)' },
            ] as const).map(opt => {
              const isSelected = filters.searchAcross.includes(opt.key);
              return (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => {
                    setFilters(p => {
                      const next = p.searchAcross.includes(opt.key)
                        ? p.searchAcross.filter(x => x !== opt.key)
                        : [...p.searchAcross, opt.key];
                      return next.length > 0 ? { ...p, searchAcross: next } : p;
                    });
                  }}
                  style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* 8. NCERT Filters (only if Prelims enabled, collapsed by default) */}
      {filters.showPrelims && (
        <View style={styles.filterGroup}>
          {renderFilterGroupHeader('ncert', 'NCERT FILTER (PRELIMS)')}
          {!collapsedFilters.ncert && (
            <View style={styles.chipsWrap}>
              {(['All', 'NCERT Only', 'Non-NCERT'] as const).map(opt => {
                const isSelected = filters.ncertFilter === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setFilters(p => ({ ...p, ncertFilter: opt }))}
                    style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );

  const renderHistoryDropdown = () => {
    if (!showHistory || searchHistory.length === 0) return null;
    return (
      <View style={[styles.historyDropdown, { backgroundColor: colors.surface, borderColor: colors.border, position: 'absolute', top: '100%', left: 0, right: 0, marginHorizontal: 0, marginTop: 4, zIndex: 1000 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5 }}>RECENT SEARCHES</Text>
          <TouchableOpacity onPressIn={() => {
            setSearchHistory([]);
            AsyncStorage.removeItem('integrated_search_history');
            setShowHistory(false);
          }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Clear</Text>
          </TouchableOpacity>
        </View>
        {searchHistory.map((h, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.historyItem, { borderBottomColor: colors.border }]}
            onPressIn={() => { setQuery(h); setShowHistory(false); runIntegratedSearch(h, filters); }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: colors.textSecondary }} numberOfLines={1}>{h}</Text>
            </View>
            <TouchableOpacity
              onPressIn={() => {
                const next = searchHistory.filter((_, j) => j !== i);
                setSearchHistory(next);
                AsyncStorage.setItem('integrated_search_history', JSON.stringify(next));
              }}
              style={{ padding: 4 }}
            >
              <X size={12} color={colors.textTertiary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderFlatListHeader = () => {
    return (
      <View style={{ backgroundColor: colors.bg, zIndex: 999 }}>
        {/* Header Bar inside FlatList (only shown on landing page, hidden once searched) */}
        {!hasSearched && (
          <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top, paddingHorizontal: 16, height: 60 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={require('../assets/icon.png')}
                style={{ width: 28, height: 28, borderRadius: 6 }}
                resizeMode="contain"
              />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Dr. UPSC AI Search</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={toggleMainsTheme}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface + '88',
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 12,
                }}
              >
                <Palette size={16} color={mainsTheme === 'gradient' ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: mainsTheme === 'gradient' ? colors.primary : colors.textSecondary, marginLeft: 4 }}>
                  {mainsTheme === 'gradient' ? 'Theme 1' : 'Theme 2'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search Input Bar */}
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          paddingTop: hasSearched ? insets.top + 8 : 10,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border
        }}>
          <View style={{ flexDirection: 'row', gap: 8, position: 'relative', zIndex: 999, alignItems: 'center' }}>
            {/* Sidebar toggle chevron (Tablet/iPad only) */}
            {IS_IPAD && (
              <TouchableOpacity
                onPress={() => setSidebarOpen(!sidebarOpen)}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {sidebarOpen ? (
                  <ChevronLeft size={18} color={colors.primary} />
                ) : (
                  <ChevronRight size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}

            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
              <Search size={18} color={colors.textTertiary} />
              <TextInput
                placeholder="Search concepts across Prelims, Mains, and Value Addition..."
                placeholderTextColor={colors.textTertiary}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onFocus={() => { if (searchHistory.length > 0) setShowHistory(true); }}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                onSubmitEditing={() => runIntegratedSearch(query, filters)}
                style={[styles.input, { color: colors.textPrimary }]}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); }}>
                  <X size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>

            {!IS_IPAD && (
              <TouchableOpacity
                onPress={() => setFilterOpen(true)}
                style={[styles.mobFilterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <Filter size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => runIntegratedSearch(query, filters)}
              disabled={loading || !query.trim()}
              style={[styles.searchGoBtn, { backgroundColor: colors.primary }]}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <ChevronRight size={18} color="#fff" />}
            </TouchableOpacity>
            {renderHistoryDropdown()}
          </View>

          {/* Engine mode switchers */}
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
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
                  if (hasSearched && query.trim()) runIntegratedSearch(query, filters, mode);
                }}
                style={[
                  styles.modeBtn,
                  {
                    backgroundColor: searchEngineMode === mode
                      ? (mode === 'AI' ? '#7c3aed' : (mode === 'AI+Fuzzy' ? '#06b6d4' : (mode === 'Matching' ? '#0ea5e9' : '#f59e0b')))
                      : colors.surface,
                    borderColor: searchEngineMode === mode ? 'transparent' : colors.border,
                  }
                ]}
              >
                {icon}
                <Text style={[styles.modeBtnText, { color: searchEngineMode === mode ? '#fff' : colors.textSecondary }]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Keywords panel */}
          {keywords.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
              {keywords.map((kw, i) => {
                const isExcluded = excludedKeywords.has(kw);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => toggleExcludedKeyword(kw)}
                    style={[
                      styles.pill,
                      {
                        backgroundColor: isExcluded ? colors.surfaceStrong : '#ede9fe',
                        borderColor: isExcluded ? colors.border : '#c4b5fd',
                        opacity: isExcluded ? 0.5 : 1,
                      }
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: isExcluded ? colors.textTertiary : '#7c3aed',
                        textDecorationLine: isExcluded ? 'line-through' : 'none',
                      }}
                    >
                      {kw}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Relevance / Year / Subject sorting headers */}
        {!loading && activeResults.length > 0 && (
          <View style={[styles.resultsHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>
                {activeResults.length} results
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
                {(['Relevance', 'Year', 'Subject'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setSortMode(s)}
                    style={[
                      styles.sortBtn,
                      { backgroundColor: sortMode === s ? '#7c3aed' : colors.surfaceStrong }
                    ]}
                  >
                    <Text style={[styles.sortBtnText, { color: sortMode === s ? '#fff' : colors.textSecondary }]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Learn / Exam launch buttons */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity
                onPress={() => openBatchQuiz('learning')}
                style={[styles.batchBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}
              >
                <BookOpen size={12} color={colors.primary} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.primary }}>Learn</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openBatchQuiz('exam')}
                style={[styles.batchBtn, { backgroundColor: '#7c3aed', borderColor: '#7c3aed' }]}
              >
                <Target size={12} color="#fff" />
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff' }}>Exam</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderListEmptyOrLoading = () => {
    if (loading) {
      return (
        <View style={{ flex: 1, height: 350, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }
    return (
      <View style={{ flex: 1, height: 350, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textTertiary }}>
          {hasSearched ? 'No results found. Adjust your filters or query.' : 'Type a query above to search.'}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {!isDark && mainsTheme === 'gradient' && (
          <LinearGradient
            colors={['#e0f2fe', '#fef3c7', '#fce7f3', '#d1fae5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        )}

        {/* Header Bar */}
        {!hasSearched && (
          <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={require('../assets/icon.png')}
                style={{ width: 28, height: 28, borderRadius: 6 }}
                resizeMode="contain"
              />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Dr. UPSC AI Search</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={toggleMainsTheme}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: colors.surface + '88',
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 12,
                }}
              >
                <Palette size={16} color={mainsTheme === 'gradient' ? colors.primary : colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: mainsTheme === 'gradient' ? colors.primary : colors.textSecondary, marginLeft: 4 }}>
                  {mainsTheme === 'gradient' ? 'Theme 1' : 'Theme 2'}
                </Text>
              </TouchableOpacity>
              {IS_IPAD && (
                <TouchableOpacity
                  onPress={() => setSidebarOpen(!sidebarOpen)}
                  style={[styles.sidebarToggle, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <SlidersHorizontal size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {!hasSearched ? (
          <ScrollView
            ref={landingScrollRef}
            contentContainerStyle={{ flexGrow: 1, alignItems: 'center', padding: 24 }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ flex: 1 }} />

            {/* Brand Logo / Title */}
            <View style={{ alignItems: 'center', marginBottom: 30 }}>
              <Image
                source={require('../assets/icon.png')}
                style={{ width: 80, height: 80, borderRadius: 20, marginBottom: 16 }}
                resizeMode="contain"
              />
              <Text style={{ fontSize: 32, fontWeight: '900', color: colors.textPrimary, letterSpacing: -1 }}>
                Dr. UPSC <Text style={{ color: colors.primary }}>AI Search</Text>
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textTertiary, marginTop: 6, letterSpacing: 0.5 }}>
                Search across Prelims, Mains, and Value Addition Hub
              </Text>
            </View>

            {/* Centered Search Bar */}
            <View style={{ width: '100%', maxWidth: 580, position: 'relative', zIndex: 999 }}>
              <View style={{ flexDirection: 'row', gap: 8, position: 'relative', zIndex: 999 }}>
                <View style={[styles.searchBox, { height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: colors.surface, borderColor: colors.border, flex: 1 }]}>
                  <Search size={20} color={colors.textTertiary} />
                  <TextInput
                    placeholder="Ask a question or search key concepts..."
                    placeholderTextColor={colors.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    returnKeyType="search"
                    onFocus={() => {
                      if (searchHistory.length > 0) {
                        setShowHistory(true);
                        setTimeout(() => {
                          landingScrollRef.current?.scrollToEnd({ animated: true });
                        }, 50);
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                    onSubmitEditing={() => runIntegratedSearch(query, filters)}
                    style={[styles.input, { color: colors.textPrimary, fontSize: 15 }]}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                      <X size={18} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {!IS_IPAD && (
                  <TouchableOpacity
                    onPress={() => setFilterOpen(true)}
                    style={[styles.mobFilterBtn, { height: 52, width: 52, borderRadius: 26, backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Filter size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => runIntegratedSearch(query, filters)}
                  disabled={loading || !query.trim()}
                  style={[styles.searchGoBtn, { height: 52, width: 52, borderRadius: 26, backgroundColor: colors.primary }]}
                >
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : <ChevronRight size={20} color="#fff" />}
                </TouchableOpacity>
              </View>

              {renderHistoryDropdown()}

              {/* Engine mode switchers centered */}
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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
                      if (hasSearched && query.trim()) runIntegratedSearch(query, filters, mode);
                    }}
                    style={[
                      styles.modeBtn,
                      {
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: 14,
                        backgroundColor: searchEngineMode === mode
                          ? (mode === 'AI' ? '#7c3aed' : (mode === 'AI+Fuzzy' ? '#06b6d4' : (mode === 'Matching' ? '#0ea5e9' : '#f59e0b')))
                          : colors.surface,
                        borderColor: searchEngineMode === mode ? 'transparent' : colors.border,
                      }
                    ]}
                  >
                    {icon}
                    <Text style={[styles.modeBtnText, { color: searchEngineMode === mode ? '#fff' : colors.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {showHistory && <View style={{ height: 280 }} />}
            <View style={{ flex: 1.5 }} />
          </ScrollView>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {/* Left sidebar on Tablet/iPad */}
          {IS_IPAD && sidebarOpen && (
            <View style={{ width: 280, borderRightWidth: 0.5, borderRightColor: colors.border, backgroundColor: colors.surface }}>
              {LeftPanelFilters}
            </View>
          )}

          {/* Results column */}
          <View style={{ flex: 1 }}>
            <FlatList
              data={loading ? [] : activeResults}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 60 }}
              ListHeaderComponent={renderFlatListHeader()}
              ListEmptyComponent={renderListEmptyOrLoading()}
              keyboardShouldPersistTaps="handled"
              extraData={{ activeMainsTabs, colors, isDark }}
            />
          </View>
        </View>
      )}

      {/* Mobile Filter Modal */}
      <Modal
        visible={filterOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setFilterOpen(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.surface }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.bottomSheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>Search Filters</Text>
              <TouchableOpacity onPress={() => setFilterOpen(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }}>
              {LeftPanelFilters}
            </ScrollView>
            <View style={{ padding: 16, borderTopWidth: 0.5, borderTopColor: colors.border, flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setFilters(DEFAULT_FILTERS)} style={[styles.applyBtn, { backgroundColor: colors.surfaceStrong, flex: 1 }]}>
                <Text style={{ color: colors.textSecondary, fontWeight: '800' }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setFilterOpen(false)} style={[styles.applyBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 1. Prelims Detailed Question Preview Modal */}
      {previewPrelimsQuestion && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewPrelimsQuestion(null)}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(10,10,20,0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <View style={{ width: '100%', maxWidth: 650, maxHeight: '90%', flexShrink: 1, backgroundColor: colors.bg, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
              
              {/* Modal Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={18} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>Question Preview</Text>
                    <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.5 }}>LITE QUIZ ENGINE</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setPreviewPrelimsQuestion(null)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                >
                  <X size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Scrollable Card Panel with Zoom Support */}
              <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
                <ScrollView 
                  ref={previewScrollRef}
                  style={{ flexShrink: 1 }}
                  contentContainerStyle={{ padding: 16 }}
                  showsVerticalScrollIndicator={true}
                >
                  <SharedQuestionCard
                    item={{
                      ...previewPrelimsQuestion,
                      exam_info: {
                        is_upsc_cse: previewPrelimsQuestion?.is_upsc_cse,
                        is_allied: previewPrelimsQuestion?.is_allied,
                        is_others: previewPrelimsQuestion?.is_others,
                        group: previewPrelimsQuestion?.exam_group,
                        exam_name: previewPrelimsQuestion?.exam_group,
                        year: previewPrelimsQuestion?.exam_year,
                        ...(previewPrelimsQuestion?.exam_info || {})
                      },
                      _explanations: previewPrelimsQuestion._explanations || [],
                      _institutes: previewPrelimsQuestion._institutes || [],
                    }}
                    index={0}
                    arenaMode="learning"
                    isRevealed={previewPrelimsRevealed}
                    colors={colors}
                    mdStyles={mdStyles}
                    mdRules={mdRules}
                    fontSize={previewFontSize}
                    answerData={{
                      selectedAnswer: previewPrelimsAnswer,
                      isReview: previewPrelimsStudyTags.length > 0,
                      studyTags: previewPrelimsStudyTags
                    }}
                    userStudyTags={['Must Revise', 'Imp. Concept', 'Imp. Fact', 'Trap Question']}
                    toggleStudyTag={handleTogglePrelimsTag}
                    activeExplSource={previewPrelimsExplSource}
                    onExplSourceChange={setPreviewPrelimsExplSource}
                    onRevealExplanation={() => setPreviewPrelimsRevealed(true)}
                    onOptionSelect={(qid: string, opt: string) => setPreviewPrelimsAnswer(opt)}
                    onAnswerSelect={(ans: any) => {
                      setPreviewPrelimsAnswer(ans);
                      setPreviewPrelimsRevealed(true);
                    }}
                  />

                  {previewPrelimsQuestion.micro_topic && (
                    <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.surfaceStrong, borderRadius: 16, borderWidth: 1, borderColor: colors.border + '50' }}>
                      <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>SYLLABUS CONTEXT</Text>
                      <Text style={{ fontSize: Math.max(11, previewFontSize - 3), color: colors.textSecondary, fontWeight: '600' }}>{previewPrelimsQuestion.micro_topic}</Text>
                    </View>
                  )}
                </ScrollView>
              </PinchGestureHandler>

              {/* Quick Notes Editor */}
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 6 }}>QUICK NOTES</Text>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'flex-end' }}>
                  <TextInput
                    multiline
                    style={{
                      flex: 1,
                      backgroundColor: colors.bg,
                      borderRadius: 10,
                      paddingHorizontal: 11,
                      paddingVertical: 9,
                      fontSize: 12,
                      color: colors.textPrimary,
                      borderWidth: 1,
                      borderColor: colors.border,
                      maxHeight: 80,
                      fontWeight: '500'
                    }}
                    placeholderTextColor={colors.textTertiary}
                    placeholder="Add your notes here..."
                    value={previewNotes}
                    onChangeText={setPreviewNotes}
                  />
                  <TouchableOpacity
                    onPress={async () => {
                      if (!previewNotes.trim() || !session?.user?.id || !previewPrelimsQuestion?.id) return;
                      setIsSavingNotes(true);
                      try {
                        await supabase.from('question_states').upsert({
                          user_id: session.user.id,
                          question_id: previewPrelimsQuestion.id,
                          test_id: previewPrelimsQuestion.test_id || 'manual',
                          user_notes: previewNotes.trim()
                        });
                        Alert.alert('Saved', 'Quick notes saved successfully.');
                      } catch (err) {
                        console.error('Notes save error:', err);
                      } finally {
                        setIsSavingNotes(false);
                      }
                    }}
                    disabled={!previewNotes.trim() || isSavingNotes}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 9,
                      backgroundColor: previewNotes.trim() ? colors.primary : colors.surfaceStrong,
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: previewNotes.trim() ? 1 : 0.5
                    }}
                  >
                    {isSavingNotes ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>✓</Text>}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                  onPress={() => {
                    const q = previewPrelimsQuestion;
                    setPreviewPrelimsQuestion(null);
                    if (q) {
                      router.push({
                        pathname: '/unified/engine',
                        params: {
                          resultIds: q.id,
                          questionId: q.id,
                          mode: 'learning',
                          sourceLabel: 'Global Search',
                        },
                      } as any);
                    }
                  }}
                >
                  <BookOpen size={16} color={colors.primary} />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>Learn Mode</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, backgroundColor: '#7c3aed' }}
                  onPress={() => {
                    const q = previewPrelimsQuestion;
                    setPreviewPrelimsQuestion(null);
                    if (q) {
                      router.push({
                        pathname: '/unified/engine',
                        params: {
                          resultIds: q.id,
                          questionId: q.id,
                          mode: 'exam',
                          sourceLabel: 'Global Search',
                        },
                      } as any);
                    }
                  }}
                >
                  <Target size={16} color="#fff" />
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>Practice Exam</Text>
                </TouchableOpacity>
              </View>

            </View>
          </View>
        </Modal>
      )}

      {/* 2. Mains Detailed Question Preview Modal */}
      {previewMainsQuestion && (
        <Modal
          visible={true}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setPreviewMainsQuestion(null)}
        >
          <DetailedQuestionView
            question={previewMainsQuestion}
            onBack={() => setPreviewMainsQuestion(null)}
            colors={colors}
            isDark={isDark}
            isTablet={IS_IPAD}
            insets={insets}
            savedIds={[]}
            onToggleSaved={handleToggleMainsSaved}
            userTags={[]}
            onToggleTag={() => {}}
            onCreateTag={() => {}}
            isFlashcarded={false}
            isSavingFlashcard={false}
            onAddFlashcard={() => {}}
            studyTags={[]}
            confidence={null}
            onSetConfidence={() => {}}
            difficulty={null}
            onSetDifficulty={() => {}}
            onSaveToPilot={() => {}}
            onOpenAIChat={() => {}}
            onOpenVitaminEditor={() => {}}
            detailedBestAnswer={detailedBestAnswer}
            onDeleteBestAnswer={() => {}}
          />
        </Modal>
      )}

      {/* 3. Value Addition Detailed Modal (Fixed raw text markdown preview) */}
      {previewValueAddItem && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setPreviewValueAddItem(null)}
        >
          <Pressable style={styles.overlay} onPress={() => setPreviewValueAddItem(null)}>
            <Pressable style={[styles.vaModal, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e: any) => e.stopPropagation()}>
              <View style={[styles.bottomSheetHeader, { borderBottomColor: colors.border }]}>
                {(() => {
                  let vaTitle = previewValueAddItem.title || 'Value Addition Details';
                  if (vaTitle.includes(' - ')) {
                    const parts = vaTitle.split(' - ');
                    if (parts[0] && parts[1] && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
                      vaTitle = parts[0].trim();
                    }
                  }
                  return (
                    <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }} numberOfLines={1}>
                      {vaTitle}
                    </Text>
                  );
                })()}
                <TouchableOpacity onPress={() => setPreviewValueAddItem(null)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {previewValueAddItem.paper && (
                  <View style={{ backgroundColor: '#f3f4f6', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textPrimary }}>Paper: {previewValueAddItem.paper}</Text>
                  </View>
                )}
                {previewValueAddItem.subject && (
                  <Text style={{ fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 8 }}>
                    Subject: {previewValueAddItem.subject}
                  </Text>
                )}
                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: 8 }}>
                  Type: {getValueAddTypeLabel(previewValueAddItem)}
                </Text>
                {previewValueAddItem.context && (
                  <Text style={{ fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', marginBottom: 12 }}>
                    Context: {previewValueAddItem.context}
                  </Text>
                )}
                {previewValueAddItem.quoteText && (
                  <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, marginVertical: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>"{previewValueAddItem.quoteText}"</Text>
                    {previewValueAddItem.author && (
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4, textAlign: 'right' }}>— {previewValueAddItem.author}</Text>
                    )}
                  </View>
                )}
                {previewValueAddItem.rawContent && (
                  <Markdown style={mdStyles} rules={mdRules}>
                    {previewValueAddItem.rawContent}
                  </Markdown>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sidebarToggle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  mobFilterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchGoBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  modeBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardContainer: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: 'hidden',
  },
  cardHeaderArea: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  cardNum: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 6,
  },
  cardChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 9,
    fontWeight: '700',
  },
  expandedPanel: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 0.5,
  },
  inlineMainsAnswer: {
    marginTop: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  inlineAnswerTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  resultsHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginRight: 6,
  },
  sortBtnText: {
    fontSize: 11,
    fontWeight: '800',
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    width: '100%',
    maxHeight: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
  },
  bottomSheetHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 0.5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  filterGroup: {
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fchip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  fchipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  applyBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaModal: {
    backgroundColor: '#fff',
    borderRadius: 24,
    marginHorizontal: 16,
    marginVertical: 60,
    flex: 1,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  historyDropdown: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  redirectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
