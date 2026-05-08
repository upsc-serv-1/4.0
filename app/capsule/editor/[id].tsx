/**
 * Capsule Editor — block-based dedicated workspace.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ActivityIndicator, useWindowDimensions, Modal,
} from 'react-native';
import {
  X, ChevronLeft, Hash, Type, List as ListIcon, ListOrdered,
  CheckSquare, Highlighter, Quote, Plus, Save,
  Trash2, ArrowUp, ArrowDown, Eye, Share2, MoreHorizontal,
  GripVertical, HelpCircle, Settings, Bold, Italic, Underline,
  Slash, Link, Image as ImageIcon, Table, Sparkles,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { PageWrapper } from '../../../src/components/PageWrapper';
import {
  fetchNotebookContent, saveNotebookContent,
} from '../../../src/repositories/capsuleRepo';
import { supabase } from '../../../src/lib/supabase';
import { aiImproveAnswer } from '../../../src/services/GeminiService';
import {
  CapsuleBlock, CapsuleBlockType, CapsuleNotebookContent,
} from '../../../src/types/capsule';

const HIGHLIGHT_COLORS = ['#FFF3B0', '#ABEBC6', '#F1948A', '#C39BD3', '#AED6F1', '#F0F0F0'];

const newId = () => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const newBlock = (type: CapsuleBlockType = 'paragraph'): CapsuleBlock => ({
  id: newId(), type, text: '', created_at: new Date().toISOString(),
});

export default function CapsuleEditor() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id || '';
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;

  const [content, setContent] = useState<CapsuleNotebookContent>({ blocks: [], highlights: [], version: 1 });
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<'blocks' | 'outline'>('blocks');
  const [aiPromptVisible, setAiPromptVisible] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [improvingBlock, setImprovingBlock] = useState(false);
  const saveTimer = useRef<any>(null);

  /* ------------ load ------------ */

  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      const [c, { data: row }] = await Promise.all([
        fetchNotebookContent(id),
        supabase.from('user_notes').select('title').eq('id', id).maybeSingle(),
      ]);
      if (!active) return;
      const blocks = c.blocks?.length ? c.blocks : [newBlock('paragraph')];
      setContent({ ...c, blocks });
      setTitle(row?.title || 'Untitled');
      setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  /* ------------ debounced save ------------ */

  const persist = useCallback(async (next: CapsuleNotebookContent, nextTitle: string) => {
    if (!id) return;
    setSaving(true);
    await Promise.all([
      saveNotebookContent(id, next),
      supabase.from('user_notes').update({
        title: nextTitle, updated_at: new Date().toISOString(),
      }).eq('id', id),
      supabase.from('user_note_nodes').update({
        title: nextTitle, updated_at: new Date().toISOString(),
      }).eq('note_id', id),
    ]);
    setSaving(false);
    setDirty(false);
  }, [id]);

  const scheduleSave = useCallback((next: CapsuleNotebookContent, nextTitle: string) => {
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(next, nextTitle), 600);
  }, [persist]);

  const updateBlocks = useCallback((mutator: (prev: CapsuleBlock[]) => CapsuleBlock[]) => {
    setContent((prev) => {
      const nextBlocks = mutator(prev.blocks);
      const next = { ...prev, blocks: nextBlocks };
      scheduleSave(next, title);
      return next;
    });
  }, [scheduleSave, title]);

  const updateTitle = (next: string) => {
    setTitle(next);
    scheduleSave(content, next);
  };

  /* ------------ block ops ------------ */

  const setBlockText = (id: string, text: string) =>
    updateBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));

  const setBlockType = (id: string, type: CapsuleBlockType, level?: number) =>
    updateBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, type, level } : b)));

  const toggleChecked = (id: string) =>
    updateBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b)));

  const addBlockAfter = (afterId: string | null, type: CapsuleBlockType = 'paragraph') => {
    updateBlocks((prev) => {
      if (afterId === null) return [...prev, newBlock(type)];
      const idx = prev.findIndex((b) => b.id === afterId);
      if (idx === -1) return [...prev, newBlock(type)];
      const next = [...prev];
      next.splice(idx + 1, 0, newBlock(type));
      return next;
    });
  };

  const removeBlock = (id: string) =>
    updateBlocks((prev) => (prev.length === 1 ? [{ ...prev[0], text: '' }] : prev.filter((b) => b.id !== id)));

  const moveBlock = (id: string, direction: -1 | 1) =>
    updateBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx === -1) return prev;
      const swapWith = idx + direction;
      if (swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });

  const handleAiImprove = async () => {
    if (!focusedBlockId) return;
    const block = content.blocks.find(b => b.id === focusedBlockId);
    if (!block || !block.text.trim()) return;
    setImprovingBlock(true);
    try {
      const improved = await aiImproveAnswer(
        aiInstruction.trim() || 'Improve spelling, grammar and professional styling of this text, keeping it short.',
        block.text,
        title || ''
      );
      if (improved) {
        setBlockText(focusedBlockId, improved);
        setAiPromptVisible(false);
        setAiInstruction('');
      }
    } catch (e: any) {
      alert(e?.message || 'AI improvement failed. Please try again.');
    } finally {
      setImprovingBlock(false);
    }
  };

  const wordCount = useMemo(() => {
    return content.blocks.reduce((acc, b) => acc + (b.text || '').trim().split(/\s+/).filter(Boolean).length, 0);
  }, [content.blocks]);

  /* ------------ render ------------ */

  if (loading) {
    return (
      <PageWrapper>
        <View style={editorStyles.center}><ActivityIndicator color={colors.primary} /></View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Full-width formatting toolbar — shown at TOP of editor */}
        <View style={[editorStyles.formattingBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={editorStyles.iconBtn}>
            <X color={colors.textPrimary} size={20} />
          </TouchableOpacity>

          <TextInput
            value={title}
            onChangeText={updateTitle}
            style={[editorStyles.titleInput, { color: colors.textPrimary }]}
            placeholder="Notebook title"
            placeholderTextColor={colors.textTertiary}
          />

          <View style={editorStyles.saveBadge}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dirty ? '#FF9500' : '#34C759' }} />
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 6 }}>
              {saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
            </Text>
          </View>

          <TouchableOpacity style={editorStyles.iconBtn}><Share2 size={18} color={colors.textTertiary} /></TouchableOpacity>
          <TouchableOpacity style={[editorStyles.exportBtn, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>Export</Text>
          </TouchableOpacity>
          <TouchableOpacity style={editorStyles.iconBtn}><MoreHorizontal size={18} color={colors.textTertiary} /></TouchableOpacity>
        </View>

        {/* Second row: formatting tools — operate on focusedBlockId */}
        <View style={[editorStyles.toolRow, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={editorStyles.toolRowInner}>
              <TouchableOpacity
                onPress={() => focusedBlockId && setBlockType(focusedBlockId, 'heading', 1)}
                style={[editorStyles.formatBtn, focusedBlockId && content.blocks.find(b => b.id === focusedBlockId)?.type === 'heading' && content.blocks.find(b => b.id === focusedBlockId)?.level === 1 && { backgroundColor: colors.border }]}
              >
                <Text style={[editorStyles.formatBtnTxt, { color: colors.textPrimary }]}>H1</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => focusedBlockId && setBlockType(focusedBlockId, 'heading', 2)}
                style={[editorStyles.formatBtn, focusedBlockId && content.blocks.find(b => b.id === focusedBlockId)?.type === 'heading' && content.blocks.find(b => b.id === focusedBlockId)?.level === 2 && { backgroundColor: colors.border }]}
              >
                <Text style={[editorStyles.formatBtnTxt, { color: colors.textPrimary }]}>H2</Text>
              </TouchableOpacity>
              <View style={[editorStyles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={editorStyles.iconBtn}><Bold size={16} color={colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity style={editorStyles.iconBtn}><Italic size={16} color={colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity style={editorStyles.iconBtn}><Underline size={16} color={colors.textSecondary} /></TouchableOpacity>
              <View style={[editorStyles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                onPress={() => focusedBlockId && setBlockType(focusedBlockId, 'numbered')}
                style={editorStyles.iconBtn}
              >
                <ListOrdered size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => focusedBlockId && setBlockType(focusedBlockId, 'bullet')}
                style={editorStyles.iconBtn}
              >
                <ListIcon size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[editorStyles.divider, { backgroundColor: colors.border }]} />
              <HighlighterBtn
                focusedBlockId={focusedBlockId}
                colors={colors}
                onHighlight={(blockId, color) => {
                  if (blockId) setBlockType(blockId, color ? 'highlight' : 'paragraph');
                }}
              />
              <View style={[editorStyles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={editorStyles.iconBtn}><Link size={16} color={colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity style={editorStyles.iconBtn}><ImageIcon size={16} color={colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity style={editorStyles.iconBtn}><Table size={16} color={colors.textSecondary} /></TouchableOpacity>
              <TouchableOpacity
                onPress={() => focusedBlockId && setBlockType(focusedBlockId, 'checklist')}
                style={editorStyles.iconBtn}
              >
                <CheckSquare size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={[editorStyles.divider, { backgroundColor: colors.border }]} />
              <TouchableOpacity
                onPress={() => {
                  if (!focusedBlockId) {
                    alert('Please select a text block first by tapping on it.');
                    return;
                  }
                  setAiInstruction('');
                  setAiPromptVisible(true);
                }}
                style={[editorStyles.formatBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary, borderWidth: 1, paddingHorizontal: 12, borderRadius: 6, gap: 4, flexDirection: 'row', alignItems: 'center' }]}
              >
                <Sparkles size={14} color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '700' }}>AI Edit</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>

        {/* Editor layout: content + right panel */}
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={editorStyles.content}>
            {content.blocks.map((b, i) => (
              <BlockEditor
                key={b.id}
                block={b}
                index={i}
                total={content.blocks.length}
                isFocused={focusedBlockId === b.id}
                onFocus={(id) => setFocusedBlockId(id)}
                onText={(t) => setBlockText(b.id, t)}
                onToggleCheck={() => toggleChecked(b.id)}
                onRemove={() => removeBlock(b.id)}
                onMove={(dir) => moveBlock(b.id, dir)}
              />
            ))}
            <TouchableOpacity onPress={() => addBlockAfter(null)} style={[editorStyles.appendBtn, { borderColor: colors.border }]}>
              <Plus size={16} color={colors.textTertiary} />
              <Text style={{ color: colors.textTertiary, fontSize: 13, marginLeft: 6 }}>Add block</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Right outline panel — iPad only */}
          {isTablet && (
            <View style={[editorStyles.rightPanel, { borderLeftColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={[editorStyles.rightPanelTabs, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setRightTab('blocks')}>
                  <Text style={rightTab === 'blocks' ? [editorStyles.tabActive, { color: colors.primary, borderBottomColor: colors.primary }] : [editorStyles.tabInactive, { color: colors.textTertiary }]}>Blocks</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setRightTab('outline')}>
                  <Text style={rightTab === 'outline' ? [editorStyles.tabActive, { color: colors.primary, borderBottomColor: colors.primary }] : [editorStyles.tabInactive, { color: colors.textTertiary }]}>Outline</Text>
                </TouchableOpacity>
              </View>
              <ScrollView>
                {content.blocks.map((b) => (
                  <View key={b.id} style={editorStyles.outlineRow}>
                    <Text style={[editorStyles.outlineBlockType, { color: colors.textTertiary }]}>
                      {b.type === 'heading' ? (b.level === 1 ? 'H1' : 'H2') : b.type === 'checklist' ? '☐' : '¶'}
                    </Text>
                    <Text numberOfLines={1} style={[editorStyles.outlineText, { color: colors.textSecondary }]}>{b.text || '—'}</Text>
                    <TouchableOpacity style={editorStyles.dragHandle}>
                      <GripVertical size={14} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Bottom status bar */}
        <View style={[editorStyles.statusBar, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity style={[editorStyles.fontSizeBtn, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '600' }}>Aa</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 12 }}>100%</Text>
          <View style={[editorStyles.zoomSlider, { backgroundColor: colors.border }]} />
          <TouchableOpacity><Text style={[editorStyles.zoomBtn, { color: colors.textSecondary }]}>+</Text></TouchableOpacity>

          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 'auto' }}>
            Words: {wordCount}
          </Text>
          <TouchableOpacity style={editorStyles.iconBtn}><Settings size={16} color={colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={editorStyles.iconBtn}><HelpCircle size={16} color={colors.textSecondary} /></TouchableOpacity>
        </View>

        <Modal visible={aiPromptVisible} transparent animationType="slide" onRequestClose={() => setAiPromptVisible(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, width: '90%', maxWidth: 500, padding: 24, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color={colors.primary} />
                  <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>AI Block Assistant</Text>
                </View>
                <TouchableOpacity onPress={() => setAiPromptVisible(false)}>
                  <X size={20} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, color: colors.textTertiary, marginBottom: 8 }}>
                Tell AI how to edit or improve the selected block text:
              </Text>

              <TextInput
                value={aiInstruction}
                onChangeText={setAiInstruction}
                placeholder="e.g. 'Summarize this', 'Translate to Hindi', 'Check spelling & grammar', 'Add explanation of Article 14'..."
                placeholderTextColor={colors.textTertiary}
                multiline
                style={{ height: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: colors.textPrimary, lineHeight: 20, textAlignVertical: 'top', backgroundColor: colors.surfaceStrong }}
              />

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setAiInstruction('Improve spelling, grammar, and professional styling, keeping it clear.')}
                  style={{ backgroundColor: colors.surfaceStrong, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>✨ Enhance</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAiInstruction('Summarize this block into a concise, punchy sentence.')}
                  style={{ backgroundColor: colors.surfaceStrong, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>📝 Summarize</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAiInstruction('Expand this concept with rich explanatory facts useful for UPSC preparation.')}
                  style={{ backgroundColor: colors.surfaceStrong, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ fontSize: 11, color: colors.textSecondary }}>📈 Expand</Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
                <TouchableOpacity
                  onPress={() => setAiPromptVisible(false)}
                  style={{ paddingHorizontal: 16, height: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={improvingBlock}
                  onPress={handleAiImprove}
                  style={{ paddingHorizontal: 20, height: 40, borderRadius: 8, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}
                >
                  {improvingBlock ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Sparkles color="#fff" size={14} />
                      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Improve with AI</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </PageWrapper>
  );
}

const HighlighterBtn = ({ focusedBlockId, colors, onHighlight }: any) => {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} style={editorStyles.iconBtn}>
        <Highlighter size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      {open && (
        <View style={[editorStyles.colorPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={() => { onHighlight(focusedBlockId, null); setOpen(false); }}>
            <View style={[editorStyles.swatch, { borderWidth: 1, borderColor: colors.border }]}>
              <Slash size={12} color="#999" />
            </View>
          </TouchableOpacity>
          {HIGHLIGHT_COLORS.map(color => (
            <TouchableOpacity key={color} onPress={() => { onHighlight(focusedBlockId, color); setOpen(false); }}>
              <View style={[editorStyles.swatch, { backgroundColor: color }]} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const BlockEditor: React.FC<{
  block: CapsuleBlock;
  index: number;
  total: number;
  isFocused: boolean;
  onFocus: (id: string) => void;
  onText: (t: string) => void;
  onToggleCheck: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}> = ({ block, index, total, isFocused, onFocus, onText, onToggleCheck, onRemove, onMove }) => {
  const { colors } = useTheme();

  const inputStyle: any = useMemo(() => {
    switch (block.type) {
      case 'heading':   return { fontSize: 22, fontWeight: '700', color: colors.textPrimary };
      case 'highlight': return { fontSize: 15, color: '#1a1a1a', backgroundColor: '#FFF3B0', paddingHorizontal: 6, borderRadius: 4 };
      case 'quote':     return { fontSize: 15, color: colors.textSecondary, fontStyle: 'italic' };
      default:          return { fontSize: 15, color: colors.textPrimary };
    }
  }, [block.type, colors]);

  return (
    <View
      style={[
        editorStyles.blockWrap,
        isFocused && { backgroundColor: 'rgba(91,79,232,0.06)', borderColor: colors.primary },
      ]}
    >
      <View style={editorStyles.blockRow}>
        {block.type === 'checklist' && (
          <TouchableOpacity onPress={onToggleCheck} style={editorStyles.checkBtn}>
            <Text style={{ fontSize: 16 }}>{block.checked ? '☑' : '☐'}</Text>
          </TouchableOpacity>
        )}
        {block.type === 'bullet' && <Text style={[editorStyles.bulletDot, { color: colors.textPrimary }]}>•</Text>}
        {block.type === 'numbered' && <Text style={[editorStyles.bulletDot, { color: colors.textPrimary }]}>{index + 1}.</Text>}
        {block.type === 'quote' && <View style={[editorStyles.quoteBar, { backgroundColor: colors.primary }]} />}

        <TextInput
          value={block.text}
          onChangeText={onText}
          placeholder="Type something…"
          placeholderTextColor={colors.textTertiary}
          multiline
          onFocus={() => onFocus(block.id)}
          style={[editorStyles.input, inputStyle, block.type === 'checklist' && block.checked && { textDecorationLine: 'line-through' }]}
        />

        {isFocused && (
          <View style={editorStyles.blockActions}>
            <TouchableOpacity onPress={() => onMove(-1)} disabled={index === 0} style={editorStyles.actionBtn}>
              <ArrowUp size={14} color={index === 0 ? colors.border : colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onMove(1)} disabled={index === total - 1} style={editorStyles.actionBtn}>
              <ArrowDown size={14} color={index === total - 1 ? colors.border : colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onRemove} style={editorStyles.actionBtn}>
              <Trash2 size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const editorStyles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  formattingBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  titleInput: {
    flex: 1, fontSize: 16, fontWeight: '700',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  saveBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.05)', marginRight: 8,
  },
  exportBtn: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtn: { padding: 8, borderRadius: 8 },
  toolRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolRowInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  formatBtn: { paddingHorizontal: 10, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  formatBtnTxt: { fontSize: 13, fontWeight: '700' },
  divider: { width: 1, height: 18, marginHorizontal: 4 },
  colorPicker: {
    flexDirection: 'row', position: 'absolute', top: 32, left: 0,
    zIndex: 99, padding: 8, borderRadius: 8, borderWidth: 1, gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
  },
  swatch: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 40, paddingTop: 32, paddingBottom: 120, maxWidth: 760, alignSelf: 'center', width: '100%' },
  appendBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, height: 40, borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed', marginTop: 24, alignSelf: 'flex-start',
  },
  rightPanel: {
    width: 220,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
  },
  rightPanelTabs: {
    flexDirection: 'row', gap: 16,
    paddingHorizontal: 16, paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabActive: { fontSize: 14, fontWeight: '600', paddingBottom: 6, borderBottomWidth: 2 },
  tabInactive: { fontSize: 14, paddingBottom: 6 },
  outlineRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  outlineBlockType: { fontSize: 11, width: 24 },
  outlineText: { flex: 1, fontSize: 13 },
  dragHandle: { padding: 4 },
  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, height: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fontSizeBtn: {
    width: 32, height: 24, borderRadius: 6, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  zoomSlider: { width: 80, height: 3, borderRadius: 1.5, marginLeft: 12, marginRight: 8 },
  zoomBtn: { fontSize: 16, fontWeight: '600', paddingHorizontal: 6 },
  blockWrap: {
    marginVertical: 4, borderRadius: 8, padding: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  blockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  checkBtn: { paddingTop: 4 },
  bulletDot: { fontSize: 16, lineHeight: 23, marginTop: 2, width: 18, textAlign: 'center' },
  quoteBar: { width: 3, alignSelf: 'stretch', borderRadius: 2 },
  input: {
    flex: 1, padding: 4, lineHeight: 22, minHeight: 28,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  blockActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: 'auto' },
  actionBtn: { padding: 4 },
});
