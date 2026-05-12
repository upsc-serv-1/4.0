// ==========================================================================
// Renovated Types — covers all Supabase tables + admin-specific UI types
// ==========================================================================

// ── QUESTIONS ──
export interface QuestionFull {
  id: string;
  test_id: string;
  question_number: number | null;
  question_text: string;
  statement_lines: any[];
  question_blocks: any[];
  options: Record<string, string>;
  correct_answer: string | null;
  explanation_markdown: string | null;
  source_attribution_label: string | null;
  source: any;
  subject: string | null;
  section_group: string | null;
  micro_topic: string | null;
  is_pyq: boolean;
  is_ncert: boolean;
  is_upsc_cse: boolean;
  is_allied: boolean;
  is_others: boolean;
  is_cancelled: boolean;
  exam: string | null;
  exam_group: string | null;
  exam_year: number | null;
  exam_category: string | null;
  specific_exam: string | null;
  exam_stage: string | null;
  exam_paper: string | null;
  updated_at: string;
}

// ── TESTS ──
export interface TestFull {
  id: string;
  title: string;
  provider: string | null;
  institute: string | null;
  program_id: string | null;
  program_name: string | null;
  launch_year: number | null;
  series: string | null;
  level: string | null;
  year: number | null;
  subject: string | null;
  subject_test: string | null;
  section_group: string | null;
  paper_type: string | null;
  question_count: number;
  default_minutes: number | null;
  source_mode: string | null;
  is_demo_available: boolean;
  exam_year: number | null;
  updated_at: string;
}

// ── USERS & ADMIN ──
export interface AppUser {
  id: string;
  email: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  role: 'super_admin' | 'editor' | 'viewer';
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  full_name: string | null;
  display_name: string | null;
  permissions: {
    isAdmin: boolean;
    accessPdf: boolean;
    accessTags: boolean;
    accessNotes: boolean;
    accessFlashcards: boolean;
  };
  custom_tags: string[];
  folders: any[];
  updated_at: string;
}

// ── ATTEMPTS ──
export interface TestAttemptFull {
  id: string;
  user_id: string;
  test_id: string | null;
  title: string | null;
  provider: string | null;
  subject: string | null;
  explanation_mode: string | null;
  timer_mode: string | null;
  timer_minutes: number | null;
  started_at: string | null;
  submitted_at: string;
  score: number | null;
  attempt_payload: any;
  custom_test_name: string | null;
  deleted: boolean;
  updated_at: string;
}

// ── FLASHCARDS ──
export interface Card {
  id: string;
  question_id: string;
  test_id: string;
  front_text: string | null;
  back_text: string | null;
  subject: string | null;
  section_group: string | null;
  microtopic: string | null;
  card_type: string;
  source: any;
  explanation_markdown: string | null;
  institutes: string[];
  merged_from: string[];
  primary_institute: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserCard {
  id: string;
  user_id: string;
  card_id: string;
  status: string;
  repetitions: number;
  interval_days: number;
  ease_factor: number;
  learning_status: string;
  next_review: string;
  last_reviewed: string | null;
  deleted: boolean;
}

export interface CardReview {
  id: string;
  user_id: string;
  card_id: string;
  reviewed_at: string;
  quality: number;
  rating: string | null;
  learning_step: number | null;
}

// ── SOFT NOTES ──
export interface SoftNotebook {
  id: string;
  user_id: string;
  name: string;
  cover_color: string;
  paper_style: string;
  archived: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface SoftPage {
  id: string;
  notebook_id: string;
  order_index: number;
  width: number;
  height: number;
  paper_style: string;
}

export interface SoftStroke {
  id: string;
  page_id: string;
  tool: string;
  color: string;
  width: number;
  opacity: number;
  raw_points: any[];
  bezier_points: any;
  bounding_box: any;
  z_index: number;
  created_at: string;
}

export interface SoftTextBox {
  id: string;
  page_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  font_size: number;
  font_family: string | null;
  color: string;
  z_index: number;
  created_at: string;
  updated_at: string;
}

// ── QUESTION STATES (per-user analytics) ──
export interface QuestionState {
  id: string;
  user_id: string;
  question_id: string;
  test_id: string | null;
  selected_answer: string | null;
  confidence: string | null;
  review_difficulty: string | null;
  is_incorrect_last_attempt: boolean;
  marked_tough: boolean;
  marked_must_revise: boolean;
  error_category: string | null;
  time_spent_seconds: number;
  deleted: boolean;
  updated_at: string;
}

// ── STUDY SESSIONS ──
export interface StudySession {
  id: string;
  user_id: string;
  date: string;
  cards_reviewed: number;
  cards_correct: number;
  duration_seconds: number;
}

// ── SYLLABUS ──
export interface UserSyllabusProgress {
  id: string;
  user_id: string;
  path: string;
  status: any;
  updated_at: string;
}

// ── TAXONOMY ──
export interface TaxonomyItem {
  id: number;
  subject: string;
  section_group: string;
  microtopic: string;
}

// ── USER NOTES ──
export interface UserNote {
  id: string;
  user_id: string;
  subject: string;
  title: string;
  content: string | null;
  deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserNoteNode {
  id: string;
  user_id: string;
  parent_id: string | null;
  type: string;
  title: string;
  metadata: any;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

// ── USER WIDGETS ──
export interface UserWidget {
  id: string;
  user_id: string;
  widget_key: string;
  position: number;
  is_archived: boolean;
  size: string;
  created_at: string;
}

// ── ADMIN-SPECIFIC UI TYPES ──
export interface DataHealthReport {
  type: 'missing_correct_answer' | 'empty_option' | 'blank_question_text' | 'no_explanation' | 'duplicate_questions' | 'orphan_cards' | 'unlinked_test' | 'cancelled_questions';
  label: string;
  count: number;
  severity: 'critical' | 'warning' | 'info';
  query: string;
}

export interface BulkEditPayload {
  questionIds: string[];
  fields: Record<string, any>;
}

export interface ImportPreviewRow {
  rowNumber: number;
  questionText: string;
  subject: string | null;
  sectionGroup: string | null;
  microtopic: string | null;
  errors: string[];
  warnings: string[];
}

export type AdminTabKey =
  | 'dashboard'
  | 'questions'
  | 'tests'
  | 'flashcards'
  | 'users'
  | 'analytics'
  | 'softnotes'
  | 'question-states'
  | 'data-health'
  | 'bulk-operations'
  | 'taxonomy'
  | 'dedup'
  | 'notes'
  | 'settings';

export interface AdminNavItem {
  key: AdminTabKey;
  label: string;
  icon: string;
  badge?: number;
  requires?: string;
}

// ── FILTER DEFINITIONS ──
export interface FilterDef {
  key: string;
  label: string;
  type: 'text' | 'select' | 'number' | 'boolean' | 'date' | 'multiselect';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: any) => React.ReactNode;
}

// ── IMPORT SCHEMA ──
export interface ImportSchema {
  fields: {
    field: string;
    label: string;
    required?: boolean;
    type: 'string' | 'number' | 'boolean' | 'json';
    default?: any;
  }[];
}