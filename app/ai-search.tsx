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
  Sparkles, Filter,
} from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { aiExpandSearchQuery } from '../src/services/GeminiService';
import { PageWrapper } from '../src/components/PageWrapper';
import { getPYQCategorization } from './unified/engine';
import { AIModelSwitcher } from '../src/components/ai/AIModelSwitcher';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IPAD = SCREEN_WIDTH >= 768;

// ── Types ────────────────────────────────────────────────────────────────────

type SearchResult = {
  id: string;
  question_text: string;     // flat column name from schema
  correct_answer: string;
  subject?: string;
  section_group?: string;
  micro_topic?: string;
  is_pyq?: boolean;          // flat boolean — canonical
  is_ncert?: boolean;
  is_upsc_cse?: boolean;
  is_allied?: boolean;
  is_others?: boolean;
  exam_year?: number;        // integer in schema
  exam_group?: string;
  exam_stage?: string;
  tests?: { institute?: string; series?: string; program_name?: string };
};

type Filters = {
  searchMode:   'Matching' | 'Exact';
  searchAcross: 'Questions' | 'Explanations' | 'Questions+Options';
  stage:        string;   // 'All' | 'Prelims' | 'Mains'
  institutes:   string;   // 'All' | comma-separated
  pyqFilter:    string;   // 'All' | 'PYQ Only' | 'Non-PYQ'
  examCategory: string;   // 'All' | 'UPSC' | 'Allied' | 'Others'
  ncertFilter:  string;   // 'All' | 'NCERT Only' | 'Non-NCERT'
  subjects:     string;   // 'All' | comma-separated
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

// ── Main Component ───────────────────────────────────────────────────────────

export default function AISearchTab() {
  const { colors } = useTheme();
  const { session } = useAuth();
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

  const [subjectOptions, setSubjectOptions]     = useState<string[]>([]);
  const [instituteOptions, setInstituteOptions] = useState<string[]>([]);

  const inputRef = useRef<TextInput>(null);

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
    })();
  }, []);

  // ── Core search with correct filter logic ─────────────────────────────────

  const runSearch = useCallback(async (q: string, activeFilters: Filters) => {
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setResults([]);

    try {
      // ── STEP 1: Determine search conditions ────────────────────────────────
      let conditions: string[];
      let displayKeywords: string[];

      if (activeFilters.searchMode === 'Exact') {
        // Exact mode: bypass AI expansion, single phrase match
        if (activeFilters.searchAcross === 'Explanations') {
          conditions = [`explanation_markdown.ilike.%${q.trim()}%`];
        } else {
          // Questions or Questions+Options — search question_text
          conditions = [`question_text.ilike.%${q.trim()}%`];
        }
        displayKeywords = [q.trim()];
      } else {
        // Matching mode: AI expands query, OR across keywords
        const kws = await aiExpandSearchQuery(q.trim());
        displayKeywords = kws;

        if (kws.length === 0) {
          setKeywords([]);
          setLoading(false);
          return;
        }

        const safeKws = kws.slice(0, 12); // cap to avoid URL length errors

        if (activeFilters.searchAcross === 'Explanations') {
          conditions = safeKws.map(kw => `explanation_markdown.ilike.%${kw}%`);
        } else if (activeFilters.searchAcross === 'Questions+Options') {
          conditions = safeKws.map(kw => `question_text.ilike.%${kw}%`);
        } else {
          // Questions (default)
          conditions = safeKws.map(kw => `question_text.ilike.%${kw}%`);
        }
      }

      setKeywords(displayKeywords);

      // ── STEP 2: Base query using FLAT COLUMNS (matches Supabase schema) ────
      let dbQuery = supabase
        .from('questions')
        .select(`
          id,
          question_text,
          correct_answer,
          subject,
          section_group,
          micro_topic,
          is_pyq,
          is_ncert,
          is_upsc_cse,
          is_allied,
          is_others,
          exam_year,
          exam_group,
          exam_stage,
          test_id,
          tests(institute, series, program_name)
        `)
        .or(conditions.join(','))
        .limit(60);

      // ── STEP 3: Apply flat-column filters (direct on questions table) ──────

      // PYQ filter — uses is_pyq boolean column (NOT exam_info)
      if (activeFilters.pyqFilter === 'PYQ Only') {
        dbQuery = dbQuery.eq('is_pyq', true);
      } else if (activeFilters.pyqFilter === 'Non-PYQ') {
        dbQuery = dbQuery.eq('is_pyq', false);
      }

      // NCERT filter — NULL means "not tagged" → treat as Non-NCERT
      if (activeFilters.ncertFilter === 'NCERT Only') {
        dbQuery = dbQuery.eq('is_ncert', true);
      } else if (activeFilters.ncertFilter === 'Non-NCERT') {
        dbQuery = dbQuery.or('is_ncert.is.null,is_ncert.eq.false');
      }

      // Exam category — uses flat boolean columns (NOT exam_info jsonb)
      if (activeFilters.examCategory === 'UPSC') {
        dbQuery = dbQuery.eq('is_upsc_cse', true);
      } else if (activeFilters.examCategory === 'Allied') {
        dbQuery = dbQuery.eq('is_allied', true);
      } else if (activeFilters.examCategory === 'Others') {
        dbQuery = dbQuery.eq('is_others', true);
      }

      // Subject filter — exact string match (case-sensitive, use DB values as-is)
      if (activeFilters.subjects !== 'All') {
        const subs = activeFilters.subjects.split(',').filter(Boolean);
        if (subs.length > 0) dbQuery = dbQuery.in('subject', subs);
      }

      // ── STEP 4: Tests-table filters (stage + institutes) ──────────────────
      // IMPORTANT: Combine both into ONE subquery to avoid double .in('test_id')
      // which would silently override the first.

      const stageActive = activeFilters.stage && activeFilters.stage !== 'All';
      const instList = activeFilters.institutes !== 'All'
        ? activeFilters.institutes.split(',').filter(Boolean)
        : [];
      const instActive = instList.length > 0;

      if (stageActive || instActive) {
        let testsQ = supabase.from('tests').select('id');

        // Stage: filter by tests.series using ilike (e.g. "Prelims (Official)" contains "Prelims")
        if (stageActive) testsQ = testsQ.ilike('series', `%${activeFilters.stage}%`);

        // Institute: filter by tests.institute exact match
        if (instActive) testsQ = testsQ.in('institute', instList);

        const { data: testRows } = await testsQ;
        const testIds = (testRows || []).map((t: any) => t.id);

        // If no matching tests found, force zero results (do NOT silently skip the filter)
        dbQuery = testIds.length > 0
          ? dbQuery.in('test_id', testIds)
          : dbQuery.in('test_id', ['__NO_MATCH__']);
      }

      // ── STEP 5: Execute ────────────────────────────────────────────────────
      const { data, error } = await dbQuery;
      if (error) throw error;
      setResults((data || []) as unknown as SearchResult[]);

    } catch (e: any) {
      const msg: string = e?.message || 'Unknown error';
      if (msg.includes('No Gemini API key found')) {
        Alert.alert('Gemini key needed', 'Go to Settings → AI Settings and paste your Gemini key.');
      } else if (msg.includes('No Groq API key found')) {
        Alert.alert('Groq key needed', 'Go to Settings → AI Settings and paste your Groq key.\nFree at console.groq.com');
      } else if (msg.includes('429')) {
        Alert.alert(
          'Quota exceeded',
          'This key has hit its limit. Go to Settings → AI Settings and switch to another key, or switch provider.',
        );
      } else if (msg.includes('404')) {
        Alert.alert('Model not found', 'Go to Settings → AI Settings and switch model.');
      } else {
        Alert.alert('Search failed', msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sorted results ────────────────────────────────────────────────────────

  const sortedResults = React.useMemo(() => {
    if (sortMode === 'Year') {
      return [...results].sort((a, b) => (b.exam_year || 0) - (a.exam_year || 0));
    }
    if (sortMode === 'Subject') {
      return [...results].sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
    }
    return results; // Relevance = DB order
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

  const openQuestion = (item: SearchResult) => {
    router.push({
      pathname: '/unified/engine',
      params: {
        searchQuery: query,
        searchMode: filters.searchMode,
        searchAcross: filters.searchAcross,
        initialId: item.id,
      },
    } as any);
  };

  // ── Result card ───────────────────────────────────────────────────────────

  const renderResultCard = ({ item, index }: { item: SearchResult; index: number }) => {
    const subColor = getSubjectColor(item.subject || '');
    const isFeatured = index === 0;

    // FIX 2 — build chip label via the same getPYQCategorization() used in
    // engine.tsx so AI Search shows full exam name ("UPSC CSE 2025",
    // "BPSC 2024") rather than a bare "PYQ 2025". The Supabase query for
    // this screen only selects flat columns, so we synthesise a minimal
    // exam_info from those flat columns before calling the helper.
    const synthExamInfo = {
      group:        item.exam_group,
      year:         item.exam_year,
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

    return (
      <TouchableOpacity
        onPress={() => openQuestion(item)}
        testID={`ai-search-result-${item.id}`}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isFeatured ? '#7c3aed40' : colors.border,
            borderWidth: isFeatured ? 1.5 : 1,
          },
        ]}
      >
        <View style={[styles.cardNum, { backgroundColor: isFeatured ? '#7c3aed15' : colors.surfaceStrong }]}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isFeatured ? '#7c3aed' : colors.textTertiary }}>
            {index + 1}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.cardText, { color: colors.textPrimary }]} numberOfLines={3}>
            {item.question_text}
          </Text>

          <View style={styles.cardChips}>
            {item.subject && (
              <View style={[styles.chip, { backgroundColor: subColor + '18' }]}>
                <Text style={[styles.chipText, { color: subColor }]}>{item.subject}</Text>
              </View>
            )}
            {/* PYQ chip — uses getPYQCategorization for full exam name (e.g.
                "UPSC CSE 2025", "BPSC 2024") instead of bare "PYQ 2025". */}
            {item.is_pyq && pyqLabel && (
              <View style={[styles.chip, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.chipText, { color: '#15803d' }]}>
                  {pyqLabel}
                </Text>
              </View>
            )}
            {!item.is_pyq && (
              <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                <Text style={[styles.chipText, { color: colors.textTertiary }]}>Practice</Text>
              </View>
            )}
            {item.tests?.institute && (
              <View style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
                <Text style={[styles.chipText, { color: '#1d4ed8' }]}>{item.tests.institute}</Text>
              </View>
            )}
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

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.brainBadge}>
        <Brain size={28} color="#fff" />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>AI-Powered Search</Text>
      <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
        Ask in plain language.{'\n'}Gemini expands your query into keywords,{'\n'}then searches across all questions.
      </Text>
      <Text style={[styles.examplesLabel, { color: colors.textTertiary }]}>TRY THESE</Text>
      {[
        'rivers flowing east to west in India',
        'constitutional amendments after 1990',
        'trade policy effects on agriculture',
        'mapping rivers mountains deserts',
      ].map((ex) => (
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
    </View>
  );

  // ── Left panel (iPad sidebar / inline on phone) ───────────────────────────

  const LeftPanel = (
    <View style={[
      IS_IPAD ? styles.leftPanel : styles.phoneKeywordsPanel,
      { backgroundColor: IS_IPAD ? colors.surface : colors.bg, borderRightColor: colors.border },
    ]}>
      {keywords.length > 0 && (
        <>
          <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>AI EXPANDED KEYWORDS</Text>
          {renderKeywordPills()}
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
              {[...new Set(results.map(r => r.subject).filter(Boolean))].map(sub => {
                const count = results.filter(r => r.subject === sub).length;
                const color = getSubjectColor(sub as string);
                return (
                  <TouchableOpacity
                    key={sub}
                    style={[styles.subjectChip, { borderColor: colors.border }]}
                    onPress={() => {
                      const newFilters = { ...filters, subjects: sub as string };
                      setFilters(newFilters);
                      runSearch(query, newFilters);
                    }}
                  >
                    <View style={[styles.subjectDot, { backgroundColor: color }]} />
                    <Text style={[styles.subjectChipText, { color: colors.textSecondary }]}>{sub}</Text>
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
        </>
      )}
    </View>
  );

  const ResultsHeader = (
    <View style={[styles.resultsHeader, { borderBottomColor: colors.border }]}>
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
                    onPress={() => setPendingFilters(p => ({ ...p, subjects: 'All' }))}
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
                          setPendingFilters(p => ({ ...p, subjects: next.length ? next.join(',') : 'All' }));
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
    <View style={styles.searchRow}>
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Search size={15} color={colors.textTertiary} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Ask in plain language…"
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          onSubmitEditing={() => runSearch(query, filters)}
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
          style={styles.goBtn}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Brain size={15} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={() => setShowModelSwitcher(true)}
        style={[
          styles.filterBtn,
          { backgroundColor: colors.surface, borderColor: colors.border }
        ]}
      >
        <Brain size={18} color="#7c3aed" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={openFilterPopup}
        testID="ai-search-filter-open"
        style={[
          styles.filterBtn,
          {
            backgroundColor: activeFilterCount > 0 ? '#ede9fe' : colors.surface,
            borderColor: activeFilterCount > 0 ? '#c4b5fd' : colors.border,
          },
        ]}
      >
        <SlidersHorizontal size={15} color={activeFilterCount > 0 ? '#7c3aed' : colors.textSecondary} />
        {activeFilterCount > 0 && (
          <View style={styles.filterBadge}>
            <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
          </View>
        )}
      </TouchableOpacity>
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

        {SearchBar}

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
                {keywords.length > 0 && (
                  <View style={{ padding: 12, paddingBottom: 0 }}>
                    <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>AI EXPANDED KEYWORDS</Text>
                    {renderKeywordPills()}
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
      </KeyboardAvoidingView>
      <AIModelSwitcher
        visible={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
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
});
