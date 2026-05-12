// ==========================================================================
// Constants — subject lists, exam categories, default values
// ==========================================================================

export const SUBJECTS = [
  'History',
  'Geography',
  'Polity',
  'Economy',
  'Environment',
  'Science & Tech',
  'Art & Culture',
  'CSAT',
  'Essay',
  'GS 1',
  'GS 2',
  'GS 3',
  'GS 4',
  'Current Affairs',
] as const;

export const EXAM_CATEGORIES = [
  { value: 'cse', label: 'UPSC CSE' },
  { value: 'state_psc', label: 'State PSC' },
  { value: 'bpsc', label: 'BPSC' },
  { value: 'uppcs', label: 'UPPCS' },
  { value: 'mppsc', label: 'MPPSC' },
  { value: 'other', label: 'Other' },
] as const;

export const EXAM_STAGES = [
  { value: 'prelims', label: 'Prelims' },
  { value: 'mains', label: 'Mains' },
  { value: 'interview', label: 'Interview' },
] as const;

export const EXAM_PAPERS = [
  { value: 'pre_gs1', label: 'Prelims GS Paper 1' },
  { value: 'pre_csat', label: 'Prelims CSAT' },
  { value: 'mains_gs1', label: 'Mains GS Paper 1' },
  { value: 'mains_gs2', label: 'Mains GS Paper 2' },
  { value: 'mains_gs3', label: 'Mains GS Paper 3' },
  { value: 'mains_gs4', label: 'Mains GS Paper 4' },
  { value: 'mains_essay', label: 'Mains Essay' },
  { value: 'other', label: 'Other' },
] as const;

export const TEST_LEVELS = [
  { value: 'Full Test', label: 'Full Test' },
  { value: 'Sectional Test', label: 'Sectional Test' },
  { value: 'Subject Test', label: 'Subject Test' },
  { value: 'PYQ', label: 'Previous Year Questions' },
] as const;

export const PAPER_TYPES = [
  { value: 'Full Length', label: 'Full Length' },
  { value: 'Sectional', label: 'Sectional' },
  { value: 'Topic-wise', label: 'Topic-wise' },
] as const;

export const CARD_TYPES = ['qa', 'note_block', 'manual'] as const;

export const ADMIN_ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
] as const;

export const PER_PAGE_OPTIONS = [25, 50, 100, 200] as const;

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard' },
  { key: 'questions', label: 'Questions', icon: 'FileQuestion' },
  { key: 'tests', label: 'Tests', icon: 'FileText' },
  { key: 'flashcards', label: 'Flashcards', icon: 'Layers' },
  { key: 'users', label: 'Users', icon: 'Users' },
  { key: 'analytics', label: 'Analytics', icon: 'BarChart2' },
  { key: 'data-health', label: 'Data Health', icon: 'Activity' },
  { key: 'bulk-operations', label: 'Bulk Ops', icon: 'Zap' },
  { key: 'taxonomy', label: 'Taxonomy', icon: 'TreePine' },
  { key: 'dedup', label: 'Dedup', icon: 'Scan' },
  { key: 'softnotes', label: 'Soft Notes', icon: 'BookOpen' },
  { key: 'notes', label: 'Notes', icon: 'StickyNote' },
  { key: 'question-states', label: 'Q States', icon: 'BrainCircuit' },
  { key: 'settings', label: 'Settings', icon: 'Settings' },
] as const;