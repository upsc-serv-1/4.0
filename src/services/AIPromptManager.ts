/**
 * AIPromptManager — manages dynamic AI prompt templates, conversation history,
 * and vitamin versions. Uses Supabase for persistence and AsyncStorage for
 * offline caching.
 *
 * Phase 1 of the AI Enhancement strategy.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

export type PromptCategory = 'quiz' | 'notes' | 'tags' | 'analysis' | 'syllabus';

export type PromptTemplate = {
  id?: string;
  template_name: string;
  template_key: string;
  button_label: string;
  button_emoji?: string;
  prompt_text: string;
  category: PromptCategory;
  is_active: boolean;
  display_order: number;
};

export type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
  template_used?: string;
  timestamp?: number;
};

export type VitaminVersion = {
  id?: string;
  question_id: string;
  explanation_content: string;
  template_used?: string;
  prompt_template_name?: string;
  rating?: number;
  tags?: string[];
  is_primary?: boolean;
  created_at?: string;
};

// ──────────────────────────────────────────────────────────
// DEFAULT PROMPT TEMPLATES (used when user has no custom ones)
// ──────────────────────────────────────────────────────────

export const DEFAULT_QUIZ_TEMPLATES: PromptTemplate[] = [
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
    display_order: 0,
  },
  {
    template_name: "ELI5 - Explain Like I'm 5",
    template_key: 'eli5',
    button_label: 'ELI5',
    button_emoji: '👶',
    prompt_text: `Explain this concept as if talking to a 5-year-old. Use simple words, analogies, and real-world examples.

QUESTION: {{question}}
CORRECT ANSWER: {{correct_answer}}

Make it super simple and fun!`,
    category: 'quiz',
    is_active: true,
    display_order: 1,
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
3. Why this concept matters for UPSC
4. Connection to other topics`,
    category: 'quiz',
    is_active: true,
    display_order: 2,
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
    display_order: 3,
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
1. Recent news (2023-2025)
2. Real-world scenarios
3. Practical applications
4. Historical examples`,
    category: 'quiz',
    is_active: true,
    display_order: 4,
  },
];

export const DEFAULT_NOTES_TEMPLATES: PromptTemplate[] = [
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
    display_order: 0,
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
    display_order: 1,
  },
  {
    template_name: 'Create Flashcards',
    template_key: 'flashcards',
    button_label: 'Flashcards',
    button_emoji: '🃏',
    prompt_text: `Create 5 concise flashcards from this note for spaced repetition.

NOTE CONTENT:
{{note_content}}

Format each as:
FRONT: [Key term or question]
BACK: [Definition or answer]`,
    category: 'notes',
    is_active: true,
    display_order: 2,
  },
];

export const DEFAULT_TAGS_TEMPLATES: PromptTemplate[] = [
  {
    template_name: 'Explain Concept',
    template_key: 'explain_concept',
    button_label: 'Explain',
    button_emoji: '💡',
    prompt_text: `Provide a comprehensive explanation of: {{tag_name}}

Include:
1. Definition
2. Historical context
3. Current relevance for UPSC
4. Related concepts and links`,
    category: 'tags',
    is_active: true,
    display_order: 0,
  },
  {
    template_name: 'Mind Map',
    template_key: 'mind_map',
    button_label: 'Mind Map',
    button_emoji: '🗺️',
    prompt_text: `Create a text-based mind map of connections for: {{tag_name}}

Show:
- Central concept
- 3-5 main branches
- Sub-topics under each branch
- Key relationships`,
    category: 'tags',
    is_active: true,
    display_order: 1,
  },
];

export const DEFAULT_ANALYSIS_TEMPLATES: PromptTemplate[] = [
  {
    template_name: 'Performance Insight',
    template_key: 'performance',
    button_label: 'Insight',
    button_emoji: '📊',
    prompt_text: `Analyze this performance data and give actionable advice.

WEAK AREAS: {{weak_topics}}
ACCURACY: {{accuracy}}%
TOTAL QUESTIONS: {{total_count}}

Provide:
1. Root cause of weakness
2. 3 specific study strategies
3. Priority topics to focus on
4. Estimated improvement timeline`,
    category: 'analysis',
    is_active: true,
    display_order: 0,
  },
];

export const DEFAULT_SYLLABUS_TEMPLATES: PromptTemplate[] = [
  {
    template_name: 'Study Plan',
    template_key: 'study_plan',
    button_label: 'Study Plan',
    button_emoji: '📅',
    prompt_text: `Create a personalized study plan for: {{syllabus_topic}}

CURRENT PROGRESS: {{progress}}%

Include:
1. Daily breakdown (7-day plan)
2. Time allocation per subtopic
3. Resources recommended
4. Revision checkpoints`,
    category: 'syllabus',
    is_active: true,
    display_order: 0,
  },
];

const ALL_DEFAULTS: Record<string, PromptTemplate[]> = {
  quiz: DEFAULT_QUIZ_TEMPLATES,
  notes: DEFAULT_NOTES_TEMPLATES,
  tags: DEFAULT_TAGS_TEMPLATES,
  analysis: DEFAULT_ANALYSIS_TEMPLATES,
  syllabus: DEFAULT_SYLLABUS_TEMPLATES,
};

// ──────────────────────────────────────────────────────────
// AI PROMPT MANAGER CLASS
// ──────────────────────────────────────────────────────────

export class AIPromptManager {
  private static instance: AIPromptManager;

  static getInstance(): AIPromptManager {
    if (!AIPromptManager.instance) {
      AIPromptManager.instance = new AIPromptManager();
    }
    return AIPromptManager.instance;
  }

  // ── PROMPT TEMPLATE MANAGEMENT ──

  async fetchPromptTemplates(
    userId: string,
    category: string
  ): Promise<PromptTemplate[]> {
    const cacheKey = `prompts_${userId}_${category}`;
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    try {
      const { data, error } = await supabase
        .from('prompt_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('category', category)
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;

      const customTemplates = data || [];
      const defaultTemplates = ALL_DEFAULTS[category] || [];

      // Merge defaults with custom templates. Custom templates with matching keys override defaults.
      const merged: PromptTemplate[] = [...defaultTemplates];

      customTemplates.forEach(custom => {
        const existingIdx = merged.findIndex(d => d.template_key === custom.template_key);
        if (existingIdx > -1) {
          // Override the default template with the user's custom one
          merged[existingIdx] = custom;
        } else {
          // Append new custom templates
          merged.push(custom);
        }
      });

      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(merged));
      } catch {}
      return merged;
    } catch {
      return ALL_DEFAULTS[category] || [];
    }
  }

  async createPromptTemplate(
    userId: string,
    template: PromptTemplate
  ): Promise<PromptTemplate | null> {
    try {
      const { data, error } = await supabase
        .from('prompt_templates')
        .insert({ user_id: userId, ...template })
        .select()
        .single();

      if (error) throw error;
      await this.invalidateCategoryCache(userId, template.category);
      return data;
    } catch (err) {
      console.error('Failed to create prompt template:', err);
      return null;
    }
  }

  async updatePromptTemplate(
    userId: string,
    templateId: string,
    updates: Partial<PromptTemplate>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('prompt_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', templateId)
        .eq('user_id', userId);

      if (error) throw error;
      // Invalidate all category caches
      for (const cat of Object.keys(ALL_DEFAULTS)) {
        await this.invalidateCategoryCache(userId, cat as PromptCategory);
      }
      return true;
    } catch {
      return false;
    }
  }

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
      await this.invalidateCategoryCache(userId, category as PromptCategory);
      return true;
    } catch {
      return false;
    }
  }

  async deleteCustomTemplatesForCategory(
    userId: string,
    category: string
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('prompt_templates')
        .delete()
        .eq('user_id', userId)
        .eq('category', category);

      if (error) throw error;
      await this.invalidateCategoryCache(userId, category as PromptCategory);
      return true;
    } catch {
      return false;
    }
  }

  private async invalidateCategoryCache(userId: string, category: string) {
    try {
      await AsyncStorage.removeItem(`prompts_${userId}_${category}`);
    } catch {}
  }

  // ── CONVERSATION HISTORY ──

  async getConversationHistory(
    userId: string,
    questionId: string,
    limit = 20
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
        timestamp: new Date(msg.created_at).getTime(),
      }));
    } catch {
      return [];
    }
  }

  async saveMessage(
    userId: string,
    questionId: string,
    message: ConversationMessage
  ): Promise<boolean> {
    try {
      const { error } = await supabase.from('conversation_history').insert({
        user_id: userId,
        question_id: questionId,
        message_role: message.role,
        message_content: message.content,
        template_used: message.template_used || null,
      });
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }

  async clearConversation(userId: string, questionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversation_history')
        .delete()
        .eq('user_id', userId)
        .eq('question_id', questionId);
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }

  // ── VITAMIN VERSIONS ──

  async getVitaminVersions(
    userId: string,
    questionId: string
  ): Promise<VitaminVersion[]> {
    try {
      const { data, error } = await supabase
        .from('vitamin_versions')
        .select('*')
        .eq('user_id', userId)
        .eq('question_id', questionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  }

  async saveVitaminVersion(
    userId: string,
    vitamin: VitaminVersion
  ): Promise<VitaminVersion | null> {
    try {
      const { data, error } = await supabase
        .from('vitamin_versions')
        .insert({ user_id: userId, ...vitamin })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  }

  async updateVitaminRating(
    userId: string,
    vitaminId: string,
    rating: number
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('vitamin_versions')
        .update({ rating })
        .eq('id', vitaminId)
        .eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }

  async deleteVitaminVersion(userId: string, vitaminId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('vitamin_versions')
        .delete()
        .eq('id', vitaminId)
        .eq('user_id', userId);
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  }

  // ── UTILITY: Fill prompt placeholders ──

  fillTemplate(promptText: string, vars: Record<string, string>): string {
    let filled = promptText;
    for (const [key, value] of Object.entries(vars)) {
      filled = filled.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return filled;
  }
}
