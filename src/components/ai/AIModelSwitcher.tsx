/**
 * AIModelSwitcher
 * A compact bottom sheet showing:
 * - Provider toggle (Gemini / Groq / OpenRouter / DeepSeek / Custom) 
 * - Model chips for the active provider (including dynamically fetched custom models)
 * - "More settings →" link to full AI Settings page
 * Saves instantly on selection — no Save button needed.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  ActivityIndicator, Platform, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Brain, X, ChevronRight, Settings2, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  AI_PROVIDER_KEY, GEMINI_MODELS, GROQ_MODELS, OPENROUTER_MODELS, DEEPSEEK_MODELS,
  DEFAULT_MODEL, DEFAULT_GROQ_MODEL, DEFAULT_OPENROUTER_MODEL, DEFAULT_DEEPSEEK_MODEL,
  PROMPT_KEYS, GROQ_MODEL_KEY, OPENROUTER_MODEL_KEY, DEEPSEEK_MODEL_KEY,
  CUSTOM_MODEL_KEY, CUSTOM_API_BASE_URL_KEY, CUSTOM_ENDPOINT_NAME_KEY,
  CUSTOM_FETCHED_MODELS_KEY, DEFAULT_CUSTOM_MODEL, DEFAULT_CUSTOM_ENDPOINT_NAME,
  CustomModelOption, fetchCustomModels,
} from '../../services/GeminiService';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AIModelSwitcher({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const [provider, setProvider] = useState<'gemini' | 'groq' | 'openrouter' | 'deepseek' | 'custom'>('gemini');
  const [geminiModel, setGeminiModel] = useState(DEFAULT_MODEL);
  const [groqModel, setGroqModel] = useState(DEFAULT_GROQ_MODEL);
  const [openrouterModel, setOpenrouterModel] = useState(DEFAULT_OPENROUTER_MODEL);
  const [deepseekModel, setDeepseekModel] = useState(DEFAULT_DEEPSEEK_MODEL);
  const [customModel, setCustomModel] = useState(DEFAULT_CUSTOM_MODEL);
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const [customEndpointName, setCustomEndpointName] = useState(DEFAULT_CUSTOM_ENDPOINT_NAME);
  const [customFetchedModels, setCustomFetchedModels] = useState<CustomModelOption[]>([]);
  const [customFetching, setCustomFetching] = useState(false);

  // Load current selections on open
  useEffect(() => {
    if (!visible) return;
    (async () => {
      const [p, gm, grm, orm, dsm, cm, cb, cName, cFetched] = await Promise.all([
        AsyncStorage.getItem(AI_PROVIDER_KEY),
        AsyncStorage.getItem(PROMPT_KEYS.model),
        AsyncStorage.getItem(GROQ_MODEL_KEY),
        AsyncStorage.getItem(OPENROUTER_MODEL_KEY),
        AsyncStorage.getItem(DEEPSEEK_MODEL_KEY),
        AsyncStorage.getItem(CUSTOM_MODEL_KEY),
        AsyncStorage.getItem(CUSTOM_API_BASE_URL_KEY),
        AsyncStorage.getItem(CUSTOM_ENDPOINT_NAME_KEY),
        AsyncStorage.getItem(CUSTOM_FETCHED_MODELS_KEY),
      ]);
      setProvider((p as 'gemini' | 'groq' | 'openrouter' | 'deepseek' | 'custom') || 'gemini');
      setGeminiModel(gm || DEFAULT_MODEL);
      setGroqModel(grm || DEFAULT_GROQ_MODEL);
      setOpenrouterModel(orm || DEFAULT_OPENROUTER_MODEL);
      setDeepseekModel(dsm || DEFAULT_DEEPSEEK_MODEL);
      setCustomModel(cm || DEFAULT_CUSTOM_MODEL);
      setCustomBaseUrl(cb || '');
      setCustomEndpointName(cName || DEFAULT_CUSTOM_ENDPOINT_NAME);
      if (cFetched) {
        try {
          const parsed = JSON.parse(cFetched);
          if (Array.isArray(parsed)) setCustomFetchedModels(parsed);
        } catch {}
      }
    })();
  }, [visible]);

  // Save instantly when user taps a model or provider
  const saveProvider = async (p: 'gemini' | 'groq' | 'openrouter' | 'deepseek' | 'custom') => {
    setProvider(p);
    await AsyncStorage.setItem(AI_PROVIDER_KEY, p);
  };

  const saveGeminiModel = async (m: string) => {
    setGeminiModel(m);
    await AsyncStorage.setItem(PROMPT_KEYS.model, m);
  };

  const saveGroqModel = async (m: string) => {
    setGroqModel(m);
    await AsyncStorage.setItem(GROQ_MODEL_KEY, m);
  };

  const saveOpenrouterModel = async (m: string) => {
    setOpenrouterModel(m);
    await AsyncStorage.setItem(OPENROUTER_MODEL_KEY, m);
  };

  const saveDeepseekModel = async (m: string) => {
    setDeepseekModel(m);
    await AsyncStorage.setItem(DEEPSEEK_MODEL_KEY, m);
  };

  const saveCustomModel = async (m: string) => {
    setCustomModel(m);
    await AsyncStorage.setItem(CUSTOM_MODEL_KEY, m);
  };

  const handleRefreshCustomModels = async () => {
    if (!customBaseUrl.trim()) {
      onClose();
      router.push('/ai-settings');
      return;
    }
    setCustomFetching(true);
    try {
      const res = await fetchCustomModels(customBaseUrl);
      if (res.success && res.models.length > 0) {
        setCustomFetchedModels(res.models);
        await AsyncStorage.setItem(CUSTOM_FETCHED_MODELS_KEY, JSON.stringify(res.models));
      }
    } catch {} finally {
      setCustomFetching(false);
    }
  };

  const models = provider === 'groq' 
    ? GROQ_MODELS 
    : provider === 'openrouter'
    ? OPENROUTER_MODELS
    : provider === 'deepseek' 
    ? DEEPSEEK_MODELS 
    : provider === 'custom'
    ? (customFetchedModels.length > 0 ? customFetchedModels : [{ id: customModel || DEFAULT_CUSTOM_MODEL, label: customModel || DEFAULT_CUSTOM_MODEL, sub: customEndpointName || 'Custom Node' }])
    : GEMINI_MODELS;

  const activeModel = provider === 'groq' 
    ? groqModel 
    : provider === 'openrouter'
    ? openrouterModel
    : provider === 'deepseek' 
    ? deepseekModel 
    : provider === 'custom'
    ? customModel
    : geminiModel;

  const accentColor = provider === 'groq' 
    ? '#f97316' 
    : provider === 'openrouter'
    ? '#0891b2'
    : provider === 'deepseek' 
    ? '#0ea5e9' 
    : provider === 'custom'
    ? '#10b981'
    : '#7c3aed';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000060' }} onPress={onClose} />
      <View style={{
        backgroundColor: colors.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 20, paddingBottom: 36,
        maxHeight: '85%',
      }}>

        {/* Handle + header */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
            <Brain size={18} color={accentColor} />
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary, flex: 1, marginLeft: 8 }}>
              AI Model Switcher
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Provider toggle */}
          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, marginBottom: 8 }}>
            ACTIVE PROVIDER
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {(['gemini', 'groq', 'openrouter', 'deepseek', 'custom'] as const).map(p => {
              const accent = p === 'groq' 
                ? '#f97316' 
                : p === 'openrouter' 
                ? '#0891b2'
                : p === 'deepseek' 
                ? '#0ea5e9' 
                : p === 'custom'
                ? '#10b981'
                : '#7c3aed';
              const label = p === 'groq' ? '⚡ Groq' : p === 'openrouter' ? '🌐 OpenRouter' : p === 'deepseek' ? '🌀 DeepSeek' : p === 'custom' ? '⚙️ Custom' : '✦ Gemini';
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => saveProvider(p)}
                  style={{
                    flex: 1, minWidth: '30%', paddingVertical: 9, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center',
                    borderWidth: provider === p ? 2 : 1,
                    borderColor: provider === p ? accent : colors.border,
                    backgroundColor: provider === p ? accent + '15' : colors.surface,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: provider === p ? accent : colors.textSecondary }}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Model chips */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary }}>
              {provider === 'custom' ? `CUSTOM MODELS (${models.length})` : 'SELECT MODEL'}
            </Text>
            {provider === 'custom' && customBaseUrl.trim() !== '' && (
              <TouchableOpacity onPress={handleRefreshCustomModels} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {customFetching ? <ActivityIndicator size="small" color="#10b981" /> : <RefreshCw size={12} color="#10b981" />}
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#10b981' }}>Refresh</Text>
              </TouchableOpacity>
            )}
          </View>

          {provider === 'custom' && !customBaseUrl.trim() && (
            <View style={{
              padding: 12, borderRadius: 10, backgroundColor: '#10b98115',
              borderWidth: 1, borderColor: '#10b981', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#10b981' }}>
                No Custom Base URL Configured
              </Text>
              <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
                Tap "Custom Base URL, Keys & Prompts" below to configure your custom endpoint or public IP.
              </Text>
            </View>
          )}

          <View style={{ gap: 8, marginBottom: 20 }}>
            {models.map(m => (
              <TouchableOpacity
                key={m.id}
                onPress={() => {
                  if (provider === 'groq') saveGroqModel(m.id);
                  else if (provider === 'openrouter') saveOpenrouterModel(m.id);
                  else if (provider === 'deepseek') saveDeepseekModel(m.id);
                  else if (provider === 'custom') saveCustomModel(m.id);
                  else saveGeminiModel(m.id);
                }}
                style={{
                  flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
                  borderWidth: activeModel === m.id ? 2 : 1,
                  borderColor: activeModel === m.id ? accentColor : colors.border,
                  backgroundColor: activeModel === m.id ? accentColor + '15' : colors.surface,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700',
                    color: activeModel === m.id ? accentColor : colors.textPrimary }}>
                    {m.label}
                  </Text>
                  {m.sub && <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{m.sub}</Text>}
                </View>
                {activeModel === m.id && (
                  <View style={{ backgroundColor: accentColor, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 10, fontWeight: '900', color: '#fff' }}>ACTIVE</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Link to full AI Settings */}
          <TouchableOpacity
            onPress={() => { onClose(); router.push('/ai-settings'); }}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              padding: 12, borderRadius: 12,
              backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.border,
            }}
          >
            <Settings2 size={16} color={colors.textSecondary} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
              Custom Base URL, Keys & Prompts
            </Text>
            <ChevronRight size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        </ScrollView>

      </View>
    </Modal>
  );
}
