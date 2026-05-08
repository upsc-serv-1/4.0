# 🤖 EMERGENT AI SYSTEM - Complete Implementation Instructions
## For Claude AI to Execute All Phases Automatically

---

## 📋 MISSION OVERVIEW

Build a **complete multi-tab AI system** for quiz app with:
- ✅ Multi-turn AI chat in quiz explanations
- ✅ Dynamic prompt templates (editable anytime, no app republish)
- ✅ Custom button names + prompts
- ✅ AI in all tabs (Notes, Tags, Analysis, Syllabus)
- ✅ Vitamin multi-versioning
- ✅ AI Settings hub to manage all prompts/templates
- ✅ Persistent storage (Supabase + AsyncStorage)
- ✅ All buttons functional & tested

---

## 🎯 PHASE 1: Dynamic Prompt Management System

### 1.1 Create Prompt Template Database Schema

**Supabase Migration:**
```sql
-- Create prompt_templates table
CREATE TABLE prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name VARCHAR(100) NOT NULL,
  template_key VARCHAR(100) NOT NULL UNIQUE,
  button_label VARCHAR(50) NOT NULL DEFAULT template_name,
  button_emoji VARCHAR(10),
  prompt_text TEXT NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'quiz', 'notes', 'tags', 'analysis', 'syllabus'
  is_active BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, template_key)
);

-- Create conversation_history table
CREATE TABLE conversation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id VARCHAR(100) NOT NULL,
  message_role VARCHAR(20) NOT NULL, -- 'user' | 'assistant'
  message_content TEXT NOT NULL,
  template_used VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create vitamin_versions table (replacing single vitamin storage)
CREATE TABLE vitamin_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id VARCHAR(100) NOT NULL,
  explanation_content TEXT NOT NULL,
  template_used VARCHAR(100),
  prompt_template_name VARCHAR(100),
  rating INT DEFAULT 0, -- 0-5 stars
  tags TEXT[], -- JSON array: ['easy', 'concept', 'tricky']
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, question_id, id)
);

-- Create ai_settings table
CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_provider VARCHAR(50) DEFAULT 'gemini', -- 'gemini' | 'groq' | 'openrouter'
  gemini_model VARCHAR(100) DEFAULT 'gemini-2.0-flash',
  groq_model VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
  openrouter_model VARCHAR(100) DEFAULT 'openrouter/free',
  gemini_api_key VARCHAR(500) ENCRYPTED,
  groq_api_key VARCHAR(500) ENCRYPTED,
  openrouter_api_key VARCHAR(500) ENCRYPTED,
  enable_conversation_history BOOLEAN DEFAULT true,
  max_history_messages INT DEFAULT 10,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create indexes
CREATE INDEX idx_prompt_templates_user ON prompt_templates(user_id);
CREATE INDEX idx_conversation_history_user_question ON conversation_history(user_id, question_id);
CREATE INDEX idx_vitamin_versions_user_question ON vitamin_versions(user_id, question_id);
CREATE INDEX idx_ai_settings_user ON ai_settings(user_id);
```

---

## 🛠️ PHASE 2: Enhanced GeminiService

### 2.1 File: `src/services/AIPromptManager.ts` (NEW)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type PromptTemplate = {
  id?: string;
  template_name: string;
  template_key: string;
  button_label: string;
  button_emoji?: string;
  prompt_text: string;
  category: 'quiz' | 'notes' | 'tags' | 'analysis' | 'syllabus';
  is_active: boolean;
  display_order: number;
};

export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  template_used?: string;
  timestamp?: number;
};

export class AIPromptManager {
  private static instance: AIPromptManager;
  private cachedTemplates: PromptTemplate[] = [];

  static getInstance(): AIPromptManager {
    if (!AIPromptManager.instance) {
      AIPromptManager.instance = new AIPromptManager();
    }
    return AIPromptManager.instance;
  }

  // ===== PROMPT TEMPLATE MANAGEMENT =====

  /**
   * Fetch all active prompts for a category from Supabase
   */
  async fetchPromptTemplates(
    userId: string,
    category: string
  ): Promise<PromptTemplate[]> {
    try {
      // Try cache first
      const cached = await AsyncStorage.getItem(
        `prompts_${userId}_${category}`
      );
      if (cached) {
        this.cachedTemplates = JSON.parse(cached);
        return this.cachedTemplates;
      }

      // Fetch from Supabase
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      const templates = data || [];
      
      // Cache locally
      await AsyncStorage.setItem(
        `prompts_${userId}_${category}`,
        JSON.stringify(templates)
      );

      this.cachedTemplates = templates;
      return templates;
    } catch (error) {
      console.error('Failed to fetch prompt templates:', error);
      return this.getDefaultTemplates(category);
    }
  }

  /**
   * Create new prompt template
   */
  async createPromptTemplate(
    userId: string,
    template: PromptTemplate
  ): Promise<PromptTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('prompt_templates')
        .insert({
          user_id: userId,
          ...template
        })
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      await AsyncStorage.removeItem(
        `prompts_${userId}_${template.category}`
      );

      return data;
    } catch (error) {
      console.error('Failed to create prompt template:', error);
      return null;
    }
  }

  /**
   * Update existing prompt template
   */
  async updatePromptTemplate(
    userId: string,
    templateId: string,
    updates: Partial<PromptTemplate>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('prompt_templates')
        .update(updates)
        .eq('id', templateId)
        .eq('user_id', userId);

      if (error) throw error;

      // Invalidate all category caches for this user
      const categories = ['quiz', 'notes', 'tags', 'analysis', 'syllabus'];
      for (const cat of categories) {
        await AsyncStorage.removeItem(`prompts_${userId}_${cat}`);
      }

      return true;
    } catch (error) {
      console.error('Failed to update prompt template:', error);
      return false;
    }
  }

  /**
   * Delete prompt template
   */
  async deletePromptTemplate(
    userId: string,
    templateId: string,
    category: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('prompt_templates')
        .delete()
        .eq('id', templateId)
        .eq('user_id', userId);

      if (error) throw error;

      // Invalidate cache
      await AsyncStorage.removeItem(`prompts_${userId}_${category}`);

      return true;
    } catch (error) {
      console.error('Failed to delete prompt template:', error);
      return false;
    }
  }

  /**
   * Get default templates for category
   */
  private getDefaultTemplates(category: string): PromptTemplate[] {
    const defaults: Record<string, PromptTemplate[]> = {
      quiz: [
        {
          template_name: 'Standard Explanation',
          template_key: 'standard',
          button_label: 'Standard',
          button_emoji: '📚',
          prompt_text: `You are an expert UPSC coach. Explain this question completely.

QUESTION:
{{question}}

OPTIONS:
{{options}}

CORRECT ANSWER: {{correct_answer}}

Write a complete study note with:
1. Why the correct answer is right
2. Detailed explanation of each option
3. Key facts and concepts`,
          category: 'quiz',
          is_active: true,
          display_order: 0
        },
        {
          template_name: 'ELI5 - Explain Like I\'m 5',
          template_key: 'eli5',
          button_label: 'ELI5',
          button_emoji: '👶',
          prompt_text: `Explain this concept as if talking to a 5-year-old. Use simple words, analogies, and real-world examples.

QUESTION: {{question}}
CORRECT ANSWER: {{correct_answer}}

Make it super simple and fun!`,
          category: 'quiz',
          is_active: true,
          display_order: 1
        },
        {
          template_name: 'Conceptual Deep Dive',
          template_key: 'conceptual',
          button_label: 'Concept',
          button_emoji: '🧠',
          prompt_text: `Provide a deep conceptual explanation of the core idea behind this question.

QUESTION: {{question}}
CORRECT ANSWER: {{correct_answer}}

Focus on:
1. Core concept definition
2. Historical/theoretical background
3. Why this concept matters
4. Connection to other topics`,
          category: 'quiz',
          is_active: true,
          display_order: 2
        },
        {
          template_name: 'Why is This Wrong?',
          template_key: 'why_wrong',
          button_label: 'Why Wrong?',
          button_emoji: '❌',
          prompt_text: `Explain why the WRONG options are incorrect and what misconceptions they test.

QUESTION: {{question}}
CORRECT ANSWER: {{correct_answer}}
WRONG OPTIONS: {{wrong_options}}

For each wrong option, explain:
1. What's wrong about it
2. What misconception does it test
3. How to avoid this mistake`,
          category: 'quiz',
          is_active: true,
          display_order: 3
        },
        {
          template_name: 'Real World Example',
          template_key: 'real_world',
          button_label: 'Example',
          button_emoji: '🌍',
          prompt_text: `Provide real-world examples, current events, or recent news related to this concept.

QUESTION: {{question}}
CORRECT ANSWER: {{correct_answer}}

Connect to:
1. Recent news (2023-2024)
2. Real-world scenarios
3. Practical applications
4. Historical examples`,
          category: 'quiz',
          is_active: true,
          display_order: 4
        }
      ],
      notes: [
        {
          template_name: 'Summarize',
          template_key: 'summarize',
          button_label: 'Summarize',
          button_emoji: '📝',
          prompt_text: `Summarize this note into 5-7 key bullet points.

NOTE CONTENT:
{{note_content}}

Keep it concise but complete.`,
          category: 'notes',
          is_active: true,
          display_order: 0
        },
        {
          template_name: 'Generate Questions',
          template_key: 'gen_questions',
          button_label: 'Questions',
          button_emoji: '❓',
          prompt_text: `Generate 5 potential UPSC exam questions based on this note.

NOTE CONTENT:
{{note_content}}

Format as:
1. Question text
   A) Option A
   B) Option B
   C) Option C
   D) Option D
   Answer: X`,
          category: 'notes',
          is_active: true,
          display_order: 1
        }
      ],
      tags: [
        {
          template_name: 'Explain Concept',
          template_key: 'explain_concept',
          button_label: 'Explain',
          button_emoji: '💡',
          prompt_text: `Provide a comprehensive explanation of: {{tag_name}}

Include:
1. Definition
2. Historical context
3. Current relevance
4. Related concepts`,
          category: 'tags',
          is_active: true,
          display_order: 0
        }
      ],
      analysis: [
        {
          template_name: 'Performance Insight',
          template_key: 'performance',
          button_label: 'Insight',
          button_emoji: '📊',
          prompt_text: `Analyze why user is weak in {{topic}} and suggest improvements.

WEAK AREAS: {{weak_topics}}
CORRECT ANSWERS: {{correct_count}}
TOTAL: {{total_count}}`,
          category: 'analysis',
          is_active: true,
          display_order: 0
        }
      ],
      syllabus: [
        {
          template_name: 'Study Plan',
          template_key: 'study_plan',
          button_label: 'Plan',
          button_emoji: '📅',
          prompt_text: `Create a personalized {{days}}-day study plan for {{syllabus_topic}}.

CURRENT PROGRESS: {{progress}}

Include:
1. Daily topics
2. Time allocation
3. Resources recommended
4. Revision schedule`,
          category: 'syllabus',
          is_active: true,
          display_order: 0
        }
      ]
    };

    return defaults[category] || [];
  }

  // ===== CONVERSATION HISTORY =====

  /**
   * Fetch conversation history for a question
   */
  async getConversationHistory(
    userId: string,
    questionId: string,
    limit: number = 20
  ): Promise<ConversationMessage[]> {
    try {
      const { data, error } = await supabase
        .from('conversation_history')
        .select('message_role, message_content, template_used, created_at')
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(msg => ({
        role: msg.message_role as 'user' | 'assistant',
        content: msg.message_content,
        template_used: msg.template_used,
        timestamp: new Date(msg.created_at).getTime()
      }));
    } catch (error) {
      console.error('Failed to fetch conversation history:', error);
      return [];
    }
  }

  /**
   * Save message to conversation history
   */
  async saveMessage(
    userId: string,
    questionId: string,
    message: ConversationMessage
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversation_history')
        .insert({
          user_id: userId,
          question_id: questionId,
          message_role: message.role,
          message_content: message.content,
          template_used: message.template_used || null
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to save message:', error);
      return false;
    }
  }

  /**
   * Clear conversation history for a question
   */
  async clearConversation(
    userId: string,
    questionId: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversation_history')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', questionId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      return false;
    }
  }
}
```

---

### 2.2 File: Update `src/services/GeminiService.ts`

Add conversation support:

```typescript
// ADD THIS TO EXISTING GeminiService.ts

/**
 * Generate AI response with conversation history
 */
export async function generateWithHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  questionContext?: {
    question: string;
    options: string[];
    correct_answer: string;
    institute_explanations?: string;
  }
): Promise<string> {
  const provider = await AsyncStorage.getItem(AI_PROVIDER_KEY) || 'gemini';
  const model = await getSelectedModel(provider);
  const apiKey = await getSelectedApiKey(provider);

  if (!apiKey) throw new Error('No API key configured');

  const systemPrompt = `You are an expert UPSC coach helping a student understand exam questions.
${questionContext ? `
QUESTION: ${questionContext.question}
OPTIONS: ${questionContext.options.join(', ')}
CORRECT ANSWER: ${questionContext.correct_answer}
` : ''}
Be concise, accurate, and helpful.`;

  try {
    if (provider === 'gemini') {
      return await generateGeminiWithHistory(
        model,
        apiKey,
        messages,
        systemPrompt
      );
    } else if (provider === 'groq') {
      return await generateGroqWithHistory(
        model,
        apiKey,
        messages,
        systemPrompt
      );
    } else if (provider === 'openrouter') {
      return await generateOpenRouterWithHistory(
        model,
        apiKey,
        messages,
        systemPrompt
      );
    }

    throw new Error(`Unknown provider: ${provider}`);
  } catch (error) {
    console.error('Error generating with history:', error);
    throw error;
  }
}

/**
 * Gemini with conversation history
 */
async function generateGeminiWithHistory(
  model: string,
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        }))
      })
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || '';
}

/**
 * Groq with conversation history
 */
async function generateGroqWithHistory(
  model: string,
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Groq API error');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * OpenRouter with conversation history
 */
async function generateOpenRouterWithHistory(
  model: string,
  apiKey: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  systemPrompt: string
): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenRouter API error');
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}
```

---

## 🎨 PHASE 3: UI Components

### 3.1 File: `src/components/unified/AIExplanationChat.tsx` (NEW)

```typescript
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Send, Star, Trash2, Copy, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { spacing, radius } from '../../theme';
import { AIPromptManager, PromptTemplate, ConversationMessage } from '../../services/AIPromptManager';
import { generateWithHistory } from '../../services/GeminiService';

interface AIExplanationChatProps {
  questionId: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  instituteExplanations?: string;
  initialExplanation?: string;
  onVitaminSave?: (content: string, templateUsed: string, rating: number) => void;
}

export const AIExplanationChat: React.FC<AIExplanationChatProps> = ({
  questionId,
  questionText,
  options,
  correctAnswer,
  instituteExplanations,
  initialExplanation,
  onVitaminSave
}) => {
  const { colors } = useTheme();
  const { session } = useAuth();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>('standard');
  const [vitaminRating, setVitaminRating] = useState(0);
  const [showVitaminPanel, setShowVitaminPanel] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);
  const promptManager = AIPromptManager.getInstance();

  useEffect(() => {
    loadTemplates();
    loadConversationHistory();
  }, [questionId]);

  const loadTemplates = async () => {
    if (!session?.user?.id) return;
    const temps = await promptManager.fetchPromptTemplates(
      session.user.id,
      'quiz'
    );
    setTemplates(temps);
  };

  const loadConversationHistory = async () => {
    if (!session?.user?.id) return;
    const history = await promptManager.getConversationHistory(
      session.user.id,
      questionId
    );
    if (history.length === 0 && initialExplanation) {
      setMessages([
        {
          role: 'assistant',
          content: initialExplanation,
          template_used: 'standard'
        }
      ]);
    } else {
      setMessages(history);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !session?.user?.id) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: inputText
    };

    setMessages(prev => [...prev, userMessage]);
    await promptManager.saveMessage(session.user.id, questionId, userMessage);
    setInputText('');

    setLoading(true);
    try {
      const response = await generateWithHistory(
        messages.map(m => ({ role: m.role, content: m.content })),
        {
          question: questionText,
          options,
          correct_answer: correctAnswer,
          institute_explanations: instituteExplanations
        }
      );

      const aiMessage: ConversationMessage = {
        role: 'assistant',
        content: response
      };

      setMessages(prev => [...prev, aiMessage]);
      await promptManager.saveMessage(session.user.id, questionId, aiMessage);
    } catch (error) {
      console.error('Failed to get AI response:', error);
      alert('Failed to get response. Check your API key in settings.');
    } finally {
      setLoading(false);
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleTemplateButton = async (template: PromptTemplate) => {
    if (!session?.user?.id) return;

    setSelectedTemplateKey(template.template_key);
    setLoading(true);

    try {
      const promptText = template.prompt_text
        .replace('{{question}}', questionText)
        .replace('{{options}}', options.join('\n'))
        .replace('{{correct_answer}}', correctAnswer)
        .replace('{{wrong_options}}', options
          .filter((_, i) => i !== options.indexOf(correctAnswer))
          .join('\n'));

      const response = await generateWithHistory(
        [...messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: promptText }],
        { question: questionText, options, correct_answer: correctAnswer }
      );

      const aiMessage: ConversationMessage = {
        role: 'assistant',
        content: response,
        template_used: template.template_key
      };

      setMessages(prev => [...prev, aiMessage]);
      await promptManager.saveMessage(session.user.id, questionId, aiMessage);
    } catch (error) {
      console.error('Template button error:', error);
      alert('Failed to generate response');
    } finally {
      setLoading(false);
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSaveVitamin = () => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && onVitaminSave) {
      onVitaminSave(lastMessage.content, selectedTemplateKey, vitaminRating);
      setShowVitaminPanel(false);
      alert('✅ Saved to My Vitamins!');
    }
  };

  const handleCopyMessage = (text: string) => {
    // Implementation for copy to clipboard
    alert('Copied to clipboard');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.bg }]}
    >
      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: true })
        }
      >
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.messageRow,
              msg.role === 'user' ? styles.userMessageRow : styles.aiMessageRow
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                msg.role === 'user'
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.secondaryBg }
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  {
                    color:
                      msg.role === 'user' ? colors.primaryText : colors.textPrimary
                  }
                ]}
              >
                {msg.content}
              </Text>

              {msg.role === 'assistant' && (
                <View style={styles.messageActions}>
                  <TouchableOpacity onPress={() => handleCopyMessage(msg.content)}>
                    <Copy size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowVitaminPanel(true)}>
                    <Star size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ))}

        {loading && (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginLeft: spacing.md }}>
              AI is thinking...
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Quick Template Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.templateScroll}
        contentContainerStyle={styles.templateContent}
      >
        {templates.map(template => (
          <TouchableOpacity
            key={template.template_key}
            style={[
              styles.templateButton,
              {
                backgroundColor:
                  selectedTemplateKey === template.template_key
                    ? colors.primary
                    : colors.secondaryBg,
                borderColor: colors.border
              }
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
                      ? colors.primaryText
                      : colors.textPrimary
                }
              ]}
            >
              {template.button_emoji} {template.button_label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input Area */}
      <View style={[styles.inputArea, { borderTopColor: colors.border }]}>
        <TextInput
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.secondaryBg,
              borderColor: colors.border
            }
          ]}
          placeholder="Ask anything about this question..."
          placeholderTextColor={colors.textSecondary}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={500}
          editable={!loading}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: colors.primary, opacity: loading ? 0.5 : 1 }
          ]}
          onPress={handleSendMessage}
          disabled={loading || !inputText.trim()}
        >
          <Send size={20} color={colors.primaryText} />
        </TouchableOpacity>
      </View>

      {/* Vitamin Rating Panel */}
      {showVitaminPanel && (
        <View style={[styles.vitaminPanel, { backgroundColor: colors.secondaryBg }]}>
          <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>
            Save to My Vitamins
          </Text>
          <View style={styles.ratingStars}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => setVitaminRating(star)}
              >
                <Star
                  size={24}
                  color={star <= vitaminRating ? '#FFD700' : colors.border}
                  fill={star <= vitaminRating ? '#FFD700' : 'none'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.panelButtons}>
            <TouchableOpacity
              style={[
                styles.panelButton,
                { backgroundColor: colors.primary }
              ]}
              onPress={handleSaveVitamin}
            >
              <Text style={{ color: colors.primaryText, fontWeight: '600' }}>
                Save
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.panelButton,
                { backgroundColor: colors.border }
              ]}
              onPress={() => setShowVitaminPanel(false)}
            >
              <Text style={{ color: colors.textPrimary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  messagesContainer: {
    flex: 1
  },
  messagesContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  messageRow: {
    marginVertical: spacing.sm,
    flexDirection: 'row'
  },
  userMessageRow: {
    justifyContent: 'flex-end'
  },
  aiMessageRow: {
    justifyContent: 'flex-start'
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    marginVertical: spacing.xs
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20
  },
  messageActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md
  },
  templateScroll: {
    maxHeight: 60,
    borderTopWidth: 1
  },
  templateContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm
  },
  templateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginRight: spacing.sm
  },
  templateButtonText: {
    fontSize: 12,
    fontWeight: '600'
  },
  inputArea: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'flex-end'
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    maxHeight: 100
  },
  sendButton: {
    padding: spacing.sm,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center'
  },
  vitaminPanel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl
  },
  ratingStars: {
    flexDirection: 'row',
    gap: spacing.md,
    marginVertical: spacing.md,
    justifyContent: 'center'
  },
  panelButtons: {
    flexDirection: 'row',
    gap: spacing.md
  },
  panelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center'
  }
});
```

---

## 🔧 PHASE 4: AI Settings Screen

### 4.1 File: `app/ai-settings.tsx` (ENHANCE EXISTING)

```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Plus, Edit2, Trash2, Save } from 'lucide-react-native';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import { spacing, radius } from '../src/theme';
import { AIPromptManager, PromptTemplate } from '../src/services/AIPromptManager';
import { PageWrapper } from '../src/components/PageWrapper';

export default function AISettingsScreen() {
  const { colors } = useTheme();
  const { session } = useAuth();

  const [activeTab, setActiveTab] = useState<'prompts' | 'settings'>('prompts');
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('quiz');
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);

  const [formData, setFormData] = useState({
    template_name: '',
    button_label: '',
    button_emoji: '',
    prompt_text: ''
  });

  const promptManager = AIPromptManager.getInstance();

  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  const loadTemplates = async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      const temps = await promptManager.fetchPromptTemplates(
        session.user.id,
        selectedCategory
      );
      setTemplates(temps);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!session?.user?.id || !formData.template_name || !formData.prompt_text) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setLoading(true);
    try {
      const newTemplate: PromptTemplate = {
        template_name: formData.template_name,
        template_key: formData.template_name.toLowerCase().replace(/\s+/g, '_'),
        button_label: formData.button_label || formData.template_name,
        button_emoji: formData.button_emoji,
        prompt_text: formData.prompt_text,
        category: selectedCategory as any,
        is_active: true,
        display_order: templates.length
      };

      const result = await promptManager.createPromptTemplate(
        session.user.id,
        newTemplate
      );

      if (result) {
        Alert.alert('Success', 'Template created!');
        setFormData({ template_name: '', button_label: '', button_emoji: '', prompt_text: '' });
        setShowNewTemplateForm(false);
        loadTemplates();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!session?.user?.id || !editingTemplate?.id) return;

    setLoading(true);
    try {
      const success = await promptManager.updatePromptTemplate(
        session.user.id,
        editingTemplate.id,
        {
          template_name: formData.template_name,
          button_label: formData.button_label,
          button_emoji: formData.button_emoji,
          prompt_text: formData.prompt_text
        }
      );

      if (success) {
        Alert.alert('Success', 'Template updated!');
        setEditingTemplate(null);
        setFormData({ template_name: '', button_label: '', button_emoji: '', prompt_text: '' });
        loadTemplates();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!session?.user?.id) return;

    Alert.alert('Delete', 'Are you sure?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Delete',
        onPress: async () => {
          setLoading(true);
          try {
            const success = await promptManager.deletePromptTemplate(
              session.user.id!,
              templateId,
              selectedCategory
            );
            if (success) {
              loadTemplates();
              Alert.alert('Deleted', 'Template removed');
            }
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const handleEditTemplate = (template: PromptTemplate) => {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      button_label: template.button_label,
      button_emoji: template.button_emoji || '',
      prompt_text: template.prompt_text
    });
    setShowNewTemplateForm(true);
  };

  return (
    <PageWrapper style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          AI Settings
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'prompts' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('prompts')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'prompts' ? colors.primary : colors.textSecondary }
            ]}
          >
            Prompts
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === 'settings' && { borderBottomColor: colors.primary }
          ]}
          onPress={() => setActiveTab('settings')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'settings' ? colors.primary : colors.textSecondary }
            ]}
          >
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'prompts' && (
        <ScrollView style={styles.content}>
          {/* Category Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {['quiz', 'notes', 'tags', 'analysis', 'syllabus'].map(cat => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryBadge,
                  {
                    backgroundColor:
                      selectedCategory === cat ? colors.primary : colors.secondaryBg,
                    borderColor: colors.border
                  }
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    {
                      color:
                        selectedCategory === cat
                          ? colors.primaryText
                          : colors.textPrimary
                    }
                  ]}
                >
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Templates List */}
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            <View style={styles.templatesList}>
              {templates.map(template => (
                <View
                  key={template.template_key}
                  style={[styles.templateCard, { backgroundColor: colors.secondaryBg }]}
                >
                  <View>
                    <Text style={[styles.templateName, { color: colors.textPrimary }]}>
                      {template.button_emoji} {template.button_label}
                    </Text>
                    <Text
                      style={[styles.promptPreview, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {template.prompt_text}
                    </Text>
                  </View>
                  <View style={styles.templateActions}>
                    <TouchableOpacity onPress={() => handleEditTemplate(template)}>
                      <Edit2 size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteTemplate(template.id!)}
                    >
                      <Trash2 size={18} color={colors.danger || '#FF6B6B'} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Add New Button */}
          {!showNewTemplateForm && (
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                setEditingTemplate(null);
                setFormData({ template_name: '', button_label: '', button_emoji: '', prompt_text: '' });
                setShowNewTemplateForm(true);
              }}
            >
              <Plus size={20} color={colors.primaryText} />
              <Text style={[styles.addButtonText, { color: colors.primaryText }]}>
                Add Template
              </Text>
            </TouchableOpacity>
          )}

          {/* Form */}
          {showNewTemplateForm && (
            <View style={[styles.formContainer, { backgroundColor: colors.secondaryBg }]}>
              <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
                {editingTemplate ? 'Edit Template' : 'New Template'}
              </Text>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Template Name
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.bg,
                      borderColor: colors.border
                    }
                  ]}
                  placeholder="e.g., Explain Like I'm 5"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.template_name}
                  onChangeText={text =>
                    setFormData({ ...formData, template_name: text })
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Button Label
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.bg,
                      borderColor: colors.border
                    }
                  ]}
                  placeholder="Button text (e.g., ELI5)"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.button_label}
                  onChangeText={text =>
                    setFormData({ ...formData, button_label: text })
                  }
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Button Emoji
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.bg,
                      borderColor: colors.border
                    }
                  ]}
                  placeholder="e.g., 👶"
                  placeholderTextColor={colors.textSecondary}
                  value={formData.button_emoji}
                  onChangeText={text =>
                    setFormData({ ...formData, button_emoji: text })
                  }
                  maxLength={2}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.label, { color: colors.textPrimary }]}>
                  Prompt Template
                </Text>
                <Text
                  style={[
                    styles.hintText,
                    { color: colors.textSecondary }
                  ]}
                >
                  Use {{{{question}}}}, {{{{options}}}}, {{{{correct_answer}}}} as placeholders
                </Text>
                <TextInput
                  style={[
                    styles.largeInput,
                    {
                      color: colors.textPrimary,
                      backgroundColor: colors.bg,
                      borderColor: colors.border
                    }
                  ]}
                  placeholder="Enter your prompt here..."
                  placeholderTextColor={colors.textSecondary}
                  value={formData.prompt_text}
                  onChangeText={text =>
                    setFormData({ ...formData, prompt_text: text })
                  }
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.formButton, { backgroundColor: colors.primary }]}
                  onPress={
                    editingTemplate ? handleUpdateTemplate : handleCreateTemplate
                  }
                  disabled={loading}
                >
                  <Save size={18} color={colors.primaryText} />
                  <Text style={[styles.formButtonText, { color: colors.primaryText }]}>
                    {loading
                      ? 'Saving...'
                      : editingTemplate
                      ? 'Update'
                      : 'Create'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.formButton,
                    { backgroundColor: colors.border }
                  ]}
                  onPress={() => {
                    setShowNewTemplateForm(false);
                    setEditingTemplate(null);
                    setFormData({
                      template_name: '',
                      button_label: '',
                      button_emoji: '',
                      prompt_text: ''
                    });
                  }}
                >
                  <Text style={[styles.formButtonText, { color: colors.textPrimary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'settings' && (
        <View style={styles.content}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            API Configuration
          </Text>
          <Text style={[styles.sectionText, { color: colors.textSecondary }]}>
            Configure your AI provider and API keys in the main settings.
          </Text>
        </View>
      )}
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800'
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent'
  },
  tabText: {
    fontWeight: '600',
    fontSize: 14
  },
  content: {
    flex: 1,
    padding: spacing.lg
  },
  categoryScroll: {
    marginBottom: spacing.lg,
    marginHorizontal: -spacing.lg
    paddingHorizontal: spacing.lg
  },
  categoryBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginRight: spacing.md
  },
  categoryText: {
    fontWeight: '600',
    fontSize: 12
  },
  templatesList: {
    gap: spacing.md
  },
  templateCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  templateName: {
    fontWeight: '600',
    fontSize: 14
  },
  promptPreview: {
    fontSize: 12,
    marginTop: spacing.xs
  },
  templateActions: {
    flexDirection: 'row',
    gap: spacing.md
  },
  addButton: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg
  },
  addButtonText: {
    fontWeight: '600',
    marginLeft: spacing.md
  },
  formContainer: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.lg
  },
  formGroup: {
    marginBottom: spacing.lg
  },
  label: {
    fontWeight: '600',
    fontSize: 12,
    marginBottom: spacing.sm
  },
  hintText: {
    fontSize: 11,
    fontStyle: 'italic',
    marginBottom: spacing.sm
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1
  },
  largeInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1
  },
  formButtons: {
    flexDirection: 'row',
    gap: spacing.md
  },
  formButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center'
  },
  formButtonText: {
    fontWeight: '600',
    marginLeft: spacing.sm
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.md
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20
  }
});
```

---

## 📱 PHASE 5: Integration Into All Tabs

### 5.1 Quiz Tab - Add to `src/components/unified/ReviewSection.tsx`

Add this after showing explanation:

```typescript
// Inside ReviewSection component, add:

import { AIExplanationChat } from './AIExplanationChat';

// In the JSX where explanation is shown:
<AIExplanationChat
  questionId={question.id}
  questionText={question.question_text}
  options={question.options}
  correctAnswer={question.correct_answer}
  instituteExplanations={question.institute_explanations}
  initialExplanation={question.explanation_markdown}
  onVitaminSave={async (content, templateUsed, rating) => {
    // Save to vitamin_versions table
    await supabase.from('vitamin_versions').insert({
      user_id: session.user.id,
      question_id: question.id,
      explanation_content: content,
      template_used: templateUsed,
      rating: rating,
      is_primary: true
    });
  }}
/>
```

---

### 5.2 Notes Tab - AI Integration

Add to `app/notes/index.tsx`:

```typescript
// New AI actions for notes:
<TouchableOpacity
  onPress={async () => {
    const response = await generateWithHistory(
      [{ role: 'user', content: `Summarize this note:\n${noteContent}` }]
    );
    setSummary(response);
  }}
  style={styles.aiButton}
>
  <Text>📝 Summarize</Text>
</TouchableOpacity>

<TouchableOpacity
  onPress={async () => {
    const response = await generateWithHistory(
      [{ role: 'user', content: `Generate 5 exam questions from:\n${noteContent}` }]
    );
    setQuestions(response);
  }}
  style={styles.aiButton}
>
  <Text>❓ Generate Questions</Text>
</TouchableOpacity>
```

---

### 5.3 Tags Tab - Concept Explanation

Add to `app/tags.tsx`:

```typescript
// New AI for tags:
<TouchableOpacity
  onPress={async () => {
    const response = await generateWithHistory(
      [{ role: 'user', content: `Explain this concept: ${tagName}` }]
    );
    setExplanation(response);
  }}
  style={styles.aiButton}
>
  <Text>💡 Explain Concept</Text>
</TouchableOpacity>
```

---

## ✅ CHECKLIST FOR CLAUDE

When implementing, ensure:

- [ ] All database tables created in Supabase
- [ ] AIPromptManager.ts has all methods working
- [ ] GeminiService.ts extended with conversation support
- [ ] AIExplanationChat component fully functional with chat
- [ ] All template buttons working without errors
- [ ] AI Settings screen allows creating/editing/deleting prompts
- [ ] Changes saved to Supabase AND AsyncStorage for offline
- [ ] No "dead" buttons - all click handlers functional
- [ ] Conversation history persists per question
- [ ] Vitamin save feature stores to database
- [ ] Multi-variant vitamins work (multiple versions per question)
- [ ] Template placeholders ({{question}}, {{options}}) replaced correctly
- [ ] No API errors - proper error handling
- [ ] UI responsive on all screen sizes
- [ ] Loading states show while AI is generating
- [ ] Copy to clipboard works for messages
- [ ] Star rating system for vitamins works

---

## 🚀 DEPLOYMENT CHECKLIST

Before publishing:
1. Run all Supabase migrations
2. Test all AI providers (Gemini, Groq, OpenRouter)
3. Test offline functionality (AsyncStorage caching)
4. Test conversation history persistence
5. Test vitamin saving across app restarts
6. Test template editing and usage
7. Verify no console errors
8. Check bundle size doesn't exceed limits

---

## 💡 NOTES FOR CLAUDE

- **Token Efficiency**: All prompt templates stored in database, fetched once at app start
- **No App Republishing**: Users can modify all prompts in-app settings
- **Dynamic Buttons**: Button names, emojis, and prompts fully customizable
- **Offline Support**: AsyncStorage caches templates locally
- **Scalable**: Can add more template categories easily
- **User Privacy**: All data stored per user in Supabase with RLS enabled

---

**This is ready for execution! Claude will now implement all phases with full functionality.**

