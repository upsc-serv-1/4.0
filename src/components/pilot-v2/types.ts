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
  /** Pencil annotation strokes — page-level continuous overlay (Step 5/6). */
  pencilStrokes?: PilotV2PencilStroke[];
}

/* ========================================================================== */
/* Pencil annotations (Step 5 + Step 6)                                       */
/* ========================================================================== */

/** Notability-style tool kinds. */
export type PilotV2PencilTool =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'lasso';

/** A single point captured during a stroke. Coordinates are stored in
 *  RELATIVE canvas-space (0..1 per axis on the document page) to avoid
 *  scale drift at any zoom level. */
export interface PilotV2PencilPoint {
  /** Relative X (0..1) inside the page bounds. */
  x: number;
  /** Relative Y (0..1) inside the page bounds. */
  y: number;
  /** Apple Pencil force / pressure 0..1 (0.5 fallback for finger / mouse). */
  pressure: number;
  /** ms epoch — used for velocity smoothing. */
  t: number;
}

/** A persisted ink stroke. */
export interface PilotV2PencilStroke {
  id: string;
  tool: PilotV2PencilTool;
  color: string;
  /** Width in absolute px (rendered relative to current canvas height). */
  width: number;
  opacity: number;
  points: PilotV2PencilPoint[];
  /** Z-order for proper rendering (later strokes on top). */
  zIndex: number;
  createdAt: string;
  /** Optional bounds in relative coords (for fast eraser hit-test). */
  bounds?: { x: number; y: number; w: number; h: number };
}

export interface PilotV2PencilToolState {
  tool: PilotV2PencilTool;
  color: string;
  width: number;
  /** 0..1 — only used by highlighter (35% by default). */
  opacity: number;
  /** When true, the canvas only accepts stylus / pencil input (palm rejection). */
  pencilOnly: boolean;
  /** Most recent tool used before the current one (for double-tap switch). */
  previousTool?: PilotV2PencilTool;
}

/** Default tool palette presets (Notability-style). */
export const PILOT_V2_PEN_COLORS = [
  '#0F172A', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF',
] as const;
export const PILOT_V2_HIGHLIGHTER_COLORS = [
  '#FDE68A', '#FCA5A5', '#A7F3D0', '#93C5FD', '#D8B4FE', '#FDBA74',
] as const;
/** 6 stroke widths (px) — matches user spec ("highlighter en 6 width"). */
export const PILOT_V2_PEN_WIDTHS = [1, 2, 3, 5, 8, 12] as const;
export const PILOT_V2_HIGHLIGHTER_WIDTHS = [8, 12, 18, 24, 32, 44] as const;

export interface PilotV2Note {
  id: string;
  user_id?: string;
  title: string;
  subject?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  content: PilotV2NoteContent;
  is_pinned?: boolean;
  is_archived?: boolean;
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

export const PILOT_V2_SUBJECT_PALETTE: PilotV2SubjectMeta[] = [];

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
  search: string;
}

export const PILOT_V2_INITIAL_VIEW: PilotV2ViewState = {
  mode: 'dashboard',
  selectedSubject: null,
  selectedTopic: null,
  selectedSubtopic: null,
  currentNoteId: null,
  sidebarCollapsed: false,
  quickFilter: 'home',
  search: '',
};
