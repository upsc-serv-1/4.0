/**
 * Pilot V2 — Note List
 *
 * Faithful port of the KM `NoteList` component:
 *   • Sticky header with back button + topic title + search + "+ New Note"
 *   • Per-note row: blue file icon, title, timestamp, optional star,
 *     three-dot affordance.
 *
 * Rows that match the active subtopic are surfaced first; remaining notes
 * shown below for context. If the user has no notes yet, demo placeholder
 * rows from the Figma comp are shown.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { ChevronLeft, Search, Plus, FileText, Star, MoreVertical } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilotV2 } from '../../context/PilotV2Context';

const formatTime = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (sameDay) return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  if (isYesterday) return 'Yesterday';
  const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diff < 7) return `${diff} days ago`;
  return d.toLocaleDateString();
};

const DEMO = [
  { id: 'n1', title: 'General Overview — Right to Equality', updated_at: undefined, timestamp: 'Today, 9:47 AM', is_pinned: true },
  { id: 'n2', title: 'Article 14 — Equality Before Law',     updated_at: undefined, timestamp: 'Today, 9:41 AM' },
  { id: 'n3', title: 'Article 15 — Prohibition of Discrimination', updated_at: undefined, timestamp: 'Yesterday' },
  { id: 'n4', title: 'Article 16 — Equality of Opportunity', updated_at: undefined, timestamp: '2 days ago' },
  { id: 'n5', title: 'Important Provisions — Women, Children, SCs, STs', updated_at: undefined, timestamp: '3 days ago' },
];

const SUBTOPIC_LABELS: Record<string, string> = {
  preamble: 'Preamble',
  'right-to-equality': 'Right to Equality',
  'right-to-freedom': 'Right to Freedom',
  exploitation: 'Right against Exploitation',
  'religious-freedom': 'Right to Freedom of Religion',
  'cultural-rights': 'Cultural & Educational Rights',
  'constitutional-remedies': 'Right to Constitutional Remedies',
};

export function PilotV2NoteList() {
  const { colors } = useTheme();
  const { state, dispatch } = usePilotV2();
  const [query, setQuery] = useState('');

  const subtopicId = state.view.selectedSubtopic;
  const topicName = subtopicId ? (SUBTOPIC_LABELS[subtopicId] ?? subtopicId.replace(/-/g, ' ')) : 'Notes';

  const notes = useMemo(() => {
    const real = state.notes.filter(n =>
      !state.view.selectedSubtopic || (n.subtopic && n.subtopic === topicName)
    );
    if (real.length === 0) return DEMO as any[];
    return real;
  }, [state.notes, state.view.selectedSubtopic, topicName]);

  const filtered = notes.filter(n =>
    !query || n.title.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelectNote = (id: string) => {
    if (id.startsWith('n') && id.length === 2) {
      // Demo row — surface a friendly hint instead of routing to a missing note.
      dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
      return;
    }
    dispatch({ type: 'SET_CURRENT_NOTE_ID', payload: id });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
  };

  const handleBack = () => {
    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'subject' });
  };

  return (
    <View testID="pilot-v2-notelist" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      <View style={[styles.header, { backgroundColor: '#fff', borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity testID="pilot-v2-notelist-back" onPress={handleBack} style={styles.backBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{topicName}</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: '#F3F3F5', borderColor: colors.border }]}>
            <Search size={18} color={colors.textTertiary} />
            <TextInput
              testID="pilot-v2-notelist-search"
              value={query}
              onChangeText={setQuery}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder={`Search in ${topicName}...`}
              placeholderTextColor={colors.textTertiary}
            />
          </View>
          <TouchableOpacity
            testID="pilot-v2-notelist-new"
            activeOpacity={0.85}
            style={[styles.newBtn, { backgroundColor: '#5B4EFA' }]}
          >
            <Plus size={18} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>New Note</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body}>
        {filtered.length === 0 ? (
          <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 40 }}>
            No matching notes
          </Text>
        ) : (
          filtered.map((n: any) => (
            <TouchableOpacity
              key={n.id}
              testID={`pilot-v2-note-${n.id}`}
              activeOpacity={0.85}
              onPress={() => handleSelectNote(n.id)}
              style={[styles.row, { backgroundColor: '#fff', borderColor: colors.border }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: '#DBEAFE' }]}>
                <FileText size={18} color="#2563EB" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {n.title}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                  {n.timestamp ?? formatTime(n.updated_at)}
                </Text>
              </View>
              {n.is_pinned && <Star size={18} color="#FACC15" fill="#FACC15" />}
              <TouchableOpacity hitSlop={6} style={{ padding: 6 }}>
                <MoreVertical size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { padding: 8, borderRadius: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  newBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
  },
  body: { paddingHorizontal: 24, paddingVertical: 16, gap: 8, paddingBottom: 80 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingHorizontal: 20, paddingVertical: 16,
    borderRadius: 16, borderWidth: 1,
  },
  rowIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
  rowMeta: { fontSize: 12 },
});
