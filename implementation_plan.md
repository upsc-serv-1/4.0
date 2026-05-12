# Implementation Plan

## [Overview]

Complete renovation of the Dr. UPSC Admin Panel from a 5-page skeleton into a full-featured administrative backend that manages every aspect of the app (questions, tests, flashcards, soft notes, users, analytics) via Supabase, with dedicated data health scanners, bulk operations, and per-user feature toggles.

The current admin panel is a minimal Vite+React+Tailwind app with 5 pages (Dashboard, Questions, Tests, Dedup Manager, User Performance). It lacks coverage for the app's 15+ feature tabs (Arena, Analyse, PYQ, Flashcards, Tags, Pilot V2, Hardnotes, Capsule, Soft Notes, etc.), has no data quality tooling, no bulk edit capabilities, and no user management beyond read-only stats. The renovated panel will match the full app surface area, add dedicated "Data Health" tabs, provide bulk JSON/CSV import, and support per-user feature permission management. It will pull architecture inspiration from the old PHP-based admin panel at `C:\Users\Dr. Yogesh\Pictures\G1V15.2 for codex` and the JSON import patterns from `3.2/referenece json file.json` and the `jt_` schema from the Question-Parser-Tool.

## [Types]

The type system will expand from the current minimal 4 types to a comprehensive set that covers all Supabase tables and admin-specific UI (filters, bulk ops, reports).

### Current Types (admin-panel/src/lib/types.ts)
```typescript
export type Question = {
  id: string;
  test_id?: string | null;
  question_text: string;
  options: Record<string, string>;
  correct_answer: string;
  explanation_markdown: string | null;
  subject: string | null;
  micro_topic: string | null;
  section_group: string | null;
  is_pyq: boolean | null;
  is_upsc_cse: boolean | null;
  is_allied: boolean | null;
  is_others: boolean | null;
  exam_year: number | null;
};

export type Test = {
  id: string;
  title: string;
  provider: string | null;
  institute: string | null;
  program_name: string | null;
  question_count: number | null;
  default_minutes: number | null;
  created_at?: string;
};

export type AdminUser = { id: string; user_id: string; email: string; role: string };

export type Performance = {
  attempt_id: string;
  user_id: string;
  test_id: string;
  test_title: string;
  score: number;
  question_count: number;
  accuracy_pct: number;
  started_at: string | null;
  submitted_at: string;
  duration_seconds: number;
};
```

### Renovated Types (admin-panel/src/lib/types.ts)
Full types for all database tables:

```typescript
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

// ── ADMIN-SPECIFIC UI TYPES ──
export interface DataHealthReport {
  type: 'missing_correct_answer' | 'empty_option' | 'blank_question_text' | 'no_explanation' | 'duplicate_questions' | 'orphan_cards' | 'unlinked_test';
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
  | 'logs';

export interface AdminNavItem {
  key: AdminTabKey;
  label: string;
  icon: string; // lucide icon name
  badge?: number;
  requires?: string; // role
}
```

## [Files]

The admin panel will be heavily restructured. The existing file tree will be reorganized into a feature-based folder structure with shared components.

### New File Tree (admin-panel/src/)
```
src/
  main.tsx                          # Entry point (keep)
  App.tsx                           # Rewritten — new nav, lazy routes, role-based access
  index.css                         # Keep
  lib/
    supabase.ts                     # Keep (update Supabase client config)
    types.ts                        # Rewritten — all types above
    supabaseAdmin.ts                # NEW — service-role client for admin operations
    queryUtils.ts                   # NEW — reusable query builders (filter, sort, paginate)
    exportUtils.ts                  # NEW — CSV/JSON download helpers
    taxonomyStore.ts                # NEW — in-memory cache for taxonomy dropdowns
    constants.ts                    # NEW — subject list, exam categories, etc.
  hooks/
    useAdminAuth.ts                 # NEW — session + role + permission hook
    useDebounce.ts                  # NEW
    usePagination.ts                # NEW
    useBulkSelect.ts                # NEW — checkbox state for list views
    useDataHealth.ts                # NEW — run quality scans
    useSupabaseQuery.ts             # NEW — generic query hook with loading/error
  components/
    shared/
      DataTable.tsx                 # NEW — sortable, paginated, selectable table
      FilterBar.tsx                 # NEW — multi-field filter panel
      DetailModal.tsx               # NEW — slide-over / modal for record editing
      JsonEditor.tsx                # NEW — JSON editor with validation for options/source
      MarkdownEditor.tsx            # NEW — simple markdown textarea with preview
      FileDropZone.tsx              # NEW — drag-and-drop JSON/CSV import
      Badge.tsx                     # NEW
      StatCard.tsx                  # NEW
      PageHeader.tsx                # NEW
      ConfirmDialog.tsx             # NEW
      Toast.tsx                     # NEW
    layout/
      Sidebar.tsx                   # Rewritten — new nav items + role-based visibility
      Header.tsx                    # NEW — breadcrumb + user menu
      Shell.tsx                     # NEW — wraps sidebar + header + <Outlet/>
    dashboard/
      Dashboard.tsx                 # Rewritten — more stats charts, recent activity
      StatGrid.tsx                  # NEW
      RecentActivity.tsx            # NEW
      SystemHealth.tsx              # NEW
    questions/
      QuestionsPage.tsx             # Rewritten — full CRUD, search, filter, paginate
      QuestionEditor.tsx            # Rewritten — full fields, options grid, toggles
      QuestionTable.tsx             # NEW — virtualized table with bulk select
      QuestionFilters.tsx           # NEW — subject, section, exam, year, type filters
      QuestionImport.tsx            # NEW — JSON/CSV import with preview & validate
      QuestionExport.tsx            # NEW — export filtered set to JSON/CSV
    tests/
      TestsPage.tsx                 # Rewritten
      TestEditor.tsx                # NEW — full test CRUD with all fields
      TestQuestionList.tsx          # NEW — questions belonging to a test
      TestFilters.tsx               # NEW
    flashcards/
      FlashcardsPage.tsx            # NEW — manage cards table
      CardEditor.tsx                # NEW — edit card front/back/source/institutes
      CardFilters.tsx               # NEW
      FlashcardBranches.tsx         # NEW — manage flashcard_branches
    users/
      UsersPage.tsx                 # Rewritten from UserPerformancePage
      UserDetailModal.tsx           # NEW — full user profile, settings, feature permissions
      UserPerformanceTab.tsx        # NEW — per-user attempt history, accuracy charts
      UserFeatureToggles.tsx        # NEW — toggle permissions, feature access
      AdminUserManager.tsx          # NEW — manage admin_users table
    analytics/
      AnalyticsPage.tsx             # NEW — aggregate platform analytics
      AttemptsTable.tsx             # NEW — browse all test_attempts
      QuestionStateExplorer.tsx     # NEW — browse question_states
    data-health/
      DataHealthPage.tsx            # NEW — main data health dashboard
      HealthScannerPanel.tsx        # NEW — run scans, see results
      MissingAnswersReport.tsx      # NEW — questions with no correct_answer
      EmptyOptionsReport.tsx        # NEW — options with blank values
      BlankQuestionsReport.tsx      # NEW — empty/missing question_text
      DuplicateFinder.tsx           # NEW — duplicate detection + merge UI
      OrphanFinder.tsx              # NEW — cards without questions, etc.
      HealthFixActions.tsx          # NEW — bulk fix buttons (set default, clear, delete)
    bulk-operations/
      BulkOperationsPage.tsx        # NEW
      BulkMetadataEditor.tsx        # NEW — select questions → apply field changes
      BulkTagEditor.tsx             # NEW — add/remove subject/section/micro_topic en masse
      BulkImportWizard.tsx          # NEW — multi-step JSON/CSV importer
      BulkDeletePanel.tsx           # NEW — safe delete with preview
    taxonomy/
      TaxonomyPage.tsx              # NEW — manage subject/section/microtopic hierarchy
      TaxonomyEditor.tsx            # NEW — CRUD for jt_taxonomy
      DropdownOptionsManager.tsx    # NEW — manage jt_dropdown_options
    dedup/
      DedupManager.tsx              # Keep & enhance — add merge suggestions
    softnotes/
      SoftNotesAdminPage.tsx        # NEW — browse notebooks, pages, strokes
    settings/
      AdminSettingsPage.tsx         # NEW — global settings, dropdown options
  pages/                            # DELETED — flattened into components/ above
    Dashboard.tsx                   # DELETE
    QuestionsPage.tsx               # DELETE
    TestsPage.tsx                   # DELETE
    UserPerformancePage.tsx         # DELETE
    DedupManager.tsx                # DELETE (recreated as component)
    Login.tsx                       # KEEP (out of pages/ → move to components/auth/)
  auth/
    Login.tsx                       # MOVED from pages/
    ProtectedRoute.tsx              # NEW
```

### File Modification Summary
| File | Action |
|------|--------|
| admin-panel/src/lib/types.ts | Rewrite — add all new types |
| admin-panel/src/lib/supabase.ts | Update — add admin-specific queries |
| admin-panel/src/App.tsx | Rewrite — lazy routes, new sidebar, role guards |
| admin-panel/src/index.css | Keep |
| admin-panel/src/main.tsx | Keep |
| admin-panel/src/pages/* | Delete all (replaced by components/) |
| admin-panel/src/assets/* | Keep |
| admin-panel/package.json | May add: papaparse (CSV), react-markdown, @tanstack/react-table, recharts |

## [Functions]

### New Utility Functions

| Name | Signature | File | Purpose |
|------|-----------|------|---------|
| `useAdminAuth()` | `() => { session, isAdmin, role, hasPermission }` | hooks/useAdminAuth.ts | Session + role + permission state |
| `useBulkSelect()` | `<T>() => { selected: Set<T>, toggle, selectAll, clear }` | hooks/useBulkSelect.ts | Generic multi-select for tables |
| `useDataHealth()` | `() => { reports: DataHealthReport[], scan, loading }` | hooks/useDataHealth.ts | Run health checks across tables |
| `useSupabaseQuery()` | `<T>(table, query) => { data, loading, error }` | hooks/useSupabaseQuery.ts | Generic query with loading state |
| `useDebounce()` | `<T>(value: T, delay) => T` | hooks/useDebounce.ts | Debounce search inputs |
| `usePagination()` | `(total) => { page, perPage, setPage, totalPages }` | hooks/usePagination.ts | Pagination state |
| `exportToCSV()` | `<T>(data: T[], filename) => void` | lib/exportUtils.ts | Download filtered data as CSV |
| `exportToJSON()` | `<T>(data: T[], filename) => void` | lib/exportUtils.ts | Download filtered data as JSON |
| `validateImportRow()` | `(row, schema) => ImportPreviewRow` | lib/queryUtils.ts | Validate a row against question schema |
| `buildQuestionQuery()` | `(filters: QuestionFilters) => PostgrestFilterBuilder` | lib/queryUtils.ts | Build dynamic Supabase query |
| `parseJSONImport()` | `(file: File) => Promise<ImportPreviewRow[]>` | lib/queryUtils.ts | Parse uploaded JSON file |
| `parseCSVImport()` | `(file: File) => Promise<ImportPreviewRow[]>` | lib/queryUtils.ts | Parse uploaded CSV file |
| `runHealthCheck()` | `(type: string) => Promise<{ count, items }>` | lib/queryUtils.ts | Run a specific health scan query |
| `getTaxonomy()` | `() => Promise<TaxonomyItem[]>` | lib/taxonomyStore.ts | Fetch taxonomy cache |
| `getDropdownOptions()` | `(field: string) => Promise<{value, label}[]>` | lib/taxonomyStore.ts | Get dropdown options for a field |

### Existing Functions to Modify

| Function | File | Change |
|----------|------|--------|
| App component | App.tsx | Replace inline Shell with lazy-loaded routes + auth guards |
| Shell component | App.tsx | Move to components/layout/Shell.tsx, add Outlet |
| Question columns | QuestionsPage.tsx | Expand to all QuestionFull fields |

## [Classes]

No new classes. The project uses functional React components throughout. All "classes" are React components (pages, layouts, widgets).

### New Components
| Component | File Path | Key Props | Purpose |
|-----------|-----------|-----------|---------|
| `Sidebar` | components/layout/Sidebar.tsx | - | Role-based nav with collapsible sections |
| `Shell` | components/layout/Shell.tsx | - | Main layout wrapper |
| `DataTable` | components/shared/DataTable.tsx | columns, data, sortable, selectable, paginated | Universal sortable table |
| `FilterBar` | components/shared/FilterBar.tsx | filters: FilterDef[], onChange | Multi-field filter panel |
| `DetailModal` | components/shared/DetailModal.tsx | open, onClose, title, children | Slide-over edit modal |
| `FileDropZone` | components/shared/FileDropZone.tsx | onFile, accept, multiple | Drag-and-drop import |
| `JsonEditor` | components/shared/JsonEditor.tsx | value, onChange, error | JSON text editor |
| `MarkdownEditor` | components/shared/MarkdownEditor.tsx | value, onChange | Markdown input with preview |
| `ConfirmDialog` | components/shared/ConfirmDialog.tsx | open, title, message, onConfirm | Generic confirmation |

### Renovated Components
| Component | File Path | Changes |
|-----------|-----------|---------|
| `Login` | components/auth/Login.tsx | Add role-based redirect |
| `Dashboard` | components/dashboard/Dashboard.tsx | Add charts (recharts), recent activity feed |
| `QuestionsPage` | components/questions/QuestionsPage.tsx | Full CRUD, pagination, bulk select, advanced filters |
| `TestsPage` | components/tests/TestsPage.tsx | Full CRUD, link to questions |
| `UserPerformancePage` → `UsersPage` | components/users/UsersPage.tsx | User list, search, detail modal |
| `DedupManager` | components/dedup/DedupManager.tsx | Add merge suggestions UI |

## [Dependencies]

### New Dependencies (admin-panel/package.json)
```json
{
  "@tanstack/react-table": "^8.21.0",
  "papaparse": "^5.5.2",
  "recharts": "^2.15.0",
  "react-markdown": "^10.1.0",
  "date-fns": "^4.1.0",
  "react-hot-toast": "^2.5.2",
  "zod": "^3.24.0"
}
```

### Dev Dependencies
```json
{
  "@types/papaparse": "^5.5.0"
}
```

No backend changes needed — all operations go directly to Supabase (REST + service_role key for admin operations).

## [Testing]

Manual testing checklist for each tab after implementation:

1. **Dashboard**: Verify stats load, charts render, recent activity shows
2. **Questions**: CRUD, search by text/subject/year, filter combos, bulk edit, JSON import preview, CSV export
3. **Tests**: Full CRUD, link to questions, paper_type/level/series fields
4. **Flashcards**: Browse cards, edit front/back, filter by subject, view branches
5. **Users**: View list, search, open detail modal, toggle feature permissions, manage admin_users
6. **Analytics**: Browse attempts, question_state explorer, aggregate stats
7. **Data Health**: Run each scanner, verify counts, apply fix actions
8. **Bulk Operations**: Select questions, apply metadata change, verify in questions tab
9. **Taxonomy**: CRUD, verify dropdowns populate correctly
10. **Dedup**: Run dedup scan, view suggestions, merge
11. **Soft Notes**: Browse notebooks, view pages/strokes

## [Implementation Order]

The implementation should proceed in 11 phases, each building on the previous:

1. **Foundation** — Rewrite types.ts, add shared UI components (DataTable, FilterBar, DetailModal, etc.), create lib/queryUtils.ts and lib/exportUtils.ts, add new dependencies, set up auth hook and ProtectedRoute.

2. **Layout & Navigation** — Rewrite App.tsx with lazy-loaded routes, create Sidebar (collapsible, role-based), Shell with Outlet, Header with breadcrumbs, migrate Login to components/auth/.

3. **Dashboard Renovation** — Rewrite Dashboard with recharts (question/test/attempt trends), recent activity feed, system health snapshot.

4. **Questions Renovation** — Rewrite QuestionsPage with full QuestionFull schema, pagination, advanced filters (subject/section/exam/year/type/cancelled), bulk select checkbox column, QuestionEditor with all fields. Add QuestionExport.

5. **Tests Renovation** — Rewrite TestsPage with full TestFull schema, TestQuestionList, paper_type/level/series filters.

6. **Flashcards** — New FlashcardsPage, CardEditor, CardFilters, FlashcardBranches.

7. **Users & Authorization** — Rewrite UsersPage with user search, UserDetailModal (profile, settings, feature toggles per UserSettings.permissions), AdminUserManager (add/remove admins).

8. **Analytics** — New AnalyticsPage with aggregate stats, AttemptsTable, QuestionStateExplorer (browse all question_states by user).

9. **Data Health** — New DataHealthPage with 7 dedicated scanner panels: MissingAnswers, EmptyOptions, BlankQuestions, NoExplanation, DuplicateFinder, OrphanFinder, UnlinkedTests. Each with run button, count display, drill-down to affected items, and Fix Actions.

10. **Bulk Operations** — New BulkOperationsPage with BulkMetadataEditor (select questions → apply field changes), BulkTagEditor, BulkImportWizard (JSON/CSV upload → preview → validate → confirm), BulkDeletePanel.

11. **Taxonomy, Dedup, Soft Notes, Settings** — TaxonomyPage (manage jt_taxonomy + jt_dropdown_options), SoftNotesAdminPage (read-only browse), DedupManager enhancement, AdminSettingsPage (global dropdown options, system config).