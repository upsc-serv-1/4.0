/**
 * isQuestionStateEmpty — Issue #1
 * --------------------------------
 * Returns true when every user-generated field of a question state row is
 * null / empty / default. Used by the sync layer to auto-delete the row
 * from Supabase instead of keeping a useless empty record.
 *
 * The fields below are the user-state fields the audit list (Issue Set 1)
 * specified must be checked.
 */

const FIELDS_TO_CHECK = [
  'selected_answer',
  'confidence',
  'confidence_level',
  'highlight_text',
  'highlighted_text',
  'saved_folder',
  'review_tags',
  'user_tags',
  'question_type',
  'review_difficulty',
  'difficulty_level',
  'attempt_history',
  'spaced_revision',
  'attempt_difficulty_level',
  'error_category',
  'note',
  'notes',
  'personal_note',
  'bookmarks',
  'marked_must_revise',
  'is_incorrect_last_attempt',
  'time_spent_seconds',
] as const;

const isEmptyValue = (v: any): boolean => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  if (typeof v === 'object' && Object.keys(v).length === 0) return true;
  if (typeof v === 'number' && v === 0) return true;       // time_spent_seconds=0
  if (typeof v === 'boolean' && v === false) return true;  // marked_must_revise=false
  return false;
};

/** Returns true when every meaningful user-state field is empty/default. */
export function isQuestionStateEmpty(state: Record<string, any>): boolean {
  if (!state || typeof state !== 'object') return true;
  for (const k of FIELDS_TO_CHECK) {
    if (!isEmptyValue(state[k])) return false;
  }
  return true;
}
