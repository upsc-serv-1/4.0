/**
 * Pilot V2 — Dashboard
 *
 * Faithful port of the KM `Dashboard` component:
 *   • Top bar: breadcrumb + search + "+ New" button
 *   • Greeting block (Good Morning / Afternoon / Evening + sub-line)
 *   • "Continue Studying" horizontal carousel (3 sample cards)
 *   • "Pinned Notes" 2-col grid (4 sample cards)
 *
 * The cards are seeded from existing notes in the PilotV2Context, with a
 * graceful demo fallback so the screen still looks complete on first run.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Animated,
} from 'react-native';
import {
  Search, Plus, ChevronRight, FileText, Star, Scale, TrendingUp,
  Landmark, ScrollText, Globe2, Leaf, FlaskConical, Book, RotateCcw, Trash2,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  findOrCreatePilotV2Note, fetchPilotV2NotesForUser, fetchAllPilotV2Nodes, restorePilotV2Node, purgePilotV2NoteNode,
} from '../../repositories/pilotV2Repo';
import { PilotV2Note, PILOT_V2_SUBJECT_PALETTE } from './types';
import { Swipeable } from 'react-native-gesture-handler';

const SUBJECT_ICONS: Record<string, any> = {
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book,
};

const resolveSubjectMeta = (subjectName?: string, notes: PilotV2Note[] = []) => {
  if (!subjectName) return { id: 'polity', label: 'Polity', icon: 'Landmark', bg: '#E9D5FF', text: '#7C3AED' };
  const found = PILOT_V2_SUBJECT_PALETTE.find(
    s => s.label.toLowerCase() === subjectName.toLowerCase()
  );
  if (found) return found;

  const exists = notes.some(n => n.subject && n.subject.toLowerCase() === subjectName.toLowerCase());
  if (exists) {
    return {
      id: subjectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      label: subjectName,
      icon: 'Book',
      bg: '#E9D5FF',
      text: '#7C3AED',
    };
  }

  return { id: 'polity', label: 'Polity', icon: 'Landmark', bg: '#E9D5FF', text: '#7C3AED' };
};

const greetingFor = (d: Date) => {
  const h = d.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const formatRelative = (iso?: string) => {
  if (!iso) return 'Just now';
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min${m > 1 ? 's' : ''} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString();
};

export function PilotV2Dashboard() {
  const { colors } = useTheme();
  const { state, dispatch } = usePilotV2();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [creating, setCreating] = useState(false);
  const search = state.view.search;
  const quickFilter = state.view.quickFilter;

  const selectedSubjectId = state.view.selectedSubject;
  const activeSubject = useMemo(
    () => PILOT_V2_SUBJECT_PALETTE.find(s => s.id === selectedSubjectId),
    [selectedSubjectId]
  );
  const isSubjectMode = state.view.mode === 'subject' && !state.view.selectedSubtopic;

  const filterPredicate = (n: PilotV2Note): boolean => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (isSubjectMode && activeSubject) {
      if (!n.subject || n.subject.toLowerCase() !== activeSubject.label.toLowerCase()) return false;
    }
    if (quickFilter === 'pinned')  return Boolean(n.is_pinned);
    if (quickFilter === 'shared')  return Boolean((n as any).shared);
    if (quickFilter === 'trash')   return Boolean((n as any).is_archived);
    return true;
  };

  const visibleNotes = useMemo(
    () => state.notes.filter(filterPredicate),
    [state.notes, search, quickFilter, isSubjectMode, activeSubject]
  );

  const recents = useMemo(() => {
    const sorted = [...visibleNotes].sort((a, b) =>
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    // Recent tab shows the full recent list; Home/other tabs show a compact carousel.
    return quickFilter === 'recent' ? sorted : sorted.slice(0, 6);
  }, [visibleNotes, quickFilter]);

  // Pinned tab → full grid (no slice). Home/other → compact preview (top 6).
  const pinned = useMemo(
    () => {
      const all = visibleNotes.filter(n => n.is_pinned);
      return quickFilter === 'pinned' ? all : all.slice(0, 6);
    },
    [visibleNotes, quickFilter]
  );

  // Section visibility per sidebar filter
  const showContinueStudying = quickFilter === 'home';
  const showPinnedSection = quickFilter === 'home' || quickFilter === 'pinned';
  const showRecentSection = quickFilter === 'recent';

  const openGlance = (noteId: string) => {
    dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: noteId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
  };

  const handleRestore = async (noteItem: PilotV2Note) => {
    if (!userId || !noteItem?.id) return;
    try {
      const nodes = await fetchAllPilotV2Nodes(userId, true);
      const node = nodes.find(nd => nd.note_id === noteItem.id);
      if (!node) return;
      await restorePilotV2Node(node.id);
      const fresh = await fetchPilotV2NotesForUser(userId);
      dispatch({ type: 'SET_NOTES', payload: fresh });
      Alert.alert('Restored', `“${noteItem.title}” has been restored.`);
    } catch (e) {
      Alert.alert('Error', (e as Error).message);
    }
  };

  const handlePurge = (noteItem: PilotV2Note) => {
    Alert.alert(
      'Delete permanently?',
      `Are you sure you want to permanently delete “${noteItem.title}”? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            if (!userId || !noteItem?.id) return;
            try {
              const nodes = await fetchAllPilotV2Nodes(userId, true);
              const node = nodes.find(nd => nd.note_id === noteItem.id);
              if (!node) return;
              await purgePilotV2NoteNode({ nodeId: node.id, noteId: node.note_id });
              const fresh = await fetchPilotV2NotesForUser(userId);
              dispatch({ type: 'SET_NOTES', payload: fresh });
            } catch (e) {
              Alert.alert('Error', (e as Error).message);
            }
          }
        }
      ]
    );
  };

  const handleNew = async () => {
    if (creating) return;
    const title = `Untitled note · ${new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    // Optimistic: create local draft and open editor instantly. Background sync to Supabase if signed-in.
    const transientId = `transient_${Date.now()}`;
    const transient: PilotV2Note = {
      id: transientId,
      title,
      content: { blocks: [], version: 1 },
      is_pinned: false,
    };
    dispatch({ type: 'UPSERT_NOTE', payload: transient });
    dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: transient.id });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' });

    if (!userId) return;
    setCreating(true);
    (async () => {
      try {
        const result = await findOrCreatePilotV2Note({ userId, subject: 'General', title });
        const fresh = await fetchPilotV2NotesForUser(userId);
        dispatch({ type: 'SET_NOTES', payload: fresh });
        dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: result.noteId });
      } catch (e) {
        console.warn('[pilot-v2] background create failed', (e as Error).message);
      } finally {
        setCreating(false);
      }
    })();
  };

  const seeAllRecent = () => {
    dispatch({ type: 'SET_QUICK_FILTER', payload: 'recent' });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' });
  };
  const seeAllPinned = () => {
    dispatch({ type: 'SET_QUICK_FILTER', payload: 'pinned' });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' });
  };

  const filterBadge =
    quickFilter === 'home'   ? null :
    quickFilter === 'pinned' ? 'Showing pinned only' :
    quickFilter === 'recent' ? 'Showing recently edited' :
    quickFilter === 'shared' ? 'Showing shared notes' :
    'Showing trash';

  return (
    <View testID="pilot-v2-dashboard" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Top bar */}
      <View style={[styles.topBar, { backgroundColor: '#fff', borderBottomColor: colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
        <View style={styles.breadcrumb}>
          {isSubjectMode && activeSubject && (
            <>
              <Text style={[styles.breadCrumb, { color: colors.textSecondary }]}>Subjects</Text>
              <ChevronRight size={14} color={colors.textTertiary} />
              <Text style={[styles.breadCrumb, { color: colors.textPrimary, fontWeight: '600' }]}>{activeSubject.label}</Text>
            </>
          )}
        </View>

        <TouchableOpacity
          testID="pilot-v2-dashboard-new"
          activeOpacity={0.85}
          onPress={handleNew}
          disabled={creating}
          style={[styles.newBtn, { backgroundColor: '#5B4EFA', opacity: creating ? 0.7 : 1 }]}
        >
          <Plus size={16} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>New</Text>
        </TouchableOpacity>

        {filterBadge ? (
          <View style={styles.filterBadge}>
            <Text style={{ fontSize: 11, color: '#5B4EFA', fontWeight: '600' }}>{filterBadge}</Text>
            {quickFilter !== 'trash' && (
              <TouchableOpacity
                testID="pilot-v2-clear-filter"
                onPress={() => dispatch({ type: 'SET_QUICK_FILTER', payload: 'home' })}
                hitSlop={6}
              >
                <Text style={{ fontSize: 11, color: '#5B4EFA', fontWeight: '700' }}>Clear ✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {quickFilter === 'trash' ? (
          <View>
            <View style={{ marginBottom: 24 }}>
              <Text style={[styles.h1, { color: colors.textPrimary }]}>Trash</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {visibleNotes.length} {visibleNotes.length === 1 ? 'item' : 'items'} in Trash. Swipe left on any item to restore or delete permanently.
              </Text>
            </View>

            {visibleNotes.length === 0 ? (
              <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 64 }}>
                <Trash2 size={48} color={colors.textTertiary} style={{ marginBottom: 16 }} />
                <Text style={{ color: colors.textSecondary, fontSize: 16, fontWeight: '600' }}>Trash is empty</Text>
                <Text style={{ color: colors.textTertiary, fontSize: 13, marginTop: 4 }}>Deleted notes will appear here.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {visibleNotes.map((item: any) => (
                  <Swipeable
                    key={item.id}
                    renderRightActions={(progress, dragX) => {
                      const trans = dragX.interpolate({
                        inputRange: [-160, 0],
                        outputRange: [0, 160],
                        extrapolate: 'clamp',
                      });
                      return (
                        <Animated.View style={{ transform: [{ translateX: trans }], flexDirection: 'row', width: 160 }}>
                          <TouchableOpacity
                            onPress={() => handleRestore(item)}
                            style={{
                              backgroundColor: '#10B981',
                              justifyContent: 'center',
                              alignItems: 'center',
                              width: 80,
                              height: '100%',
                              borderTopLeftRadius: 12,
                              borderBottomLeftRadius: 12,
                            }}
                          >
                            <RotateCcw size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 4 }}>Restore</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handlePurge(item)}
                            style={{
                              backgroundColor: '#ef4444',
                              justifyContent: 'center',
                              alignItems: 'center',
                              width: 80,
                              height: '100%',
                              borderTopRightRadius: 12,
                              borderBottomRightRadius: 12,
                            }}
                          >
                            <Trash2 size={18} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 4 }}>Purge</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      );
                    }}
                    friction={1.5}
                    rightThreshold={40}
                  >
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => openGlance(item.id)}
                      style={[styles.trashRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.trashTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 4 }}>
                          {item.subject || 'General'} • {formatRelative(item.updated_at)}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={colors.textTertiary} />
                    </TouchableOpacity>
                  </Swipeable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <>
            {/* Greeting */}
            <View style={{ marginBottom: 32 }}>
              <Text style={[styles.h1, { color: colors.textPrimary }]}>
                {isSubjectMode && activeSubject
                  ? `${activeSubject.label} Study Hub`
                  : `${greetingFor(new Date())}, Aspirant 👋`}
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {isSubjectMode && activeSubject
                  ? `Ready to continue your ${activeSubject.label} preparation?`
                  : 'Ready to continue your preparation?'}
              </Text>
            </View>

            {/* Continue Studying */}
            {showContinueStudying && (
            <View style={{ marginBottom: 40 }}>
              <View style={styles.sectionHead}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>Continue Studying</Text>
                <TouchableOpacity testID="pilot-v2-dashboard-seeall-recent" onPress={seeAllRecent}>
                  <Text style={{ color: '#5B4EFA', fontSize: 13, fontWeight: '600' }}>See All</Text>
                </TouchableOpacity>
              </View>

              {recents.length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: 13, paddingVertical: 8 }}>No study sessions yet. Create a note to begin!</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {recents.map((c: any) => {
                    const meta = resolveSubjectMeta(c.subject, state.notes);
                    const IconComponent = SUBJECT_ICONS[meta.icon] ?? Scale;

                    return (
                      <TouchableOpacity
                        key={c.id}
                        testID={`pilot-v2-dashboard-card-${c.id}`}
                        activeOpacity={0.9}
                        onPress={() => openGlance(c.id)}
                        style={[styles.studyCard, { borderColor: colors.border }]}
                      >
                        <View style={[styles.studyIcon, { backgroundColor: c.iconBg ?? meta.bg }]}>
                          <IconComponent size={16} color={c.iconColor ?? meta.text} />
                        </View>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="tail">
                          {c.title}
                        </Text>
                        <View style={styles.cardFoot}>
                          <Text style={{ color: colors.textTertiary, fontSize: 11 }} numberOfLines={1}>{c.subject || 'General'}</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 11 }} numberOfLines={1}>
                            {formatRelative(c.updated_at)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
            )}

            {/* Recent Notes (only on Recent tab) */}
            {showRecentSection && (
              <View style={{ marginBottom: 40 }}>
                <View style={styles.sectionHead}>
                  <Text style={[styles.h2, { color: colors.textPrimary }]}>Recent Notes</Text>
                </View>
                {recents.length === 0 ? (
                  <Text style={{ color: colors.textTertiary, fontSize: 13, paddingVertical: 8 }}>No recent notes yet.</Text>
                ) : (
                  <View style={styles.pinnedGrid}>
                    {recents.map((p: any) => {
                      const meta = resolveSubjectMeta(p.subject, state.notes);
                      const IconComponent = SUBJECT_ICONS[meta.icon] ?? Scale;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          testID={`pilot-v2-dashboard-recent-${p.id}`}
                          activeOpacity={0.9}
                          onPress={() => openGlance(p.id)}
                          style={[styles.pinnedCard, { borderColor: colors.border }]}
                        >
                          <View style={styles.pinnedTop}>
                            <View style={[styles.pinnedIcon, { backgroundColor: meta.bg }]}>
                              <IconComponent size={14} color={meta.text} />
                            </View>
                          </View>
                          <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1} ellipsizeMode="tail">
                            {p.title}
                          </Text>
                          <View style={styles.cardFoot}>
                            <Text style={{ color: colors.textTertiary, fontSize: 11 }} numberOfLines={1}>{p.subject || 'General'}</Text>
                            <Text style={{ color: colors.textTertiary, fontSize: 11 }} numberOfLines={1}>{formatRelative(p.updated_at)}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* Pinned Notes */}
            {showPinnedSection && (
            <View>
              <View style={styles.sectionHead}>
                <Text style={[styles.h2, { color: colors.textPrimary }]}>Pinned Notes</Text>
                {quickFilter === 'home' && (
                  <TouchableOpacity testID="pilot-v2-dashboard-seeall-pinned" onPress={seeAllPinned}>
                    <Text style={{ color: '#5B4EFA', fontSize: 13, fontWeight: '600' }}>See All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {pinned.length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: 13, paddingVertical: 8 }}>No pinned notes yet.</Text>
              ) : (
                <View style={styles.pinnedGrid}>
                  {pinned.map((p: any) => {
                    const meta = resolveSubjectMeta(p.subject, state.notes);
                    const IconComponent = SUBJECT_ICONS[meta.icon] ?? Scale;

                    return (
                      <TouchableOpacity
                        key={p.id}
                        testID={`pilot-v2-dashboard-pinned-${p.id}`}
                        activeOpacity={0.9}
                        onPress={() => openGlance(p.id)}
                        style={[styles.pinnedCard, { borderColor: colors.border }]}
                      >
                        <View style={styles.pinnedTop}>
                          <View style={[styles.pinnedIcon, { backgroundColor: meta.bg }]}>
                            <IconComponent size={14} color={meta.text} />
                          </View>
                          <Star size={14} color="#FACC15" fill="#FACC15" />
                        </View>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {p.title}
                        </Text>
                        <View style={styles.cardFoot}>
                          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{p.subject || 'General'}</Text>
                          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                            {formatRelative(p.updated_at)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/* Demo data only used until the user has real notes. */
const DEMO_CARDS: any[] = [];
const DEMO_PINNED: any[] = [];

const styles = StyleSheet.create({
  topBar: { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' },
  breadCrumb: { fontSize: 13 },
  searchRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
    minHeight: 48,
  },
  body: { paddingHorizontal: 36, paddingVertical: 28, paddingBottom: 96 },
  h1: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: '700' },
  studyCard: {
    width: 180, padding: 14, borderRadius: 16, borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#5B4EFA', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  studyIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  pinnedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pinnedCard: {
    width: '31.5%',
    minWidth: 190,
    padding: 16, borderRadius: 16, borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#3B82F6', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  pinnedTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  pinnedIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterBadge: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#EEECFF', borderRadius: 8,
  },
  trashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  trashTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
});
