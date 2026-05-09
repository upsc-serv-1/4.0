/**
 * PencilToolbar — Pilot V2 Step 6
 * --------------------------------
 * Notability-style floating toolbar with:
 *   • Pen / Highlighter / Eraser / Lasso tools
 *   • 6 stroke widths per tool (per user spec)
 *   • Multiple colors + favorites + custom picker chip
 *   • Undo / Redo
 *   • Spring entrance animation on tool switch & color selection (Reanimated)
 *   • Toggleable palm-rejection ("Pencil only" mode)
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Modal, TextInput, ScrollView,
} from 'react-native';
import {
  Pen, Highlighter, Eraser, Lasso, Undo2, Redo2,
  Hand, Star, Plus, X, Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
} from 'react-native-reanimated';
import {
  PilotV2PencilTool,
  PILOT_V2_PEN_COLORS,
  PILOT_V2_HIGHLIGHTER_COLORS,
  PILOT_V2_PEN_WIDTHS,
  PILOT_V2_HIGHLIGHTER_WIDTHS,
} from './types';

interface Props {
  tool: PilotV2PencilTool;
  color: string;
  width: number;
  pencilOnly: boolean;
  shapeRecognition?: boolean;
  favoriteColors: string[];
  canUndo: boolean;
  canRedo: boolean;
  onToolChange: (t: PilotV2PencilTool) => void;
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
  onPencilOnlyChange: (v: boolean) => void;
  onShapeRecognitionChange?: (v: boolean) => void;
  onFavoritesChange: (next: string[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose?: () => void;
}

const ping = () => {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => undefined);
  }
};

export function PencilToolbar({
  tool, color, width, pencilOnly, shapeRecognition, favoriteColors,
  canUndo, canRedo,
  onToolChange, onColorChange, onWidthChange, onPencilOnlyChange,
  onShapeRecognitionChange,
  onFavoritesChange, onUndo, onRedo, onClose,
}: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const [customHex, setCustomHex] = useState('#');

  const isHL = tool === 'highlighter';
  const palette: readonly string[] =
    tool === 'eraser' || tool === 'lasso'
      ? PILOT_V2_PEN_COLORS
      : isHL
        ? PILOT_V2_HIGHLIGHTER_COLORS
        : PILOT_V2_PEN_COLORS;
  const widths: readonly number[] = isHL ? PILOT_V2_HIGHLIGHTER_WIDTHS : PILOT_V2_PEN_WIDTHS;

  const handleAddFavorite = useCallback(() => {
    if (favoriteColors.includes(color)) {
      onFavoritesChange(favoriteColors.filter(c => c !== color));
    } else {
      const next = [...favoriteColors, color].slice(-6);
      onFavoritesChange(next);
    }
    ping();
  }, [color, favoriteColors, onFavoritesChange]);

  return (
    <View
      testID="pilot-v2-pencil-toolbar"
      style={s.wrap}
    >
      <View style={s.group}>
        <ToolBtn
          icon={<Pen size={18} color={tool === 'pen' ? '#0f172a' : '#94a3b8'} strokeWidth={2.5} />}
          active={tool === 'pen'}
          onPress={() => { onToolChange('pen'); ping(); }}
          testID="pilot-v2-pencil-tool-pen"
        />
        <ToolBtn
          icon={<Highlighter size={18} color={tool === 'highlighter' ? '#eab308' : '#94a3b8'} strokeWidth={2.5} />}
          active={tool === 'highlighter'}
          onPress={() => { onToolChange('highlighter'); ping(); }}
          testID="pilot-v2-pencil-tool-hl"
        />
        <ToolBtn
          icon={<Eraser size={18} color={tool === 'eraser' ? '#ef4444' : '#94a3b8'} strokeWidth={2.5} />}
          active={tool === 'eraser'}
          onPress={() => { onToolChange('eraser'); ping(); }}
          testID="pilot-v2-pencil-tool-eraser"
        />
        <ToolBtn
          icon={<Lasso size={18} color={tool === 'lasso' ? '#3b82f6' : '#94a3b8'} strokeWidth={2.5} />}
          active={tool === 'lasso'}
          onPress={() => { onToolChange('lasso'); ping(); }}
          testID="pilot-v2-pencil-tool-lasso"
        />
      </View>

      <View style={s.divider} />

      <View style={s.group}>
        {palette.map((c) => (
          <ColorSwatch
            key={`p-${c}`}
            color={c}
            active={color.toLowerCase() === c.toLowerCase()}
            onPress={() => { onColorChange(c); ping(); }}
            testID={`pilot-v2-pencil-color-${c.replace('#', '')}`}
          />
        ))}
        <TouchableOpacity
          onPress={() => { setCustomHex(color); setShowCustom(true); ping(); }}
          style={s.customBtn}
          testID="pilot-v2-pencil-custom-color"
        >
          <Plus size={14} color="#475569" />
        </TouchableOpacity>
      </View>

      {favoriteColors.length > 0 && (
        <>
          <View style={s.divider} />
          <View style={s.group}>
            {favoriteColors.map((c) => (
              <ColorSwatch
                key={`f-${c}`}
                color={c}
                active={color.toLowerCase() === c.toLowerCase()}
                onPress={() => { onColorChange(c); ping(); }}
                testID={`pilot-v2-pencil-fav-${c.replace('#', '')}`}
              />
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        onPress={handleAddFavorite}
        style={s.iconBtn}
        testID="pilot-v2-pencil-toggle-fav"
      >
        <Star
          size={15}
          color={favoriteColors.includes(color) ? '#f59e0b' : '#94a3b8'}
          fill={favoriteColors.includes(color) ? '#f59e0b' : 'transparent'}
          strokeWidth={2}
        />
      </TouchableOpacity>

      <View style={s.divider} />

      <View style={s.group}>
        {widths.map((w) => (
          <WidthBtn
            key={`w-${w}`}
            value={w}
            active={width === w}
            color={color}
            onPress={() => { onWidthChange(w); ping(); }}
            testID={`pilot-v2-pencil-width-${w}`}
          />
        ))}
      </View>

      <View style={s.divider} />

      <View style={s.group}>
        <TouchableOpacity
          disabled={!canUndo}
          onPress={() => { onUndo(); ping(); }}
          style={[s.iconBtn, !canUndo && { opacity: 0.3 }]}
          testID="pilot-v2-pencil-undo"
        >
          <Undo2 size={16} color="#0f172a" />
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!canRedo}
          onPress={() => { onRedo(); ping(); }}
          style={[s.iconBtn, !canRedo && { opacity: 0.3 }]}
          testID="pilot-v2-pencil-redo"
        >
          <Redo2 size={16} color="#0f172a" />
        </TouchableOpacity>
      </View>

      <View style={s.divider} />

      <TouchableOpacity
        onPress={() => { onPencilOnlyChange(!pencilOnly); ping(); }}
        style={[s.iconBtn, pencilOnly && { backgroundColor: '#fee2e2' }]}
        testID="pilot-v2-pencil-only"
      >
        <Hand size={15} color={pencilOnly ? '#b91c1c' : '#94a3b8'} strokeWidth={2.5} />
      </TouchableOpacity>

      {onShapeRecognitionChange ? (
        <TouchableOpacity
          onPress={() => { onShapeRecognitionChange(!shapeRecognition); ping(); }}
          style={[s.iconBtn, shapeRecognition && { backgroundColor: '#ede9fe' }]}
          testID="pilot-v2-pencil-shape"
        >
          <Sparkles size={15} color={shapeRecognition ? '#7c3aed' : '#94a3b8'} strokeWidth={2.5} />
        </TouchableOpacity>
      ) : null}

      {onClose && (
        <>
          <View style={s.divider} />
          <TouchableOpacity
            onPress={() => { onClose(); ping(); }}
            style={s.iconBtn}
            testID="pilot-v2-pencil-close"
          >
            <X size={16} color="#475569" />
          </TouchableOpacity>
        </>
      )}

      <Modal
        visible={showCustom}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCustom(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalCard} testID="pilot-v2-pencil-color-modal">
            <Text style={s.modalTitle}>Custom color</Text>
            <Text style={s.modalLabel}>Hex (e.g. #0F172A)</Text>
            <TextInput
              value={customHex}
              onChangeText={setCustomHex}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
              style={s.modalInput}
              testID="pilot-v2-pencil-color-input"
            />
            <ScrollView horizontal style={{ marginTop: 12 }}>
              {[
                '#FF6B6B', '#FFA94D', '#FFE066', '#94D82D', '#63E6BE', '#4DABF7',
                '#748FFC', '#9775FA', '#E599F7', '#FFC9C9', '#1E3A8A', '#0F172A',
              ].map(c => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCustomHex(c)}
                  style={[s.swatch, { backgroundColor: c, marginRight: 6 }]}
                />
              ))}
            </ScrollView>
            <View style={s.modalActions}>
              <TouchableOpacity
                onPress={() => setShowCustom(false)}
                style={s.modalBtnGhost}
              >
                <Text style={{ color: '#64748b', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (/^#[0-9a-fA-F]{6}$/.test(customHex)) {
                    onColorChange(customHex);
                    onFavoritesChange(
                      favoriteColors.includes(customHex)
                        ? favoriteColors
                        : [...favoriteColors, customHex].slice(-6),
                    );
                    setShowCustom(false);
                  }
                }}
                style={s.modalBtnPrimary}
                testID="pilot-v2-pencil-color-apply"
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ToolBtn(
  { icon, active, onPress, testID }:
    { icon: React.ReactNode; active: boolean; onPress: () => void; testID?: string },
) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (active) {
      scale.value = withSpring(1.18, { damping: 10, stiffness: 220 });
      const id = setTimeout(() => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      }, 140);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [active, scale]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[s.iconBtn, active && s.iconBtnActive]}
      testID={testID}
    >
      <Animated.View style={animStyle}>
        {icon}
      </Animated.View>
    </TouchableOpacity>
  );
}

function ColorSwatch(
  { color, active, onPress, testID }:
    { color: string; active: boolean; onPress: () => void; testID?: string },
) {
  const scale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  useEffect(() => {
    if (active) {
      scale.value = withSpring(1.22, { damping: 11, stiffness: 240 });
      ringOpacity.value = withTiming(1, { duration: 140 });
    } else {
      scale.value = withSpring(1, { damping: 13, stiffness: 200 });
      ringOpacity.value = withTiming(0, { duration: 120 });
    }
  }, [active, scale, ringOpacity]);
  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
  }));
  return (
    <TouchableOpacity onPress={onPress} testID={testID} style={s.swatchBtn}>
      <Animated.View
        style={[s.swatch, { backgroundColor: color }, wrapStyle]}
      />
      <Animated.View style={[s.swatchRing, ringStyle]} pointerEvents="none" />
    </TouchableOpacity>
  );
}

function WidthBtn(
  { value, active, color, onPress, testID }:
    { value: number; active: boolean; color: string; onPress: () => void; testID?: string },
) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (active) {
      scale.value = withSpring(1.15, { damping: 12, stiffness: 220 });
    } else {
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });
    }
  }, [active, scale]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <TouchableOpacity onPress={onPress} style={[s.widthBtn, active && s.widthBtnActive]} testID={testID}>
      <Animated.View
        style={[
          {
            width: Math.min(value + 4, 22),
            height: Math.min(value + 4, 22),
            borderRadius: 99,
            backgroundColor: color,
          },
          animStyle,
        ]}
      />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: '#ffffff', borderRadius: 18,
    borderWidth: 1, borderColor: '#e5e7eb',
    flexWrap: 'wrap',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.12,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 6 },
    }),
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 22, backgroundColor: '#e5e7eb', marginHorizontal: 4 },
  iconBtn: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 9,
  },
  iconBtnActive: { backgroundColor: '#f1f5f9' },
  swatchBtn: {
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  swatch: {
    width: 20, height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.18)',
  },
  swatchRing: {
    position: 'absolute',
    width: 26, height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#0f172a',
  },
  widthBtn: {
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 9,
  },
  widthBtnActive: { backgroundColor: '#f1f5f9' },
  customBtn: {
    width: 26, height: 26, borderRadius: 13,
    borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 380, backgroundColor: '#fff',
    borderRadius: 16, padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, color: '#0f172a' },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  modalBtnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalBtnPrimary: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10,
    backgroundColor: '#5B4EFA',
  },
});
