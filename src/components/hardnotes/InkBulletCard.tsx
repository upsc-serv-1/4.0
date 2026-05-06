/**
 * InkBulletCard — single bullet/point card for the unified Hardnotes editor.
 *
 * Renders *one* Point and adapts to the active lens:
 *   • glance  →  rich HTML preview, tap to inline-edit, checklist toggle, highlight pill
 *   • focus   →  serif body on parchment, read-only
 *   • ink     →  rich HTML preview + transparent Skia overlay, gestures anchored
 *                per-bullet, strokes persisted in point.strokes[]
 *
 * The Skia canvas is sized to the card's measured width × content height so
 * strokes follow the bullet when it is reordered or deleted (they are stored
 * *inside* the point itself).
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  LayoutChangeEvent,
  InteractionManager,
  Pressable,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Canvas, Path } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import {
  Pencil, Check, Lock, Unlock, Trash2, Tag as TagIcon, GripVertical, Plus,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Point } from './useHardnoteDoc';
import { Stroke, StrokePoint, strokeToSvgPath, ToolKind } from './strokes';
import { Lens } from './LensSwitcher';

interface Props {
  point: Point;
  lens: Lens;
  contentWidth: number;
  /** Ink-lens tool settings (forwarded from parent). */
  inkTool: ToolKind;
  inkColor: string;
  inkWidth: number;
  onUpdate: (patch: Partial<Point>) => void;
  onAddStroke: (stroke: Stroke) => void;
  onRemoveStrokes: (ids: string[]) => void;
  onDelete: () => void;
  onRequestHighlight?: (selection: { start: number; end: number }) => void;
  onToggleLock: () => void;
  onOpenTagSheet?: () => void;
  onAddBelow?: () => void;
  textModeActive?: boolean;
}

const COLOR_WITH_OPACITY = (hex: string, alpha: number): string => {
  const a = Math.max(0, Math.min(1, alpha));
  const ah = Math.round(a * 255).toString(16).padStart(2, '0');
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return `${hex}${ah}`;
  return hex;
};

const MIN_CARD_HEIGHT = 72;
const EDIT_EXPAND_MULT = 1.15;

export function InkBulletCard({
  point, lens, contentWidth, inkTool, inkColor, inkWidth,
  onUpdate, onAddStroke, onRemoveStrokes, onDelete, onRequestHighlight, onToggleLock, onOpenTagSheet,
  onAddBelow,
  textModeActive,
}: Props) {
  const { colors } = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(point.text);
  const [cardSize, setCardSize] = useState({ w: 0, h: MIN_CARD_HEIGHT });
  const [currentStroke, setCurrentStroke] = useState<StrokePoint[]>([]);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [zoomScale, setZoomScale] = useState(1);
  const pointsRef = useRef<StrokePoint[]>([]);
  const strokeIdRef = useRef('');
  const lastSampleRef = useRef(0);
  const eraseHitsRef = useRef<Set<string>>(new Set());
  const zoomRef = useRef(1);
  const pinchBaseRef = useRef(1);

  const isHeading = point.type === 'heading';
  const isCheck = point.type === 'checklist';
  const accent = point.color || (isHeading ? '#6366f1' : colors.primary);
  const strokes = point.strokes || [];

  // ===== text edit =====
  const beginEdit = () => {
    if (lens === 'focus') return;
    if (point.locked) return;
    InteractionManager.runAfterInteractions(() => {
      setDraft(point.text);
      setEditing(true);
    });
  };
  const commitEdit = () => {
    if (draft !== point.text) onUpdate({ text: draft });
    setEditing(false);
  };

  const wrapSelection = (tagOpen: string, tagClose: string) => {
    const { start, end } = selection;
    if (end <= start) return;
    const before = draft.slice(0, start);
    const sel = draft.slice(start, end);
    const after = draft.slice(end);
    const wrapped = `${before}${tagOpen}${sel}${tagClose}${after}`;
    setDraft(wrapped);
    onUpdate({ text: wrapped });
    setSelection({ start: start + tagOpen.length, end: end + tagOpen.length });
  };

  const applyBold = () => wrapSelection('<b>', '</b>');
  const applyItalic = () => wrapSelection('<i>', '</i>');
  const applyHighlight = (color: string) =>
    wrapSelection(`<mark style="background:${color}">`, '</mark>');

  // ===== skia drawing =====
  const toCanvasCoords = (x: number, y: number) => {
    const scale = Math.max(1, zoomRef.current);
    return { x: x / scale, y: y / scale };
  };

  const startStroke = (x: number, y: number) => {
    const c = toCanvasCoords(x, y);
    if (inkTool === 'eraser') {
      eraseHitsRef.current = new Set();
      hitErase(c.x, c.y);
      return;
    }
    strokeIdRef.current = `st_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const pt: StrokePoint = { x: c.x, y: c.y, p: 0.5, t: 0 };
    pointsRef.current = [pt];
    setCurrentStroke([pt]);
    lastSampleRef.current = Date.now();
  };
  const addStrokePoint = (x: number, y: number, velocity: number) => {
    const c = toCanvasCoords(x, y);
    if (inkTool === 'eraser') {
      hitErase(c.x, c.y);
      return;
    }
    const now = Date.now();
    if (now - lastSampleRef.current < 4) return;
    lastSampleRef.current = now;
    const v = Math.min(1, velocity / 2500);
    const p = Math.max(0.25, 1 - v * 0.6);
    pointsRef.current.push({ x: c.x, y: c.y, p, t: 0 });
    setCurrentStroke([...pointsRef.current]);
  };
  const endStroke = () => {
    if (inkTool === 'eraser') {
      const ids = Array.from(eraseHitsRef.current);
      eraseHitsRef.current = new Set();
      if (ids.length) onRemoveStrokes(ids);
      return;
    }
    const pts = pointsRef.current;
    if (pts.length > 0) {
      const stroke: Stroke = {
        id: strokeIdRef.current,
        tool: inkTool,
        color: inkColor,
        width: inkWidth,
        opacity: inkTool === 'highlighter' ? 0.35 : 1,
        points: pts,
        created_at: new Date().toISOString(),
      };
      onAddStroke(stroke);
    }
    pointsRef.current = [];
    setCurrentStroke([]);
  };
  const hitErase = (x: number, y: number) => {
    for (const s of strokes) {
      for (const p of s.points) {
        if (Math.abs(p.x - x) < 12 && Math.abs(p.y - y) < 12) {
          eraseHitsRef.current.add(s.id);
          break;
        }
      }
    }
  };

  const beginPinch = () => {
    pinchBaseRef.current = zoomRef.current;
  };

  const updatePinch = (scale: number) => {
    const next = Math.max(1, Math.min(2.8, pinchBaseRef.current * scale));
    zoomRef.current = next;
    setZoomScale(next);
  };

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .maxPointers(1)
        .onBegin((e) => {
          'worklet';
          runOnJS(startStroke)(e.x, e.y);
        })
        .onUpdate((e) => {
          'worklet';
          const v = Math.sqrt(e.velocityX * e.velocityX + e.velocityY * e.velocityY);
          runOnJS(addStrokePoint)(e.x, e.y, v);
        })
        .onEnd(() => {
          'worklet';
          runOnJS(endStroke)();
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inkTool, inkColor, inkWidth, strokes],
  );

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          'worklet';
          runOnJS(beginPinch)();
        })
        .onUpdate((e) => {
          'worklet';
          runOnJS(updatePinch)(e.scale);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const inkGesture = useMemo(() => Gesture.Simultaneous(pan, pinch), [pan, pinch]);

  const doubleTap = useMemo(
    () =>
      Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(260)
        .onEnd((_e, success) => {
          'worklet';
          if (success && !textModeActive) runOnJS(beginEdit)();
        }),
    [textModeActive, beginEdit],
  );

  const onLayoutBody = (e: LayoutChangeEvent) => {
    const h = Math.max(MIN_CARD_HEIGHT, Math.round(e.nativeEvent.layout.height));
    const w = Math.round(e.nativeEvent.layout.width);
    setCardSize((prev) => (Math.abs(h - prev.h) > 1 || Math.abs(w - prev.w) > 1 ? { w, h } : prev));
  };

  // ===== render =====
  const headingFont = isHeading ? styles.headingText : null;
  const lockedBg = point.locked ? 'rgba(254, 243, 199, 0.45)' : 'transparent';
  const cardBgByLens: Record<Lens, string> = {
    glance: colors.surface,
    focus: '#fff8ec',
    ink: colors.surface,
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBgByLens[lens],
          borderColor: colors.border,
          borderLeftColor: accent,
        },
        isHeading && styles.headingCard,
      ]}
      data-testid={`ink-card-${point.id}`}
    >
      {/* Locked/source strip */}
      {(point.locked || point.source) && (
        <View style={styles.topRow}>
          {point.locked && (
            <View style={[styles.lockChip, { backgroundColor: '#fef3c7' }]}>
              <Lock size={9} color="#92400e" />
              <Text style={styles.lockText}>LOCKED REFERENCE</Text>
            </View>
          )}
          {point.source && (
            <Text style={[styles.sourceText, { color: colors.textTertiary }]} numberOfLines={1}>
              {point.source}
            </Text>
          )}
        </View>
      )}

      {/* Body */}
      <View onLayout={onLayoutBody} style={[styles.body, { backgroundColor: lockedBg }]}>
        {/* Checklist check */}
        {isCheck && (
          <TouchableOpacity
            onPress={() => onUpdate({ checked: !point.checked })}
            style={[
              styles.checkbox,
              {
                borderColor: point.checked ? accent : colors.textTertiary,
                backgroundColor: point.checked ? accent : 'transparent',
              },
            ]}
            data-testid={`ink-card-check-${point.id}`}
          >
            {point.checked && <Check size={12} color="#fff" strokeWidth={3} />}
          </TouchableOpacity>
        )}

        <View style={{ flex: 1 }}>
          {editing ? (
            <>
              <View style={{ marginBottom: 6, opacity: 0.75 }}>
                <RenderHtml
                  source={{ html: htmlFor(draft, isHeading) }}
                  contentWidth={Math.max(120, (lens === 'focus' ? contentWidth : contentWidth - 56))}
                  baseStyle={{
                    color: colors.textTertiary,
                    fontSize: 12,
                    lineHeight: 18,
                  }}
                  tagsStyles={{
                    b: { fontWeight: '800' as const },
                    strong: { fontWeight: '800' as const },
                    i: { fontStyle: 'italic' as const },
                    em: { fontStyle: 'italic' as const },
                    mark: { borderRadius: 3, paddingHorizontal: 2 },
                    p: { marginVertical: 0 },
                  }}
                />
              </View>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                multiline
                autoFocus
                onBlur={commitEdit}
                style={[
                  styles.editInput,
                  {
                    color: colors.textPrimary,
                    minHeight: Math.max(60, cardSize.h * EDIT_EXPAND_MULT),
                  },
                  headingFont,
                ]}
                placeholder="Type here…"
                placeholderTextColor={colors.textTertiary}
                data-testid={`ink-card-input-${point.id}`}
              />
              <View style={styles.editToolbar}>
                <FormatBtn label="B" bold onPress={applyBold} />
                <FormatBtn label="I" italic onPress={applyItalic} />
                {['#fde68a', '#a7f3d0', '#fca5a5', '#93c5fd'].map((c) => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => applyHighlight(c)}
                    style={[styles.hlSwatch, { backgroundColor: c }]}
                    data-testid={`ink-card-hl-${c.replace('#', '')}`}
                  />
                ))}
                <TouchableOpacity onPress={commitEdit} style={[styles.doneBtn, { backgroundColor: colors.primary }]} data-testid={`ink-card-done-${point.id}`}>
                  <Text style={[styles.doneBtnText, { color: colors.buttonText }]}>DONE</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <GestureDetector gesture={doubleTap}>
              <Pressable
                onPress={textModeActive ? beginEdit : undefined}
                disabled={lens === 'focus' || point.locked}
                style={{ minHeight: 20 }}
              >
                <RenderHtml
                  source={{ html: htmlFor(point.text, isHeading) }}
                  contentWidth={lens === 'focus' ? contentWidth : contentWidth - 56}
                  baseStyle={{
                    color: lens === 'focus' ? '#3f2d16' : colors.textPrimary,
                    fontSize: lens === 'focus' ? 16 : (isHeading ? 14 : 14),
                    lineHeight: lens === 'focus' ? 26 : 21,
                    fontFamily: lens === 'focus' ? (Platform.OS === 'ios' ? 'Georgia' : 'serif') : undefined,
                    fontWeight: isHeading ? ('900' as const) : ('500' as const),
                    letterSpacing: isHeading ? 0.4 : 0,
                    textTransform: isHeading ? ('uppercase' as const) : undefined,
                  }}
                  tagsStyles={{
                    b: { fontWeight: '800' as const, color: colors.textPrimary },
                    strong: { fontWeight: '800' as const, color: colors.textPrimary },
                    i: { fontStyle: 'italic' as const },
                    em: { fontStyle: 'italic' as const },
                    mark: { borderRadius: 3, paddingHorizontal: 2 },
                    p: { marginVertical: 0 },
                  }}
                />
              </Pressable>
            </GestureDetector>
          )}

          {/* Tags */}
          {!editing && Array.isArray(point.tags) && point.tags.length > 0 && (
            <View style={styles.tagRow}>
              {point.tags.slice(0, 4).map((t) => (
                <View key={t} style={[styles.tagChip, { backgroundColor: accent + '1F' }]}>
                  <Text style={[styles.tagText, { color: accent }]}>#{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Skia overlay: visible in all lenses (read-only in glance/focus) */}
      {(strokes.length > 0 || (lens === 'ink' && currentStroke.length > 0)) && (
        <View
          pointerEvents="none"
          style={[
            styles.canvasOverlay,
            {
              height: cardSize.h,
              transform: [{ scale: lens === 'ink' ? zoomScale : 1 }],
            },
          ]}
        >
          <Canvas style={StyleSheet.absoluteFillObject}>
            {/* Hide erased strokes in-flight */}
            {strokes.map((s) => {
              if (eraseHitsRef.current.has(s.id)) return null;
              const d = strokeToSvgPath(s.points);
              if (!d) return null;
              const isHL = s.tool === 'highlighter';
              const strokeColor = isHL ? COLOR_WITH_OPACITY(s.color, s.opacity) : s.color;
              const avgP = s.points.reduce((a, p) => a + p.p, 0) / Math.max(1, s.points.length);
              const dynW = s.width * (0.5 + 0.5 * avgP);
              return (
                <Path
                  key={s.id}
                  path={d}
                  color={strokeColor}
                  style="stroke"
                  strokeWidth={isHL ? s.width * 1.8 : dynW}
                  strokeCap="round"
                  strokeJoin="round"
                  blendMode={isHL ? 'multiply' : undefined}
                />
              );
            })}
            {lens === 'ink' && currentStroke.length > 0 && (
              <Path
                path={strokeToSvgPath(currentStroke)}
                color={inkTool === 'highlighter' ? COLOR_WITH_OPACITY(inkColor, 0.35) : inkColor}
                style="stroke"
                strokeWidth={inkTool === 'highlighter' ? inkWidth * 1.8 : inkWidth}
                strokeCap="round"
                strokeJoin="round"
                blendMode={inkTool === 'highlighter' ? 'multiply' : undefined}
              />
            )}
          </Canvas>
        </View>
      )}

      {/* Ink gesture surface (only when lens = ink AND not currently text-editing) */}
      {lens === 'ink' && !editing && !textModeActive && (
        <GestureDetector gesture={inkGesture}>
          <View
            style={[
              styles.inkSurface,
              {
                height: cardSize.h,
                transform: [{ scale: zoomScale }],
              },
            ]}
            data-testid={`ink-surface-${point.id}`}
          />
        </GestureDetector>
      )}

      {/* Row actions */}
      {lens !== 'focus' && !editing && (
        <View style={styles.actionsRow}>
          <TouchableOpacity onPress={beginEdit} style={styles.iconBtnSm} disabled={point.locked} data-testid={`ink-card-edit-${point.id}`}>
            <Pencil size={13} color={point.locked ? colors.textTertiary : colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onToggleLock} style={styles.iconBtnSm} data-testid={`ink-card-lock-${point.id}`}>
            {point.locked ? <Lock size={13} color="#f59e0b" /> : <Unlock size={13} color={colors.textTertiary} />}
          </TouchableOpacity>
          {onOpenTagSheet && (
            <TouchableOpacity onPress={onOpenTagSheet} style={styles.iconBtnSm} data-testid={`ink-card-tag-${point.id}`}>
              <TagIcon size={13} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDelete} style={styles.iconBtnSm} data-testid={`ink-card-delete-${point.id}`}>
            <Trash2 size={13} color="#ef4444" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {lens === 'ink' && zoomScale > 1.01 && (
            <View style={styles.zoomChip}>
              <Text style={styles.zoomChipText}>{Math.round(zoomScale * 100)}%</Text>
            </View>
          )}
          <View style={styles.grip}><GripVertical size={14} color={colors.textTertiary} /></View>
        </View>
      )}

      {lens === 'glance' && !editing && onAddBelow && (
        <TouchableOpacity
          onPress={onAddBelow}
          style={[styles.addBelowBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          data-testid={`ink-card-add-below-${point.id}`}
        >
          <Plus size={12} color={colors.textSecondary} />
          <Text style={[styles.addBelowText, { color: colors.textSecondary }]}>Add below</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function FormatBtn({ label, bold, italic, onPress }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.formatBtn}>
      <Text
        style={{
          fontWeight: bold ? '900' : '700',
          fontStyle: italic ? 'italic' : 'normal',
          fontSize: 13,
          color: '#0f172a',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const htmlFor = (text: string, heading: boolean): string => {
  const safe = text && text.length > 0 ? text : (heading ? 'Heading' : 'Tap to add a point…');
  if (/<\/?[a-z][\s\S]*>/i.test(safe)) return safe;
  return safe.replace(/\n/g, '<br/>');
};

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    borderRadius: 14,
    borderWidth: 1,
    borderLeftWidth: 4,
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 12,
    paddingBottom: 6,
    overflow: 'visible',
  },
  headingCard: { marginTop: 14, paddingVertical: 10 },
  headingText: { fontWeight: '900' as const, letterSpacing: 0.5 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  lockChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  lockText: { fontSize: 8, fontWeight: '900', color: '#92400e', letterSpacing: 0.6 },
  sourceText: { fontSize: 10, fontWeight: '700', flex: 1, textAlign: 'right' },
  body: { flexDirection: 'row', gap: 10, paddingVertical: 4, paddingHorizontal: 4, borderRadius: 8 },
  checkbox: {
    width: 18, height: 18, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginTop: 3,
  },
  editInput: {
    fontSize: 14,
    lineHeight: 21,
    textAlignVertical: 'top',
    paddingVertical: 4,
  },
  editToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  formatBtn: {
    width: 28, height: 28, borderRadius: 7,
    borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center', justifyContent: 'center',
  },
  hlSwatch: { width: 22, height: 22, borderRadius: 11, borderWidth: 1, borderColor: '#e2e8f0' },
  doneBtn: { paddingHorizontal: 10, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
  doneBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  tagRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 6 },
  tagChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  tagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.3 },

  canvasOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 },
  inkSurface: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 6, backgroundColor: 'transparent' },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  iconBtnSm: {
    width: 26, height: 26, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  zoomChip: {
    minWidth: 44,
    height: 20,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a12',
    paddingHorizontal: 8,
    marginRight: 2,
  },
  zoomChipText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.2,
  },
  grip: { padding: 4 },
  addBelowBtn: {
    marginTop: 8,
    alignSelf: 'center',
    minHeight: 28,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addBelowText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
});
