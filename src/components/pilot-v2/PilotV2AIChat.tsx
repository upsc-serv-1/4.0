import React, { useEffect, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  Clipboard,
  BackHandler
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
  Easing
} from 'react-native-reanimated';
import { X, Sparkles, Send, Maximize2, Minimize2, Copy, Check, Square, CheckSquare, Settings2, List, ChevronDown, FileText } from 'lucide-react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIPromptManager, DEFAULT_QUIZ_TEMPLATES, DEFAULT_MAINS_TEMPLATES, PromptTemplate } from '../../services/AIPromptManager';
import { generateWithHistory } from '../../services/GeminiService';
import { runOnJS } from 'react-native-reanimated';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isManual?: boolean;
}

interface PilotV2AIChatProps {
  isOtherPopupOpen?: boolean;
  activeQuestion?: any;
  onSaveResponse?: (res: string) => void;
  externalOpenTrigger?: number | boolean;
  onOpenVitaminEditor?: (text: string) => void;
  isMains?: boolean;
}

// Global session-level cache to guarantee conversation histories are 100% persistent across question swaps
const globalHistoryCache: Record<string, Message[]> = {};

export function PilotV2AIChat({ isOtherPopupOpen, activeQuestion, onSaveResponse, externalOpenTrigger, onOpenVitaminEditor, isMains }: PilotV2AIChatProps) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>(isMains ? DEFAULT_MAINS_TEMPLATES : DEFAULT_QUIZ_TEMPLATES);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { currentNote } = usePilotV2();
  const activeNote = currentNote();
  
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hello! I am Dr. UPSC, your personal tutor. Ask me anything or choose a preset mode above!' }
  ]);

  // Block Context System State
  const [showContextPicker, setShowContextPicker] = useState(false);
  const [selectedBlockIds, setSelectedBlockIds] = useState<string[]>([]);
  const [hasInitializedNoteContext, setHasInitializedNoteContext] = useState(false);

  // Automatically initialize context if switched to a new note without active question
  useEffect(() => {
    if (activeNote && !activeQuestion) {
      const blockCount = activeNote.content?.blocks?.length || 0;
      if (blockCount > 0) {
        // Always refresh context when switching notes
        const allIds = (activeNote.content.blocks || []).map(b => b.id);
        setSelectedBlockIds(allIds);
        setHasInitializedNoteContext(true);
        
        // Generate helpful context message with block count
        const contextMsg = `I'm ready to analyze "${activeNote.title}". I've loaded all ${allIds.length} block${allIds.length !== 1 ? 's' : ''} as context. You can refine the selection using the context picker above, or just ask your question!`;
        setMessages([{ role: 'assistant', content: contextMsg }]);
      }
    } else if (!activeNote) {
      setHasInitializedNoteContext(false);
      setSelectedBlockIds([]);
    }
  }, [activeNote?.id, activeQuestion]);

  // When `true`, tapping a preset combines the user-typed prompt + the preset
  // template using a newline before sending — per user spec.
  const inputTextRef = React.useRef(inputText);
  React.useEffect(() => { inputTextRef.current = inputText; }, [inputText]);

  const progress = useSharedValue(0);
  const keyboardHeight = useSharedValue(0);
  const promptManager = AIPromptManager.getInstance();

  // Load custom templates if available, ensuring 100% uniformity with the Quiz section
  useEffect(() => {
    loadTemplates();
  }, [session?.user?.id, isMains]);

  const loadTemplates = async () => {
    if (!session?.user?.id) return;
    try {
      const category = isMains ? 'mains' : 'quiz';
      const temps = await promptManager.fetchPromptTemplates(session.user.id, category);
      if (temps.length > 0) {
        setTemplates(temps);
      } else {
        setTemplates(isMains ? DEFAULT_MAINS_TEMPLATES : DEFAULT_QUIZ_TEMPLATES);
      }
    } catch { }
  };

  // Sync and load/save messages from globalHistoryCache when activeQuestion changes
  useEffect(() => {
    // Synchronously reset messages to initial state to prevent flash of previous question's content
    const initial: Message[] = [
      { role: 'assistant', content: 'Hello! I am Dr. UPSC, your personal tutor. Ask me anything or choose a preset mode above!' }
    ];
    setMessages(initial);

    if (activeQuestion?.id && session?.user?.id) {
      // Always clear cache entry when switching questions to ensure fresh conversations for each question
      delete globalHistoryCache[activeQuestion.id];
      
      // Try fetching from Supabase first
      promptManager.getConversationHistory(session.user.id, activeQuestion.id)
        .then(history => {
          if (history && history.length > 0) {
            setMessages(history);
            globalHistoryCache[activeQuestion.id] = history;
          } else {
            setMessages(initial);
            globalHistoryCache[activeQuestion.id] = initial;
          }
        })
        .catch(() => {
          setMessages(initial);
          globalHistoryCache[activeQuestion.id] = initial;
        });
    }
  }, [activeQuestion?.id, session?.user?.id]);

  // Sync isOpen state changes with highly-damped premium ease transition (strictly no bouncing)
  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: 360,
      easing: Easing.out(Easing.quad)
    });
  }, [isOpen]);

  // Close chatbot when activeQuestion is falsy
  useEffect(() => {
    if (!activeQuestion) {
      setIsOpen(false);
    }
  }, [activeQuestion]);

  // Hardware back button handler to close/minimize chatbot
  useEffect(() => {
    const handleBackButton = () => {
      if (isOpen) {
        setIsOpen(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => subscription.remove();
  }, [isOpen]);

  // Auto-minimize when other sheets are open
  useEffect(() => {
    if (isOtherPopupOpen) {
      setIsOpen(false);
    }
  }, [isOtherPopupOpen]);

  useEffect(() => {
    if (externalOpenTrigger) {
      setIsOpen(true);
    }
  }, [externalOpenTrigger]);

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
      let response = "";
      if (activeQuestion) {
        const qText = activeQuestion?.statement_line || activeQuestion?.question_text || "";
        const qOptionsObj = activeQuestion?.options || {};
        const qCorrect = activeQuestion?.correct_answer || "";
        const optionsArr = Object.entries(qOptionsObj).map(([k, v]) => `${k}) ${v}`);

        response = await generateWithHistory(
          updatedMessages.map(m => ({ role: m.role, content: m.content })),
          {
            question: qText,
            options: optionsArr,
            correct_answer: qCorrect,
          }
        );
      } else if (activeNote) {
        // Build composite context string from selected blocks only
        const sourceBlocks = activeNote.content?.blocks || [];
        const targetedBlocks = selectedBlockIds.length > 0 
          ? sourceBlocks.filter(b => selectedBlockIds.includes(b.id))
          : sourceBlocks;

        // Sanitize block text to remove HTML and extract plain text
        const sanitizeBlockText = (text: string): string => {
          if (!text) return '';
          // Remove HTML tags
          return text.replace(/<[^>]*>?/gm, '').trim();
        };

        const compositeText = targetedBlocks
          .map(b => {
            const sanitizedText = sanitizeBlockText(b.text);
            if (!sanitizedText) return '';
            const blockHeader = `[Block:${b.type}${b.level ? ` L${b.level}` : ''}]`;
            return `${blockHeader}\n${sanitizedText}`;
          })
          .filter(line => line.trim())
          .join('\n\n');

        if (!compositeText.trim()) {
          // If no valid content, return helpful message
          response = "I notice the selected blocks don't have text content. Please select blocks with text or ensure they're populated.";
        } else {
          response = await generateWithHistory(
            updatedMessages.map(m => ({ role: m.role, content: m.content })),
            {
              noteTitle: activeNote.title,
              noteContent: compositeText,
            }
          );
        }
      } else {
        // Default contextless response
        response = await generateWithHistory(
          updatedMessages.map(m => ({ role: m.role, content: m.content }))
        );
      }

      const aiMsg: Message = {
        role: 'assistant',
        content: response,
      };

      setMessages(prev => {
        const next = [...prev, aiMsg];
        if (activeQuestion?.id) {
          globalHistoryCache[activeQuestion.id] = next;
          if (session?.user?.id) {
            promptManager.saveMessage(session.user.id, activeQuestion.id, userMsg);
            promptManager.saveMessage(session.user.id, activeQuestion.id, aiMsg);
          }
        }
        return next;
      });
    } catch (err: any) {
      // Offline / Unconfigured Keys Fallback
      const errorMsg = err?.message || 'Unknown error';
      console.error('AI Error:', errorMsg);
      
      // Check if it's an API key issue
      if (errorMsg.includes('API key') || errorMsg.includes('API error') || errorMsg.includes('401') || errorMsg.includes('403')) {
        let aiReply = `⚠️ **API Configuration Issue**: ${errorMsg}\n\nGo to Settings → AI Settings to add your API key for Gemini, Groq, or OpenRouter.`;
        const fallbackMsg: Message = { role: 'assistant', content: aiReply };
        setMessages(prev => {
          const next = [...prev, fallbackMsg];
          if (activeQuestion?.id) {
            globalHistoryCache[activeQuestion.id] = next;
          }
          return next;
        });
        return;
      }
      
      // For network errors or other issues, provide generic helpful message
      let aiReply = `I encountered an issue processing your question. This might be a temporary network issue or API configuration problem.\n\nPlease try:\n1. Check your internet connection\n2. Verify your API key in Settings → AI Settings\n3. Try again in a moment`;
      
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

    // Per user spec: when the user has typed a custom command in the input
    // bar AND taps a preset, both run together joined with a newline so the
    // preset acts as additional context on top of the user's instruction.
    const userTyped = (inputTextRef.current || '').trim();
    const finalPrompt = userTyped ? `${userTyped}\n\n${promptText}` : promptText;
    if (userTyped) setInputText('');

    handleSend(finalPrompt, true);
  };

  const handleCopy = (content: string, idx: number) => {
    Clipboard.setString(content);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // --- Draggable FAB Logic & Persistence ---
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const startDragX = useSharedValue(0);
  const startDragY = useSharedValue(0);

  const saveAIFabPos = React.useCallback((x: number, y: number) => {
    AsyncStorage.setItem('pilot_v2_ai_fab_pos', JSON.stringify({ x, y })).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('pilot_v2_ai_fab_pos').then(saved => {
      if (saved) {
        try {
          const p = JSON.parse(saved);
          if (typeof p.x === 'number') dragX.value = p.x;
          if (typeof p.y === 'number') dragY.value = p.y;
        } catch {}
      }
    });
  }, []);

  const panGesture = Gesture.Pan()
    .minDistance(5)
    .onStart(() => {
      startDragX.value = dragX.value;
      startDragY.value = dragY.value;
    })
    .onUpdate((e) => {
      dragX.value = startDragX.value + e.translationX;
      dragY.value = startDragY.value + e.translationY;
    })
    .onFinalize(() => {
      runOnJS(saveAIFabPos)(dragX.value, dragY.value);
    });

  const containerAnimatedStyle = useAnimatedStyle(() => {
    const isTablet = screenWidth >= 768;

    const cardWidth = isFullscreen
      ? (screenWidth - 24)
      : (isTablet ? screenWidth * 0.45 : screenWidth * 0.94);

    const baseHeight = isFullscreen
      ? (screenHeight - 60)
      : (isTablet ? screenHeight * 0.88 : screenHeight * 0.88);

    const finalWidth = interpolate(progress.value, [0, 1], [64, cardWidth]);
    const finalHeight = interpolate(progress.value, [0, 1], [64, baseHeight]);
    const borderRadius = interpolate(progress.value, [0, 1], [32, isFullscreen ? 16 : 20]);

    // Bottom lifts when the keyboard is up to keep the whole card visible.
    const finalBottom = 24;

    const baseTranslateX = dragX.value * (1 - progress.value);
    const baseTranslateY = dragY.value * (1 - progress.value);

    return {
      width: finalWidth,
      height: finalHeight,
      borderRadius,
      bottom: finalBottom,
      right: isFullscreen ? 12 : 12,
      transform: [
        { translateX: baseTranslateX },
        { translateY: baseTranslateY }
      ]
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
        <GestureDetector gesture={panGesture}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setIsOpen(true)}
            style={styles.fabInner}
            testID="pilot-v2-ai-fab"
          >
            <Text style={{ fontSize: 26, lineHeight: 32 }}>🧠</Text>
          </TouchableOpacity>
        </GestureDetector>
      </Animated.View>

      {/* Morph State 2: Expanded AI Assistant Card */}
      <Animated.View style={chatStyle}>
        {/* Header Row */}
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
            <TouchableOpacity onPress={() => setIsFullscreen(!isFullscreen)} style={styles.headerBtn}>
              {isFullscreen ? <Minimize2 size={16} color={colors.textSecondary} /> : <Maximize2 size={16} color={colors.textSecondary} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsOpen(false)} style={styles.closeBtn}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Context Indicator Bar (Visible when in note mode and picker minimized) */}
        {!activeQuestion && activeNote && (
          <TouchableOpacity 
            onPress={() => setShowContextPicker(!showContextPicker)}
            style={{
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              backgroundColor: colors.surfaceStrong, 
              paddingHorizontal: 12, 
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: colors.border
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <FileText size={14} color="#5B4EFA" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textPrimary }}>
                {showContextPicker ? 'Configuring Context...' : `Using ${selectedBlockIds.length} of ${activeNote.content?.blocks?.length || 0} blocks`}
              </Text>
            </View>
            <View style={{ backgroundColor: showContextPicker ? '#5B4EFA' : '#E0E7FF', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontSize: 10, fontWeight: '800', color: showContextPicker ? '#FFF' : '#5B4EFA' }}>
                {showContextPicker ? 'Done' : 'REFINE'}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Input Bar — Moved back to top per user request */}
        <View style={[styles.inputContainer, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]}
            placeholder="Ask a UPSC query..."
            placeholderTextColor={colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
          />
          <TouchableOpacity onPress={() => handleSend()} style={[styles.sendBtn, { backgroundColor: '#5B4EFA' }]}>
            <Send size={14} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Presets Bar — Under the input */}
        <View style={[styles.presetsBar, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionsGrid}>
            {templates.map((template) => (
              <TouchableOpacity
                key={template.template_key}
                onPress={() => handleActionPill(template)}
                style={[styles.pill, { backgroundColor: colors.surfaceStrong, borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ fontSize: 14 }}>{template.button_emoji || '🤖'}</Text>
                <Text style={{ color: colors.textPrimary, fontSize: 10, fontWeight: '700', marginLeft: 4 }} numberOfLines={1}>
                  {template.button_label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Chat Messages */}
        {/* Main Body: Scroll Toggle between Config Picker OR Message List */}
        {showContextPicker && activeNote && !activeQuestion ? (
          <View style={{ flex: 1, backgroundColor: colors.bg }}>
             <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
               <Text style={{ fontWeight: '800', color: colors.textPrimary, fontSize: 15 }}>Select context for AI</Text>
               <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 4 }}>Choose precisely which blocks Dr. UPSC reads to ensure focus.</Text>
               
               <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                 <TouchableOpacity 
                   style={[styles.pill, { backgroundColor: colors.surfaceStrong }]}
                   onPress={() => setSelectedBlockIds(activeNote.content?.blocks?.map(b => b.id) || [])}
                 >
                   <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>Select All</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.pill, { backgroundColor: colors.surfaceStrong }]}
                   onPress={() => setSelectedBlockIds([])}
                 >
                   <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary }}>Clear</Text>
                 </TouchableOpacity>
               </View>
             </View>

             <ScrollView style={styles.scroll}>
               <View style={{ padding: 12 }}>
                 {(activeNote.content?.blocks || []).map((block, idx) => {
                   const isSelected = selectedBlockIds.includes(block.id);
                   
                   // Helper for section selection: Select this block and all trailing blocks until next heading
                   const selectSection = () => {
                     const currentBlocks = activeNote.content?.blocks || [];
                     let newSelection = [...selectedBlockIds];
                     
                     if (isSelected) {
                       // If deselected, just remove this one
                       newSelection = newSelection.filter(id => id !== block.id);
                     } else {
                       // Find matching section range
                       newSelection.push(block.id);
                       if (block.type === 'heading') {
                         for (let i = idx + 1; i < currentBlocks.length; i++) {
                           if (currentBlocks[i].type === 'heading') break;
                           if (!newSelection.includes(currentBlocks[i].id)) {
                             newSelection.push(currentBlocks[i].id);
                           }
                         }
                       }
                     }
                     setSelectedBlockIds([...new Set(newSelection)]);
                   };

                   const toggleSelf = () => {
                     setSelectedBlockIds(prev => 
                       prev.includes(block.id) 
                         ? prev.filter(x => x !== block.id) 
                         : [...prev, block.id]
                     );
                   };

                   return (
                     <TouchableOpacity 
                       key={block.id} 
                       onPress={toggleSelf}
                       style={{
                         flexDirection: 'row',
                         alignItems: 'center',
                         padding: 10,
                         backgroundColor: isSelected ? '#5B4EFA08' : colors.surface,
                         borderBottomWidth: StyleSheet.hairlineWidth,
                         borderBottomColor: colors.border,
                         gap: 10,
                         borderRadius: 8,
                         marginBottom: 4
                       }}
                     >
                       {isSelected ? <CheckSquare size={18} color="#5B4EFA" /> : <Square size={18} color={colors.textTertiary} />}
                       <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 10, fontWeight: '800', color: block.type === 'heading' ? '#5B4EFA' : colors.textTertiary, textTransform: 'uppercase' }}>
                              {block.type}
                            </Text>
                            {block.type === 'heading' && (
                              <TouchableOpacity onPress={selectSection} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }}>(Select section)</Text>
                              </TouchableOpacity>
                            )}
                          </View>
                          <Text numberOfLines={2} style={{ fontSize: 13, color: colors.textPrimary, fontWeight: block.type === 'heading' ? '700' : '400', marginTop: 2 }}>
                            {block.text.replace(/<[^>]*>?/gm, '').trim() || '(Empty or embedded block)'}
                          </Text>
                       </View>
                     </TouchableOpacity>
                   );
                 })}
               </View>
             </ScrollView>
             
             <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
                <TouchableOpacity 
                  style={{ backgroundColor: '#5B4EFA', paddingVertical: 14, borderRadius: 12, alignItems: 'center' }}
                  onPress={() => setShowContextPicker(false)}
                >
                   <Text style={{ color: '#FFF', fontWeight: '800' }}>Apply Context & Return</Text>
                </TouchableOpacity>
             </View>
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            {messages.map((m, idx) => {
              if (m.role === 'user' && !m.isManual) return null;
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
                    <Text style={{ color: '#FFF', fontSize: 13, lineHeight: 18 }}>{m.content}</Text>
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
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          onPress={() => handleCopy(m.content, idx)}
                          style={[styles.copyBtn, { borderColor: colors.border }]}
                        >
                          {copiedId === idx ? <Check size={12} color="#10B981" /> : <Copy size={12} color={colors.textTertiary} />}
                          <Text style={{ fontSize: 10, color: copiedId === idx ? "#10B981" : colors.textTertiary, fontWeight: '600' }}>
                            {copiedId === idx ? "Copied!" : "Copy"}
                          </Text>
                        </TouchableOpacity>
                        {!!onSaveResponse && (
                          <TouchableOpacity
                            onPress={() => onSaveResponse(m.content)}
                            style={[styles.copyBtn, { borderColor: '#5B4EFA55', backgroundColor: '#5B4EFA14' }]}
                          >
                            <Text style={{ fontSize: 10, color: '#5B4EFA', fontWeight: '800' }}>Save to Notes</Text>
                          </TouchableOpacity>
                        )}
                        {!!onOpenVitaminEditor && (
                          <TouchableOpacity
                            onPress={() => onOpenVitaminEditor(m.content)}
                            style={[styles.copyBtn, { borderColor: '#10b98155', backgroundColor: '#10b98114' }]}
                          >
                            <Text style={{ fontSize: 10, color: '#10b981', fontWeight: '800' }}>Open in Vitamin</Text>
                          </TouchableOpacity>
                        )}
                      </View>
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
        )}
      </Animated.View>
    </Animated.View>
  );
}

interface PilotV2AIChatProps {
  isOtherPopupOpen?: boolean;
  activeQuestion?: any;
  onSaveResponse?: (text: string) => void;
  externalOpenTrigger?: number;
  onOpenVitaminEditor?: (text: string) => void;
  isMains?: boolean;
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 130,
  },
});
