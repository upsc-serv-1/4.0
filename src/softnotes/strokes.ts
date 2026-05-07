/**
 * Soft Notes — stroke smoothing + SVG-path rendering utilities.
 *
 * Implements the Catmull-Rom → cubic-Bezier conversion from
 * `Hardnotes upgrade/4. NOTABILITY_IMPLEMENTATION_GUIDE.md §Stroke smoothing`.
 *
 * All functions are pure; safe to call from worklet OR JS thread.
 */
import { SoftStrokePoint, BezierPoint, SoftStroke } from './types';

// ============================================================================
// Velocity & pressure
// ============================================================================
export function calculateVelocity(p0: SoftStrokePoint, p1: SoftStrokePoint): number {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dt = (p1.timestamp - p0.timestamp) || 1;
  return Math.sqrt(dx * dx + dy * dy) / dt;
}

/**
 * Pressure heuristic for finger / mouse input.
 * Faster motion → thinner stroke (mimics flicked pen).
 */
export function pressureFromVelocity(v: number): number {
  // velocity in px/ms — typical fast flicks ~3 px/ms
  const norm = Math.min(1, v / 3);
  return Math.max(0.25, 1 - norm * 0.6);
}

// ============================================================================
// Catmull-Rom → Cubic Bezier
// (from file 4, with sane edge handling)
// ============================================================================
function catmullRomCP(p0: SoftStrokePoint, p1: SoftStrokePoint, p2: SoftStrokePoint, alpha: number) {
  return {
    x: p1.x + (p2.x - p0.x) * alpha / 6,
    y: p1.y + (p2.y - p0.y) * alpha / 6,
  };
}

export function smoothStroke(points: SoftStrokePoint[]): BezierPoint[] {
  if (points.length === 0) return [];
  if (points.length < 3) {
    return points.map((p) => ({
      x: p.x, y: p.y,
      cp_in_x: p.x, cp_in_y: p.y,
      cp_out_x: p.x, cp_out_y: p.y,
      pressure: p.pressure,
      velocity: 0,
    }));
  }
  const out: BezierPoint[] = [];
  for (let i = 0; i < points.length; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(points.length - 1, i + 1)];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cpIn  = catmullRomCP(p0, p1, p2, 0.5);
    const cpOut = catmullRomCP(p1, p2, p3, 0.5);
    const v = i > 0 ? calculateVelocity(points[i - 1], p1) : 0;
    out.push({
      x: p1.x, y: p1.y,
      cp_in_x: cpIn.x, cp_in_y: cpIn.y,
      cp_out_x: cpOut.x, cp_out_y: cpOut.y,
      pressure: p1.pressure,
      velocity: v,
    });
  }
  return out;
}

// ============================================================================
// SVG path builder for Skia.Path.MakeFromSVGString()
// ============================================================================
export function bezierToSvgPath(bezier: BezierPoint[]): string {
  if (!bezier.length) return '';
  let d = `M ${bezier[0].x.toFixed(2)} ${bezier[0].y.toFixed(2)}`;
  for (let i = 1; i < bezier.length; i++) {
    const prev = bezier[i - 1];
    const cur  = bezier[i];
    d += ` C ${prev.cp_out_x.toFixed(2)} ${prev.cp_out_y.toFixed(2)} ` +
         `${cur.cp_in_x.toFixed(2)} ${cur.cp_in_y.toFixed(2)} ` +
         `${cur.x.toFixed(2)} ${cur.y.toFixed(2)}`;
  }
  return d;
}

/** Convenience — raw → smoothed → SVG. */
export function rawPointsToSvgPath(points: SoftStrokePoint[]): string {
  return bezierToSvgPath(smoothStroke(points));
}

// ============================================================================
// Bounding box helpers
// ============================================================================
export function computeBoundingBox(points: SoftStrokePoint[]): { x: number; y: number; width: number; height: number } {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ============================================================================
// Point-in-polygon (lasso selection)
// ============================================================================
export function pointInPolygon(x: number, y: number, polygon: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > y) !== (yj > y)) &&
                      (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** A stroke is in the lasso if its bounding box centre is inside the polygon. */
export function strokesInPolygon(strokes: SoftStroke[], polygon: { x: number; y: number }[]): string[] {
  const out: string[] = [];
  for (const s of strokes) {
    const b = s.bounding_box || computeBoundingBox(s.raw_points);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    if (pointInPolygon(cx, cy, polygon)) out.push(s.id);
  }
  return out;
}

// ============================================================================
// Screen ↔ canvas-space conversion (for pinch-zoom + pan)
// ============================================================================
export function screenToCanvas(
  screenX: number, screenY: number,
  zoom: number, panX: number, panY: number,
): { x: number; y: number } {
  return { x: (screenX - panX) / zoom, y: (screenY - panY) / zoom };
}

export function canvasToScreen(
  canvasX: number, canvasY: number,
  zoom: number, panX: number, panY: number,
): { x: number; y: number } {
  return { x: canvasX * zoom + panX, y: canvasY * zoom + panY };
}
