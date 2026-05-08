/**
 * questionStateUtils.ts — Central utility for checking if a question_state
 * row is "empty" (all user-generated fields are null/empty/default) and
 * should therefore be deleted from Supabase.
 */
import { supabase } from '../lib/supabase';

/**
 * Fields that carry user-specific data. If ALL of these are null, empty,
 * or set to their default value, the row is considered "empty" and should
 * be deleted to keep the database clean.
 */
const USER_STATE_FIELDS: Array<{
  key: string;
  isEmpty: (v: any) => boolean;
}> = [
  { key: 'selected_answer',         isEmpty: (v) => !v || v === '' },
  { key: 'confidence_level',        isEmpty: (v) => v == null || v === '' || v === 0 },
  { key: 'highlighted_text',        isEmpty: (v) => !v || v === '' || v === '[]' || (Array.isArray(v) && v.length === 0) },
  { key: 'saved_folder',            isEmpty: (v) => !v || v === '' },
  { key: 'review_tags',             isEmpty: (v) => !v || (Array.isArray(v) && v.length === 0) || v === '[]' || v === 'null' },
  { key: 'question_type',           isEmpty: (v) => !v || v === '' },
  { key: 'review_difficulty',       isEmpty: (v) => !v || v === '' },
  { key: 'attempt_history',         isEmpty: (v) => !v || (Array.isArray(v) && v.length === 0) || v === '[]' },
  { key: 'spaced_revision',         isEmpty: (v) => !v || v === '' || v === '{}' || (typeof v === 'object' && Object.keys(v).length === 0) },
  { key: 'attempt_difficulty_level', isEmpty: (v) => !v || v === '' },
  { key: 'error_category',          isEmpty: (v) => !v || v === '' },
  { key: 'notes',                   isEmpty: (v) => !v || v === '' },
  { key: 'bookmarks',               isEmpty: (v) => !v || v === false || v === 0 },
  { key: 'is_bookmarked',           isEmpty: (v) => !v || v === false || v === 0 },
  { key: 'revision_metadata',       isEmpty: (v) => !v || v === '{}' || (typeof v === 'object' && Object.keys(v).length === 0) },
  { key: 'user_note',               isEmpty: (v) => !v || v === '' },
  { key: 'flagged',                 isEmpty: (v) => !v || v === false || v === 0 },
  { key: 'custom_tags',             isEmpty: (v) => !v || (Array.isArray(v) && v.length === 0) || v === '[]' },
];

/**
 * Returns true if every user-generated field in the given state object
 * is null/empty/default, meaning the row should be deleted.
 */
export function isQuestionStateEmpty(state: Record<string, any>): boolean {
  return USER_STATE_FIELDS.every(({ key, isEmpty }) => isEmpty(state[key]));
}

/**
 * After updating a question_state row, call this to auto-delete
 * the row if all user-generated fields are now empty.
 *
 * @param userId - current user ID
 * @param questionId - the question_id of the state row
 * @param currentState - (optional) the current state object to check.
 *        If not provided, will fetch from Supabase.
 * @returns true if the row was deleted, false otherwise
 */
export async function autoCleanupQuestionState(
  userId: string,
  questionId: string,
  currentState?: Record<string, any> | null
): Promise<boolean> {
  if (!userId || !questionId) return false;

  let state = currentState;

  if (!state) {
    const { data, error } = await supabase
      .from('question_states')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId)
      .maybeSingle();
    if (error || !data) return false;
    state = data;
  }

  if (isQuestionStateEmpty(state)) {
    const { error } = await supabase
      .from('question_states')
      .delete()
      .eq('user_id', userId)
      .eq('question_id', questionId);
    if (error) {
      console.warn('[autoCleanup] Failed to delete empty question_state:', error.message);
      return false;
    }
    return true;
  }

  return false;
}

/**
 * Batch cleanup: find all question_states for a user that are "empty"
 * and delete them. Useful for periodic maintenance.
 */
export async function batchCleanupEmptyStates(userId: string): Promise<number> {
  if (!userId) return 0;

  const { data: rows, error } = await supabase
    .from('question_states')
    .select('*')
    .eq('user_id', userId);

  if (error || !rows) return 0;

  const emptyIds = rows
    .filter((row) => isQuestionStateEmpty(row))
    .map((row) => row.id);

  if (emptyIds.length === 0) return 0;

  // Delete in batches of 100
  let deleted = 0;
  for (let i = 0; i < emptyIds.length; i += 100) {
    const batch = emptyIds.slice(i, i + 100);
    const { error: delErr } = await supabase
      .from('question_states')
      .delete()
      .in('id', batch);
    if (!delErr) deleted += batch.length;
  }

  return deleted;
}
