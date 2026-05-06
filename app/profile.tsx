import React, { useEffect, useState, useRef } from 'react';
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
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
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
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROMPT_KEYS, DEFAULT_PROMPTS, GEMINI_MODELS, DEFAULT_MODEL } from '../src/services/GeminiService';
import { supabase } from '../src/lib/supabase';
import { PageWrapper } from '../src/components/PageWrapper';
import { OPTIONAL_SUBJECTS } from '../src/data/syllabus';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { DEFAULT_ANALYTICS_LAYOUT, loadAnalyticsLayout, moveLayoutItem, saveAnalyticsLayout } from '../src/utils/analyticsLayout';
import { OfflineManager, SyncProgress, OfflineMetadata } from '../src/services/OfflineManager';

const AVATARS = [
  { id: 'boy1', uri: require('../assets/avatars/boy1.png') },
  { id: 'boy2', uri: require('../assets/avatars/boy2.png') },
  { id: 'boy3', uri: require('../assets/avatars/boy3.png') },
  { id: 'boy4', uri: require('../assets/avatars/boy4.png') },
  { id: 'boy5', uri: require('../assets/avatars/boy5.png') },
  { id: 'girl1', uri: require('../assets/avatars/girl1.png') },
  { id: 'girl2', uri: require('../assets/avatars/girl2.png') },
  { id: 'girl3', uri: require('../assets/avatars/girl3.png') },
  { id: 'girl4', uri: require('../assets/avatars/girl4.png') },
  { id: 'girl5', uri: require('../assets/avatars/girl5.png') },
];

const ThemeSwitcher = require('../src/components/ThemeSwitcher').ThemeSwitcher;

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
  const router = useRouter();
  const email = session?.user.email || '';
  const name = (session?.user.user_metadata as any)?.display_name || email.split('@')[0];
  const initial = (name[0] || 'A').toUpperCase();

  const [optional, setOptional] = useState('Anthropology');
  const [pickerVisible, setPickerVisible] = useState(false);
  const [newName, setNewName] = useState(name);
  const [updating, setUpdating] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState((session?.user.user_metadata as any)?.avatar_id || '');
  const [layoutAdminVisible, setLayoutAdminVisible] = useState(false);
  const [analyticsLayout, setAnalyticsLayout] = useState(DEFAULT_ANALYTICS_LAYOUT);
  const isAnalyticsAdmin = email.toLowerCase() === 'your@email.com';

  // ── Offline Mode State ────────────────────────────────────
  const [offlineMeta, setOfflineMeta] = useState<OfflineMetadata | null>(null);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ phase: 'tests', current: 0, total: 1, detail: '' });
  const [syncDone, setSyncDone] = useState(false);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  // ── AI Prompt Settings State ──────────────────────────────
  const [geminiKey, setGeminiKey] = useState('');
  const [geminiModel, setGeminiModel] = useState<string>(DEFAULT_MODEL);
  const [explainPrompt, setExplainPrompt]     = useState('');
  const [summarizePrompt, setSummarizePrompt] = useState('');
  const [searchPrompt, setSearchPrompt]       = useState('');
  const [expandedPrompt, setExpandedPrompt]   = useState<'explain' | 'summarize' | 'search' | null>(null);
  const [promptSaving, setPromptSaving]       = useState(false);
  const [promptSaved, setPromptSaved]         = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('optional_choice').then(val => {
      if (val) setOptional(val);
    });
    loadAnalyticsLayout().then(setAnalyticsLayout);
    OfflineManager.getMetadata().then(setOfflineMeta);
  }, []);

  // Load AI settings
  useEffect(() => {
    (async () => {
      const [key, model, ep, sp, srp] = await Promise.all([
        AsyncStorage.getItem('gemini_api_key'),
        AsyncStorage.getItem(PROMPT_KEYS.model),
        AsyncStorage.getItem(PROMPT_KEYS.explain),
        AsyncStorage.getItem(PROMPT_KEYS.summarize),
        AsyncStorage.getItem(PROMPT_KEYS.search),
      ]);
      setGeminiKey(key || '');
      setGeminiModel(model || DEFAULT_MODEL);
      setExplainPrompt(ep || DEFAULT_PROMPTS.explain);
      setSummarizePrompt(sp || DEFAULT_PROMPTS.summarize);
      setSearchPrompt(srp || DEFAULT_PROMPTS.search);
    })();
  }, []);

  const saveAiSettings = async () => {
    setPromptSaving(true);
    try {
      await Promise.all([
        AsyncStorage.setItem('gemini_api_key', geminiKey.trim()),
        AsyncStorage.setItem(PROMPT_KEYS.model,     geminiModel),
        AsyncStorage.setItem(PROMPT_KEYS.explain,    explainPrompt.trim()   || DEFAULT_PROMPTS.explain),
        AsyncStorage.setItem(PROMPT_KEYS.summarize,  summarizePrompt.trim() || DEFAULT_PROMPTS.summarize),
        AsyncStorage.setItem(PROMPT_KEYS.search,     searchPrompt.trim()    || DEFAULT_PROMPTS.search),
      ]);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2500);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || '');
    } finally {
      setPromptSaving(false);
    }
  };

  const resetPrompt = async (key: 'explain' | 'summarize' | 'search') => {
    await AsyncStorage.removeItem(PROMPT_KEYS[key]);
    if (key === 'explain')    setExplainPrompt(DEFAULT_PROMPTS.explain);
    if (key === 'summarize')  setSummarizePrompt(DEFAULT_PROMPTS.summarize);
    if (key === 'search')     setSearchPrompt(DEFAULT_PROMPTS.search);
  };

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
      });
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
            <Text style={[styles.h1, { color: colors.textPrimary }]}>Profile.</Text>
          </View>
          <ThemeSwitcher />
        </View>

        <View style={[styles.userCard, { backgroundColor: colors.surface + '80', borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => {}} style={styles.avatarContainer}>
            {selectedAvatar ? (
              <Image source={AVATARS.find(a => a.id === selectedAvatar)?.uri} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{initial}</Text></View>
            )}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <TextInput 
              style={[styles.nameInput, { color: colors.textPrimary }]} 
              value={newName} 
              onChangeText={setNewName}
              placeholder="Display Name"
              placeholderTextColor={colors.textTertiary}
            />
            <Text style={[styles.uemail, { color: colors.textSecondary }]}>{email}</Text>
          </View>
          {newName !== name || selectedAvatar !== (session?.user.user_metadata as any)?.avatar_id ? (
            <TouchableOpacity onPress={updateProfile} disabled={updating}>
              {updating ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={{ color: colors.primary, fontWeight: '700' }}>Save</Text>}
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 12, marginBottom: 12 }]}>CHOOSE AVATAR</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarList}>
          {AVATARS.map(av => (
            <TouchableOpacity 
              key={av.id} 
              onPress={() => setSelectedAvatar(av.id)}
              style={[
                styles.avatarPickerItem, 
                { borderColor: selectedAvatar === av.id ? colors.primary : colors.border },
                selectedAvatar === av.id && { backgroundColor: colors.primary + '10' }
              ]}
            >
              <Image source={av.uri} style={styles.avatarPickerImg} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>COURSE PREFERENCES</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          <Row 
            icon={<BookOpen color={colors.primary} size={20} />} 
            label="Optional Subject" 
            sub={optional} 
            onPress={showOptionalPicker}
            isLast
          />
        </View>

        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>SETTINGS</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          <Row testID="profile-theme" icon={<Palette color={colors.primary} size={20} />} label="Zen Theme" sub="Change global appearance" right={<ThemeSwitcher />} />
          <Row testID="profile-tabs" icon={<LayoutList color={colors.primary} size={20} />} label="Customize Tabs" sub="Reorder bottom bar" onPress={() => router.push('/customize_tabs')} />
          <Row testID="profile-dedup" icon={<Layers color={colors.primary} size={20} />} label="Dedup Manager" sub="Smart-merge UPSC PYQs across institutes" onPress={() => router.push('/dedup-manager')} />
          <Row testID="profile-widgets" icon={<BarChart3 color={colors.primary} size={20} />} label="Manage Widgets" sub="Long-press dashboard header for 4s to edit" onPress={() => Alert.alert('Widget Editor', 'Go to Dashboard and long-press the header area for 4 seconds to enter widget edit mode. You can add, remove, and rearrange widgets.')} />
          {isAnalyticsAdmin ? (
            <Row testID="profile-analytics-layout" icon={<BarChart3 color={colors.primary} size={20} />} label="Analytics Layout Admin" sub="Arrange review and overall cards" onPress={() => setLayoutAdminVisible(true)} />
          ) : null}
          <Row testID="profile-reset" icon={<UserIcon color={colors.primary} size={20} />} label="Reset Password" sub="Send reset link to email" onPress={requestPasswordReset} />
          <Row testID="profile-identity" icon={<UserIcon color={colors.textPrimary} size={20} />} label="Account" sub={email} onPress={() => {}} isLast />
        </View>

        {/* ── AI SETTINGS SECTION ──────────────────────────────── */}
        <Text style={[styles.small, { color: colors.textTertiary, marginTop: 24, marginBottom: 12 }]}>
          AI SETTINGS
        </Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>

          {/* Gemini API Key row */}
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Brain size={18} color="#7c3aed" />
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                Gemini API Key
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 8 }}>
              Free key from aistudio.google.com → Get API key
            </Text>
            <TextInput
              value={geminiKey}
              onChangeText={setGeminiKey}
              placeholder="Paste your AIzaSy... key here"
              placeholderTextColor={colors.textTertiary}
              secureTextEntry={true}
              autoCorrect={false}
              autoCapitalize="none"
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1, borderColor: colors.border,
                borderRadius: 10, padding: 10,
                fontSize: 13, color: colors.textPrimary,
                fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
              }}
              testID="ai-settings-api-key"
            />
          </View>

          {/* ── MODEL SELECTOR ─────────────────────────────────── */}
          <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 10 }}>
              Gemini Model
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {GEMINI_MODELS.map(m => {
                const isSelected = geminiModel === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setGeminiModel(m.id)}
                    style={{
                      flex: 1, minWidth: 90,
                      paddingVertical: 10, paddingHorizontal: 12,
                      borderRadius: 12, borderWidth: 1.5,
                      borderColor: isSelected ? '#7c3aed' : colors.border,
                      backgroundColor: isSelected ? '#ede9fe' : colors.bg,
                      alignItems: 'center',
                    }}
                    testID={`ai-model-btn-${m.id}`}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: '800',
                      color: isSelected ? '#7c3aed' : colors.textPrimary,
                    }}>
                      {m.label}
                    </Text>
                    <Text style={{
                      fontSize: 10, fontWeight: '500', marginTop: 2, textAlign: 'center',
                      color: isSelected ? '#7c3aed' : colors.textTertiary,
                    }}>
                      {m.sub}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Prompt rows — one for each of the 3 prompts */}
          {(
            [
              {
                key:         'explain' as const,
                label:       'Explain Prompt',
                sub:         'Used by AI EXPLAIN button on each question',
                icon:        <Brain size={16} color="#7c3aed" />,
                value:       explainPrompt,
                setter:      setExplainPrompt,
                placeholder: '{{question}}, {{options}}, {{correct_answer}} are the available variables',
              },
              {
                key:         'summarize' as const,
                label:       'Summarize Prompt',
                sub:         'Used by ✨ SUMMARIZE INTO BULLETS button',
                icon:        <Sparkles size={16} color="#f59e0b" />,
                value:       summarizePrompt,
                setter:      setSummarizePrompt,
                placeholder: '{{explanation}} is the available variable',
              },
              {
                key:         'search' as const,
                label:       'Search Prompt',
                sub:         'Used by AI Search tab to expand your query',
                icon:        <Search size={16} color={colors.primary} />,
                value:       searchPrompt,
                setter:      setSearchPrompt,
                placeholder: '{{query}} is the available variable',
              },
            ] as const
          ).map((item, idx, arr) => (
            <View
              key={item.key}
              style={idx < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}}
            >
              {/* Collapsed header row — tap to expand */}
              <TouchableOpacity
                onPress={() => setExpandedPrompt(expandedPrompt === item.key ? null : item.key)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 }}
                testID={`ai-prompt-row-${item.key}`}
              >
                {item.icon}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 1 }}>
                    {item.sub}
                  </Text>
                </View>
                {expandedPrompt === item.key
                  ? <ChevronUp size={16} color={colors.textTertiary} />
                  : <ChevronDown size={16} color={colors.textTertiary} />
                }
              </TouchableOpacity>

              {/* Expanded editor */}
              {expandedPrompt === item.key && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  <Text style={{ fontSize: 10, color: colors.textTertiary, marginBottom: 6, fontWeight: '700' }}>
                    AVAILABLE VARIABLES: {item.placeholder}
                  </Text>
                  <TextInput
                    value={item.value}
                    onChangeText={item.setter}
                    multiline
                    numberOfLines={10}
                    textAlignVertical="top"
                    autoCorrect={false}
                    autoCapitalize="none"
                    style={{
                      backgroundColor: colors.bg,
                      borderWidth: 1, borderColor: colors.border,
                      borderRadius: 10, padding: 12,
                      fontSize: 12, color: colors.textPrimary,
                      lineHeight: 18, minHeight: 180,
                      fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
                    }}
                    testID={`ai-prompt-editor-${item.key}`}
                  />
                  {/* Reset to default button */}
                  <TouchableOpacity
                    onPress={() => resetPrompt(item.key)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}
                    testID={`ai-prompt-reset-${item.key}`}
                  >
                    <RotateCcw size={12} color={colors.textTertiary} />
                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '700' }}>
                      Reset to default
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Save all AI settings button */}
        <TouchableOpacity
          onPress={saveAiSettings}
          disabled={promptSaving}
          style={{
            marginTop: 12,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, borderRadius: 14,
            backgroundColor: promptSaved ? '#22c55e' : '#7c3aed',
            opacity: promptSaving ? 0.6 : 1,
          }}
          testID="ai-settings-save"
        >
          {promptSaving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Brain size={16} color="#fff" />
          }
          <Text style={{ fontSize: 14, fontWeight: '900', color: '#fff' }}>
            {promptSaved ? '✓ Saved!' : 'Save AI Settings'}
          </Text>
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

        <TouchableOpacity testID="logout-button" style={[styles.logout, { borderColor: 'rgba(255,59,48,0.2)', backgroundColor: 'rgba(255,59,48,0.05)' }]} onPress={confirmLogout}>
          <LogOut color="#FF3B30" size={18} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

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
});
