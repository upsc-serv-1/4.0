/**
 * UnifiedAnnotationFAB — Apple Pencil-style expandable floating action button
 * --------------------------------------------------------------------------
 * Single compact FAB at bottom-right that expands to reveal all annotation
 * tools: Pen, Highlighter, Eraser, Washi Tape, plus color picker.
 *
 * Collapsed: circular button with current tool icon
 * Expanded: springs open to show tool row + color/sub-tool row
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, interpolate, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Pen, Highlighter, Eraser, X, Layers, Undo, Redo, Hand,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { PilotV2PencilTool } from './types';
import { WashiTapeColor, WASHI_TAPE_COLORS } from './washiTape';

const FAB_POS_KEY = 'pilot_v2_fab_position';

export type AnnotationMode = PilotV2PencilTool | 'washi';

interface Props {
  /** Current active annotation mode */
  mode: AnnotationMode;
  /** Pencil tool (pen/highlighter/eraser/lasso) — valid only when mode is a pencil tool */
  pencilTool: PilotV2PencilTool;
  /** Current pencil color */
  color: string;
  /** Current pencil width */
  width: number;
  /** Whether pencil-only (palm rejection) is enabled */
  pencilOnly: boolean;
  /** Current washi tape color (valid when mode === 'washi') */
  washiColor: WashiTapeColor;
  /** Undo/redo availability */
  canUndo: boolean;
  canRedo: boolean;
  /** Callbacks */
  onModeChange: (mode: AnnotationMode) => void;
  onToolChange: (t: PilotV2PencilTool) => void;
  onColorChange: (c: string) => void;
  onWidthChange: (w: number) => void;
  onPencilOnlyChange: (v: boolean) => void;
  onWashiColorChange: (c: WashiTapeColor) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClose: () => void;
}

const TOOLS: Array<{ mode: AnnotationMode; label: string; icon: React.ReactNode }> = [
  { mode: 'pen', label: 'Pen', icon: <Pen size={20} strokeWidth={2.5} /> },
  { mode: 'highlighter', label: 'HL', icon: <Highlighter size={20} strokeWidth={2.5} /> },
  { mode: 'eraser', label: 'Erase', icon: <Eraser size={20} strokeWidth={2.5} /> },
  { mode: 'washi', label: 'Tape', icon: <Layers size={20} strokeWidth={2.5} /> },
];

const ping = () => {
  if (Platform.OS !== 'web') {
    Haptics.selectionAsync().catch(() => undefined);
  }
};

export function UnifiedAnnotationFAB({
  mode, pencilTool, color, width, pencilOnly, washiColor,
  canUndo, canRedo,
  onModeChange, onToolChange, onColorChange, onWidthChange,
  onPencilOnlyChange, onWashiColorChange,
  onUndo, onRedo, onClose,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useSharedValue(0);

  // Draggable position
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const savedPanX = useSharedValue(0);
  const savedPanY = useSharedValue(0);
  const [fabOffset, setFabOffset] = useState({ x: 0, y: 0 });

  const saveFabPosition = useCallback(async (x: number, y: number) => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      await AsyncStorage.setItem(FAB_POS_KEY, JSON.stringify({ x, y }));
    } catch {}
  }, []);

  const loadFabPosition = useCallback(async () => {
    try {
      const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
      const raw = await AsyncStorage.getItem(FAB_POS_KEY);
      if (raw) {
        const { x, y } = JSON.parse(raw);
        panX.value = x;
        panY.value = y;
        savedPanX.value = x;
        savedPanY.value = y;
        setFabOffset({ x, y });
      }
    } catch {}
  }, []);

  useEffect(() => { loadFabPosition(); }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      panX.value = savedPanX.value + e.translationX;
      panY.value = savedPanY.value + e.translationY;
    })
    .onEnd(() => {
      savedPanX.value = panX.value;
      savedPanY.value = panY.value;
      runOnJS(saveFabPosition)(panX.value, panY.value);
    });

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panX.value }, { translateY: panY.value }],
  }));

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    expandAnim.value = withSpring(next ? 1 : 0, {
      damping: 18,
      stiffness: 160,
    });
    if (next) {
      onModeChange(mode);
    }
    ping();
  };

  const handleToolSelect = (nextMode: AnnotationMode) => {
    onModeChange(nextMode);
    if (nextMode !== 'washi') {
      onToolChange(nextMode as PilotV2PencilTool);
    }
    // Keep expanded so user can pick colors/widths
    ping();
  };

  const handleClose = () => {
    expandAnim.value = withSpring(0, { damping: 18, stiffness: 160 });
    setExpanded(false);
    onClose();
  };

  const isHighlighter = mode === 'highlighter';
  const minW = isHighlighter ? 6 : 1;
  const maxW = isHighlighter ? 50 : 20;
  
  const decreaseWidth = () => {
    const next = Math.max(minW, width - (isHighlighter ? 2 : 1));
    onWidthChange(next);
    ping();
  };
  const increaseWidth = () => {
    const next = Math.min(maxW, width + (isHighlighter ? 2 : 1));
    onWidthChange(next);
    ping();
  };

  // Animated styles
  const fabRotate = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(expandAnim.value, [0, 1], [0, 45])}deg` }],
  }));

  const panelScale = useAnimatedStyle(() => ({
    opacity: expandAnim.value,
    transform: [{ scale: interpolate(expandAnim.value, [0, 1], [0.85, 1]) }],
  }));

  const panelTranslate = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(expandAnim.value, [0, 1], [20, 0]) },
    ],
  }));

  const isActive = (m: AnnotationMode) => {
    if (m === 'washi') return mode === 'washi';
    return mode === m;
  };
  const toolColor = (m: AnnotationMode) => {
    if (m === 'washi') return '#8B5CF6';
    switch (m) {
      case 'pen': return '#5B4EFA';
      case 'highlighter': return '#eab308';
      case 'eraser': return '#ef4444';
      default: return '#64748b';
    }
  };

  return (
    <View
      pointerEvents="box-none"
      style={styles.container}
      testID="unified-annotation-fab"
    >
      {/* Draggable wrapper */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={dragStyle}>
      {/* Expandable panel */}
      {expanded && (
        <Animated.View
          style={[
            styles.panel,
            panelScale,
            panelTranslate,
          ]}
        >
          {/* Row 1: Tool selection */}
          <View style={styles.toolRow}>
            {TOOLS.map((t) => {
              const active = isActive(t.mode);
              return (
                <TouchableOpacity
                  key={t.mode}
                  onPress={() => handleToolSelect(t.mode)}
                  style={[
                    styles.toolBtn,
                    active && { backgroundColor: toolColor(t.mode) + '18', borderColor: toolColor(t.mode) },
                  ]}
                  testID={`fab-tool-${t.mode}`}
                >
                <View>
                  {React.cloneElement(t.icon as React.ReactElement<any>, {
                    color: active ? toolColor(t.mode) : '#64748b',
                  })}
                </View>
                  <Text
                    style={[
                      styles.toolLabel,
                      { color: active ? toolColor(t.mode) : '#94a3b8' },
                      active && { fontWeight: '800' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Row 2: Color/Width controls */}
          {(mode === 'pen' || mode === 'highlighter') && (
            <PencilColorRow
              isHighlighter={mode === 'highlighter'}
              activeColor={color}
              onColorChange={onColorChange}
            />
          )}

          {mode === 'washi' && (
            <WashiColorRow
              activeColor={washiColor}
              onColorChange={onWashiColorChange}
            />
          )}

          {mode === 'eraser' && (
            <View style={styles.eraserHint}>
              <Text style={styles.hintText}>Drag over strokes to erase</Text>
            </View>
          )}

          {/* Row 3: Undo / Redo / Size / Close */}
          <View style={styles.utilityRow}>
            <TouchableOpacity
              disabled={!canUndo}
              onPress={() => { onUndo(); ping(); }}
              style={[styles.utilBtn, !canUndo && { opacity: 0.3 }]}
              testID="fab-undo"
            >
              <Undo size={16} color="#475569" />
            </TouchableOpacity>
            <TouchableOpacity
              disabled={!canRedo}
              onPress={() => { onRedo(); ping(); }}
              style={[styles.utilBtn, !canRedo && { opacity: 0.3 }]}
              testID="fab-redo"
            >
              <Redo size={16} color="#475569" />
            </TouchableOpacity>
            {mode !== 'eraser' && (
              <TouchableOpacity
                onPress={() => { onPencilOnlyChange(!pencilOnly); ping(); }}
                style={[styles.utilBtn, pencilOnly && { backgroundColor: '#fee2e2' }]}
                testID="fab-pencil-only"
              >
                <Hand size={16} color={pencilOnly ? '#b91c1c' : '#94a3b8'} />
              </TouchableOpacity>
            )}

            {/* Inlined size +/- buttons for compact internal layout */}
            {(mode === 'pen' || mode === 'highlighter') && (
              <View style={styles.widthControlsGroup}>
                <TouchableOpacity
                  onPress={decreaseWidth}
                  disabled={width <= minW}
                  style={[styles.widthBtnSmall, width <= minW && { opacity: 0.35 }]}
                >
                  <Text style={styles.widthBtnTextSmall}>−</Text>
                </TouchableOpacity>
                <View style={styles.widthIndicatorSmall}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: 0.8, transform: [{ scale: 0.5 + (width / maxW) * 1.2 }] }} />
                  <Text style={styles.widthValueLabelSmall}>{width}</Text>
                </View>
                <TouchableOpacity
                  onPress={increaseWidth}
                  disabled={width >= maxW}
                  style={[styles.widthBtnSmall, width >= maxW && { opacity: 0.35 }]}
                >
                  <Text style={styles.widthBtnTextSmall}>+</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              onPress={handleClose}
              style={[styles.utilBtn, { marginLeft: 'auto' }]}
              testID="fab-close"
            >
              <X size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Main FAB button */}
      <TouchableOpacity
        onPress={toggleExpand}
        activeOpacity={0.85}
        style={[
          styles.fab,
          { backgroundColor: mode === 'washi' ? '#8B5CF6' : (pencilTool === 'eraser' ? '#ef4444' : '#5B4EFA') },
          expanded && styles.fabExpanded,
        ]}
        testID="annotate-fab-main"
      >
        <Animated.View style={fabRotate}>
          {mode === 'washi' ? (
            <Layers size={24} color="#fff" strokeWidth={2.5} />
          ) : pencilTool === 'eraser' ? (
            <Eraser size={24} color="#fff" strokeWidth={2.5} />
          ) : (
            <Pen size={24} color="#fff" strokeWidth={2.5} />
          )}
        </Animated.View>
      </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/* ─── Pencil color row ─────────────────────────────────────────────────────── */

const PEN_COLORS = ['#0F172A', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'];
const HL_COLORS = ['#FDE68A', '#FCA5A5', '#A7F3D0', '#93C5FD', '#D8B4FE', '#FDBA74'];

function PencilColorRow({
  isHighlighter, activeColor, onColorChange,
}: {
  isHighlighter: boolean;
  activeColor: string;
  onColorChange: (c: string) => void;
}) {
  const palette = isHighlighter ? HL_COLORS : PEN_COLORS;

  return (
    <View style={styles.colorRow}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchScroll}>
        {palette.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => { onColorChange(c); ping(); }}
            style={[
              styles.colorChip,
              { backgroundColor: c },
              activeColor.toLowerCase() === c.toLowerCase() && styles.colorChipActive,
            ]}
            testID={`fab-color-${c.replace('#', '')}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/* ─── Washi color row ────────────────────────────────────────────────────── */

function WashiColorRow({
  activeColor, onColorChange,
}: {
  activeColor: WashiTapeColor;
  onColorChange: (c: WashiTapeColor) => void;
}) {
  return (
    <View style={styles.colorRow}>
      <Text style={styles.washiLabel}>Tape</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.swatchScroll}>
        {WASHI_TAPE_COLORS.map((c) => (
          <TouchableOpacity
            key={c.name}
            onPress={() => { onColorChange(c.name); ping(); }}
            style={[
              styles.colorChip,
              { backgroundColor: c.bg },
              activeColor === c.name && styles.washiChipActive,
            ]}
            testID={`fab-washi-${c.name}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    alignItems: 'flex-end',
    zIndex: 1100,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabExpanded: {
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  panel: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 12,
    minWidth: 240,
    maxWidth: 380,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 4,
  },
  toolBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 4,
  },
  toolLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 8,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  swatchScroll: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    paddingRight: 8,
  },
  colorChip: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.1)',
  },
  colorChipActive: {
    borderWidth: 2.5,
    borderColor: '#0F172A',
  },
  washiChipActive: {
    borderWidth: 2.5,
    borderColor: '#0F172A',
  },
  washiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8B5CF6',
    letterSpacing: 0.5,
    marginRight: 4,
  },
  widthGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
  },
  widthDot: {
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  widthDotActive: {
    borderWidth: 2,
    borderColor: '#0F172A',
  },
  widthSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
    flex: 1,
  },
  widthBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  widthTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
    position: 'relative',
  },
  widthTrackFill: {
    height: '100%',
    borderRadius: 3,
  },
  widthThumb: {
    position: 'absolute',
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  widthValueLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    minWidth: 18,
    textAlign: 'center',
  },
  eraserHint: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  hintText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  utilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  utilBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthControlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: '#f1f5f9',
    paddingLeft: 8,
  },
  widthBtnSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  widthBtnTextSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  widthIndicatorSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 32,
    justifyContent: 'center',
  },
  widthValueLabelSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
});