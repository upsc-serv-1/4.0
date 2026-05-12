/**
 * Pilot V2 ΓÇö type definitions
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
  /** Heading level ΓÇö only meaningful for type === 'heading'. */
  level?: 1 | 2 | 3;
  /** Checked state for `checklist` blocks. */
  checked?: boolean;
  /** Highlight color name (one of PILOT_V2_HIGHLIGHT_PALETTE.name). */
  highlightColor?: string;
  /** Inline marks ΓÇö applied to the whole block (RN TextInput limitation). */
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Hyperlink URL ΓÇö when set, the block renders as a tappable link. */
  link?: string;
  /** Image data ΓÇö base64 (`imageBase64`) or remote URL (`imageUri`). */
  imageBase64?: string;
  imageUri?: string;
  /** Attachment metadata for paperclip blocks. */
  attachment?: { name: string; uri?: string; mime?: string; size?: number };
  /** Reminder timestamp (ISO string) for calendar blocks. */
  remindAt?: string;
  /** Tabular data for table blocks (rows ├ù cols). */
  tableRows?: string[][];
  /** Free-form metadata: source attribution, AI prompt, etc. */
  meta?: Record<string, any>;
  created_at?: string;
}

export interface PilotV2NoteContent {
  blocks: PilotV2Block[];
  /** Schema version ΓÇö bump when block shape changes incompatibly. */
  version?: number;
  /** Pencil annotation strokes ΓÇö page-level continuous overlay (Step 5/6). */
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
  /** ms epoch ΓÇö used for velocity smoothing. */
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
  /** Block-level anchor ΓÇö assigned after the stroke is committed.
   *  Lets the stroke follow its host block when blocks are reordered,
   *  edited, or when the editor/glance transition changes page dimensions. */
  anchor?: {
    /** ID of the PilotV2Block this stroke is drawn on. */
    blockId: string;
    /** Y of the block's top edge as a fraction (0..1) of the page height
     *  at the moment the stroke was committed.  Used to compute the delta
     *  when the block moves: dy = (currentBlockY / pageH) ΓêÆ blockOriginY. */
    blockOriginY: number;

    /* ΓöÇΓöÇ Span-offset fields (Step 9) ΓÇö underlines & highlights only ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
    /** ContentElement id.  For current single-span blocks this equals
     *  blockId; reserved for future multi-element blocks. */
    elementId?: string;
    /** Span index inside the ContentElement (0 for single-span blocks). */
    spanIndex?: number;
    /** Estimated character offset of the stroke's LEFT edge within the
     *  block text.  Derived at commit time as
     *  `Math.round(startRelX * blockText.length)`. */
    startOffset?: number;
    /** Estimated character offset of the stroke's RIGHT edge (exclusive).
     *  Derived as `Math.round(endRelX * blockText.length)`. */
    endOffset?: number;
    /** Stroke's left X as a fraction (0..1) of the block width at commit
     *  time.  Preserved so the corrective X can be re-derived later even
     *  when character-level text metrics are not available. */
    startRelX?: number;
    /** Stroke's right X as a fraction (0..1) of the block width. */
    endRelX?: number;
    /** Stroke centroid Y as a fraction (0..1) of the block HEIGHT at
     *  commit time.  Identifies which line the annotation sits on. */
    relY?: number;
    /** Stroke centroid Y as a PAGE-relative fraction (0..1 of page height)
     *  at commit time.  Used in conjunction with page-relative startRelX/
     *  endRelX to reproject strokes after orientation/sidebar changes that
     *  affect both page width and height.  Falls back to relY (block-
     *  relative) when absent. */
    pageRelY?: number;
    /** Page width (px) at anchor time ΓÇö used to recompute the absolute
     *  position when the page width changes (sidebar show/hide,
     *  orientation change), then re-project onto the block's current rect. */
    pageWidth?: number;
    /** Page height (px) at anchor time. */
    pageHeight?: number;
  };
}

export interface PilotV2PencilToolState {
  tool: PilotV2PencilTool;
  color: string;
  width: number;
  /** 0..1 ΓÇö only used by highlighter (35% by default). */
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
/** 6 stroke widths (px) ΓÇö matches user spec ("highlighter en 6 width"). */
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

/* ========================================================================= */
/* STEP 1 (v2.2) ΓÇö Nested-block architecture (foundation)                     */
/* ========================================================================= */

/** Inline rich-text run inside a `ContentElement`. */
export interface TextSpan {
  text: string;
  marks?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  highlightColor?: string;
  link?: { url: string; title?: string };
}

export type ContentElementType =
  | 'heading'
  | 'paragraph'
  | 'bullet'
  | 'numbered'
  | 'checklist'
  | 'quote'
  | 'code'
  | 'divider'
  | 'table';

/** Atomic content node inside a nested block. */
export interface ContentElement {
  id: string;
  type: ContentElementType;
  spans?: TextSpan[];
  checked?: boolean;
  level?: 1 | 2 | 3;
  tableRows?: string[][];
  /** Source attribution + provenance (quiz import, timestamp, badge label). */
  meta?: {
    addedAt?: string;
    source?: string;
    sourceQuizId?: string;
    sourceQuestion?: string;
    /** Optional badge label, e.g. "Added by quiz import". */
    badge?: string;
    [key: string]: any;
  };
}

/** Single pencil/Apple-Pencil stroke recorded on top of a nested block. */
export interface PencilStroke {
  id: string;
  type: 'drawing' | 'highlight' | 'underline' | 'circle' | 'arrow' | 'text';
  points: Array<{ x: number; y: number; pressure?: number; timestamp: number }>;
  color: string;
  width: number;
  opacity?: number;
  bounds: { x: number; y: number; width: number; height: number };
  createdAt: string;
}

/** Nested block ΓÇö container for a heading + ordered list of content elements. */
export interface PilotV2NestedBlock {
  id: string;
  /** Logical name surfaced in the block selector (e.g. "GDP Implications"). */
  blockName: string;
  /** User-edited override for `blockName` (rename without losing the auto label). */
  customName?: string;
  /** The block's own heading element (rendered as the section title). */
  heading?: ContentElement;
  /** Bullets, paragraphs, dividers, tables ΓÇö the renderable body of the block. */
  children: ContentElement[];

  /** Pencil annotations layered on top of this block (Step 5+). */
  pencilStrokes?: PencilStroke[];

  /** Tags for filtering / search-within-blocks (Step 8). */
  tags?: string[];

  /** Provenance ΓÇö set when the block (or its content) came from a quiz import. */
  sourceQuizId?: string;

  /** Local-first dirty flag ΓÇö true means "needs sync to server". */
  isDirty?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PilotV2UserPreferences {
  userId: string;
  lastUsedNotebook?: {
    noteId: string;
    title: string;
    subject: string;
    topic?: string | null;
    microtopic?: string | null;
  };
  lastUsedBlockId?: string;
  /** Insert a divider between consecutive imports. */
  autoSeparators: boolean;
  /** Auto-continue numbered-list numbering when appending. */
  continueNumbering: boolean;
  /** Default export format chosen in the export sheet. */
  defaultExportFormat?: 'pdf' | 'markdown' | 'plain' | 'image';
  /** Updated whenever preferences are written. */
  updatedAt?: string;
}

/* ------------------------------------------------------------------------- */
/* Backward-compatibility converters                                          */
/*                                                                            */
/*   Legacy notes are stored as PilotV2Block[] (flat list of headings, bullets*/
/*   paragraphs, etc). The new export sheet + smart-append code consumes      */
/*   PilotV2NestedBlock[] (heading + children groups). These helpers convert  */
/*   safely between both shapes so an old note never crashes the new UI.      */
/* ------------------------------------------------------------------------- */

const newConvId = (): string => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `pv2_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const nowIso = (): string => new Date().toISOString();

/** Map a flat block's textual content to a single ContentElement. */
function flatBlockToContentElement(block: PilotV2Block): ContentElement {
  const baseSpans: TextSpan[] = block.text
    ? [{
        text: block.text,
        marks: {
          bold: block.bold,
          italic: block.italic,
          underline: block.underline,
        },
        highlightColor: block.highlightColor,
        link: block.link ? { url: block.link } : undefined,
      }]
    : [];

  switch (block.type) {
    case 'heading':
      return {
        id: block.id,
        type: 'heading',
        level: block.level ?? 2,
        spans: baseSpans,
      };
    case 'bullet':
      return { id: block.id, type: 'bullet', spans: baseSpans };
    case 'numbered':
      return { id: block.id, type: 'numbered', spans: baseSpans };
    case 'checklist':
      return { id: block.id, type: 'checklist', checked: !!block.checked, spans: baseSpans };
    case 'quote':
      return { id: block.id, type: 'quote', spans: baseSpans };
    case 'code':
      return { id: block.id, type: 'code', spans: baseSpans };
    case 'highlight':
      return { id: block.id, type: 'paragraph', spans: baseSpans };
    case 'paragraph':
    default:
      if (block.tableRows?.length) {
        return { id: block.id, type: 'table', tableRows: block.tableRows };
      }
      return { id: block.id, type: 'paragraph', spans: baseSpans };
  }
}

/** Flatten a single ContentElement back into a legacy PilotV2Block. */
function contentElementToFlatBlock(el: ContentElement): PilotV2Block {
  const text = (el.spans || []).map(s => s.text).join('');
  const firstSpan = el.spans?.[0];
  const base: PilotV2Block = {
    id: el.id,
    type: 'paragraph',
    text,
    bold: firstSpan?.marks?.bold,
    italic: firstSpan?.marks?.italic,
    underline: firstSpan?.marks?.underline,
    highlightColor: firstSpan?.highlightColor,
    link: firstSpan?.link?.url,
    meta: el.meta,
  };
  switch (el.type) {
    case 'heading':
      return { ...base, type: 'heading', level: el.level ?? 2 };
    case 'bullet':
      return { ...base, type: 'bullet' };
    case 'numbered':
      return { ...base, type: 'numbered' };
    case 'checklist':
      return { ...base, type: 'checklist', checked: !!el.checked };
    case 'quote':
      return { ...base, type: 'quote' };
    case 'code':
      return { ...base, type: 'code' };
    case 'table':
      return { ...base, type: 'paragraph', tableRows: el.tableRows };
    case 'divider':
      // Legacy schema has no divider ΓÇö represent as a thin-rule paragraph.
      return { ...base, type: 'paragraph', text: text || 'ΓÇöΓÇöΓÇö' };
    case 'paragraph':
    default:
      return { ...base, type: 'paragraph' };
  }
}

/**
 * Convert a legacy flat block list into nested heading-grouped blocks.
 *
 * Rules:
 *  ΓÇó Each `heading` starts a new nested block. The heading element becomes the
 *    block's `heading`; its `text` becomes `blockName`.
 *  ΓÇó Non-heading elements before the first heading are placed in an implicit
 *    "Notes" block so no content is lost.
 *  ΓÇó If the input is empty, a single empty block is returned (so the UI never
 *    sees `blocks.length === 0` after migration).
 */
export function flatBlocksToNested(flat: PilotV2Block[] | undefined | null): PilotV2NestedBlock[] {
  const safe = Array.isArray(flat) ? flat : [];
  if (safe.length === 0) {
    return [{
      id: newConvId(),
      blockName: 'Notes',
      children: [],
      isDirty: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }];
  }

  const result: PilotV2NestedBlock[] = [];
  let current: PilotV2NestedBlock | null = null;

  const startBlock = (heading?: ContentElement, name?: string): PilotV2NestedBlock => ({
    id: newConvId(),
    blockName: (name ?? 'Notes').trim() || 'Notes',
    heading,
    children: [],
    isDirty: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  for (const flatBlock of safe) {
    if (flatBlock.type === 'heading') {
      // Push previous block (if any) and open a new one keyed by the heading text.
      if (current) result.push(current);
      const headingEl = flatBlockToContentElement(flatBlock);
      current = startBlock(headingEl, flatBlock.text);
    } else {
      if (!current) current = startBlock(undefined, 'Notes');
      current.children.push(flatBlockToContentElement(flatBlock));
    }
  }
  if (current) result.push(current);
  return result;
}

/**
 * Inverse of `flatBlocksToNested` ΓÇö used when the new UI saves a nested note
 * back into the legacy `PilotV2NoteContent.blocks` field so the existing editor
 * (Samsung-Notes-style) and any other consumer keeps rendering correctly.
 */
export function nestedToFlatBlocks(nested: PilotV2NestedBlock[] | undefined | null): PilotV2Block[] {
  const safe = Array.isArray(nested) ? nested : [];
  const out: PilotV2Block[] = [];
  for (const block of safe) {
    if (block.heading) {
      out.push(contentElementToFlatBlock(block.heading));
    } else if ((block.blockName || '').trim()) {
      // No explicit heading element ΓÇö synthesize one from blockName so the flat
      // editor still shows the section break.
      out.push({
        id: block.id,
        type: 'heading',
        level: 2,
        text: (block.customName || block.blockName || '').trim(),
      });
    }
    for (const child of block.children) {
      out.push(contentElementToFlatBlock(child));
    }
  }
  return out;
}

/**
 * Best-effort detector that accepts either shape and returns a normalised
 * nested block list. Used by note-loader paths to be crash-proof against
 * notes saved before the v2.2 schema change.
 */
export function ensureNestedBlocks(
  raw: PilotV2Block[] | PilotV2NestedBlock[] | undefined | null
): PilotV2NestedBlock[] {
  const arr = Array.isArray(raw) ? raw : [];
  if (arr.length === 0) return flatBlocksToNested([]);
  const looksNested = (arr as any[]).every(
    b => b && typeof b === 'object' && 'children' in b && Array.isArray((b as any).children)
  );
  if (looksNested) return arr as PilotV2NestedBlock[];
  return flatBlocksToNested(arr as PilotV2Block[]);
}

/** Plain-text projection of a nested block (used by the smart-block matcher). */
export function nestedBlockPlainText(block: PilotV2NestedBlock): string {
  const headingText = (block.heading?.spans || []).map(s => s.text).join(' ');
  const childText = block.children
    .map(c => (c.spans || []).map(s => s.text).join(' '))
    .filter(Boolean)
    .join(' \n ');
  return [block.customName || block.blockName, headingText, childText]
    .filter(Boolean)
    .join('\n')
    .trim();
}
