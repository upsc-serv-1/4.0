/**
 * WashiTapeLayer — renderer + creator for premium paper-tape masking.
 * ------------------------------------------------------------------
 * Sits ABOVE the text/pencil layers when active. Tap to toggle reveal.
 * Long-press to remove. Drag-while-active to draw a new tape rect.
 *
 * Uses RNGH Gesture.Pan (instead of old PanResponder) so it works
 * reliably alongside pinch/pan/double-tap gestures in both
 * GlanceView and EditorView.
 *
 * CRITICAL: All React state updates (setDraft, onAdd) must go through
 * runOnJS because gesture callbacks run on the UI-thread worklet.
 */

import React, { useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useSharedValue } from 'react-native-reanimated';
import {
  PilotV2WashiTape, washiBg, washiEdge, createWashiTape,
  WashiTapeColor, WASHI_TAPE_COLORS,
} from './washiTape';

interface Props {
  tapes: PilotV2WashiTape[];
  width: number;
  height: number;
  /** When true, pan gestures inside the layer create new tapes. */
  drawingMode: boolean;
  activeColor: WashiTapeColor;
  onAdd: (tape: PilotV2WashiTape) => void;
  onToggle: (tapeId: string) => void;
  onRemove: (tapeId: string) => void;
  testID?: string;
}

export function WashiTapeLayer({
  tapes, width, height, drawingMode, activeColor,
  onAdd, onToggle, onRemove, testID,
}: Props) {
  const [draft, setDraft] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  // Shared values for worklet-to-JS communication
  const sxSV = useSharedValue(0);
  const sySV = useSharedValue(0);
  const dxSV = useSharedValue(0);
  const dySV = useSharedValue(0);
  const dwSV = useSharedValue(0);
  const dhSV = useSharedValue(0);
  const endedSV = useSharedValue(false);

  /** Called via runOnJS from gesture onBegin — resets draft */
  const onBeginJS = useCallback((sx: number, sy: number) => {
    setDraft({ x: sx, y: sy, w: 0, h: 0 });
  }, []);

  /** Called via runOnJS from gesture onUpdate — updates draft */
  const onUpdateJS = useCallback((x: number, y: number, w: number, h: number) => {
    setDraft({ x, y, w, h });
  }, []);

  /** Called via runOnJS from gesture onEnd — commits tape or clears draft */
  const onEndJS = useCallback((d: { x: number; y: number; w: number; h: number } | null) => {
    if (d && d.w > 0.02 && d.h > 0.015) {
      onAdd(createWashiTape(d.x, d.y, d.w, d.h, activeColor));
    }
    setDraft(null);
  }, [activeColor, onAdd]);

  /** Called via runOnJS from gesture onFinalize — cleanup */
  const onFinalizeJS = useCallback(() => {
    setDraft(null);
  }, []);

  const drawGesture = Gesture.Pan()
    .enabled(drawingMode)
    .minDistance(3)
    .onBegin((e) => {
      'worklet';
      endedSV.value = false;
      sxSV.value = e.x / Math.max(1, width);
      sySV.value = e.y / Math.max(1, height);
      runOnJS(onBeginJS)(sxSV.value, sySV.value);
    })
    .onUpdate((e) => {
      'worklet';
      const cx = (sxSV.value * width + e.translationX) / Math.max(1, width);
      const cy = (sySV.value * height + e.translationY) / Math.max(1, height);
      const sx = sxSV.value;
      const sy = sySV.value;
      const ux = Math.min(sx, cx);
      const uy = Math.min(sy, cy);
      const uw = Math.abs(cx - sx);
      const uh = Math.abs(cy - sy);
      dxSV.value = ux;
      dySV.value = uy;
      dwSV.value = uw;
      dhSV.value = uh;
      runOnJS(onUpdateJS)(ux, uy, uw, uh);
    })
    .onEnd(() => {
      'worklet';
      if (endedSV.value) return;
      endedSV.value = true;
      const d = (dwSV.value > 0.02 && dhSV.value > 0.015)
        ? { x: dxSV.value, y: dySV.value, w: dwSV.value, h: dhSV.value }
        : null;
      runOnJS(onEndJS)(d);
    })
    .onFinalize(() => {
      'worklet';
      endedSV.value = true;
      runOnJS(onFinalizeJS)();
    });

  return (
    <View
      pointerEvents={drawingMode ? 'auto' : 'box-none'}
      style={[styles.layer, { width, height }]}
      testID={testID || 'pilot-v2-washi-layer'}
    >
      {/* Gesture overlay for drawing new tapes */}
      {drawingMode && (
        <GestureDetector gesture={drawGesture}>
          <Animated.View style={{ ...StyleSheet.absoluteFillObject, width, height }} />
        </GestureDetector>
      )}

      {/* Existing tapes */}
      {tapes.map((t) => (
        <TouchableOpacity
          key={t.id}
          activeOpacity={0.85}
          onPress={() => onToggle(t.id)}
          onLongPress={() => onRemove(t.id)}
          delayLongPress={500}
          style={[
            styles.tape,
            {
              left: t.x * width,
              top: t.y * height,
              width: t.w * width,
              height: t.h * height,
              backgroundColor: washiBg(t.color),
              borderColor: washiEdge(t.color),
              transform: [{ rotate: `${t.rotation || 0}deg` }],
              opacity: t.revealed ? 0.35 : 0.92,
            },
          ]}
          testID={`pilot-v2-washi-${t.id}`}
        >
          {t.revealed ? (
            <View style={styles.revealedHint}>
              <Text style={styles.revealedHintText}>tap to hide</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      ))}

      {/* Drag-draft preview while creating a new tape */}
      {draft ? (
        <View
          pointerEvents="none"
          style={[
            styles.tape,
            {
              left: draft.x * width,
              top: draft.y * height,
              width: draft.w * width,
              height: draft.h * height,
              backgroundColor: washiBg(activeColor),
              borderColor: washiEdge(activeColor),
              opacity: 0.55,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

interface ColorPickerProps {
  active: WashiTapeColor;
  onChange: (c: WashiTapeColor) => void;
}
export function WashiTapeColorPicker({ active, onChange }: ColorPickerProps) {
  return (
    <View style={styles.colorRow} testID="pilot-v2-washi-color-row">
      {WASHI_TAPE_COLORS.map((c) => (
        <TouchableOpacity
          key={c.name}
          onPress={() => onChange(c.name)}
          style={[
            styles.colorChip,
            { backgroundColor: c.bg, borderColor: active === c.name ? '#0F172A' : c.edge },
          ]}
          testID={`pilot-v2-washi-chip-${c.name}`}
        />
      ))}
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
  tape: {
    position: 'absolute',
    borderRadius: 2,
    borderWidth: 1,
    // Subtle handmade-paper grain effect via a single inset shadow on web.
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  revealedHint: {
    position: 'absolute',
    bottom: 2,
    right: 4,
  },
  revealedHintText: {
    fontSize: 9,
    color: 'rgba(15,23,42,0.55)',
    fontWeight: '600',
  },
  colorRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    flexWrap: 'wrap',
  },
  colorChip: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
  },
});