import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Modal,
} from 'react-native';
import { 
  ChevronLeft,
  ChevronRight,
  Brain,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  PROMPT_KEYS, 
  DEFAULT_PROMPTS, 
  GEMINI_MODELS, 
  DEFAULT_MODEL,
  AI_PROVIDER_KEY,
  GROQ_MODELS,
  DEFAULT_GROQ_MODEL,
  GROQ_MODEL_KEY,
  OPENROUTER_API_KEY_STORAGE,
  OPENROUTER_MODEL_KEY,
  OPENROUTER_MODELS,
  DEFAULT_OPENROUTER_MODEL,
  DEEPSEEK_MODELS,
  DEFAULT_DEEPSEEK_MODEL,
  DEEPSEEK_MODEL_KEY,
} from '../src/services/GeminiService';
import {
  AIPromptManager,
  PromptTemplate,
  PromptCategory,
  DEFAULT_QUIZ_TEMPLATES,
  DEFAULT_NOTES_TEMPLATES,
  DEFAULT_TAGS_TEMPLATES,
  DEFAULT_ANALYSIS_TEMPLATES,
  DEFAULT_SYLLABUS_TEMPLATES,
  DEFAULT_FLASHCARD_TEMPLATES,
} from '../src/services/AIPromptManager';
import { useAuth } from '../src/context/AuthContext';
import { PageWrapper } from '../src/components/PageWrapper';
import { useTheme } from '../src/context/ThemeContext';
import { loadAIPromptsFromServer, saveAllAIPrompts } from '../src/services/UserAIPromptService';
import AppInfoGuide from '../src/components/AppInfoGuide';

export default function AISettings() {
  const SAVE_SHEET_AI_PROMPT_KEY = 'pilot-v2:save-sheet:ai-preset-prompt';
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const promptManager = AIPromptManager.getInstance();

  // ── Gemini State ──────────────────────────────
  const [geminiKeys, setGeminiKeys] = useState<string[]>(['', '', '', '']);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number>(0);
  const [geminiModel, setGeminiModel] = useState<string>(DEFAULT_MODEL);

  // ── Groq State ────────────────────────────────
  const [groqKeys, setGroqKeys] = useState<string[]>(['', '', '', '']);
  const [activeGroqKeyIndex, setActiveGroqKeyIndex] = useState<number>(0);
  const [groqModel, setGroqModel] = useState<string>(DEFAULT_GROQ_MODEL);

  // ── OpenRouter State ──────────────────────────
  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq' | 'openrouter' | 'deepseek'>('gemini');
  const [openrouterKey, setOpenrouterKey] = useState<string>('');
  const [openrouterModel, setOpenrouterModel] = useState<string>(DEFAULT_OPENROUTER_MODEL);

  // ── DeepSeek State ──────────────────────────
  const [deepseekKeys, setDeepseekKeys] = useState<string[]>(['', '', '', '']);
  const [activeDeepSeekKeyIndex, setActiveDeepSeekKeyIndex] = useState<number>(0);
  const [deepseekModel, setDeepseekModel] = useState<string>(DEFAULT_DEEPSEEK_MODEL);

  // ── Prompts State ─────────────────────────────
  const [explainPrompt, setExplainPrompt]     = useState('');
  const [summarizePrompt, setSummarizePrompt] = useState('');
  const [searchPrompt, setSearchPrompt]       = useState('');
  const [expandedPrompt, setExpandedPrompt]   = useState<'explain' | 'summarize' | 'search' | null>(null);
  const [saveSheetPrompt, setSaveSheetPrompt] = useState('');
  const [promptSaving, setPromptSaving]       = useState(false);
  const [promptSaved, setPromptSaved]         = useState(false);

  // ── Prompt Templates State ────────────────────
  const [activeTemplateCategory, setActiveTemplateCategory] = useState<PromptCategory>('quiz');
  const [templatesList, setTemplatesList] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAppGuide, setShowAppGuide] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState<Partial<PromptTemplate>>({
    template_name: '', template_key: '', button_label: '', button_emoji: '🤖',
    prompt_text: '', category: 'quiz', is_active: true, display_order: 0,
  });

  const TEMPLATE_CATEGORIES: { key: PromptCategory; label: string; emoji: string }[] = [
    { key: 'quiz', label: 'Quiz', emoji: '📝' },
    { key: 'notes', label: 'Notes', emoji: '📔' },
    { key: 'tags', label: 'Tags', emoji: '🏷️' },
    { key: 'analysis', label: 'Analysis', emoji: '📊' },
    { key: 'syllabus', label: 'Syllabus', emoji: '📅' },
    { key: 'flashcard', label: 'Flashcards', emoji: '🃏' },
  ];

  // Load AI settings
  useEffect(() => {
    (async () => {
      const [
        k1, k2, k3, k4, activeIdx, model, 
        provider, gk1, gk2, gk3, gk4, groqActiveIdx, groqMod, 
        ep, sp, srp, ork, orm, saveSheetAiPrompt
      ] = await Promise.all([
        AsyncStorage.getItem('gemini_api_key'),
        AsyncStorage.getItem('gemini_api_key_2'),
        AsyncStorage.getItem('gemini_api_key_3'),
        AsyncStorage.getItem('gemini_api_key_4'),
        AsyncStorage.getItem('gemini_active_key_index'),
        AsyncStorage.getItem(PROMPT_KEYS.model),
        AsyncStorage.getItem(AI_PROVIDER_KEY),
        AsyncStorage.getItem('groq_api_key'),
        AsyncStorage.getItem('groq_api_key_2'),
        AsyncStorage.getItem('groq_api_key_3'),
        AsyncStorage.getItem('groq_api_key_4'),
        AsyncStorage.getItem('groq_active_key_index'),
        AsyncStorage.getItem(GROQ_MODEL_KEY),
        AsyncStorage.getItem(PROMPT_KEYS.explain),
        AsyncStorage.getItem(PROMPT_KEYS.summarize),
        AsyncStorage.getItem(PROMPT_KEYS.search),
        AsyncStorage.getItem(OPENROUTER_API_KEY_STORAGE),
        AsyncStorage.getItem(OPENROUTER_MODEL_KEY),
        AsyncStorage.getItem(SAVE_SHEET_AI_PROMPT_KEY),
      ]);
      
      setGeminiKeys([k1 || '', k2 || '', k3 || '', k4 || '']);
      setActiveKeyIndex(activeIdx ? parseInt(activeIdx, 10) : 0);
      setGeminiModel(model || DEFAULT_MODEL);
      
      setAiProvider((provider as 'gemini' | 'groq' | 'openrouter') || 'gemini');
      setGroqKeys([gk1 || '', gk2 || '', gk3 || '', gk4 || '']);
      setActiveGroqKeyIndex(groqActiveIdx ? parseInt(groqActiveIdx, 10) : 0);
      setGroqModel(groqMod || DEFAULT_GROQ_MODEL);

      setOpenrouterKey(ork || '');
      setOpenrouterModel(orm || DEFAULT_OPENROUTER_MODEL);

      // DeepSeek
      const dsk1 = await AsyncStorage.getItem('deepseek_api_key');
      const dsk2 = await AsyncStorage.getItem('deepseek_api_key_2');
      const dsk3 = await AsyncStorage.getItem('deepseek_api_key_3');
      const dsk4 = await AsyncStorage.getItem('deepseek_api_key_4');
      const dsActiveIdx = await AsyncStorage.getItem('deepseek_active_key_index');
      const dsModel = await AsyncStorage.getItem(DEEPSEEK_MODEL_KEY);
      setDeepseekKeys([dsk1 || '', dsk2 || '', dsk3 || '', dsk4 || '']);
      setActiveDeepSeekKeyIndex(dsActiveIdx ? parseInt(dsActiveIdx, 10) : 0);
      setDeepseekModel(dsModel || DEFAULT_DEEPSEEK_MODEL);

      setExplainPrompt(ep || DEFAULT_PROMPTS.explain);
      setSummarizePrompt(sp || DEFAULT_PROMPTS.summarize);
      setSearchPrompt(srp || DEFAULT_PROMPTS.search);
      setSaveSheetPrompt(saveSheetAiPrompt || '');

      // ── Cross-device sync: fetch prompts from Supabase ────────────
      // This runs after local load so the UI shows instantly, then
      // Supabase values overwrite if they're newer.
      if (session?.user?.id) {
        try {
          const serverPrompts = await loadAIPromptsFromServer(session.user.id);
          const serverExplain = serverPrompts[PROMPT_KEYS.explain];
          const serverSummarize = serverPrompts[PROMPT_KEYS.summarize];
          const serverSearch = serverPrompts[PROMPT_KEYS.search];
          const serverSaveSheet = serverPrompts['pilot-v2:save-sheet:ai-preset-prompt'];
          if (serverExplain)   setExplainPrompt(serverExplain);
          if (serverSummarize) setSummarizePrompt(serverSummarize);
          if (serverSearch)    setSearchPrompt(serverSearch);
          if (serverSaveSheet) setSaveSheetPrompt(serverSaveSheet);
        } catch (e) {
          console.warn('[AISettings] Failed to sync prompts from Supabase:', e);
        }
      }
    })();
  }, [session?.user?.id]);

  const saveAiSettings = async () => {
    setPromptSaving(true);
    try {
      await Promise.all([
        AsyncStorage.setItem(AI_PROVIDER_KEY, aiProvider),
        AsyncStorage.setItem('gemini_api_key',   geminiKeys[0].trim()),
        AsyncStorage.setItem('gemini_api_key_2', geminiKeys[1].trim()),
        AsyncStorage.setItem('gemini_api_key_3', geminiKeys[2].trim()),
        AsyncStorage.setItem('gemini_api_key_4', geminiKeys[3].trim()),
        AsyncStorage.setItem('gemini_active_key_index', String(activeKeyIndex)),
        AsyncStorage.setItem(PROMPT_KEYS.model,     geminiModel),
        AsyncStorage.setItem('groq_api_key',   groqKeys[0].trim()),
        AsyncStorage.setItem('groq_api_key_2', groqKeys[1].trim()),
        AsyncStorage.setItem('groq_api_key_3', groqKeys[2].trim()),
        AsyncStorage.setItem('groq_api_key_4', groqKeys[3].trim()),
        AsyncStorage.setItem('groq_active_key_index', String(activeGroqKeyIndex)),
        AsyncStorage.setItem(GROQ_MODEL_KEY, groqModel),
        AsyncStorage.setItem(OPENROUTER_API_KEY_STORAGE, openrouterKey.trim()),
        AsyncStorage.setItem(OPENROUTER_MODEL_KEY, openrouterModel),
        // DeepSeek
        AsyncStorage.setItem('deepseek_api_key',   deepseekKeys[0].trim()),
        AsyncStorage.setItem('deepseek_api_key_2', deepseekKeys[1].trim()),
        AsyncStorage.setItem('deepseek_api_key_3', deepseekKeys[2].trim()),
        AsyncStorage.setItem('deepseek_api_key_4', deepseekKeys[3].trim()),
        AsyncStorage.setItem('deepseek_active_key_index', String(activeDeepSeekKeyIndex)),
        AsyncStorage.setItem(DEEPSEEK_MODEL_KEY, deepseekModel),
        AsyncStorage.setItem(PROMPT_KEYS.explain,    explainPrompt.trim()   || DEFAULT_PROMPTS.explain),
        AsyncStorage.setItem(PROMPT_KEYS.summarize,  summarizePrompt.trim() || DEFAULT_PROMPTS.summarize),
        AsyncStorage.setItem(PROMPT_KEYS.search,     searchPrompt.trim()    || DEFAULT_PROMPTS.search),
        AsyncStorage.setItem(SAVE_SHEET_AI_PROMPT_KEY, saveSheetPrompt.trim()),
      ]);
      // ── Cross-device sync: save prompts to Supabase ──────────────
      if (session?.user?.id) {
        try {
          await saveAllAIPrompts(session.user.id, {
            [PROMPT_KEYS.explain]:    explainPrompt.trim()   || DEFAULT_PROMPTS.explain,
            [PROMPT_KEYS.summarize]:  summarizePrompt.trim() || DEFAULT_PROMPTS.summarize,
            [PROMPT_KEYS.search]:     searchPrompt.trim()    || DEFAULT_PROMPTS.search,
            [SAVE_SHEET_AI_PROMPT_KEY]: saveSheetPrompt.trim(),
          });
        } catch (e) {
          console.warn('[AISettings] Failed to sync prompts to Supabase:', e);
          // Non-critical — local save succeeded
        }
      }

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
    const defaultText = key === 'explain' ? DEFAULT_PROMPTS.explain : key === 'summarize' ? DEFAULT_PROMPTS.summarize : DEFAULT_PROMPTS.search;
    if (key === 'explain')    setExplainPrompt(defaultText);
    if (key === 'summarize')  setSummarizePrompt(defaultText);
    if (key === 'search')     setSearchPrompt(defaultText);

    // Sync reset to Supabase
    if (session?.user?.id) {
      try {
        const { saveAIPrompt } = await import('../src/services/UserAIPromptService');
        await saveAIPrompt(session.user.id, PROMPT_KEYS[key], defaultText);
      } catch (e) {
        console.warn('[AISettings] Failed to sync prompt reset:', e);
      }
    }
  };

  // ── Template Helpers ──────────────────────────
  const loadTemplatesForCategory = async (cat: PromptCategory) => {
    setTemplatesLoading(true);
    try {
      const userId = session?.user?.id;
      const tmplts = userId
        ? await promptManager.fetchPromptTemplates(userId, cat)
        : getDefaultsForCat(cat);
      setTemplatesList(tmplts);
    } catch {
      setTemplatesList(getDefaultsForCat(cat));
    } finally {
      setTemplatesLoading(false);
    }
  };

  const getDefaultsForCat = (cat: PromptCategory): PromptTemplate[] => {
    const map: Record<string, PromptTemplate[]> = {
      quiz: DEFAULT_QUIZ_TEMPLATES,
      notes: DEFAULT_NOTES_TEMPLATES,
      tags: DEFAULT_TAGS_TEMPLATES,
      analysis: DEFAULT_ANALYSIS_TEMPLATES,
      syllabus: DEFAULT_SYLLABUS_TEMPLATES,
      flashcard: DEFAULT_FLASHCARD_TEMPLATES,
    };
    return map[cat] || [];
  };

  useEffect(() => { loadTemplatesForCategory(activeTemplateCategory); }, [activeTemplateCategory]);

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      template_name: '', template_key: '', button_label: '', button_emoji: '🤖',
      prompt_text: '', category: activeTemplateCategory, is_active: true, display_order: templatesList.length,
    });
    setShowTemplateModal(true);
  };

  const openEditTemplate = (tmpl: PromptTemplate) => {
    setEditingTemplate(tmpl);
    setTemplateForm({ ...tmpl });
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.template_name || !templateForm.prompt_text || !templateForm.button_label) {
      Alert.alert('Missing fields', 'Name, button label and prompt text are required');
      return;
    }
    const userId = session?.user?.id;
    if (!userId) { Alert.alert('Login required', 'Please log in to save custom templates'); return; }

    const key = templateForm.template_key || (templateForm.template_name || '').toLowerCase().replace(/\s+/g, '_');
    const full: PromptTemplate = {
      ...(templateForm as PromptTemplate),
      template_key: key,
      category: activeTemplateCategory,
    };

    if (editingTemplate?.id) {
      await promptManager.updatePromptTemplate(userId, editingTemplate.id, full);
    } else {
      await promptManager.createPromptTemplate(userId, full);
    }

    setShowTemplateModal(false);
    loadTemplatesForCategory(activeTemplateCategory);
  };

  const handleDeleteTemplate = (tmpl: PromptTemplate) => {
    if (!tmpl.id) { Alert.alert('Info', 'Default templates cannot be deleted'); return; }
    Alert.alert('Delete Template', `Delete "${tmpl.template_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const userId = session?.user?.id;
          if (!userId) return;
          await promptManager.deletePromptTemplate(userId, tmpl.id!, activeTemplateCategory);
          loadTemplatesForCategory(activeTemplateCategory);
        },
      },
    ]);
  };

  const handleResetTemplatesToDefault = () => {
    const userId = session?.user?.id;
    if (!userId) { Alert.alert('Login required', 'Please log in to reset templates'); return; }

    const categoryLabel = TEMPLATE_CATEGORIES.find(c => c.key === activeTemplateCategory)?.label || activeTemplateCategory;

    Alert.alert(
      'Reset Templates',
      `Are you sure you want to delete all custom templates in the "${categoryLabel}" category and restore the default ones?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setTemplatesLoading(true);
            const success = await promptManager.deleteCustomTemplatesForCategory(userId, activeTemplateCategory);
            setTemplatesLoading(false);
            if (success) {
              loadTemplatesForCategory(activeTemplateCategory);
              Alert.alert('Reset complete', `Default templates restored for "${categoryLabel}".`);
            } else {
              Alert.alert('Reset failed', 'Could not restore default templates.');
            }
          },
        },
      ]
    );
  };

  return (
    <PageWrapper>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '900', color: colors.textPrimary, flex: 1 }}>
          AI Settings
        </Text>
        <View style={{
          backgroundColor: aiProvider === 'groq' ? '#f97316' : aiProvider === 'openrouter' ? '#0891b2' : aiProvider === 'deepseek' ? '#0ea5e9' : '#7c3aed',
          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>
            {aiProvider === 'groq' ? '⚡ Groq Active' : aiProvider === 'openrouter' ? '🌐 OpenRouter Active' : aiProvider === 'deepseek' ? '🌀 DeepSeek Active' : '✦ Gemini Active'}
          </Text>
        </View>
      </View>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        
        {/* ── APP GUIDE ─────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => setShowAppGuide(true)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: colors.primary + '12', borderRadius: 14,
            padding: 16, marginBottom: 20, borderWidth: 1, borderColor: colors.primary + '30',
          }}
        >
          <View style={{
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 20 }}>📖</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary }}>App Guide</Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>Learn about every feature in the app</Text>
          </View>
          <ChevronRight size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* ── PROVIDER TOGGLE ───────────────────────────────── */}
        <Text style={styles.sectionTitle}>AI PROVIDER</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => setAiProvider('gemini')}
            style={[
              styles.providerCard,
              { 
                borderColor: aiProvider === 'gemini' ? '#7c3aed' : colors.border,
                backgroundColor: aiProvider === 'gemini' ? '#7c3aed15' : colors.surface,
                borderWidth: aiProvider === 'gemini' ? 2 : 1,
              }
            ]}
          >
            <Text style={{ fontSize: 15 }}>✦</Text>
            <Text style={[styles.providerName, { color: aiProvider === 'gemini' ? '#7c3aed' : colors.textPrimary }]}>Gemini</Text>
            <Text style={styles.providerSub}>Google · needs billing in India</Text>
            {aiProvider === 'gemini' && <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAiProvider('groq')}
            style={[
              styles.providerCard,
              { 
                borderColor: aiProvider === 'groq' ? '#f97316' : colors.border,
                backgroundColor: aiProvider === 'groq' ? '#f9731615' : colors.surface,
                borderWidth: aiProvider === 'groq' ? 2 : 1,
              }
            ]}
          >
            <Text style={{ fontSize: 15 }}>⚡</Text>
            <Text style={[styles.providerName, { color: aiProvider === 'groq' ? '#f97316' : colors.textPrimary }]}>Groq</Text>
            <Text style={styles.providerSub}>Free · no billing 14400 req/day</Text>
            {aiProvider === 'groq' && <View style={[styles.activeBadge, { backgroundColor: '#f97316' }]}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAiProvider('openrouter')}
            style={[
              styles.providerCard,
              { 
                borderColor: aiProvider === 'openrouter' ? '#0891b2' : colors.border,
                backgroundColor: aiProvider === 'openrouter' ? '#0891b215' : colors.surface,
                borderWidth: aiProvider === 'openrouter' ? 2 : 1,
              }
            ]}
          >
            <Text style={{ fontSize: 15 }}>🌐</Text>
            <Text style={[styles.providerName, { color: aiProvider === 'openrouter' ? '#0891b2' : colors.textPrimary }]}>OpenRouter</Text>
            <Text style={styles.providerSub}>33+ free models · DeepSeek, Qwen, Llama</Text>
            {aiProvider === 'openrouter' && <View style={[styles.activeBadge, { backgroundColor: '#0891b2' }]}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setAiProvider('deepseek')}
            style={[
              styles.providerCard,
              { 
                borderColor: aiProvider === 'deepseek' ? '#0ea5e9' : colors.border,
                backgroundColor: aiProvider === 'deepseek' ? '#0ea5e915' : colors.surface,
                borderWidth: aiProvider === 'deepseek' ? 2 : 1,
              }
            ]}
          >
            <Text style={{ fontSize: 15 }}>🌀</Text>
            <Text style={[styles.providerName, { color: aiProvider === 'deepseek' ? '#0ea5e9' : colors.textPrimary }]}>DeepSeek</Text>
            <Text style={styles.providerSub}>Direct API · V4 Flash, V3, R1</Text>
            {aiProvider === 'deepseek' && <View style={[styles.activeBadge, { backgroundColor: '#0ea5e9' }]}><Text style={styles.activeBadgeText}>ACTIVE</Text></View>}
          </TouchableOpacity>
        </View>

        {/* ── MODEL SELECTOR ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>MODEL</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {(aiProvider === 'groq' ? GROQ_MODELS : aiProvider === 'openrouter' ? OPENROUTER_MODELS : aiProvider === 'deepseek' ? DEEPSEEK_MODELS : GEMINI_MODELS).map(m => {
            const isSelected = (aiProvider === 'groq' ? groqModel : aiProvider === 'openrouter' ? openrouterModel : aiProvider === 'deepseek' ? deepseekModel : geminiModel) === m.id;
            const accent = aiProvider === 'groq' ? '#f97316' : aiProvider === 'openrouter' ? '#0891b2' : aiProvider === 'deepseek' ? '#0ea5e9' : '#7c3aed';
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => {
                  if (aiProvider === 'groq') setGroqModel(m.id);
                  else if (aiProvider === 'openrouter') setOpenrouterModel(m.id);
                  else if (aiProvider === 'deepseek') setDeepseekModel(m.id);
                  else setGeminiModel(m.id);
                }}
                style={{
                  flex: 1, minWidth: 100,
                  paddingVertical: 10, paddingHorizontal: 12,
                  borderRadius: 12, borderWidth: 1.5,
                  borderColor: isSelected ? accent : colors.border,
                  backgroundColor: isSelected ? accent + '10' : colors.surface,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800', color: isSelected ? accent : colors.textPrimary }}>{m.label}</Text>
                <Text style={{ fontSize: 10, fontWeight: '500', marginTop: 2, textAlign: 'center', color: isSelected ? accent : colors.textTertiary }}>{m.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── API KEYS ───────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{aiProvider.toUpperCase()} API KEYS</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          <View style={{ padding: 14 }}>
            <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 12 }}>
              {aiProvider === 'gemini' 
                ? 'Add up to 4 keys from aistudio.google.com. Tap to set active.' 
                : aiProvider === 'deepseek'
                ? 'Add up to 4 keys from platform.deepseek.com/api_keys. Tap to set active.'
                : 'Free keys from console.groq.com. 14,400 free requests/day.'}
            </Text>

            {(aiProvider !== 'openrouter') ? (['Key 1', 'Key 2', 'Key 3', 'Key 4'] as const).map((label, idx) => {
              const keys = aiProvider === 'groq' ? groqKeys : aiProvider === 'deepseek' ? deepseekKeys : geminiKeys;
              const activeIdx = aiProvider === 'groq' ? activeGroqKeyIndex : aiProvider === 'deepseek' ? activeDeepSeekKeyIndex : activeKeyIndex;
              const isActive = activeIdx === idx;
              const hasValue = !!keys[idx].trim();
              const accent = aiProvider === 'groq' ? '#f97316' : aiProvider === 'deepseek' ? '#0ea5e9' : '#7c3aed';

              return (
                <View key={idx} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? accent : colors.textTertiary }}>{label}</Text>
                    {isActive && <View style={[styles.keyBadge, { backgroundColor: accent }]}><Text style={styles.keyBadgeText}>ACTIVE</Text></View>}
                    {!isActive && hasValue && (
                      <TouchableOpacity onPress={() => aiProvider === 'groq' ? setActiveGroqKeyIndex(idx) : aiProvider === 'deepseek' ? setActiveDeepSeekKeyIndex(idx) : setActiveKeyIndex(idx)} style={[styles.keyBadge, { borderWidth: 1, borderColor: accent }]}>
                        <Text style={[styles.keyBadgeText, { color: accent }]}>SET ACTIVE</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    value={keys[idx]}
                    onChangeText={val => {
                      if (aiProvider === 'groq') {
                        const updated = [...groqKeys]; updated[idx] = val; setGroqKeys(updated);
                      } else if (aiProvider === 'deepseek') {
                        const updated = [...deepseekKeys]; updated[idx] = val; setDeepseekKeys(updated);
                      } else {
                        const updated = [...geminiKeys]; updated[idx] = val; setGeminiKeys(updated);
                      }
                    }}
                    placeholder={idx === 0 ? `Paste your ${aiProvider === 'groq' ? 'gsk_...' : aiProvider === 'deepseek' ? 'sk-...' : 'AIzaSy...'} key here` : 'Optional key'}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry
                    autoCorrect={false}
                    autoCapitalize="none"
                    style={[
                      styles.keyInput,
                      { 
                        backgroundColor: colors.bg,
                        borderColor: isActive ? accent : colors.border,
                        borderWidth: isActive ? 2 : 1,
                        color: colors.textPrimary,
                      }
                    ]}
                  />
                </View>
              );
            }) : (
              <View style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#0891b2' }}>API Key</Text>
                </View>
                <TextInput
                  value={openrouterKey}
                  onChangeText={setOpenrouterKey}
                  placeholder="Paste your sk-or-... key here"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  autoCorrect={false}
                  autoCapitalize="none"
                  style={[
                    styles.keyInput,
                    { 
                      backgroundColor: colors.bg,
                      borderColor: '#0891b2',
                      borderWidth: 2,
                      color: colors.textPrimary,
                    }
                  ]}
                />
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 8 }}>
                  Get keys from openrouter.ai → Keys. High-quality free models available.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── PROMPTS ────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>PROMPTS</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border }]}>
          {[
            { key: 'explain', label: 'Explain Prompt', sub: 'Used by AI EXPLAIN on questions', icon: <Brain size={16} color="#7c3aed" />, value: explainPrompt, setter: setExplainPrompt, placeholder: '{{question}}, {{options}}, {{correct_answer}}' },
            { key: 'summarize', label: 'Summarize Prompt', sub: 'Used by ✨ SUMMARIZE button', icon: <Sparkles size={16} color="#f59e0b" />, value: summarizePrompt, setter: setSummarizePrompt, placeholder: '{{explanation}}' },
            { key: 'search', label: 'Search Prompt', sub: 'Used by AI Search tab', icon: <Search size={16} color={colors.primary} />, value: searchPrompt, setter: setSearchPrompt, placeholder: '{{query}}' },
          ].map((item, idx, arr) => (
            <View key={item.key} style={idx < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : {}}>
              <TouchableOpacity onPress={() => setExpandedPrompt(expandedPrompt === item.key ? null : item.key as any)} style={styles.promptHeader}>
                {item.icon}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.promptLabel, { color: colors.textPrimary }]}>{item.label}</Text>
                  <Text style={[styles.promptSub, { color: colors.textTertiary }]}>{item.sub}</Text>
                </View>
                {expandedPrompt === item.key ? <ChevronUp size={16} color={colors.textTertiary} /> : <ChevronDown size={16} color={colors.textTertiary} />}
              </TouchableOpacity>

              {expandedPrompt === item.key && (
                <View style={{ padding: 14, paddingTop: 0 }}>
                  <Text style={styles.variableHint}>VARS: {item.placeholder}</Text>
                  <TextInput
                    value={item.value}
                    onChangeText={item.setter}
                    multiline
                    textAlignVertical="top"
                    style={[styles.promptInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary }]}
                  />
                  <TouchableOpacity onPress={() => resetPrompt(item.key as any)} style={styles.resetBtn}>
                    <RotateCcw size={12} color={colors.textTertiary} />
                    <Text style={styles.resetText}>Reset to default</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>SAVE SHEET AI PRESET</Text>
        <View style={[styles.settingsGroup, { backgroundColor: colors.surface + '50', borderColor: colors.border, padding: 14 }]}>
          <Text style={[styles.promptSub, { color: colors.textTertiary, marginBottom: 8 }]}>
            This prompt pre-fills in "Save to Pilot V2" AI panel, so you do not type it every time.
          </Text>
          <TextInput
            value={saveSheetPrompt}
            onChangeText={setSaveSheetPrompt}
            multiline
            textAlignVertical="top"
            placeholder="Example: Convert into bullet points, bold key terms, and shorten to 50 words."
            placeholderTextColor={colors.textTertiary}
            style={[styles.promptInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.textPrimary, minHeight: 120 }]}
          />
        </View>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* PROMPT TEMPLATES SECTION */}
        {/* ══════════════════════════════════════════════════════════ */}
        <View style={{ marginTop: 28, marginBottom: 80 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={styles.sectionTitle}>AI PROMPT TEMPLATES</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                testID="reset-templates-btn"
                onPress={handleResetTemplatesToDefault}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <RotateCcw size={14} color="#ef4444" />
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#ef4444' }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="add-template-btn"
                onPress={openCreateTemplate}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#7c3aed', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
              >
                <Plus size={14} color="#fff" />
                <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
            Customize AI buttons shown when reviewing questions (ELI5, Why Wrong, etc.)
          </Text>

          {/* Category tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {TEMPLATE_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  testID={`template-cat-${cat.key}`}
                  onPress={() => setActiveTemplateCategory(cat.key)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1,
                    backgroundColor: activeTemplateCategory === cat.key ? '#7c3aed' : 'transparent',
                    borderColor: activeTemplateCategory === cat.key ? '#7c3aed' : '#ccc',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: activeTemplateCategory === cat.key ? '#fff' : '#888' }}>
                    {cat.emoji} {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Templates list */}
          {templatesLoading ? (
            <ActivityIndicator color="#7c3aed" style={{ marginVertical: 20 }} />
          ) : templatesList.length === 0 ? (
            <Text style={{ color: '#888', fontSize: 13, textAlign: 'center', paddingVertical: 16 }}>
              No templates yet. Tap Add to create one.
            </Text>
          ) : (
            <View style={{ gap: 8 }}>
              {templatesList.map((tmpl, idx) => (
                <View
                  key={tmpl.id || tmpl.template_key || idx}
                  style={{
                    borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
                    padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10,
                  }}
                >
                  <Text style={{ fontSize: 20 }}>{tmpl.button_emoji || '🤖'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800' }}>{tmpl.template_name}</Text>
                    <Text style={{ fontSize: 11, color: '#888', marginTop: 2 }} numberOfLines={2}>
                      {tmpl.prompt_text.slice(0, 80)}…
                    </Text>
                  </View>
                  <TouchableOpacity testID={`edit-template-${idx}`} onPress={() => openEditTemplate(tmpl)} style={{ padding: 6 }}>
                    <Edit2 size={15} color="#888" />
                  </TouchableOpacity>
                  <TouchableOpacity testID={`delete-template-${idx}`} onPress={() => handleDeleteTemplate(tmpl)} style={{ padding: 6 }}>
                    <Trash2 size={15} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Template Create/Edit Modal */}
      <Modal visible={showTemplateModal} transparent animationType="slide" onRequestClose={() => setShowTemplateModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '900' }}>
                  {editingTemplate ? 'Edit Template' : 'New Template'}
                </Text>
                <TouchableOpacity onPress={() => setShowTemplateModal(false)}>
                  <X size={22} color="#000" />
                </TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 4 }}>NAME *</Text>
                <TextInput
                  testID="template-name-input"
                  style={[styles.keyInput, { backgroundColor: '#f5f5f5', borderColor: '#e5e7eb', borderWidth: 1, marginBottom: 12 }]}
                  value={templateForm.template_name}
                  onChangeText={v => setTemplateForm(f => ({ ...f, template_name: v }))}
                  placeholder="e.g. ELI5 Explanation"
                />
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 4 }}>BUTTON LABEL *</Text>
                    <TextInput
                      testID="template-button-label-input"
                      style={[styles.keyInput, { backgroundColor: '#f5f5f5', borderColor: '#e5e7eb', borderWidth: 1 }]}
                      value={templateForm.button_label}
                      onChangeText={v => setTemplateForm(f => ({ ...f, button_label: v }))}
                      placeholder="ELI5"
                    />
                  </View>
                  <View style={{ width: 70 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 4 }}>EMOJI</Text>
                    <TextInput
                      testID="template-emoji-input"
                      style={[styles.keyInput, { backgroundColor: '#f5f5f5', borderColor: '#e5e7eb', borderWidth: 1, textAlign: 'center', fontSize: 20 }]}
                      value={templateForm.button_emoji}
                      onChangeText={v => setTemplateForm(f => ({ ...f, button_emoji: v }))}
                      maxLength={4}
                    />
                  </View>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 4 }}>
                  PROMPT TEXT * (use {'{{question}}'}, {'{{correct_answer}}'}, {'{{options}}'})
                </Text>
                <TextInput
                  testID="template-prompt-input"
                  style={[styles.promptInput, { backgroundColor: '#f5f5f5', borderColor: '#e5e7eb', minHeight: 180, marginBottom: 16 }]}
                  value={templateForm.prompt_text}
                  onChangeText={v => setTemplateForm(f => ({ ...f, prompt_text: v }))}
                  placeholder="Write your AI prompt. Use {{question}}, {{correct_answer}}, {{options}} as variables."
                  multiline
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  testID="template-save-btn"
                  onPress={handleSaveTemplate}
                  style={{ backgroundColor: '#7c3aed', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 24 }}
                >
                  <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>
                    {editingTemplate ? '✓ Update Template' : '+ Save Template'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* App Guide Modal */}
      <AppInfoGuide visible={showAppGuide} onClose={() => setShowAppGuide(false)} />

      {/* Sticky Save Button */}
      <View style={[styles.stickyFooter, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          onPress={saveAiSettings} 
          disabled={promptSaving}
          style={[
            styles.saveBtn, 
            { backgroundColor: promptSaved ? '#22c55e' : aiProvider === 'groq' ? '#f97316' : aiProvider === 'openrouter' ? '#0891b2' : aiProvider === 'deepseek' ? '#0ea5e9' : '#7c3aed' }
          ]}
        >
          {promptSaving ? <ActivityIndicator size="small" color="#fff" /> : <Brain size={16} color="#fff" />}
          <Text style={styles.saveBtnText}>{promptSaved ? '✓ Saved!' : 'Save AI Settings'}</Text>
        </TouchableOpacity>
      </View>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 11, letterSpacing: 1.5, fontWeight: '800', color: '#888', marginBottom: 12 },
  providerCard: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 12, alignItems: 'center' },
  providerName: { fontSize: 13, fontWeight: '800', marginTop: 4 },
  providerSub: { fontSize: 10, color: '#888', marginTop: 2, textAlign: 'center' },
  activeBadge: { marginTop: 6, backgroundColor: '#7c3aed', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  activeBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  settingsGroup: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  keyBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  keyBadgeText: { fontSize: 9, fontWeight: '900', color: '#fff' },
  keyInput: { borderRadius: 10, padding: 10, fontSize: 13, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  promptHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  promptLabel: { fontSize: 14, fontWeight: '700' },
  promptSub: { fontSize: 11, marginTop: 1 },
  variableHint: { fontSize: 10, color: '#888', marginBottom: 6, fontWeight: '700' },
  promptInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 12, minHeight: 150, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  resetText: { fontSize: 11, color: '#888', fontWeight: '700' },
  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, borderTopWidth: 1 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: '#fff' },
});
