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
} from 'react-native';
import { 
  ChevronLeft,
  Brain,
  Sparkles,
  Search,
  ChevronDown,
  ChevronUp,
  RotateCcw,
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
  GROQ_MODEL_KEY
} from '../src/services/GeminiService';
import { PageWrapper } from '../src/components/PageWrapper';
import { useTheme } from '../src/context/ThemeContext';

export default function AISettings() {
  const { colors } = useTheme();
  const router = useRouter();

  // ── Gemini State ──────────────────────────────
  const [geminiKeys, setGeminiKeys] = useState<string[]>(['', '', '', '']);
  const [activeKeyIndex, setActiveKeyIndex] = useState<number>(0);
  const [geminiModel, setGeminiModel] = useState<string>(DEFAULT_MODEL);

  // ── Groq State ────────────────────────────────
  const [aiProvider, setAiProvider] = useState<'gemini' | 'groq'>('gemini');
  const [groqKeys, setGroqKeys] = useState<string[]>(['', '', '', '']);
  const [activeGroqKeyIndex, setActiveGroqKeyIndex] = useState<number>(0);
  const [groqModel, setGroqModel] = useState<string>(DEFAULT_GROQ_MODEL);

  // ── Prompts State ─────────────────────────────
  const [explainPrompt, setExplainPrompt]     = useState('');
  const [summarizePrompt, setSummarizePrompt] = useState('');
  const [searchPrompt, setSearchPrompt]       = useState('');
  const [expandedPrompt, setExpandedPrompt]   = useState<'explain' | 'summarize' | 'search' | null>(null);

  const [promptSaving, setPromptSaving]       = useState(false);
  const [promptSaved, setPromptSaved]         = useState(false);

  // Load AI settings
  useEffect(() => {
    (async () => {
      const [
        k1, k2, k3, k4, activeIdx, model, 
        provider, gk1, gk2, gk3, gk4, groqActiveIdx, groqMod, 
        ep, sp, srp
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
      ]);
      
      setGeminiKeys([k1 || '', k2 || '', k3 || '', k4 || '']);
      setActiveKeyIndex(activeIdx ? parseInt(activeIdx, 10) : 0);
      setGeminiModel(model || DEFAULT_MODEL);
      
      setAiProvider((provider as 'gemini' | 'groq') || 'gemini');
      setGroqKeys([gk1 || '', gk2 || '', gk3 || '', gk4 || '']);
      setActiveGroqKeyIndex(groqActiveIdx ? parseInt(groqActiveIdx, 10) : 0);
      setGroqModel(groqMod || DEFAULT_GROQ_MODEL);

      setExplainPrompt(ep || DEFAULT_PROMPTS.explain);
      setSummarizePrompt(sp || DEFAULT_PROMPTS.summarize);
      setSearchPrompt(srp || DEFAULT_PROMPTS.search);
    })();
  }, []);

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
          backgroundColor: aiProvider === 'groq' ? '#f97316' : '#7c3aed',
          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
        }}>
          <Text style={{ fontSize: 12, fontWeight: '900', color: '#fff' }}>
            {aiProvider === 'groq' ? '⚡ Groq Active' : '✦ Gemini Active'}
          </Text>
        </View>
      </View>
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        
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
        </View>

        {/* ── MODEL SELECTOR ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>MODEL</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          {(aiProvider === 'groq' ? GROQ_MODELS : GEMINI_MODELS).map(m => {
            const isSelected = (aiProvider === 'groq' ? groqModel : geminiModel) === m.id;
            const accent = aiProvider === 'groq' ? '#f97316' : '#7c3aed';
            return (
              <TouchableOpacity
                key={m.id}
                onPress={() => aiProvider === 'groq' ? setGroqModel(m.id) : setGeminiModel(m.id)}
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
                : 'Free keys from console.groq.com. 14,400 free requests/day.'}
            </Text>

            {(['Key 1', 'Key 2', 'Key 3', 'Key 4'] as const).map((label, idx) => {
              const keys = aiProvider === 'groq' ? groqKeys : geminiKeys;
              const activeIdx = aiProvider === 'groq' ? activeGroqKeyIndex : activeKeyIndex;
              const isActive = activeIdx === idx;
              const hasValue = !!keys[idx].trim();
              const accent = aiProvider === 'groq' ? '#f97316' : '#7c3aed';

              return (
                <View key={idx} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: isActive ? accent : colors.textTertiary }}>{label}</Text>
                    {isActive && <View style={[styles.keyBadge, { backgroundColor: accent }]}><Text style={styles.keyBadgeText}>ACTIVE</Text></View>}
                    {!isActive && hasValue && (
                      <TouchableOpacity onPress={() => aiProvider === 'groq' ? setActiveGroqKeyIndex(idx) : setActiveKeyIndex(idx)} style={[styles.keyBadge, { borderWidth: 1, borderColor: accent }]}>
                        <Text style={[styles.keyBadgeText, { color: accent }]}>SET ACTIVE</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    value={keys[idx]}
                    onChangeText={val => {
                      if (aiProvider === 'groq') {
                        const updated = [...groqKeys]; updated[idx] = val; setGroqKeys(updated);
                      } else {
                        const updated = [...geminiKeys]; updated[idx] = val; setGeminiKeys(updated);
                      }
                    }}
                    placeholder={idx === 0 ? `Paste your ${aiProvider === 'groq' ? 'gsk_...' : 'AIzaSy...'} key here` : 'Optional key'}
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
            })}
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

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Save Button */}
      <View style={[styles.stickyFooter, { backgroundColor: colors.bg, borderTopColor: colors.border }]}>
        <TouchableOpacity 
          onPress={saveAiSettings} 
          disabled={promptSaving}
          style={[
            styles.saveBtn, 
            { backgroundColor: promptSaved ? '#22c55e' : aiProvider === 'groq' ? '#f97316' : '#7c3aed' }
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
