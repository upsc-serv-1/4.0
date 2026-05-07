/**
 * Capsule Editor — block-based dedicated workspace.
 *
 * Each block is independently editable. Toolbar lets the user change a
 * block's type (paragraph / heading / bullet / numbered / checklist /
 * highlight / quote), reorder, duplicate or delete it, and append new
 * blocks. The notebook content auto-saves to Supabase after a short debounce.
 *
 * Reading mode lives at /capsule/glance/[id].
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, ActivityIndicator,
} from 'react-native';
import {
  ChevronLeft, Hash, Type, List as ListIcon, ListOrdered,
  CheckSquare, Highlighter, Quote, Plus, Save,
  Trash2, ArrowUp, ArrowDown, Eye,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../src/context/ThemeContext';
import { PageWrapper } from '../../../src/components/PageWrapper';
import {
  fetchNotebookContent, saveNotebookContent,
} from '../../../src/repositories/capsuleRepo';
import { supabase } from '../../../src/lib/supabase';
import {
  CapsuleBlock, CapsuleBlockType, CapsuleNotebookContent,
} from '../../../src/types/capsule';

const BLOCK_TYPES: { type: CapsuleBlockType; Icon: any; label: string }[] = [
  { type: 'paragraph', Icon: Type,        label: 'Text' },
  { type: 'heading',   Icon: Hash,        label: 'Heading' },
  { type: 'bullet',    Icon: ListIcon,    label: 'Bullet' },
  { type: 'numbered',  Icon: ListOrdered, label: 'Numbered' },
  { type: 'checklist', Icon: CheckSquare, label: 'Check' },
  { type: 'highlight', Icon: Highlighter, label: 'Highlight' },
  { type: 'quote',     Icon: Quote,       label: 'Quote' },
];

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

  const [content, setContent] = useState<CapsuleNotebookContent>({ blocks: [], highlights: [], version: 1 });
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
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

  const setBlockType = (id: string, type: CapsuleBlockType) =>
    updateBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, type } : b)));

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

  /* ------------ render ------------ */

  if (loading) {
    return (
      <PageWrapper>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity testID="capsule-editor-back" onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft color={colors.textPrimary} size={22} />
          </TouchableOpacity>

          <Text style={[styles.crumb, { color: colors.textTertiary, flex: 1 }]} numberOfLines={1}>
            {dirty ? 'Editing — unsaved changes' : saving ? 'Saving…' : 'All changes saved'}
          </Text>

          <TouchableOpacity
            testID="capsule-editor-glance"
            onPress={() => router.replace({ pathname: '/capsule/glance/[id]', params: { id } } as any)}
            style={styles.iconBtn}
          >
            <Eye color={colors.textTertiary} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="capsule-editor-save"
            onPress={() => persist(content, title)}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
          >
            <Save color="#fff" size={14} strokeWidth={2.5} />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <TextInput
            testID="capsule-editor-title"
            value={title}
            onChangeText={updateTitle}
            placeholder="Notebook title"
            placeholderTextColor={colors.textTertiary}
            style={[styles.title, { color: colors.textPrimary }]}
          />

          {content.blocks.map((b, i) => (
            <BlockEditor
              key={b.id}
              block={b}
              index={i}
              total={content.blocks.length}
              onText={(t) => setBlockText(b.id, t)}
              onType={(t) => setBlockType(b.id, t)}
              onToggleCheck={() => toggleChecked(b.id)}
              onAddAfter={() => addBlockAfter(b.id)}
              onRemove={() => removeBlock(b.id)}
              onMove={(dir) => moveBlock(b.id, dir)}
            />
          ))}

          <TouchableOpacity
            testID="capsule-editor-append"
            onPress={() => addBlockAfter(null)}
            style={[styles.appendBtn, { borderColor: colors.border }]}
          >
            <Plus color={colors.textTertiary} size={16} />
            <Text style={[styles.appendTxt, { color: colors.textTertiary }]}>Add block</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </PageWrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Per-block editor                                                            */
/* -------------------------------------------------------------------------- */

const BlockEditor: React.FC<{
  block: CapsuleBlock;
  index: number;
  total: number;
  onText: (t: string) => void;
  onType: (t: CapsuleBlockType) => void;
  onToggleCheck: () => void;
  onAddAfter: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}> = ({ block, index, total, onText, onType, onToggleCheck, onAddAfter, onRemove, onMove }) => {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

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
      testID={`capsule-block-${block.id}`}
      style={[
        styles.blockWrap,
        focused && { backgroundColor: 'rgba(127,119,221,0.06)', borderColor: colors.primary },
      ]}
    >
      <View style={styles.blockRow}>
        {block.type === 'checklist' && (
          <TouchableOpacity onPress={onToggleCheck} testID={`capsule-block-check-${block.id}`} style={styles.checkBtn}>
            <Text style={{ fontSize: 16 }}>{block.checked ? '☑' : '☐'}</Text>
          </TouchableOpacity>
        )}
        {(block.type === 'bullet') && <Text style={[styles.bulletDot, { color: colors.textPrimary }]}>•</Text>}
        {(block.type === 'numbered') && <Text style={[styles.bulletDot, { color: colors.textPrimary }]}>{index + 1}.</Text>}
        {(block.type === 'quote') && <View style={[styles.quoteBar, { backgroundColor: colors.primary }]} />}

        <TextInput
          testID={`capsule-block-input-${block.id}`}
          value={block.text}
          onChangeText={onText}
          placeholder={PLACEHOLDER[block.type] || 'Type something…'}
          placeholderTextColor={colors.textTertiary}
          multiline
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, inputStyle, block.type === 'checklist' && block.checked && { textDecorationLine: 'line-through' }]}
        />
      </View>

      <View style={[styles.toolbar, { borderTopColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarRow}>
          {BLOCK_TYPES.map(({ type, Icon, label }) => {
            const active = block.type === type;
            return (
              <TouchableOpacity
                key={type}
                testID={`capsule-block-type-${block.id}-${type}`}
                onPress={() => onType(type)}
                style={[
                  styles.typeChip,
                  active && { backgroundColor: hex(colors.primary, 0.12) },
                ]}
              >
                <Icon size={14} color={active ? colors.primary : colors.textTertiary} />
                <Text style={[styles.typeChipTxt, { color: active ? colors.primary : colors.textTertiary }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity testID={`capsule-block-up-${block.id}`} onPress={() => onMove(-1)} disabled={index === 0} style={styles.actionBtn}>
            <ArrowUp size={14} color={index === 0 ? colors.border : colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity testID={`capsule-block-down-${block.id}`} onPress={() => onMove(1)} disabled={index === total - 1} style={styles.actionBtn}>
            <ArrowDown size={14} color={index === total - 1 ? colors.border : colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity testID={`capsule-block-add-${block.id}`} onPress={onAddAfter} style={styles.actionBtn}>
            <Plus size={14} color={colors.textTertiary} />
          </TouchableOpacity>
          <TouchableOpacity testID={`capsule-block-remove-${block.id}`} onPress={onRemove} style={styles.actionBtn}>
            <Trash2 size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const PLACEHOLDER: Record<CapsuleBlockType, string> = {
  paragraph: 'Write a paragraph…',
  heading:   'Heading',
  bullet:    'Bullet point',
  numbered:  'Numbered item',
  checklist: 'Checklist item',
  highlight: 'Highlight this for revision',
  quote:     'Quote or callout',
  attachment: 'Attachment',
  ai:        'AI explanation',
  voice:     'Voice transcription',
};

function hex(c: string, alpha: number): string {
  if (!c?.startsWith('#') || c.length !== 7) return c;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${c}${a}`;
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
    borderBottomWidth: 1, minHeight: 48,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
  crumb: { fontSize: 12, paddingLeft: 6 },
  saveBtn: {
    height: 32, paddingHorizontal: 12, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 96, maxWidth: 760, alignSelf: 'center', width: '100%' },
  title: {
    fontSize: 26, fontWeight: '700', marginBottom: 16, padding: 4,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },

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

  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 6, paddingTop: 6, borderTopWidth: 1, gap: 6,
  },
  toolbarRow: { gap: 6, alignItems: 'center', paddingRight: 8 },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  typeChipTxt: { fontSize: 11, fontWeight: '500' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  actionBtn: { padding: 6 },

  appendBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderStyle: 'dashed', marginTop: 16, alignSelf: 'flex-start',
  },
  appendTxt: { fontSize: 13 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
