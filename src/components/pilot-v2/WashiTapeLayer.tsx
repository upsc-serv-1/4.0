/**
 * WashiTapeLayer — renderer + creator for premium paper-tape masking.
 * ------------------------------------------------------------------
 * Sits ABOVE the text/pencil layers when active. Tap to toggle reveal.
 * Long-press to remove. Drag-while-active to draw a new tape rect.
 */

import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, PanResponder, Text } from 'react-native';
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
  const startRef = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawingMode,
      onMoveShouldSetPanResponder: () => drawingMode,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        startRef.current = { x: locationX / Math.max(1, width), y: locationY / Math.max(1, height) };
        setDraft({ x: startRef.current.x, y: startRef.current.y, w: 0, h: 0 });
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const cx = locationX / Math.max(1, width);
        const cy = locationY / Math.max(1, height);
        setDraft({
          x: Math.min(startRef.current.x, cx),
          y: Math.min(startRef.current.y, cy),
          w: Math.abs(cx - startRef.current.x),
          h: Math.abs(cy - startRef.current.y),
        });
      },
      onPanResponderRelease: () => {
        setDraft((d) => {
          if (d && d.w > 0.02 && d.h > 0.015) {
            onAdd(createWashiTape(d.x, d.y, d.w, d.h, activeColor));
          }
          return null;
        });
      },
      onPanResponderTerminate: () => setDraft(null),
    })
  ).current;

  return (
    <View
      pointerEvents={drawingMode ? 'auto' : 'box-none'}
      style={[styles.layer, { width, height }]}
      testID={testID || 'pilot-v2-washi-layer'}
      {...(drawingMode ? panResponder.panHandlers : {})}
    >
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
