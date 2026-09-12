/**
 * BestAnswerService — "My Vitamin"
 * ─────────────────────────────────────────────────────────────────────────
 * Stores per-question best AI answers that the user has saved or edited.
 * Each row is keyed by (user_id, question_id) and is private to the user
 * via Supabase RLS.
 *
 *   ────────────────────────────────────────────────────────────────────
 *   ⚠️  RUN THIS SQL ONCE IN THE SUPABASE SQL EDITOR BEFORE USING THIS
 *       SERVICE. The app will throw a clear error otherwise.
 *   ────────────────────────────────────────────────────────────────────
 *
 *   CREATE TABLE IF NOT EXISTS user_best_answers (
 *     id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *     user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *     question_id TEXT NOT NULL,
 *     answer_text TEXT NOT NULL,
 *     key_points  TEXT,
 *     custom_prompt TEXT,
 *     created_at  TIMESTAMPTZ DEFAULT NOW(),
 *     updated_at  TIMESTAMPTZ DEFAULT NOW(),
 *     UNIQUE(user_id, question_id)
 *   );
 *
 *   ALTER TABLE user_best_answers ENABLE ROW LEVEL SECURITY;
 *
 *   CREATE POLICY "Users manage own best answers" ON user_best_answers
 *     FOR ALL
 *     USING      (auth.uid() = user_id)
 *     WITH CHECK (auth.uid() = user_id);
 *
 *   CREATE INDEX IF NOT EXISTS user_best_answers_user_idx
 *     ON user_best_answers(user_id);
 *   CREATE INDEX IF NOT EXISTS user_best_answers_question_idx
 *     ON user_best_answers(user_id, question_id);
 */

import { supabase } from '../lib/supabase';

export type BestAnswer = {
  id?: string;
  user_id?: string;
  question_id: string;
  answer_text: string;
  key_points: string | null;
  custom_prompt: string | null;
  created_at?: string;
  updated_at?: string;
};

const TABLE = 'user_best_answers';

const getUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
};

/**
 * Returns the saved best answer for a question, or null if none.
 * Returns null on any unexpected error so the calling UI degrades gracefully.
 */

export async function fetchBestAnswer(questionId: string): Promise<BestAnswer | null> {
  if (!questionId) return null;
  const userId = await getUserId();
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, question_id, answer_text, key_points, custom_prompt, created_at, updated_at')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle();
    if (error) return null;
    const result = (data as BestAnswer) || null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Upsert a best answer for the current user + question.
 * Pass keyPoints/customPrompt as null (not undefined) to clear them.
 */
export async function saveBestAnswer(
  questionId: string,
  answerText: string,
  keyPoints: string | null = null,
  customPrompt: string | null = null,
): Promise<BestAnswer | null> {
  if (!questionId || !answerText) return null;
  const userId = await getUserId();
  if (!userId) throw new Error('Not signed in.');

  const payload = {
    user_id:       userId,
    question_id:   questionId,
    answer_text:   answerText,
    key_points:    keyPoints,
    custom_prompt: customPrompt,
    updated_at:    new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'user_id,question_id' })
    .select('id, question_id, answer_text, key_points, custom_prompt, created_at, updated_at')
    .maybeSingle();

  if (error) {
    if ((error as any)?.code === '42P01' || /relation .* does not exist/i.test(error.message || '')) {
      throw new Error(
        'user_best_answers table not found. Open Supabase SQL editor and run the CREATE TABLE block at the top of BestAnswerService.ts.',
      );
    }
    throw error;
  }
  return (data as BestAnswer) || null;
}

export async function deleteBestAnswer(questionId: string): Promise<boolean> {
  if (!questionId) return false;
  const userId = await getUserId();
  if (!userId) return false;
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq('user_id', userId)
    .eq('question_id', questionId);
  return !error;
}

export const BestAnswerService = {
  fetchBestAnswer,
  saveBestAnswer,
  deleteBestAnswer,
};

export default BestAnswerService;
