/**
 * Pilot V2 — Editor View (Samsung Notes-style block editor)
 *
 * Faithful port of the KM `EditorView`:
 *   • Top bar: doc title, undo/redo, "Saved" status, close button
 *   • Document title input (large)
 *   • Formatting toolbar:
 *       H1, H2, B, I, U, divider,
 *       OL, UL, Checklist, divider,
 *       Highlight (with palette pop-over),
 *       Link, Image, Calendar, Paperclip, Table, Code
 *   • Block-based editor area
 *   • Right-hand outline panel (Blocks / Outline tabs) on tablets
 *   • Bottom bar: font size, zoom, word count
 *
 * Auto-save on every change is debounced and mirrored to the in-memory
 * note via `PATCH_BLOCKS`. Step 10 wires this to Supabase via pilotV2Repo.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, runOnJS } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import RenderHtml from 'react-native-render-html';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, useWindowDimensions, Modal, Alert, Linking,
  Image, Animated, StatusBar, PanResponder, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  X, RotateCcw, RotateCw, Save, Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, ListTodo, Link as LinkIcon, Image as ImageIcon, Calendar,
  Paperclip, Table as TableIcon, Code, Type, ChevronDown, ChevronLeft, ChevronRight, Highlighter, Plus, Trash2, ArrowUp, ArrowDown, Edit3, Quote, MoreHorizontal,
  Pen,
} from 'lucide-react-native';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import RichNoteEditor from '../RichNoteEditor';
import { useTheme } from '../../context/ThemeContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  PilotV2Block, PilotV2BlockType, PILOT_V2_HIGHLIGHT_PALETTE,
  PilotV2PencilStroke,
} from './types';
import { savePilotV2NoteContent, renamePilotV2Note } from '../../repositories/pilotV2Repo';
import { savePilotV2NoteOfflineFirst } from './pilotV2OfflineSave';
import { PencilCanvas } from './PencilCanvas';
import { PencilToolbar } from './PencilToolbar';
import { usePilotV2Pencil } from './usePilotV2Pencil';
import { PilotV2UnifiedExport } from './PilotV2UnifiedExport';
import { getBlockTag } from './pilotV2Migration';
import {
  PilotV2WashiTape, WashiTapeColor, toggleWashiReveal,
  removeWashiTape, setAllRevealed,
} from './washiTape';
import { WashiTapeLayer, WashiTapeColorPicker } from './WashiTapeLayer';
import { PilotV2BlockRichEditModal } from './PilotV2BlockRichEditModal';

let globalToolbarVisible = false;
let globalToolbarPos = { x: 80, y: 150 };

const stripHtml = (html: string) => html ? html.replace(/<[^>]*>/g, '') : '';

const preserveHtmlWrap = (originalHtml: string, newPlainText: string): string => {
  if (!originalHtml) return newPlainText;
  const match = originalHtml.trim().match(/^<([a-zA-Z0-9]+)([^>]*)>(.*)<\/\1>$/);
  if (match) {
    const tagName = match[1];
    const attributes = match[2];
    return `<${tagName}${attributes}>${newPlainText}</${tagName}>`;
  }
  return newPlainText;
};

const newId = () =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `pv2_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const tomorrowMorningMinutes = (): number => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);
  return Math.max(1, Math.round((next.getTime() - Date.now()) / 60000));
};

const DEFAULT_BLOCKS: PilotV2Block[] = [
  { id: newId(), type: 'heading', level: 2, text: 'Key Points' },
  { id: newId(), type: 'bullet', text: 'No person shall be deprived of his life or personal liberty except according to procedure established by law.' },
  { id: newId(), type: 'bullet', text: 'Interpreted widely by the judiciary.' },
  { id: newId(), type: 'bullet', text: 'Includes the right to live with dignity.' },
  { id: newId(), type: 'heading', level: 2, text: 'Important Cases' },
  { id: newId(), type: 'bullet', text: 'Maneka Gandhi v. Union of India' },
  { id: newId(), type: 'bullet', text: 'Olga Tellis v. Bombay Municipal Corp.' },
  { id: newId(), type: 'bullet', text: 'Puttaswamy Judgment (Privacy)' },
  { id: newId(), type: 'heading', level: 2, text: 'Checklist' },
  { id: newId(), type: 'checklist', text: 'Read Article 14 text', checked: false },
  { id: newId(), type: 'checklist', text: 'Review key cases', checked: true },
  { id: newId(), type: 'checklist', text: 'Practice previous year questions', checked: false },
];

export function PilotV2EditorView() {
  // Persistence system for Pencil FAB Positioning
  const pencilDragX = useSharedValue(0);
  const pencilDragY = useSharedValue(0);
  const pencilStartDragX = useSharedValue(0);
  const pencilStartDragY = useSharedValue(0);

  const savePencilPos = useCallback((x: number, y: number) => {
    AsyncStorage.setItem('pilot_v2_pencil_fab_pos', JSON.stringify({ x, y })).catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('pilot_v2_pencil_fab_pos').then(saved => {
      if (saved) {
        try {
          const p = JSON.parse(saved);
          if (typeof p.x === 'number') pencilDragX.value = p.x;
          if (typeof p.y === 'number') pencilDragY.value = p.y;
        } catch {}
      }
    });
  }, []);

  const pencilPanGesture = useMemo(() => 
    Gesture.Pan()
      .minDistance(5)
      .onStart(() => {
        pencilStartDragX.value = pencilDragX.value;
        pencilStartDragY.value = pencilDragY.value;
      })
      .onUpdate((e) => {
        pencilDragX.value = pencilStartDragX.value + e.translationX;
        pencilDragY.value = pencilStartDragY.value + e.translationY;
      })
      .onFinalize(() => {
        runOnJS(savePencilPos)(pencilDragX.value, pencilDragY.value);
      }),
    [savePencilPos]
  );

  const pencilFabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pencilDragX.value },
      { translateY: pencilDragY.value }
    ]
  }));

  const { colors } = useTheme();
  const { dispatch, currentNote } = usePilotV2();
  const note = currentNote();
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;

  const [title, setTitle] = useState(note?.title ?? 'Untitled note');
  const [blocks, setBlocks] = useState<PilotV2Block[]>(() => {
    if (note?.content?.blocks?.length) {
      return note.content.blocks;
    }
    if (note?.id && note.id.startsWith('n') && note.id.length === 2) {
      return DEFAULT_BLOCKS;
    }
    return [{ id: newId(), type: 'paragraph', text: '' }];
  });
  const [activeBlockId, setActiveBlockId] = useState<string | null>(blocks[0]?.id ?? null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState('Yellow');
  const [outlineTab, setOutlineTab] = useState<'blocks' | 'outline'>('blocks');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('saved');
  const saveTimer = useRef<any>(null);
  /** Maps blockId → {y, h} in pixels within the paper view.  Updated by
   *  each BlockRow's onLayout callback.  Used to assign anchor.blockOriginY
   *  when a stroke is committed (Step 6 — block-level anchoring). */
  const blockLayoutsRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());
  /** Incremented whenever a block's y/h changes significantly (e.g. after a
   *  block-reorder or text height change).  Passed to <PencilCanvas> so the
   *  CommittedStrokesLayer knows to re-derive stroke display positions. */
  const [blockLayoutVersion, setBlockLayoutVersion] = useState(0);
  const [tableEditor, setTableEditor] = useState<{ visible: boolean; blockId: string | null; rows: string[][] }>({
    visible: false,
    blockId: null,
    rows: [],
  });
  const [richBlockEdit, setRichBlockEdit] = useState<{ visible: boolean; blockId: string | null; html: string }>({
    visible: false,
    blockId: null,
    html: '',
  });

  /* --------------- Bottom bar — font scale & zoom --------------- */
  // Each step is a distinct "Aa" preset that scales every block's font, plus a
  // zoom multiplier for the whole canvas. Both persist for the editor session.
  const FONT_SCALES = [0.85, 1.0, 1.15, 1.3];
  const ZOOM_LEVELS = [0.75, 1.0, 1.25, 1.5];
  const [fontScaleIdx, setFontScaleIdx] = useState(1); // default 1.0
  const [zoomIdx, setZoomIdx] = useState(1);            // default 1.0
  const fontScale = FONT_SCALES[fontScaleIdx];
  const zoom = ZOOM_LEVELS[zoomIdx];

  const cycleFontScale = () => setFontScaleIdx((i) => (i + 1) % FONT_SCALES.length);
  const cycleZoom      = () => setZoomIdx((i) => (i + 1) % ZOOM_LEVELS.length);
  // We snapshot { blocks, title } whenever the user mutates state. Undo pops
  // the last snapshot and pushes the current state to the redo stack.
  const undoStack = useRef<Array<{ blocks: PilotV2Block[]; title: string }>>([]);
  const redoStack = useRef<Array<{ blocks: PilotV2Block[]; title: string }>>([]);
  const skipHistoryRef = useRef(false);
  const [historyTick, setHistoryTick] = useState(0);
  const contentRef = useRef<View>(null);

  const pushHistory = (prevBlocks: PilotV2Block[], prevTitle: string) => {
    if (skipHistoryRef.current) return;
    undoStack.current.push({ blocks: prevBlocks, title: prevTitle });
    if (undoStack.current.length > 100) undoStack.current.shift();
    redoStack.current = [];
    setHistoryTick(t => t + 1);
  };

  const handleUndo = () => {
    const last = undoStack.current.pop();
    if (!last) return;
    redoStack.current.push({ blocks, title });
    skipHistoryRef.current = true;
    setBlocks(last.blocks);
    setTitle(last.title);
    scheduleSave(last.blocks, last.title);
    skipHistoryRef.current = false;
    setHistoryTick(t => t + 1);
  };

  const handleRedo = () => {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ blocks, title });
    skipHistoryRef.current = true;
    setBlocks(next.blocks);
    setTitle(next.title);
    scheduleSave(next.blocks, next.title);
    skipHistoryRef.current = false;
    setHistoryTick(t => t + 1);
  };
  // historyTick is referenced so the lint catcher knows the state is consumed
  void historyTick;

  const wordCount = useMemo(
    () => blocks.reduce((acc, b) => acc + (b.text?.trim().split(/\s+/).filter(Boolean).length ?? 0), 0),
    [blocks]
  );

  const scheduleSave = (nextBlocks: PilotV2Block[], nextTitle: string) => {
    setSavingState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        if (note?.id) {
          if (nextTitle !== note.title) await renamePilotV2Note(note.id, nextTitle);
          await savePilotV2NoteOfflineFirst(note.id, { blocks: nextBlocks, version: 1 });
          dispatch({ type: 'PATCH_BLOCKS', payload: { id: note.id, blocks: nextBlocks } });
          dispatch({ type: 'PATCH_CURRENT_NOTE', payload: { id: note.id, patch: { title: nextTitle } } });
        }
        setSavingState('saved');
      } catch {
        setSavingState('idle');
      }
    }, 600);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const updateBlock = (id: string, patch: Partial<PilotV2Block>) => {
    pushHistory(blocks, title);
    const next = blocks.map(b => (b.id === id ? { ...b, ...patch } : b));
    setBlocks(next);
    scheduleSave(next, title);
  };

  const moveBlock = (id: string, dir: 'up' | 'down') => {
    pushHistory(blocks, title);
    const idx = blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    setBlocks(next);
    scheduleSave(next, title);
  };

  const setActiveBlockType = (type: PilotV2BlockType, level?: 1 | 2 | 3) => {
    if (!activeBlockId) return;
    updateBlock(activeBlockId, { type, level });
  };

  const toggleMark = (mark: 'bold' | 'italic' | 'underline') => {
    if (!activeBlockId) return;
    const target = blocks.find(b => b.id === activeBlockId);
    if (!target) return;
    updateBlock(activeBlockId, { [mark]: !target[mark] } as Partial<PilotV2Block>);
  };

  const activeBlock = blocks.find(b => b.id === activeBlockId);
  const isMarkActive = (mark: 'bold' | 'italic' | 'underline') => Boolean(activeBlock?.[mark]);

  const insertBlockAfterActive = (type: PilotV2BlockType = 'paragraph', extra?: Partial<PilotV2Block>) => {
    pushHistory(blocks, title);
    const newBlock: PilotV2Block = { id: newId(), type, text: '', ...extra };
    const idx = blocks.findIndex(b => b.id === activeBlockId);
    const next = [...blocks];
    if (idx === -1) next.push(newBlock);
    else next.splice(idx + 1, 0, newBlock);
    setBlocks(next);
    setActiveBlockId(newBlock.id);
    scheduleSave(next, title);
    return newBlock;
  };

  const deleteBlock = (id: string) => {
    pushHistory(blocks, title);
    if (blocks.length === 1) {
      const reset: PilotV2Block[] = [{ id: newId(), type: 'paragraph', text: '' }];
      setBlocks(reset); scheduleSave(reset, title); return;
    }
    const next = blocks.filter(b => b.id !== id);
    setBlocks(next);
    if (activeBlockId === id) setActiveBlockId(next[0]?.id ?? null);
    scheduleSave(next, title);
  };

  const applyHighlight = (color: string) => {
    if (!activeBlockId) { setShowHighlightPicker(false); return; }
    setActiveHighlight(color);
    updateBlock(activeBlockId, { type: 'highlight', highlightColor: color });
    setShowHighlightPicker(false);
  };

  const handleClose = () => {
    dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
  };

  const openTableEditor = (blockId: string, rows: string[][]) => {
    setTableEditor({ visible: true, blockId, rows: rows.map(r => [...r]) });
  };

  const commitTableEditor = () => {
    if (!tableEditor.blockId) return;
    const rows = tableEditor.rows.map(r => r.map(c => c ?? ''));
    updateBlock(tableEditor.blockId, {
      tableRows: rows,
      text: rows.map(r => r.join(' | ')).join('\n'),
    });
    setTableEditor({ visible: false, blockId: null, rows: [] });
  };

  const openBlockEditSheet = (blockId: string) => {
    const target = blocks.find((b) => b.id === blockId);
    if (!target) return;
    const normalizedBody = (target.text || '').trim().startsWith('<')
      ? (target.text || '')
      : `<p>${(target.text || '').replace(/\n/g, '<br/>')}</p>`;
    setBlockEditSheet({
      visible: true,
      blockId,
      body: normalizedBody,
    });
    setBlockEditKey((k) => k + 1);
  };

  const applyBlockEditSheet = async () => {
    if (!blockEditSheet.blockId) return;
    setBlockEditSaving(true);
    try {
      let html = blockEditSheet.body || '';
      try {
        const fromEditor = await blockEditRef.current?.getContentHtml?.();
        if (typeof fromEditor === 'string') html = fromEditor;
      } catch {}
      updateBlock(blockEditSheet.blockId, { text: html });
      setBlockEditSheet({ visible: false, blockId: null, body: '' });
    } finally {
      setBlockEditSaving(false);
    }
  };

  /* --------------- Link / Image / Calendar / Attachment / Table / Code --------------- */
  const [linkModal, setLinkModal] = useState<{ visible: boolean; text: string; url: string }>({
    visible: false, text: '', url: '',
  });
  const [reminderPickerVisible, setReminderPickerVisible] = useState(false);

  // Export sheet state — single unified export (replaces 3 legacy buttons)
  const [exportSheetOpen, setExportSheetOpen] = useState(false);

  const insertLink = () => {
    const target = activeBlock;
    setLinkModal({
      visible: true,
      text: target?.text ?? '',
      url: (target?.link as string) ?? 'https://',
    });
  };

  const submitLink = () => {
    const { text, url } = linkModal;
    setLinkModal(s => ({ ...s, visible: false }));
    if (!url.trim()) return;
    if (activeBlockId) {
      updateBlock(activeBlockId, { text: text || url, link: url });
    } else {
      insertBlockAfterActive('paragraph', { text: text || url, link: url });
    }
  };

  const insertImageFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Grant photo-library access to insert images.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : undefined;
      insertBlockAfterActive('paragraph', {
        text: '',
        imageBase64: data,
        imageUri: !data ? asset.uri : undefined,
      });
    } catch (e) {
      Alert.alert('Could not insert image', (e as Error).message);
    }
  };

  const insertReminder = (offsetMinutes: number) => {
    const when = new Date(Date.now() + offsetMinutes * 60 * 1000);
    const label = when.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    insertBlockAfterActive('paragraph', {
      text: `📅 Reminder · ${label}`,
      remindAt: when.toISOString(),
    });
    setReminderPickerVisible(false);
  };

  const insertAttachment = async () => {
    // Without a document picker installed we offer the photo-library route as
    // a friendly fallback (a file blob is captured as an attachment).
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Grant photo-library access to attach files.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        base64: false,
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.fileName ?? asset.uri.split('/').pop() ?? 'attachment';
      insertBlockAfterActive('paragraph', {
        text: `📎 ${name}`,
        attachment: { name, uri: asset.uri, mime: asset.mimeType, size: asset.fileSize },
      });
    } catch (e) {
      Alert.alert('Could not attach file', (e as Error).message);
    }
  };

  const insertTable = () => {
    Alert.alert(
      'Insert table',
      'Choose a layout',
      [
        { text: '2 × 2', onPress: () => addTableBlock(2, 2) },
        { text: '3 × 3', onPress: () => addTableBlock(3, 3) },
        { text: '4 × 4', onPress: () => addTableBlock(4, 4) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const addTableBlock = (rows: number, cols: number) => {
    const tableRows = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => (r === 0 ? `Col ${c + 1}` : ''))
    );
    insertBlockAfterActive('paragraph', {
      text: tableRows.map(r => r.join(' | ')).join('\n'),
      tableRows,
    });
  };

  const insertCode = () => {
    const inserted = insertBlockAfterActive('code', { text: '' });
    setActiveBlockId(inserted.id);
  };

  // Scroll-fade title animation
  const scrollY = useRef(new Animated.Value(0)).current;
  const titleOpacity = scrollY.interpolate({ inputRange: [0, 60, 120], outputRange: [1, 0.4, 0], extrapolate: 'clamp' });
  const titleTranslate = scrollY.interpolate({ inputRange: [0, 120], outputRange: [0, -40], extrapolate: 'clamp' });

  // Floating control panel menu
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [outlinePanelOpen, setOutlinePanelOpen] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const [blockEditSheet, setBlockEditSheet] = useState<{ visible: boolean; blockId: string | null; body: string }>({
    visible: false,
    blockId: null,
    body: '',
  });
  const [blockEditSaving, setBlockEditSaving] = useState(false);
  const [blockEditKey, setBlockEditKey] = useState(0);
  const [slashPicker, setSlashPicker] = useState<{ visible: boolean; blockId: string | null }>({ visible: false, blockId: null });
  const blockEditRef = useRef<any>(null);

  /* --------------- Pencil annotation overlay (Step 5+6) --------------- */
  const [paperSize, setPaperSize] = useState({ w: 1, h: 1 });

  /* ── Editor Zoom & Pan (GlanceView-style Pinch & Drag) ────────────────── */
  const editorScale = useSharedValue(1);
  const editorOffsetX = useSharedValue(0);
  const editorOffsetY = useSharedValue(0);
  const savedEditorScale = useSharedValue(1);
  const savedEditorOffsetX = useSharedValue(0);
  const savedEditorOffsetY = useSharedValue(0);
  
  const outlineWidth = useSharedValue(0);
  useEffect(() => {
    outlineWidth.value = withSpring(outlinePanelOpen ? 340 : 0, { damping: 15, stiffness: 100 });
  }, [outlinePanelOpen]);

  const animatedOutlineStyle = useAnimatedStyle(() => ({
    width: outlineWidth.value,
    opacity: outlineWidth.value > 20 ? 1 : 0,
    overflow: 'hidden',
  }));

  const editorPinchGesture = Gesture.Pinch()
    .onUpdate(e => {
      'worklet';
      editorScale.value = Math.max(0.25, Math.min(4, savedEditorScale.value * e.scale));
    })
    .onEnd(() => {
      'worklet';
      savedEditorScale.value = editorScale.value;
    });

  const editorPanGesture = Gesture.Pan()
    .onUpdate(e => {
      'worklet';
      editorOffsetX.value = savedEditorOffsetX.value + e.translationX;
      editorOffsetY.value = savedEditorOffsetY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      savedEditorOffsetX.value = editorOffsetX.value;
      savedEditorOffsetY.value = editorOffsetY.value;
    });

  const editorComposedGesture = Gesture.Simultaneous(editorPinchGesture, editorPanGesture);

  const animatedEditorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: editorOffsetX.value },
      { translateY: editorOffsetY.value },
      { scale: editorScale.value },
    ],
  }));

  useEffect(() => {
    editorScale.value = zoom;
    savedEditorScale.value = zoom;
  }, [zoom]);
  const initialStrokes = (note?.content?.pencilStrokes ?? []) as PilotV2PencilStroke[];
  // Pending content ref — captures the latest blocks + strokes payload that
  // hasn't been flushed yet. We flush this ref on unmount so a debounced
  // save in flight is never lost when the user navigates away mid-stroke
  // (which previously caused 'drawings disappear after navigation').
  const pendingSaveRef = useRef<{ noteId: string; content: any } | null>(null);

  /** After a stroke is committed, find which block's y-range the stroke
   *  centroid falls in and tag the stroke with anchor.blockId +
   *  anchor.blockOriginY.  Also detects underline / highlight strokes and
   *  populates span-offset fields (Step 9) for future text-edit tracking.
   *  Strokes that already carry an anchor are left untouched (idempotent).
   *  O(n_strokes × n_blocks). */
  const assignAnchorToStrokes = useCallback(
    (strokes: PilotV2PencilStroke[]): PilotV2PencilStroke[] => {
      const ph = Math.max(1, paperSize.h);
      const pw = Math.max(1, paperSize.w);
      return strokes.map((s) => {
        if (s.anchor) return s;
        const pts = s.points;
        if (!pts.length) return s;

        // ── 1. Find host block (centroid Y) ──────────────────────────────
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

        // ── 2. Span-offset detection for underlines / highlights ─────────
        // A stroke is treated as a text annotation when:
        //   a) tool is 'highlighter', OR
        //   b) tool is 'pen' and the stroke is nearly horizontal:
        //      vertical spread < 20 % of horizontal spread AND
        //      horizontal span > 5 % of page width.
        let spanAnchor: Partial<typeof s.anchor> = {};
        const isHighlighter = s.tool === 'highlighter';
        if (isHighlighter || s.tool === 'pen') {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          const dX = maxX - minX; // horizontal spread (0..1)
          const dY = maxY - minY; // vertical spread (0..1)
          const isHorizontal = dX > 0.05 && dY < dX * 0.25; // flat stroke
          if (isHighlighter || isHorizontal) {
            // Block-relative coordinates (critical for reflow-safe underlines)
            const blockH = Math.max(1, blockRect.h);
            const blockW = Math.max(1, blockRect.w);
            const minXpx = minX * pw;
            const maxXpx = maxX * pw;
            const startRelX = Math.max(0, Math.min(1, (minXpx - blockRect.x) / blockW));
            const endRelX   = Math.max(startRelX, Math.max(0, Math.min(1, (maxXpx - blockRect.x) / blockW)));
            const relY = Math.max(0, Math.min(1,
              (cy - blockRect.y) / blockH,
            ));
            // Estimate char offsets using the block's text length.
            // charPos = fraction_of_block_width × block_text_length.
            // This is a heuristic; precise measurement requires text-layout.
            const blockText = blocks.find(b => b.id === bestId)?.text ?? '';
            const textLen = Math.max(1, blockText.length);
            const startOffset = Math.round(startRelX * textLen);
            const endOffset   = Math.min(textLen, Math.round(endRelX * textLen));
            spanAnchor = {
              elementId:   bestId, // = blockId for single-span blocks
              spanIndex:   0,
              startOffset,
              endOffset,
              startRelX,
              endRelX,
              relY,
            };
          }
        }

        return {
          ...s,
          anchor: { blockId: bestId, blockOriginY, ...spanAnchor },
        };
      });
    },
    [paperSize.h, paperSize.w, blocks],
  );

  const persistStrokes = (next: PilotV2PencilStroke[]) => {
    // Tag any new strokes with their block anchor before persisting.
    const anchored = assignAnchorToStrokes(next);
    // Silently update engine's in-memory anchor metadata so the display
    // transform in CommittedStrokesLayer always sees fresh values.
    anchored.forEach((s) => {
      if (s.anchor) pencil.engine.setStrokeAnchor(s.id, s.anchor);
    });
    if (!note?.id) return;
    const content = { blocks, version: 1, pencilStrokes: anchored };
    pendingSaveRef.current = { noteId: note.id, content };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await savePilotV2NoteOfflineFirst(note.id, content);
        dispatch({ type: 'PATCH_BLOCKS', payload: { id: note.id, blocks } });
        dispatch({ type: 'PATCH_PENCIL_STROKES', payload: { id: note.id, strokes: anchored } });
        pendingSaveRef.current = null;
        setSavingState('saved');
      } catch { setSavingState('idle'); }
    }, 600);
  };
  // Flush any pending stroke save on unmount so navigation never drops a
  // commit. Persistence is offline-first (MMKV) so this is fire-and-forget.
  useEffect(() => {
    return () => {
      const pending = pendingSaveRef.current;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (pending) {
        savePilotV2NoteOfflineFirst(pending.noteId, pending.content).catch(() => null);
        pendingSaveRef.current = null;
      }
    };
  }, []);
  const pencil = usePilotV2Pencil({
    noteId: note?.id ?? null,
    initialStrokes,
    pageWidth: paperSize.w,
    pageHeight: paperSize.h,
    onChange: persistStrokes,
  });

  // ── Washi-Tape state ─────────────────────────────────────────────────
  const [washiTapes, setWashiTapes] = useState<PilotV2WashiTape[]>(
    () => (note?.content as any)?.washiTapes || []
  );
  const [washiMode, setWashiMode] = useState(false);
  const [washiColor, setWashiColor] = useState<WashiTapeColor>('Yellow');
  const persistWashi = (next: PilotV2WashiTape[]) => {
    if (!note?.id) return;
    setWashiTapes(next);
    const content: any = { blocks, version: 1, pencilStrokes: pencil.engine.getPersisted(), washiTapes: next };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await savePilotV2NoteOfflineFirst(note.id, content); } catch { /* ignore */ }
    }, 600);
  };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#fff' }}
      testID="pilot-v2-editor"
    >
      {/* Hide system status bar for true fullscreen immersion */}
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* Floating back button (replaces Save/X bar) */}
      <TouchableOpacity
        testID="pilot-v2-editor-back"
        onPress={handleClose}
        activeOpacity={0.85}
        style={[styles.floatingBack, { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: colors.border }]}
      >
        <X size={18} color={colors.textPrimary} />
      </TouchableOpacity>

      {/* Floating top-right control panel: Undo / Redo / More */}
      <View style={[styles.floatingControls, { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: colors.border }]}>
        <TouchableOpacity
          testID="pilot-v2-tool-undo"
          onPress={handleUndo}
          disabled={undoStack.current.length === 0}
          style={[styles.iconBtn, { opacity: undoStack.current.length === 0 ? 0.35 : 1 }]}
        >
          <RotateCcw size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="pilot-v2-tool-redo"
          onPress={handleRedo}
          disabled={redoStack.current.length === 0}
          style={[styles.iconBtn, { opacity: redoStack.current.length === 0 ? 0.35 : 1 }]}
        >
          <RotateCw size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          testID="pilot-v2-tool-more"
          onPress={() => setMoreMenuOpen(true)}
          style={styles.iconBtn}
        >
          <MoreHorizontal size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Collapsible Outline Panel Toggle Button (Tablet only) */}
      {isTablet && (
        <TouchableOpacity
          onPress={() => setOutlinePanelOpen(prev => !prev)}
          activeOpacity={0.85}
          style={[
            styles.floatingControls,
            {
              top: 78,
              right: 18,
              paddingHorizontal: 12,
              paddingVertical: 12,
              borderRadius: 24,
              backgroundColor: 'rgba(255,255,255,0.92)',
              borderColor: colors.border,
            }
          ]}
        >
          {outlinePanelOpen ? (
            <ChevronRight size={18} color={colors.textPrimary} />
          ) : (
            <ChevronLeft size={18} color={colors.textPrimary} />
          )}
        </TouchableOpacity>
      )}

      {/* Title + toolbar (fades on scroll) */}
      <Animated.View style={[styles.titleSection, activeBlockId ? { height: 0, paddingTop: 0, paddingBottom: 0, opacity: 0, overflow: 'hidden' } : null, { borderBottomColor: 'transparent', opacity: titleOpacity, transform: [{ translateY: titleTranslate }] }]} pointerEvents="box-none">
        <TextInput
          testID="pilot-v2-editor-title"
          value={title}
          onChangeText={(v) => { setTitle(v); scheduleSave(blocks, v); }}
          placeholder="Untitled"
          placeholderTextColor={colors.textTertiary}
          style={[styles.titleInput, { color: colors.textPrimary }]}
        />
        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
          {note?.updated_at ? new Date(note.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
        </Text>
      </Animated.View>

      {/* Floating draggable formatting toolbar */}
      {showToolbar && (
        <FloatingToolbar
          colors={colors}
          onH1={() => setActiveBlockType('heading', 1)}
          onH2={() => setActiveBlockType('heading', 2)}
          onBold={() => toggleMark('bold')}
          onItalic={() => toggleMark('italic')}
          onUnderline={() => toggleMark('underline')}
          onOL={() => setActiveBlockType('numbered')}
          onUL={() => setActiveBlockType('bullet')}
          onCheck={() => setActiveBlockType('checklist')}
          onQuote={() => setActiveBlockType('quote')}
          onHighlight={() => setShowHighlightPicker(v => !v)}
          showHighlightPicker={showHighlightPicker}
          activeHighlight={activeHighlight}
          onApplyHighlight={applyHighlight}
          onLink={insertLink}
          onImage={insertImageFromLibrary}
          onAttach={insertAttachment}
          onTable={insertTable}
          onCode={insertCode}
          isMarkActive={isMarkActive}
        />
      )}

      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Animated.ScrollView
          testID="pilot-v2-editor-canvas"
          style={{ flex: 1, backgroundColor: '#F9FAFB' }}
          contentContainerStyle={styles.canvas}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          <GestureDetector gesture={editorComposedGesture}>
            <AnimatedReanimated.View
              ref={contentRef}
              style={[styles.paper, { backgroundColor: '#fff', borderColor: colors.border }, animatedEditorStyle]}
              onLayout={(e) => setPaperSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            >
            {blocks.map(b => (
              <BlockRow
                key={b.id}
                block={b}
                colors={colors}
                fontScale={fontScale}
                isActive={activeBlockId === b.id}
                onFocus={() => setActiveBlockId(b.id)}
                onChange={(text) => {
                  if ((text === '/' || text === '/ ') && (b.type === 'paragraph' || b.type === 'bullet' || b.type === 'numbered')) {
                    // Slash command: open picker and don't persist the slash.
                    setActiveBlockId(b.id);
                    setSlashPicker({ visible: true, blockId: b.id });
                    updateBlock(b.id, { text: '' });
                    return;
                  }
                  updateBlock(b.id, { text });
                }}
                onToggleCheck={() => updateBlock(b.id, { checked: !b.checked })}
                onDelete={() => deleteBlock(b.id)}
                onMoveUp={() => moveBlock(b.id, 'up')}
                onMoveDown={() => moveBlock(b.id, 'down')}
                onEditTable={() => (b.tableRows?.length ? openTableEditor(b.id, b.tableRows) : null)}
                onOpenRichEdit={() => {
                  setActiveBlockId(b.id);
                  setRichBlockEdit({ visible: true, blockId: b.id, html: b.text || '' });
                }}
                onBlockLayout={(id, x, y, w, h) => {
                  const cur = blockLayoutsRef.current.get(id);
                  blockLayoutsRef.current.set(id, { x, y, w, h });
                  // Bump version only when position changed noticeably so the
                  // CommittedStrokesLayer knows to recompute display offsets.
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
              />
            ))}

            <TouchableOpacity
              testID="pilot-v2-editor-add-block"
              onPress={() => insertBlockAfterActive('paragraph')}
              activeOpacity={0.7}
              style={[styles.addBlockRow, { borderColor: colors.border }]}
            >
              <Plus size={14} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 13 }}>Add block</Text>
            </TouchableOpacity>

            {/* Pencil canvas — Skia renders to a native surface that does NOT
                respect React Native's ScrollView scroll offset. We wrap it in
                an Animated.View that applies the inverse scroll transform so
                strokes follow the content. */}
            {paperSize.w > 1 && paperSize.h > 1 && (
              <Animated.View
                pointerEvents={pencil.drawingMode ? 'auto' : 'none'}
                style={[StyleSheet.absoluteFill, { transform: [{ translateY: Animated.multiply(scrollY, -1) }] }]}
              >
                <PencilCanvas
                  engine={pencil.engine}
                  tool={pencil.tool}
                  width={paperSize.w}
                  height={paperSize.h}
                  drawingMode={pencil.drawingMode}
                  onCommit={(strokes) => persistStrokes(strokes)}
                  blockLayouts={blockLayoutsRef.current}
                  blockLayoutVersion={blockLayoutVersion}
                />
              </Animated.View>
            )}

            {/* Washi Tape layer — same scroll-fix as PencilCanvas above */}
            {paperSize.w > 1 && paperSize.h > 1 && (
              <Animated.View
                pointerEvents={washiMode ? 'auto' : 'none'}
                style={[StyleSheet.absoluteFill, { transform: [{ translateY: Animated.multiply(scrollY, -1) }] }]}
              >
                <WashiTapeLayer
                  tapes={washiTapes}
                  width={paperSize.w}
                  height={paperSize.h}
                  drawingMode={washiMode}
                  activeColor={washiColor}
                  onAdd={(t) => persistWashi([...washiTapes, t])}
                  onToggle={(id) => persistWashi(toggleWashiReveal(washiTapes, id))}
                  onRemove={(id) => persistWashi(removeWashiTape(washiTapes, id))}
                />
              </Animated.View>
            )}

            </AnimatedReanimated.View>
          </GestureDetector>
        </Animated.ScrollView>

        {isTablet && (
          <AnimatedReanimated.View style={[styles.outlinePanel, { borderLeftColor: colors.border, paddingTop: 130 }, animatedOutlineStyle]}>
            <View style={[styles.outlineTabs, { borderBottomColor: colors.border }]}>
              <OutlineTab label="Blocks"  active={outlineTab === 'blocks'}  onPress={() => setOutlineTab('blocks')} />
              <OutlineTab label="Outline" active={outlineTab === 'outline'} onPress={() => setOutlineTab('outline')} />
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
              {(outlineTab === 'blocks' ? blocks : blocks.filter(b => b.type === 'heading')).map(b => (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => setActiveBlockId(b.id)}
                  style={[styles.outlineRow, activeBlockId === b.id ? { backgroundColor: '#EEECFF' } : null]}
                >
                  <Text style={{ fontSize: 11, color: colors.textTertiary, width: 28 }}>
                    {b.type === 'heading' ? `H${b.level ?? 2}` : b.type.slice(0, 3).toUpperCase()}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textPrimary, flex: 1 }} numberOfLines={1}>
                    {b.text || 'Empty'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </AnimatedReanimated.View>
        )}
      </View>


      {/* Link prompt modal */}
      <Modal
        visible={linkModal.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setLinkModal(s => ({ ...s, visible: false }))}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border }]} testID="pilot-v2-link-modal">
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Insert link</Text>
            <Text style={styles.modalLabel}>Display text</Text>
            <TextInput
              testID="pilot-v2-link-text"
              value={linkModal.text}
              onChangeText={(v) => setLinkModal(s => ({ ...s, text: v }))}
              placeholder="Read more"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <Text style={styles.modalLabel}>URL</Text>
            <TextInput
              testID="pilot-v2-link-url"
              autoCapitalize="none"
              autoCorrect={false}
              value={linkModal.url}
              onChangeText={(v) => setLinkModal(s => ({ ...s, url: v }))}
              placeholder="https://example.com"
              placeholderTextColor={colors.textTertiary}
              style={styles.modalInput}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setLinkModal(s => ({ ...s, visible: false }))} style={styles.modalBtnGhost}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="pilot-v2-link-save" onPress={submitLink} style={[styles.modalBtnPrimary, { backgroundColor: '#5B4EFA' }]}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Insert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reminder picker modal */}
      <Modal
        visible={reminderPickerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setReminderPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border }]} testID="pilot-v2-reminder-modal">
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Set a reminder</Text>
            <Text style={[styles.modalLabel, { marginBottom: 12 }]}>Surface this note in your study queue.</Text>
            {[
              { label: 'In 30 minutes', mins: 30 },
              { label: 'In 2 hours',    mins: 120 },
              { label: 'Tomorrow morning (9 AM)', mins: tomorrowMorningMinutes() },
              { label: 'Next week (same time)',   mins: 60 * 24 * 7 },
            ].map(opt => (
              <TouchableOpacity
                key={opt.label}
                testID={`pilot-v2-reminder-${opt.mins}`}
                onPress={() => insertReminder(opt.mins)}
                style={styles.modalListBtn}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setReminderPickerVisible(false)} style={[styles.modalBtnGhost, { alignSelf: 'flex-end', marginTop: 8 }]}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Slash command picker */}
      <Modal
        visible={slashPicker.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setSlashPicker({ visible: false, blockId: null })}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border }]} testID="pilot-v2-slash-modal">
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Insert…</Text>
            {[
              { label: 'Heading 1', action: () => setActiveBlockType('heading', 1) },
              { label: 'Heading 2', action: () => setActiveBlockType('heading', 2) },
              { label: 'Bullet', action: () => setActiveBlockType('bullet') },
              { label: 'Numbered', action: () => setActiveBlockType('numbered') },
              { label: 'Checklist', action: () => setActiveBlockType('checklist') },
              { label: 'Quote', action: () => setActiveBlockType('quote') },
              { label: 'Highlight', action: () => setActiveBlockType('highlight') },
              { label: 'Code', action: () => setActiveBlockType('code') },
              { label: 'Table (2×2)', action: () => addTableBlock(2, 2) },
            ].map(opt => (
              <TouchableOpacity
                key={opt.label}
                onPress={() => {
                  opt.action();
                  setSlashPicker({ visible: false, blockId: null });
                }}
                style={styles.modalListBtn}
              >
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => setSlashPicker({ visible: false, blockId: null })}
              style={[styles.modalBtnGhost, { alignSelf: 'flex-end', marginTop: 8 }]}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Table editor */}
      <Modal
        visible={tableEditor.visible}
        animationType="fade"
        transparent
        onRequestClose={() => setTableEditor({ visible: false, blockId: null, rows: [] })}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, maxWidth: 560 }]} testID="pilot-v2-table-modal">
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit table</Text>
            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 10 }}>
              {tableEditor.rows.map((row, ri) => (
                <View key={ri} style={{ flexDirection: 'row', gap: 8 }}>
                  {row.map((cell, ci) => (
                    <TextInput
                      key={`${ri}_${ci}`}
                      value={cell}
                      onChangeText={(t) => {
                        setTableEditor(s => {
                          const next = s.rows.map(r => [...r]);
                          next[ri][ci] = t;
                          return { ...s, rows: next };
                        });
                      }}
                      placeholder={ri === 0 ? `Header ${ci + 1}` : `Cell`}
                      placeholderTextColor={colors.textTertiary}
                      style={[
                        styles.modalInput,
                        { flex: 1, minWidth: 0, color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity
                onPress={() => {
                  setTableEditor(s => {
                    const cols = s.rows[0]?.length ?? 2;
                    const next = [...s.rows, Array.from({ length: cols }, () => '')];
                    return { ...s, rows: next };
                  });
                }}
                style={[styles.modalBtnGhost, { borderWidth: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>+ Row</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setTableEditor(s => {
                    const next = s.rows.map(r => [...r, '']);
                    return { ...s, rows: next };
                  });
                }}
                style={[styles.modalBtnGhost, { borderWidth: 1, borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>+ Col</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => setTableEditor({ visible: false, blockId: null, rows: [] })}
                style={styles.modalBtnGhost}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={commitTableEditor} style={[styles.modalBtnPrimary, { backgroundColor: '#5B4EFA' }]}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block edit sheet (rich editor for selected block only) */}
      <Modal
        visible={blockEditSheet.visible}
        animationType="slide"
        transparent
        onRequestClose={() => setBlockEditSheet({ visible: false, blockId: null, body: '' })}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, maxWidth: 760, maxHeight: '86%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit block</Text>
              <TouchableOpacity onPress={() => setBlockEditSheet({ visible: false, blockId: null, body: '' })}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' }}>
              <RichToolbar
                getEditor={() => blockEditRef.current}
                selectedIconTint="#5B4EFA"
                iconTint={colors.textPrimary}
                style={{ backgroundColor: colors.surfaceStrong, height: 42 }}
                actions={[
                  actions.setBold,
                  actions.setItalic,
                  actions.setUnderline,
                  actions.heading1,
                  actions.heading2,
                  actions.insertBulletsList,
                  actions.insertOrderedList,
                ]}
              />
              <View style={{ height: 360 }}>
                <RichNoteEditor
                  key={`block-edit-${blockEditKey}`}
                  ref={blockEditRef}
                  html={blockEditSheet.body}
                  onChange={(v) => setBlockEditSheet((s) => ({ ...s, body: v }))}
                  themeColors={{
                    bg: colors.surfaceStrong,
                    surface: colors.surface,
                    textPrimary: colors.textPrimary,
                    border: colors.border,
                    primary: '#5B4EFA',
                  }}
                  editorStyle={{ minHeight: 340 }}
                  placeholder="Edit this block with full formatting."
                />
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setBlockEditSheet({ visible: false, blockId: null, body: '' })} style={styles.modalBtnGhost}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyBlockEditSheet} style={[styles.modalBtnPrimary, { backgroundColor: '#5B4EFA' }]} disabled={blockEditSaving}>
                {blockEditSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Apply to Block</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Pencil mode FAB ─────────────────────────────────────────── */}
      <AnimatedReanimated.View style={[{ position: 'absolute', zIndex: 1100, right: 18, bottom: 80 }, pencilFabAnimatedStyle]}>
        <GestureDetector gesture={pencilPanGesture}>
          <TouchableOpacity
            testID="pilot-v2-pencil-fab"
            onPress={() => {
              console.log('[PENCIL FAB] Current drawingMode:', pencil.drawingMode);
              pencil.setDrawingMode(!pencil.drawingMode);
              console.log('[PENCIL FAB] Set drawingMode to:', !pencil.drawingMode);
            }}
            activeOpacity={0.85}
            style={[
              styles.pencilFab, 
              pencil.drawingMode && { backgroundColor: '#0F172A' },
              // Explicitly override positioning since outer container handles it now
              { position: 'relative', right: 0, bottom: 0 }
            ]}
          >
            <Pen size={22} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>
        </GestureDetector>
      </AnimatedReanimated.View>

      {/* ── Quick formatting toolbar toggle (bottom-right) ─────────── */}
      <TouchableOpacity
        testID="pilot-v2-formatting-fab"
        onPress={() => setShowToolbar((v) => {
          globalToolbarVisible = !v;
          return !v;
        })}
        activeOpacity={0.85}
        style={[
          styles.pencilFab,
          {
            right: 18,
            bottom: 148,
            backgroundColor: showToolbar ? '#0F172A' : '#5B4EFA',
          },
        ]}
      >
        <Type size={22} color="#ffffff" strokeWidth={2.5} />
      </TouchableOpacity>

      {/* ── Washi-Tape FAB (active recall masking) ──────────────────── */}
      <TouchableOpacity
        testID="pilot-v2-washi-fab"
        onPress={() => setWashiMode((m) => !m)}
        activeOpacity={0.85}
        style={[
          styles.pencilFab,
          { right: 88, backgroundColor: washiMode ? '#0F172A' : '#FFE88A' },
        ]}
      >
        <Text style={{ fontSize: 20 }}>{washiMode ? '🛑' : '🩹'}</Text>
      </TouchableOpacity>

      {/* Washi-Tape control panel (only while in tape mode) */}
      {washiMode ? (
        <View
          testID="pilot-v2-washi-controls"
          style={{
            position: 'absolute', bottom: 88, right: 16,
            backgroundColor: '#fff', borderRadius: 14, padding: 10,
            borderWidth: 1, borderColor: '#E5E7EB',
            shadowColor: '#000', shadowOpacity: 0.08,
            shadowOffset: { width: 0, height: 4 }, shadowRadius: 10,
            elevation: 4, gap: 6,
          }}
        >
          <Text style={{ fontSize: 11, color: '#475569', fontWeight: '700' }}>
            TAPE COLOR
          </Text>
          <WashiTapeColorPicker active={washiColor} onChange={setWashiColor} />
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
            <TouchableOpacity
              testID="pilot-v2-washi-show-all"
              onPress={() => persistWashi(setAllRevealed(washiTapes, true))}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#0F172A' }}
            >
              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>Show all</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="pilot-v2-washi-hide-all"
              onPress={() => persistWashi(setAllRevealed(washiTapes, false))}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#5B4EFA' }}
            >
              <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>Hide all</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
            Drag to place tape · Tap to reveal · Long-press to remove
          </Text>
        </View>
      ) : null}

      {/* ── Notability-style pencil toolbar (only when drawing) ─── */}
      {pencil.drawingMode && (
        <View style={styles.pencilToolbarFloat} pointerEvents="box-none">
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
        </View>
      )}

      {/* ── More menu w/ working Export ────────────────────────────── */}
      <Modal visible={moreMenuOpen} animationType="fade" transparent onRequestClose={() => setMoreMenuOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setMoreMenuOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.35)' }}>
          <View style={[styles.moreMenu, { borderColor: colors.border, backgroundColor: '#fff' }]} testID="pilot-v2-more-menu">
            {[
              { label: 'Export…', sub: 'PDF · pastel themes · choose blocks', testID: 'pilot-v2-more-export', onPress: () => { setMoreMenuOpen(false); setExportSheetOpen(true); } },
              { label: `Text Size: ${Math.round(fontScale * 100)}%`, sub: 'Tap to increase text scale (cycles)', testID: 'pilot-v2-more-fontscale', onPress: () => { cycleFontScale(); } },
              { label: `Zoom Level: ${Math.round(zoom * 100)}%`, sub: 'Tap to change canvas zoom (cycles)', testID: 'pilot-v2-more-zoom', onPress: () => { cycleZoom(); } },
              { label: showToolbar ? 'Hide Formatting Toolbar' : 'Show Formatting Toolbar', sub: 'Draggable rich formatting bar', testID: 'pilot-v2-more-toolbar', onPress: () => { setShowToolbar(v => { globalToolbarVisible = !v; return !v; }); } },
            ].map(item => (
              <TouchableOpacity key={item.label} testID={item.testID} onPress={item.onPress} style={styles.moreItem}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{item.label}</Text>
                {item.sub ? <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{item.sub}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      {/* ── Unified Export sheet (single, replaces all legacy export entry-points) ── */}
      <PilotV2UnifiedExport
        visible={exportSheetOpen}
        onClose={() => setExportSheetOpen(false)}
        title={title || 'Pilot V2 Note'}
        blocks={blocks}
        strokes={pencil.engine.getPersisted()}
        pageWidth={paperSize.w}
        pageHeight={paperSize.h}
        contentRef={contentRef}
      />

      {/* ── Per-block rich-text edit modal (full formatting toolbar) ── */}
      <PilotV2BlockRichEditModal
        visible={richBlockEdit.visible}
        initialHtml={richBlockEdit.html}
        onClose={() => setRichBlockEdit({ visible: false, blockId: null, html: '' })}
        onSave={(html) => {
          if (richBlockEdit.blockId) {
            updateBlock(richBlockEdit.blockId, { text: html });
          }
          setRichBlockEdit({ visible: false, blockId: null, html: '' });
        }}
      />
    </KeyboardAvoidingView>
  );
}

/* ---------- Block row ---------- */
interface BlockRowProps {
  block: PilotV2Block;
  colors: any;
  fontScale: number;
  isActive: boolean;
  onFocus: () => void;
  onChange: (text: string) => void;
  onToggleCheck: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEditTable: () => void;
  /** Opens the rich-editor modal for this block (full formatting toolbar). */
  onOpenRichEdit: () => void;
  /** Called when the block's layout changes — used for block-level anchoring. */
  onBlockLayout: (id: string, x: number, y: number, w: number, h: number) => void;
}

function BlockRow({ block, colors, fontScale, isActive, onFocus, onChange, onToggleCheck, onDelete, onMoveUp, onMoveDown, onEditTable, onOpenRichEdit, onBlockLayout }: BlockRowProps) {
  const { width } = useWindowDimensions();
  const baseFs = block.type === 'heading'
    ? block.level === 1 ? 24 : 18
    : 16;
  const fontSize = Math.round(baseFs * fontScale);
  const fontWeight: any = (block.type === 'heading' || block.bold) ? '700' : '400';
  const fontStyle: any = block.italic ? 'italic' : 'normal';

  const decorations: string[] = [];
  if (block.type === 'checklist' && block.checked) decorations.push('line-through');
  if (block.underline) decorations.push('underline');
  const textDecorationLine: any = decorations.length === 2
    ? 'underline line-through'
    : (decorations[0] ?? 'none');

  const highlightBg = block.type === 'highlight'
    ? PILOT_V2_HIGHLIGHT_PALETTE.find(c => c.name === block.highlightColor)?.bg ?? '#FDE68A'
    : 'transparent';

  // Step 8 — block-tag badge ("Added by quiz import" etc.)
  const tag = getBlockTag(block);

  return (
    <View
      onLayout={(e) => {
        const { x, y, width: w, height: h } = e.nativeEvent.layout;
        onBlockLayout(block.id, x, y, w, h);
      }}
      style={[
        styles.blockRow,
        isActive ? {
          backgroundColor: '#F9FAFB',
          borderLeftWidth: 4,
          borderLeftColor: '#5B4EFA',
          paddingLeft: 4,
        } : null,
        { flexDirection: 'column' }
      ]}
    >
      {tag ? (
        <View
          testID={`pilot-v2-block-tag-${block.id}`}
          style={{
            position: 'absolute',
            top: -8,
            left: 8,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 8,
            backgroundColor: tag.color,
            zIndex: 5,
          }}
        >
          <Text style={{ fontSize: 9, color: '#fff', fontWeight: '700', letterSpacing: 0.4 }}>
            {tag.label.toUpperCase()}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', width: '100%', alignItems: 'flex-start', gap: 8 }}>
        {block.type === 'bullet' && <Text style={[styles.lead, { color: colors.textPrimary }]}>•</Text>}
      {block.type === 'numbered' && <Text style={[styles.lead, { color: colors.textPrimary, fontWeight: '600' }]}>1.</Text>}
      {block.type === 'checklist' && (
        <TouchableOpacity onPress={onToggleCheck} hitSlop={6} style={[
          styles.check, {
            borderColor: colors.border,
            backgroundColor: block.checked ? '#5B4EFA' : 'transparent',
          },
        ]} />
      )}
      {block.type === 'quote' && <View style={[styles.quoteBar, { backgroundColor: '#5B4EFA' }]} />}

      <View style={{ flex: 1, backgroundColor: highlightBg, borderRadius: 6, paddingHorizontal: highlightBg === 'transparent' ? 0 : 6 }}>
        {block.imageBase64 || block.imageUri ? (
          <Image
            testID={`pilot-v2-block-image-${block.id}`}
            source={{ uri: (block.imageBase64 ?? block.imageUri) as string }}
            style={styles.blockImage}
          />
        ) : null}

        {block.tableRows?.length ? (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => { onFocus(); onEditTable(); }}
            style={[styles.blockTableWrap, { borderColor: '#E5E7EB' }]}
            testID={`pilot-v2-block-table-${block.id}`}
          >
            {block.tableRows.map((row, ri) => (
              <View key={ri} style={styles.blockTableRow}>
                {row.map((cell, ci) => (
                  <Text
                    key={ci}
                    style={[styles.blockTableCell, ri === 0 && { fontWeight: '700', backgroundColor: '#F9FAFB' }]}
                    numberOfLines={2}
                  >
                    {cell || ' '}
                  </Text>
                ))}
              </View>
            ))}
            {isActive ? (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', padding: 8, gap: 8 }}>
                <View style={{ flex: 1 }} />
                <Edit3 size={14} color={colors.textTertiary} />
                <Text style={{ fontSize: 12, color: colors.textTertiary, fontWeight: '600' }}>Tap to edit</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ) : null}

        {!block.tableRows?.length && !(block.imageBase64 || block.imageUri) ? (
          isActive ? (
            <TextInput
              testID={`pilot-v2-block-${block.id}`}
              multiline
              value={stripHtml(block.text)}
              onChangeText={(text) => onChange(preserveHtmlWrap(block.text, text))}
              onFocus={onFocus}
              placeholder={block.type === 'heading' ? 'Heading…' : 'Type something…'}
              placeholderTextColor={colors.textTertiary}
              style={{
                fontSize,
                fontWeight,
                fontStyle,
                color: block.link ? '#5B4EFA' : colors.textPrimary,
                lineHeight: fontSize === 24 ? 32 : fontSize === 18 ? 26 : 24,
                paddingVertical: 4,
                textDecorationLine: block.link ? 'underline' : textDecorationLine,
              }}
            />
          ) : (
            <TouchableOpacity
              onPress={() => { onFocus(); }}
              activeOpacity={0.8}
              style={{ paddingVertical: 4 }}
            >
              <RenderHtml
                source={{ html: block.text || '<i>Type something…</i>' }}
                contentWidth={width - 80}
                baseStyle={{
                  color: block.link ? '#5B4EFA' : colors.textPrimary,
                  fontSize,
                  fontWeight,
                  fontStyle,
                  lineHeight: fontSize === 24 ? 32 : fontSize === 18 ? 26 : 24,
                }}
                tagsStyles={{
                  b: { fontWeight: 'bold' as const, color: colors.textPrimary },
                  strong: { fontWeight: 'bold' as const, color: colors.textPrimary },
                  i: { fontStyle: 'italic' as const },
                  em: { fontStyle: 'italic' as const },
                  p: { color: colors.textPrimary, marginVertical: 0 },
                  mark: { backgroundColor: '#FFE066', color: '#000', paddingHorizontal: 2, borderRadius: 3 },
                }}
              />
            </TouchableOpacity>
          )
        ) : null}

        {block.link ? (
          <TouchableOpacity
            testID={`pilot-v2-block-link-open-${block.id}`}
            onPress={() => Linking.openURL(block.link as string).catch(() => Alert.alert('Could not open', block.link as string))}
            style={{ paddingTop: 4 }}
          >
            <Text style={{ fontSize: 11, color: '#5B4EFA' }}>↗ Open {block.link}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 2, alignSelf: 'flex-end', marginTop: 4, marginRight: 8, opacity: isActive ? 1 : 0.35 }}>
        <TouchableOpacity testID={`pilot-v2-block-richedit-${block.id}`} onPress={onOpenRichEdit} hitSlop={6} style={styles.iconBtn}>
          <Edit3 size={14} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity testID={`pilot-v2-block-moveup-${block.id}`} onPress={onMoveUp} hitSlop={6} style={styles.iconBtn}>
          <ArrowUp size={14} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity testID={`pilot-v2-block-movedown-${block.id}`} onPress={onMoveDown} hitSlop={6} style={styles.iconBtn}>
          <ArrowDown size={14} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity testID={`pilot-v2-block-delete-${block.id}`} onPress={onDelete} hitSlop={6} style={styles.iconBtn}>
          <Trash2 size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}


/* ---------- Floating draggable formatting toolbar ---------- */
function FloatingToolbar(props: any) {
  const { colors, showHighlightPicker, activeHighlight, onApplyHighlight, isMarkActive } = props;
  const { width, height } = useWindowDimensions();
  const pos = useRef(new Animated.ValueXY(globalToolbarPos)).current;
  const [collapsed, setCollapsed] = useState(false);
  const [vertical, setVertical] = useState(false);

  const lastPos = useRef({ x: 0, y: 0 });
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6,
    onPanResponderGrant: () => {
      lastPos.current = { x: (pos.x as any)._value, y: (pos.y as any)._value };
    },
    onPanResponderMove: (_, g) => {
      const x = Math.min(Math.max(8, lastPos.current.x + g.dx), width - 80);
      const y = Math.min(Math.max(44, lastPos.current.y + g.dy), height - 80);
      pos.setValue({ x, y });
    },
    onPanResponderRelease: () => {
      const x = (pos.x as any)._value;
      const y = (pos.y as any)._value;
      // Snap to nearest edge — auto-orient horizontal vs vertical
      const distLeft = x;
      const distRight = width - x;
      const distTop = y;
      const distBottom = height - y;
      const min = Math.min(distLeft, distRight, distTop, distBottom);
      let nextX = x, nextY = y, isVert = false;
      if (min === distLeft)        { nextX = 8;  isVert = true; }
      else if (min === distRight)  { nextX = width - 68; isVert = true; }
      else if (min === distTop)    { nextY = 64; isVert = false; }
      else                          { nextY = height - 96; isVert = false; }
      globalToolbarPos = { x: nextX, y: nextY };
      Animated.spring(pos, {
        toValue: { x: nextX, y: nextY },
        useNativeDriver: false,
        tension: 60,
        friction: 8,
      }).start();
      setVertical(isVert);
    },
  })).current;

  const items = [
    { label: 'H1', onPress: props.onH1, type: 'text' },
    { label: 'H2', onPress: props.onH2, type: 'text' },
    { Icon: Bold, onPress: props.onBold, active: isMarkActive('bold'), testID: 'pilot-v2-tool-bold' },
    { Icon: Italic, onPress: props.onItalic, active: isMarkActive('italic'), testID: 'pilot-v2-tool-italic' },
    { Icon: UnderlineIcon, onPress: props.onUnderline, active: isMarkActive('underline'), testID: 'pilot-v2-tool-underline' },
    { Icon: List, onPress: props.onUL, testID: 'pilot-v2-tool-ul' },
    { Icon: ListOrdered, onPress: props.onOL, testID: 'pilot-v2-tool-ol' },
    { Icon: ListTodo, onPress: props.onCheck, testID: 'pilot-v2-tool-checklist' },
    { Icon: Quote, onPress: props.onQuote, testID: 'pilot-v2-tool-quote' },
    { Icon: Highlighter, onPress: props.onHighlight, testID: 'pilot-v2-tool-highlight' },
    { Icon: LinkIcon, onPress: props.onLink, testID: 'pilot-v2-tool-link' },
    { Icon: ImageIcon, onPress: props.onImage, testID: 'pilot-v2-tool-image' },
    { Icon: Paperclip, onPress: props.onAttach, testID: 'pilot-v2-tool-attachment' },
    { Icon: TableIcon, onPress: props.onTable, testID: 'pilot-v2-tool-table' },
    { Icon: Code, onPress: props.onCode, testID: 'pilot-v2-tool-code' },
  ];

  return (
    <Animated.View
      testID="pilot-v2-floating-toolbar"
      style={[
        styles.floatingToolbar,
        {
          flexDirection: vertical ? 'column' : 'row',
          transform: pos.getTranslateTransform(),
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderColor: colors.border,
        },
      ]}
      {...pan.panHandlers}
    >
      <TouchableOpacity onPress={() => setCollapsed(c => !c)} style={styles.dragHandle} testID="pilot-v2-toolbar-collapse">
        <Text style={{ color: colors.textTertiary, fontSize: 14, fontWeight: '700' }}>{collapsed ? '⋮' : '⋯'}</Text>
      </TouchableOpacity>
      {!collapsed && items.map((it: any, i: number) => (
        it.type === 'text' ? (
          <TouchableOpacity key={i} onPress={it.onPress} style={styles.floatBtn}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary }}>{it.label}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity key={i} testID={it.testID} onPress={it.onPress} style={[styles.floatBtn, it.active && { backgroundColor: '#EEECFF' }]}>
            <it.Icon size={18} color={it.active ? '#5B4EFA' : colors.textSecondary} />
          </TouchableOpacity>
        )
      ))}
      {!collapsed && showHighlightPicker && (
        <View style={[styles.highlightPicker, { backgroundColor: '#fff', borderColor: colors.border, top: vertical ? 0 : 52, left: vertical ? 52 : 0 }]}>
          {PILOT_V2_HIGHLIGHT_PALETTE.map(c => (
            <TouchableOpacity
              key={c.name}
              testID={`pilot-v2-highlight-${c.name.toLowerCase()}`}
              onPress={() => onApplyHighlight(c.name)}
              style={[styles.swatch, { backgroundColor: c.bg, borderWidth: activeHighlight === c.name ? 2 : 0, borderColor: '#5B4EFA' }]}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/* ---------- Toolbar atoms ---------- */
const ToolbarTextBtn = ({ label, onPress, colors }: any) => (
  <TouchableOpacity onPress={onPress} style={styles.toolBtn}>
    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
  </TouchableOpacity>
);
const ToolbarIconBtn = ({ Icon, onPress, colors, testID, active }: any) => (
  <TouchableOpacity testID={testID} onPress={onPress} style={[styles.toolBtn, active && { backgroundColor: '#EEECFF' }]}>
    <Icon size={16} color={active ? '#5B4EFA' : colors.textSecondary} />
  </TouchableOpacity>
);
const Divider = ({ colors }: any) => <View style={[styles.toolDivider, { backgroundColor: colors.border }]} />;
const OutlineTab = ({ label, active, onPress }: any) => (
  <TouchableOpacity onPress={onPress} style={[styles.outlineTab, active && { borderBottomColor: '#5B4EFA' }]}>
    <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#5B4EFA' : '#6B7280' }}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12, borderBottomWidth: 1 },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 8, borderRadius: 8 },
  savedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },

  titleSection: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 8, gap: 4, position: 'relative' },
  titleInput: { fontSize: 28, fontWeight: '700', padding: 0, lineHeight: 38 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  toolBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  toolDivider: { width: 1, height: 24, marginHorizontal: 4 },
  swatch: { width: 18, height: 18, borderRadius: 4 },
  highlightPicker: {
    position: 'absolute', marginTop: 4,
    flexDirection: 'row', gap: 6, padding: 8, borderRadius: 8, borderWidth: 1, zIndex: 1000,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  floatingBack: {
    position: 'absolute', top: 18, left: 18, zIndex: 1000,
    width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  floatingControls: {
    position: 'absolute', top: 18, right: 18, zIndex: 1000,
    flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 26, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  floatingToolbar: {
    position: 'absolute', zIndex: 1100,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    paddingHorizontal: 8, paddingVertical: 8, borderRadius: 18, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  floatBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, marginHorizontal: 1 },
  dragHandle: { width: 40, height: 26, alignItems: 'center', justifyContent: 'center' },
  moreMenu: {
    position: 'absolute', top: 64, right: 16, minWidth: 240,
    borderRadius: 14, borderWidth: 1, paddingVertical: 6,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  moreItem: { paddingVertical: 10, paddingHorizontal: 14 },

  canvas: { padding: 24, paddingBottom: 80 },
  paper: {
    padding: 28, borderRadius: 12, borderWidth: 0, gap: 8, maxWidth: 1100, alignSelf: 'center', width: '100%',
    backgroundColor: '#ffffff',
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
  },
  blockRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  lead: { width: 18, fontSize: 16, lineHeight: 24, paddingTop: 4 },
  check: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, marginTop: 6 },
  quoteBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  addBlockRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 14, marginTop: 10, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center',
  },

  outlinePanel: { width: 340, borderLeftWidth: 1, flexDirection: 'column', backgroundColor: '#fff' },
  outlineTabs: { flexDirection: 'row', borderBottomWidth: 1 },
  outlineTab: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
  outlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },

  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 14, borderTopWidth: 1 },
  bottomItem: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    width: '100%', maxWidth: 460, backgroundColor: '#fff',
    borderRadius: 16, borderWidth: 1, padding: 20, gap: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 6 },
  modalInput: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0F172A',
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  modalBtnGhost: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  modalBtnPrimary: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  modalListBtn: {
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10,
    backgroundColor: '#F3F4F6', marginTop: 6,
  },
  blockImage: {
    width: '100%', minHeight: 160, borderRadius: 10,
    backgroundColor: '#0F172A', resizeMode: 'cover',
  },
  blockLink: { color: '#5B4EFA', textDecorationLine: 'underline' },
  blockTableWrap: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  blockTableRow: { flexDirection: 'row' },
  blockTableCell: {
    flex: 1, padding: 8, fontSize: 13, color: '#0F172A',
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB',
  },
  pencilFab: {
    position: 'absolute', right: 18, bottom: 80,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#5B4EFA', zIndex: 1100,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  pencilToolbarFloat: {
    position: 'absolute', bottom: 80, alignSelf: 'center', zIndex: 1200,
  },
});
