import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, Pressable, FlatList, Vibration, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  BookOpen, BarChart3, Play, Clock,
  RotateCcw, Zap, Sliders, FileText, Tag, Award, Brain
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { cacheGet, cacheSet } from '../../src/lib/cache';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { SyllabusService } from '../../src/services/SyllabusService';
import { MICRO_SYLLABUS } from '../../src/data/syllabus';
import { fetchPilotV2NotesForUser } from '../../src/repositories/pilotV2Repo';
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
  id: string; title: string; type: 'note' | 'folder'; updated_at: string; note_id: string | null;
};

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

// Memoized avatar component to prevent flicker on navigation
const AvatarDisplay = memo(function AvatarDisplay({ avatarId, name, colors }: any) {
  const avatarSource = useMemo(() => AVATARS.find(a => a.id === avatarId)?.uri, [avatarId]);
  
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
    if (userId) loadWidgets();
  }, [userId]);



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

    try {
      const [
        { data: qs },
        { count: notesCount },
        { count: cardsCount },
        { data: tagsData }
      ] = await Promise.all([
        supabase.from('question_states').select('is_incorrect_last_attempt').eq('user_id', userId),
        supabase.from('user_notes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('user_cards').select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'active')
          .not('next_review', 'is', null)
          .lte('next_review', new Date().toISOString()),
        supabase.from('user_tags')
          .select('name, usage_count')
          .eq('user_id', userId)
          .order('usage_count', { ascending: false })
          .limit(8)
      ]);

      // Recent notes on Home should come from Pilot V2 notebooks only.
      const pilotNotes = await fetchPilotV2NotesForUser(userId);
      const mapped: NoteNode[] = (pilotNotes || []).slice(0, 8).map((n: any) => ({
        id: n.id,
        title: n.title || 'Untitled',
        type: 'note',
        updated_at: n.updated_at,
        note_id: n.id,
      }));
      setRecentNotes(mapped);
      if (tagsData) setTopTags(tagsData.map(t => ({ name: t.name, count: t.usage_count || 0 })));

      const total = qs?.length || 0;
      const correct = qs?.filter(x => x.is_incorrect_last_attempt === false)?.length || 0;

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

      Object.entries(dataPool).forEach(([sub, groups]) => {
        if (selectedSubjects.length > 0 && !selectedSubjects.includes(sub)) return;
        if (!subjectStats[sub]) {
          subjectStats[sub] = { total: 0, completed: 0, color: COLORS[colorIdx % COLORS.length] };
          colorIdx++;
        }
        Object.entries(groups as any).forEach(([group, topics]) => {
          (topics as string[]).forEach(topic => {
            const path = `${sub}.${group}.${topic}`;
            const item = progress[path] || {};
            
            // 1. Replication of Tracker Logic: Topic Completion Score
            let compScore = 0;
            if (pyqReportMode === 'single') {
              compScore = item.mastered ? 1 : 0;
            } else {
              // Checkpoints averaging (matches tracker logic exactly)
              const done = Number(Boolean(item.mastered)) + Number(Boolean(item.ncert)) + Number(Boolean(item.pyqs)) + Number(Boolean(item.books));
              compScore = done / 4;
            }

            // 2. Replication of Tracker Logic: Weight Hierarchy fallback
            let weight = 1;
            const isEligibleForWeights = pyqDisplayMode === 'pyq_weighted' && activeCategory.toLowerCase() === 'prelims';
            if (isEligibleForWeights) {
              const t = String(topic).trim().toLowerCase();
              const g = String(group).trim().toLowerCase();
              const s = String(sub).trim().toLowerCase();
              weight = topicW[t] || sectionW[g] || subjectW[s] || 0;
            }

            totalItems += weight;
            completedItems += weight * compScore;
            subjectStats[sub].total += weight;
            subjectStats[sub].completed += weight * compScore;
          });
        });
      });

      // Final evaluation handling zero-weights fallback matching app/tracker.tsx
      syllabusPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      subjectProgress = Object.entries(subjectStats).map(([label, s]) => ({
        label, progress: s.total ? s.completed / s.total : 0, color: s.color
      })).sort((a, b) => b.progress - a.progress);

      const next: Stats = {
        attempts: total, accuracy: total ? Math.round((correct / total) * 100) : 0,
        dueCards: cardsCount || 0, totalNotes: notesCount || 0, streak: 5, syllabusPercent, subjectProgress
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
      const { data: testRows, error: testErr } = await supabase.from('tests').select('id, title, launch_year, exam_year, institute, program_id, program_name, series').limit(5000);
      if (testErr) throw testErr;
      const eligibleTests = (testRows || []).filter((t: any) => {
        const y = Number(t.launch_year || t.exam_year || 0);
        return y >= startYear && y <= endYear && isStrictPyqSource(t);
      });
      if (eligibleTests.length === 0) { Alert.alert('No tests found', 'No matching X-IAS / PYQ Book / UPSC CSE tests were found.'); return false; }
      const testIdSet = new Set(eligibleTests.map((t: any) => String(t.id)));
      const { data: qRows, error: qErr } = await supabase.from('questions').select('id, test_id, is_pyq, subject, section_group, micro_topic, source').in('test_id', Array.from(testIdSet)).eq('is_pyq', true).limit(12000);
      if (qErr) throw qErr;
      const filtered = (qRows || []).filter((q: any) => isStrictPyqSubject(q));
      if (filtered.length < count) { Alert.alert('Not enough questions', `Found only ${filtered.length} strict PYQ questions.`); return false; }
      const selected = filtered.map((q: any) => q.id).sort(() => Math.random() - 0.5).slice(0, count);
      router.push({ pathname: '/unified/engine', params: { mode: 'exam', view: 'list', timer: 'countdown', resultIds: selected.join(','), title: `Random PYQ ${startYear}-${endYear}` } } as any);
      return true;
    } catch (e: any) { Alert.alert('Launch failed', e?.message || 'Error'); return false; }
  }, []);

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

  const renderNoteCard = ({ item }: { item: NoteNode }) => (
    <TouchableOpacity
      style={[styles.noteCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
      onPress={() => router.push({ pathname: '/pilot-v2', params: { noteId: item.note_id || item.id } } as any)}
    >
      <LinearGradient colors={[colors.primary + '10', 'transparent']} style={styles.cardGlow} />
      <View style={styles.glassFill}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20', width: 32, height: 32 }]}>
          <FileText size={16} color={colors.primary} />
        </View>
        <Text style={[styles.noteTitle, { color: colors.textPrimary }]} numberOfLines={2}>{item.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
          <Clock size={10} color={colors.textTertiary} />
          <Text style={[styles.noteDate, { color: colors.textTertiary }]}>{new Date(item.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

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
                    backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border,
                    borderRadius: 26, paddingHorizontal: 16, paddingVertical: 12,
                  }}
                >
                  <Brain size={16} color="#7c3aed" />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.textTertiary }}>Search topics, PYQs, notes…</Text>
                  <View style={{ backgroundColor: '#7c3aed', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>AI</Text>
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

              <View style={styles.pulseGrid}>
                <TouchableOpacity style={[styles.pulseActionCard, { width: pulseTileWidth, borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.push('/pilot-v2')}>
                  <View style={[styles.resumeIconWrap, { backgroundColor: '#EC489920' }]}>
                    <BookOpen size={20} color="#EC4899" />
                  </View>
                  <Text style={[styles.pulseActionTitle, { color: colors.textPrimary }]}>Pilot V2</Text>
                  <Text style={[styles.pulseActionSub, { color: colors.textTertiary }]}>Structured Notes</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.pulseActionCard, { width: pulseTileWidth, borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.push('/analyse')}>
                  <View style={[styles.resumeIconWrap, { backgroundColor: '#34C75920' }]}>
                    <BarChart3 size={20} color="#34C759" />
                  </View>
                  <Text style={[styles.pulseActionTitle, { color: colors.textPrimary }]}>Analyse</Text>
                  <Text style={[styles.pulseActionSub, { color: colors.textTertiary }]}>Performance</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.pulseActionCard, { width: pulseTileWidth, borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => router.push('/flashcards/review')}>
                  <View style={[styles.resumeIconWrap, { backgroundColor: '#F59E0B20' }]}>
                    <RotateCcw size={20} color="#F59E0B" />
                  </View>
                  <Text style={[styles.pulseActionTitle, { color: colors.textPrimary }]}>{stats.dueCards}</Text>
                  <Text style={[styles.pulseActionSub, { color: colors.textTertiary }]}>Due Cards</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.pulseActionCard, { width: pulseTileWidth, borderColor: colors.border, backgroundColor: colors.surface }]} onPress={() => setPyqPickerVisible(true)}>
                  <View style={[styles.resumeIconWrap, { backgroundColor: '#6366F120' }]}>
                    <Play size={20} color="#4F46E5" />
                  </View>
                  <Text style={[styles.pulseActionTitle, { color: colors.textPrimary }]}>{pyqQuestionCount}</Text>
                  <Text style={[styles.pulseActionSub, { color: colors.textTertiary }]}>Random PYQ</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 3. Syllabus Tracker Widget */}
            <TouchableOpacity
              style={[styles.trackerWidget, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onLongPress={() => setConfigVisible(true)}
              onPress={() => router.push('/tracker')}
            >
              <LinearGradient colors={[colors.primary + '05', 'transparent']} style={styles.cardGlow} />
              <View style={styles.trackerTop}>
                <View style={[styles.trackerIcon, { backgroundColor: colors.primary + '20' }]}>
                  <Award size={24} color={colors.primary} />
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
                      <View style={[styles.barBase, { backgroundColor: colors.border + '50' }]}>
                        <LinearGradient
                          colors={[sp.color, sp.color + '90']}
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

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginTop: 32, marginBottom: 12 }}>
              <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>MY CUSTOM WIDGETS</Text>
              <TouchableOpacity
                onPress={() => setIsEditMode(!isEditMode)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 6,
                  backgroundColor: isEditMode ? '#ef444415' : colors.border + '30',
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8
                }}
              >
                {isEditMode ? (
                  <>
                    <Check size={12} color="#ef4444" />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#ef4444' }}>DONE</Text>
                  </>
                ) : (
                  <>
                    <Sliders size={12} color={colors.textSecondary} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>EDIT LAYOUT</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {isEditMode && (
              <Text style={{ color: colors.textTertiary, fontSize: 11, marginLeft: 20, marginBottom: 16, fontWeight: '600' }}>
                Hold and drag to reorder. Tap the Red X to remove.
              </Text>
            )}
          </>
        }
        renderItem={({ item, drag }) => (
          <ScaleDecorator>
            <TouchableOpacity 
              onLongPress={drag} 
              style={[
                styles.customWidgetItem, 
                isEditMode && { borderWidth: 1, borderColor: '#ef444430', borderStyle: 'dashed', borderRadius: 12 }
              ]}
              disabled={!isEditMode}
            >
              <WidgetRenderer 
                widgetKey={item.widget_key} 
                data={widgetData} 
                onArchive={() => handleToggleArchive(item)}
                isEditMode={isEditMode}
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
            
            <ScrollView nestedScrollEnabled contentContainerStyle={{ paddingBottom: 20 }}>
              {widgets.map(w => {
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
              })}
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
  const categories = ['Prelims', 'Mains', 'Optional'];
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
              {(['prelims', 'mains', 'optional'] as const).map(examType => (
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  userName: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  profileBtn: { elevation: 4 },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { color: '#fff', fontSize: 20, fontWeight: '900' },
  searchContainer: { marginTop: 4 },

  // Sections
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  sectionHeaderWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },

  // Pulse Cards
  pulseContainer: { marginBottom: 32 },
  pulseGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },
  pulseActionCard: { minHeight: 118, borderRadius: 24, borderWidth: 1, padding: 16, justifyContent: 'flex-start', elevation: 1 },
  pulseActionTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3, marginTop: 10 },
  pulseActionSub: { fontSize: 11, fontWeight: '700', marginTop: 2, opacity: 0.7 },
  cardGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  resumeIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' },

  // Syllabus Tracker Widget
  trackerWidget: { marginHorizontal: 20, borderRadius: 32, borderWidth: 1, padding: 24, marginBottom: 32, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 15 },
  trackerTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  trackerIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  trackerTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  catBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start', marginTop: 6 },
  badgeCatText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  masteryText: { fontSize: 28, fontWeight: '900', letterSpacing: -1 },
  subjectList: { gap: 16 },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  subItemRow: { gap: 8, width: '48%' },
  subTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  subName: { fontSize: 16, fontWeight: '800', flex: 1 },
  subPer: { fontSize: 12, fontWeight: '700', opacity: 0.6 },
  barBase: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barInner: { height: '100%', borderRadius: 4 },

  // Recent Notes
  notesSection: { marginBottom: 32 },
  notesScroll: { paddingHorizontal: 20, gap: 16 },
  noteCard: { width: 180, height: 130, borderRadius: 24, borderWidth: 1, overflow: 'hidden', elevation: 2 },
  glassFill: { flex: 1, padding: 20 },
  noteTitle: { fontSize: 16, fontWeight: '900', marginTop: 12, height: 44, lineHeight: 22 },
  noteDate: { fontSize: 11, fontWeight: '700', marginTop: 'auto', opacity: 0.5 },

  // Tags
  tagsSection: { marginBottom: 32 },
  tagCloud: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginTop: 16 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, borderWidth: 1, elevation: 1 },
  tagName: { fontSize: 14, fontWeight: '800' },
  tagCount: { fontSize: 10, fontWeight: '900', opacity: 0.4 },

  // Footer
  footerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, marginBottom: 40 },
  customWidgetItem: { marginHorizontal: 20, marginBottom: 12 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 20 },
  pyqForm: { gap: 20 },
  inputGroup: { gap: 10 },
  inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  yearInput: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontWeight: '700' },
  countInput: { height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: 16, fontWeight: '700' },
  launchBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  launchBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  catRow: { flexDirection: 'row', gap: 10 },
  catBtn: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  configCatText: { fontSize: 14, fontWeight: '700' },
  subGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  subItem: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  subText: { fontSize: 13, fontWeight: '600' },
  applyBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  applyText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  radioButton: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  optionText: { fontSize: 14, fontWeight: '600' },
});
