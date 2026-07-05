import React, { useState, useMemo, useEffect, useCallback, useRef, useDeferredValue } from 'react';
import FeatureGate from '../../src/components/FeatureGate';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { KVStore } from '../../src/lib/kvStore';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  Search,
  BookOpen,
  Target,
  Play,
  Check,
  ChevronRight,
  Clock,
  LayoutGrid,
  List,
  Filter,
  Tag as TagIcon,
  Zap,
  ArrowRight,
  Layout,
  XCircle,
  Brain,
} from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useCourse } from '../../src/context/CourseContext';
import { GlobalSearchBar } from '../../src/components/GlobalSearchBar';
import { useQuizStore } from '../../src/store/quizStore';
import { mergeQuestions } from '../../src/utils/merger';
import { OfflineManager } from '../../src/services/OfflineManager';
import { LocalQuery } from '../../src/services/LocalQuery';
import { buildArenaEngineSearchParams } from '../../src/utils/arenaSearchNavigation';

const { width } = Dimensions.get('window');

let arenaMetadataCache: any[] | null = null;
let arenaMetadataCachedAt = 0;
const ARENA_METADATA_CACHE_TTL_MS = 300_000; // 5 minutes (was 90s)

// --- Helper Components ---

const FilterRow = ({ title, items, selected, onSelect, multi = false, visible = true, showSelectAll = true, allowAll = true }: any) => {
  const { colors } = useTheme();
  if (!visible || items.length === 0) return null;

  const isSelected = (item: string) => {
    if (multi) return Array.isArray(selected) && selected.includes(item);
    return selected === item;
  };

  const handleSelect = (item: string) => {
    if (item === 'All') {
      onSelect(multi ? [] : 'All');
      return;
    }
    if (item === 'SELECT_ALL') {
      onSelect([...items]);
      return;
    }
    if (multi) {
      const prev = Array.isArray(selected) ? selected : [];
      if (prev.includes(item)) onSelect(prev.filter((i: string) => i !== item));
      else onSelect([...prev, item]);
    } else {
      onSelect(item);
    }
  };

  const isEverythingSelected = multi && Array.isArray(selected) && selected.length === items.length && items.length > 0;

  const isAll = !selected || (Array.isArray(selected) && selected.length === 0) || selected === 'All';

  return (
    <View style={styles.filterRowContainer}>
      <Text style={[styles.filterRowTitle, { color: colors.textTertiary }]}>{title.toUpperCase()}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {allowAll && (
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isAll && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect('All')}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, isAll && { color: colors.buttonText }]}>
              All
            </Text>
          </TouchableOpacity>
        )}

        {multi && items.length > 1 && showSelectAll && (
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isEverythingSelected && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect('SELECT_ALL')}
          >
            <Text style={[styles.chipText, { color: colors.textSecondary }, isEverythingSelected && { color: colors.buttonText }]}>
              Select All
            </Text>
          </TouchableOpacity>
        )}
        {items.map((item: string) => (
          <TouchableOpacity
            key={item}
            activeOpacity={1}
            style={[
              styles.chip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isSelected(item) && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => handleSelect(item)}
          >
            <Text
              style={[
                styles.chipText,
                { color: colors.textSecondary },
                isSelected(item) && { color: colors.buttonText },
              ]}
            >
              {item}
            </Text>
            {multi && isSelected(item) && <Check size={12} color={colors.buttonText} style={{ marginLeft: 4 }} />}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const ToggleButton = ({ options, activeValue, onSelect, style }: any) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.toggleContainer, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }, style]}>
      {options.map((opt: any) => {
        const isActive = activeValue === opt.value;
        const Icon = opt.icon;
        return (
          <TouchableOpacity
            key={opt.value}
            activeOpacity={1}
            onPress={() => onSelect(opt.value)}
            style={[
              styles.toggleBtn,
              isActive && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
          >
            {Icon && <Icon size={16} color={isActive ? colors.buttonText : colors.textSecondary} style={{ marginRight: 6 }} />}
            <Text style={[styles.toggleText, { color: isActive ? colors.buttonText : colors.textSecondary }]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// --- Main Component ---

function UnifiedArenaSetup() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { selectedCourse } = useCourse();
  const params = useLocalSearchParams();
  const startTestStore = useQuizStore((state) => state.startTest);

  // 1. Core State
  const initialTab = params.query ? 'search' : 'topic';
  const [arenaMode, setArenaMode] = useState<'learning' | 'exam'>('learning');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [activeTab, setActiveTab] = useState<'topic' | 'paper' | 'search'>(initialTab);

  // 2. Filter Selections
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string[]>([]);
  const [selectedMicrotopic, setSelectedMicrotopic] = useState<string[]>([]);

  const [pyqMaster, setPyqMaster] = useState('All');
  const [selectedExamCategory, setSelectedExamCategory] = useState<string[]>([]);

  const [selectedInstitutes, setSelectedInstitutes] = useState<string[]>([]);
  const deferredSelectedInstitutes = useDeferredValue(selectedInstitutes);
  const [selectedPrograms, setSelectedPrograms] = useState<string[]>([]);
  const [selectedExamStage, setSelectedExamStage] = useState('All');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [ncertFilter, setNcertFilter] = useState('All');
  const [timerMode, setTimerMode] = useState<'countdown' | 'stopwatch' | 'none'>('none');
  const [showExamModal, setShowExamModal] = useState(false);

  // Search Tab Independent State
  const [searchQuery, setSearchQuery] = useState((params.query as string) || '');
  const [searchFilters, setSearchFilters] = useState<any>(() => {
    try {
      if (params.filters) return JSON.parse(params.filters as string);
    } catch (e) { }
    return {};
  });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [showPYQTags, setShowPYQTags] = useState(true);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicSearch, setTopicSearch] = useState('');
  const [paperVisibleCount, setPaperVisibleCount] = useState(40);
  const hasAutoLaunchedRef = useRef(false);

  // 3. Dynamic Data State
  const [metadata, setMetadata] = useState<any[]>(() => arenaMetadataCache || []);
  const [loading, setLoading] = useState(!arenaMetadataCache);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ phase: string; current: number; total: number; detail: string } | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      KVStore.removeItem('@offline_metadata_consolidated');
      arenaMetadataCache = [];
      arenaMetadataCachedAt = 0;
      await fetchMetadata();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };
  const [userTags, setUserTags] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number | null>(null);
  const [calculatingCount, setCalculatingCount] = useState(false);
  const countDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchUserTags = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const { data: tagData } = await LocalQuery.from('question_states')
        .select('review_tags')
        .eq('user_id', session.user.id)
        .not('review_tags', 'is', null);

      const tags = new Set<string>();
      tagData?.forEach(row => {
        if (Array.isArray(row.review_tags)) row.review_tags.forEach(t => tags.add(t));
      });
      setUserTags(Array.from(tags).sort());
    } catch (e) {
      console.error("Error fetching tags", e);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // Reset metadata when course changes
    arenaMetadataCache = [];
    arenaMetadataCachedAt = 0;
    fetchMetadata();
  }, [selectedCourse]);

  useFocusEffect(
    useCallback(() => {
      fetchUserTags();
    }, [fetchUserTags])
  );

  // 🆕 Sync Pilot Dashboard Filters
  useEffect(() => {
    if (params.subjects) setSelectedSubjects(String(params.subjects).split(',').filter(Boolean));
    else if (params.subject && params.subject !== 'All') setSelectedSubjects([params.subject as string]);
    if (params.tab === 'topic') setActiveTab('topic');
    if (params.section) {
      const sList = (params.section as string).split('|').filter(Boolean);
      setSelectedSection(sList);
    }
    if (params.microtopic) {
      const mList = (params.microtopic as string).split('|').filter(Boolean);
      setSelectedMicrotopic(mList);
    }
    if (params.tags) {
      const incomingTags = String(params.tags).split('|').filter(Boolean);
      setSelectedTags(incomingTags);
    }
    if (params.pyqFilter) setPyqMaster(params.pyqFilter as string);
    if (params.ncertFilter) setNcertFilter(params.ncertFilter as string);
    if (params.stage) setSelectedExamStage(params.stage as string);
    if (params.program) {
      const prog = String(params.program);
      if (prog === 'All') setSelectedPrograms([]);
      else setSelectedPrograms(prog.split(',').filter(Boolean));
    }
    if (params.programs) {
      const prog = String(params.programs);
      if (prog === 'All') setSelectedPrograms([]);
      else setSelectedPrograms(prog.split(',').filter(Boolean));
    }
  }, [params]);

  useEffect(() => {
    if (params.autorun !== 'learn') return;
    if (activeTab !== 'topic') return;
    if (hasAutoLaunchedRef.current) return;
    if (calculatingCount) return;
    if (!questionCount || questionCount <= 0) return;
    hasAutoLaunchedRef.current = true;
    handleLaunch('learning');
  }, [params.autorun, activeTab, calculatingCount, questionCount]);

  // Simple LRU cache for question counts by filter combo key
  const countCacheRef = useRef<Map<string, number>>(new Map());
  const COUNTCACHE_MAX = 50;

  useEffect(() => {
    if (countDebounceRef.current) {
      clearTimeout(countDebounceRef.current);
    }

    // Build cache key from current filters
    const cacheKey = JSON.stringify({
      tab: activeTab,
      subjects: selectedSubjects,
      section: selectedSection,
      microtopic: selectedMicrotopic,
      pyq: pyqMaster,
      examCat: selectedExamCategory,
      inst: deferredSelectedInstitutes,
      prog: selectedPrograms,
      tags: selectedTags,
      ncert: ncertFilter,
    });
    const cached = countCacheRef.current.get(cacheKey);
    if (cached !== undefined) {
      setQuestionCount(cached);
      return;
    }

    countDebounceRef.current = setTimeout(() => {
      updateQuestionCount();
    }, 400);

    return () => {
      if (countDebounceRef.current) {
        clearTimeout(countDebounceRef.current);
      }
    };
  }, [
    selectedSubjects,
    selectedSection,
    selectedMicrotopic,
    pyqMaster,
    selectedExamCategory,
    deferredSelectedInstitutes,
    selectedPrograms,
    selectedExamStage,
    selectedTestId,
    selectedTags,
    arenaMode,
    activeTab,
    searchQuery,
    searchFilters,
    ncertFilter,
    metadata,
    session,
  ]);

  useEffect(() => {
    setShowPYQTags(arenaMode === 'learning');
  }, [arenaMode]);

  useEffect(() => {
    if (activeTab === 'search') {
      fetchSearchResults();
    }
  }, [searchQuery, searchFilters, activeTab]);

  useEffect(() => {
    if (activeTab === 'paper') {
      setPaperVisibleCount(40);
    }
  }, [activeTab, deferredSelectedInstitutes, selectedPrograms, selectedExamStage, selectedTestId]);

  const fetchSearchResults = async () => {
    if (!searchQuery && Object.keys(searchFilters).length === 0) {
      setSearchResults([]);
      setQuestionCount(0);
      return;
    }
    setLoadingSearch(true);
    try {
      const sf = searchFilters || {};
      const term = searchQuery.trim();
      const mode = sf.searchMode || 'Matching';
      const fields = sf.searchFields || ['Questions'];
      const MAX_TOTAL = 2000;
      const CHUNK = 1000;
      let from = 0;
      let allFreshData: any[] = [];

      // OFFLINE-FIRST: if cached questions already satisfy this search,
      // render instantly and skip network.
      const cachedQuestions = OfflineManager.getOfflineQuestionsAllSync() || [];
      if (term.length > 0 && cachedQuestions.length > 0) {
        const searchLower = term.toLowerCase();
        const filtered = cachedQuestions.filter((q: any) =>
          q?.question_text?.toLowerCase?.().includes(searchLower) ||
          q?.explanation_markdown?.toLowerCase?.().includes(searchLower) ||
          q?.subject?.toLowerCase?.().includes(searchLower)
        );

        if (filtered.length > 0) {
          const { mergedQs } = mergeQuestions(filtered);
          setSearchResults(mergedQs.slice(0, 100));
          setQuestionCount(Math.min(mergedQs.length, 100));
          setLoadingSearch(false);
          return;
        }
      }

      while (allFreshData.length < MAX_TOTAL) {
        let query = supabase.from('questions').select('id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_upsc_cms, is_neetpg, is_inicet, is_allied, is_others, source, test_id, tests(*)').eq('course', selectedCourse);

        if (term) {
          const words = term.split(/\s+/).filter(w => w.length > 1 || /\d/.test(w));
          if (mode === 'Exact' || words.length > 1) {
            if (words.length > 1) {
              words.forEach(word => {
                const wordFilters = [];
                if (fields.includes('Questions')) wordFilters.push(`question_text.ilike.%${word}%`);
                if (fields.includes('Explanations')) wordFilters.push(`explanation_markdown.ilike.%${word}%`);
                if (wordFilters.length > 0) query = query.or(wordFilters.join(','));
              });
            } else {
              const termPattern = `%${term}%`;
              const filters = [];
              if (fields.includes('Questions')) filters.push(`question_text.ilike.${termPattern}`);
              if (fields.includes('Explanations')) filters.push(`explanation_markdown.ilike.${termPattern}`);
              if (filters.length > 0) query = query.or(filters.join(','));
            }
          } else {
            const termPattern = `%${term}%`;
            const filters = [];
            if (fields.includes('Questions')) filters.push(`question_text.ilike.${termPattern}`);
            if (fields.includes('Explanations')) filters.push(`explanation_markdown.ilike.${termPattern}`);
            if (filters.length > 0) query = query.or(filters.join(','));
          }
        }

        if (sf.selectedSubjects?.length > 0) query = query.in('subject', sf.selectedSubjects);
        if (sf.selectedSections?.length > 0) {
          const sections = sf.selectedSections.map((s: string) => s === "General" ? null : s);
          if (sections.includes(null)) {
            const nonNulls = sections.filter((s: any) => s !== null);
            if (nonNulls.length > 0) query = query.or(`section_group.in.(${nonNulls.join(',')}),section_group.is.null`);
            else query = query.is('section_group', null);
          } else {
            query = query.in('section_group', sections);
          }
        }
        if (sf.selectedMicrotopics?.length > 0) query = query.in('micro_topic', sf.selectedMicrotopics);

        if (sf.pyqFilter === 'PYQ Only') {
          query = query.eq('is_pyq', true);
          const cats = sf.pyqCategory || [];
          const fOr = [];
          if (selectedCourse === 'Medical Science') {
            if (cats.includes('NEET PG')) fOr.push('is_neetpg.eq.true');
            if (cats.includes('INI-CET')) fOr.push('is_inicet.eq.true');
            if (cats.includes('UPSC CMS')) fOr.push('is_upsc_cms.eq.true');
            if (cats.includes('Others')) fOr.push('is_others.eq.true');
          } else {
            if (cats.includes('UPSC') || cats.includes('UPSC CSE')) fOr.push('is_upsc_cse.eq.true');
            if (cats.includes('Allied') || cats.includes('Allied Exams')) fOr.push('is_allied.eq.true');
            if (cats.includes('Others')) fOr.push('is_others.eq.true');
          }
          if (fOr.length > 0) query = query.or(fOr.join(','));
        } else if (sf.pyqFilter === 'Non-PYQ') {
          query = query.eq('is_pyq', false);
        }
        if (sf.ncertFilter === 'NCERT Only') {
          query = query.eq('is_ncert', true);
        } else if (sf.ncertFilter === 'Non-NCERT') {
          query = query.or('is_ncert.is.null,is_ncert.eq.false');
        }

        if (sf.selectedInstitutes?.length > 0 || sf.selectedPrograms?.length > 0 || (sf.examStage && sf.examStage !== 'All')) {
          let tQuery = supabase.from('tests').select('id').eq('course', selectedCourse);
          if (sf.selectedInstitutes?.length > 0) tQuery = tQuery.in('institute', sf.selectedInstitutes);
          if (sf.selectedPrograms?.length > 0) tQuery = tQuery.in('program_name', sf.selectedPrograms);
          if (sf.examStage && sf.examStage !== 'All') tQuery = tQuery.ilike('series', `%${sf.examStage}%`);
          const { data: testRows } = await tQuery;
          const tIds = (testRows || []).map((t: any) => t.id);
          if (tIds.length > 0) query = query.in('test_id', tIds);
          else { setSearchResults([]); setQuestionCount(0); setLoadingSearch(false); return; }
        }

        let { data, error } = await query.range(from, from + CHUNK - 1);
        if (error) throw error;

        if (mode !== 'Exact' && term && term.length > 3) {
          const words = term.split(/\s+/).filter(Boolean);
          if (words.length === 1) {
            const word = words[0];
            const fuzzyPatterns = [];
            for (let i = 0; i < word.length; i++) {
              const pattern = word.substring(0, i) + '%' + word.substring(i + 1);
              if (fields.includes('Questions')) fuzzyPatterns.push(`question_text.ilike.%${pattern}%`);
              if (fields.includes('Explanations')) fuzzyPatterns.push(`explanation_markdown.ilike.%${pattern}%`);
            }

            let fuzzyQ = supabase.from('questions').select('id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_upsc_cms, is_neetpg, is_inicet, is_allied, is_others, source, test_id, tests(*)').eq('course', selectedCourse).or(fuzzyPatterns.join(',')).limit(100);
            if (sf.selectedSubjects?.length > 0) fuzzyQ = fuzzyQ.in('subject', sf.selectedSubjects);
            if (sf.selectedSections?.length > 0) {
              const fSections = sf.selectedSections.map((s: string) => s === 'General' ? null : s);
              if (fSections.includes(null)) {
                const nonNulls = fSections.filter((s: any) => s !== null);
                if (nonNulls.length > 0) fuzzyQ = fuzzyQ.or(`section_group.in.(${nonNulls.join(',')}),section_group.is.null`);
                else fuzzyQ = fuzzyQ.is('section_group', null);
              } else {
                fuzzyQ = fuzzyQ.in('section_group', fSections);
              }
            }
            if (sf.selectedMicrotopics?.length > 0) fuzzyQ = fuzzyQ.in('micro_topic', sf.selectedMicrotopics);
            if (sf.pyqFilter === 'PYQ Only') {
              fuzzyQ = fuzzyQ.eq('is_pyq', true);
            } else if (sf.pyqFilter === 'Non-PYQ') {
              fuzzyQ = fuzzyQ.eq('is_pyq', false);
            }
            if (sf.ncertFilter === 'NCERT Only') fuzzyQ = fuzzyQ.eq('is_ncert', true);
            if (sf.ncertFilter === 'Non-NCERT') fuzzyQ = fuzzyQ.or('is_ncert.is.null,is_ncert.eq.false');

            if (sf.selectedInstitutes?.length > 0 || sf.selectedPrograms?.length > 0 || (sf.examStage && sf.examStage !== 'All')) {
              let tfQuery = supabase.from('tests').select('id').eq('course', selectedCourse);
              if (sf.selectedInstitutes?.length > 0) tfQuery = tfQuery.in('institute', sf.selectedInstitutes);
              if (sf.selectedPrograms?.length > 0) tfQuery = tfQuery.in('program_name', sf.selectedPrograms);
              if (sf.examStage && sf.examStage !== 'All') tfQuery = tfQuery.ilike('series', `%${sf.examStage}%`);
              const { data: tfRows } = await tfQuery;
              const tfIds = (tfRows || []).map((t: any) => t.id);
              if (tfIds.length > 0) fuzzyQ = fuzzyQ.in('test_id', tfIds);
              else fuzzyQ = fuzzyQ.in('test_id', ['__NO_MATCH__']);
            }

            const { data: fData } = await fuzzyQ;
            if (fData && fData.length > 0) {
              const existingIds = new Set((data || []).map((d: any) => d.id));
              const merged = [...(data || [])];
              fData.forEach((fd: any) => { if (!existingIds.has(fd.id)) merged.push(fd); });
              data = merged;
            }
          }
        }

        if (!data || data.length === 0) break;
        allFreshData.push(...data);
        if (data.length < CHUNK) break;
        from += CHUNK;
      }

      const { mergedQs } = mergeQuestions(allFreshData);

      mergedQs.sort((a: any, b: any) => {
        const aText = (a.question_text + ' ' + (a.explanation_markdown || '')).toLowerCase();
        const bText = (b.question_text + ' ' + (b.explanation_markdown || '')).toLowerCase();
        const aExact = aText.includes(term.toLowerCase());
        const bExact = bText.includes(term.toLowerCase());
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        const getRank = (q: any) => {
          const src = (q.source?.group || q.exam_group || q.tests?.series || q.tests?.title || '').toUpperCase();
          if (selectedCourse === 'Medical Science') {
            if (q.is_neetpg || src.includes('NEET PG')) return 3;
            if (q.is_inicet || src.includes('INI-CET')) return 2;
            if (q.is_upsc_cms || src.includes('UPSC CMS')) return 1;
            return 0;
          } else {
            if (q.is_upsc_cse || src.includes('UPSC CSE')) return 3;
            if (q.is_allied) return 2;
            if (q.is_pyq) return 1;
            return 0;
          }
        };
        const rA = getRank(a), rB = getRank(b);
        if (rA !== rB) return rB - rA;
        const yA = parseInt(a.exam_year || a.tests?.exam_year || '0'), yB = parseInt(b.exam_year || b.tests?.exam_year || '0');
        return yB - yA;
      });

      setSearchResults(mergedQs);
      setQuestionCount(mergedQs.length);
    } catch (err) {
      console.error('Search fetch error:', err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const fetchMetadata = async () => {
    console.log('[ARENA-INIT] fetchMetadata called', {
      timestamp: new Date().toISOString(),
      cacheAge: arenaMetadataCache ? Date.now() - arenaMetadataCachedAt : 'no-cache'
    });
    
    const hasWarmCache = Array.isArray(arenaMetadataCache) && arenaMetadataCache.length > 0;

    if (hasWarmCache) {
      // Immediate paint from warm cache to avoid entry lag/faded loading state.
      console.log('[ARENA-CACHE] Using warm metadata cache:', { itemCount: (arenaMetadataCache || []).length });
      setMetadata(arenaMetadataCache || []);
      setLoading(false);
    } else {
      console.log('[ARENA-CACHE] No warm cache, loading from storage...');
      setLoading(true);
    }

    const isCacheFresh = hasWarmCache && (Date.now() - arenaMetadataCachedAt) < ARENA_METADATA_CACHE_TTL_MS;
    if (isCacheFresh) {
      console.log('[ARENA-CACHE] Metadata cache still fresh, skipping refresh');
      fetchUserTags();
      return;
    }

    // Only show "Syncing filters..." when there's no warm cache
    if (!hasWarmCache) {
      setRefreshingMetadata(true);
    }
    
    try {
      console.log('[ARENA-LOAD] Fetching consolidated metadata from OfflineManager...');
      const flattened = await OfflineManager.getConsolidatedMetadata();
      const normalized = Array.isArray(flattened) ? flattened : [];

      // Filter metadata by selected course and category (cse vs cms)
      const courseFiltered = normalized.filter((item: any) => {
        const targetCategory = selectedCourse === 'Medical Science' ? 'cms' : 'cse';
        return item.course === selectedCourse || item.exam_category === targetCategory;
      });

      console.log('[ARENA-LOAD] Offline data:', { totalItems: normalized.length, courseItems: courseFiltered.length, course: selectedCourse });

      let dataToShow = courseFiltered;

      // If offline cache is completely empty, fetch from Supabase immediately
      // and start background sync without blocking the UI
      if (courseFiltered.length === 0) {
        console.log('[ARENA-LOAD] Offline cache empty, fetching metadata from Supabase directly (course:', selectedCourse, ')');
        
        try {
          // Fetch metadata directly from Supabase — don't wait for sync
          const { data: supabaseQuestions, error } = await supabase
            .from('questions')
            .select('course, subject, section_group, micro_topic, sub_topic, test_id, id, exam_category, exam_stage, tests(series, institute, program_name, title)')
            .eq('course', selectedCourse)
            .not('subject', 'is', null)
            .limit(5000);

          if (!error && supabaseQuestions?.length) {
            dataToShow = supabaseQuestions.map((q: any) => {
              const testObj = Array.isArray(q.tests) ? q.tests[0] : q.tests;
              return {
                course: q.course || selectedCourse,
                subject: q.subject || null,
                section_group: q.section_group || null,
                micro_topic: q.micro_topic || null,
                test_id: q.test_id || null,
                id: q.id,
                exam_category: q.exam_category || null,
                exam_stage: q.exam_stage || null,
                series: testObj?.series || null,
                institute: testObj?.institute || null,
                program_name: testObj?.program_name || null,
                title: testObj?.title || null,
              };
            });
            console.log('[ARENA-LOAD] ✅ Metadata from Supabase:', { items: supabaseQuestions.length, course: selectedCourse });
          } else {
            console.log('[ARENA-LOAD] No data from Supabase for:', selectedCourse, error || '');
          }
        } catch (fetchErr) {
          console.warn('[ARENA-LOAD] Supabase direct fetch failed:', fetchErr);
        }

        // Start background sync (non-blocking — don't await)
        if (session?.user?.id) {
          setSyncProgress({ phase: 'tests', current: 0, total: 1, detail: 'Starting download...' });
          OfflineManager.syncAllContent(session.user.id, (progress) => {
            setSyncProgress(progress);
          }).then(() => {
            console.log('[ARENA-LOAD] ✅ Background sync completed');
            setSyncProgress(null);
          }).catch((syncErr: any) => {
            console.warn('[ARENA-LOAD] Background sync failed:', syncErr);
            setSyncProgress(null);
          });
        }
      } else {
        console.log('[ARENA-LOAD] ✅ Using offline cache');
      }

      arenaMetadataCache = dataToShow;
      arenaMetadataCachedAt = Date.now();
      setMetadata(dataToShow);

      if (session?.user?.id) {
        await fetchUserTags();
      }

      // Background sync: Only if offline cache had data, try to get more from Supabase (non-blocking)
      if (courseFiltered.length > 0) {
        setTimeout(async () => {
          try {
            console.log('[ARENA-SYNC] Starting background sync for course:', selectedCourse);
            const { data: supabaseQuestions, error } = await supabase
              .from('questions')
              .select('course, subject, section_group, micro_topic, sub_topic, test_id, id, exam_category, exam_stage, tests(series, institute, program_name, title)')
              .eq('course', selectedCourse)
              .not('subject', 'is', null)
              .limit(5000);

            if (error) throw error;
            if (supabaseQuestions?.length) {
              const flatSynced = supabaseQuestions.map((q: any) => {
                const testObj = Array.isArray(q.tests) ? q.tests[0] : q.tests;
                return {
                  course: q.course || selectedCourse,
                  subject: q.subject || null,
                  section_group: q.section_group || null,
                  micro_topic: q.micro_topic || null,
                  test_id: q.test_id || null,
                  id: q.id,
                  exam_category: q.exam_category || null,
                  exam_stage: q.exam_stage || null,
                  series: testObj?.series || null,
                  institute: testObj?.institute || null,
                  program_name: testObj?.program_name || null,
                  title: testObj?.title || null,
                };
              });

              console.log('[ARENA-SYNC] ✅ Synced from Supabase:', { items: flatSynced.length, course: selectedCourse });
              
              // Only update UI if we have more data than what was offline
              if (flatSynced.length > courseFiltered.length) {
                arenaMetadataCache = flatSynced;
                arenaMetadataCachedAt = Date.now();
                setMetadata(flatSynced);
                console.log('[ARENA-SYNC] Updated UI with synced flat data');
              }
            }
          } catch (syncErr) {
            console.log('[ARENA-SYNC] Background sync failed (non-blocking):', syncErr);
          }
        }, 500);
      }
    } catch (err) {
      console.error('[ARENA-LOAD] ❌ Metadata fetch error:', { error: err, timestamp: new Date().toISOString() });
    } finally {
      setRefreshingMetadata(false);
      if (!hasWarmCache) setLoading(false);
    }
  };

  const updateQuestionCount = async () => {
    setCalculatingCount(true);
    const sf = searchFilters || {};
    try {
      if (activeTab === 'search') {
        setCalculatingCount(false);
        return;
      }

      const useOffline = OfflineManager.getOfflineQuestionsAllSync().length > 0;

      const isDefaultAllQuestions =
        activeTab === 'topic' &&
        selectedSubjects.length === 0 &&
        selectedSection.length === 0 &&
        selectedMicrotopic.length === 0 &&
        pyqMaster === 'All' &&
        selectedExamCategory.length === 0 &&
        deferredSelectedInstitutes.length === 0 &&
        selectedPrograms.length === 0 &&
        selectedTags.length === 0 &&
        ncertFilter === 'All';

      if (isDefaultAllQuestions) {
        // Count questions for the selected course only (not all courses)
        const qSource = useOffline ? LocalQuery : supabase;
        const { count, error } = await qSource.from('questions')
          .select('id', { count: 'exact', head: true })
          .eq('course', selectedCourse);
        if (!error && count && count > 0) {
          setQuestionCount(count);
          setCalculatingCount(false);
          return;
        }
      }

      if (activeTab === 'paper') {
        // Let the tab switch paint first, then compute lightweight count from cached metadata.
        await new Promise(resolve => setTimeout(resolve, 0));

        const isNcert = (v: any) => {
          if (v === true || v === 1) return true;
          if (typeof v === 'string') {
            const x = v.trim().toLowerCase();
            return x === 'true' || x === '1' || x === 'yes';
          }
          return false;
        };

        let rows = metadata.filter((m: any) => !!m.test_id);

        if (selectedTestId) {
          rows = rows.filter((m: any) => m.test_id === selectedTestId);
        } else {
          if (deferredSelectedInstitutes.length > 0) rows = rows.filter((m: any) => deferredSelectedInstitutes.includes(m.institute));
          if (selectedPrograms.length > 0) rows = rows.filter((m: any) => selectedPrograms.includes(m.program_name));
          if (selectedExamStage !== 'All') rows = rows.filter((m: any) => String(m.exam_stage || '').toLowerCase() === selectedExamStage.toLowerCase());
        }

        if (ncertFilter === 'NCERT Only') {
          rows = rows.filter((m: any) => isNcert(m.is_ncert));
        } else if (ncertFilter === 'Non-NCERT') {
          rows = rows.filter((m: any) => !isNcert(m.is_ncert));
        }

        setQuestionCount(rows.length);
        setCalculatingCount(false);
        return;
      }

      let query = (useOffline ? LocalQuery : supabase).from('questions').select('id', { count: 'exact', head: true }).eq('course', selectedCourse);

      if (activeTab === 'topic') {
        if (selectedSubjects.length > 0) query = query.in('subject', selectedSubjects);
        if (selectedSection.length > 0) {
          const sections = selectedSection.map(s => s === "General" ? null : s);
          if (sections.includes(null)) {
            const nonNulls = sections.filter(s => s !== null);
            if (nonNulls.length > 0) {
              const inStr = `section_group.in.(${nonNulls.map(s => `"${s}"`).join(',')})`;
              query = query.or(`${inStr},section_group.is.null`);
            }
            else query = query.is('section_group', null);
          } else {
            query = query.in('section_group', sections);
          }
        }
        if (selectedMicrotopic.length > 0) query = query.in('micro_topic', selectedMicrotopic);

        if (pyqMaster === 'PYQ Only') {
          query = query.eq('is_pyq', true);
          if (selectedExamCategory.length > 0) {
            const orFilters = [];
            if (selectedCourse === 'Medical Science') {
              if (selectedExamCategory.includes('NEET PG')) orFilters.push('is_neetpg.eq.true');
              if (selectedExamCategory.includes('INI-CET')) orFilters.push('is_inicet.eq.true');
              if (selectedExamCategory.includes('UPSC CMS')) orFilters.push('is_upsc_cms.eq.true');
              if (selectedExamCategory.includes('Others')) orFilters.push('is_others.eq.true');
            } else {
              if (selectedExamCategory.includes('UPSC CSE')) orFilters.push('is_upsc_cse.eq.true');
              if (selectedExamCategory.includes('Allied Exams')) orFilters.push('is_allied.eq.true');
              if (selectedExamCategory.includes('Others')) orFilters.push('is_others.eq.true');
            }
            if (orFilters.length > 0) query = query.or(orFilters.join(','));
          }
        } else if (pyqMaster === 'Non-PYQ') {
          query = query.eq('is_pyq', false);
        }

        if (ncertFilter === 'NCERT Only') {
          query = query.eq('is_ncert', true);
        } else if (ncertFilter === 'Non-NCERT') {
          query = query.not('is_ncert', 'eq', true);
        }

        if (selectedTags.length > 0) {
          if (!session?.user?.id) {
            setQuestionCount(0); setCalculatingCount(false); return;
          }
          const orQuery = selectedTags.map(t => `review_tags.cs.["${t}"]`).join(',');
          const { data: tagIds, error: tagErr } = await (useOffline ? LocalQuery : supabase).from('question_states')
            .select('question_id')
            .eq('user_id', session.user.id)
            .or(orQuery);

          if (!tagErr && tagIds) {
            const ids = tagIds.map(t => t.question_id);
            if (ids.length > 0) query = query.in('id', ids);
            else { setQuestionCount(0); setCalculatingCount(false); return; }
          } else {
            setQuestionCount(0); setCalculatingCount(false); return;
          }
        }

        if (deferredSelectedInstitutes.length > 0 || selectedPrograms.length > 0) {
          let tQuery = (useOffline ? LocalQuery : supabase).from('tests').select('id').eq('course', selectedCourse);
          if (deferredSelectedInstitutes.length > 0) tQuery = tQuery.in('institute', deferredSelectedInstitutes);
          if (selectedPrograms.length > 0) tQuery = tQuery.in('program_name', selectedPrograms);
          const { data: testRows } = await tQuery;
          const testIds = (testRows || []).map(t => t.id);
          if (testIds.length > 0) query = query.in('test_id', testIds);
        }
      } else if (activeTab === 'search') {
        setCalculatingCount(false);
        return;
      }

      const { count, error } = await query;
      if (error) throw error;
      setQuestionCount(count || 0);
      // Cache this count result
      const cacheKey = JSON.stringify({
        tab: activeTab, subjects: selectedSubjects, section: selectedSection,
        microtopic: selectedMicrotopic, pyq: pyqMaster, examCat: selectedExamCategory,
        inst: deferredSelectedInstitutes, prog: selectedPrograms, tags: selectedTags, ncert: ncertFilter
      });
      const cache = countCacheRef.current;
      cache.set(cacheKey, count || 0);
      if (cache.size > 50) {
        const first = cache.keys().next().value;
        if (first) cache.delete(first);
      }
    } catch (err) {
      console.error('[ARENA-COUNT] ❌ Error calculating question count:', err);
      // Set to 0 on error, but log it so we can debug
      setQuestionCount(0);
    } finally {
      setCalculatingCount(false);
    }
  };

  const subjects = useMemo(() => {
    let base = metadata;
    if (selectedExamStage !== 'All') {
      base = base.filter(m => String(m.exam_stage || '').toLowerCase() === selectedExamStage.toLowerCase());
    }
    return Array.from(new Set(base.map(m => m.subject).filter(Boolean))).sort();
  }, [metadata, selectedExamStage]);

  const sections = useMemo(() => {
    let base = selectedSubjects.length > 0
      ? metadata.filter(m => selectedSubjects.includes(m.subject))
      : metadata;
    if (selectedExamStage !== 'All') {
      base = base.filter(m => String(m.exam_stage || '').toLowerCase() === selectedExamStage.toLowerCase());
    }

    return Array.from(new Set(
      base
        .map(m => m.section_group)
        .filter(Boolean)
    )).sort();
  }, [metadata, selectedSubjects, selectedExamStage]);

  const microtopics = useMemo(() => {
    if (selectedSection.length === 0) return [];
    let base = metadata;
    if (selectedExamStage !== 'All') {
      base = base.filter(m => String(m.exam_stage || '').toLowerCase() === selectedExamStage.toLowerCase());
    }

    return Array.from(new Set(
      base
        .filter(m => {
          const subjectMatch = selectedSubjects.length === 0 || selectedSubjects.includes(m.subject);
          const sectionMatch = selectedSection.includes(m.section_group);
          return subjectMatch && sectionMatch;
        })
        .map(m => m.micro_topic)
        .filter(Boolean)
    )).sort();
  }, [metadata, selectedSubjects, selectedSection, selectedExamStage]);

  const examCategories = useMemo(() => {
    if (selectedCourse === 'Medical Science') {
      return ['NEET PG', 'INI-CET', 'UPSC CMS', 'Others'];
    }
    return ['UPSC CSE', 'Allied Exams', 'Others'];
  }, [selectedCourse]);

  const institutes = useMemo(() => {
    let base = metadata;
    // Apply subject filter with AND logic
    if (selectedSubjects.length > 0) {
      base = base.filter(m => selectedSubjects.includes(m.subject));
    }
    if (selectedExamStage !== 'All') {
      base = base.filter(m => String(m.exam_stage || '').toLowerCase() === selectedExamStage.toLowerCase());
    }
    return Array.from(new Set(base.map(m => m.institute).filter(Boolean))).sort();
  }, [metadata, selectedSubjects, selectedExamStage]);

  const programs = useMemo(() => {
    let base = metadata;
    if (deferredSelectedInstitutes.length > 0) base = base.filter(m => deferredSelectedInstitutes.includes(m.institute));
    if (selectedExamStage !== 'All') {
      base = base.filter(m => String(m.exam_stage || '').toLowerCase() === selectedExamStage.toLowerCase());
    }
    return Array.from(new Set(base.map(m => m.program_name).filter(Boolean))).sort();
  }, [metadata, deferredSelectedInstitutes, selectedExamStage]);

  const examStages = useMemo(() => {
    return Array.from(new Set(metadata.map(m => m.series).filter(Boolean))).sort();
  }, [metadata]);

  const testList = useMemo(() => {
    const tests = new Map();
    metadata.forEach(m => {
      if (!m.test_id) return;
      if (deferredSelectedInstitutes.length > 0 && !deferredSelectedInstitutes.includes(m.institute)) return;
      if (selectedPrograms.length > 0 && !selectedPrograms.includes(m.program_name)) return;
      if (selectedExamStage !== 'All' && String(m.exam_stage || '').toLowerCase() !== selectedExamStage.toLowerCase()) return;

      if (!tests.has(m.test_id)) {
        tests.set(m.test_id, {
          id: m.test_id,
          title: m.title || "Untitled Test",
          institute: m.institute,
          program: m.program_name,
          stage: m.series
        });
      }
    });
    return Array.from(tests.values()).sort((a, b) => String(a.title).localeCompare(String(b.title)));
  }, [metadata, deferredSelectedInstitutes, selectedPrograms, selectedExamStage]);

  const visiblePaperTests = useMemo(() => testList.slice(0, paperVisibleCount), [testList, paperVisibleCount]);

  const [showPreFlight, setShowPreFlight] = useState(false);

  // 5. Start Logic
  const handleLaunch = (mode: 'learning' | 'exam', timer?: string) => {
    setShowPreFlight(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const baseParams = {
      mode: mode,
      view: mode === 'exam' ? 'paper' : viewMode,
      timer: mode === 'exam' ? (timer || 'none') : 'none',
      showPYQTags: mode === 'exam' ? 'false' : (showPYQTags ? 'true' : 'false'),
    };

    let finalParams = {};

    if (activeTab === 'search') {
      finalParams = {
        ...baseParams,
        query: searchQuery,
        searchMode: searchFilters.searchMode,
        searchFields: searchFilters.searchFields?.join(','),
        subject: searchFilters.selectedSubjects?.[0] || 'All',
        subjects: searchFilters.selectedSubjects?.join(','),
        section: searchFilters.selectedSections?.join('|') || '',
        microtopic: searchFilters.selectedMicrotopics?.join('|') || '',
        institutes: searchFilters.selectedInstitutes?.join(','),
        programs: searchFilters.selectedPrograms?.join(','),
        examStage: searchFilters.examStage,
        pyqFilter: searchFilters.pyqFilter,
        pyqCategory: searchFilters.pyqCategory?.join(','),
        ncertFilter: searchFilters.ncertFilter,
        testId: '',
      };
    } else if (activeTab === 'topic') {
      finalParams = {
        ...baseParams,
        subject: selectedSubjects[0] || 'All',
        subjects: selectedSubjects.join(','),
        section: selectedSection.join('|'),
        microtopic: selectedMicrotopic.join('|'),
        pyqMaster: pyqMaster,
        examCategory: Array.isArray(selectedExamCategory) ? selectedExamCategory.join(',') : (selectedExamCategory || ''),
        institute: selectedInstitutes[0] || 'All',
        institutes: selectedInstitutes.join(','),
        program: selectedPrograms.join(',') || 'All',
        tags: selectedTags.join('|'),
        ncertFilter: ncertFilter,
        testId: '',
      };
    } else if (activeTab === 'paper') {
      finalParams = {
        ...baseParams,
        subject: 'All',
        section: '',
        microtopic: '',
        pyqMaster: 'All',
        examCategory: '',
        institute: selectedInstitutes[0] || 'All',
        institutes: selectedInstitutes.join(','),
        program: selectedPrograms.join(',') || 'All',
        examStage: selectedExamStage,
        tags: '',
        ncertFilter: ncertFilter,
        testId: selectedTestId || '',
      };
    }

    router.push({
      pathname: '/unified/engine',
      params: finalParams
    });
  };

  const renderTopicModal = () => {
    const subjectSections = Array.from(new Set(
      metadata
        .filter(m => selectedSubjects.length === 0 || selectedSubjects.includes(m.subject))
        .map(m => m.section_group)
        .filter(Boolean)
    )).sort();

    const subjectMicrotopics = Array.from(new Set(
      metadata
        .filter(m => {
          const subjectMatch = selectedSubjects.length === 0 || selectedSubjects.includes(m.subject);
          const sectionMatch = selectedSection.length === 0 || selectedSection.includes(m.section_group);
          const searchMatch = !topicSearch || m.micro_topic?.toLowerCase().includes(topicSearch.toLowerCase());
          return subjectMatch && sectionMatch && searchMatch;
        })
        .map(m => m.micro_topic)
        .filter(Boolean)
    )).sort();

    return (
      <Modal
        visible={showTopicModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowTopicModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismisser}
            activeOpacity={1}
            onPress={() => setShowTopicModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '90%', paddingHorizontal: 0 }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: 24 }]}>Topic Browser</Text>
                  <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600' }}>{selectedSubjects.length || 'All'} Subjects • {selectedSection.length || 'All'} Sections</Text>
                </View>
                <TouchableOpacity onPress={() => setShowTopicModal(false)}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}>
                    <XCircle size={24} color={colors.textSecondary} />
                  </View>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: 16, paddingHorizontal: 12, height: 48, marginTop: 12, borderWidth: 1, borderColor: colors.border }}>
                <Search size={18} color={colors.textTertiary} />
                <TextInput
                  placeholder="Find a microtopic..."
                  placeholderTextColor={colors.textTertiary}
                  style={{ flex: 1, marginLeft: 10, color: colors.textPrimary, fontWeight: '600' }}
                  value={topicSearch}
                  onChangeText={setTopicSearch}
                />
                {topicSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setTopicSearch('')}>
                    <XCircle size={18} color={colors.textTertiary} fill={colors.surfaceStrong} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => {
                    setSelectedSection([]);
                    setSelectedMicrotopic([]);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: colors.surfaceStrong, borderColor: colors.border, paddingHorizontal: 20 },
                    selectedSection.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.textSecondary, fontSize: 13 }, selectedSection.length === 0 && { color: '#fff' }]}>All Sections</Text>
                </TouchableOpacity>
                {subjectSections.map(s => {
                  const isSelected = selectedSection.includes(s);
                  return (
                    <TouchableOpacity
                      key={s}
                      activeOpacity={1}
                      onPress={() => {
                        setSelectedSection(prev => {
                          if (prev.includes(s)) return prev.filter(x => x !== s);
                          return [...prev, s];
                        });
                        setSelectedMicrotopic([]);
                      }}
                      style={[
                        styles.chip,
                        { backgroundColor: colors.surfaceStrong, borderColor: colors.border, paddingHorizontal: 16 },
                        isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }
                      ]}
                    >
                      <Text style={[styles.chipText, { color: colors.textSecondary, fontSize: 13 }, isSelected && { color: '#fff' }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingBottom: 120 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1.5 }}>MICRO-TOPICS ({subjectMicrotopics.length})</Text>
                {selectedMicrotopic.length > 0 && (
                  <TouchableOpacity onPress={() => setSelectedMicrotopic([])}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>CLEAR ({selectedMicrotopic.length})</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {subjectMicrotopics.length === 0 ? (
                  <View style={{ flex: 1, padding: 40, alignItems: 'center' }}>
                    <Text style={{ color: colors.textTertiary, fontSize: 14, textAlign: 'center' }}>No matching topics found.</Text>
                  </View>
                ) : (
                  subjectMicrotopics.map((m, idx) => {
                    const isSelected = selectedMicrotopic.includes(m);
                    return (
                      <TouchableOpacity
                        key={m}
                        activeOpacity={1}
                        onPress={() => {
                          setSelectedMicrotopic(prev => {
                            if (prev.includes(m)) return prev.filter(x => x !== m);
                            return [...prev, m];
                          });
                        }}
                        style={{
                          width: '48%',
                          backgroundColor: isSelected ? colors.primary + '10' : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: 1.5,
                          borderRadius: 16,
                          padding: 12,
                          marginBottom: 12,
                          minHeight: 64,
                          justifyContent: 'center'
                        }}
                      >
                        <Text style={{ color: isSelected ? colors.primary : colors.textPrimary, fontSize: 12, fontWeight: isSelected ? '800' : '600' }} numberOfLines={3}>{m}</Text>
                        {isSelected && (
                          <View style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface }}>
                            <Check size={10} color="#fff" />
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>

            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border }}>
              <TouchableOpacity
                style={[styles.launchBtn, { backgroundColor: colors.primary, height: 56, borderRadius: 18, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }]}
                onPress={() => setShowTopicModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>SAVE SELECTION</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <PageWrapper>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { paddingBottom: 16 }]}>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Unified Arena</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Setup your focus session</Text>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={handleRefresh} 
              colors={[colors.primary]} 
              tintColor={colors.primary} 
            />
          }
        >

          {(loading || refreshingMetadata || syncProgress) && (
            <View style={[styles.metadataRefreshBanner, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <View style={{ flex: 1, marginLeft: 4 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
                  {syncProgress ? 'Downloading questions…' : 'Syncing filters…'}
                </Text>
                {syncProgress && (
                  <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                    {syncProgress.phase === 'tests' ? `Finding tests…` :
                     syncProgress.phase === 'questions' ? `${syncProgress.detail} (${syncProgress.current}/${syncProgress.total})` :
                     syncProgress.phase === 'done' ? 'Saving…' :
                     syncProgress.detail}
                  </Text>
                )}
              </View>
              {syncProgress && syncProgress.total > 0 && (
                <View style={{ width: 60 }}>
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${Math.min(100, Math.round((syncProgress.current / syncProgress.total) * 100))}%`, backgroundColor: colors.primary, borderRadius: 2 }} />
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={[styles.tabBar, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setActiveTab('topic')}
              style={[styles.tab, activeTab === 'topic' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'topic' ? colors.primary : colors.textSecondary }]}>Topic-Wise</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('paper')}
              style={[styles.tab, activeTab === 'paper' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'paper' ? colors.primary : colors.textSecondary }]}>Paper-Wise</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('search')}
              style={[styles.tab, activeTab === 'search' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            >
              <Text style={[styles.tabText, { color: activeTab === 'search' ? colors.primary : colors.textSecondary }]}>Search</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'topic' && (
            <View style={styles.filterSection}>

              <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.groupHeader}>
                  <Filter size={14} color={colors.primary} />
                  <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Content Hierarchy</Text>
                </View>
                <FilterRow
                  title="Subject"
                  items={subjects}
                  selected={selectedSubjects}
                  onSelect={(vals: string[]) => {
                    setSelectedSubjects(vals);
                    setSelectedSection([]);
                    setSelectedMicrotopic([]);
                  }}
                  multi
                />

                <View style={{ marginTop: 8 }}>
                  <TouchableOpacity
                    onPress={() => setShowTopicModal(true)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: colors.primary + '10',
                      padding: 16,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: colors.primary + '30',
                      borderStyle: 'dashed'
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                        <LayoutGrid size={18} color="#fff" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: colors.textPrimary }}>Micro-Topic Selector</Text>
                        <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>
                          {selectedSection.length > 0 || selectedMicrotopic.length > 0
                            ? `${selectedSection.length} Sections, ${selectedMicrotopic.length} Topics`
                            : 'Select specific chapters or topics'}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.groupHeader}>
                  <Zap size={14} color={colors.primary} />
                  <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Targeting & Focus</Text>
                </View>
                <FilterRow
                  title="PYQ Mode"
                  items={['PYQ Only', 'Non-PYQ']}
                  selected={pyqMaster}
                  onSelect={(val: string) => {
                    setPyqMaster(val);
                    if (val !== 'PYQ Only') setSelectedExamCategory([]);
                  }}
                />
                <FilterRow
                  title="Exam Category"
                  items={examCategories}
                  selected={selectedExamCategory}
                  onSelect={setSelectedExamCategory}
                  multi={true}
                  showSelectAll={false}
                  visible={pyqMaster === 'PYQ Only'}
                />
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12, opacity: 0.5 }} />
                <FilterRow
                  title="Revision Tags"
                  items={userTags}
                  selected={selectedTags}
                  onSelect={setSelectedTags}
                  multi
                />
                <FilterRow
                  title="Curriculum"
                  items={['NCERT Only', 'Non-NCERT']}
                  selected={ncertFilter}
                  onSelect={setNcertFilter}
                />
              </View>

              <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.groupHeader}>
                  <BookOpen size={14} color={colors.primary} />
                  <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Source & Institute</Text>
                </View>
                <FilterRow
                  title="Institute"
                  items={institutes}
                  selected={selectedInstitutes}
                  onSelect={(vals: string[]) => {
                    setSelectedInstitutes(vals);
                    setSelectedPrograms([]);
                  }}
                  multi
                />
                <FilterRow
                  title="Program"
                  items={programs}
                  selected={selectedPrograms}
                  onSelect={setSelectedPrograms}
                  multi
                  visible={selectedInstitutes.length > 0}
                />
              </View>

            </View>
          )}

          {activeTab === 'paper' && (
            <View style={styles.paperContent}>
              <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.groupHeader}>
                  <Layout size={14} color={colors.primary} />
                  <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>Paper Configuration</Text>
                </View>
                <FilterRow
                  title="Exam Stage"
                  items={examStages}
                  selected={selectedExamStage}
                  onSelect={setSelectedExamStage}
                />
                <FilterRow
                  title="Institute"
                  items={institutes}
                  selected={selectedInstitutes}
                  onSelect={(vals: string[]) => {
                    setSelectedInstitutes(vals);
                    setSelectedPrograms([]);
                  }}
                  multi
                />
                <FilterRow
                  title="Program"
                  items={programs}
                  selected={selectedPrograms}
                  onSelect={setSelectedPrograms}
                />
                <FilterRow
                  title="Curriculum"
                  items={['NCERT Only', 'Non-NCERT']}
                  selected={ncertFilter}
                  onSelect={setNcertFilter}
                />
              </View>

              <View style={{ marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1 }}>
                  CHOOSE TEST ({testList.length})
                </Text>
              </View>

              {visiblePaperTests.map(test => (
                <TouchableOpacity
                  key={test.id}
                  onPress={() => {
                    setSelectedTestId(test.id === selectedTestId ? null : test.id);
                  }}
                  style={[
                    styles.testCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selectedTestId === test.id && { borderColor: colors.primary, borderWidth: 2 }
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.testTitle, { color: colors.textPrimary }]}>{test.title}</Text>
                    <Text style={[styles.testSubtitle, { color: colors.textTertiary }]}>
                      {test.institute} • {test.program}
                    </Text>
                  </View>
                  {selectedTestId === test.id && (
                    <View style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 4 }}>
                      <Check size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              {testList.length > paperVisibleCount && (
                <TouchableOpacity
                  onPress={() => setPaperVisibleCount((prev) => Math.min(prev + 40, testList.length))}
                  style={{ marginHorizontal: 20, marginBottom: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.primary + '55', alignItems: 'center' }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 12 }}>
                    Show More ({paperVisibleCount}/{testList.length})
                  </Text>
                </TouchableOpacity>
              )}

              {testList.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ color: colors.textTertiary }}>No tests found for the selected filters.</Text>
                </View>
              )}
            </View>
          )}

          {activeTab === 'search' && (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <TouchableOpacity
                onPress={() => router.push('/ai-search' as any)}
                testID="arena-search-redirect-btn"
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 12,
                  backgroundColor: '#7c3aed15', borderWidth: 1.5, borderColor: '#c4b5fd',
                  borderRadius: 20, paddingHorizontal: 20, paddingVertical: 16, width: '100%',
                }}
              >
                <Brain size={22} color="#7c3aed" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#7c3aed' }}>AI Universal Search</Text>
                  <Text style={{ fontSize: 11, color: '#7c3aed90', marginTop: 2 }}>AI · Fuzzy · Exact — all modes, all filters</Text>
                </View>
                <ChevronRight size={18} color="#7c3aed" />
              </TouchableOpacity>
              <Text style={{ marginTop: 12, fontSize: 11, color: colors.textTertiary, textAlign: 'center' }}>
                Search from the AI Search tab for the full experience with hierarchical filters.
              </Text>
            </View>
          )}

          <View style={[styles.filterGroupCard, { backgroundColor: colors.surface, borderColor: colors.border, marginHorizontal: 20, marginTop: 10, marginBottom: 40 }]}>
            <View style={styles.groupHeader}>
              <Layout size={14} color={colors.primary} />
              <Text style={[styles.groupTitle, { color: colors.textPrimary }]}>General Preferences</Text>
            </View>

            <FilterRow
              title="View Mode"
              items={['List View', 'Card View']}
              selected={viewMode === 'list' ? 'List View' : 'Card View'}
              onSelect={(val: string) => setViewMode(val === 'List View' ? 'list' : 'card')}
              showSelectAll={false}
              allowAll={false}
            />

            <TouchableOpacity
              onPress={() => setShowPYQTags(!showPYQTags)}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border + '30', marginTop: 8 }}
            >
              <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textTertiary, letterSpacing: 1 }}>SHOW PYQ CHIPS</Text>
              <View style={[styles.toggleTrack, { backgroundColor: showPYQTags ? colors.primary : colors.surfaceStrong }]}>
                <View style={[styles.toggleThumb, { left: showPYQTags ? 24 : 4, backgroundColor: '#fff' }]} />
              </View>
            </TouchableOpacity>
          </View>

        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={{ flex: 1.2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.countText, { color: colors.textPrimary }]}>
                {loading || refreshingMetadata || syncProgress ? '...' : (questionCount || 0)}
              </Text>
              {(calculatingCount || loading || refreshingMetadata || syncProgress) && <ActivityIndicator size="small" color={colors.textTertiary} />}
            </View>
            <Text style={[styles.countLabel, { color: colors.textTertiary }]} numberOfLines={2}>
              {syncProgress ? 'Downloading...' : (loading || refreshingMetadata ? 'Syncing Filters' : 'Targeted Questions\n(Pre-Dedupe)')}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 8, flex: 3 }}>
            <TouchableOpacity
              style={[styles.launchBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.primary, borderWidth: 1 }]}
              onPress={() => { handleLaunch('learning'); }}
              disabled={questionCount === 0 || loading || refreshingMetadata || !!syncProgress}
            >
              <BookOpen size={16} color={syncProgress ? colors.textTertiary : colors.primary} />
              <Text style={[styles.launchBtnText, { color: syncProgress ? colors.textTertiary : colors.primary, fontSize: 14 }]}>Learn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.launchBtn, { backgroundColor: syncProgress ? colors.surfaceStrong : colors.primary }]}
              onPress={() => { setArenaMode('exam'); setShowExamModal(true); }}
              disabled={questionCount === 0 || loading || refreshingMetadata || !!syncProgress}
            >
              <Target size={16} color={syncProgress ? colors.textTertiary : '#fff'} />
              <Text style={[styles.launchBtnText, { color: syncProgress ? colors.textTertiary : '#fff', fontSize: 14 }]}>Exam</Text>
            </TouchableOpacity>
          </View>
        </View>

        {renderTopicModal()}

        <Modal visible={showExamModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 8 }}>Exam Mode Setup</Text>
              <Text style={{ fontSize: 13, color: colors.textTertiary, marginBottom: 24 }}>Choose your timer preference for this session.</Text>

              <View style={{ gap: 12 }}>
                {[
                  { id: 'stopwatch', label: 'Stopwatch', sub: 'Count upwards', icon: Clock },
                  { id: 'countdown', label: 'Default Timer', sub: '2 mins per question', icon: Target },
                  { id: 'none', label: 'No Timer', sub: 'Relaxed practice', icon: XCircle }
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => { handleLaunch('exam', opt.id); setShowExamModal(false); }}
                    style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <opt.icon size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '800', color: colors.textPrimary }}>{opt.label}</Text>
                      <Text style={{ fontSize: 11, color: colors.textTertiary }}>{opt.sub}</Text>
                    </View>
                    <ChevronRight size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => setShowExamModal(false)}
                style={{ marginTop: 24, alignItems: 'center' }}
              >
                <Text style={{ color: colors.textTertiary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  metadataRefreshBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  header: { padding: 24, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  scrollContent: { paddingBottom: 160 },
  sectionCard: { marginHorizontal: 20, marginBottom: 20 },
  toggleContainer: { flexDirection: 'row', borderRadius: 16, padding: 4, borderWidth: 1 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12 },
  toggleText: { fontSize: 13, fontWeight: '700' },
  tabBar: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 12, fontWeight: '800' },
  filterSection: { gap: 16 },
  filterGroupCard: { marginHorizontal: 20, borderRadius: 20, padding: 16, borderWidth: 1 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  groupTitle: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  filterRowContainer: { marginBottom: 12 },
  filterRowTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  filterScroll: { gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, marginRight: 8 },
  chipText: { fontSize: 12, fontWeight: '700' },
  footer: { position: 'absolute', bottom: 0, width: '100%', padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 16 },
  countText: { fontSize: 24, fontWeight: '900', letterSpacing: -1 },
  countLabel: { fontSize: 9, fontWeight: '700', letterSpacing: 0.2, marginTop: -2, opacity: 0.6 },
  launchBtn: { flex: 1, height: 54, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, elevation: 4 },
  launchBtnText: { fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalDismisser: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginVertical: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900' },
  paperContent: { paddingTop: 10, paddingBottom: 40, gap: 16 },
  testCard: { padding: 20, borderRadius: 20, borderWidth: 1, marginHorizontal: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
  testTitle: { fontSize: 16, fontWeight: '800', marginBottom: 4 },
  testSubtitle: { fontSize: 12, fontWeight: '600', opacity: 0.7 },
  resultCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, gap: 12 },
  resultText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  resultMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultTag: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  seeAllBtn: { padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center', marginTop: 8, borderStyle: 'dashed' },
  seeAllBtnText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  fullModalOverlay: { flex: 1 },
  fullModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: Platform.OS === 'ios' ? 20 : 40 },
  fullModalTitle: { fontSize: 18, fontWeight: '900' },
  backBtn: { padding: 8 },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, position: 'absolute' },
});

export default function ArenaScreen() {
  return (
    <FeatureGate feature="quiz_arena" featureLabel="Quiz Arena">
      <UnifiedArenaSetup />
    </FeatureGate>
  );
}
