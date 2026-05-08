/**
 * Pilot V2 — type definitions
 *
 * Pilot V2 is a parallel notes surface introduced as a *new* tab so the existing
 * Capsule tab continues to work untouched. Storage reuses the `user_notes` +
 * `user_note_nodes` Supabase tables with `metadata.surface = 'pilot_v2'` for
 * full isolation from Capsule (`pilot`) and the legacy Notes tab.
 *
 * Hierarchy mirrors the Knowledge Management app design spec:
 *   Subject -> Topic -> Subtopic -> Note (rich block document)
 */

export const PILOT_V2_SURFACE = 'pilot_v2' as const;

export type PilotV2NodeType = 'subject' | 'topic' | 'subtopic' | 'note';

export interface PilotV2Node {
  id: string;
  user_id: string;
  parent_id: string | null;
  type: PilotV2NodeType;
  title: string;
  /** Linked user_notes row id (only for type === 'note'). */
  note_id: string | null;
  is_pinned?: boolean;
  is_archived?: boolean;
  color?: string | null;
  icon?: string | null;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

/** Block formats supported by the Samsung-Notes-style editor. */
export type PilotV2BlockType =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'quote'
  | 'highlight'
  | 'code';

/** Highlight palette used for both inline highlights and tag chips. */
export const PILOT_V2_HIGHLIGHT_PALETTE = [
  { name: 'Yellow', bg: '#FDE68A', tagBg: '#FEF3C7', tagText: '#92400E' },
  { name: 'Lime',   bg: '#D9F99D', tagBg: '#ECFCCB', tagText: '#3F6212' },
  { name: 'Green',  bg: '#86EFAC', tagBg: '#D1FAE5', tagText: '#065F46' },
  { name: 'Pink',   bg: '#FBCFE8', tagBg: '#FCE7F3', tagText: '#9D174D' },
  { name: 'Purple', bg: '#DDD6FE', tagBg: '#EDE9FE', tagText: '#5B21B6' },
  { name: 'Blue',   bg: '#BFDBFE', tagBg: '#DBEAFE', tagText: '#1E40AF' },
  { name: 'Red',    bg: '#FCA5A5', tagBg: '#FEE2E2', tagText: '#991B1B' },
] as const;

export interface PilotV2Block {
  id: string;
  type: PilotV2BlockType;
  text: string;
  /** Heading level — only meaningful for type === 'heading'. */
  level?: 1 | 2 | 3;
  /** Checked state for `checklist` blocks. */
  checked?: boolean;
  /** Highlight color name (one of PILOT_V2_HIGHLIGHT_PALETTE.name). */
  highlightColor?: string;
  /** Inline marks — applied to the whole block (RN TextInput limitation). */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Hyperlink URL — when set, the block renders as a tappable link. */
  link?: string;
  /** Image data — base64 (`imageBase64`) or remote URL (`imageUri`). */
  imageBase64?: string;
  imageUri?: string;
  /** Attachment metadata for paperclip blocks. */
  attachment?: { name: string; uri?: string; mime?: string; size?: number };
  /** Reminder timestamp (ISO string) for calendar blocks. */
  remindAt?: string;
  /** Tabular data for table blocks (rows × cols). */
  tableRows?: string[][];
  /** Free-form metadata: source attribution, AI prompt, etc. */
  meta?: Record<string, any>;
  created_at?: string;
}

export interface PilotV2NoteContent {
  blocks: PilotV2Block[];
  /** Schema version — bump when block shape changes incompatibly. */
  version?: number;
}

export interface PilotV2Note {
  id: string;
  user_id?: string;
  title: string;
  subject?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  content: PilotV2NoteContent;
  is_pinned?: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Subject palette mirrors the Figma colour swatches. */
export interface PilotV2SubjectMeta {
  id: string;
  label: string;
  icon: string;        // Emoji-free safe glyph from the Figma comp
  bg: string;
  text: string;
}

export const PILOT_V2_SUBJECT_PALETTE: PilotV2SubjectMeta[] = [
  { id: 'polity',        label: 'Polity',        icon: 'Landmark',     bg: '#E9D5FF', text: '#7C3AED' },
  { id: 'economy',       label: 'Economy',       icon: 'TrendingUp',   bg: '#FCE7F3', text: '#DB2777' },
  { id: 'history',       label: 'History',       icon: 'ScrollText',   bg: '#FED7AA', text: '#EA580C' },
  { id: 'geography',     label: 'Geography',     icon: 'Globe2',       bg: '#D1FAE5', text: '#059669' },
  { id: 'ethics',        label: 'Ethics',        icon: 'Scale',        bg: '#DBEAFE', text: '#2563EB' },
  { id: 'environment',   label: 'Environment',   icon: 'Leaf',         bg: '#CCFBF1', text: '#0D9488' },
  { id: 'science-tech',  label: 'Science & Tech', icon: 'FlaskConical', bg: '#FEF3C7', text: '#D97706' },
];

/* ------------------------------------------------------------------------- */
/* View state                                                                 */
/* ------------------------------------------------------------------------- */

export type PilotV2ViewMode = 'dashboard' | 'subject' | 'noteList' | 'glance' | 'editor';

export type PilotV2QuickFilter = 'home' | 'pinned' | 'recent' | 'shared' | 'trash';

export interface PilotV2ViewState {
  mode: PilotV2ViewMode;
  selectedSubject: string | null;
  selectedTopic: string | null;
  selectedSubtopic: string | null;
  currentNoteId: string | null;
  sidebarCollapsed: boolean;
  /** Quick-nav filter applied on Dashboard / NoteList screens. */
  quickFilter: PilotV2QuickFilter;
}

export const PILOT_V2_INITIAL_VIEW: PilotV2ViewState = {
  mode: 'dashboard',
  selectedSubject: null,
  selectedTopic: null,
  selectedSubtopic: null,
  currentNoteId: null,
  sidebarCollapsed: false,
  quickFilter: 'home',
};
