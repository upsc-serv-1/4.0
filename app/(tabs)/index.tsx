import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Dimensions,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Search,
  Bell,
  Flame,
  Calendar,
  Check,
  Plus,
  BookOpen,
  FileText,
  PlayCircle,
  Sparkles,
  RefreshCw,
  BarChart3,
  X,
  Scan,
  Target,
  LayoutList,
  Play,
  Map,
  ChevronRight,
  Lightbulb,
  Trash2,
  Settings,
  Clock,
  Database,
  Tag
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useAuth } from '../../src/context/AuthContext';
import { useProfile } from '../../src/context/ProfileContext';
import { HomescreenService, DailyTask, StudyStreak, DailyInsight } from '../../src/services/homescreenService';
import { AVATARS } from '../../src/constants/avatars';
import LocalQuery from '../../src/services/LocalQuery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import { getPYQCategorization } from '../../src/utils/questionUtils';
import { MICRO_SYLLABUS, MAINS_SYLLABUS, ANTHROPOLOGY_SYLLABUS, MEDICAL_SCIENCE_SYLLABUS, OPTIONAL_SYLLABUS } from '../../src/data/syllabus';
import { SyllabusService, SyllabusProgress } from '../../src/services/SyllabusService';
import { supabase } from '../../src/lib/supabase';
import { KVStore } from '../../src/lib/kvStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_TABLET = SCREEN_WIDTH >= 768;
const AVATAR_MAP = Object.fromEntries(AVATARS.map(a => [a.id, a.uri]));

const calculateTabSubjects = (progress: Record<string, SyllabusProgress>, trackingMethod: 'single' | 'multi' = 'multi', optionalChoice: string = 'Anthropology') => {
  const getLeafNodes = (node: any, path: string): Array<{ path: string; topic: string }> => {
    if (Array.isArray(node)) {
      return node.map(topic => ({ path: `${path}.${topic}`, topic }));
    }
    const leaves: Array<{ path: string; topic: string }> = [];
    if (node && typeof node === 'object') {
      Object.entries(node).forEach(([key, val]) => {
        leaves.push(...getLeafNodes(val, `${path}.${key}`));
      });
    }
    return leaves;
  };

  const calc = (syllabusData: any, keys: string[], colors: string[], nameMap?: Record<string, string>) => {
    return keys.map((key, i) => {
      let total = 0;
      let completed = 0;
      
      const subjData = syllabusData[key];
      if (subjData) {
        const leaves = getLeafNodes(subjData, key);
        leaves.forEach(leaf => {
          const item = progress[leaf.path] || {};
          if (trackingMethod === 'single') {
            total += 1;
            if (item.mastered) completed++;
          } else {
            total += 4;
            if (item.mastered) completed++;
            if (item.ncert) completed++;
            if (item.pyqs) completed++;
            if (item.books) completed++;
          }
        });
      }
      
      return {
        id: key,
        name: nameMap ? (nameMap[key] || key) : key,
        percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        color: colors[i % colors.length]
      };
    });
  };

  const prelimsKeys = ['Polity', 'History', 'Agriculture', 'Science & Technology', 'International Relations', 'Geography', 'Environment', 'Economy'];
  const prelimsColors = ['#F97316', '#3B82F6', '#10B981', '#6366F1', '#EC4899', '#3B82F6', '#EAB308', '#3B82F6'];
  const prelims = calc(MICRO_SYLLABUS, prelimsKeys, prelimsColors);

  const mainsKeys = ['GS1', 'GS2', 'GS3', 'GS4', 'Essay'];
  const mainsColors = ['#F97316', '#3B82F6', '#10B981', '#6366F1', '#EC4899'];
  const mains = calc(MAINS_SYLLABUS, mainsKeys, mainsColors);
  
  const sourceSyllabus = optionalChoice === 'Anthropology' ? ANTHROPOLOGY_SYLLABUS : optionalChoice === 'Medical Science' ? MEDICAL_SCIENCE_SYLLABUS : OPTIONAL_SYLLABUS;
  const activeOptionalSyllabus = {
    [`${optionalChoice} Paper 1`]: sourceSyllabus["Paper 1"],
    [`${optionalChoice} Paper 2`]: sourceSyllabus["Paper 2"]
  };
  const optionalKeys = Object.keys(activeOptionalSyllabus);
  const optionalColors = ['#7C3AED', '#EC4899'];
  const optionalNameMap = {
    [`${optionalChoice} Paper 1`]: 'Paper 1',
    [`${optionalChoice} Paper 2`]: 'Paper 2'
  };
  const optional = calc(activeOptionalSyllabus, optionalKeys, optionalColors, optionalNameMap);
  
  // Create an Overall list combining all unique subjects
  const overallKeys = Array.from(new Set([...prelimsKeys, ...mainsKeys, ...optionalKeys]));
  const overallColors = [...prelimsColors, ...mainsColors, ...optionalColors];
  const overall = calc({ ...MICRO_SYLLABUS, ...MAINS_SYLLABUS, ...activeOptionalSyllabus }, overallKeys, overallColors, optionalNameMap);

  return { Prelims: prelims, Mains: mains, Optional: optional, Overall: overall };
};

const DEFAULT_TAB_SUBJECTS = {
  Prelims: [
    { id: 'Polity', name: 'Polity', percent: 0, color: '#F97316' },
    { id: 'History', name: 'History', percent: 0, color: '#3B82F6' },
    { id: 'Agriculture', name: 'Agriculture', percent: 0, color: '#10B981' },
    { id: 'Science & Technology', name: 'Science & Technology', percent: 0, color: '#6366F1' },
    { id: 'International Relations', name: 'International Relations', percent: 0, color: '#EC4899' },
    { id: 'Geography', name: 'Geography', percent: 0, color: '#3B82F6' },
    { id: 'Environment', name: 'Environment', percent: 0, color: '#EAB308' },
    { id: 'Economy', name: 'Economy', percent: 0, color: '#3B82F6' },
  ],
  Mains: [
    { id: 'GS1', name: 'GS1', percent: 0, color: '#F97316' },
    { id: 'GS2', name: 'GS2', percent: 0, color: '#3B82F6' },
    { id: 'GS3', name: 'GS3', percent: 0, color: '#10B981' },
    { id: 'GS4', name: 'GS4', percent: 0, color: '#6366F1' },
    { id: 'Essay', name: 'Essay', percent: 0, color: '#EC4899' },
  ],
  Optional: [
    { id: 'Anthropology Paper 1', name: 'Paper 1', percent: 0, color: '#7C3AED' },
    { id: 'Anthropology Paper 2', name: 'Paper 2', percent: 0, color: '#EC4899' },
  ],
  Overall: [] as any[]
};
DEFAULT_TAB_SUBJECTS.Overall = [...DEFAULT_TAB_SUBJECTS.Prelims, ...DEFAULT_TAB_SUBJECTS.Mains, ...DEFAULT_TAB_SUBJECTS.Optional];

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { displayName, avatarId } = useProfile();
  const name = displayName || 'Dr. Yogesh';

  const [tabSubjects, setTabSubjects] = useState(DEFAULT_TAB_SUBJECTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [prepTab, setPrepTab] = useState<'Prelims' | 'Mains' | 'Optional' | 'Overall'>('Prelims');
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [streak, setStreak] = useState<StudyStreak>({
    current_streak: 0,
    weekly_history: [false, false, false, false, false, false, false],
    last_activity_date: new Date().toISOString(),
  });
  const [insights, setInsights] = useState<DailyInsight[]>([]);
  const [insightIndex, setInsightIndex] = useState(0);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [addTaskModalVisible, setAddTaskModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');

  // --- Daily Challenge State ---
  const [inlineQuestion, setInlineQuestion] = useState<any>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
  const [challengePrefs, setChallengePrefs] = useState<{ subjects: string[]; institutes: string[]; programs: string[]; exams: string[]; pyqMode: 'all' | 'pyq_only' | 'non_pyq_only' }>({
    subjects: [], institutes: [], programs: [], exams: [], pyqMode: 'all'
  });
  const [availableFilters, setAvailableFilters] = useState<{ subjects: string[]; institutes: string[]; programs: string[]; exams: string[] }>({ subjects: [], institutes: [], programs: [], exams: ['UPSC CSE', 'Allied Exams', 'Others'] });
  const [tempPrefs, setTempPrefs] = useState(challengePrefs);

  // --- Quotes State ---
  const DEFAULT_USER_QUOTES = [
    { id: 'default1', text: 'Success in UPSC is not a sprint, but a well-paced marathon.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
    { id: 'default2', text: 'Governance is not about power, but about enabling people.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
    { id: 'default3', text: 'You have to dream before your dreams can come true.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
    { id: 'default4', text: 'If you fail, never give up because F.A.I.L. means First Attempt In Learning.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
    { id: 'default5', text: 'Arise, awake, and stop not till the goal is reached.', author: 'Swami Vivekananda', is_active: true },
    { id: 'default6', text: 'Small steps each day lead to big results on the final merit list.', author: 'Dr. A.P.J. Abdul Kalam', is_active: true },
  ];

  const [customQuotes, setCustomQuotes] = useState<{ id: string, text: string, author: string, is_active: boolean }[]>(DEFAULT_USER_QUOTES);
  const [activeQuote, setActiveQuote] = useState<any>(DEFAULT_USER_QUOTES[0]);
  const [isQuoteModalVisible, setIsQuoteModalVisible] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState('');
  const [newQuoteAuthor, setNewQuoteAuthor] = useState('');

  const pickRandomActiveQuote = (quotesList: any[]) => {
    const active = quotesList.filter((q: any) => q.is_active);
    if (active.length > 0) {
      const chosen = active[Math.floor(Math.random() * active.length)];
      setActiveQuote(chosen);
    } else if (quotesList.length > 0) {
      setActiveQuote(quotesList[0]);
    }
  };

  const handleNextQuote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const active = customQuotes.filter(q => q.is_active);
    if (active.length > 1) {
      const others = active.filter(q => q.id !== activeQuote?.id);
      const next = others[Math.floor(Math.random() * others.length)] || active[0];
      setActiveQuote(next);
    }
  };

  const loadQuotes = async () => {
    try {
      let mergedQuotes: any[] = DEFAULT_USER_QUOTES;

      // 1. Fast sync from MMKV local store
      const localKv = KVStore.getJson<any[]>('user_quotes_cache_' + (userId || 'global')) || KVStore.getJson<any[]>('user_quotes_cache');
      if (Array.isArray(localKv) && localKv.length > 0) {
        mergedQuotes = localKv;
        setCustomQuotes(mergedQuotes);
        pickRandomActiveQuote(mergedQuotes);
      } else {
        // 2. Fallback to AsyncStorage
        const cached = await AsyncStorage.getItem(`custom_quotes_${userId || 'guest'}`) || await AsyncStorage.getItem('custom_quotes_global');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            mergedQuotes = parsed;
            setCustomQuotes(mergedQuotes);
            pickRandomActiveQuote(mergedQuotes);
          }
        }
      }

      // 3. Supabase Cloud Sync (stored reliably in user_notes under subject: '__user_quotes__')
      if (userId) {
        const { data } = await supabase
          .from('user_notes')
          .select('id, content')
          .eq('user_id', userId)
          .eq('subject', '__user_quotes__')
          .maybeSingle();

        if (data?.content) {
          try {
            const cloudQuotes = JSON.parse(data.content);
            if (Array.isArray(cloudQuotes) && cloudQuotes.length > 0) {
              setCustomQuotes(cloudQuotes);
              KVStore.setJson('user_quotes_cache_' + userId, cloudQuotes);
              KVStore.setJson('user_quotes_cache', cloudQuotes);
              await AsyncStorage.setItem(`custom_quotes_${userId}`, JSON.stringify(cloudQuotes));
              pickRandomActiveQuote(cloudQuotes);
              return;
            }
          } catch {}
        }
      }

      pickRandomActiveQuote(mergedQuotes);
    } catch (e) {
      console.log('Error in loadQuotes:', e);
    }
  };

  const saveQuotes = async (newQuotes: any[]) => {
    setCustomQuotes(newQuotes);
    pickRandomActiveQuote(newQuotes);

    // Save locally to MMKV and AsyncStorage
    try {
      KVStore.setJson('user_quotes_cache_' + (userId || 'global'), newQuotes);
      KVStore.setJson('user_quotes_cache', newQuotes);
      await AsyncStorage.setItem(`custom_quotes_${userId || 'guest'}`, JSON.stringify(newQuotes));
      await AsyncStorage.setItem('custom_quotes_global', JSON.stringify(newQuotes));
    } catch {}

    // Save to Supabase
    if (userId) {
      try {
        const { data: existing } = await supabase
          .from('user_notes')
          .select('id')
          .eq('user_id', userId)
          .eq('subject', '__user_quotes__')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('user_notes')
            .update({
              content: JSON.stringify(newQuotes),
              title: 'Custom Quotes',
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('user_notes')
            .insert({
              user_id: userId,
              subject: '__user_quotes__',
              title: 'Custom Quotes',
              content: JSON.stringify(newQuotes),
            });
        }
      } catch (err) {
        console.log('Error saving quotes to Supabase:', err);
      }
    }
  };

  const handleAddQuote = () => {
    if (!newQuoteText.trim()) return;
    const nq = { id: 'uq_' + Date.now().toString(), text: newQuoteText.trim(), author: newQuoteAuthor.trim() || 'Dr. A.P.J. Abdul Kalam', is_active: true };
    const updated = [nq, ...customQuotes];
    saveQuotes(updated);
    setNewQuoteText('');
    setNewQuoteAuthor('');
  };

  const handleToggleQuote = (id: string) => {
    const updated = customQuotes.map(q => q.id === id ? { ...q, is_active: !q.is_active } : q);
    saveQuotes(updated);
  };

  const handleDeleteQuote = (id: string) => {
    const updated = customQuotes.filter(q => q.id !== id);
    saveQuotes(updated.length > 0 ? updated : DEFAULT_USER_QUOTES);
  };


  const loadDailyChallenge = async (prefsToUse?: typeof challengePrefs) => {
    try {
      let prefs = prefsToUse;
      if (!prefs) {
        const stored = await AsyncStorage.getItem('daily_challenge_prefs_v2');
        if (stored) {
          try { prefs = JSON.parse(stored); } catch(e){}
        }
      }
      const activePrefs = prefs || { subjects: [], institutes: [], programs: [], exams: [], pyqMode: 'all' };
      setChallengePrefs(activePrefs);
      
      const allQuestions = (await LocalQuery.from('questions')).data || [];
      const data = allQuestions;

      if (data.length > 0) {
        const subjects = Array.from(new Set(data.map((q: any) => q.subject).filter(Boolean))).sort() as string[];
        const institutes = Array.from(new Set(data.map((q: any) => q.institute || q._institute || (q.tests && q.tests.institute)).filter(Boolean))).sort() as string[];
        const programs = Array.from(new Set(data.map((q: any) => q.program_name || q._program_name || (q.tests && q.tests.program_name)).filter(Boolean))).sort() as string[];
        setAvailableFilters({ subjects, institutes, programs, exams: ['UPSC CSE', 'Allied Exams', 'Others'] });
      }
      if (data.length === 0) return;
      
      const filtered = data.filter((q: any) => {
        if (activePrefs.subjects.length > 0 && !activePrefs.subjects.includes(q.subject)) return false;
        const qInst = q.institute || q._institute || (q.tests && q.tests.institute);
        if (activePrefs.institutes.length > 0 && !activePrefs.institutes.includes(qInst)) return false;
        const qProg = q.program_name || q._program_name || (q.tests && q.tests.program_name);
        if (activePrefs.programs.length > 0 && !activePrefs.programs.includes(qProg)) return false;
        if (activePrefs.pyqMode === 'pyq_only' && !q.is_pyq) return false;
        if (activePrefs.pyqMode === 'non_pyq_only' && q.is_pyq) return false;
        if (activePrefs.exams && activePrefs.exams.length > 0) {
          const pyqCat = getPYQCategorization(q);
          let matched = false;
          if (activePrefs.exams.includes('UPSC CSE') && pyqCat.isUPSC) matched = true;
          if (activePrefs.exams.includes('Allied Exams') && pyqCat.isAllied) matched = true;
          if (activePrefs.exams.includes('Others') && pyqCat.isOther) matched = true;
          if (!matched) return false;
        }
        return true;
      });
        
      if (filtered.length > 0) {
        const randomQ = filtered[Math.floor(Math.random() * filtered.length)];
        let parsedOptions = randomQ.options;
        if (typeof parsedOptions === 'string') {
          try { parsedOptions = JSON.parse(parsedOptions); } catch (e) { parsedOptions = {}; }
        }
        
        let optionsArray: { label: string, text: string }[] = [];
        if (Array.isArray(parsedOptions)) {
           optionsArray = parsedOptions.map((text, idx) => ({ label: String.fromCharCode(65 + idx), text }));
        } else if (typeof parsedOptions === 'object' && parsedOptions !== null) {
           optionsArray = Object.entries(parsedOptions).map(([label, text]) => ({ label: String(label).toUpperCase(), text: String(text) }));
        }

        setInlineQuestion({
           ...randomQ,
           question: randomQ.question_text || randomQ.question || 'Question text not available',
           explanation: randomQ.explanation_markdown || randomQ.explanation || 'No explanation available.',
           answerLetter: String(randomQ.correct_answer || '').trim().toUpperCase(),
           parsedOptions: optionsArray 
        });
        setSelectedOption(null);
        setShowExplanation(false);
      } else {
        setInlineQuestion(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      loadData();
      loadDailyChallenge();
      loadQuotes();
      return () => { isActive = false; };
    }, [userId])
  );

  const loadData = async () => {
    const loadedTasks = await HomescreenService.getTodayTasks(userId);
    setTasks(loadedTasks);

    const loadedStreak = await HomescreenService.getStudyStreak(userId);
    setStreak(loadedStreak);

    const loadedInsights = await HomescreenService.getDailyInsights();
    setInsights(loadedInsights);

    const loadedNotes = await HomescreenService.getRecentNotes(userId);
    setRecentNotes(loadedNotes);

    if (userId) {
      const progress = await SyllabusService.getProgress(userId);
      const trackingMethod = await AsyncStorage.getItem('syllabus_tracking_method') as 'single' | 'multi' || 'multi';
      const optionalChoice = await AsyncStorage.getItem('optional_choice') || 'Anthropology';
      setTabSubjects(calculateTabSubjects(progress, trackingMethod, optionalChoice));
    } else {
      setTabSubjects(DEFAULT_TAB_SUBJECTS);
    }
  };

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      router.push({ pathname: '/search', params: { q: searchQuery } });
    } else {
      router.push('/search');
    }
  };

  const handleAISearch = () => {
    router.push({ pathname: '/ai-search', params: { q: searchQuery } });
  };

  const handleTaskToggle = async (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated = await HomescreenService.toggleTaskCompletion(taskId, userId, tasks);
    setTasks(updated);
  };

  const handleTaskDelete = async (taskId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updated = await HomescreenService.deleteTask(taskId, userId, tasks);
    setTasks(updated);
  };

  const handleAddNewTask = async () => {
    if (!newTaskTitle.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const updated = await HomescreenService.addTask(newTaskTitle.trim(), newTaskTime, userId, tasks);
    setTasks(updated);
    setNewTaskTitle('');
    setNewTaskTime('');
    setAddTaskModalVisible(false);
  };

  const handleNextInsight = () => {
    if (insights.length === 0) return;
    setInsightIndex((prev) => (prev + 1) % insights.length);
  };

  const handleToggleDayStreak = async (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updatedHistory = [...streak.weekly_history];
    updatedHistory[idx] = !updatedHistory[idx];
    const newStreakObj = {
      ...streak,
      weekly_history: updatedHistory,
      current_streak: updatedHistory.filter(Boolean).length,
    };
    setStreak(newStreakObj);
    await HomescreenService.saveStudyStreak(newStreakObj, userId);
  };

  const avatarSource = avatarId ? AVATAR_MAP[avatarId] : undefined;
  const currentInsight = insights[insightIndex] || insights[0];
  const currentSubjects = tabSubjects[prepTab] || [];
  const overallCompletion = Math.round(
    currentSubjects.reduce((sum, s) => sum + (s.percent || 0), 0) / Math.max(1, currentSubjects.length)
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      
      {/* ── GLOBAL FIXED DECORATIVE LAYER ── */}
      <View style={styles.globalArtworkLayer} pointerEvents="none">
        <Image
          source={require('../../assets/images/header_hero_new.png')}
          style={styles.globalArtworkImage}
          resizeMode="cover"
        />
        {/* Organic atmospheric dissolve to the left */}
        <LinearGradient
          colors={['#F8FAFC', 'rgba(248, 250, 252, 0.95)', 'rgba(248, 250, 252, 0.6)', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.globalFadeLeft}
        />
        {/* Long gradual dissolve into background at the bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(248, 250, 252, 0.3)', 'rgba(248, 250, 252, 0.8)', '#F8FAFC', '#F8FAFC']}
          start={{ x: 0, y: 0.2 }}
          end={{ x: 0, y: 1 }}
          style={styles.globalFadeBottom}
        />
      </View>

      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* ── FOREGROUND CONTENT (No background block, purely flowing) ── */}
        <View style={styles.contentContainer}>
          
          {/* ── 2. HEADER CONTENT ── */}
          <View style={styles.headerContainer}>
            {/* Left Section: Greeting */}
            <View style={styles.headerLeft}>
              <Text style={styles.headerWelcomeText}>WELCOME BACK</Text>
              <Text style={styles.headerNameText}>{name}</Text>
              <Text style={styles.headerSubtitleText}>Consistent effort today, a stronger India tomorrow. 🇮🇳</Text>
            </View>


            {/* Right Section: Bell, Avatar, Vertical 3-Line Tagline */}
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconCircleButton} onPress={() => Alert.alert('Notifications', 'No new unread notifications.')}>
                <Bell size={18} color="#475569" />
                <View style={styles.notifBadge} />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.avatarWrap} onPress={() => router.push('/profile')}>
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarFallback}><Text style={styles.avatarFallbackTxt}>{name[0]}</Text></View>
                )}
              </TouchableOpacity>

              <View style={styles.taglineContainer}>
                <Text style={styles.taglineText}>STUDY</Text>
                <Text style={styles.taglineText}>SERVE</Text>
                <Text style={styles.taglineText}>TRANSFORM</Text>
                <LinearGradient colors={['#F97316', '#FFFFFF', '#16A34A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.taglineBar} />
              </View>
            </View>
          </View>

          {/* ── 3. GLOBAL SEARCH BAR ── */}
          <View style={styles.searchBarCard}>
            <Search size={18} color="#94A3B8" style={{ marginRight: 10 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search topics, PYQs, notes, syllabus..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity style={{ padding: 4, marginRight: 6 }} onPress={() => setSearchQuery('')}>
                <X size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.aiButton} onPress={handleAISearch}>
              <LinearGradient colors={['#7C3AED', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.aiGradient}>
                <Text style={styles.aiButtonText}>AI</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scanButton} onPress={handleSearchSubmit}>
              <Scan size={18} color="#475569" />
            </TouchableOpacity>
          </View>


          {/* ── 4. ROW 1 (3-COLUMN GRID) ── */}
          <View style={[styles.rowGrid, { alignItems: 'flex-start' }]}>
            {/* COLUMN 1: My Preparation (44% Width) */}
            <View style={[styles.card, styles.col1Card, { overflow: 'hidden', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]}>
              {/* Premium Geometric Backgrounds */}
              <View style={{ position: 'absolute', top: -30, right: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(37, 99, 235, 0.03)', zIndex: 0 }} />
              <View style={{ position: 'absolute', bottom: 20, left: -40, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(124, 58, 237, 0.02)', zIndex: 0 }} />
              
              <View style={[styles.cardHeaderRow, { zIndex: 1 }]}>
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center' }}
                  onLongPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    Alert.alert(
                      'Syllabus Settings Sync',
                      'This widget automatically syncs with your Tracker settings. To switch between Single/Multi or Normal/PYQ modes, open the Tracker and change the settings at the top!',
                      [
                        { text: 'Open Tracker', onPress: () => router.push('/tracker') },
                        { text: 'Cancel', style: 'cancel' }
                      ]
                    );
                  }}
                >
                  <BarChart3 size={20} color="#2563EB" style={{ marginRight: 8 }} />
                  <Text style={styles.cardTitle}>My Preparation</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => router.push('/tracker')}>
                  <Text style={styles.linkText}>View Syllabus ›</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.prepContentRow}>
                <View style={{ flex: 1 }}>
                  {/* Tab Selector */}
                  <View style={styles.tabBar}>
                    {(['Prelims', 'Mains', 'Optional', 'Overall'] as const).map((tab) => (
                      <TouchableOpacity
                        key={tab}
                        style={[styles.tabItem, prepTab === tab && styles.activeTabItem]}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setPrepTab(tab);
                        }}
                      >
                        <Text style={[styles.tabText, prepTab === tab && styles.activeTabText]} numberOfLines={1}>{tab}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Interactive Subject Items */}
                  <View style={styles.subjectGrid}>
                    {currentSubjects.map((sub, idx) => (
                      <TouchableOpacity
                        key={sub.id || sub.name || idx}
                        style={styles.subjectItem}
                        onPress={() => router.push({ pathname: '/tracker', params: { subject: sub.id || sub.name, defaultMode: prepTab.toLowerCase() } })}
                      >
                        <View style={styles.subjectLabelRow}>
                          <Text style={styles.subjectName} numberOfLines={1}>{sub.name}</Text>
                          <Text style={styles.subjectPercent}>{sub.percent}%</Text>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressFill, { width: `${sub.percent}%`, backgroundColor: sub.color }]} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Donut Ring on Right */}
                <View style={styles.ringContainer}>
                  <Svg width={96} height={96} viewBox="0 0 100 100">
                    <Circle cx="50" cy="50" r="40" stroke="#E2E8F0" strokeWidth="8" fill="none" />
                    <Circle
                      cx="50"
                      cy="50"
                      r="40"
                      stroke="#10B981"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray="251.2"
                      strokeDashoffset={251.2 * (1 - overallCompletion / 100)}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                  </Svg>
                  <View style={styles.ringTextWrap}>
                    <Text style={styles.ringPercentTxt}>{overallCompletion}%</Text>
                    <Text style={styles.ringSubTxt}>Completed</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* COLUMN 2: Quick Actions (26% Width) */}
            <View style={[styles.card, { flex: IS_TABLET ? 1.4 : undefined, minHeight: 290, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#BBF7D0' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Sparkles size={20} color="#10B981" style={{ marginRight: 8 }} />
                <Text style={styles.cardTitle}>Quick Actions</Text>
              </View>

              <ScrollView style={{ flex: 1, maxHeight: 230 }} contentContainerStyle={styles.quickGrid} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#F3E8FF' }]} onPress={() => router.push('/pilot-v2')}>
                  <FileText size={22} color="#7C3AED" />
                  <Text style={[styles.quickTileTitle, { color: '#6B21A8' }]}>Create Note</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#FEF2F2' }]} onPress={() => router.push('/flashcards')}>
                  <Flame size={22} color="#EF4444" />
                  <Text style={[styles.quickTileTitle, { color: '#991B1B' }]}>Due Cards</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#D1FAE5' }]} onPress={() => router.push('/ai-search')}>
                  <Sparkles size={22} color="#059669" />
                  <Text style={[styles.quickTileTitle, { color: '#065F46' }]}>Ask AI</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#FFEDD5' }]} onPress={() => router.push('/pyq')}>
                  <Map size={22} color="#EA580C" />
                  <Text style={[styles.quickTileTitle, { color: '#9A3412' }]}>Heatmap</Text>
                </TouchableOpacity>

                {/* New Shortcuts */}
                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#E0F2FE' }]} onPress={() => router.push('/tracker')}>
                  <LayoutList size={22} color="#0284C7" />
                  <Text style={[styles.quickTileTitle, { color: '#0369A1' }]}>Syllabus</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#FCE7F3' }]} onPress={() => router.push({ pathname: '/mains', params: { initialScreen: 'questions' } })}>
                  <Database size={22} color="#DB2777" />
                  <Text style={[styles.quickTileTitle, { color: '#BE185D' }]}>Question Bank</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#FEF9C3' }]} onPress={() => router.push('/unified/arena')}>
                  <Target size={22} color="#CA8A04" />
                  <Text style={[styles.quickTileTitle, { color: '#A16207' }]}>Prelims Arena</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.quickTile, { backgroundColor: '#ECFCCB' }]} onPress={() => router.push('/tags')}>
                  <Tag size={22} color="#65A30D" />
                  <Text style={[styles.quickTileTitle, { color: '#4D7C0F' }]}>Revision Tags</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>

            {/* COLUMN 3: Open Background & Quote (30% Width) */}
            <View style={{ flex: IS_TABLET ? 1.5 : undefined, flexDirection: 'column', minHeight: 290 }}>
              {/* Spacer to push quote to bottom and leave top empty for background image */}
              <View style={{ flex: 1 }} />

              {/* Bottom Card: Kalam Quote Card with Soft Mountain Graphic */}
              <TouchableOpacity activeOpacity={0.8} onPress={handleNextQuote} style={[styles.card, styles.kalamQuoteCard, { marginTop: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <Text style={styles.kalamQuoteMark}>“</Text>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', zIndex: 10 }}>
                    <TouchableOpacity onPress={handleNextQuote} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <RefreshCw size={13} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsQuoteModalVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Settings size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.kalamQuoteText}>
                  {activeQuote?.text || 'Success in UPSC is not a sprint, but a well-paced marathon.'}
                </Text>
                <Text style={styles.kalamQuoteAuthor}>— {activeQuote?.author || 'Dr. A.P.J. Abdul Kalam'}</Text>
                
                {/* Faint Blue Mountain Illustration at Bottom Right */}
                <View style={styles.mountainGraphicWrap}>
                  <Svg width={180} height={40} viewBox="0 0 180 40" fill="none">
                    <Path d="M0 40 L30 18 L60 40 L100 12 L140 40 L180 22 V40 H0 Z" fill="#DBEAFE" opacity={0.4} />
                    <Path d="M20 40 L70 20 L120 40 L160 25 L180 40 H0 Z" fill="#BFDBFE" opacity={0.6} />
                  </Svg>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── 5. ROW 2 (3 EQUAL COLUMNS) ── */}
          <View style={[styles.rowGrid, { alignItems: 'flex-start' }]}>
            {/* Recent Notes */}
            <View style={[styles.card, styles.equalColCard, { overflow: 'hidden', backgroundColor: '#FEFCE8', borderWidth: 1, borderColor: '#FEF08A' }]}>
              {/* Premium Geometric Backgrounds */}
              <View style={{ position: 'absolute', right: -30, bottom: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(217, 119, 6, 0.05)', zIndex: 0 }} />
              
              <View style={[styles.cardHeaderRow, { zIndex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <FileText size={20} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={styles.cardTitle}>Recent Notes</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/pilot-v2')}>
                  <Text style={styles.linkText}>View All ›</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginTop: 4 }}>
                {recentNotes.map((note, idx) => (
                  <TouchableOpacity
                    key={note.id || idx}
                    style={styles.noteRow}
                    onPress={() => router.push({ pathname: '/pilot-v2', params: { noteId: note.note_id } })}
                  >
                    <View style={styles.noteIconWrap}>
                      <FileText size={15} color="#7C3AED" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.noteTitle} numberOfLines={1}>{note.title}</Text>
                      <Text style={styles.noteDate}>{note.updated_at || 'Today, 6:30 PM'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* COLUMN 2: Today Task List Card */}
            <View style={[styles.card, styles.equalColCard, { overflow: 'hidden', backgroundColor: '#F5F3FF', borderWidth: 0 }]}>
              {/* Premium Geometric Backgrounds */}
              <View style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(124, 58, 237, 0.04)', zIndex: 0 }} />
              
              <View style={[styles.cardHeaderRow, { zIndex: 1 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Calendar size={20} color="#7C3AED" style={{ marginRight: 8 }} />
                  <View>
                    <Text style={styles.cardTitle}>Today</Text>
                    <Text style={styles.cardSubTitle}>{new Date().toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => router.push('/tracker')}>
                  <Text style={styles.linkText}>View Plan ›</Text>
                </TouchableOpacity>
              </View>

              <ScrollView 
                style={{ marginVertical: 8, maxHeight: 380 }}
                contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {tasks.length === 0 ? (
                  <View style={styles.emptyTaskState}>
                    <Check size={24} color="#8B5CF6" style={{ marginBottom: 4, opacity: 0.8 }} />
                    <Text style={{ fontSize: 12, color: '#8B5CF6', fontWeight: '600' }}>All clear for today! 🎉</Text>
                  </View>
                ) : (
                  tasks.map((task) => (
                    <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, backgroundColor: task.is_completed ? 'rgba(255,255,255,0.4)' : '#FFFFFF', borderRadius: 14, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                        onPress={() => handleTaskToggle(task.id)}
                      >
                        <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1.5, borderColor: task.is_completed ? '#8B5CF6' : '#C4B5FD', backgroundColor: task.is_completed ? '#8B5CF6' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {task.is_completed && <Check size={14} color="#FFF" />}
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: task.is_completed ? '#94A3B8' : '#1E293B', textDecorationLine: task.is_completed ? 'line-through' : 'none' }}>{task.title}</Text>
                          {task.time_slot ? <Text style={{ fontSize: 11, color: task.is_completed ? '#CBD5E1' : '#8B5CF6', fontWeight: '600', marginTop: 2 }}>{task.time_slot}</Text> : null}
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity style={{ padding: 6, opacity: task.is_completed ? 0.5 : 1 }} onPress={() => handleTaskDelete(task.id)}>
                        <Trash2 size={16} color={task.is_completed ? '#CBD5E1' : '#FCA5A5'} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </ScrollView>

              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 'auto', backgroundColor: '#FFFFFF', borderRadius: 14, paddingHorizontal: 14, height: 46, shadowColor: '#7C3AED', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
                <TextInput 
                  style={{ flex: 1, fontSize: 13, color: '#334155', fontWeight: '500', height: '100%' }}
                  placeholder="Quick add a new task..."
                  placeholderTextColor="#94A3B8"
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                  onSubmitEditing={handleAddNewTask}
                  returnKeyType="done"
                />
                <TouchableOpacity style={{ width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' }} onPress={() => setAddTaskModalVisible(true)}>
                  <Clock size={16} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity style={{ backgroundColor: '#8B5CF6', width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 6 }} onPress={handleAddNewTask}>
                  <Plus size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Daily PYQ / Arena Challenge */}
            <View style={[styles.card, styles.equalColCard, { backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#FDE68A', padding: 20, overflow: 'hidden', minHeight: 250 }]}>
              {/* Decorative background shapes */}
              <View style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(217, 119, 6, 0.15)', zIndex: 0 }} />
              <View style={{ position: 'absolute', right: 40, bottom: -30, width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(245, 158, 11, 0.1)', zIndex: 0 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, zIndex: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Target size={20} color="#D97706" style={{ marginRight: 8 }} />
                  <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '800' }}>Daily Challenge</Text>
                </View>
                <TouchableOpacity onPress={() => { 
                  setTempPrefs({
                    subjects: challengePrefs.subjects.filter(s => availableFilters.subjects.includes(s)),
                    institutes: challengePrefs.institutes.filter(i => availableFilters.institutes.includes(i)),
                    programs: challengePrefs.programs.filter(p => availableFilters.programs.includes(p)),
                    exams: challengePrefs.exams || [],
                    pyqMode: challengePrefs.pyqMode
                  });
                  setIsSettingsModalVisible(true); 
                }} style={{ padding: 4 }}>
                  <Settings size={18} color="#92400E" />
                </TouchableOpacity>
              </View>
              
              {inlineQuestion ? (
                <View style={{ zIndex: 2, flex: 1 }}>
                  <ScrollView style={{ maxHeight: 300, marginBottom: 12 }} showsVerticalScrollIndicator={true} nestedScrollEnabled={true}>
                    <Markdown style={{ paragraph: { marginVertical: 0 }, body: { color: '#1E293B', fontSize: 14, lineHeight: 22, fontWeight: '500' } }}>{inlineQuestion.question}</Markdown>
                    {(() => {
                      const pyqCat = getPYQCategorization(inlineQuestion);
                      if (!pyqCat.hasPYQData) return null;
                      const chipColor = pyqCat.isUPSC ? { bg: '#dbeafe', color: '#1d4ed8' } : pyqCat.isAllied ? { bg: '#dcfce7', color: '#15803d' } : pyqCat.isOther ? { bg: '#ffedd5', color: '#c2410c' } : { bg: '#fef3c7', color: '#b45309' };
                      return (
                        <Text style={{ fontSize: 10, fontWeight: '800', color: chipColor.color, backgroundColor: chipColor.bg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 8 }}>
                          {`${pyqCat.groupName} ${pyqCat.year ?? ''}`.trim()}
                        </Text>
                      );
                    })()}
                  </ScrollView>
                  
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {(Array.isArray(inlineQuestion.parsedOptions) ? inlineQuestion.parsedOptions : []).map((opt: any, idx: number) => {
                      const label = opt.label;
                      const text = opt.text;
                      const isSelected = selectedOption === idx;
                      const isCorrect = inlineQuestion.answerLetter === label;
                      const showResult = selectedOption !== null;
                      
                      let bgColor = 'rgba(255, 255, 255, 0.6)';
                      let borderColor = '#FDE68A';
                      
                      if (showResult) {
                        if (isCorrect) {
                          bgColor = '#D1FAE5';
                          borderColor = '#10B981';
                        } else if (isSelected) {
                          bgColor = '#FEE2E2';
                          borderColor = '#EF4444';
                        }
                      } else if (isSelected) {
                        bgColor = '#FEF3C7';
                        borderColor = '#F59E0B';
                      }

                      return (
                        <TouchableOpacity 
                          key={idx}
                          disabled={showResult}
                          onPress={() => setSelectedOption(idx)}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: bgColor,
                            borderWidth: 1,
                            borderColor,
                          }}
                        >
                          <Markdown style={{ paragraph: { marginVertical: 0 }, body: { color: '#334155', fontSize: 13, lineHeight: 18 } }}>
                            {`**${label}.** ${text}`}
                          </Markdown>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  
                  {selectedOption !== null && (
                    <View style={{ marginTop: 4 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <TouchableOpacity 
                          onPress={() => setShowExplanation(!showExplanation)}
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <Lightbulb size={16} color="#D97706" style={{ marginRight: 6 }} />
                          <Text style={{ color: '#D97706', fontSize: 13, fontWeight: '700' }}>
                            {showExplanation ? 'Hide Explanation' : 'View Explanation'}
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity 
                          onPress={() => loadDailyChallenge(challengePrefs)}
                          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EA580C', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 }}
                        >
                          <Text style={{ color: '#FFF', fontSize: 12, fontWeight: '700', marginRight: 4 }}>Next</Text>
                          <ChevronRight size={14} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                      
                      {showExplanation && inlineQuestion.explanation && (
                        <View style={{ marginTop: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8 }}>
                          <Markdown style={{ paragraph: { marginVertical: 0 }, body: { color: '#475569', fontSize: 13, lineHeight: 20 } }}>
                            {inlineQuestion.explanation}
                          </Markdown>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ zIndex: 2, paddingVertical: 20, alignItems: 'center' }}>
                  <Text style={{ color: '#92400E', fontSize: 14, textAlign: 'center' }}>No questions found for the selected subjects.</Text>
                  <TouchableOpacity onPress={() => { 
                    setTempPrefs({
                      subjects: challengePrefs.subjects.filter(s => availableFilters.subjects.includes(s)),
                      institutes: challengePrefs.institutes.filter(i => availableFilters.institutes.includes(i)),
                      programs: challengePrefs.programs.filter(p => availableFilters.programs.includes(p)),
                      pyqMode: challengePrefs.pyqMode
                    });
                    setIsSettingsModalVisible(true); 
                  }} style={{ marginTop: 12, backgroundColor: '#EA580C', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 }}>
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>Update Filters</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* ── 6. ADD TASK MODAL ── */}
          <Modal visible={addTaskModalVisible} transparent animationType="slide">
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Add New Task</Text>
                  <TouchableOpacity onPress={() => setAddTaskModalVisible(false)}>
                    <X size={20} color="#64748B" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Task Title (e.g. Solve Mains PYQ)"
                  value={newTaskTitle}
                  onChangeText={setNewTaskTitle}
                />
                <TextInput
                  style={styles.modalInput}
                  placeholder="Time Slot (e.g. 2:00 – 3:00 PM)"
                  value={newTaskTime}
                  onChangeText={setNewTaskTime}
                />
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddNewTask}>
                  <Text style={styles.modalSubmitTxt}>Save Task</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </Modal>

        </View>
      </ScrollView>

      {/* ── 7. BOTTOM RIGHT FLOATING FOOTER PILL ── */}
      <TouchableOpacity
        style={styles.floatingFooterPill}
        onPress={() => Alert.alert('Small Steps, Big Results', 'Focus on 1% daily improvement to master the syllabus!')}
      >
        <Lightbulb size={16} color="#EAB308" style={{ marginRight: 6 }} />
        <Text style={styles.floatingFooterTxt}>Small Steps Big Results</Text>
        <ChevronRight size={14} color="#64748B" />
      </TouchableOpacity>

      {/* ── 8. CHALLENGE SETTINGS MODAL ── */}
      <Modal visible={isSettingsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Challenge Filters</Text>
              <TouchableOpacity onPress={() => setIsSettingsModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>Select which questions to include in your daily challenges.</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              
              <Text style={{ fontWeight: '700', color: '#1E293B', marginTop: 8, marginBottom: 8 }}>PYQ Mode</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {(['all', 'pyq_only', 'non_pyq_only'] as const).map(mode => (
                   <TouchableOpacity key={mode} onPress={() => setTempPrefs({...tempPrefs, pyqMode: mode})} style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, backgroundColor: tempPrefs.pyqMode === mode ? '#EA580C' : '#F1F5F9' }}>
                     <Text style={{ color: tempPrefs.pyqMode === mode ? '#FFF' : '#64748B', fontSize: 12, fontWeight: '600' }}>
                       {mode === 'all' ? 'All Questions' : mode === 'pyq_only' ? 'PYQs Only' : 'Non-PYQs'}
                     </Text>
                   </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontWeight: '700', color: '#1E293B', marginTop: 8, marginBottom: 8 }}>Exams</Text>
              {availableFilters.exams.map((exam) => {
                const isSelected = tempPrefs.exams.includes(exam);
                return (
                  <TouchableOpacity key={exam} onPress={() => {
                      if (isSelected) setTempPrefs({ ...tempPrefs, exams: tempPrefs.exams.filter(s => s !== exam) });
                      else setTempPrefs({ ...tempPrefs, exams: [...tempPrefs.exams, exam] });
                    }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: isSelected ? '#EA580C' : '#CBD5E1', backgroundColor: isSelected ? '#EA580C' : '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      {isSelected && <Check size={12} color="#FFF" />}
                    </View>
                    <Text style={{ color: '#334155', fontSize: 14 }}>{exam}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={{ fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 8 }}>Subjects</Text>
              {availableFilters.subjects.map((sub) => {
                const isSelected = tempPrefs.subjects.includes(sub);
                return (
                  <TouchableOpacity key={sub} onPress={() => {
                      if (isSelected) setTempPrefs({ ...tempPrefs, subjects: tempPrefs.subjects.filter(s => s !== sub) });
                      else setTempPrefs({ ...tempPrefs, subjects: [...tempPrefs.subjects, sub] });
                    }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: isSelected ? '#EA580C' : '#CBD5E1', backgroundColor: isSelected ? '#EA580C' : '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      {isSelected && <Check size={12} color="#FFF" />}
                    </View>
                    <Text style={{ color: '#334155', fontSize: 14 }}>{sub}</Text>
                  </TouchableOpacity>
                );
              })}
              
              <Text style={{ fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 8 }}>Institutes</Text>
              {availableFilters.institutes.length === 0 && <Text style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>No institutes available.</Text>}
              {availableFilters.institutes.map((inst) => {
                const isSelected = tempPrefs.institutes.includes(inst);
                return (
                  <TouchableOpacity key={inst} onPress={() => {
                      if (isSelected) setTempPrefs({ ...tempPrefs, institutes: tempPrefs.institutes.filter(s => s !== inst) });
                      else setTempPrefs({ ...tempPrefs, institutes: [...tempPrefs.institutes, inst] });
                    }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: isSelected ? '#EA580C' : '#CBD5E1', backgroundColor: isSelected ? '#EA580C' : '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      {isSelected && <Check size={12} color="#FFF" />}
                    </View>
                    <Text style={{ color: '#334155', fontSize: 14 }}>{inst}</Text>
                  </TouchableOpacity>
                );
              })}

              <Text style={{ fontWeight: '700', color: '#1E293B', marginTop: 16, marginBottom: 8 }}>Programs</Text>
              {availableFilters.programs.length === 0 && <Text style={{ color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }}>No programs available.</Text>}
              {availableFilters.programs.map((prog) => {
                const isSelected = tempPrefs.programs.includes(prog);
                return (
                  <TouchableOpacity key={prog} onPress={() => {
                      if (isSelected) setTempPrefs({ ...tempPrefs, programs: tempPrefs.programs.filter(s => s !== prog) });
                      else setTempPrefs({ ...tempPrefs, programs: [...tempPrefs.programs, prog] });
                    }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: isSelected ? '#EA580C' : '#CBD5E1', backgroundColor: isSelected ? '#EA580C' : '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                      {isSelected && <Check size={12} color="#FFF" />}
                    </View>
                    <Text style={{ color: '#334155', fontSize: 14 }}>{prog}</Text>
                  </TouchableOpacity>
                );
              })}

            </ScrollView>

            <TouchableOpacity 
              style={{ backgroundColor: '#EA580C', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 16 }}
              onPress={async () => {
                setChallengePrefs(tempPrefs);
                await AsyncStorage.setItem('daily_challenge_prefs_v2', JSON.stringify(tempPrefs));
                setIsSettingsModalVisible(false);
                loadDailyChallenge(tempPrefs);
              }}
            >
              <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Save Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── 9. QUOTES MODAL ── */}
      <Modal visible={isQuoteModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Quotes</Text>
              <TouchableOpacity onPress={() => setIsQuoteModalVisible(false)}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ marginBottom: 16 }}>
              {customQuotes.map((q) => (
                <View key={q.id} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                  <TouchableOpacity onPress={() => handleToggleQuote(q.id)} style={{ padding: 4, marginRight: 8, marginTop: -2 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: q.is_active ? '#10B981' : '#CBD5E1', backgroundColor: q.is_active ? '#10B981' : '#FFF', alignItems: 'center', justifyContent: 'center' }}>
                      {q.is_active && <Check size={12} color="#FFF" />}
                    </View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, color: '#1E293B', fontStyle: 'italic', marginBottom: 4 }}>"{q.text}"</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>— {q.author}</Text>
                  </View>
                  {!q.id.startsWith('default') && (
                    <TouchableOpacity onPress={() => handleDeleteQuote(q.id)} style={{ padding: 6, marginLeft: 4 }}>
                      <Trash2 size={16} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={{ borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Add New Quote</Text>
              <TextInput
                style={[styles.modalInput, { height: 80 }]}
                placeholder="Quote text..."
                multiline
                value={newQuoteText}
                onChangeText={setNewQuoteText}
              />
              <TextInput
                style={styles.modalInput}
                placeholder="Author (e.g. Dr. Kalam)"
                value={newQuoteAuthor}
                onChangeText={setNewQuoteAuthor}
              />
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddQuote}>
                <Text style={styles.modalSubmitTxt}>Add Quote</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },
  
  // -- GLOBAL BACKGROUND ARTWORK STYLES --
  globalArtworkLayer: {
    position: 'absolute',
    top: 25,
    right: -40,
    width: '70%',
    height: 420,
    zIndex: 0,
  },
  globalArtworkImage: {
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  globalFadeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '55%',
  },
  globalFadeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },

  contentContainer: { padding: 24, paddingBottom: 70, zIndex: 1 },
  
  // -- HEADER LAYOUT (Overlays Background) --
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    marginTop: 10,
    zIndex: 2,
  },
  headerLeft: { flex: 1, zIndex: 1 },
  headerWelcomeText: { fontSize: 11, fontWeight: '700', color: '#94A3B8', letterSpacing: 1 },
  headerNameText: { fontSize: 32, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  headerSubtitleText: { fontSize: 13, color: '#64748B', marginTop: 2 },
  
  headerRight: { flexDirection: 'row', alignItems: 'center', zIndex: 1 },
  iconCircleButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  notifBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', marginRight: 12 },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { width: '100%', height: '100%', backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackTxt: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  taglineContainer: { alignItems: 'flex-start' },
  taglineText: { fontSize: 9, fontWeight: '800', color: '#475569', letterSpacing: 0.8 },
  taglineBar: { width: 50, height: 3, borderRadius: 1.5, marginTop: 2 },
  
  // -- DASHBOARD STYLES --
  searchBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingHorizontal: 20,
    height: 56,
    width: IS_TABLET ? '62%' : '100%',
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#1E293B' },
  aiButton: { borderRadius: 16, overflow: 'hidden', marginRight: 8 },
  aiGradient: { paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center', justifyContent: 'center' },
  aiButtonText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
  scanButton: { padding: 6 },
  rowGrid: { flexDirection: IS_TABLET ? 'row' : 'column', gap: 20, marginBottom: 20 },
  col1Card: { flex: IS_TABLET ? 2.2 : undefined, minHeight: 290 },
  col2Column: { flex: IS_TABLET ? 1.3 : undefined, gap: 14, justifyContent: 'space-between' },
  col3Card: { flex: IS_TABLET ? 1.5 : undefined, minHeight: 290 },
  equalColCard: { flex: 1, minHeight: 220, position: 'relative' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  cardSubTitle: { fontSize: 11, color: '#64748B' },
  linkText: { fontSize: 12, fontWeight: '600', color: '#6366F1' },
  prepContentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 14, padding: 3, marginBottom: 14, width: 280, maxWidth: '100%' },
  tabItem: { flex: 1, paddingVertical: 6, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  activeTabItem: { backgroundColor: '#1E293B' },
  tabText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  activeTabText: { color: '#FFFFFF' },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  subjectItem: { width: '47%' },
  subjectLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  subjectName: { fontSize: 12, color: '#334155', fontWeight: '600' },
  subjectPercent: { fontSize: 12, color: '#64748B', fontWeight: '700' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  ringContainer: { width: 96, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  ringTextWrap: { position: 'absolute', alignItems: 'center' },
  ringPercentTxt: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  ringSubTxt: { fontSize: 9, color: '#64748B', fontWeight: '600' },
  streakCard: { backgroundColor: '#FFFFFF', padding: 18, borderRadius: 24 },
  streakTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  streakCount: { fontSize: 30, fontWeight: '800', color: '#EA580C', marginVertical: 2 },
  streakSub: { fontSize: 11, color: '#64748B', marginBottom: 12 },
  weekDotsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayDotLabel: { fontSize: 10, color: '#64748B', marginBottom: 4, fontWeight: '600' },
  dayDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dayDotActive: { backgroundColor: '#10B981' },
  dayDotInactive: { backgroundColor: '#E2E8F0' },
  kalamQuoteCard: {
    backgroundColor: '#FFF5F5',
    padding: 16,
    borderRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  kalamQuoteMark: { fontSize: 24, color: '#EF4444', fontWeight: 'bold', lineHeight: 24, marginBottom: -4 },
  kalamQuoteText: { fontSize: 13, fontStyle: 'italic', color: '#1E293B', lineHeight: 20 },
  kalamQuoteAuthor: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 12 },
  mountainGraphicWrap: { position: 'absolute', right: 0, bottom: 0 },
  emptyTaskState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
  },
  taskListContainer: { gap: 10, marginVertical: 6, flex: 1 },
  taskRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  taskCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskCheckboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  taskTitle: { fontSize: 13, fontWeight: '600', color: '#1E293B' },
  taskTitleCompleted: { textDecorationLine: 'line-through', color: '#475569' },
  taskTime: { fontSize: 11, color: '#64748B' },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    paddingVertical: 12,
    borderRadius: 16,
    marginTop: 12,
    width: '100%',
  },
  addTaskButtonTxt: { fontSize: 12, fontWeight: '700', color: '#7C3AED' },
  noteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  noteIconWrap: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F3E8FF', alignItems: 'center', justifyContent: 'center' },
  noteTitle: { fontSize: 12, fontWeight: '600', color: '#1E293B' },
  noteDate: { fontSize: 10, color: '#64748B' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickTile: { width: '47%', padding: 14, borderRadius: 16, gap: 6 },
  quickTileTitle: { fontSize: 12, fontWeight: '700' },
  insightContentWrap: { marginVertical: 6, zIndex: 2 },
  insightQuoteTxt: { fontSize: 13, fontStyle: 'italic', color: '#1E293B', lineHeight: 18 },
  insightAuthorTxt: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 6 },
  dotsRow: { flexDirection: 'row', gap: 4, marginTop: 12, justifyContent: 'flex-start' },
  carouselDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#CBD5E1' },
  activeCarouselDot: { backgroundColor: '#2563EB', width: 14 },

  floatingFooterPill: {
    position: 'absolute',
    right: 24,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  floatingFooterTxt: { fontSize: 11, fontWeight: '700', color: '#334155', marginRight: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  modalInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, marginBottom: 12, fontSize: 14 },
  modalSubmitBtn: { backgroundColor: '#7C3AED', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSubmitTxt: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  // For Flashcard Alert
  flashcardAlertPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  flashcardAlertTxt: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },

  // For Inline Task Input
  inlineTaskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inlineTaskInput: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    height: '100%',
  },
  inlineTaskBtn: {
    backgroundColor: '#7C3AED',
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // For Daily Challenge Card
  challengeCard: {
    backgroundColor: '#1E293B',
    padding: 20,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    zIndex: 2,
  },
  challengeTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  challengeSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
    zIndex: 2,
  },
  challengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 2,
  },
  challengeBtnTxt: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginRight: 6,
  },
  challengeDeco1: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    zIndex: 1,
  },
  challengeDeco2: {
    position: 'absolute',
    right: 40,
    bottom: -30,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    zIndex: 1,
  },
});
