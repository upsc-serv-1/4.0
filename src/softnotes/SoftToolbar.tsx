/**
 * SoftToolbar — floating tool palette for the Soft Notes canvas.
 * Mirrors the Hardnotes InkToolbar but typed against SoftToolKind.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Pen, Highlighter, Eraser, Square, Undo2, Redo2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { SoftToolKind } from './types';

const PEN_COLORS         = ['#0f172a', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
const HIGHLIGHTER_COLORS = ['#fde68a', '#fca5a5', '#a7f3d0', '#93c5fd', '#d8b4fe', '#fdba74'];
const TAPE_COLORS        = ['#ffffff', '#fffbeb', '#f1f5f9', '#fef3c7', '#fee2e2', '#0f172a'];
const PEN_WIDTHS         = [2, 4, 7];
const HL_WIDTHS          = [8, 14, 22];
const TAPE_WIDTHS        = [16, 28, 44];

interface Props {
  tool: SoftToolKind;
  color: string;
  width: number;
  onToolChange: (t: SoftToolKind) => void;
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRedo?: () => void;
  canRedo?: boolean;
}

export function SoftToolbar({
  tool, color, width,
  onToolChange, onColorChange, onWidthChange,
  onUndo, canUndo, onRedo, canRedo,
}: Props) {
  const palette = tool === 'highlighter' ? HIGHLIGHTER_COLORS : tool === 'tape' ? TAPE_COLORS : PEN_COLORS;
  const widths  = tool === 'highlighter' ? HL_WIDTHS : tool === 'tape' ? TAPE_WIDTHS : PEN_WIDTHS;
  const ping = () => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); };

  return (
    <View style={s.wrap} data-testid="soft-toolbar">
      <View style={s.group}>
        <ToolBtn active={tool === 'pen'} onPress={() => { onToolChange('pen'); ping(); }} testID="soft-tool-pen">
          <Pen size={18} color={tool === 'pen' ? '#0f172a' : '#94a3b8'} strokeWidth={2.5} />
        </ToolBtn>
        <ToolBtn active={tool === 'highlighter'} onPress={() => { onToolChange('highlighter'); ping(); }} testID="soft-tool-hl">
          <Highlighter size={18} color={tool === 'highlighter' ? '#eab308' : '#94a3b8'} strokeWidth={2.5} />
        </ToolBtn>
        <ToolBtn active={tool === 'eraser'} onPress={() => { onToolChange('eraser'); ping(); }} testID="soft-tool-eraser">
          <Eraser size={18} color={tool === 'eraser' ? '#ef4444' : '#94a3b8'} strokeWidth={2.5} />
        </ToolBtn>
        <ToolBtn active={tool === 'tape'} onPress={() => { onToolChange('tape'); ping(); }} testID="soft-tool-tape">
          <Square size={18} color={tool === 'tape' ? '#0f172a' : '#94a3b8'} fill={tool === 'tape' ? '#fde68a' : 'none'} strokeWidth={2.5} />
        </ToolBtn>
      </View>
      <View style={s.divider} />
      <View style={s.group}>
        {palette.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => { onColorChange(c); ping(); }}
            style={[s.swatch, { backgroundColor: c }, color === c && s.swatchActive]}
            data-testid={`soft-color-${c.replace('#', '')}`}
          />
        ))}
      </View>
      <View style={s.divider} />
      <View style={s.group}>
        {widths.map((w) => (
          <TouchableOpacity
            key={w}
            onPress={() => { onWidthChange(w); ping(); }}
            style={[s.widthBtn, width === w && s.widthBtnActive]}
            data-testid={`soft-width-${w}`}
          >
            <View style={{ width: Math.min(w, 18), height: Math.min(w, 18), borderRadius: 99, backgroundColor: color }} />
          </TouchableOpacity>
        ))}
      </View>
      {onUndo && (
        <>
          <View style={s.divider} />
          <View style={s.group}>
            <TouchableOpacity disabled={!canUndo} onPress={onUndo} style={[s.iconBtn, !canUndo && { opacity: 0.3 }]} data-testid="soft-undo">
              <Undo2 size={16} color="#0f172a" />
            </TouchableOpacity>
            <TouchableOpacity disabled={!canRedo} onPress={onRedo} style={[s.iconBtn, !canRedo && { opacity: 0.3 }]} data-testid="soft-redo">
              <Redo2 size={16} color="#0f172a" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

function ToolBtn({ active, onPress, children, testID }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.iconBtn, active && s.iconBtnActive]}
      data-testid={testID}
    >
      {children}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb',
    ...Platform.select({ ios: { shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 4 } }),
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 22, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  iconBtnActive: { backgroundColor: '#f1f5f9' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: '#0f172a' },
  widthBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  widthBtnActive: { backgroundColor: '#f1f5f9' },
});
