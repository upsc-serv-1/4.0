import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal,
  Alert, Pressable, ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Keyboard
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  Folder, BookOpen, FileText, Plus, Search as SearchIcon, X, ChevronLeft, ChevronRight,
  Layers, FolderPlus,
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { PremiumMoveSheet, MoveTarget } from '../../src/components/common/PremiumMoveSheet';
import { ThemeSwitcher } from '../../src/components/ThemeSwitcher';
import { PageWrapper } from '../../src/components/PageWrapper';
import { NoteRow, NoteNode, NoteRowAction } from '../../src/components/notes/NoteRow';

type RawNode = {
  id: string; user_id: string; parent_id: string | null;
  type: 'folder' | 'notebook' | 'note'; title: string; note_id: string | null;
  is_archived: boolean; updated_at?: string; created_at?: string;
};

export default function NotesIndex() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allNodes, setAllNodes] = useState<RawNode[]>([]);
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  
  const [currentFolder, setCurrentFolder] = useState<NoteNode | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modals
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'folder' | 'notebook' | 'note'>('folder');
  const [createTitle, setCreateTitle] = useState('');
  const [createParentId, setCreateParentId] = useState<string | null>(null);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [actionNodeId, setActionNodeId] = useState<string | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    const { data, error } = await supabase.from('user_note_nodes')
      .select('*').eq('user_id', session.user.id).eq('is_archived', false);
    if (!error) {
      setAllNodes((data || []) as RawNode[]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  // --- Tree Building ---
  const tree = useMemo(() => {
    const buildTree = (parentId: string | null, depth: number): NoteNode[] => {
      return allNodes
        .filter(n => n.parent_id === parentId)
        .map(n => {
          const children = buildTree(n.id, depth + 1);
          return {
            ...n,
            depth,
            children,
            childrenCount: children.length
          } as NoteNode;
        })
        .sort((a, b) => {
          const order = { folder: 0, notebook: 1, note: 2 };
          return order[a.type] - order[b.type] || a.title.localeCompare(b.title);
        });
    };
    return buildTree(null, 0);
  }, [allNodes]);

  // Update current folder ref if it changed
  useEffect(() => {
    if (currentFolder) {
      const flat = flattenAll(tree);
      const updated = flat.find(n => n.id === currentFolder.id);
      if (updated && updated !== currentFolder) {
        setCurrentFolder(updated);
      }
    }
  }, [tree]);

  const flattenAll = (nodes: NoteNode[]): NoteNode[] => {
    return nodes.reduce((acc: NoteNode[], node) => {
      acc.push(node);
      acc.push(...flattenAll(node.children));
      return acc;
    }, []);
  };

  const flattenVisible = (nodes: NoteNode[], expandedSet: Set<string>): NoteNode[] => {
    let result: NoteNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (expandedSet.has(node.id) && node.children.length > 0) {
        result.push(...flattenVisible(node.children, expandedSet));
      }
    }
    return result;
  };

  const displayRows = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const allFlats = flattenAll(tree);
      return allFlats.filter(n => n.title.toLowerCase().includes(q));
    }
    
    if (currentFolder) {
      const baseDepth = currentFolder.depth + 1;
      return flattenVisible(currentFolder.children, expanded).map(n => ({
        ...n,
        depth: Math.max(0, n.depth - baseDepth)
      }));
    }
    
    return flattenVisible(tree, expanded);
  }, [tree, search, currentFolder, expanded]);

  const aggregateStats = useMemo(() => {
    let folders = 0, notebooks = 0, notes = 0;
    const allFlats = flattenAll(currentFolder ? [currentFolder] : tree);
    allFlats.forEach(n => {
      if (n.type === 'folder') folders++;
      else if (n.type === 'notebook') notebooks++;
      else if (n.type === 'note') notes++;
    });
    return { folders, notebooks, notes };
  }, [tree, currentFolder]);

  const moveTargets = useMemo<MoveTarget[]>(() => {
    return allNodes
      .filter(n => n.type === 'folder' || n.type === 'notebook')
      .map(n => ({
        id: n.id,
        name: n.title,
        type: n.type as 'folder' | 'notebook',
        parent_id: n.parent_id,
      }));
  }, [allNodes]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openNode = (n: NoteNode) => {
    if ((n.type === 'note' || n.type === 'notebook') && n.note_id) {
      router.push({ pathname: '/notes/editor', params: { id: n.note_id, title: n.title } });
    } else if (n.type === 'folder') {
      setCurrentFolder(n);
      setSearch('');
      setSearchVisible(false);
    }
  };

  const actionNode = allNodes.find(n => n.id === actionNodeId);

  // ─── CRUD ───
  const doCreate = async () => {
    if (!createTitle.trim() || !session?.user.id) return;
    if (createType === 'notebook' || createType === 'note') {
      const { data: note } = await supabase.from('user_notes')
        .insert({ user_id: session.user.id, subject: 'General', title: createTitle.trim(), items: [] })
        .select().single();
      await supabase.from('user_note_nodes').insert({
        user_id: session.user.id, parent_id: createParentId, type: createType,
        title: createTitle.trim(), note_id: note?.id,
      });
    } else {
      await supabase.from('user_note_nodes').insert({
        user_id: session.user.id, parent_id: createParentId, type: createType,
        title: createTitle.trim(),
      });
    }
    if (createParentId) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.add(createParentId);
        return next;
      });
    }
    setCreateOpen(false); setCreateTitle('');
    load();
  };

  const doRename = async () => {
    if (!actionNode || !renameValue.trim() || !session?.user.id) return;
    const { error } = await supabase.rpc('rename_note_node', {
      p_node_id: actionNode.id, p_user_id: session.user.id, p_title: renameValue.trim(),
    });
    if (error) { Alert.alert('Rename failed', error.message); return; }
    setRenameOpen(false); setActionNodeId(null); load();
  };

  const doMove = async (newParentId: string | null) => {
    if (!actionNode || !session?.user.id) return;
    const { error } = await supabase.rpc('move_note_node', {
      p_node_id: actionNode.id, p_user_id: session.user.id, p_new_parent_id: newParentId,
    });
    if (error) { Alert.alert('Move failed', error.message); return; }
    setMoveOpen(false); setActionNodeId(null); load();
  };

  const doDuplicate = async (n: RawNode) => {
    if (!session?.user.id) return;
    try {
      if (n.type === 'note' && n.note_id) {
        const { data: src } = await supabase.from('user_notes').select('*').eq('id', n.note_id).single();
        const { data: clone } = await supabase.from('user_notes').insert({
          user_id: session.user.id, subject: src?.subject || 'General',
          title: `${src?.title || n.title} (copy)`,
          items: src?.items || [],
        }).select().single();
        await supabase.from('user_note_nodes').insert({
          user_id: session.user.id, parent_id: n.parent_id, type: 'note',
          title: `${n.title} (copy)`, note_id: clone?.id,
        });
      } else {
        await supabase.from('user_note_nodes').insert({
          user_id: session.user.id, parent_id: n.parent_id, type: n.type,
          title: `${n.title} (copy)`,
        });
      }
      load();
    } catch (e: any) { Alert.alert('Duplicate failed', e?.message || ''); }
  };

  const doDelete = (node: RawNode) => {
    if (!session?.user.id) return;
    Alert.alert('Delete?', `Permanently delete "${node.title}" and everything inside?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('delete_note_node_cascade', {
            p_node_id: node.id, p_user_id: session.user.id,
          });
          if (error) { Alert.alert('Delete failed', error.message); return; }
          load();
        }
      },
    ]);
  };

  const onAction = (node: NoteNode, action: NoteRowAction) => {
    setActionNodeId(node.id);
    switch (action) {
      case 'add':
        setCreateParentId(node.id);
        setCreateType('note');
        setCreateOpen(true);
        break;
      case 'move':
        setMoveOpen(true);
        break;
      case 'rename':
        setRenameValue(node.title);
        setRenameOpen(true);
        break;
      case 'duplicate':
        doDuplicate(node);
        break;
      case 'delete':
        doDelete(node);
        break;
    }
  };

  return (
    <PageWrapper>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerTop}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <TouchableOpacity onPress={() => currentFolder ? setCurrentFolder(null) : router.back()} style={styles.iconBtn}>
                <ChevronLeft size={28} color={colors.primary} />
              </TouchableOpacity>
              <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {currentFolder ? currentFolder.title : 'Notes'}
              </Text>
            </View>
            <View style={styles.headerBtns}>
              <TouchableOpacity onPress={() => { setCreateParentId(currentFolder?.id ?? null); setAddMenuOpen(true); }} style={styles.iconBtn}>
                <Plus size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSearchVisible(v => !v)} style={styles.iconBtn}>
                <SearchIcon size={22} color={colors.textPrimary} />
              </TouchableOpacity>
              <ThemeSwitcher />
            </View>
          </View>
          {searchVisible && (
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SearchIcon size={16} color={colors.textTertiary} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={colors.textTertiary} style={[styles.searchInput, { color: colors.textPrimary }]} autoFocus />
              <TouchableOpacity onPress={() => { setSearch(''); setSearchVisible(false); Keyboard.dismiss(); }}><X size={16} color={colors.textTertiary} /></TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.topActionArea}>
          <View style={[styles.statsBar, { marginHorizontal: 0, width: '100%' }]}>
            <View style={[styles.statBox, { backgroundColor: '#fef3c712', borderColor: '#f59e0b30' }]}>
              <Folder size={14} color="#f59e0b" />
              <Text style={[styles.statNum, { color: '#f59e0b' }]}>{aggregateStats.folders}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Folders</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#dcfce712', borderColor: '#10b98130' }]}>
              <BookOpen size={14} color="#10b981" />
              <Text style={[styles.statNum, { color: '#10b981' }]}>{aggregateStats.notebooks}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Notebooks</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#e0f2fe12', borderColor: '#0ea5e930' }]}>
              <FileText size={14} color="#0ea5e9" />
              <Text style={[styles.statNum, { color: '#0ea5e9' }]}>{aggregateStats.notes}</Text>
              <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Notes</Text>
            </View>
          </View>
        </View>

        {loading && !refreshing ? (
          <View style={[styles.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
            <View style={{ paddingHorizontal: 4 }}>
              {displayRows.map((item) => (
                <View key={item.id}>
                  <NoteRow 
                    node={item} 
                    expanded={expanded.has(item.id)} 
                    onToggle={() => toggleExpand(item.id)} 
                    onOpen={() => { if (item.type === 'folder' && item.depth === 0) setCurrentFolder(item); else openNode(item); }} 
                    onAction={(action) => onAction(item, action)} 
                  />
                </View>
              ))}
            </View>
            {displayRows.length === 0 && (
              <View style={styles.empty}>
                <Layers size={48} color={colors.border} />
                <Text style={{ color: colors.textTertiary, marginTop: 12 }}>Empty here</Text>
              </View>
            )}
          </ScrollView>
        )}

        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => { setCreateParentId(currentFolder?.id ?? null); setAddMenuOpen(true); }}>
          <Plus size={28} color="#04223a" />
        </TouchableOpacity>

        {/* ADD MENU */}
        <Modal visible={addMenuOpen} transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
          <Pressable style={styles.overlay} onPress={() => setAddMenuOpen(false)}>
            <View style={[styles.addMenuContent, { backgroundColor: colors.surface }]}>
              <AddMenuItem 
                icon={<FolderPlus size={22} color="#f59e0b" />} 
                title="Create Folder" 
                sub="Organize your notes into folders" 
                onPress={() => { setAddMenuOpen(false); setCreateType('folder'); setCreateOpen(true); }} 
              />
              <AddMenuItem 
                icon={<BookOpen size={22} color="#10b981" />} 
                title="Create Notebook" 
                sub="A collection of related notes" 
                onPress={() => { setAddMenuOpen(false); setCreateType('notebook'); setCreateOpen(true); }} 
              />
              <AddMenuItem 
                icon={<FileText size={22} color="#0ea5e9" />} 
                title="Create Note" 
                sub="A quick standalone note" 
                onPress={() => { setAddMenuOpen(false); setCreateType('note'); setCreateOpen(true); }} 
              />
            </View>
          </Pressable>
        </Modal>

        {/* CREATE SHEET */}
        <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.overlay}>
              <Pressable style={{ flex: 1 }} onPress={() => setCreateOpen(false)} />
              <View style={[styles.createSheet, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.dialogTitle, { color: colors.textPrimary }]}>
                    {createType === 'folder' ? 'New Folder' : createType === 'notebook' ? 'New Notebook' : 'New Note'}
                  </Text>
                  <TouchableOpacity onPress={() => setCreateOpen(false)} style={styles.closeBtn}>
                    <X size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
                <TextInput 
                  testID="create-title-input" 
                  value={createTitle} 
                  onChangeText={setCreateTitle} 
                  placeholder="Enter title..." 
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.premiumInput, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]} 
                  autoFocus 
                />
                <TouchableOpacity testID="create-confirm" onPress={doCreate} style={[styles.bigCreateBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.bigCreateBtnTxt}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* RENAME */}
        <Modal transparent visible={renameOpen} animationType="fade" onRequestClose={() => setRenameOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.overlay}>
              <Pressable style={{ flex: 1 }} onPress={() => setRenameOpen(false)} />
              <View style={[styles.createSheet, { backgroundColor: colors.surface }]}>
                <Text style={[styles.dialogTitle, { color: colors.textPrimary, marginBottom: 12 }]}>Rename</Text>
                <TextInput testID="rename-input" value={renameValue} onChangeText={setRenameValue} autoFocus
                  style={[styles.premiumInput, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]} />
                <View style={styles.dialogActions}>
                  <TouchableOpacity onPress={() => setRenameOpen(false)} style={styles.modalCancel}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity testID="rename-save" onPress={doRename} style={[styles.modalCreate, { backgroundColor: colors.primary }]}><Text style={{ color: '#04223a', fontWeight: '900' }}>Save</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <PremiumMoveSheet
          visible={moveOpen}
          title={`Move "${actionNode?.title}" to…`}
          targets={moveTargets.filter(f => f.id !== actionNode?.id)}
          currentSelectedId={actionNode?.parent_id}
          onClose={() => setMoveOpen(false)}
          onConfirm={doMove}
        />
      </View>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 14 },
  topActionArea: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginVertical: 16, gap: 12 },
  statsBar: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14, borderWidth: 1, gap: 4 },
  statNum: { fontSize: 20, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

  fab: { position: 'absolute', bottom: 30, right: 20, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  empty: { padding: 80, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  dialogTitle: { fontSize: 20, fontWeight: '900' },
  dialogActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, alignItems: 'center', padding: 16 },
  modalCreate: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16 },

  // Premium Add Menu
  addMenuContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  addItemIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addItemContent: { flex: 1 },
  addItemTitle: { fontSize: 17, fontWeight: '800' },
  addItemSub: { fontSize: 13, marginTop: 2 },
  
  // Premium Create Sheet
  createSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  premiumInput: { height: 60, borderRadius: 18, paddingHorizontal: 20, fontSize: 17, fontWeight: '600', marginVertical: 24 },
  bigCreateBtn: { height: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bigCreateBtnTxt: { color: '#04223a', fontSize: 17, fontWeight: '900' },
});

function AddMenuItem({ icon, title, sub, onPress }: { icon: any, title: string, sub: string, onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={styles.addMenuItem}>
      <View style={[styles.addItemIcon, { backgroundColor: colors.surfaceStrong }]}>
        {icon}
      </View>
      <View style={styles.addItemContent}>
        <Text style={[styles.addItemTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.addItemSub, { color: colors.textTertiary }]}>{sub}</Text>
      </View>
      <ChevronRight size={20} color={colors.border} />
    </TouchableOpacity>
  );
}
