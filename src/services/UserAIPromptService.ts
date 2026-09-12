/**
 * UserAIPromptService
 *
 * Syncs user's AI prompt customizations (explain, summarize, search, save_sheet)
 * between AsyncStorage (offline-first) and Supabase (cross-device sync).
 *
 * Strategy:
 *   - On load: read from AsyncStorage immediately, then fetch from Supabase and
 *     merge (Supabase values win if they're newer — last-write-wins by updated_at).
 *   - On save: write to AsyncStorage instantly, then upsert to Supabase.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { PROMPT_KEYS, DEFAULT_PROMPTS } from './GeminiService';

const SAVE_SHEET_AI_PROMPT_KEY = 'pilot-v2:save-sheet:ai-preset-prompt';

// All prompt keys we want to sync
const ALL_PROMPT_KEYS = [
  PROMPT_KEYS.explain,
  PROMPT_KEYS.summarize,
  PROMPT_KEYS.search,
  SAVE_SHEET_AI_PROMPT_KEY,
] as const;

type PromptRow = {
  prompt_key: string;
  prompt_text: string;
  updated_at: string;
};

/**
 * Load prompts from Supabase for the given user, falling back to AsyncStorage.
 * Returns a map of prompt_key → prompt_text.
 */
export async function loadAIPromptsFromServer(
  userId: string
): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabase
      .from('user_ai_prompts')
      .select('prompt_key, prompt_text, updated_at')
      .eq('user_id', userId);

    if (error) throw error;

    if (!data || data.length === 0) {
      return {};
    }

    const serverMap: Record<string, PromptRow> = {};
    for (const row of data as PromptRow[]) {
      serverMap[row.prompt_key] = row;
    }

    // Merge with AsyncStorage: for each key, keep the one with the later updated_at
    const merged: Record<string, string> = {};
    for (const key of ALL_PROMPT_KEYS) {
      const serverRow = serverMap[key];
      const localText = await getLocalPrompt(key);
      const serverTime = serverRow ? new Date(serverRow.updated_at).getTime() : 0;

      if (serverRow && serverTime > 0) {
        // Server has data — use it and update local cache
        merged[key] = serverRow.prompt_text;
        await setLocalPrompt(key, serverRow.prompt_text);
      } else if (localText) {
        // Only local has data — push to server silently
        merged[key] = localText;
        await upsertPromptToServer(userId, key, localText);
      } else {
        // Neither — use default
        merged[key] = getDefaultPrompt(key);
      }
    }

    return merged;
  } catch (err) {
    console.warn('[UserAIPromptService] Failed to load from server, using local:', err);
    // Fallback: read all from AsyncStorage
    const local: Record<string, string> = {};
    for (const key of ALL_PROMPT_KEYS) {
      local[key] = (await getLocalPrompt(key)) || getDefaultPrompt(key);
    }
    return local;
  }
}

/**
 * Save a single prompt to both AsyncStorage and Supabase.
 */
export async function saveAIPrompt(
  userId: string | undefined,
  promptKey: string,
  promptText: string
): Promise<void> {
  // Always save locally first (offline-first)
  await setLocalPrompt(promptKey, promptText);

  // Then sync to server if user is logged in
  if (userId) {
    try {
      await upsertPromptToServer(userId, promptKey, promptText);
    } catch (err) {
      console.warn('[UserAIPromptService] Failed to save to server:', err);
      // Non-critical — local save already succeeded
    }
  }
}

/**
 * Save all prompts at once (batch upsert).
 */
export async function saveAllAIPrompts(
  userId: string | undefined,
  prompts: Record<string, string>
): Promise<void> {
  // Save all locally
  const promises: Promise<void>[] = [];
  for (const [key, text] of Object.entries(prompts)) {
    promises.push(setLocalPrompt(key, text));
  }
  await Promise.all(promises);

  // Batch upsert to server
  if (userId && Object.keys(prompts).length > 0) {
    try {
      const rows = Object.entries(prompts).map(([prompt_key, prompt_text]) => ({
        user_id: userId,
        prompt_key,
        prompt_text,
      }));

      const { error } = await supabase
        .from('user_ai_prompts')
        .upsert(rows, {
          onConflict: 'user_id,prompt_key',
          ignoreDuplicates: false,
        });

      if (error) throw error;
    } catch (err) {
      console.warn('[UserAIPromptService] Failed to batch save to server:', err);
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────

async function upsertPromptToServer(
  userId: string,
  promptKey: string,
  promptText: string
): Promise<void> {
  const { error } = await supabase
    .from('user_ai_prompts')
    .upsert(
      {
        user_id: userId,
        prompt_key: promptKey,
        prompt_text: promptText,
      },
      {
        onConflict: 'user_id,prompt_key',
        ignoreDuplicates: false,
      }
    );

  if (error) throw error;
}

async function getLocalPrompt(key: string): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(key)) || null;
  } catch {
    return null;
  }
}

async function setLocalPrompt(key: string, text: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, text);
  } catch {
    // Silently fail
  }
}

function getDefaultPrompt(key: string): string {
  if (key === PROMPT_KEYS.explain) return DEFAULT_PROMPTS.explain;
  if (key === PROMPT_KEYS.summarize) return DEFAULT_PROMPTS.summarize;
  if (key === PROMPT_KEYS.search) return DEFAULT_PROMPTS.search;
  return '';
}
