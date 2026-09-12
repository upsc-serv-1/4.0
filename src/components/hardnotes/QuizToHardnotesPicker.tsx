/**
 * QuizToHardnotesPicker — bottom-sheet picker used by the quiz engine to
 * push a quiz explanation into a new Hardnotes Note.
 *
 * Flow:
 *   1. User taps "Send to Hardnotes" on an explanation.
 *   2. This sheet lists their folder hierarchy (from user_note_nodes).
 *   3. User picks a destination folder (or Root) and optionally names the note.
 *   4. We create a new user_notes row with a `base_layer` item and a corresponding
 *      user_note_nodes leaf, then route to /notes/pro-editor with the new noteId.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import {
  X,
  Folder,
  FolderOpen,
  Home,
  ChevronRight,
  ChevronDown,
  Sparkles,
  ArrowRight,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  HardnotesService,
  HardNode,
  isFolder,
} from '../../services/HardnotesService';

interface Props {
  visible: boolean;
  userId: string;
  explanationMarkdown: string;
  suggestedTitle?: string;
  onClose: () => void;
}

export function QuizToHardnotesPicker({
  visible,
  userId,
  explanationMarkdown,
  suggestedTitle,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const [nodes, setNodes] = useState<HardNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [pickedFolderId, setPickedFolderId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(suggestedTitle || 'Quiz Note');
    setPickedFolderId(null);
    (async () => {
      try {
        setLoading(true);
        await HardnotesService.seedUpscSkeleton(userId);
        const list = await HardnotesService.listNodes(userId);
        setNodes(list);
      } catch (e: any) {
        Alert.alert('Load failed', e?.message || '');
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, userId, suggestedTitle]);

  const tree = useMemo(() => HardnotesService.buildTree(nodes), [nodes]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commit = async () => {
    setCreating(true);
    try {
      const { note } = await HardnotesService.createNote(
        userId,
        title.trim() || 'Quiz Note',
        pickedFolderId,
        { baseLayer: { markdown: explanationMarkdown, source: 'quiz_explanation' } }
      );
      setCreating(false);
      onClose();
      router.push({
        pathname: '/notes/pro-editor',
        params: {
          noteId: note.id,
          title: note.title,
          baseLayer: JSON.stringify({ markdown: explanationMarkdown, source: 'quiz_explanation' }),
        },
      } as any);
    } catch (e: any) {
      setCreating(false);
      Alert.alert('Could not send', e?.message || '');
    }
  };

  const renderFolder = (n: HardNode, depth: number) => {
    if (!isFolder(n)) return null;
    const kids = (tree.get(n.id) || []).filter(isFolder);
    const isOpen = expanded.has(n.id);
    const selected = pickedFolderId === n.id;

    return (
      <View key={n.id}>
        <TouchableOpacity
          onPress={() => {
            setPickedFolderId(n.id);
            if (kids.length > 0) toggle(n.id);
          }}
          style={[
            s.row,
            { paddingLeft: 12 + depth * 18 },
            selected && { backgroundColor: colors.primary + '18', borderLeftColor: colors.primary },
            !selected && { borderLeftColor: 'transparent' },
          ]}
          data-testid={`q2hn-folder-${n.id}`}
        >
          <View style={s.chev}>
            {kids.length > 0 ? (
              isOpen ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />
            ) : (
              <View style={{ width: 14 }} />
            )}
          </View>
          {isOpen ? (
            <FolderOpen size={16} color={selected ? colors.primary : '#f59e0b'} />
          ) : (
            <Folder size={16} color={selected ? colors.primary : '#f59e0b'} />
          )}
          <Text
            numberOfLines={1}
            style={[
              s.rowLabel,
              { color: selected ? colors.primary : colors.textPrimary, fontWeight: selected ? '900' : '700' },
            ]}
          >
            {n.title}
          </Text>
        </TouchableOpacity>
        {isOpen && kids.map((k) => renderFolder(k, depth + 1))}
      </View>
    );
  };

  const rootFolders = (tree.get(null) || []).filter(isFolder);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[s.sheet, { backgroundColor: colors.surface }]}
          data-testid="q2hn-sheet"
        >
          <View style={s.head}>
            <View style={[s.headIcon, { backgroundColor: colors.primary + '18' }]}>
              <Sparkles size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.headTitle, { color: colors.textPrimary }]}>Send to Hardnotes</Text>
              <Text style={[s.headSub, { color: colors.textTertiary }]}>
                Creates a new note with this explanation as a locked base layer.
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.border + '40' }]}>
              <X size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={[s.titleWrap, { borderColor: colors.border, backgroundColor: colors.bg }]}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Note title"
              placeholderTextColor={colors.textTertiary}
              style={[s.titleInput, { color: colors.textPrimary }]}
              data-testid="q2hn-title"
            />
          </View>

          <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>PICK DESTINATION FOLDER</Text>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 6 }}>
            <TouchableOpacity
              onPress={() => setPickedFolderId(null)}
              style={[
                s.row,
                { paddingLeft: 12 },
                pickedFolderId === null && { backgroundColor: colors.primary + '18', borderLeftColor: colors.primary },
                pickedFolderId !== null && { borderLeftColor: 'transparent' },
              ]}
              data-testid="q2hn-root"
            >
              <View style={s.chev}><View style={{ width: 14 }} /></View>
              <Home size={16} color={pickedFolderId === null ? colors.primary : colors.textSecondary} />
              <Text style={[s.rowLabel, { color: pickedFolderId === null ? colors.primary : colors.textPrimary, fontWeight: pickedFolderId === null ? '900' : '700' }]}>
                All Notes (Root)
              </Text>
            </TouchableOpacity>

            {loading ? (
              <View style={{ padding: 40, alignItems: 'center' }}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              rootFolders.map((n) => renderFolder(n, 0))
            )}
          </ScrollView>

          <TouchableOpacity
            onPress={commit}
            disabled={creating}
            style={[s.cta, { backgroundColor: colors.primary, opacity: creating ? 0.7 : 1 }]}
            data-testid="q2hn-send"
          >
            {creating ? (
              <ActivityIndicator color={colors.buttonText} />
            ) : (
              <>
                <Text style={[s.ctaText, { color: colors.buttonText }]}>Send & Open Canvas</Text>
                <ArrowRight size={16} color={colors.buttonText} strokeWidth={3} />
              </>
            )}
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { height: '85%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  headIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 18, fontWeight: '900' },
  headSub: { fontSize: 11, fontWeight: '700' },
  closeBtn: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  titleInput: { fontSize: 14, fontWeight: '800' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 4, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
    borderLeftWidth: 3,
    marginBottom: 2,
  },
  chev: { width: 14, alignItems: 'center' },
  rowLabel: { fontSize: 13, flex: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  ctaText: { fontSize: 14, fontWeight: '900' },
});
