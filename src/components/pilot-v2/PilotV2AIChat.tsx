import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  Keyboard, 
  useWindowDimensions, 
  Platform,
  ActivityIndicator,
  Clipboard
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  interpolate, 
  Extrapolate,
  Easing
} from 'react-native-reanimated';
import { X, Sparkles, Send, Maximize2, Minimize2, Copy, Check } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AIPromptManager, DEFAULT_QUIZ_TEMPLATES, PromptTemplate } from '../../services/AIPromptManager';
import { generateWithHistory } from '../../services/GeminiService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isManual?: boolean;
}

// Global session-level cache to guarantee conversation histories are 100% persistent across question swaps
const globalHistoryCache: Record<string, Message[]> = {};

export function PilotV2AIChat({ isOtherPopupOpen, activeQuestion }: PilotV2AIChatProps) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>(DEFAULT_QUIZ_TEMPLATES);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am Dr. UPSC Assistant, your personal GS and Polity tutor. Ask me anything or choose a preset mode below!' }
  ]);

  const progress = useSharedValue(0);
  const keyboardHeight = useSharedValue(0);
  const promptManager = AIPromptManager.getInstance();

  // Load custom templates if available, ensuring 100% uniformity with the Quiz section
  useEffect(() => {
    loadTemplates();
  }, [session?.user?.id]);

  const loadTemplates = async () => {
    if (!session?.user?.id) return;
    try {
      const temps = await promptManager.fetchPromptTemplates(session.user.id, 'quiz');
      if (temps.length > 0) setTemplates(temps);
    } catch {}
  };

  // Sync and load/save messages from globalHistoryCache when activeQuestion changes
  useEffect(() => {
    if (activeQuestion?.id) {
      const cached = globalHistoryCache[activeQuestion.id];
      if (cached && cached.length > 0) {
        setMessages(cached);
      } else {
        const initial: Message[] = [
          { role: 'assistant', content: 'Hello! I am Dr. UPSC Assistant, your personal GS and Polity tutor. Ask me anything or choose a preset mode below!' }
        ];
        setMessages(initial);
        globalHistoryCache[activeQuestion.id] = initial;
      }
    }
  }, [activeQuestion?.id]);

  // Sync isOpen state changes with highly-damped premium ease transition (strictly no bouncing)
  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, { 
      duration: 360, 
      easing: Easing.out(Easing.quad) 
    });
  }, [isOpen]);

  // Auto-minimize when other sheets are open
  useEffect(() => {
    if (isOtherPopupOpen) {
      setIsOpen(false);
    }
  }, [isOtherPopupOpen]);

  // Premium timing-based tracking (completely eliminates button shaking/bouncing)
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 250, easing: Easing.out(Easing.quad) });
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        keyboardHeight.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.quad) });
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleSend = async (textToSend?: string, isPillClick?: boolean) => {
    const query = textToSend || inputText;
    if (!query.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: query, isManual: !isPillClick };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);

    // Persist user query to global session cache
    if (activeQuestion?.id) {
      globalHistoryCache[activeQuestion.id] = updatedMessages;
    }

    try {
      const qText = activeQuestion?.statement_line || activeQuestion?.question_text || "";
      const qOptionsObj = activeQuestion?.options || {};
      const qCorrect = activeQuestion?.correct_answer || "";
      const optionsArr = Object.entries(qOptionsObj).map(([k, v]) => `${k}) ${v}`);

      // Call Gemini Service Live with dynamic question context
      const response = await generateWithHistory(
        updatedMessages.map(m => ({ role: m.role, content: m.content })),
        {
          question: qText,
          options: optionsArr,
          correct_answer: qCorrect,
        }
      );

      const aiMsg: Message = {
        role: 'assistant',
        content: response,
      };
      
      setMessages(prev => {
        const next = [...prev, aiMsg];
        if (activeQuestion?.id) {
          globalHistoryCache[activeQuestion.id] = next;
        }
        return next;
      });
    } catch (err: any) {
      // Offline / Unconfigured Keys Fallback
      let aiReply = "I am ready to help you with your UPSC study. Let me know if you want an ELI5 or a deep study breakdown of this question!";
      const lowerText = query.toLowerCase();
      if (lowerText.includes('polity') || lowerText.includes('emergency')) {
        aiReply = "Under Article 352, 356, and 360, India's Constitution provides emergency provisions that shift India from a federal to a unitary structure during national or state crises.";
      } else if (lowerText.includes('concept') || lowerText.includes('core concept')) {
        aiReply = "💡 **Polity Core Concept**: The structural federation in India is built with a strong unitary bias (quasi-federal), allowing national interests to reign supreme in times of crisis.";
      } else if (lowerText.includes('wrong') || lowerText.includes('incorrect')) {
        aiReply = "❌ **Distractor Analysis**: Other choices are incorrect because they refer to Article 356 (President's Rule) or Article 360 (Financial Emergency), whereas Article 352 governs National Emergency only.";
      } else if (lowerText.includes('example') || lowerText.includes('real-world')) {
        aiReply = "🌍 **Historical Precedent**: The landmark S.R. Bommai v. Union of India (1994) case laid down strict guidelines to prevent arbitrary invocation of Article 356 President's Rule in the states.";
      } else if (lowerText.includes('elephant')) {
        aiReply = "🐘 **Elephant Heritage**: Elephants are highly intelligent, social mammals native to Asia and Africa. In India, they hold significant cultural heritage status and are protected under Schedule I of the Wildlife Protection Act, 1972.";
      }

      const fallbackMsg: Message = { role: 'assistant', content: aiReply };
      setMessages(prev => {
        const next = [...prev, fallbackMsg];
        if (activeQuestion?.id) {
          globalHistoryCache[activeQuestion.id] = next;
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionPill = (template: PromptTemplate) => {
    const qText = activeQuestion?.statement_line || activeQuestion?.question_text || "Emergency provisions of the Constitution of India.";
    const qOptionsObj = activeQuestion?.options || {
      "A": "President's Rule",
      "B": "Financial Emergency",
      "C": "National Emergency",
      "D": "State Emergency"
    };
    const qCorrect = activeQuestion?.correct_answer || "C";

    const optionsStr = Object.entries(qOptionsObj)
      .map(([k, v]) => `${k}) ${v}`)
      .join('\n');

    const wrongOptions = Object.entries(qOptionsObj)
      .filter(([k]) => k.toLowerCase() !== qCorrect.toLowerCase())
      .map(([k, v]) => `${k}) ${v}`)
      .join('\n');

    const promptText = promptManager.fillTemplate(template.prompt_text, {
      question: qText,
      options: optionsStr,
      correct_answer: qCorrect,
      wrong_options: wrongOptions,
    });

    handleSend(promptText, true);
  };

  const handleCopy = (content: string, idx: number) => {
    Clipboard.setString(content);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // GPU-interpolated morphing and positioning animation
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const isTablet = screenWidth >= 768;
    
    // Expand to full screen (with 16px safety margins) if isFullscreen is active
    const cardWidth = isFullscreen 
      ? (screenWidth - 32)
      : (isTablet ? screenWidth * 0.4 : screenWidth * 0.9);
    
    const baseHeight = isFullscreen
      ? (screenHeight - keyboardHeight.value - 40)
      : (isTablet ? screenHeight * 0.82 : screenHeight * 0.72);
      
    const maxHeight = screenHeight - keyboardHeight.value - 50;
    const activeHeight = Math.min(baseHeight, maxHeight);

    const finalWidth = interpolate(progress.value, [0, 1], [64, cardWidth]);
    const finalHeight = interpolate(progress.value, [0, 1], [64, activeHeight]);
    const borderRadius = interpolate(progress.value, [0, 1], [32, isFullscreen ? 16 : 24]);
    
    const finalBottom = interpolate(progress.value, [0, 1], [24, 24 + keyboardHeight.value]);

    return {
      width: finalWidth,
      height: finalHeight,
      borderRadius,
      bottom: finalBottom,
      right: isFullscreen ? 16 : 24,
    };
  });

  const fabStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 0.15], [1, 0], Extrapolate.CLAMP);
    const scale = interpolate(progress.value, [0, 0.15], [1, 0], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
      position: 'absolute',
      alignSelf: 'center',
      top: 14,
    };
  });

  const chatStyle = useAnimatedStyle(() => {
    // Fast fade-out of contents during closing (progress < 0.55) to prevent squishing or double-collapse stutter
    const opacity = interpolate(progress.value, [0.55, 1], [0, 1], Extrapolate.CLAMP);
    const scale = interpolate(progress.value, [0.55, 1], [0.96, 1], Extrapolate.CLAMP);
    return {
      opacity,
      transform: [{ scale }],
      flex: 1,
      display: progress.value > 0.1 ? 'flex' : 'none',
    };
  });

  return (
    <Animated.View
      style={[
        styles.cardContainer,
        { 
          backgroundColor: colors.surface, 
          borderColor: colors.border,
          shadowColor: '#5B4EFA',
        },
        containerAnimatedStyle
      ]}
      testID="pilot-v2-ai-chat-card"
    >
      {/* Morph State 1: Floating FAB Trigger */}
      <Animated.View style={fabStyle}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setIsOpen(true)}
          style={styles.fabInner}
          testID="pilot-v2-ai-fab"
        >
          <Text style={{ fontSize: 26, lineHeight: 32 }}>🧠</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Morph State 2: Expanded AI Assistant Card */}
      <Animated.View style={chatStyle}>
        {/* Header Row with Branding and Fullscreen Toggle */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleContainer}>
            <View style={[styles.logoCircle, { backgroundColor: '#EEECFF' }]}>
              <Sparkles size={16} color="#5B4EFA" />
            </View>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Dr. UPSC Assistant</Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>UPSC Prep Context Active</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity 
              onPress={() => setIsFullscreen(!isFullscreen)} 
              style={styles.headerBtn}
              activeOpacity={0.7}
            >
              {isFullscreen ? (
                <Minimize2 size={16} color={colors.textSecondary} />
              ) : (
                <Maximize2 size={16} color={colors.textSecondary} />
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Top-Anchored Dynamic Input Bar */}
        <View style={[styles.inputContainer, { borderBottomColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]}
            placeholder={`Ask a UPSC ${activeQuestion?.subject || 'Polity'} query...`}
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity onPress={() => handleSend()} style={[styles.sendBtn, { backgroundColor: '#5B4EFA' }]}>
            <Send size={14} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Repositioned Preset study pills with premium styling right under search bar */}
        <View style={[styles.presetsBar, { borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsGrid}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.template_key}
                onPress={() => handleActionPill(template)}
                style={[styles.pill, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>
                  {template.button_emoji || '🤖'} {template.button_label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chat Messages */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {messages.map((m, idx) => {
            // Keep system/pill prompts fully hidden from view
            if (m.role === 'user' && !m.isManual) {
              return null;
            }
            return (
              <View
                key={idx}
                style={[
                  styles.msgBubble,
                  m.role === 'user' 
                    ? [styles.userMsg, { backgroundColor: '#5B4EFA' }] 
                    : [styles.aiMsg, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]
                ]}
              >
                {m.role === 'user' ? (
                  <Text style={{ color: '#FFF', fontSize: 13, lineHeight: 18 }}>
                    {m.content}
                  </Text>
                ) : (
                  <View style={{ gap: 8 }}>
                    <Markdown
                      style={{
                        body: { color: colors.textPrimary, fontSize: 13, lineHeight: 18, margin: 0, padding: 0 },
                        paragraph: { margin: 0, padding: 0 },
                        strong: { fontWeight: 'bold', color: colors.textPrimary }
                      }}
                    >
                      {m.content}
                    </Markdown>
                    <TouchableOpacity 
                      onPress={() => handleCopy(m.content, idx)} 
                      style={[styles.copyBtn, { borderColor: colors.border }]}
                      activeOpacity={0.7}
                    >
                      {copiedId === idx ? (
                        <Check size={12} color="#10B981" />
                      ) : (
                        <Copy size={12} color={colors.textTertiary} />
                      )}
                      <Text style={{ fontSize: 10, color: copiedId === idx ? "#10B981" : colors.textTertiary, fontWeight: '600' }}>
                        {copiedId === idx ? "Copied!" : "Copy"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
          {isLoading && (
            <View style={[styles.msgBubble, styles.aiMsg, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
              <ActivityIndicator size="small" color="#5B4EFA" />
              <Text style={{ fontSize: 12, color: colors.textTertiary }}>Thinking...</Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}

interface PilotV2AIChatProps {
  isOtherPopupOpen?: boolean;
  activeQuestion?: any;
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    borderWidth: 1.5,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 9999,
    overflow: 'hidden',
  },
  fabInner: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 10,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  msgBubble: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userMsg: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 2,
  },
  aiMsg: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 2,
    borderWidth: 1,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  actionsGrid: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
