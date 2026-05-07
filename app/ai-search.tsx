/**
 * AI Search Tab
 * Gemini expands the user's query into keywords, then searches Supabase.
 * All filters use FLAT BOOLEAN COLUMNS on the questions table — never JSONB.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView,
  FlatList, Modal, Pressable, ActivityIndicator, Dimensions, Platform,
  KeyboardAvoidingView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Brain, Search, SlidersHorizontal, X, ChevronRight,
  Sparkles, Filter, Clock, ChevronUp, ChevronDown, BookOpen, Target, Zap,
  TrendingUp, BarChart2, Flame,
} from 'lucide-react-native';
import { PinchGestureHandler, State as GHState } from 'react-native-gesture-handler';
import { FlashcardSvc } from '../src/services/FlashcardService';
import * as Haptics from 'expo-haptics';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiExpandSearchQuery, aiExplainQuestion, type AIInferredFilters } from '../src/services/GeminiService';
import { PageWrapper } from '../src/components/PageWrapper';
import Markdown from 'react-native-markdown-display';
import { AIModelSwitcher } from '../src/components/ai/AIModelSwitcher';
import { SharedQuestionCard } from '../src/components/unified/SharedQuestionCard';
import { getPYQCategorization, buildCanonicalExplanations } from '../src/utils/questionUtils';
import { mergeQuestions } from '../src/utils/merger';
import { QuestionCache } from '../src/services/QuestionCache';
import { buildPredictive, probableHotsFor2026, type PredictiveRow } from '../src/lib/pyqPredictive';
import { StudentSync } from '../src/services/StudentSync';
import { NotebookLocationPicker } from '../src/components/NotebookLocationPicker';
import { AddToFlashcardSheet } from '../src/components/flashcards/AddToFlashcardSheet';
import { fetchBestAnswer, type BestAnswer } from '../src/services/BestAnswerService';
import { LocalQuery } from '../src/services/LocalQuery';
import { buildMarkdownStyles, buildMarkdownRules } from '../src/utils/markdownUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IPAD = SCREEN_WIDTH >= 768;

// ── Types ────────────────────────────────────────────────────────────────────

type SearchEngineMode = 'AI' | 'Matching' | 'Exact';

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
  tests?: { institute?: string; series?: string; program_name?: string };
  // Merger outputs
  _explanations?: Array<{ source: string; program: string; text: string; year: string; answer: string }>;
  _institutes?: string[];
  _mergedIds?: string[];
  _searchTier?: number;
};

type Filters = {
  searchMode:    'Matching' | 'Exact';
  searchAcross:  'Questions' | 'Explanations' | 'Questions+Options' | 'Notes';
  stage:         string;   // 'All' | 'Prelims' | 'Mains'
  institutes:    string;   // 'All' | comma-separated
  pyqFilter:     string;   // 'All' | 'PYQ Only' | 'Non-PYQ'
  examCategory:  string;   // 'All' | 'UPSC' | 'Allied' | 'Others'
  ncertFilter:   string;   // 'All' | 'NCERT Only' | 'Non-NCERT'
  subjects:      string;   // 'All' | comma-separated
  sections:      string;   // 'All' | comma-separated (section_group)
  microtopics:   string;   // 'All' | comma-separated
  yearRange:     string;   // '' | 'YYYY' | 'YYYY,YYYY'
};

const DEFAULT_FILTERS: Filters = {
  searchMode:   'Matching',
  searchAcross: 'Questions',
  stage:        'All',
  institutes:   'All',
  pyqFilter:    'All',
  examCategory: 'All',
  ncertFilter:  'All',
  subjects:     'All',
  sections:     'All',
  microtopics:  'All',
  yearRange:    '',
};

type SortMode = 'Relevance' | 'Year' | 'Subject';

// ── Helpers ──────────────────────────────────────────────────────────────────

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.searchMode !== 'Matching')    n++;
  if (f.searchAcross !== 'Questions') n++;
  if (f.stage !== 'All')              n++;
  if (f.institutes !== 'All')         n++;
  if (f.pyqFilter !== 'All')          n++;
  if (f.examCategory !== 'All')       n++;
  if (f.ncertFilter !== 'All')        n++;
  if (f.subjects !== 'All')           n++;
  if (f.sections !== 'All')           n++;
  if (f.microtopics !== 'All')        n++;
  if (f.yearRange)                    n++;
  return n;
}

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
function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  const kws = keywords.slice(0, 3).filter(k => k.length > 2);
  if (!kws.length) return text;
  const escaped = kws.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part)
      ? <Text key={i} style={{ fontWeight: '800', color: '#f59e0b', backgroundColor: '#fef3c720' }}>{part}</Text>
      : <Text key={i}>{part}</Text>
  );
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

  // PYQ Widget — hot topics from predictive analysis
  const [pyqHotTopics, setPyqHotTopics] = useState<PredictiveRow[]>([]);

  // Fix #2 — sidebar subject filter (separate from filters.subjects)
  const [sidebarSubjectFilter, setSidebarSubjectFilter] = useState<string | null>(null);

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
  const [previewFlashcard, setPreviewFlashcard] = useState(false);
  const [savingFlashcard, setSavingFlashcard] = useState(false);
  const [userTags, setUserTags] = useState<string[]>([]);

  // Notebook states for "Add to Notebook" parity
  const [notebookModalVisible, setNotebookModalVisible] = useState(false);
  const [selectedNotebook, setSelectedNotebook] = useState<{ node_id: string; note_id: string; title: string; folder_id: string | null } | null>(null);
  const [previewNotebookDraft, setPreviewNotebookDraft] = useState<string>('');
  const [isSavingToNotebook, setIsSavingToNotebook] = useState(false);

  // Flashcard placement sheet (same flow as full quiz engine)
  const [aff, setAff] = useState<{
    visible: boolean;
    cardId: string | null;
    hint: { subject?: string; section_group?: string; microtopic?: string };
  }>({
    visible: false,
    cardId: null,
    hint: { subject: 'General', section_group: 'General', microtopic: 'General' },
  });

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

  const closePreviewModal = React.useCallback(() => {
    flashcardOpLockRef.current = false;
    setSavingFlashcard(false);
    setAiExplainLoading(false);
    setNotebookModalVisible(false);
    setAff(prev => ({ ...prev, visible: false }));
    setPreviewQuestion(null);
    setPreviewRevealed(false);
  }, []);

  // Fetch real user revision tags for the study tags section
  React.useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from('question_states')
      .select('review_tags')
      .eq('user_id', session.user.id)
      .not('review_tags', 'is', null)
      .then(({ data }) => {
        const tags = new Set<string>();
        data?.forEach(row => {
          if (Array.isArray(row.review_tags)) {
            row.review_tags.forEach(t => tags.add(t));
          }
        });
        const list = Array.from(tags).sort();
        if (list.length === 0) {
          setUserTags(['Guessed', 'Silly Mistake', 'Must Revise', 'Time Mgmt', 'Imp. Fact']);
        } else {
          setUserTags(list);
        }
      });
  }, [session?.user?.id]);

  // When popup opens: fetch full explanation data for every _mergedId so all
  // linked institute answers are guaranteed to appear — same as Arena pipeline
  React.useEffect(() => {
    if (!previewQuestion) {
      setEnrichedExplanations(null);
      setPreviewAnswer(null);
      setPreviewExplSource('all');
      setPreviewStudyTags([]);
      setPreviewFlashcard(false);
      setAiExplanation(null);
      setSelectedNotebook(null);
      setPreviewNotebookDraft('');
      return;
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

    // Sync flashcard state and tags with backend
    if (previewQuestion && session?.user?.id) {
      // 1. Check flashcard status (same relation-based lookup as full engine)
      supabase
        .from('user_cards')
        .select('cards!inner(question_id)')
        .eq('user_id', session.user.id)
        .in('cards.question_id', [previewQuestion.id])
        .then(({ data }) => {
          setPreviewFlashcard(!!(data && data.length > 0));
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
        .catch(err => console.error("Tag sync check failed:", err));
    }
  }, [previewQuestion?.id]);

  const handleToggleTag = async (qid: string, currentTags: string[], tag: string) => {
    if (!session?.user?.id) return;
    const newTags = currentTags.includes(tag) 
      ? currentTags.filter(t => t !== tag) 
      : [...currentTags, tag];
    
    setPreviewStudyTags(newTags);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    try {
      // Sync to backend via StudentSync (consistent with Engine format)
      await StudentSync.enqueue('question_state', {
        userId: session.user.id,
        questionId: qid,
        patch: { review_tags: newTags }
      });
    } catch (err) {
      console.error("Tag Sync Error:", err);
    }
  };

  const handlePickNotebook = async (notebook: { node_id: string; note_id: string; title: string; folder_id: string | null }) => {
    setSelectedNotebook(notebook);
    setNotebookModalVisible(false);

    if (!previewQuestion) return;

    setIsSavingToNotebook(true);
    try {
      const activeText = previewNotebookDraft
        || (previewExplSource === 'ai' ? aiExplanation : null)
        || (previewExplSource === 'vitamin' ? (bestAnswers[previewQuestion.id]?.answer_text || '') : null)
        || buildCanonicalExplanations(previewQuestion as any).find((e: any) => e.sourceKey === previewExplSource)?.text
        || previewQuestion.explanation_markdown
        || '';

      const { data: noteData, error: fetchError } = await LocalQuery
        .from('user_notes')
        .select('items')
        .eq('id', notebook.note_id)
        .single();

      if (fetchError) throw fetchError;

      const currentItems = Array.isArray(noteData?.items) ? noteData.items : [];
      const newItems = [...currentItems];
      const heading = previewQuestion.micro_topic || 'General';

      if (heading && heading !== 'General') {
        const headingExists = newItems.some((i: any) => i.type === 'microTopicHeading' && i.text === heading);
        if (!headingExists) {
          newItems.push({
            id: Date.now().toString() + '-h',
            type: 'microTopicHeading',
            text: heading,
            addedAt: new Date().toISOString(),
          });
        }
      }

      newItems.push({
        id: (Date.now() + 1).toString(),
        type: 'highlight',
        text: activeText,
        color: '#FFB74D',
        source: `AI Search Preview / ${previewQuestion.subject || previewQuestion.exam_group || 'Practice'} ${previewQuestion.exam_year || ''}`.trim(),
        addedAt: new Date().toISOString(),
      });

      const { error: updateError } = await supabase
        .from('user_notes')
        .update({
          items: newItems,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notebook.note_id);

      if (updateError) throw updateError;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setPreviewNotebookDraft('');
      Alert.alert('Success', 'Study text saved to Text Section.');
    } catch (err: any) {
      console.error('Notebook Save Error:', err);
      Alert.alert('Error', 'Failed to save to Text Section: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingToNotebook(false);
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

  const handleAddToFlashcards = async (qArg?: any) => {
    if (!session?.user?.id) return;
    const q = (qArg || previewQuestion) as SearchResult | null;
    if (!q) return;
    if (flashcardOpLockRef.current || savingFlashcard) return;

    flashcardOpLockRef.current = true;
    setSavingFlashcard(true);

    const hint = {
      subject: q.subject || 'General',
      section_group: (q as any).section_group || (q as any).sectionGroup || 'General',
      microtopic: (q as any).micro_topic || (q as any).microtopic || (q as any).microTopic || 'General',
    };

    try {
      // Same flow as full quiz engine: create/resolve card first, then open AddToFlashcardSheet.
      const explanations = buildCanonicalExplanations(q as any);
      const activeExplText = previewExplSource === 'ai'
        ? aiExplanation
        : previewExplSource === 'vitamin'
          ? (bestAnswers[q.id]?.answer_text || '')
          : explanations.find((e: any) => e.sourceKey === previewExplSource)?.text || q.explanation_markdown || '';

      const wasAlreadySaved = previewFlashcard;
      const cardId = await FlashcardSvc.createFromQuestion(session.user.id, q as any, activeExplText || undefined);

      // If user closed preview while async work was in flight, don't mount overlays on top.
      if (previewQuestionIdRef.current !== q.id) return;

      setPreviewFlashcard(true);
      setAff({ visible: true, cardId, hint });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

      if (wasAlreadySaved) {
        Alert.alert('Already saved to flashcards');
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      const duplicate = /duplicate key value|uq_user_cards_user_card|23505/i.test(msg);
      if (duplicate) {
        try {
          const { data: existingCard } = await supabase
            .from('cards')
            .select('id')
            .eq('question_id', q.id)
            .maybeSingle();

          if (existingCard?.id && previewQuestionIdRef.current === q.id) {
            setPreviewFlashcard(true);
            setAff({ visible: true, cardId: existingCard.id, hint });
            Alert.alert('Already saved to flashcards');
          } else {
            Alert.alert('Already saved to flashcards');
          }
        } catch {
          Alert.alert('Already saved to flashcards');
        }
      } else {
        console.error('Flashcard Error:', err);
        Alert.alert('Error', 'Failed to add to Flashcards. ' + msg);
      }
    } finally {
      flashcardOpLockRef.current = false;
      setSavingFlashcard(false);
    }
  };

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
        .from('questions').select('subject').not('subject', 'is', null).limit(1000);
      if (subData) {
        const unique = [...new Set(subData.map((r: any) => r.subject).filter(Boolean))].sort() as string[];
        setSubjectOptions(unique);
      }
      const { data: instData } = await supabase
        .from('tests').select('institute').not('institute', 'is', null).limit(300);
      if (instData) {
        const unique = [...new Set(instData.map((r: any) => r.institute).filter(Boolean))].sort() as string[];
        setInstituteOptions(unique);
      }
      const raw = await AsyncStorage.getItem('ai_search_history');
      if (raw) setSearchHistory(JSON.parse(raw));

      // PYQ hot topics — fetch last 6 years of PYQs and run predictive analysis
      const { data: pyqData } = await supabase
        .from('questions')
        .select('subject, section_group, micro_topic, exam_year, is_pyq')
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
  }, []);

  // ── Load sections when subject changes ────────────────────────────────────
  useEffect(() => {
    const subs = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split(',').filter(Boolean) : [];
    if (subs.length === 0) { setSectionOptions([]); setMicrotopicOptions([]); return; }
    supabase.from('questions').select('section_group, micro_topic').in('subject', subs).limit(2000).then(({ data }) => {
      if (!data) return;
      const secs = [...new Set(data.map((r: any) => r.section_group).filter(Boolean))].sort() as string[];
      setSectionOptions(secs);
    });
  }, [pendingFilters.subjects]);

  // ── Load microtopics when section changes ─────────────────────────────────
  useEffect(() => {
    const subs = pendingFilters.subjects !== 'All' ? pendingFilters.subjects.split(',').filter(Boolean) : [];
    const secs = pendingFilters.sections !== 'All' ? pendingFilters.sections.split(',').filter(Boolean) : [];
    if (subs.length === 0 || secs.length === 0) { setMicrotopicOptions([]); return; }
    supabase.from('questions').select('micro_topic').in('subject', subs).in('section_group', secs).not('micro_topic', 'is', null).limit(2000).then(({ data }) => {
      if (!data) return;
      const mts = [...new Set(data.map((r: any) => r.micro_topic).filter(Boolean))].sort() as string[];
      setMicrotopicOptions(mts);
    });
  }, [pendingFilters.subjects, pendingFilters.sections]);

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
        let q2 = dbQuery;
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
        // Year range (manual or AI-inferred)
        const yearStr = yearOverride ?? (af.yearRange || null);
        if (yearStr) {
          if (yearStr.includes(',')) q2 = q2.in('exam_year', yearStr.split(',').map(Number));
          else q2 = q2.eq('exam_year', parseInt(yearStr, 10));
        }
        // Stage + institutes (joint subquery)
        const stageActive = af.stage && af.stage !== 'All';
        const instList = af.institutes !== 'All' ? af.institutes.split(',').filter(Boolean) : [];
        if (stageActive || instList.length > 0) {
          let testsQ = supabase.from('tests').select('id');
          if (stageActive) testsQ = testsQ.ilike('series', `%${af.stage}%`);
          if (instList.length > 0) testsQ = testsQ.in('institute', instList);
          const { data: testRows } = await testsQ;
          const testIds = (testRows || []).map((t: any) => t.id);
          q2 = testIds.length > 0 ? q2.in('test_id', testIds) : q2.in('test_id', ['__NO_MATCH__']);
        }
        return q2;
      };

      const BASE_SELECT = `id,question_text,correct_answer,options,explanation_markdown,
        subject,section_group,micro_topic,
        is_pyq,is_ncert,is_upsc_cse,is_allied,is_others,exam_year,exam_group,exam_stage,
        test_id,tests(institute,series,program_name)`;

      // ─────────────────────────────────────────────────────────────────────
      // EXACT MODE: literal phrase match only
      // ─────────────────────────────────────────────────────────────────────
      if (mode === 'Exact') {
        const term = q.trim();
        setKeywords([term]);
        let field = 'question_text';
        if (activeFilters.searchAcross === 'Explanations') field = 'explanation_markdown';
        let dbQ = supabase.from('questions').select(BASE_SELECT)
          .ilike(field, `%${term}%`).limit(80);
        dbQ = await applyFilters(dbQ, activeFilters);
        const { data, error } = await dbQ;
        if (error) throw error;
        const raw = (data || []) as unknown as SearchResult[];
        const { mergedQs } = mergeQuestions(raw as any);
        setResults(mergedQs as SearchResult[]);
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // MATCHING MODE: cache-first + fuzzy Supabase (no AI)
      // ─────────────────────────────────────────────────────────────────────
      if (mode === 'Matching') {
        setKeywords([q.trim()]);
        const cacheMode = activeFilters.searchMode === 'Exact' ? 'Exact' : 'Matching';
        const cacheFields = activeFilters.searchAcross === 'Explanations'
          ? ['Explanations'] : ['Questions'];

        // 1) Cache-first
        let localResults = await QuestionCache.searchLocal(q.trim(), cacheMode, cacheFields) as any[];
        // Apply hard filters to cache results
        const subList = activeFilters.subjects !== 'All' ? activeFilters.subjects.split(',') : [];
        const secList = activeFilters.sections !== 'All' ? activeFilters.sections.split(',') : [];
        const mtList  = activeFilters.microtopics !== 'All' ? activeFilters.microtopics.split(',') : [];
        if (subList.length) localResults = localResults.filter((r: any) => subList.includes(r.subject));
        if (secList.length) localResults = localResults.filter((r: any) => secList.includes(r.section_group));
        if (mtList.length)  localResults = localResults.filter((r: any) => mtList.includes(r.micro_topic));
        if (activeFilters.pyqFilter === 'PYQ Only')  localResults = localResults.filter((r: any) => r.is_pyq);
        if (activeFilters.pyqFilter === 'Non-PYQ')   localResults = localResults.filter((r: any) => !r.is_pyq);
        if (activeFilters.ncertFilter === 'NCERT Only') localResults = localResults.filter((r: any) => r.is_ncert);

        // 2) Remote: main + fuzzy fallback
        const term = q.trim();
        let conditions: string[] = [];
        if (activeFilters.searchAcross === 'Explanations') {
          conditions = [`explanation_markdown.ilike.%${term}%`];
        } else {
          conditions = [`question_text.ilike.%${term}%`];
          // Add fuzzy patterns for 1-char tolerance
          if (term.length > 3) {
            for (let i = 1; i < term.length - 1; i++) {
              const pattern = term.slice(0, i) + '%' + term.slice(i + 1);
              conditions.push(`question_text.ilike.%${pattern}%`);
            }
          }
        }
        let dbQ = supabase.from('questions').select(BASE_SELECT)
          .or(conditions.slice(0, 10).join(','))
          .limit(60);
        dbQ = await applyFilters(dbQ, activeFilters);
        const { data: remote } = await dbQ;

        // Merge
        const localIds = new Set(localResults.map((r: any) => r.id));
        const merged = [...localResults, ...(remote || []).filter((r: any) => !localIds.has(r.id))];

        // Sort: exact match first, then PYQ rank, then year
        const sorted = merged.sort((a: any, b: any) => {
          const at = (a.question_text || '').toLowerCase();
          const bt = (b.question_text || '').toLowerCase();
          const tl = term.toLowerCase();
          const ae = at.includes(tl), be = bt.includes(tl);
          if (ae && !be) return -1; if (!ae && be) return 1;
          const rank = (q: any) => q.is_upsc_cse ? 3 : q.is_allied ? 2 : q.is_pyq ? 1 : 0;
          const rd = rank(b) - rank(a); if (rd !== 0) return rd;
          return (b.exam_year || 0) - (a.exam_year || 0);
        });
        const { mergedQs } = mergeQuestions(sorted as any);
        setResults(mergedQs as SearchResult[]);
        return;
      }

      // ─────────────────────────────────────────────────────────────────────
      // AI MODE: Hybrid ranking pipeline
      //
      // Priority tiers (fetched in order, merged with dedup):
      //   Tier 0 — Exact original phrase match (highest priority)
      //   Tier 1 — All AI keywords matched together (AND-like, using multi-word)
      //   Tier 2 — Individual AI keyword matches (OR across each keyword)
      //   Tier 3 — Remaining fuzzy AI keyword matches (lowest priority)
      //
      // This guarantees the user's literal intent always surfaces first,
      // followed by AI-expanded semantic matches as supplementary results.
      // ─────────────────────────────────────────────────────────────────────
      const aiResult = await aiExpandSearchQuery(q.trim());
      const displayKeywords = aiResult.keywords;

      // Merge AI-inferred filters with user-chosen filters (user-chosen take priority)
      const mergedFilters: Filters = { ...activeFilters };
      if (aiResult.filters.subject      && activeFilters.subjects     === 'All') mergedFilters.subjects     = aiResult.filters.subject;
      if (aiResult.filters.stage        && activeFilters.stage        === 'All') mergedFilters.stage        = aiResult.filters.stage;
      if (aiResult.filters.pyqFilter    && activeFilters.pyqFilter    === 'All') mergedFilters.pyqFilter    = aiResult.filters.pyqFilter;
      if (aiResult.filters.examCategory && activeFilters.examCategory === 'All') mergedFilters.examCategory = aiResult.filters.examCategory;
      if (aiResult.filters.ncertFilter  && activeFilters.ncertFilter  === 'All') mergedFilters.ncertFilter  = aiResult.filters.ncertFilter;

      const aiYear = aiResult.filters.specificYear || null;
      setAiInferredFilters(aiResult.filters);
      setFilters(mergedFilters);
      activeFilters = mergedFilters;

      setKeywords(displayKeywords);
      if (displayKeywords.length === 0) { setLoading(false); return; }

      // The raw query text the user typed — used for exact-phrase tier
      const rawTerm = q.trim();
      const field = activeFilters.searchAcross === 'Explanations'
        ? 'explanation_markdown'
        : 'question_text';

      // Dedup accumulator — preserves insertion order (= priority order)
      const seenIds = new Set<string>();
      const priorityResults: SearchResult[] = [];

      // Extract user words for Exact Keyword matching (words > 2 chars)
      const userWords = rawTerm.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);

      const addBatch = (rows: SearchResult[]) => {
        for (const r of rows) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            priorityResults.push(r);
          }
        }
      };

      // ── TIER 0: Exact original phrase ─────────────────────────────────────
      // Highest confidence: the user's literal input is present verbatim.
      {
        let dbQ = supabase.from('questions').select(BASE_SELECT)
          .ilike(field, `%${rawTerm}%`)
          .limit(40);
        dbQ = await applyFilters(dbQ, activeFilters, aiYear);
        const { data } = await dbQ;
        addBatch((data || []) as unknown as SearchResult[]);
      }

      // ── TIER 1: Exact keyword matches (All User Words) ─────────────────────
      // User's own typed keywords, matched as AND
      if (userWords.length > 1) {
        let dbQ: any = supabase.from('questions').select(BASE_SELECT).limit(30);
        for (const w of userWords) {
          dbQ = dbQ.ilike(field, `%${w}%`);
        }
        dbQ = await applyFilters(dbQ, activeFilters, aiYear);
        const { data } = await dbQ;
        addBatch((data || []) as unknown as SearchResult[]);
      }

      // ── TIER 2: Fuzzy keyword matches (Any User Word) ──────────────────────
      // User's own typed keywords, matched as OR
      for (const w of userWords) {
        if (priorityResults.length >= 60) break; // Cap
        let dbQ = supabase.from('questions').select(BASE_SELECT)
          .ilike(field, `%${w}%`)
          .limit(10);
        dbQ = await applyFilters(dbQ, activeFilters, aiYear);
        const { data } = await dbQ;
        addBatch((data || []) as unknown as SearchResult[]);
      }

      // ── TIER 3: Multi-keyword AND simulation (AI Words) ──────────────────
      // Questions that contain ALL of the first 3 AI keywords are more
      // relevant than those containing only some of them.
      const safeKws = displayKeywords.slice(0, 12);
      const topKws = safeKws.slice(0, 3);
      if (topKws.length > 1) {
        // Build an AND filter by chaining multiple .ilike() calls
        let dbQ: any = supabase.from('questions').select(BASE_SELECT).limit(30);
        for (const kw of topKws) {
          dbQ = dbQ.ilike(field, `%${kw}%`);
        }
        dbQ = await applyFilters(dbQ, activeFilters, aiYear);
        const { data } = await dbQ;
        addBatch((data || []) as unknown as SearchResult[]);
      }

      // ── TIER 4: Individual AI keyword OR queries ──────────────────────────
      // Each keyword searched independently and added in keyword order,
      // so earlier (higher-confidence) AI keywords get priority.
      for (const kw of safeKws) {
        if (priorityResults.length >= 80) break; // cap total
        let dbQ = supabase.from('questions').select(BASE_SELECT)
          .ilike(field, `%${kw}%`)
          .limit(20);
        dbQ = await applyFilters(dbQ, activeFilters, aiYear);
        const { data } = await dbQ;
        addBatch((data || []) as unknown as SearchResult[]);
      }

      // Deduplicate across merged question variants
      const { mergedQs } = mergeQuestions(priorityResults as any);

      // Attach a search-rank score for the final sort step
      const rawTermLower = rawTerm.toLowerCase();
      const topKwsLower = topKws.map(k => k.toLowerCase());

      const getSearchTier = (r: any): number => {
        const text = ((r.question_text || '') + ' ' + (r.explanation_markdown || '')).toLowerCase();
        
        // Tier 0: Exact phrase
        if (text.includes(rawTermLower)) return 0;
        
        // Tier 1: All user keywords (Exact keyword match)
        if (userWords.length > 1 && userWords.every(w => text.includes(w))) return 1;
        
        // Tier 2: Fuzzy match (at least half of user keywords)
        const matchCount = userWords.filter(w => text.includes(w)).length;
        if (userWords.length > 0 && matchCount >= Math.ceil(userWords.length / 2)) return 2;
        
        // Tier 3: All AI keywords
        if (topKwsLower.length > 0 && topKwsLower.every(k => text.includes(k))) return 3;
        
        // Tier 4: AI semantic / Any AI keyword
        return 4;
      };

      // Stamp each result with its tier (used in sortedResults)
      const stamped = mergedQs.map((r: any) => ({ ...r, _searchTier: getSearchTier(r) }));
      setResults(stamped as SearchResult[]);

    } catch (e: any) {
      const msg: string = e?.message || 'Unknown error';
      if (msg.includes('No Gemini API key found') || msg.includes('No Groq API key found')) {
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

  // ── Sorted results (Hybrid ranking) ──────────────────────────────────────
  //
  // When sortMode === 'Relevance', results are ranked by a 3-level key:
  //   1. Search tier  (0=exact phrase, 1=all top kws, 2=any top kw, 3=AI-only)
  //   2. PYQ tier     (UPSC CSE PYQ > Allied PYQ > Others PYQ > Practice)
  //   3. Exam year    (newer first)
  //
  // This ensures the user's exact typed phrase always floats to the top,
  // followed by questions matching all their keywords, then individual
  // keyword matches, and finally AI-semantic-only retrievals at the bottom.
  const sortedResults = React.useMemo(() => {
    if (sortMode === 'Year') {
      return [...results].sort((a, b) => (b.exam_year || 0) - (a.exam_year || 0));
    }
    if (sortMode === 'Subject') {
      return [...results].sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
    }
    // PYQ relevance tier (lower = more relevant)
    const pyqTier = (r: SearchResult): number => {
      if (r.is_pyq && r.is_upsc_cse) return 0;
      if (r.is_pyq && r.is_allied)   return 1;
      if (r.is_pyq && r.is_others)   return 2;
      if (r.is_pyq)                  return 3;
      return 4;
    };
    return [...results].sort((a: any, b: any) => {
      // Primary: search-match tier (exact phrase first, AI-semantic last)
      const sTierA = a._searchTier ?? 3;
      const sTierB = b._searchTier ?? 3;
      if (sTierA !== sTierB) return sTierA - sTierB;

      // Secondary: PYQ relevance
      const ptd = pyqTier(a) - pyqTier(b);
      if (ptd !== 0) return ptd;

      // Tertiary: exam year (newer first)
      return (b.exam_year || 0) - (a.exam_year || 0);
    });
  }, [results, sortMode]);

  // ── Filter popup ──────────────────────────────────────────────────────────

  const openFilterPopup = () => {
    setPendingFilters({ ...filters });
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    setFilterOpen(false);
    if (hasSearched && query.trim()) runSearch(query, pendingFilters);
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
        initialId: item.id,
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
    const synthExamInfo = {
      is_upsc_cse:  item.is_upsc_cse,
      is_allied:    item.is_allied,
      is_others:    item.is_others,
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
          {/* Enhancement 1 — keyword highlighting in question text */}
          <Text style={[styles.cardText, { color: colors.textPrimary }]} numberOfLines={3}>
            {keywords.length > 0 ? highlightKeywords(item.question_text, keywords) : item.question_text}
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
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
          Ask in plain language.{'\n'}Gemini maps intent → filters + keywords,{'\n'}then searches across all questions.
        </Text>

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
    <View style={[
      IS_IPAD ? styles.leftPanel : styles.phoneKeywordsPanel,
      { backgroundColor: IS_IPAD ? colors.surface : colors.bg, borderRightColor: colors.border },
    ]}>
      {keywords.length > 0 && (
        <>
          {/* Fix #6 — collapsible keywords */}
          <TouchableOpacity
            onPress={() => setKeywordsExpanded(e => !e)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 }}
          >
            <Sparkles size={11} color="#7c3aed" />
            <Text style={[styles.panelLabel, { color: '#7c3aed', marginBottom: 0, flex: 1 }]}>
              {keywords.length} AI KEYWORDS USED
            </Text>
            {keywordsExpanded
              ? <ChevronUp size={13} color={colors.textTertiary} />
              : <ChevronDown size={13} color={colors.textTertiary} />
            }
          </TouchableOpacity>
          {keywordsExpanded && renderKeywordPills()}
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
          {[...new Set(results.map(r => r.subject).filter(Boolean))].length > 1 && (
            <>
              <Text style={[styles.panelLabel, { color: colors.textTertiary, marginTop: 14 }]}>BY SUBJECT</Text>
              {/* Fix #2 - clear chip */}
              {sidebarSubjectFilter && (
                <TouchableOpacity
                  style={[styles.subjectChip, { borderColor: '#ef4444', backgroundColor: '#fee2e2' }]}
                  onPress={() => {
                    setSidebarSubjectFilter(null);
                    const newFilters = { ...filters, subjects: 'All' };
                    setFilters(newFilters);
                    runSearch(query, newFilters);
                  }}
                >
                  <X size={10} color="#ef4444" />
                  <Text style={[styles.subjectChipText, { color: '#ef4444' }]}>Clear: {sidebarSubjectFilter}</Text>
                </TouchableOpacity>
              )}
              {[...new Set(results.map(r => r.subject).filter(Boolean))].map(sub => {
                const count = results.filter(r => r.subject === sub).length;
                const color = getSubjectColor(sub as string);
                const isSelected = sidebarSubjectFilter === sub;
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subjectChip, {
                      borderColor: isSelected ? '#7c3aed' : colors.border,
                      backgroundColor: isSelected ? '#ede9fe' : colors.surface,
                    }]}
                    onPress={() => {
                      const isSame = sidebarSubjectFilter === sub;
                      const newSub = isSame ? 'All' : sub as string;
                      setSidebarSubjectFilter(isSame ? null : sub as string);
                      const newFilters = { ...filters, subjects: newSub };
                      setFilters(newFilters);
                      runSearch(query, newFilters);
                    }}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: color }]} />
                    <Text style={[styles.subjectChipText, { color: isSelected ? '#7c3aed' : colors.textSecondary }]}>{sub}</Text>
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
                  borderColor: filters.pyqFilter === opt ? '#c4b5fd' : colors.border,
                  backgroundColor: filters.pyqFilter === opt ? '#ede9fe' : colors.surface,
                },
              ]}
              onPress={() => {
                const newFilters = { ...filters, pyqFilter: opt };
                setFilters(newFilters);
                if (hasSearched) runSearch(query, newFilters);
              }}
            >
              <Text style={[styles.subjectChipText, {
                color: filters.pyqFilter === opt ? '#7c3aed' : colors.textSecondary,
                fontWeight: filters.pyqFilter === opt ? '800' : '600',
              }]}>{opt}</Text>
            </TouchableOpacity>
          ))}

          {/* Institute breakdown in results */}
          {(() => {
            const instInResults = results
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
                  const isSelected = filters.institutes.split(',').includes(inst);
                  return (
                    <TouchableOpacity
                      key={inst}
                      style={[styles.subjectChip, {
                        borderColor: isSelected ? '#7c3aed' : colors.border,
                        backgroundColor: isSelected ? '#ede9fe' : colors.surface,
                      }]}
                      onPress={() => {
                        const list = filters.institutes === 'All' ? [] : filters.institutes.split(',').filter(Boolean);
                        const next = isSelected ? list.filter(i => i !== inst) : [...list, inst];
                        const newFilters = { ...filters, institutes: next.length ? next.join(',') : 'All' };
                        setFilters(newFilters);
                        runSearch(query, newFilters);
                      }}
                    >
                      <View style={[styles.subjectDot, { backgroundColor: '#7c3aed' }]} />
                      <Text style={[styles.subjectChipText, { color: isSelected ? '#7c3aed' : colors.textSecondary }]}>{inst}</Text>
                      <Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{count}</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            );
          })()}
        </>
      )}
    </View>
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
          style={[styles.popup, { backgroundColor: colors.surface, borderColor: colors.border }]}
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

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.popupBody}>

            <FilterGroup
              label="SEARCH MODE"
              options={['Matching', 'Exact']}
              value={pendingFilters.searchMode}
              onSelect={(v) => setPendingFilters(p => ({ ...p, searchMode: v as any }))}
              colors={colors}
            />

            <FilterGroup
              label="SEARCH ACROSS"
              options={['Questions', 'Explanations', 'Questions+Options']}
              value={pendingFilters.searchAcross}
              onSelect={(v) => setPendingFilters(p => ({ ...p, searchAcross: v as any }))}
              colors={colors}
            />

            <FilterGroup
              label="EXAM STAGE"
              options={['All', 'Prelims', 'Mains']}
              value={pendingFilters.stage}
              onSelect={(v) => setPendingFilters(p => ({ ...p, stage: v }))}
              colors={colors}
            />

            <FilterGroup
              label="PYQ FILTER"
              options={['All', 'PYQ Only', 'Non-PYQ']}
              value={pendingFilters.pyqFilter}
              onSelect={(v) => setPendingFilters(p => ({ ...p, pyqFilter: v }))}
              colors={colors}
            />

            <FilterGroup
              label="EXAM CATEGORY"
              options={['All', 'UPSC', 'Allied', 'Others']}
              value={pendingFilters.examCategory}
              onSelect={(v) => setPendingFilters(p => ({ ...p, examCategory: v }))}
              colors={colors}
            />

            <FilterGroup
              label="CURRICULUM"
              options={['All', 'NCERT Only', 'Non-NCERT']}
              value={pendingFilters.ncertFilter}
              onSelect={(v) => setPendingFilters(p => ({ ...p, ncertFilter: v }))}
              colors={colors}
            />

            {/* Institutes — dynamically loaded from tests table */}
            {instituteOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>INSTITUTES</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, institutes: 'All' }))}
                    style={[styles.fchip, pendingFilters.institutes === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.institutes === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Subjects — dynamically loaded from questions table */}
            {subjectOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SUBJECTS</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, subjects: 'All', sections: 'All', microtopics: 'All' }))}
                    style={[styles.fchip, pendingFilters.subjects === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.subjects === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {subjectOptions.map(sub => {
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Section Groups — shown after subject chosen */}
            {sectionOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SECTION / CHAPTER</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, sections: 'All', microtopics: 'All' }))}
                    style={[styles.fchip, pendingFilters.sections === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.sections === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {sectionOptions.map(sec => {
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Micro Topics — shown after section chosen */}
            {microtopicOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>MICRO TOPIC</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, microtopics: 'All' }))}
                    style={[styles.fchip, pendingFilters.microtopics === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, { color: pendingFilters.microtopics === 'All' ? '#fff' : colors.textSecondary }]}>All</Text>
                  </TouchableOpacity>
                  {microtopicOptions.map(mt => {
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
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

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

  const SearchBar = (
    <View>
      {/* ── 3-Mode Engine Toggle ──────────────────────────────────────────── */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 }}>
        {([
          { mode: 'AI' as SearchEngineMode, icon: <Brain size={12} color={searchEngineMode === 'AI' ? '#fff' : '#7c3aed'} />, label: 'AI' },
          { mode: 'Matching' as SearchEngineMode, icon: <Zap size={12} color={searchEngineMode === 'Matching' ? '#fff' : colors.textSecondary} />, label: 'Fuzzy' },
          { mode: 'Exact' as SearchEngineMode, icon: <Target size={12} color={searchEngineMode === 'Exact' ? '#fff' : colors.textSecondary} />, label: 'Exact' },
        ]).map(({ mode, icon, label }) => (
          <TouchableOpacity
            key={mode}
            onPress={() => {
              setSearchEngineMode(mode);
              if (hasSearched && query.trim()) runSearch(query, filters, mode);
            }}
            testID={`search-mode-${mode.toLowerCase()}`}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 4,
              paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
              backgroundColor: searchEngineMode === mode
                ? (mode === 'AI' ? '#7c3aed' : (mode === 'Matching' ? '#0ea5e9' : '#f59e0b'))
                : colors.surface,
              borderWidth: 1,
              borderColor: searchEngineMode === mode
                ? 'transparent'
                : colors.border,
            }}
          >
            {icon}
            <Text style={{ fontSize: 11, fontWeight: '800', color: searchEngineMode === mode ? '#fff' : colors.textSecondary }}>{label}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 10, color: colors.textTertiary, alignSelf: 'center' }}>
          {searchEngineMode === 'AI' ? 'Gemini understands your intent' : searchEngineMode === 'Matching' ? 'Fuzzy keyword match' : 'Exact phrase only'}
        </Text>
      </View>

      {/* ── Search input row ─────────────────────────────────────────────── */}
      <View style={styles.searchRow}>
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

        <TouchableOpacity
          onPress={() => setShowModelSwitcher(true)}
          style={[styles.filterBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Brain size={18} color="#7c3aed" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={openFilterPopup}
          testID="ai-search-filter-open"
          style={[styles.filterBtn, {
            backgroundColor: activeFilterCount > 0 ? '#ede9fe' : colors.surface,
            borderColor: activeFilterCount > 0 ? '#c4b5fd' : colors.border,
          }]}
        >
          <SlidersHorizontal size={15} color={activeFilterCount > 0 ? '#7c3aed' : colors.textSecondary} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
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
                NATURAL LANGUAGE · GEMINI FLASH · FUZZY + TYPO TOLERANT
              </Text>
            </View>
          </View>
          <View style={[styles.aiBadge, { backgroundColor: '#ede9fe' }]}>
            <Sparkles size={10} color="#7c3aed" />
            <Text style={styles.aiBadgeText}>Semantic</Text>
          </View>
        </View>

        <View style={{ position: 'relative' }}>
          {SearchBar}

          {/* Fix #4 — Search History Dropdown: positioned inside a relative wrapper so it sits below the search bar (toggle row ~33px + search row ~68px = ~101px) */}
          {showHistory && (searchHistory.length > 0 || instituteOptions.length > 0) && (
            <View style={[styles.historyDropdown, {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            }]}>
              {/* Quick institute filter chips */}
              {instituteOptions.length > 0 && (
                <View style={{ paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
                  <Text style={[styles.panelLabel, { color: colors.textTertiary, marginBottom: 6 }]}>FILTER BY INSTITUTE</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                    {instituteOptions.slice(0, 10).map(inst => {
                      const isActive = filters.institutes.split(',').includes(inst);
                      return (
                        <TouchableOpacity
                          key={inst}
                          onPress={() => {
                            const list = filters.institutes === 'All' ? [] : filters.institutes.split(',').filter(Boolean);
                            const next = isActive ? list.filter(i => i !== inst) : [...list, inst];
                            const newFilters = { ...filters, institutes: next.length ? next.join(',') : 'All' };
                            setFilters(newFilters);
                            if (hasSearched && query.trim()) runSearch(query, newFilters);
                          }}
                          style={{
                            marginRight: 6,
                            paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                            backgroundColor: isActive ? '#7c3aed' : colors.surfaceStrong,
                            borderWidth: 1, borderColor: isActive ? '#7c3aed' : colors.border,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? '#fff' : colors.textSecondary }}>{inst}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Recent searches */}
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

        {IS_IPAD ? (
          <View style={styles.ipadBody}>
            {LeftPanel}
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
          </View>
        ) : (
          <FlatList
            data={hasSearched ? sortedResults : []}
            keyExtractor={item => item.id}
            renderItem={renderResultCard}
            ListHeaderComponent={
              <>
                {/* AI Smart Filters chips */}
                {Object.keys(aiInferredFilters).length > 0 && hasSearched && (
                  <View style={{ paddingHorizontal: 12, paddingTop: 6, paddingBottom: 2 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 }}>
                        <Brain size={10} color="#7c3aed" />
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#7c3aed', letterSpacing: 0.8 }}>AI APPLIED</Text>
                      </View>
                      {aiInferredFilters.subject && (
                        <TouchableOpacity style={styles.aiChip} onPress={() => {
                          setAiInferredFilters(prev => { const n = {...prev}; delete n.subject; return n; });
                          const f = { ...filters, subjects: 'All' }; setFilters(f); runSearch(query, f);
                        }}><Text style={styles.aiChipText}>{aiInferredFilters.subject}</Text><X size={8} color="#6d28d9" /></TouchableOpacity>
                      )}
                      {aiInferredFilters.stage && (
                        <TouchableOpacity style={styles.aiChip} onPress={() => {
                          setAiInferredFilters(prev => { const n = {...prev}; delete n.stage; return n; });
                          const f = { ...filters, stage: 'All' }; setFilters(f); runSearch(query, f);
                        }}><Text style={styles.aiChipText}>{aiInferredFilters.stage}</Text><X size={8} color="#6d28d9" /></TouchableOpacity>
                      )}
                      {aiInferredFilters.pyqFilter && (
                        <TouchableOpacity style={styles.aiChip} onPress={() => {
                          setAiInferredFilters(prev => { const n = {...prev}; delete n.pyqFilter; return n; });
                          const f = { ...filters, pyqFilter: 'All' }; setFilters(f); runSearch(query, f);
                        }}><Text style={styles.aiChipText}>{aiInferredFilters.pyqFilter}</Text><X size={8} color="#6d28d9" /></TouchableOpacity>
                      )}
                      {aiInferredFilters.examCategory && (
                        <TouchableOpacity style={styles.aiChip} onPress={() => {
                          setAiInferredFilters(prev => { const n = {...prev}; delete n.examCategory; return n; });
                          const f = { ...filters, examCategory: 'All' }; setFilters(f); runSearch(query, f);
                        }}><Text style={styles.aiChipText}>{aiInferredFilters.examCategory}</Text><X size={8} color="#6d28d9" /></TouchableOpacity>
                      )}
                      {aiInferredFilters.ncertFilter && (
                        <TouchableOpacity style={styles.aiChip} onPress={() => {
                          setAiInferredFilters(prev => { const n = {...prev}; delete n.ncertFilter; return n; });
                          const f = { ...filters, ncertFilter: 'All' }; setFilters(f); runSearch(query, f);
                        }}><Text style={styles.aiChipText}>{aiInferredFilters.ncertFilter}</Text><X size={8} color="#6d28d9" /></TouchableOpacity>
                      )}
                      {aiInferredFilters.specificYear && (
                        <TouchableOpacity style={styles.aiChip} onPress={() => {
                          setAiInferredFilters(prev => { const n = {...prev}; delete n.specificYear; return n; });
                          runSearch(query, filters);
                        }}><Text style={styles.aiChipText}>{aiInferredFilters.specificYear}</Text><X size={8} color="#6d28d9" /></TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
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
                    <SharedQuestionCard
                      item={{
                        ...previewQuestion,
                        exam_info: {
                          is_upsc_cse: previewQuestion?.is_upsc_cse,
                          is_allied: previewQuestion?.is_allied,
                          is_others: previewQuestion?.is_others,
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
                      aiExplanation={aiExplanation}
                      isAiLoading={aiExplainLoading}
                      isSavingFlashcard={savingFlashcard}
                      isFlashcarded={previewFlashcard}
                      onRevealExplanation={() => setPreviewRevealed(true)}
                      onOptionSelect={(qid: string, opt: string) => setPreviewAnswer(opt)}
                      onAddFlashcard={handleAddToFlashcards}
                      onAiExplain={handleAiExplainPopup}
                      bestAnswers={bestAnswers}
                      ensureBestAnswerLoaded={ensureBestAnswerLoaded}
                      showNotebookButton={false}
                      openNotebookFromQuestion={(_: any, activeText?: string) => {
                        setPreviewNotebookDraft(activeText || '');
                        setNotebookModalVisible(true);
                      }}
                    />
                    
                    {previewQuestion.micro_topic && (
                      <View style={{ marginTop: 12, padding: 12, backgroundColor: colors.surfaceStrong, borderRadius: 16, borderWidth: 1, borderColor: colors.border + '50' }}>
                        <Text style={{ fontSize: 10, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1, marginBottom: 4 }}>SYLLABUS CONTEXT</Text>
                        <Text style={{ fontSize: Math.max(11, previewFontSize - 3), color: colors.textSecondary, fontWeight: '600' }}>{previewQuestion.micro_topic}</Text>
                      </View>
                    )}
                  </ScrollView>
                </PinchGestureHandler>

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
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
        <AIModelSwitcher 
          visible={showModelSwitcher} 
          onClose={() => setShowModelSwitcher(false)}
        />

        <NotebookLocationPicker
          visible={notebookModalVisible}
          onClose={() => setNotebookModalVisible(false)}
          userId={session?.user?.id || ''}
          onPickNotebook={handlePickNotebook}
        />

        <AddToFlashcardSheet
          visible={aff.visible}
          onClose={() => setAff((prev) => ({ ...prev, visible: false }))}
          userId={session?.user?.id || ''}
          cardId={aff.cardId}
          hint={aff.hint}
        />
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
  leftPanel:      { width: 240, borderRightWidth: 0.5, padding: 14 },
  phoneKeywordsPanel: { paddingHorizontal: 14, paddingBottom: 4 },
  panelLabel:     { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 },
  pillsWrap:      { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill:           { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  pillText:       { fontSize: 10, fontWeight: '700' },
  statRow:        { flexDirection: 'row', gap: 8 },
  statCard:       { flex: 1, borderRadius: 10, padding: 10 },
  statNum:        { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  statLabel:      { fontSize: 10, fontWeight: '600' },
  subjectChip:    { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 7, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, marginBottom: 4 },
  subjectDot:     { width: 7, height: 7, borderRadius: 4 },
  subjectChipText:{ fontSize: 12, fontWeight: '600', flex: 1 },
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
  fchip:          { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  fchipSel:       { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  fchipText:      { fontSize: 11, fontWeight: '700' },
  // Fix #4 styles — dropdown sits below the search row (toggle row ~33px + search row ~68px = ~101px)
  historyDropdown:{ position: 'absolute', top: 105, left: 14, right: 14, zIndex: 999, borderRadius: 14, borderWidth: 1, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
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
