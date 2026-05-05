/**
 * Hardnotes Hub — dual-pane home screen for the premium note ecosystem.
 * Left pane: collapsible folder tree (user_note_nodes, type='folder')
 * Right pane: grid of child folders + notes for the selected folder.
 *
 * Terminology (enforced in UI):
 *   Folder  →  container
 *   Note    →  leaf drawing/point document (user_notes)
 *   Points  →  items inside a Note (text, checklist, stroke, base_layer)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Plus, Search, Settings, ChevronRight, Home, Sparkles, X, Folder, FileText } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { HardnotesService, HardNode, HardNote, isFolder, isLeaf } from '../../src/services/HardnotesService';
import { HardnotesSidebar } from '../../src/components/hardnotes/HardnotesSidebar';
import { NotesGrid } from '../../src/components/hardnotes/NotesGrid';

export default function Hardnotes() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { width: winW } = useWindowDimensions();
  const isTablet = winW >= 760;
  const sidebarWidth = isTablet ? 280 : Math.min(260, winW * 0.78);

  const [nodes, setNodes] = useState<HardNode[]>([]);
  const [notesById, setNotesById] = useState<Map<string, HardNote>>(new Map());
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [newNoteInputVisible, setNewNoteInputVisible] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [creatingNote, setCreatingNote] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    try {
      await HardnotesService.seedUpscSkeleton(userId);
      const [nodeList, noteList] = await Promise.all([
        HardnotesService.listNodes(userId),
        HardnotesService.listNotes(userId),
      ]);
      setNodes(nodeList);
      const map = new Map<string, HardNote>();
      noteList.forEach((n) => map.set(n.id, n));
      setNotesById(map);
    } catch (e: any) {
      console.error('Hardnotes refresh error:', e);
      Alert.alert('Load failed', e?.message || 'Could not load Hardnotes');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const tree = useMemo(() => HardnotesService.buildTree(nodes), [nodes]);

  const breadcrumb = useMemo(() => HardnotesService.ancestorPath(nodes, selectedFolderId), [nodes, selectedFolderId]);

  const childFolders = useMemo(() => {
    if (selectedFolderId === null) {
      // Show all root folders on "All Notes" home
      return (tree.get(null) || []).filter(isFolder);
    }
    return (tree.get(selectedFolderId) || []).filter(isFolder);
  }, [tree, selectedFolderId]);

  const childNotes = useMemo(() => {
    if (selectedFolderId === null) {
      // "All Notes" view: surface every leaf note the user owns
      return nodes.filter(isLeaf);
    }
    return (tree.get(selectedFolderId) || []).filter(isLeaf);
  }, [tree, nodes, selectedFolderId]);

  const filteredChildFolders = useMemo(() => {
    if (!globalQuery.trim()) return childFolders;
    const q = globalQuery.trim().toLowerCase();
    return childFolders.filter((f) => f.title.toLowerCase().includes(q));
  }, [childFolders, globalQuery]);

  const filteredChildNotes = useMemo(() => {
    if (!globalQuery.trim()) return childNotes;
    const q = globalQuery.trim().toLowerCase();
    return childNotes.filter((f) => f.title.toLowerCase().includes(q));
  }, [childNotes, globalQuery]);

  const createNote = async () => {
    if (!userId) return;
    const title = newNoteTitle.trim() || `Untitled Note`;
    setCreatingNote(true);
    try {
      const { node, note } = await HardnotesService.createNote(userId, title, selectedFolderId, {});
      setNewNoteTitle('');
      setNewNoteInputVisible(false);
      await refresh();
      router.push({
        pathname: '/hardnotes/editor',
        params: { noteId: note.id, nodeId: node.id, title: note.title },
      } as any);
    } catch (e: any) {
      Alert.alert('Could not create note', e?.message || '');
    } finally {
      setCreatingNote(false);
    }
  };

  if (!userId) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.centered}>
          <Text style={{ color: colors.textPrimary, fontWeight: '800' }}>Sign in to use Hardnotes</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentFolderTitle =
    selectedFolderId === null ? 'All Notes' : breadcrumb[breadcrumb.length - 1]?.title || 'Folder';

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top']} data-testid="hn-hub-root">
      <View style={styles.row}>
        {/* SIDEBAR */}
        {isTablet ? (
          <HardnotesSidebar
            userId={userId}
            nodes={nodes}
            selectedFolderId={selectedFolderId}
            onSelectFolder={setSelectedFolderId}
            onNodesChanged={refresh}
            width={sidebarWidth}
          />
        ) : null}

        {/* MAIN CONTENT */}
        <View style={styles.main}>
          <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
            {!isTablet && (
              <TouchableOpacity
                onPress={() => setMobileSidebarOpen(true)}
                style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                data-testid="hn-open-sidebar"
              >
                <Folder size={18} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.crumbRow}>
                <TouchableOpacity onPress={() => setSelectedFolderId(null)} style={styles.crumbItem}>
                  <Home size={12} color={colors.textTertiary} />
                  <Text style={[styles.crumbTxt, { color: colors.textTertiary }]}>All Notes</Text>
                </TouchableOpacity>
                {breadcrumb.map((n, idx) => (
                  <React.Fragment key={n.id}>
                    <ChevronRight size={12} color={colors.textTertiary} />
                    <TouchableOpacity onPress={() => setSelectedFolderId(n.id)} style={styles.crumbItem}>
                      <Text
                        style={[
                          styles.crumbTxt,
                          {
                            color: idx === breadcrumb.length - 1 ? colors.textPrimary : colors.textTertiary,
                            fontWeight: idx === breadcrumb.length - 1 ? '900' : '700',
                          },
                        ]}
                      >
                        {n.title}
                      </Text>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
              <Text style={[styles.folderTitle, { color: colors.textPrimary }]}>{currentFolderTitle}</Text>
              <Text style={[styles.folderMeta, { color: colors.textTertiary }]}>
                {filteredChildFolders.length} folder{filteredChildFolders.length === 1 ? '' : 's'} ·{' '}
                {filteredChildNotes.length} note{filteredChildNotes.length === 1 ? '' : 's'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setGlobalSearchOpen((v) => !v)}
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              data-testid="hn-open-search"
            >
              <Search size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/profile')}
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              data-testid="hn-open-settings"
            >
              <Settings size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setNewNoteInputVisible(true)}
              style={styles.newBtn}
              activeOpacity={0.85}
              data-testid="hn-new-note-btn"
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.newBtnInner}
              >
                <Plus size={16} color={colors.buttonText} strokeWidth={3} />
                <Text style={[styles.newBtnTxt, { color: colors.buttonText }]}>New</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {globalSearchOpen && (
            <View
              style={[
                styles.globalSearchBar,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Search size={16} color={colors.textTertiary} />
              <TextInput
                value={globalQuery}
                onChangeText={setGlobalQuery}
                placeholder="Search in this folder…"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={[styles.globalSearchInput, { color: colors.textPrimary }]}
                data-testid="hn-global-search-input"
              />
              {globalQuery.length > 0 && (
                <TouchableOpacity onPress={() => setGlobalQuery('')}>
                  <X size={14} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <NotesGrid
              folderNodes={filteredChildFolders}
              noteNodes={filteredChildNotes}
              notesById={notesById}
              onOpenFolder={(id) => setSelectedFolderId(id)}
            />
          )}
        </View>
      </View>

      {/* Mobile sidebar drawer */}
      {!isTablet && (
        <Modal
          visible={mobileSidebarOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setMobileSidebarOpen(false)}
        >
          <View style={styles.drawerBackdrop}>
            <HardnotesSidebar
              userId={userId}
              nodes={nodes}
              selectedFolderId={selectedFolderId}
              onSelectFolder={(id) => {
                setSelectedFolderId(id);
                setMobileSidebarOpen(false);
              }}
              onNodesChanged={refresh}
              width={sidebarWidth}
            />
            <Pressable style={styles.drawerDim} onPress={() => setMobileSidebarOpen(false)} />
          </View>
        </Modal>
      )}

      {/* New note modal */}
      <Modal
        visible={newNoteInputVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNewNoteInputVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setNewNoteInputVisible(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
          >
            <View style={styles.modalHead}>
              <View
                style={[styles.modalIcon, { backgroundColor: colors.primary + '18' }]}
              >
                <Sparkles size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Note</Text>
                <Text style={[styles.modalSub, { color: colors.textTertiary }]}>
                  Will be created in{' '}
                  <Text style={{ color: colors.textPrimary, fontWeight: '900' }}>{currentFolderTitle}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={() => setNewNoteInputVisible(false)} data-testid="hn-new-note-close">
                <X size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={newNoteTitle}
              onChangeText={setNewNoteTitle}
              placeholder="Note title (optional)"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              onSubmitEditing={createNote}
              style={[
                styles.modalInput,
                { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border },
              ]}
              data-testid="hn-new-note-title-input"
            />
            <TouchableOpacity
              onPress={createNote}
              disabled={creatingNote}
              style={[styles.modalCta, { backgroundColor: colors.primary, opacity: creatingNote ? 0.6 : 1 }]}
              data-testid="hn-new-note-create"
            >
              {creatingNote ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <>
                  <FileText size={16} color={colors.buttonText} />
                  <Text style={[styles.modalCtaTxt, { color: colors.buttonText }]}>Create & Open Canvas</Text>
                </>
              )}
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flex: 1, flexDirection: 'row' },
  main: { flex: 1 },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crumbRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 },
  crumbItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  crumbTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  folderTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  folderMeta: { fontSize: 11, fontWeight: '700' },

  newBtn: { borderRadius: 12, overflow: 'hidden' },
  newBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 38,
    borderRadius: 12,
  },
  newBtnTxt: { fontSize: 13, fontWeight: '900' },

  globalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 14,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  globalSearchInput: { flex: 1, fontSize: 14, fontWeight: '600' },

  drawerBackdrop: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.4)' },
  drawerDim: { flex: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 24, padding: 24, gap: 16 },
  modalHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalSub: { fontSize: 12, fontWeight: '700' },
  modalInput: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontWeight: '700' },
  modalCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  modalCtaTxt: { fontSize: 14, fontWeight: '900' },
});
