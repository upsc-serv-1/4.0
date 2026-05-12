import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { buildCanonicalExplanations } from '../../utils/questionUtils';
import { Sparkles, Send, X } from 'lucide-react-native';
import { aiAskDoubt } from '../../services/GeminiService';

interface VitaminVersion {
  id: string;
  question_id: string;
  user_id: string;
  text: string;
  rating?: number | null;
  created_at: string;
}

interface InstituteExplanation {
  source: string;
  program?: string;
  answer?: string;
  text: string;
}

interface Props {
  questionId: string;
  testId: string;
  questionText: string;
  defaultExplanation: string;
  subject?: string;
  sectionGroup?: string;
  microTopic?: string;
  isZenMode?: boolean;
  instituteExplanations?: any[];
  institutes?: string[];
  mergedIds?: string[];
}

export function TagsQuestionAIPanel({
  questionId,
  testId,
  questionText,
  defaultExplanation,
  subject,
  microTopic,
  isZenMode,
  instituteExplanations = [],
  mergedIds = [],
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const sec = isZenMode ? '#43342295' : colors.textSecondary;
  const tert = isZenMode ? '#43342260' : colors.textTertiary;
  const primary = colors.primary;

  const handleAskAI = () => {
    setChatMessages([{
      role: 'ai',
      text: `I'm looking at the question: "${questionText.substring(0, 100)}${questionText.length > 100 ? '...' : ''}". How can I help you with it?`,
    }]);
    setChatModalVisible(true);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatLoading(true);
    try {
      const response = await aiAskDoubt(
        `${userMsg}\n\nContext — Question: ${questionText}\nExplanation: ${defaultExplanation || 'N/A'}\nSubject: ${subject || 'N/A'}`,
        { question: questionText, explanation: defaultExplanation }
      );
      setChatMessages(prev => [...prev, { role: 'ai', text: response || 'Sorry, I could not generate a response.' }]);
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'ai', text: `Error: ${err?.message || 'AI service unavailable'}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <View style={[styles.panel, { borderTopColor: colors.border + '55' }]} testID="tags-ai-panel">
      {/* "Ask AI" button — the ONLY action button */}
      <TouchableOpacity
        onPress={handleAskAI}
        style={[styles.askAiBtn, { backgroundColor: primary + '15', borderColor: primary + '30' }]}
        testID="ask-ai-button"
      >
        <Sparkles size={14} color={primary} />
        <Text style={[styles.askAiText, { color: primary }]}>Ask AI</Text>
      </TouchableOpacity>

      {/* AI Chatbot Modal */}
      <Modal visible={chatModalVisible} transparent animationType="slide" onRequestClose={() => setChatModalVisible(false)}>
        <View style={styles.chatOverlay}>
          <View style={[styles.chatContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.chatTitle, { color: colors.textPrimary }]}>Ask AI — Tagged Question</Text>
              <TouchableOpacity onPress={() => setChatModalVisible(false)}>
                <X size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.chatMessages} contentContainerStyle={styles.chatMessagesContent}>
              {chatMessages.map((msg, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.chatBubble,
                    msg.role === 'user'
                      ? [styles.userBubble, { backgroundColor: primary + '20', alignSelf: 'flex-end' }]
                      : [styles.aiBubble, { backgroundColor: colors.bg, alignSelf: 'flex-start' }],
                  ]}
                >
                  <Text style={[styles.chatBubbleText, { color: msg.role === 'user' ? primary : colors.textPrimary }]}>
                    {msg.text}
                  </Text>
                </View>
              ))}
              {chatLoading && (
                <View style={[styles.chatBubble, styles.aiBubble, { backgroundColor: colors.bg, alignSelf: 'flex-start' }]}>
                  <ActivityIndicator size="small" color={primary} />
                </View>
              )}
            </ScrollView>
            <View style={[styles.chatInputRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.chatInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
                placeholder="Ask anything about this question..."
                placeholderTextColor={tert}
                value={chatInput}
                onChangeText={setChatInput}
                multiline
              />
              <TouchableOpacity
                onPress={handleSendMessage}
                disabled={!chatInput.trim() || chatLoading}
                style={[styles.sendBtn, { backgroundColor: primary, opacity: !chatInput.trim() || chatLoading ? 0.5 : 1 }]}
              >
                <Send size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
  askAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
  },
  askAiText: { fontSize: 14, fontWeight: '800' },
  // Chat Modal
  chatOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  chatContainer: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '80%', minHeight: '50%' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  chatTitle: { fontSize: 16, fontWeight: '900', flex: 1 },
  chatMessages: { flex: 1 },
  chatMessagesContent: { padding: 16, gap: 12 },
  chatBubble: { maxWidth: '85%', padding: 12, borderRadius: 16, marginBottom: 4 },
  userBubble: { borderBottomRightRadius: 4 },
  aiBubble: { borderBottomLeftRadius: 4 },
  chatBubbleText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  chatInputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1 },
  chatInput: { flex: 1, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 100, fontSize: 14 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});