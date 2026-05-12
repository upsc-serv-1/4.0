/**
 * AIModelSwitcher
 * A compact bottom sheet showing:
 * - Provider toggle (Gemini / Groq) 
 * - Model chips for the active provider
 * - "More settings →" link to full AI Settings page
 * Saves instantly on selection — no Save button needed.
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  ActivityIndicator, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Brain, X, ChevronRight, Settings2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  AI_PROVIDER_KEY, GEMINI_MODELS, GROQ_MODELS, DEEPSEEK_MODELS,
  DEFAULT_MODEL, DEFAULT_GROQ_MODEL, DEFAULT_DEEPSEEK_MODEL,
  PROMPT_KEYS, GROQ_MODEL_KEY, DEEPSEEK_MODEL_KEY,
} from '../../services/GeminiService';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function AIModelSwitcher({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const [provider, setProvider] = useState<'gemini' | 'groq' | 'deepseek'>('gemini');
  const [geminiModel, setGeminiModel] = useState(DEFAULT_MODEL);
  const [groqModel, setGroqModel] = useState(DEFAULT_GROQ_MODEL);
  const [deepseekModel, setDeepseekModel] = useState(DEFAULT_DEEPSEEK_MODEL);

  // Load current selections on open
  useEffect(() => {
    if (!visible) return;
    (async () => {
      const [p, gm, grm, dsm] = await Promise.all([
        AsyncStorage.getItem(AI_PROVIDER_KEY),
        AsyncStorage.getItem(PROMPT_KEYS.model),
        AsyncStorage.getItem(GROQ_MODEL_KEY),
        AsyncStorage.getItem(DEEPSEEK_MODEL_KEY),
      ]);
      setProvider((p as 'gemini' | 'groq' | 'deepseek') || 'gemini');
      setGeminiModel(gm || DEFAULT_MODEL);
      setGroqModel(grm || DEFAULT_GROQ_MODEL);
      setDeepseekModel(dsm || DEFAULT_DEEPSEEK_MODEL);
    })();
  }, [visible]);

  // Save instantly when user taps a model or provider
  const saveProvider = async (p: 'gemini' | 'groq' | 'deepseek') => {
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

  const saveDeepseekModel = async (m: string) => {
    setDeepseekModel(m);
    await AsyncStorage.setItem(DEEPSEEK_MODEL_KEY, m);
  };

  const models = provider === 'groq' ? GROQ_MODELS : provider === 'deepseek' ? DEEPSEEK_MODELS : GEMINI_MODELS;
  const activeModel = provider === 'groq' ? groqModel : provider === 'deepseek' ? deepseekModel : geminiModel;
  const accentColor = provider === 'groq' ? '#f97316' : provider === 'deepseek' ? '#0ea5e9' : '#7c3aed';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000060' }} onPress={onClose} />
      <View style={{
        backgroundColor: colors.bg,
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 20, paddingBottom: 36,
      }}>

        {/* Handle + header */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 14 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
            <Brain size={18} color={accentColor} />
            <Text style={{ fontSize: 16, fontWeight: '900', color: colors.textPrimary, flex: 1, marginLeft: 8 }}>
              AI Model
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Provider toggle */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, marginBottom: 8 }}>
          PROVIDER
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          {(['gemini', 'groq', 'deepseek'] as const).map(p => {
            const accent = p === 'groq' ? '#f97316' : p === 'deepseek' ? '#0ea5e9' : '#7c3aed';
            return (
              <TouchableOpacity
                key={p}
                onPress={() => saveProvider(p)}
                style={{
                  flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                  borderWidth: provider === p ? 2 : 1,
                  borderColor: provider === p ? accent : colors.border,
                  backgroundColor: provider === p ? accent + '15' : colors.surface,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '800',
                  color: provider === p ? accent : colors.textSecondary }}>
                  {p === 'groq' ? '⚡ Groq' : p === 'deepseek' ? '🌀 DeepSeek' : '✦ Gemini'}
                </Text>
                <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>
                  {p === 'groq' ? 'Free · no billing' : p === 'deepseek' ? 'Latest models' : 'Google'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Model chips */}
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, marginBottom: 8 }}>
          MODEL
        </Text>
        <View style={{ gap: 8, marginBottom: 20 }}>
          {models.map(m => (
            <TouchableOpacity
              key={m.id}
              onPress={() => provider === 'groq' ? saveGroqModel(m.id) : provider === 'deepseek' ? saveDeepseekModel(m.id) : saveGeminiModel(m.id)}
              style={{
                flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12,
                borderWidth: activeModel === m.id ? 2 : 1,
                borderColor: activeModel === m.id ? accentColor : colors.border,
                backgroundColor: activeModel === m.id ? accentColor + '15' : colors.surface,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700',
                  color: activeModel === m.id ? accentColor : colors.textPrimary }}>
                  {m.label}
                </Text>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{m.sub}</Text>
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
            API Keys, Prompts & More
          </Text>
          <ChevronRight size={14} color={colors.textTertiary} />
        </TouchableOpacity>

      </View>
    </Modal>
  );
}
