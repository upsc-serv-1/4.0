/**
 * PencilToolbar — Pilot V2 Step 6 Redesign
 * ----------------------------------------
 * Premium, Notability-style floating drawing toolbar:
 *   • One unified favorites preset toolbar (visually shows Pen vs Highlighter, actual color & thickness)
 *   • Tap a favorite preset for instant one-tap switching
 *   • Smooth spring-expanding controls panel that emerges from the active tool button
 *   • Horizontal drag/touch size slider for dynamic, step-free stroke thickness resizing
 *   • Action panels for Eraser and Lasso
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform,
  Modal, TextInput, ScrollView,
} from 'react-native';
import {
  Pen, Highlighter, Eraser, Lasso, Undo2, Redo2,
  Hand, Star, Plus, X, Sparkles, Trash2, RotateCcw,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate,
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

function parseFavorite(fav: string): { tool: 'pen' | 'highlighter'; color: string; width: number } {
  if (fav.startsWith('pen:') || fav.startsWith('highlighter:')) {
    const parts = fav.split(':');
    return {
      tool: parts[0] as any,
      color: parts[1],
      width: parseInt(parts[2] || '3', 10),
    };
  }
  return {
    tool: 'pen',
    color: fav,
    width: 3,
  };
}

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
  const palette: readonly string[] = isHL ? PILOT_V2_HIGHLIGHTER_COLORS : PILOT_V2_PEN_COLORS;
  const minWidth = isHL ? 6 : 1;
  const maxWidth = isHL ? 50 : 20;

  // Unified favorites toggle
  const serializedCurrent = `${tool}:${color}:${width}`;
  const isCurrentFavorited = favoriteColors.some(fav => {
    const p = parseFavorite(fav);
    return p.tool === tool && p.color.toLowerCase() === color.toLowerCase() && p.width === width;
  });

  const handleToggleFavorite = useCallback(() => {
    if (isCurrentFavorited) {
      const next = favoriteColors.filter(fav => {
        const p = parseFavorite(fav);
        return !(p.tool === tool && p.color.toLowerCase() === color.toLowerCase() && p.width === width);
      });
      onFavoritesChange(next);
    } else {
      const next = [...favoriteColors, serializedCurrent].slice(-6);
      onFavoritesChange(next);
    }
    ping();
  }, [tool, color, width, favoriteColors, isCurrentFavorited, serializedCurrent, onFavoritesChange]);

  // Spring animated controls panel height
  const panelHeight = useSharedValue(0);
  const panelOpacity = useSharedValue(0);

  useEffect(() => {
    const targetHeight = tool === 'pen' || tool === 'highlighter' ? 56 : 46;
    panelHeight.value = withSpring(targetHeight, { damping: 24, stiffness: 180 });
    panelOpacity.value = withSpring(1, { damping: 24, stiffness: 180 });
  }, [tool]);

  const animatedPanelStyle = useAnimatedStyle(() => ({
    height: panelHeight.value,
    opacity: panelOpacity.value,
    overflow: 'hidden',
  }));

  return (
    <View testID="pilot-v2-pencil-toolbar" style={s.card}>
      {/* ROW 1: Tools selection & Unified Presets */}
      <View style={s.topRow}>
        <View style={s.group}>
          <ToolBtn
            icon={<Pen size={17} color={tool === 'pen' ? '#5B4EFA' : '#64748b'} strokeWidth={2.5} />}
            active={tool === 'pen'}
            onPress={() => { onToolChange('pen'); ping(); }}
            testID="pilot-v2-pencil-tool-pen"
          />
          <ToolBtn
            icon={<Highlighter size={17} color={tool === 'highlighter' ? '#eab308' : '#64748b'} strokeWidth={2.5} />}
            active={tool === 'highlighter'}
            onPress={() => { onToolChange('highlighter'); ping(); }}
            testID="pilot-v2-pencil-tool-hl"
          />
          <ToolBtn
            icon={<Eraser size={17} color={tool === 'eraser' ? '#ef4444' : '#64748b'} strokeWidth={2.5} />}
            active={tool === 'eraser'}
            onPress={() => { onToolChange('eraser'); ping(); }}
            testID="pilot-v2-pencil-tool-eraser"
          />
          <ToolBtn
            icon={<Lasso size={17} color={tool === 'lasso' ? '#3b82f6' : '#64748b'} strokeWidth={2.5} />}
            active={tool === 'lasso'}
            onPress={() => { onToolChange('lasso'); ping(); }}
            testID="pilot-v2-pencil-tool-lasso"
          />
        </View>

        <View style={s.divider} />

        {/* Unified Favorites Toolbar Row */}
        <View style={s.group}>
          {favoriteColors.map((fav, i) => {
            const parsed = parseFavorite(fav);
            const isFavActive = tool === parsed.tool && color.toLowerCase() === parsed.color.toLowerCase() && width === parsed.width;
            return (
              <TouchableOpacity
                key={`${fav}-${i}`}
                onPress={() => {
                  onToolChange(parsed.tool);
                  onColorChange(parsed.color);
                  onWidthChange(parsed.width);
                  ping();
                }}
                style={[s.favBtn, isFavActive && s.favBtnActive]}
                testID={`pilot-v2-pencil-fav-${i}`}
              >
                {parsed.tool === 'highlighter' ? (
                  <View style={[s.favHLIcon, { backgroundColor: parsed.color }]}>
                    <Highlighter size={11} color="rgba(15,23,42,0.8)" strokeWidth={3} />
                  </View>
                ) : (
                  <View style={[s.favPenIcon, { backgroundColor: parsed.color }]}>
                    <Pen size={11} color="#fff" strokeWidth={3} />
                  </View>
                )}
                <View style={[s.favDot, { backgroundColor: parsed.color, width: Math.min(parsed.width / 2 + 3, 8), height: Math.min(parsed.width / 2 + 3, 8) }]} />
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            onPress={handleToggleFavorite}
            style={s.starBtn}
            testID="pilot-v2-pencil-toggle-fav"
          >
            <Star
              size={15}
              color={isCurrentFavorited ? '#f59e0b' : '#94a3b8'}
              fill={isCurrentFavorited ? '#f59e0b' : 'transparent'}
              strokeWidth={2.5}
            />
          </TouchableOpacity>
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
      </View>

      {/* ROW 2: Animated Tool-Specific Controls Panel */}
      <Animated.View style={[s.panelWrap, animatedPanelStyle]}>
        {(tool === 'pen' || tool === 'highlighter') && (
          <View style={s.controlPanel}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.swatchesScroll}>
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
                <Plus size={13} color="#475569" />
              </TouchableOpacity>
            </ScrollView>

            <View style={s.vDivider} />

            {/* Step-free horizontal slider brush resizer */}
            <HorizontalWidthSlider
              value={width}
              min={minWidth}
              max={maxWidth}
              color={color}
              onChange={(w) => { onWidthChange(w); ping(); }}
            />

            <View style={s.vDivider} />

            <View style={s.group}>
              <TouchableOpacity
                onPress={() => { onPencilOnlyChange(!pencilOnly); ping(); }}
                style={[s.iconBtn, pencilOnly && { backgroundColor: '#fee2e2' }]}
                testID="pilot-v2-pencil-only"
              >
                <Hand size={14} color={pencilOnly ? '#b91c1c' : '#64748b'} strokeWidth={2.5} />
              </TouchableOpacity>

              {tool === 'pen' && onShapeRecognitionChange && (
                <TouchableOpacity
                  onPress={() => { onShapeRecognitionChange(!shapeRecognition); ping(); }}
                  style={[s.iconBtn, shapeRecognition && { backgroundColor: '#ede9fe' }]}
                  testID="pilot-v2-pencil-shape"
                >
                  <Sparkles size={14} color={shapeRecognition ? '#7c3aed' : '#64748b'} strokeWidth={2.5} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {tool === 'eraser' && (
          <View style={s.controlPanel}>
            <HorizontalWidthSlider
              value={width}
              min={10}
              max={80}
              color="#ef4444"
              onChange={(w) => { onWidthChange(w); ping(); }}
            />
            <View style={s.vDivider} />
            <TouchableOpacity
              onPress={() => { onPencilOnlyChange(!pencilOnly); ping(); }}
              style={[s.iconBtn, pencilOnly && { backgroundColor: '#fee2e2' }]}
            >
              <Hand size={14} color={pencilOnly ? '#b91c1c' : '#64748b'} strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={s.panelText}>Erase strokes by dragging over them</Text>
          </View>
        )}

        {tool === 'lasso' && (
          <View style={s.controlPanel}>
            <TouchableOpacity
              onPress={() => { onPencilOnlyChange(!pencilOnly); ping(); }}
              style={[s.iconBtn, pencilOnly && { backgroundColor: '#fee2e2' }]}
            >
              <Hand size={14} color={pencilOnly ? '#b91c1c' : '#64748b'} strokeWidth={2.5} />
            </TouchableOpacity>
            <View style={s.vDivider} />
            <Text style={s.panelText}>Draw around strokes to select and move them</Text>
          </View>
        )}
      </Animated.View>

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

function HorizontalWidthSlider({ value, min, max, onChange, color }: { value: number; min: number; max: number; onChange: (v: number) => void; color: string }) {
  const [sliderWidth, setSliderWidth] = useState(140);
  const handleTouch = (e: any) => {
    const x = e.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / sliderWidth));
    const newVal = Math.round(min + ratio * (max - min));
    onChange(newVal);
  };
  return (
    <View style={s.sliderRow}>
      <Text style={s.sliderLabel}>Size</Text>
      <TouchableOpacity
        activeOpacity={0.9}
        onLayout={(e) => setSliderWidth(e.nativeEvent.layout.width || 140)}
        onPress={handleTouch}
        style={s.sliderTrackContainer}
      >
        <View style={s.sliderTrack} />
        <View
          style={[
            s.sliderThumb,
            {
              backgroundColor: color,
              left: `${((value - min) / (max - min)) * 100}%`,
            },
          ]}
        />
      </TouchableOpacity>
      <Text style={s.sliderVal}>{value}px</Text>
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
      scale.value = withSpring(1.2, { damping: 10, stiffness: 220 });
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

const s = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 5 },
    }),
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  panelWrap: {
    borderTopWidth: 0,
    borderColor: '#f1f5f9',
  },
  controlPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 6,
    height: '100%',
  },
  swatchesScroll: {
    alignItems: 'center',
    gap: 4,
    paddingRight: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '700',
    width: 24,
  },
  sliderTrackContainer: {
    height: 24,
    width: 100,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrack: {
    height: 4,
    backgroundColor: '#f1f5f9',
    borderRadius: 2,
    width: '100%',
  },
  sliderThumb: {
    position: 'absolute',
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
      },
      android: { elevation: 2 },
    }),
  },
  sliderVal: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '800',
    width: 24,
    textAlign: 'right',
  },
  favBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  favBtnActive: {
    borderColor: '#5B4EFA',
    backgroundColor: '#EEECFF',
  },
  favPenIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  favHLIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.85,
  },
  favDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  starBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  group: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  divider: { width: 1, height: 20, backgroundColor: '#f1f5f9', marginHorizontal: 4 },
  vDivider: { width: 1, height: 20, backgroundColor: '#f1f5f9' },
  iconBtn: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 8,
  },
  iconBtnActive: { backgroundColor: '#f1f5f9' },
  swatchBtn: {
    width: 24, height: 24,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  swatch: {
    width: 18, height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.12)',
  },
  swatchRing: {
    position: 'absolute',
    width: 24, height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#5B4EFA',
  },
  customBtn: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
  panelText: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 320, backgroundColor: '#fff',
    borderRadius: 16, padding: 18,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#0f172a' },
  modalLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: '#0F172A',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 14 },
  modalBtnGhost: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  modalBtnPrimary: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#5B4EFA',
  },
});
