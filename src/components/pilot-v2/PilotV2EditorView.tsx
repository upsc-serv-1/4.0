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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  X, RotateCcw, RotateCw, Save, Bold, Italic, Underline as UnderlineIcon,
  List, ListOrdered, ListTodo, Link as LinkIcon, Image as ImageIcon, Calendar,
  Paperclip, Table as TableIcon, Code, Type, ChevronDown, Highlighter, Plus, Trash2,
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
  const [blocks, setBlocks] = useState<PilotV2Block[]>(
    note?.content?.blocks?.length ? note.content.blocks : DEFAULT_BLOCKS
  );
  const [activeBlockId, setActiveBlockId] = useState<string | null>(blocks[0]?.id ?? null);
  const [showHighlightPicker, setShowHighlightPicker] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState('Yellow');
  const [outlineTab, setOutlineTab] = useState<'blocks' | 'outline'>('blocks');
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved'>('saved');
  const saveTimer = useRef<any>(null);

  /* ---------------- Undo / Redo history stacks ---------------- */
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

  /* --------------- Link / Image / Calendar / Attachment / Table / Code --------------- */
  const [linkModal, setLinkModal] = useState<{ visible: boolean; text: string; url: string }>({
    visible: false, text: '', url: '',
  });
  const [reminderPickerVisible, setReminderPickerVisible] = useState(false);

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: '#fff' }}
      testID="pilot-v2-editor"
    >
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
        <View style={styles.topLeft}>
          <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
            {title || 'Untitled'}
          </Text>
          <TouchableOpacity
            testID="pilot-v2-tool-undo"
            onPress={handleUndo}
            disabled={undoStack.current.length === 0}
            style={[styles.iconBtn, { opacity: undoStack.current.length === 0 ? 0.35 : 1 }]}
          >
            <RotateCcw size={16} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="pilot-v2-tool-redo"
            onPress={handleRedo}
            disabled={redoStack.current.length === 0}
            style={[styles.iconBtn, { opacity: redoStack.current.length === 0 ? 0.35 : 1 }]}
          >
            <RotateCw size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <View style={styles.topRight}>
          <View style={[styles.savedPill, { borderColor: colors.border }]}>
            <Save size={14} color={savingState === 'saving' ? '#D97706' : '#059669'} />
            <Text style={{
              fontSize: 12,
              fontWeight: '600',
              color: savingState === 'saving' ? '#D97706' : '#059669',
            }}>
              {savingState === 'saving' ? 'Saving…' : 'Saved'}
            </Text>
          </View>
          <TouchableOpacity testID="pilot-v2-editor-close" onPress={handleClose} style={styles.iconBtn}>
            <X size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Title + toolbar */}
      <View style={[styles.titleSection, { borderBottomColor: colors.border }]}>
        <TextInput
          testID="pilot-v2-editor-title"
          value={title}
          onChangeText={(v) => { setTitle(v); scheduleSave(blocks, v); }}
          placeholder="Untitled"
          placeholderTextColor={colors.textTertiary}
          style={[styles.titleInput, { color: colors.textPrimary }]}
        />

        <View style={styles.toolbar}>
          <ToolbarTextBtn label="H1" onPress={() => setActiveBlockType('heading', 1)} colors={colors} />
          <ToolbarTextBtn label="H2" onPress={() => setActiveBlockType('heading', 2)} colors={colors} />
          <ToolbarIconBtn Icon={Bold}          onPress={() => toggleMark('bold')}      colors={colors} active={isMarkActive('bold')}      testID="pilot-v2-tool-bold" />
          <ToolbarIconBtn Icon={Italic}        onPress={() => toggleMark('italic')}    colors={colors} active={isMarkActive('italic')}    testID="pilot-v2-tool-italic" />
          <ToolbarIconBtn Icon={UnderlineIcon} onPress={() => toggleMark('underline')} colors={colors} active={isMarkActive('underline')} testID="pilot-v2-tool-underline" />
          <Divider colors={colors} />
          <ToolbarIconBtn Icon={ListOrdered} onPress={() => setActiveBlockType('numbered')}  colors={colors} testID="pilot-v2-tool-ol" />
          <ToolbarIconBtn Icon={List}        onPress={() => setActiveBlockType('bullet')}    colors={colors} testID="pilot-v2-tool-ul" />
          <ToolbarIconBtn Icon={ListTodo}    onPress={() => setActiveBlockType('checklist')} colors={colors} testID="pilot-v2-tool-checklist" />
          <Divider colors={colors} />

          <View>
            <TouchableOpacity
              testID="pilot-v2-tool-highlight"
              onPress={() => setShowHighlightPicker(v => !v)}
              style={styles.toolBtn}
            >
              <View style={[styles.swatch, { backgroundColor: PILOT_V2_HIGHLIGHT_PALETTE.find(c => c.name === activeHighlight)?.bg ?? '#FDE68A' }]} />
            </TouchableOpacity>
            {showHighlightPicker && (
              <View style={[styles.highlightPicker, { backgroundColor: '#fff', borderColor: colors.border }]}>
                {PILOT_V2_HIGHLIGHT_PALETTE.map(c => (
                  <TouchableOpacity
                    key={c.name}
                    testID={`pilot-v2-highlight-${c.name.toLowerCase()}`}
                    onPress={() => applyHighlight(c.name)}
                    style={[
                      styles.swatch,
                      { backgroundColor: c.bg, borderWidth: activeHighlight === c.name ? 2 : 0, borderColor: '#5B4EFA' },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <ToolbarIconBtn Icon={Highlighter} onPress={() => setActiveBlockType('highlight')} colors={colors} testID="pilot-v2-tool-block-highlight" />
          <ToolbarIconBtn Icon={LinkIcon}    onPress={insertLink}                colors={colors} testID="pilot-v2-tool-link" />
          <ToolbarIconBtn Icon={ImageIcon}   onPress={insertImageFromLibrary}    colors={colors} testID="pilot-v2-tool-image" />
          <ToolbarIconBtn Icon={Calendar}    onPress={() => setReminderPickerVisible(true)} colors={colors} testID="pilot-v2-tool-reminder" />
          <ToolbarIconBtn Icon={Paperclip}   onPress={insertAttachment}          colors={colors} testID="pilot-v2-tool-attachment" />
          <ToolbarIconBtn Icon={TableIcon}   onPress={insertTable}               colors={colors} testID="pilot-v2-tool-table" />
          <ToolbarIconBtn Icon={Code}        onPress={insertCode}                colors={colors} testID="pilot-v2-tool-code" />
        </View>
      </View>

      {/* Editor + outline */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <ScrollView
          testID="pilot-v2-editor-canvas"
          style={{ flex: 1, backgroundColor: '#F9FAFB' }}
          contentContainerStyle={styles.canvas}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.paper, { backgroundColor: '#fff', borderColor: colors.border }]}>
            {blocks.map(b => (
              <BlockRow
                key={b.id}
                block={b}
                colors={colors}
                isActive={activeBlockId === b.id}
                onFocus={() => setActiveBlockId(b.id)}
                onChange={(text) => updateBlock(b.id, { text })}
                onToggleCheck={() => updateBlock(b.id, { checked: !b.checked })}
                onDelete={() => deleteBlock(b.id)}
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
        </ScrollView>

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
          <TouchableOpacity style={styles.bottomItem}>
            <Type size={14} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Aa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomItem}>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>100%</Text>
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
    </KeyboardAvoidingView>
  );
}

/* ---------- Block row ---------- */
interface BlockRowProps {
  block: PilotV2Block;
  colors: any;
  isActive: boolean;
  onFocus: () => void;
  onChange: (text: string) => void;
  onToggleCheck: () => void;
  onDelete: () => void;
}

function BlockRow({ block, colors, isActive, onFocus, onChange, onToggleCheck, onDelete }: BlockRowProps) {
  const fontSize = block.type === 'heading'
    ? block.level === 1 ? 24 : 18
    : 16;
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
        isActive ? { backgroundColor: '#F3F4F6' } : null,
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
          <View style={[styles.blockTableWrap, { borderColor: '#E5E7EB' }]} testID={`pilot-v2-block-table-${block.id}`}>
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
          </View>
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
        <TouchableOpacity testID={`pilot-v2-block-delete-${block.id}`} onPress={onDelete} hitSlop={6} style={styles.iconBtn}>
          <Trash2 size={14} color={colors.textTertiary} />
        </TouchableOpacity>
      )}
    </View>
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
  iconBtn: { padding: 6, borderRadius: 6 },
  savedPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1 },

  titleSection: { paddingHorizontal: 32, paddingVertical: 16, borderBottomWidth: 1, gap: 16 },
  titleInput: { fontSize: 30, fontWeight: '700', padding: 0, lineHeight: 40 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  toolBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  toolDivider: { width: 1, height: 24, marginHorizontal: 4 },
  swatch: { width: 18, height: 18, borderRadius: 4 },
  highlightPicker: {
    position: 'absolute', top: '100%', left: 0, marginTop: 4,
    flexDirection: 'row', gap: 6, padding: 8, borderRadius: 8, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },

  canvas: { padding: 24, paddingBottom: 80 },
  paper: { padding: 32, borderRadius: 12, borderWidth: 1, gap: 6, maxWidth: 880, alignSelf: 'center', width: '100%' },
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
