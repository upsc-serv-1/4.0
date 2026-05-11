/**
 * Pilot V2 — Glance View (Issue 12: Page Scaling & Zooming)
 *
 * Premium reading workspace with:
 *   • Edge-to-edge content layout (no maxWidth constraint)
 *   • Pinch-to-zoom: entire page scales (NOT individual text font sizes)
 *   • Smooth pan when zoomed — 2D movement with inertia feel
 *   • Double-tap reset or header Reset button
 *   • Unified page/canvas background — no "white page on grey" separation
 *   • Zoom level badge with smooth spring animations
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Share,
  Image, Linking, useWindowDimensions,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronLeft, MoreVertical, Pencil,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  archivePilotV2Node, fetchAllPilotV2Nodes, fetchPilotV2NotesForUser,
  pinPilotV2Node, restorePilotV2Node, purgePilotV2NoteNode,
} from '../../repositories/pilotV2Repo';
import { PilotV2Block, PilotV2PencilStroke, PILOT_V2_HIGHLIGHT_PALETTE } from './types';
import { PencilCanvas } from './PencilCanvas';
import { PencilAnnotationEngine } from './PencilAnnotationEngine';
import { PencilToolbar } from './PencilToolbar';
import { usePilotV2Pencil } from './usePilotV2Pencil';
import { PilotV2UnifiedExport } from './PilotV2UnifiedExport';
import { savePilotV2NoteContent } from '../../repositories/pilotV2Repo';
import { savePilotV2NoteOfflineFirst } from './pilotV2OfflineSave';
import { PilotV2WashiTape, setAllRevealed } from './washiTape';
import { WashiTapeLayer } from './WashiTapeLayer';
import RenderHtml from 'react-native-render-html';

/* ─── helpers ────────────────────────────────────────────────────────────── */

const highlightBg = (name?: string) => {
  if (!name) return '#FDE68A';
  const found = PILOT_V2_HIGHLIGHT_PALETTE.find(c => c.name === name);
  return found?.bg ?? '#FDE68A';
};

const clamp = (val: number, min: number, max: number) => {
  'worklet';
  return Math.max(min, Math.min(max, val));
};

/* ─── demo data ───────────────────────────────────────────────────────────── */

const DEMO_BLOCKS: PilotV2Block[] = [
  { id: 'd1', type: 'heading', level: 1, text: 'Article 14 — Equality Before Law' },
  {
    id: 'd2', type: 'paragraph', text:
      'A comprehensive study guide on Article 14 of the Indian Constitution, covering the fundamental ' +
      'right to equality, its interpretation, exceptions, and landmark judicial pronouncements.',
  },
  { id: 'd3', type: 'heading', level: 2, text: 'Introduction to Equality Before Law' },
  {
    id: 'd4', type: 'bullet', text:
      'Article 14 of the Indian Constitution guarantees the Right to Equality. It states: "The State ' +
      'shall not deny to any person equality before the law or the equal protection of the laws within ' +
      'the territory of India." This foundational principle ensures that no individual or group receives ' +
      'preferential treatment under the law, establishing a bedrock for justice and fairness in Indian democracy.',
  },
  { id: 'd5', type: 'highlight', highlightColor: 'Yellow', text: 'Key Point: Equality before law applies to all persons, citizens and non-citizens alike.' },
  { id: 'd6', type: 'heading', level: 2, text: "The Rule of Law and Dicey's Principles" },
  {
    id: 'd7', type: 'bullet', text:
      'The concept of "equality before law" is synonymous with the British doctrine of Rule of Law as ' +
      'propounded by A.V. Dicey. According to Dicey, the rule of law has three essential components: ' +
      'supremacy of law, equality before the law, and predominance of legal spirit.',
  },
  { id: 'd8', type: 'heading', level: 2, text: 'Doctrine of Reasonable Classification' },
  {
    id: 'd9', type: 'bullet', text:
      'Article 14 does not prohibit all classifications but only unreasonable or arbitrary classifications. ' +
      'For a classification to be valid, it must satisfy two conditions: an intelligible differentia, and a ' +
      'rational relation to the object sought to be achieved.',
  },
  { id: 'd10', type: 'heading', level: 2, text: 'Landmark Judicial Pronouncements' },
  { id: 'd11', type: 'bullet', text: 'State of West Bengal v. Anwar Ali Sarkar (1952) — established the test for reasonable classification.' },
  { id: 'd12', type: 'bullet', text: 'E.P. Royappa v. State of Tamil Nadu (1974) — equality as a basic feature of the Constitution.' },
  { id: 'd13', type: 'bullet', text: 'Maneka Gandhi v. Union of India (1978) — Articles 14, 19 and 21 form a "golden triangle".' },
  {
    id: 'd14', type: 'bullet', text:
      'Indra Sawhney v. Union of India (1992) — Mandal Commission case; reservations capped at 50% with creamy-layer carve-out.',
  },
];

/* ─── component ──────────────────────────────────────────────────────────── */

export function PilotV2GlanceView() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { state, dispatch, currentNote, glanceScrollMemory } = usePilotV2();
  const { width: screenWidth } = useWindowDimensions();
  const note = currentNote();
  const blocks = note?.content?.blocks?.length ? note.content.blocks : DEMO_BLOCKS;
  const title = note?.title ?? 'Article 14 — Equality Before Law';

  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const scrollRef = useRef<any>(null);
  const scrollKey = note?.id || '__demo__';
  const lastScrollY = useRef<number>(glanceScrollMemory.current[scrollKey] || 0);

  /* ── Pencil overlay (Step 6) — drawable EVERYWHERE in glance view ─── */
  const [paperSize, setPaperSize] = useState({ w: 1, h: 1 });
  /** Block layout map — keyed by block.id, same shape as EditorView.
   *  Populated by per-block onLayout wrappers; feeds PencilCanvas so
   *  anchored strokes follow block reorders in the read-only view (Step 10). */
  const blockLayoutsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  const [blockLayoutVersion, setBlockLayoutVersion] = useState(0);
  const initialStrokes = (note?.content?.pencilStrokes ?? []) as PilotV2PencilStroke[];
  const assignAnchorToStrokes = useCallback((strokes: PilotV2PencilStroke[]): PilotV2PencilStroke[] => {
    const ph = Math.max(1, paperSize.h);
    const pw = Math.max(1, paperSize.w);
    return strokes.map((s) => {
      if (s.anchor) return s;
      const pts = s.points || [];
      if (!pts.length) return s;

      // Host block by centroid Y (same heuristic as EditorView)
      let cy = 0;
      for (const p of pts) cy += p.y;
      cy = (cy / pts.length) * ph;
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const [id, rect] of blockLayoutsRef.current.entries()) {
        if (cy >= rect.y && cy <= rect.y + rect.h) {
          bestId = id; bestDist = 0; break;
        }
        const d = Math.min(Math.abs(cy - rect.y), Math.abs(cy - (rect.y + rect.h)));
        if (d < bestDist) { bestDist = d; bestId = id; }
      }
      if (!bestId) return s;
      const blockRect = blockLayoutsRef.current.get(bestId)!;
      const blockOriginY = blockRect.y / ph;

      let spanAnchor: Partial<NonNullable<PilotV2PencilStroke['anchor']>> = {};
      const isHighlighter = s.tool === 'highlighter';
      if (isHighlighter || s.tool === 'pen') {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const p of pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
        const dX = maxX - minX;
        const dY = maxY - minY;
        const isHorizontal = dX > 0.05 && dY < dX * 0.25;
        if (isHighlighter || isHorizontal) {
          const blockH = Math.max(1, blockRect.h);
          const blockW = Math.max(1, blockRect.w);
          const minXpx = minX * pw;
          const maxXpx = maxX * pw;
          const startRelX = Math.max(0, Math.min(1, (minXpx - blockRect.x) / blockW));
          const endRelX = Math.max(startRelX, Math.max(0, Math.min(1, (maxXpx - blockRect.x) / blockW)));
          const relY = Math.max(0, Math.min(1, (cy - blockRect.y) / blockH));
          const blockText = blocks.find(b => b.id === bestId)?.text ?? '';
          const textLen = Math.max(1, blockText.length);
          const startOffset = Math.round(startRelX * textLen);
          const endOffset = Math.min(textLen, Math.round(endRelX * textLen));
          spanAnchor = {
            elementId: bestId,
            spanIndex: 0,
            startOffset,
            endOffset,
            startRelX,
            endRelX,
            relY,
          };
        }
      }

      return { ...s, anchor: { blockId: bestId, blockOriginY, ...spanAnchor } };
    });
  }, [paperSize.h, paperSize.w, blocks]);

  /** Ref to the pencil engine — used by persistGlanceStrokes to sync anchor
   *  metadata back into the engine's in-memory strokes without creating a
   *  circular dependency between the callback and the usePilotV2Pencil hook. */
  const engineRef = useRef<PencilAnnotationEngine | null>(null);

  const persistGlanceStrokes = useCallback((next: PilotV2PencilStroke[]) => {
    if (!note?.id) return;
    const anchored = assignAnchorToStrokes(next);
    // Sync anchor metadata into the engine's in-memory strokes so the
    // CommittedStrokesLayer's applyBlockOffset can use startRelX/endRelX/relY
    // for Notability-style word-tracking reprojection immediately (without
    // waiting for a round-trip through persistence + reload).
    if (engineRef.current) {
      anchored.forEach((s) => {
        if (s.anchor) engineRef.current!.setStrokeAnchor(s.id, s.anchor);
      });
    }
    const content = {
      blocks: note.content?.blocks ?? [],
      version: note.content?.version ?? 1,
      pencilStrokes: anchored,
    };
    savePilotV2NoteOfflineFirst(note.id, content).catch(() => null);
    dispatch({ type: 'PATCH_CURRENT_NOTE', payload: { id: note.id, patch: { content } } });
  }, [note, dispatch, assignAnchorToStrokes]);
  const pencil = usePilotV2Pencil({
    noteId: note?.id ?? null,
    initialStrokes,
    pageWidth: paperSize.w,
    pageHeight: paperSize.h,
    onChange: persistGlanceStrokes,
  });
  // Keep the ref in sync so persistGlanceStrokes can always access the current engine.
  engineRef.current = pencil.engine;

  /* ── zoom state ─────────────────────────────────────────────────────────── */
  const scale      = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const offsetX    = useSharedValue(0);
  const offsetY    = useSharedValue(0);
  const savedOffX  = useSharedValue(0);
  const savedOffY  = useSharedValue(0);
  // Shared value for screenWidth so worklets can access it safely
  const screenWidthSV = useSharedValue(screenWidth);
  useEffect(() => { screenWidthSV.value = screenWidth; }, [screenWidth, screenWidthSV]);

  const [scrollEnabled, setScrollEnabled] = useState(true);

  /* ── Draggable Pencil FAB ─────────────────────────────────────────────── */
  const pencilFabX = useSharedValue(0);
  const pencilFabY = useSharedValue(0);
  const savedFabX = useSharedValue(0);
  const savedFabY = useSharedValue(0);

  const togglePencilMode = () => {
    pencil.setDrawingMode(!pencil.drawingMode);
  };

  const fabGesture = Gesture.Race(
    Gesture.Pan()
      .onUpdate((e) => {
        'worklet';
        pencilFabX.value = savedFabX.value + e.translationX;
        pencilFabY.value = savedFabY.value + e.translationY;
      })
      .onEnd(() => {
        'worklet';
        savedFabX.value = pencilFabX.value;
        savedFabY.value = pencilFabY.value;
      }),
    Gesture.Tap().onEnd(() => {
      'worklet';
      runOnJS(togglePencilMode)();
    })
  );

  const animatedFabStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pencilFabX.value },
      { translateY: pencilFabY.value },
    ],
  }));

  /* ── Draggable Pencil Toolbar ─────────────────────────────────────────── */
  const toolbarX = useSharedValue(0);
  const toolbarY = useSharedValue(0);
  const savedToolbarX = useSharedValue(0);
  const savedToolbarY = useSharedValue(0);

  const toolbarGesture = Gesture.Pan()
    .onUpdate((e) => {
      'worklet';
      toolbarX.value = savedToolbarX.value + e.translationX;
      toolbarY.value = savedToolbarY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      savedToolbarX.value = toolbarX.value;
      savedToolbarY.value = toolbarY.value;
    });

  const animatedToolbarStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: toolbarX.value },
      { translateY: toolbarY.value },
    ],
  }));

  const [isZoomed, setIsZoomed]           = useState(false);
  const [displayScale, setDisplayScale]   = useState(1);

  /* ── reset zoom (callable from JS and worklets) ─────────────────────────── */
  const resetZoom = useCallback(() => {
    scale.value      = withSpring(1,  { damping: 22, stiffness: 180 });
    offsetX.value    = withSpring(0,  { damping: 22, stiffness: 180 });
    offsetY.value    = withSpring(0,  { damping: 22, stiffness: 180 });
    savedScale.value = 1;
    savedOffX.value  = 0;
    savedOffY.value  = 0;
    setScrollEnabled(true);
    setIsZoomed(false);
    setDisplayScale(1);
  }, [scale, offsetX, offsetY, savedScale, savedOffX, savedOffY]);

  /* ── pinch gesture ──────────────────────────────────────────────────────── */
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      'worklet';
      runOnJS(setScrollEnabled)(false);
    })
    .onUpdate(e => {
      'worklet';
      const newScale = clamp(savedScale.value * e.scale, 0.25, 4);
      scale.value = newScale;
      // Zoom toward the focal point (center-relative shift)
      const midX = screenWidthSV.value / 2;
      const focalOffX = (e.focalX - midX) * (1 - e.scale) * 0.5;
      const focalOffY = e.focalY * (1 - e.scale) * 0.3;
      offsetX.value = savedOffX.value + focalOffX;
      offsetY.value = savedOffY.value + focalOffY;
      runOnJS(setDisplayScale)(Math.round(newScale * 10) / 10);
    })
    .onEnd(() => {
      'worklet';
      savedScale.value = scale.value;
      savedOffX.value  = offsetX.value;
      savedOffY.value  = offsetY.value;

      // If user zoomed OUT (scale < 1), keep vertical scrolling enabled and
      // neutralize pan offsets so the entire note remains scrollable.
      if (scale.value < 0.99) {
        offsetX.value = withSpring(0, { damping: 22, stiffness: 180 });
        offsetY.value = withSpring(0, { damping: 22, stiffness: 180 });
        savedOffX.value = 0;
        savedOffY.value = 0;
        runOnJS(setScrollEnabled)(true);
        runOnJS(setIsZoomed)(true);
        return;
      }

      if (Math.abs(scale.value - 1) > 0.05) {
        runOnJS(setIsZoomed)(true);
        // When zoomed IN, we pan in 2D so we keep scroll disabled.
        // When very close to 1, restore normal scroll behavior.
        if (scale.value <= 1.01) runOnJS(setScrollEnabled)(true);
      } else {
        scale.value   = withSpring(1, { damping: 22, stiffness: 180 });
        offsetX.value = withSpring(0, { damping: 22, stiffness: 180 });
        offsetY.value = withSpring(0, { damping: 22, stiffness: 180 });
        savedScale.value = 1;
        savedOffX.value  = 0;
        savedOffY.value  = 0;
        runOnJS(setScrollEnabled)(true);
        runOnJS(setIsZoomed)(false);
        runOnJS(setDisplayScale)(1);
      }
    });

  /* ── pan gesture (active when zoomed, 2D panning) ──────────────────────── */
  const panGesture = Gesture.Pan()
    .onUpdate(e => {
      'worklet';
      if (Math.abs(scale.value - 1) > 0.02) {
        offsetX.value = savedOffX.value + e.translationX;
        offsetY.value = savedOffY.value + e.translationY;
      }
    })
    .onEnd(e => {
      'worklet';
      if (Math.abs(scale.value - 1) > 0.02) {
        // Add light inertia / momentum
        offsetX.value = offsetX.value + e.velocityX * 0.06;
        offsetY.value = offsetY.value + e.velocityY * 0.06;
        savedOffX.value = offsetX.value;
        savedOffY.value = offsetY.value;
      }
    });

  /* ── double-tap to reset zoom ───────────────────────────────────────────── */
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      if (Math.abs(scale.value - 1) > 0.05) {
        runOnJS(resetZoom)();
      }
    });

  /* ── compose all gestures ─────────────────────────────────────────────────*/
  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
  );

  /* ── animated page style ─────────────────────────────────────────────────*/
  const animatedPageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offsetX.value },
      { translateY: offsetY.value },
      { scale: scale.value },
    ],
  }));

  /* ── scroll memory ──────────────────────────────────────────────────────── */
  useEffect(() => {
    const saved = glanceScrollMemory.current[scrollKey] || 0;
    if (saved > 0 && scrollRef.current) {
      const handle = setTimeout(() => {
        scrollRef.current?.scrollTo({ y: saved, animated: false });
      }, 60);
      return () => clearTimeout(handle);
    }
    return undefined;
  }, [scrollKey, glanceScrollMemory]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    lastScrollY.current = y;
    glanceScrollMemory.current[scrollKey] = lastScrollY.current;
  }, [scrollKey, glanceScrollMemory]);

  /* ── navigation ─────────────────────────────────────────────────────────── */
  const handleBack = () => {
    resetZoom();
    dispatch({ type: 'SET_VIEW_MODE', payload: state.view.selectedSubtopic ? 'noteList' : 'dashboard' });
  };

  /* ── share / export ─────────────────────────────────────────────────────── */
  const blocksToPlainText = (): string => {
    return blocks
      .map(b => {
        switch (b.type) {
          case 'heading':   return `\n# ${b.text}\n`;
          case 'bullet':    return `• ${b.text}`;
          case 'numbered':  return `1. ${b.text}`;
          case 'checklist': return `${b.checked ? '[x]' : '[ ]'} ${b.text}`;
          case 'quote':     return `> ${b.text}`;
          case 'code':      return `\`\`\`\n${b.text}\n\`\`\``;
          default:          return b.text;
        }
      })
      .join('\n');
  };

  const handleShare = async () => {
    const message = `${title}\n\n${blocksToPlainText()}`;
    try {
      if (Platform.OS === 'web') {
        if ((navigator as any)?.share) {
          await (navigator as any).share({ title, text: message });
        } else {
          await Clipboard.setStringAsync(message);
          Alert.alert('Copied to clipboard', 'Note content copied — paste it anywhere.');
        }
        return;
      }
      await Share.share({ title, message });
    } catch (e) {
      console.warn('[pilot-v2] share failed', e);
    }
  };

  const handleExport = () => {
    setExportSheetOpen(true);
  };

  const handleMore = () => {
    Alert.alert(title, undefined, [
      {
        text: note?.is_pinned ? 'Unpin' : 'Pin',
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) return;
          await pinPilotV2Node(node.id, !note.is_pinned).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
        },
      },
      ...(note?.is_archived ? [{
        text: 'Restore',
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId, true);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) return;
          await restorePilotV2Node(node.id).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
          dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
        },
      }] : []),
      { text: 'Open in Editor', onPress: () => dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' }) },
      { text: 'Share', onPress: handleShare },
      {
        text: 'Copy Plain Text',
        onPress: async () => {
          const message = blocksToPlainText();
          await Clipboard.setStringAsync(message);
          Alert.alert('Copied', 'Plain text copied to clipboard.');
        },
      },
      { text: 'Export', onPress: handleExport },
      ...(note?.is_archived ? [{
        text: 'Delete permanently',
        style: 'destructive' as const,
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId, true);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) return;
          await purgePilotV2NoteNode({ nodeId: node.id, noteId: node.note_id }).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
          dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
        },
      }] : [{
        text: 'Move to Trash',
        style: 'destructive' as const,
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) {
            Alert.alert('Could not delete', 'Note row not linked to a Pilot V2 node.');
            return;
          }
          await archivePilotV2Node(node.id).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
          dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
        },
      }]),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  /* ─────────────────────────────────────────────────────────────────────────*/
  /* Render                                                                    */
  /* ─────────────────────────────────────────────────────────────────────────*/
  return (
    <View
      testID="pilot-v2-glance"
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      {/* ── Cute Floating back button ──────────────────────────────────── */}
      <TouchableOpacity
        testID="pilot-v2-glance-back"
        onPress={handleBack}
        activeOpacity={0.85}
        style={[
          styles.floatingBack,
          { 
            backgroundColor: colors.surface + 'E6', 
            borderColor: colors.border,
            shadowColor: colors.textPrimary,
          }
        ]}
      >
        <ChevronLeft size={26} color={colors.textPrimary} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Minimal floating controls (no header band) ───────────────────── */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', top: 18, left: 0, right: 0, zIndex: 1600, alignItems: 'center' }}
      >
        <View
          testID="pilot-v2-glance-zoom-chip"
          style={[
            styles.zoomPill,
            {
              backgroundColor: colors.surface + 'E6',
              borderColor: colors.border,
              paddingVertical: 6,
            },
          ]}
        >
          <Text style={[styles.zoomPillText, { color: colors.textPrimary }]}>
            {displayScale.toFixed(1)}×
          </Text>
        </View>
      </View>

      <TouchableOpacity
        testID="pilot-v2-glance-menu"
        onPress={handleMore}
        activeOpacity={0.85}
        style={[
          styles.floatingBack,
          {
            left: undefined as any,
            right: 18,
            width: 52,
            height: 52,
            backgroundColor: colors.surface + 'E6',
            borderColor: colors.border,
            shadowColor: colors.textPrimary,
          } as any,
        ]}
      >
        <MoreVertical size={22} color={colors.textPrimary} strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Scalable page canvas ─────────────────────────────────────────── */}
      {/*
          The outer View clips overflow.
          GestureDetector captures pinch + pan + double-tap.
          Animated.View holds the scale/translate transform — this IS the "page".
          ScrollView inside handles vertical reading scroll when scale = 1.
      */}
      <View style={styles.canvas}>
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.page, animatedPageStyle]}>
            <ScrollView
              ref={scrollRef}
              testID="pilot-v2-glance-scroll"
              style={[styles.scroll, { backgroundColor: colors.bg }]}
              contentContainerStyle={[styles.body, { paddingBottom: 100 }]}
              showsVerticalScrollIndicator
              scrollEnabled={scrollEnabled && !pencil.drawingMode}
              onScroll={onScroll}
              scrollEventThrottle={32}
              bounces={!isZoomed}
            >
              {/* Title row */}
              <View style={styles.titleRow}>
                <Text style={[styles.h1, { color: colors.textPrimary }]}>{title}</Text>
                <View style={[styles.tagChip, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>Key Point</Text>
                </View>
              </View>

              <View
                onLayout={(e) => setPaperSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
              >
                {blocks.map(b => (
                  <View
                    key={b.id}
                    onLayout={(e) => {
                      const { x, y, width: w, height: h } = e.nativeEvent.layout;
                      const cur = blockLayoutsRef.current.get(b.id);
                      blockLayoutsRef.current.set(b.id, { x, y, w, h });
                      // Only bump version when position changes noticeably to
                      // avoid spurious CommittedStrokesLayer invalidations.
                      if (
                        !cur ||
                        Math.abs(cur.x - x) > 2 ||
                        Math.abs(cur.y - y) > 2 ||
                        Math.abs(cur.w - w) > 2 ||
                        Math.abs(cur.h - h) > 2
                      ) {
                        setBlockLayoutVersion(v => v + 1);
                      }
                    }}
                  >
                    <BlockRenderer block={b} colors={colors} />
                  </View>
                ))}
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.eog, { color: colors.textTertiary }]}>— End of Glance —</Text>
                {paperSize.w > 1 && paperSize.h > 1 && (
                  <PencilCanvas
                    engine={pencil.engine}
                    tool={pencil.tool}
                    width={paperSize.w}
                    height={paperSize.h}
                    drawingMode={pencil.drawingMode}
                    onCommit={persistGlanceStrokes}
                    blockLayouts={blockLayoutsRef.current}
                    blockLayoutVersion={blockLayoutVersion}
                  />
                )}

                {paperSize.w > 1 && paperSize.h > 1 ? (
                  <WashiTapeLayer
                    tapes={(note?.content as any)?.washiTapes || []}
                    width={paperSize.w}
                    height={paperSize.h}
                    drawingMode={false}
                    activeColor={'Yellow' as any}
                    onAdd={() => undefined}
                    onToggle={(id) => {
                      const cur: PilotV2WashiTape[] = (note?.content as any)?.washiTapes || [];
                      const next = cur.map(t => t.id === id ? { ...t, revealed: !t.revealed } : t);
                      const content: any = { ...(note?.content || { blocks: [] }), washiTapes: next };
                      if (note?.id) savePilotV2NoteOfflineFirst(note.id, content).catch(() => null);
                    }}
                    onRemove={() => undefined}
                  />
                ) : null}
              </View>
            </ScrollView>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* ── Zoom help bar (shown when zoomed) ───────────────────────────── */}
      {isZoomed && (
        <View style={[styles.zoomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.zoomBarText, { color: colors.textTertiary }]}>
            Pinch to zoom · Double-tap or tap{' '}
            <Text style={{ color: colors.primary }}>Reset</Text>
            {' '}to restore
          </Text>
          <TouchableOpacity
            testID="pilot-v2-glance-zoom-bar-reset"
            onPress={resetZoom}
            style={[styles.zoomBarBtn, { borderColor: colors.primary }]}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Reset</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Pencil FAB (Step 6) ─────────────────────────────────── */}
      <GestureDetector gesture={fabGesture}>
        <Animated.View
          style={[
            glanceStyles.pencilFab,
            animatedFabStyle,
            { backgroundColor: pencil.drawingMode ? '#0F172A' : '#5B4EFA' },
          ]}
          testID="pilot-v2-glance-pencil-fab"
        >
          <Pencil size={22} color="#ffffff" strokeWidth={2.5} />
        </Animated.View>
      </GestureDetector>

      {pencil.drawingMode && (
        <GestureDetector gesture={toolbarGesture}>
          <Animated.View style={[glanceStyles.pencilToolbarFloat, animatedToolbarStyle]} pointerEvents="box-none">
            <PencilToolbar
              tool={pencil.tool}
              color={pencil.color}
              width={pencil.width}
              pencilOnly={pencil.pencilOnly}
              shapeRecognition={pencil.shapeRecognition}
              favoriteColors={pencil.favorites}
              canUndo={pencil.canUndo}
              canRedo={pencil.canRedo}
              onToolChange={pencil.setTool}
              onColorChange={pencil.setColor}
              onWidthChange={pencil.setWidth}
              onPencilOnlyChange={pencil.setPencilOnly}
              onShapeRecognitionChange={pencil.setShapeRecognition}
              onFavoritesChange={pencil.setFavorites}
              onUndo={pencil.undo}
              onRedo={pencil.redo}
              onClose={() => pencil.setDrawingMode(false)}
            />
          </Animated.View>
        </GestureDetector>
      )}

      {/* ── Unified Export sheet (single, replaces Upload-icon legacy export) ── */}
      <PilotV2UnifiedExport
        visible={exportSheetOpen}
        onClose={() => setExportSheetOpen(false)}
        title={title || 'Pilot V2 Note'}
        blocks={blocks}
        strokes={pencil.engine.getPersisted()}
        pageWidth={paperSize.w}
        pageHeight={paperSize.h}
      />
    </View>
  );
}

/* ─── Block renderer ─────────────────────────────────────────────────────── */

interface BlockRendererProps { block: PilotV2Block; colors: any }

function BlockRenderer({ block, colors }: BlockRendererProps) {
  const markStyle = {
    fontWeight:          block.bold      ? '700' as const        : undefined,
    fontStyle:           block.italic    ? 'italic' as const     : undefined,
    textDecorationLine:  block.underline ? 'underline' as const  : undefined,
  };

  if (block.imageBase64 || block.imageUri) {
    return (
      <Image
        source={{ uri: (block.imageBase64 ?? block.imageUri) as string }}
        style={bStyles.blockImage}
      />
    );
  }

  if (block.tableRows?.length) {
    return (
      <View style={bStyles.tableWrap}>
        {block.tableRows.map((row, ri) => (
          <View key={ri} style={bStyles.tableRow}>
            {row.map((cell, ci) => (
              <Text
                key={ci}
                style={[
                  bStyles.tableCell,
                  ri === 0 && { fontWeight: '700', backgroundColor: '#F9FAFB' },
                ]}
                numberOfLines={3}
              >
                {cell || ' '}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (block.link) {
    return (
      <TouchableOpacity
        onPress={() =>
          Linking.openURL(block.link as string).catch(() =>
            Alert.alert('Could not open', block.link as string)
          )
        }
        style={{ marginVertical: 6 }}
      >
        <Text style={[bStyles.text, { color: '#5B4EFA', textDecorationLine: 'underline' }, markStyle]}>
          {block.text || block.link}
        </Text>
      </TouchableOpacity>
    );
  }

  switch (block.type) {
    case 'heading': {
      const fs = block.level === 1 ? 24 : block.level === 3 ? 16 : 18;
      const mt = block.level === 1 ? 32 : 24;
      return (
        <Text style={[bStyles.heading, { fontSize: fs, marginTop: mt, color: colors.textPrimary }]}>
          {block.text}
        </Text>
      );
    }
    case 'bullet':
      return (
        <View style={bStyles.bulletRow}>
          <Text style={[bStyles.bulletDot, { color: colors.textPrimary }]}>•</Text>
          <View style={{ flex: 1 }}>
            <RenderHtml
              source={{ html: block.text || '' }}
              contentWidth={800}
              baseStyle={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24 }}
              tagsStyles={{
                b: { fontWeight: 'bold' as const, color: colors.textPrimary },
                strong: { fontWeight: 'bold' as const, color: colors.textPrimary },
                i: { fontStyle: 'italic' as const },
                em: { fontStyle: 'italic' as const },
              }}
            />
          </View>
        </View>
      );
    case 'numbered':
      return (
        <View style={bStyles.bulletRow}>
          <Text style={[bStyles.bulletDot, { color: colors.textPrimary, fontWeight: '600' }]}>1.</Text>
          <View style={{ flex: 1 }}>
            <RenderHtml
              source={{ html: block.text || '' }}
              contentWidth={800}
              baseStyle={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24 }}
              tagsStyles={{
                b: { fontWeight: 'bold' as const, color: colors.textPrimary },
                strong: { fontWeight: 'bold' as const, color: colors.textPrimary },
                i: { fontStyle: 'italic' as const },
                em: { fontStyle: 'italic' as const },
              }}
            />
          </View>
        </View>
      );
    case 'checklist':
      return (
        <View style={bStyles.bulletRow}>
          <View style={[bStyles.checkbox, {
            borderColor: colors.border,
            backgroundColor: block.checked ? '#5B4EFA' : 'transparent',
          }]} />
          <View style={{ flex: 1 }}>
            <RenderHtml
              source={{ html: block.text || '' }}
              contentWidth={800}
              baseStyle={{
                color: colors.textPrimary,
                fontSize: 16,
                lineHeight: 24,
                textDecorationLine: block.checked ? 'line-through' : 'none',
              }}
              tagsStyles={{
                b: { fontWeight: 'bold' as const, color: colors.textPrimary },
                strong: { fontWeight: 'bold' as const, color: colors.textPrimary },
                i: { fontStyle: 'italic' as const },
                em: { fontStyle: 'italic' as const },
              }}
            />
          </View>
        </View>
      );
    case 'quote':
      return (
        <View style={[bStyles.quote, { borderLeftColor: '#5B4EFA' }]}>
          <View style={{ flex: 1 }}>
            <RenderHtml
              source={{ html: block.text || '' }}
              contentWidth={800}
              baseStyle={{ color: colors.textSecondary, fontSize: 16, lineHeight: 24, fontStyle: 'italic' }}
              tagsStyles={{
                b: { fontWeight: 'bold' as const },
                strong: { fontWeight: 'bold' as const },
              }}
            />
          </View>
        </View>
      );
    case 'highlight':
      return (
        <View style={[bStyles.highlight, { backgroundColor: highlightBg(block.highlightColor) }]}>
          <View style={{ flex: 1 }}>
            <RenderHtml
              source={{ html: block.text || '' }}
              contentWidth={800}
              baseStyle={{ color: '#1F2937', fontSize: 16, lineHeight: 24 }}
              tagsStyles={{
                b: { fontWeight: 'bold' as const },
                strong: { fontWeight: 'bold' as const },
              }}
            />
          </View>
        </View>
      );
    case 'code':
      return (
        <View style={[bStyles.code, { backgroundColor: '#0F172A' }]}>
          <Text style={[bStyles.text, { color: '#E2E8F0', fontFamily: 'monospace' }]}>
            {block.text}
          </Text>
        </View>
      );
    default:
      return (
        <RenderHtml
          source={{ html: block.text || '' }}
          contentWidth={800}
          baseStyle={{ color: colors.textPrimary, fontSize: 16, lineHeight: 24 }}
          tagsStyles={{
            b: { fontWeight: 'bold' as const, color: colors.textPrimary },
            strong: { fontWeight: 'bold' as const, color: colors.textPrimary },
            i: { fontStyle: 'italic' as const },
            em: { fontStyle: 'italic' as const },
          }}
        />
      );
  }
}

/* ─── styles ─────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  /* Header */
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  iconBtn: { padding: 10, borderRadius: 10 },

  /* Zoom pill in header */
  zoomPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, marginRight: 4,
  },
  zoomPillText: { fontSize: 12, fontWeight: '700' },

  /* Zoom hint badge (shows when not zoomed) */
  zoomHint: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth, marginRight: 4, opacity: 0.6,
  },
  zoomHintText: { fontSize: 10, fontWeight: '600' },

  /* Canvas: clips overflow when zoomed */
  canvas: {
    flex: 1,
    overflow: 'hidden',
  },

  /* Page: this is what gets scaled */
  page: {
    flex: 1,
  },

  /* Scroll view */
  scroll: { flex: 1 },

  /* Content body — NOTE: no maxWidth, full-width reading */
  body: {
    paddingHorizontal: 16,
    paddingTop: 28,
  },

  /* Title row */
  titleRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: 20, gap: 12,
  },
  h1: { flex: 1, fontSize: 26, fontWeight: '700', lineHeight: 36 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },

  /* Divider + EOG */
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 28 },
  eog: { fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginBottom: 8 },

  /* Zoom help bar at bottom */
  zoomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth,
  },
  zoomBarText: { flex: 1, fontSize: 12, lineHeight: 16 },
  zoomBarBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1,
    marginLeft: 12,
  },

  /* Floating back button */
  floatingBack: {
    position: 'absolute',
    top: 18,
    left: 18,
    zIndex: 1500,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});

const bStyles = StyleSheet.create({
  blockImage: {
    width: '100%', minHeight: 200, borderRadius: 10,
    marginVertical: 12, resizeMode: 'cover', backgroundColor: '#0F172A',
  },
  tableWrap: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    overflow: 'hidden', marginVertical: 12,
  },
  tableRow: { flexDirection: 'row' },
  tableCell: {
    flex: 1, padding: 10, fontSize: 13, color: '#0F172A',
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB',
  },
  heading: { fontWeight: '700', marginBottom: 10, lineHeight: 28 },
  bulletRow: { flexDirection: 'row', gap: 10, marginVertical: 5 },
  bulletDot: { fontSize: 16, lineHeight: 24, width: 18 },
  text: { fontSize: 16, lineHeight: 26, flex: 1 },
  checkbox: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, marginTop: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4, marginVertical: 8 },
  highlight: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginVertical: 6 },
  code: { padding: 14, borderRadius: 8, marginVertical: 8 },
});

const glanceStyles = StyleSheet.create({
  pencilFab: {
    position: 'absolute', right: 100, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 1100,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  pencilToolbarFloat: {
    position: 'absolute', left: 12, right: 12, bottom: 90,
    alignItems: 'center', zIndex: 1200,
  },
});
