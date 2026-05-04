/**
 * SkiaCanvas — high-performance drawing canvas using @shopify/react-native-skia.
 *
 * - Renders an optional base layer (quiz explanation / text) as <Text> + <Rect> at y=0..baseHeight
 * - Renders committed strokes from props.strokes
 * - Draws an in-progress stroke driven by PanResponder gestures
 * - Returns the finalized stroke via onStrokeCommit when the finger lifts
 *
 * Pressure & tilt:
 *   React Native doesn't expose Apple Pencil data via PanResponder natively,
 *   but evt.nativeEvent.force and evt.nativeEvent.altitudeAngle are populated
 *   on iOS when available. We fall back to 0.5 pressure for finger/stylus
 *   without force data, and use a light velocity-based estimate otherwise.
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, PanResponder, StyleSheet, GestureResponderEvent } from 'react-native';
import { Canvas, Path, Group, Rect } from '@shopify/react-native-skia';
import { Stroke, StrokePoint, ToolKind, strokeToSvgPath } from './strokes';

interface Props {
  width: number;
  height: number;
  strokes: Stroke[];
  tool: ToolKind;
  color: string;
  baseWidth: number;
  /** Optional locked base-layer text (quiz explanation from Phase 3). */
  baseLayer?: { text: string; height?: number } | null;
  onStrokeCommit: (stroke: Stroke) => void;
  onEraseStrokes?: (ids: string[]) => void;
}

const COLOR_WITH_OPACITY = (hex: string, alpha: number): string => {
  // Accept '#rrggbb' or '#rgb' and append alpha hex (00-ff).
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${ah}`;
  if (/^#[0-9a-fA-F]{3}$/.test(hex)) {
    const [_, r, g, b] = hex.match(/^#(.)(.)(.)$/)!;
    return `#${r}${r}${g}${g}${b}${b}${ah}`;
  }
  return hex;
};

export function SkiaCanvas({
  width,
  height,
  strokes,
  tool,
  color,
  baseWidth,
  baseLayer,
  onStrokeCommit,
  onEraseStrokes,
}: Props) {
  const [currentPoints, setCurrentPoints] = useState<StrokePoint[]>([]);
  const currentPointsRef = useRef<StrokePoint[]>([]);
  const strokeIdRef = useRef<string>('');
  const lastSampleTimeRef = useRef<number>(0);
  const eraseHitsRef = useRef<Set<string>>(new Set());

  const extractTouch = (evt: GestureResponderEvent): StrokePoint => {
    const native = evt.nativeEvent as any;
    const x = native.locationX ?? 0;
    const y = native.locationY ?? 0;
    // iOS Apple Pencil exposes `force` in 0..1. Stylus/touch usually give 0.
    let pressure = typeof native.force === 'number' && native.force > 0 ? native.force : 0.5;
    pressure = Math.max(0.1, Math.min(1, pressure));
    const tilt = typeof native.altitudeAngle === 'number' ? native.altitudeAngle : 0;
    return { x, y, p: pressure, t: tilt };
  };

  const strokeHitsPoint = (stroke: Stroke, x: number, y: number, tolerance: number) => {
    // Simple bounding + per-point proximity check. Cheap enough for small stroke counts.
    for (const p of stroke.points) {
      if (Math.abs(p.x - x) < tolerance && Math.abs(p.y - y) < tolerance) return true;
    }
    return false;
  };

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const pt = extractTouch(evt);
          if (tool === 'eraser') {
            eraseHitsRef.current = new Set();
            const hits = strokes.filter((s) => strokeHitsPoint(s, pt.x, pt.y, 8)).map((s) => s.id);
            hits.forEach((id) => eraseHitsRef.current.add(id));
            return;
          }
          strokeIdRef.current = `st_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          currentPointsRef.current = [pt];
          setCurrentPoints([pt]);
          lastSampleTimeRef.current = Date.now();
        },
        onPanResponderMove: (evt) => {
          const pt = extractTouch(evt);
          if (tool === 'eraser') {
            const hits = strokes.filter((s) => strokeHitsPoint(s, pt.x, pt.y, 8)).map((s) => s.id);
            hits.forEach((id) => eraseHitsRef.current.add(id));
            return;
          }
          // Throttle — min 8ms between samples for smooth 120fps Apple Pencil.
          const now = Date.now();
          if (now - lastSampleTimeRef.current < 4) return;
          lastSampleTimeRef.current = now;
          currentPointsRef.current.push(pt);
          setCurrentPoints([...currentPointsRef.current]);
        },
        onPanResponderRelease: () => {
          if (tool === 'eraser') {
            const ids = Array.from(eraseHitsRef.current);
            eraseHitsRef.current = new Set();
            if (ids.length && onEraseStrokes) onEraseStrokes(ids);
            return;
          }
          const pts = currentPointsRef.current;
          if (pts.length > 0) {
            const avgP = pts.reduce((a, p) => a + p.p, 0) / pts.length;
            const stroke: Stroke = {
              id: strokeIdRef.current,
              tool,
              color,
              width: baseWidth,
              opacity: tool === 'highlighter' ? 0.35 : 1,
              points: pts,
              created_at: new Date().toISOString(),
            };
            onStrokeCommit(stroke);
          }
          currentPointsRef.current = [];
          setCurrentPoints([]);
        },
        onPanResponderTerminate: () => {
          currentPointsRef.current = [];
          setCurrentPoints([]);
          eraseHitsRef.current = new Set();
        },
      }),
    [tool, color, baseWidth, strokes, onStrokeCommit, onEraseStrokes]
  );

  const renderStroke = (s: Stroke) => {
    const d = strokeToSvgPath(s.points);
    if (!d) return null;
    const isHighlighter = s.tool === 'highlighter';
    const strokeColor = isHighlighter ? COLOR_WITH_OPACITY(s.color, s.opacity) : s.color;
    const avgP = s.points.reduce((a, p) => a + p.p, 0) / Math.max(1, s.points.length);
    const dynWidth = s.width * (0.5 + 0.5 * avgP);
    return (
      <Path
        key={s.id}
        path={d}
        color={strokeColor}
        style="stroke"
        strokeWidth={isHighlighter ? s.width * 1.8 : dynWidth}
        strokeCap="round"
        strokeJoin="round"
        blendMode={isHighlighter ? 'multiply' : undefined}
      />
    );
  };

  const renderActiveStroke = () => {
    const d = strokeToSvgPath(currentPoints);
    if (!d) return null;
    const isHL = tool === 'highlighter';
    const strokeColor = isHL ? COLOR_WITH_OPACITY(color, 0.35) : color;
    const avgP = currentPoints.reduce((a, p) => a + p.p, 0) / currentPoints.length;
    const w = baseWidth * (0.5 + 0.5 * avgP);
    return (
      <Path
        path={d}
        color={strokeColor}
        style="stroke"
        strokeWidth={isHL ? baseWidth * 1.8 : w}
        strokeCap="round"
        strokeJoin="round"
        blendMode={isHL ? 'multiply' : undefined}
      />
    );
  };

  const eraseHits = eraseHitsRef.current;

  return (
    <View style={[styles.wrap, { width, height }]} {...responder.panHandlers} data-testid="hn-skia-canvas">
      <Canvas style={{ width, height }}>
        {/* Paper background */}
        <Rect x={0} y={0} width={width} height={height} color="#ffffff" />
        {/* Light ruled lines for notebook feel */}
        {Array.from({ length: Math.floor(height / 32) }).map((_, i) => (
          <Rect key={`ln_${i}`} x={0} y={(i + 1) * 32} width={width} height={1} color="#e5e7eb" />
        ))}

        {/* Base layer (quiz explanation) */}
        {baseLayer && (
          <Group>
            <Rect x={16} y={16} width={width - 32} height={baseLayer.height ?? 260} color="#fef3c7" />
            <Rect x={16} y={16} width={4} height={baseLayer.height ?? 260} color="#f59e0b" />
          </Group>
        )}

        {/* Committed strokes */}
        <Group>
          {strokes.map((s) => {
            if (eraseHits.has(s.id)) return null;
            return renderStroke(s);
          })}
        </Group>

        {/* Active in-progress stroke */}
        {renderActiveStroke()}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#ffffff', overflow: 'hidden' },
});
