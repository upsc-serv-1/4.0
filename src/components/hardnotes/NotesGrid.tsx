/**
 * NotesGrid — right pane thumbnail grid of notes in the currently selected folder.
 * Taps route to /notes/pro-editor for Skia drawing.
 */
import React from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { FileText, Clock, Pin, Folder } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { HardNode, HardNote, isFolder, isLeaf } from '../../services/HardnotesService';

interface Props {
  folderNodes: HardNode[]; // child folders of current selection
  noteNodes: HardNode[]; // child note leaves of current selection
  notesById: Map<string, HardNote>;
  onOpenFolder: (folderId: string) => void;
}

export function NotesGrid({ folderNodes, noteNodes, notesById, onOpenFolder }: Props) {
  const { colors } = useTheme();

  const combined = [
    ...folderNodes.map((n) => ({ kind: 'folder' as const, node: n })),
    ...noteNodes.map((n) => ({ kind: 'note' as const, node: n })),
  ];

  if (combined.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { backgroundColor: colors.primary + '15' }]}>
          <FileText size={32} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Empty folder</Text>
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
          Tap the <Text style={{ color: colors.primary, fontWeight: '900' }}>+ New</Text> button to create your first note.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={combined}
      keyExtractor={(item) => `${item.kind}_${item.node.id}`}
      numColumns={3}
      columnWrapperStyle={{ gap: 16 }}
      contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 120 }}
      data-testid="hn-notes-grid"
      renderItem={({ item }) => {
        if (item.kind === 'folder') {
          return (
            <TouchableOpacity
              onPress={() => onOpenFolder(item.node.id)}
              activeOpacity={0.7}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              data-testid={`hn-grid-folder-${item.node.id}`}
            >
              <View style={[styles.thumb, { backgroundColor: '#f59e0b10' }]}>
                <Folder size={46} color="#f59e0b" strokeWidth={1.5} />
              </View>
              <View style={styles.meta}>
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                  {item.node.title}
                </Text>
                <Text style={[styles.sub, { color: colors.textTertiary }]}>Folder</Text>
              </View>
            </TouchableOpacity>
          );
        }

        const note = item.node.note_id ? notesById.get(item.node.note_id) : null;
        const pointCount = note?.items?.length || 0;
        const isPinned = !!item.node.is_pinned;

        return (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/notes/pro-editor',
                params: { noteId: item.node.note_id || '', nodeId: item.node.id, title: item.node.title },
              } as any)
            }
            activeOpacity={0.75}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            data-testid={`hn-grid-note-${item.node.id}`}
          >
            <View style={[styles.thumb, { backgroundColor: colors.primary + '08' }]}>
              <View style={styles.thumbLinesWrap}>
                {[0.9, 0.7, 0.85, 0.5, 0.75].map((w, i) => (
                  <View
                    key={i}
                    style={[
                      styles.thumbLine,
                      { width: `${w * 100}%`, backgroundColor: colors.textTertiary + '40' },
                    ]}
                  />
                ))}
              </View>
              {isPinned && (
                <View style={[styles.pinBadge, { backgroundColor: colors.primary }]}>
                  <Pin size={10} color="#fff" fill="#fff" />
                </View>
              )}
            </View>
            <View style={styles.meta}>
              <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                {item.node.title}
              </Text>
              <View style={styles.metaRow}>
                <Clock size={10} color={colors.textTertiary} />
                <Text style={[styles.sub, { color: colors.textTertiary }]}>
                  {new Date(item.node.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
                <Text style={[styles.dot, { color: colors.textTertiary }]}>·</Text>
                <Text style={[styles.sub, { color: colors.textTertiary }]}>
                  {pointCount} {pointCount === 1 ? 'point' : 'points'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  thumb: { height: 130, alignItems: 'center', justifyContent: 'center', padding: 14 },
  thumbLinesWrap: { width: '100%', gap: 7 },
  thumbLine: { height: 5, borderRadius: 3 },
  pinBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { padding: 12, gap: 4 },
  title: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { fontSize: 10, fontWeight: '700' },
  dot: { fontSize: 10, fontWeight: '900' },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  emptyIcon: { width: 78, height: 78, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '900' },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', maxWidth: 280 },
});
