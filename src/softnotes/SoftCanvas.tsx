/**
 * SoftCanvas — Notability-style drawing surface for one Soft Notes page.
 *
 * Features
 *  - Pen / Highlighter / Eraser / Tape with shared SoftStroke model
 *  - Catmull-Rom Bezier smoothing on commit
 *  - Pinch-to-zoom + two-finger pan (visual transform; coords stored in canvas space)
 *  - Single-finger pan = draw (Notability convention)
 *  - Per-tool palette + width via SoftToolbar (separate component)
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Path, Group, Rect } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import {
  SoftStroke, SoftStrokePoint, SoftToolKind,
  Page, PaperStyle,
} from './types';
import {
  smoothStroke, bezierToSvgPath, computeBoundingBox, screenToCanvas,
  pressureFromVelocity,
} from './strokes';

const COLOR_WITH_OPACITY = (hex: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${ah}`;
  return hex;
};

interface Props {
  page: Page;
  strokes: SoftStroke[];
  tool: SoftToolKind;
  color: string;
  width: number;
  /** Viewport size in screen pixels (the visible scroll-area). */
  viewportWidth: number;
  viewportHeight: number;
  onAddStroke: (s: SoftStroke) => void;
  onRemoveStrokes: (ids: string[]) => void;
}

export function SoftCanvas({
  page, strokes, tool, color, width,
  viewportWidth, viewportHeight,
  onAddStroke, onRemoveStrokes,
}: Props) {
  const [currentPoints, setCurrentPoints] = useState<SoftStrokePoint[]>([]);
  const pointsRef = useRef<SoftStrokePoint[]>([]);
  const eraseHitsRef = useRef<Set<string>>(new Set());
  const lastSampleRef = useRef(0);

  // ===== Visual transform (pinch + two-finger pan) =====
  const zoom = useSharedValue(1);
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  // JS-readable refs so the draw-gesture (which runs runOnJS) can transform input.
  const zoomJS = useRef(1);
  const panXJS = useRef(0);
  const panYJS = useRef(0);

  // ===== Drawing handlers =====
  const start = (sx: number, sy: number) => {
    // Convert screen coords → canvas coords using current transform.
    const { x, y } = screenToCanvas(sx, sy, zoomJS.current, panXJS.current, panYJS.current);

    if (tool === 'eraser') {
      eraseHitsRef.current = new Set();
      hitErase(x, y);
      return;
    }
    pointsRef.current = [{ x, y, pressure: 0.5, timestamp: Date.now() }];
    setCurrentPoints(pointsRef.current);
    lastSampleRef.current = Date.now();
  };

  const move = (sx: number, sy: number) => {
    const { x, y } = screenToCanvas(sx, sy, zoomJS.current, panXJS.current, panYJS.current);
    if (tool === 'eraser') {
      hitErase(x, y);
      return;
    }
    const now = Date.now();
    if (now - lastSampleRef.current < 4) return;
    lastSampleRef.current = now;
    const prev = pointsRef.current[pointsRef.current.length - 1];
    let pressure = 0.5;
    if (prev) {
      const dt = (now - prev.timestamp) || 1;
      const dx = x - prev.x, dy = y - prev.y;
      const v = Math.sqrt(dx * dx + dy * dy) / dt;
      pressure = pressureFromVelocity(v);
    }
    pointsRef.current.push({ x, y, pressure, timestamp: now });
    setCurrentPoints([...pointsRef.current]);
  };

  const finish = () => {
    if (tool === 'eraser') {
      const ids = Array.from(eraseHitsRef.current);
      eraseHitsRef.current = new Set();
      if (ids.length) onRemoveStrokes(ids);
      return;
    }
    const pts = pointsRef.current;
    if (pts.length === 0) return;
    const stroke: SoftStroke = {
      id: `sst_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      page_id: page.id,
      tool,
      color,
      width: tool === 'tape' ? Math.max(width, 30) : width,
      opacity: tool === 'highlighter' ? 0.35 : 1,
      raw_points: pts,
      bezier_points: smoothStroke(pts),
      bounding_box: computeBoundingBox(pts),
      z_index: strokes.length,
      created_at: new Date().toISOString(),
    };
    onAddStroke(stroke);
    pointsRef.current = [];
    setCurrentPoints([]);
  };

  const hitErase = (x: number, y: number) => {
    const tol = 14 / zoomJS.current;
    for (const s of strokes) {
      const b = s.bounding_box;
      if (b && (x < b.x - tol || x > b.x + b.width + tol || y < b.y - tol || y > b.y + b.height + tol)) continue;
      for (const p of s.raw_points) {
        if (Math.abs(p.x - x) < tol && Math.abs(p.y - y) < tol) {
          eraseHitsRef.current.add(s.id);
          break;
        }
      }
    }
  };

  // ===== Gestures =====
  // Single-finger pan = draw
  const drawGesture = useMemo(
    () => Gesture.Pan()
      .minDistance(0)
      .maxPointers(1)
      .onBegin((e) => { 'worklet'; runOnJS(start)(e.x, e.y); })
      .onUpdate((e) => { 'worklet'; runOnJS(move)(e.x, e.y); })
      .onEnd(() => { 'worklet'; runOnJS(finish)(); }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tool, color, width, strokes],
  );

  // Pinch-to-zoom
  const pinchGesture = useMemo(
    () => Gesture.Pinch()
      .onUpdate((e) => {
        'worklet';
        const next = Math.max(0.25, Math.min(4, zoom.value * e.scale));
        zoom.value = next;
        runOnJS(syncZoomJS)(next);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Two-finger pan (zoom companion). RNGH Pan with minPointers(2) lets us
  // pan only when two fingers down, leaving single-finger to the draw gesture.
  const twoFingerPan = useMemo(
    () => Gesture.Pan()
      .minPointers(2)
      .maxPointers(2)
      .onUpdate((e) => {
        'worklet';
        panX.value += e.changeX;
        panY.value += e.changeY;
        runOnJS(syncPanJS)(panX.value, panY.value);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Double-tap = reset transform
  const doubleTap = useMemo(
    () => Gesture.Tap()
      .numberOfTaps(2)
      .onStart(() => {
        'worklet';
        zoom.value = 1; panX.value = 0; panY.value = 0;
        runOnJS(syncZoomJS)(1); runOnJS(syncPanJS)(0, 0);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function syncZoomJS(v: number) { zoomJS.current = v; }
  function syncPanJS(x: number, y: number) { panXJS.current = x; panYJS.current = y; }

  const composedGesture = Gesture.Simultaneous(
    Gesture.Race(doubleTap, drawGesture),
    pinchGesture,
    twoFingerPan,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: panX.value },
      { translateY: panY.value },
      { scale: zoom.value },
    ],
  }));

  // ===== Render =====
  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[styles.surface, { width: viewportWidth, height: viewportHeight }, animatedStyle]}>
        <Canvas style={{ width: page.width, height: page.height }}>
          {/* Paper background */}
          <Rect x={0} y={0} width={page.width} height={page.height} color="#ffffff" />
          <PaperGuides style={page.paper_style} width={page.width} height={page.height} />
          {/* Persisted strokes */}
          <Group>
            {strokes.map((s) => {
              if (eraseHitsRef.current.has(s.id)) return null;
              const path = s.bezier_points && s.bezier_points.length
                ? bezierToSvgPath(s.bezier_points)
                : bezierToSvgPath(smoothStroke(s.raw_points));
              if (!path) return null;
              const isHL = s.tool === 'highlighter';
              const isTape = s.tool === 'tape';
              if (isTape) {
                return (
                  <Path key={s.id} path={path} color={s.color} style="stroke"
                    strokeWidth={Math.max(s.width, 24)} strokeCap="butt" strokeJoin="miter" />
                );
              }
              const strokeColor = isHL ? COLOR_WITH_OPACITY(s.color, s.opacity) : s.color;
              return (
                <Path key={s.id} path={path} color={strokeColor} style="stroke"
                  strokeWidth={isHL ? s.width * 1.8 : s.width}
                  strokeCap="round" strokeJoin="round"
                  blendMode={isHL ? 'multiply' : undefined}
                />
              );
            })}
            {/* Live stroke */}
            {currentPoints.length > 0 && (() => {
              const path = bezierToSvgPath(smoothStroke(currentPoints));
              if (!path) return null;
              const isHL = tool === 'highlighter';
              const isTape = tool === 'tape';
              if (isTape) {
                return (
                  <Path path={path} color={color} style="stroke"
                    strokeWidth={Math.max(width, 24)} strokeCap="butt" strokeJoin="miter" />
                );
              }
              return (
                <Path path={path} color={isHL ? COLOR_WITH_OPACITY(color, 0.35) : color} style="stroke"
                  strokeWidth={isHL ? width * 1.8 : width}
                  strokeCap="round" strokeJoin="round"
                  blendMode={isHL ? 'multiply' : undefined}
                />
              );
            })()}
          </Group>
        </Canvas>
      </Animated.View>
    </GestureDetector>
  );
}

// ============================================================================
// PaperGuides — ruled / grid / dotted backgrounds drawn via Skia primitives
// ============================================================================
function PaperGuides({ style, width, height }: { style: PaperStyle; width: number; height: number }) {
  if (style === 'plain') return null;
  if (style === 'ruled') {
    const lines = [];
    for (let y = 36; y < height; y += 28) {
      lines.push(<Rect key={y} x={0} y={y} width={width} height={1} color="#dbeafe" />);
    }
    return <Group>{lines}</Group>;
  }
  if (style === 'grid') {
    const cells = [];
    for (let x = 0; x < width; x += 24) cells.push(<Rect key={`vx${x}`} x={x} y={0} width={1} height={height} color="#e5e7eb" />);
    for (let y = 0; y < height; y += 24) cells.push(<Rect key={`hy${y}`} x={0} y={y} width={width} height={1} color="#e5e7eb" />);
    return <Group>{cells}</Group>;
  }
  if (style === 'dotted') {
    const dots = [];
    for (let x = 16; x < width; x += 24) {
      for (let y = 16; y < height; y += 24) {
        dots.push(<Rect key={`d${x}-${y}`} x={x} y={y} width={2} height={2} color="#d1d5db" />);
      }
    }
    return <Group>{dots}</Group>;
  }
  if (style === 'cornell') {
    return (
      <Group>
        <Rect x={0} y={0} width={width * 0.3} height={height} color="#fafafa" />
        <Rect x={width * 0.3} y={0} width={1} height={height} color="#e5e7eb" />
        <Rect x={0} y={height * 0.85} width={width} height={1} color="#e5e7eb" />
      </Group>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
});
