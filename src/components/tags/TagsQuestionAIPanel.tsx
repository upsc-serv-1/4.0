import React, { Fragment, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Sparkles, Send, ChevronDown, ChevronRight, BookOpen, GraduationCap, Lightbulb, Star } from 'lucide-react-native';
import { aiAskDoubt } from '../../services/GeminiService';
import { fetchBestAnswer, type BestAnswer } from '../../services/BestAnswerService';

/** Strip raw HTML tags from a string */
const stripHtml = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')   // Remove all HTML tags
    .replace(/&lt;/g, '<')      // Restore escaped <
    .replace(/&gt;/g, '>')      // Restore escaped >
    .replace(/&amp;/g, '&')     // Restore escaped &
    .replace(/&nbsp;/g, ' ')    // Restore &nbsp;
    .replace(/\s+/g, ' ')       // Collapse whitespace
    .trim();
};

/**
 * Render text with markdown bold/italic formatting and HTML stripped.
 * Parses **bold** and *italic* markers into styled <Text> children.
 */
function FormattedText({ text, style, color, numberOfLines }: {
  text: string; style?: any; color?: string; numberOfLines?: number;
}) {
  const clean = stripHtml(text || '');
  // Parse markdown: **bold** or __bold__ then *italic* or _italic_
  const parts: { t: string; b?: boolean; i?: boolean }[] = [];
  // First handle **bold**
  let remaining = clean;
  const boldRe = /(\*\*(.+?)\*\*|__(.+?)__)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = boldRe.exec(remaining)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ t: remaining.slice(lastIdx, match.index) });
    }
    parts.push({ t: match[2] || match[3], b: true });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < remaining.length) {
    parts.push({ t: remaining.slice(lastIdx) });
  }
  // Now handle *italic* within each non-bold part
  const finalParts: { t: string; b?: boolean; i?: boolean }[] = [];
  for (const part of parts) {
    if (part.b) {
      finalParts.push(part);
      continue;
    }
    const italicRe = /(\*(.+?)\*|_(.+?)_)/g;
    let iLast = 0;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = italicRe.exec(part.t)) !== null) {
      if (iMatch.index > iLast) {
        finalParts.push({ t: part.t.slice(iLast, iMatch.index) });
      }
      finalParts.push({ t: iMatch[2] || iMatch[3], i: true });
      iLast = iMatch.index + iMatch[0].length;
    }
    if (iLast < part.t.length) {
      finalParts.push({ t: part.t.slice(iLast) });
    }
  }
  if (finalParts.length === 0) finalParts.push({ t: clean });

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {finalParts.map((part, idx) => (
        <Text key={idx} style={[part.b && { fontWeight: '800' }, part.i && { fontStyle: 'italic' }, color ? { color } : {}]}>
          {part.t}
        </Text>
      ))}
    </Text>
  );
}

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
  /** When provided, clicking "Ask AI" opens the PilotV2AIChat floating chatbot instead of a local modal */
  onOpenAIChat?: (questionData: { id: string; question_text: string; correct_answer: string; explanation: string; subject?: string }) => void;
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
  onOpenAIChat,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;

  // State for user's MyVitamin (BestAnswer)
  const [bestAnswer, setBestAnswer] = useState<BestAnswer | null>(null);
  const [bestAnswerLoading, setBestAnswerLoading] = useState(false);

  // Fetch the user's MyVitamin for this question
  useEffect(() => {
    if (!questionId || !userId) return;
    let cancelled = false;
    setBestAnswerLoading(true);
    fetchBestAnswer(questionId).then((row) => {
      if (!cancelled) {
        setBestAnswer(row);
        setBestAnswerLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setBestAnswerLoading(false);
    });
    return () => { cancelled = true; };
  }, [questionId, userId]);

  // State for collapsible institute explanations
  const [instituteExpanded, setInstituteExpanded] = useState(false);
  // State for inline chat mode (fallback if onOpenAIChat not provided)
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);

  const sec = isZenMode ? '#43342295' : colors.textSecondary;
  const tert = isZenMode ? '#43342260' : colors.textTertiary;
  const primary = colors.primary;
  const bg = isZenMode ? 'rgba(67,52,34,0.03)' : colors.surface;

  // Filter institute explanations:
  // - Must have text content
  // - Deduplicate by text content: if two entries have identical text, keep only the first one
  const validInstituteExpls = (instituteExplanations || []).filter((ie: any, idx: number) => {
    if (!ie || !ie.text) return false;
    // Deduplicate: skip entries whose text matches a PREVIOUS entry's text
    for (let i = 0; i < idx; i++) {
      const prev = instituteExplanations[i];
      if (prev && prev.text === ie.text) return false;
    }
    return true;
  });

  const handleAskAI = () => {
    if (onOpenAIChat) {
      // Use parent's PilotV2AIChat floating chatbot
      onOpenAIChat({
        id: questionId,
        question_text: questionText,
        correct_answer: '',
        explanation: defaultExplanation,
        subject,
      });
    } else {
      // Fallback: inline chat mode
      setChatExpanded(true);
      setChatMessages([{
        role: 'ai',
        text: `I'm looking at the question: "${questionText.substring(0, 100)}${questionText.length > 100 ? '...' : ''}". How can I help you with it?`,
      }]);
    }
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

  function getSourceIcon(source: string) {
    const s = (source || '').toLowerCase();
    if (s.includes('vision') || s.includes('myvitamin') || s.includes('my_vitamin')) return Lightbulb;
    return GraduationCap;
  }

  return (
    <View style={[styles.panel, { borderTopColor: colors.border + '55' }]} testID="tags-ai-panel">
      {/* ── Multiple Answers Section ── */}
      {(bestAnswer || validInstituteExpls.length > 0) && (
        <View style={styles.answersSection}>

          {/* MyVitamin Answer — only shown when user has saved one */}
          {bestAnswer && (
            <View style={[styles.answerBlock, { backgroundColor: isZenMode ? 'rgba(67,52,34,0.03)' : '#22c55e10', borderColor: '#22c55e40' }]}>
              <View style={styles.answerHeader}>
                <Star size={14} color="#22c55e" />
                <Text style={[styles.answerSource, { color: '#22c55e' }]}>My Vitamin</Text>
                {bestAnswer.updated_at && (
                  <Text style={{ fontSize: 8, color: tert, fontWeight: '600' }}>
                    {new Date(bestAnswer.updated_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <FormattedText text={bestAnswer.answer_text} style={[styles.answerText]} color={sec} numberOfLines={5} />
            </View>
          )}

          <View style={styles.instituteSection}>
              <TouchableOpacity
                onPress={() => setInstituteExpanded(!instituteExpanded)}
                style={[styles.instituteToggle, { backgroundColor: isZenMode ? 'rgba(67,52,34,0.05)' : colors.surfaceStrong + '20' }]}
              >
                <BookOpen size={14} color={primary} />
                <Text style={[styles.instituteToggleText, { color: primary }]}>
                  {validInstituteExpls.length} Institute Answer{validInstituteExpls.length > 1 ? 's' : ''}
                </Text>
                {instituteExpanded ? (
                  <ChevronDown size={14} color={tert} />
                ) : (
                  <ChevronRight size={14} color={tert} />
                )}
              </TouchableOpacity>

              {instituteExpanded && (
                <View style={styles.instituteList}>
                  {validInstituteExpls.map((ie: any, idx: number) => {
                    const Icon = getSourceIcon(ie.source);
                    const sourceLabel = ie.source || `Institute ${idx + 1}`;
                    const ansLetter = ie.answer ? `Ans: ${ie.answer}` : '';
                    return (
                      <View
                        key={idx}
                        style={[styles.answerBlock, { backgroundColor: isZenMode ? 'rgba(67,52,34,0.02)' : colors.surface, borderColor: colors.border }]}
                      >
                        <View style={styles.answerHeader}>
                          <Icon size={12} color={primary} />
                          <Text style={[styles.answerSource, { color: primary }]} numberOfLines={1}>
                            {sourceLabel}{ie.program ? ` — ${ie.program}` : ''}
                          </Text>
                        </View>
                        {ansLetter ? (
                          <Text style={[styles.answerLetter, { color: '#22c55e', fontWeight: '800', fontSize: 11, marginBottom: 4 }]}>
                            {ansLetter}
                          </Text>
                        ) : null}
                        <FormattedText text={ie.text} style={[styles.answerText]} color={sec} numberOfLines={4} />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
      )}

      {/* ── Ask AI / Chat Section (Issue 21 fix) ── */}
      {onOpenAIChat ? (
        /* Opens floating PilotV2AIChat chatbot */
        <TouchableOpacity
          onPress={handleAskAI}
          style={[styles.askAiBtn, { backgroundColor: primary + '15', borderColor: primary + '30' }]}
          testID="ask-ai-button"
        >
          <Sparkles size={14} color={primary} />
          <Text style={[styles.askAiText, { color: primary }]}>Ask AI</Text>
        </TouchableOpacity>
      ) : (
        /* Fallback inline chat mode */
        <>
          <TouchableOpacity
            onPress={handleAskAI}
            style={[styles.askAiBtn, { backgroundColor: primary + '15', borderColor: primary + '30' }]}
            testID="ask-ai-button"
          >
            <Sparkles size={14} color={primary} />
            <Text style={[styles.askAiText, { color: primary }]}>Ask AI</Text>
          </TouchableOpacity>

          {chatExpanded && (
            <View style={[styles.inlineChat, { borderTopColor: colors.border + '30' }]}>
              <ScrollView style={styles.inlineChatMessages} contentContainerStyle={styles.inlineChatMessagesContent}>
                {chatMessages.map((msg, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.inlineChatBubble,
                      msg.role === 'user'
                        ? [styles.inlineUserBubble, { backgroundColor: primary + '20', alignSelf: 'flex-end' }]
                        : [styles.inlineAiBubble, { backgroundColor: bg, alignSelf: 'flex-start' }],
                    ]}
                  >
                    <Text style={[styles.inlineChatBubbleText, { color: msg.role === 'user' ? primary : colors.textPrimary }]}>
                      {msg.text}
                    </Text>
                  </View>
                ))}
                {chatLoading && (
                  <View style={[styles.inlineChatBubble, styles.inlineAiBubble, { backgroundColor: bg, alignSelf: 'flex-start' }]}>
                    <ActivityIndicator size="small" color={primary} />
                  </View>
                )}
              </ScrollView>
              <View style={[styles.inlineChatInputRow, { borderTopColor: colors.border }]}>
                <TextInput
                  style={[styles.inlineChatInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: bg }]}
                  placeholder="Ask anything about this question..."
                  placeholderTextColor={tert}
                  value={chatInput}
                  onChangeText={setChatInput}
                  multiline
                />
                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={!chatInput.trim() || chatLoading}
                  style={[styles.inlineSendBtn, { backgroundColor: primary, opacity: !chatInput.trim() || chatLoading ? 0.5 : 1 }]}
                >
                  <Send size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, gap: 8 },
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
  
  // ── Multiple Answers Section ──
  answersSection: { gap: 6 },
  answerBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  answerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  answerSource: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  answerText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
  answerLetter: {
    fontSize: 11,
    fontWeight: '800',
  },
  instituteSection: { gap: 4 },
  instituteToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  instituteToggleText: {
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  instituteList: {
    gap: 4,
    paddingLeft: 4,
  },
  
  // ── Inline Chat (fallback) ──
  inlineChat: {
    borderTopWidth: 1,
    marginTop: 4,
    paddingTop: 8,
  },
  inlineChatMessages: {
    maxHeight: 160,
  },
  inlineChatMessagesContent: {
    gap: 8,
    paddingBottom: 8,
  },
  inlineChatBubble: {
    maxWidth: '90%',
    padding: 10,
    borderRadius: 12,
    marginBottom: 2,
  },
  inlineUserBubble: {
    borderBottomRightRadius: 4,
  },
  inlineAiBubble: {
    borderBottomLeftRadius: 4,
  },
  inlineChatBubbleText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  inlineChatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 8,
  },
  inlineChatInput: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 80,
    fontSize: 13,
  },
  inlineSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});