/**
 * Knowledge Vault — the root view of the Notes tab.
 *
 * Layout principles (driven by the user's "Aichii Dual-Engine" brief):
 *   • Root: Subject Hub grid (top-level user folders only — no auto-seed).
 *   • Inside a folder: Aichii hierarchy tree with vertical lines + Glance.
 *   • Glance Mode: inline-expand any note row to skim its blocks/checklist.
 *   • Semantic chip filter: review tags from the existing tag catalog
 *     (Tags-tab parity) — selecting a chip filters glance content.
 *   • Focus Mode: Play button → editor with ?focus=1 (zen + parchment).
 *   • Export: any row → UnifiedExportSheet (kind: 'notes') with all items
 *     under that subtree.
 */
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal,
  Alert, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, Keyboard,
  RefreshControl, Dimensions, Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AnimatedReanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import {
  Folder, BookOpen, FileText, Plus, Search as SearchIcon, X, ChevronLeft, ChevronRight,
  Layers, FolderPlus, LayoutGrid, List as ListIcon, Sparkles, Edit2, Trash2,
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { OfflineManager } from '../../src/services/OfflineManager';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { PremiumMoveSheet, MoveTarget } from '../../src/components/common/PremiumMoveSheet';
import { ThemeSwitcher } from '../../src/components/ThemeSwitcher';
import { PageWrapper } from '../../src/components/PageWrapper';
import { NoteRow, NoteNode, NoteRowAction } from '../../src/components/notes/NoteRow';
import { SubjectHubGrid, SUBJECT_PALETTE } from '../../src/components/notes/SubjectHubGrid';
import { SemanticChipRow } from '../../src/components/notes/SemanticChipRow';
import { GlancePanel, NoteItem } from '../../src/components/notes/GlancePanel';
import { UnifiedExportSheet } from '../../src/components/export/UnifiedExportSheet';
import type { ExportPayload, ExportNoteBlock } from '../../src/lib/unifiedExportEngine';
import { useNoteTagCatalog } from '../../src/hooks/useNoteTagCatalog';
import { normalizeTag } from '../../src/utils/tagUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IS_WIDE = SCREEN_WIDTH >= 768;

type RawNode = {
  id: string; user_id: string; parent_id: string | null;
  type: 'folder' | 'notebook' | 'note'; title: string; note_id: string | null;
  is_archived: boolean; updated_at?: string; created_at?: string;
};

const ALL_TAG = 'All';

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
  // Folder navigation stack — for back-to-parent (not back-to-root)
  const [folderStack, setFolderStack] = useState<NoteNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [glanceOpen, setGlanceOpen] = useState<Set<string>>(new Set());
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string>(ALL_TAG);
  const [hubLayout, setHubLayout] = useState<'grid' | 'list'>('grid');
  // Hide left navigation panel (full-screen notes mode)
  const [leftPanelHidden, setLeftPanelHidden] = useState(false);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [0, -100],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollY.value,
      [0, 80],
      [1, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }],
      opacity,
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      backgroundColor: colors.bg,
    };
  });

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

  // Export sheet
  const [exportSheet, setExportSheet] = useState<{ visible: boolean; node: NoteNode | null; payload: ExportPayload | null; title: string }>({
    visible: false, node: null, payload: null, title: 'Notes Export',
  });
  const [exportPreparing, setExportPreparing] = useState(false);

  // Context Menu & Edit Folder (Notability Style)
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; node: NoteNode | null; x: number; y: number }>({ visible: false, node: null, x: 0, y: 0 });
  const [editFolderOpen, setEditFolderOpen] = useState(false);
  const [editFolderTitle, setEditFolderTitle] = useState('');
  const [editFolderColor, setEditFolderColor] = useState<string | null>(null);
  const [editFolderLocked, setEditFolderLocked] = useState(false);

  const { tags: catalogTags } = useNoteTagCatalog(session?.user.id);

  const load = useCallback(async () => {
    if (!session?.user.id) return;

    const cacheKey = `user_notes_${session.user.id}`;
    let hasCached = false;

    // OFFLINE-FIRST: read cached nodes first.
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setAllNodes(parsed as RawNode[]);
          hasCached = true;
        }
      }
    } catch {}

    if (!hasCached) setLoading(true);

    try {
      const { data, error } = await supabase.from('user_note_nodes')
        .select('*').eq('user_id', session.user.id).eq('is_archived', false);

      if (!error && data) {
        const rows = (data || []) as RawNode[];
        setAllNodes(rows);
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(rows));
        } catch {}
      }
    } catch {
      // Network failed — try OfflineManager KVStore as additional fallback
      if (!hasCached) {
        try {
          const offlineNodes = OfflineManager.getCollectionSync('user_note_nodes', session.user.id) as any[];
          if (offlineNodes && offlineNodes.length > 0) {
            const rows = offlineNodes.filter((n: any) => !n.is_archived) as RawNode[];
            if (rows.length > 0) {
              setAllNodes(rows);
              try {
                await AsyncStorage.setItem(cacheKey, JSON.stringify(rows));
              } catch {}
            }
          }
        } catch {}
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); };

  // --- Tree Building ---
  const tree = useMemo(() => {
    const buildTree = (parentId: string | null, depth: number): NoteNode[] => {
      return allNodes
        .filter((n) => n.parent_id === parentId)
        .map((n) => {
          const children = buildTree(n.id, depth + 1);
          return {
            ...n,
            depth,
            children,
            childrenCount: children.length,
          } as NoteNode;
        })
        .sort((a, b) => {
          const order = { folder: 0, notebook: 1, note: 2 };
          return order[a.type] - order[b.type] || a.title.localeCompare(b.title);
        });
    };
    return buildTree(null, 0);
  }, [allNodes]);

  // Refresh currentFolder reference whenever the tree rebuilds.
  useEffect(() => {
    if (!currentFolder) return;
    const flat = flattenAll(tree);
    const updated = flat.find((n) => n.id === currentFolder.id) || null;
    if (updated) {
      setCurrentFolder(updated);
    } else {
      setCurrentFolder(null);
    }
  }, [tree]);

  const selectedFolder = useMemo(() => {
    if (!selectedFolderId) return null;
    return flattenAll(tree).find(n => n.id === selectedFolderId) || null;
  }, [selectedFolderId, tree]);

  // Reset selectedNoteId when folder changes
  useEffect(() => {
    setSelectedNoteId(null);
  }, [currentFolder]);

  const topLevelFolders = useMemo(() => tree.filter((n) => n.type === 'folder'), [tree]);
  const topLevelOrphans = useMemo(() => tree.filter((n) => n.type !== 'folder'), [tree]);

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
    if (!currentFolder) return [] as NoteNode[];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return flattenAll(currentFolder.children).filter((n) => n.title.toLowerCase().includes(q));
    }
    const baseDepth = currentFolder.depth + 1;
    return flattenVisible(currentFolder.children, expanded).map((n) => ({
      ...n,
      depth: Math.max(0, n.depth - baseDepth),
    }));
  }, [tree, search, currentFolder, expanded]);

  // Auto-open glance for matching notes when chip filter is active inside a folder.
  useEffect(() => {
    if (!currentFolder) return;
    if (normalizeTag(activeChip) === normalizeTag(ALL_TAG)) return;
    const noteIds = new Set<string>();
    flattenAll(currentFolder.children).forEach((n) => {
      if ((n.type === 'note' || n.type === 'notebook') && n.note_id) {
        noteIds.add(n.id);
      }
    });
    setGlanceOpen(noteIds);
  }, [activeChip, currentFolder]);

  const aggregateStats = useMemo(() => {
    let folders = 0, notebooks = 0, notes = 0, glances = 0;
    const allFlats = flattenAll(currentFolder ? [currentFolder] : tree);
    allFlats.forEach((n) => {
      if (n.type === 'folder') folders++;
      else if (n.type === 'notebook') notebooks++;
      else if (n.type === 'note') notes++;
      if (n.note_id) glances++;
    });
    return { folders, notebooks, notes, glances };
  }, [tree, currentFolder]);

  const moveTargets = useMemo<MoveTarget[]>(() => {
    return allNodes
      .filter((n) => n.type === 'folder' || n.type === 'notebook')
      .map((n) => ({
        id: n.id,
        name: n.title,
        type: n.type as 'folder' | 'notebook',
        parent_id: n.parent_id,
      }));
  }, [allNodes]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGlance = (id: string) => {
    setGlanceOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleScroll = (event: any) => {
    // Scroll tracking logic removed per user request
  };

  // Navigate into a folder — pushes current to stack for proper back navigation
  const navigateToFolder = (n: NoteNode) => {
    if (currentFolder) setFolderStack(s => [...s, currentFolder]);
    setCurrentFolder(n);
    setSearch('');
    setSearchVisible(false);
    // Auto-expand the folder in tree view
    setExpanded(prev => { const next = new Set(prev); next.add(n.id); return next; });
  };

  // Go back — pop stack (parent folder) or back to root
  const navigateBack = () => {
    if (folderStack.length > 0) {
      const parent = folderStack[folderStack.length - 1];
      setFolderStack(s => s.slice(0, -1));
      setCurrentFolder(parent);
    } else {
      setCurrentFolder(null);
      setSelectedFolderId(null);
      setSelectedNoteId(null);
    }
  };

  const openNode = (n: NoteNode) => {
    if ((n.type === 'note' || n.type === 'notebook') && n.note_id) {
      router.push({ pathname: '/notes/editor', params: { id: n.note_id, title: n.title } });
    } else if (n.type === 'folder') {
      // Tree hierarchy: just expand/collapse inline, don't navigate
      toggleExpand(n.id);
      setSearch('');
      setSearchVisible(false);
    }
  };

  const playNode = (n: NoteNode) => {
    if ((n.type === 'note' || n.type === 'notebook') && n.note_id) {
      router.push({ pathname: '/notes/editor', params: { id: n.note_id, title: n.title, focus: '1' } });
    }
  };

  const actionNode = allNodes.find((n) => n.id === actionNodeId);

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
      setExpanded((prev) => {
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
          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }
          
          // IMMEDIATE UI UPDATE: Filter out the deleted node and all its descendants
          const deletedIds = new Set<string>();
          const collectIds = (id: string) => {
            deletedIds.add(id);
            allNodes.filter(n => n.parent_id === id).forEach(child => collectIds(child.id));
          };
          collectIds(node.id);
          
          const remainingNodes = allNodes.filter(n => !deletedIds.has(n.id));
          setAllNodes(remainingNodes);
          
          // Update cache immediately
          try {
            const cacheKey = `user_notes_${session.user.id}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(remainingNodes));
          } catch {}

          // If we were inside the deleted folder, go back
          if (currentFolder && deletedIds.has(currentFolder.id)) {
            navigateBack();
          }
          
          // Still call load() to ensure sync with server, but UI is already updated
          load();
        },
      },
    ]);
  };

  /**
   * Build a notes export payload by fetching user_notes for every note_id
   * inside the chosen subtree, then flattening into ExportNoteBlock[].
   */
  const buildExportPayload = useCallback(async (root: NoteNode): Promise<ExportPayload | null> => {
    const noteIds: string[] = [];
    const headingsByNote: Record<string, string> = {};
    const walk = (n: NoteNode, breadcrumb: string[]) => {
      const crumb = [...breadcrumb, n.title];
      if ((n.type === 'note' || n.type === 'notebook') && n.note_id) {
        noteIds.push(n.note_id);
        headingsByNote[n.note_id] = crumb.join(' › ');
      }
      n.children.forEach((c) => walk(c, crumb));
    };
    walk(root, []);

    if (noteIds.length === 0) return null;

    const { data, error } = await supabase
      .from('user_notes')
      .select('id, title, subject, items, highlights, checklist_notes, content, content_html, updated_at')
      .in('id', noteIds);
    if (error) throw error;

    const blocks: ExportNoteBlock[] = [];
    (data || []).forEach((note: any) => {
      const breadcrumb = headingsByNote[note.id] || note.title;
      blocks.push({
        id: `nb-${note.id}`,
        type: 'microTopicHeading',
        text: breadcrumb,
      });
      const items: NoteItem[] = Array.isArray(note.items) && note.items.length
        ? note.items
        : (Array.isArray(note.highlights) ? note.highlights : []);

      let checklistItems: Array<{ id?: string; text?: string; checked?: boolean }> = [];
      if (Array.isArray(note.checklist_notes)) {
        checklistItems = note.checklist_notes;
      } else if (typeof note.checklist_notes === 'string' && note.checklist_notes.trim()) {
        try {
          const parsed = JSON.parse(note.checklist_notes);
          if (Array.isArray(parsed)) checklistItems = parsed;
        } catch {
          // Ignore malformed legacy checklist payloads.
        }
      }

      checklistItems.forEach((entry, idx) => {
        if (!entry?.text) return;
        blocks.push({
          id: entry.id || `check-${note.id}-${idx}`,
          type: 'checklist',
          text: String(entry.text),
          checked: !!entry.checked,
          color: '#6366f1',
          sourceLabel: note.subject || undefined,
        });
      });

      if (items.length === 0 && (note.content_html || note.content)) {
        blocks.push({
          id: `body-${note.id}`,
          type: 'highlight',
          text: String(note.content_html || note.content || ''),
          color: '#6366f1',
          sourceLabel: note.subject || undefined,
        });
      }

      items.forEach((it, idx) => {
        if (it.type === 'microTopicHeading') {
          blocks.push({ id: it.id || `h-${note.id}-${idx}`, type: 'microTopicHeading', text: it.text || '' });
        } else {
          blocks.push({
            id: it.id || `i-${note.id}-${idx}`,
            type: 'highlight',
            text: it.text || '',
            color: it.color,
            sourceLabel: note.subject || undefined,
          });
        }
      });
    });

    return { kind: 'notes', blocks };
  }, []);

  const handleExportNode = useCallback(async (node: NoteNode) => {
    try {
      setExportPreparing(true);
      const payload = await buildExportPayload(node);
      if (!payload) {
        Alert.alert('Nothing to export', `${node.title} has no notes inside yet.`);
        return;
      }
      setExportSheet({
        visible: true,
        node,
        payload,
        title: `${node.title} · Notes`,
      });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not prepare export.');
    } finally {
      setExportPreparing(false);
    }
  }, [buildExportPayload]);

  const onAction = (node: NoteNode, action: NoteRowAction) => {
    setActionNodeId(node.id);
    switch (action) {
      case 'add':
        setCreateParentId(node.id);
        setCreateType(node.type === 'folder' ? 'notebook' : 'note');
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
      case 'play':
        playNode(node);
        break;
      case 'export':
        handleExportNode(node);
        break;
    }
  };

  const onHubAction = (node: NoteNode, action: 'add' | 'export' | 'rename' | 'move' | 'delete' | 'duplicate' | 'play') => {
    setActionNodeId(node.id);
    switch (action) {
      case 'add':
        setCreateParentId(node.id);
        setCreateType('notebook');
        setCreateOpen(true);
        break;
      case 'rename':
        setRenameValue(node.title);
        setRenameOpen(true);
        break;
      case 'move':
        setMoveOpen(true);
        break;
      case 'delete':
        doDelete(node);
        break;
      case 'duplicate':
        doDuplicate(node);
        break;
      case 'export':
        handleExportNode(node);
        break;
      case 'play':
        playNode(node);
        break;
    }
  };

  const showSubjectHub = !currentFolder;

  return (
    <PageWrapper>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {!showSubjectHub && IS_WIDE ? (
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {/* LEFT COLUMN: Sidebar — hidden when leftPanelHidden */}
            {!leftPanelHidden && (
              <View style={[styles.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.border }]}>
                <View style={[styles.sidebarHeader, { borderBottomColor: colors.border }]}>
                  <View style={styles.headerTop}>
                    <TouchableOpacity onPress={navigateBack} style={styles.iconBtn}>
                      <ChevronLeft size={24} color={colors.primary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.eyebrow, { color: colors.primary, fontSize: 10 }]}>KNOWLEDGE VAULT</Text>
                      <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: 16 }]} numberOfLines={1}>
                        {/* Breadcrumb: show parent path */}
                        {folderStack.length > 0 ? folderStack.map(f => f.title).join(' › ') + ' › ' + currentFolder?.title : currentFolder?.title}
                      </Text>
                    </View>
                  </View>
                </View>

                <SemanticChipRow
                  tags={catalogTags}
                  selected={activeChip}
                  onChange={setActiveChip}
                />

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                  <View style={{ paddingHorizontal: 4 }}>
                    {displayRows.map((item) => (
                      <NoteRow
                        key={item.id}
                        node={item}
                        expanded={expanded.has(item.id)}
                        onToggle={() => toggleExpand(item.id)}
                        onOpen={() => {
                          if ((item.type === 'note' || item.type === 'notebook') && item.note_id) {
                            setSelectedNoteId(item.note_id);
                            setSelectedFolderId(null);
                          } else if (item.type === 'folder') {
                            setSelectedFolderId(item.id);
                            setSelectedNoteId(null);
                            toggleExpand(item.id);
                          }
                        }}
                        onAction={(action) => onAction(item, action)}
                        isHighlighted={selectedNoteId === item.note_id || selectedFolderId === item.id}
                        onLongPress={(x, y) => {
                          if (item.type === 'folder') {
                            setContextMenu({ visible: true, node: item, x, y });
                          }
                        }}
                      />
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}

            {/* RIGHT COLUMN: Content */}
            <View style={[styles.splitContent, { backgroundColor: colors.bg }]}>
              {/* Hide/Show left panel toggle */}
              <TouchableOpacity
                onPress={() => setLeftPanelHidden(h => !h)}
                testID="notes-hide-panel-btn"
                style={{
                  position: 'absolute', top: 12, left: leftPanelHidden ? 12 : -10, zIndex: 100,
                  backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                  borderRadius: 10, padding: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1, shadowRadius: 4, elevation: 4,
                }}
              >
                {leftPanelHidden ? <ChevronRight size={18} color={colors.primary} /> : <ChevronLeft size={18} color={colors.primary} />}
              </TouchableOpacity>

              {selectedNoteId ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 48, paddingBottom: 100 }}>
                  <GlancePanel
                    noteId={selectedNoteId}
                    contentWidth={leftPanelHidden ? SCREEN_WIDTH - 80 : SCREEN_WIDTH - 286 - 40}
                    selectedTag={activeChip}
                    onPlay={() => {
                      const node = allNodes.find(n => n.note_id === selectedNoteId);
                      if (node) playNode(node as any);
                    }}
                    onOpenEdit={() => {
                      const node = allNodes.find(n => n.note_id === selectedNoteId);
                      if (node) openNode(node as any);
                    }}
                  />
                </ScrollView>
              ) : selectedFolderId ? (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 48, paddingBottom: 100 }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                       <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }}>
                         <Folder size={24} color={colors.primary} />
                       </View>
                       <View>
                         <Text style={{ fontSize: 22, fontWeight: '900', color: colors.textPrimary }}>{selectedFolder?.title}</Text>
                         <Text style={{ fontSize: 13, color: colors.textTertiary, fontWeight: '600' }}>{selectedFolder?.children.length || 0} items inside</Text>
                       </View>
                     </View>
                     <TouchableOpacity 
                       onPress={() => { setCreateParentId(selectedFolderId); setCreateType('notebook'); setCreateOpen(true); }}
                       style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
                     >
                       <Text style={{ color: '#04223a', fontWeight: '900' }}>+ Create Inside</Text>
                     </TouchableOpacity>
                   </View>
                   
                   <SubjectHubGrid
                     folders={selectedFolder?.children || []}
                     onOpen={(n) => {
                       if (n.type === 'folder') {
                         setSelectedFolderId(n.id);
                         setExpanded(prev => { const next = new Set(prev); next.add(n.id); return next; });
                       } else if (n.note_id) {
                         setSelectedNoteId(n.note_id);
                         setSelectedFolderId(null);
                       }
                     }}
                     onAction={onHubAction}
                   />
                </ScrollView>
              ) : (
                <View style={styles.center}>
                  <Text style={{ color: colors.textTertiary, fontSize: 16 }}>Select a note or folder to preview</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            <AnimatedReanimated.View style={[styles.header, headerAnimatedStyle, { borderBottomColor: colors.border }]}>
              <View style={styles.headerTop}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <TouchableOpacity
                    onPress={() => currentFolder ? navigateBack() : router.back()}
                    style={styles.iconBtn}
                    data-testid="vault-back"
                  >
                    <ChevronLeft size={28} color={colors.primary} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eyebrow, { color: colors.primary }]}>KNOWLEDGE VAULT</Text>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      {currentFolder ? currentFolder.title : 'My Vault'}
                    </Text>
                  </View>
                </View>
                <View style={styles.headerBtns}>
                  <TouchableOpacity
                    onPress={() => { 
                      const pId = IS_WIDE ? (selectedFolderId || currentFolder?.id || null) : (currentFolder?.id || null);
                      setCreateParentId(pId); 
                      setAddMenuOpen(true); 
                    }}
                    style={styles.iconBtn}
                    data-testid="vault-add-button"
                  >
                    <Plus size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setSearchVisible((v) => !v)} style={styles.iconBtn} data-testid="vault-search-toggle">
                    <SearchIcon size={22} color={colors.textPrimary} />
                  </TouchableOpacity>
                  <ThemeSwitcher />
                </View>
              </View>
              {searchVisible && (
                <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <SearchIcon size={16} color={colors.textTertiary} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search…"
                    placeholderTextColor={colors.textTertiary}
                    style={[styles.searchInput, { color: colors.textPrimary }]}
                    autoFocus
                    data-testid="vault-search-input"
                  />
                  <TouchableOpacity onPress={() => { setSearch(''); setSearchVisible(false); Keyboard.dismiss(); }}>
                    <X size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Semantic chip row — only shown when inside a folder */}
              {!showSubjectHub && (
                <SemanticChipRow
                  tags={catalogTags}
                  selected={activeChip}
                  onChange={setActiveChip}
                  hint={activeChip !== ALL_TAG ? `Streaming "${activeChip}" across "${currentFolder?.title}"` : undefined}
                />
              )}
            </AnimatedReanimated.View>

            {exportPreparing && (
              <View style={[styles.preparingBar, { marginTop: 140 }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginLeft: 8 }}>
                  Preparing export…
                </Text>
              </View>
            )}

            {loading && !refreshing ? (
              <View style={[styles.center, { paddingTop: 140 }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <AnimatedReanimated.ScrollView
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: 140, paddingBottom: 120 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              >
                {showSubjectHub ? (
                  // ROOT — Subject Hub Grid
                  <>
                    <View style={styles.hubHeaderRow}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Your Subjects</Text>
                      <View style={[styles.viewToggle, { backgroundColor: colors.surfaceStrong }]}>
                        <TouchableOpacity
                          onPress={() => setHubLayout('grid')}
                          style={[
                            styles.viewToggleBtn,
                            hubLayout === 'grid' && { backgroundColor: colors.surface }
                          ]}
                          data-testid="vault-hub-grid"
                        >
                          <LayoutGrid size={11} color={hubLayout === 'grid' ? colors.textPrimary : colors.textTertiary} />
                          <Text style={[
                            styles.viewToggleText,
                            { color: hubLayout === 'grid' ? colors.textPrimary : colors.textTertiary }
                          ]}>Grid</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setHubLayout('list')}
                          style={[
                            styles.viewToggleBtn,
                            hubLayout === 'list' && { backgroundColor: colors.surface }
                          ]}
                          data-testid="vault-hub-list"
                        >
                          <ListIcon size={11} color={hubLayout === 'list' ? colors.textPrimary : colors.textTertiary} />
                          <Text style={[
                            styles.viewToggleText,
                            { color: hubLayout === 'list' ? colors.textPrimary : colors.textTertiary }
                          ]}>List</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {hubLayout === 'grid' ? (
                      <SubjectHubGrid
                        folders={[...topLevelFolders, ...topLevelOrphans]}
                        onOpen={(n) => {
                          if (n.type === 'folder') navigateToFolder(n);
                          else openNode(n);
                        }}
                        onAction={onHubAction}
                      />
                    ) : (
                      <View style={{ paddingHorizontal: 4 }}>
                        {[...topLevelFolders, ...topLevelOrphans].map((item) => {
                          const isNoteLike = (item.type === 'note' || item.type === 'notebook') && !!item.note_id;
                          const isGlance = glanceOpen.has(item.id);
                          return (
                            <View key={item.id}>
                              <NoteRow
                                node={item}
                                expanded={expanded.has(item.id)}
                                onToggle={() => toggleExpand(item.id)}
                                onOpen={() => openNode(item)}
                                onAction={(action) => onAction(item, action)}
                                glanceExpanded={isNoteLike && isGlance}
                                onToggleGlance={isNoteLike ? () => toggleGlance(item.id) : undefined}
                                style={item.type !== 'folder' ? { opacity: 0.85, borderStyle: 'dashed', borderColor: colors.border, borderWidth: 0.5, borderRadius: 12, marginHorizontal: 4 } : undefined}
                              />
                              {isNoteLike && isGlance && item.note_id && (
                                <GlancePanel
                                  noteId={item.note_id}
                                  contentWidth={SCREEN_WIDTH - 32}
                                  selectedTag={ALL_TAG}
                                  onPlay={() => playNode(item)}
                                  onOpenEdit={() => openNode(item)}
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {topLevelFolders.length === 0 && topLevelOrphans.length === 0 && (
                      <View style={styles.empty}>
                        <Layers size={48} color={colors.border} />
                        <Text style={{ color: colors.textTertiary, marginTop: 12, fontWeight: '700' }}>
                          Tap + to create your first folder
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  // INSIDE A FOLDER — Aichii Tree + Glance
                  <>
                    <View style={styles.hubHeaderRow}>
                      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Contents</Text>
                      <View style={[styles.viewToggle, { backgroundColor: colors.surfaceStrong }]}>
                        <TouchableOpacity
                          onPress={() => setHubLayout('grid')}
                          style={[
                            styles.viewToggleBtn,
                            hubLayout === 'grid' && { backgroundColor: colors.surface }
                          ]}
                        >
                          <LayoutGrid size={11} color={hubLayout === 'grid' ? colors.textPrimary : colors.textTertiary} />
                          <Text style={[
                            styles.viewToggleText,
                            { color: hubLayout === 'grid' ? colors.textPrimary : colors.textTertiary }
                          ]}>Grid</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setHubLayout('list')}
                          style={[
                            styles.viewToggleBtn,
                            hubLayout === 'list' && { backgroundColor: colors.surface }
                          ]}
                        >
                          <ListIcon size={11} color={hubLayout === 'list' ? colors.textPrimary : colors.textTertiary} />
                          <Text style={[
                            styles.viewToggleText,
                            { color: hubLayout === 'list' ? colors.textPrimary : colors.textTertiary }
                          ]}>List</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {hubLayout === 'grid' ? (
                      <SubjectHubGrid
                        folders={displayRows}
                        onOpen={(n) => {
                          if (n.type === 'folder') navigateToFolder(n);
                          else openNode(n);
                        }}
                        onAction={onHubAction}
                      />
                    ) : (
                      <View style={{ paddingHorizontal: 4 }}>
                        {displayRows.map((item) => {
                          const isNoteLike = (item.type === 'note' || item.type === 'notebook') && !!item.note_id;
                          const isGlance = glanceOpen.has(item.id);
                          return (
                            <View key={item.id}>
                              <NoteRow
                                node={item}
                                expanded={expanded.has(item.id)}
                                onToggle={() => toggleExpand(item.id)}
                                onOpen={() => openNode(item)}
                                onAction={(action) => onAction(item, action)}
                                glanceExpanded={isNoteLike && isGlance}
                                onToggleGlance={isNoteLike ? () => toggleGlance(item.id) : undefined}
                              />
                              {isNoteLike && isGlance && item.note_id && (
                                <GlancePanel
                                  noteId={item.note_id}
                                  contentWidth={SCREEN_WIDTH - 32}
                                  selectedTag={activeChip}
                                  onPlay={() => playNode(item)}
                                  onOpenEdit={() => openNode(item)}
                                />
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                    {displayRows.length === 0 && (
                      <View style={styles.empty}>
                        <Layers size={48} color={colors.border} />
                        <Text style={{ color: colors.textTertiary, marginTop: 12 }}>Empty here</Text>
                      </View>
                    )}
                  </>
                )}
              </AnimatedReanimated.ScrollView>
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: colors.primary }]}
          onPress={() => { setCreateParentId(currentFolder?.id ?? null); setAddMenuOpen(true); }}
          data-testid="vault-fab"
        >
          <Plus size={28} color="#04223a" />
        </TouchableOpacity>

        {/* ADD MENU */}
        <Modal visible={addMenuOpen} transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
          <Pressable style={styles.overlay} onPress={() => setAddMenuOpen(false)}>
            <View style={[styles.addMenuContent, { backgroundColor: colors.surface }]}>
              <AddMenuItem
                icon={<FolderPlus size={22} color="#f59e0b" />}
                title="Create Folder"
                sub="Organize notes by subject"
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
                  data-testid="create-title-input"
                  value={createTitle}
                  onChangeText={setCreateTitle}
                  placeholder="Enter title…"
                  placeholderTextColor={colors.textTertiary}
                  style={[styles.premiumInput, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]}
                  autoFocus
                />
                <TouchableOpacity
                  testID="create-confirm"
                  data-testid="create-confirm"
                  onPress={doCreate}
                  style={[styles.bigCreateBtn, { backgroundColor: colors.primary }]}
                >
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
                <TextInput
                  testID="rename-input"
                  data-testid="rename-input"
                  value={renameValue}
                  onChangeText={setRenameValue}
                  autoFocus
                  style={[styles.premiumInput, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]}
                />
                <View style={styles.dialogActions}>
                  <TouchableOpacity onPress={() => setRenameOpen(false)} style={styles.modalCancel}>
                    <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="rename-save"
                    data-testid="rename-save"
                    onPress={doRename}
                    style={[styles.modalCreate, { backgroundColor: colors.primary }]}
                  >
                    <Text style={{ color: '#04223a', fontWeight: '900' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* --- Context Menu (Notability Style) --- */}
        <Modal
          visible={contextMenu.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setContextMenu({ visible: false, node: null, x: 0, y: 0 })}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setContextMenu({ ...contextMenu, visible: false })}
          >
            <View style={[
              styles.contextMenu, 
              { 
                backgroundColor: colors.surface, 
                borderColor: colors.border,
                position: 'absolute',
                top: Math.min(contextMenu.y, Dimensions.get('window').height - 250),
                left: Math.min(contextMenu.x, Dimensions.get('window').width - 240),
              }
            ]}>
              <TouchableOpacity 
                style={styles.contextItem}
                onPress={() => {
                  const node = contextMenu.node;
                  setContextMenu({ visible: false, node: null, x: 0, y: 0 });
                  if (node) {
                    setCreateParentId(node.id);
                    setCreateType('folder');
                    setCreateOpen(true);
                  }
                }}
              >
                <FolderPlus size={18} color={colors.textPrimary} />
                <Text style={[styles.contextText, { color: colors.textPrimary }]}>Insert folder</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.contextItem}
                onPress={() => {
                  const node = contextMenu.node;
                  setContextMenu({ visible: false, node: null, x: 0, y: 0 });
                  if (node) {
                    setEditFolderTitle(node.title);
                    setActionNodeId(node.id);
                    setEditFolderOpen(true);
                  }
                }}
              >
                <Edit2 size={18} color={colors.textPrimary} />
                <Text style={[styles.contextText, { color: colors.textPrimary }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.contextItem}
                onPress={() => {
                  const node = contextMenu.node;
                  setContextMenu({ visible: false, node: null, x: 0, y: 0 });
                  if (node) {
                    setRenameValue(node.title);
                    setActionNodeId(node.id);
                    setRenameOpen(true);
                  }
                }}
              >
                <Edit2 size={18} color={colors.textPrimary} />
                <Text style={[styles.contextText, { color: colors.textPrimary }]}>Rename</Text>
              </TouchableOpacity>

              <View style={[styles.contextDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity 
                style={styles.contextItem}
                onPress={() => {
                  const node = contextMenu.node;
                  setContextMenu({ visible: false, node: null, x: 0, y: 0 });
                  if (node) doDelete(node);
                }}
              >
                <Trash2 size={18} color="#ef4444" />
                <Text style={[styles.contextText, { color: '#ef4444' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        {/* --- Edit Folder Modal (Screenshot 3 Style) --- */}
        <Modal
          visible={editFolderOpen}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setEditFolderOpen(false)}
        >
          <PageWrapper>
            <View style={[styles.fullModal, { backgroundColor: colors.bg }]}>
              <View style={[styles.editModalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setEditFolderOpen(false)}>
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{editFolderTitle || 'Edit Folder'}</Text>
                <TouchableOpacity onPress={async () => {
                  // Perform Save (for now just rename)
                  if (actionNodeId) {
                    try {
                      await supabase.rpc('rename_note_node', {
                        p_node_id: actionNodeId, p_user_id: session?.user.id, p_title: editFolderTitle.trim(),
                      });
                      setEditFolderOpen(false);
                      await load();
                    } catch (err) {
                      console.error("Save error:", err);
                      Alert.alert("Error", "Failed to save changes.");
                    }
                  }
                }}>
                  <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={{ flex: 1, padding: 20 }}>
                <TextInput
                  value={editFolderTitle}
                  onChangeText={setEditFolderTitle}
                  style={[styles.modalInput, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
                  placeholder="Folder title"
                />

                <View style={{ marginTop: 24 }}>
                  <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>CHOOSE COLOR</Text>
                  <View style={styles.colorGrid}>
                    {SUBJECT_PALETTE.map((p, i) => (
                      <TouchableOpacity 
                        key={i}
                        onPress={() => setEditFolderColor(p.bg)}
                        style={[
                          styles.colorDot, 
                          { backgroundColor: p.fg },
                          editFolderColor === p.bg && { borderWidth: 3, borderColor: colors.textPrimary }
                        ]}
                      />
                    ))}
                  </View>
                </View>

                <View style={[styles.modalRow, { marginTop: 32 }]}>
                  <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '600' }}>Lock folder</Text>
                  {/* Switch would go here */}
                  <View style={{ width: 50, height: 28, borderRadius: 14, backgroundColor: colors.border }} />
                </View>

                <TouchableOpacity 
                  style={[styles.deleteBtn, { marginTop: 40 }]}
                  onPress={() => {
                    const node = allNodes.find(n => n.id === actionNodeId);
                    if (node) {
                      setEditFolderOpen(false);
                      doDelete(node);
                    }
                  }}
                >
                  <Trash2 size={20} color="#ef4444" />
                  <Text style={{ color: '#ef4444', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>Delete folder</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </PageWrapper>
        </Modal>

        <PremiumMoveSheet
          visible={moveOpen}
          title={`Move "${actionNode?.title}" to…`}
          targets={moveTargets.filter((f) => f.id !== actionNode?.id)}
          currentSelectedId={actionNode?.parent_id}
          onClose={() => setMoveOpen(false)}
          onConfirm={doMove}
        />

        {/* Unified export sheet */}
        <UnifiedExportSheet
          visible={exportSheet.visible}
          onClose={() => setExportSheet({ ...exportSheet, visible: false })}
          payload={exportSheet.payload}
          title={exportSheet.title}
          initialOptions={{
            title: exportSheet.title,
            moduleName: 'Knowledge Vault',
            theme: 'modern',
            paperStyle: 'plain',
            fontFamily: 'sans',
            fontSize: 6,
            showTOC: false,
            headerText: 'Dr. UPSC · Notes',
            footerText: exportSheet.title,
            notesSubheadingColor: '#6A5BFF20',
          }}
          hideSections={['content', 'answer', 'sort', 'filters']}
        />
      </View>
    </PageWrapper>
  );
}

function flattenAll(nodes: NoteNode[]): NoteNode[] {
  return nodes.reduce<NoteNode[]>((acc, node) => {
    acc.push(node);
    acc.push(...flattenAll(node.children));
    return acc;
  }, []);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { borderBottomWidth: 1, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8 },
  sidebar: { width: 286, borderRightWidth: 0.5 },
  splitContent: { flex: 1 },
  sidebarHeader: { borderBottomWidth: 0.5, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, marginLeft: 2, marginBottom: 2 },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, gap: 8, marginTop: 4 },
  searchInput: { flex: 1, fontSize: 14 },

  topActionArea: { paddingHorizontal: 16, marginTop: 12, marginBottom: 8 },
  statsBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 14 },
  statBox: { width: '47%', flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 13, borderRadius: 14, gap: 10 },
  statIconBox: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statNum: { fontSize: 20, fontWeight: '800', lineHeight: 22 },
  statLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },

  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, paddingHorizontal: 16, marginBottom: 8 },
  viewToggle: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  viewToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8 },
  viewToggleText: { fontSize: 11, fontWeight: '700' },

  preparingBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 6 },

  fab: { position: 'absolute', bottom: 30, right: 20, width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  empty: { padding: 80, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  dialogTitle: { fontSize: 20, fontWeight: '900' },
  dialogActions: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, alignItems: 'center', padding: 16 },
  modalCreate: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16 },

  addMenuContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  addItemIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  addItemContent: { flex: 1 },
  addItemTitle: { fontSize: 17, fontWeight: '800' },
  addItemSub: { fontSize: 13, marginTop: 2 },

  createSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  premiumInput: { height: 60, borderRadius: 18, paddingHorizontal: 20, fontSize: 17, fontWeight: '600', marginVertical: 24 },
  bigCreateBtn: { height: 60, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bigCreateBtnTxt: { color: '#04223a', fontSize: 17, fontWeight: '900' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)' },
  contextMenu: {
    width: 220,
    borderRadius: 18,
    borderWidth: 1,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 20,
  },
  contextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderRadius: 12,
  },
  contextText: { fontSize: 15, fontWeight: '600' },
  contextDivider: { height: 1, marginVertical: 4 },

  fullModal: { flex: 1 },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalInput: {
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '600',
  },
  sectionLabel: { fontSize: 11, fontWeight: '800', marginBottom: 16, letterSpacing: 0.8, marginTop: 8 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'center', paddingVertical: 10 },
  colorDot: { width: 34, height: 34, borderRadius: 17 },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 14, borderWidth: 1, borderColor: '#fee2e2' },
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
