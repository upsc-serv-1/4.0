/**
 * PencilCanvas — Pilot V2 Step 6 + Step 8 (lasso)
 * -----------------------------------------------
 * Single page-level continuous Skia drawing surface. Strokes live on an
 * independent layer so the underlying text blocks remain editable & selectable
 * at all times — exactly per Phase 3 spec in PILOT_V2_GAPS.md.
 *
 * Coordinates inside `engine` are RELATIVE (0..1) so panning, pinching, or
 * resizing the page never causes scale drift.
 *
 * Step 8 adds a lasso tool: when the active tool is 'lasso', a dashed
 * polygon is drawn while the user pans, and on release the strokes inside
 * are selected. A floating "Move / Delete" pill is shown next to the
 * selection.
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Canvas, Path, Group, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import {
  PencilAnnotationEngine,
  pencilStrokeToSvgPath,
} from './PencilAnnotationEngine';
import { PilotV2PencilStroke, PilotV2PencilTool } from './types';

interface Props {
  /** Persistent engine instance owning all strokes for this page. */
  engine: PencilAnnotationEngine;
  /** Active tool — used to switch behaviour for lasso. */
  tool?: PilotV2PencilTool;
  /** Width of the page in px (full editor width). */
  width: number;
  /** Height of the page in px (full document height). */
  height: number;

  /** When false, the canvas is purely visual & lets touches pass through. */
  drawingMode: boolean;
  /** Called after every committed stroke — host persists to MMKV/Supabase. */
  onCommit?: (strokes: PilotV2PencilStroke[]) => void;
  /** Optional testID for end-to-end tests. */
  testID?: string;
  /** Current block layout map keyed by blockId (pixels within the page).
   *  Passed through to CommittedStrokesLayer so anchored strokes can be
   *  repositioned when blocks move or the page width changes (sidebar
   *  show/hide) — the Notability-style word-tracking transform. */
  blockLayouts?: Map<string, { x: number; y: number; w: number; h: number }>;
  /** Opaque counter that increments whenever blockLayouts changes.
   *  Forces CommittedStrokesLayer to re-render and recompute offsets. */
  blockLayoutVersion?: number;
}

/** Compose hex color + 0..1 alpha into an 8-digit hex Skia accepts. */
const withAlpha = (hex: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${ah}`;
  return hex;
};

export function PencilCanvas({
  engine, tool = 'pen', width, height, drawingMode, onCommit, testID,
  blockLayouts, blockLayoutVersion = 0,
}: Props) {
  const [committedStrokes, setCommittedStrokes] = useState<PilotV2PencilStroke[]>(engine.getPersisted());
  const [activeStroke, setActiveStroke] = useState<PilotV2PencilStroke | null>(engine.getCurrent());

  // Lasso state — polygon being drawn + active selection.
  const [lassoPolygon, setLassoPolygon] = useState<{ x: number; y: number }[]>([]);
  const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set());
  const [selectionBounds, setSelectionBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const moveOriginRef = useRef<{ x: number; y: number } | null>(null);

  // Skia path cache moved into <CommittedStrokesLayer> — see bottom of file.

  // ===== Active-stroke fast-path =====
  // Building a native Skia.Path via MakeFromSVGString on every move event is
  // the single biggest source of write lag in Pilot V2 (each point allocates
  // a fresh native object across the JSI bridge). Instead we keep the active
  // stroke as a plain SVG-path STRING, append one quadratic segment per new
  // point (O(1)) and pass that string directly to <Path> — Skia accepts both
  // strings and Path objects, but the string path stays on the JS thread so
  // there is no per-point native allocation. This mirrors Soft Notes which
  // already runs at full 120 Hz on iPad Pro.
  const activePathStrRef = useRef<string>('');
  const activeLastIdxRef = useRef<number>(-1);
  const activeStrokeIdRef = useRef<string | null>(null);
  const [activePathStr, setActivePathStr] = useState<string>('');

  const buildActivePath = useCallback((stroke: PilotV2PencilStroke): string => {
    if (!stroke.points.length) return '';
    // Reset the incremental string when the active stroke identity changes
    // (new stroke after endStroke or after a tool/colour change).
    if (activeStrokeIdRef.current !== stroke.id) {
      activeStrokeIdRef.current = stroke.id;
      activePathStrRef.current = '';
      activeLastIdxRef.current = -1;
    }

    const pts = stroke.points;
    const n = pts.length;
    let d = activePathStrRef.current;
    let i = activeLastIdxRef.current;

    if (i < 0) {
      const x0 = pts[0].x * width;
      const y0 = pts[0].y * height;
      d = `M ${x0.toFixed(2)} ${y0.toFixed(2)}`;
      i = 0;
    }
    // Append a quadratic segment for every new point since last build.
    for (let k = i + 1; k < n; k++) {
      const prev = pts[k - 1];
      const cur = pts[k];
      const px = prev.x * width, py = prev.y * height;
      const cx = cur.x * width, cy = cur.y * height;
      const mx = (px + cx) / 2, my = (py + cy) / 2;
      d += ` Q ${px.toFixed(2)} ${py.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
    }
    activePathStrRef.current = d;
    activeLastIdxRef.current = n - 1;
    // Final L to the latest point so the visible head of the stroke matches
    // the finger position exactly. We rebuild only this trailing segment per
    // frame which is cheap and keeps the head crisp without re-walking the
    // whole point array.
    const last = pts[n - 1];
    return `${d} L ${(last.x * width).toFixed(2)} ${(last.y * height).toFixed(2)}`;
  }, [width, height]);

  // Reset the incremental cache when the user finishes / cancels a stroke or
  // switches tools so the next stroke starts clean.
  const resetActivePath = useCallback(() => {
    activePathStrRef.current = '';
    activeLastIdxRef.current = -1;
    activeStrokeIdRef.current = null;
    setActivePathStr('');
  }, []);

  useEffect(() => {
    engine.setConfig({ pageWidth: width, pageHeight: height });
  }, [engine, width, height]);

  useEffect(() => {
    // PERSISTED listener — refresh the committed-strokes layer ONLY when a
    // stroke is added/removed/undone/redone/replaced. This subscription
    // never fires during the live move loop (see PencilAnnotationEngine),
    // so the committed <Path> tree stays mounted untouched while drawing.
    const unsubPersisted = engine.subscribePersisted((persisted) => {
      setCommittedStrokes(persisted);
    });
    // ACTIVE listener — fires on EVERY move event. We rebuild the live SVG
    // path string incrementally and feed it to a tiny <ActivePathLayer>
    // that is the ONLY component re-rendering during the drag. All other
    // committed strokes + the editor blocks stay perfectly still.
    const unsubActive = engine.subscribeActive((current) => {
      setActiveStroke(current);
      if (current) {
        setActivePathStr(buildActivePath(current));
      } else {
        resetActivePath();
      }
    });
    return () => {
      unsubPersisted();
      unsubActive();
    };
  }, [engine, buildActivePath, resetActivePath]);

  // When the user switches away from lasso, drop the selection.
  useEffect(() => {
    if (tool !== 'lasso') {
      setLassoPolygon([]);
      setSelectionIds(new Set());
      setSelectionBounds(null);
    }
  }, [tool]);

  function handleStart(x: number, y: number, pointerType?: string) {
    if (!drawingMode) return;
    if (engine.getConfig().pencilOnly && pointerType !== 'stylus') return;
    if (tool === 'lasso') {
      const rel = engine.toRelative(x, y);
      setLassoPolygon([rel]);
      setSelectionIds(new Set());
      setSelectionBounds(null);
      return;
    }
    engine.startStroke(x, y);
  }
  function handleMove(x: number, y: number, pointerType?: string) {
    if (!drawingMode) return;
    if (engine.getConfig().pencilOnly && pointerType !== 'stylus') return;
    if (tool === 'lasso') {
      const rel = engine.toRelative(x, y);
      setLassoPolygon((prev) => [...prev, rel]);
      return;
    }
    engine.addPoint(x, y);
  }
  function handleEnd() {
    if (!drawingMode) return;
    if (tool === 'lasso') {
      setLassoPolygon((poly) => {
        if (poly.length < 3) return [];
        const ids = engine.selectInsidePolygon(poly);
        setSelectionIds(new Set(ids));
        if (ids.length) {
          // Compute bounds of selection (relative space).
          let minX = 1, minY = 1, maxX = 0, maxY = 0;
          for (const s of engine.getPersisted()) {
            if (!ids.includes(s.id)) continue;
            for (const p of s.points) {
              if (p.x < minX) minX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.x > maxX) maxX = p.x;
              if (p.y > maxY) maxY = p.y;
            }
          }
          setSelectionBounds({ x: minX, y: minY, w: maxX - minX, h: maxY - minY });
        }
        return poly; // keep polygon visible until user dismisses
      });
      return;
    }
    engine.endStroke();
    onCommit?.(engine.getPersisted());
  }

  const drawGesture = useMemo(() => {
    // UI-thread throttle — drop sub-frame events before incurring the
    // runOnJS bridge cost. 4 ms ≈ 240 Hz, plenty for ProMotion 120 Hz
    // pencil input but cheap to filter on the UI thread.
    const lastUI = { t: 0 };
    const ended = { v: false };
    return Gesture.Pan()
      .minDistance(0)
      .maxPointers(1)
      .enabled(drawingMode)
      .onBegin((e) => {
        'worklet';
        ended.v = false;
        lastUI.t = 0;
        runOnJS(handleStart)(e.x, e.y, e.pointerType);
      })
      .onUpdate((e) => {
        'worklet';
        const now = Date.now();
        if (now - lastUI.t < 4) return;
        lastUI.t = now;
        runOnJS(handleMove)(e.x, e.y, e.pointerType);
      })
      .onEnd(() => {
        'worklet';
        if (ended.v) return;
        ended.v = true;
        runOnJS(handleEnd)();
      })
      .onFinalize(() => {
        'worklet';
        if (ended.v) return;
        ended.v = true;
        runOnJS(handleEnd)();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingMode, tool]);

  /* -------- selection actions -------- */
  const dismissSelection = () => {
    setLassoPolygon([]);
    setSelectionIds(new Set());
    setSelectionBounds(null);
  };
  const deleteSelection = () => {
    if (!selectionIds.size) return;
    engine.removeStrokes(selectionIds);
    onCommit?.(engine.getPersisted());
    dismissSelection();
  };
  const moveSelection = (dxScreen: number, dyScreen: number) => {
    if (!selectionIds.size) return;
    const dx = dxScreen / Math.max(1, width);
    const dy = dyScreen / Math.max(1, height);
    engine.moveStrokes(selectionIds, dx, dy);
    onCommit?.(engine.getPersisted());
    setSelectionBounds((b) => b && { ...b, x: b.x + dx, y: b.y + dy });
  };

  return (
    <View
      testID={testID || 'pilot-v2-pencil-canvas'}
      pointerEvents={drawingMode ? 'auto' : 'none'}
      style={[styles.layer, { width, height }]}
      collapsable={false}
    >
      <GestureDetector gesture={drawGesture}>
        <Animated.View style={{ width, height }}>
          <Canvas style={{ width, height }}>
            <Group>
              {/* Committed strokes — memoised so they DO NOT re-render when
                  the active path string updates on every move event. */}
              <CommittedStrokesLayer strokes={committedStrokes} width={width} height={height} blockLayouts={blockLayouts} blockLayoutVersion={blockLayoutVersion} />

              {/* Render active stroke separately — uses a string-path
                  fast-path so each new point is an O(1) string append on
                  the JS thread, avoiding the per-point JSI allocation that
                  Skia.Path.MakeFromSVGString incurs. This is the change
                  that brings Pilot V2 ink latency down to Soft Notes
                  levels on iPad Pro. */}
              {activeStroke && activePathStr ? (() => {
                const isHL = activeStroke.tool === 'highlighter';
                const colorHex = withAlpha(activeStroke.color, isHL ? activeStroke.opacity : 1);
                return (
                  <Path
                    key={activeStroke.id}
                    path={activePathStr}
                    color={colorHex}
                    style="stroke"
                    strokeWidth={isHL ? activeStroke.width * 1.6 : activeStroke.width}
                    strokeCap="round"
                    strokeJoin="round"
                    blendMode={isHL ? 'multiply' : undefined}
                  />
                );
              })() : null}

              {/* Active lasso polygon */}
              {lassoPolygon.length > 1 ? (() => {
                const d = lassoPolygon
                  .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * width).toFixed(2)} ${(p.y * height).toFixed(2)}`)
                  .join(' ') + ' Z';
                const path = Skia.Path.MakeFromSVGString(d);
                if (!path) return null;
                return (
                  <Path
                    key="lasso-poly"
                    path={path}
                    color="#5B4EFA"
                    style="stroke"
                    strokeWidth={1.5}
                    strokeJoin="round"
                  />
                );
              })() : null}
            </Group>
          </Canvas>
        </Animated.View>
      </GestureDetector>

      {/* Floating selection pill — drag to move, tap delete */}
      {tool === 'lasso' && selectionBounds && selectionIds.size > 0 ? (
        <SelectionPill
          bounds={selectionBounds}
          width={width}
          height={height}
          count={selectionIds.size}
          onMove={moveSelection}
          onDelete={deleteSelection}
          onDismiss={dismissSelection}
        />
      ) : null}
    </View>
  );
}

interface SelectionPillProps {
  bounds: { x: number; y: number; w: number; h: number };
  width: number;
  height: number;
  count: number;
  onMove: (dx: number, dy: number) => void;
  onDelete: () => void;
  onDismiss: () => void;
}
function SelectionPill({ bounds, width, height, count, onMove, onDelete, onDismiss }: SelectionPillProps) {
  // Position pill at top-right of selection bounding box.
  const left = Math.min(width - 220, Math.max(8, bounds.x * width));
  const top = Math.max(8, bounds.y * height - 40);

  const dragGesture = useMemo(() => {
    return Gesture.Pan()
      .onUpdate((e) => {
        'worklet';
        // Use RNGH's incremental delta (changeX/changeY) — this is the
        // distance since the previous update event, perfect for translating
        // the selection by exactly what the finger moved on this frame.
        // The previous implementation used mutable closure vars (let lastX)
        // which DO NOT persist reliably across worklet invocations — each
        // update saw lastX=0 and applied the cumulative translationX as a
        // delta, causing strokes to teleport / clamp to the canvas corner
        // (visually appearing to "delete themselves").
        runOnJS(onMove)(e.changeX, e.changeY);
      });
  }, [onMove]);

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left, top, flexDirection: 'row', gap: 6, zIndex: 10 }}
    >
      <GestureDetector gesture={dragGesture}>
        <Animated.View
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 18,
            backgroundColor: '#5B4EFA',
            shadowColor: '#000',
            shadowOpacity: 0.18,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
            ☰  Drag to move ({count})
          </Text>
        </Animated.View>
      </GestureDetector>
      <TouchableOpacity
        testID="pilot-v2-lasso-delete"
        onPress={onDelete}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 18,
          backgroundColor: '#EF4444',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Delete</Text>
      </TouchableOpacity>
      <TouchableOpacity
        testID="pilot-v2-lasso-dismiss"
        onPress={onDismiss}
        style={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 18,
          backgroundColor: '#0F172A',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Done</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});

/* -------------------------------------------------------------------------- */
/* CommittedStrokesLayer                                                       */
/*                                                                             */
/*   Renders the persisted-strokes <Path> tree. Wrapped in React.memo so it    */
/*   reconciles ONLY when the strokes array itself (or page dimensions) is    */
/*   replaced — never on every active-stroke point update. This is what       */
/*   keeps the committed ink layer perfectly still while a new stroke is in   */
/*   progress, eliminating frame drops on long notes.                          */
/* -------------------------------------------------------------------------- */
interface CommittedLayerProps {
  strokes: PilotV2PencilStroke[];
  width: number;
  height: number;
  /** Current block positions in pixels within the page.  When present,
   *  anchored strokes are repositioned using their span-anchor data (startRelX,
   *  endRelX, relY) so they follow the text they annotate even when page width
   *  changes (e.g. sidebar show/hide) — exactly how Notability keeps strokes
   *  locked to words despite zoom / resize.  Falls back to Y-only delta for
   *  strokes that lack span-offset data (legacy anchors). */
  blockLayouts?: Map<string, { x: number; y: number; w: number; h: number }>;
  /** Increments when blockLayouts changes, forcing the memo to re-run. */
  blockLayoutVersion: number;
}
const CommittedStrokesLayer = React.memo(function CommittedStrokesLayer({
  strokes, width, height, blockLayouts, blockLayoutVersion,
}: CommittedLayerProps) {
  // Per-instance Skia path cache — rebuilt only when this layer re-renders,
  // i.e. when the persisted-strokes array reference or blockLayoutVersion changes.
  const cache = useRef<Map<string, { path: any; w: number; h: number }>>(new Map());
  const prevVersionRef = useRef(0);
  // Invalidate the whole path cache when block layouts change so anchored
  // strokes get new Skia paths with the correct reorder offsets applied.
  if (prevVersionRef.current !== blockLayoutVersion) {
    cache.current.clear();
    prevVersionRef.current = blockLayoutVersion;
  }

  /** Reproject an anchored stroke onto its host block's CURRENT position.
   *
   *  **Notability / GoodNotes approach — word-tracking anchors:**
   *
   *  Strokes that carry span-anchor data (startRelX, endRelX, relY) are
   *  fully reprojected: every point is mapped from "fraction along the
   *  original stroke x-extent" to the same fraction within the block's
   *  current bounding box.  This handles:
   *    • sidebar show / hide changing page width  (horizontal shift)
   *    • block reorder changing page position      (vertical shift)
   *    • zoom / resize                              (both axes)
   *
   *  **Important:** startRelX/endRelX are stored as PAGE-relative fractions
   *  (0..1 of page width).  To reproject correctly after a page width change
   *  (e.g. sidebar toggle), we first compute the absolute pixel position
   *  using the CURRENT page width, then map that onto the block's current
   *  bounding box to derive the block-relative fraction for rendering.
   *
   *  Strokes with a legacy anchor (blockId + blockOriginY only) fall back
   *  to the original Y-delta logic.
   */
  const applyBlockOffset = (s: PilotV2PencilStroke): PilotV2PencilStroke => {
    if (!s.anchor || !blockLayouts?.size || height <= 0 || width <= 0) return s;

    const blockRect = blockLayouts.get(s.anchor.blockId);
    if (!blockRect) return s;

    // ── Full span-anchor reprojection (page-relative anchors) ─────────
    // startRelX/endRelX are PAGE-relative (0..1 of page width).
    // We take startRelX * currentWidth to get the absolute pixel X in the
    // current page coordinate system, then find where that falls within
    // the block's current bounding box to get block-relative fractions.
    if (
      typeof s.anchor.startRelX === 'number' &&
      typeof s.anchor.endRelX === 'number' &&
      typeof s.anchor.relY === 'number'
    ) {
      // ── Y-axis: use pageRelY when available (orientation-safe) ─────────
      // When pageRelY is present, we compute the absolute Y pixel via
      // pageRelY * currentHeight, then find where that falls within the
      // block's current bounding box.  This correctly handles orientation
      // changes where BOTH width and height may change.
      // Falls back to block-relative relY when pageRelY is absent.
      let targetY: number;
      if (typeof s.anchor.pageRelY === 'number') {
        const absY = s.anchor.pageRelY * height;
        const blockRelY = Math.max(0, Math.min(1,
          (absY - blockRect.y) / Math.max(1, blockRect.h)
        ));
        targetY = (blockRect.y + blockRelY * blockRect.h) / height;
      } else {
        targetY = (blockRect.y + Math.max(0, Math.min(1, s.anchor.relY)) * blockRect.h) / height;
      }

      // Determine each point's fraction along the original stroke extent
      // so the stroke's shape (curves, pressure variance) is preserved.
      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (const p of s.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
      const xExtent = Math.max(1e-9, maxX - minX);
      const yExtent = Math.max(1e-9, maxY - minY);

      // Convert page-relative startRelX/endRelX to absolute pixel positions
      // in the CURRENT page coordinate system.
      const currentStartPx = s.anchor.startRelX * width;
      const currentEndPx   = s.anchor.endRelX * width;

      // Map these absolute positions onto the current block rect to get
      // block-relative fractions (0..1 of block width).
      const targetBlockRelStart = Math.max(0, Math.min(1,
        (currentStartPx - blockRect.x) / Math.max(1, blockRect.w)
      ));
      const targetBlockRelEnd = Math.max(targetBlockRelStart, Math.max(0, Math.min(1,
        (currentEndPx - blockRect.x) / Math.max(1, blockRect.w)
      )));

      // Target position in page-relative (0..1) coordinates derived from
      // the block's current pixel rect.
      const targetX0     = (blockRect.x + targetBlockRelStart * blockRect.w) / width;
      const targetXEnd   = (blockRect.x + targetBlockRelEnd * blockRect.w) / width;
      const targetXSpan  = targetXEnd - targetX0;

      // Check if the stroke's Y extent is small relative to its X extent
      // (i.e. it's a roughly horizontal underline / highlight).
      const isHorizontal = (maxY - minY) < (maxX - minX) * 0.5;

      const points = s.points.map((p) => {
        const fx = (p.x - minX) / xExtent; // 0..1 along the stroke X
        const newX = targetX0 + fx * targetXSpan;
        let newY: number;
        if (isHorizontal) {
          // For horizontal strokes (underlines, highlights), pin all
          // points to the same target Y so the line stays flat at the
          // correct text baseline.
          const fy = (p.y - minY) / yExtent;
          newY = targetY + (fy - 0.5) * (yExtent * 0.5);
        } else {
          // For non-horizontal strokes (circles, arrows), preserve the
          // stroke's relative shape and translate its centroid to the
          // block's current position.
          const cy = (minY + maxY) / 2;
          const dy = targetY - cy;
          newY = p.y + dy;
        }
        return {
          ...p,
          x: Math.max(0, Math.min(1, newX)),
          y: Math.max(0, Math.min(1, newY)),
        };
      });
      return { ...s, points };
    }

    // ── Legacy Y-only delta (pre-Step-9 anchors without span offsets) ──
    const dy = blockRect.y / height - s.anchor.blockOriginY;
    if (Math.abs(dy) < 0.002) return s; // < 0.2 % of page — negligible
    const points = s.points.map(p => ({
      ...p,
      y: Math.max(0, Math.min(1, p.y + dy)),
    }));
    return { ...s, points };
  };

  const getPath = (s: PilotV2PencilStroke) => {
    const cached = cache.current.get(s.id);
    if (cached && cached.w === width && cached.h === height) return cached.path;
    const display = applyBlockOffset(s);
    const d = pencilStrokeToSvgPath(display, width, height);
    if (!d) return null;
    const skiaPath = Skia.Path.MakeFromSVGString(d);
    if (!skiaPath) return null;
    cache.current.set(s.id, { path: skiaPath, w: width, h: height });
    return skiaPath;
  };
  // Drop cache entries for strokes that no longer exist.
  const liveIds = new Set(strokes.map((s) => s.id));
  for (const id of cache.current.keys()) {
    if (!liveIds.has(id)) cache.current.delete(id);
  }
  return (
    <Group>
      {strokes.map((s) => {
        const path = getPath(s);
        if (!path) return null;
        const isHL = s.tool === 'highlighter';
        const colorHex = withAlpha(s.color, isHL ? s.opacity : 1);
        return (
          <Path
            key={s.id}
            path={path}
            color={colorHex}
            style="stroke"
            strokeWidth={isHL ? s.width * 1.6 : s.width}
            strokeCap="round"
            strokeJoin="round"
            blendMode={isHL ? 'multiply' : undefined}
          />
        );
      })}
    </Group>
  );
}, (prev, next) => (
  prev.strokes === next.strokes &&
  prev.width === next.width &&
  prev.height === next.height &&
  prev.blockLayoutVersion === next.blockLayoutVersion
));

const engineRegistry = new Map<string, PencilAnnotationEngine>();

export function getOrCreateEngine(
  noteId: string,
  initialStrokes: PilotV2PencilStroke[],
  pageWidth: number,
  pageHeight: number,
  pencilOnly: boolean,
): PencilAnnotationEngine {
  const existing = engineRegistry.get(noteId);
  if (existing) {
    existing.setConfig({ pageWidth, pageHeight, pencilOnly });
    return existing;
  }
  const created = new PencilAnnotationEngine(initialStrokes, {
    pageWidth, pageHeight, pencilOnly,
  });
  engineRegistry.set(noteId, created);
  return created;
}

export function disposeEngine(noteId: string): void {
  engineRegistry.delete(noteId);
}
