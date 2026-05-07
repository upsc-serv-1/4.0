/**
 * PageInkOverlay — Notability-style page-wide ink canvas.
 *
 * Renders a single absolute-positioned Skia canvas and a gesture surface that
 * sit on top of the entire scrollable note. Users can draw with pen/highlighter
 * across the WHOLE page — over text bullets, between bullets, anywhere.
 *
 * Coordinates are stored in the page's content space (scroll-offset adjusted),
 * so strokes follow the bullets when content is added/removed/scrolled.
 *
 * Activation: visible at all times (so strokes show), but the gesture surface
 * is only mounted when the parent says `interactive` is true (i.e. Ink lens).
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Stroke, StrokePoint, strokeToSvgPath, ToolKind } from './strokes';

const COLOR_WITH_OPACITY = (hex: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${ah}`;
  return hex;
};

interface Props {
  width: number;
  /** Total pixel height of the scrollable content. */
  contentHeight: number;
  /** Existing persisted strokes for this page. */
  strokes: Stroke[];
  /** True when the user is in Ink lens — gesture surface is mounted. */
  interactive: boolean;
  inkTool: ToolKind;
  inkColor: string;
  inkWidth: number;
  /** Current ScrollView offset.y so we can convert touch.y → page-y. */
  scrollOffsetY: number;
  onAddStroke: (s: Stroke) => void;
  onRemoveStrokes: (ids: string[]) => void;
}

export function PageInkOverlay({
  width, contentHeight, strokes, interactive,
  inkTool, inkColor, inkWidth, scrollOffsetY,
  onAddStroke, onRemoveStrokes,
}: Props) {
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const pointsRef = useRef<StrokePoint[]>([]);
  const strokeIdRef = useRef('');
  const lastSampleRef = useRef(0);
  const eraseHitsRef = useRef<Set<string>>(new Set());
  const offsetRef = useRef(scrollOffsetY);
  offsetRef.current = scrollOffsetY;

  const start = (x: number, y: number) => {
    const py = y + offsetRef.current; // convert touch-y → content-y
    if (inkTool === 'eraser') {
      eraseHitsRef.current = new Set();
      hitErase(x, py);
      return;
    }
    strokeIdRef.current = `pgs_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const pt: StrokePoint = { x, y: py, p: 0.5, t: 0 };
    pointsRef.current = [pt];
    setCurrentStroke([pt]);
    lastSampleRef.current = Date.now();
  };

  const move = (x: number, y: number, velocity: number) => {
    const py = y + offsetRef.current;
    if (inkTool === 'eraser') {
      hitErase(x, py);
      return;
    }
    const now = Date.now();
    if (now - lastSampleRef.current < 4) return;
    lastSampleRef.current = now;
    const v = Math.min(1, velocity / 2500);
    const p = Math.max(0.25, 1 - v * 0.6);
    pointsRef.current.push({ x, y: py, p, t: 0 });
    setCurrentStroke([...pointsRef.current]);
  };

  const finish = () => {
    if (inkTool === 'eraser') {
      const ids = Array.from(eraseHitsRef.current);
      eraseHitsRef.current = new Set();
      if (ids.length) onRemoveStrokes(ids);
      return;
    }
    const pts = pointsRef.current;
    if (pts.length > 0) {
      const stroke: Stroke = {
        id: strokeIdRef.current,
        tool: inkTool,
        color: inkColor,
        width: inkTool === 'tape' ? Math.max(inkWidth, 30) : inkWidth,
        opacity: inkTool === 'highlighter' ? 0.35 : 1,
        points: pts,
        created_at: new Date().toISOString(),
      };
      onAddStroke(stroke);
    }
    pointsRef.current = [];
    setCurrentStroke([]);
  };

  const hitErase = (x: number, y: number) => {
    for (const s of strokes) {
      for (const p of s.points) {
        if (Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12) {
          eraseHitsRef.current.add(s.id);
          break;
        }
      }
    }
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => {
          'worklet';
          runOnJS(start)(e.x, e.y);
        })
        .onUpdate((e) => {
          'worklet';
          const v = Math.sqrt(e.velocityX * e.velocityX + e.velocityY * e.velocityY);
          runOnJS(move)(e.x, e.y, v);
        })
        .onEnd(() => {
          'worklet';
          runOnJS(finish)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inkTool, inkColor, inkWidth, strokes],
  );

  const canvas = (
    <Canvas style={{ width: Math.max(1, width), height: Math.max(1, contentHeight) }}>
      {strokes.map((s) => {
        if (eraseHitsRef.current.has(s.id)) return null;
        const d = strokeToSvgPath(s.points);
        if (!d) return null;
        const isHL = s.tool === 'highlighter';
        const isTape = s.tool === 'tape';
        const strokeColor = isHL ? COLOR_WITH_OPACITY(s.color, s.opacity) : s.color;
        if (isTape) {
          return (
            <Path
              key={s.id}
              path={d}
              color={s.color}
              style="stroke"
              strokeWidth={Math.max(s.width, 24)}
              strokeCap="butt"
              strokeJoin="miter"
            />
          );
        }
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
      })}
      {currentStroke.length > 0 && (
        <Path
          path={strokeToSvgPath(currentStroke)}
          color={
            inkTool === 'highlighter'
              ? COLOR_WITH_OPACITY(inkColor, 0.35)
              : inkTool === 'tape'
                ? inkColor
                : inkColor
          }
          style="stroke"
          strokeWidth={
            inkTool === 'highlighter'
              ? inkWidth * 1.8
              : inkTool === 'tape'
                ? Math.max(inkWidth, 24)
                : inkWidth
          }
          strokeCap={inkTool === 'tape' ? 'butt' : 'round'}
          strokeJoin={inkTool === 'tape' ? 'miter' : 'round'}
          blendMode={inkTool === 'highlighter' ? 'multiply' : undefined}
        />
      )}
    </Canvas>
  );

  // Read-only display layer (always shown): absolute-positioned canvas behind/above content.
  // The gesture surface only mounts when interactive (Ink lens).
  return (
    <>
      <View pointerEvents="none" style={[styles.layer, { height: contentHeight }]} testID="page-ink-layer">
        {canvas}
      </View>
      {interactive && (
        <GestureDetector gesture={pan}>
          <View
            style={[styles.surface, { height: contentHeight }]}
            data-testid="page-ink-surface"
          />
        </GestureDetector>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 4,
  },
  surface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 7, // above bullet cards but below the floating ink dock
    backgroundColor: 'transparent',
  },
});
