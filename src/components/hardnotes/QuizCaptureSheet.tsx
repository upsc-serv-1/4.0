/**
 * QuizCaptureSheet — Notability-style "Smart Capture" bottom sheet.
 *
 * Shown when the user taps "Hardnotes" inside the Unified Quiz Engine. Renders the
 * current quiz explanation in a scrollable, selectable TextInput (multiline) so the
 * user can highlight only the slice they care about. We listen to onSelectionChange
 * to extract the selected substring.
 *
 * Two CTAs:
 *   - "Send Selection"  → push only the highlighted slice
 *   - "Send Full"       → fall back to entire explanation
 *
 * On commit we forward the chosen markdown to the parent via onCommit(text). The
 * parent (quiz engine) is responsible for creating the Hardnote (folder pick + create)
 * — but for convenience this sheet also exposes a built-in folder picker when
 * `userId` is provided.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import {
  X,
  Sparkles,
  ArrowRight,
  Folder,
  FolderOpen,
  Home,
  ChevronRight,
  ChevronDown,
  TextCursorInput,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { HardnotesService, HardNode, isFolder } from '../../services/HardnotesService';

interface Props {
  visible: boolean;
  userId: string;
  explanationMarkdown: string;
  suggestedTitle?: string;
  onClose: () => void;
}

export function QuizCaptureSheet({
  visible,
  userId,
  explanationMarkdown,
  suggestedTitle,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [title, setTitle] = useState<string>(suggestedTitle || 'Quiz Note');
  const [pickedFolderId, setPickedFolderId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<HardNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(suggestedTitle || 'Quiz Note');
    setSelection({ start: 0, end: 0 });
    setPickedFolderId(null);
    (async () => {
      try {
        setLoading(true);
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
  const rootFolders = (tree.get(null) || []).filter(isFolder);

  const selectedSlice = useMemo(() => {
    const { start, end } = selection;
    if (end <= start) return '';
    return explanationMarkdown.slice(start, end).trim();
  }, [selection, explanationMarkdown]);

  const commit = async (useSelection: boolean) => {
    const payload = useSelection && selectedSlice ? selectedSlice : explanationMarkdown;
    if (!payload.trim()) {
      Alert.alert('Nothing to send', 'Highlight some text or use “Send Full”.');
      return;
    }
    setCreating(true);
    try {
      const { note } = await HardnotesService.createNote(userId, title.trim() || 'Quiz Note', pickedFolderId, {
        baseLayer: { markdown: payload, source: 'quiz_explanation' },
      });
      setCreating(false);
      onClose();
      router.push({
        pathname: '/hardnotes/editor',
        params: {
          noteId: note.id,
          title: note.title,
          baseLayer: JSON.stringify({ markdown: payload, source: 'quiz_explanation' }),
        },
      } as any);
    } catch (e: any) {
      setCreating(false);
      Alert.alert('Could not send', e?.message || '');
    }
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderFolder = (n: HardNode, depth: number) => {
    if (!isFolder(n)) return null;
    const kids = (tree.get(n.id) || []).filter(isFolder);
    const isOpen = expanded.has(n.id);
    const sel = pickedFolderId === n.id;
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
            sel && { backgroundColor: colors.primary + '18', borderLeftColor: colors.primary },
            !sel && { borderLeftColor: 'transparent' },
          ]}
          data-testid={`qcap-folder-${n.id}`}
        >
          <View style={s.chev}>
            {kids.length > 0 ? (
              isOpen ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />
            ) : <View style={{ width: 14 }} />}
          </View>
          {isOpen ? <FolderOpen size={16} color={sel ? colors.primary : '#f59e0b'} /> :
            <Folder size={16} color={sel ? colors.primary : '#f59e0b'} />}
          <Text numberOfLines={1} style={[s.rowLabel, { color: sel ? colors.primary : colors.textPrimary }]}>
            {n.title}
          </Text>
        </TouchableOpacity>
        {isOpen && kids.map((k) => renderFolder(k, depth + 1))}
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[s.sheet, { backgroundColor: colors.surface }]}
            data-testid="qcap-sheet"
          >
            <View style={s.handle} />

            <View style={s.head}>
              <View style={[s.headIcon, { backgroundColor: colors.primary + '18' }]}>
                <Sparkles size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.headTitle, { color: colors.textPrimary }]}>Smart Capture → Hardnotes</Text>
                <Text style={[s.headSub, { color: colors.textTertiary }]}>
                  Highlight only what you want to keep. The selection becomes a locked base layer on a new canvas.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={[s.closeBtn, { backgroundColor: colors.border + '40' }]}>
                <X size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={[s.titleWrap, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Note title"
                placeholderTextColor={colors.textTertiary}
                style={[s.titleInput, { color: colors.textPrimary }]}
                data-testid="qcap-title"
              />
            </View>

            {/* Selectable explanation */}
            <View style={[s.explWrap, { backgroundColor: '#fff7d6' }]} data-testid="qcap-expl">
              <View style={s.explHead}>
                <Text style={s.explBadge}>QUIZ EXPLANATION</Text>
                <View style={s.selChip}>
                  <TextCursorInput size={11} color="#92400e" />
                  <Text style={s.selChipTxt}>{selectedSlice ? `${selectedSlice.length} chars selected` : 'tap & drag to highlight'}</Text>
                </View>
              </View>
              <ScrollView style={{ maxHeight: 220 }}>
                <TextInput
                  ref={inputRef}
                  value={explanationMarkdown}
                  multiline
                  editable={false}
                  selection={undefined}
                  onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                  style={s.explBody}
                  data-testid="qcap-text"
                  // Required so iOS/Android allow text selection in non-editable input.
                  contextMenuHidden={false}
                  // @ts-ignore — selectTextOnFocus avoids accidental cursor jumps
                  selectTextOnFocus={false}
                />
              </ScrollView>
            </View>

            {/* Folder picker */}
            <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>DESTINATION FOLDER</Text>
            <View style={[s.folderBox, { borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 160 }}>
                <TouchableOpacity
                  onPress={() => setPickedFolderId(null)}
                  style={[
                    s.row,
                    { paddingLeft: 12 },
                    pickedFolderId === null && { backgroundColor: colors.primary + '18', borderLeftColor: colors.primary },
                    pickedFolderId !== null && { borderLeftColor: 'transparent' },
                  ]}
                  data-testid="qcap-root"
                >
                  <View style={s.chev}><View style={{ width: 14 }} /></View>
                  <Home size={16} color={pickedFolderId === null ? colors.primary : colors.textSecondary} />
                  <Text style={[s.rowLabel, { color: pickedFolderId === null ? colors.primary : colors.textPrimary }]}>
                    All Notes (Root)
                  </Text>
                </TouchableOpacity>
                {loading ? (
                  <View style={{ padding: 20, alignItems: 'center' }}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : rootFolders.length === 0 ? (
                  <Text style={[s.emptyHint, { color: colors.textTertiary }]}>
                    No folders yet — long-press a folder in the sidebar to create children, or tap “New Folder at Root”.
                  </Text>
                ) : (
                  rootFolders.map((n) => renderFolder(n, 0))
                )}
              </ScrollView>
            </View>

            {/* CTAs */}
            <View style={s.ctaRow}>
              <TouchableOpacity
                onPress={() => commit(false)}
                disabled={creating}
                style={[s.ctaSecondary, { borderColor: colors.border }]}
                data-testid="qcap-send-full"
              >
                <Text style={[s.ctaSecTxt, { color: colors.textPrimary }]}>Send Full</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => commit(true)}
                disabled={creating || !selectedSlice}
                style={[s.ctaPrimary, { backgroundColor: colors.primary, opacity: creating || !selectedSlice ? 0.5 : 1 }]}
                data-testid="qcap-send-selection"
              >
                {creating ? (
                  <ActivityIndicator color={colors.buttonText} />
                ) : (
                  <>
                    <Text style={[s.ctaPrimTxt, { color: colors.buttonText }]}>Send Selection</Text>
                    <ArrowRight size={16} color={colors.buttonText} strokeWidth={3} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    height: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    gap: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    marginBottom: 4,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  headIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headTitle: { fontSize: 16, fontWeight: '900' },
  headSub: { fontSize: 11, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  titleWrap: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42, justifyContent: 'center' },
  titleInput: { fontSize: 14, fontWeight: '800' },

  explWrap: { borderRadius: 16, padding: 12, gap: 6 },
  explHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  explBadge: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#92400e' },
  selChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  selChipTxt: { fontSize: 10, fontWeight: '900', color: '#92400e' },
  explBody: {
    fontSize: 13,
    lineHeight: 19,
    color: '#713f12',
    fontWeight: '600',
    minHeight: 80,
    padding: 0,
    textAlignVertical: 'top',
  },

  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 4 },
  folderBox: { borderWidth: 1, borderRadius: 12, paddingVertical: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingRight: 12,
    borderLeftWidth: 3,
    marginBottom: 1,
  },
  chev: { width: 14, alignItems: 'center' },
  rowLabel: { fontSize: 13, flex: 1, fontWeight: '700' },
  emptyHint: { fontSize: 11, fontWeight: '700', padding: 14, textAlign: 'center' },

  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ctaSecondary: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ctaSecTxt: { fontSize: 13, fontWeight: '900' },
  ctaPrimary: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  ctaPrimTxt: { fontSize: 13, fontWeight: '900' },
});