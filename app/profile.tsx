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
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { useProfile } from '../src/context/ProfileContext';
import { useCourse } from '../src/context/CourseContext';
import { AvatarPicker } from '../src/components/AvatarPicker';
import { useAccessControl } from '../src/context/AccessControlContext';
import { emitShowSubscription } from '../src/utils/subscriptionEvents';
import { Crown } from 'lucide-react-native';

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
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ phase: 'tests', current: 0, total: 1, detail: '' });
  const [syncDone, setSyncDone] = useState(false);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq'>('gemini');
  const [showAppGuide, setShowAppGuide] = useState(false);
  const [coursePickerVisible, setCoursePickerVisible] = useState(false);
  const { selectedCourse, setSelectedCourse } = useCourse();
  const AVAILABLE_COURSES = ['Civil Services', 'Medical Science'] as const;

  useEffect(() => {
    AsyncStorage.getItem('optional_choice').then(val => {
      if (val) setOptional(val);
    });
    loadAnalyticsLayout().then(setAnalyticsLayout);
    OfflineManager.getMetadata().then(setOfflineMeta);
  }, []);

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
        // Animate progress bar
        const phaseFraction: Record<string, number> = { tests: 0.05, questions: 0.7, states: 0.8, notes: 0.85, attempts: 0.9, cards: 0.95, done: 1 };
        let target = phaseFraction[p.phase] || 0;
        if (p.phase === 'questions' && p.total > 0) {
          target = 0.05 + (p.current / p.total) * 0.65;
        }
        RNAnimated.timing(progressAnim, { toValue: target, duration: 300, useNativeDriver: false }).start();
      }, selectedCourse);
      setSyncDone(true);
      const meta = await OfflineManager.getMetadata();
      setOfflineMeta(meta);
    } catch (err: any) {
      Alert.alert('Download Failed', err.message || 'Something went wrong');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRefreshSync = async () => {
    if (!session?.user?.id) return;
    Alert.alert('Refreshing...', 'Fetching new content in the background.');
    try {
      await OfflineManager.incrementalSync(session.user.id);
      const meta = await OfflineManager.getMetadata();
      setOfflineMeta(meta);
      Alert.alert('Done', 'Offline data is up to date!');
    } catch {
      Alert.alert('Error', 'Refresh failed. Try again later.');
    }
  };

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

        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>COURSE PREFERENCES</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          <Row 
            icon={<BookOpen color={colors.primary} size={20} />} 
            label="Select Course" 
            sub={selectedCourse} 
            onPress={() => setCoursePickerVisible(true)}
          />
          <Row 
            icon={<BookOpen color={colors.primary} size={20} />} 
            label="Optional Subject" 
            sub={optional} 
            onPress={showOptionalPicker}
            isLast
          />
        </View>

        {/* ── SUBSCRIPTION SECTION ───────────────────────────── */}
        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>SUBSCRIPTION</Text>
        <TouchableOpacity
          onPress={emitShowSubscription}
          style={[styles.settingsGroup, {
            backgroundColor: colors.surface + '50',
            borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center',
            padding: 16, gap: 12,
          }]}
        >
          <Crown size={20} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
              View Plans & Subscription
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              {featureMap.pyq ? 'Pro plan active' : 'Free tier — upgrade for more'}
            </Text>
          </View>
          <View style={{
            backgroundColor: featureMap.pyq ? colors.primary + '20' : colors.surfaceStrong,
            borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: featureMap.pyq ? colors.primary : colors.textTertiary }}>
              {featureMap.pyq ? 'ACTIVE' : 'FREE'}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>APP GUIDE</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          <Row
            testID="profile-app-guide"
            icon={<BookOpen color={colors.primary} size={20} />}
            label="App Guide"
            sub="Learn about every feature"
            onPress={() => setShowAppGuide(true)}
            isLast
          />
        </View>

        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>SETTINGS</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          <Row testID="profile-theme" icon={<Palette color={colors.primary} size={20} />} label="Zen Theme" sub="Change global appearance" onPress={() => router.push('/theme-preview')} />
          <Row testID="profile-tabs" icon={<LayoutList color={colors.primary} size={20} />} label="Customize Tabs" sub="Reorder bottom bar" onPress={() => router.push('/customize_tabs')} />
          <Row testID="profile-dedup" icon={<Layers color={colors.primary} size={20} />} label="Dedup Manager" sub="Smart-merge UPSC PYQs across institutes" onPress={() => router.push('/dedup-manager')} />
          <Row 
            testID="profile-widgets" 
            icon={<BarChart3 color={colors.primary} size={20} />} 
            label="Manage Widgets" 
            sub="Configure syllabus tracking & layout" 
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
          {isAnalyticsAdmin ? (
            <>
              <Row 
                testID="profile-admin-panel" 
                icon={<ShieldCheck color="#ef4444" size={20} />} 
                label="Admin Panel" 
                sub="Manage users, features, paywalls & configurations" 
                onPress={() => router.push('/admin')} 
              />
              <Row testID="profile-analytics-layout" icon={<BarChart3 color={colors.primary} size={20} />} label="Analytics Layout Admin" sub="Arrange review and overall cards" onPress={() => setLayoutAdminVisible(true)} />
            </>
          ) : null}
          <Row testID="profile-reset" icon={<UserIcon color={colors.primary} size={20} />} label="Reset Password" sub="Send reset link to email" onPress={requestPasswordReset} />
          <Row testID="profile-identity" icon={<UserIcon color={colors.textPrimary} size={20} />} label="Account" sub={email} onPress={() => {}} isLast />
        </View>

        {/* ── AI SETTINGS SECTION ──────────────────────────────── */}
        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>
          AI SETTINGS
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/ai-settings')}
          style={[styles.settingsGroup, {
            backgroundColor: colors.surface + '50',
            borderColor: colors.border,
            flexDirection: 'row', alignItems: 'center',
            padding: 16, gap: 12,
          }]}
        >
          <Brain size={20} color="#7c3aed" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.textPrimary }}>
              AI Settings
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>
              Provider, model, API keys, prompts
            </Text>
          </View>
          {/* Active provider badge */}
          <View style={{
            backgroundColor: aiProvider === 'groq' ? '#f97316' : '#7c3aed',
            borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
          }}>
            <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>
              {aiProvider.toUpperCase()}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* ── DATA & OFFLINE SECTION ─────────────────────────── */}
        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>DATA & OFFLINE</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          <Row 
            testID="profile-download"
            icon={<Download color={colors.primary} size={20} />}
            label="Download All Data"
            sub={offlineMeta?.lastFullSync ? `Last synced: ${OfflineManager.formatSyncAge(offlineMeta.lastFullSync)}` : 'Make app work offline'}
            onPress={startFullDownload}
          />
          <Row 
            testID="profile-refresh"
            icon={<RefreshCw color={colors.primary} size={20} />}
            label="Refresh Data"
            sub={offlineMeta?.lastIncrementalSync ? `Updated: ${OfflineManager.formatSyncAge(offlineMeta.lastIncrementalSync)}` : 'Fetch latest changes'}
            onPress={handleRefreshSync}
          />
          <Row 
            testID="profile-clear-cache"
            icon={<Trash2 color="#ef4444" size={20} />}
            label="Clear Offline Data"
            sub={offlineMeta?.totalQuestions ? `${offlineMeta.totalQuestions.toLocaleString()} questions cached` : 'No data cached'}
            onPress={handleClearOffline}
          />
          <Row 
            testID="profile-offline-diag"
            icon={<Wifi color="#8b5cf6" size={20} />}
            label="Offline Diagnostic Test"
            sub="Test which screens work in airplane mode"
            onPress={() => router.push('/offline-diag')}
            isLast
          />
        </View>

        {offlineMeta?.lastFullSync ? (
          <View style={[styles.cacheInfoCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
            <Database color={colors.primary} size={16} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.cacheInfoTitle, { color: colors.textPrimary }]}>Offline Cache Active</Text>
              <Text style={[styles.cacheInfoSub, { color: colors.textSecondary }]}>
                {offlineMeta.totalQuestions.toLocaleString()} questions • {offlineMeta.totalStates} tags • {offlineMeta.totalNotes} notebooks • {offlineMeta.totalAttempts} attempts
              </Text>
            </View>
          </View>
        ) : null}

      {/* User Subscription Admin Modal */}
      <Modal
        visible={userSubAdminVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!savingAdminSub) {
            setUserSubAdminVisible(false);
            setSelectedAdminUser(null);
          }
        }}
      >
        <View style={styles.syncOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, width: '100%', height: '90%', borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
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
