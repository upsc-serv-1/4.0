import React, { useEffect, useState, useRef, useCallback } from 'react';
import AppInfoGuide from '../src/components/AppInfoGuide';
import { Animated as RNAnimated } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
  Modal,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { 
  Palette, 
  BarChart3, 
  Archive, 
  User as UserIcon, 
  LogOut, 
  ChevronRight,
  BookOpen,
  LayoutList,
  Layers,
  ArrowUp,
  ArrowDown,
  Download,
  RefreshCw,
  Trash2,
  Database,
  CheckCircle,
  X,
  Wifi,
  WifiOff,
  Brain,
  Users,
  ShieldCheck,
  Image as ImageIcon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AI_PROVIDER_KEY } from '../src/services/GeminiService';
import { supabase } from '../src/lib/supabase';
import { PageWrapper } from '../src/components/PageWrapper';
import { OPTIONAL_SUBJECTS } from '../src/data/syllabus';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { DEFAULT_ANALYTICS_LAYOUT, loadAnalyticsLayout, moveLayoutItem, saveAnalyticsLayout } from '../src/utils/analyticsLayout';
import { OfflineManager, SyncProgress, OfflineMetadata } from '../src/services/OfflineManager';
import { KVStore } from '../src/lib/kvStore';
import { MediaCacheService } from '../src/services/MediaCacheService';
import { MAINS_QUESTIONS_CACHE_KEY } from '../src/data/mainsConsolidatedLoader';
import { NetworkStatus } from '../src/lib/networkStatus';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { useProfile } from '../src/context/ProfileContext';
import { useCourse } from '../src/context/CourseContext';
import { AvatarPicker } from '../src/components/AvatarPicker';
import { useAccessControl } from '../src/context/AccessControlContext';
import { emitShowSubscription } from '../src/utils/subscriptionEvents';
import { Crown, Settings2 } from 'lucide-react-native';
import { FolderAlgorithmModal } from '../src/components/flashcards/FolderAlgorithmModal';

import { AVATARS } from '../src/constants/avatars';
const AVATAR_MAP = Object.fromEntries(AVATARS.map(a => [a.id, a.uri]));



const { width } = Dimensions.get('window');

const radius = {
  md: 12,
  lg: 20,
};

const spacing = {
  lg: 24,
};

export default function Profile() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { colors } = useTheme();
  const { session, signOut } = useAuth();
  const { displayName, avatarId, updateProfile: updateProfileContext } = useProfile();
  const { featureMap } = useAccessControl();
  const router = useRouter();
  const email = session?.user.email || '';
  const initial = (displayName[0] || 'A').toUpperCase();

  const [optional, setOptional] = useState('Anthropology');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [newName, setNewName] = useState(displayName);
  const [updating, setUpdating] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(avatarId);
  const [layoutAdminVisible, setLayoutAdminVisible] = useState(false);
  const [analyticsLayout, setAnalyticsLayout] = useState(DEFAULT_ANALYTICS_LAYOUT);
  const [algorithmModalVisible, setAlgorithmModalVisible] = useState(false);
  
  const ADMIN_EMAILS = [
    'your@email.com',
    'aiimsmbbs17@gmail.com',
    'dn.d.n.g.zm.s.n.f.smb.t@gmail.com',
    'upsc-serv-1@proton.me'
  ];
  const isAnalyticsAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

  // ── Subscription Admin State ──────────────────────────────
  const [userSubAdminVisible, setUserSubAdminVisible] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [adminPlans, setAdminPlans] = useState<any[]>([]);
  const [adminSubs, setAdminSubs] = useState<Record<string, any>>({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSearch, setAdminSearch] = useState('');
  const [selectedAdminUser, setSelectedAdminUser] = useState<any>(null);
  const [selectedPlanIdForUser, setSelectedPlanIdForUser] = useState<string>('free');
  const [savingAdminSub, setSavingAdminSub] = useState(false);

  const loadAdminUserData = async () => {
    setAdminLoading(true);
    try {
      const { data: plansData, error: plansErr } = await supabase
        .from('access_plans')
        .select('*')
        .order('sort_order');
      if (plansErr) throw plansErr;
      setAdminPlans(plansData || []);

      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('*')
        .order('email');
      if (usersErr) throw usersErr;
      setAdminUsers(usersData || []);

      const { data: subsData, error: subsErr } = await supabase
        .from('user_subscriptions')
        .select('*, access_plans(name)')
        .eq('is_active', true);
      if (subsErr) throw subsErr;

      const subsMap: Record<string, any> = {};
      (subsData || []).forEach(sub => {
        subsMap[sub.user_id] = sub;
      });
      setAdminSubs(subsMap);
    } catch (err: any) {
      console.error('Admin Load Error:', err);
    } finally {
      setAdminLoading(false);
    }
  };

  useEffect(() => {
    if (userSubAdminVisible) {
      loadAdminUserData();
    }
  }, [userSubAdminVisible]);

  const saveUserSubscription = async () => {
    if (!selectedAdminUser) return;
    setSavingAdminSub(true);
    try {
      const targetUserId = selectedAdminUser.id;
      
      // 1. Deactivate any existing active subscriptions for this user
      const { error: deactivateErr } = await supabase
        .from('user_subscriptions')
        .update({ is_active: false })
        .eq('user_id', targetUserId)
        .eq('is_active', true);
      
      if (deactivateErr) throw deactivateErr;

      if (selectedPlanIdForUser && selectedPlanIdForUser !== 'free') {
        // 2. Insert new active subscription
        const { error: insertErr } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: targetUserId,
            plan_id: selectedPlanIdForUser,
            is_active: true,
            expires_at: new Date('2035-12-31T23:59:59Z').toISOString()
          });
        if (insertErr) throw insertErr;
      }

      Alert.alert('Success', 'User subscription updated successfully!');
      setSelectedAdminUser(null);
      await loadAdminUserData();
    } catch (err: any) {
      Alert.alert('Error Saving Subscription', err.message || 'Something went wrong.');
    } finally {
      setSavingAdminSub(false);
    }
  };

  // ── Offline Mode State ────────────────────────────────────
  const [offlineMeta, setOfflineMeta] = useState<OfflineMetadata | null>(null);
  const [downloadStats, setDownloadStats] = useState<{
    questions:    { done: number; total: number };
    images:       { done: number; total: number };
    valueAdds:    { done: number; total: number };
    topperCopies: { done: number; total: number };
  } | null>(null);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ phase: 'tests', current: 0, total: 1, detail: '' });
  const [syncDone, setSyncDone] = useState(false);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq' | 'openrouter' | 'deepseek' | 'custom'>('gemini');
  const [showAppGuide, setShowAppGuide] = useState(false);
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);
  const { selectedCourse, setSelectedCourse } = useCourse();
  const AVAILABLE_COURSES = ['Civil Services', 'Medical Science'] as const;

  const TOTALS_CACHE_KEY = 'download_totals_cache_v1';

  const refreshDownloadStats = useCallback(async () => {
    try {
      const questionsDone = (OfflineManager.getOfflineQuestionsAllSync() ?? []).length;
      const imagesDone    = MediaCacheService.cachedCount();
      const valueAddsDone = (KVStore.getJson<any[]>('@mains_cached_value_add_v2') ?? []).length;

      const cachedMains = KVStore.getJson<any[]>(MAINS_QUESTIONS_CACHE_KEY) ?? [];
      let topperCopiesDone = 0;
      cachedMains.forEach((q: any) => {
        if (Array.isArray(q?.answers)) {
          const hasTopperCopy = q.answers.some((a: any) => a?.is_topper === true);
          if (hasTopperCopy) {
            topperCopiesDone++;
          }
        }
      });

      const prev = KVStore.getJson<{
        questions: number; images: number; valueAdds: number; topperCopies: number;
      }>(TOTALS_CACHE_KEY) ?? { questions: 0, images: 0, valueAdds: 0, topperCopies: 0 };

      let questionsTotal      = Math.max(prev.questions,    questionsDone);
      const imagesTotal       = Math.max(prev.images,       imagesDone);
      const valueAddsTotal    = Math.max(prev.valueAdds,    valueAddsDone);
      const topperCopiesTotal = Math.max(prev.topperCopies, topperCopiesDone);

      if (!NetworkStatus.isOnline || NetworkStatus.isOnline()) {
        try {
          const qRes = await supabase
            .from('questions')
            .select('id', { count: 'exact', head: true })
            .eq('course', selectedCourse);
          if (typeof qRes.count === 'number' && qRes.count > 0) {
            questionsTotal = qRes.count;
          }
        } catch { /* keep previous */ }
      }

      KVStore.setJson(TOTALS_CACHE_KEY, {
        questions: questionsTotal,
        images: imagesTotal,
        valueAdds: valueAddsTotal,
        topperCopies: topperCopiesTotal,
      });

      setDownloadStats({
        questions:    { done: questionsDone,    total: questionsTotal },
        images:       { done: imagesDone,       total: imagesTotal },
        valueAdds:    { done: valueAddsDone,    total: valueAddsTotal },
        topperCopies: { done: topperCopiesDone, total: topperCopiesTotal },
      });
    } catch (e) {
      console.warn('[Profile] refreshDownloadStats failed', e);
    }
  }, [selectedCourse]);

  useEffect(() => {
    AsyncStorage.getItem('optional_choice').then(val => {
      if (val) setOptional(val);
    });
    loadAnalyticsLayout().then(setAnalyticsLayout);
    OfflineManager.getMetadata().then(setOfflineMeta);
  }, []);

  useEffect(() => {
    refreshDownloadStats();
  }, [refreshDownloadStats]);

  // Load AI provider for badge
  useEffect(() => {
    AsyncStorage.getItem(AI_PROVIDER_KEY).then(val => {
      if (val) setAiProvider(val as any);
    });
  }, []);


  // ── Offline Handlers ──────────────────────────────────────
  const startFullDownload = async () => {
    if (!session?.user?.id) return;
    setSyncModalVisible(true);
    setIsSyncing(true);
    setSyncDone(false);
    progressAnim.setValue(0);

    try {
      await OfflineManager.syncAllContent(session.user.id, (p) => {
        setSyncProgress(p);
        // Animate progress bar — questions then the media (images) phase.
        const phaseFraction: Record<string, number> = { tests: 0.05, questions: 0.6, states: 0.7, notes: 0.75, attempts: 0.78, cards: 0.82, media: 0.9, done: 1 };
        let target = phaseFraction[p.phase] || 0;
        if (p.phase === 'questions' && p.total > 0) {
          target = 0.05 + (p.current / p.total) * 0.55;
        }
        if (p.phase === 'media' && p.total > 0) {
          target = 0.82 + (p.current / p.total) * 0.17;
        }
        RNAnimated.timing(progressAnim, { toValue: target, duration: 300, useNativeDriver: false }).start();
      }, selectedCourse);
      // NOTE: value-adds and mains questions are NOT fetched separately here.
      // `syncAllContent` owns the 'catalog' category; calling another
      // catalog-category method while it holds the lock made `_runCategory`
      // return its own in-flight promise, so this function awaited itself and
      // the modal never reached the "done" state. They are folded into
      // `syncAllContent` instead.
      // Refresh metadata BEFORE flipping to the done state, otherwise the
      // completion summary renders stale/empty counts.
      const meta = await OfflineManager.getMetadata();
      setOfflineMeta(meta);
      await refreshDownloadStats();
      setSyncDone(true);
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Something went wrong');
    } finally {
      setIsSyncing(false);
    }
  };

  const [isMediaSyncing, setIsMediaSyncing] = useState(false);

  /**
   * "Check for updates" — cheap catalog delta (tests index only) plus the
   * user-data sync. It never re-downloads tests that are already complete, and
   * it never selects the whole questions table.
   */
  const handleRefreshSync = async () => {
    if (!session?.user?.id) return;
    setIsSyncing(true);
    setSyncModalVisible(true);
    setSyncDone(false);
    progressAnim.setValue(0);
    try {
      const result = await OfflineManager.refreshCatalogDelta(
        session.user.id,
        (p) => setSyncProgress(p),
        selectedCourse
      );
      const meta = await OfflineManager.getMetadata();
      setOfflineMeta(meta);
      await refreshDownloadStats();
      setSyncDone(true);
      if (result.newTests === 0 && result.updatedTests === 0) {
        Alert.alert('Already up to date', `No new or changed tests. ${result.unchangedTests} tests checked.`);
      } else {
        Alert.alert(
          'Updated',
          `${result.newTests} new test(s), ${result.updatedTests} changed. ${result.unchangedTests} unchanged.`
        );
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Refresh failed. Try again later.');
    } finally {
      setIsSyncing(false);
    }
  };

  /** Resume only the image phase — reuses cached questions, no catalog egress. */
  const handleDownloadRemainingImages = async () => {
    if (!session?.user?.id) return;
    setIsMediaSyncing(true);
    try {
      const result = await OfflineManager.downloadRemainingMedia((p) => setSyncProgress(p));
      const meta = await OfflineManager.getMetadata();
      setOfflineMeta(meta);
      await refreshDownloadStats();
      Alert.alert('Done', `${result.done} new images cached, ${result.skipped} already present.`);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Image download failed.');
    } finally {
      setIsMediaSyncing(false);
    }
  };

  // ── Per-category actions ──────────────────────────────────────
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  /** Generic runner: shows the modal, drives one category, then reports. */
  const runCategoryAction = async (
    category: string,
    label: string,
    work: (onProgress: (p: SyncProgress) => void) => Promise<string>
  ) => {
    if (!session?.user?.id) return;
    setActiveCategory(category);
    setSyncModalVisible(true);
    setIsSyncing(true);
    setSyncDone(false);
    progressAnim.setValue(0);
    try {
      const detail = await work((p) => {
        setSyncProgress(p);
        const frac: Record<string, number> = {
          tests: 0.1, questions: 0.7, valueadds: 0.85, topper: 0.8, media: 0.9, done: 1,
        };
        let target = frac[p.phase] ?? 0;
        if (p.total > 0 && (p.phase === 'questions' || p.phase === 'media' || p.phase === 'topper')) {
          target = Math.max(target - 0.2, 0.05) + (p.current / p.total) * 0.25;
        }
        RNAnimated.timing(progressAnim, { toValue: target, duration: 250, useNativeDriver: false }).start();
      });
      setSyncDone(true);
      setOfflineMeta(await OfflineManager.getMetadata());
      await refreshDownloadStats();
      Alert.alert(label, detail);
    } catch (err: any) {
      Alert.alert(`${label} failed`, err?.message || 'Something went wrong');
    } finally {
      setIsSyncing(false);
      setActiveCategory(null);
    }
  };

  const handleDownloadQuestions = () =>
    runCategoryAction('questions', 'Questions downloaded', async (report) => {
      const r = await OfflineManager.downloadQuestions(session!.user!.id, selectedCourse, report);
      return `${r.questions.toLocaleString()} questions and ${r.valueAdds.toLocaleString()} value-adds are ready offline.`;
    });

  const handleRefreshQuestions = () =>
    runCategoryAction('questions', 'Check complete', async (report) => {
      const catalog = await OfflineManager.refreshCatalogDelta(session!.user!.id, report, selectedCourse);
      const va = await OfflineManager.refreshValueAddsDelta(report);
      const parts: string[] = [];
      parts.push(
        catalog.newTests + catalog.updatedTests === 0
          ? `No new tests (${catalog.unchangedTests} checked)`
          : `${catalog.newTests} new, ${catalog.updatedTests} updated`
      );
      parts.push(va.changed ? `Value-adds updated (${va.total})` : 'Value-adds unchanged');
      return parts.join('. ') + '.';
    });

  const handleDownloadTopperImages = () =>
    runCategoryAction('topperImages', 'Topper images downloaded', async (report) => {
      const r = await OfflineManager.downloadTopperImages(report);
      return `${r.done} new images cached, ${r.skipped} already present.`;
    });

  const handleRefreshTopperImages = () =>
    runCategoryAction('topperImages', 'Check complete', async (report) => {
      const r = await OfflineManager.refreshTopperImagesDelta(report);
      return r.done === 0
        ? `Already up to date (${r.skipped} images present).`
        : `${r.done} new images downloaded.`;
    });

  const handleDownloadCardImages = () =>
    runCategoryAction('cardImages', 'Flashcard images downloaded', async (report) => {
      const r = await OfflineManager.downloadCardImages(report);
      return `${r.done} new images cached, ${r.skipped} already present.`;
    });

  const handleRefreshCardImages = () =>
    runCategoryAction('cardImages', 'Check complete', async (report) => {
      const r = await OfflineManager.refreshCardImagesDelta(report);
      return r.done === 0
        ? `Already up to date (${r.skipped} images present).`
        : `${r.done} new images downloaded.`;
    });

  const handleClearOffline = () => {
    Alert.alert('Clear All Offline Data?', 'This will remove all cached questions and user data from your device. You can re-download anytime.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        await OfflineManager.clearAllOfflineData();
        setOfflineMeta(null);
        Alert.alert('Done', 'All offline data cleared.');
      }},
    ]);
  };

  /** Free space for one category without touching the others. */
  const handleClearCategory = (category: 'topperImages' | 'cardImages') => {
    const isTopper = category === 'topperImages';
    const label = isTopper ? 'topper images' : 'flashcard images';
    Alert.alert(
      `Clear ${label}?`,
      `Removes only the cached ${label}. Questions, value-adds and your notes are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await OfflineManager.clearCategoryCache(category);
            setOfflineMeta(await OfflineManager.getMetadata());
            Alert.alert('Done', `Cached ${label} cleared.`);
          },
        },
      ]
    );
  };

  const updateAnalyticsOrder = async (bucket: 'review' | 'overall', index: number, direction: -1 | 1) => {
    const next = {
      ...analyticsLayout,
      [bucket]: moveLayoutItem(analyticsLayout[bucket], index, direction),
    };
    setAnalyticsLayout(next);
    await saveAnalyticsLayout(next);
  };

  const saveOptional = async (val: string) => {
    setOptional(val);
    await AsyncStorage.setItem('optional_choice', val);
    Alert.alert("Success", `Optional set to ${val}`);
  };

  const updateProfile = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: newName, avatar_id: selectedAvatar }
      });
      if (error) throw error;
      await updateProfileContext(newName.trim(), selectedAvatar);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setUpdating(false);
    }
  };

  const requestPasswordReset = async () => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      Alert.alert("Reset Link Sent", "Check your email to reset your password.");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const showOptionalPicker = () => {
    setPickerVisible(true);
  };

  const handleSelectAvatar = useCallback((avatarId: string) => {
    setSelectedAvatar(avatarId);
  }, []);

  const confirmLogout = () => {
    Alert.alert('Sign out?', 'You will need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  };

  return (
    <PageWrapper>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        <View style={styles.topRow}>
          <View>
            <Text style={[styles.small, { color: colors.textTertiary }]}>ACCOUNT</Text>
            <Text style={[styles.h1, { color: colors.textPrimary }]}>Profile</Text>
          </View>
          <ThemeSwitcher />
        </View>

        <View style={[styles.userCard, { backgroundColor: colors.surface + '80', borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => {}} style={styles.avatarContainer}>
            {selectedAvatar ? (
              <Image 
                source={AVATAR_MAP[selectedAvatar]} 
                style={styles.avatarImg}
              />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{initial}</Text></View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, marginBottom: 4 }}>DISPLAY NAME</Text>
            <TextInput 
              style={[styles.nameInput, { color: colors.textPrimary }]} 
              value={newName} 
              onChangeText={setNewName}
              placeholder="Display Name"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.uemail, { color: colors.textSecondary }]}>{email}</Text>
          </View>
          {newName !== displayName || selectedAvatar !== avatarId ? (
            <TouchableOpacity 
              onPress={updateProfile} 
              disabled={updating}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
            >
              {updating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>}
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 12, marginBottom: 12 }]}>CHOOSE AVATAR</Text>
        <AvatarPicker 
          selectedAvatar={selectedAvatar}
          onSelectAvatar={handleSelectAvatar}
          colors={colors}
        />

        {/* ── ACADEMIC & SUBSCRIPTION PREFERENCES CHIPS ────── */}
        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 20, marginBottom: 10 }]}>ACADEMIC & SUBSCRIPTION PREFERENCES</Text>
        <View style={[styles.prefGrid, isTablet ? styles.prefGridTablet : styles.prefGridMobile]}>
          {/* Chip 1: Course */}
          <TouchableOpacity 
            style={[styles.prefChip, { backgroundColor: colors.surface + '80', borderColor: colors.border, width: isTablet ? '23.8%' : '48%' }]}
            onPress={() => setCoursePickerVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.prefChipTop}>
              <View style={[styles.prefChipIcon, { backgroundColor: colors.primary + '18' }]}>
                <BookOpen size={15} color={colors.primary} />
              </View>
              <View style={[styles.prefChipTag, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.prefChipTagText, { color: colors.primary }]}>ACTIVE</Text>
              </View>
            </View>
            <Text style={[styles.prefChipLabel, { color: colors.textTertiary }]}>COURSE</Text>
            <Text style={[styles.prefChipValue, { color: colors.textPrimary }]} numberOfLines={1}>{selectedCourse}</Text>
          </TouchableOpacity>

          {/* Chip 2: Optional Subject */}
          <TouchableOpacity 
            style={[styles.prefChip, { backgroundColor: colors.surface + '80', borderColor: colors.border, width: isTablet ? '23.8%' : '48%' }]}
            onPress={showOptionalPicker}
            activeOpacity={0.7}
          >
            <View style={styles.prefChipTop}>
              <View style={[styles.prefChipIcon, { backgroundColor: '#06b6d418' }]}>
                <BookOpen size={15} color="#06b6d4" />
              </View>
              <View style={[styles.prefChipTag, { backgroundColor: '#06b6d420' }]}>
                <Text style={[styles.prefChipTagText, { color: '#06b6d4' }]}>PAPERS 1 & 2</Text>
              </View>
            </View>
            <Text style={[styles.prefChipLabel, { color: colors.textTertiary }]}>OPTIONAL</Text>
            <Text style={[styles.prefChipValue, { color: colors.textPrimary }]} numberOfLines={1}>{optional}</Text>
          </TouchableOpacity>

          {/* Chip 3: Subscription */}
          <TouchableOpacity 
            style={[styles.prefChip, { backgroundColor: colors.surface + '80', borderColor: colors.border, width: isTablet ? '23.8%' : '48%' }]}
            onPress={emitShowSubscription}
            activeOpacity={0.7}
          >
            <View style={styles.prefChipTop}>
              <View style={[styles.prefChipIcon, { backgroundColor: '#f59e0b18' }]}>
                <Crown size={15} color="#f59e0b" />
              </View>
              <View style={[styles.prefChipTag, { backgroundColor: featureMap.pyq ? '#10b98120' : colors.surfaceStrong }]}>
                <Text style={[styles.prefChipTagText, { color: featureMap.pyq ? '#10b981' : colors.textTertiary }]}>
                  {featureMap.pyq ? 'ACTIVE' : 'FREE'}
                </Text>
              </View>
            </View>
            <Text style={[styles.prefChipLabel, { color: colors.textTertiary }]}>SUBSCRIPTION</Text>
            <Text style={[styles.prefChipValue, { color: colors.textPrimary }]} numberOfLines={1}>
              {featureMap.pyq ? 'Pro Plan Active' : 'Free Tier'}
            </Text>
          </TouchableOpacity>

          {/* Chip 4: AI Tutor Engine */}
          <TouchableOpacity 
            style={[styles.prefChip, { backgroundColor: colors.surface + '80', borderColor: colors.border, width: isTablet ? '23.8%' : '48%' }]}
            onPress={() => router.push('/ai-settings')}
            activeOpacity={0.7}
          >
            <View style={styles.prefChipTop}>
              <View style={[styles.prefChipIcon, { backgroundColor: '#8b5cf618' }]}>
                <Brain size={15} color="#8b5cf6" />
              </View>
              <View style={[styles.prefChipTag, { backgroundColor: '#8b5cf620' }]}>
                <Text style={[styles.prefChipTagText, { color: '#8b5cf6' }]}>
                  {aiProvider === 'custom' ? 'CUSTOM' : aiProvider.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.prefChipLabel, { color: colors.textTertiary }]}>AI TUTOR</Text>
            <Text style={[styles.prefChipValue, { color: colors.textPrimary }]} numberOfLines={1}>
              {aiProvider === 'gemini' ? 'Gemini 2.5' : aiProvider.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── DATA & OFFLINE STORAGE HUB (SUPER-CARD) ─────────── */}
        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 22, marginBottom: 10 }]}>DATA & OFFLINE STORAGE HUB</Text>
        <View style={[styles.offlineSuperCard, { backgroundColor: colors.surface + '70', borderColor: colors.border }]}>
          {/* Master Header */}
          <View style={[styles.superCardHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.superCardTitleGroup}>
              <View style={[styles.superCardIcon, { backgroundColor: colors.primary + '18' }]}>
                <Database size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.superCardTitle, { color: colors.textPrimary }]}>Offline Storage Hub</Text>
                <Text style={[styles.superCardSub, { color: colors.textTertiary }]}>
                  {downloadStats
                    ? `${downloadStats.questions.done.toLocaleString()} Questions • ${downloadStats.topperCopies.done.toLocaleString()} Topper Copies • ${downloadStats.images.done.toLocaleString()} Cards`
                    : offlineMeta?.totalQuestions
                    ? `${offlineMeta.totalQuestions.toLocaleString()} Questions • ${offlineMeta.topperImageCount?.toLocaleString() ?? 0} Topper Copies`
                    : 'All offline questions, topper sheets & card photos'}
                </Text>
              </View>
            </View>
            <View style={styles.superCardActions}>
              <TouchableOpacity 
                style={[styles.masterPill, { backgroundColor: colors.primary }]}
                onPress={startFullDownload}
                activeOpacity={0.7}
              >
                <Download size={13} color="#fff" />
                <Text style={styles.masterPillTextPrimary}>Sync All</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.masterPill, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderWidth: 1 }]}
                onPress={handleRefreshSync}
                activeOpacity={0.7}
              >
                <RefreshCw size={12} color={colors.textSecondary} />
                <Text style={[styles.masterPillText, { color: colors.textSecondary }]}>Check Updates</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.masterPill, { backgroundColor: '#ef444415', borderColor: '#ef444430', borderWidth: 1 }]}
                onPress={handleClearOffline}
                activeOpacity={0.7}
              >
                <Trash2 size={12} color="#ef4444" />
                <Text style={[styles.masterPillText, { color: '#ef4444' }]}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 2x2 Sub-Boxes Grid */}
          <View style={[styles.offlineGrid, isTablet ? styles.offlineGridTablet : styles.offlineGridMobile]}>
            {/* Box 1: Questions & Value-Adds */}
            <View style={[styles.offlineSubBox, { backgroundColor: colors.surface + '90', borderColor: colors.border, width: isTablet ? '48.8%' : '100%' }]}>
              <View style={styles.subBoxHeader}>
                <View style={[styles.subBoxIcon, { backgroundColor: colors.primary + '15' }]}>
                  <BookOpen size={16} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subBoxTitle, { color: colors.textPrimary }]}>Questions & Value-Adds</Text>
                  <Text style={[styles.subBoxStat, { color: colors.textSecondary }]}>
                    {downloadStats
                      ? `${downloadStats.questions.done.toLocaleString()} / ${downloadStats.questions.total > 0 ? downloadStats.questions.total.toLocaleString() : '?'} Qs • ${(downloadStats.valueAdds.done ?? 0).toLocaleString()} VAs`
                      : offlineMeta?.totalQuestions
                      ? `${offlineMeta.totalQuestions.toLocaleString()} Qs • ${(offlineMeta.totalValueAdds ?? 0).toLocaleString()} VAs`
                      : 'Question bank + mains value-adds'}
                  </Text>
                </View>
              </View>
              <View style={styles.subBoxButtons}>
                <TouchableOpacity 
                  style={[styles.subBoxBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]} 
                  onPress={handleDownloadQuestions}
                >
                  <Download size={13} color={colors.primary} />
                  <Text style={[styles.subBoxBtnText, { color: colors.primary }]}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.subBoxBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]} 
                  onPress={handleRefreshQuestions}
                >
                  <RefreshCw size={13} color={colors.textSecondary} />
                  <Text style={[styles.subBoxBtnText, { color: colors.textSecondary }]}>Check Delta</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Box 2: Topper Copies */}
            <View style={[styles.offlineSubBox, { backgroundColor: colors.surface + '90', borderColor: colors.border, width: isTablet ? '48.8%' : '100%' }]}>
              <View style={styles.subBoxHeader}>
                <View style={[styles.subBoxIcon, { backgroundColor: '#06b6d415' }]}>
                  <ImageIcon size={16} color="#06b6d4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subBoxTitle, { color: colors.textPrimary }]}>Topper Answer Copies</Text>
                  <Text style={[styles.subBoxStat, { color: colors.textSecondary }]}>
                    {downloadStats
                      ? `${downloadStats.topperCopies.done.toLocaleString()} / ${downloadStats.topperCopies.total > 0 ? downloadStats.topperCopies.total.toLocaleString() : '?'} copies`
                      : offlineMeta?.topperImageCount
                      ? `${offlineMeta.topperImageCount.toLocaleString()} copies cached`
                      : 'Topper copies'}
                  </Text>
                </View>
              </View>
              <View style={styles.subBoxButtons}>
                <TouchableOpacity 
                  style={[styles.subBoxBtn, { backgroundColor: '#06b6d415', borderColor: '#06b6d430' }]} 
                  onPress={handleDownloadTopperImages}
                >
                  <Download size={13} color="#06b6d4" />
                  <Text style={[styles.subBoxBtnText, { color: '#06b6d4' }]}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.subBoxBtn, { backgroundColor: '#ef444412', borderColor: '#ef444425' }]} 
                  onPress={() => handleClearCategory('topperImages')}
                >
                  <Trash2 size={13} color="#ef4444" />
                  <Text style={[styles.subBoxBtnText, { color: '#ef4444' }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Box 3: Flashcard Images */}
            <View style={[styles.offlineSubBox, { backgroundColor: colors.surface + '90', borderColor: colors.border, width: isTablet ? '48.8%' : '100%' }]}>
              <View style={styles.subBoxHeader}>
                <View style={[styles.subBoxIcon, { backgroundColor: '#8b5cf615' }]}>
                  <Layers size={16} color="#8b5cf6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subBoxTitle, { color: colors.textPrimary }]}>Flashcard Photos & Media</Text>
                  <Text style={[styles.subBoxStat, { color: colors.textSecondary }]}>
                    {downloadStats
                      ? `${downloadStats.images.done.toLocaleString()} / ${downloadStats.images.total > 0 ? downloadStats.images.total.toLocaleString() : '?'} photos`
                      : offlineMeta?.cardImageCount
                      ? `${offlineMeta.cardImageCount.toLocaleString()} photos cached`
                      : 'Card attachments'}
                  </Text>
                </View>
              </View>
              <View style={styles.subBoxButtons}>
                <TouchableOpacity 
                  style={[styles.subBoxBtn, { backgroundColor: '#8b5cf615', borderColor: '#8b5cf630' }]} 
                  onPress={handleDownloadCardImages}
                >
                  <Download size={13} color="#8b5cf6" />
                  <Text style={[styles.subBoxBtnText, { color: '#8b5cf6' }]}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.subBoxBtn, { backgroundColor: '#ef444412', borderColor: '#ef444425' }]} 
                  onPress={() => handleClearCategory('cardImages')}
                >
                  <Trash2 size={13} color="#ef4444" />
                  <Text style={[styles.subBoxBtnText, { color: '#ef4444' }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Box 4: Airplane Diagnostic Test */}
            <View style={[styles.offlineSubBox, { backgroundColor: colors.surface + '90', borderColor: colors.border, width: isTablet ? '48.8%' : '100%' }]}>
              <View style={styles.subBoxHeader}>
                <View style={[styles.subBoxIcon, { backgroundColor: '#10b98115' }]}>
                  <Wifi size={16} color="#10b981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subBoxTitle, { color: colors.textPrimary }]}>Airplane Diagnostic Test</Text>
                  <Text style={[styles.subBoxStat, { color: colors.textSecondary }]}>
                    {offlineMeta?.lastFullSync ? `Synced: ${OfflineManager.formatSyncAge(offlineMeta.lastFullSync)}` : 'Test all screens in airplane mode'}
                  </Text>
                </View>
              </View>
              <View style={styles.subBoxButtons}>
                <TouchableOpacity 
                  style={[styles.subBoxBtn, { backgroundColor: '#10b98118', borderColor: '#10b98135', flex: 1 }]} 
                  onPress={() => router.push('/offline-diag')}
                >
                  <Wifi size={13} color="#10b981" />
                  <Text style={[styles.subBoxBtnText, { color: '#10b981' }]}>Run Diagnostic</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {offlineMeta?.mediaPhaseCancelled ? (
            <TouchableOpacity 
              style={[styles.mediaCancelledAlert, { backgroundColor: '#f59e0b12', borderColor: '#f59e0b30' }]}
              onPress={handleDownloadRemainingImages}
            >
              <ImageIcon color="#f59e0b" size={16} />
              <Text style={{ color: '#f59e0b', fontSize: 12, fontWeight: '700', flex: 1, marginLeft: 8 }}>
                {isMediaSyncing ? 'Caching remaining images...' : 'A previous image download was cancelled — tap to finish.'}
              </Text>
              <ChevronRight size={16} color="#f59e0b" />
            </TouchableOpacity>
          ) : null}
        </View>

        {offlineMeta?.lastFullSync ? (
          <View style={[styles.cacheInfoCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20', marginBottom: 6 }]}>
            <Database color={colors.primary} size={16} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.cacheInfoTitle, { color: colors.textPrimary }]}>Offline Cache Active</Text>
              <Text style={[styles.cacheInfoSub, { color: colors.textSecondary }]}>
                {offlineMeta.totalQuestions.toLocaleString()} questions • {offlineMeta.totalStates} tags • {offlineMeta.totalNotes} notebooks • {offlineMeta.totalAttempts} attempts
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── SETTINGS & TOOLS CONFIGURATION (2-COLUMN GRID) ──── */}
        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 22, marginBottom: 10 }]}>SETTINGS & TOOLS CONFIGURATION</Text>
        <View style={[styles.settings2Col, isTablet ? styles.settings2ColTablet : styles.settings2ColMobile]}>
          {/* Column 1: Study & Algorithm Tools */}
          <View style={[styles.settingsPanel, { backgroundColor: colors.surface + '70', borderColor: colors.border, width: isTablet ? '48.8%' : '100%' }]}>
            <Text style={[styles.panelHeaderTitle, { color: colors.textTertiary }]}>STUDY & ENGINE TOOLS</Text>
            <View style={styles.panelRows}>
              <Row testID="profile-algorithm" icon={<Settings2 color={colors.primary} size={18} />} label="Algorithm Defaults" sub="Set global spaced repetition rules" onPress={() => setAlgorithmModalVisible(true)} />
              <Row testID="profile-theme" icon={<Palette color={colors.primary} size={18} />} label="Zen Themes & Colors" sub="Custom palettes & OLED mode" onPress={() => router.push('/theme-preview')} />
              <Row testID="profile-tabs" icon={<LayoutList color={colors.primary} size={18} />} label="Customize Tabs" sub="Reorder & toggle bottom bar" onPress={() => router.push('/customize_tabs')} />
              <Row testID="profile-dedup" icon={<Layers color={colors.primary} size={18} />} label="Dedup Manager" sub="Smart-merge UPSC PYQs across institutes" onPress={() => router.push('/dedup-manager')} isLast />
            </View>
          </View>

          {/* Column 2: System, Account & Workspace */}
          <View style={[styles.settingsPanel, { backgroundColor: colors.surface + '70', borderColor: colors.border, width: isTablet ? '48.8%' : '100%' }]}>
            <Text style={[styles.panelHeaderTitle, { color: colors.textTertiary }]}>SYSTEM & WORKSPACE</Text>
            <View style={styles.panelRows}>
              <Row 
                testID="profile-widgets" 
                icon={<BarChart3 color={colors.primary} size={18} />} 
                label="Manage Dashboard Widgets" 
                sub="Configure syllabus tracking & rows" 
                onPress={() => { 
                  router.push('/(tabs)/' as any); 
                  setTimeout(() => {
                    Alert.alert(
                      'Widget Configuration', 
                      '1. Long-press the Syllabus Tracker to configure PYQ Mode & Report Type.\n\n2. Scroll down & tap "Manage Dashboard Widgets" to show/hide widgets.'
                    );
                  }, 500);
                }} 
              />
              <Row 
                testID="profile-ai-settings" 
                icon={<Brain color="#8b5cf6" size={18} />} 
                label="AI Settings & Models" 
                sub="Provider, API keys & custom prompts" 
                onPress={() => router.push('/ai-settings')} 
              />
              <Row
                testID="profile-app-guide"
                icon={<BookOpen color={colors.primary} size={18} />}
                label="App Feature Guide"
                sub="Learn about every feature"
                onPress={() => setShowAppGuide(true)}
              />
              {isAnalyticsAdmin ? (
                <>
                  <Row 
                    testID="profile-admin-panel" 
                    icon={<ShieldCheck color="#ef4444" size={18} />} 
                    label="Admin Control Panel" 
                    sub="Manage users, features & plans" 
                    onPress={() => router.push('/admin')} 
                  />
                  <Row testID="profile-analytics-layout" icon={<BarChart3 color={colors.primary} size={18} />} label="Analytics Layout Admin" sub="Arrange review and overall cards" onPress={() => setLayoutAdminVisible(true)} />
                </>
              ) : null}
              <Row testID="profile-reset" icon={<UserIcon color={colors.primary} size={18} />} label="Reset Password" sub="Send reset link to email" onPress={requestPasswordReset} />
              <Row testID="profile-logout" icon={<LogOut color="#ef4444" size={18} />} label="Sign Out" sub={email} onPress={confirmLogout} isLast />
            </View>
          </View>
        </View>

      {/* User Subscription Admin Modal */}
      <Modal
        visible={userSubAdminVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingAdminSub) {
            setUserSubAdminVisible(false);
            setSelectedAdminUser(null);
          }
        }}
      >
        <View style={styles.syncOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, width: '100%', maxWidth: 560, maxHeight: '85%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Crown size={22} color={colors.primary} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Subscription Admin</Text>
              </View>
              <TouchableOpacity 
                disabled={savingAdminSub}
                onPress={() => {
                  setUserSubAdminVisible(false);
                  setSelectedAdminUser(null);
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {adminLoading ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={{ marginTop: 12, color: colors.textSecondary }}>Loading users & plans...</Text>
              </View>
            ) : selectedAdminUser ? (
              <View style={{ flex: 1, justifyContent: 'space-between', paddingVertical: 10 }}>
                <ScrollView>
                  <Text style={[styles.small, { color: colors.textTertiary, marginBottom: 8 }]}>EDITING SUBSCRIPTION FOR</Text>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 }}>
                    {selectedAdminUser.email}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 24 }}>
                    ID: {selectedAdminUser.id}
                  </Text>

                  <Text style={[styles.small, { color: colors.textTertiary, marginBottom: 12 }]}>SELECT SUBSCRIPTION PLAN</Text>
                  
                  <TouchableOpacity
                    style={[
                      styles.planOptionRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: selectedPlanIdForUser === 'free' ? colors.primary + '10' : colors.surface + '40',
                      }
                    ]}
                    onPress={() => setSelectedPlanIdForUser('free')}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>Free Tier</Text>
                      <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>No active paid subscription</Text>
                    </View>
                    <View style={[styles.checkCircle, { borderColor: selectedPlanIdForUser === 'free' ? colors.primary : colors.border, backgroundColor: selectedPlanIdForUser === 'free' ? colors.primary : 'transparent' }]}>
                      {selectedPlanIdForUser === 'free' && <View style={[styles.checkInner, { backgroundColor: '#fff' }]} />}
                    </View>
                  </TouchableOpacity>

                  {adminPlans.map(plan => {
                    const isSelected = selectedPlanIdForUser === plan.id;
                    return (
                      <TouchableOpacity
                        key={plan.id}
                        style={[
                          styles.planOptionRow,
                          {
                            borderColor: colors.border,
                            backgroundColor: isSelected ? colors.primary + '10' : colors.surface + '40',
                            marginTop: 10,
                          }
                        ]}
                        onPress={() => setSelectedPlanIdForUser(plan.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>{plan.name}</Text>
                          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
                            {plan.description || `Price: ${plan.currency} ${plan.price}/${plan.interval}`}
                          </Text>
                        </View>
                        <View style={[styles.checkCircle, { borderColor: isSelected ? colors.primary : colors.border, backgroundColor: isSelected ? colors.primary : 'transparent' }]}>
                          {isSelected && <View style={[styles.checkInner, { backgroundColor: '#fff' }]} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
                  <TouchableOpacity
                    disabled={savingAdminSub}
                    style={[styles.adminBtn, { backgroundColor: colors.surfaceStrong, flex: 1 }]}
                    onPress={() => setSelectedAdminUser(null)}
                  >
                    <Text style={{ color: colors.textPrimary, fontWeight: '700', textAlign: 'center' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={savingAdminSub}
                    style={[styles.adminBtn, { backgroundColor: colors.primary, flex: 1 }]}
                    onPress={saveUserSubscription}
                  >
                    {savingAdminSub ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>Save Changes</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={[styles.searchContainer, { borderColor: colors.border, backgroundColor: colors.surfaceStrong + '50' }]}>
                  <TextInput
                    style={{ flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 8, paddingHorizontal: 12 }}
                    placeholder="Search user email..."
                    placeholderTextColor={colors.textTertiary}
                    value={adminSearch}
                    onChangeText={setAdminSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {adminSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setAdminSearch('')} style={{ padding: 8 }}>
                      <X size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                <FlatList
                  data={adminUsers.filter(u => u.email?.toLowerCase().includes(adminSearch.toLowerCase()))}
                  keyExtractor={item => item.id}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  renderItem={({ item }) => {
                    const activeSub = adminSubs[item.id];
                    const planName = activeSub?.access_plans?.name || 'Free';
                    return (
                      <View style={[styles.userListItem, { borderColor: colors.border, backgroundColor: colors.surface + '40' }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{item.email}</Text>
                          <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>ID: {item.id}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                            <Crown size={12} color={activeSub ? colors.primary : colors.textTertiary} />
                            <Text style={{ fontSize: 12, fontWeight: '600', color: activeSub ? colors.primary : colors.textSecondary }}>
                              Plan: {planName}
                            </Text>
                            {activeSub?.expires_at && (
                              <Text style={{ fontSize: 10, color: colors.textTertiary }}>
                                (Expires: {new Date(activeSub.expires_at).toLocaleDateString()})
                              </Text>
                            )}
                          </View>
                        </View>
                        <TouchableOpacity
                          style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
                          onPress={() => {
                            setSelectedAdminUser(item);
                            setSelectedPlanIdForUser(activeSub?.plan_id || 'free');
                          }}
                        >
                          <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Manage</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  ListEmptyComponent={
                    <View style={{ padding: 30, alignItems: 'center' }}>
                      <Text style={{ color: colors.textTertiary, textAlign: 'center' }}>
                        {adminUsers.length === 0 ? 'No registered users found in database.' : 'No matching users found.'}
                      </Text>
                    </View>
                  }
                />
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* App Guide Modal */}
      <AppInfoGuide visible={showAppGuide} onClose={() => setShowAppGuide(false)} />

      <TouchableOpacity testID="logout-button" style={[styles.logout, { borderColor: 'rgba(255,59,48,0.2)', backgroundColor: 'rgba(255,59,48,0.05)' }]} onPress={confirmLogout}>
          <LogOut color="#FF3B30" size={18} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Course Picker Modal */}
      <Modal
        visible={coursePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCoursePickerVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setCoursePickerVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Select Course</Text>
              <TouchableOpacity onPress={() => setCoursePickerVisible(false)}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={AVAILABLE_COURSES}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.pickerItem, 
                    { borderBottomColor: colors.border },
                    selectedCourse === item && { backgroundColor: colors.primary + '10' }
                  ]}
                  onPress={() => {
                    setSelectedCourse(item);
                    Alert.alert('Course Changed', `Switched to ${item}`);
                    setCoursePickerVisible(false);
                  }}
                >
                  <Text style={[
                    styles.pickerText, 
                    { color: colors.textPrimary },
                    selectedCourse === item && { color: colors.primary, fontWeight: '800' }
                  ]}>
                    {item}
                  </Text>
                  {selectedCourse === item && <View style={[styles.check, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Optional Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay} 
          onPress={() => setPickerVisible(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Choose Optional</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={OPTIONAL_SUBJECTS}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[
                    styles.pickerItem, 
                    { borderBottomColor: colors.border },
                    optional === item && { backgroundColor: colors.primary + '10' }
                  ]}
                  onPress={() => {
                    saveOptional(item);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={[
                    styles.pickerText, 
                    { color: colors.textPrimary },
                    optional === item && { color: colors.primary, fontWeight: '800' }
                  ]}>
                    {item}
                  </Text>
                  {optional === item && <View style={[styles.check, { backgroundColor: colors.primary }]} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={layoutAdminVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLayoutAdminVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setLayoutAdminVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Analytics Layout</Text>
              <TouchableOpacity onPress={() => setLayoutAdminVisible(false)}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>
            {(['review', 'overall'] as const).map(bucket => (
              <View key={bucket} style={{ marginBottom: 18 }}>
                <Text style={[styles.small, { color: colors.textTertiary, marginBottom: 10 }]}>{bucket.toUpperCase()}</Text>
                {analyticsLayout[bucket].map((item, index) => (
                  <View key={`${bucket}-${item}`} style={[styles.layoutRow, { borderColor: colors.border, backgroundColor: colors.surface + '60' }]}>
                    <Text style={[styles.layoutLabel, { color: colors.textPrimary }]}>{item.replace(/_/g, ' ')}</Text>
                    <View style={styles.layoutActions}>
                      <TouchableOpacity onPress={() => updateAnalyticsOrder(bucket, index, -1)} style={[styles.layoutBtn, { borderColor: colors.border }]}>
                        <ArrowUp size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => updateAnalyticsOrder(bucket, index, 1)} style={[styles.layoutBtn, { borderColor: colors.border }]}>
                        <ArrowDown size={16} color={colors.textPrimary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── SYNC PROGRESS MODAL ─────────────────────────── */}
      <Modal visible={syncModalVisible} transparent animationType="fade" onRequestClose={() => { if (!isSyncing) setSyncModalVisible(false); }}>
        <View style={styles.syncOverlay}>
          <View style={[styles.syncModal, { backgroundColor: colors.surface }]}>
            {syncDone ? (
              <>
                <View style={[styles.syncDoneCircle, { backgroundColor: '#22c55e15' }]}>
                  <CheckCircle color="#22c55e" size={48} />
                </View>
                <Text style={[styles.syncDoneTitle, { color: colors.textPrimary }]}>All Data Downloaded!</Text>
                <Text style={[styles.syncDoneDetail, { color: colors.textSecondary }]}>
                  {offlineMeta?.totalQuestions.toLocaleString()} questions • {offlineMeta?.totalStates} tags{"\n"}
                  {offlineMeta?.totalNotes} notebooks • {offlineMeta?.totalAttempts} attempts • {offlineMeta?.totalCards} flashcards
                  {"\n"}
                  {(offlineMeta?.totalMainsQuestions ?? 0).toLocaleString()} mains • {offlineMeta?.totalValueAdds ?? 0} value-adds
                </Text>
                <TouchableOpacity style={[styles.syncCloseBtn, { backgroundColor: colors.primary }]} onPress={() => setSyncModalVisible(false)}>
                  <Text style={[styles.syncCloseBtnText, { color: colors.buttonText }]}>Done</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={[styles.syncModalTitle, { color: colors.textPrimary }]}>Downloading Data...</Text>
                <Text style={[styles.syncPhaseLabel, { color: colors.primary }]}>
                  {syncProgress.phase === 'questions' ? 'QUESTIONS' :
                   syncProgress.phase === 'tests' ? 'TEST CATALOGUE' :
                   syncProgress.phase === 'states' ? 'TAGS & BOOKMARKS' :
                   syncProgress.phase === 'notes' ? 'NOTEBOOKS' :
                   syncProgress.phase === 'attempts' ? 'TEST ATTEMPTS' :
                   syncProgress.phase === 'cards' ? 'FLASHCARDS' : syncProgress.phase.toUpperCase()}
                </Text>
                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                  <RNAnimated.View style={[
                    styles.progressBarFill,
                    { backgroundColor: colors.primary, width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }
                  ]} />
                </View>
                <Text style={[styles.syncDetail, { color: colors.textSecondary }]} numberOfLines={2}>{syncProgress.detail}</Text>
                <TouchableOpacity 
                  style={[styles.syncCancelBtn, { borderColor: colors.border }]} 
                  onPress={() => { OfflineManager.cancelSync(); setSyncModalVisible(false); setIsSyncing(false); }}
                >
                  <Text style={[styles.syncCancelText, { color: colors.textTertiary }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <FolderAlgorithmModal
        visible={algorithmModalVisible}
        userId={session?.user?.id || ''}
        onClose={() => setAlgorithmModalVisible(false)}
      />

    </PageWrapper>
  );
}

function Row({ icon, label, sub, onPress, testID, right, isLast }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity 
      testID={testID} 
      style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border }]} 
      onPress={onPress} 
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      {icon}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={[styles.rowT, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.rowS, { color: colors.textSecondary }]}>{sub}</Text>
      </View>
      {right || (onPress && <ChevronRight color={colors.textTertiary} size={18} />)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  small: { fontSize: 11, letterSpacing: 2, fontWeight: '800' },
  h1: { fontSize: 36, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  userCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: radius.lg, padding: 16, marginBottom: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 22 },
  uname: { fontWeight: '800', fontSize: 18 },
  nameInput: { fontWeight: '800', fontSize: 18, padding: 0, margin: 0 },
  uemail: { fontSize: 13, marginTop: 2 },
  avatarContainer: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarList: { gap: 12, paddingBottom: 8 },
  avatarPickerItem: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, padding: 2, overflow: 'hidden' },
  avatarPickerImg: { width: '100%', height: '100%', borderRadius: 28 },
  settingsGroup: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  rowT: { fontWeight: '700', fontSize: 15 },
  rowS: { fontSize: 12, marginTop: 2 },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18, borderRadius: radius.md, borderWidth: 1, marginTop: 32 },
  logoutText: { color: '#FF3B30', fontWeight: '900', letterSpacing: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { borderRadius: 24, padding: 22, maxHeight: '80%', width: '100%', maxWidth: 480, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.4, shadowRadius: 30, elevation: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 18, borderBottomWidth: 1 },
  pickerText: { fontSize: 16, fontWeight: '600' },
  check: { width: 10, height: 10, borderRadius: 5 },
  layoutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderRadius: 14, marginBottom: 8 },
  layoutLabel: { flex: 1, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  layoutActions: { flexDirection: 'row', gap: 8 },
  layoutBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // ── Offline / Sync Styles ──
  prefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  prefGridTablet: {
    justifyContent: 'space-between',
  },
  prefGridMobile: {
    justifyContent: 'space-between',
  },
  prefChip: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    minHeight: 84,
    justifyContent: 'space-between',
  },
  prefChipTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  prefChipIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefChipTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  prefChipTagText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  prefChipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  prefChipValue: {
    fontSize: 13,
    fontWeight: '700',
  },

  /* Super Card Styles */
  offlineSuperCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  superCardHeader: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  superCardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 240,
  },
  superCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  superCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  superCardSub: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  superCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  masterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  masterPillTextPrimary: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  masterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  offlineGrid: {
    padding: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  offlineGridTablet: {
    justifyContent: 'space-between',
  },
  offlineGridMobile: {
    flexDirection: 'column',
  },
  offlineSubBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 105,
  },
  subBoxHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  subBoxIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  subBoxStat: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  subBoxButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subBoxBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  subBoxBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  mediaCancelledAlert: {
    marginHorizontal: 14,
    marginBottom: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  /* 2-Column Settings Layout */
  settings2Col: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  settings2ColTablet: {
    justifyContent: 'space-between',
  },
  settings2ColMobile: {
    flexDirection: 'column',
  },
  settingsPanel: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingTop: 12,
  },
  panelHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  panelRows: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(150, 150, 150, 0.1)',
  },
  cacheInfoCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: 14, marginTop: 12 },
  cacheInfoTitle: { fontSize: 13, fontWeight: '800' },
  cacheInfoSub: { fontSize: 11, marginTop: 2, lineHeight: 16 },
  syncOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  syncModal: { width: '100%', borderRadius: 28, padding: 28, alignItems: 'center' },
  syncModalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 16 },
  syncPhaseLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, marginBottom: 12 },
  progressBarBg: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 14 },
  progressBarFill: { height: '100%', borderRadius: 4 },
  syncDetail: { fontSize: 12, textAlign: 'center', marginBottom: 20, lineHeight: 18 },
  syncCancelBtn: { paddingVertical: 10, paddingHorizontal: 28, borderRadius: 12, borderWidth: 1 },
  syncCancelText: { fontSize: 13, fontWeight: '700' },
  syncDoneCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  syncDoneTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  syncDoneDetail: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 24 },
  syncCloseBtn: { paddingVertical: 14, paddingHorizontal: 40, borderRadius: 16 },
  syncCloseBtnText: { fontSize: 15, fontWeight: '900' },
  planOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderRadius: 14,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
  },
  adminBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
