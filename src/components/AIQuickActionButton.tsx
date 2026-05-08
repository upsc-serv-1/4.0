/**
 * AIQuickActionButton — a floating "Ask AI" button + bottom sheet modal
 * that can be embedded anywhere in the app (Notes, Tags, Analysis, Syllabus).
 *
 * Usage:
 *   <AIQuickActionButton
 *     context={{ type: 'note', content: '...note text...' }}
 *     templates={DEFAULT_NOTES_TEMPLATES}
 *   />
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Sparkles, X, Copy, Send } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AIPromptManager, PromptTemplate } from '../../services/AIPromptManager';
import { generateWithHistory } from '../../services/GeminiService';

export type AIContext = {
  type: 'note' | 'tag' | 'analysis' | 'syllabus' | 'quiz';
  content?: string;
  title?: string;
  metadata?: Record<string, string>;
};

interface Props {
  context: AIContext;
  templates: PromptTemplate[];
  buttonStyle?: object;
  buttonLabel?: string;
  category?: string;
}

export const AIQuickActionButton: React.FC<Props> = ({
  context,
  templates,
  buttonStyle,
  buttonLabel = '✨ Ask AI',
  category,
}) => {
  const { colors } = useTheme();
  const { session } = useAuth();
  const promptManager = AIPromptManager.getInstance();

  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<string>('');

  const handleTemplateAction = async (template: PromptTemplate) => {
    setLoading(true);
    setResult('');
    setActiveTemplate(template.template_key);

    try {
      const vars = {
        note_content: context.content || '',
        tag_name: context.title || '',
        title: context.title || '',
        content: context.content || '',
        weak_topics: context.metadata?.weak_topics || '',
        accuracy: context.metadata?.accuracy || '',
        total_count: context.metadata?.total_count || '',
        syllabus_topic: context.title || '',
        progress: context.metadata?.progress || '0',
        ...context.metadata,
      };

      const filledPrompt = promptManager.fillTemplate(template.prompt_text, vars);

      const response = await generateWithHistory([{ role: 'user', content: filledPrompt }]);
      setResult(response);
    } catch (err: any) {
      Alert.alert('AI Error', err?.message || 'Failed to generate. Check AI Settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSend = async () => {
    if (!customInput.trim() || loading) return;
    setLoading(true);
    setActiveTemplate('custom');

    try {
      const contextPrefix = context.content
        ? `Context: ${context.content.slice(0, 500)}\n\n`
        : context.title
        ? `Topic: ${context.title}\n\n`
        : '';

      const response = await generateWithHistory([
        { role: 'user', content: contextPrefix + customInput.trim() },
      ]);
      setResult(response);
    } catch (err: any) {
      Alert.alert('AI Error', err?.message || 'Failed to generate response');
    } finally {
      setLoading(false);
      setCustomInput('');
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    Alert.alert('Copied', 'Response copied to clipboard');
  };

  return (
    <>
      <TouchableOpacity
        testID="ai-quick-action-btn"
        onPress={() => setVisible(true)}
        style={[styles.floatBtn, buttonStyle]}
      >
        <Sparkles size={14} color="#fff" />
        <Text style={styles.floatBtnText}>{buttonLabel}</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ width: '100%' }}
          >
            <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
              {/* Header */}
              <View style={styles.sheetHeader}>
                <View style={styles.sheetDragHandle} />
                <View style={styles.sheetTitleRow}>
                  <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                    🤖 AI Assistant
                  </Text>
                  {context.title && (
                    <Text style={[styles.sheetSubtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                      {context.title}
                    </Text>
                  )}
                  <TouchableOpacity
                    testID="ai-sheet-close-btn"
                    onPress={() => { setVisible(false); setResult(''); }}
                  >
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
                {/* Quick Action Buttons */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.templateRow}
                  contentContainerStyle={styles.templateContent}
                >
                  {templates.map(t => (
                    <TouchableOpacity
                      key={t.template_key}
                      testID={`ai-quick-${t.template_key}`}
                      style={[
                        styles.templateChip,
                        {
                          backgroundColor:
                            activeTemplate === t.template_key ? '#7c3aed' : colors.surface,
                          borderColor:
                            activeTemplate === t.template_key ? '#7c3aed' : colors.border,
                        },
                      ]}
                      onPress={() => handleTemplateAction(t)}
                      disabled={loading}
                    >
                      <Text
                        style={[
                          styles.templateChipText,
                          { color: activeTemplate === t.template_key ? '#fff' : colors.textPrimary },
                        ]}
                      >
                        {t.button_emoji} {t.button_label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Loading indicator */}
                {loading && (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator color="#7c3aed" />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      AI is thinking…
                    </Text>
                  </View>
                )}

                {/* Result */}
                {!!result && !loading && (
                  <View style={[styles.resultBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.resultText, { color: colors.textPrimary }]} selectable>
                      {result}
                    </Text>
                    <TouchableOpacity
                      testID="ai-result-copy-btn"
                      onPress={handleCopy}
                      style={[styles.copyBtn, { borderColor: colors.border }]}
                    >
                      <Copy size={14} color={colors.textTertiary} />
                      <Text style={[styles.copyBtnText, { color: colors.textTertiary }]}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Custom input */}
                <View style={[styles.inputRow, { borderColor: colors.border }]}>
                  <TextInput
                    testID="ai-custom-input"
                    style={[styles.customInput, { color: colors.textPrimary, backgroundColor: colors.surface }]}
                    placeholder="Ask anything…"
                    placeholderTextColor={colors.textTertiary}
                    value={customInput}
                    onChangeText={setCustomInput}
                    multiline
                    maxLength={500}
                    editable={!loading}
                  />
                  <TouchableOpacity
                    testID="ai-custom-send-btn"
                    onPress={handleCustomSend}
                    disabled={!customInput.trim() || loading}
                    style={[
                      styles.sendBtn,
                      { opacity: !customInput.trim() || loading ? 0.5 : 1 },
                    ]}
                  >
                    <Send size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  floatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  floatBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  sheetHeader: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  sheetDragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 12,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '900',
    flex: 1,
  },
  sheetSubtitle: {
    fontSize: 12,
    flex: 1,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  templateRow: {
    maxHeight: 54,
    marginVertical: 12,
  },
  templateContent: {
    gap: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  templateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  templateChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  resultBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 22,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  copyBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 8,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  customInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    maxHeight: 100,
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#7c3aed',
    padding: 12,
    borderRadius: 20,
  },
});
