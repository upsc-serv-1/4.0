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
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert,
} from 'react-native';
import {
  Search, Plus, ChevronRight, FileText, Star, Scale, TrendingUp,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import { findOrCreatePilotV2Note, fetchPilotV2NotesForUser } from '../../repositories/pilotV2Repo';
import { PilotV2Note, PILOT_V2_SUBJECT_PALETTE } from './types';

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
  const [search, setSearch] = useState('');
  const quickFilter = state.view.quickFilter;

  const filterPredicate = (n: PilotV2Note): boolean => {
    if (search && !n.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (quickFilter === 'pinned')  return Boolean(n.is_pinned);
    if (quickFilter === 'shared')  return Boolean((n as any).shared);
    if (quickFilter === 'trash')   return Boolean((n as any).is_archived);
    return true;
  };

  const visibleNotes = useMemo(
    () => state.notes.filter(filterPredicate),
    [state.notes, search, quickFilter]
  );

  const recents = useMemo(() => {
    const sorted = [...visibleNotes].sort((a, b) =>
      new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
    );
    return sorted.slice(0, 6);
  }, [visibleNotes]);

  const pinned = useMemo(
    () => visibleNotes.filter(n => n.is_pinned).slice(0, 4),
    [visibleNotes]
  );

  const openGlance = (noteId: string) => {
    dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: noteId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
  };

  const handleNew = async () => {
    if (creating) return;
    const title = `Untitled note · ${new Date().toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    if (!userId) {
      const transient: PilotV2Note = {
        id: `transient_${Date.now()}`,
        title,
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
      const result = await findOrCreatePilotV2Note({ userId, subject: 'General', title });
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
      <View style={[styles.topBar, { backgroundColor: '#fff', borderBottomColor: colors.border }]}>
        <View style={styles.breadcrumb}>
          <Text style={[styles.breadCrumb, { color: colors.textSecondary }]}>Polity</Text>
          <ChevronRight size={14} color={colors.textTertiary} />
          <Text style={[styles.breadCrumb, { color: colors.textSecondary }]}>Fundamental Rights</Text>
          <ChevronRight size={14} color={colors.textTertiary} />
          <Text style={[styles.breadCrumb, { color: colors.textPrimary, fontWeight: '600' }]}>
            Right to Equality
          </Text>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: '#F3F3F5', borderColor: colors.border }]}>
            <Search size={16} color={colors.textTertiary} />
            <TextInput
              testID="pilot-v2-dashboard-search"
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Search notes, topics, keywords..."
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <TouchableOpacity
            testID="pilot-v2-dashboard-new"
            activeOpacity={0.85}
            onPress={handleNew}
            disabled={creating}
            style={[styles.newBtn, { backgroundColor: '#5B4EFA', opacity: creating ? 0.7 : 1 }]}
          >
            <Plus size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{creating ? 'Creating…' : 'New'}</Text>
          </TouchableOpacity>
        </View>

        {filterBadge ? (
          <View style={styles.filterBadge}>
            <Text style={{ fontSize: 11, color: '#5B4EFA', fontWeight: '600' }}>{filterBadge}</Text>
            <TouchableOpacity
              testID="pilot-v2-clear-filter"
              onPress={() => dispatch({ type: 'SET_QUICK_FILTER', payload: 'home' })}
              hitSlop={6}
            >
              <Text style={{ fontSize: 11, color: '#5B4EFA', fontWeight: '700' }}>Clear ✕</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {/* Greeting */}
        <View style={{ marginBottom: 32 }}>
          <Text style={[styles.h1, { color: colors.textPrimary }]}>
            {greetingFor(new Date())}, Aspirant 👋
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Ready to continue your preparation?
          </Text>
        </View>

        {/* Continue Studying */}
        <View style={{ marginBottom: 40 }}>
          <View style={styles.sectionHead}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>Continue Studying</Text>
            <TouchableOpacity testID="pilot-v2-dashboard-seeall-recent" onPress={seeAllRecent}>
              <Text style={{ color: '#5B4EFA', fontSize: 13, fontWeight: '600' }}>See All</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
            {(recents.length ? recents : DEMO_CARDS).map((c: any) => (
              <TouchableOpacity
                key={c.id}
                testID={`pilot-v2-dashboard-card-${c.id}`}
                activeOpacity={0.9}
                onPress={() => recents.length ? openGlance(c.id) : null}
                style={[styles.studyCard, { backgroundColor: '#fff', borderColor: colors.border }]}
              >
                <View style={[styles.studyIcon, { backgroundColor: c.iconBg ?? '#DBEAFE' }]}>
                  {c.iconName === 'TrendingUp'
                    ? <TrendingUp size={20} color={c.iconColor ?? '#2563EB'} />
                    : <Scale size={20} color={c.iconColor ?? '#2563EB'} />}
                </View>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {c.title}
                </Text>
                <View style={styles.cardFoot}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{c.subject || 'Polity'}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {recents.length ? formatRelative(c.updated_at) : c.timestamp}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Pinned Notes */}
        <View>
          <View style={styles.sectionHead}>
            <Text style={[styles.h2, { color: colors.textPrimary }]}>Pinned Notes</Text>
            <TouchableOpacity testID="pilot-v2-dashboard-seeall-pinned" onPress={seeAllPinned}>
              <Text style={{ color: '#5B4EFA', fontSize: 13, fontWeight: '600' }}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.pinnedGrid}>
            {(pinned.length ? pinned : DEMO_PINNED).map((p: any) => (
              <TouchableOpacity
                key={p.id}
                testID={`pilot-v2-dashboard-pinned-${p.id}`}
                activeOpacity={0.9}
                onPress={() => pinned.length ? openGlance(p.id) : null}
                style={[styles.pinnedCard, { backgroundColor: '#fff', borderColor: colors.border }]}
              >
                <View style={styles.pinnedTop}>
                  <View style={[styles.pinnedIcon, { backgroundColor: '#DBEAFE' }]}>
                    <FileText size={14} color="#2563EB" />
                  </View>
                  <Star size={14} color="#FACC15" fill="#FACC15" />
                </View>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {p.title}
                </Text>
                <View style={styles.cardFoot}>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{p.subject || '—'}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
                    {pinned.length ? formatRelative(p.updated_at) : p.timestamp}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/* Demo data only used until the user has real notes. */
const DEMO_CARDS = [
  { id: 'd1', title: 'Article 21', subject: 'Polity',  timestamp: '2 mins ago', iconName: 'Scale',     iconBg: '#DBEAFE', iconColor: '#2563EB' },
  { id: 'd2', title: 'Indian Economy Overview', subject: 'Economy', timestamp: 'Yesterday', iconName: 'TrendingUp', iconBg: '#D1FAE5', iconColor: '#059669' },
  { id: 'd3', title: 'Fundamental Rights', subject: 'Polity', timestamp: '2 days ago', iconName: 'Scale', iconBg: '#FEE2E2', iconColor: '#DC2626' },
];

const DEMO_PINNED = [
  { id: 'p1', title: 'Budget 2025-26', subject: 'Economy', timestamp: '6 pages' },
  { id: 'p2', title: 'Ethics Case Studies', subject: 'Ethics', timestamp: '12 pages' },
  { id: 'p3', title: 'Climate Change', subject: 'Environment', timestamp: '8 pages' },
  { id: 'p4', title: 'Directive Principles', subject: 'Polity', timestamp: '10 pages' },
];

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
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
  },
  body: { paddingHorizontal: 32, paddingVertical: 24, paddingBottom: 96 },
  h1: { fontSize: 26, fontWeight: '700', marginBottom: 4 },
  sub: { fontSize: 14 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  h2: { fontSize: 18, fontWeight: '700' },
  studyCard: {
    minWidth: 280, padding: 20, borderRadius: 12, borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 1 },
  },
  studyIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  pinnedGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  pinnedCard: {
    flexBasis: '48%', flexGrow: 1,
    padding: 16, borderRadius: 12, borderWidth: 1,
  },
  pinnedTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  pinnedIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  filterBadge: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#EEECFF', borderRadius: 8,
  },
});
