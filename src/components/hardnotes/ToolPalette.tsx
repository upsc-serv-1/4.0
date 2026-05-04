/**
 * ToolPalette — floating, draggable toolbar for the Pro-Note canvas.
 * Uses React Native Reanimated + Gesture Handler for a 60fps drag experience.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pen, Highlighter, Eraser, Lasso, Undo2, Redo2, GripVertical, Minus, Plus } from 'lucide-react-native';
import { ToolKind } from './strokes';

interface Props {
  tool: ToolKind;
  onToolChange: (t: ToolKind) => void;
  color: string;
  onColorChange: (c: string) => void;
  width: number;
  onWidthChange: (w: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const PEN_COLORS = ['#0f172a', '#ef4444', '#3b82f6', '#16a34a', '#f59e0b', '#a855f7'];
const HIGHLIGHTER_COLORS = ['#fde047', '#86efac', '#93c5fd', '#fca5a5'];

export function ToolPalette({
  tool,
  onToolChange,
  color,
  onColorChange,
  width,
  onWidthChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: Props) {
  const translateX = useSharedValue(20);
  const translateY = useSharedValue(90);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const drag = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      translateX.value = withSpring(translateX.value);
      translateY.value = withSpring(translateY.value);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ] as any,
  }));

  const colors = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS;

  return (
    <Animated.View style={[styles.wrap, style]} data-testid="hn-tool-palette">
      <GestureDetector gesture={drag}>
        <View style={styles.dragHandle}>
          <GripVertical size={14} color="#64748b" />
        </View>
      </GestureDetector>

      <View style={styles.toolRow}>
        <ToolBtn active={tool === 'pen'} onPress={() => onToolChange('pen')} testID="hn-tool-pen">
          <Pen size={16} color={tool === 'pen' ? '#fff' : '#0f172a'} />
        </ToolBtn>
        <ToolBtn active={tool === 'highlighter'} onPress={() => onToolChange('highlighter')} testID="hn-tool-highlighter">
          <Highlighter size={16} color={tool === 'highlighter' ? '#fff' : '#0f172a'} />
        </ToolBtn>
        <ToolBtn active={tool === 'eraser'} onPress={() => onToolChange('eraser')} testID="hn-tool-eraser">
          <Eraser size={16} color={tool === 'eraser' ? '#fff' : '#0f172a'} />
        </ToolBtn>
        <ToolBtn active={tool === 'lasso'} onPress={() => onToolChange('lasso')} testID="hn-tool-lasso">
          <Lasso size={16} color={tool === 'lasso' ? '#fff' : '#0f172a'} />
        </ToolBtn>
      </View>

      <View style={styles.divider} />

      <View style={styles.colorRow}>
        {colors.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => onColorChange(c)}
            style={[
              styles.colorDot,
              { backgroundColor: c },
              color === c && styles.colorDotActive,
            ]}
            data-testid={`hn-color-${c}`}
          />
        ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.widthRow}>
        <TouchableOpacity
          onPress={() => onWidthChange(Math.max(1, width - 1))}
          style={styles.sizeBtn}
          data-testid="hn-width-dec"
        >
          <Minus size={12} color="#0f172a" />
        </TouchableOpacity>
        <View style={styles.widthPreviewWrap}>
          <View style={[styles.widthPreview, { width: Math.max(2, width), height: Math.max(2, width), backgroundColor: color }]} />
        </View>
        <TouchableOpacity
          onPress={() => onWidthChange(Math.min(24, width + 1))}
          style={styles.sizeBtn}
          data-testid="hn-width-inc"
        >
          <Plus size={12} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      <View style={styles.toolRow}>
        <TouchableOpacity
          onPress={onUndo}
          disabled={!canUndo}
          style={[styles.actionBtn, !canUndo && { opacity: 0.35 }]}
          data-testid="hn-undo"
        >
          <Undo2 size={15} color="#0f172a" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onRedo}
          disabled={!canRedo}
          style={[styles.actionBtn, !canRedo && { opacity: 0.35 }]}
          data-testid="hn-redo"
        >
          <Redo2 size={15} color="#0f172a" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function ToolBtn({
  active,
  onPress,
  children,
  testID,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
  testID: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.toolBtn, active && styles.toolBtnActive]}
      data-testid={testID}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    gap: 6,
  },
  dragHandle: { alignItems: 'center', paddingVertical: 4 },
  toolRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 4 },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  toolBtnActive: { backgroundColor: '#0f172a' },
  divider: { height: 1, backgroundColor: 'rgba(15,23,42,0.08)', marginVertical: 4 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 4, maxWidth: 120 },
  colorDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#0f172a' },
  widthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  sizeBtn: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.06)' },
  widthPreviewWrap: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  widthPreview: { borderRadius: 50 },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
});
