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
import { useRouter, useLocalSearchParams } from 'expo-router';
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
  RotateCcw,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSearchHistory, saveSearch, removeSearchItem, clearSearchHistory } from '../src/utils/searchHistory';
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
  getInitialMainsQuestions,
  normalizePaper,
  resolvePaper,
} from '../src/data/mainsConsolidatedLoader';
import {
  mainsConsolidatedValueAdd,
  ValueAdditionItem,
  fetchValueAdditionFromSupabase,
  getInitialValueAdditions,
} from '../src/data/mainsValueAdditionLoader';
import QuestionBankTopperCard from '../src/components/mains/QuestionBankTopperCard';
import TopperImageViewerModal from '../src/components/mains/TopperImageViewerModal';
import {
  isTopperQuestion,
  isGenuineTopperAnswer,
  isTopperAnswer,
  getTopperName,
  getAir,
  getTopperPageUrls,
  normalizeQuestionKey,
  buildTopperAttachmentMap,
} from '../src/utils/topperHelpers';
import { DetailedQuestionView, ValueAddCardBody, getMarkdownRules, parseIntroductoryBox } from './mains';
import { buildMarkdownStyles } from '../src/utils/markdownUtils';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { getPYQCategorization } from '../src/utils/questionUtils';
import { fetchBestAnswer, BestAnswer } from '../src/services/BestAnswerService';
import { supabase } from '../src/lib/supabase';
import { KVStore } from '../src/lib/kvStore';
import * as Clipboard from 'expo-clipboard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IPAD = SCREEN_WIDTH >= 768;

type UnifiedSearchResult = {
  id: string;
  type: 'prelims' | 'mains' | 'value_add' | 'topper';
  title: string;
  subtitle?: string;
  subject?: string;
  paper?: string;
  year?: number;
  score: number;
  rawItem: any;
  matchedInQuestion?: boolean;
  matchedInExplanation?: boolean;
  matchedInOptions?: boolean;
};

type UnifiedFilters = {
  showPrelims: boolean;
  showMains: boolean;
  showToppers: boolean;
  showValueAdd: boolean;
  pyqFilter: 'All' | 'PYQ Only' | 'Non-PYQ';
  examCategory: 'All' | 'UPSC' | 'Allied' | 'Others';
  ncertFilter: 'All' | 'NCERT Only' | 'Non-NCERT';
  subjects: string[];
  mainsPapers: string[];
  institutes: string[];
  programmes: string[];
  searchAcross: ('Question' | 'Explanation' | 'Options')[];

  // Prelims filters
  sections: string[];
  microtopics: string[];
  revisionTags: string[];
  yearRange: string;

  // Mains filters
  mainsYears: string[];
  subtopics: string[];
  nanotopics: string[];
  macrotags: string[];
  microtags: string[];
};

export function matchesSearchScope(item: UnifiedSearchResult, searchAcross: ('Question' | 'Explanation' | 'Options')[]): boolean {
  if (!searchAcross || searchAcross.length === 0) return true;
  const searchQuestion = searchAcross.includes('Question');
  const searchExplanation = searchAcross.includes('Explanation');
  const searchOptions = searchAcross.includes('Options');

  let ok = false;
  if (searchQuestion && item.matchedInQuestion) ok = true;
  if (searchExplanation && item.matchedInExplanation) ok = true;
  if (searchOptions && item.matchedInOptions) ok = true;
  return ok;
}

const DEFAULT_FILTERS: UnifiedFilters = {
  showPrelims: true,
  showMains: true,
  showToppers: true,
  showValueAdd: true,
  pyqFilter: 'All',
  examCategory: 'All',
  ncertFilter: 'All',
  subjects: [],
  mainsPapers: [],
  institutes: [],
  programmes: [],
  searchAcross: ['Question', 'Explanation', 'Options'],
  sections: [],
  microtopics: [],
  revisionTags: [],
  yearRange: '',
  mainsYears: [],
  subtopics: [],
  nanotopics: [],
  macrotags: [],
  microtags: [],
};

export function countActiveFilters(f: UnifiedFilters): number {
  let count = 0;
  if (!f.showPrelims || !f.showMains || !f.showToppers || !f.showValueAdd) count++;
  if (f.searchAcross.length !== 3) count++;
  if (f.pyqFilter !== 'All') count++;
  if (f.institutes.length > 0) count += f.institutes.length;
  if (f.programmes.length > 0) count += f.programmes.length;
  if (f.revisionTags.length > 0) count += f.revisionTags.length;
  if (f.examCategory !== 'All') count++;
  if (f.ncertFilter !== 'All') count++;
  if (f.sections.length > 0) count += f.sections.length;
  if (f.microtopics.length > 0) count += f.microtopics.length;
  if (f.yearRange) count++;
  if (f.mainsPapers.length > 0) count += f.mainsPapers.length;
  if (f.subjects.length > 0) count += f.subjects.length;
  if (f.subtopics.length > 0) count += f.subtopics.length;
  if (f.nanotopics.length > 0) count += f.nanotopics.length;
  if (f.macrotags.length > 0) count += f.macrotags.length;
  if (f.microtags.length > 0) count += f.microtags.length;
  if (f.mainsYears.length > 0) count += f.mainsYears.length;
  return count;
}

export const PAPER_OPTIONS = ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'] as const;

// Canonicalize subjects across Prelims, Mains, and Value Add to eliminate duplication
export function canonicalizeSubject(sub: string | null | undefined): string {
  if (!sub) return '';
  const clean = String(sub).trim();
  if (!clean) return '';
  const lower = clean.toLowerCase();

  // Ethics, Integrity & Aptitude
  if (lower.includes('ethics') || lower.includes('integrity') || lower.includes('aptitude')) {
    return 'Ethics, Integrity & Aptitude';
  }
  // Polity & Governance
  if (
    lower === 'polity' || 
    lower === 'indian polity' || 
    lower.includes('governance') || 
    lower.includes('constitution') || 
    lower === 'polity & governance'
  ) {
    return 'Polity & Governance';
  }
  // Economy
  if (lower === 'economy' || lower === 'indian economy' || lower.includes('economic')) {
    return 'Economy';
  }
  // Science & Technology
  if (
    lower.includes('science') || 
    lower.includes('technology') || 
    lower === 's&t' || 
    lower.includes('science & technology') || 
    lower.includes('science and tech')
  ) {
    return 'Science & Technology';
  }
  // History & Culture
  if (
    lower.includes('history') || 
    lower.includes('ancient') || 
    lower.includes('medieval') || 
    lower.includes('modern') || 
    lower.includes('art & culture') || 
    lower.includes('art and culture') || 
    lower.includes('culture')
  ) {
    return 'History & Culture';
  }
  // Geography
  if (lower.includes('geography')) {
    return 'Geography';
  }
  // Environment & Ecology
  if (lower.includes('environment') || lower.includes('ecology') || lower.includes('biodiversity')) {
    return 'Environment';
  }
  // International Relations
  if (lower.includes('international relations') || lower === 'ir' || lower.includes('international')) {
    return 'International Relations';
  }
  // Social Justice
  if (lower.includes('social justice') || lower === 'justice') {
    return 'Social Justice';
  }
  // Society
  if (lower.includes('society') || lower.includes('social issues') || lower === 'indian society') {
    return 'Indian Society';
  }
  // Internal Security
  if (lower.includes('security') || lower.includes('internal security')) {
    return 'Internal Security';
  }
  // Disaster Management
  if (lower.includes('disaster') || lower === 'dm') {
    return 'Disaster Management';
  }
  // Agriculture
  if (lower.includes('agri') || lower.includes('agriculture')) {
    return 'Agriculture';
  }
  // Anthropology
  if (lower.includes('anthro')) {
    return 'Anthropology';
  }
  // Sociology
  if (lower.includes('socio')) {
    return 'Sociology';
  }
  // Current Affairs
  if (lower.includes('current') || lower.includes('ca')) {
    return 'Current Affairs';
  }
  // Essay
  if (lower.includes('essay')) {
    return 'Essay';
  }

  // Proper Title Casing fallback
  return clean
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

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

const getQuestionSection = (q: any): string => q?.sectionGroup || q?.section_group || q?.sectiongroup || '';
const getQuestionMicro = (q: any): string => q?.microTopic || q?.microtopic || q?.micro_topic || '';
const getQuestionSub = (q: any): string => q?.subTopic || q?.subtopic || q?.sub_topic || '';
const getQuestionNano = (q: any): string => q?.nanoTopic || q?.nanotopic || q?.nano_topic || '';
const getValueAddSub = (va: any): string => va?.subtopic || va?.subTopic || va?.sub_topic || '';
const getValueAddNano = (va: any): string => va?.nanotopic || va?.nanoTopic || va?.nano_topic || '';

function getStageIndicatorColor(type: 'prelims' | 'mains' | 'value_add' | 'topper'): string {
  if (type === 'prelims') return '#3b82f6'; // Blue
  if (type === 'mains') return '#f97316';   // Amber/Orange (not pink!)
  if (type === 'topper') return '#ea580c';  // Vibrant Orange/Topper
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
  if (!items || !items.length) return [];
  const seen = new Set<string>();
  return items.filter(item => {
    if (!item) return false;
    const fingerprint = item.id || [
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
    va.content_markdown || '',
    va.content || '',
    va.description || '',
    va.tags || '',
    va.subject || '',
    va.sectionGroup || va.section_group || '',
    va.microtopic || va.microTopic || '',
    va.subtopic || va.subTopic || '',
    va.examples || '',
    va.data_points || '',
    va.core_values || '',
    va.category || '',
  ];
  
  if (va.mnemonicExpansion && Array.isArray(va.mnemonicExpansion)) {
    va.mnemonicExpansion.forEach((item: any) => {
      parts.push(item.letter || '', item.meaning || '', item.detail || '');
    });
  }
  
  if (va.frameworkBoxes && Array.isArray(va.frameworkBoxes)) {
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
      ed.keywordExample || '',
      ed.comparisonNonTableContent || ''
    );
    if (Array.isArray(ed.dimensionsList)) {
      parts.push(...ed.dimensionsList);
    }
    if (Array.isArray(ed.comparisonPoints)) {
      ed.comparisonPoints.forEach((p: any) => {
        parts.push(p.criteria || '', p.termA || '', p.termB || '');
      });
    }
  }

  return parts.filter(Boolean).join(' ');
}

const wholeWordRegex = (word: string): RegExp =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

const hasWholeWord = (text: string, word: string): boolean =>
  wholeWordRegex(word).test(text);

export const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'any', 'can', 'her', 'was', 'one',
  'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see',
  'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'with',
  'from', 'that', 'this', 'what', 'which', 'when', 'where', 'will', 'they', 'them', 'these',
  'those', 'been', 'have', 'were', 'about', 'would', 'there', 'their'
]);

export const textMatchesKeyword = (text: string, kw: string): boolean => {
  if (!text || !kw) return false;
  if (kw.length <= 4) {
    return hasWholeWord(text, kw);
  }
  return hasWholeWord(text, kw) || text.toLowerCase().includes(kw.toLowerCase());
};

function highlightKeywords(text: string, allKeywords: string[]): React.ReactNode {
  const matchingKws = allKeywords.filter(k => k.length > 2 && textMatchesKeyword(text, k));
  if (!matchingKws.length) return <Text>{text}</Text>;
  const escaped = matchingKws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part)
      ? <Text key={i} style={{ fontWeight: '800', color: '#f59e0b' }}>{part}</Text>
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
    const rawWords = rawTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
    for (const word of rawWords) {
      if (textMatchesKeyword(text || '', word)) {
        return buildSnippetFromField(text || '', word, '', maxContextWords);
      }
    }
  }

  const textKw = keywords.find(k => k.length > 2 && textMatchesKeyword(text || '', k));
  if (textKw) {
    return buildSnippetFromField(text || '', textKw, '', maxContextWords);
  }

  if (options) {
    const optsText = Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(' ');
    const optsKw = keywords.find(k => k.length > 2 && textMatchesKeyword(optsText, k));
    if (optsKw) {
      return buildSnippetFromField(optsText, optsKw, '(Options)', maxContextWords);
    }
  }

  if (explanation) {
    const explKw = keywords.find(k => k.length > 2 && textMatchesKeyword(explanation, k));
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
  const match = fieldText.match(keyword.length <= 4 ? wholeWordRegex(keyword) : new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  if (!match || match.index === undefined) {
    return <Text>{fieldText.slice(0, 120)}</Text>;
  }
  const matchIdx = match.index;
  const matchEnd = matchIdx + match[0].length;
  const matchedWord = match[0];
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
  const snippet = `${labelPrefix}${prefix}${contextBefore} ${matchedWord} ${contextAfter}${suffix}`;

  return highlightKeywords(snippet, [keyword, matchedWord]);
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
  activeTab,
  onActiveTabChange,
}: {
  rawItem: any;
  colors: any;
  isDark: boolean;
  mdStyles: any;
  mdRules: any;
  router: any;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
}) => {
  const cleanAnswers = getCleanAvailableAnswers(rawItem.answers || []);

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
                    onPress={() => onActiveTabChange(ans.institute)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 6,
                      borderWidth: 0.5,
                      borderColor: isTabActive ? '#3b82f6' : colors.border,
                      backgroundColor: isTabActive ? '#3b82f6' : colors.surfaceStrong,
                    }}
                  >
                    <Text style={{ 
                      fontSize: 11, 
                      fontWeight: '700', 
                      color: isTabActive ? '#ffffff' : colors.textTertiary 
                    }}>
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
  const params = useLocalSearchParams<{ q?: string }>();
  const { colors, isDark } = useTheme();
  const { session } = useAuth();
  const { selectedCourse } = useCourse();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Core Search States
  const [query, setQuery] = useState('');
  const [searchEngineMode, setSearchEngineMode] = useState<'AI' | 'AI+Fuzzy' | 'Matching' | 'Exact'>('Matching');
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
    searchScope: true,
    // Prelims
    ncert: true,
    examCategory: true,
    prelimsSections: true,
    prelimsMicrotopics: true,
    prelimsYearRange: true,
    // Mains
    mainsPaper: true,
    mainsSubject: true,
    mainsSubtopic: true,
    mainsNanotopic: true,
    mainsMacrotag: true,
    mainsMicrotag: true,
    mainsYear: true,
    // Common
    institute: true,
    programme: true,
    pyqStatus: false,
    revisionTags: true,
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
  const [sidebarSubjectFilter, setSidebarSubjectFilter] = useState<string | null>(null);
  const [filters, setFilters] = useState<UnifiedFilters>(DEFAULT_FILTERS);

  // Live Sync / Offline Loader States - synchronously hydrate from KVStore cache on boot
  const [mainsQuestions, setMainsQuestions] = useState<ConsolidatedQuestion[]>(() => getInitialMainsQuestions());
  const [mainsValueAdd, setMainsValueAdd] = useState<ValueAdditionItem[]>(() => getInitialValueAdditions());

  // Load search history from local storage (unified)
  useEffect(() => {
    loadSearchHistory()
      .then(history => {
        if (history) setSearchHistory(history);
      })
      .catch(() => {});
  }, []);

  // User question state maps for fast local revision tag filtering
  const [userQuestionStates, setUserQuestionStates] = useState<Record<string, { reviewTags: string[] }>>({});
  const [prelimsTaggedMap, setPrelimsTaggedMap] = useState<Record<string, string[]>>({});
  const [userTags, setUserTags] = useState<string[]>(['Must Revise', 'Tricky', 'High Yield', 'Weak Area', 'Current Affairs']);

  useEffect(() => {
    if (!session?.user?.id) return;
    const loadTagsAndStates = async () => {
      try {
        const [qsRes, mqsRes] = await Promise.all([
          supabase.from('question_states').select('question_id, review_tags').eq('user_id', session.user.id),
          supabase.from('mains_question_states').select('question_id, review_tags').eq('user_id', session.user.id),
        ]);
        const set = new Set<string>(['Must Revise', 'Tricky', 'High Yield', 'Weak Area', 'Current Affairs']);
        if (qsRes.data) {
          const preMap: Record<string, string[]> = {};
          qsRes.data.forEach((r: any) => {
            if (Array.isArray(r.review_tags) && r.review_tags.length > 0) {
              preMap[r.question_id] = r.review_tags;
              r.review_tags.forEach((t: string) => set.add(t));
            }
          });
          setPrelimsTaggedMap(preMap);
        }
        if (mqsRes.data) {
          const mainsMap: Record<string, { reviewTags: string[] }> = {};
          mqsRes.data.forEach((r: any) => {
            if (Array.isArray(r.review_tags) && r.review_tags.length > 0) {
              mainsMap[r.question_id] = { reviewTags: r.review_tags };
              r.review_tags.forEach((t: string) => set.add(t));
            }
          });
          setUserQuestionStates(mainsMap);
        }
        setUserTags(Array.from(set));
      } catch (err) {
        console.warn('[UnifiedSearch] Failed to load user tags:', err);
      }
    };
    loadTagsAndStates();
  }, [session?.user?.id]);

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

  // Lookup map for fast topper attachment: questionKey -> genuine topper answers
  const topperAttachmentMap = useMemo(() => {
    return buildTopperAttachmentMap(mainsQuestions);
  }, [mainsQuestions]);

  // Saved / Bookmarked Mains Questions (parity with app/mains.tsx)
  const [savedQuestionIds, setSavedQuestionIds] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem('mains_saved_questions')
      .then(stored => {
        if (stored) setSavedQuestionIds(JSON.parse(stored));
      })
      .catch(e => console.error('Failed to load mains saved questions:', e));
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

  // Full-screen Image Viewer Lightbox for Topper Copies (parity with app/mains.tsx)
  const [topperViewerVisible, setTopperViewerVisible] = useState(false);
  const [topperViewerImages, setTopperViewerImages] = useState<string[]>([]);
  const [topperViewerIndex, setTopperViewerIndex] = useState(0);
  const [topperViewerName, setTopperViewerName] = useState('Topper');
  const [topperViewerAir, setTopperViewerAir] = useState<string | number | undefined>(undefined);
  const [topperViewerQuestionText, setTopperViewerQuestionText] = useState('');

  const handleOpenTopperViewer = useCallback((
    images: string[],
    index: number = 0,
    name?: string,
    air?: string | number,
    qText?: string
  ) => {
    if (!images || images.length === 0) return;
    setTopperViewerImages(images);
    setTopperViewerIndex(index);
    setTopperViewerName(name || 'Topper');
    setTopperViewerAir(air);
    setTopperViewerQuestionText(qText || '');
    setTopperViewerVisible(true);
  }, []);

  const baseFontSizeRef = useRef(16);
  const previewScrollRef = useRef<ScrollView>(null);

  // Load Mains data from Supabase if online, with fallback to KVStore
  useEffect(() => {
    let isMounted = true;
    const syncData = async () => {
      // Re-check cache once KVStore finishes hydrating
      await KVStore.ready();
      if (!isMounted) return;
      if (mainsQuestions.length === 0) {
        const q = getInitialMainsQuestions();
        if (q && q.length > 0) setMainsQuestions(q);
      }
      if (mainsValueAdd.length === 0) {
        const va = getInitialValueAdditions();
        if (va && va.length > 0) setMainsValueAdd(va);
      }

      // Mains catalog is local-only after Download. Refresh is the sole path
      // that re-reads the server, so we never pay catalog egress on screen open.
    };
    syncData();
    return () => { isMounted = false; };
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

  // Cache course-specific prelims questions to avoid calling the slow getOfflineQuestionsEnrichedSync() repeatedly
  const coursePrelims = useMemo(() => {
    const allPre = OfflineManager.getOfflineQuestionsEnrichedSync() || [];
    return allPre.filter((q: any) => q.course === selectedCourse);
  }, [selectedCourse]);

  // Aggregate subjects dynamically - INTERCONNECTED with active stages, papers, and search results!
  const subjectOptions = useMemo(() => {
    const subjects = new Set<string>();

    if (hasSearched && results.length > 0) {
      // In active search results: aggregate subjects from results matching active stages & papers
      results.forEach(r => {
        if (r.type === 'prelims' && !filters.showPrelims) return;
        if (r.type === 'mains' && !filters.showMains) return;
        if (r.type === 'topper' && !filters.showToppers) return;
        if (r.type === 'value_add' && !filters.showValueAdd) return;

        if (filters.mainsPapers.length > 0) {
          if (r.type === 'mains' || r.type === 'value_add' || r.type === 'topper') {
            const normP = normalizePaper(r.paper);
            if (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper)) return;
          } else {
            return; // Prelims excluded when paper filter is active
          }
        }

        if (filters.pyqFilter === 'PYQ Only') {
          const isPyq = r.type === 'prelims' ? r.rawItem?.is_pyq : (r.rawItem?.is_pyq || r.rawItem?.isPyq);
          if (!isPyq) return;
        } else if (filters.pyqFilter === 'Non-PYQ') {
          const isPyq = r.type === 'prelims' ? r.rawItem?.is_pyq : (r.rawItem?.is_pyq || r.rawItem?.isPyq);
          if (isPyq) return;
        }

        const canon = canonicalizeSubject(r.subject);
        if (canon) subjects.add(canon);
      });

      // Ensure any currently selected subjects remain in options so they can be toggled/deselected
      filters.subjects.forEach(s => {
        const canon = canonicalizeSubject(s);
        if (canon) subjects.add(canon);
      });
    } else {
      // Prior to search: aggregate from dataset filtered by active stages and papers
      if (filters.showPrelims && filters.mainsPapers.length === 0) {
        coursePrelims.forEach((q: any) => {
          const canon = canonicalizeSubject(q.subject);
          if (canon) subjects.add(canon);
        });
      }

      if (filters.showMains || filters.showToppers) {
        mainsQuestions.forEach(q => {
          const normP = normalizePaper(q.paper);
          if (filters.mainsPapers.length > 0 && (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === q.paper))) return;
          const canon = canonicalizeSubject(q.subject);
          if (canon) subjects.add(canon);
        });
      }

      if (filters.showValueAdd) {
        mainsValueAdd.forEach(va => {
          const normP = normalizePaper(va.paper);
          if (filters.mainsPapers.length > 0 && (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === va.paper))) return;
          const canon = canonicalizeSubject(va.subject);
          if (canon) subjects.add(canon);
        });
      }
    }

    return ['All', ...Array.from(subjects).sort()];
  }, [mainsQuestions, mainsValueAdd, coursePrelims, filters.showPrelims, filters.showMains, filters.showToppers, filters.showValueAdd, filters.mainsPapers, filters.pyqFilter, filters.subjects, hasSearched, results]);

  // Aggregate unique institutes dynamically - INTERCONNECTED with active stages & search results
  const instituteOptions = useMemo(() => {
    const insts = new Set<string>();

    if (hasSearched && results.length > 0) {
      results.forEach(r => {
        if (r.type === 'prelims' && !filters.showPrelims) return;
        if (r.type === 'mains' && !filters.showMains) return;
        if (r.type === 'value_add') return; // value add has no institutes
        if (filters.mainsPapers.length > 0) {
          if (r.type === 'mains') {
            const normP = normalizePaper(r.paper);
            if (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper)) return;
          } else {
            return;
          }
        }
        if (filters.subjects.length > 0 && (!r.subject || !filters.subjects.includes(r.subject))) return;

        const inst = r.rawItem?.institute || (Array.isArray(r.rawItem?.tests) ? r.rawItem.tests[0]?.institute : r.rawItem?.tests?.institute) || '';
        if (inst) insts.add(inst);
      });
      filters.institutes.forEach(i => insts.add(i));
    } else {
      if (filters.showPrelims && filters.mainsPapers.length === 0) {
        coursePrelims.forEach((q: any) => {
          if (filters.subjects.length > 0 && (!q.subject || !filters.subjects.includes(q.subject))) return;
          const tests = Array.isArray(q.tests) ? q.tests[0] : q.tests;
          const inst = tests?.institute || q.provider || q.source?.institute || '';
          if (inst) insts.add(inst);
        });
      }

      if (filters.showMains) {
        mainsQuestions.forEach(q => {
          const normP = normalizePaper(q.paper);
          if (filters.mainsPapers.length > 0 && (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === q.paper))) return;
          if (filters.subjects.length > 0 && (!q.subject || !filters.subjects.includes(q.subject))) return;
          if (q.institute) insts.add(q.institute);
        });
      }
    }

    return ['All', ...Array.from(insts).sort()];
  }, [mainsQuestions, coursePrelims, filters.showPrelims, filters.showMains, filters.mainsPapers, filters.subjects, filters.institutes, hasSearched, results]);

  const programmeOptions = useMemo(() => {
    const progs = new Set<string>();

    if (hasSearched && results.length > 0) {
      results.forEach(r => {
        if (r.type === 'prelims' && !filters.showPrelims) return;
        if (r.type === 'mains' && !filters.showMains) return;
        if (r.type === 'value_add') return;

        const inst = r.rawItem?.institute || (Array.isArray(r.rawItem?.tests) ? r.rawItem.tests[0]?.institute : r.rawItem?.tests?.institute) || '';
        if (filters.institutes.length > 0 && !filters.institutes.includes(inst)) return;

        const prog = r.rawItem?.program_name || (Array.isArray(r.rawItem?.tests) ? r.rawItem.tests[0]?.program_name : r.rawItem?.tests?.program_name) || '';
        if (prog) progs.add(prog);
      });
      filters.programmes.forEach(p => progs.add(p));
    } else {
      // 1. Prelims questions
      if (filters.showPrelims && filters.mainsPapers.length === 0) {
        coursePrelims.forEach((q: any) => {
          const tests = Array.isArray(q.tests) ? q.tests[0] : q.tests;
          const inst = tests?.institute || q.provider || q.source?.institute || '';
          if (filters.institutes.length > 0 && !filters.institutes.includes(inst)) return;
          const prog = tests?.program_name || q.program_name || '';
          if (prog) progs.add(prog);
        });
      }

      // 2. Mains questions
      if (filters.showMains) {
        mainsQuestions.forEach((q: any) => {
          const normP = normalizePaper(q.paper);
          if (filters.mainsPapers.length > 0 && (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === q.paper))) return;
          const inst = q.institute || '';
          if (filters.institutes.length > 0 && !filters.institutes.includes(inst)) return;
          const prog = q.program_name || '';
          if (prog) progs.add(prog);
        });
      }
    }

    return ['All', ...Array.from(progs).sort()];
  }, [coursePrelims, filters.institutes, filters.showPrelims, filters.showMains, filters.mainsPapers, filters.programmes, mainsQuestions, hasSearched, results]);

  // Prelims facet options
  const prelimsSectionOptions = useMemo(() => {
    const s = new Set<string>();
    coursePrelims.forEach((q: any) => {
      if (q.section_group) s.add(q.section_group);
    });
    return ['All', ...Array.from(s).sort()];
  }, [coursePrelims]);

  const prelimsMicrotopicOptions = useMemo(() => {
    const s = new Set<string>();
    coursePrelims.forEach((q: any) => {
      if (q.micro_topic) s.add(q.micro_topic);
    });
    return ['All', ...Array.from(s).slice(0, 40).sort()];
  }, [coursePrelims]);

  // Mains facet options
  const mainsSubtopicOptions = useMemo(() => {
    const s = new Set<string>();
    mainsQuestions.forEach((q: any) => {
      const sub = getQuestionSub(q);
      if (sub && sub !== 'General' && sub !== 'All') s.add(sub);
    });
    return ['All', ...Array.from(s).slice(0, 40).sort()];
  }, [mainsQuestions]);

  const mainsNanotopicOptions = useMemo(() => {
    const s = new Set<string>();
    mainsQuestions.forEach((q: any) => {
      const nano = getQuestionNano(q);
      if (nano && nano !== 'General') s.add(nano);
    });
    return ['All', ...Array.from(s).slice(0, 40).sort()];
  }, [mainsQuestions]);

  const mainsMacrotagOptions = useMemo(() => {
    const s = new Set<string>();
    mainsQuestions.forEach((q: any) => {
      if (q.macrotag) {
        q.macrotag.split(',').forEach((t: string) => {
          const clean = t.trim();
          if (clean) s.add(clean);
        });
      }
    });
    return ['All', ...Array.from(s).sort()];
  }, [mainsQuestions]);

  const mainsMicrotagOptions = useMemo(() => {
    const s = new Set<string>();
    mainsQuestions.forEach((q: any) => {
      if (q.microtag) {
        q.microtag.split(',').forEach((t: string) => {
          const clean = t.trim();
          if (clean) s.add(clean);
        });
      }
    });
    return ['All', ...Array.from(s).slice(0, 40).sort()];
  }, [mainsQuestions]);

  const mainsYearOptions = useMemo(() => {
    const s = new Set<string>();
    mainsQuestions.forEach((q: any) => {
      if (q.year && String(q.year).trim() && String(q.year).trim() !== '0') {
        s.add(String(q.year).trim());
      }
    });
    return ['All', ...Array.from(s).sort((a, b) => Number(b) - Number(a))];
  }, [mainsQuestions]);

  // Real-time subjects in results for quick drill-down (respects active stages & papers)
  const allResultSubjects = useMemo(() => {
    const subs = new Set<string>();
    results.forEach(r => {
      if (r.type === 'prelims' && !filters.showPrelims) return;
      if (r.type === 'mains' && !filters.showMains) return;
      if (r.type === 'value_add' && !filters.showValueAdd) return;

      if (filters.mainsPapers.length > 0) {
        if (r.type === 'mains' || r.type === 'value_add') {
          const normP = normalizePaper(r.paper);
          if (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper)) return;
        } else {
          return;
        }
      }

      const canon = canonicalizeSubject(r.subject);
      if (canon) subs.add(canon);
    });
    return Array.from(subs).sort();
  }, [results, filters.showPrelims, filters.showMains, filters.showValueAdd, filters.mainsPapers]);

  // Real-time match counts for subjects, papers, institutes, and stages from search results
  // All counts are fully REACTIVE and INTERCONNECTED with all active filters!
  const resultCounts = useMemo(() => {
    const subjectCounts: Record<string, number> = {};
    const paperCounts: Record<string, number> = {};
    const instituteCounts: Record<string, number> = {};
    const stageCounts = { prelims: 0, mains: 0, topper: 0, value_add: 0 };

    const matchesPyq = (item: UnifiedSearchResult) => {
      if (filters.pyqFilter === 'All' || item.type === 'topper') return true;
      const isPyq = item.type === 'prelims' ? item.rawItem?.is_pyq : (item.rawItem?.is_pyq || item.rawItem?.isPyq);
      if (filters.pyqFilter === 'PYQ Only') return !!isPyq;
      if (filters.pyqFilter === 'Non-PYQ') return !isPyq;
      return true;
    };

    const matchesNcert = (item: UnifiedSearchResult) => {
      if (filters.ncertFilter === 'All') return true;
      if (item.type === 'prelims') {
        const v = item.rawItem?.is_ncert;
        const isNcert = v === true || v === 1 || ['true', '1', 'yes'].includes(String(v).trim().toLowerCase());
        return filters.ncertFilter === 'NCERT Only' ? isNcert : !isNcert;
      }
      return true;
    };

    const matchesInstitute = (item: UnifiedSearchResult) => {
      if (filters.institutes.length === 0 || item.type === 'topper') return true;
      if (item.type === 'prelims') {
        const tests = Array.isArray(item.rawItem?.tests) ? item.rawItem.tests[0] : item.rawItem?.tests;
        const inst = tests?.institute || item.rawItem?.provider || item.rawItem?.source?.institute || '';
        return filters.institutes.includes(inst);
      }
      if (item.type === 'mains') {
        return item.rawItem?.institute && filters.institutes.includes(item.rawItem.institute);
      }
      return false;
    };

    const matchesProgramme = (item: UnifiedSearchResult) => {
      if (filters.programmes.length === 0 || item.type === 'topper') return true;
      if (item.type === 'prelims') {
        const tests = Array.isArray(item.rawItem?.tests) ? item.rawItem.tests[0] : item.rawItem?.tests;
        const prog = tests?.program_name || item.rawItem?.program_name || '';
        return filters.programmes.includes(prog);
      }
      if (item.type === 'mains') {
        return item.rawItem?.program_name && filters.programmes.includes(item.rawItem.program_name);
      }
      return false;
    };

    const matchesKeywordsExclusion = (item: UnifiedSearchResult) => {
      if (excludedKeywords.size === 0) return true;
      const titleLower = item.title.toLowerCase();
      const subLower = (item.subtitle || '').toLowerCase();
      return !Array.from(excludedKeywords).some(ek => titleLower.includes(ek) || subLower.includes(ek));
    };

    const matchesSidebarSubject = (item: UnifiedSearchResult) => {
      if (!sidebarSubjectFilter) return true;
      return canonicalizeSubject(item.subject) === canonicalizeSubject(sidebarSubjectFilter);
    };

    const matchesScope = (item: UnifiedSearchResult) => matchesSearchScope(item, filters.searchAcross);

    // 1. Calculate Stage Counts (reflecting all other active filters: paper, subject, pyq, inst, prog, exclusion, scope)
    results.forEach(r => {
      if (!matchesScope(r) || !matchesPyq(r) || !matchesNcert(r) || !matchesKeywordsExclusion(r) || !matchesSidebarSubject(r)) return;
      if (filters.subjects.length > 0) {
        const itemSub = canonicalizeSubject(r.subject);
        if (!itemSub || !filters.subjects.some(s => canonicalizeSubject(s) === itemSub)) return;
      }

      if (r.type === 'prelims') {
        if (filters.mainsPapers.length === 0 && matchesInstitute(r) && matchesProgramme(r)) {
          stageCounts.prelims++;
        }
      } else if (r.type === 'topper') {
        const normP = normalizePaper(r.paper);
        if (filters.mainsPapers.length > 0 && (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper))) return;
        stageCounts.topper++;
      } else if (r.type === 'mains') {
        const normP = normalizePaper(r.paper);
        if (filters.mainsPapers.length > 0 && (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper))) return;
        if (matchesInstitute(r) && matchesProgramme(r)) {
          stageCounts.mains++;
        }
      } else if (r.type === 'value_add') {
        const normP = normalizePaper(r.paper);
        if (filters.mainsPapers.length > 0 && (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper))) return;
        stageCounts.value_add++;
      }
    });

    // 2. Calculate Paper Counts (for GS1, GS2, GS3, GS4, Essay, Optional)
    // CRITICAL: Respects filters.showMains, filters.showToppers, and filters.showValueAdd!
    // If user deselects Value Addition, Value Additions are NOT counted in paperCounts.
    results.forEach(r => {
      if (!r.paper) return;
      if (r.type === 'mains' && !filters.showMains) return;
      if (r.type === 'topper' && !filters.showToppers) return;
      if (r.type === 'value_add' && !filters.showValueAdd) return;
      if (r.type === 'prelims') return; // prelims has no paper

      if (!matchesScope(r) || !matchesPyq(r) || !matchesKeywordsExclusion(r) || !matchesSidebarSubject(r)) return;
      if (filters.subjects.length > 0) {
        const itemSub = canonicalizeSubject(r.subject);
        if (!itemSub || !filters.subjects.some(s => canonicalizeSubject(s) === itemSub)) return;
      }
      if (r.type === 'mains' && (!matchesInstitute(r) || !matchesProgramme(r))) return;

      const normPaper = normalizePaper(r.paper);
      if (!normPaper) return;
      paperCounts[normPaper] = (paperCounts[normPaper] || 0) + 1;
    });

    // 3. Calculate Subject Counts (reflecting active stages, paper filter, pyq, inst, scope, etc.)
    results.forEach(r => {
      const canon = canonicalizeSubject(r.subject);
      if (!canon) return;
      if (r.type === 'prelims' && !filters.showPrelims) return;
      if (r.type === 'mains' && !filters.showMains) return;
      if (r.type === 'value_add' && !filters.showValueAdd) return;
      if (!matchesScope(r)) return;

      if (filters.mainsPapers.length > 0) {
        if (r.type === 'mains' || r.type === 'value_add') {
          const normP = normalizePaper(r.paper);
          if (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper)) return;
        } else {
          return;
        }
      }

      if (!matchesPyq(r) || !matchesNcert(r) || !matchesKeywordsExclusion(r)) return;
      if (!matchesInstitute(r) || !matchesProgramme(r)) return;

      subjectCounts[canon] = (subjectCounts[canon] || 0) + 1;
    });

    // 4. Calculate Institute Counts (reflecting active stages, paper filter, subjects, scope, etc.)
    results.forEach(r => {
      if (r.type === 'prelims' && !filters.showPrelims) return;
      if (r.type === 'mains' && !filters.showMains) return;
      if (r.type === 'value_add') return;
      if (!matchesScope(r)) return;

      if (filters.mainsPapers.length > 0) {
        if (r.type === 'mains') {
          const normP = normalizePaper(r.paper);
          if (!normP || !filters.mainsPapers.some(p => normalizePaper(p) === normP || p === r.paper)) return;
        } else {
          return;
        }
      }

      if (filters.subjects.length > 0 && (!r.subject || !filters.subjects.includes(r.subject))) return;
      if (!matchesPyq(r) || !matchesNcert(r) || !matchesKeywordsExclusion(r) || !matchesSidebarSubject(r)) return;

      const inst = r.rawItem?.institute || (Array.isArray(r.rawItem?.tests) ? r.rawItem.tests[0]?.institute : r.rawItem?.tests?.institute) || '';
      if (inst) instituteCounts[inst] = (instituteCounts[inst] || 0) + 1;
    });

    return { subjectCounts, paperCounts, instituteCounts, stageCounts };
  }, [
    results,
    filters.showPrelims,
    filters.showMains,
    filters.showValueAdd,
    filters.mainsPapers,
    filters.subjects,
    filters.institutes,
    filters.programmes,
    filters.pyqFilter,
    filters.ncertFilter,
    filters.searchAcross,
    excludedKeywords,
    sidebarSubjectFilter,
  ]);

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
    setSidebarSubjectFilter(null);

    try {
      const cleanQuery = currentQuery.toLowerCase().trim();
      const userWords = cleanQuery
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
      let keywordsList: string[] = [...new Set([cleanQuery, ...userWords])];
      let displayKeywords: string[] = [];
      
      if (mode === 'AI' || mode === 'AI+Fuzzy') {
        try {
          const aiResult = await aiExpandSearchQuery(currentQuery);
          if (aiResult && aiResult.keywords && aiResult.keywords.length > 0) {
            displayKeywords = aiResult.keywords
              .map(k => k.toLowerCase().trim())
              .filter(k => Boolean(k) && !STOP_WORDS.has(k));
            keywordsList = [...new Set([cleanQuery, ...userWords, ...displayKeywords])];
          }
        } catch (err) {
          console.warn('[UnifiedSearch] query expansion failed:', err);
        }
      }
      setKeywords(displayKeywords.length > 0 ? displayKeywords : (userWords.length > 0 ? userWords : [cleanQuery]));

      const matchedResults: UnifiedSearchResult[] = [];

      const searchQuestion = activeFilters.searchAcross.includes('Question');
      const searchExplanation = activeFilters.searchAcross.includes('Explanation');
      const searchOptions = activeFilters.searchAcross.includes('Options');

      // A. PRELIMS SEARCH (Offline-First)
      const allPre = OfflineManager.getOfflineQuestionsEnrichedSync() || [];
      const preQs = allPre.filter((q: any) => q.course === selectedCourse);

      preQs.forEach((q: any) => {
        let score = 0;
        const qText = String(q.question_text || '').toLowerCase();
        const qExpl = String(q.explanation_markdown || q.explanation || '').toLowerCase();
        const optsObj = q.options || {};
        const optsText = `${q.option_a || ''} ${q.option_b || ''} ${q.option_c || ''} ${q.option_d || ''} ${Object.values(optsObj).join(' ')}`.toLowerCase();

        let matchedInQ = false;
        let matchedInExpl = false;
        let matchedInOpts = false;

        keywordsList.forEach((kw, index) => {
          const weight = index === 0 ? 3 : 1;
          const kwInQ = qText ? textMatchesKeyword(qText, kw) : false;
          const kwInExpl = qExpl ? textMatchesKeyword(qExpl, kw) : false;
          const kwInOpts = optsText ? textMatchesKeyword(optsText, kw) : false;

          if (kwInQ) {
            score += 2 * weight;
            matchedInQ = true;
          }
          if (kwInExpl) {
            score += 0.5 * weight;
            matchedInExpl = true;
          }
          if (kwInOpts) {
            score += 0.5 * weight;
            matchedInOpts = true;
          }
        });

        const hasScopeMatch = (searchQuestion && matchedInQ) || (searchExplanation && matchedInExpl) || (searchOptions && matchedInOpts);

        if (hasScopeMatch && score > 0) {
          matchedResults.push({
            id: `prelims_${q.id}`,
            type: 'prelims',
            title: q.question_text,
            subtitle: q.explanation_markdown || '',
            subject: canonicalizeSubject(q.subject),
            year: q.exam_year,
            score,
            rawItem: q,
            matchedInQuestion: matchedInQ,
            matchedInExplanation: matchedInExpl,
            matchedInOptions: matchedInOpts,
          });
        }
      });

      // B. MAINS SEARCH (local cache only — the downloaded snapshot)
      await KVStore.ready();
      const sourceMains = mainsQuestions.length > 0 ? mainsQuestions : getInitialMainsQuestions();

      sourceMains.forEach((q: any) => {
        let score = 0;
        const rawQBody = String(q.questionText || q.question_text || q.question || q.question_body || '').trim();
        const qText = (rawQBody || String(q.title || '')).toLowerCase();

        const answersList = q.answers || [];
        let directAns = '';
        if (q.model_answer) directAns += ' ' + q.model_answer;
        if (q.answer_text) directAns += ' ' + q.answer_text;
        if (q.synopsis) directAns += ' ' + q.synopsis;

        const ansText = `${answersList.map((a: any) => `${a.answerText || a.answer_text || a.content || ''} ${a.synopsis || ''}`).join(' ')} ${directAns}`.toLowerCase();
        const metaText = `${q.subject || ''} ${q.sectionGroup || q.section_group || ''} ${q.microTopic || q.microtopic || ''} ${q.subTopic || q.subtopic || ''} ${q.macrotag || ''} ${q.microtag || ''}`.toLowerCase();

        let matchedInQ = false;
        let matchedInAns = false;

        keywordsList.forEach((kw, index) => {
          const weight = index === 0 ? 3 : 1;
          const kwInQ = qText ? textMatchesKeyword(qText, kw) : false;
          const kwInAns = ansText ? textMatchesKeyword(ansText, kw) : false;

          if (kwInQ) {
            score += 2 * weight;
            matchedInQ = true;
          }
          if (kwInAns) {
            score += 1.5 * weight;
            matchedInAns = true;
          }
          // metaText ONLY adds bonus relevance if the active target scope actually matched!
          if ((matchedInQ || matchedInAns) && metaText && textMatchesKeyword(metaText, kw)) {
            score += 0.5 * weight;
          }
        });

        // ── Topper copies: first-class results (parity with MainsAISearchView, app/mains.tsx) ──
        if (isTopperQuestion(q)) {
          if (!searchQuestion) return; // respect the existing search-scope toggle
          const topperAns =
            (q.answers || []).find((a: any) => isGenuineTopperAnswer(a)) || (q.answers || [])[0];
          const tName = (getTopperName(topperAns, q) || '').toLowerCase();
          const rawAir = getAir(topperAns, q);
          const tAir = String(rawAir ?? q.air_rank ?? '').toLowerCase();
          const searchLower = cleanQuery;
          const nameMatch = !!(tName && tName !== 'topper' && tName.includes(searchLower));
          const airMatch = !!(tAir && (tAir.includes(searchLower) || ('air ' + tAir).includes(searchLower)));

          if (matchedInQ || nameMatch || airMatch) {
            matchedResults.push({
              id: `topper_${q.id}`,
              type: 'topper',
              title: q.questionText || q.question_text || q.title || 'Topper Copy',
              subtitle: `${getTopperName(topperAns, q)}${rawAir ? ` (AIR ${rawAir})` : ''}`,
              subject: canonicalizeSubject(q.subject),
              paper: resolvePaper(q),
              year: q.year || q.exam_year || q.topper_year,
              score: Math.max(score, 1),
              rawItem: q,
              matchedInQuestion: matchedInQ || nameMatch || airMatch,
              matchedInExplanation: false,
              matchedInOptions: false,
            });
          }
          return; // never double-emit a topper row as a generic 'mains' card
        }

        const hasScopeMatch = (searchQuestion && matchedInQ) || (searchExplanation && matchedInAns);

        if (hasScopeMatch && score > 0) {
          matchedResults.push({
            id: `mains_${q.id}`,
            type: 'mains',
            title: q.questionText || q.question_text || q.title || 'Mains Question',
            subtitle: answersList.map((a: any) => a.answerText || a.answer_text || '').filter(Boolean).join(' ') || metaText,
            subject: canonicalizeSubject(q.subject),
            paper: resolvePaper(q),
            year: q.year || q.exam_year,
            score,
            rawItem: q,
            matchedInQuestion: matchedInQ,
            matchedInExplanation: matchedInAns,
            matchedInOptions: false,
          });
        }
      });

      // C. VALUE ADDITION SEARCH (Comprehensive field index search)
      let sourceVA = mainsValueAdd.length > 0 ? mainsValueAdd : getInitialValueAdditions();
      if ((!sourceVA || sourceVA.length === 0) && activeFilters.showValueAdd) {
        try {
          const liveVA = await fetchValueAdditionFromSupabase();
          if (liveVA && liveVA.length > 0) {
            sourceVA = liveVA;
            setMainsValueAdd(liveVA);
          }
        } catch (e) {
          console.log('[UnifiedSearch] on-demand value add fetch failed:', e);
        }
      }

      const uniqueVA = getUniqueValueAddItems(sourceVA);
      uniqueVA.forEach((va: any) => {
        let score = 0;
        const titleLower = String(va.title || '').toLowerCase();
        const textContent = getValueAddItemTextContent(va).toLowerCase();

        let matchedInTitle = false;
        let matchedInContent = false;

        keywordsList.forEach((kw, index) => {
          const weight = index === 0 ? 3 : 1;
          // In Value Add: 'Question' corresponds to the title/heading, 'Explanation' corresponds to content/notes
          const kwInTitle = titleLower ? textMatchesKeyword(titleLower, kw) : false;
          const kwInContent = textContent ? textMatchesKeyword(textContent, kw) : false;

          if (kwInTitle) {
            score += 2 * weight;
            matchedInTitle = true;
          }
          if (kwInContent) {
            score += 1.5 * weight;
            matchedInContent = true;
          }
        });

        const hasScopeMatch = (searchQuestion && matchedInTitle) || (searchExplanation && matchedInContent);

        if (hasScopeMatch && score > 0) {
          matchedResults.push({
            id: `valueadd_${va.id}`,
            type: 'value_add',
            title: va.title || 'Untitled Value Add',
            subtitle: va.rawContent || va.content_markdown || va.context || va.description || '',
            subject: canonicalizeSubject(va.subject),
            paper: resolvePaper(va) || normalizePaper(va.paper) || 'GS1',
            score,
            rawItem: va,
            matchedInQuestion: matchedInTitle,
            matchedInExplanation: matchedInContent,
            matchedInOptions: false,
          });
        }
      });

      setResults(matchedResults);

      // Save query to unified history
      if (currentQuery) {
        saveSearch(currentQuery)
          .then(next => setSearchHistory(next))
          .catch(() => {});
      }
      setShowHistory(false);
    } catch (err) {
      Alert.alert('Search Error', 'Failed to execute query.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Auto-run search when opened with a query param ──
  const autoRanRef = useRef(false);
  useEffect(() => {
    const incoming = typeof params.q === 'string' ? params.q.trim() : '';
    if (incoming && !autoRanRef.current) {
      autoRanRef.current = true;
      setQuery(incoming);
      runIntegratedSearch(incoming, filters);
    }
  }, [params.q]);

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

    // Filter by active search scope ("SEARCH IN": Question, Explanation, Options)
    list = list.filter(item => matchesSearchScope(item, filters.searchAcross));

    // Filter by search stages
    list = list.filter(item => {
      if (item.type === 'prelims' && !filters.showPrelims) return false;
      if (item.type === 'mains' && !filters.showMains) return false;
      if (item.type === 'topper' && !filters.showToppers) return false;
      if (item.type === 'value_add' && !filters.showValueAdd) return false;
      return true;
    });

    // Filter by subject
    if (filters.subjects.length > 0) {
      list = list.filter(item => {
        if (!item.subject) return false;
        const normSub = canonicalizeSubject(item.subject);
        return filters.subjects.some(s => canonicalizeSubject(s) === normSub);
      });
    }

    // Filter by PYQ status
    if (filters.pyqFilter === 'PYQ Only') {
      list = list.filter(item => {
        if (item.type === 'topper') return true;
        if (item.type === 'prelims') return item.rawItem.is_pyq;
        if (item.type === 'mains') return item.rawItem.is_pyq || item.rawItem.isPyq;
        return false;
      });
    } else if (filters.pyqFilter === 'Non-PYQ') {
      list = list.filter(item => {
        if (item.type === 'topper') return true;
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
        if (item.type === 'mains' || item.type === 'value_add' || item.type === 'topper') {
          const normP = normalizePaper(item.paper);
          return filters.mainsPapers.some(p => normalizePaper(p) === normP || p === item.paper);
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
        if (item.type === 'topper') return true;
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
        if (item.type === 'topper') return true;
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

    // Filter by Sections (prelims)
    if (filters.sections.length > 0) {
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const sec = item.rawItem.section_group || item.rawItem.sectionGroup;
          return sec && filters.sections.includes(sec);
        }
        return false;
      });
    }

    // Filter by Microtopics (prelims)
    if (filters.microtopics.length > 0) {
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const mt = item.rawItem.micro_topic || item.rawItem.microTopic;
          return mt && filters.microtopics.includes(mt);
        }
        return false;
      });
    }

    // Filter by Prelims Year Range
    if (filters.yearRange) {
      const yr = filters.yearRange.trim();
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const y = item.rawItem.exam_year || item.year;
          if (!y) return false;
          if (yr.includes('-')) {
            const [minY, maxY] = yr.split('-').map(x => parseInt(x.trim(), 10));
            return y >= minY && y <= maxY;
          }
          if (yr.includes(',')) {
            const years = yr.split(',').map(x => parseInt(x.trim(), 10));
            return years.includes(y);
          }
          return y === parseInt(yr, 10);
        }
        return false;
      });
    }

    // Filter by Mains Subtopics
    if (filters.subtopics.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'topper') {
          const sub = getQuestionSub(item.rawItem);
          return sub && filters.subtopics.includes(sub);
        }
        if (item.type === 'value_add') {
          const sub = getValueAddSub(item.rawItem);
          return sub && filters.subtopics.includes(sub);
        }
        return false;
      });
    }

    // Filter by Mains Nanotopics
    if (filters.nanotopics.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'topper') {
          const nano = getQuestionNano(item.rawItem);
          return nano && filters.nanotopics.includes(nano);
        }
        if (item.type === 'value_add') {
          const nano = getValueAddNano(item.rawItem);
          return nano && filters.nanotopics.includes(nano);
        }
        return false;
      });
    }

    // Filter by Mains Macrotags
    if (filters.macrotags.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'topper') {
          const tags = (item.rawItem.macrotag || '').split(',').map((t: string) => t.trim());
          return tags.some((t: string) => filters.macrotags.includes(t));
        }
        return false;
      });
    }

    // Filter by Mains Microtags
    if (filters.microtags.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'topper') {
          const tags = (item.rawItem.microtag || '').split(',').map((t: string) => t.trim());
          return tags.some((t: string) => filters.microtags.includes(t));
        }
        return false;
      });
    }

    // Filter by Mains Years
    if (filters.mainsYears.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'topper') {
          const y = String(item.rawItem.year || item.rawItem.exam_year || item.rawItem.topper_year || '');
          return filters.mainsYears.includes(y);
        }
        return false;
      });
    }

    // Filter by Revision Tags (both Prelims and Mains)
    if (filters.revisionTags.length > 0) {
      list = list.filter(item => {
        if (item.type === 'prelims') {
          const tags = prelimsTaggedMap[item.rawItem.id] || [];
          return tags.some(t => filters.revisionTags.includes(t));
        }
        if (item.type === 'mains' || item.type === 'topper') {
          const tags = userQuestionStates[item.rawItem.id]?.reviewTags || [];
          return tags.some(t => filters.revisionTags.includes(t));
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

    // Sidebar specific subject drill-down (matching ai-search and mains)
    if (sidebarSubjectFilter) {
      const normSide = canonicalizeSubject(sidebarSubjectFilter);
      list = list.filter(r => r.subject && canonicalizeSubject(r.subject) === normSide);
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
  }, [results, filters, excludedKeywords, sortMode, sidebarSubjectFilter, userQuestionStates, prelimsTaggedMap]);

  const activeResults = sortedAndFilteredResults;
  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

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
    await toggleBookmark(id);
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
    if (item.type === 'topper') {
      const topperAns =
        (item.rawItem.answers || []).find((a: any) => isTopperAnswer(a)) || item.rawItem.answers?.[0];
      const qKey = normalizeQuestionKey(item.rawItem);
      const attached = topperAttachmentMap.get(qKey) || [];
      return (
        <QuestionBankTopperCard
          key={item.id}
          question={item.rawItem}
          topperAnswer={topperAns}
          attachedToppers={attached.length > 0 ? attached : undefined}
          colors={colors}
          isDark={isDark}
          zoomFontSize={15}
          isBookmarked={savedQuestionIds.includes(item.rawItem.id)}
          onToggleBookmark={toggleBookmark}
          onOpenViewer={handleOpenTopperViewer}
          onOpenDetailed={() => setPreviewMainsQuestion(item.rawItem)}
          searchQuery={query}
        />
      );
    }

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

    // Build context snippet depending on type and active search scope
    let snippetComponent: React.ReactNode;
    if (item.type === 'prelims') {
      const expl = filters.searchAcross.includes('Explanation') ? (item.rawItem.explanation_markdown || item.rawItem.explanation) : null;
      const opts = filters.searchAcross.includes('Options') ? item.rawItem.options : null;
      snippetComponent = buildContextSnippet(item.rawItem.question_text, keywords, opts, expl, query);
    } else if (item.type === 'mains') {
      const expl = filters.searchAcross.includes('Explanation') ? item.subtitle : null;
      snippetComponent = buildContextSnippet(item.rawItem.questionText || item.title, keywords, null, expl, query);
    } else {
      const expl = filters.searchAcross.includes('Explanation') ? item.subtitle : null;
      snippetComponent = buildContextSnippet(item.rawItem.title, keywords, null, expl, query);
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

              {prelimsInst && prelimsInst.toUpperCase() !== 'UPSC' && prelimsInst.toUpperCase() !== 'CSE' ? (
                <View style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[styles.chipText, { color: '#1d4ed8' }]}>{prelimsInst}</Text>
                </View>
              ) : (
                !(item.rawItem.is_pyq || item.rawItem.isPyq) && !prelimsInst && (
                  <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                    <Text style={[styles.chipText, { color: colors.textTertiary }]}>Practice</Text>
                  </View>
                )
              )}

              {prelimsProg && prelimsProg.toUpperCase() !== 'UPSC' && prelimsProg.toUpperCase() !== 'CSE' ? (
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
                activeTab={activeMainsTabs[item.id] || getCleanAvailableAnswers(item.rawItem.answers || [])[0]?.institute || ''}
                onActiveTabChange={(tab) => {
                  setActiveMainsTabs(prev => ({ ...prev, [item.id]: tab }));
                }}
              />
            )}
          </View>
        )}
        </View>
      </View>
    );
  };

  const toggleFilterChip = (
    key:
      | 'subjects'
      | 'mainsPapers'
      | 'institutes'
      | 'programmes'
      | 'sections'
      | 'microtopics'
      | 'revisionTags'
      | 'subtopics'
      | 'nanotopics'
      | 'macrotags'
      | 'microtags'
      | 'mainsYears',
    value: string
  ) => {
    setFilters(p => {
      if (value === 'All') {
        return { ...p, [key]: [] };
      }
      if (key === 'subjects') {
        const canonicalVal = canonicalizeSubject(value);
        const isSel = p.subjects.some(s => canonicalizeSubject(s) === canonicalVal);
        const next = isSel
          ? p.subjects.filter(s => canonicalizeSubject(s) !== canonicalVal)
          : [...p.subjects.filter(s => canonicalizeSubject(s) !== canonicalVal), canonicalVal];
        return { ...p, subjects: next };
      }
      const current = (p[key] as string[]) || [];
      const next = current.includes(value)
        ? current.filter(x => x !== value)
        : [...current, value];
      return { ...p, [key]: next };
    });
  };

  const toggleStage = (key: 'showPrelims' | 'showMains' | 'showToppers' | 'showValueAdd') => {
    setFilters(p => {
      const nextVal = !p[key];
      const next = { ...p, [key]: nextVal };
      // If Prelims turned off, reset prelims-only options
      if (!next.showPrelims) {
        next.ncertFilter = 'All';
        next.examCategory = 'All';
        next.sections = [];
        next.microtopics = [];
        next.yearRange = '';
      }
      // If Mains, Toppers, and ValueAdd all turned off, reset mains filters
      if (!next.showMains && !next.showToppers && !next.showValueAdd) {
        next.mainsPapers = [];
        next.subtopics = [];
        next.nanotopics = [];
        next.macrotags = [];
        next.microtags = [];
        next.mainsYears = [];
      }
      return next;
    });
    setSidebarSubjectFilter(null);
  };

  const mdStyles = buildMarkdownStyles(
    colors.textPrimary,
    14,
    colors.surface,
    colors.border,
    colors.primary
  );
  const mdRules = getMarkdownRules(colors, isDark, setZoomImageUri);

  const renderFilterGroupHeader = (key: string, label: string, badgeCount?: string | number, isActive?: boolean) => {
    const isCollapsed = collapsedFilters[key] ?? true;
    return (
      <TouchableOpacity
        onPress={() => setCollapsedFilters(p => ({ ...p, [key]: !isCollapsed }))}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 10,
          borderBottomWidth: 0.5,
          borderBottomColor: isActive ? colors.primary + '60' : colors.border,
          marginBottom: isCollapsed ? 12 : 8,
          backgroundColor: isActive && !isCollapsed ? colors.primary + '0a' : 'transparent',
          borderRadius: 8,
          paddingHorizontal: 4,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isActive ? colors.primary : colors.textTertiary, letterSpacing: 1 }}>
            {label}
          </Text>
          {badgeCount !== undefined && (
            <View style={{ backgroundColor: isActive ? colors.primary : colors.border + '60', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 8, fontWeight: '800', color: isActive ? '#fff' : colors.textTertiary }}>
                {badgeCount}
              </Text>
            </View>
          )}
        </View>
        {isCollapsed ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronUp size={14} color={isActive ? colors.primary : colors.textTertiary} />}
      </TouchableOpacity>
    );
  };

  const LeftPanelFilters = (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={true}>
      {/* 0. Live Search Stats Panel (matching ai-search and mains) */}
      {hasSearched && results.length > 0 && (
        <View style={{ marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 8 }}>
            RESULT BREAKDOWN
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>{activeResults.length}</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: colors.textTertiary }}>Total</Text>
            </View>
            <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#15803D' }}>{activeResults.filter(r => r.type === 'prelims').length}</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#166534' }}>Prelims</Text>
            </View>
            <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: '#FFEDD5', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#C2410C' }}>{activeResults.filter(r => r.type === 'mains').length}</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#9A3412' }}>Mains</Text>
            </View>
            <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: '#FFF7ED', alignItems: 'center', borderWidth: 0.5, borderColor: '#FED7AA' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#EA580C' }}>{activeResults.filter(r => r.type === 'topper').length}</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#C2410C' }}>Toppers</Text>
            </View>
            <View style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#7E22CE' }}>{activeResults.filter(r => r.type === 'value_add').length}</Text>
              <Text style={{ fontSize: 9, fontWeight: '600', color: '#6B21A8' }}>Value Adds</Text>
            </View>
          </View>
        </View>
      )}

      {/* 0.1 Interactive Keywords Exclusion Section (matching ai-search and mains) */}
      {keywords.length > 0 && (
        <View style={{ marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Sparkles size={12} color="#7C3AED" />
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#7C3AED', letterSpacing: 1 }}>
                {keywords.length - excludedKeywords.size}/{keywords.length} KEYWORDS
              </Text>
            </View>
            {excludedKeywords.size > 0 && (
              <TouchableOpacity onPress={() => setExcludedKeywords(new Set())}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#EF4444' }}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 8 }}>
            💡 Tap to exclude keywords from search
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {keywords.map((kw, i) => {
              const isExcluded = excludedKeywords.has(kw);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleExcludedKeyword(kw)}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: isExcluded ? (isDark ? '#334155' : '#F1F5F9') : '#EDE9FE',
                      borderColor: isExcluded ? colors.border : '#C4B5FD',
                      opacity: isExcluded ? 0.5 : 1,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                    }
                  ]}
                >
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: isExcluded ? colors.textTertiary : '#7C3AED',
                    textDecorationLine: isExcluded ? 'line-through' : 'none',
                  }}>
                    {kw}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* 0.2 Quick Subject Drill-down in Search Results (matching ai-search and mains) */}
      {hasSearched && results.length > 0 && allResultSubjects.length > 0 && (
        <View style={{ marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 8 }}>
            BY SUBJECT IN RESULTS
          </Text>
          {sidebarSubjectFilter && (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', marginBottom: 8, alignSelf: 'flex-start' }}
              onPress={() => setSidebarSubjectFilter(null)}
            >
              <X size={12} color="#EF4444" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>Clear: {sidebarSubjectFilter}</Text>
            </TouchableOpacity>
          )}
          <View style={{ gap: 6 }}>
            {allResultSubjects.map(sub => {
              const canonSub = canonicalizeSubject(sub);
              const count = resultCounts.subjectCounts[canonSub] ?? 0;
              const isSelected = sidebarSubjectFilter ? canonicalizeSubject(sidebarSubjectFilter) === canonSub : false;
              const color = getSubjectColor(canonSub);
              return (
                <TouchableOpacity
                  key={canonSub}
                  onPress={() => setSidebarSubjectFilter(isSelected ? null : canonSub)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: isSelected ? colors.primary : colors.border,
                    backgroundColor: isSelected ? colors.primary + '15' : colors.surface,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
                    <Text style={{ fontSize: 12, fontWeight: isSelected ? '700' : '500', color: isSelected ? colors.primary : colors.textPrimary }} numberOfLines={1}>
                      {sub}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: isSelected ? colors.primary : colors.border + '60', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: isSelected ? '#fff' : colors.textTertiary }}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Reset All Filters button if any filter is active */}
      {activeFilterCount > 0 && (
        <TouchableOpacity
          onPress={() => setFilters(DEFAULT_FILTERS)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            backgroundColor: '#FEE2E2',
            borderWidth: 1,
            borderColor: '#FCA5A5',
            marginBottom: 14,
          }}
        >
          <RotateCcw size={13} color="#DC2626" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626' }}>
            Reset All Filters ({activeFilterCount})
          </Text>
        </TouchableOpacity>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: CONTENT
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 11, fontWeight: '900', color: colors.primary, letterSpacing: 1.2 }}>
          1. CONTENT
        </Text>
      </View>

      {/* Search Stages */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader(
          'searchStages', 
          'SEARCH STAGES', 
          `${(filters.showPrelims ? 1 : 0) + (filters.showMains ? 1 : 0) + (filters.showToppers ? 1 : 0) + (filters.showValueAdd ? 1 : 0)}/4`,
          !filters.showPrelims || !filters.showMains || !filters.showToppers || !filters.showValueAdd
        )}
        {!collapsedFilters.searchStages && (
          <View>
            <TouchableOpacity
              onPress={() => toggleStage('showPrelims')}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, filters.showPrelims && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {filters.showPrelims && <Check size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 }}>Prelims Questions</Text>
              {hasSearched && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>
                  {resultCounts.stageCounts.prelims}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleStage('showMains')}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, filters.showMains && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {filters.showMains && <Check size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 }}>Mains Questions</Text>
              {hasSearched && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>
                  {resultCounts.stageCounts.mains}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleStage('showToppers')}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, filters.showToppers && { backgroundColor: '#ea580c', borderColor: '#ea580c' }]}>
                {filters.showToppers && <Check size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 }}>Topper Copies</Text>
              {hasSearched && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>
                  {resultCounts.stageCounts.topper}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => toggleStage('showValueAdd')}
              style={styles.checkboxRow}
            >
              <View style={[styles.checkbox, filters.showValueAdd && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                {filters.showValueAdd && <Check size={12} color="#fff" />}
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, flex: 1 }}>Value Additions</Text>
              {hasSearched && (
                <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>
                  {resultCounts.stageCounts.value_add}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Search Scope ("SEARCH IN") */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader('searchScope', 'SEARCH IN', `${filters.searchAcross.length}/3`, filters.searchAcross.length !== 3)}
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
                    const next = filters.searchAcross.includes(opt.key)
                      ? filters.searchAcross.filter(x => x !== opt.key)
                      : [...filters.searchAcross, opt.key];
                    if (next.length === 0) return;
                    const newFilters = { ...filters, searchAcross: next };
                    setFilters(newFilters);
                    if (hasSearched && query.trim()) {
                      runIntegratedSearch(query, newFilters, searchEngineMode);
                    }
                  }}
                  style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt.label}</Text>
                  {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: PRELIMS FILTERS (Visible when showPrelims is enabled)
         ═══════════════════════════════════════════════════════════════════════ */}
      {filters.showPrelims && (
        <View>
          <View style={{ marginTop: 8, marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#16A34A40' }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#16A34A', letterSpacing: 1.2 }}>
              2. PRELIMS FILTERS
            </Text>
          </View>

          {/* NCERT Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader('ncert', 'NCERT FILTER (PRELIMS)', filters.ncertFilter !== 'All' ? filters.ncertFilter : undefined, filters.ncertFilter !== 'All')}
            {!collapsedFilters.ncert && (
              <View style={styles.chipsWrap}>
                {(['All', 'NCERT Only', 'Non-NCERT'] as const).map(opt => {
                  const isSelected = filters.ncertFilter === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setFilters(p => ({ ...p, ncertFilter: opt }))}
                      style={[styles.fchip, isSelected && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Exam Category Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader('examCategory', 'EXAM CATEGORY (PRELIMS)', filters.examCategory !== 'All' ? filters.examCategory : undefined, filters.examCategory !== 'All')}
            {!collapsedFilters.examCategory && (
              <View style={styles.chipsWrap}>
                {(['All', 'UPSC', 'Allied', 'Others'] as const).map(opt => {
                  const isSelected = filters.examCategory === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => setFilters(p => ({ ...p, examCategory: opt }))}
                      style={[styles.fchip, isSelected && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Sections / Modules Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'prelimsSections',
              'SECTIONS / MODULES (PRELIMS)',
              filters.sections.length === 0 ? 'All' : `${filters.sections.length}/${Math.max(prelimsSectionOptions.length - 1, 1)}`,
              filters.sections.length > 0
            )}
            {!collapsedFilters.prelimsSections && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('sections', 'All')}
                  style={[styles.fchip, filters.sections.length === 0 && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.sections.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.sections.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {prelimsSectionOptions.filter(x => x !== 'All').map(sec => {
                  const isSelected = filters.sections.includes(sec);
                  return (
                    <TouchableOpacity
                      key={sec}
                      onPress={() => toggleFilterChip('sections', sec)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sec}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Microtopics Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'prelimsMicrotopics',
              'MICROTOPICS (PRELIMS)',
              filters.microtopics.length === 0 ? 'All' : `${filters.microtopics.length}/${Math.max(prelimsMicrotopicOptions.length - 1, 1)}`,
              filters.microtopics.length > 0
            )}
            {!collapsedFilters.prelimsMicrotopics && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('microtopics', 'All')}
                  style={[styles.fchip, filters.microtopics.length === 0 && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.microtopics.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.microtopics.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {prelimsMicrotopicOptions.filter(x => x !== 'All').map(mt => {
                  const isSelected = filters.microtopics.includes(mt);
                  return (
                    <TouchableOpacity
                      key={mt}
                      onPress={() => toggleFilterChip('microtopics', mt)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{mt}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Prelims Year Range */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'prelimsYearRange',
              'YEAR RANGE (PRELIMS)',
              filters.yearRange ? filters.yearRange : 'All',
              !!filters.yearRange
            )}
            {!collapsedFilters.prelimsYearRange && (
              <View>
                <View style={styles.chipsWrap}>
                  {['All', '2024', '2023', '2022', '2021', '2020', '2015-2024', '2010-2019'].map(yr => {
                    const isSelected = yr === 'All' ? !filters.yearRange : filters.yearRange === yr;
                    return (
                      <TouchableOpacity
                        key={yr}
                        onPress={() => setFilters(p => ({ ...p, yearRange: yr === 'All' ? '' : yr }))}
                        style={[styles.fchip, isSelected && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{yr}</Text>
                        {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                  <TextInput
                    placeholder="Custom (e.g. 2018-2024)"
                    placeholderTextColor={colors.textTertiary}
                    value={filters.yearRange}
                    onChangeText={txt => setFilters(p => ({ ...p, yearRange: txt }))}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: colors.border,
                      paddingHorizontal: 10,
                      fontSize: 12,
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                    }}
                  />
                  {filters.yearRange ? (
                    <TouchableOpacity onPress={() => setFilters(p => ({ ...p, yearRange: '' }))} style={{ padding: 4 }}>
                      <X size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: MAINS FILTERS (Visible when Mains, Toppers or ValueAdd enabled)
         ═══════════════════════════════════════════════════════════════════════ */}
      {(filters.showMains || filters.showToppers || filters.showValueAdd) && (
        <View>
          <View style={{ marginTop: 8, marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: '#EA580C40' }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: '#EA580C', letterSpacing: 1.2 }}>
              3. MAINS FILTERS
            </Text>
          </View>

          {/* Paper (Mains) filter with Live Facet Counts */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'mainsPaper', 
              'PAPER (MAINS)', 
              filters.mainsPapers.length === 0 ? 'All' : `${filters.mainsPapers.length}/${PAPER_OPTIONS.length}`,
              filters.mainsPapers.length > 0
            )}
            {!collapsedFilters.mainsPaper && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('mainsPapers', 'All')}
                  style={[styles.fchip, filters.mainsPapers.length === 0 && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.mainsPapers.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.mainsPapers.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {PAPER_OPTIONS.map(opt => {
                  const isSelected = filters.mainsPapers.includes(opt);
                  const count = resultCounts.paperCounts[opt] ?? 0;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => toggleFilterChip('mainsPapers', opt)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                      {hasSearched && (
                        <Text style={{ fontSize: 9, fontWeight: '700', marginLeft: 4, color: isSelected ? '#fff' : colors.textTertiary }}>
                          ({count})
                        </Text>
                      )}
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Subject Filter with Live Facet Counts */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'mainsSubject', 
              'SUBJECT (MAINS)', 
              filters.subjects.length === 0 ? 'All' : `${filters.subjects.length}/${Math.max(subjectOptions.length - 1, 1)}`,
              filters.subjects.length > 0
            )}
            {!collapsedFilters.mainsSubject && (
              <View>
                {filters.subjects.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {filters.subjects.map(s => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => toggleFilterChip('subjects', s)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: 10, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }}
                      >
                        <X size={10} color="#EF4444" />
                        <Text style={{ fontSize: 10, fontWeight: '700', color: '#DC2626' }}>Clear: {s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('subjects', 'All')}
                    style={[styles.fchip, filters.subjects.length === 0 && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                  >
                    <Text style={[styles.fchipText, { color: filters.subjects.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {filters.subjects.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                  {subjectOptions.filter(x => x !== 'All').map(sub => {
                    const canonSub = canonicalizeSubject(sub);
                    const isSelected = filters.subjects.some(s => canonicalizeSubject(s) === canonSub);
                    const count = resultCounts.subjectCounts[canonSub] ?? 0;
                    return (
                      <TouchableOpacity
                        key={canonSub}
                        onPress={() => toggleFilterChip('subjects', canonSub)}
                        style={[styles.fchip, isSelected && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sub}</Text>
                        {hasSearched && (
                          <Text style={{ fontSize: 9, fontWeight: '700', marginLeft: 4, color: isSelected ? '#fff' : colors.textTertiary }}>
                            ({count})
                          </Text>
                        )}
                        {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          {/* Subtopics Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'mainsSubtopic',
              'SUBTOPICS (MAINS)',
              filters.subtopics.length === 0 ? 'All' : `${filters.subtopics.length}/${Math.max(mainsSubtopicOptions.length - 1, 1)}`,
              filters.subtopics.length > 0
            )}
            {!collapsedFilters.mainsSubtopic && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('subtopics', 'All')}
                  style={[styles.fchip, filters.subtopics.length === 0 && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.subtopics.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.subtopics.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {mainsSubtopicOptions.filter(x => x !== 'All').map(sub => {
                  const isSelected = filters.subtopics.includes(sub);
                  return (
                    <TouchableOpacity
                      key={sub}
                      onPress={() => toggleFilterChip('subtopics', sub)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sub}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Nanotopics Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'mainsNanotopic',
              'NANOTOPICS (MAINS)',
              filters.nanotopics.length === 0 ? 'All' : `${filters.nanotopics.length}/${Math.max(mainsNanotopicOptions.length - 1, 1)}`,
              filters.nanotopics.length > 0
            )}
            {!collapsedFilters.mainsNanotopic && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('nanotopics', 'All')}
                  style={[styles.fchip, filters.nanotopics.length === 0 && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.nanotopics.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.nanotopics.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {mainsNanotopicOptions.filter(x => x !== 'All').map(nano => {
                  const isSelected = filters.nanotopics.includes(nano);
                  return (
                    <TouchableOpacity
                      key={nano}
                      onPress={() => toggleFilterChip('nanotopics', nano)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{nano}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Macro Tags Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'mainsMacrotag',
              'MACRO TAGS (MAINS)',
              filters.macrotags.length === 0 ? 'All' : `${filters.macrotags.length}/${Math.max(mainsMacrotagOptions.length - 1, 1)}`,
              filters.macrotags.length > 0
            )}
            {!collapsedFilters.mainsMacrotag && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('macrotags', 'All')}
                  style={[styles.fchip, filters.macrotags.length === 0 && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.macrotags.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.macrotags.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {mainsMacrotagOptions.filter(x => x !== 'All').map(tag => {
                  const isSelected = filters.macrotags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleFilterChip('macrotags', tag)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{tag}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Micro Tags Filter */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'mainsMicrotag',
              'MICRO TAGS (MAINS)',
              filters.microtags.length === 0 ? 'All' : `${filters.microtags.length}/${Math.max(mainsMicrotagOptions.length - 1, 1)}`,
              filters.microtags.length > 0
            )}
            {!collapsedFilters.mainsMicrotag && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('microtags', 'All')}
                  style={[styles.fchip, filters.microtags.length === 0 && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.microtags.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.microtags.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {mainsMicrotagOptions.filter(x => x !== 'All').map(tag => {
                  const isSelected = filters.microtags.includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleFilterChip('microtags', tag)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{tag}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          {/* Mains Years */}
          <View style={styles.filterGroup}>
            {renderFilterGroupHeader(
              'mainsYear',
              'EXAM YEAR (MAINS)',
              filters.mainsYears.length === 0 ? 'All' : `${filters.mainsYears.length}/${Math.max(mainsYearOptions.length - 1, 1)}`,
              filters.mainsYears.length > 0
            )}
            {!collapsedFilters.mainsYear && (
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('mainsYears', 'All')}
                  style={[styles.fchip, filters.mainsYears.length === 0 && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                >
                  <Text style={[styles.fchipText, { color: filters.mainsYears.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {filters.mainsYears.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {mainsYearOptions.filter(x => x !== 'All').map(yr => {
                  const isSelected = filters.mainsYears.includes(yr);
                  return (
                    <TouchableOpacity
                      key={yr}
                      onPress={() => toggleFilterChip('mainsYears', yr)}
                      style={[styles.fchip, isSelected && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{yr}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: COMMON
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginTop: 8, marginBottom: 12, paddingBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textSecondary, letterSpacing: 1.2 }}>
          4. COMMON
        </Text>
      </View>

      {/* PYQ Status */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader(
          'pyqStatus', 
          'PYQ STATUS', 
          filters.pyqFilter !== 'All' ? filters.pyqFilter : 'All',
          filters.pyqFilter !== 'All'
        )}
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
                  {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Institute Filter with Live Facet Counts */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader(
          'institute', 
          'INSTITUTE', 
          filters.institutes.length === 0 ? 'All' : `${filters.institutes.length}/${Math.max(instituteOptions.length - 1, 1)}`,
          filters.institutes.length > 0
        )}
        {!collapsedFilters.institute && (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              onPress={() => toggleFilterChip('institutes', 'All')}
              style={[styles.fchip, filters.institutes.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.fchipText, { color: filters.institutes.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
              {filters.institutes.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
            {instituteOptions.filter(x => x !== 'All').map(inst => {
              const isSelected = filters.institutes.includes(inst);
              const count = resultCounts.instituteCounts[inst] ?? 0;
              return (
                <TouchableOpacity
                  key={inst}
                  onPress={() => toggleFilterChip('institutes', inst)}
                  style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                >
                  <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{inst}</Text>
                  {hasSearched && (
                    <Text style={{ fontSize: 9, fontWeight: '700', marginLeft: 4, color: isSelected ? '#fff' : colors.textTertiary }}>
                      ({count})
                    </Text>
                  )}
                  {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Programme Filter */}
      <View style={styles.filterGroup}>
        {renderFilterGroupHeader(
          'programme', 
          'PROGRAMME', 
          filters.programmes.length === 0 ? 'All' : `${filters.programmes.length}/${Math.max(programmeOptions.length - 1, 1)}`,
          filters.programmes.length > 0
        )}
        {!collapsedFilters.programme && (
          <View style={styles.chipsWrap}>
            <TouchableOpacity
              onPress={() => toggleFilterChip('programmes', 'All')}
              style={[styles.fchip, filters.programmes.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.fchipText, { color: filters.programmes.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
              {filters.programmes.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
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
                  {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {/* Revision Tags Filter */}
      {userTags.length > 0 && (
        <View style={styles.filterGroup}>
          {renderFilterGroupHeader(
            'revisionTags',
            'REVISION TAGS',
            filters.revisionTags.length === 0 ? 'All' : `${filters.revisionTags.length}/${userTags.length}`,
            filters.revisionTags.length > 0
          )}
          {!collapsedFilters.revisionTags && (
            <View style={styles.chipsWrap}>
              <TouchableOpacity
                onPress={() => toggleFilterChip('revisionTags', 'All')}
                style={[styles.fchip, filters.revisionTags.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.fchipText, { color: filters.revisionTags.length === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                {filters.revisionTags.length === 0 && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
              {userTags.map(tag => {
                const isSelected = filters.revisionTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleFilterChip('revisionTags', tag)}
                    style={[styles.fchip, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{tag}</Text>
                    {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
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
            clearSearchHistory().catch(() => {});
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
                removeSearchItem(h)
                  .then(next => setSearchHistory(next))
                  .catch(() => {});
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
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ padding: 8, marginLeft: -8 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                testID="search-back-button"
              >
                <ChevronLeft size={24} color={colors.textPrimary} />
              </TouchableOpacity>
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
            {hasSearched && (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ padding: 6, marginRight: -2 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                testID="search-back-button-searched"
              >
                <ChevronLeft size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
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
                onFocus={() => {
                  loadSearchHistory().then(h => {
                    setSearchHistory(h);
                    if (h.length > 0) setShowHistory(true);
                  }).catch(() => {
                    if (searchHistory.length > 0) setShowHistory(true);
                  });
                }}
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
                style={[styles.mobFilterBtn, { backgroundColor: colors.surface, borderColor: colors.border, position: 'relative' }]}
              >
                <Filter size={18} color={activeFilterCount > 0 ? colors.primary : colors.textSecondary} />
                {activeFilterCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    backgroundColor: colors.primary,
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 3,
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>{activeFilterCount}</Text>
                  </View>
                )}
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
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Header Bar */}
        {!hasSearched && (
          <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ padding: 8, marginLeft: -8 }}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                testID="search-back-button-static"
              >
                <ChevronLeft size={24} color={colors.textPrimary} />
              </TouchableOpacity>
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
                      loadSearchHistory().then(h => {
                        setSearchHistory(h);
                        if (h.length > 0) {
                          setShowHistory(true);
                          setTimeout(() => {
                            landingScrollRef.current?.scrollToEnd({ animated: true });
                          }, 50);
                        }
                      }).catch(() => {
                        if (searchHistory.length > 0) {
                          setShowHistory(true);
                          setTimeout(() => {
                            landingScrollRef.current?.scrollToEnd({ animated: true });
                          }, 50);
                        }
                      });
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
                    style={[styles.mobFilterBtn, { height: 52, width: 52, borderRadius: 26, backgroundColor: colors.surface, borderColor: colors.border, position: 'relative' }]}
                  >
                    <Filter size={20} color={activeFilterCount > 0 ? colors.primary : colors.textSecondary} />
                    {activeFilterCount > 0 && (
                      <View style={{
                        position: 'absolute',
                        top: -2,
                        right: -2,
                        backgroundColor: colors.primary,
                        borderRadius: 10,
                        minWidth: 20,
                        height: 20,
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingHorizontal: 4,
                      }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>{activeFilterCount}</Text>
                      </View>
                    )}
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

      {/* Floating Sidebar Toggle Button (matching ai-search and mains) */}
      <TouchableOpacity
        testID="search-toggle-sidebar"
        onPress={() => {
          if (IS_IPAD) {
            setSidebarOpen(!sidebarOpen);
          } else {
            setFilterOpen(!filterOpen);
          }
        }}
        style={{
          position: 'absolute',
          bottom: 24,
          left: 20,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: (IS_IPAD ? sidebarOpen : filterOpen) ? (isDark ? '#475569' : '#64748B') : colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.primary,
          shadowOpacity: 0.35,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
          zIndex: 9999,
        }}
      >
        {(IS_IPAD ? sidebarOpen : filterOpen) ? (
          <ChevronLeft size={20} color="#fff" />
        ) : (
          <SlidersHorizontal size={18} color="#fff" />
        )}
      </TouchableOpacity>

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
            <View style={{ flex: 1 }}>
              {LeftPanelFilters}
            </View>
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
            savedIds={savedQuestionIds}
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

      {/* Fullscreen Topper Copy Lightbox (parity with app/mains.tsx) */}
      <TopperImageViewerModal
        visible={topperViewerVisible}
        images={topperViewerImages}
        initialIndex={topperViewerIndex}
        topperName={topperViewerName}
        air={topperViewerAir}
        questionText={topperViewerQuestionText}
        onClose={() => setTopperViewerVisible(false)}
      />
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
    flexDirection: 'row',
    alignItems: 'center',
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
