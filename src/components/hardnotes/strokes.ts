/**
 * Stroke model — a single pen/highlighter stroke stored as vector data.
 * Serialized into user_notes.items as { type: 'stroke', ...data }.
 */
export type ToolKind = 'pen' | 'highlighter' | 'eraser' | 'lasso' | 'tape';

export interface StrokePoint {
  x: number;
  y: number;
  /** Normalized pressure [0..1]. Defaults to 0.5 for finger / mouse input. */
  p: number;
  /** Tilt in radians (iPad Apple Pencil). 0 when unavailable. */
  t?: number;
}

export interface Stroke {
  id: string;
  tool: ToolKind;
  color: string;
  /** Base width in px. Final width = width * (0.5 + 0.5 * pressure). */
  width: number;
  /** For highlighter — opacity below 1. */
  opacity: number;
  points: StrokePoint[];
  created_at: string;
}

/** Build an SVG path `d` string from stroke points — used by Skia.Path.MakeFromSVGString. */
export function strokeToSvgPath(points: StrokePoint[]): string {
  if (!points.length) return '';
  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const prev = points[i - 1];
    // Quadratic smoothing using midpoints gives very clean ink.
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
}
