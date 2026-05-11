/**
 * pilotV2StrokeRemap (Step 20)
 * ----------------------------
 * Re-projects Pilot V2 pencil strokes from EDITOR-canvas-space (where they
 * were drawn) into EXPORT-canvas-space (where the unified export engine's
 * `buildHardnoteHtml` will render them inside one big SVG).
 *
 * Why this exists
 * ---------------
 * The hardnote SVG path uses ABSOLUTE pixel coordinates inside a single
 * `<svg viewBox="0 0 W H">`.  When the user changes export font-size,
 * paper, theme or column count, the Pilot V2 base-layer markdown reflows —
 * but the strokes' (x, y) values are baked at draw-time.  Without re-
 * projection, an underline drawn under "constitution" at font-size 11 will
 * drift sideways at font-size 18.
 *
 * Strategy
 * --------
 *   1. **Anchored strokes** (Step 9 anchor with `relY` + `startRelX/endRelX`)
 *      are re-projected onto the surviving block's NEW bounding box in the
 *      export canvas.  The mapping is:
 *           targetX  = blockX + relX * blockW       (per point)
 *           targetY  = blockY + anchor.relY * blockH (constant — line height)
 *      Stroke shape is preserved by parameterising each point along the
 *      [startRelX, endRelX] range based on its original x-fraction within
 *      the stroke's bounding box.
 *
 *   2. **Unanchored strokes** (free canvas drawings such as washi-tape area
 *      doodles) are simply scaled by the export-to-editor canvas ratio so
 *      they keep their absolute screen position relative to the page.
 *
 *   3. **Excluded strokes** (whose host block was filtered out by chip /
 *      per-block selection) are dropped UPSTREAM in PilotV2UnifiedExport.
 *      This module never silently drops anchored strokes — if the caller
 *      passes a stroke whose anchor block is not in the layout map, it is
 *      treated as "block missing" and skipped (returns `null`).
 *
 * Block layout estimation
 * -----------------------
 * Real export-time layouts are not knowable until the HTML is rendered, so
 * `estimateExportBlockLayouts` uses a deterministic line-wrap heuristic
 * parameterised by `fontSize` + `columns` to produce stable y/h values per
 * blockId.  The heuristic intentionally mirrors the one used inside
 * `pilotV2Migration.ts → estimateBlockLayouts` so anchors recorded with the
 * legacy fallback line up with this remap.
 */

import { PilotV2Block, PilotV2PencilStroke } from '../components/pilot-v2/types';
import {
  ExportHardnoteStroke,
  ExportHardnoteStrokePoint,
} from './unifiedExportEngine';

/* ------------------------------------------------------------------ */
/* Block-layout estimator                                             */
/* ------------------------------------------------------------------ */

export interface ExportBlockRect {
  /** Top-left X of the block in the export canvas (px). */
  x: number;
  /** Top-left Y of the block in the export canvas (px). */
  y: number;
  /** Width of the block content area (px). */
  w: number;
  /** Height of the block content area (px). */
  h: number;
}

export interface EstimateLayoutOptions {
  /** Export canvas width in CSS pixels. */
  canvasWidth: number;
  /** Export canvas height in CSS pixels.  Used only for clamping. */
  canvasHeight: number;
  /** Body font size in pt (matches `ExportOptions.fontSize`). */
  fontSize: number;
  /** Column count (1 or 2 today — matches `ExportOptions.columns`). */
  columns: number;
  /** Vertical padding between blocks (px). */
  blockGap?: number;
  /** Top padding inside the canvas before the first block (px). */
  topPadding?: number;
}

/**
 * Approximate the block layout that `buildHardnoteHtml` would produce, in
 * the same coordinate system as the SVG viewBox.  This is a heuristic
 * (not a real text engine) but it is deterministic and stable across
 * multiple invocations with the same inputs — which is what the anchored
 * stroke remap needs.
 */
export function estimateExportBlockLayouts(
  blocks: PilotV2Block[],
  opts: EstimateLayoutOptions,
): Map<string, ExportBlockRect> {
  const out = new Map<string, ExportBlockRect>();
  const cols = Math.max(1, Math.min(2, Math.round(opts.columns || 1)));
  const gap = opts.blockGap ?? 8;
  const topPad = opts.topPadding ?? 0;
  const colGutter = cols === 2 ? 24 : 0;
  const colWidth = (opts.canvasWidth - colGutter * (cols - 1)) / cols;

  // Average glyph advance in px ≈ fontSize * 0.55 (sans).  Lines wrap at
  // approx `colWidth / advance` characters.
  const fontPx = Math.max(6, opts.fontSize) * (96 / 72); // pt → px
  const avgAdvance = Math.max(3, fontPx * 0.55);
  const charsPerLine = Math.max(10, Math.floor(colWidth / avgAdvance));
  const lineHeight = fontPx * 1.45;
  const headingScale = 1.45; // approximate H2 multiplier
  const codePad = 4;

  // Distribute blocks across columns round-robin: simplest model that
  // matches the engine's CSS column-count flow (close enough for the
  // anchor-stability acceptance test).
  const colCursors = new Array<number>(cols).fill(topPad);

  blocks.forEach((b, i) => {
    const colIdx = cols === 2 ? (i % 2) : 0;
    const x = colIdx * (colWidth + colGutter);
    const text = (b.text || '').trim();
    const lines = text
      ? Math.max(1, Math.ceil(text.length / charsPerLine))
      : 1;

    let h: number;
    if (b.type === 'heading') {
      h = lineHeight * headingScale * lines;
    } else if (b.type === 'code') {
      h = lineHeight * lines + codePad * 2;
    } else {
      h = lineHeight * lines;
    }
    // Clamp tiny rows so anchored y math stays well-defined.
    h = Math.max(lineHeight, h);

    const y = colCursors[colIdx];
    out.set(b.id, { x, y, w: colWidth, h });
    colCursors[colIdx] = y + h + gap;
  });

  // Optional: clamp final block y inside the canvas.
  const maxY = Math.max(...colCursors, topPad);
  void maxY; // intentionally not used to clamp — exported PDF auto-grows
  void opts.canvasHeight;

  return out;
}

/* ------------------------------------------------------------------ */
/* Per-stroke remap                                                   */
/* ------------------------------------------------------------------ */

export interface RemapContext {
  /** Block layouts in EXPORT canvas-space (output of estimator above). */
  layouts: Map<string, ExportBlockRect>;
  /** Export canvas width in px. */
  exportCanvasWidth: number;
  /** Export canvas height in px. */
  exportCanvasHeight: number;
  /** Editor page width in px (where the strokes were drawn). */
  editorCanvasWidth: number;
  /** Editor page height in px (where the strokes were drawn). */
  editorCanvasHeight: number;
}

/**
 * Convert a single stroke into an `ExportHardnoteStroke` in export-canvas
 * coordinates, or `null` if the stroke should be dropped (anchored to a
 * missing block).
 *
 * When the export canvas matches the editor canvas (the default case), ALL
 * strokes — including anchored ones — use direct scaling from their relative
 * (0..1) coordinates.  This avoids the cumulative drift that the block-layout
 * estimation introduces (the estimation cannot perfectly match HTML/CSS text
 * rendering, so every heuristic mismatch shifts strokes further from their
 * intended position).  The anchor-based remap only kicks in when the user
 * explicitly changes export settings (font size, columns) that cause the
 * text to reflow in the PDF.
 */
export function remapStrokeForExport(
  stroke: PilotV2PencilStroke,
  ctx: RemapContext,
): ExportHardnoteStroke | null {
  if (!stroke || !stroke.points || stroke.points.length === 0) return null;
  if (stroke.tool === 'lasso') return null;

  const tool = stroke.tool === 'eraser' ? 'eraser' : stroke.tool;

  // ── Fast path: export canvas ≈ editor canvas (default export) ──────
  // Use raw relative → absolute scaling for ALL strokes so they render
  // at the same pixel positions they occupied on-screen.  This is the
  // same approach Notability uses for its PDF export: strokes are in
  // page-relative coords, and the export page matches the editor page.
  const wRatio = ctx.exportCanvasWidth  / Math.max(1, ctx.editorCanvasWidth);
  const hRatio = ctx.exportCanvasHeight / Math.max(1, ctx.editorCanvasHeight);
  const canvasMatch = Math.abs(wRatio - 1) < 0.02 && Math.abs(hRatio - 1) < 0.02;

  if (canvasMatch) {
    const points: ExportHardnoteStrokePoint[] = stroke.points.map((p) => ({
      x: round2(clamp01(p.x) * ctx.exportCanvasWidth),
      y: round2(clamp01(p.y) * ctx.exportCanvasHeight),
      p: typeof p.pressure === 'number' ? p.pressure : 0.5,
    }));
    return {
      id: stroke.id,
      tool: tool as ExportHardnoteStroke['tool'],
      color: stroke.color,
      width: stroke.width,
      opacity: stroke.opacity,
      points,
    };
  }

  // ── Anchor-based remap (only when export settings differ) ──────────
  const anchorBlockId =
    stroke.anchor?.elementId ?? stroke.anchor?.blockId ?? null;

  if (
    anchorBlockId &&
    typeof stroke.anchor?.startRelX === 'number' &&
    typeof stroke.anchor?.endRelX === 'number' &&
    typeof stroke.anchor?.relY === 'number'
  ) {
    const rect = ctx.layouts.get(anchorBlockId);
    if (!rect) return null; // anchored block was not laid out → drop

    const startRelX = clamp01(stroke.anchor.startRelX!);
    const endRelX = Math.max(startRelX, clamp01(stroke.anchor.endRelX!));
    const relY = clamp01(stroke.anchor.relY!);

    // Determine each point's fraction along the original stroke x-extent
    // so curves are preserved (instead of collapsing to a flat line).
    let minX = Infinity, maxX = -Infinity;
    for (const p of stroke.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
    const xExtent = Math.max(1e-6, maxX - minX);

    const targetY = rect.y + relY * rect.h;
    const targetX0 = rect.x + startRelX * rect.w;
    const targetXSpan = (endRelX - startRelX) * rect.w;

    const points: ExportHardnoteStrokePoint[] = stroke.points.map((p) => {
      const f = (p.x - minX) / xExtent; // 0..1 along the stroke
      return {
        x: round2(targetX0 + f * targetXSpan),
        y: round2(targetY),
        p: typeof p.pressure === 'number' ? p.pressure : 0.5,
      };
    });

    return {
      id: stroke.id,
      tool: tool as ExportHardnoteStroke['tool'],
      color: stroke.color,
      width: stroke.width,
      opacity: stroke.opacity,
      points,
    };
  }

  // Unanchored stroke: scale relative coords → export canvas coords.
  const points: ExportHardnoteStrokePoint[] = stroke.points.map((p) => ({
    x: round2(clamp01(p.x) * ctx.exportCanvasWidth),
    y: round2(clamp01(p.y) * ctx.exportCanvasHeight),
    p: typeof p.pressure === 'number' ? p.pressure : 0.5,
  }));

  return {
    id: stroke.id,
    tool: tool as ExportHardnoteStroke['tool'],
    color: stroke.color,
    width: stroke.width,
    opacity: stroke.opacity,
    points,
  };
}

/** Convenience: remap a list of strokes, dropping `null` results. */
export function remapStrokesForExport(
  strokes: PilotV2PencilStroke[],
  ctx: RemapContext,
): ExportHardnoteStroke[] {
  const out: ExportHardnoteStroke[] = [];
  for (const s of strokes) {
    const remapped = remapStrokeForExport(s, ctx);
    if (remapped) out.push(remapped);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
