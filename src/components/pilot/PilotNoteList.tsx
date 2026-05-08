import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import {
  ArrowLeft, ChevronRight, FileText, Calendar, Plus
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { PilotNote } from '../../context/PilotContext';

interface PilotNoteListProps {
  notes: PilotNote[];
  topicName?: string;
  onBack: () => void;
  onSelectNote: (note: PilotNote) => void;
  onCreateNote?: () => void;
}

export const PilotNoteList: React.FC<PilotNoteListProps> = ({
  notes,
  topicName = 'All Notes',
  onBack,
  onSelectNote,
  onCreateNote,
}) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ArrowLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {topicName}
        </Text>
        {onCreateNote && (
          <TouchableOpacity onPress={onCreateNote} style={styles.addBtn}>
            <Plus size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {notes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <FileText size={48} color={colors.textTertiary} opacity={0.3} style={{ marginBottom: 12 }} />
            <Text style={{ color: colors.textSecondary, fontSize: 15, fontWeight: '700' }}>No notes in this folder</Text>
            <Text style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', marginTop: 4, paddingHorizontal: 40 }}>
              Create a new note to start building your knowledge base.
            </Text>
          </View>
        ) : (
          notes.map((note) => (
            <TouchableOpacity
              key={note.id}
              onPress={() => onSelectNote(note)}
              style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.primary + '12' }]}>
                <FileText size={18} color={colors.primary} />
              </View>

              <View style={styles.itemBody}>
                <Text style={[styles.itemTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {note.title}
                </Text>
                <View style={styles.itemMeta}>
                  <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>
                    {note.subject}
                  </Text>
                  <Text style={{ fontSize: 11, color: colors.textTertiary }}>•</Text>
                  <View style={styles.dateRow}>
                    <Calendar size={10} color={colors.textTertiary} />
                    <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>
                      {new Date(note.updated_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </View>

              <ChevronRight size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 8, borderRadius: 20 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', marginLeft: 8 },
  addBtn: { padding: 8 },
  scrollContent: { padding: 16, gap: 12 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemBody: { flex: 1, gap: 4 },
  itemTitle: { fontSize: 14, fontWeight: '800' },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
