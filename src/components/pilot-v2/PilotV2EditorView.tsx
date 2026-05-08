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
  KeyboardAvoidingView, Platform, useWindowDimensions,
} from 'react-native';
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
          <ToolbarIconBtn Icon={LinkIcon}    onPress={() => {}} colors={colors} />
          <ToolbarIconBtn Icon={ImageIcon}   onPress={() => {}} colors={colors} />
          <ToolbarIconBtn Icon={Calendar}    onPress={() => {}} colors={colors} />
          <ToolbarIconBtn Icon={Paperclip}   onPress={() => {}} colors={colors} />
          <ToolbarIconBtn Icon={TableIcon}   onPress={() => {}} colors={colors} />
          <ToolbarIconBtn Icon={Code}        onPress={() => setActiveBlockType('code')} colors={colors} />
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
            color: colors.textPrimary,
            lineHeight: fontSize === 24 ? 32 : fontSize === 18 ? 26 : 24,
            paddingVertical: 4,
            textDecorationLine,
          }}
        />
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
});
