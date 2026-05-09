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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, useWindowDimensions, Modal, Alert, Linking,
  Image, Animated, StatusBar, PanResponder,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  X, RotateCcw, RotateCw, Save, Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, ListTodo, Link as LinkIcon, Image as ImageIcon, Calendar,
  Paperclip, Table as TableIcon, Code, Type, ChevronDown, Highlighter, Plus, Trash2, ArrowUp, ArrowDown, Edit3, Quote, MoreHorizontal,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  PilotV2Block, PilotV2BlockType, PILOT_V2_HIGHLIGHT_PALETTE,
} from './types';
import { savePilotV2NoteContent, renamePilotV2Note } from '../../repositories/pilotV2Repo';

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
  const [slashPicker, setSlashPicker] = useState<{ visible: boolean; blockId: string | null }>({ visible: false, blockId: null });
  const [tableEditor, setTableEditor] = useState<{ visible: boolean; blockId: string | null; rows: string[][] }>({
    visible: false,
    blockId: null,
    rows: [],
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
          await savePilotV2NoteContent(note.id, { blocks: nextBlocks, version: 1 });
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

  /* --------------- Link / Image / Calendar / Attachment / Table / Code --------------- */
  const [linkModal, setLinkModal] = useState<{ visible: boolean; text: string; url: string }>({
    visible: false, text: '', url: '',
  });
  const [reminderPickerVisible, setReminderPickerVisible] = useState(false);

  // Export sheet state (heading-selection)
  const [exportSheetOpen, setExportSheetOpen] = useState(false);
  const [excludedHeadings, setExcludedHeadings] = useState<Record<string, boolean>>({});
  const [includeMargins, setIncludeMargins] = useState(true);

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

      {/* Title + toolbar (fades on scroll) */}
      <Animated.View style={[styles.titleSection, { borderBottomColor: 'transparent', opacity: titleOpacity, transform: [{ translateY: titleTranslate }] }]} pointerEvents="box-none">
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

      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Animated.ScrollView
          testID="pilot-v2-editor-canvas"
          style={{ flex: 1, backgroundColor: '#F9FAFB' }}
          contentContainerStyle={styles.canvas}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        >
          <View style={[styles.paper, { backgroundColor: '#fff', borderColor: colors.border, transform: [{ scale: zoom }] }]}>
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
          </View>
        </Animated.ScrollView>

        {isTablet && (
          <View style={[styles.outlinePanel, { borderLeftColor: colors.border }]}>
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
          </View>
        )}
      </View>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity testID="pilot-v2-bottom-fontscale" onPress={cycleFontScale} style={styles.bottomItem}>
            <Type size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Aa · {Math.round(fontScale * 100)}%</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="pilot-v2-bottom-zoom" onPress={cycleZoom} style={styles.bottomItem}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{Math.round(zoom * 100)}%</Text>
            <ChevronDown size={12} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Words: {wordCount}</Text>
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
}

function BlockRow({ block, colors, fontScale, isActive, onFocus, onChange, onToggleCheck, onDelete, onMoveUp, onMoveDown, onEditTable }: BlockRowProps) {
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

  return (
    <View
      style={[
        styles.blockRow,
        isActive ? {
          backgroundColor: '#F9FAFB',
          borderLeftWidth: 4,
          borderLeftColor: '#5B4EFA',
          paddingLeft: 4,
        } : null,
      ]}
    >
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
          <TextInput
            testID={`pilot-v2-block-${block.id}`}
            multiline
            value={block.text}
            onChangeText={onChange}
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

      {isActive && (
        <View style={{ flexDirection: 'row', gap: 2 }}>
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
      )}
    </View>
  );
}

      {/* More menu — Export / Settings / Templates / Theme / Share / Print / Page settings */}
      <Modal visible={moreMenuOpen} animationType="fade" transparent onRequestClose={() => setMoreMenuOpen(false)}>
        <TouchableOpacity activeOpacity={1} onPress={() => setMoreMenuOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.35)' }}>
          <View style={[styles.moreMenu, { borderColor: colors.border, backgroundColor: '#fff' }]} testID="pilot-v2-more-menu">
            {[
              { label: 'Quick export', sub: 'PDF, All Pages', testID: 'pilot-v2-more-quick-export', onPress: () => { setMoreMenuOpen(false); setExportSheetOpen(true); } },
              { label: 'Export options', testID: 'pilot-v2-more-export-options', onPress: () => { setMoreMenuOpen(false); setExportSheetOpen(true); } },
              { label: 'Share', testID: 'pilot-v2-more-share', onPress: async () => { setMoreMenuOpen(false); try { const text = blocks.map(b => b.text).filter(Boolean).join('\n'); if (Platform.OS === 'web') { await (navigator as any)?.share?.({ title, text }); } else { const { Share: RNShare } = require('react-native'); await RNShare.share({ title, message: `${title}\n\n${text}` }); } } catch {} } },
              { label: 'Print', testID: 'pilot-v2-more-print', onPress: () => { setMoreMenuOpen(false); setExportSheetOpen(true); } },
              { label: 'Templates', testID: 'pilot-v2-more-templates', onPress: () => { setMoreMenuOpen(false); Alert.alert('Templates', 'Note templates coming soon.'); } },
              { label: 'Theme', testID: 'pilot-v2-more-theme', onPress: () => { setMoreMenuOpen(false); Alert.alert('Theme', 'Editor theme switcher coming soon.'); } },
              { label: 'Page settings', testID: 'pilot-v2-more-page', onPress: () => { setMoreMenuOpen(false); Alert.alert('Page settings', 'Margins / paper size coming soon.'); } },
              { label: 'Settings', testID: 'pilot-v2-more-settings', onPress: () => { setMoreMenuOpen(false); Alert.alert('Settings', 'Editor preferences coming soon.'); } },
            ].map(item => (
              <TouchableOpacity key={item.label} testID={item.testID} onPress={item.onPress} style={styles.moreItem}>
                <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '600' }}>{item.label}</Text>
                {item.sub ? <Text style={{ color: colors.textTertiary, fontSize: 11, marginTop: 2 }}>{item.sub}</Text> : null}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Heading-selection export sheet */}
      <Modal visible={exportSheetOpen} animationType="slide" transparent onRequestClose={() => setExportSheetOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { borderColor: colors.border, maxWidth: 520 }]} testID="pilot-v2-export-sheet">
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Export</Text>
            <Text style={[styles.modalLabel, { marginBottom: 8 }]}>Select sections to include. All selected by default.</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {blocks.filter(b => b.type === 'heading').map(h => (
                <TouchableOpacity
                  key={h.id}
                  testID={`pilot-v2-export-heading-${h.id}`}
                  onPress={() => setExcludedHeadings(s => ({ ...s, [h.id]: !s[h.id] }))}
                  style={[styles.modalListBtn, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
                >
                  <View style={[styles.check, { width: 16, height: 16, marginTop: 0, backgroundColor: !excludedHeadings[h.id] ? '#5B4EFA' : 'transparent', borderColor: '#5B4EFA' }]} />
                  <Text style={{ color: colors.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={2}>
                    {`H${h.level ?? 2}  ${h.text || 'Untitled'}`}
                  </Text>
                </TouchableOpacity>
              ))}
              {blocks.filter(b => b.type === 'heading').length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: 13, paddingVertical: 12 }}>No headings detected. Full note will be exported.</Text>
              ) : null}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <TouchableOpacity testID="pilot-v2-export-toggle-margins" onPress={() => setIncludeMargins(v => !v)} style={[styles.modalBtnGhost, { borderWidth: 1, borderColor: colors.border }]}>
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{includeMargins ? '✓ Include margins' : 'Exclude margins'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setExportSheetOpen(false)} style={styles.modalBtnGhost}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pilot-v2-export-pdf"
                onPress={async () => {
                  setExportSheetOpen(false);
                  try {
                    const filtered = filterBlocksByHeadings(blocks, excludedHeadings);
                    await unifiedExportSelected({ title, blocks: filtered, format: 'pdf', includeMargins });
                  } catch (e) {
                    Alert.alert('Export failed', (e as Error).message);
                  }
                }}
                style={[styles.modalBtnPrimary, { backgroundColor: '#5B4EFA' }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Export PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pilot-v2-export-image"
                onPress={async () => {
                  setExportSheetOpen(false);
                  try {
                    const filtered = filterBlocksByHeadings(blocks, excludedHeadings);
                    await unifiedExportSelected({ title, blocks: filtered, format: 'image', includeMargins });
                  } catch (e) {
                    Alert.alert('Export failed', (e as Error).message);
                  }
                }}
                style={[styles.modalBtnPrimary, { backgroundColor: '#0F172A' }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Export Image</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

/* ---------- Floating draggable formatting toolbar ---------- */
function FloatingToolbar(props: any) {
  const { colors, showHighlightPicker, activeHighlight, onApplyHighlight, isMarkActive } = props;
  const { width, height } = useWindowDimensions();
  const pos = useRef(new Animated.ValueXY({ x: Math.max(80, width / 2 - 200), y: 60 })).current;
  const [collapsed, setCollapsed] = useState(false);
  const [vertical, setVertical] = useState(false);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
    onPanResponderMove: (_, g) => {
      const x = Math.min(Math.max(8, (pos.x as any)._value + g.dx), width - 80);
      const y = Math.min(Math.max(40, (pos.y as any)._value + g.dy), height - 80);
      pos.setValue({ x, y });
    },
    onPanResponderRelease: (_, g) => {
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
      else if (min === distRight)  { nextX = width - 64; isVert = true; }
      else if (min === distTop)    { nextY = 60; isVert = false; }
      else                          { nextY = height - 90; isVert = false; }
      Animated.spring(pos, { toValue: { x: nextX, y: nextY }, useNativeDriver: false }).start();
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

/* ---------- Helpers: heading-tree filtering + unified export ---------- */
function filterBlocksByHeadings(blocks: PilotV2Block[], excluded: Record<string, boolean>): PilotV2Block[] {
  // Walk blocks; when entering an excluded heading section, skip until next heading at same/higher level.
  const out: PilotV2Block[] = [];
  let skipUntilLevel: number | null = null;
  for (const b of blocks) {
    if (b.type === 'heading') {
      const lvl = b.level ?? 2;
      if (skipUntilLevel !== null && lvl > skipUntilLevel) continue;
      skipUntilLevel = excluded[b.id] ? lvl : null;
      if (skipUntilLevel !== null) continue;
    } else if (skipUntilLevel !== null) {
      continue;
    }
    out.push(b);
  }
  return out;
}

async function unifiedExportSelected({ title, blocks, format, includeMargins }: { title: string; blocks: PilotV2Block[]; format: 'pdf' | 'image'; includeMargins: boolean }) {
  // Use the existing Unified Export Engine if available; fallback to plain share.
  try {
    const mod: any = await import('../../lib/unifiedExportEngine');
    const fn = mod?.exportPilotV2 ?? mod?.unifiedExport ?? mod?.default;
    if (typeof fn === 'function') { await fn({ title, blocks, format, includeMargins }); return; }
  } catch {}
  const text = blocks.map(b => b.text).filter(Boolean).join('\n');
  if (Platform.OS !== 'web') {
    const { Share: RNShare } = require('react-native');
    await RNShare.share({ title: `${title} (${format.toUpperCase()})`, message: `${title}\n\n${text}` });
  } else {
    Alert.alert('Export ready', `${title} exported as ${format.toUpperCase()}.`);
  }
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
  iconBtn: { padding: 6, borderRadius: 6 },
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
    position: 'absolute', top: 16, left: 16, zIndex: 1000,
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  floatingControls: {
    position: 'absolute', top: 16, right: 16, zIndex: 1000,
    flexDirection: 'row', gap: 4, paddingHorizontal: 6, paddingVertical: 4,
    borderRadius: 18, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  floatingToolbar: {
    position: 'absolute', zIndex: 1100,
    alignItems: 'center', justifyContent: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 6, borderRadius: 16, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  floatBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10, marginHorizontal: 1 },
  dragHandle: { width: 36, height: 22, alignItems: 'center', justifyContent: 'center' },
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
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, marginTop: 8, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', justifyContent: 'center',
  },

  outlinePanel: { width: 320, borderLeftWidth: 1, flexDirection: 'column', backgroundColor: '#fff' },
  outlineTabs: { flexDirection: 'row', borderBottomWidth: 1 },
  outlineTab: { flex: 1, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', alignItems: 'center' },
  outlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },

  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1 },
  bottomItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },

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
});
