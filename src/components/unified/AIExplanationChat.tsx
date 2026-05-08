/**
 * AIExplanationChat — multi-turn AI chat component for quiz explanations.
 * Includes:
 * - Quick action template buttons (ELI5, Why Wrong, Concept, etc.)
 * - Free-text follow-up input
 * - Conversation history (persisted to Supabase)
 * - Vitamin save with star rating
 * - Copy-to-clipboard
 *
 * Phase 3 of the AI Enhancement strategy.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Send, Star, Trash2, Copy, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { spacing, radius } from '../../theme';
import {
  AIPromptManager,
  PromptTemplate,
  ConversationMessage,
  DEFAULT_QUIZ_TEMPLATES,
} from '../../services/AIPromptManager';
import { generateWithHistory } from '../../services/GeminiService';

interface AIExplanationChatProps {
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  instituteExplanations?: string;
  initialExplanation?: string;
  onVitaminSave?: (content: string, templateUsed: string, rating: number) => void;
  collapsed?: boolean;
}

export const AIExplanationChat: React.FC<AIExplanationChatProps> = ({
  questionId,
  questionText,
  options,
  correctAnswer,
  instituteExplanations,
  initialExplanation,
  onVitaminSave,
  collapsed: initialCollapsed = false,
}) => {
  const { colors } = useTheme();
  const { session } = useAuth();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>(DEFAULT_QUIZ_TEMPLATES);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('standard');
  const [vitaminRating, setVitaminRating] = useState(0);
  const [showVitaminPanel, setShowVitaminPanel] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const promptManager = AIPromptManager.getInstance();

  useEffect(() => {
    loadTemplates();
    loadConversationHistory();
  }, [questionId]);

  const loadTemplates = async () => {
    if (!session?.user?.id) return;
    try {
      const temps = await promptManager.fetchPromptTemplates(session.user.id, 'quiz');
      if (temps.length > 0) setTemplates(temps);
    } catch {}
  };

  const loadConversationHistory = async () => {
    if (!session?.user?.id) return;
    try {
      const history = await promptManager.getConversationHistory(session.user.id, questionId);
      if (history.length > 0) {
        setMessages(history);
      } else if (initialExplanation) {
        setMessages([
          {
            role: 'assistant',
            content: initialExplanation,
            template_used: 'standard',
            timestamp: Date.now(),
          },
        ]);
      }
    } catch {}
    setHistoryLoaded(true);
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || loading) return;
    const userId = session?.user?.id;

    const userMsg: ConversationMessage = {
      role: 'user',
      content: inputText.trim(),
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    if (userId) promptManager.saveMessage(userId, questionId, userMsg);
    setInputText('');
    setLoading(true);

    try {
      const response = await generateWithHistory(
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        {
          question: questionText,
          options,
          correct_answer: correctAnswer,
          institute_explanations: instituteExplanations,
        }
      );

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMsg]);
      if (userId) promptManager.saveMessage(userId, questionId, aiMsg);

      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert(
        'AI Error',
        err?.message || 'Failed to get response. Check your API key in AI Settings.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateButton = async (template: PromptTemplate) => {
    if (loading) return;
    const userId = session?.user?.id;
    setSelectedTemplateKey(template.template_key);
    setLoading(true);

    try {
      const wrongOptions = options.filter(opt => {
        const optKey = opt.split(')')[0].trim().toUpperCase();
        return optKey !== correctAnswer.toUpperCase();
      });

      const promptText = promptManager.fillTemplate(template.prompt_text, {
        question: questionText,
        options: options.join('\n'),
        correct_answer: correctAnswer,
        wrong_options: wrongOptions.join('\n'),
      });

      const userMsg: ConversationMessage = {
        role: 'user',
        content: promptText,
        template_used: template.template_key,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, userMsg];

      const response = await generateWithHistory(
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        { question: questionText, options, correct_answer: correctAnswer }
      );

      const aiMsg: ConversationMessage = {
        role: 'assistant',
        content: response,
        template_used: template.template_key,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMsg]);
      if (userId) {
        promptManager.saveMessage(userId, questionId, userMsg);
        promptManager.saveMessage(userId, questionId, aiMsg);
      }

      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err: any) {
      Alert.alert('AI Error', err?.message || 'Failed to generate response');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVitamin = async () => {
    const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAiMsg) return;

    if (onVitaminSave) {
      onVitaminSave(lastAiMsg.content, selectedTemplateKey, vitaminRating);
    }

    const userId = session?.user?.id;
    if (userId) {
      await promptManager.saveVitaminVersion(userId, {
        question_id: questionId,
        explanation_content: lastAiMsg.content,
        template_used: selectedTemplateKey,
        rating: vitaminRating,
        is_primary: true,
      });
    }

    setShowVitaminPanel(false);
    Alert.alert('✅ Saved!', 'Added to My Vitamins.');
  };

  const handleCopyMessage = async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Alert.alert('Copied', 'Text copied to clipboard');
    } catch {}
  };

  const handleClearHistory = async () => {
    Alert.alert('Clear History', 'Remove all chat messages for this question?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const userId = session?.user?.id;
          if (userId) await promptManager.clearConversation(userId, questionId);
          setMessages(
            initialExplanation
              ? [{ role: 'assistant', content: initialExplanation, template_used: 'standard' }]
              : []
          );
        },
      },
    ]);
  };

  if (collapsed) {
    return (
      <TouchableOpacity
        testID="ai-chat-expand-btn"
        onPress={() => setCollapsed(false)}
        style={[styles.collapsedBar, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Text style={[styles.collapsedText, { color: colors.primary }]}>
          🤖 Ask AI about this question
        </Text>
        <ChevronDown size={16} color={colors.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bg }]}
      testID="ai-explanation-chat"
    >
      {/* Header */}
      <View style={[styles.chatHeader, { borderBottomColor: colors.border }]}>
        <View style={[styles.aiIndicator, { backgroundColor: '#7c3aed20' }]}>
          <Text style={[styles.aiLabel, { color: '#7c3aed' }]}>🤖 AI Chat</Text>
        </View>
        <View style={styles.headerActions}>
          {messages.length > 0 && (
            <TouchableOpacity onPress={handleClearHistory} testID="ai-chat-clear-btn">
              <Trash2 size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setCollapsed(true)} testID="ai-chat-collapse-btn">
            <ChevronUp size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.messageRow,
              msg.role === 'user' ? styles.userMessageRow : styles.aiMessageRow,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                msg.role === 'user'
                  ? [styles.userBubble, { backgroundColor: '#7c3aed' }]
                  : [styles.aiBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
              ]}
            >
              {msg.template_used && msg.role === 'assistant' && (
                <View style={styles.templateBadge}>
                  <Text style={[styles.templateBadgeText, { color: colors.textTertiary }]}>
                    {templates.find(t => t.template_key === msg.template_used)?.button_emoji || '🤖'}{' '}
                    {templates.find(t => t.template_key === msg.template_used)?.button_label || msg.template_used}
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.messageText,
                  { color: msg.role === 'user' ? '#fff' : colors.textPrimary },
                ]}
                selectable
              >
                {msg.content}
              </Text>
              {msg.role === 'assistant' && (
                <View style={styles.messageActions}>
                  <TouchableOpacity
                    onPress={() => handleCopyMessage(msg.content)}
                    testID={`copy-msg-${idx}`}
                    style={styles.actionBtn}
                  >
                    <Copy size={14} color={colors.textTertiary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowVitaminPanel(true)}
                    testID={`save-vitamin-${idx}`}
                    style={styles.actionBtn}
                  >
                    <Star size={14} color="#f59e0b" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#7c3aed" size="small" />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              AI is thinking…
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Quick Template Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.templateScroll, { borderTopColor: colors.border }]}
        contentContainerStyle={styles.templateContent}
      >
        {templates.map(template => (
          <TouchableOpacity
            key={template.template_key}
            testID={`template-btn-${template.template_key}`}
            style={[
              styles.templateButton,
              {
                backgroundColor:
                  selectedTemplateKey === template.template_key
                    ? '#7c3aed'
                    : colors.surface,
                borderColor:
                  selectedTemplateKey === template.template_key
                    ? '#7c3aed'
                    : colors.border,
              },
            ]}
            onPress={() => handleTemplateButton(template)}
            disabled={loading}
          >
            <Text
              style={[
                styles.templateButtonText,
                {
                  color:
                    selectedTemplateKey === template.template_key
                      ? '#fff'
                      : colors.textPrimary,
                },
              ]}
            >
              {template.button_emoji} {template.button_label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input Area */}
      <View
        style={[
          styles.inputArea,
          { borderTopColor: colors.border, backgroundColor: colors.bg },
        ]}
      >
        <TextInput
          testID="ai-chat-input"
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          placeholder="Ask anything about this question…"
          placeholderTextColor={colors.textTertiary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!loading}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          testID="ai-chat-send-btn"
          style={[
            styles.sendButton,
            { backgroundColor: '#7c3aed', opacity: loading || !inputText.trim() ? 0.5 : 1 },
          ]}
          onPress={handleSendMessage}
          disabled={loading || !inputText.trim()}
        >
          <Send size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Vitamin Save Panel */}
      {showVitaminPanel && (
        <View style={[styles.vitaminPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.vitaminTitle, { color: colors.textPrimary }]}>
            ⭐ Save to My Vitamins
          </Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                testID={`vitamin-star-${star}`}
                onPress={() => setVitaminRating(star)}
              >
                <Star
                  size={28}
                  color={star <= vitaminRating ? '#f59e0b' : colors.border}
                  fill={star <= vitaminRating ? '#f59e0b' : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.vitaminButtons}>
            <TouchableOpacity
              testID="vitamin-save-confirm-btn"
              style={[styles.vitaminBtn, { backgroundColor: '#7c3aed' }]}
              onPress={handleSaveVitamin}
            >
              <Text style={styles.vitaminBtnText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="vitamin-cancel-btn"
              style={[styles.vitaminBtn, { backgroundColor: colors.border }]}
              onPress={() => setShowVitaminPanel(false)}
            >
              <Text style={[styles.vitaminBtnText, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 300,
  },
  collapsedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: spacing.sm,
  },
  collapsedText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  aiIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  messagesContainer: {
    flex: 1,
    maxHeight: 320,
  },
  messagesContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  aiMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '85%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  templateBadge: {
    marginBottom: 4,
  },
  templateBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 21,
  },
  messageActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  actionBtn: {
    padding: 4,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  loadingText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  templateScroll: {
    maxHeight: 54,
    borderTopWidth: 1,
  },
  templateContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  templateButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 6,
  },
  templateButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputArea: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 8,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitaminPanel: {
    padding: spacing.lg,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: spacing.md,
  },
  vitaminTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 12,
  },
  vitaminButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  vitaminBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  vitaminBtnText: {
    fontWeight: '800',
    color: '#fff',
    fontSize: 14,
  },
});
