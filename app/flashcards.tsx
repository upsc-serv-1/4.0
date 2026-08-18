import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FeatureGate from '../src/components/FeatureGate';
import {
  View, Text, StyleSheet, ActivityIndicator, ScrollView,
  TouchableOpacity, Modal, TextInput, Alert, FlatList, RefreshControl, Pressable,
  KeyboardAvoidingView, Platform, Keyboard, useWindowDimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useFocusEffect } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {
  Plus, Search as SearchIcon, X, Flame, Clock, Sparkles, Layers, Zap, ArrowUpDown,
  Folder, CheckCircle2, Minus, ChevronLeft, ArrowUpRight, Settings, MoreVertical,
  FolderPlus, Play, ChevronRight, Trash, Check, FileDown, Cloud, CloudOff, RefreshCw
} from 'lucide-react-native';
import { supabase } from '../src/lib/supabase';
import { SyncQueue } from '../src/services/SyncQueue';
import { useAuth } from '../src/context/AuthContext';
import { useTheme } from '../src/context/ThemeContext';
import { ThemeSwitcher } from '../src/components/ThemeSwitcher';
import { PageWrapper } from '../src/components/PageWrapper';
import { FolderAlgorithmModal } from '../src/components/flashcards/FolderAlgorithmModal';

import { BranchSvc, BranchNode } from '../src/services/BranchService';
import { DeckRow, type DeckRowAction } from '../src/components/flashcards/DeckRow';
import { PremiumMoveModal } from '../src/components/flashcards/PremiumMoveModal';
import { UnifiedExportSheet } from '../src/components/export/UnifiedExportSheet';
import type { ExportPayload, ExportFlashcard } from '../src/lib/unifiedExportEngine';
import { BranchColors, DEFAULT_BRANCH_COLORS } from '../src/lib/branchColors';
import { usePreventRemove } from '@react-navigation/native';

function FlashcardsHub() {
  const { width } = useWindowDimensions();
  const paddingH = width > 768 ? 64 : 16;
  const { colors } = useTheme();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tree, setTree] = useState<BranchNode[]>([]);
  const [search, setSearch] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [currentFolder, setCurrentFolder] = useState<BranchNode | null>(null);

  usePreventRemove(
    currentFolder !== null,
    () => {
      setCurrentFolder(null);
    }
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const navLock = React.useRef(false);
  const [syncStatusVisible, setSyncStatusVisible] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Modals
  const [addMenuVisible, setAddMenuVisible] = useState(false);
  const [createModal, setCreateModal] = useState<{ type: 'folder' | 'deck', parentId?: string | null, parentName?: string, color?: string } | null>(null);
  const [renameModal, setRenameModal] = useState<{ node: BranchNode } | null>(null);
  const [moveModal, setMoveModal] = useState<{ node: BranchNode } | null>(null);
  const [emptyCardModal, setEmptyCardModal] = useState<'due' | 'new' | null>(null);
  const [algorithmModalVisible, setAlgorithmModalVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Bulk Delete Selection
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      'Delete Selected?',
      `Are you sure you want to delete all ${selectedIds.size} selected folders/decks?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const idsArray = Array.from(selectedIds);
              for (const id of idsArray) {
                await BranchSvc.softDelete(id);
              }
              setSelectedIds(new Set());
              setIsSelectionMode(false);
              await load();
            } catch (e: any) {
              Alert.alert('Delete failed', e?.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleBulkExport = async () => {
    if (selectedIds.size === 0 || !uid) return;
    try {
      setPreparingExportId('__bulk__');
      const selectedNodes = BranchSvc.flatten(tree).filter(n => selectedIds.has(n.id));

      // Collect card IDs from all selected branches recursively
      const allCardIds: string[] = [];
      for (const node of selectedNodes) {
        const ids = await BranchSvc.listCardIdsInBranch(node.id, {
          recursive: true,
          userId: uid,
        });
        allCardIds.push(...ids);
      }

      if (allCardIds.length === 0) {
        Alert.alert('Nothing to export', 'Selected decks have no cards yet.');
        return;
      }

      const uniqueCardIds = [...new Set(allCardIds)];
      const { data, error } = await supabase
        .from('user_cards')
        .select(`
          card_id,
          learning_status,
          cards!inner(
            id,
            front_text,
            back_text,
            question_text,
            answer_text,
            subject,
            section_group,
            microtopic
          )
        `)
        .eq('user_id', uid)
        .eq('status', 'active')
        .in('card_id', uniqueCardIds);

      if (error) throw error;

      const rows: ExportFlashcard[] = (data ?? []).map((row: any) => {
        const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
        return {
          id: row.card_id,
          front: String(card?.front_text || card?.question_text || '').trim() || 'Front unavailable',
          back: String(card?.back_text || card?.answer_text || '').trim() || 'Back unavailable',
          deck: selectedNodes.length === 1 ? selectedNodes[0].name : 'Bulk Export',
          state: normalizeLearningState(row.learning_status),
          subject: card?.subject || undefined,
          micro_topic: card?.microtopic || card?.section_group || undefined,
        };
      });

      const uniqueRows: ExportFlashcard[] = Array.from(new Map<string, ExportFlashcard>(rows.map((r) => [r.id, r])).values());
      if (uniqueRows.length === 0) {
        Alert.alert('Nothing to export', 'Selected decks have no active cards yet.');
        return;
      }

      setExportPayload({ kind: 'flashcards', rows: uniqueRows } as ExportPayload);
      setExportTitle(`${selectedIds.size} Deck${selectedIds.size > 1 ? 's' : ''} · ${uniqueRows.length} Cards`);
      setExportSheetVisible(true);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not prepare flashcards export.');
    } finally {
      setPreparingExportId(null);
    }
  };
  
  const FOLDER_COLORS = DEFAULT_BRANCH_COLORS;
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);
  const [branchColorMap, setBranchColorMap] = useState<Record<string, string>>({});

  // Load saved branch colors and subscribe to changes
  useEffect(() => {
    let mounted = true;
    BranchColors.loadAll().then((m) => { if (mounted) setBranchColorMap(m); });
    const unsub = BranchColors.subscribe(() => {
      BranchColors.loadAll().then((m) => { if (mounted) setBranchColorMap(m); });
    });
    return () => { mounted = false; unsub(); };
  }, []);

  const [exportSheetVisible, setExportSheetVisible] = useState(false);
  const [exportPayload, setExportPayload] = useState<ExportPayload | null>(null);
  const [exportTitle, setExportTitle] = useState('Flashcards Export');
  const [preparingExportId, setPreparingExportId] = useState<string | null>(null);
  const [capAwareStats, setCapAwareStats] = useState<{ due: number; new: number; total: number } | null>(null);

  const treeRef = React.useRef(tree);
  treeRef.current = tree;

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const updateTreeState = (freshTree: BranchNode[]) => {
        setTree(freshTree);
        setCurrentFolder(prev => {
          if (!prev) return null;
          const flat = BranchSvc.flatten(freshTree);
          return flat.find(n => n.id === prev.id) ?? null;
        });
      };

      // Always use cache-first for instant render of local reviews, which will also trigger a background refresh
      const t = await BranchSvc.buildTreeCacheFirst(uid, updateTreeState);
      updateTreeState(t);
    } catch (e: any) {
      console.error('[DrUPSCHub] load error:', e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
      navLock.current = false;
    }
  }, [uid]);

  useFocusEffect(useCallback(() => { 
    navLock.current = false; 
    setPendingSyncCount(SyncQueue.pendingCount());
    load(); 
  }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); };

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const result = await SyncQueue.drain();
      setPendingSyncCount(SyncQueue.pendingCount());
      if (result.flushed > 0 || result.failed > 0) {
        Alert.alert('Sync Complete', `Successfully synced ${result.flushed} items.\nFailed: ${result.failed}`);
      } else {
        Alert.alert('Sync Status', 'Everything is up to date.');
      }
    } catch (e: any) {
      Alert.alert('Sync Error', e?.message || 'An error occurred during sync.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch cap-aware stats (applies daily limits matching the review screen)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!uid) return;
      try {
        const folder = currentFolder ? { branch_id: currentFolder.id, recursive: true, userId: uid } : undefined;
        const stats = await (await import('../src/services/FlashcardService')).FlashcardSvc.getFolderStats(uid, folder as any);
        if (cancelled) return;
        setCapAwareStats({
          due: (stats.learning_due || 0) + (stats.review_due || 0),
          new: stats.not_studied || 0,
          total: stats.total || 0,
        });
      } catch { /* fall back to tree stats */ }
    })();
    return () => { cancelled = true; };
  }, [uid, currentFolder]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const displayRows = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return BranchSvc.flatten(tree).filter(n => n.name.toLowerCase().includes(q));
    }
    
    if (currentFolder) {
      const baseDepth = currentFolder.depth + 1;
      return BranchSvc.flatten(currentFolder.children, expanded).map(n => ({
        ...n,
        depth: Math.max(0, n.depth - baseDepth)
      }));
    }
    
    return BranchSvc.flatten(tree, expanded);
  }, [tree, search, currentFolder, expanded]);

  const aggregateStats = useMemo(() => {
    // Use cap-aware stats (applies daily limits) when available, fall back to tree counts.
    if (capAwareStats) return capAwareStats;
    let due = 0, new_ = 0, total = 0;
    const targetSet = currentFolder ? [currentFolder] : tree;
    targetSet.forEach(n => { due += n.due_count; new_ += n.new_count; total += n.total_count; });
    return { due, new: new_, total };
  }, [tree, currentFolder, capAwareStats]);

  const handleMove = async (targetParentId: string | null) => {
    if (!moveModal) return;
    try {
      await BranchSvc.move(moveModal.node.id, targetParentId);
      setMoveModal(null);
      await load();
    } catch (e: any) { Alert.alert('Move failed', e?.message); }
  };

  const handleCreate = async () => {
    if (!uid || !nameDraft.trim() || !createModal) return;
    try {
      const isFolder = createModal.type === 'folder';
      const pid = createModal.parentId !== undefined ? createModal.parentId : (currentFolder?.id ?? null);
      const created = await BranchSvc.create(uid, nameDraft.trim(), pid, isFolder);
      // Persist selected color for this branch (folder or deck)
      try {
        if (selectedColor) {
          await BranchColors.setColor(created.id, selectedColor);
        }
      } catch {}
      if (pid) {
        setExpanded(prev => {
          const next = new Set(prev);
          next.add(pid);
          return next;
        });
      }
      setCreateModal(null);
      setNameDraft('');
      setSelectedColor(FOLDER_COLORS[0]);
      await load();
    } catch (e: any) { Alert.alert('Error', e?.message); }
  };

  const normalizeLearningState = (value?: string): 'learning' | 'learned' | 'mastered' | 'due' | undefined => {
    const v = (value || '').toLowerCase();
    if (v === 'mastered') return 'mastered';
    if (v === 'review') return 'learned';
    if (v === 'learning' || v === 'leech') return 'learning';
    if (v === 'new' || v === 'not_studied') return 'due';
    return undefined;
  };

  const handleExportNode = async (node: BranchNode) => {
    if (!uid) {
      Alert.alert('Login required', 'Please log in to export flashcards.');
      return;
    }

    try {
      setPreparingExportId(node.id);

      let cardIds = await BranchSvc.listCardIdsInBranch(node.id, {
        recursive: true, // Issue 29: Always recursive to include child decks
        userId: uid,
      });

      if (cardIds.length === 0) {
        const leafCardIds = await BranchSvc.listCardIdsInBranch(node.id, {
          recursive: false,
          userId: uid,
        });
        if (leafCardIds.length === 0) {
          Alert.alert('Nothing to export', `${node.name} has no cards yet.`);
          return;
        }
        cardIds.push(...leafCardIds);
      }

      const { data, error } = await supabase
        .from('user_cards')
        .select(`
          card_id,
          learning_status,
          cards!inner(
            id,
            front_text,
            back_text,
            question_text,
            answer_text,
            subject,
            section_group,
            microtopic
          )
        `)
        .eq('user_id', uid)
        .eq('status', 'active')
        .in('card_id', cardIds);

      if (error) throw error;

      const rows: ExportFlashcard[] = (data ?? []).map((row: any) => {
        const card = Array.isArray(row.cards) ? row.cards[0] : row.cards;
        return {
          id: row.card_id,
          front: String(card?.front_text || card?.question_text || '').trim() || 'Front unavailable',
          back: String(card?.back_text || card?.answer_text || '').trim() || 'Back unavailable',
          deck: node.path || node.name,
          state: normalizeLearningState(row.learning_status),
          subject: card?.subject || undefined,
          micro_topic: card?.microtopic || card?.section_group || undefined,
        };
      });

      const uniqueRows: ExportFlashcard[] = Array.from(new Map<string, ExportFlashcard>(rows.map((r) => [r.id, r])).values());

      if (uniqueRows.length === 0) {
        Alert.alert('Nothing to export', `${node.name} has no active cards yet.`);
        return;
      }

      setExportPayload({ kind: 'flashcards', rows: uniqueRows } as ExportPayload);
      setExportTitle(`${node.name} Flashcards`);
      setExportSheetVisible(true);
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not prepare flashcards export.');
    } finally {
      setPreparingExportId(null);
    }
  };

  const openDeck = (node: BranchNode) => {
    if (navLock.current) return;
    navLock.current = true;
    router.push({
      pathname: '/flashcards/microtopic',
      params: { branchId: node.id, branchName: node.name, recursive: '1' },
    } as any);
  };

  const onAction = (node: BranchNode, action: DeckRowAction) => {
    switch (action) {
      case 'export':
        handleExportNode(node);
        break;
      case 'move':
        setMoveModal({ node });
        break;
      case 'rename':
        setRenameModal({ node });
        setNameDraft(node.name);
        break;
      case 'delete':
        Alert.alert('Delete?', `Are you sure you want to delete ${node.name}?`, [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive', 
            onPress: async () => {
              try {
                await BranchSvc.softDelete(node.id);
                await load();
              } catch (e: any) { Alert.alert('Delete failed', e?.message); }
            } 
          }
        ]);
        break;
      case 'add':
        setCreateModal({ type: 'deck', parentId: node.id, parentName: node.name });
        break;
      case 'settings':
        openDeck(node);
        break;
    }
  };

  const handleRename = async () => {
    if (!renameModal || !nameDraft.trim()) return;
    try {
      await BranchSvc.rename(renameModal.node.id, nameDraft.trim());
      setRenameModal(null);
      setNameDraft('');
      await load();
    } catch (e: any) { Alert.alert('Rename failed', e?.message); }
  };

  const startStudy = (mode: 'due' | 'new') => {
    const cardCount = mode === 'due' ? aggregateStats.due : aggregateStats.new;
    if (cardCount === 0) {
      setEmptyCardModal(mode);
      return;
    }
    router.push({
      pathname: '/flashcards/review',
      params: { 
        mode, 
        recursive: '1',
        branchId: currentFolder?.id || undefined
      }
    } as any);
  };



  return (
    <PageWrapper>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <Animated.View style={[styles.header, headerAnimatedStyle, { borderBottomColor: colors.border }]}>
          {isSelectionMode ? (
            <View style={[styles.headerTop, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} style={styles.iconBtn}>
                  <X size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '700', color: colors.textPrimary }}>
                  {selectedIds.size} Selected
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  onPress={() => {
                    const allIds = displayRows.map(r => r.id);
                    setSelectedIds(new Set(allIds));
                  }} 
                  style={[styles.iconBtn, { width: 'auto', paddingHorizontal: 10 }]}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleBulkExport}
                  disabled={selectedIds.size === 0}
                  style={[styles.iconBtn, { width: 'auto', paddingHorizontal: 10, opacity: selectedIds.size === 0 ? 0.4 : 1 }]}
                >
                  <Text style={{ color: '#06b6d4', fontWeight: '700', fontSize: 14 }}>Export</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleBulkDelete}
                  disabled={selectedIds.size === 0}
                  style={[styles.iconBtn, { opacity: selectedIds.size === 0 ? 0.4 : 1 }]}
                >
                  <Trash size={22} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.headerTop}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => currentFolder ? setCurrentFolder(null) : router.back()} style={styles.iconBtn}>
                  <ChevronLeft size={28} color={colors.primary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                  {currentFolder ? currentFolder.name : 'Home'}
                </Text>
              </View>
              <View style={styles.headerBtns}>
                <TouchableOpacity onPress={() => { setPendingSyncCount(SyncQueue.pendingCount()); setSyncStatusVisible(true); }} style={styles.iconBtn}>
                  {pendingSyncCount > 0 && !isSyncing && (
                    <View style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', zIndex: 10 }} />
                  )}
                  {isSyncing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : pendingSyncCount > 0 ? (
                    <CloudOff size={22} color={colors.textPrimary} />
                  ) : (
                    <Cloud size={22} color={colors.textPrimary} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setAlgorithmModalVisible(true)} style={styles.iconBtn}>
                  <Settings size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSearchVisible(v => !v)} style={styles.iconBtn}>
                  <SearchIcon size={22} color={colors.textPrimary} />
                </TouchableOpacity>
                <ThemeSwitcher />
              </View>
            </View>
          )}
          {searchVisible && (
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <SearchIcon size={16} color={colors.textTertiary} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search..." placeholderTextColor={colors.textTertiary} style={[styles.searchInput, { color: colors.textPrimary }]} autoFocus />
              <TouchableOpacity onPress={() => { setSearch(''); setSearchVisible(false); Keyboard.dismiss(); }}><X size={16} color={colors.textTertiary} /></TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <Animated.ScrollView 
          onScroll={scrollHandler} 
          scrollEventThrottle={16} 
          showsVerticalScrollIndicator={false} 
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />} 
          contentContainerStyle={{ paddingTop: 110, paddingBottom: 100 }}
        >
          {/* Global Stats removed per user request */}
          {loading ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border + '60' }} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ height: 14, width: `${70 - i * 8}%`, borderRadius: 6, backgroundColor: colors.border + '50' }} />
                    <View style={{ height: 10, width: `${40 - i * 5}%`, borderRadius: 6, backgroundColor: colors.border + '30' }} />
                  </View>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border + '40' }} />
                </View>
              ))}
            </View>
          ) : (
            <>
          {preparingExportId && (
            <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Preparing PDF export...</Text>
              </View>
            </View>
          )}
          <View style={{ paddingHorizontal: paddingH }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, overflow: 'hidden' }}>
            {displayRows.map((item) => {
              const isSelected = selectedIds.has(item.id);
              return (
                <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isSelectionMode && (
                    <TouchableOpacity 
                      onPress={() => handleToggleSelect(item.id)} 
                      style={{ paddingLeft: 12, paddingRight: 4 }}
                    >
                      <CheckCircle2 
                        size={24} 
                        color={isSelected ? colors.primary : colors.border} 
                        style={isSelected ? {} : { opacity: 0.5 }}
                      />
                    </TouchableOpacity>
                  )}
                  <View style={{ flex: 1 }}>
                    <DeckRow 
                      node={item} 
                      expanded={expanded.has(item.id)} 
                      color={branchColorMap[item.id]}
                      onToggle={() => toggleExpand(item.id)} 
                      onOpen={() => { 
                        if (isSelectionMode) {
                          handleToggleSelect(item.id);
                        } else if (item.is_folder && item.depth === 0) {
                          setCurrentFolder(item);
                        } else {
                          openDeck(item);
                        }
                      }} 
                      onAction={(action) => onAction(item, action)} 
                    />
                  </View>
                </View>
              );
            })}
            </View>
          </View>
          {displayRows.length === 0 && !loading && (
            <View style={styles.empty}><Zap size={48} color={colors.border} /><Text style={{ color: colors.textTertiary, marginTop: 12 }}>Empty</Text></View>
          )}
          </>
          )}
        </Animated.ScrollView>

        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setAddMenuVisible(true)}>
          <Plus size={28} color="#04223a" />
        </TouchableOpacity>

        {/* Modals */}
        {/* Sync Status Modal */}
        <Modal visible={syncStatusVisible} transparent animationType="fade" onRequestClose={() => setSyncStatusVisible(false)}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setSyncStatusVisible(false)}>
            <View style={[styles.modalContent, { backgroundColor: colors.surface, padding: 24, alignItems: 'center' }]}>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: pendingSyncCount > 0 ? '#fef08a' : '#bbf7d0', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                {pendingSyncCount > 0 ? <CloudOff size={32} color="#ca8a04" /> : <Cloud size={32} color="#16a34a" />}
              </View>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 }}>
                Sync Status
              </Text>
              <Text style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>
                {pendingSyncCount > 0 
                  ? `You have ${pendingSyncCount} offline changes waiting to sync to the cloud.`
                  : 'All your flashcards and progress are safely backed up to the cloud!'}
              </Text>
              
              <TouchableOpacity 
                onPress={handleForceSync}
                disabled={isSyncing || pendingSyncCount === 0}
                style={{
                  width: '100%', paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  backgroundColor: pendingSyncCount > 0 ? colors.primary : colors.border,
                  opacity: (isSyncing || pendingSyncCount === 0) ? 0.6 : 1
                }}
              >
                {isSyncing ? <ActivityIndicator color="#fff" /> : <RefreshCw size={20} color={pendingSyncCount > 0 ? "#fff" : colors.textTertiary} />}
                <Text style={{ color: pendingSyncCount > 0 ? "#fff" : colors.textTertiary, fontWeight: '700', fontSize: 16 }}>
                  {isSyncing ? 'Syncing...' : pendingSyncCount > 0 ? 'Sync Now' : 'Up to Date'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSyncStatusVisible(false)} style={{ marginTop: 16, padding: 8 }}>
                <Text style={{ color: colors.textTertiary, fontWeight: '600' }}>Close</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Add Menu Modal */}
        <Modal visible={addMenuVisible} transparent animationType="fade" onRequestClose={() => setAddMenuVisible(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setAddMenuVisible(false)}>
            <View style={[styles.addMenuContent, { backgroundColor: colors.surface }]}>
              <AddMenuItem 
                icon={<Zap size={22} color={colors.textPrimary} />} 
                title="Create deck" 
                sub="Organize flashcards into decks" 
                onPress={() => { setAddMenuVisible(false); setCreateModal({ type: 'deck' }); }} 
              />
              <AddMenuItem 
                icon={<FolderPlus size={22} color={colors.textPrimary} />} 
                title="Create folder" 
                sub="Organize decks into folders" 
                onPress={() => { setAddMenuVisible(false); setCreateModal({ type: 'folder' }); }} 
              />
              <AddMenuItem
                icon={<Zap size={22} color="#06b6d4" />}
                title="Select to Manage"
                sub="Select multiple decks to export or delete"
                onPress={() => { setAddMenuVisible(false); setIsSelectionMode(true); setSelectedIds(new Set()); }}
              />
            </View>
          </Pressable>
        </Modal>

        {/* Create Modal */}
        <Modal visible={!!createModal} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <Pressable style={{ flex: 1 }} onPress={() => setCreateModal(null)} />
              <View style={[styles.createSheet, { backgroundColor: colors.surface }]}>
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                    {createModal?.type === 'folder' ? 'Create folder' : 'Create deck'}
                  </Text>
                  <TouchableOpacity onPress={() => setCreateModal(null)} style={styles.closeBtn}>
                    <X size={20} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>

                <TextInput 
                  placeholder={createModal?.type === 'folder' ? 'Folder name' : 'Deck name'} 
                  placeholderTextColor={colors.textTertiary} 
                  style={[styles.premiumInput, { color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]} 
                  value={nameDraft} 
                  onChangeText={setNameDraft} 
                  autoFocus 
                />

                {createModal && (
                  <View style={styles.iconColorSection}>
                    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>
                      {createModal?.type === 'folder' ? 'Folder color' : 'Deck color'}
                    </Text>
                    <View style={styles.colorRow}>
                      <View style={[styles.iconBox, { backgroundColor: colors.surfaceStrong }]}>
                        {createModal?.type === 'folder' ? (
                          <Folder size={20} color={selectedColor} />
                        ) : (
                          <Zap size={20} color={selectedColor} />
                        )}
                      </View>
                      <View style={styles.colorsList}>
                        {FOLDER_COLORS.map(c => (
                          <TouchableOpacity 
                            key={c} 
                            onPress={() => setSelectedColor(c)} 
                            style={[
                              styles.colorCircle, 
                              { backgroundColor: c },
                              selectedColor === c && { borderWidth: 2, borderColor: colors.primary }
                            ]} 
                          />
                        ))}
                      </View>
                    </View>
                  </View>
                )}

                <TouchableOpacity 
                  onPress={handleCreate} 
                  style={[styles.bigCreateBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.bigCreateBtnTxt}>Create</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        
        <Modal visible={!!renameModal} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={styles.modalOverlay}>
              <Pressable style={{ flex: 1 }} onPress={() => setRenameModal(null)} />
              <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Rename</Text>
                <TextInput placeholder="New name" placeholderTextColor={colors.textTertiary} style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]} value={nameDraft} onChangeText={setNameDraft} autoFocus />
                <View style={styles.modalBtns}>
                  <TouchableOpacity onPress={() => setRenameModal(null)} style={styles.modalCancel}><Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity onPress={handleRename} style={[styles.modalCreate, { backgroundColor: colors.primary }]}><Text style={{ color: '#04223a', fontWeight: '900' }}>Save</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        <PremiumMoveModal visible={!!moveModal} node={moveModal?.node ?? null} tree={tree} onClose={() => setMoveModal(null)} onConfirm={handleMove} />

        {/* Empty Cards Modal */}
        <Modal visible={!!emptyCardModal} transparent animationType="fade" onRequestClose={() => setEmptyCardModal(null)}>
          <Pressable style={[styles.modalOverlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' }]} onPress={() => setEmptyCardModal(null)}>
            <View style={[styles.emptyCardModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Check size={56} color={colors.primary} style={{ marginBottom: 16 }} />
              <Text style={[styles.emptyCardTitle, { color: colors.textPrimary }]}>
                {emptyCardModal === 'due' ? 'All caught up!' : 'All new cards completed!'}
              </Text>
              <Text style={[styles.emptyCardSub, { color: colors.textTertiary, marginTop: 12 }]}>
                {emptyCardModal === 'due' ? 'No cards are due right now.' : 'No new cards available.'}
              </Text>
              <TouchableOpacity
                style={[styles.emptyCardBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
                onPress={() => setEmptyCardModal(null)}
              >
                <Text style={styles.emptyCardBtnText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>

        <UnifiedExportSheet
          visible={exportSheetVisible}
          onClose={() => setExportSheetVisible(false)}
          payload={exportPayload}
          title={exportTitle}
          initialOptions={useMemo(() => ({
            title: exportTitle,
            moduleName: 'Flashcards',
            showTOC: false,
            headerText: 'Dr. UPSC · Flashcards',
            footerText: exportTitle,
            sortBy: 'subject',
          }), [exportTitle])}
          hideSections={['content', 'answer', 'sort', 'filters']}
        />

        <FolderAlgorithmModal
          visible={algorithmModalVisible}
          userId={uid}
          onClose={() => setAlgorithmModalVisible(false)}
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderRadius: 24, padding: 24, width: '100%', maxWidth: 500, alignSelf: 'center' },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20 },
  modalInput: { borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 16, fontWeight: '600', marginBottom: 20 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, alignItems: 'center', padding: 16 },
  modalCreate: { flex: 1, alignItems: 'center', padding: 16, borderRadius: 16 },
  
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  addMenuContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  addMenuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  addItemIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  addItemContent: { flex: 1 },
  addItemTitle: { fontSize: 18, fontWeight: '700' },
  addItemSub: { fontSize: 13, marginTop: 2 },
  createSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40, width: '100%', position: 'absolute', bottom: 0 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f2f2f7', alignItems: 'center', justifyContent: 'center' },
  premiumInput: { height: 64, borderRadius: 20, paddingHorizontal: 20, fontSize: 18, fontWeight: '600', marginVertical: 20 },
  iconColorSection: { marginBottom: 30 },
  sectionLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  colorsList: { flexDirection: 'row', gap: 10, flex: 1 },
  colorCircle: { width: 44, height: 44, borderRadius: 22 },
  bigCreateBtn: { height: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bigCreateBtnTxt: { color: '#04223a', fontSize: 18, fontWeight: '900' },
  
  emptyCardModal: {
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '86%',
    maxWidth: 340,
    borderWidth: 1,
  },
  emptyCardTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyCardSub: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCardBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCardBtnText: {
    color: '#04223a',
    fontSize: 16,
    fontWeight: '900',
  },
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

export default function FlashcardsScreen() {
  return (
    <FeatureGate feature="flashcards" featureLabel="Flashcards">
      <FlashcardsHub />
    </FeatureGate>
  );
}
