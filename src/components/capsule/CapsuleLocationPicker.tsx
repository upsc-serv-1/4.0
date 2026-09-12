/**
 * CapsuleLocationPicker — bottom-sheet picker for "Add to Notebook → Capsule".
 *
 * Two modes per the bible spec:
 *   • Manual — user browses the Subject → Topic → Subtopic → Notebook tree
 *     and may create new nodes inline.
 *   • Auto   — generated from the source card metadata
 *     (Subject = card.subject, Topic = card.section_group,
 *      Subtopic = card.microtopic, Notebook = user-typed title).
 *     Missing nodes are created on the fly.
 *
 * onPick returns the resolved notebook { note_id, title } so the caller can
 * append blocks via appendBlocksToNotebook().
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import {
  ChevronDown, ChevronRight, Plus, X, BookOpen, Wand2, ListTree,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchAllCapsuleNodes, createCapsuleNode, createNotebookRow, buildCapsuleTree,
  CapsuleTreeNode,
} from '../../repositories/capsuleRepo';
import {
  CapsuleNode, CapsuleNodeType, CAPSULE_SUBJECT_PALETTE,
} from '../../types/capsule';

interface AutoSeed {
  subject?: string | null;
  topic?: string | null;       // section_group
  subtopic?: string | null;    // microtopic
}

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
  /** Called when a notebook is finally picked / created. */
  onPick: (result: { node_id: string; note_id: string; title: string }) => void;
  /** Optional pre-filled values for Auto-mode (from the card / question). */
  autoSeed?: AutoSeed;
  /** Default notebook title in Auto mode. */
  defaultNotebookTitle?: string;
}

type Mode = 'manual' | 'auto';

export const CapsuleLocationPicker: React.FC<Props> = ({
  visible, userId, onClose, onPick, autoSeed, defaultNotebookTitle,
}) => {
  const { colors } = useTheme();

  const [mode, setMode] = useState<Mode>(autoSeed?.subject ? 'auto' : 'manual');
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<CapsuleNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  /* manual selection */
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [creating, setCreating] = useState(false);

  /* auto fields */
  const [autoSubject,  setAutoSubject]  = useState(autoSeed?.subject  || '');
  const [autoTopic,    setAutoTopic]    = useState(autoSeed?.topic    || '');
  const [autoSubtopic, setAutoSubtopic] = useState(autoSeed?.subtopic || '');
  const [autoNotebook, setAutoNotebook] = useState(defaultNotebookTitle || '');

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const list = await fetchAllCapsuleNodes(userId);
    setNodes(list);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    setMode(autoSeed?.subject ? 'auto' : 'manual');
    setSelectedParentId(null);
    setNewNotebookTitle('');
    setAutoSubject(autoSeed?.subject || '');
    setAutoTopic(autoSeed?.topic || '');
    setAutoSubtopic(autoSeed?.subtopic || '');
    setAutoNotebook(defaultNotebookTitle || '');
    reload();
  }, [visible, reload, autoSeed, defaultNotebookTitle]);

  const tree = useMemo(() => buildCapsuleTree(nodes), [nodes]);

  /* ---------------- manual ops ---------------- */

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const handlePickNotebook = (n: CapsuleTreeNode) => {
    if (n.type !== 'notebook' || !n.note_id) return;
    onPick({ node_id: n.id, note_id: n.note_id, title: n.title });
    onClose();
  };

  const handleSaveNewNotebook = async () => {
    const title = newNotebookTitle.trim();
    if (!title || !selectedParentId) return;
    setCreating(true);
    try {
      const parent = nodes.find((n) => n.id === selectedParentId);
      const subjectTitle = walkUpToSubject(parent, nodes)?.title || 'Capsule';
      const noteId = await createNotebookRow({ userId, subject: subjectTitle, title });
      if (!noteId) return;
      const node = await createCapsuleNode({
        userId, type: 'notebook', title, parentId: selectedParentId, noteId,
      });
      if (node) {
        onPick({ node_id: node.id, note_id: noteId, title });
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  /* ---------------- auto ops ---------------- */

  const handleSaveAuto = async () => {
    const subject  = autoSubject.trim();
    const topic    = autoTopic.trim();
    const subtopic = autoSubtopic.trim();
    const notebook = autoNotebook.trim();
    if (!subject || !notebook) return;
    setCreating(true);
    try {
      const result = await ensureCapsulePath({
        userId, nodes, subject, topic, subtopic, notebookTitle: notebook,
      });
      await reload();
      onPick(result);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  /* ---------------- render ---------------- */

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />

        <View style={[styles.sheet, { backgroundColor: colors.surface }]} testID="capsule-location-picker">
          <View style={styles.head}>
            <BookOpen color={colors.primary} size={20} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Save to Capsule</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border + '40' }]} testID="capsule-picker-close">
              <X color={colors.textPrimary} size={20} />
            </TouchableOpacity>
          </View>

          <View style={[styles.modeRow, { borderColor: colors.border }]}>
            <ModeBtn
              Icon={ListTree} label="Manual" active={mode === 'manual'}
              onPress={() => setMode('manual')} testID="capsule-picker-mode-manual"
            />
            <ModeBtn
              Icon={Wand2} label="Auto" active={mode === 'auto'}
              onPress={() => setMode('auto')} testID="capsule-picker-mode-auto"
            />
          </View>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : mode === 'manual' ? (
            <ManualMode
              tree={tree}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onPickNotebook={handlePickNotebook}
              selectedParentId={selectedParentId}
              onSelectParent={setSelectedParentId}
              newNotebookTitle={newNotebookTitle}
              setNewNotebookTitle={setNewNotebookTitle}
              creating={creating}
              onSaveNew={handleSaveNewNotebook}
            />
          ) : (
            <AutoMode
              subject={autoSubject} setSubject={setAutoSubject}
              topic={autoTopic} setTopic={setAutoTopic}
              subtopic={autoSubtopic} setSubtopic={setAutoSubtopic}
              notebook={autoNotebook} setNotebook={setAutoNotebook}
              creating={creating}
              onSave={handleSaveAuto}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/* -------------------------------------------------------------------------- */
/* Manual mode                                                                 */
/* -------------------------------------------------------------------------- */

const ManualMode: React.FC<{
  tree: CapsuleTreeNode[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onPickNotebook: (n: CapsuleTreeNode) => void;
  selectedParentId: string | null;
  onSelectParent: (id: string | null) => void;
  newNotebookTitle: string;
  setNewNotebookTitle: (s: string) => void;
  creating: boolean;
  onSaveNew: () => void;
}> = ({
  tree, expandedIds, onToggleExpand, onPickNotebook,
  selectedParentId, onSelectParent, newNotebookTitle, setNewNotebookTitle, creating, onSaveNew,
}) => {
  const { colors } = useTheme();

  const renderRow = (n: CapsuleTreeNode, depth: number): React.ReactNode => {
    const isExpanded = expandedIds.has(n.id);
    const isParentChosen = selectedParentId === n.id;
    const canHaveNotebook = n.type === 'subtopic' || n.type === 'topic' || n.type === 'subject';
    const tint = n.type === 'subject'
      ? (n.color || CAPSULE_SUBJECT_PALETTE[n.title] || CAPSULE_SUBJECT_PALETTE.default)
      : null;

    return (
      <View key={n.id}>
        <View style={[styles.row, { paddingLeft: 12 + depth * 14, borderBottomColor: colors.border + '20' }, isParentChosen && { backgroundColor: colors.primary + '15' }]}>
          {n.type !== 'notebook' ? (
            <TouchableOpacity onPress={() => onToggleExpand(n.id)} style={styles.chev} hitSlop={4}>
              {isExpanded ? <ChevronDown color={colors.textTertiary} size={14} /> : <ChevronRight color={colors.textTertiary} size={14} />}
            </TouchableOpacity>
          ) : <View style={styles.chev} />}

          {tint
            ? <View style={[styles.chip, { backgroundColor: tint }]}><Text style={styles.chipTxt}>{n.title.charAt(0).toUpperCase()}</Text></View>
            : <BookOpen color={colors.textTertiary} size={14} />}

          <TouchableOpacity
            style={{ flex: 1 }}
            testID={`capsule-picker-row-${n.id}`}
            onPress={() => {
              if (n.type === 'notebook') onPickNotebook(n);
              else onSelectParent(n.id);
            }}
          >
            <Text
              numberOfLines={1}
              style={[styles.rowTxt, {
                color: isParentChosen ? colors.primary : colors.textPrimary,
                fontWeight: n.type === 'subject' ? '600' : '400',
              }]}
            >
              {n.title}
            </Text>
          </TouchableOpacity>

          {n.type !== 'notebook' && n.notebookCount > 0 && (
            <Text style={[styles.count, { color: colors.textTertiary }]}>{n.notebookCount}</Text>
          )}
        </View>

        {isExpanded && n.children.map((c) => renderRow(c, depth + 1))}
      </View>
    );
  };

  const canSave = !!selectedParentId && !!newNotebookTitle.trim();

  return (
    <>
      <ScrollView style={styles.tree} contentContainerStyle={{ paddingVertical: 6 }}>
        {tree.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>
            No subjects yet — switch to Auto mode or open Capsule to create your first subject.
          </Text>
        ) : (
          tree.map((n) => renderRow(n, 0))
        )}
      </ScrollView>

      <View style={[styles.createRow, { borderTopColor: colors.border }]}>
        <TextInput
          testID="capsule-picker-new-name"
          value={newNotebookTitle}
          onChangeText={setNewNotebookTitle}
          placeholder={selectedParentId ? 'New notebook name' : 'Pick a topic or subtopic above first…'}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
          editable={!!selectedParentId}
        />
        <TouchableOpacity
          testID="capsule-picker-create-here"
          onPress={onSaveNew}
          disabled={!canSave || creating}
          style={[styles.cta, { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.55 }]}
        >
          <Plus color="#fff" size={14} strokeWidth={2.5} />
          <Text style={styles.ctaTxt}>{creating ? 'Saving…' : 'Create here'}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

/* -------------------------------------------------------------------------- */
/* Auto mode                                                                   */
/* -------------------------------------------------------------------------- */

const AutoMode: React.FC<{
  subject: string;  setSubject:  (s: string) => void;
  topic: string;    setTopic:    (s: string) => void;
  subtopic: string; setSubtopic: (s: string) => void;
  notebook: string; setNotebook: (s: string) => void;
  creating: boolean;
  onSave: () => void;
}> = ({
  subject, setSubject, topic, setTopic, subtopic, setSubtopic,
  notebook, setNotebook, creating, onSave,
}) => {
  const { colors } = useTheme();
  const canSave = !!subject.trim() && !!notebook.trim();

  return (
    <View style={styles.autoWrap}>
      <Text style={[styles.autoHint, { color: colors.textSecondary }]}>
        Pre-filled from the question (Subject → Section Group → Microtopic). Adjust and save —
        any missing levels will be created automatically.
      </Text>
      <Field label="Subject" value={subject} onChange={setSubject} testID="capsule-auto-subject" />
      <Field label="Topic"    value={topic}    onChange={setTopic}    testID="capsule-auto-topic" />
      <Field label="Subtopic" value={subtopic} onChange={setSubtopic} testID="capsule-auto-subtopic" />
      <Field label="Notebook name" value={notebook} onChange={setNotebook} testID="capsule-auto-notebook" />

      <TouchableOpacity
        testID="capsule-auto-save"
        onPress={onSave}
        disabled={!canSave || creating}
        style={[styles.cta, { backgroundColor: colors.primary, opacity: canSave ? 1 : 0.55, marginTop: 12, alignSelf: 'flex-end' }]}
      >
        <Plus color="#fff" size={14} strokeWidth={2.5} />
        <Text style={styles.ctaTxt}>{creating ? 'Saving…' : 'Save to Capsule'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (s: string) => void; testID?: string }> = ({
  label, value, onChange, testID,
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        style={[styles.input, { flex: undefined, width: '100%', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
        placeholder="—"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
};

const ModeBtn: React.FC<{ Icon: any; label: string; active: boolean; onPress: () => void; testID?: string }> = ({
  Icon, label, active, onPress, testID,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[
        styles.modeBtn,
        active && { backgroundColor: hex(colors.primary, 0.12), borderColor: colors.primary },
        !active && { borderColor: colors.border },
      ]}
    >
      <Icon size={14} color={active ? colors.primary : colors.textTertiary} />
      <Text style={[styles.modeBtnTxt, { color: active ? colors.primary : colors.textTertiary }]}>{label}</Text>
    </TouchableOpacity>
  );
};

/* -------------------------------------------------------------------------- */
/* Hierarchy resolver — shared with Step 8 quiz pipeline                       */
/* -------------------------------------------------------------------------- */

function walkUpToSubject(start: CapsuleNode | undefined, all: CapsuleNode[]): CapsuleNode | null {
  if (!start) return null;
  let cur: CapsuleNode | undefined = start;
  const map = new Map(all.map((n) => [n.id, n]));
  while (cur && cur.type !== 'subject') {
    if (!cur.parent_id) return null;
    cur = map.get(cur.parent_id);
  }
  return cur || null;
}

export async function ensureCapsulePath(input: {
  userId: string;
  nodes: CapsuleNode[];
  subject: string;
  topic?: string;
  subtopic?: string;
  notebookTitle: string;
}): Promise<{ node_id: string; note_id: string; title: string }> {
  const { userId, subject, topic, subtopic, notebookTitle } = input;
  let nodes = [...input.nodes];

  const findChild = (parentId: string | null, type: CapsuleNodeType, title: string) =>
    nodes.find(
      (n) =>
        n.parent_id === parentId &&
        n.type === type &&
        (n.title || '').trim().toLowerCase() === title.trim().toLowerCase()
    );

  const ensure = async (parentId: string | null, type: CapsuleNodeType, title: string, color?: string) => {
    const existing = findChild(parentId, type, title);
    if (existing) return existing;
    const created = await createCapsuleNode({
      userId, type, title, parentId,
      color: color || (type === 'subject' ? CAPSULE_SUBJECT_PALETTE[title] || null : null),
    });
    if (created) nodes.push(created);
    return created!;
  };

  const subjectNode = await ensure(null, 'subject', subject);
  let parent: CapsuleNode = subjectNode;
  if (topic) parent = await ensure(parent.id, 'topic', topic) || parent;
  if (subtopic) parent = await ensure(parent.id, 'subtopic', subtopic) || parent;

  // create notebook (always new — append-friendly behavior is handled by caller)
  const noteId = await createNotebookRow({ userId, subject, title: notebookTitle });
  if (!noteId) throw new Error('Failed to create notebook row');
  const notebookNode = await createCapsuleNode({
    userId, type: 'notebook', title: notebookTitle, parentId: parent.id, noteId,
  });
  if (!notebookNode) throw new Error('Failed to create notebook node');
  return { node_id: notebookNode.id, note_id: noteId, title: notebookTitle };
}

function hex(c: string, alpha: number): string {
  if (!c?.startsWith('#') || c.length !== 7) return c;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${c}${a}`;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                      */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  sheet: {
    width: '94%', maxWidth: 500, height: '82%', borderRadius: 40,
    padding: 20, paddingBottom: 30, flexDirection: 'column', overflow: 'hidden',
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 10 },
  title: { fontSize: 18, fontWeight: '900' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  modeRow: {
    flexDirection: 'row', gap: 8, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  modeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, height: 32, borderRadius: 8, borderWidth: 1,
  },
  modeBtnTxt: { fontSize: 13, fontWeight: '500' },

  loaderWrap: { padding: 24, alignItems: 'center' },

  /* manual */
  tree: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 12, gap: 8, borderBottomWidth: 1, borderRadius: 12 },
  chev: { width: 16, alignItems: 'center', justifyContent: 'center' },
  chip: { width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  rowTxt: { fontSize: 15, fontWeight: '600', flex: 1 },
  count: { fontSize: 11 },

  createRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, borderTopWidth: 1,
  },
  input: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  cta: {
    paddingHorizontal: 14, height: 40, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  ctaTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },

  empty: { padding: 24, fontSize: 13, textAlign: 'center' },

  /* auto */
  autoWrap: { paddingVertical: 16 },
  autoHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 4 },
});
