/**
 * PencilCanvas — Pilot V2 Step 6
 * --------------------------------
 * Single page-level continuous Skia drawing surface that overlays the entire
 * scrollable note (top-to-bottom, edge-to-edge). Strokes live on an
 * independent layer so the underlying text blocks remain editable & selectable
 * at all times — exactly per Phase 3 spec in PILOT_V2_GAPS.md.
 *
 * Coordinates inside `engine` are RELATIVE (0..1) so panning, pinching, or
 * resizing the page never causes scale drift.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Path, Group, Skia } from '@shopify/react-native-skia';import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS } from 'react-native-reanimated';
import {
  PencilAnnotationEngine,
  pencilStrokeToSvgPath,
} from './PencilAnnotationEngine';
import { PilotV2PencilStroke } from './types';

interface Props {
  /** Persistent engine instance owning all strokes for this page. */
  engine: PencilAnnotationEngine;
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
}

/** Compose hex color + 0..1 alpha into an 8-digit hex Skia accepts. */
const withAlpha = (hex: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${ah}`;
  return hex;
};

export function PencilCanvas({
  engine, width, height, drawingMode, onCommit, testID,
}: Props) {
  const [strokes, setStrokes] = useState<PilotV2PencilStroke[]>(engine.getAll());
  const [, setTick] = useState(0);

  useEffect(() => {
    engine.setConfig({ pageWidth: width, pageHeight: height });
  }, [engine, width, height]);

  useEffect(() => {
    const unsub = engine.subscribe((next) => {
      setStrokes(next);
      setTick(t => t + 1);
    });
    return unsub;
  }, [engine]);

  function handleStart(x: number, y: number) {
    if (!drawingMode) return;
    engine.startStroke(x, y);
  }
  function handleMove(x: number, y: number) {
    if (!drawingMode) return;
    engine.addPoint(x, y);
  }
  function handleEnd() {
    if (!drawingMode) return;
    engine.endStroke();
    onCommit?.(engine.getPersisted());
  }

  const drawGesture = useMemo(() => {
    return Gesture.Pan()
      .minDistance(0)
      .maxPointers(1)
      .enabled(drawingMode)
      .onBegin((e) => {
        'worklet';
        runOnJS(handleStart)(e.x, e.y);
      })
      .onUpdate((e) => {
        'worklet';
        runOnJS(handleMove)(e.x, e.y);
      })
      .onEnd(() => {
        'worklet';
        runOnJS(handleEnd)();
      })
      .onFinalize(() => {
        'worklet';
        runOnJS(handleEnd)();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingMode]);

  return (
    <View
      testID={testID || 'pilot-v2-pencil-canvas'}
      pointerEvents={drawingMode ? 'auto' : 'none'}
      style={[styles.layer, { width, height }]}
    >
      <GestureDetector gesture={drawGesture}>
        <Animated.View style={{ width, height }}>
          <Canvas style={{ width, height }}>
            <Group>
              {strokes.map((s) => {
                const d = pencilStrokeToSvgPath(s, width, height);
                if (!d) return null;
                const path = Skia.Path.MakeFromSVGString(d);
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
          </Canvas>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
});

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
