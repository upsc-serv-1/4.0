/**
 * InkToolbar — floating, minimal tool palette for the Ink lens.
 *
 * Mirrors Notability's quick-access top bar: pen / highlighter / eraser,
 * six colour swatches and three stroke widths. Pure UI — state lives in parent.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Pen, Highlighter, Eraser, Sparkles, Undo2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { ToolKind } from './strokes';

const PEN_COLORS = ['#0f172a', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];
const HIGHLIGHTER_COLORS = ['#fde68a', '#fca5a5', '#a7f3d0', '#93c5fd', '#d8b4fe', '#fdba74'];
const WIDTHS = [2, 4, 7];

interface Props {
  tool: ToolKind;
  color: string;
  width: number;
  onToolChange: (t: ToolKind) => void;
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onTextMode?: () => void;
  isTextMode?: boolean;
}

export function InkToolbar({
  tool,
  color,
  width,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  canUndo,
  onTextMode,
  isTextMode,
}: Props) {
  const { colors } = useTheme();
  const palette = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS;

  const ping = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  };

  return (
    <View style={[s.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]} data-testid="ink-toolbar">
      {/* Tools */}
      <View style={s.group}>
        <ToolBtn active={tool === 'pen'} onPress={() => { onToolChange('pen'); ping(); }} testID="ink-tool-pen">
          <Pen size={18} color={tool === 'pen' ? '#0f172a' : colors.textTertiary} strokeWidth={tool === 'pen' ? 2.5 : 2} />
        </ToolBtn>
        <ToolBtn active={tool === 'highlighter'} onPress={() => { onToolChange('highlighter'); ping(); }} testID="ink-tool-highlighter">
          <Highlighter size={18} color={tool === 'highlighter' ? '#eab308' : colors.textTertiary} strokeWidth={tool === 'highlighter' ? 2.5 : 2} />
        </ToolBtn>
        <ToolBtn active={tool === 'eraser'} onPress={() => { onToolChange('eraser'); ping(); }} testID="ink-tool-eraser">
          <Eraser size={18} color={tool === 'eraser' ? '#ef4444' : colors.textTertiary} strokeWidth={tool === 'eraser' ? 2.5 : 2} />
        </ToolBtn>
      </View>

      {onTextMode && (
        <>
          <View style={[s.divider, { backgroundColor: colors.border }]} />
          <ToolBtn active={!!isTextMode} onPress={() => { onTextMode(); ping(); }} testID="ink-tool-text">
            <Text style={{ fontSize: 15, fontWeight: '900', color: isTextMode ? colors.primary : colors.textTertiary }}>T</Text>
          </ToolBtn>
        </>
      )}

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* Colors (hidden while erasing) */}
      {tool !== 'eraser' && (
        <View style={s.group}>
          {palette.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => { onColorChange(c); ping(); }}
              data-testid={`ink-color-${c.replace('#', '')}`}
              style={[
                s.swatch,
                { backgroundColor: c, borderColor: color === c ? '#0f172a' : 'transparent', transform: [{ scale: color === c ? 1.12 : 1 }] },
              ]}
            />
          ))}
        </View>
      )}

      {tool !== 'eraser' && <View style={[s.divider, { backgroundColor: colors.border }]} />}

      {/* Widths */}
      <View style={s.group}>
        {WIDTHS.map((w) => (
          <TouchableOpacity
            key={w}
            onPress={() => { onWidthChange(w); ping(); }}
            data-testid={`ink-width-${w}`}
            style={[
              s.widthBtn,
              {
                borderColor: width === w ? '#0f172a' : colors.border,
                backgroundColor: width === w ? colors.bg : 'transparent',
              },
            ]}
          >
            <View style={{ width: w * 2, height: w * 2, borderRadius: w, backgroundColor: colors.textPrimary }} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={[s.divider, { backgroundColor: colors.border }]} />

      {/* Undo */}
      {onUndo && (
        <TouchableOpacity
          onPress={() => { if (canUndo) { onUndo(); ping(); } }}
          disabled={!canUndo}
          style={[s.iconBtn, { opacity: canUndo ? 1 : 0.3 }]}
          data-testid="ink-undo"
        >
          <Undo2 size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      <View style={s.group}>
        <View style={[s.toolHint, { backgroundColor: colors.textPrimary + '10' }]}>
          <Sparkles size={11} color={colors.textSecondary} />
          <Text style={[s.toolHintText, { color: colors.textSecondary }]}>per-bullet</Text>
        </View>
      </View>
    </View>
  );
}

function ToolBtn({ active, onPress, children, testID }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      data-testid={testID}
      style={[
        s.toolBtn,
        { backgroundColor: active ? colors.bg : 'transparent', borderColor: active ? colors.textPrimary : 'transparent' },
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 6,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  divider: { width: 1, height: 22, marginHorizontal: 2 },
  toolBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
  widthBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.2, alignItems: 'center', justifyContent: 'center' },
  toolHint: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  toolHintText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
});
