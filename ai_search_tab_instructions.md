# AI SEARCH TAB — Complete Build Instructions
# For: emergent.sh AI agent
# Context: GeminiService.ts and profile.tsx AI settings panel are ALREADY DONE.
#          This document covers what is still pending.

---


## WHAT IS STILL PENDING — build in this order

1. **AI Explain + Summarize buttons in `app/unified/engine.tsx`** — wire the existing
   `aiExplainQuestion` and `aiSummarizeExplanation` functions into the quiz engine UI.
2. **AI Search tab** — new screen `app/(tabs)/ai-search.tsx` + tab registration.

---

## PART 1 — Wire AI Explain + Summarize into engine.tsx

**File:** `app/unified/engine.tsx`

### 1a. Add imports (add to existing lucide import block)

```typescript
import { Brain, Sparkles, ChevronDown, ChevronUp } from 'lucide-react-native';
import {
  aiExplainQuestion,
  aiSummarizeExplanation,
} from '../../src/services/GeminiService';
```

### 1b. Add state variables (near other useState declarations)

```typescript
// AI Explain state — per question, keyed by question id
const [aiExplanations, setAiExplanations] = useState<Record<string, string>>({});
const [aiSummaries, setAiSummaries]       = useState<Record<string, string>>({});
const [aiLoading, setAiLoading]           = useState<Record<string, boolean>>({});
const [aiSumLoading, setAiSumLoading]     = useState<Record<string, boolean>>({});
const [aiExpanded, setAiExpanded]         = useState<Record<string, boolean>>({});
```

### 1c. Add handler functions

```typescript
const handleAiExplain = async (item: any) => {
  const id = item.id || item.question_id;
  if (aiExplanations[id]) {
    // already loaded — just toggle visibility
    setAiExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    return;
  }
  setAiLoading(prev => ({ ...prev, [id]: true }));
  setAiExpanded(prev => ({ ...prev, [id]: true }));
  try {
    const optionsMap: Record<string, string> = {
      A: item.option_a || item.optionA || '',
      B: item.option_b || item.optionB || '',
      C: item.option_c || item.optionC || '',
      D: item.option_d || item.optionD || '',
    };
    const result = await aiExplainQuestion(
      item.question || item.question_text || '',
      optionsMap,
      item.correct_answer || item.correctAnswer || '',
    );
    setAiExplanations(prev => ({ ...prev, [id]: result }));
  } catch (e: any) {
    Alert.alert('AI Error', e?.message || 'Could not get AI explanation. Check your Gemini API key in Settings → AI Settings.');
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
```

### 1d. Add AI Explain panel JSX — insert BELOW the existing explanation block for each question card

Find where each question card renders its explanation text (look for `showResult`, `item.explanation`, or the explanation block). After the explanation block, add:

```tsx
{/* ── AI EXPLAIN BUTTON ─────────────────────────────── */}
{showResult && (
  <View style={{ marginTop: 10 }}>
    <TouchableOpacity
      onPress={() => handleAiExplain(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#7c3aed18',
        borderWidth: 1,
        borderColor: '#7c3aed30',
      }}
      testID={`ai-explain-btn-${item.id}`}
    >
      {aiLoading[item.id || item.question_id] ? (
        <ActivityIndicator size="small" color="#7c3aed" />
      ) : (
        <Brain size={15} color="#7c3aed" />
      )}
      <Text style={{ fontSize: 13, fontWeight: '800', color: '#7c3aed', flex: 1 }}>
        {aiExplanations[item.id || item.question_id] ? 'AI EXPLANATION' : 'AI EXPLAIN'}
      </Text>
      {aiExplanations[item.id || item.question_id] && (
        aiExpanded[item.id || item.question_id]
          ? <ChevronUp size={14} color="#7c3aed" />
          : <ChevronDown size={14} color="#7c3aed" />
      )}
    </TouchableOpacity>

    {/* AI explanation text — shown when expanded */}
    {aiExpanded[item.id || item.question_id] && aiExplanations[item.id || item.question_id] && (
      <View style={{
        marginTop: 8,
        padding: 14,
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#7c3aed20',
      }}>
        <Text style={{
          fontSize: 13,
          color: colors.textPrimary,
          lineHeight: 20,
          fontWeight: '400',
        }}>
          {aiExplanations[item.id || item.question_id]}
        </Text>

        {/* Summarize into bullets button */}
        {!aiSummaries[item.id || item.question_id] && (
          <TouchableOpacity
            onPress={() => handleAiSummarize(item)}
            style={{
              marginTop: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 7,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: '#f59e0b18',
              borderWidth: 1,
              borderColor: '#f59e0b30',
              alignSelf: 'flex-start',
            }}
            testID={`ai-summarize-btn-${item.id}`}
          >
            {aiSumLoading[item.id || item.question_id] ? (
              <ActivityIndicator size="small" color="#f59e0b" />
            ) : (
              <Sparkles size={13} color="#f59e0b" />
            )}
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b' }}>
              ✨ SUMMARIZE INTO BULLETS
            </Text>
          </TouchableOpacity>
        )}

        {/* Bullet summary */}
        {aiSummaries[item.id || item.question_id] && (
          <View style={{
            marginTop: 12,
            padding: 12,
            backgroundColor: '#fef3c720',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#f59e0b25',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#f59e0b', marginBottom: 6, letterSpacing: 0.5 }}>
              ✨ KEY POINTS
            </Text>
            <Text style={{
              fontSize: 12,
              color: colors.textPrimary,
              lineHeight: 20,
            }}>
              {aiSummaries[item.id || item.question_id]}
            </Text>
          </View>
        )}
      </View>
    )}
  </View>
)}
```

**IMPORTANT:** `item.id` vs `item.question_id` — check which field the existing engine uses as the unique question key and use that consistently for all the `aiExplanations[id]`, `aiLoading[id]` lookups above.

---

## PART 2 — AI Search Tab (new screen)

### 2a. Create the file

**New file:** `app/(tabs)/ai-search.tsx`

This is a complete standalone tab screen. Create it from scratch with the code below.

### 2b. Register the tab

**File:** `app/(tabs)/_layout.tsx`

Add the tab to the tab bar alongside existing tabs:

```tsx
<Tabs.Screen
  name="ai-search"
  options={{
    title: 'AI Search',
    tabBarIcon: ({ color, size }) => <Brain size={size} color={color} />,
    tabBarLabel: 'AI Search',
  }}
/>
```

Add `import { Brain } from 'lucide-react-native';` to the layout imports if not already present.

---

### 2c. Full code for `app/(tabs)/ai-search.tsx`

```tsx
/**
 * AI Search Tab
 *
 * Uses GeminiService.aiExpandSearchQuery to expand the user's natural-language
 * query into keywords, then runs the same multi-keyword Supabase search logic
 * used in the existing search bar (engine.tsx params).
 *
 * Supports all existing filters: searchMode, searchAcross, stage, institutes,
 * pyqFilter, examCategory, ncertFilter — shown in a bottom sheet popup.
 *
 * On iPad (width >= 768): two-column layout — left sidebar shows keywords +
 * active filters + subject drill-down; right panel shows results.
 * On phone: single column, full screen.
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
  Sparkles, BookOpen, Filter,
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { aiExpandSearchQuery } from '../../src/services/GeminiService';
import { PageWrapper } from '../../src/components/PageWrapper';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_IPAD = SCREEN_WIDTH >= 768;

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchResult = {
  id: string;
  question: string;
  correct_answer: string;
  subject?: string;
  is_pyq?: boolean;
  exam_year?: string;
  exam_info?: any;
  institute?: string;
  tests?: { institute?: string; name?: string };
};

type Filters = {
  searchMode: 'Matching' | 'Exact';
  searchAcross: 'Questions' | 'Explanations' | 'Notes';
  stage: string;           // 'All' | 'Prelims' | 'Mains'
  institutes: string;      // comma-separated or 'All'
  pyqFilter: string;       // 'All' | 'PYQ Only' | 'Non-PYQ'
  examCategory: string;    // 'All' | 'UPSC' | 'Allied' | 'Others'
  ncertFilter: string;     // 'All' | 'NCERT Only' | 'Non-NCERT'
  subjects: string;        // comma-separated or 'All'
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function countActiveFilters(f: Filters): number {
  let n = 0;
  if (f.searchMode !== 'Matching')   n++;
  if (f.searchAcross !== 'Questions') n++;
  if (f.stage !== 'All')             n++;
  if (f.institutes !== 'All')        n++;
  if (f.pyqFilter !== 'All')         n++;
  if (f.examCategory !== 'All')      n++;
  if (f.ncertFilter !== 'All')       n++;
  if (f.subjects !== 'All')          n++;
  return n;
}

function getYear(item: SearchResult): string {
  const info = item.exam_info && typeof item.exam_info === 'object' ? item.exam_info : {};
  return String(info.year || item.exam_year || '');
}

function isPYQ(item: SearchResult): boolean {
  return !!(item.is_pyq || (item.exam_info as any)?.isPyq || (item.exam_info as any)?.is_pyq);
}

function getSubjectColor(sub: string): string {
  const map: Record<string, string> = {
    geography: '#0ea5e9', polity: '#8b5cf6', history: '#f59e0b',
    economy: '#10b981', environment: '#22c55e', science: '#06b6d4',
    art: '#f43f5e', international: '#3b82f6',
  };
  const key = (sub || '').toLowerCase();
  for (const [k, v] of Object.entries(map)) if (key.includes(k)) return v;
  return '#94a3b8';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AISearchTab() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();

  const [query, setQuery]             = useState('');
  const [keywords, setKeywords]       = useState<string[]>([]);
  const [results, setResults]         = useState<SearchResult[]>([]);
  const [loading, setLoading]         = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS);
  const [sortMode, setSortMode]       = useState<SortMode>('Relevance');
  const [filterOpen, setFilterOpen]   = useState(false);
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);

  // Dynamic filter options (loaded from DB)
  const [subjectOptions, setSubjectOptions]     = useState<string[]>([]);
  const [instituteOptions, setInstituteOptions] = useState<string[]>([]);

  const inputRef = useRef<TextInput>(null);

  // Load dynamic filter options once
  useEffect(() => {
    (async () => {
      const { data: subData } = await supabase
        .from('questions').select('subject').not('subject', 'is', null).limit(500);
      if (subData) {
        const unique = [...new Set(subData.map((r: any) => r.subject).filter(Boolean))].sort();
        setSubjectOptions(unique as string[]);
      }
      const { data: instData } = await supabase
        .from('tests').select('institute').not('institute', 'is', null).limit(200);
      if (instData) {
        const unique = [...new Set(instData.map((r: any) => r.institute).filter(Boolean))].sort();
        setInstituteOptions(unique as string[]);
      }
    })();
  }, []);

  // ── Core search logic ──────────────────────────────────────────────────────

  const runSearch = useCallback(async (q: string, activeFilters: Filters) => {
    if (!q.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setResults([]);
    setKeywords([]);

    try {
      // Step 1: expand query with Gemini
      const kws = await aiExpandSearchQuery(q.trim());
      setKeywords(kws);

      if (kws.length === 0) {
        setLoading(false);
        return;
      }

      // Step 2: build Supabase query — same logic as engine.tsx search
      // We run OR across all keywords, matching question or explanation text
      const searchField = activeFilters.searchAcross === 'Explanations'
        ? 'explanation'
        : activeFilters.searchAcross === 'Notes'
          ? 'notes'
          : 'question';

      // For Matching mode: use ilike for each keyword; for Exact: match phrase
      const conditions = activeFilters.searchMode === 'Exact'
        ? [`${searchField}.ilike.%${q.trim()}%`]
        : kws.slice(0, 12).map(kw => `${searchField}.ilike.%${kw}%`);

      let dbQuery = supabase
        .from('questions')
        .select(`
          id, question, correct_answer, subject,
          is_pyq, exam_year, exam_info, institute,
          tests(institute, name)
        `)
        .or(conditions.join(','))
        .limit(60);

      // Apply filters
      if (activeFilters.stage && activeFilters.stage !== 'All') {
        dbQuery = dbQuery.ilike('series', `%${activeFilters.stage}%`);
      }
      if (activeFilters.institutes && activeFilters.institutes !== 'All') {
        const insts = activeFilters.institutes.split(',').filter(Boolean);
        if (insts.length > 0) dbQuery = dbQuery.in('institute', insts);
      }
      if (activeFilters.pyqFilter === 'PYQ Only') {
        dbQuery = dbQuery.eq('is_pyq', true);
      } else if (activeFilters.pyqFilter === 'Non-PYQ') {
        dbQuery = dbQuery.eq('is_pyq', false);
      }
      if (activeFilters.ncertFilter === 'NCERT Only') {
        dbQuery = dbQuery.eq('is_ncert', true);
      } else if (activeFilters.ncertFilter === 'Non-NCERT') {
        dbQuery = dbQuery.eq('is_ncert', false);
      }
      if (activeFilters.subjects && activeFilters.subjects !== 'All') {
        const subs = activeFilters.subjects.split(',').filter(Boolean);
        if (subs.length > 0) dbQuery = dbQuery.in('subject', subs);
      }
      if (activeFilters.examCategory && activeFilters.examCategory !== 'All') {
        // map UPSC / Allied / Others to is_upsc_cse / is_allied / is_others
        if (activeFilters.examCategory === 'UPSC') {
          dbQuery = dbQuery.eq('exam_info->>is_upsc_cse', 'true');
        } else if (activeFilters.examCategory === 'Allied') {
          dbQuery = dbQuery.eq('exam_info->>is_allied', 'true');
        } else if (activeFilters.examCategory === 'Others') {
          dbQuery = dbQuery.eq('exam_info->>is_others', 'true');
        }
      }

      const { data, error } = await dbQuery;
      if (error) throw error;

      setResults((data || []) as SearchResult[]);
    } catch (e: any) {
      if (e?.message?.includes('API key') || e?.message?.includes('Gemini')) {
        Alert.alert(
          'Gemini API key needed',
          'Go to Settings → AI Settings and paste your free Gemini API key from aistudio.google.com',
          [{ text: 'OK' }],
        );
      } else {
        Alert.alert('Search failed', e?.message || 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Sorted results ─────────────────────────────────────────────────────────

  const sortedResults = React.useMemo(() => {
    if (sortMode === 'Year') {
      return [...results].sort((a, b) => {
        const ya = getYear(a), yb = getYear(b);
        return yb.localeCompare(ya);
      });
    }
    if (sortMode === 'Subject') {
      return [...results].sort((a, b) => (a.subject || '').localeCompare(b.subject || ''));
    }
    return results; // Relevance = DB order (already ranked by OR match count)
  }, [results, sortMode]);

  // ── Filter popup helpers ───────────────────────────────────────────────────

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

  // ── Navigate to question ───────────────────────────────────────────────────

  const openQuestion = (item: SearchResult) => {
    router.push({
      pathname: '/unified/engine',
      params: {
        searchQuery: query,
        searchMode: filters.searchMode,
        searchAcross: filters.searchAcross,
        initialId: item.id,
      },
    });
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderResultCard = ({ item, index }: { item: SearchResult; index: number }) => {
    const pyq = isPYQ(item);
    const year = getYear(item);
    const subColor = getSubjectColor(item.subject || '');
    const isFeatured = index === 0;

    return (
      <TouchableOpacity
        onPress={() => openQuestion(item)}
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: isFeatured ? '#7c3aed40' : colors.border,
            borderWidth: isFeatured ? 1.5 : 1,
          },
        ]}
        testID={`ai-search-result-${item.id}`}
      >
        {/* Number badge */}
        <View style={[styles.cardNum, { backgroundColor: isFeatured ? '#7c3aed15' : colors.surfaceStrong }]}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: isFeatured ? '#7c3aed' : colors.textTertiary }}>
            {index + 1}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.cardText, { color: colors.textPrimary }]} numberOfLines={3}>
            {item.question}
          </Text>

          {/* Chips row */}
          <View style={styles.cardChips}>
            {item.subject && (
              <View style={[styles.chip, { backgroundColor: subColor + '18' }]}>
                <Text style={[styles.chipText, { color: subColor }]}>{item.subject}</Text>
              </View>
            )}
            {pyq && (
              <View style={[styles.chip, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.chipText, { color: '#15803d' }]}>PYQ {year}</Text>
              </View>
            )}
            {!pyq && (
              <View style={[styles.chip, { backgroundColor: colors.surfaceStrong }]}>
                <Text style={[styles.chipText, { color: colors.textTertiary }]}>Practice</Text>
              </View>
            )}
            {(item.tests?.institute || item.institute) && (
              <View style={[styles.chip, { backgroundColor: '#dbeafe' }]}>
                <Text style={[styles.chipText, { color: '#1d4ed8' }]}>
                  {item.tests?.institute || item.institute}
                </Text>
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
          style={[styles.exampleChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Sparkles size={12} color="#7c3aed" />
          <Text style={[styles.exampleText, { color: colors.textSecondary }]}>{ex}</Text>
          <ChevronRight size={12} color={colors.textTertiary} />
        </TouchableOpacity>
      ))}
    </View>
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
          style={[styles.searchInput, { color: colors.textPrimary }]}
          testID="ai-search-input"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setHasSearched(false); setKeywords([]); }}>
            <X size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        {/* Go button */}
        <TouchableOpacity
          onPress={() => runSearch(query, filters)}
          disabled={loading || !query.trim()}
          style={styles.goBtn}
          testID="ai-search-go"
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Brain size={15} color="#fff" />
          }
        </TouchableOpacity>
      </View>

      {/* Filter button */}
      <TouchableOpacity
        onPress={openFilterPopup}
        style={[
          styles.filterBtn,
          {
            backgroundColor: activeFilterCount > 0 ? '#ede9fe' : colors.surface,
            borderColor: activeFilterCount > 0 ? '#c4b5fd' : colors.border,
          },
        ]}
        testID="ai-search-filter-btn"
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

  // ── Left panel (iPad sidebar / inline on phone) ────────────────────────────

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
              <Text style={[styles.statNum, { color: '#15803d' }]}>{results.filter(isPYQ).length}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>PYQs</Text>
            </View>
          </View>

          {/* Subject filter */}
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

          {/* PYQ / Practice quick filter */}
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

  // ── Sort + results header ─────────────────────────────────────────────────

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
            style={[styles.sortBtn, {
              backgroundColor: sortMode === s ? '#7c3aed' : colors.surfaceStrong,
            }]}
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
          {/* Popup header */}
          <View style={[styles.popupHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
              <Filter size={15} color={colors.textSecondary} />
              <Text style={[styles.popupTitle, { color: colors.textPrimary }]}>Search Filters</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setPendingFilters(DEFAULT_FILTERS)}>
                <Text style={[styles.clearBtn, { color: colors.textTertiary }]}>Clear all</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilterOpen(false)}
                style={[styles.closeBtn, { backgroundColor: colors.surfaceStrong }]}
              >
                <X size={12} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* AI note */}
          <View style={[styles.aiNote, { backgroundColor: '#ede9fe' }]}>
            <Brain size={13} color="#7c3aed" />
            <Text style={[styles.aiNoteText, { color: '#7c3aed' }]}>
              Gemini automatically handles fuzzy matching and typo correction.
              These filters narrow the AI-expanded results.
            </Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.popupBody}>

            {/* Search Mode */}
            <FilterGroup
              label="SEARCH MODE"
              options={['Matching', 'Exact']}
              value={pendingFilters.searchMode}
              onSelect={(v) => setPendingFilters(p => ({ ...p, searchMode: v as any }))}
              colors={colors}
            />

            {/* Search Across */}
            <FilterGroup
              label="SEARCH ACROSS"
              options={['Questions', 'Explanations', 'Notes']}
              value={pendingFilters.searchAcross}
              onSelect={(v) => setPendingFilters(p => ({ ...p, searchAcross: v as any }))}
              colors={colors}
            />

            {/* Exam Stage */}
            <FilterGroup
              label="EXAM STAGE"
              options={['All', 'Prelims', 'Mains']}
              value={pendingFilters.stage}
              onSelect={(v) => setPendingFilters(p => ({ ...p, stage: v }))}
              colors={colors}
            />

            {/* PYQ Filter */}
            <FilterGroup
              label="PYQ FILTER"
              options={['All', 'PYQ Only', 'Non-PYQ']}
              value={pendingFilters.pyqFilter}
              onSelect={(v) => setPendingFilters(p => ({ ...p, pyqFilter: v }))}
              colors={colors}
            />

            {/* Exam Category */}
            <FilterGroup
              label="EXAM CATEGORY"
              options={['All', 'UPSC', 'Allied', 'Others']}
              value={pendingFilters.examCategory}
              onSelect={(v) => setPendingFilters(p => ({ ...p, examCategory: v }))}
              colors={colors}
            />

            {/* Curriculum */}
            <FilterGroup
              label="CURRICULUM"
              options={['All', 'NCERT Only', 'Non-NCERT']}
              value={pendingFilters.ncertFilter}
              onSelect={(v) => setPendingFilters(p => ({ ...p, ncertFilter: v }))}
              colors={colors}
            />

            {/* Institutes — dynamic */}
            {instituteOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>INSTITUTES</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, institutes: 'All' }))}
                    style={[styles.fchip, pendingFilters.institutes === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, {
                      color: pendingFilters.institutes === 'All' ? '#fff' : colors.textSecondary,
                    }]}>All</Text>
                  </TouchableOpacity>
                  {instituteOptions.map(inst => {
                    const isSelected = pendingFilters.institutes.split(',').includes(inst);
                    return (
                      <TouchableOpacity
                        key={inst}
                        onPress={() => {
                          const list = pendingFilters.institutes === 'All'
                            ? [] : pendingFilters.institutes.split(',').filter(Boolean);
                          const next = isSelected ? list.filter(i => i !== inst) : [...list, inst];
                          setPendingFilters(p => ({ ...p, institutes: next.length ? next.join(',') : 'All' }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                          {inst}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Subjects — dynamic */}
            {subjectOptions.length > 0 && (
              <View style={styles.filterGroup}>
                <Text style={[styles.filterGroupTitle, { color: colors.textTertiary }]}>SUBJECTS</Text>
                <View style={styles.chipsWrap}>
                  <TouchableOpacity
                    onPress={() => setPendingFilters(p => ({ ...p, subjects: 'All' }))}
                    style={[styles.fchip, pendingFilters.subjects === 'All' && styles.fchipSel]}
                  >
                    <Text style={[styles.fchipText, {
                      color: pendingFilters.subjects === 'All' ? '#fff' : colors.textSecondary,
                    }]}>All</Text>
                  </TouchableOpacity>
                  {subjectOptions.map(sub => {
                    const isSelected = pendingFilters.subjects.split(',').includes(sub);
                    return (
                      <TouchableOpacity
                        key={sub}
                        onPress={() => {
                          const list = pendingFilters.subjects === 'All'
                            ? [] : pendingFilters.subjects.split(',').filter(Boolean);
                          const next = isSelected ? list.filter(s => s !== sub) : [...list, sub];
                          setPendingFilters(p => ({ ...p, subjects: next.length ? next.join(',') : 'All' }));
                        }}
                        style={[styles.fchip, isSelected && styles.fchipSel]}
                      >
                        <Text style={[styles.fchipText, { color: isSelected ? '#fff' : colors.textSecondary }]}>
                          {sub}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Apply button */}
          <View style={[styles.popupFooter, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={applyFilters} style={styles.applyBtn} testID="ai-search-apply-filters">
              <Filter size={14} color="#fff" />
              <Text style={styles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <PageWrapper>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
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

        {/* Search bar */}
        {SearchBar}

        {/* Body */}
        {IS_IPAD ? (
          // iPad: two-column layout
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
                          No results found. Try different keywords or adjust filters.
                        </Text>
                      </View>
                    )
                  }
                />
              ) : renderEmptyState()}
            </View>
          </View>
        ) : (
          // Phone: single column
          <FlatList
            data={hasSearched ? sortedResults : []}
            keyExtractor={item => item.id}
            renderItem={renderResultCard}
            ListHeaderComponent={
              <>
                {keywords.length > 0 && (
                  <View style={{ padding: 12, paddingBottom: 0 }}>
                    <Text style={[styles.panelLabel, { color: colors.textTertiary }]}>
                      AI EXPANDED KEYWORDS
                    </Text>
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
    </PageWrapper>
  );
}

// ── Filter group sub-component ────────────────────────────────────────────────

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
            <Text style={[styles.fchipText, { color: value === opt ? '#fff' : colors.textSecondary }]}>
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 0.5,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brainBadge:  {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  headerSub:   { fontSize: 9, fontWeight: '600', letterSpacing: 0.6, marginTop: 1 },
  aiBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  aiBadgeText: { fontSize: 10, fontWeight: '800', color: '#7c3aed' },

  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10 },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 26, borderWidth: 1.5, height: 48, paddingLeft: 14, paddingRight: 6,
    shadowColor: '#7c3aed', shadowOpacity: 0.07, shadowRadius: 12, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: '500' },
  goBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    height: 48, paddingHorizontal: 13, borderRadius: 14, borderWidth: 1.5,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 16, height: 16, borderRadius: 8, backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },
  filterBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },

  ipadBody:  { flex: 1, flexDirection: 'row' },
  leftPanel: { width: 240, borderRightWidth: 0.5, padding: 14 },
  phoneKeywordsPanel: { paddingHorizontal: 14, paddingBottom: 4 },

  panelLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginBottom: 7 },
  pillsWrap:  { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  pill:       { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  pillText:   { fontSize: 10, fontWeight: '700' },

  statRow:  { flexDirection: 'row', gap: 8 },
  statCard: { flex: 1, borderRadius: 10, padding: 10 },
  statNum:  { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  statLabel: { fontSize: 10, fontWeight: '600' },

  subjectChip:     { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 7, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, marginBottom: 4 },
  subjectDot:      { width: 7, height: 7, borderRadius: 4 },
  subjectChipText: { fontSize: 12, fontWeight: '600', flex: 1 },
  subjectCount:    { fontSize: 10, fontWeight: '700' },

  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  resultsCount:  { fontSize: 11, fontWeight: '700' },
  sortRow:       { flexDirection: 'row', gap: 4 },
  sortBtn:       { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  sortBtnText:   { fontSize: 10, fontWeight: '800' },

  card:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 13, padding: 12, marginBottom: 7 },
  cardNum:   { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  cardText:  { fontSize: 13, lineHeight: 19, fontWeight: '500', marginBottom: 7 },
  cardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  chip:      { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 2 },
  chipText:  { fontSize: 10, fontWeight: '800' },

  emptyState:    { padding: 28, alignItems: 'center' },
  emptyTitle:    { fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  emptySub:      { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  examplesLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 10 },
  exampleChip:   { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  exampleText:   { fontSize: 13, fontWeight: '500', flex: 1 },

  noResults: { padding: 40, alignItems: 'center' },

  overlay:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  popup:      { borderRadius: 20, borderWidth: 1, maxHeight: '90%', overflow: 'hidden' },
  popupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 0.5 },
  popupTitle:  { fontSize: 14, fontWeight: '800' },
  clearBtn:    { fontSize: 11, fontWeight: '700' },
  closeBtn:    { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  popupBody:   { padding: 14, gap: 14, paddingBottom: 4 },
  popupFooter: { padding: 14, borderTopWidth: 0.5 },
  applyBtn:    { backgroundColor: '#7c3aed', borderRadius: 12, padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  applyBtnText: { fontSize: 13, fontWeight: '800', color: '#fff' },

  aiNote:     { flexDirection: 'row', alignItems: 'flex-start', gap: 7, padding: 10, margin: 12, marginBottom: 0, borderRadius: 10 },
  aiNoteText: { fontSize: 11, fontWeight: '600', lineHeight: 17, flex: 1 },

  filterGroup:      { gap: 6 },
  filterGroupTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  chipsWrap:        { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  fchip:            { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  fchipSel:         { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  fchipText:        { fontSize: 11, fontWeight: '700' },
});
```

---

## PART 3 — Verification checklist

After completing Parts 1 and 2, verify:

### Part 1 — Engine AI buttons
- [ ] "AI EXPLAIN" button appears below each question's existing explanation (only after answer is revealed / `showResult === true`)
- [ ] Tapping AI EXPLAIN calls `aiExplainQuestion` and shows a loading spinner while waiting
- [ ] The AI explanation text renders below the button, formatted correctly
- [ ] "✨ SUMMARIZE INTO BULLETS" button appears inside the explanation panel
- [ ] Bullet summary renders with yellow styling after Summarize is tapped
- [ ] If no Gemini API key, a clear Alert says "Go to Settings → AI Settings"
- [ ] AI state is per-question (one question's loading doesn't affect others)

### Part 2 — AI Search tab
- [ ] New tab "AI Search" appears in the tab bar with Brain icon
- [ ] Search bar has purple glow shadow and Brain go-button
- [ ] Typing a query and submitting calls `aiExpandSearchQuery` from GeminiService
- [ ] AI expanded keywords appear as purple pills above results
- [ ] Results render as cards with subject chip (colored) + PYQ year chip (green)
- [ ] First result card has purple border (featured)
- [ ] Sort buttons (Relevance / Year / Subject) work correctly
- [ ] Filter button shows active filter count badge when filters are applied
- [ ] Filter popup opens from bottom sheet on phone, from button area on iPad
- [ ] All 8 filter groups are present in the popup
- [ ] "Clear all" resets all pending filters to defaults
- [ ] "Apply Filters" closes popup and re-runs search with new filters
- [ ] Subjects and Institutes lists are dynamically loaded from Supabase
- [ ] Left sidebar stats (questions / PYQs) update after each search
- [ ] Subject drill-down in left sidebar re-filters results inline
- [ ] On iPad (width ≥ 768): two-column layout — left sidebar + right results panel
- [ ] On phone: single column with keywords above results
- [ ] Tapping a result navigates to `/unified/engine` with the question pre-loaded
- [ ] Empty state shows example queries; tapping one runs the search immediately
- [ ] If Gemini API key is missing, Alert explains where to add it

---

## NOTES FOR EMERGENT.SH AGENT

1. **Do not touch `GeminiService.ts` or `profile.tsx`** — both are already complete.
2. The `supabase` import path is `../../src/lib/supabase` from `app/(tabs)/`.
3. `PageWrapper` is at `../../src/components/PageWrapper`.
4. `useTheme` is at `../../src/context/ThemeContext`.
5. `useAuth` is at `../../src/context/AuthContext`.
6. The `questions` table uses `is_pyq`, `exam_year`, `exam_info` (JSONB), `subject`, `institute`.
7. The filter popup uses `Modal` (already imported) — **not** a bottom drawer library.
8. The `colors` object from `useTheme()` has: `bg`, `surface`, `surfaceStrong`, `primary`,
   `textPrimary`, `textSecondary`, `textTertiary`, `border`. Use these everywhere — no hardcoded
   hex except `#7c3aed` (the fixed AI purple accent) and the PYQ green `#15803d` / `#dcfce7`.
9. `ActivityIndicator` and `Alert` are already in the React Native import. 
10. For the engine.tsx Part 1 changes, check the exact field used as question ID (`item.id`,
    `item.question_id`, or another field) by searching for how existing analytics/bookmarks
    reference questions, and use that same field as the key for `aiExplanations`, `aiLoading` etc.
11. The tab bar layout file is `app/(tabs)/_layout.tsx` — add the new screen there following
    the existing pattern exactly (same `headerShown: false` convention as other tabs).
