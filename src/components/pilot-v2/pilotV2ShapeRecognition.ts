/**
 * pilotV2ShapeRecognition — quick shape snap heuristics for Pencil
 * ----------------------------------------------------------------
 * Given the relative-coordinate point list of a stroke, decide whether the
 * user *probably* drew a square, circle or arrow and return a clean
 * replacement stroke. Returns null when the gesture is freehand.
 *
 * Heuristics are intentionally simple and local — they run on the JS thread
 * inside `endStroke()` so they must finish in <1ms.
 */
import { PilotV2PencilPoint, PilotV2PencilStroke } from './types';

interface Bounds { x: number; y: number; w: number; h: number; cx: number; cy: number; }

const computeBounds = (pts: PilotV2PencilPoint[]): Bounds => {
  let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return { x: minX, y: minY, w, h, cx: minX + w / 2, cy: minY + h / 2 };
};

/** Distance between first and last sampled point in relative units. */
const closureDist = (pts: PilotV2PencilPoint[]): number => {
  if (pts.length < 2) return Infinity;
  const a = pts[0], b = pts[pts.length - 1];
  return Math.hypot(a.x - b.x, a.y - b.y);
};

/** Returns true when the stroke's points look roughly like a circle. */
const looksLikeCircle = (pts: PilotV2PencilPoint[], b: Bounds): boolean => {
  if (pts.length < 12) return false;
  if (closureDist(pts) > 0.06) return false; // must close
  const r = (b.w + b.h) / 4;
  if (r < 0.02) return false; // too small
  // Variance of point distance to centre normalised by radius.
  let totalErr = 0;
  for (const p of pts) {
    const d = Math.hypot(p.x - b.cx, p.y - b.cy);
    totalErr += Math.abs(d - r) / r;
  }
  return totalErr / pts.length < 0.18;
};

/** Returns true when the stroke's points look roughly like a rectangle. */
const looksLikeRectangle = (pts: PilotV2PencilPoint[], b: Bounds): boolean => {
  if (pts.length < 8) return false;
  if (b.w < 0.04 || b.h < 0.04) return false;
  // 4 sharp turns with mostly axis-aligned segments → rectangle.
  let onEdge = 0;
  const tol = Math.max(b.w, b.h) * 0.18;
  for (const p of pts) {
    const nearLeft = Math.abs(p.x - b.x) < tol;
    const nearRight = Math.abs(p.x - (b.x + b.w)) < tol;
    const nearTop = Math.abs(p.y - b.y) < tol;
    const nearBottom = Math.abs(p.y - (b.y + b.h)) < tol;
    if (nearLeft || nearRight || nearTop || nearBottom) onEdge += 1;
  }
  return onEdge / pts.length > 0.7 && closureDist(pts) < 0.1;
};

/** Returns true when the stroke is dominantly straight (treated as arrow). */
const looksLikeArrow = (pts: PilotV2PencilPoint[], b: Bounds): boolean => {
  if (pts.length < 6) return false;
  const len = b.w + b.h;
  if (len < 0.1) return false;
  // For an arrow we expect: long mostly-straight body + a backwards "tick" near the end.
  const head = pts[0];
  const tail = pts[pts.length - 1];
  const trunk = Math.hypot(tail.x - head.x, tail.y - head.y);
  if (trunk < len * 0.5) return false;
  // The stroke should largely lie on the head-tail line.
  let off = 0;
  for (const p of pts) {
    // perpendicular distance to head→tail line
    const A = tail.y - head.y;
    const B = head.x - tail.x;
    const C = -(A * head.x + B * head.y);
    const denom = Math.hypot(A, B) || 1;
    off += Math.abs(A * p.x + B * p.y + C) / denom;
  }
  return off / pts.length < 0.04;
};

/** Replace the stroke point list with snapped geometry. */
function snapToCircle(b: Bounds): PilotV2PencilPoint[] {
  const r = (b.w + b.h) / 4;
  const out: PilotV2PencilPoint[] = [];
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push({
      x: b.cx + Math.cos(a) * r,
      y: b.cy + Math.sin(a) * r,
      pressure: 0.5,
      t: Date.now() + i,
    });
  }
  return out;
}

function snapToRectangle(b: Bounds): PilotV2PencilPoint[] {
  const t = Date.now();
  return [
    { x: b.x,       y: b.y,         pressure: 0.5, t },
    { x: b.x + b.w, y: b.y,         pressure: 0.5, t: t + 1 },
    { x: b.x + b.w, y: b.y + b.h,   pressure: 0.5, t: t + 2 },
    { x: b.x,       y: b.y + b.h,   pressure: 0.5, t: t + 3 },
    { x: b.x,       y: b.y,         pressure: 0.5, t: t + 4 },
  ];
}

function snapToArrow(pts: PilotV2PencilPoint[]): PilotV2PencilPoint[] {
  const head = pts[0];
  const tail = pts[pts.length - 1];
  // Build arrowhead — a chevron at the tail.
  const dx = tail.x - head.x;
  const dy = tail.y - head.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const tipBack = 0.04;          // length of arrowhead in relative units
  const tipSide = 0.025;         // half-width of arrowhead
  const baseX = tail.x - ux * tipBack;
  const baseY = tail.y - uy * tipBack;
  const leftX = baseX - uy * tipSide;
  const leftY = baseY + ux * tipSide;
  const rightX = baseX + uy * tipSide;
  const rightY = baseY - ux * tipSide;
  const t = Date.now();
  return [
    { x: head.x, y: head.y, pressure: 0.5, t },
    { x: tail.x, y: tail.y, pressure: 0.5, t: t + 1 },
    { x: leftX,  y: leftY,  pressure: 0.5, t: t + 2 },
    { x: tail.x, y: tail.y, pressure: 0.5, t: t + 3 },
    { x: rightX, y: rightY, pressure: 0.5, t: t + 4 },
  ];
}

export type RecognisedShape = 'circle' | 'rectangle' | 'arrow' | null;

export interface RecognitionResult {
  shape: RecognisedShape;
  points: PilotV2PencilPoint[] | null;
}

/** Run all heuristics. Returns a snapped point list when confident, else null. */
export function recogniseShape(stroke: PilotV2PencilStroke): RecognitionResult {
  const pts = stroke.points;
  if (!pts || pts.length < 6) return { shape: null, points: null };
  const b = computeBounds(pts);
  if (looksLikeRectangle(pts, b)) return { shape: 'rectangle', points: snapToRectangle(b) };
  if (looksLikeCircle(pts, b))    return { shape: 'circle',    points: snapToCircle(b) };
  if (looksLikeArrow(pts, b))     return { shape: 'arrow',     points: snapToArrow(pts) };
  return { shape: null, points: null };
}
