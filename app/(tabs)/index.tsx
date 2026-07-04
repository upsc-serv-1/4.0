import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable, FlatList, Vibration, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BookOpen, BarChart3, Play, Clock,
  RotateCcw, Zap, Sliders, FileText, Tag, Award, Brain, Flame, Target, PenTool, Sparkles, Library, Map,
  ScrollText, Landmark, Globe2, Leaf, TrendingUp, FlaskConical, Scale, Book,
  ChevronUp, ChevronDown
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { cacheGet, cacheSet } from '../../src/lib/cache';
import { useTheme } from '../../src/context/ThemeContext';
import { useCourse } from '../../src/context/CourseContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { SyllabusService } from '../../src/services/SyllabusService';
import { MICRO_SYLLABUS } from '../../src/data/syllabus';
import { fetchPilotV2NotesForUser } from '../../src/repositories/pilotV2Repo';
import { OfflineManager } from '../../src/services/OfflineManager';
import { NetworkStatus } from '../../src/lib/networkStatus';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppInfoGuide from '../../src/components/AppInfoGuide';
import { Check, X } from 'lucide-react-native';
import { Alert } from 'react-native';
import { WidgetService, Widget } from '../../src/services/WidgetService';
import { useWidgetData } from '../../src/hooks/useWidgetData';
import { WidgetRenderer } from '../../src/components/widgets/WidgetRenderer';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { AVATARS } from '../../src/constants/avatars';
import { Image } from 'react-native';
import { buildWeightedSyllabusData } from '../../src/lib/syllabusWeightedProgress';

type Stats = {
  attempts: number;
  accuracy: number;
  dueCards: number;
  totalNotes: number;
  streak: number;
  syllabusPercent: number;
  subjectProgress: { label: string; progress: number; color: string }[];
};

type NoteNode = {
  id: string; title: string; type: 'note' | 'folder'; updated_at: string; note_id: string | null; subject?: string | null;
};

interface PulseShortcut {
  id: string;
  label: string;
  sub: string;
  icon: string;
  color: string;
  visible: boolean;
}

const DEFAULT_SHORTCUTS: PulseShortcut[] = [
  { id: 'due_cards', label: 'Due Cards', sub: 'Flashcards', icon: 'RotateCcw', color: '#F59E0B', visible: true },
  { id: 'random_pyq', label: 'Random PYQ', sub: 'Prelims Test', icon: 'Play', color: '#6366F1', visible: true },
  { id: 'q_bank', label: 'Q-Bank', sub: 'Mains', icon: 'Library', color: '#3b82f6', visible: true },
  { id: 'data_facts', label: 'Data & Facts', sub: 'Mains Value Add', icon: 'BarChart3', color: '#3b82f6', visible: true },
  { id: 'intro_conclusion', label: 'Intro/Concl.', sub: 'Mains Value Add', icon: 'PenTool', color: '#10b981', visible: true },
  { id: 'ethics', label: 'Ethics Hub', sub: 'Mains Value Add', icon: 'Scale', color: '#06b6d4', visible: true },
  { id: 'quotes', label: 'Quotes/Hooks', sub: 'Mains Value Add', icon: 'Sparkles', color: '#8b5cf6', visible: true },
  { id: 'syllabus', label: 'Syllabus', sub: 'Mains', icon: 'Map', color: '#10b981', visible: true },
  { id: 'pyq_analysis', label: 'PYQ Analysis', sub: 'Mains', icon: 'BarChart3', color: '#8b5cf6', visible: true },
];

const normalizeText = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const WIDGET_LABELS: Record<string, string> = {
  daily_goal: 'Daily Goal Tracker',
  exam_countdown: 'Exam Countdown',
  questions_today: 'Questions Done Today',
  study_time_today: 'Study Time',
  weekly_streak: 'Weekly Activity Streak',
  accuracy_trend: 'Accuracy Trend',
  correct_incorrect: 'Today Correct vs Incorrect',
  speed_meter: 'Study Speed Meter',
  due_cards: 'Overdue Flashcards',
  mastery_ring: 'Syllabus Mastery Ring',
  pyq_coverage: 'PYQ Coverage Summary',
  recent_notes: 'Recent Notebook Activity',
  tagged_count: 'Tagged Questions Tally',
  quick_practice: 'Quick Practice Hub',
  last_test: 'Last Test Quick Score',
  test_scores: 'Test Scores Timeline',
  study_heatmap: 'Daily Consistency Heatmap'
};

// Pre-built avatar lookup map for O(1) access instead of Array.find
const AVATAR_MAP = Object.fromEntries(AVATARS.map(a => [a.id, a.uri]));
// Memoized avatar component to prevent flicker on navigation
const AvatarDisplay = memo(function AvatarDisplay({ avatarId, name, colors }: any) {
  const avatarSource = useMemo(() => avatarId ? AVATAR_MAP[avatarId] : undefined, [avatarId]);
  
  return (
    <LinearGradient colors={[colors.primary, colors.primary + 'CC']} style={[styles.avatarWrap, { overflow: 'hidden' }]}>
      {avatarId && avatarSource ? (
        <Image
          source={avatarSource}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <Text style={styles.avatarTxt}>{(name[0] || 'A').toUpperCase()}</Text>
      )}
    </LinearGradient>
  );
});

export default function Home() {
  const { colors } = useTheme();
  const { selectedCourse } = useCourse();
  const { session } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const userId = session?.user.id;
  const { displayName, avatarId } = useProfile();
  const name = displayName;
  const pulseCardGap = 12;
  const pulseColumns = windowWidth >= 900 ? 4 : 2;
  const pulseTileWidth = (windowWidth - 40 - pulseCardGap * (pulseColumns - 1)) / pulseColumns;

  const [stats, setStats] = useState<Stats>({
    attempts: 0, accuracy: 0, dueCards: 0, totalNotes: 0, streak: 5, syllabusPercent: 0, subjectProgress: []
  });
  const [recentNotes, setRecentNotes] = useState<NoteNode[]>([]);
  const [topTags, setTopTags] = useState<{ name: string, count: number }[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // PYQ Picker
  const [pyqPickerVisible, setPyqPickerVisible] = useState(false);
  const [pyqStartYear, setPyqStartYear] = useState('2013');
  const [pyqEndYear, setPyqEndYear] = useState(String(new Date().getFullYear()));
  const [pyqQuestionCount, setPyqQuestionCount] = useState('10');
  const [launchingPyq, setLaunchingPyq] = useState(false);

  // Widget Configuration
  const [configVisible, setConfigVisible] = useState(false);
  const [showFirstLaunchGuide, setShowFirstLaunchGuide] = useState(false);
  const [widgetCategory, setWidgetCategory] = useState<'Prelims' | 'Mains' | 'Optional'>('Prelims');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [optionalChoice, setOptionalChoice] = useState('Anthropology');

  // PYQ Widget Configuration
  const [pyqDisplayMode, setPyqDisplayMode] = useState<'normal' | 'pyq_weighted'>('normal');
  const [pyqExamType, setPyqExamType] = useState<'prelims' | 'mains' | 'optional'>('prelims');
  const [pyqReportMode, setPyqReportMode] = useState<'single' | 'multi'>('single');

  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showManage, setShowManage] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const longPressTimer = useRef<any>(null);
  const { data: widgetData, refresh: refreshWidgets } = useWidgetData(userId);

  const [shortcuts, setShortcuts] = useState<PulseShortcut[]>(DEFAULT_SHORTCUTS);
  const [manageTab, setManageTab] = useState<'widgets' | 'pulse'>('widgets');

  const handleToggleShortcut = useCallback((id: string) => {
    setShortcuts(prev => {
      const next = prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s);
      AsyncStorage.setItem('productivity_pulse_shortcuts', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleMoveShortcut = useCallback((index: number, direction: 'up' | 'down') => {
    setShortcuts(prev => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < next.length) {
        const temp = next[index];
        next[index] = next[targetIndex];
        next[targetIndex] = temp;
        AsyncStorage.setItem('productivity_pulse_shortcuts', JSON.stringify(next)).catch(() => {});
      }
      return next;
    });
  }, []);

  const activeWidgets = useMemo(() => widgets.filter(w => !w.is_archived), [widgets]);
  const archivedWidgets = useMemo(() => widgets.filter(w => w.is_archived), [widgets]);

  useEffect(() => {
    AsyncStorage.getItem('dashboard_widget_config').then(val => {
      if (val) {
        const parsed = JSON.parse(val);
        setWidgetCategory(parsed.category || 'Prelims');
        setSelectedSubjects(parsed.subjects || []);
      }
    });
    AsyncStorage.getItem('optional_choice').then(val => {
      if (val) setOptionalChoice(val);
    });
    // Load PYQ widget configuration - always set values
    WidgetService.getWidgetConfig('mastery_ring').then(config => {
      setPyqDisplayMode((config.pyqMode as any) || 'normal');
      setPyqExamType((config.examType as any) || 'prelims');
      setPyqReportMode((config.reportMode as any) || 'single');
    }).catch(() => {
      // On error, ensure defaults are set
      setPyqDisplayMode('normal');
      setPyqExamType('prelims');
      setPyqReportMode('single');
    });
    AsyncStorage.getItem('productivity_pulse_shortcuts').then(savedPulse => {
      if (savedPulse) {
        try {
          const parsed = JSON.parse(savedPulse) as PulseShortcut[];
          const merged = DEFAULT_SHORTCUTS.map(def => {
            const match = parsed.find(p => p.id === def.id);
            return match ? { ...def, visible: match.visible } : def;
          });
          merged.sort((a, b) => {
            const idxA = parsed.findIndex(p => p.id === a.id);
            const idxB = parsed.findIndex(p => p.id === b.id);
            if (idxA === -1) return 1;
            if (idxB === -1) return -1;
            return idxA - idxB;
          });
          setShortcuts(merged);
        } catch (e) {}
      }
    });
    if (userId) loadWidgets();
  }, [userId]);

  useEffect(() => {
    if (selectedCourse === 'Medical Science') {
      if (widgetCategory === 'Mains') setWidgetCategory('Prelims');
      if (pyqExamType === 'mains') setPyqExamType('prelims');
    }
  }, [selectedCourse, widgetCategory, pyqExamType]);

  const loadWidgets = useCallback(() => {
    if (userId) WidgetService.list(userId).then(setWidgets);
  }, [userId]);

  const handleToggleArchive = useCallback(async (w: Widget) => {
    const newStatus = !w.is_archived;
    // Optimistic local state update so UI reflects instantly
    setWidgets(prev => prev.map(item => item.id === w.id ? { ...item, is_archived: newStatus } : item));
    try {
      if (newStatus) {
        await WidgetService.archive(userId!, w.id);
      } else {
        await WidgetService.restore(userId!, w.id);
      }
    } catch (e) {
      // Revert on error by re-fetching
      loadWidgets();
    }
  }, [userId, loadWidgets]);

  const load = useCallback(async () => {
    if (!userId) return;
    const cached = await cacheGet<Stats>(`home:${userId}`);
    if (cached) setStats(cached);

    const now = new Date().toISOString();

    try {
      // ── OFFLINE-FIRST: Read from KVStore cache first ──
      const offlineStates = OfflineManager.getCollectionSync('question_states', userId) as any[];
      const offlineNotes = OfflineManager.getCollectionSync('user_notes', userId) as any[];
      const offlineCards = OfflineManager.getCollectionSync('user_cards', userId) as any[];
      const offlineTags = OfflineManager.getCollectionSync('user_tags', userId) as any[];

      const total = offlineStates?.length || 0;
      const correct = offlineStates?.filter(x => x.is_incorrect_last_attempt === false)?.length || 0;
      const notesCount = offlineNotes?.length || 0;
      const dueCards = (offlineCards || []).filter(c => 
        c.status === 'active' && c.next_review && c.next_review <= now
      ).length;
      const top8Tags = (offlineTags || [])
        .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
        .slice(0, 8)
        .map(t => ({ name: t.name, count: t.usage_count || 0 }));

      setTopTags(top8Tags);

      // Background: try Supabase for fresher data, but don't block UI.
      // Skip entirely when offline so we don't spam the network — the cache
      // values set above already populate the screen.
      if (NetworkStatus.isOnline()) Promise.all([
        supabase.from('question_states').select('is_incorrect_last_attempt').eq('user_id', userId),
        supabase.from('user_notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_cards').select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('status', 'active')
          .not('next_review', 'is', null).lte('next_review', now),
        supabase.from('user_tags').select('name, usage_count')
          .eq('user_id', userId).order('usage_count', { ascending: false }).limit(8)
      ]).then(([{ data: qs }, { count: supNotesCount }, { count: supCardsCount }, { data: supTags }]) => {
        const supTotal = qs?.length || 0;
        const supCorrect = qs?.filter(x => x.is_incorrect_last_attempt === false)?.length || 0;
        const supDueCards = supCardsCount || 0;
        const supNotes = supNotesCount || 0;
        const supTopTags = supTags ? supTags.map(t => ({ name: t.name, count: t.usage_count || 0 })) : top8Tags;

        // Only update if Supabase returned fresher data
        setStats(prev => ({
          ...prev,
          attempts: supTotal > 0 ? supTotal : prev.attempts,
          accuracy: supTotal > 0 ? Math.round((supCorrect / supTotal) * 100) : prev.accuracy,
          dueCards: supDueCards > 0 || supCardsCount === 0 ? supDueCards : prev.dueCards,
          totalNotes: supNotes > 0 || supNotesCount === 0 ? supNotes : prev.totalNotes,
        }));
        setTopTags(supTopTags.length > 0 ? supTopTags : top8Tags);
      }).catch(() => {
        // Supabase offline — keep using cached data, no error
      });

      // Recent notes on Home should come from Pilot V2 notebooks only.
      try {
        const pilotNotes = await fetchPilotV2NotesForUser(userId);
        const mapped: NoteNode[] = (pilotNotes || []).slice(0, 8).map((n: any) => ({
          id: n.id,
          title: n.title || 'Untitled',
          type: 'note',
          updated_at: n.updated_at,
          note_id: n.id,
          subject: n.subject || null,
        }));
        setRecentNotes(mapped);
      } catch (e) {
        // Offline: use cached notes from KVStore
        const cachedNotes = (OfflineManager.getCollectionSync('user_notes', userId) as any[]) || [];
        const mapped: NoteNode[] = cachedNotes.slice(0, 8).map((n: any) => ({
          id: n.id,
          title: n.title || 'Untitled',
          type: 'note',
          updated_at: n.updated_at,
          note_id: n.id,
          subject: n.subject || null,
        }));
        setRecentNotes(mapped);
      }

      let syllabusPercent = 0;
      let subjectProgress: { label: string; progress: number; color: string }[] = [];

      const progress = await SyllabusService.getProgress(userId);
      let totalItems = 0;
      let completedItems = 0;
      const subjectStats: Record<string, { total: number; completed: number; color: string }> = {};
      const COLORS = ['#007AFF', '#FF9500', '#34C759', '#AF52DE', '#FF2D55', '#5856D6', '#FFCC00'];
      let colorIdx = 0;

      // Fetch weighted counts if requested by widget configuration
      let topicW: Record<string, number> = {};
      let sectionW: Record<string, number> = {};
      let subjectW: Record<string, number> = {};

      if (pyqDisplayMode === 'pyq_weighted') {
        try {
          const weightResults = await buildWeightedSyllabusData({ mode: 'all' });
          topicW = weightResults.topicCounts || {};
          sectionW = weightResults.sectionCounts || {};
          subjectW = weightResults.subjectCounts || {};
        } catch (weightedErr) {
          console.warn('[StatsLoad] Failed building weighted syllabus data:', weightedErr);
        }
      }

      // Align active category pool from either source
      const activeCategory = pyqExamType ? (pyqExamType.charAt(0).toUpperCase() + pyqExamType.slice(1)) : widgetCategory;

      let dataPool = {};
      if (activeCategory === 'Optional') {
        const sourceSyllabus = (optionalChoice === 'Anthropology') ? require('../../src/data/syllabus').ANTHROPOLOGY_SYLLABUS : { "Paper 1": { "Fundamentals": [] }, "Paper 2": { "Indian Context": [] } };
        dataPool = { [`${optionalChoice} Paper 1`]: sourceSyllabus["Paper 1"], [`${optionalChoice} Paper 2`]: sourceSyllabus["Paper 2"] };
      } else if (activeCategory === 'Mains') {
        dataPool = require('../../src/data/syllabus').MAINS_SYLLABUS;
      } else {
        dataPool = MICRO_SYLLABUS;
      }

      Object.entries(dataPool).forEach(([sub, subNode]) => {
        if (selectedSubjects.length > 0 && !selectedSubjects.includes(sub)) return;
        if (!subjectStats[sub]) {
          subjectStats[sub] = { total: 0, completed: 0, color: COLORS[colorIdx % COLORS.length] };
          colorIdx++;
        }

        const traverse = (node: any, path: string, groupName: string) => {
          if (Array.isArray(node)) {
            node.forEach((topic: string) => {
              const fullPath = `${path}.${topic}`;
              const item = progress[fullPath] || {};

              let compScore = 0;
              if (pyqReportMode === 'single') {
                compScore = item.mastered ? 1 : 0;
              } else {
                const done = Number(Boolean(item.mastered)) + Number(Boolean(item.ncert)) + Number(Boolean(item.pyqs)) + Number(Boolean(item.books));
                compScore = done / 4;
              }

              let weight = 1;
              const isEligibleForWeights = pyqDisplayMode === 'pyq_weighted' && activeCategory.toLowerCase() === 'prelims';
              if (isEligibleForWeights) {
                const t = String(topic).trim().toLowerCase();
                const g = String(groupName).trim().toLowerCase();
                const s = String(sub).trim().toLowerCase();
                weight = topicW[t] || sectionW[g] || subjectW[s] || 0;
              }

              totalItems += weight;
              completedItems += weight * compScore;
              subjectStats[sub].total += weight;
              subjectStats[sub].completed += weight * compScore;
            });
          } else if (node && typeof node === 'object') {
            Object.entries(node).forEach(([key, val]) => {
              const nextGroup = path === sub ? key : groupName;
              traverse(val, `${path}.${key}`, nextGroup);
            });
          }
        };

        traverse(subNode, sub, "");
      });

      // Final evaluation handling zero-weights fallback matching app/tracker.tsx
      syllabusPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      subjectProgress = Object.entries(subjectStats).map(([label, s]) => ({
        label, progress: s.total ? s.completed / s.total : 0, color: s.color
      })).sort((a, b) => b.progress - a.progress);

      const next: Stats = {
        attempts: total, accuracy: total ? Math.round((correct / total) * 100) : 0,
        dueCards, totalNotes: notesCount, streak: 5, syllabusPercent, subjectProgress
      };
      setStats(next);
      await cacheSet(`home:${userId}`, next);
    } catch (err) { console.error("Home Load Error:", err); }
  }, [userId, widgetCategory, selectedSubjects, optionalChoice, pyqDisplayMode, pyqExamType, pyqReportMode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); refreshWidgets(); setRefreshing(false); };

  const isStrictPyqSource = (input: any) => {
    const institute = normalizeText(String(input?.institute || ''));
    const program = normalizeText(`${input?.program_name || ''} ${input?.program_id || ''} ${input?.program || ''}`);
    const examCategory = normalizeText(`${input?.exam_category || ''} ${input?.series || ''} ${input?.title || ''}`);
    const isRightInstitute = institute.includes('x ias') || institute.includes('forum ias');
    const isUpscCse = examCategory.includes('upsc cse') || (examCategory.includes('upsc') && examCategory.includes('cse')) || program.includes('upsc cse') || (program.includes('upsc') && program.includes('cse')) || program.includes('pyq book');
    return isRightInstitute && isUpscCse;
  };

  const isStrictPyqSubject = (q: any) => {
    const corpus = normalizeText(`${q?.subject || ''} ${q?.section_group || ''} ${q?.micro_topic || ''}`);
    const PYQ_EXCLUDED_TERMS = ['csat', 'current affairs', 'internal security', 'international relations'];
    if (PYQ_EXCLUDED_TERMS.some(term => corpus.includes(term))) return false;
    const PYQ_ALLOWED_SUBJECTS = ['agriculture', 'economy', 'environment', 'geography', 'history', 'polity', 'science and technology'];
    return [
      corpus.includes('agriculture'),
      corpus.includes('economy') || corpus.includes('economic'),
      corpus.includes('environment') || corpus.includes('ecology'),
      corpus.includes('geography'),
      corpus.includes('history'),
      corpus.includes('polity') || corpus.includes('constitution') || corpus.includes('governance'),
      corpus.includes('science and technology') || corpus.includes('science technology') || corpus.includes('science and tech') || corpus.includes('s and t'),
    ].some(Boolean);
  };

  const startRandomPyqTest = useCallback(async (startYear: number, endYear: number, count: number) => {
    try {
      // OFFLINE-FIRST: Use cached tests and questions from KVStore
      const cachedTests = OfflineManager.getOfflineTestsSync();
      let testRows: any[] = cachedTests?.length > 0 ? cachedTests : [];
      
      // If no offline tests, try Supabase
      if (testRows.length === 0) {
        const { data, error } = await supabase.from('tests').select('id, title, launch_year, exam_year, institute, program_id, program_name, series').eq('course', selectedCourse).limit(5000);
        if (error) throw error;
        testRows = data || [];
      }
      
      const eligibleTests = testRows.filter((t: any) => {
        const y = Number(t.launch_year || t.exam_year || 0);
        return y >= startYear && y <= endYear && isStrictPyqSource(t);
      });
      if (eligibleTests.length === 0) { Alert.alert('No tests found', 'No matching X-IAS / PYQ Book / UPSC CSE tests were found.'); return false; }
      
      const testIdSet = new Set(eligibleTests.map((t: any) => String(t.id)));
      
      // OFFLINE-FIRST: Filter cached questions
      const cachedQuestions = OfflineManager.getOfflineQuestionsAllSync();
      let qRows: any[] = [];
      if (cachedQuestions.length > 0) {
        qRows = cachedQuestions.filter((q: any) => testIdSet.has(String(q.test_id)));
      } else {
        const { data, error } = await supabase.from('questions')
          .select('id, test_id, is_pyq, subject, section_group, micro_topic, source')
          .eq('course', selectedCourse)
          .in('test_id', Array.from(testIdSet)).eq('is_pyq', true).limit(12000);
        if (error) throw error;
        qRows = data || [];
      }
      
      const filtered = qRows.filter((q: any) => isStrictPyqSubject(q));
      if (filtered.length < count) { Alert.alert('Not enough questions', `Found only ${filtered.length} strict PYQ questions.`); return false; }
      const selected = filtered.map((q: any) => q.id).sort(() => Math.random() - 0.5).slice(0, count);
      router.push({ pathname: '/unified/engine', params: { mode: 'exam', view: 'list', timer: 'countdown', resultIds: selected.join(','), title: `Random PYQ ${startYear}-${endYear}` } } as any);
      return true;
    } catch (e: any) { Alert.alert('Launch failed', e?.message || 'Error'); return false; }
  }, [selectedCourse]);

  const submitRandomPyqPicker = async () => {
    const startYear = Number(pyqStartYear);
    const endYear = Number(pyqEndYear);
    const count = Number(pyqQuestionCount);
    if (!Number.isFinite(startYear) || !Number.isFinite(endYear)) return;
    setLaunchingPyq(true);
    const success = await startRandomPyqTest(Math.min(startYear, endYear), Math.max(startYear, endYear), Math.floor(count));
    setLaunchingPyq(false);
    if (success) setPyqPickerVisible(false);
  };

  const handleLongPressIn = () => { longPressTimer.current = setTimeout(() => { Vibration.vibrate(50); setIsEditMode(true); }, 3000); };
  const handleLongPressOut = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };

  const getSubjectIconAndColor = (subjectName: string | null | undefined) => {
    if (!subjectName) {
      return {
        IconComponent: FileText,
        color: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
        cardGradient: ['rgba(59, 130, 246, 0.09)', 'rgba(59, 130, 246, 0)']
      };
    }

    const lc = subjectName.toLowerCase().replace(/[^a-z0-9&]/g, '');

    if (lc.includes('polit') || lc.includes('law') || lc.includes('constitut') || lc.includes('govern')) {
      return {
        IconComponent: Landmark,
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
        cardGradient: ['rgba(59, 130, 246, 0.09)', 'rgba(59, 130, 246, 0)']
      };
    }
    if (lc.includes('econom') || lc.includes('finance') || lc.includes('budget') || lc.includes('market') || lc.includes('csat')) {
      return {
        IconComponent: TrendingUp,
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.15)',
        cardGradient: ['rgba(245, 158, 11, 0.09)', 'rgba(245, 158, 11, 0)']
      };
    }
    if (lc.includes('history') || lc.includes('ancient') || lc.includes('medieval') || lc.includes('modern')) {
      return {
        IconComponent: ScrollText,
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
        cardGradient: ['rgba(239, 68, 68, 0.09)', 'rgba(239, 68, 68, 0)']
      };
    }
    if (lc.includes('geograph') || lc.includes('map') || lc.includes('intern') || lc.includes('relation')) {
      return {
        IconComponent: Globe2,
        color: '#0EA5E9',
        bgColor: 'rgba(14, 165, 233, 0.15)',
        cardGradient: ['rgba(14, 165, 233, 0.09)', 'rgba(14, 165, 233, 0)']
      };
    }
    if (lc.includes('science') || lc.includes('tech') || lc.includes('space') || lc.includes('biotech')) {
      return {
        IconComponent: FlaskConical,
        color: '#8B5CF6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        cardGradient: ['rgba(139, 92, 246, 0.09)', 'rgba(139, 92, 246, 0)']
      };
    }
    if (lc.includes('ethic') || lc.includes('philosoph') || lc.includes('moral') || lc.includes('integrity')) {
      return {
        IconComponent: Scale,
        color: '#8B5CF6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
        cardGradient: ['rgba(139, 92, 246, 0.09)', 'rgba(139, 92, 246, 0)']
      };
    }
    if (lc.includes('environ') || lc.includes('ecology') || lc.includes('agri') || lc.includes('farm') || lc.includes('cultur') || lc.includes('art')) {
      return {
        IconComponent: Leaf,
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
        cardGradient: ['rgba(16, 185, 129, 0.09)', 'rgba(16, 185, 129, 0)']
      };
    }

    return {
      IconComponent: Book,
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.15)',
      cardGradient: ['rgba(59, 130, 246, 0.09)', 'rgba(59, 130, 246, 0)']
    };
  };

  const renderNoteCard = ({ item }: { item: NoteNode }) => {
    const themeStyle = getSubjectIconAndColor(item.subject);
    const IconComponent = themeStyle.IconComponent;
    return (
      <TouchableOpacity
        style={[styles.noteCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
        onPress={() => router.push({ pathname: '/pilot-v2', params: { noteId: item.note_id || item.id } } as any)}
      >
        <LinearGradient 
          colors={themeStyle.cardGradient as [string, string]} 
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.glassFill}>
          <View style={[styles.iconCircle, { backgroundColor: themeStyle.bgColor, width: 36, height: 36, borderRadius: 18 }]}>
            <IconComponent size={16} color={themeStyle.color} />
          </View>
          <Text style={[styles.noteTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
            <Clock size={11} color={colors.textTertiary} />
            <Text style={[styles.noteDate, { color: colors.textTertiary }]}>{new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const saveConfig = async (category: any, subjects: string[], pyqMode?: 'normal' | 'pyq_weighted', examType?: 'prelims' | 'mains' | 'optional', reportMode?: 'single' | 'multi') => {
    const newConfig = { category, subjects };
    await AsyncStorage.setItem('dashboard_widget_config', JSON.stringify(newConfig));
    
    // Always save PYQ widget configuration
    if (pyqMode && examType && reportMode) {
      const pyqConfig = { pyqMode, examType, reportMode };
      await WidgetService.setWidgetConfig('mastery_ring', pyqConfig);
      // Update state immediately to reflect changes in UI
      setPyqDisplayMode(pyqMode);
      setPyqExamType(examType);
      setPyqReportMode(reportMode);
    }
    
    // Refresh widget data to ensure display updates
    refreshWidgets();
    load();
  };

  // ── First Launch: Show App Guide ────────────────
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const seen = await AsyncStorage.getItem('app_guide_seen');
        if (!seen) {
          setShowFirstLaunchGuide(true);
        }
      } catch (e) {}
    };
    checkFirstLaunch();
  }, []);

  return (
    <PageWrapper>
      <DraggableFlatList
        data={activeWidgets}
        keyExtractor={(item) => item.id}
        onDragEnd={({ data }) => { setWidgets(prev => [...data, ...prev.filter(w => w.is_archived)]); WidgetService.reorder(userId!, data.map(d => d.id)); }}
        activationDistance={20}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {/* 1. Header Section */}
            <View style={styles.heroSection}>
              <View style={styles.headerRow}>
                <View>
                  <Text style={[styles.greeting, { color: colors.textTertiary }]}>WELCOME BACK</Text>
                  <Text style={[styles.userName, { color: colors.textPrimary }]}>{name}</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
                  <AvatarDisplay avatarId={avatarId} name={name} colors={colors} />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <TouchableOpacity
                  onPress={() => router.push('/ai-search' as any)}
                  testID="home-search-redirect-btn"
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: '#7c3aed33',
                    borderRadius: 26, paddingHorizontal: 18, paddingVertical: 14,
                    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2
                  }}
                >
                  <Brain size={18} color="#7c3aed" />
                  <Text style={{ flex: 1, fontSize: 14, color: colors.textTertiary, fontWeight: '500' }}>Search topics, PYQs, notes…</Text>
                  <View style={{ backgroundColor: '#7c3aed', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 0.5 }}>AI</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Productivity Pulse */}
            <View style={styles.pulseContainer}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>PRODUCTIVITY PULSE</Text>
                <Zap size={14} color={colors.primary} />
              </View>

              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.pulseScroll}
              >
                {shortcuts
                  .filter(s => s.visible && (!['q_bank', 'data_facts', 'intro_conclusion', 'ethics', 'quotes', 'syllabus', 'pyq_analysis'].includes(s.id) || selectedCourse !== 'Medical Science'))
                  .map(s => {
                    const gradientColors = s.id === 'due_cards' 
                      ? ['rgba(245, 158, 11, 0.09)', 'rgba(245, 158, 11, 0)']
                      : s.id === 'random_pyq'
                      ? ['rgba(99, 102, 241, 0.09)', 'rgba(99, 102, 241, 0)']
                      : s.id === 'data_facts' || s.id === 'q_bank'
                      ? ['rgba(59, 130, 246, 0.09)', 'rgba(59, 130, 246, 0)']
                      : s.id === 'intro_conclusion' || s.id === 'syllabus'
                      ? ['rgba(16, 185, 129, 0.09)', 'rgba(16, 185, 129, 0)']
                      : s.id === 'ethics'
                      ? ['rgba(6, 182, 212, 0.09)', 'rgba(6, 182, 212, 0)']
                      : ['rgba(139, 92, 246, 0.09)', 'rgba(139, 92, 246, 0)'];

                    const onPress = () => {
                      if (s.id === 'due_cards') router.push('/flashcards/review');
                      else if (s.id === 'random_pyq') setPyqPickerVisible(true);
                      else if (s.id === 'q_bank') router.push({ pathname: '/mains', params: { initialScreen: 'questions' } });
                      else if (s.id === 'data_facts') router.push({ pathname: '/mains', params: { initialScreen: 'value-add', category: 'data_facts' } });
                      else if (s.id === 'intro_conclusion') router.push({ pathname: '/mains', params: { initialScreen: 'value-add', category: 'intro_conclusion' } });
                      else if (s.id === 'ethics') router.push({ pathname: '/mains', params: { initialScreen: 'value-add', category: 'ethics' } });
                      else if (s.id === 'quotes') router.push({ pathname: '/mains', params: { initialScreen: 'value-add', category: 'quotes' } });
                      else if (s.id === 'syllabus') router.push({ pathname: '/tracker', params: { defaultMode: 'mains' } });
                      else if (s.id === 'pyq_analysis') router.push({ pathname: '/pyq', params: { fromTab: 'mains' } });
                    };

                    let IconComp = RotateCcw;
                    if (s.icon === 'Play') IconComp = Play;
                    else if (s.icon === 'Library') IconComp = Library;
                    else if (s.icon === 'BarChart3') IconComp = BarChart3;
                    else if (s.icon === 'PenTool') IconComp = PenTool;
                    else if (s.icon === 'Scale') IconComp = Scale;
                    else if (s.icon === 'Sparkles') IconComp = Sparkles;
                    else if (s.icon === 'Map') IconComp = Map;

                    let titleValue: string | number = s.label;
                    if (s.id === 'due_cards') titleValue = stats.dueCards;
                    else if (s.id === 'random_pyq') titleValue = pyqQuestionCount;

                    const isNumberTitle = typeof titleValue === 'number' || s.id === 'due_cards' || s.id === 'random_pyq';

                    return (
                      <TouchableOpacity 
                        key={s.id}
                        style={[styles.pulseActionCard, { borderColor: colors.border, backgroundColor: colors.surface }]} 
                        onPress={onPress}
                      >
                        <LinearGradient 
                          colors={gradientColors as [string, string]} 
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFillObject}
                        />
                        <View style={[styles.resumeIconWrap, { backgroundColor: s.color }]}>
                          <IconComp size={20} color="#fff" />
                        </View>
                        <Text style={[styles.pulseActionTitle, { color: colors.textPrimary }, isNumberTitle ? { fontSize: 28, marginTop: 14 } : { fontSize: 16, marginTop: 18 }]} numberOfLines={1}>
                          {titleValue}
                        </Text>
                        <Text style={[styles.pulseActionSub, { color: colors.textTertiary }]}>{s.sub}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
            </View>

            {/* 3. Syllabus Tracker Widget */}
            <TouchableOpacity
              style={[styles.trackerWidget, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onLongPress={() => setConfigVisible(true)}
              onPress={() => router.push('/tracker')}
            >
              <LinearGradient 
                colors={[colors.primary + '0b', colors.primary + '00']} 
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFillObject}
              />
              <View style={styles.trackerTop}>
                <View style={[styles.trackerIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Award size={24} color="#f59e0b" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.trackerTitle, { color: colors.textPrimary }]}>Syllabus Mastery</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <View style={[styles.catBadge, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.badgeCatText, { color: colors.primary }]}>{(pyqExamType ? pyqExamType.toUpperCase() : widgetCategory.toUpperCase())}</Text>
                    </View>
                    {pyqDisplayMode === 'pyq_weighted' && (
                      <View style={[styles.catBadge, { backgroundColor: '#f59e0b20' }]}>
                        <Text style={[styles.badgeCatText, { color: '#d97706' }]}>PYQ WEIGHTED</Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.masteryText, { color: colors.primary }]}>{stats.syllabusPercent}%</Text>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase' }}>Completed</Text>
                </View>
              </View>
              <View style={styles.subjectList}>
                <View style={styles.subjectGrid}>
                  {stats.subjectProgress.slice(0, 8).map(sp => (
                    <View key={sp.label} style={styles.subItemRow}>
                      <View style={styles.subTextRow}>
                        <Text style={[styles.subName, { color: colors.textSecondary }]} numberOfLines={1}>{sp.label}</Text>
                        <Text style={[styles.subPer, { color: colors.textTertiary }]}>{Math.round(sp.progress * 100)}%</Text>
                      </View>
                      <View style={[styles.barBase, { backgroundColor: colors.border + '30' }]}>
                        <LinearGradient
                          colors={[sp.color, sp.color + 'aa']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={[styles.barInner, { width: `${Math.max(sp.progress * 100, 5)}%` }]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>

            {/* 4. Recent Notes Carousel */}
            <View style={styles.notesSection}>
              <View style={styles.sectionHeaderWide}>
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>RECENT NOTES (PILOT V2)</Text>
                <TouchableOpacity onPress={() => router.push('/pilot-v2')}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Open Pilot V2</Text></TouchableOpacity>
              </View>
              <FlatList
                horizontal
                data={recentNotes}
                renderItem={renderNoteCard}
                keyExtractor={item => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.notesScroll}
              />
            </View>

            {/* 5. Quick Tags Chips */}
            <View style={styles.tagsSection}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginLeft: 20 }]}>TOP TAGS</Text>
              <View style={styles.tagCloud}>
                {topTags.map((tag, idx) => {
                  const tagColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                  const tagColor = tagColors[idx % tagColors.length];
                  return (
                    <TouchableOpacity key={tag.name} style={[styles.tagChip, { backgroundColor: colors.surface, borderColor: tagColor + '30' }]} onPress={() => router.push({ pathname: '/unified/arena', params: { tab: 'topic', tags: tag.name, autorun: 'learn' } } as any)}>
                      <Tag size={12} color={tagColor} />
                      <Text style={[styles.tagName, { color: colors.textPrimary }]}>{tag.name}</Text>
                      <View style={{ backgroundColor: tagColor + '15', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                        <Text style={[styles.tagCount, { color: tagColor }]}>{tag.count}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        }
        renderItem={({ item, drag }) => (
          <ScaleDecorator>
            <TouchableOpacity 
              style={styles.customWidgetItem}
              disabled={true}
            >
              <WidgetRenderer 
                widgetKey={item.widget_key} 
                data={widgetData} 
                onArchive={() => handleToggleArchive(item)}
                isEditMode={false}
                config={
                  item.widget_key === 'mastery_ring' 
                    ? { pyqMode: pyqDisplayMode, examType: pyqExamType, reportMode: pyqReportMode }
                    : {}
                }
              />
            </TouchableOpacity>
          </ScaleDecorator>
        )}
        ListFooterComponent={() => (
          <TouchableOpacity onPress={() => setShowManage(true)} style={styles.footerBtn}>
            <Sliders size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Manage Dashboard Widgets</Text>
          </TouchableOpacity>
        )}
      />

      {/* Modals */}
      <Modal visible={pyqPickerVisible} transparent animationType="fade" onRequestClose={() => setPyqPickerVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPyqPickerVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <Pressable style={[styles.modalContent, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Random PYQ Test</Text>
              <View style={styles.pyqForm}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>YEAR RANGE</Text>
                  <View style={styles.yearRow}>
                    <TextInput value={pyqStartYear} onChangeText={setPyqStartYear} keyboardType="number-pad" style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border }]} />
                    <Text style={{ color: colors.textTertiary }}>to</Text>
                    <TextInput value={pyqEndYear} onChangeText={setPyqEndYear} keyboardType="number-pad" style={[styles.yearInput, { color: colors.textPrimary, borderColor: colors.border }]} />
                  </View>
                </View>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>QUESTION COUNT</Text>
                  <TextInput value={pyqQuestionCount} onChangeText={setPyqQuestionCount} keyboardType="number-pad" style={[styles.countInput, { color: colors.textPrimary, borderColor: colors.border }]} />
                </View>
                <TouchableOpacity style={[styles.launchBtn, { backgroundColor: colors.primary }]} onPress={submitRandomPyqPicker}>
                  <Text style={styles.launchBtnTxt}>Generate Test</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <WidgetConfigModal visible={configVisible} onClose={() => setConfigVisible(false)} onSave={saveConfig} category={widgetCategory} setCategory={setWidgetCategory} selectedSubjects={selectedSubjects} setSelectedSubjects={setSelectedSubjects} optionalChoice={optionalChoice} pyqDisplayMode={pyqDisplayMode} setPyqDisplayMode={setPyqDisplayMode} pyqExamType={pyqExamType} setPyqExamType={setPyqExamType} pyqReportMode={pyqReportMode} setPyqReportMode={setPyqReportMode} colors={colors} />

      <Modal visible={showManage} transparent animationType="fade" onRequestClose={() => setShowManage(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.surface, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary }}>Manage Dashboard</Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>Select widgets to show on your screen</Text>
              </View>
              <TouchableOpacity onPress={() => setShowManage(false)} style={{ backgroundColor: colors.border + '50', padding: 6, borderRadius: 20 }}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            {/* Tab Selector */}
            <View style={{ flexDirection: 'row', backgroundColor: colors.border + '30', borderRadius: 12, padding: 4, marginBottom: 16 }}>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: manageTab === 'widgets' ? colors.surface : 'transparent', borderRadius: 8 }}
                onPress={() => setManageTab('widgets')}
              >
                <Text style={{ fontWeight: '700', fontSize: 13, color: manageTab === 'widgets' ? colors.textPrimary : colors.textTertiary }}>Dashboard Widgets</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={{ flex: 1, paddingVertical: 8, alignItems: 'center', backgroundColor: manageTab === 'pulse' ? colors.surface : 'transparent', borderRadius: 8 }}
                onPress={() => setManageTab('pulse')}
              >
                <Text style={{ fontWeight: '700', fontSize: 13, color: manageTab === 'pulse' ? colors.textPrimary : colors.textTertiary }}>Productivity Pulse</Text>
              </TouchableOpacity>
            </View>

            <ScrollView nestedScrollEnabled contentContainerStyle={{ paddingBottom: 20 }} style={{ minHeight: 300 }}>
              {manageTab === 'widgets' ? (
                widgets.map(w => {
                  const isActive = !w.is_archived;
                  const label = WIDGET_LABELS[w.widget_key] || w.widget_key.replace(/_/g, ' ').toUpperCase();
                  return (
                    <TouchableOpacity
                      key={w.id}
                      style={{ 
                        flexDirection: 'row', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        paddingVertical: 14, 
                        paddingHorizontal: 16,
                        borderBottomWidth: 1, 
                        borderBottomColor: colors.border,
                        backgroundColor: isActive ? 'transparent' : colors.surfaceStrong + '50',
                        borderRadius: 8,
                        marginBottom: 4
                      }}
                      onPress={() => handleToggleArchive(w)}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ color: isActive ? colors.textPrimary : colors.textTertiary, fontSize: 15, fontWeight: '700' }}>
                          {label}
                        </Text>
                      </View>
                      <View style={{ 
                        width: 44, height: 24, borderRadius: 12, 
                        backgroundColor: isActive ? colors.primary : colors.border,
                        justifyContent: 'center',
                        paddingHorizontal: 2
                      }}>
                        <View style={{ 
                          width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                          alignSelf: isActive ? 'flex-end' : 'flex-start',
                          elevation: 2
                        }} />
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                shortcuts.map((s, idx) => {
                  return (
                    <View
                      key={s.id}
                      style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center',
                        paddingVertical: 12, 
                        paddingHorizontal: 16,
                        borderBottomWidth: 1, 
                        borderBottomColor: colors.border,
                        backgroundColor: s.visible ? 'transparent' : colors.surfaceStrong + '50',
                        borderRadius: 8,
                        marginBottom: 4
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: s.visible ? colors.textPrimary : colors.textTertiary, fontSize: 15, fontWeight: '700' }}>
                          {s.label}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 1 }}>
                          {s.sub}
                        </Text>
                      </View>
                      
                      {/* Rearrange Arrows */}
                      <View style={{ flexDirection: 'row', gap: 4, marginRight: 16 }}>
                        <TouchableOpacity 
                          disabled={idx === 0}
                          onPress={() => handleMoveShortcut(idx, 'up')}
                          style={{ padding: 6, opacity: idx === 0 ? 0.2 : 0.8 }}
                        >
                          <ChevronUp size={18} color={idx === 0 ? colors.textTertiary : colors.textPrimary} />
                        </TouchableOpacity>
                        <TouchableOpacity 
                          disabled={idx === shortcuts.length - 1}
                          onPress={() => handleMoveShortcut(idx, 'down')}
                          style={{ padding: 6, opacity: idx === shortcuts.length - 1 ? 0.2 : 0.8 }}
                        >
                          <ChevronDown size={18} color={idx === shortcuts.length - 1 ? colors.textTertiary : colors.textPrimary} />
                        </TouchableOpacity>
                      </View>

                      {/* Toggle Switch */}
                      <TouchableOpacity
                        onPress={() => handleToggleShortcut(s.id)}
                        style={{ 
                          width: 44, height: 24, borderRadius: 12, 
                          backgroundColor: s.visible ? colors.primary : colors.border,
                          justifyContent: 'center',
                          paddingHorizontal: 2
                        }}
                      >
                        <View style={{ 
                          width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
                          alignSelf: s.visible ? 'flex-end' : 'flex-start',
                          elevation: 2
                        }} />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <TouchableOpacity 
              style={[styles.applyBtn, { backgroundColor: colors.primary, marginTop: 16 }]} 
              onPress={() => setShowManage(false)}
            >
              <Text style={styles.applyText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* First Launch App Guide */}
      <AppInfoGuide
        visible={showFirstLaunchGuide}
        onClose={() => {
          setShowFirstLaunchGuide(false);
          AsyncStorage.setItem('app_guide_seen', 'true').catch(() => {});
        }}
      />
    </PageWrapper>
  );
}

function WidgetConfigModal({ visible, onClose, onSave, category, setCategory, selectedSubjects, setSelectedSubjects, optionalChoice, pyqDisplayMode, setPyqDisplayMode, pyqExamType, setPyqExamType, pyqReportMode, setPyqReportMode, colors }: any) {
  const { selectedCourse } = useCourse();
  const categories = useMemo(() => {
    if (selectedCourse === 'Medical Science') {
      return ['Prelims', 'Optional'];
    }
    return ['Prelims', 'Mains', 'Optional'];
  }, [selectedCourse]);

  const subjects = useMemo(() => {
    if (category === 'Optional') return [`${optionalChoice} Paper 1`, `${optionalChoice} Paper 2`];
    if (category === 'Mains') return Object.keys(require('../../src/data/syllabus').MAINS_SYLLABUS);
    return Object.keys(MICRO_SYLLABUS);
  }, [category, optionalChoice]);

  const toggleSubject = (s: string) => {
    if (selectedSubjects.includes(s)) setSelectedSubjects(selectedSubjects.filter((x: string) => x !== s));
    else setSelectedSubjects([...selectedSubjects, s]);
  };

  const handleSave = () => {
    onSave(category, selectedSubjects, pyqDisplayMode, pyqExamType, pyqReportMode);
    onClose();
  };

  const examTypeOptions = useMemo(() => {
    if (selectedCourse === 'Medical Science') {
      return ['prelims', 'optional'] as const;
    }
    return ['prelims', 'mains', 'optional'] as const;
  }, [selectedCourse]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Widget Settings</Text>
            <TouchableOpacity onPress={onClose}><X color={colors.textPrimary} size={24} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
            {/* Syllabus Category Section */}
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>SYLLABUS CATEGORY</Text>
            <View style={styles.catRow}>
              {categories.map(c => (
                <TouchableOpacity key={c} style={[styles.catBtn, { backgroundColor: category === c ? colors.primary : colors.surfaceStrong }]} onPress={() => { setCategory(c); setPyqExamType(c.toLowerCase() as any); }}>
                  <Text style={[styles.configCatText, { color: category === c ? '#fff' : colors.textPrimary }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Visible Subjects Section */}
            <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 24 }]}>VISIBLE SUBJECTS</Text>
            <View style={styles.subGrid}>
              <TouchableOpacity style={[styles.subItem, { borderColor: colors.border }, selectedSubjects.length === 0 && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => setSelectedSubjects([])}>
                <Text style={[styles.subText, { color: colors.textPrimary }, selectedSubjects.length === 0 && { color: colors.primary, fontWeight: '800' }]}>All Subjects</Text>
              </TouchableOpacity>
              {subjects.map((s: any) => (
                <TouchableOpacity key={s} style={[styles.subItem, { borderColor: colors.border }, selectedSubjects.includes(s) && { backgroundColor: colors.primary + '20', borderColor: colors.primary }]} onPress={() => toggleSubject(s)}>
                  <Text style={[styles.subText, { color: colors.textPrimary }, selectedSubjects.includes(s) && { color: colors.primary, fontWeight: '800' }]}>{s}</Text>
                  {selectedSubjects.includes(s) && <Check size={14} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            {/* PYQ Display Mode Section */}
            <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 24 }]}>DISPLAY MODE</Text>
            <View style={{ gap: 10 }}>
              {(['normal', 'pyq_weighted'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.optionRow, { borderColor: colors.border, backgroundColor: pyqDisplayMode === mode ? colors.primary + '10' : 'transparent' }]}
                  onPress={() => { console.log('Setting display mode to:', mode); setPyqDisplayMode(mode); }}
                >
                  <View style={[styles.radioButton, { borderColor: colors.primary, backgroundColor: pyqDisplayMode === mode ? colors.primary : 'transparent' }]}>
                    {pyqDisplayMode === mode && <View style={[styles.radioDot, { backgroundColor: '#fff' }]} />}
                  </View>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                    {mode === 'normal' ? 'Normal Percentage' : 'PYQ Weighted Average'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Exam Type Section */}
            <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 24 }]}>EXAM TYPE</Text>
            <View style={{ gap: 10 }}>
              {examTypeOptions.map(examType => (
                <TouchableOpacity
                  key={examType}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.optionRow, { borderColor: colors.border, backgroundColor: pyqExamType === examType ? colors.primary + '10' : 'transparent' }]}
                  onPress={() => { setPyqExamType(examType); setCategory(examType.charAt(0).toUpperCase() + examType.slice(1)); }}
                >
                  <View style={[styles.radioButton, { borderColor: colors.primary, backgroundColor: pyqExamType === examType ? colors.primary : 'transparent' }]}>
                    {pyqExamType === examType && <View style={[styles.radioDot, { backgroundColor: '#fff' }]} />}
                  </View>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                    {examType.charAt(0).toUpperCase() + examType.slice(1)}
                  </Text>

                </TouchableOpacity>
              ))}
            </View>

            {/* Report Mode Section */}
            <Text style={[styles.modalLabel, { color: colors.textSecondary, marginTop: 24 }]}>REPORT MODE</Text>
            <View style={{ gap: 10 }}>
              {(['single', 'multi'] as const).map(mode => (
                <TouchableOpacity
                  key={mode}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={[styles.optionRow, { borderColor: colors.border, backgroundColor: pyqReportMode === mode ? colors.primary + '10' : 'transparent' }]}
                  onPress={() => { console.log('Setting report mode to:', mode); setPyqReportMode(mode); }}
                >
                  <View style={[styles.radioButton, { borderColor: colors.primary, backgroundColor: pyqReportMode === mode ? colors.primary : 'transparent' }]}>
                    {pyqReportMode === mode && <View style={[styles.radioDot, { backgroundColor: '#fff' }]} />}
                  </View>
                  <Text style={[styles.optionText, { color: colors.textPrimary }]}>
                    {mode === 'single' ? 'Single Report' : 'Multi-Report'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
            <Text style={styles.applyText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Hero & Header
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 11, fontWeight: '800', letterSpacing: 2, opacity: 0.6 },
  userName: { fontSize: 34, fontWeight: '900', letterSpacing: -1.2, marginTop: 4 },
  profileBtn: { 
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 
  },
  avatarWrap: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 20, fontWeight: '900' },
  searchContainer: { marginTop: 4 },

  // Sections
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 16 },
  sectionHeaderWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, opacity: 0.6 },

  // Pulse Cards
  pulseContainer: { marginBottom: 36 },
  pulseScroll: { paddingHorizontal: 24, gap: 12 },
  pulseActionCard: { 
    width: 190,
    height: 140, 
    borderRadius: 28, 
    borderWidth: 1, 
    padding: 20, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2,
    overflow: 'hidden'
  },
  pulseActionTitle: { fontSize: 16, fontWeight: '900', marginTop: 12, height: 44, lineHeight: 22, letterSpacing: -0.2 },
  pulseActionSub: { fontSize: 11, fontWeight: '700', marginTop: 'auto', opacity: 0.6 },
  cardGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  resumeIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

  // Syllabus Tracker Widget
  trackerWidget: { 
    marginHorizontal: 24, 
    borderRadius: 32, 
    borderWidth: 1, 
    padding: 24, 
    marginBottom: 36, 
    shadowColor: '#7c3aed', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 4,
    overflow: 'hidden'
  },
  trackerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  trackerIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  trackerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.7 },
  catBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start', marginTop: 8 },
  badgeCatText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  masteryText: { fontSize: 32, fontWeight: '900', letterSpacing: -1.2 },
  subjectList: { gap: 18 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  subItemRow: { gap: 10, width: '48%' },
  subTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontSize: 15, fontWeight: '800', flex: 1, letterSpacing: -0.2 },
  subPer: { fontSize: 12, fontWeight: '700', opacity: 0.6 },
  barBase: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barInner: { height: '100%', borderRadius: 3 },

  // Recent Notes
  notesSection: { marginBottom: 36 },
  notesScroll: { paddingHorizontal: 24, gap: 16 },
  noteCard: { 
    width: 190, 
    height: 140, 
    borderRadius: 28, 
    borderWidth: 1, 
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2
  },
  glassFill: { flex: 1, padding: 20 },
  noteTitle: { fontSize: 16, fontWeight: '900', marginTop: 12, height: 44, lineHeight: 22, letterSpacing: -0.2 },
  noteDate: { fontSize: 11, fontWeight: '700', marginTop: 'auto', opacity: 0.6 },

  // Tags
  tagsSection: { marginBottom: 36 },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 24, marginTop: 16 },
  tagChip: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 18, 
    borderWidth: 1, 
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 
  },
  tagName: { fontSize: 14, fontWeight: '800', letterSpacing: -0.1 },
  tagCount: { fontSize: 10, fontWeight: '900', opacity: 0.6 },

  // Footer
  footerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, marginBottom: 40 },
  customWidgetItem: { marginHorizontal: 24, marginBottom: 12 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 20, letterSpacing: -0.5 },
  pyqForm: { gap: 20 },
  inputGroup: { gap: 10 },
  inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, opacity: 0.6 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  yearInput: { flex: 1, height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, fontSize: 16, fontWeight: '700' },
  countInput: { height: 52, borderRadius: 16, borderWidth: 1, paddingHorizontal: 18, fontSize: 16, fontWeight: '700' },
  launchBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  launchBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, opacity: 0.6 },

  catRow: { flexDirection: 'row', gap: 10 },
  catBtn: { flex: 1, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  configCatText: { fontSize: 14, fontWeight: '700' },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  subItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  subText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  radioButton: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { fontSize: 14, fontWeight: '600' },
});
