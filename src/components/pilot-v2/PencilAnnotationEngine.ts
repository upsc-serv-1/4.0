/**
 * PencilAnnotationEngine — Pilot V2 Step 5
 * ----------------------------------------
 * In-memory stroke tracker for the page-level Notability-style overlay.
 *
 * Responsibilities (Phase 3 gaps from PILOT_V2_GAPS.md):
 *   1. Palm rejection — ignore non-stylus input when pencilOnly = true.
 *   2. Relative-scaled coordinates — every captured point is normalised to
 *      0..1 of the page bounds so drawings never drift when the user
 *      zooms / pans / resizes the document.
 *   3. Undo / Redo — operation stacks consumed by the toolbar.
 *   4. Single page-level continuous overlay — one engine instance owns ALL
 *      strokes for the whole note (no per-block canvases → no lag).
 *
 * Persistence is handled by the host hook (usePilotV2Pencil); this file only
 * deals with capture + smoothing + history. Borrows Catmull-Rom smoothing
 * from src/softnotes/strokes.ts (smart re-use).
 */

import {
  PilotV2PencilStroke,
  PilotV2PencilPoint,
  PilotV2PencilTool,
} from './types';
import { recogniseShape } from './pilotV2ShapeRecognition';

/** Listener fired whenever the visible stroke list changes. */
type ChangeListener = (strokes: PilotV2PencilStroke[]) => void;

/** A single undoable operation. */
type EngineOp =
  | { kind: 'add'; strokes: PilotV2PencilStroke[] }
  | { kind: 'remove'; strokes: PilotV2PencilStroke[] };

const newStrokeId = (): string => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return `pv2_str_${(crypto as any).randomUUID()}`;
  }
  return `pv2_str_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const nowIso = () => new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Smoothing helpers (lifted from softnotes/strokes.ts to avoid coupling)      */
/* -------------------------------------------------------------------------- */
const calcVelocity = (a: PilotV2PencilPoint, b: PilotV2PencilPoint): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dt = (b.t - a.t) || 1;
  return Math.sqrt(dx * dx + dy * dy) / dt;
};

/** Faster motion → thinner stroke (mimics flicked pen). */
export const pressureFromVelocity = (v: number): number => {
  const norm = Math.min(1, v * 1000); // v is in relative-units / ms
  return Math.max(0.25, 1 - norm * 0.6);
};

/** Compute an axis-aligned bounding box in relative-space. */
export const computeBounds = (
  points: PilotV2PencilPoint[],
): { x: number; y: number; w: number; h: number } => {
  if (!points.length) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

/* -------------------------------------------------------------------------- */
/* Engine                                                                      */
/* -------------------------------------------------------------------------- */

export interface EngineConfig {
  /** Page width in pixels — used to convert screen → relative coords. */
  pageWidth: number;
  /** Page height in pixels. */
  pageHeight: number;
  /** When true: only stylus / pencil input is captured (palm rejection). */
  pencilOnly: boolean;
}

export class PencilAnnotationEngine {
  private strokes: PilotV2PencilStroke[] = [];
  private currentStroke: PilotV2PencilStroke | null = null;
  private currentPoints: PilotV2PencilPoint[] = [];
  private listeners: ChangeListener[] = [];

  private undoStack: EngineOp[] = [];
  private redoStack: EngineOp[] = [];

  private config: EngineConfig;
  /** Last captured screen coords — used to dedupe noisy gesture events. */
  private lastSampleAt = 0;
  /** Currently-active tool / color / width — set by the toolbar. */
  private tool: PilotV2PencilTool = 'pen';
  private color = '#0F172A';
  private width = 2;
  private opacity = 1;
  /** Set of strokes flagged for deletion in the active eraser drag. */
  private eraseHits: Set<string> = new Set();
  /** When true, freehand strokes are auto-snapped to recognised shapes. */
  private shapeRecognition = false;

  constructor(initial: PilotV2PencilStroke[] = [], config: EngineConfig) {
    this.strokes = [...initial];
    this.config = { ...config };
  }

  /* -------------------- public API -------------------- */

  setConfig(patch: Partial<EngineConfig>) {
    this.config = { ...this.config, ...patch };
  }

  getConfig(): EngineConfig {
    return { ...this.config };
  }

  setTool(tool: PilotV2PencilTool) { this.tool = tool; }
  setColor(c: string)              { this.color = c; }
  setWidth(w: number)               { this.width = w; }
  setOpacity(o: number)             { this.opacity = Math.max(0, Math.min(1, o)); }

  /** When true, freehand strokes are auto-snapped to circle/rectangle/arrow. */
  setShapeRecognition(on: boolean) { this.shapeRecognition = on; }
  isShapeRecognition(): boolean { return this.shapeRecognition; }

  /** All strokes (already-persisted + the live one being drawn). */
  getAll(): PilotV2PencilStroke[] {
    return this.currentStroke
      ? [...this.strokes, this.currentStroke]
      : this.strokes;
  }

  /** Persisted strokes only (excludes the in-progress one). */
  getPersisted(): PilotV2PencilStroke[] {
    return [...this.strokes];
  }

  getCurrent(): PilotV2PencilStroke | null {
    return this.currentStroke;
  }

  replaceAll(strokes: PilotV2PencilStroke[]) {
    this.strokes = [...strokes];
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  subscribe(fn: ChangeListener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  /* -------------------- input -------------------- */

  /** Returns true when the engine should accept this input event.
   *  Palm rejection: when `pencilOnly` is true, only stylus events pass. */
  shouldAccept(pointerType: 'touch' | 'stylus' | 'mouse' | 'unknown'): boolean {
    if (!this.config.pencilOnly) return true;
    return pointerType === 'stylus';
  }

  /** Begin a new stroke at screen coords (px) inside the canvas. */
  startStroke(screenX: number, screenY: number, pressure = 0.5): void {
    if (this.tool === 'eraser') {
      this.eraseHits = new Set();
      this.eraseHitTest(screenX, screenY);
      return;
    }
    const point = this.toRelativePoint(screenX, screenY, pressure);
    this.currentPoints = [point];
    this.currentStroke = {
      id: newStrokeId(),
      tool: this.tool,
      color: this.color,
      width: this.width,
      opacity: this.tool === 'highlighter' ? 0.35 : this.opacity,
      points: [point],
      zIndex: this.strokes.length,
      createdAt: nowIso(),
    };
    this.lastSampleAt = Date.now();
    this.notify();
  }

  /** Add a point to the active stroke. */
  addPoint(screenX: number, screenY: number, pressure?: number): void {
    if (this.tool === 'eraser') {
      this.eraseHitTest(screenX, screenY);
      return;
    }
    if (!this.currentStroke) return;

    const now = Date.now();
    // 4ms throttle — matches Soft Notes
    if (now - this.lastSampleAt < 4) return;
    this.lastSampleAt = now;

    const prev = this.currentPoints[this.currentPoints.length - 1];
    const point = this.toRelativePoint(screenX, screenY, pressure ?? 0.5);

    if (pressure === undefined && prev) {
      const v = calcVelocity(prev, point);
      point.pressure = pressureFromVelocity(v);
    }

    this.currentPoints.push(point);
    this.currentStroke = {
      ...this.currentStroke,
      points: [...this.currentPoints],
    };
    this.notify();
  }

  /** Finish the current stroke and commit it to history. */
  endStroke(): PilotV2PencilStroke | null {
    if (this.tool === 'eraser') {
      const ids = Array.from(this.eraseHits);
      this.eraseHits = new Set();
      if (ids.length === 0) return null;
      const removed = this.strokes.filter(s => ids.includes(s.id));
      this.strokes = this.strokes.filter(s => !ids.includes(s.id));
      this.pushOp({ kind: 'remove', strokes: removed });
      this.notify();
      return null;
    }

    if (!this.currentStroke || this.currentPoints.length === 0) {
      this.currentStroke = null;
      this.currentPoints = [];
      return null;
    }

    let finalPoints = this.currentPoints;
    // Optional shape recognition — pen tool only, only when feature is on.
    if (this.shapeRecognition && this.tool === 'pen') {
      try {
        const result = recogniseShape({
          ...this.currentStroke,
          points: this.currentPoints,
        });
        if (result.points) finalPoints = result.points;
      } catch {
        /* fall through to raw stroke */
      }
    }

    const finished: PilotV2PencilStroke = {
      ...this.currentStroke,
      points: [...finalPoints],
      bounds: computeBounds(finalPoints),
    };
    this.strokes.push(finished);
    this.pushOp({ kind: 'add', strokes: [finished] });
    this.currentStroke = null;
    this.currentPoints = [];
    this.notify();
    return finished;
  }

  /** Cancel the in-progress stroke without committing. */
  cancelStroke(): void {
    this.currentStroke = null;
    this.currentPoints = [];
    this.eraseHits = new Set();
    this.notify();
  }

  /* -------------------- erase hit-test -------------------- */
  private eraseHitTest(screenX: number, screenY: number): void {
    const target = this.toRelativePoint(screenX, screenY, 0.5);
    const tol = 0.018; // ~1.8% of page edge in relative units
    for (const s of this.strokes) {
      if (this.eraseHits.has(s.id)) continue;
      const b = s.bounds || computeBounds(s.points);
      if (
        target.x < b.x - tol ||
        target.x > b.x + b.w + tol ||
        target.y < b.y - tol ||
        target.y > b.y + b.h + tol
      ) {
        continue;
      }
      for (const p of s.points) {
        if (Math.abs(p.x - target.x) < tol && Math.abs(p.y - target.y) < tol) {
          this.eraseHits.add(s.id);
          break;
        }
      }
    }
  }

  /* -------------------- undo / redo -------------------- */

  private pushOp(op: EngineOp) {
    this.undoStack.push(op);
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): EngineOp | null {
    const op = this.undoStack.pop();
    if (!op) return null;
    if (op.kind === 'add') {
      const ids = new Set(op.strokes.map(s => s.id));
      this.strokes = this.strokes.filter(s => !ids.has(s.id));
    } else {
      this.strokes = [...this.strokes, ...op.strokes].sort((a, b) => a.zIndex - b.zIndex);
    }
    this.redoStack.push(op);
    this.notify();
    return op;
  }

  redo(): EngineOp | null {
    const op = this.redoStack.pop();
    if (!op) return null;
    if (op.kind === 'add') {
      this.strokes = [...this.strokes, ...op.strokes].sort((a, b) => a.zIndex - b.zIndex);
    } else {
      const ids = new Set(op.strokes.map(s => s.id));
      this.strokes = this.strokes.filter(s => !ids.has(s.id));
    }
    this.undoStack.push(op);
    this.notify();
    return op;
  }

  clear(): void {
    if (this.strokes.length === 0) return;
    const removed = [...this.strokes];
    this.strokes = [];
    this.pushOp({ kind: 'remove', strokes: removed });
    this.notify();
  }

  /* -------------------- lasso selection -------------------- */

  /** Return the IDs of every stroke whose centroid lies inside the polygon.
   *  Polygon points must be in RELATIVE (0..1) coordinates. */
  selectInsidePolygon(poly: { x: number; y: number }[]): string[] {
    if (poly.length < 3) return [];
    const ids: string[] = [];
    for (const s of this.strokes) {
      let cx = 0, cy = 0;
      for (const p of s.points) { cx += p.x; cy += p.y; }
      cx /= s.points.length || 1;
      cy /= s.points.length || 1;
      if (this.pointInPolygon(cx, cy, poly)) ids.push(s.id);
    }
    return ids;
  }

  /** Translate every stroke in `ids` by (dx, dy) in relative units. */
  moveStrokes(ids: Set<string> | string[], dx: number, dy: number): void {
    const set = ids instanceof Set ? ids : new Set(ids);
    if (set.size === 0 || (dx === 0 && dy === 0)) return;
    this.strokes = this.strokes.map((s) => {
      if (!set.has(s.id)) return s;
      const points = s.points.map((p) => ({
        ...p,
        x: Math.max(0, Math.min(1, p.x + dx)),
        y: Math.max(0, Math.min(1, p.y + dy)),
      }));
      return { ...s, points, bounds: computeBounds(points) };
    });
    this.notify();
  }

  /** Remove the strokes in `ids`. Used by lasso "delete selection". */
  removeStrokes(ids: Set<string> | string[]): void {
    const set = ids instanceof Set ? ids : new Set(ids);
    if (set.size === 0) return;
    const removed = this.strokes.filter((s) => set.has(s.id));
    if (!removed.length) return;
    this.strokes = this.strokes.filter((s) => !set.has(s.id));
    this.pushOp({ kind: 'remove', strokes: removed });
    this.notify();
  }

  private pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x, yi = poly[i].y;
      const xj = poly[j].x, yj = poly[j].y;
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || 1e-9) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  /* -------------------- coordinate helper (public for lasso) -------------------- */

  toRelative(screenX: number, screenY: number): { x: number; y: number } {
    const w = Math.max(1, this.config.pageWidth);
    const h = Math.max(1, this.config.pageHeight);
    return {
      x: Math.max(0, Math.min(1, screenX / w)),
      y: Math.max(0, Math.min(1, screenY / h)),
    };
  }

  /* -------------------- internals -------------------- */

  private toRelativePoint(
    screenX: number,
    screenY: number,
    pressure: number,
  ): PilotV2PencilPoint {
    const w = Math.max(1, this.config.pageWidth);
    const h = Math.max(1, this.config.pageHeight);
    return {
      x: Math.max(0, Math.min(1, screenX / w)),
      y: Math.max(0, Math.min(1, screenY / h)),
      pressure: Math.max(0, Math.min(1, pressure)),
      t: Date.now(),
    };
  }

  private notify() {
    const snapshot = this.getAll();
    for (const fn of this.listeners) {
      try { fn(snapshot); } catch { /* ignore listener errors */ }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* SVG path helper — used by both PencilCanvas (Skia) and the export engine    */
/* -------------------------------------------------------------------------- */

/** Convert relative-space points → absolute-pixel SVG path with quadratic
 *  midpoint smoothing. The result mirrors the on-device Skia render so the
 *  unified export (PDF/Image) stays pixel-perfect. */
export function pencilStrokeToSvgPath(
  stroke: PilotV2PencilStroke,
  pageWidth: number,
  pageHeight: number,
): string {
  if (!stroke.points.length) return '';
  const pts = stroke.points;
  const x0 = pts[0].x * pageWidth;
  const y0 = pts[0].y * pageHeight;
  let d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur = pts[i];
    const px = prev.x * pageWidth, py = prev.y * pageHeight;
    const cx = cur.x * pageWidth,  cy = cur.y * pageHeight;
    const mx = (px + cx) / 2, my = (py + cy) / 2;
    d += ` Q ${px.toFixed(2)} ${py.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${(last.x * pageWidth).toFixed(2)} ${(last.y * pageHeight).toFixed(2)}`;
  return d;
}
