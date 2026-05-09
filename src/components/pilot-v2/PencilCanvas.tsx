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

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
}: Props) {
  const [strokes, setStrokes] = useState<PilotV2PencilStroke[]>(engine.getAll());
  const [, setTick] = useState(0);

  // Lasso state — polygon being drawn + active selection.
  const [lassoPolygon, setLassoPolygon] = useState<{ x: number; y: number }[]>([]);
  const [selectionIds, setSelectionIds] = useState<Set<string>>(new Set());
  const [selectionBounds, setSelectionBounds] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const moveOriginRef = useRef<{ x: number; y: number } | null>(null);

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

  // When the user switches away from lasso, drop the selection.
  useEffect(() => {
    if (tool !== 'lasso') {
      setLassoPolygon([]);
      setSelectionIds(new Set());
      setSelectionBounds(null);
    }
  }, [tool]);

  function handleStart(x: number, y: number) {
    if (!drawingMode) return;
    if (tool === 'lasso') {
      const rel = engine.toRelative(x, y);
      setLassoPolygon([rel]);
      setSelectionIds(new Set());
      setSelectionBounds(null);
      return;
    }
    engine.startStroke(x, y);
  }
  function handleMove(x: number, y: number) {
    if (!drawingMode) return;
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
