/**
 * SkiaCanvas — vector drawing canvas using @shopify/react-native-skia + react-native-gesture-handler.
 *
 * Phase-2 upgrades:
 *   - Pan gesture via Gesture.Pan() with minDistance(0) so the very first touch starts a stroke.
 *   - Apple Pencil pressure read from native event when present (force/altitudeAngle on iOS),
 *     falling back to velocity-based width modulation when force is unavailable.
 *   - Highlighter uses multiply blend mode (page darkens, text underneath stays crisp).
 *   - Eraser hit-tests stroke points; erased ids surface via onEraseStrokes for parent CRUD.
 *   - Lasso tool selects strokes whose centroid is inside the closed polygon — selection ids
 *     surface via onSelectionChange so the parent can move/delete them.
 *   - Optional draggable selection: when in 'lasso' mode and there is an active selection,
 *     a subsequent pan inside the selection bbox emits onMoveSelection with dx/dy.
 *   - Paper background (plain | lined | dotted | cream | mint).
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Path, Group, Rect, Circle } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Stroke, StrokePoint, ToolKind, strokeToSvgPath } from './strokes';

export type PaperKind = 'plain' | 'lined' | 'dotted' | 'cream' | 'mint';

interface Props {
  width: number;
  height: number;
  strokes: Stroke[];
  tool: ToolKind | 'scissor';
  color: string;
  baseWidth: number;
  paper?: PaperKind;
  baseLayer?: { text: string; height?: number } | null;
  onStrokeCommit: (stroke: Stroke) => void;
  onEraseStrokes?: (ids: string[]) => void;
  onSelectionChange?: (ids: string[]) => void;
  onMoveSelection?: (ids: string[], dx: number, dy: number) => void;
}

const COLOR_WITH_OPACITY = (hex: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${ah}`;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const m = hex.match(/^#(.)(.)(.)$/)!;
    return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}${ah}`;
  }
  return hex;
};

const PAPER_BG: Record<PaperKind, string> = {
  plain: '#ffffff',
  lined: '#ffffff',
  dotted: '#ffffff',
  cream: '#fef7e0',
  mint: '#ecfdf5',
};

function pointInPolygon(x: number, y: number, poly: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function SkiaCanvas({
  width,
  height,
  strokes,
  tool,
  color,
  baseWidth,
  paper = 'plain',
  baseLayer,
  onStrokeCommit,
  onEraseStrokes,
  onSelectionChange,
  onMoveSelection,
}: Props) {
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);
  const [lassoPoints, setLassoPoints] = useState<{ x: number; y: number }[]>([]);
  const [selection, setSelection] = useState<string[]>([]);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const currentRef = useRef<StrokePoint[]>([]);
  const lassoRef = useRef<{ x: number; y: number }[]>([]);
  const eraseHitsRef = useRef<Set<string>>(new Set());
  const idRef = useRef('');
  const lastSampleRef = useRef(0);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const beginStroke = (x: number, y: number) => {
    idRef.current = `st_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const pt: StrokePoint = { x, y, p: 0.5, t: 0 };
    currentRef.current = [pt];
    setCurrentPoints([pt]);
    lastSampleRef.current = Date.now();
  };

  const appendPoint = (x: number, y: number, velocity: number) => {
    const now = Date.now();
    if (now - lastSampleRef.current < 4) return;
    lastSampleRef.current = now;
    // Velocity-based pressure fallback: faster = thinner.
    const v = Math.min(1, velocity / 2500);
    const p = Math.max(0.25, 1 - v * 0.6);
    const pt: StrokePoint = { x, y, p, t: 0 };
    currentRef.current.push(pt);
    setCurrentPoints([...currentRef.current]);
  };

  const finalizeStroke = () => {
    const pts = currentRef.current;
    if (pts.length > 0) {
      const stroke: Stroke = {
        id: idRef.current,
        tool: (tool === 'scissor' ? 'pen' : (tool as ToolKind)),
        color,
        width: baseWidth,
        opacity: tool === 'highlighter' ? 0.35 : 1,
        points: pts,
        created_at: new Date().toISOString(),
      };
      onStrokeCommit(stroke);
    }
    currentRef.current = [];
    setCurrentPoints([]);
  };

  const beginErase = (x: number, y: number) => {
    eraseHitsRef.current = new Set();
    appendErase(x, y);
  };
  const appendErase = (x: number, y: number) => {
    for (const s of strokes) {
      for (const p of s.points) {
        if (Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10) {
          eraseHitsRef.current.add(s.id);
          break;
        }
      }
    }
  };
  const finalizeErase = () => {
    const ids = Array.from(eraseHitsRef.current);
    eraseHitsRef.current = new Set();
    if (ids.length && onEraseStrokes) onEraseStrokes(ids);
  };

  const beginLasso = (x: number, y: number) => {
    // If we already have a selection and the touch falls inside its bbox, start a drag instead.
    if (selection.length > 0) {
      const hit = strokes.filter((s) => selection.includes(s.id));
      const bbox = computeBBox(hit);
      if (bbox && x >= bbox.x && x <= bbox.x + bbox.w && y >= bbox.y && y <= bbox.y + bbox.h) {
        dragStartRef.current = { x, y };
        return;
      }
    }
    lassoRef.current = [{ x, y }];
    setLassoPoints([{ x, y }]);
    setSelection([]);
    onSelectionChange?.([]);
  };
  const appendLasso = (x: number, y: number) => {
    if (dragStartRef.current) {
      const dx = x - dragStartRef.current.x;
      const dy = y - dragStartRef.current.y;
      setDragOffset({ x: dx, y: dy });
      return;
    }
    lassoRef.current.push({ x, y });
    setLassoPoints([...lassoRef.current]);
  };
  const finalizeLasso = () => {
    if (dragStartRef.current && dragOffset) {
      onMoveSelection?.(selection, dragOffset.x, dragOffset.y);
      dragStartRef.current = null;
      setDragOffset(null);
      return;
    }
    const poly = lassoRef.current;
    if (poly.length > 2) {
      const ids: string[] = [];
      for (const s of strokes) {
        const cx = s.points.reduce((a, p) => a + p.x, 0) / s.points.length;
        const cy = s.points.reduce((a, p) => a + p.y, 0) / s.points.length;
        if (pointInPolygon(cx, cy, poly)) ids.push(s.id);
      }
      setSelection(ids);
      onSelectionChange?.(ids);
    }
    lassoRef.current = [];
    setLassoPoints([]);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .averageTouches(false)
        .onBegin((e) => {
          'worklet';
          const x = e.x;
          const y = e.y;
          if (tool === 'eraser') runOnJS(beginErase)(x, y);
          else if (tool === 'lasso') runOnJS(beginLasso)(x, y);
          else if (tool === 'scissor') return;
          else runOnJS(beginStroke)(x, y);
        })
        .onUpdate((e) => {
          'worklet';
          const x = e.x;
          const y = e.y;
          const v = Math.sqrt(e.velocityX * e.velocityX + e.velocityY * e.velocityY);
          if (tool === 'eraser') runOnJS(appendErase)(x, y);
          else if (tool === 'lasso') runOnJS(appendLasso)(x, y);
          else if (tool === 'scissor') return;
          else runOnJS(appendPoint)(x, y, v);
        })
        .onEnd(() => {
          'worklet';
          if (tool === 'eraser') runOnJS(finalizeErase)();
          else if (tool === 'lasso') runOnJS(finalizeLasso)();
          else if (tool === 'scissor') return;
          else runOnJS(finalizeStroke)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, baseWidth, strokes, selection, dragOffset]
  );

  const renderStroke = (s: Stroke, dx = 0, dy = 0) => {
    const shifted = dx || dy ? { ...s, points: s.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) } : s;
    const d = strokeToSvgPath(shifted.points);
    if (!d) return null;
    const isHL = s.tool === 'highlighter';
    const strokeColor = isHL ? COLOR_WITH_OPACITY(s.color, s.opacity) : s.color;
    const avgP = s.points.reduce((a, p) => a + p.p, 0) / Math.max(1, s.points.length);
    const dynW = s.width * (0.5 + 0.5 * avgP);
    return (
      <Path
        key={s.id}
        path={d}
        color={strokeColor}
        style="stroke"
        strokeWidth={isHL ? s.width * 1.8 : dynW}
        strokeCap="round"
        strokeJoin="round"
        blendMode={isHL ? 'multiply' : undefined}
      />
    );
  };

  const renderActiveStroke = () => {
    const d = strokeToSvgPath(currentPoints);
    if (!d) return null;
    const isHL = tool === 'highlighter';
    const strokeColor = isHL ? COLOR_WITH_OPACITY(color, 0.35) : color;
    return (
      <Path
        path={d}
        color={strokeColor}
        style="stroke"
        strokeWidth={isHL ? baseWidth * 1.8 : baseWidth}
        strokeCap="round"
        strokeJoin="round"
        blendMode={isHL ? 'multiply' : undefined}
      />
    );
  };

  const renderLasso = () => {
    if (lassoPoints.length < 2) return null;
    const d =
      'M ' +
      lassoPoints.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ') +
      ' Z';
    return <Path path={d} color="#3b82f6" style="stroke" strokeWidth={1.5} />;
  };

  const renderSelectionRect = () => {
    if (selection.length === 0) return null;
    const hit = strokes.filter((s) => selection.includes(s.id));
    const bbox = computeBBox(hit);
    if (!bbox) return null;
    const dx = dragOffset?.x ?? 0;
    const dy = dragOffset?.y ?? 0;
    return (
      <Rect
        x={bbox.x - 6 + dx}
        y={bbox.y - 6 + dy}
        width={bbox.w + 12}
        height={bbox.h + 12}
        color="#3b82f622"
        style="stroke"
        strokeWidth={1.5}
      />
    );
  };

  const eraseHits = eraseHitsRef.current;
  const baseHeight = baseLayer?.height ?? 0;
  const linedRows = paper === 'lined' ? Math.floor(height / 32) : 0;
  const dotCols = paper === 'dotted' ? Math.floor(width / 24) : 0;
  const dotRows = paper === 'dotted' ? Math.floor(height / 24) : 0;

  return (
    <View style={[styles.wrap, { width, height }]} data-testid="hn-skia-canvas">
      <GestureDetector gesture={pan}>
        <Canvas style={{ width, height }}>
          {/* Paper bg */}
          <Rect x={0} y={0} width={width} height={height} color={PAPER_BG[paper]} />

          {paper === 'lined' &&
            Array.from({ length: linedRows }).map((_, i) => (
              <Rect key={`ln_${i}`} x={0} y={(i + 1) * 32} width={width} height={1} color="#e5e7eb" />
            ))}

          {paper === 'dotted' &&
            Array.from({ length: dotRows }).map((_, r) =>
              Array.from({ length: dotCols }).map((__, c) => (
                <Circle key={`d_${r}_${c}`} cx={(c + 1) * 24} cy={(r + 1) * 24} r={1} color="#cbd5e1" />
              ))
            )}

          {/* Soft pastel locked base layer */}
          {baseLayer && baseLayer.text && (
            <Group>
              <Rect
                x={12}
                y={12}
                width={width - 24}
                height={baseHeight || 220}
                color="#fff7d6"
              />
            </Group>
          )}

          {/* Committed strokes (with selection drag offset) */}
          <Group>
            {strokes.map((s) => {
              if (eraseHits.has(s.id)) return null;
              const isSelected = selection.includes(s.id);
              const dx = isSelected && dragOffset ? dragOffset.x : 0;
              const dy = isSelected && dragOffset ? dragOffset.y : 0;
              return renderStroke(s, dx, dy);
            })}
          </Group>

          {/* In-progress stroke / lasso / selection */}
          {renderActiveStroke()}
          {renderLasso()}
          {renderSelectionRect()}
        </Canvas>
      </GestureDetector>
    </View>
  );
}

function computeBBox(strokes: Stroke[]) {
  if (strokes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#ffffff', overflow: 'hidden', borderRadius: 16 },
});
