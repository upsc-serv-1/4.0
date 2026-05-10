/**
 * Pilot V2 — Note List
 *
 * Adds:
 * - Trash-aware filtering (archived notes hidden unless in Trash mode)
 * - Multi-select + bulk actions (Trash / Restore / Pin / Unpin / Delete permanently)
 * - Single-item swipe: Trash (normal) / Delete permanently (trash)
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Modal,
  Platform,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { ChevronLeft, Search, Plus, FileText, Star, MoreVertical, X, Trash2, CheckSquare } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  findOrCreatePilotV2Note,
  renamePilotV2Note,
  archivePilotV2Node,
  restorePilotV2Node,
  purgePilotV2NoteNode,
  pinPilotV2Node,
  fetchAllPilotV2Nodes,
  fetchPilotV2NotesForUser,
} from '../../repositories/pilotV2Repo';
import { PILOT_V2_SUBJECT_PALETTE, PilotV2Note } from './types';
import { SUBJECT_TOPICS } from './PilotV2SidebarSubject';

const formatTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (isYesterday) return 'Yesterday';
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString();
};

const SUBTOPIC_LABELS: Record<string, string> = {
  preamble: 'Preamble',
  'right-to-equality': 'Right to Equality',
  'right-to-freedom': 'Right to Freedom',
  exploitation: 'Right against Exploitation',
  'religious-freedom': 'Right to Freedom of Religion',
  'cultural-rights': 'Cultural & Educational Rights',
  'constitutional-remedies': 'Right to Constitutional Remedies',
};

const normalize = (v: string) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export function PilotV2NoteList() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { state, dispatch } = usePilotV2();

  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});

  const [renameModal, setRenameModal] = useState<{ visible: boolean; noteId: string | null; title: string }>({
    visible: false,
    noteId: null,
    title: '',
  });
  const [savingRename, setSavingRename] = useState(false);

  const subtopicId = state.view.selectedSubtopic;
  const subjectId = state.view.selectedSubject;
  const selectedTopicId = state.view.selectedTopic;
  /** True when sidebar stored the topic id in both fields (leaf topic with no subtopics). */
  const subtopicIsTopicLeaf =
    !!state.view.selectedSubtopic &&
    !!selectedTopicId &&
    state.view.selectedSubtopic === selectedTopicId;
  const hasRealSubtopic = !!state.view.selectedSubtopic && !subtopicIsTopicLeaf;

  const topicName = useMemo(() => {
    if (subtopicIsTopicLeaf && selectedTopicId) {
      const staticTopics = SUBJECT_TOPICS[subjectId ?? ''] ?? [];
      const topicObj = staticTopics.find(t => t.id === selectedTopicId);
      return topicObj?.label || selectedTopicId.replace(/-/g, ' ');
    }
    if (!subtopicId) return 'Notes';
    return (
      SUBTOPIC_LABELS[subtopicId] ??
      (typeof subtopicId === 'string' ? (subtopicId.includes(' ') ? subtopicId : subtopicId.replace(/-/g, ' ')) : 'Notes')
    );
  }, [subtopicId, subtopicIsTopicLeaf, selectedTopicId, subjectId]);
  const subjectMeta = useMemo(() => {
    if (!subjectId) return null;
    const matchedNote = state.notes.find(
      n => n.subject && n.subject.toLowerCase().replace(/[^a-z0-9]/g, '-') === subjectId.toLowerCase()
    );
    if (matchedNote && matchedNote.subject) {
      return {
        id: subjectId,
        label: matchedNote.subject,
      };
    }
    return {
      id: subjectId,
      label: subjectId.charAt(0).toUpperCase() + subjectId.slice(1).replace(/-/g, ' '),
    };
  }, [subjectId, state.notes]);
  const quickFilter = state.view.quickFilter;
  const isTrashMode = quickFilter === 'trash';

  const globalSearch = state.view.search;

  const selectedList = useMemo(() => Object.keys(selectedIds).filter(id => selectedIds[id]), [selectedIds]);

  const clearSelection = () => {
    setSelectMode(false);
    setSelectedIds({});
  };

  const toggleSelected = (noteId: string) => {
    setSelectedIds(prev => {
      const next = { ...prev, [noteId]: !prev[noteId] };
      if (!next[noteId]) delete next[noteId];
      return next;
    });
  };

  const refreshNotes = async () => {
    if (!userId) return;
    const fresh = await fetchPilotV2NotesForUser(userId);
    dispatch({ type: 'SET_NOTES', payload: fresh });
  };

  const bulkWithNodes = async (): Promise<Array<{ nodeId: string; noteId: string | null }>> => {
    if (!userId) return [];
    const nodes = await fetchAllPilotV2Nodes(userId, true);
    const byNoteId = new Map(nodes.filter(n => n.note_id).map(n => [n.note_id as string, n]));
    return selectedList
      .map(id => byNoteId.get(id))
      .filter(Boolean)
      .map((node: any) => ({ nodeId: node.id as string, noteId: node.note_id as string }));
  };

  const bulkMoveToTrash = async () => {
    if (!userId || selectedList.length === 0) return;
    const items = await bulkWithNodes();
    await Promise.all(items.map(i => archivePilotV2Node(i.nodeId).catch(() => null)));
    await refreshNotes();
    clearSelection();
  };

  const bulkRestore = async () => {
    if (!userId || selectedList.length === 0) return;
    const items = await bulkWithNodes();
    await Promise.all(items.map(i => restorePilotV2Node(i.nodeId).catch(() => null)));
    await refreshNotes();
    clearSelection();
  };

  const bulkPin = async (pinned: boolean) => {
    if (!userId || selectedList.length === 0) return;
    const items = await bulkWithNodes();
    await Promise.all(items.map(i => pinPilotV2Node(i.nodeId, pinned).catch(() => null)));
    await refreshNotes();
    clearSelection();
  };

  const bulkDeletePermanently = async () => {
    if (!userId || selectedList.length === 0) return;
    const items = await bulkWithNodes();
    await Promise.all(items.map(i => purgePilotV2NoteNode({ nodeId: i.nodeId, noteId: i.noteId }).catch(() => null)));
    await refreshNotes();
    clearSelection();
  };

  const notes = useMemo(() => {
    let filteredList = [...state.notes];

    if (subjectMeta) {
      filteredList = filteredList.filter(n => n.subject && n.subject.toLowerCase() === subjectMeta.label.toLowerCase());
    }

    if (selectedTopicId && !hasRealSubtopic) {
      const subjId = state.view.selectedSubject;
      const staticTopics = SUBJECT_TOPICS[subjId ?? ''] ?? [];
      const topicObj = staticTopics.find(t => t.id === selectedTopicId);
      const activeTopicLabel = topicObj?.label || selectedTopicId.replace(/-/g, ' ');
      const activeTopicNorm = normalize(activeTopicLabel);
      const selectedTopicNorm = normalize(selectedTopicId);

      filteredList = filteredList.filter(
        n => {
          const topicNorm = normalize(n.topic || '');
          return topicNorm === activeTopicNorm || topicNorm === selectedTopicNorm;
        }
      );
    }

    if (hasRealSubtopic) {
      const sid = state.view.selectedSubtopic!;
      const subtopicTitle =
        SUBTOPIC_LABELS[sid] ??
        (sid.includes(' ') ? sid : sid.replace(/-/g, ' '));
      filteredList = filteredList.filter(
        n =>
          n.subtopic &&
          n.subtopic.toLowerCase() === String(subtopicTitle).toLowerCase()
      );
    }

    filteredList = filteredList.filter(n => (isTrashMode ? !!n.is_archived : !n.is_archived));
    return filteredList;
  }, [
    state.notes,
    state.view.selectedSubtopic,
    hasRealSubtopic,
    subtopicIsTopicLeaf,
    isTrashMode,
    subjectMeta,
    selectedTopicId,
    state.view.selectedSubject,
  ]);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase();
    const gs = (globalSearch || '').toLowerCase();
    if (!q && !gs) return notes;
    // Step 8 — search across note titles AND block contents.
    const matchesNote = (n: any, term: string): boolean => {
      if (!term) return true;
      if ((n.title || '').toLowerCase().includes(term)) return true;
      const blocks = n?.content?.blocks || [];
      for (const b of blocks) {
        if (typeof b?.text === 'string' && b.text.toLowerCase().includes(term)) return true;
      }
      return false;
    };
    return notes.filter(n => matchesNote(n, q) && matchesNote(n, gs));
  }, [notes, query, globalSearch]);

  const handleSelectNote = (id: string) => {
    if (selectMode) {
      toggleSelected(id);
      return;
    }
    dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: id });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
  };

  const handleBack = () => {
    if (selectMode) {
      clearSelection();
      return;
    }
    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'subject' });
  };

  const handleNewNote = async () => {
    if (creating) return;
    const title = `Untitled note · ${new Date().toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`;

    if (!userId) {
      const transient: PilotV2Note = {
        id: `transient_${Date.now()}`,
        title,
        subject: subjectMeta?.label ?? null,
        subtopic: topicName,
        content: { blocks: [], version: 1 },
        is_pinned: false,
        is_archived: false,
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
        subjectTitle: subjectMeta?.label ?? 'General',
        topicTitle: subjectMeta?.label ?? 'General',
        subtopicTitle: topicName,
        noteTitle: title,
      });
      if (!result) throw new Error('Could not create note');
      await refreshNotes();
      dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: result.noteId });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' });
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const submitRename = async () => {
    if (!userId || !renameModal.noteId || savingRename) return;
    const title = renameModal.title.trim();
    if (!title) return;
    setSavingRename(true);
    try {
      await renamePilotV2Note(renameModal.noteId, title);
      const nodes = await fetchAllPilotV2Nodes(userId, true);
      const node = nodes.find(nd => nd.note_id === renameModal.noteId);
      if (node) {
        const { renamePilotV2Node } = await import('../../repositories/pilotV2Repo');
        await renamePilotV2Node(node.id, title).catch(() => null);
      }
      await refreshNotes();
      setRenameModal({ visible: false, noteId: null, title: '' });
    } finally {
      setSavingRename(false);
    }
  };

  const handleRowMenu = (n: PilotV2Note) => {
    Alert.alert(n.title, undefined, [
      ...(isTrashMode
        ? [
            {
              text: 'Restore',
              onPress: async () => {
                if (!userId) return;
                const nodes = await fetchAllPilotV2Nodes(userId, true);
                const node = nodes.find(nd => nd.note_id === n.id);
                if (!node) return;
                await restorePilotV2Node(node.id).catch(() => null);
                await refreshNotes();
              },
            },
            {
              text: 'Delete permanently',
              style: 'destructive' as const,
              onPress: async () => {
                if (!userId) return;
                const nodes = await fetchAllPilotV2Nodes(userId, true);
                const node = nodes.find(nd => nd.note_id === n.id);
                if (!node) return;
                await purgePilotV2NoteNode({ nodeId: node.id, noteId: node.note_id }).catch(() => null);
                await refreshNotes();
              },
            },
          ]
        : [
            {
              text: n.is_pinned ? 'Unpin' : 'Pin',
              onPress: async () => {
                if (!userId) return;
                const nodes = await fetchAllPilotV2Nodes(userId, true);
                const node = nodes.find(nd => nd.note_id === n.id);
                if (!node) return;
                await pinPilotV2Node(node.id, !n.is_pinned).catch(() => null);
                await refreshNotes();
              },
            },
            {
              text: 'Rename',
              onPress: () => setRenameModal({ visible: true, noteId: n.id, title: n.title }),
            },
            {
              text: 'Move to Trash',
              style: 'destructive' as const,
              onPress: async () => {
                if (!userId) return;
                const nodes = await fetchAllPilotV2Nodes(userId, true);
                const node = nodes.find(nd => nd.note_id === n.id);
                if (!node) return;
                await archivePilotV2Node(node.id).catch(() => null);
                await refreshNotes();
              },
            },
          ]),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderSwipeDelete = (n: PilotV2Note) => {
    const handle = async () => {
      if (!userId) return;
      if (isTrashMode) {
        Alert.alert('Delete permanently', `Permanently delete "${n.title}"?`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              const nodes = await fetchAllPilotV2Nodes(userId, true);
              const node = nodes.find(nd => nd.note_id === n.id);
              if (!node) return;
              await purgePilotV2NoteNode({ nodeId: node.id, noteId: node.note_id }).catch(() => null);
              await refreshNotes();
            },
          },
        ]);
        return;
      }

      Alert.alert('Move to Trash', `Move "${n.title}" to Trash? You can restore it later.`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          style: 'destructive',
          onPress: async () => {
            const nodes = await fetchAllPilotV2Nodes(userId, true);
            const node = nodes.find(nd => nd.note_id === n.id);
            if (!node) return;
            await archivePilotV2Node(node.id).catch(() => null);
            await refreshNotes();
          },
        },
      ]);
    };

    return (progress: any, dragX: any) => {
      const trans = dragX.interpolate({
        inputRange: [-70, 0],
        outputRange: [0, 70],
        extrapolate: 'clamp',
      });
      return (
        <Animated.View style={{ transform: [{ translateX: trans }], width: 70 }}>
          <TouchableOpacity
            onPress={handle}
            style={{
              backgroundColor: '#ef4444',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%',
              borderRadius: 12,
              marginVertical: 4,
            }}
          >
            <Trash2 size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      );
    };
  };

  const renderGridView = () => (
    <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }}>
      {filtered.map((n: any) => {
        const selected = !!selectedIds[n.id];
        return (
          <TouchableOpacity
            key={n.id}
            testID={`pilot-v2-note-grid-${n.id}`}
            activeOpacity={0.85}
            onPress={() => handleSelectNote(n.id)}
            style={[
              {
                width: '48%',
                backgroundColor: '#fff',
                borderRadius: 12,
                borderWidth: 2,
                borderColor: colors.border,
                padding: 12,
                alignItems: 'center',
              },
              selected ? { borderColor: '#5B4EFA', backgroundColor: '#EEF2FF' } : null,
            ]}
          >
            <View style={[{ backgroundColor: '#DBEAFE', borderRadius: 8, padding: 8, marginBottom: 8 }]}>
              <FileText size={24} color="#2563EB" />
            </View>
            <Text style={[styles.rowTitle, { color: colors.textPrimary, textAlign: 'center' }]} numberOfLines={2}>
              {n.title}
            </Text>
            <Text style={[styles.rowMeta, { color: colors.textTertiary, fontSize: 11 }]}>
              {n.timestamp ?? formatTime(n.updated_at)}
            </Text>
            <View style={{ position: 'absolute', top: 12, right: 12 }}>
              {n.is_pinned && !isTrashMode ? <Star size={14} color="#FACC15" fill="#FACC15" /> : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <View testID="pilot-v2-notelist" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={[styles.header, { backgroundColor: '#fff', borderBottomColor: colors.border }]}>
        {/* Breadcrumb Trail */}
        {(state.view.selectedTopic || state.view.selectedSubtopic) && !isTrashMode && (
          <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {subjectMeta && (
              <TouchableOpacity
                onPress={() => {
                  dispatch({ type: 'SET_SELECTED_TOPIC', payload: null });
                  dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
                }}
              >
                <Text style={{ color: '#5B4EFA', fontSize: 12, fontWeight: '500' }}>
                  {subjectMeta.label}
                </Text>
              </TouchableOpacity>
            )}
            {state.view.selectedTopic && (
              <>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>/</Text>
                <TouchableOpacity
                  onPress={() => {
                    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
                  }}
                >
                  <Text style={{ color: '#5B4EFA', fontSize: 12, fontWeight: '500' }}>
                    {state.view.selectedTopic.replace(/-/g, ' ')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
            {state.view.selectedSubtopic && (
              <>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>/</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{topicName}</Text>
              </>
            )}
          </View>
        )}
        
        <View style={styles.headerTop}>
          <TouchableOpacity testID="pilot-v2-notelist-back" onPress={handleBack} style={styles.backBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{isTrashMode ? 'Trash' : topicName}</Text>
          <View style={{ flex: 1 }} />
          {!selectMode ? (
            <>
              <TouchableOpacity
                testID="pilot-v2-notelist-new"
                activeOpacity={0.85}
                onPress={handleNewNote}
                disabled={creating}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <Plus size={18} color="#5B4EFA" />
                <Text style={{ color: '#5B4EFA', fontSize: 14, fontWeight: '600' }}>New</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pilot-v2-notelist-menu"
                onPress={() => {
                  Alert.alert('View Options', undefined, [
                    {
                      text: viewMode === 'list' ? '✓ View as List' : 'View as List',
                      onPress: () => setViewMode('list'),
                    },
                    {
                      text: viewMode === 'grid' ? '✓ View as Grid' : 'View as Grid',
                      onPress: () => setViewMode('grid'),
                    },
                    {
                      text: 'Select Notes',
                      onPress: () => setSelectMode(true),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
              >
                <MoreVertical size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                testID="pilot-v2-notelist-select-all"
                onPress={() => {
                  const allSelected = filtered.length > 0 && filtered.length === Object.keys(selectedIds).filter(k => selectedIds[k]).length;
                  if (allSelected) {
                    setSelectedIds({});
                  } else {
                    const newIds: Record<string, boolean> = {};
                    filtered.forEach((n: any) => {
                      newIds[n.id] = true;
                    });
                    setSelectedIds(newIds);
                  }
                }}
                style={{ marginRight: 12 }}
              >
                <CheckSquare size={16} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 12 }}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pilot-v2-notelist-cancel-select"
                onPress={clearSelection}
                style={[styles.selectBtn, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 12 }}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {filtered.length === 0 ? (
          <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 40 }}>
            {isTrashMode ? 'Trash is empty' : 'No matching notes'}
          </Text>
        ) : viewMode === 'grid' ? (
          renderGridView()
        ) : (
          filtered.map((n: any) => {
            const selected = !!selectedIds[n.id];
            return (
              <Swipeable
                key={n.id}
                renderRightActions={renderSwipeDelete(n)}
                friction={1.5}
                rightThreshold={30}
                enabled={!selectMode}
              >
                <TouchableOpacity
                  testID={`pilot-v2-note-${n.id}`}
                  activeOpacity={0.85}
                  onPress={() => handleSelectNote(n.id)}
                  onLongPress={() => {
                    setSelectMode(true);
                    setSelectedIds(prev => ({ ...prev, [n.id]: true }));
                  }}
                  delayLongPress={250}
                  style={[
                    styles.row,
                    { backgroundColor: '#fff', borderColor: colors.border },
                    selected ? { borderColor: '#5B4EFA', backgroundColor: '#EEF2FF' } : null,
                  ]}
                >
                  <View style={[styles.rowIcon, { backgroundColor: '#DBEAFE' }]}>
                    <FileText size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {n.title}
                    </Text>
                    <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>{n.timestamp ?? formatTime(n.updated_at)}</Text>
                  </View>
                  {n.is_pinned && !isTrashMode ? <Star size={18} color="#FACC15" fill="#FACC15" /> : null}
                  <TouchableOpacity
                    testID={`pilot-v2-note-menu-${n.id}`}
                    hitSlop={6}
                    style={{ padding: 6 }}
                    onPress={() => {
                      if (selectMode) toggleSelected(n.id);
                      else handleRowMenu(n);
                    }}
                  >
                    <MoreVertical size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </Swipeable>
            );
          })
        )}
      </ScrollView>

      {selectMode ? (
        <View style={[styles.bulkBar, { backgroundColor: '#fff', borderTopColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '800' }}>{selectedList.length} selected</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {isTrashMode ? (
              <>
                <TouchableOpacity onPress={bulkRestore} style={[styles.bulkBtn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={bulkDeletePermanently} style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Delete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => bulkPin(true)} style={[styles.bulkBtn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Pin</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => bulkPin(false)} style={[styles.bulkBtn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Unpin</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={bulkMoveToTrash} style={[styles.bulkBtn, { backgroundColor: '#ef4444' }]}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>Trash</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={clearSelection} style={[styles.bulkBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <Modal
        visible={renameModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModal({ visible: false, noteId: null, title: '' })}
      >
        <View style={styles.rmBackdrop}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => setRenameModal({ visible: false, noteId: null, title: '' })}
            style={StyleSheet.absoluteFill}
          />
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
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0, ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null) },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  body: { paddingHorizontal: 24, paddingVertical: 16, gap: 8, paddingBottom: 120 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowMeta: { fontSize: 12 },
  rmBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  rmCard: { width: '100%', maxWidth: 420, borderRadius: 18, borderWidth: 1, padding: 18 },
  rmHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  rmTitle: { fontSize: 17, fontWeight: '900' },
  rmInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  rmBtnGhost: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rmBtnPrimary: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bulkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  bulkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
});
