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
  Clock,
  Play,
  RefreshCw,
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
  fetchMainsQuestionsFromSupabase,
  MAINS_QUESTIONS_CACHE_KEY,
} from '../src/data/mainsConsolidatedLoader';
import { TopperImageCacheService } from '../src/services/TopperImageCacheService';
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
import { DetailedQuestionView, ValueAddCardBody, getMarkdownRules, parseIntroductoryBox, resolveItemConcept } from './mains';
import MainsQuestionCard from '../src/components/mains/MainsQuestionCard';
import SidebarDisplayPreferences from '../src/components/mains/SidebarDisplayPreferences';
import {
  KeyBoxColor,
  setGlobalTextColorMode,
  setGlobalKeyBoxMode,
  setGlobalKeyBoxColor,
} from '../src/utils/mainsCardHelpers';
import * as Haptics from 'expo-haptics';
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
  _searchTier?: number;
};

type UnifiedFilters = {
  showPrelims: boolean;
  showMains: boolean;
  showToppers: boolean;
  showValueAdd: boolean;
  pyqFilter: 'All' | 'PYQ Only' | 'Non-PYQ';
  examCategory: 'All' | 'UPSC' | 'Allied' | 'Others' | 'NEET PG' | 'INI-CET' | 'UPSC CMS';
  alliedExams: string[];
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
  mainsSections?: string[];
  mainsMicrotopics?: string[];
  subtopics: string[];
  nanotopics: string[];
  tags: string[];
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
  alliedExams: [],
  ncertFilter: 'All',
  subjects: [],
  mainsPapers: [],
  institutes: [],
  programmes: [],
  searchAcross: ['Question'],
  sections: [],
  microtopics: [],
  mainsSections: [],
  mainsMicrotopics: [],
  revisionTags: [],
  yearRange: '',
  mainsYears: [],
  subtopics: [],
  nanotopics: [],
  tags: [],
  macrotags: [],
  microtags: [],
};

export function countActiveFiltersBySection(f: UnifiedFilters): {
  prelims: number;
  mains: number;
  institutes: number;
  revision: number;
  display: number;
} {
  let prelims = 0;
  if (f.ncertFilter !== 'All') prelims++;
  if (f.sections.length > 0) prelims += f.sections.length;
  if (f.microtopics.length > 0) prelims += f.microtopics.length;
  if (f.yearRange) prelims++;
  if (f.subjects.length > 0) {
    if (f.showMains && f.mainsPapers.length > 0) {
      // counted in mains
    } else if (f.showPrelims) {
      prelims += f.subjects.length;
    }
  }

  let mains = 0;
  if (f.mainsPapers.length > 0) mains += f.mainsPapers.length;
  if (f.showMains && f.mainsPapers.length > 0 && f.subjects.length > 0) mains += f.subjects.length;
  if ((f.mainsSections || []).length > 0) mains += f.mainsSections!.length;
  if ((f.mainsMicrotopics || []).length > 0) mains += f.mainsMicrotopics!.length;
  if (f.subtopics.length > 0) mains += f.subtopics.length;
  if (f.nanotopics.length > 0) mains += f.nanotopics.length;
  if (f.tags && f.tags.length > 0) mains += f.tags.length;
  if (f.macrotags.length > 0) mains += f.macrotags.length;
  if (f.microtags.length > 0) mains += f.microtags.length;
  if (f.mainsYears.length > 0) mains += f.mainsYears.length;

  let institutes = 0;
  if (f.institutes.length > 0) institutes += f.institutes.length;
  if (f.programmes.length > 0) institutes += f.programmes.length;

  let revision = 0;
  if (f.revisionTags.length > 0) revision += f.revisionTags.length;

  return { prelims, mains, institutes, revision, display: 0 };
}

export function countActiveFilters(f: UnifiedFilters): number {
  let total = 0;
  if (!f.showPrelims || !f.showMains || !f.showToppers || !f.showValueAdd) total++;
  if (f.pyqFilter !== 'All') total++;
  if (f.examCategory !== 'All') total++;
  if (f.alliedExams && f.alliedExams.length > 0) total += f.alliedExams.length;
  const s = countActiveFiltersBySection(f);
  return total + s.prelims + s.mains + s.institutes + s.revision;
}

export const PAPER_OPTIONS = ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'] as const;

// Preserve subject names and data labels exactly as they exist in data/app (Requirements 1 & 2)
export function canonicalizeSubject(sub: string | null | undefined): string {
  if (!sub) return '';
  return String(sub).trim();
}

export function truncateSubjectLabel(name: string): string {
  return (name || '').trim();
}

// Subject color mapper from Prelims AI search
function getSubjectColor(sub: string): string {
  const map: Record<string, string> = {
    history: '#b91c1c',
    polity: '#1d4ed8',
    governance: '#1d4ed8',
    constitution: '#1d4ed8',
    economy: '#059669',
    economic: '#059669',
    geography: '#d97706',
    science: '#7c3aed',
    tech: '#7c3aed',
    environment: '#0891b2',
    ecology: '#0891b2',
    international: '#db2777',
    ethics: '#c026d3',
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
const getValueAddSection = (va: any): string => va?.sectionGroup || va?.section_group || va?.sectiongroup || '';
const getValueAddMicro = (va: any): string => va?.microTopic || va?.microtopic || va?.micro_topic || '';
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

const PAPER_ORDER: Record<string, number> = { GS1: 0, GS2: 1, GS3: 2, GS4: 3, Essay: 4, Optional: 5 };

export const getResultConceptKey = (r: UnifiedSearchResult): string => {
  if (r.type === 'prelims') {
    const micro = r.rawItem?.micro_topic || r.rawItem?.microTopic;
    if (micro && typeof micro === 'string' && micro.trim()) return micro.trim();
    const sec = r.rawItem?.section_group || r.rawItem?.sectionGroup;
    if (sec && typeof sec === 'string' && sec.trim()) return sec.trim();
    const sub = r.subject || r.rawItem?.subject;
    if (sub && typeof sub === 'string' && sub.trim()) return sub.trim();
    return 'General Prelims Questions';
  }
  return resolveItemConcept(r.rawItem || r);
};

const withinGroupSorter = (a: UnifiedSearchResult, b: UnifiedSearchResult) => {
  const sTierA = a._searchTier ?? 1;
  const sTierB = b._searchTier ?? 1;
  if (sTierA !== sTierB) return sTierA - sTierB;
  if (a.score !== b.score) return (b.score || 0) - (a.score || 0);

  // PYQ tier (UPSC PYQ -> UPSC Allied PYQ -> Other PYQ -> Non-PYQ)
  const tierA = getQuestionSortTier(a);
  const tierB = getQuestionSortTier(b);
  const tierDiff = tierA - tierB;
  if (tierDiff !== 0) return tierDiff;

  // Latest year on top
  const yA = a.year || 0;
  const yB = b.year || 0;
  if (yA !== yB) return yB - yA;

  // GS paper order
  const orderA = PAPER_ORDER[a.paper || ''] ?? 99;
  const orderB = PAPER_ORDER[b.paper || ''] ?? 99;
  if (orderA !== orderB) return orderA - orderB;

  // Same subject together
  const sA = a.subject || '';
  const sB = b.subject || '';
  if (sA !== sB) return sA.localeCompare(sB);

  return 0;
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

/**
 * Evaluates whether a piece of text matches the query, userWords, and AI keywords.
 * Enforces:
 * 1. Exact mode: ONLY matches if the entire query phrase appears in the text.
 * 2. Multi-word queries (e.g. "bhagat singh"):
 *    - Matches if exact phrase is present (Tier 0).
 *    - Matches if ALL user words are present in text (Tier 1).
 *    - In AI modes, matches if an AI-expanded keyword is present (Tier 2).
 *    - Crucially: An isolated word (like "singh" without "bhagat") NEVER matches!
 * 3. Single-word queries (e.g. "ashoka"):
 *    - Matches if the word or AI keywords appear.
 */
export function evaluateTextMatch(
  text: string,
  cleanQuery: string,
  userWords: string[],
  aiKeywords: string[],
  mode: 'AI' | 'AI+Fuzzy' | 'Matching' | 'Exact'
): { matched: boolean; score: number; tier: number } {
  if (!text) return { matched: false, score: 0, tier: 99 };

  // 1. Exact phrase match (Tier 0)
  if (cleanQuery.length > 2 && textMatchesKeyword(text, cleanQuery)) {
    return { matched: true, score: 10, tier: 0 };
  }

  // Exact mode requires exact phrase match!
  if (mode === 'Exact') {
    return { matched: false, score: 0, tier: 99 };
  }

  // 2. Multi-word query handling (e.g. "fundamental right")
  if (userWords.length > 1) {
    const allWordsPresent = userWords.every(w => textMatchesKeyword(text, w));

    // In Fuzzy (Matching) mode, ALL meaningful terms MUST be present (AND-like matching)
    if (allWordsPresent) {
      return { matched: true, score: 6 + userWords.length, tier: 1 };
    }

    // In AI modes ONLY, allow semantic match if an AI-expanded keyword is present
    if (mode === 'AI' || mode === 'AI+Fuzzy') {
      const matchedAi = aiKeywords.filter(k => k.length > 2 && textMatchesKeyword(text, k));
      if (matchedAi.length > 0) {
        return { matched: true, score: 2 + matchedAi.length * 0.5, tier: 3 };
      }
    }

    // Isolated words (e.g. "fundamental" without "right") MUST NEVER MATCH!
    return { matched: false, score: 0, tier: 99 };
  }

  // 3. Single-word query handling (e.g. "ashoka")
  if (userWords.length === 1) {
    if (textMatchesKeyword(text, userWords[0])) {
      return { matched: true, score: 6, tier: 1 };
    }
  }

  // AI expansion match for single-word queries
  if (mode === 'AI' || mode === 'AI+Fuzzy') {
    const matchedAi = aiKeywords.filter(k => k.length > 2 && textMatchesKeyword(text, k));
    if (matchedAi.length > 0) {
      return { matched: true, score: 2 + matchedAi.length * 0.5, tier: 3 };
    }
  }

  return { matched: false, score: 0, tier: 99 };
}

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

  // Sorting & Grouping
  const [sortMode, setSortMode] = useState<'Relevance' | 'Year' | 'Subject' | 'Concept'>('Relevance');
  const [groupBy, setGroupBy] = useState<'relevance' | 'concept'>('relevance');
  const [collapsedConcepts, setCollapsedConcepts] = useState<Record<string, boolean>>({});

  // Engine mode picker bottom sheet
  const [modePickerOpen, setModePickerOpen] = useState(false);

  // Inline Expand / Collapse State
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Active answer tab selected for each Mains question ID
  const [activeMainsTabs, setActiveMainsTabs] = useState<Record<string, string>>({});

  // 6 Accordion Sections (prelims & mains OPEN by default, searchIn/institutes/revision/display CLOSED by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    prelims: true,
    mains: true,
    institutes: false,
    revision: false,
    searchIn: false,
    display: false,
  });
  const [pyqExpanded, setPyqExpanded] = useState(false);

  const [syncing, setSyncing] = useState(false);

  const sidebarScrollViewRef = useRef<ScrollView>(null);
  const sidebarSectionOffsets = useRef<Record<string, number>>({});
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
  const [keywordsExpanded, setKeywordsExpanded] = useState(true);
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
  const DEFAULT_USER_REVISION_TAGS = ['Important Concept', 'Important Fact', 'Memorize', 'Must Revise', 'Trap Question'];
  const [userQuestionStates, setUserQuestionStates] = useState<Record<string, { reviewTags: string[] }>>({});
  const [prelimsTaggedMap, setPrelimsTaggedMap] = useState<Record<string, string[]>>({});
  const [userTags, setUserTags] = useState<string[]>(DEFAULT_USER_REVISION_TAGS);

  useEffect(() => {
    const loadTagsAndStates = async () => {
      const set = new Set<string>(DEFAULT_USER_REVISION_TAGS);
      const userId = session?.user?.id;
      if (userId) {
        try {
          const catalogKey = `review_tag_catalog_${userId}`;
          const raw = await AsyncStorage.getItem(catalogKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) parsed.forEach((t: string) => t && set.add(t));
          }
        } catch {}

        try {
          const [qsRes, mqsRes] = await Promise.all([
            supabase.from('question_states').select('question_id, review_tags').eq('user_id', userId),
            supabase.from('mains_question_states').select('question_id, review_tags').eq('user_id', userId),
          ]);
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
        } catch (err) {
          console.warn('[UnifiedSearch] Failed to load user tags:', err);
        }
      }
      setUserTags(Array.from(set).sort());
    };
    loadTagsAndStates();
  }, [session?.user?.id]);

  // Modal Preview States
  const [previewPrelimsQuestion, setPreviewPrelimsQuestion] = useState<any>(null);
  const [previewPrelimsRevealed, setPreviewPrelimsRevealed] = useState(false);
  const [previewPrelimsAnswer, setPreviewPrelimsAnswer] = useState<string | null>(null);
  const [previewPrelimsStudyTags, setPreviewPrelimsStudyTags] = useState<string[]>([]);
  const [previewPrelimsExplSource, setPreviewPrelimsExplSource] = useState<string>('UPSC');
  const [previewFontSize, setPreviewFontSize] = useState<number>(15);
  const [showPreviewZoomIndicator, setShowPreviewZoomIndicator] = useState(false);
  const previewZoomTimerRef = useRef<any>(null);
  const basePreviewFontSizeRef = useRef<number>(15);
  const [macroTagsExpanded, setMacroTagsExpanded] = useState(false);
  const [microTagsExpanded, setMicroTagsExpanded] = useState(false);
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

  // Zoom level state for search results list (@dr_upsc_zoom_font_size)
  const [zoomFontSize, setZoomFontSize] = useState<number>(16);
  const baseResultsFontSizeRef = useRef<number>(16);
  const [showResultsZoomIndicator, setShowResultsZoomIndicator] = useState(false);
  const resultsZoomTimerRef = useRef<any>(null);

  // Reading Preferences state (Muted Grey vs Deep Black, Boxed vs Plain Bold, Highlight Color)
  const [textColorMode, setTextColorMode] = useState<'default' | 'black'>('default');
  const [keyBoxMode, setKeyBoxMode] = useState<'boxed' | 'bold'>('boxed');
  const [keyBoxColor, setKeyBoxColor] = useState<KeyBoxColor>('yellow');

  // Mains card expand & institute selection state
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);
  const [selectedResultInstitutes, setSelectedResultInstitutes] = useState<Record<string, string>>({});

  useEffect(() => {
    AsyncStorage.getItem('@dr_upsc_zoom_font_size')
      .then(val => {
        if (val) {
          const parsed = parseFloat(val);
          if (!isNaN(parsed) && parsed >= 12 && parsed <= 32) {
            setZoomFontSize(Math.round(parsed));
            baseResultsFontSizeRef.current = Math.round(parsed);
          }
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@mains_text_color_mode')
      .then(val => {
        if (val === 'default' || val === 'black') {
          setTextColorMode(val);
          setGlobalTextColorMode(val);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@mains_key_box_mode')
      .then(val => {
        if (val === 'boxed' || val === 'bold') {
          setKeyBoxMode(val);
          setGlobalKeyBoxMode(val);
        }
      })
      .catch(() => {});

    AsyncStorage.getItem('@mains_key_box_color')
      .then(val => {
        if (val && ['yellow', 'green', 'blue', 'pink'].includes(val)) {
          setKeyBoxColor(val as KeyBoxColor);
          setGlobalKeyBoxColor(val as KeyBoxColor);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateTextColorMode = (mode: 'default' | 'black') => {
    setTextColorMode(mode);
    setGlobalTextColorMode(mode);
    AsyncStorage.setItem('@mains_text_color_mode', mode).catch(() => {});
  };

  const handleUpdateKeyBoxMode = (mode: 'boxed' | 'bold') => {
    setKeyBoxMode(mode);
    setGlobalKeyBoxMode(mode);
    AsyncStorage.setItem('@mains_key_box_mode', mode).catch(() => {});
  };

  const handleUpdateKeyBoxColor = (color: KeyBoxColor) => {
    setKeyBoxColor(color);
    setGlobalKeyBoxColor(color);
    AsyncStorage.setItem('@mains_key_box_color', color).catch(() => {});
  };

  const handleCopyMainsQuestion = (q: any) => {
    const text = q?.questionText || q?.question_text || '';
    if (text) {
      Clipboard.setStringAsync(text);
      if (Platform.OS !== 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  };

  const onResultsPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    let next = baseResultsFontSizeRef.current * scale;
    next = Math.max(12, Math.min(32, next));
    setZoomFontSize(Math.round(next));
    setShowResultsZoomIndicator(true);
    if (resultsZoomTimerRef.current) clearTimeout(resultsZoomTimerRef.current);
    resultsZoomTimerRef.current = setTimeout(() => setShowResultsZoomIndicator(false), 1500);
  };

  const onResultsPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      baseResultsFontSizeRef.current = zoomFontSize;
      AsyncStorage.setItem('@dr_upsc_zoom_font_size', String(zoomFontSize)).catch(() => {});
      if (Platform.OS !== 'android') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  };

  const previewMdStyles = useMemo(() => {
    return buildMarkdownStyles(
      colors.textPrimary,
      previewFontSize,
      colors.surface,
      colors.border,
      colors.primary
    );
  }, [colors, previewFontSize]);

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

  const handleForceSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      KVStore.delete(MAINS_QUESTIONS_CACHE_KEY);
      KVStore.delete('@mains_cached_value_add_v2');
      const liveQuestions = await fetchMainsQuestionsFromSupabase();
      const liveValueAdd = await fetchValueAdditionFromSupabase();

      if (liveQuestions && liveQuestions.length > 0) {
        setMainsQuestions(liveQuestions);
        console.log('[UnifiedSearch] Force sync questions loaded:', liveQuestions.length);
        try {
          await TopperImageCacheService.syncAllTopperImages(liveQuestions);
        } catch (imgSyncErr) {
          console.warn('[UnifiedSearch] Topper image sync warning:', imgSyncErr);
        }
      }

      if (liveValueAdd && liveValueAdd.length > 0) {
        const merged = liveValueAdd.map(item => {
          if (item.category === 'ethics') {
            const cleanText = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '').trim();
            const targetTitle = cleanText(item.title);
            const localMatch = mainsConsolidatedValueAdd.find(
              l => l.category === 'ethics' && cleanText(l.title) === targetTitle
            );
            if (localMatch?.ethicsData?.diagramsList) {
              return {
                ...item,
                ethicsData: {
                  ...item.ethicsData,
                  diagramsList: localMatch.ethicsData.diagramsList,
                },
              };
            }
          }
          return item;
        });
        setMainsValueAdd(merged);
        console.log('[UnifiedSearch] Force sync value add loaded:', merged.length);
      }
    } catch (err) {
      console.error('[UnifiedSearch] Force sync failed:', err);
    } finally {
      setSyncing(false);
    }
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
          if (r.type !== 'topper') {
            const isPyq = r.type === 'prelims' ? r.rawItem?.is_pyq : (r.rawItem?.is_pyq || r.rawItem?.isPyq);
            if (!isPyq) return;
          }
        } else if (filters.pyqFilter === 'Non-PYQ') {
          if (r.type !== 'topper') {
            const isPyq = r.type === 'prelims' ? r.rawItem?.is_pyq : (r.rawItem?.is_pyq || r.rawItem?.isPyq);
            if (isPyq) return;
          }
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
          const normP = normalizePaper(resolvePaper(q) || q.paper);
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
    const paperFilter = filters.mainsPapers || [];
    const subjectFilters = (filters.subjects || []).map(s => s.trim().toLowerCase());

    if (hasSearched && results.length > 0) {
      results.forEach(r => {
        if (r.type === 'prelims' && !filters.showPrelims) return;
        if (r.type === 'mains' && !filters.showMains) return;
        if (r.type === 'topper' && !filters.showToppers) return;
        if (r.type === 'value_add') return;

        if (paperFilter.length > 0) {
          if (r.type === 'mains' || r.type === 'topper') {
            const normP = normalizePaper(r.paper);
            if (!normP || !paperFilter.some(p => normalizePaper(p) === normP || p === r.paper)) return;
          } else {
            return;
          }
        }
        if (subjectFilters.length > 0) {
          const rSub = (r.subject || '').trim().toLowerCase();
          if (!rSub || !subjectFilters.includes(rSub)) return;
        }

        const inst = r.rawItem?.institute || (Array.isArray(r.rawItem?.tests) ? r.rawItem.tests[0]?.institute : r.rawItem?.tests?.institute) || '';
        if (inst && inst !== 'Topper Copy') insts.add(inst);
        if (r.type === 'topper' || r.rawItem?.is_topper_copy || r.rawItem?.answers?.some((a: any) => a.is_topper || a.topper)) {
          insts.add('Topper Copies');
        }
      });
      (filters.institutes || []).forEach(i => {
        if (i && i !== 'Topper Copy') insts.add(i);
      });
    } else {
      if (filters.showPrelims && paperFilter.length === 0) {
        coursePrelims.forEach((q: any) => {
          if (subjectFilters.length > 0) {
            const qSub = (q.subject || '').trim().toLowerCase();
            if (!qSub || !subjectFilters.includes(qSub)) return;
          }
          const tests = Array.isArray(q.tests) ? q.tests[0] : q.tests;
          const inst = tests?.institute || q.provider || q.source?.institute || '';
          if (inst && inst !== 'Topper Copy') insts.add(inst);
        });
      }

      if (filters.showMains || filters.showToppers) {
        mainsQuestions.forEach(q => {
          const normP = normalizePaper(resolvePaper(q) || q.paper);
          if (paperFilter.length > 0 && (!normP || !paperFilter.some(p => normalizePaper(p) === normP || p === q.paper))) return;
          if (subjectFilters.length > 0) {
            const qSub = (q.subject || '').trim().toLowerCase();
            if (!qSub || !subjectFilters.includes(qSub)) return;
          }
          if (q.institute && q.institute !== 'Topper Copy') insts.add(q.institute);
          if (q.is_topper_copy || q.answers?.some((a: any) => a.is_topper || a.topper)) {
            insts.add('Topper Copies');
          }
        });
      }
    }

    insts.delete('Topper Copy');
    return ['All', ...Array.from(insts).sort()];
  }, [mainsQuestions, coursePrelims, filters.showPrelims, filters.showMains, filters.showToppers, filters.mainsPapers, filters.subjects, filters.institutes, hasSearched, results]);

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
          const normP = normalizePaper(resolvePaper(q) || q.paper);
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

  // Derived allied exam options from questions where is_allied is true
  const alliedExamOptions = useMemo(() => {
    const set = new Set<string>();
    const checkItem = (raw: any) => {
      if (!raw) return;
      const isAllied = raw.is_allied || (typeof raw.is_allied === 'string' && raw.is_allied === 'true');
      if (isAllied) {
        const name = raw.exam_group || raw.exam_category || raw.group || raw.tests?.exam_group || '';
        if (name && typeof name === 'string' && name.trim()) {
          set.add(name.trim());
        }
      }
    };

    if (hasSearched && results.length > 0) {
      results.forEach(r => {
        if (r.type === 'prelims' && r.rawItem) checkItem(r.rawItem);
      });
    } else {
      coursePrelims.forEach((q: any) => checkItem(q));
    }

    return Array.from(set).sort();
  }, [hasSearched, results, coursePrelims]);

  // Prelims subjects list: Result-driven when searching, preserves exact original name (Requirements 1, 13, 14, 15)
  const prelimsSubjectOptions = useMemo(() => {
    const s = new Set<string>();
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'prelims').map(r => r.rawItem).filter(Boolean)
      : coursePrelims;

    pool.forEach((q: any) => {
      const sub = (q.subject || '').trim();
      if (sub) s.add(sub);
    });

    if (!hasSearched && s.size === 0) {
      ['History & Culture', 'Polity & Governance', 'Economy', 'Geography', 'Environment & Ecology', 'Science & Technology', 'International Relations', 'Current Affairs', 'CSAT'].forEach(x => s.add(x));
    }
    if (!hasSearched && !s.has('CSAT')) {
      s.add('CSAT');
    }

    // Preserve any currently selected subjects so user can see & deselect them (Requirements 19 & 20)
    (filters.subjects || []).forEach(sub => {
      if (sub && sub !== 'All') s.add(sub.trim());
    });

    return Array.from(s).sort();
  }, [hasSearched, results, coursePrelims, filters.subjects]);

  // Prelims facet options - cascading: subject -> section -> microtopic (Result-driven, Requirements 13-16)
  const prelimsSectionOptions = useMemo(() => {
    const s = new Set<string>();
    const subjectFilters = (filters.subjects || []).map(sub => sub.trim().toLowerCase());
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'prelims').map(r => r.rawItem).filter(Boolean)
      : coursePrelims;

    pool.forEach((q: any) => {
      const qSub = (q.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(qSub);
      const sec = getQuestionSection(q);
      if (matchSubject && sec) {
        s.add(sec);
      }
    });

    // Preserve any currently selected sections so user can deselect (Requirements 19 & 20)
    (filters.sections || []).forEach(sec => {
      if (sec && sec !== 'All') s.add(sec);
    });

    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, coursePrelims, filters.subjects, filters.sections]);

  const prelimsMicrotopicOptions = useMemo(() => {
    const s = new Set<string>();
    const subjectFilters = (filters.subjects || []).map(sub => sub.trim().toLowerCase());
    const sectionFilters = filters.sections || [];
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'prelims').map(r => r.rawItem).filter(Boolean)
      : coursePrelims;

    pool.forEach((q: any) => {
      const qSub = (q.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(qSub);
      const sec = getQuestionSection(q);
      const matchSection = sectionFilters.length === 0 || sectionFilters.includes(sec);
      const micro = getQuestionMicro(q);
      if (matchSubject && matchSection && micro) {
        s.add(micro);
      }
    });

    // Preserve any currently selected microtopics (Requirements 19 & 20)
    (filters.microtopics || []).forEach(mt => {
      if (mt && mt !== 'All') s.add(mt);
    });

    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, coursePrelims, filters.subjects, filters.sections, filters.microtopics]);

  // Mains subjects cascading from selected papers (Result-driven, Requirements 1, 13, 14, 15)
  const mainsSubjectOptions = useMemo(() => {
    const s = new Set<string>();
    const paperFilter = filters.mainsPapers || [];
    const qPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    const vaPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsValueAdd;

    qPool.forEach((q: any) => {
      const normP = normalizePaper(resolvePaper(q) || q.paper);
      if (paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === q.paper)) {
        const sub = (q.subject || '').trim();
        if (sub) s.add(sub);
      }
    });
    vaPool.forEach((va: any) => {
      const normP = normalizePaper(va.paper);
      if (paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === va.paper)) {
        const sub = (va.subject || '').trim();
        if (sub) s.add(sub);
      }
    });

    // Preserve any currently selected subjects (Requirements 19 & 20)
    (filters.subjects || []).forEach(sub => {
      if (sub && sub !== 'All') s.add(sub.trim());
    });

    return Array.from(s).sort();
  }, [hasSearched, results, mainsQuestions, mainsValueAdd, filters.mainsPapers, filters.subjects]);

  // Mains facet options - cascading: paper -> subject -> section -> microtopic -> subtopic -> nanotopic (Result-driven)
  const mainsSectionOptions = useMemo(() => {
    const paperFilter = filters.mainsPapers || [];
    const subjectFilters = (filters.subjects || []).map(s => s.trim().toLowerCase());
    const s = new Set<string>();
    const qPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    const vaPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsValueAdd;

    qPool.forEach((q: any) => {
      const normP = normalizePaper(resolvePaper(q) || q.paper);
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === q.paper);
      const qSub = (q.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(qSub);
      const sec = getQuestionSection(q);
      if (matchPaper && matchSubject && sec) s.add(sec);
    });
    vaPool.forEach((va: any) => {
      const normP = normalizePaper(va.paper || '');
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === va.paper);
      const vaSub = (va.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(vaSub);
      const sec = getValueAddSection(va);
      if (matchPaper && matchSubject && sec) s.add(sec);
    });

    // Preserve any currently selected mains sections (Requirements 19 & 20)
    (filters.mainsSections || []).forEach(sec => {
      if (sec && sec !== 'All') s.add(sec);
    });

    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, mainsQuestions, mainsValueAdd, filters.mainsPapers, filters.subjects, filters.mainsSections]);

  const mainsMicrotopicOptions = useMemo(() => {
    const paperFilter = filters.mainsPapers || [];
    const subjectFilters = (filters.subjects || []).map(s => s.trim().toLowerCase());
    const sectionFilter = filters.mainsSections || [];
    const s = new Set<string>();
    const qPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    const vaPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsValueAdd;

    qPool.forEach((q: any) => {
      const normP = normalizePaper(resolvePaper(q) || q.paper);
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === q.paper);
      const qSub = (q.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(qSub);
      const sec = getQuestionSection(q);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(sec);
      const micro = getQuestionMicro(q);
      if (matchPaper && matchSubject && matchSec && micro) s.add(micro);
    });
    vaPool.forEach((va: any) => {
      const normP = normalizePaper(va.paper || '');
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === va.paper);
      const vaSub = (va.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(vaSub);
      const sec = getValueAddSection(va);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(sec);
      const micro = getValueAddMicro(va);
      if (matchPaper && matchSubject && matchSec && micro) s.add(micro);
    });

    // Preserve any currently selected mains microtopics (Requirements 19 & 20)
    (filters.mainsMicrotopics || []).forEach(mt => {
      if (mt && mt !== 'All') s.add(mt);
    });

    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, mainsQuestions, mainsValueAdd, filters.mainsPapers, filters.subjects, filters.mainsSections, filters.mainsMicrotopics]);

  const mainsSubtopicOptions = useMemo(() => {
    const paperFilter = filters.mainsPapers || [];
    const subjectFilters = (filters.subjects || []).map(s => s.trim().toLowerCase());
    const sectionFilter = filters.mainsSections || [];
    const microtopicFilter = filters.mainsMicrotopics || [];
    const s = new Set<string>();
    const qPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    const vaPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsValueAdd;

    qPool.forEach((q: any) => {
      const normP = normalizePaper(resolvePaper(q) || q.paper);
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === q.paper);
      const qSub = (q.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(qSub);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const sub = getQuestionSub(q);
      if (matchPaper && matchSubject && matchSec && matchMicro && sub && sub !== 'General' && sub !== 'All') {
        s.add(sub);
      }
    });
    vaPool.forEach((va: any) => {
      const normP = normalizePaper(va.paper || '');
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === va.paper);
      const vaSub = (va.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(vaSub);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getValueAddSection(va));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getValueAddMicro(va));
      const sub = getValueAddSub(va);
      if (matchPaper && matchSubject && matchSec && matchMicro && sub && sub !== 'General' && sub !== 'All') {
        s.add(sub);
      }
    });

    // Preserve any currently selected subtopics (Requirements 19 & 20)
    (filters.subtopics || []).forEach(sub => {
      if (sub && sub !== 'All') s.add(sub);
    });

    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, mainsQuestions, mainsValueAdd, filters.mainsPapers, filters.subjects, filters.mainsSections, filters.mainsMicrotopics, filters.subtopics]);

  const mainsNanotopicOptions = useMemo(() => {
    const paperFilter = filters.mainsPapers || [];
    const subjectFilters = (filters.subjects || []).map(s => s.trim().toLowerCase());
    const sectionFilter = filters.mainsSections || [];
    const microtopicFilter = filters.mainsMicrotopics || [];
    const subtopicFilter = filters.subtopics || [];
    const s = new Set<string>();
    const qPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    const vaPool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsValueAdd;

    qPool.forEach((q: any) => {
      const normP = normalizePaper(resolvePaper(q) || q.paper);
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === q.paper);
      const qSub = (q.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(qSub);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(getQuestionSection(q));
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(getQuestionMicro(q));
      const sub = getQuestionSub(q);
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(sub);
      const nano = getQuestionNano(q);
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && nano && nano !== 'General' && nano !== 'All') {
        s.add(nano);
      }
    });
    vaPool.forEach((va: any) => {
      const normP = normalizePaper(va.paper || '');
      const matchPaper = paperFilter.length === 0 || paperFilter.some(p => normalizePaper(p) === normP || p === va.paper);
      const vaSub = (va.subject || '').trim().toLowerCase();
      const matchSubject = subjectFilters.length === 0 || subjectFilters.includes(vaSub);
      const sec = getValueAddSection(va);
      const matchSec = sectionFilter.length === 0 || sectionFilter.includes(sec);
      const micro = getValueAddMicro(va);
      const matchMicro = microtopicFilter.length === 0 || microtopicFilter.includes(micro);
      const sub = getValueAddSub(va);
      const matchSub = subtopicFilter.length === 0 || subtopicFilter.includes(sub);
      const nano = va.nanotopic || '';
      if (matchPaper && matchSubject && matchSec && matchMicro && matchSub && nano && nano !== 'General' && nano !== 'All') {
        s.add(nano);
      }
    });

    // Preserve any currently selected nanotopics (Requirements 19 & 20)
    (filters.nanotopics || []).forEach(nano => {
      if (nano && nano !== 'All') s.add(nano);
    });

    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, mainsQuestions, mainsValueAdd, filters.mainsPapers, filters.subjects, filters.mainsSections, filters.mainsMicrotopics, filters.subtopics, filters.nanotopics]);

  // Authentic Mains Question Bank Macro Tags (Requirement 9 & 10)
  const mainsMacrotagOptions = useMemo(() => {
    const s = new Set<string>();
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper' || r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    pool.forEach((q: any) => {
      if (q.macrotag) {
        q.macrotag.split(',').forEach((t: string) => {
          const clean = t.trim().replace(/^#/, '');
          if (clean) s.add(clean);
        });
      }
    });
    (filters.macrotags || []).forEach(t => {
      const clean = t.trim().replace(/^#/, '');
      if (clean && clean !== 'All') s.add(clean);
    });
    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, mainsQuestions, filters.macrotags]);

  // Authentic Mains Question Bank Micro Tags: Only loaded contextually when Macro Tag is selected!
  const mainsMicrotagOptions = useMemo(() => {
    const macroFilter = (filters.macrotags || []).map(m => m.replace(/^#/, ''));
    if (macroFilter.length === 0) return ['All'];
    const s = new Set<string>();
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper' || r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    pool.forEach((q: any) => {
      const qMacros = (q.macrotag || '').split(',').map((t: string) => t.trim().replace(/^#/, ''));
      const matchMacro = macroFilter.some(m => qMacros.includes(m));
      if (matchMacro && q.microtag) {
        q.microtag.split(',').forEach((t: string) => {
          const clean = t.trim().replace(/^#/, '');
          if (clean) s.add(clean);
        });
      }
    });
    (filters.microtags || []).forEach(t => {
      const clean = t.trim().replace(/^#/, '');
      if (clean && clean !== 'All') s.add(clean);
    });
    return ['All', ...Array.from(s).sort()];
  }, [hasSearched, results, mainsQuestions, filters.macrotags, filters.microtags]);

  const mainsYearOptions = useMemo(() => {
    const s = new Set<string>();
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper' || r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    pool.forEach((q: any) => {
      if (q.year && String(q.year).trim() && String(q.year).trim() !== '0') {
        s.add(String(q.year).trim());
      }
    });
    (filters.mainsYears || []).forEach(y => {
      if (y && y !== 'All') s.add(String(y).trim());
    });
    return ['All', ...Array.from(s).sort((a, b) => Number(b) - Number(a))];
  }, [hasSearched, results, mainsQuestions, filters.mainsYears]);

  // Maps of sections per subject to support multi-subject section preservation (Requirements 3, 4, 19, 20)
  const prelimsSubjectSectionsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'prelims').map(r => r.rawItem).filter(Boolean)
      : coursePrelims;
    pool.forEach((q: any) => {
      const sub = canonicalizeSubject(q?.subject);
      const sec = getQuestionSection(q);
      if (sub && sec) {
        if (!map.has(sub)) map.set(sub, new Set());
        map.get(sub)!.add(sec);
      }
    });
    return map;
  }, [hasSearched, results, coursePrelims]);

  const mainsSubjectSectionsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const pool = (hasSearched && results.length > 0)
      ? results.filter(r => r.type === 'mains' || r.type === 'topper' || r.type === 'value_add').map(r => r.rawItem).filter(Boolean)
      : mainsQuestions;
    pool.forEach((q: any) => {
      const sub = canonicalizeSubject(q?.subject);
      const sec = getQuestionSection(q) || getValueAddSection(q);
      if (sub && sec) {
        if (!map.has(sub)) map.set(sub, new Set());
        map.get(sub)!.add(sec);
      }
    });
    return map;
  }, [hasSearched, results, mainsQuestions]);

  // Master subject counts and list derived from master/unfiltered results (ai-search parity)
  const masterSubjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    results.forEach(r => {
      const canon = canonicalizeSubject(r.subject);
      if (canon) counts[canon] = (counts[canon] || 0) + 1;
    });
    return counts;
  }, [results]);

  // Real-time subjects in master results for quick drill-down (ensures options don't disappear)
  const allResultSubjects = useMemo(() => {
    const subs = new Set<string>();
    results.forEach(r => {
      const canon = canonicalizeSubject(r.subject);
      if (canon) subs.add(canon);
    });
    return Array.from(subs).sort();
  }, [results]);

  // Real-time match counts for subjects, papers, institutes, and stages from search results
  // All counts are fully REACTIVE and INTERCONNECTED with all active filters!
  const resultCounts = useMemo(() => {
    const subjectCounts: Record<string, number> = {};
    const paperCounts: Record<string, number> = {};
    const instituteCounts: Record<string, number> = {};
    const stageCounts = { prelims: 0, mains: 0, topper: 0, value_add: 0 };

    const matchesPyq = (item: UnifiedSearchResult) => {
      if (item.type === 'topper') return true;
      const isPyq = item.type === 'prelims' ? item.rawItem?.is_pyq : (item.rawItem?.is_pyq || item.rawItem?.isPyq);
      if (filters.pyqFilter === 'PYQ Only' && !isPyq) return false;
      if (filters.pyqFilter === 'Non-PYQ' && isPyq) return false;
      if (filters.pyqFilter === 'PYQ Only' && filters.examCategory !== 'All') {
        if (item.type !== 'prelims') {
          if (filters.examCategory === 'UPSC') return true;
          if (filters.examCategory === 'Allied') return !!item.rawItem?.is_allied;
          if (filters.examCategory === 'Others') return !!item.rawItem?.is_others;
          return false;
        }
        const raw = item.rawItem;
        if (filters.examCategory === 'UPSC') return !!raw?.is_upsc_cse;
        if (filters.examCategory === 'Allied') {
          if (!raw?.is_allied) return false;
          if (filters.alliedExams && filters.alliedExams.length > 0) {
            const groupName = raw.exam_group || raw.exam_category || raw.group || raw.tests?.exam_group || '';
            return filters.alliedExams.includes(groupName);
          }
          return true;
        }
        if (filters.examCategory === 'Others') return !!raw?.is_others;
        if (filters.examCategory === 'NEET PG') return !!raw?.is_neetpg;
        if (filters.examCategory === 'INI-CET') return !!raw?.is_inicet;
        if (filters.examCategory === 'UPSC CMS') return !!raw?.is_upsc_cms;
      }
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
      if (filters.institutes.length === 0) return true;
      const isTopperItem = item.type === 'topper' || !!item.rawItem?.is_topper_copy || item.rawItem?.institute === 'Topper Copies' || (Array.isArray(item.rawItem?.answers) && item.rawItem.answers.some((a: any) => a?.is_topper || a?.topper || a?.is_topper_copy));
      if ((filters.institutes.includes('Topper Copies') || filters.institutes.includes('Topper Copy')) && isTopperItem) {
        return true;
      }
      if (item.type === 'topper') return filters.institutes.includes('Topper Copies') || filters.institutes.includes('Topper Copy');
      if (item.type === 'prelims') {
        const tests = Array.isArray(item.rawItem?.tests) ? item.rawItem.tests[0] : item.rawItem?.tests;
        const inst = tests?.institute || item.rawItem?.provider || item.rawItem?.source?.institute || '';
        return filters.institutes.includes(inst);
      }
      if (item.type === 'mains') {
        return !!item.rawItem?.institute && filters.institutes.includes(item.rawItem.institute);
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
      if (r.type === 'topper' && !filters.showToppers) return;
      if (r.type === 'value_add' && !filters.showValueAdd) return;
      if (!matchesScope(r)) return;

      if (filters.mainsPapers.length > 0) {
        if (r.type === 'mains' || r.type === 'topper' || r.type === 'value_add') {
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
    filters.showToppers,
    filters.showValueAdd,
    filters.mainsPapers,
    filters.subjects,
    filters.institutes,
    filters.programmes,
    filters.pyqFilter,
    filters.examCategory,
    filters.alliedExams,
    filters.tags,
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
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
      let displayKeywords: string[] = [];
      
      if (mode === 'AI' || mode === 'AI+Fuzzy') {
        try {
          const aiResult = await aiExpandSearchQuery(currentQuery);
          if (aiResult && aiResult.keywords && aiResult.keywords.length > 0) {
            displayKeywords = aiResult.keywords
              .map(k => k.toLowerCase().trim())
              .filter(k => Boolean(k) && !STOP_WORDS.has(k));
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
        const qText = String(q.question_text || '').toLowerCase();
        const qExpl = String(q.explanation_markdown || q.explanation || '').toLowerCase();
        const optsObj = q.options || {};
        const optsText = `${q.option_a || ''} ${q.option_b || ''} ${q.option_c || ''} ${q.option_d || ''} ${Object.values(optsObj).join(' ')}`.toLowerCase();

        const matchQ = searchQuestion ? evaluateTextMatch(qText, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };
        const matchExpl = searchExplanation ? evaluateTextMatch(qExpl, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };
        const matchOpts = searchOptions ? evaluateTextMatch(optsText, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };

        const combinedScopeText = [
          searchQuestion ? qText : '',
          searchExplanation ? qExpl : '',
          searchOptions ? optsText : '',
        ].filter(Boolean).join(' ');
        const matchCombined = evaluateTextMatch(combinedScopeText, cleanQuery, userWords, displayKeywords, mode);

        if (!matchCombined.matched && !matchQ.matched && !matchExpl.matched && !matchOpts.matched) {
          return;
        }

        const matchedInQ = matchQ.matched;
        const matchedInExpl = matchExpl.matched;
        const matchedInOpts = matchOpts.matched;

        const bestTier = Math.min(matchQ.tier, matchExpl.tier, matchOpts.tier, matchCombined.tier);
        const score = (matchQ.matched ? matchQ.score * 2 : 0) +
                      (matchExpl.matched ? matchExpl.score * 1 : 0) +
                      (matchOpts.matched ? matchOpts.score * 0.5 : 0) +
                      (matchCombined.score || 1);

        matchedResults.push({
          id: `prelims_${q.id}`,
          type: 'prelims',
          title: q.question_text,
          subtitle: q.explanation_markdown || '',
          subject: canonicalizeSubject(q.subject),
          year: q.exam_year,
          score,
          _searchTier: bestTier,
          rawItem: q,
          matchedInQuestion: matchedInQ,
          matchedInExplanation: matchedInExpl,
          matchedInOptions: matchedInOpts,
        });
      });

      // B. MAINS SEARCH (local cache only — the downloaded snapshot)
      await KVStore.ready();
      const sourceMains = mainsQuestions.length > 0 ? mainsQuestions : getInitialMainsQuestions();

      sourceMains.forEach((q: any) => {
        const rawQBody = String(q.questionText || q.question_text || q.question || q.question_body || '').trim();
        const qText = (rawQBody || String(q.title || '')).toLowerCase();

        const answersList = q.answers || [];
        let directAns = '';
        if (q.model_answer) directAns += ' ' + q.model_answer;
        if (q.answer_text) directAns += ' ' + q.answer_text;
        if (q.synopsis) directAns += ' ' + q.synopsis;

        const ansText = `${answersList.map((a: any) => `${a.answerText || a.answer_text || a.content || ''} ${a.synopsis || ''}`).join(' ')} ${directAns}`.toLowerCase();
        const metaText = `${q.subject || ''} ${q.sectionGroup || q.section_group || ''} ${q.microTopic || q.microtopic || ''} ${q.subTopic || q.subtopic || ''} ${q.macrotag || ''} ${q.microtag || ''}`.toLowerCase();

        // ── Topper copies: first-class results (parity with MainsAISearchView, app/mains.tsx) ──
        if (isTopperQuestion(q)) {
          if (!searchQuestion) return; // respect the existing search-scope toggle
          const topperAns =
            (q.answers || []).find((a: any) => isGenuineTopperAnswer(a)) || (q.answers || [])[0];
          const tName = (getTopperName(topperAns, q) || '').toLowerCase();
          const rawAir = getAir(topperAns, q);
          const tAir = String(rawAir ?? q.air_rank ?? '').toLowerCase();

          const matchQ = evaluateTextMatch(qText, cleanQuery, userWords, displayKeywords, mode);
          const matchName = tName && tName !== 'topper' ? evaluateTextMatch(tName, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };
          const matchAir = tAir ? evaluateTextMatch(tAir, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };

          const combinedTopperText = [qText, tName !== 'topper' ? tName : '', tAir ? `air ${tAir}` : ''].filter(Boolean).join(' ');
          const matchCombined = evaluateTextMatch(combinedTopperText, cleanQuery, userWords, displayKeywords, mode);

          if (!matchCombined.matched && !matchQ.matched && !matchName.matched && !matchAir.matched) {
            return;
          }

          const bestTier = Math.min(matchQ.tier, matchName.tier, matchAir.tier, matchCombined.tier);
          const score = Math.max(matchQ.score, matchName.score, matchAir.score, matchCombined.score, 1);

          matchedResults.push({
            id: `topper_${q.id}`,
            type: 'topper',
            title: q.questionText || q.question_text || q.title || 'Topper Copy',
            subtitle: `${getTopperName(topperAns, q)}${rawAir ? ` (AIR ${rawAir})` : ''}`,
            subject: canonicalizeSubject(q.subject),
            paper: resolvePaper(q),
            year: q.year || q.exam_year || q.topper_year,
            score,
            _searchTier: bestTier,
            rawItem: q,
            matchedInQuestion: matchQ.matched || matchName.matched || matchAir.matched,
            matchedInExplanation: false,
            matchedInOptions: false,
          });
          return; // never double-emit a topper row as a generic 'mains' card
        }

        const matchQ = searchQuestion ? evaluateTextMatch(qText, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };
        const matchAns = searchExplanation ? evaluateTextMatch(ansText, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };

        const combinedScopeText = [
          searchQuestion ? qText : '',
          searchExplanation ? ansText : '',
        ].filter(Boolean).join(' ');
        const matchCombined = evaluateTextMatch(combinedScopeText, cleanQuery, userWords, displayKeywords, mode);

        if (!matchCombined.matched && !matchQ.matched && !matchAns.matched) {
          return;
        }

        const matchedInQ = matchQ.matched;
        const matchedInAns = matchAns.matched;

        let score = (matchQ.matched ? matchQ.score * 2 : 0) +
                    (matchAns.matched ? matchAns.score * 1.5 : 0) +
                    (matchCombined.score || 1);

        // metaText ONLY adds bonus relevance if the active target scope actually matched!
        if (metaText && userWords.some(w => textMatchesKeyword(metaText, w))) {
          score += 1;
        }

        const bestTier = Math.min(matchQ.tier, matchAns.tier, matchCombined.tier);

        matchedResults.push({
          id: `mains_${q.id}`,
          type: 'mains',
          title: q.questionText || q.question_text || q.title || 'Mains Question',
          subtitle: answersList.map((a: any) => a.answerText || a.answer_text || '').filter(Boolean).join(' ') || metaText,
          subject: canonicalizeSubject(q.subject),
          paper: resolvePaper(q),
          year: q.year || q.exam_year,
          score,
          _searchTier: bestTier,
          rawItem: q,
          matchedInQuestion: matchedInQ,
          matchedInExplanation: matchedInAns,
          matchedInOptions: false,
        });
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
        const titleLower = String(va.title || '').toLowerCase();
        const textContent = getValueAddItemTextContent(va).toLowerCase();

        const matchTitle = searchQuestion ? evaluateTextMatch(titleLower, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };
        const matchContent = searchExplanation ? evaluateTextMatch(textContent, cleanQuery, userWords, displayKeywords, mode) : { matched: false, score: 0, tier: 99 };

        const combinedVAText = [
          searchQuestion ? titleLower : '',
          searchExplanation ? textContent : '',
        ].filter(Boolean).join(' ');
        const matchCombined = evaluateTextMatch(combinedVAText, cleanQuery, userWords, displayKeywords, mode);

        if (!matchCombined.matched && !matchTitle.matched && !matchContent.matched) {
          return;
        }

        const matchedInTitle = matchTitle.matched || (searchQuestion && userWords.length > 0 && userWords.some(w => textMatchesKeyword(titleLower, w)));
        const matchedInContent = matchContent.matched || (searchExplanation && userWords.length > 0 && userWords.some(w => textMatchesKeyword(textContent, w)));

        const score = (matchTitle.matched ? matchTitle.score * 2 : 0) +
                      (matchContent.matched ? matchContent.score * 1.5 : 0) +
                      (matchCombined.score || 1);
        const bestTier = Math.min(matchTitle.tier, matchContent.tier, matchCombined.tier);

        matchedResults.push({
          id: `valueadd_${va.id}`,
          type: 'value_add',
          title: va.title || 'Untitled Value Add',
          subtitle: va.rawContent || va.content_markdown || va.context || va.description || '',
          subject: canonicalizeSubject(va.subject),
          paper: resolvePaper(va) || normalizePaper(va.paper) || 'GS1',
          score,
          _searchTier: bestTier,
          rawItem: va,
          matchedInQuestion: matchedInTitle,
          matchedInExplanation: matchedInContent,
          matchedInOptions: false,
        });
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
  const lastRanQueryRef = useRef<string | null>(null);
  useEffect(() => {
    const incoming = typeof params.q === 'string' ? params.q.trim() : '';
    if (incoming && lastRanQueryRef.current !== incoming) {
      lastRanQueryRef.current = incoming;
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

  const term = query.toLowerCase().trim();
  const isExactMatch = useCallback((r: UnifiedSearchResult) =>
    !!term && `${r.title || ''} ${r.subtitle || ''}`.toLowerCase().includes(term),
  [term]);

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
        if (item.type !== 'prelims') return true;
        const v = item.rawItem.is_ncert;
        return v === true || v === 1 || ['true', '1', 'yes'].includes(String(v).trim().toLowerCase());
      });
    } else if (filters.ncertFilter === 'Non-NCERT') {
      list = list.filter(item => {
        if (item.type !== 'prelims') return true;
        const v = item.rawItem.is_ncert;
        return !(v === true || v === 1 || ['true', '1', 'yes'].includes(String(v).trim().toLowerCase()));
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

    // Filter by Exam Category (prelims & allied exams)
    if (filters.examCategory !== 'All') {
      list = list.filter(item => {
        if (item.type !== 'prelims') {
          if (filters.examCategory === 'UPSC') return true;
          if (filters.examCategory === 'Allied') return !!item.rawItem?.is_allied;
          if (filters.examCategory === 'Others') return !!item.rawItem?.is_others;
          return false;
        }
        const raw = item.rawItem;
        if (filters.examCategory === 'UPSC') return !!raw?.is_upsc_cse;
        if (filters.examCategory === 'Allied') {
          if (!raw?.is_allied) return false;
          if (filters.alliedExams && filters.alliedExams.length > 0) {
            const groupName = raw.exam_group || raw.exam_category || raw.group || raw.tests?.exam_group || '';
            return filters.alliedExams.includes(groupName);
          }
          return true;
        }
        if (filters.examCategory === 'Others') return !!raw?.is_others;
        if (filters.examCategory === 'NEET PG') return !!raw?.is_neetpg;
        if (filters.examCategory === 'INI-CET') return !!raw?.is_inicet;
        if (filters.examCategory === 'UPSC CMS') return !!raw?.is_upsc_cms;
        return true;
      });
    }

    // Filter by institute
    if (filters.institutes.length > 0) {
      list = list.filter(item => {
        const isTopperItem = item.type === 'topper' || !!item.rawItem?.is_topper_copy || item.rawItem?.institute === 'Topper Copies' || (Array.isArray(item.rawItem?.answers) && item.rawItem.answers.some((a: any) => a?.is_topper || a?.topper || a?.is_topper_copy));
        if ((filters.institutes.includes('Topper Copies') || filters.institutes.includes('Topper Copy')) && isTopperItem) {
          return true;
        }
        if (item.type === 'topper') return filters.institutes.includes('Topper Copies') || filters.institutes.includes('Topper Copy');
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
        if (item.type !== 'prelims') return true;
        const sec = item.rawItem.section_group || item.rawItem.sectionGroup || getQuestionSection(item.rawItem);
        if (filters.subjects.length > 1) {
          const itemSub = canonicalizeSubject(item.subject);
          const subSections = prelimsSubjectSectionsMap.get(itemSub);
          const hasSectionForThisSubject = subSections && filters.sections.some(s => subSections.has(s));
          if (!hasSectionForThisSubject) {
            return true;
          }
        }
        return sec && filters.sections.includes(sec);
      });
    }

    // Filter by Microtopics (prelims)
    if (filters.microtopics.length > 0) {
      list = list.filter(item => {
        if (item.type !== 'prelims') return true;
        const mt = item.rawItem.micro_topic || item.rawItem.microTopic;
        return mt && filters.microtopics.includes(mt);
      });
    }

    // Filter by Prelims Year Range
    if (filters.yearRange) {
      const yr = filters.yearRange.trim();
      list = list.filter(item => {
        if (item.type !== 'prelims') return true;
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
      });
    }

    // Filter by Mains Sections
    if (filters.mainsSections && filters.mainsSections.length > 0) {
      list = list.filter(item => {
        if (item.type !== 'mains' && item.type !== 'topper' && item.type !== 'value_add') return true;
        const sec = item.type === 'value_add' ? getValueAddSection(item.rawItem) : getQuestionSection(item.rawItem);
        if (filters.subjects.length > 1) {
          const itemSub = canonicalizeSubject(item.subject);
          const subSections = mainsSubjectSectionsMap.get(itemSub);
          const hasSectionForThisSubject = subSections && filters.mainsSections!.some(s => subSections.has(s));
          if (!hasSectionForThisSubject) {
            return true;
          }
        }
        return sec && filters.mainsSections!.includes(sec);
      });
    }

    // Filter by Mains Microtopics
    if (filters.mainsMicrotopics && filters.mainsMicrotopics.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'topper') {
          const micro = getQuestionMicro(item.rawItem);
          return micro && filters.mainsMicrotopics!.includes(micro);
        }
        if (item.type === 'value_add') {
          const micro = getValueAddMicro(item.rawItem);
          return micro && filters.mainsMicrotopics!.includes(micro);
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

    // Filter by Mains Merged Tags
    if (filters.tags && filters.tags.length > 0) {
      list = list.filter(item => {
        if (item.type === 'mains' || item.type === 'topper' || item.type === 'value_add') {
          const raw = item.rawItem;
          const macro = (raw?.macrotag || '').split(',').map((t: string) => t.trim().toLowerCase());
          const micro = (raw?.microtag || '').split(',').map((t: string) => t.trim().toLowerCase());
          return filters.tags.some(tag => {
            const lower = tag.trim().toLowerCase();
            return macro.includes(lower) || micro.includes(lower);
          });
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

    if (sortMode === 'Year') {
      return list.sort((a, b) => {
        const yearA = a.year || 0;
        const yearB = b.year || 0;
        if (yearA !== yearB) return yearB - yearA;
        return withinGroupSorter(a, b);
      });
    }

    if (sortMode === 'Subject') {
      return list.sort((a, b) => {
        const subA = a.subject || '';
        const subB = b.subject || '';
        if (subA !== subB) return subA.localeCompare(subB);
        return withinGroupSorter(a, b);
      });
    }

    if (sortMode === 'Concept') {
      return list.sort((a, b) => {
        const cA = getResultConceptKey(a);
        const cB = getResultConceptKey(b);
        if (cA !== cB) return cA.localeCompare(cB);
        return withinGroupSorter(a, b);
      });
    }

    // Exact matches always come first, followed by semantic/fuzzy matches
    const exactMatches = list.filter(isExactMatch).sort(withinGroupSorter);
    const semanticMatches = list.filter(r => !isExactMatch(r)).sort(withinGroupSorter);

    return [...exactMatches, ...semanticMatches];
  }, [results, filters, excludedKeywords, sortMode, sidebarSubjectFilter, userQuestionStates, prelimsTaggedMap, isExactMatch]);

  const activeResults = sortedAndFilteredResults;
  const isGroupedByConcept = groupBy === 'concept' || sortMode === 'Concept';

  const displayResults = useMemo<Array<UnifiedSearchResult | { kind: 'conceptHeader'; id: string; concept: string; count: number }>>(() => {
    if (!isGroupedByConcept) {
      return activeResults;
    }

    const conceptMap: Record<string, UnifiedSearchResult[]> = {};
    activeResults.forEach(r => {
      const concept = getResultConceptKey(r);
      if (!conceptMap[concept]) {
        conceptMap[concept] = [];
      }
      conceptMap[concept].push(r);
    });

    // Exact matches first within each concept, followed by tier/score/PYQ/year
    Object.keys(conceptMap).forEach(conceptKey => {
      conceptMap[conceptKey].sort((a, b) => {
        const matchA = isExactMatch(a) ? 1 : 0;
        const matchB = isExactMatch(b) ? 1 : 0;
        if (matchA !== matchB) return matchB - matchA;
        return withinGroupSorter(a, b);
      });
    });

    // Sort concept names alphabetically, pushing "General*" to the bottom
    const sortedConcepts = Object.keys(conceptMap).sort((a, b) => {
      const aIsGen = a.toLowerCase().startsWith('general');
      const bIsGen = b.toLowerCase().startsWith('general');
      if (aIsGen && !bIsGen) return 1;
      if (!aIsGen && bIsGen) return -1;
      return a.localeCompare(b);
    });

    const groupedList: Array<UnifiedSearchResult | { kind: 'conceptHeader'; id: string; concept: string; count: number }> = [];
    sortedConcepts.forEach(concept => {
      const itemsInConcept = conceptMap[concept];
      groupedList.push({
        kind: 'conceptHeader',
        id: `concept-hdr-${concept}`,
        concept,
        count: itemsInConcept.length,
      });

      if (!collapsedConcepts[concept]) {
        groupedList.push(...itemsInConcept);
      }
    });

    return groupedList;
  }, [activeResults, isGroupedByConcept, collapsedConcepts, isExactMatch]);

  const allConceptKeys = useMemo(() => {
    if (!isGroupedByConcept) return [];
    const set = new Set<string>();
    activeResults.forEach(r => {
      set.add(getResultConceptKey(r) || 'General Questions');
    });
    return Array.from(set);
  }, [activeResults, isGroupedByConcept]);

  const expandAllConcepts = useCallback(() => {
    setCollapsedConcepts({});
  }, []);

  const collapseAllConcepts = useCallback(() => {
    const next: Record<string, boolean> = {};
    allConceptKeys.forEach(k => {
      next[k] = true;
    });
    setCollapsedConcepts(next);
  }, [allConceptKeys]);

  const prelimsCount = useMemo(() => activeResults.filter(r => r.type === 'prelims').length, [activeResults]);
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
    let next = basePreviewFontSizeRef.current * scale;
    next = Math.max(12, Math.min(32, next));
    setPreviewFontSize(Math.round(next));
    setShowPreviewZoomIndicator(true);
    if (previewZoomTimerRef.current) clearTimeout(previewZoomTimerRef.current);
    previewZoomTimerRef.current = setTimeout(() => setShowPreviewZoomIndicator(false), 1500);
  };

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED || event.nativeEvent.oldState === State.ACTIVE) {
      basePreviewFontSizeRef.current = previewFontSize;
    }
  };

  // Rendering individual card - replica of Prelims search design
  const renderItem = ({ item: rawItem, index }: { item: any; index: number }) => {
    // ── CONCEPT SECTION HEADER ──
    if (rawItem && rawItem.kind === 'conceptHeader') {
      const conceptTitle = rawItem.concept || 'General Questions';
      const count = rawItem.count || 0;
      const isCollapsed = Boolean(collapsedConcepts[conceptTitle]);
      return (
        <TouchableOpacity
          key={rawItem.id}
          activeOpacity={0.8}
          onPress={() => {
            setCollapsedConcepts(prev => ({
              ...prev,
              [conceptTitle]: !prev[conceptTitle],
            }));
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? 'rgba(22, 163, 74, 0.16)' : '#DCFCE7',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            marginTop: 12,
            marginBottom: 6,
            borderWidth: 1.5,
            borderColor: isDark ? 'rgba(22, 163, 74, 0.4)' : '#16A34A',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: isDark ? '#4ade80' : '#15803D',
                flexShrink: 1,
                letterSpacing: 0.2,
              }}
              numberOfLines={1}
            >
              {conceptTitle}
            </Text>
            <View style={{
              backgroundColor: '#16A34A',
              borderRadius: 8,
              paddingHorizontal: 6,
              paddingVertical: 1,
            }}>
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#ffffff' }}>
                {count}
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? '#86efac' : '#166534' }}>
            {isCollapsed ? 'Expand' : 'Collapse'}
          </Text>
        </TouchableOpacity>
      );
    }

    const item = rawItem as UnifiedSearchResult;

    if (item.type === 'topper') {
      const tq = item.rawItem;
      const topperAns =
        (tq.answers || []).find((a: any) => isTopperAnswer(a)) || tq.answers?.[0];
      return (
        <QuestionBankTopperCard
          key={item.id}
          question={tq}
          topperAnswer={topperAns}
          colors={colors}
          isDark={isDark}
          zoomFontSize={zoomFontSize}
          isBookmarked={savedQuestionIds.includes(tq.id)}
          onToggleBookmark={toggleBookmark}
          onOpenViewer={handleOpenTopperViewer}
          onOpenDetailed={() => setPreviewMainsQuestion(tq)}
          searchQuery={query}
        />
      );
    }

    if (item.type === 'mains') {
      const mq = item.rawItem;
      return (
        <MainsQuestionCard
          key={item.id}
          question={mq}
          colors={colors}
          isDark={isDark}
          isTablet={IS_IPAD}
          zoomFontSize={zoomFontSize}
          textColorMode={textColorMode}
          keyBoxMode={keyBoxMode}
          keyBoxColor={keyBoxColor}
          isExpanded={expandedResultId === mq.id}
          onToggleExpand={() =>
            setExpandedResultId(prev => (prev === mq.id ? null : mq.id))
          }
          selectedInstitute={selectedResultInstitutes[mq.id]}
          onSelectInstitute={(inst) =>
            setSelectedResultInstitutes(prev => ({ ...prev, [mq.id]: inst }))
          }
          isBookmarked={savedQuestionIds.includes(mq.id)}
          onToggleBookmark={() => toggleBookmark(mq.id)}
          onOpenDetailed={() => setPreviewMainsQuestion(mq)}
          onCopyQuestion={() => handleCopyMainsQuestion(mq)}
          onOpenTopperViewer={handleOpenTopperViewer}
          attachedToppers={topperAttachmentMap.get(normalizeQuestionKey(mq.questionText || '')) || []}
          searchQuery={query}
          searchAcross={filters.searchAcross}
        />
      );
    }

    const isFeatured = index === 0;
    const isExpanded = expandedIds.has(item.id);
    const subColor = getSubjectColor(item.subject || '');
    
    // Type badge details
    const typeLabel = item.type === 'prelims' ? 'Prelims' : 'Value Add';
    const typeBg = item.type === 'prelims' ? '#e0e7ff' : '#d1fae5';
    const typeTxt = item.type === 'prelims' ? '#4338ca' : '#047857';

    let displayTitle = item.type === 'prelims' 
      ? item.rawItem.question_text || item.title 
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
              <Text style={[styles.cardText, { color: colors.textPrimary, fontSize: Math.max(12, zoomFontSize - 2) }]}>
                {highlightKeywords(displayTitle, keywords)}
              </Text>
            ) : (
              <Text style={[styles.cardText, { color: colors.textPrimary, fontSize: Math.max(12, zoomFontSize - 2) }]} numberOfLines={3}>
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

              {item.year && (
                <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                  <Text style={[styles.chipText, { color: colors.textTertiary }]}>{item.year}</Text>
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

        {/* Inline Expandable Panel (Value Addition) */}
        {isExpanded && item.type === 'value_add' && (
          <View style={[styles.expandedPanel, { borderTopColor: colors.border }]}>
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
      | 'mainsSections'
      | 'mainsMicrotopics'
      | 'revisionTags'
      | 'subtopics'
      | 'nanotopics'
      | 'tags'
      | 'macrotags'
      | 'microtags'
      | 'mainsYears'
      | 'alliedExams',
    value: string
  ) => {
    setFilters(p => {
      if (value === 'All') {
        const next: UnifiedFilters = { ...p, [key]: [] };
        if (key === 'mainsPapers') {
          next.subjects = [];
          next.mainsSections = [];
          next.mainsMicrotopics = [];
          next.subtopics = [];
          next.nanotopics = [];
        } else if (key === 'sections') {
          next.microtopics = [];
        } else if (key === 'mainsSections') {
          next.mainsMicrotopics = [];
          next.subtopics = [];
          next.nanotopics = [];
        } else if (key === 'mainsMicrotopics') {
          next.subtopics = [];
          next.nanotopics = [];
        } else if (key === 'subtopics') {
          next.nanotopics = [];
        } else if (key === 'institutes') {
          next.programmes = [];
        }
        return next;
      }

      if (key === 'subjects') {
        const canonicalVal = canonicalizeSubject(value);
        const isSel = p.subjects.some(s => canonicalizeSubject(s) === canonicalVal);
        const nextSubs = isSel
          ? p.subjects.filter(s => canonicalizeSubject(s) !== canonicalVal)
          : [...p.subjects.filter(s => canonicalizeSubject(s) !== canonicalVal), canonicalVal];
        return {
          ...p,
          subjects: nextSubs,
        };
      }

      const current = (p[key] as string[]) || [];
      const next = current.includes(value)
        ? current.filter(x => x !== value)
        : [...current, value];

      const updated: UnifiedFilters = { ...p, [key]: next };

      if (key === 'mainsPapers') {
        updated.subjects = [];
        updated.mainsSections = [];
        updated.mainsMicrotopics = [];
        updated.subtopics = [];
        updated.nanotopics = [];
      } else if (key === 'institutes' && next.length === 0) {
        updated.programmes = [];
      }

      return updated;
    });

    if (value !== 'All') {
      if (key === 'sections' || key === 'mainsSections') {
        setTimeout(() => {
          const targetY = sidebarSectionOffsets.current['mainsMicrotopics']
            ?? sidebarSectionOffsets.current['microtopics']
            ?? (sidebarSectionOffsets.current['mainsSections'] ? sidebarSectionOffsets.current['mainsSections'] + 50 : 320);
          sidebarScrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 30), animated: true });
        }, 70);
      } else if (key === 'microtopics' || key === 'mainsMicrotopics') {
        setTimeout(() => {
          const targetY = sidebarSectionOffsets.current['subtopics']
            ?? (sidebarSectionOffsets.current['mainsMicrotopics'] ? sidebarSectionOffsets.current['mainsMicrotopics'] + 70 : (sidebarSectionOffsets.current['microtopics'] ? sidebarSectionOffsets.current['microtopics'] + 70 : 500));
          sidebarScrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 30), animated: true });
        }, 70);
      } else if (key === 'subtopics') {
        setTimeout(() => {
          const targetY = sidebarSectionOffsets.current['nanotopics']
            ?? (sidebarSectionOffsets.current['subtopics'] ? sidebarSectionOffsets.current['subtopics'] + 70 : 680);
          sidebarScrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 30), animated: true });
        }, 70);
      } else if (key === 'nanotopics') {
        setTimeout(() => {
          const targetY = sidebarSectionOffsets.current['nanotopics'] ?? 840;
          sidebarScrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 20), animated: true });
        }, 70);
      }
    }
  };

  const toggleStage = (key: 'showPrelims' | 'showMains' | 'showToppers' | 'showValueAdd') => {
    setFilters(p => {
      const nextVal = !p[key];
      const next = { ...p, [key]: nextVal };
      // If Prelims turned off, reset prelims-only options
      if (!next.showPrelims) {
        next.ncertFilter = 'All';
        next.sections = [];
        next.microtopics = [];
        next.yearRange = '';
      }
      // If Mains, Toppers, and ValueAdd all turned off, reset mains filters
      if (!next.showMains && !next.showToppers && !next.showValueAdd) {
        next.mainsPapers = [];
        next.mainsSections = [];
        next.mainsMicrotopics = [];
        next.subtopics = [];
        next.nanotopics = [];
        next.tags = [];
        next.macrotags = [];
        next.microtags = [];
        next.mainsYears = [];
      }
      return next;
    });
    setSidebarSubjectFilter(null);
  };

  const activeSectionCounts = useMemo(() => countActiveFiltersBySection(filters), [filters]);



  const mdStyles = buildMarkdownStyles(
    colors.textPrimary,
    14,
    colors.surface,
    colors.border,
    colors.primary
  );
  const mdRules = getMarkdownRules(colors, isDark, setZoomImageUri);



  const renderAccordionHeader = (
    key: 'prelims' | 'mains' | 'institutes' | 'revision' | 'display' | 'searchIn',
    label: string,
    badgeCount?: number,
    color?: string
  ) => {
    const isOpen = openSections[key];
    const hasActive = key !== 'searchIn' && (badgeCount ?? 0) > 0;
    const activeColor = color || colors.primary;
    return (
      <TouchableOpacity
        onPress={() => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))}
        activeOpacity={1}
        style={[
          styles.sidebarSectionHeader,
          (isOpen || hasActive) && styles.sidebarSectionHeaderActive,
          {
            marginVertical: 3,
            paddingVertical: 8,
            paddingHorizontal: 10,
            borderRadius: 10,
            backgroundColor: (isOpen || hasActive)
              ? (isDark ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.06)')
              : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'transparent'),
            borderColor: (isOpen || hasActive)
              ? (isDark ? 'rgba(124, 58, 237, 0.3)' : 'rgba(124, 58, 237, 0.18)')
              : 'transparent',
            borderWidth: 1,
          }
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              color: (isOpen || hasActive) ? activeColor : colors.textSecondary,
              letterSpacing: 0.5,
            }}
          >
            {label}
          </Text>
          {hasActive && (
            <View
              style={{
                backgroundColor: activeColor,
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 1,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
                {badgeCount}
              </Text>
            </View>
          )}
        </View>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: (isOpen || hasActive) ? activeColor + '15' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
          {isOpen
            ? <ChevronUp size={13} color={(isOpen || hasActive) ? activeColor : colors.textSecondary} />
            : <ChevronDown size={13} color={colors.textTertiary} />
          }
        </View>
      </TouchableOpacity>
    );
  };

  const LeftPanelFilters = (
    <ScrollView ref={sidebarScrollViewRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={true}>
      {/* Spacer so Floating Home/Back button never overlaps Result Breakdown or top filters */}
      {IS_IPAD && <View style={{ height: Math.max(insets.top, 12) + 40 }} />}

      {/* Result Breakdown - stats pills with indicator dots on top and counts below (Requirement 9) */}
      {hasSearched && results.length > 0 && (
        <View style={{ marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' }} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#166534', letterSpacing: 0.5 }} numberOfLines={1}>
                  PRELIMS
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#15803D', marginTop: 3 }} numberOfLines={1}>
                {resultCounts.stageCounts.prelims}
              </Text>
            </View>
            <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EA580C' }} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#9A3412', letterSpacing: 0.5 }} numberOfLines={1}>
                  MAINS
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#C2410C', marginTop: 3 }} numberOfLines={1}>
                {resultCounts.stageCounts.mains}
              </Text>
            </View>
            <View style={{ flex: 1, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 8, backgroundColor: '#FFF7ED', borderWidth: 0.5, borderColor: '#FED7AA', alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F97316' }} />
                <Text style={{ fontSize: 9, fontWeight: '700', color: '#C2410C', letterSpacing: 0.5 }} numberOfLines={1}>
                  TOPPER
                </Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#EA580C', marginTop: 3 }} numberOfLines={1}>
                {resultCounts.stageCounts.topper}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 1: MASTER STAGE TOGGLES [Prelims] [Mains]
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 14, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 8 }}>
          EXAM STAGE
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {/* Prelims Master Chip */}
          <TouchableOpacity
            onPress={() => toggleStage('showPrelims')}
            activeOpacity={1}
            style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 10,
              paddingHorizontal: 8,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: filters.showPrelims ? '#16A34A' : colors.border,
              backgroundColor: filters.showPrelims ? (isDark ? 'rgba(22,163,74,0.18)' : '#DCFCE7') : colors.surface,
              gap: 6,
            }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: filters.showPrelims ? '#16A34A' : 'transparent',
                borderWidth: filters.showPrelims ? 0 : 1.5,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {filters.showPrelims && <Check size={10} color="#fff" />}
            </View>
            <Text
              style={{
                fontSize: 12,
                fontWeight: '800',
                color: filters.showPrelims ? '#15803D' : colors.textSecondary,
              }}
            >
              Prelims
            </Text>
          </TouchableOpacity>

          {/* Mains Master Chip */}
          {(() => {
            const isMainsActive = filters.showMains || filters.showToppers || filters.showValueAdd;
            return (
              <TouchableOpacity
                onPress={() => {
                  if (isMainsActive) {
                    setFilters(p => ({
                      ...p,
                      showMains: false,
                      showToppers: false,
                      showValueAdd: false,
                      mainsPapers: [],
                      subjects: [],
                      mainsSections: [],
                      mainsMicrotopics: [],
                      subtopics: [],
                      nanotopics: [],
                      tags: [],
                      macrotags: [],
                      microtags: [],
                      mainsYears: [],
                    }));
                  } else {
                    setFilters(p => ({
                      ...p,
                      showMains: true,
                      showToppers: true,
                      showValueAdd: true,
                    }));
                  }
                }}
                activeOpacity={1}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 10,
                  borderWidth: 1.5,
                  borderColor: isMainsActive ? '#EA580C' : colors.border,
                  backgroundColor: isMainsActive ? (isDark ? 'rgba(234,88,12,0.18)' : '#FFEDD5') : colors.surface,
                  gap: 6,
                }}
              >
                <View
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: isMainsActive ? '#EA580C' : 'transparent',
                    borderWidth: isMainsActive ? 0 : 1.5,
                    borderColor: colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isMainsActive && <Check size={10} color="#fff" />}
                </View>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '800',
                    color: isMainsActive ? '#C2410C' : colors.textSecondary,
                  }}
                >
                  Mains
                </Text>
              </TouchableOpacity>
            );
          })()}
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 2: COMMON PYQ CONTROL (collapsed by default)
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 12, paddingBottom: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
        <TouchableOpacity
          onPress={() => setPyqExpanded(prev => !prev)}
          activeOpacity={1}
          style={[
            styles.sidebarSectionHeader,
            (pyqExpanded || filters.pyqFilter !== 'All') && styles.sidebarSectionHeaderActive,
            {
              marginVertical: 3,
              paddingVertical: 8,
              paddingHorizontal: 10,
              borderRadius: 10,
              backgroundColor: (pyqExpanded || filters.pyqFilter !== 'All')
                ? (isDark ? 'rgba(124, 58, 237, 0.12)' : 'rgba(124, 58, 237, 0.06)')
                : (isDark ? 'rgba(255, 255, 255, 0.03)' : 'transparent'),
              borderColor: (pyqExpanded || filters.pyqFilter !== 'All')
                ? (isDark ? 'rgba(124, 58, 237, 0.3)' : 'rgba(124, 58, 237, 0.18)')
                : 'transparent',
              borderWidth: 1,
              marginBottom: pyqExpanded ? 6 : 2,
            }
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: (pyqExpanded || filters.pyqFilter !== 'All') ? colors.primary : colors.textSecondary,
                letterSpacing: 0.5,
              }}
            >
              PYQ STATUS
            </Text>
            {filters.pyqFilter !== 'All' && (
              <View
                style={{
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff' }}>
                  {filters.pyqFilter === 'PYQ Only' ? 'PYQ' : 'Non-PYQ'}
                </Text>
              </View>
            )}
          </View>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: (pyqExpanded || filters.pyqFilter !== 'All') ? colors.primary + '15' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {pyqExpanded
              ? <ChevronUp size={13} color={(pyqExpanded || filters.pyqFilter !== 'All') ? colors.primary : colors.textSecondary} />
              : <ChevronDown size={13} color={colors.textTertiary} />
            }
          </View>
        </TouchableOpacity>

        {pyqExpanded && (
          <View style={{ marginTop: 4 }}>
            <View style={{ flexDirection: 'row', gap: 5, marginBottom: filters.pyqFilter === 'PYQ Only' ? 8 : 0 }}>
              {(['All', 'PYQ Only', 'Non-PYQ'] as const).map(opt => {
                const isSelected = filters.pyqFilter === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => setFilters(p => ({ ...p, pyqFilter: opt }))}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      { flex: 1, justifyContent: 'center' },
                      isSelected
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                      {opt === 'PYQ Only' ? 'PYQ' : opt}
                    </Text>
                    {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 3 }} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Revealed when PYQ Only is selected */}
            {filters.pyqFilter === 'PYQ Only' && (
              <View style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', padding: 8, borderRadius: 10, gap: 6, marginTop: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5 }}>
                  EXAM CATEGORY
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  {(selectedCourse?.toLowerCase().includes('medical')
                    ? ['NEET PG', 'INI-CET', 'UPSC CMS', 'Others']
                    : ['UPSC', 'Allied', 'Others']
                  ).map(cat => {
                    const isSelected = filters.examCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() =>
                          setFilters(p => ({
                            ...p,
                            examCategory: (p.examCategory === cat ? 'All' : cat) as any,
                            alliedExams: p.examCategory === cat ? [] : p.alliedExams,
                          }))
                        }
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                          {cat}
                        </Text>
                        {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 3 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Revealed when Allied is selected */}
                {filters.examCategory === 'Allied' && (
                  <View style={{ marginTop: 2, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: colors.border, gap: 5 }}>
                    <Text style={{ fontSize: 9, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5 }}>
                      ALLIED EXAMS
                    </Text>
                    {alliedExamOptions.length > 0 ? (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                        {alliedExamOptions.map(ae => {
                          const isSelected = filters.alliedExams.includes(ae);
                          return (
                            <TouchableOpacity
                              key={ae}
                              onPress={() => toggleFilterChip('alliedExams', ae)}
                              activeOpacity={1}
                              style={[
                                styles.compactChip,
                                isSelected
                                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                                  : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                              ]}
                            >
                              <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                                {ae}
                              </Text>
                              {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 3 }} />}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={{ fontSize: 10, color: colors.textTertiary, fontStyle: 'italic' }}>
                        All allied questions included
                      </Text>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 3: PRELIMS ACCORDION (Always visible, default open)
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 4 }}>
        {renderAccordionHeader('prelims', 'PRELIMS FILTERS', activeSectionCounts.prelims, '#16A34A')}
        {openSections.prelims && (
          <View style={{ marginBottom: 8, gap: 8 }}>
            {/* 1. NCERT inline filter (Single line, 2 chips, both selected by default) */}
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                NCERT
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {(() => {
                  const isNcertSelected = filters.ncertFilter === 'All' || filters.ncertFilter === 'NCERT Only';
                  const isNonNcertSelected = filters.ncertFilter === 'All' || filters.ncertFilter === 'Non-NCERT';

                  const handleNcertPress = () => {
                    if (filters.ncertFilter === 'All') {
                      setFilters(p => ({ ...p, ncertFilter: 'NCERT Only' }));
                    } else if (filters.ncertFilter === 'Non-NCERT') {
                      setFilters(p => ({ ...p, ncertFilter: 'All' }));
                    } else {
                      setFilters(p => ({ ...p, ncertFilter: 'All' }));
                    }
                  };

                  const handleNonNcertPress = () => {
                    if (filters.ncertFilter === 'All') {
                      setFilters(p => ({ ...p, ncertFilter: 'Non-NCERT' }));
                    } else if (filters.ncertFilter === 'NCERT Only') {
                      setFilters(p => ({ ...p, ncertFilter: 'All' }));
                    } else {
                      setFilters(p => ({ ...p, ncertFilter: 'All' }));
                    }
                  };

                  return (
                    <>
                      <TouchableOpacity
                        onPress={handleNcertPress}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          { flex: 1, justifyContent: 'center' },
                          isNcertSelected
                            ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isNcertSelected ? '#fff' : colors.textSecondary }]}>
                          NCERT Only
                        </Text>
                        {isNcertSelected ? <Check size={10} color="#fff" style={{ marginLeft: 4 }} /> : null}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleNonNcertPress}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          { flex: 1, justifyContent: 'center' },
                          isNonNcertSelected
                            ? { backgroundColor: '#16A34A', borderColor: '#16A34A' }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isNonNcertSelected ? '#fff' : colors.textSecondary }]}>
                          Non-NCERT
                        </Text>
                        {isNonNcertSelected ? <Check size={10} color="#fff" style={{ marginLeft: 4 }} /> : null}
                      </TouchableOpacity>
                    </>
                  );
                })()}
              </View>
            </View>

            {/* 2. Subjects (2 per line, exact original names visually truncated, includes CSAT) */}
            {prelimsSubjectOptions.length > 0 && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  SUBJECTS {(filters?.subjects?.length ?? 0) > 0 ? `(${filters.subjects.length})` : ''}
                </Text>
                {/* All Button */}
                <TouchableOpacity
                  onPress={() => toggleFilterChip('subjects', 'All')}
                  activeOpacity={1}
                  style={[
                    styles.compactChip,
                    { marginBottom: 5, alignSelf: 'flex-start' },
                    (filters?.subjects?.length ?? 0) === 0
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.compactChipText, { color: (filters?.subjects?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {(filters?.subjects?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 4 }} /> : null}
                </TouchableOpacity>

                {/* 2 Subject Chips per line */}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {prelimsSubjectOptions.map(sub => {
                    const canon = canonicalizeSubject(sub);
                    const isSelected = (filters?.subjects || []).some(s => canonicalizeSubject(s) === canon);
                    return (
                      <TouchableOpacity
                        key={canon}
                        onPress={() => toggleFilterChip('subjects', canon)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          { width: '48.5%', justifyContent: 'space-between' },
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.compactChipText,
                            { color: isSelected ? '#fff' : colors.textSecondary, flex: 1 },
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {truncateSubjectLabel(sub)}
                        </Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 3. Section Group (visible ONLY when >= 1 subject selected & sections exist) */}
            {(filters?.subjects?.length ?? 0) > 0 && prelimsSectionOptions.filter(x => x !== 'All').length > 0 && (
              <View 
                onLayout={(e) => { sidebarSectionOffsets.current['sections'] = e.nativeEvent.layout.y; }}
                style={{ marginBottom: 4 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  SECTIONS / MODULES {(filters?.sections?.length ?? 0) > 0 ? `(${filters.sections.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('sections', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.sections?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.sections?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.sections?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 4 }} /> : null}
                  </TouchableOpacity>
                  {prelimsSectionOptions.filter(x => x !== 'All').map(sec => {
                    const isSelected = (filters?.sections || []).includes(sec);
                    return (
                      <TouchableOpacity
                        key={sec}
                        onPress={() => toggleFilterChip('sections', sec)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sec}</Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 4. Microtopics (visible ONLY when >= 1 section selected & microtopics exist) */}
            {(filters?.sections?.length ?? 0) > 0 && prelimsMicrotopicOptions.filter(x => x !== 'All').length > 0 && (
              <View 
                onLayout={(e) => { sidebarSectionOffsets.current['microtopics'] = e.nativeEvent.layout.y; }}
                style={{ marginBottom: 4 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  MICROTOPICS {(filters?.microtopics?.length ?? 0) > 0 ? `(${filters.microtopics.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('microtopics', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.microtopics?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.microtopics?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.microtopics?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 4 }} /> : null}
                  </TouchableOpacity>
                  {prelimsMicrotopicOptions.filter(x => x !== 'All').map(mt => {
                    const isSelected = (filters?.microtopics || []).includes(mt);
                    return (
                      <TouchableOpacity
                        key={mt}
                        onPress={() => toggleFilterChip('microtopics', mt)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{mt}</Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 4: MAINS ACCORDION (Always visible, default open)
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 4 }}>
        {renderAccordionHeader('mains', 'MAINS FILTERS', activeSectionCounts.mains, '#EA580C')}
        {openSections.mains && (
          <View style={{ marginBottom: 8, gap: 8 }}>
            {/* 1. Papers (Always visible) */}
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                PAPERS {(filters?.mainsPapers?.length ?? 0) > 0 ? `(${filters.mainsPapers.length})` : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('mainsPapers', 'All')}
                  activeOpacity={1}
                  style={[
                    styles.compactChip,
                    (filters?.mainsPapers?.length ?? 0) === 0
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.compactChipText, { color: (filters?.mainsPapers?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {(filters?.mainsPapers?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                </TouchableOpacity>
                {PAPER_OPTIONS.map(opt => {
                  const isSelected = (filters?.mainsPapers || []).includes(opt);
                  const count = resultCounts.paperCounts[opt] ?? 0;
                  return (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => toggleFilterChip('mainsPapers', opt)}
                      activeOpacity={1}
                      style={[
                        styles.compactChip,
                        isSelected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{opt}</Text>
                      {hasSearched && count > 0 && (
                        <Text style={{ fontSize: 8, fontWeight: '700', marginLeft: 3, color: isSelected ? '#fff' : colors.textTertiary }}>
                          ({count})
                        </Text>
                      )}
                      {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* 2. Subjects (Appears ONLY when >= 1 paper selected & subjects exist) */}
            {(filters?.mainsPapers?.length ?? 0) > 0 && mainsSubjectOptions.length > 0 && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  SUBJECTS {(filters?.subjects?.length ?? 0) > 0 ? `(${filters.subjects.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('subjects', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.subjects?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.subjects?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.subjects?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                  </TouchableOpacity>
                  {mainsSubjectOptions.map(sub => {
                    const canon = canonicalizeSubject(sub);
                    const isSelected = (filters?.subjects || []).some(s => canonicalizeSubject(s) === canon);
                    const count = resultCounts.subjectCounts[canon] ?? 0;
                    return (
                      <TouchableOpacity
                        key={canon}
                        onPress={() => toggleFilterChip('subjects', canon)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sub}</Text>
                        {hasSearched && count > 0 && (
                          <Text style={{ fontSize: 8, fontWeight: '700', marginLeft: 3, color: isSelected ? '#fff' : colors.textTertiary }}>
                            ({count})
                          </Text>
                        )}
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 3. Section Group (Appears ONLY when >= 1 subject selected & sections exist) */}
            {(filters?.subjects?.length ?? 0) > 0 && mainsSectionOptions.filter(x => x !== 'All').length > 0 && (
              <View 
                onLayout={(e) => { sidebarSectionOffsets.current['mainsSections'] = e.nativeEvent.layout.y; }}
                style={{ marginBottom: 4 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  SECTIONS {(filters?.mainsSections?.length ?? 0) > 0 ? `(${filters.mainsSections?.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('mainsSections', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.mainsSections?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.mainsSections?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.mainsSections?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                  </TouchableOpacity>
                  {mainsSectionOptions.filter(x => x !== 'All').map(sec => {
                    const isSelected = (filters?.mainsSections || []).includes(sec);
                    return (
                      <TouchableOpacity
                        key={sec}
                        onPress={() => toggleFilterChip('mainsSections', sec)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sec}</Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 4. Microtopics (Appears ONLY when >= 1 section selected & microtopics exist) */}
            {(filters?.mainsSections?.length ?? 0) > 0 && mainsMicrotopicOptions.filter(x => x !== 'All').length > 0 && (
              <View 
                onLayout={(e) => { sidebarSectionOffsets.current['mainsMicrotopics'] = e.nativeEvent.layout.y; sidebarSectionOffsets.current['microtopics'] = e.nativeEvent.layout.y; }}
                style={{ marginBottom: 4 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  MICROTOPICS {(filters?.mainsMicrotopics?.length ?? 0) > 0 ? `(${filters.mainsMicrotopics?.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('mainsMicrotopics', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.mainsMicrotopics?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.mainsMicrotopics?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.mainsMicrotopics?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                  </TouchableOpacity>
                  {mainsMicrotopicOptions.filter(x => x !== 'All').map(micro => {
                    const isSelected = (filters?.mainsMicrotopics || []).includes(micro);
                    return (
                      <TouchableOpacity
                        key={micro}
                        onPress={() => toggleFilterChip('mainsMicrotopics', micro)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{micro}</Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 5. Subtopics (Appears ONLY when >= 1 microtopic selected & subtopics exist) */}
            {(filters?.mainsMicrotopics?.length ?? 0) > 0 && mainsSubtopicOptions.filter(x => x !== 'All').length > 0 && (
              <View 
                onLayout={(e) => { sidebarSectionOffsets.current['subtopics'] = e.nativeEvent.layout.y; }}
                style={{ marginBottom: 4 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  SUBTOPICS {(filters?.subtopics?.length ?? 0) > 0 ? `(${filters.subtopics.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('subtopics', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.subtopics?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.subtopics?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.subtopics?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                  </TouchableOpacity>
                  {mainsSubtopicOptions.filter(x => x !== 'All').map(sub => {
                    const isSelected = (filters?.subtopics || []).includes(sub);
                    return (
                      <TouchableOpacity
                        key={sub}
                        onPress={() => toggleFilterChip('subtopics', sub)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sub}</Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 6. Nanotopics (Appears ONLY when >= 1 subtopic selected & nanotopics exist) */}
            {(filters?.subtopics?.length ?? 0) > 0 && mainsNanotopicOptions.filter(x => x !== 'All').length > 0 && (
              <View 
                onLayout={(e) => { sidebarSectionOffsets.current['nanotopics'] = e.nativeEvent.layout.y; }}
                style={{ marginBottom: 4 }}
              >
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  NANOTOPICS {(filters?.nanotopics?.length ?? 0) > 0 ? `(${filters.nanotopics.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('nanotopics', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.nanotopics?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.nanotopics?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.nanotopics?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                  </TouchableOpacity>
                  {mainsNanotopicOptions.filter(x => x !== 'All').map(nano => {
                    const isSelected = (filters?.nanotopics || []).includes(nano);
                    return (
                      <TouchableOpacity
                        key={nano}
                        onPress={() => toggleFilterChip('nanotopics', nano)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{nano}</Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 7. Macro Tags (Imported from Mains Question Bank, collapsed by default - Requirement 17) */}
            {mainsMacrotagOptions.filter(x => x !== 'All').length > 0 && (
              <View style={{ marginBottom: 4, marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: colors.border }}>
                <TouchableOpacity
                  onPress={() => setMacroTagsExpanded(p => !p)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>
                    MACRO TAGS {(filters?.macrotags?.length ?? 0) > 0 ? `(${filters.macrotags.length})` : ''}
                  </Text>
                  {macroTagsExpanded ? (
                    <ChevronUp size={12} color={colors.textTertiary} />
                  ) : (
                    <ChevronDown size={12} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
                {macroTagsExpanded && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => toggleFilterChip('macrotags', 'All')}
                      activeOpacity={1}
                      style={[
                        styles.compactChip,
                        (filters?.macrotags?.length ?? 0) === 0
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.compactChipText, { color: (filters?.macrotags?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                      {(filters?.macrotags?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                    </TouchableOpacity>
                    {mainsMacrotagOptions.filter(x => x !== 'All').map(tag => {
                      const isSelected = (filters?.macrotags || []).includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => toggleFilterChip('macrotags', tag)}
                          activeOpacity={1}
                          style={[
                            styles.compactChip,
                            isSelected
                              ? { backgroundColor: colors.primary, borderColor: colors.primary }
                              : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                            #{tag}
                          </Text>
                          {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* 8. Micro Tags (Contextual from Mains Question Bank, collapsed by default - Requirement 17) */}
            {(filters?.macrotags?.length ?? 0) > 0 && mainsMicrotagOptions.filter(x => x !== 'All').length > 0 && (
              <View style={{ marginBottom: 4, marginTop: 2 }}>
                <TouchableOpacity
                  onPress={() => setMicroTagsExpanded(p => !p)}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 }}
                >
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1 }}>
                    MICRO TAGS {(filters?.microtags?.length ?? 0) > 0 ? `(${filters.microtags.length})` : ''}
                  </Text>
                  {microTagsExpanded ? (
                    <ChevronUp size={12} color={colors.textTertiary} />
                  ) : (
                    <ChevronDown size={12} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
                {microTagsExpanded && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                    <TouchableOpacity
                      onPress={() => toggleFilterChip('microtags', 'All')}
                      activeOpacity={1}
                      style={[
                        styles.compactChip,
                        (filters?.microtags?.length ?? 0) === 0
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.compactChipText, { color: (filters?.microtags?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                      {(filters?.microtags?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                    </TouchableOpacity>
                    {mainsMicrotagOptions.filter(x => x !== 'All').map(tag => {
                      const isSelected = (filters?.microtags || []).includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => toggleFilterChip('microtags', tag)}
                          activeOpacity={1}
                          style={[
                            styles.compactChip,
                            isSelected
                              ? { backgroundColor: colors.primary, borderColor: colors.primary }
                              : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                            #{tag}
                          </Text>
                          {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 5: INSTITUTES & PROGRAMMES ACCORDION (default closed)
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 4 }}>
        {renderAccordionHeader('institutes', 'INSTITUTES & PROGRAMMES', activeSectionCounts.institutes, '#3B82F6')}
        {openSections.institutes && (
          <View style={{ marginBottom: 8, gap: 8 }}>
            {/* Institutes */}
            <View style={{ marginBottom: 4 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                INSTITUTES {filters.institutes.length > 0 ? `(${filters.institutes.length})` : ''}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('institutes', 'All')}
                  activeOpacity={1}
                  style={[
                    styles.compactChip,
                    (filters?.institutes?.length ?? 0) === 0
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.compactChipText, { color: (filters?.institutes?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {(filters?.institutes?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                </TouchableOpacity>
                {instituteOptions.filter(x => x !== 'All').map(inst => {
                  const isSelected = (filters?.institutes || []).includes(inst);
                  const count = resultCounts.instituteCounts[inst] ?? 0;
                  return (
                    <TouchableOpacity
                      key={inst}
                      onPress={() => toggleFilterChip('institutes', inst)}
                      activeOpacity={1}
                      style={[
                        styles.compactChip,
                        isSelected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{inst}</Text>
                      {hasSearched && count > 0 && (
                        <Text style={{ fontSize: 8, fontWeight: '700', marginLeft: 3, color: isSelected ? '#fff' : colors.textTertiary }}>
                          ({count})
                        </Text>
                      )}
                      {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Programmes (visible ONLY when >= 1 institute selected & programmes exist) */}
            {(filters?.institutes?.length ?? 0) > 0 && programmeOptions.filter(x => x !== 'All').length > 0 && (
              <View style={{ marginBottom: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>
                  PROGRAMMES {(filters?.programmes?.length ?? 0) > 0 ? `(${filters.programmes.length})` : ''}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                  <TouchableOpacity
                    onPress={() => toggleFilterChip('programmes', 'All')}
                    activeOpacity={1}
                    style={[
                      styles.compactChip,
                      (filters?.programmes?.length ?? 0) === 0
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.compactChipText, { color: (filters?.programmes?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                    {(filters?.programmes?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                  </TouchableOpacity>
                  {programmeOptions.filter(x => x !== 'All').map(prog => {
                    const isSelected = (filters?.programmes || []).includes(prog);
                    return (
                      <TouchableOpacity
                        key={prog}
                        onPress={() => toggleFilterChip('programmes', prog)}
                        activeOpacity={1}
                        style={[
                          styles.compactChip,
                          isSelected
                            ? { backgroundColor: colors.primary, borderColor: colors.primary }
                            : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{prog}</Text>
                        {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 6: REVISION TAGS ACCORDION (default closed)
         ═══════════════════════════════════════════════════════════════════════ */}
      {userTags.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          {renderAccordionHeader('revision', 'REVISION TAGS', activeSectionCounts.revision)}
          {openSections.revision && (
            <View style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
                <TouchableOpacity
                  onPress={() => toggleFilterChip('revisionTags', 'All')}
                  activeOpacity={1}
                  style={[
                    styles.compactChip,
                    (filters?.revisionTags?.length ?? 0) === 0
                      ? { backgroundColor: colors.primary, borderColor: colors.primary }
                      : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.compactChipText, { color: (filters?.revisionTags?.length ?? 0) === 0 ? '#fff' : colors.textSecondary }]}>All</Text>
                  {(filters?.revisionTags?.length ?? 0) === 0 ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                </TouchableOpacity>
                {userTags.map(tag => {
                  const isSelected = (filters?.revisionTags || []).includes(tag);
                  return (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleFilterChip('revisionTags', tag)}
                      activeOpacity={1}
                      style={[
                        styles.compactChip,
                        isSelected
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.compactChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{tag}</Text>
                      {isSelected ? <Check size={10} color="#fff" style={{ marginLeft: 3 }} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 6.5: SEARCH IN ACCORDION (default open)
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 4 }}>
        {renderAccordionHeader('searchIn', 'SEARCH IN', 0)}
        {openSections.searchIn && (
          <View style={{ marginBottom: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingTop: 4 }}>
            <TouchableOpacity
              onPress={() => {
                const list = filters.searchAcross || ['Question'];
                const hasQ = list.includes('Question');
                let next: ('Question' | 'Explanation' | 'Options')[];
                if (hasQ) {
                  next = list.filter(x => x !== 'Question');
                  if (next.length === 0) next = ['Question']; // keep at least one
                } else {
                  next = [...list, 'Question'];
                }
                setFilters(p => ({ ...p, searchAcross: next }));
              }}
              activeOpacity={1}
              style={[
                styles.compactChip,
                (filters.searchAcross || []).includes('Question')
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.compactChipText, { color: (filters.searchAcross || []).includes('Question') ? '#fff' : colors.textSecondary }]}>Question Text</Text>
              {(filters.searchAcross || []).includes('Question') && <Check size={10} color="#fff" style={{ marginLeft: 3 }} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                const list = filters.searchAcross || ['Question'];
                const hasE = list.includes('Explanation');
                let next: ('Question' | 'Explanation' | 'Options')[];
                if (hasE) {
                  next = list.filter(x => x !== 'Explanation');
                  if (next.length === 0) next = ['Question'];
                } else {
                  next = [...list, 'Explanation'];
                }
                setFilters(p => ({ ...p, searchAcross: next }));
              }}
              activeOpacity={1}
              style={[
                styles.compactChip,
                (filters.searchAcross || []).includes('Explanation')
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.compactChipText, { color: (filters.searchAcross || []).includes('Explanation') ? '#fff' : colors.textSecondary }]}>Answer Text</Text>
              {(filters.searchAcross || []).includes('Explanation') && <Check size={10} color="#fff" style={{ marginLeft: 3 }} />}
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          ROW 7: DISPLAY & READING ACCORDION (default closed)
         ═══════════════════════════════════════════════════════════════════════ */}
      <View style={{ marginBottom: 4 }}>
        {renderAccordionHeader('display', 'READING & DISPLAY', 0)}
        {openSections.display && (
          <View style={{ marginBottom: 8 }}>
            <SidebarDisplayPreferences
              textColorMode={textColorMode}
              onChangeTextColorMode={handleUpdateTextColorMode}
              keyBoxMode={keyBoxMode}
              onChangeKeyBoxMode={handleUpdateKeyBoxMode}
              keyBoxColor={keyBoxColor}
              onChangeKeyBoxColor={handleUpdateKeyBoxColor}
              colors={colors}
              isDark={isDark}
              hideHeader={true}
            />
          </View>
        )}
      </View>

      {/* Parity Extra: Force Sync Data Button */}
      <View style={{ marginTop: 16, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: colors.border, marginBottom: 20 }}>
        <TouchableOpacity
          onPress={handleForceSync}
          disabled={syncing}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 10,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <RefreshCw size={14} color={colors.textSecondary} />
          )}
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary }}>
            {syncing ? 'Syncing Mains...' : 'Force Sync Data'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderFlatListHeader = () => {
    return (
      <View style={{ backgroundColor: colors.bg, zIndex: 999 }}>
        {/* Search Input Bar */}
        <View style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          paddingTop: hasSearched ? Math.max(insets.top, 12) + 44 : 10,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.border
        }}>
          <View style={{ flexDirection: 'row', gap: 8, position: 'relative', zIndex: 999, alignItems: 'center' }}>
            {/* Sidebar toggle (Tablet/iPad only) */}
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
                <SlidersHorizontal size={18} color={sidebarOpen ? colors.primary : colors.textSecondary} />
              </TouchableOpacity>
            )}

            <View style={[styles.searchBox, { height: 38, backgroundColor: colors.surface, borderColor: colors.border, flex: 1, paddingLeft: 8, paddingRight: 4, alignItems: 'center' }]}>
              {/* Compact Engine Mode Badge */}
              <TouchableOpacity
                onPress={() => setModePickerOpen(true)}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 3,
                  backgroundColor:
                    searchEngineMode === 'AI' ? '#7c3aed15' :
                    searchEngineMode === 'AI+Fuzzy' ? '#06b6d415' :
                    searchEngineMode === 'Matching' ? '#0ea5e915' : '#f59e0b15',
                  paddingHorizontal: 6,
                  paddingVertical: 3,
                  borderRadius: 8,
                  marginRight: 4,
                }}
              >
                {searchEngineMode === 'AI' && <Brain size={11} color="#7c3aed" />}
                {searchEngineMode === 'AI+Fuzzy' && <Zap size={11} color="#06b6d4" />}
                {searchEngineMode === 'Matching' && <Zap size={11} color="#0ea5e9" />}
                {searchEngineMode === 'Exact' && <Target size={11} color="#f59e0b" />}
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '800',
                    color:
                      searchEngineMode === 'AI' ? '#7c3aed' :
                      searchEngineMode === 'AI+Fuzzy' ? '#06b6d4' :
                      searchEngineMode === 'Matching' ? '#0ea5e9' : '#f59e0b',
                  }}
                >
                  {searchEngineMode === 'AI' ? 'AI' : searchEngineMode === 'AI+Fuzzy' ? 'AI+Fuzzy' : searchEngineMode === 'Matching' ? 'Fuzzy' : 'Exact'}
                </Text>
                <ChevronDown size={10} color={colors.textTertiary} />
              </TouchableOpacity>

              <TextInput
                placeholder="Search concepts across Prelims, Mains, and Value Addition..."
                placeholderTextColor={colors.textTertiary}
                value={query}
                onChangeText={setQuery}
                returnKeyType="search"
                onSubmitEditing={() => runIntegratedSearch(query, filters)}
                style={[styles.input, { color: colors.textPrimary, fontSize: 13, height: 36 }]}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); }} style={{ padding: 4 }}>
                  <X size={15} color={colors.textTertiary} />
                </TouchableOpacity>
              )}

              {/* Inline Search Icon Button */}
              <TouchableOpacity
                onPress={() => runIntegratedSearch(query, filters)}
                disabled={loading || !query.trim()}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: query.trim() ? colors.primary : (isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'),
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginLeft: 4,
                }}
              >
                {loading ? <ActivityIndicator size="small" color="#fff" /> : <Search size={14} color={query.trim() ? '#fff' : colors.textTertiary} />}
              </TouchableOpacity>
            </View>

            {!IS_IPAD && (
              <TouchableOpacity
                onPress={() => setFilterOpen(true)}
                style={[styles.mobFilterBtn, { height: 38, width: 38, backgroundColor: colors.surface, borderColor: colors.border, position: 'relative' }]}
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
          </View>

          {/* AI Keywords 1-line horizontal scroll strip (Only visible in AI or AI+Fuzzy modes) */}
          {(searchEngineMode === 'AI' || searchEngineMode === 'AI+Fuzzy') && keywords.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#7c3aed15', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10 }}>
                <Sparkles size={11} color="#7c3aed" />
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#7c3aed' }}>
                  {keywords.length - excludedKeywords.size}/{keywords.length} AI
                </Text>
              </View>

              {excludedKeywords.size > 0 && (
                <TouchableOpacity
                  onPress={() => setExcludedKeywords(new Set())}
                  style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 4, borderRadius: 10 }}
                >
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#ef4444' }}>Reset</Text>
                </TouchableOpacity>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingRight: 8 }}>
                {keywords.map((kw, i) => {
                  const isExcluded = excludedKeywords.has(kw);
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => toggleExcludedKeyword(kw)}
                      style={[
                        styles.pill,
                        {
                          backgroundColor: isExcluded ? (isDark ? '#334155' : '#f1f5f9') : '#ede9fe',
                          borderColor: isExcluded ? colors.border : '#c4b5fd',
                          opacity: isExcluded ? 0.45 : 1,
                          paddingVertical: 3,
                          paddingHorizontal: 8,
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
              </ScrollView>
            </View>
          )}
        </View>

        {/* Results Toolbar Row: 4 stage toggles + divider + sort/group segmented control */}
        {!loading && (activeResults.length > 0 || hasSearched) && (
          <View
            style={{
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              paddingVertical: 6,
            }}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
                gap: 6,
              }}
            >
              {/* 4 Stage Toggle Chips */}
              {([
                { key: 'showPrelims' as const, label: 'MCQ', isSelected: filters.showPrelims, color: '#16A34A' },
                { key: 'showMains' as const, label: 'Mains Ques.', isSelected: filters.showMains, color: '#EA580C' },
                { key: 'showToppers' as const, label: 'Topper Copy', isSelected: filters.showToppers, color: '#EA580C' },
                { key: 'showValueAdd' as const, label: 'Value Additions', isSelected: filters.showValueAdd, color: '#8B5CF6' },
              ]).map(stage => (
                <TouchableOpacity
                  key={stage.key}
                  onPress={() => toggleStage(stage.key)}
                  activeOpacity={1}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: stage.isSelected ? stage.color : colors.border,
                    backgroundColor: stage.isSelected
                      ? (isDark ? `${stage.color}25` : `${stage.color}15`)
                      : colors.surface,
                    gap: 5,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: stage.isSelected ? stage.color : colors.textTertiary,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: stage.isSelected ? '700' : '500',
                      color: stage.isSelected ? (isDark ? '#fff' : stage.color) : colors.textSecondary,
                    }}
                  >
                    {stage.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Open in Mains Question Bank button for external search */}
              {query.trim().length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    router.push({
                      pathname: '/mains',
                      params: {
                        initialScreen: 'questions',
                        search: query.trim(),
                        isExternalSearch: 'true',
                        _ts: String(Date.now()),
                      }
                    } as any);
                  }}
                  activeOpacity={0.8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#3b82f6',
                    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                    gap: 4,
                  }}
                >
                  <ExternalLink size={11} color="#3b82f6" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#3b82f6' }}>
                    Open in Question Bank
                  </Text>
                </TouchableOpacity>
              )}

              {/* Vertical Divider */}
              <View
                style={{
                  width: 1,
                  height: 18,
                  backgroundColor: colors.border,
                  marginHorizontal: 4,
                }}
              />

              {/* Sort / Group Segmented Control */}
              <View
                style={{
                  flexDirection: 'row',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                  borderRadius: 16,
                  padding: 2,
                  gap: 2,
                }}
              >
                {(['Relevance', 'Year', 'Subject', 'Concept'] as const).map(s => {
                  const isActive = s === 'Concept' ? isGroupedByConcept : (sortMode === s && !isGroupedByConcept);
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        setSortMode(s);
                        if (s === 'Concept') {
                          setGroupBy('concept');
                        } else {
                          setGroupBy('relevance');
                        }
                      }}
                      activeOpacity={1}
                      style={[
                        styles.sortBtn,
                        {
                          backgroundColor: isActive ? colors.primary : 'transparent',
                          paddingHorizontal: 9,
                          paddingVertical: 4,
                          borderRadius: 14,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sortBtnText,
                          {
                            color: isActive ? '#fff' : colors.textSecondary,
                            fontSize: 10,
                            fontWeight: isActive ? '800' : '600',
                          },
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Result Count Badge */}
              <View style={{ marginLeft: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: isDark ? '#334155' : '#e2e8f0' }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary }}>
                  {activeResults.length}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}

        {/* Concept Expand All / Collapse All Control Bar (Requirement 20) */}
        {!loading && isGroupedByConcept && allConceptKeys.length > 0 && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 6,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>
              {allConceptKeys.length} {allConceptKeys.length === 1 ? 'Concept' : 'Concepts'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={expandAllConcepts}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary }}>Expand All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={collapseAllConcepts}
                activeOpacity={0.7}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#e2e8f0',
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>Collapse All</Text>
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

        {/* Floating Back / Home Button (Requirement 8 - parity with app/mains.tsx) */}
        <TouchableOpacity
          onPress={() => {
            try {
              router.navigate('/(tabs)');
            } catch {
              router.back();
            }
          }}
          activeOpacity={0.8}
          style={[
            styles.floatingBackButton,
            {
              top: Math.max(insets.top, 12),
              backgroundColor: isDark ? 'rgba(30, 41, 59, 0.92)' : 'rgba(255, 255, 255, 0.92)',
              borderColor: colors.border,
            }
          ]}
          testID="search-floating-home-button"
        >
          <ChevronLeft size={18} color={colors.textPrimary} />
          <Text style={[styles.backButtonText, { color: colors.textPrimary }]}>Home</Text>
        </TouchableOpacity>

        {/* Header Bar */}
        {!hasSearched && (
          <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top, paddingLeft: 100 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Image
                source={require('../assets/icon.png')}
                style={{ width: 28, height: 28, borderRadius: 6 }}
                resizeMode="contain"
              />
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Dr. UPSC AI Search</Text>
            </View>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
                <View style={[styles.searchBox, { height: 42, borderRadius: 21, paddingHorizontal: 12, backgroundColor: colors.surface, borderColor: colors.border, flex: 1, alignItems: 'center' }]}>
                  {/* Compact Engine Mode Badge */}
                  <TouchableOpacity
                    onPress={() => setModePickerOpen(true)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor:
                        searchEngineMode === 'AI' ? '#7c3aed15' :
                        searchEngineMode === 'AI+Fuzzy' ? '#06b6d415' :
                        searchEngineMode === 'Matching' ? '#0ea5e915' : '#f59e0b15',
                      paddingHorizontal: 7,
                      paddingVertical: 4,
                      borderRadius: 10,
                      marginRight: 6,
                    }}
                  >
                    {searchEngineMode === 'AI' && <Brain size={12} color="#7c3aed" />}
                    {searchEngineMode === 'AI+Fuzzy' && <Zap size={12} color="#06b6d4" />}
                    {searchEngineMode === 'Matching' && <Zap size={12} color="#0ea5e9" />}
                    {searchEngineMode === 'Exact' && <Target size={12} color="#f59e0b" />}
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '800',
                        color:
                          searchEngineMode === 'AI' ? '#7c3aed' :
                          searchEngineMode === 'AI+Fuzzy' ? '#06b6d4' :
                          searchEngineMode === 'Matching' ? '#0ea5e9' : '#f59e0b',
                      }}
                    >
                      {searchEngineMode === 'AI' ? 'AI' : searchEngineMode === 'AI+Fuzzy' ? 'AI+Fuzzy' : searchEngineMode === 'Matching' ? 'Fuzzy' : 'Exact'}
                    </Text>
                    <ChevronDown size={11} color={colors.textTertiary} />
                  </TouchableOpacity>

                  <TextInput
                    placeholder="Ask a question or search key concepts..."
                    placeholderTextColor={colors.textTertiary}
                    value={query}
                    onChangeText={setQuery}
                    returnKeyType="search"
                    onSubmitEditing={() => runIntegratedSearch(query, filters)}
                    style={[styles.input, { color: colors.textPrimary, fontSize: 14 }]}
                  />
                  {query.length > 0 && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                      <X size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>

                {!IS_IPAD && (
                  <TouchableOpacity
                    onPress={() => setFilterOpen(true)}
                    style={[styles.mobFilterBtn, { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.surface, borderColor: colors.border, position: 'relative' }]}
                  >
                    <Filter size={18} color={activeFilterCount > 0 ? colors.primary : colors.textSecondary} />
                    {activeFilterCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    backgroundColor: colors.primary,
                    borderRadius: 10,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                  }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>{activeFilterCount}</Text>
                  </View>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={() => runIntegratedSearch(query, filters)}
                  disabled={loading || !query.trim()}
                  style={[styles.searchGoBtn, { height: 42, width: 42, borderRadius: 21, backgroundColor: colors.primary }]}
                >
                  {loading ? <ActivityIndicator size="small" color="#fff" /> : <Search size={18} color="#fff" />}
                </TouchableOpacity>
              </View>

              {/* Inline Recent Searches Chips */}
              {searchHistory.length > 0 && (
                <View style={{ marginTop: 18, width: '100%' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Clock size={12} color={colors.textTertiary} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, letterSpacing: 0.5 }}>
                        RECENT SEARCHES
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => {
                        setSearchHistory([]);
                        clearSearchHistory().catch(() => {});
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>Clear</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {searchHistory.slice(0, 8).map((h, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          setQuery(h);
                          runIntegratedSearch(h, filters);
                        }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: colors.surface,
                          borderWidth: 1,
                          borderColor: colors.border,
                          paddingVertical: 7,
                          paddingHorizontal: 12,
                          borderRadius: 16,
                          gap: 6,
                          maxWidth: '100%',
                        }}
                      >
                        <Clock size={11} color={colors.textTertiary} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary }} numberOfLines={1}>
                          {h}
                        </Text>
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            removeSearchItem(h)
                              .then(next => setSearchHistory(next))
                              .catch(() => {});
                          }}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <X size={11} color={colors.textTertiary} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
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
            <PinchGestureHandler
              onGestureEvent={onResultsPinchGestureEvent}
              onHandlerStateChange={onResultsPinchHandlerStateChange}
            >
              <View style={{ flex: 1 }}>
                <FlatList
                  data={loading ? [] : (displayResults as any)}
                  keyExtractor={item => item.id}
                  renderItem={renderItem}
                  contentContainerStyle={{ paddingBottom: 85 }}
                  ListHeaderComponent={renderFlatListHeader()}
                  ListEmptyComponent={renderListEmptyOrLoading()}
                  keyboardShouldPersistTaps="handled"
                  extraData={{
                    activeMainsTabs,
                    colors,
                    isDark,
                    zoomFontSize,
                    textColorMode,
                    keyBoxMode,
                    keyBoxColor,
                    expandedResultId,
                    selectedResultInstitutes,
                    groupBy,
                    collapsedConcepts,
                    isGroupedByConcept,
                  }}
                />
              </View>
            </PinchGestureHandler>
            {showResultsZoomIndicator && (
              <View style={{
                position: 'absolute',
                top: 12,
                alignSelf: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                zIndex: 9999,
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                  ZOOM: {Math.round((zoomFontSize / 16) * 100)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Floating Sidebar Toggle Button (Tablet/iPad only) */}
      {IS_IPAD && (
        <TouchableOpacity
          testID="search-toggle-sidebar"
          onPress={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute',
            bottom: 24,
            left: 20,
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: sidebarOpen ? (isDark ? '#475569' : '#64748B') : colors.primary,
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
          {sidebarOpen ? (
            <ChevronLeft size={20} color="#fff" />
          ) : (
            <SlidersHorizontal size={18} color="#fff" />
          )}
        </TouchableOpacity>
      )}

      {/* Sticky Bottom Practice Capsule for Prelims */}
      {hasSearched && !loading && prelimsCount > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: IS_IPAD ? 28 : 20,
            left: 0,
            right: 0,
            alignItems: 'center',
            zIndex: 9998,
            pointerEvents: 'box-none',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: isDark ? '#1e293b' : '#0f172a',
              paddingVertical: 8,
              paddingLeft: 16,
              paddingRight: 10,
              borderRadius: 28,
              gap: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8,
              borderWidth: 1,
              borderColor: isDark ? '#334155' : '#1e293b',
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#f8fafc' }}>
              🎯 Practice {prelimsCount} Prelims {prelimsCount === 1 ? 'MCQ' : 'MCQs'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => openBatchQuiz('learning')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 16,
                  backgroundColor: colors.primary,
                }}
              >
                <BookOpen size={13} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Learn</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openBatchQuiz('exam')}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 16,
                  backgroundColor: '#10b981',
                }}
              >
                <Play size={13} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Exam</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Engine Mode Picker Modal */}
      <Modal
        visible={modePickerOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModePickerOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setModePickerOpen(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: colors.surface, maxHeight: 460 }]} onPress={e => e.stopPropagation()}>
            <View style={[styles.bottomSheetHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary }}>Search Engine Mode</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textTertiary, marginTop: 2 }}>Select matching algorithm</Text>
              </View>
              <TouchableOpacity onPress={() => setModePickerOpen(false)}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16, gap: 10 }}>
              {[
                {
                  mode: 'AI' as const,
                  icon: <Brain size={18} color="#7c3aed" />,
                  title: 'AI Semantic Search (Default)',
                  desc: 'Uses 768-dim embeddings & Gemini AI keywords to find conceptually related questions even with different wording.',
                  activeColor: '#7c3aed',
                },
                {
                  mode: 'AI+Fuzzy' as const,
                  icon: <Zap size={18} color="#06b6d4" />,
                  title: 'AI + Fuzzy Search',
                  desc: 'Combines semantic embeddings with spelling-tolerant keyword fuzzy scoring for balanced depth.',
                  activeColor: '#06b6d4',
                },
                {
                  mode: 'Matching' as const,
                  icon: <Zap size={18} color="#0ea5e9" />,
                  title: 'Fuzzy Text Search',
                  desc: 'Traditional text search with typo tolerance across Prelims, Mains, and Value Addition Hub.',
                  activeColor: '#0ea5e9',
                },
                {
                  mode: 'Exact' as const,
                  icon: <Target size={18} color="#f59e0b" />,
                  title: 'Exact Match',
                  desc: 'Strict keyword & phrase matching across questions, syllabus topics, and model answers.',
                  activeColor: '#f59e0b',
                },
              ].map(({ mode, icon, title, desc, activeColor }) => {
                const isSelected = searchEngineMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    onPress={() => {
                      setSearchEngineMode(mode);
                      setModePickerOpen(false);
                      if (hasSearched && query.trim()) {
                        runIntegratedSearch(query, filters, mode);
                      }
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: isSelected ? activeColor : colors.border,
                      backgroundColor: isSelected ? activeColor + '10' : colors.surfaceStrong,
                    }}
                  >
                    <View style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      backgroundColor: isSelected ? activeColor + '20' : colors.surface,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}>
                      {icon}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: isSelected ? activeColor : colors.textPrimary }}>
                        {title}
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                        {desc}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: activeColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 4,
                      }}>
                        <Check size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
              <View style={{ flexShrink: 1, position: 'relative' }}>
                {showPreviewZoomIndicator && (
                  <View style={{
                    position: 'absolute',
                    top: 10,
                    right: 14,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 10,
                    zIndex: 999,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>
                      {Math.round((previewFontSize / 15) * 100)}%
                    </Text>
                  </View>
                )}
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
                      mdStyles={previewMdStyles}
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
              </View>

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
            textColorMode={textColorMode}
            keyBoxMode={keyBoxMode}
            keyBoxColor={keyBoxColor}
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
  floatingBackButton: {
    position: 'absolute',
    left: 16,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 0.5,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
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
  compactChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactChipText: {
    fontSize: 10,
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
  sidebarSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: 'transparent',
    marginVertical: 2,
  },
  sidebarSectionHeaderActive: {
    backgroundColor: 'rgba(124, 58, 237, 0.05)',
    borderColor: 'rgba(124, 58, 237, 0.12)',
  },
});
