/**
 * AI Search Tab
 * Gemini expands the user's query into keywords, then searches Supabase.
 * All filters use FLAT BOOLEAN COLUMNS on the questions table — never JSONB.
 */
import FeatureGate from '../src/components/FeatureGate';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  FlatList, Modal, Pressable, ActivityIndicator, Dimensions, Platform,
  KeyboardAvoidingView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Brain, Search, SlidersHorizontal, X, ChevronRight, ChevronLeft,
  Sparkles, Filter, Clock, ChevronUp, ChevronDown, BookOpen, Target, Zap,
  TrendingUp, BarChart2, Flame, Bold, Italic, Underline, Highlighter, Check,
} from 'lucide-react-native';
import { PinchGestureHandler, State as GHState } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useFlashcardAction } from '../src/hooks/useFlashcardAction';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { useCourse } from '../src/context/CourseContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiExpandSearchQuery, aiExplainQuestion, aiImproveAnswer, type AIInferredFilters } from '../src/services/GeminiService';
import { PageWrapper } from '../src/components/PageWrapper';
import Markdown from 'react-native-markdown-display';
import { AIModelSwitcher } from '../src/components/ai/AIModelSwitcher';
import { SharedQuestionCard } from '../src/components/unified/SharedQuestionCard';
import { getPYQCategorization, buildCanonicalExplanations } from '../src/utils/questionUtils';
import { mergeQuestions } from '../src/utils/merger';
import { QuestionCache } from '../src/services/QuestionCache';
import { OfflineManager } from '../src/services/OfflineManager';
import { buildPredictive, probableHotsFor2026, type PredictiveRow } from '../src/lib/pyqPredictive';
import { StudentSync } from '../src/services/StudentSync';
import { useQuizStore } from '../src/store/quizStore';
import { useTagStore } from '../src/store/tagStore';
import { PilotV2SaveSheet } from '../src/components/pilot-v2/PilotV2SaveSheet';
import { AddToFlashcardSheet } from '../src/components/flashcards/AddToFlashcardSheet';
import { fetchBestAnswer, type BestAnswer } from '../src/services/BestAnswerService';
import { LocalQuery } from '../src/services/LocalQuery';
import { buildMarkdownStyles, buildMarkdownRules } from '../src/utils/markdownUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IPAD = SCREEN_WIDTH >= 768;

// ── Types ────────────────────────────────────────────────────────────────────

type SearchEngineMode = 'AI' | 'Matching' | 'Exact' | 'AI+Fuzzy';

type SearchResult = {
  id: string;
  question_text: string;
  correct_answer: string;
  options?: Record<string, string>;
  explanation_markdown?: string;
  subject?: string;
  section_group?: string;
  micro_topic?: string;
  is_pyq?: boolean;
  is_ncert?: boolean;
  is_upsc_cse?: boolean;
  is_allied?: boolean;
  is_others?: boolean;
  exam_year?: number;
  exam_group?: string;
  exam_stage?: string;
  test_id?: string;
  tests?: { id?: string; institute?: string; series?: string; program_name?: string };
  // Merger outputs
  _explanations?: Array<{ source: string; program: string; text: string; year: string; answer: string }>;
  _institutes?: string[];
  _mergedIds?: string[];
  _searchTier?: number;
};

type Filters = {
  searchMode:    'Matching' | 'Exact';
  searchAcross:  string[]; // array of field keys: 'Questions' | 'Explanations' | 'Options'
  stage:         string;   // 'All' | comma-separated (Prelims, Mains, Optional)
  institutes:    string;   // 'All' | comma-separated
  programs:      string;   // 'All' | comma-separated
  pyqFilter:     string;   // 'All' | 'PYQ Only' | 'Non-PYQ'
  pyqMode:       string;   // 'All' | 'PYQ Only' | 'Non-PYQ' (arena-style)
  examCategory:  string;   // 'All' | 'UPSC' | 'Allied' | 'Others'
  ncertFilter:   string;   // 'All' | 'NCERT Only' | 'Non-NCERT'
  subjects:      string;   // 'All' | comma-separated
  sections:      string;   // 'All' | comma-separated (section_group)
  microtopics:   string;   // 'All' | comma-separated
  revisionTags:  string;   // 'All' | comma-separated
  yearRange:     string;   // '' | 'YYYY' | 'YYYY,YYYY'
};

const DEFAULT_FILTERS: Filters = {
  searchMode:   'Matching',
  searchAcross: ['Questions', 'Options'],
  stage:        'All',
  institutes:   'All',
  programs:     'All',
  pyqFilter:    'All',
  pyqMode:      'All',
  examCategory: 'All',
  ncertFilter:  'All',
  subjects:     'All',
  sections:     'All',
  microtopics:  'All',
  revisionTags: 'All',
  yearRange:    '',
};

type SortMode = 'Relevance' | 'Year' | 'Subject';

// ── Helpers ──────────────────────────────────────────────────────────────────

function countActiveFilters(f: Filters): number {
  let n = 0;
  // Default is ['Questions', 'Options'] — only count as active if different
  const defaultAcross = ['Questions', 'Options'];
  const isDefaultAcross = f.searchAcross.length === defaultAcross.length &&
    defaultAcross.every(v => f.searchAcross.includes(v));
  if (!isDefaultAcross) n++;
  if (f.stage !== 'All')              n++;
  if (f.institutes !== 'All')         n++;
  if (f.programs !== 'All')           n++;
  if (f.pyqFilter !== 'All')          n++;
  if (f.pyqMode !== 'All')            n++;
  if (f.examCategory !== 'All')       n++;
  if (f.ncertFilter !== 'All')        n++;
  if (f.subjects !== 'All')           n++;
  if (f.sections !== 'All')           n++;
  if (f.microtopics !== 'All')        n++;
  if (f.revisionTags !== 'All')       n++;
  if (f.yearRange)                    n++;
  return n;
}

/** Convert multi-select searchAcross array to DB field names */
const getSearchFields = (sa: string[]): string[] => {
  if (sa.includes('All') || sa.length === 0) return ['question_text', 'explanation_markdown', 'options'];
  const fields: string[] = [];
  if (sa.includes('Questions'))     fields.push('question_text');
  if (sa.includes('Explanations'))  fields.push('explanation_markdown');
  if (sa.includes('Options'))        fields.push('options');
  return fields.length > 0 ? fields : ['question_text'];
};

function getSubjectColor(sub: string): string {
  const map: Record<string, string> = {
    geography: '#0ea5e9', polity: '#8b5cf6', history: '#f59e0b',
    economy: '#10b981', environment: '#22c55e', science: '#06b6d4',
    art: '#f43f5e', international: '#3b82f6', agriculture: '#84cc16',
  };
  const key = (sub || '').toLowerCase();
  for (const [k, v] of Object.entries(map)) if (key.includes(k)) return v;
  return '#94a3b8';
}

// ── Keyword Highlighter helper ────────────────────────────────────────────────
// Highlights ALL keywords found in the text (not just the first 3).
// Uses per-card matching: only keywords that actually appear in this text
// get highlighted, so cards matching "Krishnadevaraya" show that word in gold.
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

// ── Contextual snippet builder ───────────────────────────────────────────────
// Searches across question_text, options, and explanation_markdown for the
// best keyword match. Priority: rawTerm in question_text > AI keywords.
// Always shows context with the matched keyword highlighted, or a fallback
// showing why this question appeared.
// Uses word-boundary matching (\b) so "rain" doesn't match inside "training".

const wholeWordRegex = (word: string): RegExp =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');

const hasWholeWord = (text: string, word: string): boolean =>
  wholeWordRegex(word).test(text);

function buildContextSnippet(
  text: string,
  keywords: string[],
  options?: Record<string, string> | null,
  explanation?: string | null,
  rawTerm?: string,
  maxContextWords: number = 12,
): React.ReactNode {
  if (!text && !options && !explanation) return null;

  // Priority 1: Try to match rawTerm (user's original query) in question_text
  if (rawTerm && rawTerm.length > 2) {
    const rawWords = rawTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    for (const word of rawWords) {
      if (hasWholeWord(text || '', word)) {
        return buildSnippetFromField(text || '', word, '', maxContextWords);
      }
    }
  }

  // Priority 2: Try AI keywords in question_text (no label)
  const textKw = keywords.find(k => k.length > 2 && hasWholeWord(text || '', k));
  if (textKw) {
    return buildSnippetFromField(text || '', textKw, '', maxContextWords);
  }

  // Priority 3: Try keywords in options
  if (options) {
    const optsText = Object.entries(options).map(([k, v]) => `${k}: ${v}`).join(' ');
    const optsKw = keywords.find(k => k.length > 2 && hasWholeWord(optsText, k));
    if (optsKw) {
      return buildSnippetFromField(optsText, optsKw, '(Options)', maxContextWords);
    }
  }

  // Priority 4: Try keywords in explanation
  if (explanation) {
    const explKw = keywords.find(k => k.length > 2 && hasWholeWord(explanation, k));
    if (explKw) {
      return buildSnippetFromField(explanation, explKw, '(Explanation)', maxContextWords);
    }
  }

  // Fallback: show first 150 chars with the first keyword name as hint
  const hint = keywords.find(k => k.length > 2) || '';
  const fallbackText = (text || '').slice(0, 150);
  if (hint) {
    return <Text>{fallbackText}{fallbackText.length >= 150 ? '...' : ''} <Text style={{ fontSize: 9, color: '#888', fontStyle: 'italic' }}>(matched keyword: {hint})</Text></Text>;
  }
  return <Text>{fallbackText}</Text>;
}

// Helper: build snippet with context around a matched keyword
function buildSnippetFromField(
  fieldText: string,
  keyword: string,
  label: string,
  maxContextWords: number,
): React.ReactNode {
  const match = fieldText.match(wholeWordRegex(keyword));
  if (!match || match.index === undefined) {
    return <Text>{fieldText.slice(0, 150)}</Text>;
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

// ── PYQ chip color by exam category ──────────────────────────────────────────
function getPYQChipStyle(pyq: ReturnType<typeof getPYQCategorization>) {
  if (!pyq.hasPYQData) return null;
  if (pyq.isUPSC)    return { bg: '#dcfce7', color: '#15803d' };
  if (pyq.isAllied)  return { bg: '#fef9c3', color: '#a16207' };
  if (pyq.isOther)   return { bg: '#f1f5f9', color: '#475569' };
  return { bg: '#ede9fe', color: '#7c3aed' }; // generic PYQ (purple)
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AISearchTab() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { selectedCourse } = useCourse();
  const store = useQuizStore();

  // Zoom states - MOVED TO TOP for mdStyles dependency
  const [previewFontSize, setPreviewFontSize] = useState(16);
  const baseFontSizeRef = useRef(16);
  const zoomTimerRef = useRef<any>(null);
  const previewScrollRef = useRef<ScrollView>(null);
  const flashcardOpLockRef = useRef(false);
  const previewQuestionIdRef = useRef<string | null>(null);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const FONT_SIZE_KEY = 'engine_font_size_v1';

  const mdStyles = React.useMemo(() => buildMarkdownStyles(
    colors.textPrimary,
    previewFontSize,
    colors.surfaceStrong,
    colors.border,
    colors.primary
  ), [colors, previewFontSize]);

  const mdRules = React.useMemo(() => buildMarkdownRules(
    colors.border,
    colors.primary,
    colors.textPrimary,
    previewFontSize
  ), [colors, previewFontSize]);

  const router = useRouter();


  const [query, setQuery]               = useState('');
  const [keywords, setKeywords]         = useState<string[]>([]);
  const [results, setResults]   = useState<SearchResult[]>([]);
  // Issue #11: Store master results for client-side filtering
  const [masterResults, setMasterResults] = useState<SearchResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [showModelSwitcher, setShowModelSwitcher] = useState(false);
  const [hasSearched, setHasSearched]   = useState(false);
  const [filters, setFilters]           = useState<Filters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode]         = useState<SortMode>('Relevance');
  const [filterOpen, setFilterOpen]     = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);

  // ── Engine mode: AI (default) | Matching (fuzzy) | Exact ─────────────────
  const [searchEngineMode, setSearchEngineMode] = useState<SearchEngineMode>('AI');

  const [subjectOptions, setSubjectOptions]     = useState<string[]>([]);
  const [sectionOptions, setSectionOptions]     = useState<string[]>([]);
  const [microtopicOptions, setMicrotopicOptions] = useState<string[]>([]);
  const [instituteOptions, setInstituteOptions] = useState<string[]>([]);
  const [programOptions, setProgramOptions] = useState<string[]>([]);

  // ISSUE FIX #12: Track all subjects from search results for sidebar
  // so filter options remain visible even after selection
  const [allSearchSubjects, setAllSearchSubjects] = useState<string[]>([]);

  // Keyword toggle: which AI-expanded keywords are excluded from client-side filter
  const [excludedKeywords, setExcludedKeywords] = useState<Set<string>>(new Set());

  // PYQ Widget — hot topics from predictive analysis
  const [pyqHotTopics, setPyqHotTopics] = useState<PredictiveRow[]>([]);

  // Fix #2 — sidebar subject filter (separate from filters.subjects)
  const [sidebarSubjectFilter, setSidebarSubjectFilter] = useState<string | null>(null);
  // Sidebar institute filter — local state for instant chip color, synced to filters.institutes
  const [sidebarInstituteFilter, setSidebarInstituteFilter] = useState<string>('All');

  // Sidebar collapse state for iPad/tablet view
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fix #4 — search history
  const HISTORY_KEY = 'ai_search_history';
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const [previewQuestion, setPreviewQuestion] = useState<SearchResult | null>(null);
  const [previewRevealed, setPreviewRevealed]  = useState(false);
  // Enriched explanations: secondary fetch for ALL merged sibling IDs
  // so we never miss an institute's answer even if it wasn't in search results
  const [enrichedExplanations, setEnrichedExplanations] = useState<any[] | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<any>(null);
  const [previewAnswer, setPreviewAnswer] = useState<string | null>(null);
  const [previewExplSource, setPreviewExplSource] = useState<string>('all');
  const [previewStudyTags, setPreviewStudyTags] = useState<string[]>([]);
  const [userTags, setUserTags] = useState<string[]>([]);

  // Subscribe to tag store so tag catalog refreshes when Full Engine adds a new tag
  const tagStoreVersion = useTagStore(s => s.version);

  // Notebook states for "Add to Notebook" parity
  const [pilotV2SaveOpen, setPilotV2SaveOpen] = useState(false);
  const [previewNotebookDraft, setPreviewNotebookDraft] = useState<string>('');
  const [pilotV2InitialBodyOverride, setPilotV2InitialBodyOverride] = useState<string>('');

  // Notes editor for preview modal
  const [previewNotes, setPreviewNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Create tag states (Issue #7 — universal "+ create tag" button)
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagText, setNewTagText] = useState('');

  // Unified Flashcard Flow
  const {
    savingFlashcard,
    flashcardedIds,
    setFlashcardedIds,
    aff,
    setAff,
    handleAddToFlashcards,
    fetchFlashcardedStatus
  } = useFlashcardAction(session?.user?.id);

  // MyVitamin sync (same source as full engine)
  const [bestAnswers, setBestAnswers] = useState<Record<string, BestAnswer | null>>({});

  // Keep preview zoom in sync with full quiz engine and persist globally
  React.useEffect(() => {
    AsyncStorage.getItem(FONT_SIZE_KEY).then((saved) => {
      if (!saved) return;
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= 12 && n <= 32) {
        setPreviewFontSize(n);
        baseFontSizeRef.current = n;
      }
    }).catch(() => {});
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem(FONT_SIZE_KEY, String(previewFontSize)).catch(() => {});
  }, [previewFontSize]);

  // Re-sync zoom on every preview open/question switch so AI Search preview
  // and full quiz engine stay aligned even if font was changed elsewhere.
  React.useEffect(() => {
    if (!previewQuestion) return;
    AsyncStorage.getItem(FONT_SIZE_KEY).then((saved) => {
      if (!saved) return;
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= 12 && n <= 32) {
        setPreviewFontSize(n);
        baseFontSizeRef.current = n;
      }
    }).catch(() => {});
  }, [previewQuestion?.id]);

  React.useEffect(() => {
    previewQuestionIdRef.current = previewQuestion?.id || null;
  }, [previewQuestion?.id]);

  React.useEffect(() => {
    if (results.length > 0) {
      fetchFlashcardedStatus(results.map(r => r.id));
    }
  }, [results]);

  const closePreviewModal = React.useCallback(() => {
    flashcardOpLockRef.current = false;
    setAiExplainLoading(false);
    setAff(prev => ({ ...prev, visible: false }));
    setPreviewQuestion(null);
    setPreviewRevealed(false);
  }, []);

  // Fetch user revision tags — same catalog-first approach as Full Quiz Engine
  React.useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    const DEFAULT_TAGS = ['Imp. Fact', 'Imp. Concept', 'Trap Question', 'Must Revise', 'Memorize'];

    const loadTags = async () => {
      const allTags = new Set<string>(DEFAULT_TAGS);

      // 1. Read persisted custom tag catalog (shared with Full Engine and Tags tab)
      try {
        const catalogKey = `review_tag_catalog_${userId}`;
        const raw = await AsyncStorage.getItem(catalogKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) parsed.forEach((t: string) => t && allTags.add(t));
        }
      } catch {}

      // 2. Also pull tags from question_states (cross-device / legacy data)
      const { data } = await supabase
        .from('question_states')
        .select('review_tags')
        .eq('user_id', userId)
        .not('review_tags', 'is', null);

      data?.forEach(row => {
        if (Array.isArray(row.review_tags)) {
          row.review_tags.forEach((t: string) => t && allTags.add(t));
        }
      });

      const list = Array.from(allTags).sort();
      setUserTags(list.length > 0 ? list : DEFAULT_TAGS);
    };

    loadTags();
  }, [session?.user?.id, tagStoreVersion]);

  // When popup opens: fetch full explanation data for every _mergedId so all
  // linked institute answers are guaranteed to appear — same as Arena pipeline
  React.useEffect(() => {
    if (!previewQuestion) {
      setEnrichedExplanations(null);
      setPreviewAnswer(null);
      setPreviewExplSource('all');
      setPreviewStudyTags([]);
      setPreviewNotes('');
      // Flashcard state handled via effect below
      setAiExplanation(null);
      setPreviewNotebookDraft('');
      return;
    }

    // Load existing notes from database
    if (session?.user?.id && previewQuestion.id) {
      supabase
        .from('question_states')
        .select('user_notes')
        .eq('user_id', session.user.id)
        .eq('question_id', previewQuestion.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.user_notes) {
            setPreviewNotes(data.user_notes);
          } else {
            setPreviewNotes('');
          }
        })
        .then(() => {})
        .catch(() => setPreviewNotes(''));
    }

    const mergedIds: string[] = (previewQuestion as any)._mergedIds || [];

    // If only one ID (or none), use what the merger already gave us.
    // IMPORTANT: do not return early — we still need to sync tags/flashcard/MyVitamin state.
    if (mergedIds.length <= 1) {
      setEnrichedExplanations(null);
    } else {
      // Fetch all sibling rows for their explanations + answers + institute data
      setEnrichLoading(true);
      supabase
        .from('questions')
        .select('id,explanation_markdown,correct_answer,test_id,tests(institute,program_name,series)')
        .in('id', mergedIds)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            setEnrichedExplanations(null);
            setEnrichLoading(false);
            return;
          }

          // Build per-institute explanation entries, deduped by source+answer+text
          const entries: Array<{ source: string; program: string; text: string; answer: string }> = [];
          for (const q of data) {
            const tests = Array.isArray(q.tests) ? q.tests[0] : q.tests;
            const rawInst = tests?.institute || '';
            const source = rawInst
              ? rawInst.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
              : 'UPSC';
            const program = tests?.program_name || '';
            const text = String(q.explanation_markdown || '').trim();
            const answer = String(q.correct_answer || '').trim();
            if (!text && !answer) continue;
            const isDup = entries.some(
              e => e.source.toLowerCase() === source.toLowerCase()
                && e.answer.toUpperCase() === answer.toUpperCase()
                && (e.text || '').slice(0, 120) === text.slice(0, 120)
            );
            if (!isDup) entries.push({ source, program, text, answer });
          }
          setEnrichedExplanations(entries.length > 0 ? entries : null);
          setEnrichLoading(false);
        })
        .catch(() => { setEnrichedExplanations(null); setEnrichLoading(false); });
    }

    // Reset AI explain state when opening a new question
    setAiExplanation(null);

    // ISSUE FIX #5: Load MyVitamin (best answer) data when preview opens
    // so it's available same as in Full Quiz Engine
    if (previewQuestion?.id) {
      ensureBestAnswerLoaded(previewQuestion.id);
    }

    // Sync flashcard state and tags with backend
    if (previewQuestion && session?.user?.id) {
      // 1. Check flashcard status (same relation-based lookup as full engine)
      supabase
        .from('user_cards')
        .select('cards!inner(question_id)')
        .eq('user_id', session.user.id)
        .in('cards.question_id', [previewQuestion.id])
        .then(({ data }) => {
          if (data && data.length > 0) {
            setFlashcardedIds(new Set([previewQuestion.id]));
          }
        })
        .catch(err => console.error("Flashcard sync check failed:", err));

      // 2. Check question state (tags, confidence, etc)
      supabase
        .from('question_states')
        .select('review_tags, selected_answer')
        .eq('user_id', session.user.id)
        .eq('question_id', previewQuestion.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPreviewStudyTags(data.review_tags || []);
            if (!previewAnswer) setPreviewAnswer(data.selected_answer);
          }
        })
        .then(() => {})
        .catch((err: any) => console.error("Tag sync check failed:", err));
    }
  }, [previewQuestion?.id, session?.user?.id]);

  const handleToggleTag = async (qid: string, currentTags: string[], tag: string) => {
    if (!session?.user?.id) return;
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];

    // Optimistic UI update
    setPreviewStudyTags(newTags);
    // Mirror into quiz store for state consistency with Full Engine
    store.setMetadata(qid, { studyTags: newTags }, false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      // Resolve test_id from all possible locations (same logic as Full Engine toggleStudyTag)
      const activeQuestion = (previewQuestion?.id === qid ? previewQuestion : results.find(r => r.id === qid)) as any;
      let resolvedTestId = activeQuestion?.test_id;
      if (!resolvedTestId && activeQuestion?.tests) {
        const testsData = Array.isArray(activeQuestion.tests) ? activeQuestion.tests[0] : activeQuestion.tests;
        resolvedTestId = testsData?.id;
      }
      if (!resolvedTestId) resolvedTestId = 'manual';

      // Persist via StudentSync — same API as Full Engine
      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: qid,
        testId: resolvedTestId,
        patch: { review_tags: newTags }
      });

      // Notify Tags tab to refresh — same as Full Engine toggleStudyTag
      useTagStore.getState().bump({ type: 'add', tag, at: Date.now() });
    } catch (err) {
      console.error("Tag Sync Error:", err);
    }
  };

  const handleCreateTagAISearch = async () => {
    if (!newTagText.trim()) return;
    if (userTags.includes(newTagText.trim())) {
      setIsAddingTag(false);
      setNewTagText('');
      return;
    }
    const createdTag = newTagText.trim();
    const updated = [...userTags, createdTag];
    setUserTags(updated);
    setIsAddingTag(false);
    setNewTagText('');

    if (session?.user?.id) {
      try {
        await supabase.rpc('add_user_tag', { p_tag: createdTag }).then(({ error }) => {
          if (error) console.warn('[tags] add_user_tag RPC failed', error.message);
        });
        const catalogKey = `review_tag_catalog_${session.user.id}`;
        const existing = await AsyncStorage.getItem(catalogKey);
        const parsed: string[] = existing ? JSON.parse(existing) : [];
        const newList = Array.from(new Set([...parsed, createdTag]));
        await AsyncStorage.setItem(catalogKey, JSON.stringify(newList));
      } catch {}
      useTagStore.getState().bump({ type: 'add', tag: createdTag, at: Date.now() });
    }
  };

  const onPinchGestureEvent = (event: any) => {
    const scale = event.nativeEvent.scale;
    let next = baseFontSizeRef.current * scale;
    next = Math.max(12, Math.min(32, next));
    setPreviewFontSize(Math.round(next));
    setShowZoomIndicator(true);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 1200);
  };

  const onPinchHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === GHState.END || event.nativeEvent.state === GHState.CANCELLED) {
      baseFontSizeRef.current = previewFontSize;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  };

  // Flashcard handler is now provided by useFlashcardAction hook

  const handleAiExplainPopup = async () => {
    if (!previewQuestion) return;

    // Match full engine behavior: switch source first so the AI container is visible immediately.
    setPreviewRevealed(true);
    setPreviewExplSource('ai');

    // Cached AI explanation → just reveal and render without re-requesting.
    if (aiExplanation) {
      requestAnimationFrame(() => previewScrollRef.current?.scrollToEnd?.({ animated: true }));
      return;
    }

    setAiExplainLoading(true);
    try {
      const rawOptions = (previewQuestion as any).options || {};
      const optionsMap: Record<string, string> = {
        A: rawOptions.a || rawOptions.A || '',
        B: rawOptions.b || rawOptions.B || '',
        C: rawOptions.c || rawOptions.C || '',
        D: rawOptions.d || rawOptions.D || '',
      };

      const explanations = buildCanonicalExplanations(previewQuestion);
      const result = await aiExplainQuestion(
        previewQuestion.question_text || (previewQuestion as any).statement || '',
        optionsMap,
        previewQuestion.correct_answer || '',
        explanations.map((e: any) => ({
          source: e.source,
          program: e.program,
          text: e.text,
          answer: e.answer,
        }))
      );

      setAiExplanation(result);
      requestAnimationFrame(() => previewScrollRef.current?.scrollToEnd?.({ animated: true }));
    } catch (e: any) {
      const msg: string = e?.message || 'Unknown error';
      if (msg.includes('404')) Alert.alert('Model not found', 'Switch model in Settings.');
      else if (msg.includes('429')) Alert.alert('Quota exceeded', 'Try another key or provider.');
      else Alert.alert('AI Error', msg);
      setPreviewExplSource('all');
    } finally {
      setAiExplainLoading(false);
    }
  };

  const ensureBestAnswerLoaded = (qid: string) => {
    if (!qid || qid in bestAnswers) return;
    fetchBestAnswer(qid).then((row) => {
      setBestAnswers(prev => ({ ...prev, [qid]: row }));
      if (row && previewQuestion?.id === qid) {
        setPreviewExplSource(prev => (prev === 'all' ? 'vitamin' : prev));
      }
    });
  };

  // Fix #6 — collapsible keywords panel
  const [keywordsExpanded, setKeywordsExpanded] = useState(false);

  // AI Smart Filters — inferred from query intent
  const [aiInferredFilters, setAiInferredFilters] = useState<AIInferredFilters>({});

  const inputRef = useRef<TextInput>(null);

  // ── Fetch filter option lists ─────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: subData } = await supabase
        .from('questions').select('subject').eq('course', selectedCourse).not('subject', 'is', null).limit(1000);
      if (subData) {
        const unique = [...new Set(subData.map((r: any) => r.subject).filter(Boolean))].sort() as string[];
        setSubjectOptions(unique);
      }
      const { data: instData } = await supabase
        .from('tests').select('institute').eq('course', selectedCourse).not('institute', 'is', null).limit(300);
      if (instData) {
        const unique = [...new Set(instData.map((r: any) => r.institute).filter(Boolean))].sort() as string[];
        setInstituteOptions(unique);
      }
      const { data: progData } = await supabase
        .from('tests').select('program_name').eq('course', selectedCourse).not('program_name', 'is', null).limit(300);
      if (progData) {
        const unique = [...new Set(progData.map((r: any) => r.program_name).filter(Boolean))].sort() as string[];
        setProgramOptions(unique);
      }
      const raw = await AsyncStorage.getItem('ai_search_history');
      if (raw) setSearchHistory(JSON.parse(raw));

      // PYQ hot topics — fetch last 6 years of PYQs and run predictive analysis
      const { data: pyqData } = await supabase
        .from('questions')
        .select('subject, section_group, micro_topic, exam_year, is_pyq')
        .eq('course', selectedCourse)
        .eq('is_pyq', true)
        .not('exam_year', 'is', null)
        .gte('exam_year', new Date().getFullYear() - 6)
        .limit(3000);
      if (pyqData && pyqData.length > 0) {
        const predictive = buildPredictive(pyqData, (q) => q.exam_year ?? null, { level: 'micro_topic' });
        const hots = probableHotsFor2026(predictive, 2, 8);
        setPyqHotTopics(hots);
      }
    })();
  }, [selectedCourse]);

  // ── Load sections when subject changes ────────────────────────────────────
  useEffect(() => {
    const subs = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split(',').filter(Boolean) : [];
    if (subs.length === 0) { setSectionOptions([]); setMicrotopicOptions([]); return; }
    supabase.from('questions').select('section_group, micro_topic').eq('course', selectedCourse).in('subject', subs).limit(2000).then(({ data }) => {
      if (!data) return;
      const secs = [...new Set(data.map((r: any) => r.section_group).filter(Boolean))].sort() as string[];
      setSectionOptions(secs);
    });
  }, [pendingFilters.subjects, selectedCourse]);

  // ── Load microtopics when section changes ─────────────────────────────────
  useEffect(() => {
    const subs = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split(',').filter(Boolean) : [];
    const secs = pendingFilters.sections !== 'All' ? pendingFilters.sections.split(',').filter(Boolean) : [];
    if (subs.length === 0 || secs.length === 0) { setMicrotopicOptions([]); return; }
    supabase.from('questions').select('micro_topic').eq('course', selectedCourse).in('subject', subs).in('section_group', secs).not('micro_topic', 'is', null).limit(2000).then(({ data }) => {
      if (!data) return;
      const mts = [...new Set(data.map((r: any) => r.micro_topic).filter(Boolean))].sort() as string[];
      setMicrotopicOptions(mts);
    });
  }, [pendingFilters.subjects, pendingFilters.sections, selectedCourse]);

  // Sync sidebar institute filter when filters.institutes changes from popup
  useEffect(() => {
    setSidebarInstituteFilter(filters.institutes);
  }, [filters.institutes]);

  // ── Offline-first: search ALL 20k locally-downloaded questions ──────────────
  // Synchronous, instant, no limit. Then Supabase supplements new questions.
  const searchOfflineSync = React.useCallback((searchTerms: string[], af: Filters, fields: string[]): any[] => {
    // Get all 20k offline questions from MMKV (synchronous, ~0.2ms)
    const allQuestions = OfflineManager.getOfflineQuestionsEnrichedSync() ?? [];
    if (allQuestions.length === 0) return [];

    // Filter by selected course first
    let results = allQuestions.filter((q: any) => q.course === selectedCourse);

    // Filter: any question matching ANY search term in ANY selected field (OR expansion)
    const termSet = new Set(searchTerms.map(t => t.toLowerCase()));
    results = results.filter((q: any) => {
      // For each question, check if ANY search term appears in ANY selected field
      for (const field of fields) {
        const text = String(q[field] ?? '').toLowerCase();
        for (const term of termSet) {
          if (text.includes(term)) return true;
        }
      }
      return false;
    });

    // Apply hard filters locally (same logic as applyFilters for Supabase)
    if (af.pyqFilter === 'PYQ Only')  results = results.filter((r: any) => r.is_pyq);
    else if (af.pyqFilter === 'Non-PYQ') results = results.filter((r: any) => !r.is_pyq);

    if (af.subjects !== 'All') {
      const subs = af.subjects.split(',').filter(Boolean);
      if (subs.length > 0) results = results.filter((r: any) => subs.includes(r.subject));
    }
    if (af.sections !== 'All') {
      const secs = af.sections.split(',').filter(Boolean);
      if (secs.length > 0) results = results.filter((r: any) => secs.includes(r.section_group));
    }
    if (af.microtopics !== 'All') {
      const mts = af.microtopics.split(',').filter(Boolean);
      if (mts.length > 0) results = results.filter((r: any) => mts.includes(r.micro_topic));
    }

    // 🐛 FIX: NCERT filter — normalize is_ncert (can be boolean, number 0/1, or string 'true'/'false')
    const isNcert = (v: any) => {
      if (v === true || v === 1) return true;
      if (typeof v === 'string') return ['true','1','yes'].includes(v.trim().toLowerCase());
      return false;
    };
    if (af.ncertFilter === 'NCERT Only') {
      results = results.filter((r: any) => isNcert(r.is_ncert));
    } else if (af.ncertFilter === 'Non-NCERT') {
      results = results.filter((r: any) => !isNcert(r.is_ncert));
    }

    if (af.examCategory === 'UPSC')   results = results.filter((r: any) => r.is_upsc_cse);
    else if (af.examCategory === 'Allied') results = results.filter((r: any) => r.is_allied);
    else if (af.examCategory === 'Others') results = results.filter((r: any) => r.is_others);

    // Year range
    const yearStr = af.yearRange || null;
    if (yearStr) {
      const years = yearStr.includes(',') ? yearStr.split(',').map(Number) : [parseInt(yearStr, 10)];
      results = results.filter((r: any) => years.includes(r.exam_year));
    }

    // Apply program filter
    if (af.programs !== 'All') {
      const progList = af.programs.split(',').filter(Boolean);
      if (progList.length > 0) {
        results = results.filter((r: any) => {
          const tests = Array.isArray(r?.tests) ? r.tests[0] : r?.tests;
          const prog = tests?.program_name || r?.program_name || '';
          return progList.includes(prog);
        });
      }
    }

    // Apply institute filter
    if (af.institutes !== 'All') {
      const instList = af.institutes.split(',').filter(Boolean);
      if (instList.length > 0) {
        results = results.filter((r: any) => {
          const tests = Array.isArray(r?.tests) ? r.tests[0] : r?.tests;
          const inst = tests?.institute || r?.provider || r?.source?.institute || '';
          return instList.includes(inst);
        });
      }
    }

    return results;
  }, [selectedCourse]);

  // ── Core search — handles AI / Matching / Exact modes ──────────────────────

  const runSearch = useCallback(async (q: string, activeFilters: Filters, engineMode?: SearchEngineMode) => {
    if (!q.trim()) return;
    const mode = engineMode ?? searchEngineMode;
    // Only reset sidebar subject filter on a NEW text query
    if (q.trim() !== query.trim()) setSidebarSubjectFilter(null);
    setAiInferredFilters({});
    // Save to history
    const trimmed = q.trim();
    setSearchHistory(prev => {
      const deduped = [trimmed, ...prev.filter(h => h !== trimmed)].slice(0, 10);
      AsyncStorage.setItem('ai_search_history', JSON.stringify(deduped));
      return deduped;
    });
    setShowHistory(false);
    setKeywordsExpanded(false);
    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      // ── Helper: apply common hard filters to a DB query ───────────────────
      const applyFilters = async (dbQuery: any, af: Filters, yearOverride?: string | null): Promise<any> => {
        let q2 = dbQuery.eq('course', selectedCourse);
        // PYQ
        if (af.pyqFilter === 'PYQ Only')  q2 = q2.eq('is_pyq', true);
        else if (af.pyqFilter === 'Non-PYQ') q2 = q2.eq('is_pyq', false);
        // Exam category
        if (af.examCategory === 'UPSC')    q2 = q2.eq('is_upsc_cse', true);
        else if (af.examCategory === 'Allied') q2 = q2.eq('is_allied', true);
        else if (af.examCategory === 'Others') q2 = q2.eq('is_others', true);
        // NCERT
        if (af.ncertFilter === 'NCERT Only') q2 = q2.eq('is_ncert', true);
        else if (af.ncertFilter === 'Non-NCERT') q2 = q2.or('is_ncert.is.null,is_ncert.eq.false');
        // Subject hierarchy
        if (af.subjects !== 'All') {
          const subs = af.subjects.split(',').filter(Boolean);
          if (subs.length > 0) q2 = q2.in('subject', subs);
        }
        if (af.sections !== 'All') {
          const secs = af.sections.split(',').filter(Boolean);
          if (secs.length > 0) q2 = q2.in('section_group', secs);
        }
        if (af.microtopics !== 'All') {
          const mts = af.microtopics.split(',').filter(Boolean);
          if (mts.length > 0) q2 = q2.in('micro_topic', mts);
        }
        if (af.revisionTags !== 'All' && session?.user?.id) {
          const tags = af.revisionTags.split(',').filter(Boolean);
          if (tags.length > 0) {
            const orQuery = tags.map(tag => `review_tags.cs.["${tag.replace(/"/g, '\\"')}"]`).join(',');
            const { data: taggedRows } = await supabase
              .from('question_states')
              .select('question_id')
              .eq('user_id', session.user.id)
              .or(orQuery);
            const taggedIds = Array.from(new Set((taggedRows || []).map((row: any) => row.question_id).filter(Boolean)));
            q2 = taggedIds.length > 0 ? q2.in('id', taggedIds) : q2.in('id', ['__no_tag_matches__']);
          }
        }
        // Year range (manual or AI-inferred)
        const yearStr = yearOverride ?? (af.yearRange || null);
        if (yearStr) {
          if (yearStr.includes(',')) q2 = q2.in('exam_year', yearStr.split(',').map(Number));
          else q2 = q2.eq('exam_year', parseInt(yearStr, 10));
        }
        // Stage + institutes + programs (joint subquery on tests)
        const stageActive = af.stage && af.stage !== 'All';
        const instList = af.institutes !== 'All' ? af.institutes.split(',').filter(Boolean) : [];
        const progList = af.programs !== 'All' ? af.programs.split(',').filter(Boolean) : [];
        if (stageActive || instList.length > 0 || progList.length > 0) {
          let testsQ = supabase.from('tests').select('id').eq('course', selectedCourse);
          if (stageActive) {
            const stageList = af.stage.split(',').filter(Boolean);
            if (stageList.length === 1) testsQ = testsQ.ilike('series', `%${af.stage}%`);
            else if (stageList.length > 1) testsQ = testsQ.in('series', stageList);
          }
          if (instList.length > 0) testsQ = testsQ.in('institute', instList);
          if (progList.length > 0) testsQ = testsQ.in('program_name', progList);
          const { data: testRows } = await testsQ;
          const testIds = (testRows || []).map((t: any) => t.id);
          q2 = testIds.length > 0 ? q2.in('test_id', testIds) : q2.in('test_id', ['__NO_MATCH__']);
        }
        return q2;
      };

      const BASE_SELECT = `id,question_text,correct_answer,options,explanation_markdown,
        subject,section_group,micro_topic,
        is_pyq,is_ncert,is_upsc_cse,is_upsc_cms,is_neetpg,is_inicet,is_allied,is_others,exam_year,exam_group,exam_stage,
        test_id,tests(institute,series,program_name)`;

      // ─────────────────────────────────────────────────────────────────────
      // EXACT MODE: offline-first + Supabase supplement
      // ─────────────────────────────────────────────────────────────────────
      if (mode === 'Exact') {
        const term = q.trim();
        setKeywords([term]);
        const fields = getSearchFields(activeFilters.searchAcross);

        // STEP 1: Search 20k MMKV questions synchronously (instant, no limit)
        const localResults = searchOfflineSync([term], activeFilters, fields);
        setMasterResults(localResults as SearchResult[]);

        // STEP 2: Set immediate results (no network wait)
        const { mergedQs: localMerged } = mergeQuestions(localResults as any);
        if (!sidebarSubjectFilter) {
          const uniqueSubjects = [...new Set(localMerged.map((r: any) => r.subject).filter(Boolean))];
          setAllSearchSubjects(uniqueSubjects as string[]);
        }
        setResults(localMerged as SearchResult[]);

        // STEP 3: Fire Supabase in background for any NEW questions (unlimited)
        (async () => {
          try {
            // Search in ALL selected fields
            let orConditions: string[] = [];
            for (const f of fields) orConditions.push(`${f}.ilike.%${term}%`);
            let dbQ = supabase.from('questions').select(BASE_SELECT)
              .or(orConditions.join(',')).limit(500);
            dbQ = await applyFilters(dbQ, activeFilters);
            const { data } = await dbQ;
            if (!data || data.length === 0) return;
            const localIds = new Set(localResults.map((r: any) => r.id));
            const fresh = (data as any[]).filter((r: any) => !localIds.has(r.id));
            if (fresh.length === 0) return;
            const all = [...localResults, ...fresh];
            const { mergedQs } = mergeQuestions(all as any);
            setMasterResults(all as SearchResult[]);
            if (!sidebarSubjectFilter) {
              const uniqueSubjects = [...new Set(mergedQs.map((r: any) => r.subject).filter(Boolean))];
              setAllSearchSubjects(uniqueSubjects as string[]);
            }
            setResults(mergedQs as SearchResult[]);
          } catch (e) { /* background supplement failure is non-critical */ }
        })();
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // MATCHING MODE: offline-first + Supabase supplement
      // ─────────────────────────────────────────────────────────────────────
      if (mode === 'Matching') {
        setKeywords([q.trim()]);
        const term = q.trim();
        const fields = getSearchFields(activeFilters.searchAcross);

        // STEP 1: Search 20k MMKV questions synchronously (instant, no limit)
        const localResults = searchOfflineSync([term], activeFilters, fields);

        // Also do original QuestionCache.searchLocal for cache users without full offline download
        let cachedResults = localResults;
        try {
          const cacheMode = 'Matching';
          const cacheFields = activeFilters.searchAcross;
          cachedResults = await QuestionCache.searchLocal(term, cacheMode, cacheFields) as any[];
          // Merge MMKV + QuestionCache, dedup by ID
          const mmkvIds = new Set(localResults.map((r: any) => r.id));
          for (const r of cachedResults) { if (!mmkvIds.has(r.id)) localResults.push(r); }
        } catch {}

        // Apply revision tag filter (needs Supabase question_states query)
        let finalLocal = [...localResults];
        const revTagList = activeFilters.revisionTags !== 'All' ? activeFilters.revisionTags.split(',').filter(Boolean) : [];
        if (revTagList.length && session?.user?.id) {
          const orQuery = revTagList.map(tag => `review_tags.cs.["${tag.replace(/"/g, '\\"')}"]`).join(',');
          const { data: taggedRows } = await supabase
            .from('question_states')
            .select('question_id')
            .eq('user_id', session.user.id)
            .or(orQuery);
          const taggedIds = new Set((taggedRows || []).map((row: any) => row.question_id));
          finalLocal = finalLocal.filter((r: any) => taggedIds.has(r.id));
        }

        setMasterResults(finalLocal as SearchResult[]);
        const { mergedQs: localMerged } = mergeQuestions(finalLocal as any);
        if (!sidebarSubjectFilter) {
          const uniqueSubjects = [...new Set(localMerged.map((r: any) => r.subject).filter(Boolean))];
          setAllSearchSubjects(uniqueSubjects as string[]);
        }
        setResults(localMerged as SearchResult[]);

        // STEP 2: Fire Supabase in background for supplement (fuzzy patterns)
        (async () => {
          try {
            let conditions: string[] = [];
            const searchAcrossFields = getSearchFields(activeFilters.searchAcross);
            // For each selected field, build ilike conditions
            for (const f of searchAcrossFields) {
              conditions.push(`${f}.ilike.%${term}%`);
              if (term.length > 3 && term.length < 20) {
                for (let i = 0; i < term.length; i++) {
                  const pattern = term.slice(0, i) + term.slice(i + 1);
                  conditions.push(`${f}.ilike.% ${pattern} %`);
                  conditions.push(`${f}.ilike.${pattern},%`);
                  conditions.push(`${f}.ilike.% ${pattern},%`);
                }
                for (let i = 0; i < term.length; i++) {
                  const vowelSwaps = ['a', 'e', 'i', 'o', 'u'];
                  for (const swap of vowelSwaps) {
                    if (swap !== term[i]) {
                      const pattern = term.slice(0, i) + swap + term.slice(i + 1);
                      conditions.push(`${f}.ilike.% ${pattern} %`);
                    }
                  }
                }
              }
            }
            let dbQ = supabase.from('questions').select(BASE_SELECT)
              .or(conditions.slice(0, 10).join(','))
              .limit(500);
            dbQ = await applyFilters(dbQ, activeFilters);
            const { data: remote } = await dbQ;
            if (!remote || remote.length === 0) return;
            const localIds = new Set(finalLocal.map((r: any) => r.id));
            const fresh = remote.filter((r: any) => !localIds.has(r.id));
            if (fresh.length === 0) return;
            const all = [...finalLocal, ...fresh];
            const { mergedQs } = mergeQuestions(all as any);
            setMasterResults(all as SearchResult[]);
            setResults(mergedQs as SearchResult[]);
          } catch (e) { /* background supplement non-critical */ }
        })();
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // AI + FUZZY MODE: Combines both AI semantic search + fuzzy matching
      // Runs both AI and Matching modes, merges results with dedup
      // ─────────────────────────────────────────────────────────────────────
      // AI+FUZZY MODE: offline-first — MMKV + AI keywords + Supabase supplement
      // ─────────────────────────────────────────────────────────────────────
      if (mode === 'AI+Fuzzy') {
        setKeywords([q.trim()]);
        const rawTerm = q.trim();
        const fields = getSearchFields(activeFilters.searchAcross);
        const userWords = rawTerm.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

        // STEP 1: Get AI keywords (Gemini)
        const aiResult = await aiExpandSearchQuery(rawTerm);
        const displayKeywords = aiResult.keywords;
        setKeywords(displayKeywords.length > 0 ? displayKeywords : [rawTerm]);

        // AI should ONLY expand keywords — never override user's active filters
        const mergedFilters: Filters = { ...activeFilters };
        // Only AI-inferred specificYear is accepted since it acts as a fine-grained search hint
        const aiYear = aiResult.filters.specificYear || null;
        // Show AI-inferred filters as labels only (for user awareness) but don't apply them
        setAiInferredFilters(aiResult.filters);

        // Build ALL search terms: original query + user words + AI keywords
        const allSearchTerms: string[] = [rawTerm];
        for (const w of userWords) allSearchTerms.push(w);
        for (const kw of displayKeywords) allSearchTerms.push(kw);
        const uniqueTerms = [...new Set(allSearchTerms)];

        // STEP 2: Search 20k MMKV questions synchronously with ALL terms (instant, no limit)
        const localResults = searchOfflineSync(uniqueTerms, mergedFilters, fields);
        setMasterResults(localResults as SearchResult[]);

        const { mergedQs: localMerged } = mergeQuestions(localResults as any);
        if (!sidebarSubjectFilter) {
          const uniqueSubjects = [...new Set(localMerged.map((r: any) => r.subject).filter(Boolean))];
          setAllSearchSubjects(uniqueSubjects as string[]);
        }
        setResults(localMerged as SearchResult[]);
        if (displayKeywords.length === 0) return;

        // STEP 3: Fire Supabase supplement in background (new questions only)
        (async () => {
          try {
            const seenIds = new Set<string>();
            const priorityResults: SearchResult[] = [];
            const addBatch = (rows: SearchResult[]) => {
              for (const r of rows) { if (!seenIds.has(r.id)) { seenIds.add(r.id); priorityResults.push(r); } }
            };
            // First add all local results
            for (const r of localResults) addBatch(r as any);

            // Tier 0: exact phrase from Supabase (search in ALL selected fields)
            let orConditions: string[] = [];
            for (const f of fields) orConditions.push(`${f}.ilike.%${rawTerm}%`);
            let dbQ = supabase.from('questions').select(BASE_SELECT)
              .or(orConditions.join(',')).limit(500);
            dbQ = await applyFilters(dbQ, mergedFilters, aiResult.filters.specificYear || null);
            const { data: tier0 } = await dbQ;
            if (tier0) addBatch(tier0 as unknown as SearchResult[]);

            // Tier 1: ALL terms as big OR chunks
            const searchSqlTerms: string[] = [];
            for (const f of fields) {
              for (const w of userWords) searchSqlTerms.push(`${f}.ilike.%${w}%`);
              for (const kw of displayKeywords) searchSqlTerms.push(`${f}.ilike.%${kw}%`);
            }
            const sqlUniq = [...new Set(searchSqlTerms)];
            for (let i = 0; i < sqlUniq.length; i += 10) {
              const chunk = sqlUniq.slice(i, i + 10);
              let qB = supabase.from('questions').select(BASE_SELECT).or(chunk.join(',')).limit(500);
              qB = await applyFilters(qB, mergedFilters, aiResult.filters.specificYear || null);
              const { data } = await qB;
              if (data) addBatch(data as unknown as SearchResult[]);
            }
            const { mergedQs } = mergeQuestions(priorityResults as any);
            setMasterResults(priorityResults as SearchResult[]);
            setResults(mergedQs as SearchResult[]);
          } catch (e) { /* supplement non-critical */ }
        })();
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // AI MODE: offline-first — MMKV + AI keywords + Supabase supplement
      // ─────────────────────────────────────────────────────────────────────
      const aiResult = await aiExpandSearchQuery(q.trim());
      const displayKeywords = aiResult.keywords;
      const rawTerm = q.trim();

      // AI should ONLY expand keywords — never override user's active filters
      const mergedFilters: Filters = { ...activeFilters };
      const aiYear = aiResult.filters.specificYear || null;
      // Show AI-inferred filters as labels only (for user awareness) but don't apply them
      setAiInferredFilters(aiResult.filters);

      setKeywords(displayKeywords.length > 0 ? displayKeywords : [rawTerm]);
      if (displayKeywords.length === 0) { setLoading(false); return; }

      const fields = getSearchFields(mergedFilters.searchAcross);
      const userWords = rawTerm.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

      // Build ALL search terms: original query + user words + AI keywords
      const allSearchTerms: string[] = [rawTerm];
      for (const w of userWords) allSearchTerms.push(w);
      for (const kw of displayKeywords) allSearchTerms.push(kw);
      const uniqueTerms = [...new Set(allSearchTerms)];

      // STEP 1: Search 20k MMKV questions synchronously with ALL terms (instant, no limit)
      const localResults = searchOfflineSync(uniqueTerms, mergedFilters, fields);
      setMasterResults(localResults as SearchResult[]);

      // Compute tiers for sorting
      const rawTermLower = rawTerm.toLowerCase();
      const getSearchTier = (r: any): number => {
        const searchText = ((r.question_text || '') + ' ' + (r.explanation_markdown || ''));
        // Word-boundary matching — "rain" won't match inside "training"
        if (rawTermLower.length > 2 && hasWholeWord(searchText, rawTermLower)) return 0;
        if (userWords.length > 1 && userWords.every(w => hasWholeWord(searchText, w))) return 1;
        const matchCount = userWords.filter(w => hasWholeWord(searchText, w)).length;
        if (userWords.length > 0 && matchCount >= Math.ceil(userWords.length / 2)) return 2;
        if (displayKeywords.some(k => k.length > 2 && hasWholeWord(searchText, k))) return 3;
        return 4;
      };
      const stamped = localResults.map((r: any) => ({ ...r, _searchTier: getSearchTier(r) }));
      const { mergedQs: localMerged } = mergeQuestions(stamped as any);

      if (!sidebarSubjectFilter) {
        const uniqueSubjects = [...new Set(localMerged.map((r: any) => r.subject).filter(Boolean))];
        setAllSearchSubjects(uniqueSubjects as string[]);
      }
      setResults(localMerged as SearchResult[]);

      // STEP 2: Fire Supabase supplement in background (new questions only)
      (async () => {
        try {
          const seenIds = new Set<string>();
          const priorityResults: SearchResult[] = [];
          const addBatch = (rows: SearchResult[]) => {
            for (const r of rows) { if (!seenIds.has(r.id)) { seenIds.add(r.id); priorityResults.push(r); } }
          };
          // Add all local results first
          for (const r of localResults) addBatch(r as any);

          // Tier 0: exact phrase from Supabase (search in ALL selected fields)
          let orConditions: string[] = [];
          for (const f of fields) orConditions.push(`${f}.ilike.%${rawTerm}%`);
          let dbQ = supabase.from('questions').select(BASE_SELECT)
            .or(orConditions.join(',')).limit(500);
          dbQ = await applyFilters(dbQ, mergedFilters, aiYear);
          const { data: tier0 } = await dbQ;
          if (tier0) addBatch(tier0 as unknown as SearchResult[]);

          // Tier 1: ALL terms as big OR chunks
          const searchSqlTerms: string[] = [];
          for (const f of fields) {
            for (const w of userWords) searchSqlTerms.push(`${f}.ilike.%${w}%`);
            for (const kw of displayKeywords) searchSqlTerms.push(`${f}.ilike.%${kw}%`);
          }
          const sqlUniq = [...new Set(searchSqlTerms)];
          for (let i = 0; i < sqlUniq.length; i += 10) {
            const chunk = sqlUniq.slice(i, i + 10);
            let qB = supabase.from('questions').select(BASE_SELECT).or(chunk.join(',')).limit(500);
            qB = await applyFilters(qB, mergedFilters, aiYear);
            const { data } = await qB;
            if (data) addBatch(data as unknown as SearchResult[]);
          }
          const { mergedQs } = mergeQuestions(priorityResults as any);
          const stamped2 = mergedQs.map((r: any) => ({ ...r, _searchTier: getSearchTier(r) }));
          setMasterResults(priorityResults as SearchResult[]);
          setResults(stamped2 as SearchResult[]);
        } catch (e) { /* supplement non-critical */ }
      })();
    } catch (e: any) {
      const msg: string = e?.message || 'Unknown error';
      if (msg.includes('No Gemini API key found') || msg.includes('No Groq API key found') || msg.includes('No DeepSeek API key found')) {
        Alert.alert('AI key needed', 'Go to Settings → AI Settings and paste your key, or switch to Matching mode.');
      } else if (msg.includes('429')) {
        Alert.alert('Quota exceeded', 'This key hit its limit. Switch to another key or use Matching mode.');
      } else if (msg.includes('404')) {
        Alert.alert('Model not found', 'Go to Settings → AI Settings and switch model.');
      } else {
        Alert.alert('Search failed', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [searchEngineMode, query]);

  // ── Sorted results (Exact match first, then semantic) ───────────────────
  //
  // Results are split into two clean groups:
  //
  //   GROUP 1 (Top) — Questions where question_text contains the user's
  //   exact search term. Sub-sorted: PYQ first (by year ↓), then non-PYQ.
  //
  //   GROUP 2 (Below) — Semantic/keyword-matched questions only.
  //   Sub-sorted: PYQ first (by year ↓), then non-PYQ.
  //
  // This ensures the exact word the user typed always appears first,
  // regardless of AI-expanded keywords ranking higher by PYQ status.
  const sortedResults = React.useMemo(() => {
    if (sortMode === 'Year') {
      return [...results].sort((a, b) => (b.exam_year || 0) - (a.exam_year || 0));
    }
    if (sortMode === 'Subject') {
      return [...results].sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
    }
    
    const rawTermLower = query.trim().toLowerCase().split(/\s+/)[0] || '';
    
    // Check if question_text contains the user's exact search word (whole-word match)
    const isExactMatch = (r: SearchResult): boolean => {
      if (!rawTermLower || rawTermLower.length < 2) return false;
      return hasWholeWord(r.question_text || '', rawTermLower);
    };
    
    // PYQ relevance (lower = more relevant)
    const pyqTier = (r: SearchResult): number => {
      if (r.is_pyq && r.is_upsc_cse) return 0;
      if (r.is_pyq && r.is_allied)   return 1;
      if (r.is_pyq && r.is_others)   return 2;
      if (r.is_pyq)                  return 3;
      return 4;
    };
    
    // Within-group sorter: PYQ first by year, then non-PYQ by year
    const withinGroupSorter = (a: SearchResult, b: SearchResult): number => {
      const ptd = pyqTier(a) - pyqTier(b);
      if (ptd !== 0) return ptd;
      return (b.exam_year || 0) - (a.exam_year || 0);
    };
    
    const exactMatches = results.filter(isExactMatch).sort(withinGroupSorter);
    
    // Filter semantic matches: only show questions where at least ONE keyword
    // appears as a whole word in question_text, options, or explanation.
    const semanticMatches = results
      .filter(r => !isExactMatch(r))
      .filter(r => {
        // Build full searchable text from all fields
        const optsText = r.options ? Object.values(r.options).join(' ') : '';
        const searchText = ((r.question_text || '') + ' ' + optsText + ' ' + (r.explanation_markdown || ''));
        if (rawTermLower.length > 2 && hasWholeWord(searchText, rawTermLower)) return true;
        return [...new Set(keywords)].some(k => k.length > 2 && hasWholeWord(searchText, k));
      })
      .sort(withinGroupSorter);
    
    return [...exactMatches, ...semanticMatches];
  }, [results, sortMode, query, keywords]);

  // ── Filter popup ──────────────────────────────────────────────────────────

  const openFilterPopup = () => {
    setPendingFilters({ ...filters });
    setFilterOpen(true);
  };

  const applyFilters = () => {
    // FIX #1: Sync pyqMode → pyqFilter (popup uses pyqMode, but applyFilters helper reads pyqFilter)
    // Also ensure examCategory is cleared when PYQ mode is not PYQ Only (stale state leak fix)
    const examCatSafe = pendingFilters.pyqMode !== 'PYQ Only' ? 'All' : pendingFilters.examCategory;
    const syncedFilters = { ...pendingFilters, pyqFilter: pendingFilters.pyqMode, examCategory: examCatSafe };
    setFilters(syncedFilters);
    setFilterOpen(false);
    if (hasSearched && query.trim()) runSearch(query, syncedFilters);
  };

  const activeFilterCount = countActiveFilters(filters);

  // ── Navigate to question ──────────────────────────────────────────────────

  // Fix #1 — pass resultIds so engine loads ONLY these questions (fast path)
  const openQuestion = (item: SearchResult, openInQuizMode?: 'learning' | 'exam') => {
    const resultIdList = sortedResults.map(r => r.id).join(',');
    router.push({
      pathname: '/unified/engine',
      params: {
        resultIds: resultIdList,
        questionId: item.id,
        mode: openInQuizMode || 'learning',
        sourceLabel: 'AI Search',
      },
    } as any);
  };

  // ── Result card ───────────────────────────────────────────────────────────

  const renderResultCard = ({ item, index }: { item: SearchResult & { _searchTier?: number }; index: number }) => {
    const searchTier = (item as any)._searchTier ?? 3;
    const subColor = getSubjectColor(item.subject || '');
    const isFeatured = index === 0;
    // ISSUE FIX #10: Pass complete exam_info including exam_group/exam_name
    // so chips display specific exam names instead of generic categories
    const synthExamInfo = {
      is_upsc_cse:  item.is_upsc_cse,
      is_allied:    item.is_allied,
      is_others:    item.is_others,
      group:        item.exam_group,
      exam_name:    item.exam_group,
      year:         item.exam_year,
    };
    const pyq = getPYQCategorization({
      ...item,
      exam_info: synthExamInfo,
    });
    const pyqLabel = pyq.hasPYQData
      ? `${pyq.groupName} ${pyq.year}`.trim()
      : '';
    const pyqChipStyle = getPYQChipStyle(pyq);

    return (
      <TouchableOpacity
        onPress={() => { setPreviewRevealed(false); setPreviewQuestion(item); }}
        testID={`ai-search-result-${item.id}`}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: searchTier === 0 ? '#16a34a50' : isFeatured ? '#7c3aed40' : colors.border,
            borderWidth: (searchTier === 0 || isFeatured) ? 1.5 : 1,
          },
        ]}
      >
        <View style={[styles.cardNum, { backgroundColor: isFeatured ? '#7c3aed15' : colors.surfaceStrong }]}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isFeatured ? '#7c3aed' : colors.textTertiary }}>
            {index + 1}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          {/* Enhancement 1 — keyword highlighting with ALL matchable keywords */}
          {/* Uses ALL keywords from the search (not just first 3), so cards matching */}
          {/* AI-expanded terms like "Krishnadevaraya" also show those words highlighted */}
          {/* FIX: use buildContextSnippet to show ~12 words before & after the match, */}
          {/* ensuring matches in deep paragraphs are visible in the snippet */}
          <Text style={[styles.cardText, { color: colors.textPrimary }]} numberOfLines={3}>
            {keywords.length > 0
              ? buildContextSnippet(item.question_text, keywords, item.options, item.explanation_markdown, query)
              : item.question_text}
          </Text>

          <View style={styles.cardChips}>
            {item.subject && (

              <View style={[styles.chip, { backgroundColor: subColor + '18' }]}>
                <Text style={[styles.chipText, { color: subColor }]}>{item.subject}</Text>
              </View>
            )}
            {/* Color-coded PYQ chip by exam category */}
            {item.is_pyq && pyqLabel && pyqChipStyle && (
              <View style={[styles.chip, { backgroundColor: pyqChipStyle.bg }]}>
                <Text style={[styles.chipText, { color: pyqChipStyle.color }]}>
                  {pyqLabel}
                </Text>
              </View>
            )}
            {!item.is_pyq && (
              <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                <Text style={[styles.chipText, { color: colors.textTertiary }]}>Practice</Text>
              </View>
            )}
            {(() => {
              const insts = (item._institutes || []).filter((i: string) => i && i.toUpperCase() !== 'UPSC');
              if (insts.length === 0 && item.tests?.institute && item.tests.institute.toUpperCase() !== 'UPSC') {
                insts.push(item.tests.institute);
              }
              return insts.map((inst: string) => (
                <View key={inst} style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
                  <Text style={[styles.chipText, { color: '#1d4ed8' }]}>{inst}</Text>
                </View>
              ));
            })()}
          </View>
        </View>

        <ChevronRight size={15} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  const renderKeywordPills = () => (
    <View style={styles.pillsWrap}>
      {keywords.map((kw, i) => (
        <View key={i} style={[styles.pill, { backgroundColor: '#ede9fe', borderColor: '#c4b5fd' }]}>
          <Text style={[styles.pillText, { color: '#7c3aed' }]}>{kw}</Text>
        </View>
      ))}
    </View>
  );

  const renderEmptyState = () => {
    // Build smart suggestions: recent history (top 3) + UPSC trend topics (rotate by day)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const trendPool = [
      // Polity
      'emergency provisions article 352', 'Governor discretionary powers', 'fundamental duties cases',
      'parliamentary privilege contempt', 'CAG powers constitutional mandate',
      // History
      'Buddhist councils chronology', 'Bhakti movement saints contributions',
      'revolt 1857 causes and consequences', 'Salt Satyagraha significance',
      // Geography
      'MSP vs FRP difference', 'rain shadow effect Western Ghats', 'ITCZ monsoon mechanism',
      // Economy
      'NPA classification RBI norms', 'MSME definition revised criteria', 'fiscal deficit FRBM targets',
      // Environment
      'Ramsar wetlands India list', 'biodiversity hotspots endemic species', 'carbon credit mechanism',
      // S&T
      'mRNA vaccine technology', 'quantum computing applications UPSC', 'ISRO missions achievements',
    ];
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
        <View style={styles.brainBadge}>
          <Brain size={28} color="#fff" />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>AI-Powered Search</Text>

        {/* Recent searches section */}
        {historyItems.length > 0 && (
          <>
            <Text style={[styles.examplesLabel, { color: colors.textTertiary }]}>CONTINUE WHERE YOU LEFT OFF</Text>
            {historyItems.map((h) => (
              <TouchableOpacity
                key={`h-${h}`}
                onPress={() => { setQuery(h); runSearch(h, filters); }}
                testID={`ai-search-history-${h.slice(0, 12)}`}
                style={[styles.exampleChip, { backgroundColor: colors.surface, borderColor: '#7c3aed30' }]}
              >
                <Clock size={12} color="#7c3aed" />
                <Text style={[styles.exampleText, { color: colors.textSecondary }]} numberOfLines={1}>{h}</Text>
                <ChevronRight size={12} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Smart trending suggestions */}
        <Text style={[styles.examplesLabel, { color: colors.textTertiary, marginTop: historyItems.length > 0 ? 14 : 0 }]}>
          SMART SUGGESTIONS
        </Text>
        {suggestedFromTrend.map((ex) => (
          <TouchableOpacity
            key={ex}
            onPress={() => { setQuery(ex); runSearch(ex, filters); }}
            testID={`ai-search-example-${ex.slice(0, 12)}`}
            style={[styles.exampleChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Sparkles size={12} color="#7c3aed" />
            <Text style={[styles.exampleText, { color: colors.textSecondary }]}>{ex}</Text>
            <ChevronRight size={12} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}

        {/* PYQ Hot Topics Widget */}
        {pyqHotTopics.length > 0 && (
          <View style={{ width: '100%', marginTop: 20 }}>
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
                  const newFilters = { ...filters, pyqFilter: 'PYQ Only', examCategory: 'UPSC' };
                  setFilters(newFilters);
                  runSearch(q, newFilters);
                }}
                testID={`pyq-hot-topic-${i}`}
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
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 6, textAlign: 'center' }}>
              Based on frequency trends + slope over last 6 years
            </Text>
          </View>
        )}
      </View>
    );
  };

  // ── Left panel (iPad sidebar / inline on phone) ───────────────────────────

  const LeftPanel = (
    <ScrollView
      style={[
        IS_IPAD ? styles.leftPanel : styles.phoneKeywordsPanel,
        { backgroundColor: IS_IPAD ? colors.surface : colors.bg, borderRightColor: colors.border },
      ]}
      contentContainerStyle={{ flexGrow: 1 }}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled
    >
      {keywords.length > 0 && (
        <>
          {/* Keyword toggle section — tap to uncheck = hide results matching only that keyword */}
          <TouchableOpacity
            onPress={() => setKeywordsExpanded(e => !e)}
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
          <Text style={[styles.pillText, { color: colors.textTertiary, fontSize: 11, marginTop: 6, marginBottom: 6 }]}>
            💡 Tap a keyword to exclude it and filter results
          </Text>
          {keywordsExpanded && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
              {keywords.map((kw, i) => {
                const isExcluded = excludedKeywords.has(kw);
                return (
                  <TouchableOpacity
                    key={i}
                    onPress={() => {
                      const next = new Set(excludedKeywords);
                      if (isExcluded) next.delete(kw);
                      else next.add(kw);
                      setExcludedKeywords(next);
                      // Re-filter results client-side from masterResults
                      if (next.size === 0) {
                        setResults(masterResults);
                      } else {
                        const filtered = masterResults.filter((r: any) => {
                          const text = ((r.question_text || '') + ' ' + (r.explanation_markdown || '')).toLowerCase();
                          // Keep result if it matches at least one non-excluded keyword
                          return keywords.some(k => !next.has(k) && text.includes(k.toLowerCase()));
                        });
                        setResults(filtered);
                      }
                    }}
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
        </>
      )}

      {hasSearched && results.length > 0 && (
        <>
          <Text style={[styles.panelLabel, { color: colors.textTertiary, marginTop: 14 }]}>STATS</Text>
          <View style={styles.statRow}>
            <View style={[styles.statCard, { backgroundColor: colors.bg }]}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{results.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Questions</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.bg }]}>
              <Text style={[styles.statNum, { color: '#15803d' }]}>{results.filter(r => r.is_pyq).length}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>PYQs</Text>
            </View>
          </View>

          {/* Subject drill-down: tapping a subject re-runs search with that subject filter. */}
          {/* ISSUE FIX #12: Use allSearchSubjects so filter options remain visible after selection */}
          {allSearchSubjects.length >= 1 && (
            <>
              <Text style={[styles.panelLabel, { color: colors.textTertiary, marginTop: 14 }]}>BY SUBJECT</Text>
              {/* Fix #2 - clear chip */}
              {sidebarSubjectFilter && (
                <TouchableOpacity
                  style={[styles.subjectChip, { borderColor: '#ef4444', backgroundColor: '#fee2e2' }]}
                  onPress={() => {
                    setSidebarSubjectFilter(null);
                    // Issue #11: Client-side — restore master results
                    setResults(masterResults);
                  }}
                >
                  <X size={10} color="#ef4444" />
                  <Text style={[styles.subjectChipText, { color: '#ef4444' }]}>Clear: {sidebarSubjectFilter}</Text>
                </TouchableOpacity>
              )}
              {allSearchSubjects.map(sub => {
                // Count from current filtered results, but show all subjects from original search
                const count = masterResults.filter(r => r.subject === sub).length;
                const color = getSubjectColor(sub as string);
                const isSelected = sidebarSubjectFilter === sub;
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subjectChip, {
                      borderColor: isSelected ? '#7c3aed' : colors.border,
                      backgroundColor: isSelected ? '#7c3aed' : colors.surface,
                    }]}
                    onPress={() => {
                      // Issue #11: Client-side filtering — no re-query needed
                      const isSame = sidebarSubjectFilter === sub;
                      const newSub = isSame ? null : sub as string;
                      setSidebarSubjectFilter(newSub);
                      // Filter masterResults locally instead of re-querying Supabase
                      if (newSub) {
                        setResults(masterResults.filter(r => r.subject === newSub));
                      } else {
                        setResults(masterResults);
                      }
                    }}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: color }]} />
                    <Text style={[styles.subjectChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sub}</Text>
                    <Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{count}</Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* PYQ quick filter */}
          <Text style={[styles.panelLabel, { color: colors.textTertiary, marginTop: 14 }]}>TYPE</Text>
          {(['All', 'PYQ Only', 'Non-PYQ'] as const).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.subjectChip,
                {
                  borderColor: filters.pyqFilter === opt ? '#7c3aed' : colors.border,
                  backgroundColor: filters.pyqFilter === opt ? '#7c3aed' : colors.surface,
                },
              ]}
              onPress={() => {
                const newFilters = { ...filters, pyqFilter: opt };
                setFilters(newFilters);
                // Issue #11: Client-side filtering first
                let filtered = sidebarSubjectFilter
                  ? masterResults.filter(r => r.subject === sidebarSubjectFilter)
                  : [...masterResults];
                if (opt === 'PYQ Only') filtered = filtered.filter(r => r.is_pyq);
                else if (opt === 'Non-PYQ') filtered = filtered.filter(r => !r.is_pyq);
                // FIX #4: If client-side filtering yields suspiciously few results
                // (less than 20% of master), the original query likely didn't fetch
                // enough of the desired type. Re-query from Supabase.
                if (filtered.length < masterResults.length * 0.2 && query.trim()) {
                  runSearch(query, { ...filters, pyqFilter: opt });
                  return;
                }
                setResults(filtered);
              }}
            >
              <Text style={[styles.subjectChipText, {
                color: filters.pyqFilter === opt ? '#fff' : colors.textSecondary,
                fontWeight: filters.pyqFilter === opt ? '800' : '600',
              }]}>{opt}</Text>
            </TouchableOpacity>
          ))}

          {/* Institute breakdown in results */}
          {(() => {
            // FIX #1: Apply subject filter to institute counts (AND logic, not OR)
            const filteredBySubject = sidebarSubjectFilter
              ? masterResults.filter(r => r.subject === sidebarSubjectFilter)
              : masterResults;
            const instInResults = filteredBySubject
              .map(r => r.tests?.institute)
              .filter(Boolean) as string[];
            const instCounts: Record<string, number> = {};
            instInResults.forEach(inst => { instCounts[inst] = (instCounts[inst] || 0) + 1; });
            const instEntries = Object.entries(instCounts).sort((a, b) => b[1] - a[1]);
            if (instEntries.length === 0) return null;
            return (
              <>
                <Text style={[styles.panelLabel, { color: colors.textTertiary, marginTop: 14 }]}>BY INSTITUTE</Text>
                {instEntries.slice(0, 6).map(([inst, count]) => {
                  const isSelected = sidebarInstituteFilter !== 'All' && sidebarInstituteFilter.split(',').includes(inst);
                  return (
                    <TouchableOpacity
                      key={inst}
                      style={[styles.subjectChip, {
                        borderColor: isSelected ? '#7c3aed' : colors.border,
                        backgroundColor: isSelected ? '#7c3aed' : colors.surface,
                      }]}
                      onPress={() => {
                        const list = sidebarInstituteFilter === 'All' ? [] : sidebarInstituteFilter.split(',').filter(Boolean);
                        const next = isSelected ? list.filter(i => i !== inst) : [...list, inst];
                        const nextVal = next.length ? next.join(',') : 'All';
                        setSidebarInstituteFilter(nextVal);
                        // Sync to filters and results
                        const newFilters = { ...filters, institutes: nextVal };
                        setFilters(newFilters);
                        let filtered = sidebarSubjectFilter
                          ? masterResults.filter(r => r.subject === sidebarSubjectFilter)
                          : [...masterResults];
                        if (next.length > 0) {
                          const instSet = new Set(next);
                          filtered = filtered.filter(r => instSet.has(r.tests?.institute || ''));
                        }
                        setResults(filtered);
                      }}
                    >
                      <View style={[styles.subjectDot, { backgroundColor: isSelected ? '#fff' : '#7c3aed' }]} />
                      <Text style={[styles.subjectChipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{inst}</Text>
                      <Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{count}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            );
          })()}
            </>
          )}
        </ScrollView>
      );

  // ── Results header with Learn/Exam launch buttons ───────────────────────
  const ResultsHeader = (
    <View style={[styles.resultsHeader, { borderBottomColor: colors.border }]}>
      {/* Left: count + sort */}
      <View style={{ flex: 1 }}>
        <Text style={[styles.resultsCount, { color: colors.textTertiary }]}>
          {hasSearched ? `${sortedResults.length} results` : ''}
        </Text>
        <View style={styles.sortRow}>
          {(['Relevance', 'Year', 'Subject'] as SortMode[]).map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setSortMode(s)}
              testID={`ai-search-sort-${s}`}
              style={[styles.sortBtn, { backgroundColor: sortMode === s ? '#7c3aed' : colors.surfaceStrong }]}
            >
              <Text style={[styles.sortBtnText, { color: sortMode === s ? '#fff' : colors.textTertiary }]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Right: Launch full result set */}
      {sortedResults.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
              backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border,
            }}
            onPress={() => openQuestion(sortedResults[0], 'learning')}
            testID="ai-search-learn-all"
          >
            <BookOpen size={13} color={colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>Learn</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 5,
              paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12,
              backgroundColor: '#7c3aed', borderWidth: 1, borderColor: '#7c3aed',
            }}
            onPress={() => openQuestion(sortedResults[0], 'exam')}
            testID="ai-search-exam-all"
          >
            <Target size={13} color="#fff" />
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#fff' }}>Exam</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  // ── Filter popup ──────────────────────────────────────────────────────────

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
                testID="ai-search-filter-close"
                style={[styles.closeBtn, { backgroundColor: colors.surfaceStrong }]}
              >
                <X size={12} color={colors.textSecondary} />
              </TouchableOpacity>
              <Filter size={15} color={colors.textSecondary} />
              <Text style={[styles.popupTitle, { color: colors.textPrimary }]}>Search Filters</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setPendingFilters(DEFAULT_FILTERS)} testID="ai-search-filter-clear">
                <Text style={[styles.clearBtn, { color: colors.textTertiary }]}>Clear all</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.aiNote, { backgroundColor: '#ede9fe' }]}>
            <Brain size={13} color="#7c3aed" />
            <Text style={[styles.aiNoteText, { color: '#7c3aed' }]}>
              Gemini handles fuzzy matching and typo correction. These filters narrow the AI-expanded results.
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.popupBody} showsVerticalScrollIndicator={true}>

            {/* 🔥 Removed redundant SEARCH MODE — already available as top toggle buttons */}

            <View style={styles.filterGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SEARCH ACROSS</Text>
              <View style={styles.chipsWrap}>
                {['Questions', 'Explanations', 'Options'].map(opt => {
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

            <FilterGroup
              label="EXAM STAGE"
              options={['All', 'Prelims', 'Mains']}
              value={pendingFilters.stage}
              onSelect={(v) => setPendingFilters(p => ({ ...p, stage: v }))}
              colors={colors}
            />

            <FilterGroup
              label="PYQ MODE"
              options={['All', 'PYQ Only', 'Non-PYQ']}
              value={pendingFilters.pyqMode}
              onSelect={(v) => setPendingFilters(p => ({
                ...p,
                pyqMode: v,
                examCategory: v !== 'PYQ Only' ? 'All' : p.examCategory, // 🐛 FIX: clear examCategory when PYQ mode is not 'PYQ Only' so stale category doesn't leak
              }))}
              colors={colors}
            />

            {/* FIX #3: Only show EXAM CATEGORY when PYQ MODE is "PYQ Only" (AND logic, not OR) */}
            {pendingFilters.pyqMode === 'PYQ Only' && (
              <FilterGroup
                label="EXAM CATEGORY"
                options={['All', 'UPSC', 'Allied', 'Others']}
                value={pendingFilters.examCategory}
                onSelect={(v) => setPendingFilters(p => ({ ...p, examCategory: v }))}
                colors={colors}
              />
            )}

            <FilterGroup
              label="CURRICULUM"
              options={['All', 'NCERT Only', 'Non-NCERT']}
              value={pendingFilters.ncertFilter}
              onSelect={(v) => setPendingFilters(p => ({ ...p, ncertFilter: v }))}
              colors={colors}
            />

            {/* Institutes — dynamically loaded from tests table */}
            {userTags.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>REVISION TAGS</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, revisionTags: 'All' }))}
                    style={[styles.fchip, pendingFilters.revisionTags === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.revisionTags === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                    {pendingFilters.revisionTags === 'All' && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                  {/* Select All — selects every tag so results are filtered to tagged questions only */}
                  {userTags.length > 1 && (
                    <TouchableOpacity
                      onPress={() => setPendingFilters(p => ({
                        ...p,
                        revisionTags: userTags.join(','),
                      }))}
                      style={[styles.fchip, {
                        borderColor: colors.primary,
                        backgroundColor: pendingFilters.revisionTags === userTags.join(',') ? colors.primary : colors.surfaceStrong,
                      }]}
                    >
                      <Text style={[styles.fchipText, {
                        color: pendingFilters.revisionTags === userTags.join(',') ? '#fff' : colors.primary,
                        fontWeight: '800',
                      }]}>Select All</Text>
                      {pendingFilters.revisionTags === userTags.join(',') && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  )}
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
                        {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {instituteOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>INSTITUTES</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, institutes: 'All' }))}
                    style={[styles.fchip, pendingFilters.institutes === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.institutes === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                    {pendingFilters.institutes === 'All' && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                  {instituteOptions.map(inst => {
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
                        {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Exam Stage / Series */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>EXAM STAGE</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => setPendingFilters(p => ({ ...p, stage: 'All' }))}
                  style={[styles.fchip, pendingFilters.stage === 'All' && styles.fchipSel]}
                >
                  <Text style={[styles.fchipText, { color: pendingFilters.stage === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  {pendingFilters.stage === 'All' && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {['Prelims', 'Mains', 'Optional'].map(s => {
                  const isSelected = pendingFilters.stage.split(',').includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      onPress={() => {
                        const list = pendingFilters.stage === 'All' ? [] : pendingFilters.stage.split(',').filter(Boolean);
                        const next = isSelected ? list.filter(x => x !== s) : [...list, s];
                        setPendingFilters(p => ({ ...p, stage: next.length ? next.join(',') : 'All' }));
                      }}
                      style={[styles.fchip, isSelected && styles.fchipSel]}
                    >
                      <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{s}</Text>
                      {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Real Programs — dynamically from tests table, multi-select */}
            {programOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>PROGRAMS</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, programs: 'All' }))}
                    style={[styles.fchip, pendingFilters.programs === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.programs === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                    {pendingFilters.programs === 'All' && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                  {programOptions.map(prog => {
                    const isSelected = pendingFilters.programs.split(',').includes(prog);
                    return (
                      <TouchableOpacity
                        key={prog}
                        onPress={() => {
                          const list = pendingFilters.programs === 'All' ? [] : pendingFilters.programs.split(',').filter(Boolean);
                          const next = isSelected ? list.filter(p => p !== prog) : [...list, prog];
                          setPendingFilters(p => ({ ...p, programs: next.length ? next.join(',') : 'All' }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{prog}</Text>
                        {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Subjects — dynamically loaded from questions table */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SUBJECTS</Text>
              <View style={styles.chipsWrap}>
                <TouchableOpacity
                  onPress={() => setPendingFilters(p => ({ ...p, subjects: 'All', sections: 'All', microtopics: 'All' }))}
                  style={[styles.fchip, pendingFilters.subjects === 'All' && styles.fchipSel]}
                >
                  <Text style={[styles.fchipText, { color: pendingFilters.subjects === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  {pendingFilters.subjects === 'All' && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                </TouchableOpacity>
                {subjectOptions.length > 0 ? (
                  subjectOptions.map(sub => {
                    const isSelected = pendingFilters.subjects.split(',').includes(sub);
                    return (
                      <TouchableOpacity
                        key={sub}
                        onPress={() => {
                          const list = pendingFilters.subjects === 'All' ? [] : pendingFilters.subjects.split(',').filter(Boolean);
                          const next = isSelected ? list.filter(s => s !== sub) : [...list, sub];
                          setPendingFilters(p => ({ ...p, subjects: next.length ? next.join(',') : 'All', sections: 'All', microtopics: 'All' }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sub}</Text>
                        {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ paddingVertical: 8 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </View>
            </View>

            {/* Section Groups — shown after subject chosen or while loading */}
            {sectionOptions.length > 0 || (pendingFilters.subjects !== 'All' && pendingFilters.subjects) ? (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SECTION / CHAPTER</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, sections: 'All', microtopics: 'All' }))}
                    style={[styles.fchip, pendingFilters.sections === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.sections === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                    {pendingFilters.sections === 'All' && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                  {sectionOptions.length > 0 ? (
                    sectionOptions.map(sec => {
                      const isSelected = pendingFilters.sections.split(',').includes(sec);
                      return (
                        <TouchableOpacity
                          key={sec}
                          onPress={() => {
                            const list = pendingFilters.sections === 'All' ? [] : pendingFilters.sections.split(',').filter(Boolean);
                            const next = isSelected ? list.filter(s => s !== sec) : [...list, sec];
                            setPendingFilters(p => ({ ...p, sections: next.length ? next.join(',') : 'All', microtopics: 'All' }));
                          }}
                          style={[styles.fchip, isSelected && styles.fchipSel]}
                        >
                          <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{sec}</Text>
                          {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={{ paddingVertical: 8 }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {/* Micro Topics — shown after section chosen */}
            {microtopicOptions.length > 0 || (pendingFilters.sections !== 'All' && pendingFilters.sections) ? (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>MICRO TOPIC</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, microtopics: 'All' }))}
                    style={[styles.fchip, pendingFilters.microtopics === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.microtopics === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                    {pendingFilters.microtopics === 'All' && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                  </TouchableOpacity>
                  {microtopicOptions.length > 0 ? (
                    microtopicOptions.map(mt => {
                      const isSelected = pendingFilters.microtopics.split(',').includes(mt);
                      return (
                        <TouchableOpacity
                          key={mt}
                          onPress={() => {
                            const list = pendingFilters.microtopics === 'All' ? [] : pendingFilters.microtopics.split(',').filter(Boolean);
                            const next = isSelected ? list.filter(s => s !== mt) : [...list, mt];
                            setPendingFilters(p => ({ ...p, microtopics: next.length ? next.join(',') : 'All' }));
                          }}
                          style={[styles.fchip, isSelected && styles.fchipSel]}
                        >
                          <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>{mt}</Text>
                          {isSelected && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <View style={{ paddingVertical: 8 }}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </View>
              </View>
            ) : null}

          </ScrollView>

          <View style={[styles.popupFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={applyFilters} style={styles.applyBtn} testID="ai-search-filter-apply">
              <Filter size={14} color="#fff" />
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ── Search bar ────────────────────────────────────────────────────────────

  const QuickFilterBar = (
    <View style={{ paddingHorizontal: 14, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.8 }}>QUICK:</Text>
        {/* PYQ Mode quick chips */}
        {(['All', 'PYQ Only', 'Non-PYQ'] as const).map(opt => {
          const isActive = filters.pyqFilter === opt || (opt === 'All' && filters.pyqFilter === 'All');
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                const newF = { ...filters, pyqFilter: opt, pyqMode: opt };
                setFilters(newF);
                if (hasSearched && query.trim()) runSearch(query, newF);
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
        {/* Search Across quick chips */}
        {['Questions', 'Explanations', 'Options'].map(opt => {
          const isSelected = filters.searchAcross.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              onPress={() => {
                const list = [...filters.searchAcross];
                const next = isSelected ? list.filter(i => i !== opt) : [...list, opt];
                const newF = { ...filters, searchAcross: next.length > 0 ? next : ['Questions'] };
                setFilters(newF);
                if (hasSearched && query.trim()) runSearch(query, newF);
              }}
              style={{
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
                backgroundColor: isSelected ? colors.primary : colors.surfaceStrong,
                borderWidth: 1, borderColor: isSelected ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: isSelected ? '#fff' : colors.textSecondary }}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const SearchBar = (
    <View style={{ position: 'relative', zIndex: 100 }}>
      {/* ── 3-Mode Engine Toggle ──────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }}>
        {([
          { mode: 'AI' as SearchEngineMode, icon: <Brain size={10} color={searchEngineMode === 'AI' ? '#fff' : '#7c3aed'} />, label: IS_IPAD ? 'AI' : 'AI' },
          { mode: 'AI+Fuzzy' as SearchEngineMode, icon: <Zap size={10} color={searchEngineMode === 'AI+Fuzzy' ? '#fff' : '#06b6d4'} />, label: IS_IPAD ? 'AI+Fuzzy' : 'AI+Fz' },
          { mode: 'Matching' as SearchEngineMode, icon: <Zap size={10} color={searchEngineMode === 'Matching' ? '#fff' : colors.textSecondary} />, label: IS_IPAD ? 'Fuzzy' : 'Fuzz' },
          { mode: 'Exact' as SearchEngineMode, icon: <Target size={10} color={searchEngineMode === 'Exact' ? '#fff' : colors.textSecondary} />, label: IS_IPAD ? 'Exact' : 'Exact' },
        ]).map(({ mode, icon, label }) => (
          <TouchableOpacity
            key={mode}
            onPress={() => {
              setSearchEngineMode(mode);
              if (hasSearched && query.trim()) runSearch(query, filters, mode);
            }}
            testID={`search-mode-${mode.toLowerCase()}`}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 3,
              paddingHorizontal: 8, paddingVertical: 4, borderRadius: 14,
              backgroundColor: searchEngineMode === mode
                ? (mode === 'AI' ? '#7c3aed' : (mode === 'AI+Fuzzy' ? '#06b6d4' : (mode === 'Matching' ? '#0ea5e9' : '#f59e0b')))
                : colors.surface,
              borderWidth: 1,
              borderColor: searchEngineMode === mode
                ? 'transparent'
                : colors.border,
            }}
          >
            {icon}
            <Text style={{ fontSize: 10, fontWeight: '800', color: searchEngineMode === mode ? '#fff' : colors.textSecondary }}>{label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
      </View>

      {/* ── Search input row ─────────────────────────────────────────────── */}
      <View style={[styles.searchRow, IS_IPAD ? {} : { paddingHorizontal: 10, paddingVertical: 6, gap: 5 }]}>
        <View style={[styles.searchWrap, {
          backgroundColor: colors.surface, borderColor:
            searchEngineMode === 'AI' ? '#7c3aed60' : searchEngineMode === 'Matching' ? '#0ea5e940' : '#f59e0b40'
        }]}>
          <Search size={15} color={colors.textTertiary} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder={searchEngineMode === 'AI' ? "Ask in plain language…" : searchEngineMode === 'Matching' ? "Fuzzy keyword search…" : "Type exact phrase…"}
            placeholderTextColor={colors.textTertiary}
            returnKeyType="search"
            onSubmitEditing={() => runSearch(query, filters)}
            onFocus={() => { if (searchHistory.length > 0 || instituteOptions.length > 0) setShowHistory(true); }}
            onBlur={() => setTimeout(() => setShowHistory(false), 150)}
            testID="ai-search-input"
            style={[styles.searchInput, { color: colors.textPrimary }]}
          />
          {query.length > 0 && (
            <TouchableOpacity
              testID="ai-search-clear"
              onPress={() => { setQuery(''); setResults([]); setHasSearched(false); setKeywords([]); }}
            >
              <X size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => runSearch(query, filters)}
            disabled={loading || !query.trim()}
            testID="ai-search-go"
            style={[styles.goBtn, {
              backgroundColor: searchEngineMode === 'AI' ? '#7c3aed' : searchEngineMode === 'Matching' ? '#0ea5e9' : '#f59e0b'
            }]}
          >
            {loading
              ? <ActivityIndicator size="small" color="#fff" />
              : searchEngineMode === 'AI' ? <Brain size={15} color="#fff" />
                : searchEngineMode === 'Matching' ? <Zap size={15} color="#fff" />
                : <Target size={15} color="#fff" />
            }
          </TouchableOpacity>
        </View>

        {IS_IPAD && (
          <TouchableOpacity
            onPress={() => setShowModelSwitcher(true)}
            style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Brain size={18} color="#7c3aed" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={openFilterPopup}
          testID="ai-search-filter-open"
          style={[styles.filterBtn, IS_IPAD ? {} : { height: 40, paddingHorizontal: 10 }, {
            backgroundColor: activeFilterCount > 0 ? '#ede9fe' : colors.surface,
            borderColor: activeFilterCount > 0 ? '#c4b5fd' : colors.border,
          }]}
        >
          <SlidersHorizontal size={13} color={activeFilterCount > 0 ? '#7c3aed' : colors.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {showHistory && (searchHistory.length > 0 || instituteOptions.length > 0) && (
        <View style={[styles.historyDropdown, {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        }]}>
          {searchHistory.length > 0 && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }}>
                <Text style={[styles.panelLabel, { color: colors.textTertiary, marginBottom: 0 }]}>RECENT SEARCHES</Text>
                <TouchableOpacity onPress={() => {
                  setSearchHistory([]);
                  AsyncStorage.removeItem('ai_search_history');
                  setShowHistory(false);
                }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textTertiary }}>Clear</Text>
                </TouchableOpacity>
              </View>
              {searchHistory.map((h, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.historyItem, { borderBottomColor: colors.border }]}
                  onPress={() => { setQuery(h); setShowHistory(false); runSearch(h, filters); }}
                >
                  <Clock size={12} color={colors.textTertiary} />
                  <Text style={[styles.historyText, { color: colors.textSecondary }]} numberOfLines={1}>{h}</Text>
                  <TouchableOpacity onPress={() => {
                    const next = searchHistory.filter((_, j) => j !== i);
                    setSearchHistory(next);
                    AsyncStorage.setItem('ai_search_history', JSON.stringify(next));
                  }}>
                    <X size={11} color={colors.textTertiary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
          <View style={styles.headerLeft}>
            <View style={styles.brainBadge}>
              <Brain size={16} color="#fff" />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>AI Search</Text>
              <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
                AI · FUZZY · EXACT + TYPO TOLERANT
              </Text>
            </View>
          </View>
          <View style={[styles.aiBadge, { backgroundColor: '#ede9fe' }]}>
            <Sparkles size={10} color="#7c3aed" />
            <Text style={styles.aiBadgeText}>Semantic</Text>
          </View>
        </View>

        <View style={{ position: 'relative', zIndex: 10 }}>
          {QuickFilterBar}
          {SearchBar}
        </View>

        {IS_IPAD ? (
          <View style={styles.ipadBody}>
            <View style={{ width: sidebarCollapsed ? 0 : 260, overflow: 'hidden' }}>
              {LeftPanel}
            </View>
            <View style={{ flex: 1 }}>
              {hasSearched && ResultsHeader}
              {hasSearched ? (
                <FlatList
                  data={sortedResults}
                  keyExtractor={item => item.id}
                  renderItem={renderResultCard}
                  contentContainerStyle={{ padding: 12 }}
                  ListEmptyComponent={
                    loading ? null : (
                      <View style={styles.noResults}>
                        <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>
                          No results. Try different keywords or adjust filters.
                        </Text>
                      </View>
                    )
                  }
                />
              ) : renderEmptyState()}
            </View>

            {/* Floating Sidebar Toggle Button (similar to pilot v2) */}
            <TouchableOpacity
              testID="ai-search-show-sidebar"
              onPress={() => setSidebarCollapsed(!sidebarCollapsed)}
              style={{
                position: 'absolute',
                bottom: 24,
                left: 24,
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: !sidebarCollapsed ? colors.textSecondary : '#7c3aed',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#7c3aed',
                shadowOpacity: 0.3,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 5,
                zIndex: 9999,
              }}
            >
              {!sidebarCollapsed ? (
                <ChevronLeft size={20} color="#fff" />
              ) : (
                <ChevronRight size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={hasSearched ? sortedResults : []}
            keyExtractor={item => item.id}
            renderItem={renderResultCard}
            ListHeaderComponent={
              <>
                {/* Fix #6 — collapsible keywords on phone */}
                {keywords.length > 0 && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
                    <TouchableOpacity onPress={() => setKeywordsExpanded(e => !e)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
                      <Sparkles size={11} color="#7c3aed" />
                      <Text style={[styles.panelLabel, { color: '#7c3aed', marginBottom: 0, flex: 1 }]}>{keywords.length} AI KEYWORDS USED</Text>
                      {keywordsExpanded ? <ChevronUp size={13} color={colors.textTertiary} /> : <ChevronDown size={13} color={colors.textTertiary} />}
                    </TouchableOpacity>
                    {keywordsExpanded && renderKeywordPills()}
                  </View>
                )}
                {hasSearched && ResultsHeader}
                {!hasSearched && renderEmptyState()}
              </>
            }
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        {FilterPopup}

        {previewQuestion && (
          <Modal
            visible
            animationType="fade"
            transparent
            onRequestClose={closePreviewModal}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(10,10,20,0.65)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
              <View style={{ width: '100%', maxWidth: 650, maxHeight: '90%', flexShrink: 1, backgroundColor: colors.bg, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 32, elevation: 20 }}>
                {/* Fixed Header */}
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
                    onPress={closePreviewModal}
                    style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Independent Scrollable Content */}
                <PinchGestureHandler onGestureEvent={onPinchGestureEvent} onHandlerStateChange={onPinchHandlerStateChange}>
                  <ScrollView 
                    ref={previewScrollRef}
                    style={{ flexShrink: 1 }}
                    contentContainerStyle={{ padding: 16 }}
                    showsVerticalScrollIndicator={true}
                  >
                    {(() => {
                      // Compute activeExplanationText based on current explanation source
                      // This ensures the rocket icon captures the correct currently-displayed content
                      let computedActiveExplText = '';
                      
                      // Priority 1: Use AI explanation if source is 'ai' and available
                      if (previewExplSource === 'ai' && aiExplanation?.trim()) {
                        computedActiveExplText = aiExplanation;
                      }
                      // Priority 2: Combine all explanations when 'all' is selected and enriched data exists
                      else if (previewExplSource === 'all' && enrichedExplanations?.length) {
                        const normalized = (enrichedExplanations || []).map((e: any) => ({
                          source: e.source || 'Unknown',
                          text: e.text || '*No explanation provided.*'
                        }));
                        computedActiveExplText = normalized
                          .map((e: any) => `**${e.source}**:\n\n${e.text}`)
                          .join('\n\n---\n\n');
                      }
                      // Priority 3: Use first enriched explanation as fallback
                      else if (enrichedExplanations?.length && enrichedExplanations[0]?.text?.trim()) {
                        computedActiveExplText = enrichedExplanations[0].text;
                      }
                      // Priority 4: Fall back to question's explanation_markdown
                      else if (previewQuestion?.explanation_markdown?.trim()) {
                        computedActiveExplText = previewQuestion.explanation_markdown;
                      }
                      // Priority 5: Last resort - use question text
                      else {
                        computedActiveExplText = previewQuestion?.question_text ? `**Question:** ${previewQuestion.question_text}` : 'No content available';
                      }
                      
                      return (
                        <SharedQuestionCard
                          key={`${previewQuestion?.id}-${previewStudyTags?.length || 0}-${previewAnswer || 'none'}`}
                          item={{
                            ...previewQuestion,
                            exam_info: {
                              is_upsc_cse: previewQuestion?.is_upsc_cse,
                              is_allied: previewQuestion?.is_allied,
                              is_others: previewQuestion?.is_others,
                              group: previewQuestion?.exam_group,
                              exam_name: previewQuestion?.exam_group,
                              year: previewQuestion?.exam_year,
                              ...(previewQuestion?.exam_info || {})
                            },
                            _explanations: enrichedExplanations || previewQuestion._explanations || [],
                            _institutes: previewQuestion._institutes || [],
                          }}
                          index={0}
                          arenaMode="learning"
                          isRevealed={previewRevealed}
                          colors={colors}
                          mdStyles={mdStyles}
                          mdRules={mdRules}
                          fontSize={previewFontSize}
                          answerData={{
                            selectedAnswer: previewAnswer,
                            isReview: previewStudyTags.length > 0,
                            studyTags: previewStudyTags
                          }}
                          userStudyTags={userTags}
                          toggleStudyTag={handleToggleTag}
                          activeExplSource={previewExplSource}
                          onExplSourceChange={setPreviewExplSource}
                          activeExplanationText={computedActiveExplText}
                          aiExplanation={aiExplanation}
                          isAiLoading={aiExplainLoading}
                          isSavingFlashcard={savingFlashcard[previewQuestion.id]}
                          isFlashcarded={flashcardedIds.has(previewQuestion.id)}
                          onRevealExplanation={() => setPreviewRevealed(true)}
                          onOptionSelect={(qid: string, opt: string) => setPreviewAnswer(opt)}
                          onAddFlashcard={handleAddToFlashcards}
                          onAiExplain={handleAiExplainPopup}
                          bestAnswers={bestAnswers}
                          ensureBestAnswerLoaded={ensureBestAnswerLoaded}
                          showNotebookButton={false}
                          openNotebookFromQuestion={(_: any, activeText?: string) => {
                            // Build fallback content chain if activeText is empty
                            let content = '';
                            if (activeText && activeText.trim()) {
                              content = activeText;
                            } else if (previewExplSource === 'ai' && aiExplanation?.trim()) {
                              content = aiExplanation;
                            } else if (enrichedExplanations?.length && enrichedExplanations[0]?.text?.trim()) {
                              content = enrichedExplanations[0].text;
                            } else if (previewQuestion?.explanation_markdown?.trim()) {
                              content = previewQuestion.explanation_markdown;
                            } else if (_?.explanation_markdown?.trim()) {
                              content = _?.explanation_markdown;
                            } else {
                              content = `**Question:** ${(previewQuestion?.question_text || _?.question_text || 'Question')}`;
                            }
                            // Set the override state so the sheet gets the right content
                            setPilotV2InitialBodyOverride(content);
                            setPreviewNotebookDraft(content);
                            // Close light-preview modal first; then open Pilot sheet
                            // so it always appears on top (prevents hidden modal bug).
                            closePreviewModal();
                            setTimeout(() => setPilotV2SaveOpen(true), 120);
                          }}
                          onCreateTag={() => setIsAddingTag(true)}
                        />
                      );
                    })()}
                    
                    {previewQuestion.micro_topic && (
                      <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.surfaceStrong, borderRadius: 16, borderWidth: 1, borderColor: colors.border + '50' }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>SYLLABUS CONTEXT</Text>
                        <Text style={{ fontSize: Math.max(11, previewFontSize - 3), color: colors.textSecondary, fontWeight: '600' }}>{previewQuestion.micro_topic}</Text>
                      </View>
                    )}
                  </ScrollView>
                </PinchGestureHandler>

                {/* Cute & Compact Notes Editor */}
                {previewQuestion && (
                  <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Highlighter size={13} color={colors.primary} />
                      <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5 }}>QUICK NOTES</Text>
                    </View>
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
                        onChangeText={(text) => setPreviewNotes(text)}
                      />
                      <TouchableOpacity
                        onPress={async () => {
                          if (!previewNotes.trim() || !session?.user?.id || !previewQuestion?.id) return;
                          setIsSavingNotes(true);
                          try {
                            await supabase.from('question_states').upsert({
                              user_id: session.user.id,
                              question_id: previewQuestion.id,
                              test_id: previewQuestion.test_id || 'manual',
                              user_notes: previewNotes.trim()
                            });
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
                        {isSavingNotes ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Bold size={16} color="#fff" />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {showZoomIndicator && (
                  <View style={{ position: 'absolute', top: 70, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>ZOOM: {Math.round((previewFontSize / 16) * 100)}%</Text>
                  </View>
                )}

                {/* Fixed Footer */}
                <View style={{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => { const q = previewQuestion; closePreviewModal(); if (q) openQuestion(q, 'learning'); }}
                  >
                    <BookOpen size={16} color={colors.primary} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>Learn Mode</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 14, backgroundColor: '#7c3aed' }}
                    onPress={() => { const q = previewQuestion; closePreviewModal(); if (q) openQuestion(q, 'exam'); }}
                  >
                    <Target size={16} color="#fff" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#fff' }}>Practice Exam</Text>
                  </TouchableOpacity>
                </View>
                <AddToFlashcardSheet
                  visible={aff.visible}
                  onClose={() => setAff((prev) => ({ ...prev, visible: false }))}
                  userId={session?.user?.id || ''}
                  cardId={aff.cardId}
                  hint={aff.hint}
                />
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
        <AIModelSwitcher 
          visible={showModelSwitcher} 
          onClose={() => setShowModelSwitcher(false)}
        />

        <PilotV2SaveSheet
          visible={pilotV2SaveOpen}
          userId={session?.user?.id || ''}
          onClose={() => {
            setPilotV2SaveOpen(false);
            setPilotV2InitialBodyOverride('');
          }}
          autoSeed={previewQuestion ? {
            subject: previewQuestion.subject || null,
            topic: (previewQuestion as any).section_group || null,
            subtopic: previewQuestion.micro_topic || null,
            notebookTitle: previewQuestion.micro_topic || previewQuestion.subject || null,
          } : { subject: null, topic: null, subtopic: null, notebookTitle: null }}
          initialBody={
            pilotV2InitialBodyOverride
            || previewNotebookDraft
            || (previewExplSource === 'ai' ? aiExplanation : null)
            || previewQuestion?.explanation_markdown
            || ''
          }
          source={previewQuestion ? `AI Search / ${previewQuestion.subject || ''} ${previewQuestion.exam_year || ''}`.trim() : 'AI Search'}
        />

        {/* Create Tag Modal (Issue #7) */}
        <Modal visible={isAddingTag} transparent animationType="fade" onRequestClose={() => setIsAddingTag(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, width: '80%', maxWidth: 340, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 }}>New Study Tag</Text>
              <TextInput
                style={{ backgroundColor: colors.bg, borderRadius: 12, padding: 14, fontSize: 14, color: colors.textPrimary, marginBottom: 16, borderWidth: 1, borderColor: colors.border }}
                placeholder="e.g. Trap Question"
                autoFocus
                placeholderTextColor={colors.textTertiary}
                value={newTagText}
                onChangeText={setNewTagText}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: colors.surfaceStrong, alignItems: 'center' }}
                  onPress={() => { setIsAddingTag(false); setNewTagText(''); }}
                >
                  <Text style={{ fontWeight: '800', color: colors.textPrimary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: '#7c3aed', alignItems: 'center' }}
                  onPress={handleCreateTagAISearch}
                >
                  <Text style={{ fontWeight: '800', color: '#fff' }}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
    </PageWrapper>
  );
}


// ── FilterGroup sub-component ─────────────────────────────────────────────────

function FilterGroup({
  label, options, value, onSelect, colors,
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
  colors: any;
}) {
  return (
    <View style={styles.filterGroup}>
      <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>{label}</Text>
      <View style={styles.chipsWrap}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt}
            onPress={() => onSelect(opt)}
            style={[styles.fchip, value === opt && styles.fchipSel]}
          >
            <Text style={[styles.fchipText, { color: value === opt ? '#fff' : colors.textSecondary }]}>{opt}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: 0.5 },
  headerLeft:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brainBadge:     { width: 34, height: 34, borderRadius: 10, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSub:      { fontSize: 9, fontWeight: '600', letterSpacing: 0.6, marginTop: 1 },
  aiBadge:        { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  aiBadgeText:    { fontSize: 10, fontWeight: '800', color: '#7c3aed' },
  searchRow:      { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  searchWrap:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 26, borderWidth: 1.5, height: 48, paddingLeft: 14, paddingRight: 6, shadowColor: '#7c3aed', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3 },
  searchInput:    { flex: 1, fontSize: 14, fontWeight: '500' },
  goBtn:          { width: 34, height: 34, borderRadius: 17, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  filterBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, height: 48, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1.5, position: 'relative' },
  filterBadge:    { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  filterBadgeText:{ fontSize: 9, fontWeight: '900', color: '#fff' },
  ipadBody:       { flex: 1, flexDirection: 'row' },
  leftPanel:      { width: 180, maxWidth: 180, flexGrow: 0, borderRightWidth: 0.5, padding: 5, overflow: 'hidden' },
  phoneKeywordsPanel: { paddingHorizontal: 14, paddingBottom: 4 },
  panelLabel:     { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 },
  pillsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill:           { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  pillText:       { fontSize: 10, fontWeight: '700' },
  statRow:        { flexDirection: 'row', gap: 8 },
  statCard:       { flex: 1, borderRadius: 10, padding: 10 },
  statNum:        { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  statLabel:      { fontSize: 10, fontWeight: '600' },
  subjectChip:    { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 5, paddingHorizontal: 7, borderRadius: 7, borderWidth: 1, marginBottom: 3 },
  subjectDot:     { width: 6, height: 6, borderRadius: 3 },
  subjectChipText:{ fontSize: 11, fontWeight: '600', flex: 1 },
  subjectCount:   { fontSize: 10, fontWeight: '700' },
  resultsHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  resultsCount:   { fontSize: 11, fontWeight: '700' },
  sortRow:        { flexDirection: 'row', gap: 4 },
  sortBtn:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sortBtnText:    { fontSize: 10, fontWeight: '800' },
  card:           { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 13, padding: 12, marginBottom: 7 },
  cardNum:        { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cardText:       { fontSize: 13, lineHeight: 19, fontWeight: '500', marginBottom: 7 },
  cardChips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip:           { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  chipText:       { fontSize: 10, fontWeight: '800' },
  emptyState:     { padding: 28, alignItems: 'center' },
  emptyTitle:     { fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  emptySub:       { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  examplesLabel:  { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  exampleChip:    { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  exampleText:    { fontSize: 13, fontWeight: '500', flex: 1 },
  noResults:      { padding: 40, alignItems: 'center' },
  overlay:        { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  popup:          { borderRadius: 20, borderWidth: 1, maxHeight: '90%', overflow: 'hidden' },
  popupHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 0.5 },
  popupTitle:     { fontSize: 14, fontWeight: '800' },
  clearBtn:       { fontSize: 11, fontWeight: '700' },
  closeBtn:       { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  popupBody:      { padding: 14, gap: 14, paddingBottom: 4 },
  popupFooter:    { padding: 14, borderTopWidth: 0.5 },
  applyBtn:       { backgroundColor: '#7c3aed', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  applyBtnText:   { fontSize: 13, fontWeight: '800', color: '#fff' },
  aiNote:         { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, margin: 12, marginBottom: 0, borderRadius: 10 },
  aiNoteText:     { fontSize: 11, fontWeight: '600', lineHeight: 17, flex: 1 },
  filterGroup:    { gap: 6 },
  filterGroupTitle:{ fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  chipsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  fchip:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', flexDirection: 'row', alignItems: 'center' },
  fchipSel:       { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  fchipText:      { fontSize: 11, fontWeight: '700' },
  // Fix #4 styles — dropdown sits below the search row (toggle row ~33px + search row ~68px = ~101px)
  historyDropdown:{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999, borderRadius: 14, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5, marginHorizontal: 14, marginTop: 4 },
  historyItem:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5 },
  historyText:    { flex: 1, fontSize: 13, fontWeight: '500' },
  // Fix #5 styles
  previewSheet:   { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden', maxHeight: '85%' },
  previewHeader:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 14, borderBottomWidth: 0.5 },
  previewQ:       { fontSize: 15, lineHeight: 24, fontWeight: '500', marginBottom: 10 },
  previewMeta:    { fontSize: 11, fontWeight: '600' },
  previewFooter:  { padding: 14, borderTopWidth: 0.5 },
  previewBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 12, paddingVertical: 13 },
  previewBtnText: { fontSize: 13, fontWeight: '800' },
  // Fix #7 styles
  activeChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#c4b5fd' },
  activeChipText: { fontSize: 10, fontWeight: '800', color: '#7c3aed' },
  // AI Smart Filter chip styles
  aiChip:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: '#f3f0ff', borderWidth: 1, borderColor: '#c4b5fd' },
  aiChipText:     { fontSize: 10, fontWeight: '800', color: '#6d28d9' },
});








