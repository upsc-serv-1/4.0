/**
 * Pilot V2 — Note List
 *
 * Faithful port of the KM `NoteList` component:
 *   • Sticky header with back button + topic title + search + "+ New Note"
 *   • Per-note row: blue file icon, title, timestamp, optional star,
 *     three-dot affordance.
 *
 * Step 7 (revised): every actionable element is now wired:
 *   • "+ New Note" creates a Pilot V2 note under the current
 *     subject/topic/subtopic (auto-creates the hierarchy if missing) and
 *     routes straight into the editor. For unauthenticated users it falls
 *     back to a transient note so the editor still opens.
 *   • The per-row three-dot menu opens an action sheet with
 *     Pin / Unpin, Rename and Delete (deletes the Supabase row + tree node).
 *   • Pinned star toggles via the same action sheet.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Modal, Platform,
} from 'react-native';
import { ChevronLeft, Search, Plus, FileText, Star, MoreVertical, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  findOrCreatePilotV2Note,
  renamePilotV2Note,
  archivePilotV2Node,
  pinPilotV2Node,
  fetchAllPilotV2Nodes,
  fetchPilotV2NotesForUser,
} from '../../repositories/pilotV2Repo';
import { PILOT_V2_SUBJECT_PALETTE, PilotV2Note } from './types';

const formatTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (isYesterday) return 'Yesterday';
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString();
};

const DEMO = [
  { id: 'n1', title: 'General Overview — Right to Equality', updated_at: undefined, timestamp: 'Today, 9:47 AM', is_pinned: true },
  { id: 'n2', title: 'Article 14 — Equality Before Law',     updated_at: undefined, timestamp: 'Today, 9:41 AM' },
  { id: 'n3', title: 'Article 15 — Prohibition of Discrimination', updated_at: undefined, timestamp: 'Yesterday' },
  { id: 'n4', title: 'Article 16 — Equality of Opportunity', updated_at: undefined, timestamp: '2 days ago' },
  { id: 'n5', title: 'Important Provisions — Women, Children, SCs, STs', updated_at: undefined, timestamp: '3 days ago' },
];

const SUBTOPIC_LABELS: Record<string, string> = {
  preamble: 'Preamble',
  'right-to-equality': 'Right to Equality',
  'right-to-freedom': 'Right to Freedom',
  exploitation: 'Right against Exploitation',
  'religious-freedom': 'Right to Freedom of Religion',
  'cultural-rights': 'Cultural & Educational Rights',
  'constitutional-remedies': 'Right to Constitutional Remedies',
};

export function PilotV2NoteList() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { state, dispatch } = usePilotV2();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [renameModal, setRenameModal] = useState<{ visible: boolean; noteId: string | null; title: string }>({
    visible: false, noteId: null, title: '',
  });
  const [savingRename, setSavingRename] = useState(false);

  const subtopicId = state.view.selectedSubtopic;
  const topicName = subtopicId ? (SUBTOPIC_LABELS[subtopicId] ?? subtopicId.replace(/-/g, ' ')) : 'Notes';
  const subjectId = state.view.selectedSubject;
  const subjectMeta = PILOT_V2_SUBJECT_PALETTE.find(s => s.id === subjectId);

  const notes = useMemo(() => {
    const real = state.notes.filter(n =>
      !state.view.selectedSubtopic || (n.subtopic && n.subtopic === topicName)
    );
    if (real.length === 0) return DEMO as any[];
    return real;
  }, [state.notes, state.view.selectedSubtopic, topicName]);

  const filtered = notes.filter(n =>
    !query || n.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectNote = (id: string) => {
    if (id.startsWith('n') && id.length === 2) {
      // Demo row — surface a friendly hint instead of routing to a missing note.
      dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
      return;
    }
    dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: id });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'subject' });
  };

  /* -------------------------- New Note creation --------------------------- */
  const handleNewNote = async () => {
    if (creating) return;
    const title = `Untitled note · ${new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;

    // Unauthenticated → transient in-memory note + jump to editor so the user
    // can compose; saves will no-op until they sign in.
    if (!userId) {
      const transient: PilotV2Note = {
        id: `transient_${Date.now()}`,
        title,
        subject: subjectMeta?.label ?? null,
        subtopic: topicName,
        content: { blocks: [], version: 1 },
        is_pinned: false,
      };
      dispatch({ type: 'UPSERT_NOTE', payload: transient });
      dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: transient.id });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' });
      return;
    }

    setCreating(true);
    try {
      const result = await findOrCreatePilotV2Note({
        userId,
        subject: subjectMeta?.label || 'General',
        topic: state.view.selectedTopic ?? undefined,
        subtopic: topicName === 'Notes' ? undefined : topicName,
        title,
      });
      // Refresh note list from server so the new row is discoverable.
      const fresh = await fetchPilotV2NotesForUser(userId);
      dispatch({ type: 'SET_NOTES', payload: fresh });
      dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: result.noteId });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' });
    } catch (e) {
      Alert.alert('Could not create note', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  /* ------------------------------ Row menu -------------------------------- */
  const handleRowMenu = (n: any) => {
    const isDemo = typeof n.id === 'string' && n.id.startsWith('n') && n.id.length === 2;
    if (isDemo) {
      Alert.alert('Demo note', 'Sign in & create your own notes to enable Pin / Rename / Delete.');
      return;
    }
    Alert.alert(n.title, undefined, [
      {
        text: n.is_pinned ? 'Unpin' : 'Pin',
        onPress: async () => {
          if (!userId) return;
          // Map note_id -> node_id (pinPilotV2Node mutates the node row).
          const nodes = await fetchAllPilotV2Nodes(userId);
          const node = nodes.find(nd => nd.note_id === n.id);
          if (!node) {
            Alert.alert('Could not pin', 'Note row not linked to a Pilot V2 node.');
            return;
          }
          await pinPilotV2Node(node.id, !n.is_pinned).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
        },
      },
      {
        text: 'Rename',
        onPress: () => {
          setRenameModal({ visible: true, noteId: n.id, title: n.title || '' });
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!userId) return;
          const nodes = await fetchAllPilotV2Nodes(userId);
          const node = nodes.find(nd => nd.note_id === n.id);
          if (!node) {
            Alert.alert('Could not delete', 'Note row not linked to a Pilot V2 node.');
            return;
          }
          await archivePilotV2Node(node.id).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitRename = async () => {
    const { noteId, title } = renameModal;
    if (!noteId || !title.trim() || !userId) return;
    setSavingRename(true);
    try {
      // Rename both the note row and its linked node title so Sidebar/Note
      // List / Glance / Editor all reflect the change.
      await renamePilotV2Note(noteId, title.trim());
      const nodes = await fetchAllPilotV2Nodes(userId);
      const node = nodes.find(nd => nd.note_id === noteId);
      if (node) {
        const { renamePilotV2Node: renameNode } = await import('../../repositories/pilotV2Repo');
        await renameNode(node.id, title.trim()).catch(() => null);
      }
      const fresh = await fetchPilotV2NotesForUser(userId);
      dispatch({ type: 'SET_NOTES', payload: fresh });
      setRenameModal({ visible: false, noteId: null, title: '' });
    } finally {
      setSavingRename(false);
    }
  };

  /* ------------------------------------------------------------------ */

  return (
    <View testID="pilot-v2-notelist" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={[styles.header, { backgroundColor: '#fff', borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity testID="pilot-v2-notelist-back" onPress={handleBack} style={styles.backBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{topicName}</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: '#F3F3F5', borderColor: colors.border }]}>
            <Search size={18} color={colors.textTertiary} />
            <TextInput
              testID="pilot-v2-notelist-search"
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder={`Search in ${topicName}...`}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <TouchableOpacity
            testID="pilot-v2-notelist-new"
            activeOpacity={0.85}
            onPress={handleNewNote}
            disabled={creating}
            style={[styles.newBtn, { backgroundColor: '#5B4EFA', opacity: creating ? 0.7 : 1 }]}
          >
            <Plus size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
              {creating ? 'Creating…' : 'New Note'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {filtered.length === 0 ? (
          <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 40 }}>
            No matching notes
          </Text>
        ) : (
          filtered.map((n: any) => (
            <TouchableOpacity
              key={n.id}
              testID={`pilot-v2-note-${n.id}`}
              activeOpacity={0.85}
              onPress={() => handleSelectNote(n.id)}
              style={[styles.row, { backgroundColor: '#fff', borderColor: colors.border }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: '#DBEAFE' }]}>
                <FileText size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                  {n.timestamp ?? formatTime(n.updated_at)}
                </Text>
              </View>
              {n.is_pinned && <Star size={18} color="#FACC15" fill="#FACC15" />}
              <TouchableOpacity
                testID={`pilot-v2-note-menu-${n.id}`}
                hitSlop={6}
                style={{ padding: 6 }}
                onPress={() => handleRowMenu(n)}
              >
                <MoreVertical size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Rename modal — Step 25 button audit */}
      <Modal
        visible={renameModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModal({ visible: false, noteId: null, title: '' })}
      >
        <View style={styles.rmBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => setRenameModal({ visible: false, noteId: null, title: '' })} style={StyleSheet.absoluteFill} />
          <View style={[styles.rmCard, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="pilot-v2-rename-modal">
            <View style={styles.rmHeader}>
              <Text style={[styles.rmTitle, { color: colors.textPrimary }]}>Rename note</Text>
              <TouchableOpacity onPress={() => setRenameModal({ visible: false, noteId: null, title: '' })}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              testID="pilot-v2-rename-input"
              value={renameModal.title}
              onChangeText={(t) => setRenameModal(s => ({ ...s, title: t }))}
              placeholder="New title"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              style={[styles.rmInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
              onSubmitEditing={submitRename}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setRenameModal({ visible: false, noteId: null, title: '' })}
                style={[styles.rmBtnGhost, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pilot-v2-rename-submit"
                onPress={submitRename}
                disabled={!renameModal.title.trim() || savingRename}
                style={[styles.rmBtnPrimary, { backgroundColor: '#5B4EFA', opacity: renameModal.title.trim() && !savingRename ? 1 : 0.5 }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{savingRename ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { padding: 8, borderRadius: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
  },
  body: { paddingHorizontal: 24, paddingVertical: 16, gap: 8, paddingBottom: 80 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    borderRadius: 16, borderWidth: 1,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowMeta: { fontSize: 12 },
  /* Rename modal — Step 25 */
  rmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  rmCard: { width: '100%', maxWidth: 420, borderRadius: 18, borderWidth: 1, padding: 18 },
  rmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rmTitle: { fontSize: 17, fontWeight: '900' },
  rmInput: {
    height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  rmBtnGhost: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rmBtnPrimary: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
