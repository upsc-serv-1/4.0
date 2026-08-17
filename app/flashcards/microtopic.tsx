import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, TextInput, Modal, ScrollView, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Play, Plus, ArrowUpDown, SlidersHorizontal, MoreHorizontal, BookOpen, X, Check, Info, Clock, Settings, GraduationCap, Calendar
} from 'lucide-react-native';
import { supabase } from '../../src/lib/supabase';
import { NetworkStatus } from '../../src/lib/networkStatus';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { SkeletonCard } from '../../src/components/common/SkeletonLoader';
import { FlashcardSvc } from '../../src/services/FlashcardService';
import { Sparkles } from 'lucide-react-native';
import { logDiagEvent } from '../../src/../app/offline-diag';
import { CardOverflowMenu, CardMenuAction } from '../../src/components/flashcards/CardOverflowMenu';
import { SortSheet, SortKey } from '../../src/components/flashcards/SortSheet';
import { FilterSheet, FilterValue, EMPTY_FILTER } from '../../src/components/flashcards/FilterSheet';
import { FolderAlgorithmModal } from '../../src/components/flashcards/FolderAlgorithmModal';
import { AddToFlashcardSheet } from '../../src/components/flashcards/AddToFlashcardSheet';
import { PremiumMoveModal } from '../../src/components/flashcards/PremiumMoveModal';
import { BranchSvc, BranchNode } from '../../src/services/BranchService';
import { OfflineManager } from '../../src/services/OfflineManager';

interface CardItem {
  id: string;
  front_text: string;
  back_text: string;
  status: 'active' | 'frozen' | 'deleted';
  learning_status: 'not_studied' | 'new' | 'learning' | 'review' | 'mastered' | 'leech' | string;
  next_review?: string | null;
  last_reviewed?: string | null;
  updated_at: string;
  interval_days?: number;
}

interface Stats {
  for_today: number; not_studied: number; learning: number; mastered: number; total: number;
}

const SORT_LABELS: Record<SortKey, string> = {
  next: 'Next review', newest: 'Newest', oldest: 'Oldest', az: 'A-Z', za: 'Z-A',
};

export default function MicrotopicScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const { subject, section, microtopic, branchId, branchName, recursive } = useLocalSearchParams<{
    subject?: string; section?: string; microtopic?: string;
    branchId?: string; branchName?: string; recursive?: string;
  }>();
  const uid = session?.user?.id;
  const isBranchMode = !!branchId;
  const isRecursive = recursive === '1';

  const [loading, setLoading] = useState(true);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [cards, setCards] = useState<CardItem[]>([]);
  const [stats, setStats] = useState<Stats>({ for_today: 0, not_studied: 0, learning: 0, mastered: 0, total: 0 });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading && cards.length === 0) {
      timer = setTimeout(() => setShowSkeleton(true), 150);
    } else {
      setShowSkeleton(false);
    }
    return () => clearTimeout(timer);
  }, [loading, cards.length]);

  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterValue>(EMPTY_FILTER);

  const [sortSheet, setSortSheet] = useState(false);
  const [filterSheet, setFilterSheet] = useState(false);
  const [algoModal, setAlgoModal] = useState(false);

  const [menuCard, setMenuCard] = useState<CardItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuBusy, setMenuBusy] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');

  const [moveVisible, setMoveVisible] = useState(false);
  const [tree, setTree] = useState<BranchNode[]>([]);
  // Legacy free-text move fields (kept for backward compat — replaced by deck-tree picker via AddToFlashcardSheet).
  const [moveSubject, setMoveSubject] = useState('');
  const [moveSection, setMoveSection] = useState('');
  const [moveMicrotopic, setMoveMicrotopic] = useState('');

  const loadAll = useCallback(async () => {
    if (!uid) return;
    // Only show skeleton if we have no cached cards yet
    if (cards.length === 0) setLoading(true);
    try {
      const t = await BranchSvc.buildTreeCacheFirst(uid);
      setTree(t);
      
      let cardIds: string[] = [];
      let baseCards: any[] = [];
      const offlineCards: any[] = (((OfflineManager as any).getCollectionSync('cards') ?? []) as any[])
        .filter((c: any) => !c.deleted && !c.is_deleted);

      if (isBranchMode) {
        // AnkiPro branch mode: get cards from this branch (+ descendants if recursive)
        const { BranchSvc } = await import('../../src/services/BranchService');
        cardIds = await BranchSvc.listCardIdsInBranch(String(branchId), { recursive: isRecursive, userId: uid });
        if (cardIds.length > 0) {
          const idSet = new Set(cardIds);
          const offlineById = new Map(offlineCards.filter((c: any) => idSet.has(c.id)).map((c: any) => [c.id, c]));
          const missingIds = cardIds.filter((id) => !offlineById.has(id));

          // Render what we have in cache immediately
          baseCards = cardIds.map(id => offlineById.get(id)).filter(Boolean);
          
          const progressMap = new Map<string, any>();
          let progress = ((OfflineManager as any).getCollectionSync('user_cards', uid) ?? [])
            .filter((p: any) => p.user_id === uid && idSet.has(p.card_id));
          progress?.forEach((p: any) => progressMap.set(p.card_id, p));

          const merged: CardItem[] = baseCards.map((bc: any) => {
            const p = progressMap.get(bc.id);
            return {
              id: bc.id,
              front_text: bc.front_text || bc.question_text || '',
              back_text: bc.back_text || bc.answer_text || '',
              status: p?.status || 'active',
              learning_status: p?.learning_status || 'not_studied',
              next_review: p?.next_review,
              last_reviewed: p?.last_reviewed,
              updated_at: p?.updated_at || bc.created_at,
              interval_days: p?.interval_days,
            };
          }).filter(c => c.status !== 'deleted');
          setCards(merged);
          setLoading(false); // 🔥 Instant UI! No skeleton!

          // 🔌 BACKGROUND: Fetch missing cards from Supabase without blocking UI
          if (missingIds.length > 0 && NetworkStatus.isOnline()) {
            Promise.resolve().then(async () => {
              const fetchedCards: any[] = [];
              const CHUNK = 200;
              for (let i = 0; i < missingIds.length; i += CHUNK) {
                const slice = missingIds.slice(i, i + CHUNK);
                const { data } = await supabase.from('cards').select('*').in('id', slice).eq('is_deleted', false);
                fetchedCards.push(...(data ?? []));
              }
              if (fetchedCards.length > 0) {
                setCards(prevCards => {
                  const newMerged = [...prevCards];
                  fetchedCards.forEach((c: any) => {
                    if (!newMerged.find(pc => pc.id === c.id)) {
                      const p = progressMap.get(c.id);
                      newMerged.push({
                        id: c.id,
                        front_text: c.front_text || c.question_text || '',
                        back_text: c.back_text || c.answer_text || '',
                        status: p?.status || 'active',
                        learning_status: p?.learning_status || 'not_studied',
                        next_review: p?.next_review,
                        last_reviewed: p?.last_reviewed,
                        updated_at: p?.updated_at || c.created_at,
                        interval_days: p?.interval_days,
                      });
                    }
                  });
                  const orderMap = new Map(cardIds.map((id, idx) => [id, idx]));
                  newMerged.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));
                  return newMerged;
                });
              }
            });
          }
        }
      } else {
        // Legacy subject/section/microtopic mode
        baseCards = offlineCards
          .filter((c: any) => c.subject === subject && c.microtopic === microtopic)
          .filter((c: any) => section && section !== 'General'
            ? c.section_group === section
            : !c.section_group || c.section_group === 'General');
        cardIds = baseCards.map(c => c.id);
        
        const cardIdSet = new Set(cardIds);
        const progressMap = new Map<string, any>();
        let progress = ((OfflineManager as any).getCollectionSync('user_cards', uid) ?? [])
          .filter((p: any) => p.user_id === uid && cardIdSet.has(p.card_id));
        progress?.forEach((p: any) => progressMap.set(p.card_id, p));

        const merged: CardItem[] = baseCards.map((bc: any) => {
          const p = progressMap.get(bc.id);
          return {
            id: bc.id,
            front_text: bc.front_text || bc.question_text || '',
            back_text: bc.back_text || bc.answer_text || '',
            status: p?.status || 'active',
            learning_status: p?.learning_status || 'not_studied',
            next_review: p?.next_review,
            last_reviewed: p?.last_reviewed,
            updated_at: p?.updated_at || bc.created_at,
            interval_days: p?.interval_days,
          };
        }).filter(c => c.status !== 'deleted');
        setCards(merged);
        setLoading(false); // 🔥 Instant UI
      }

      // Background: fetch fresh progress from Supabase and update silently
      if (cardIds.length > 0 && NetworkStatus.isOnline()) {
        Promise.resolve(
          supabase
            .from('user_cards')
            .select('card_id, status, learning_status, next_review, last_reviewed, updated_at, interval_days')
            .eq('user_id', uid)
            .in('card_id', cardIds)
        ).then(({ data: freshProgress, error: progressErr }) => {
            if (!progressErr && freshProgress) {
              const freshMap = new Map<string, any>();
              freshProgress.forEach((p: any) => freshMap.set(p.card_id, p));
              setCards(prevCards => prevCards.map(c => {
                const fresh = freshMap.get(c.id);
                if (fresh) {
                  const localTime = c.updated_at ? new Date(c.updated_at).getTime() : 0;
                  const freshTime = fresh.updated_at ? new Date(fresh.updated_at).getTime() : 0;
                  if (freshTime >= localTime) {
                    return {
                      ...c,
                      status: fresh.status || 'active',
                      learning_status: fresh.learning_status || 'not_studied',
                      next_review: fresh.next_review,
                      last_reviewed: fresh.last_reviewed,
                      updated_at: fresh.updated_at || c.updated_at,
                      interval_days: fresh.interval_days,
                    };
                  }
                }
                return c;
              }));
            }
          }).catch(() => {});
      }

      // Folder-aware stats (respects daily caps)
      const s = await FlashcardSvc.getFolderStats(uid, isBranchMode
        ? { branch_id: String(branchId), recursive: isRecursive }
        : { subject: String(subject), section: String(section), microtopic: String(microtopic) }
      );
      setStats(s);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err?.message || 'Could not load cards');
    } finally {
      setLoading(false);
    }
  }, [uid, subject, section, microtopic, branchId, isBranchMode, isRecursive]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Reload cards whenever the screen comes back into focus (after adding/editing cards)
  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const filteredSortedCards = useMemo(() => {
    let list = [...cards];

    // Default (no filter selected): show everything NON-frozen
    if (filter.learning_status.length === 0 && filter.card_status.length === 0) {
      list = list.filter(c => c.status !== 'frozen');
    } else {
      if (filter.learning_status.length > 0) {
        list = list.filter(c => {
          const ls = c.learning_status;
          if (filter.learning_status.includes('not_studied') && (ls === 'not_studied')) return true;
          if (filter.learning_status.includes('learning') && (ls === 'learning' || ls === 'leech' || ls === 'review')) return true;
          if (filter.learning_status.includes('mastered') && ls === 'mastered') return true;
          return false;
        });
      }
      if (filter.card_status.length > 0) {
        list = list.filter(c => filter.card_status.includes(c.status as any));
      }
    }

    // Sort
    list.sort((a, b) => {
      if (sortBy === 'next') {
        const ad = a.next_review ? new Date(a.next_review).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.next_review ? new Date(b.next_review).getTime() : Number.POSITIVE_INFINITY;
        return ad - bd;
      }
      if (sortBy === 'newest') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      if (sortBy === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sortBy === 'az') return (a.front_text || '').localeCompare(b.front_text || '');
      if (sortBy === 'za') return (b.front_text || '').localeCompare(a.front_text || '');
      return 0;
    });

    return list;
  }, [cards, sortBy, filter]);

  const dueLabel = (c: CardItem) => {
    if (!c.learning_status || c.learning_status === 'not_studied' || c.learning_status === 'new') return 'New';
    if (!c.next_review) return 'New';

    const now = new Date();
    const reviewDate = new Date(c.next_review);
    const diffMs = reviewDate.getTime() - now.getTime();

    if (diffMs <= 0) {
      const overdueDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      if (overdueDays === 0) {
        const overdueHours = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60));
        const overdueMins = Math.floor((Math.abs(diffMs) % (1000 * 60 * 60)) / (1000 * 60));
        if (overdueHours > 0) return `Overdue ${overdueHours}h`;
        if (overdueMins > 0) return `Overdue ${overdueMins}m`;
        return 'Due now';
      }
      if (overdueDays < 30) return `Overdue ${overdueDays}d`;
      const months = Math.round(overdueDays / 30);
      if (months < 12) return `Overdue ${months}mo`;
      return `Overdue ${Math.round(overdueDays / 365)}y`;
    }

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (hours > 0) return `in ${hours}h`;
      return `in ${mins}m`;
    } else if (diffDays === 1) {
      return 'in 1 day';
    } else if (diffDays < 30) {
      return `in ${diffDays} days`;
    } else {
      const months = Math.round(diffDays / 30);
      if (months < 12) return `in ${months} months`;
      return `in ${Math.round(diffDays / 365)} years`;
    }
  };

  const openMenu = (card: CardItem) => { setMenuCard(card); setMenuVisible(true); };
  const closeMenu = () => { setMenuVisible(false); setMenuCard(null); };

  const handleMenuAction = async (action: CardMenuAction) => {
    if (!menuCard || !uid) return;
    try {
      setMenuBusy(true);
      switch (action) {
        case 'edit':
          closeMenu();
          router.push({ pathname: '/flashcards/new', params: { cardId: menuCard.id } });
          return;
        case 'freeze':
          await FlashcardSvc.toggleFreeze(uid, menuCard.id, menuCard.status);
          await loadAll();
          closeMenu(); return;
        case 'move':
          closeMenu();
          setMoveVisible(true);
          return;
        case 'reverse':
          closeMenu();
          Alert.alert('Reverse card?', 'Front and back will be swapped.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reverse', onPress: async () => { try { await FlashcardSvc.reverseCardForUser(uid, menuCard.id); await loadAll(); } catch (e: any) { Alert.alert('Failed', e?.message); } } },
          ]);
          return;
        case 'duplicate':
          await FlashcardSvc.duplicateCardForUser(uid, menuCard.id);
          await loadAll(); closeMenu(); return;
        case 'history':
          closeMenu();
          router.push({ pathname: '/flashcards/history', params: { cardId: menuCard.id, title: menuCard.front_text?.slice(0, 40) || 'Card history' } });
          return;
        case 'delete': {
          const deletedId = menuCard.id; closeMenu();
          Alert.alert('Delete card?', 'You can undo immediately.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await FlashcardSvc.softDeleteCardForUser(uid, deletedId);
                  await loadAll();
                  Alert.alert('Deleted', 'Card removed.', [
                    { text: 'Undo', onPress: async () => { try { await FlashcardSvc.restoreDeletedCardForUser(uid, deletedId); await loadAll(); } catch (e: any) { Alert.alert('Undo failed', e?.message); } } },
                    { text: 'OK' },
                  ]);
                } catch (e: any) { Alert.alert('Action failed', e?.message); }
              },
            },
          ]); return;
        }
      }
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Please try again');
    } finally { setMenuBusy(false); }
  };

  const startStudy = () => {
    const params: any = isBranchMode
      ? { branchId: String(branchId), recursive: isRecursive ? '1' : '0', branchName: String(branchName || ''), mode: 'study' }
      : { subject, section, microtopic, mode: 'study' };
    router.push({ pathname: '/flashcards/review', params });
  };

  const renderCardItem = ({ item }: { item: CardItem }) => {
    const isFrozen = item.status === 'frozen';
    const statusColor =
      item.learning_status === 'mastered' ? '#3b82f6' :
      item.learning_status === 'learning' || item.learning_status === 'review' ? '#22c55e' :
      item.learning_status === 'leech' ? '#ef4444' : colors.textTertiary;

    const label = dueLabel(item);
    const isFuture = label.startsWith('in ') && (label.includes('day') || label.includes('month') || label.includes('year'));
    
    let IconComp = Clock;
    if (label === 'New') {
      IconComp = Sparkles;
    } else if (label.startsWith('in ')) {
      IconComp = GraduationCap;
    } else {
      IconComp = Clock;
    }

    return (
      <TouchableOpacity
        style={[styles.cardItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => router.push({ 
          pathname: '/flashcards/browse', 
          params: { branchId, subject, section, microtopic, recursive, cardId: item.id } 
        })}
        testID={`card-row-${item.id}`}
      >
        <View style={styles.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconComp size={16} color={statusColor} />
            <Text style={[styles.cardDueLabel, { color: statusColor, textTransform: 'capitalize' }]}>{label}</Text>
            {isFrozen && <Text style={[styles.tag, { color: '#ef4444', borderColor: '#ef4444' }]}>FROZEN</Text>}
          </View>
          <TouchableOpacity onPress={() => openMenu(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} testID={`card-menu-${item.id}`}>
            <MoreHorizontal size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.cardFront, { color: colors.textPrimary }]} numberOfLines={2}>{item.front_text || '(empty)'}</Text>
      </TouchableOpacity>
    );
  };

  const anyFilterOn = filter.learning_status.length + filter.card_status.length > 0;

  return (
    <PageWrapper>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="btn-back"><ArrowLeft size={24} color={colors.textPrimary} /></TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {isBranchMode ? (branchName || 'Deck') : microtopic}
            </Text>
            <Text style={[styles.headerSub, { color: colors.textTertiary }]}>
              {isBranchMode ? (isRecursive ? 'Includes all sub-decks' : 'Direct cards only') : `${subject} • ${section}`}
            </Text>
          </View>
          
          <TouchableOpacity 
            onPress={() => setAlgoModal(true)} 
            style={styles.iconBtn} 
            testID="open-algo"
          >
            <Settings size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredSortedCards}
          keyExtractor={(i) => i.id}
          renderItem={renderCardItem}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          ListHeaderComponent={
            <View>
              {/* Hero */}
              <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="hero">
                <Text style={[styles.heroNum, { color: colors.textPrimary }]}>{stats.for_today}</Text>
                <Text style={[styles.heroSub, { color: colors.textTertiary }]}>cards for today</Text>

                <View style={styles.heroGrid}>
                  <MiniStat num={stats.not_studied} label="Not studied" color={colors.textTertiary} />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MiniStat num={stats.learning} label="Learning" color="#22c55e" />
                  <View style={[styles.divider, { backgroundColor: colors.border }]} />
                  <MiniStat num={stats.mastered} label="Mastered" color="#3b82f6" />
                </View>

                <TouchableOpacity
                  style={[styles.studyBtn, { backgroundColor: stats.for_today > 0 ? colors.primary : colors.surfaceStrong }]}
                  onPress={startStudy}
                  disabled={stats.for_today === 0}
                  testID="btn-study"
                >
                  <Play size={18} color={stats.for_today > 0 ? '#04223a' : colors.textTertiary} fill={stats.for_today > 0 ? '#04223a' : 'transparent'} />
                  <Text style={[styles.studyBtnText, { color: stats.for_today > 0 ? '#04223a' : colors.textTertiary }]}>
                    {stats.for_today > 0 ? 'Study cards' : 'All caught up'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Cards-in-deck header */}
              <View style={styles.sectionHead}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Cards in deck ({stats.total})</Text>
              </View>

              {/* Progress bar */}
              <View style={[styles.progressOuter, { backgroundColor: colors.border }]}>
                {stats.total > 0 && (
                  <>
                    <View style={[styles.progressSeg, { flex: stats.learning, backgroundColor: '#22c55e' }]} />
                    <View style={[styles.progressSeg, { flex: stats.mastered, backgroundColor: '#3b82f6' }]} />
                    <View style={[styles.progressSeg, { flex: stats.not_studied, backgroundColor: '#64748b' }]} />
                  </>
                )}
              </View>
              <View style={styles.legendRow}>
                <Legend color="#64748b" num={stats.not_studied} label="Not studied" />
                <Legend color="#22c55e" num={stats.learning} label="Learning" />
                <Legend color="#3b82f6" num={stats.mastered} label="Mastered" />
              </View>

              {/* Sort + Filter toolbar */}
              <View style={styles.toolbar}>
                <TouchableOpacity onPress={() => setSortSheet(true)} style={[styles.toolBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="btn-sort">
                  <ArrowUpDown size={16} color={colors.textPrimary} />
                  <Text style={[styles.toolText, { color: colors.textPrimary }]}>{SORT_LABELS[sortBy]}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setFilterSheet(true)}
                  style={[styles.toolBtn, { backgroundColor: anyFilterOn ? colors.primary + '20' : colors.surface, borderColor: anyFilterOn ? colors.primary : colors.border }]}
                  testID="btn-filter"
                >
                  <Text style={[styles.toolText, { color: anyFilterOn ? colors.primary : colors.textPrimary }]}>Filters</Text>
                  <SlidersHorizontal size={16} color={anyFilterOn ? colors.primary : colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          }
          ListEmptyComponent={
            showSkeleton ? (
              <View style={{ gap: 10 }}>
                {[1, 2, 3].map((key) => (
                  <SkeletonCard key={key} style={{ backgroundColor: colors.surface, borderColor: colors.border, padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 }} />
                ))}
              </View>
            ) : !loading && cards.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 60 }}>
                <BookOpen size={48} color={colors.border} />
                <Text style={{ color: colors.textTertiary, marginTop: 12 }}>No cards match your filter</Text>
              </View>
            ) : null
          }
          ListFooterComponent={<View style={{ height: 100 }} />}
        />

        {/* Floating "Add cards" pill */}
        <TouchableOpacity
          style={[styles.floatingAddBtn, { backgroundColor: '#1f1f1f' }]}
          onPress={() => {
            router.push({
              pathname: '/flashcards/new',
              params: {
                branchId: branchId ? String(branchId) : undefined,
                branchName: branchName ? String(branchName) : undefined,
                subject: String(subject || ''),
                section: String(section || ''),
                microtopic: String(microtopic || '')
              }
            } as any);
          }}
          testID="floating-btn-add-cards"
        >
          <Text style={styles.floatingAddText}>Add cards</Text>
        </TouchableOpacity>

        {/* Sheets */}
        <SortSheet visible={sortSheet} value={sortBy} onClose={() => setSortSheet(false)} onSelect={setSortBy} />
        <FilterSheet visible={filterSheet} value={filter} onClose={() => setFilterSheet(false)} onApply={setFilter} />
        <FolderAlgorithmModal
          visible={algoModal}
          userId={uid}
          subject={String(subject || '')}
          section={String(section || '')}
          microtopic={String(microtopic || '')}
          branchId={branchId ? String(branchId) : null}
          branchName={branchName ? String(branchName) : null}
          onClose={() => setAlgoModal(false)}
          onSaved={loadAll}
        />

        {/* Row overflow menu + modals (edit / move) */}
        <CardOverflowMenu visible={menuVisible} frozen={menuCard?.status === 'frozen'} busy={menuBusy} onClose={closeMenu} onAction={handleMenuAction} />

        <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={[styles.premiumEditSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.modalHeader}>
                <View style={{ width: 40 }} />
                <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Edit Card</Text>
                <TouchableOpacity onPress={() => setEditVisible(false)} style={[styles.closeCircle, { backgroundColor: colors.border + '40' }]}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={[styles.inputLabel, { color: colors.textTertiary }]}>FRONT SIDE</Text>
                <TextInput 
                  value={editFront} 
                  onChangeText={setEditFront} 
                  multiline 
                  style={[styles.premiumInput, { color: colors.textPrimary, borderColor: colors.border + '80', backgroundColor: colors.surfaceStrong }]} 
                />
                
                <Text style={[styles.inputLabel, { color: colors.textTertiary, marginTop: 20 }]}>BACK SIDE</Text>
                <TextInput 
                  value={editBack} 
                  onChangeText={setEditBack} 
                  multiline 
                  style={[styles.premiumInput, { color: colors.textPrimary, borderColor: colors.border + '80', backgroundColor: colors.surfaceStrong }]} 
                />
              </ScrollView>

              <View style={{ paddingTop: 20 }}>
                <TouchableOpacity
                  style={[styles.premiumSaveBtn, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    if (!menuCard || !uid) return;
                    if (!editFront.trim() || !editBack.trim()) return Alert.alert('Validation', 'Front and back are required');
                    try { 
                      await FlashcardSvc.updateCardForUser(uid, menuCard.id, { front_text: editFront.trim(), back_text: editBack.trim() }); 
                      setEditVisible(false); 
                      await loadAll(); 
                    } catch (e: any) { 
                      Alert.alert('Save failed', e?.message || 'Please try again'); 
                    }
                  }}
                >
                  <Text style={{ color: '#04223a', fontSize: 16, fontWeight: '900' }}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <PremiumMoveModal
          visible={moveVisible}
          onClose={() => setMoveVisible(false)}
          tree={tree}
          node={menuCard ? { id: menuCard.id, name: menuCard.front_text } as any : null}
          onConfirm={async (targetBranchId) => {
            if (!menuCard || !uid) return;
            try {
              setLoading(true);
              await BranchSvc.moveCardToBranch(uid, menuCard.id, targetBranchId);
              setMoveVisible(false);
              await loadAll();
              Alert.alert('Success', 'Card moved successfully');
            } catch (e: any) {
              Alert.alert('Move failed', e?.message || 'Please try again');
            } finally {
              setLoading(false);
            }
          }}
          title="Select location"
        />
      </View>
    </PageWrapper>
  );
}

function MiniStat({ num, label, color }: { num: number; label: string; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ color, fontSize: 22, fontWeight: '900' }}>{num}</Text>
      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginTop: 2 }}>{label}</Text>
    </View>
  );
}
function Legend({ color, num, label }: any) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '700' }}>{num} {label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, marginLeft: 6 },
  headerTitle: { fontSize: 18, fontWeight: '900' },
  headerSub: { fontSize: 12, marginTop: 2 },
  algoRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 14, paddingBottom: 8 },
  hero: { borderWidth: 1, borderRadius: 20, padding: 20, alignItems: 'center' },
  heroNum: { fontSize: 56, fontWeight: '900', lineHeight: 60 },
  heroSub: { fontSize: 14, marginTop: -2, marginBottom: 18 },
  heroGrid: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginBottom: 18 },
  divider: { width: 1, height: 32 },
  studyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', height: 54, borderRadius: 14, gap: 8 },
  studyBtnText: { fontSize: 17, fontWeight: '900' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 26, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '900' },
  progressOuter: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  progressSeg: { height: 8 },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 10 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  toolText: { fontSize: 13, fontWeight: '800' },
  cardItem: { padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardDueLabel: { fontSize: 12, fontWeight: '800' },
  cardFront: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  tag: { fontSize: 9, fontWeight: '900', borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  addCardsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderWidth: 1, borderStyle: 'dashed', borderRadius: 999, marginTop: 14, marginBottom: 20 },
  addCardsText: { fontWeight: '800' },
  floatingAddBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
    zIndex: 1000,
  },
  floatingAddText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900' },
  noteInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  
  // Premium Edit Styles
  premiumEditSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20, paddingBottom: 40, maxHeight: '90%' },
  closeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  premiumInput: { minHeight: 120, borderRadius: 18, borderWidth: 1, padding: 16, textAlignVertical: 'top', fontSize: 16, fontWeight: '500' },
  premiumSaveBtn: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
