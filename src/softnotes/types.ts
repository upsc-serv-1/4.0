/**
 * Soft Notes — type definitions for the Notability-clone subsystem.
 *
 * These types live alongside (NOT inside) the legacy Hardnotes types. The two
 * features share the auth user but have entirely separate Supabase tables.
 *
 * Source spec: `Hardnotes upgrade/3. NOTABILITY_CLONE_SPECIFICATION.md`
 *              `Hardnotes upgrade/4. NOTABILITY_IMPLEMENTATION_GUIDE.md`
 *              `Hardnotes upgrade/5. SOFT_NOTES_QUICK_REFERENCE.md`
 */

// ===== Notebook =====
export interface Notebook {
  id: string;
  user_id: string;
  name: string;
  cover_color: string;     // hex; lets the hub render coloured cover thumbnails
  paper_style: PaperStyle;
  created_at: string;
  updated_at: string;
  archived: boolean;
  pinned: boolean;
}

export type PaperStyle =
  | 'plain'
  | 'ruled'
  | 'grid'
  | 'dotted'
  | 'cornell';

// ===== Page =====
export interface Page {
  id: string;
  notebook_id: string;
  /** 0-based ordering inside the notebook. Re-ordered on drag. */
  order_index: number;
  /** Page width in canvas units (default 800). */
  width: number;
  /** Page height in canvas units (default 1131 for A4-ish at 96 dpi). */
  height: number;
  paper_style: PaperStyle;  // overrides notebook default if set
  created_at: string;
  updated_at: string;
}

// ===== Stroke (vector ink) =====
export type SoftToolKind =
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'tape'
  | 'lasso'
  | 'shape'
  | 'laser';   // laser pointer — strokes fade after 1 s, never persisted

export interface SoftStrokePoint {
  x: number;
  y: number;
  /** 0..1, defaults to 0.5 for finger / mouse */
  pressure: number;
  /** ms epoch — used for velocity calc */
  timestamp: number;
  /** Apple-Pencil tilt + altitude — optional */
  tilt?: number;
  azimuth?: number;
}

export interface SoftStroke {
  id: string;
  page_id: string;
  tool: SoftToolKind;
  color: string;
  width: number;
  opacity: number;
  /** Raw input samples — source of truth */
  raw_points: SoftStrokePoint[];
  /** Optional cached cubic-bezier control points (Catmull-Rom output). */
  bezier_points?: BezierPoint[];
  bounding_box?: { x: number; y: number; width: number; height: number };
  z_index: number;
  created_at: string;
}

export interface BezierPoint {
  x: number;
  y: number;
  /** Incoming control point (toward this anchor from the previous one). */
  cp_in_x: number;
  cp_in_y: number;
  /** Outgoing control point (from this anchor toward the next one). */
  cp_out_x: number;
  cp_out_y: number;
  pressure: number;
  velocity: number;
}

// ===== Text Box (typed annotations on a page) =====
export interface TextBox {
  id: string;
  page_id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Plain text for now — rich text is a Phase-B-stretch goal */
  content: string;
  font_size: number;
  font_family?: string;
  color: string;
  z_index: number;
  created_at: string;
  updated_at: string;
}

// ===== Selection (lasso result, in-memory only) =====
export interface SoftSelection {
  strokeIds: string[];
  textBoxIds: string[];
  /** Bounding rect in page coords. */
  bounds: { x: number; y: number; width: number; height: number };
}

// ===== Canvas transform (in-memory) =====
export interface CanvasTransform {
  zoom: number;       // 0.25 .. 4
  panX: number;
  panY: number;
  rotation: number;   // radians; usually 0
}

export const DEFAULT_TRANSFORM: CanvasTransform = {
  zoom: 1, panX: 0, panY: 0, rotation: 0,
};

export const DEFAULT_PAGE_WIDTH = 800;
export const DEFAULT_PAGE_HEIGHT = 1131;
