import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Inline parser for flashcard responses  
// Handles multiple format variations with fallback patterns
function parseFlashcardResponse(response: string): { front: string; back: string } | null {
  if (!response || typeof response !== 'string') {
    return null;
  }

  const trimmed = response.trim();

  // Pattern 1: Standard format with "front - ... - back - ..." (with optional trailing delimiter)
  const pattern1 = /front\s*[-–—]\s*([\s\S]*?)\s*[-–—]\s*back\s*[-–—]\s*([\s\S]*?)(?:\s*[-–—]\s*)?$/i;
  const match1 = trimmed.match(pattern1);
  if (match1) {
    const front = match1[1].trim();
    const back = match1[2].trim();
    // Validate that we got reasonable content (not just separators)
    if (front.length > 5 && back.length > 5) {
      return { front, back };
    }
  }

  // Pattern 2: "FRONT: ... BACK: ..." (all caps)
  const pattern2 = /FRONT:\s*([\s\S]*?)\s*BACK:\s*([\s\S]*?)$/i;
  const match2 = trimmed.match(pattern2);
  if (match2) {
    const front = match2[1].trim();
    const back = match2[2].trim();
    if (front.length > 5 && back.length > 5) {
      return { front, back };
    }
  }

  // Pattern 3: "Front: ... Back: ..." (title case)
  const pattern3 = /Front:\s*([\s\S]*?)\s*Back:\s*([\s\S]*?)$/i;
  const match3 = trimmed.match(pattern3);
  if (match3) {
    const front = match3[1].trim();
    const back = match3[2].trim();
    if (front.length > 5 && back.length > 5) {
      return { front, back };
    }
  }

  // Pattern 4: Look for "- back -" or "- BACK -" delimiter specifically
  const backDelimiterMatch = trimmed.match(/[-–—]\s*back\s*[-–—]/i);
  if (backDelimiterMatch) {
    const parts = trimmed.split(backDelimiterMatch[0]);
    if (parts.length === 2) {
      const front = parts[0].replace(/^front\s*[-–—]/i, '').trim();
      const back = parts[1].replace(/\s*[-–—]\s*$/, '').trim();
      if (front.length > 5 && back.length > 5) {
        return { front, back };
      }
    }
  }

  // Pattern 5: Simple " - " split (basic fallback - only if content looks balanced)
  if (trimmed.includes(' - ')) {
    const parts = trimmed.split(' - ');
    if (parts.length >= 2) {
      const front = parts[0].replace(/^front\s*[-–—]?\s*/i, '').trim();
      const back = parts.slice(1).join(' - ').replace(/\s*[-–—]\s*$/, '').trim();
      if (front.length > 5 && back.length > 5) {
        return { front, back };
      }
    }
  }

  // Pattern 6: "\n-" or "\n–" split (multiline format)
  const lines = trimmed.split(/\n[-–—]/);
  if (lines.length >= 2) {
    const front = lines[0].replace(/^front\s*[-–—]?\s*/i, '').trim();
    const back = lines.slice(1).join('\n').trim();
    if (front.length > 5 && back.length > 5) {
      return { front, back };
    }
  }

  return null;
}

export interface FlashcardAIResponse {
  front: string;
  back: string;
}

export interface UseFlashcardAIReturn {
  generateFlashcard: (content: string, customPrompt?: string) => Promise<FlashcardAIResponse | null>;
  loading: boolean;
  error: string | null;
  getAvailableTemplates: () => Promise<string[]>;
}

// Default system prompt for flashcard generation with UPSC optimization
export const FLASHCARD_SYSTEM_PROMPT = `You are an expert UPSC exam flashcard creator.

Your task: Convert the provided content/notes into a high-quality flashcard suitable for spaced repetition learning.

CRITICAL FORMAT REQUIREMENT:
Respond in EXACTLY this format:
front - [question/prompt/cue here] - back - [answer/explanation here] -

Rules:
1. Front side: Create a clear, concise question or cue (15-50 words)
2. Back side: Provide a comprehensive but focused answer (30-150 words)
3. UPSC-specific: Use official terminology, include specific facts (dates, articles, acts, names)
4. Format: Start front content immediately after "front - ", and back content after "back - "
5. Do NOT add any explanation, preamble, or closing text
6. Do NOT use markdown, bold, or italics
7. Ensure the content flows naturally when read

Convert the content below into this exact format.`;

/**
 * Hook for generating flashcards using AI with UPSC optimization
 * Supports both default and custom user-defined prompt templates
 */
export function useFlashcardAI(): UseFlashcardAIReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAvailableTemplates = useCallback(async (): Promise<string[]> => {
    try {
      const { AIPromptManager, DEFAULT_FLASHCARD_TEMPLATES } = await import('../services/AIPromptManager');
      const templates = DEFAULT_FLASHCARD_TEMPLATES.map(t => `${t.button_emoji} ${t.button_label}`);
      return templates;
    } catch {
      return [];
    }
  }, []);

  const generateFlashcard = useCallback(async (content: string, customPrompt?: string): Promise<FlashcardAIResponse | null> => {
    if (!content?.trim()) {
      setError('Content cannot be empty');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Dynamically import GeminiService to avoid circular dependencies
      const { callAI } = await import('../services/GeminiService');

      // Use custom prompt if provided, otherwise use default
      const systemPrompt = customPrompt || FLASHCARD_SYSTEM_PROMPT;

      // Combine system prompt with user content
      const userPrompt = `${systemPrompt}\n\nCONTENT TO CONVERT:\n${content}`;

      // Call AI API (uses user's selected provider: Gemini, Groq, or OpenRouter)
      const response = await callAI(userPrompt, 400);

      // Parse the AI response using multiple fallback patterns
      const parsed = parseFlashcardResponse(response);

      if (!parsed) {
        setError('Failed to parse AI response. Please try again.');
        return null;
      }

      return {
        front: parsed.front,
        back: parsed.back,
      };
    } catch (err: any) {
      const message = err?.message || 'AI generation failed';
      setError(message);
      console.error('[useFlashcardAI] Error:', message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generateFlashcard,
    loading,
    error,
    getAvailableTemplates,
  };
}
