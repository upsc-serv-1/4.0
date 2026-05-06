/**
 * NotesGrid — right pane thumbnail grid/list of notes in the currently selected folder.
 */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { FileText, Clock, Pin, Folder, List, Grid3X3, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { HardNode, HardNote } from '../../services/HardnotesService';

interface Props {
  folderNodes: HardNode[]; // child folders of current selection
  noteNodes: HardNode[]; // child note leaves of current selection
  notesById: Map<string, HardNote>;
  onOpenFolder: (folderId: string) => void;
}

type ViewMode = 'grid' | 'list';

export function NotesGrid({ folderNodes, noteNodes, notesById, onOpenFolder }: Props) {
  const { colors } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

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
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>Tap + New to create your first note.</Text>
      </View>
    );
  }

  const isGrid = viewMode === 'grid';
  const numColumns = isGrid ? 4 : 1;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.modeRow}>
        <View />
        <TouchableOpacity
          onPress={() => setViewMode((v) => (v === 'grid' ? 'list' : 'grid'))}
          style={[styles.modeBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          data-testid="hn-notes-view-toggle"
        >
          {viewMode === 'grid' ? <List size={16} color={colors.textPrimary} /> : <Grid3X3 size={16} color={colors.textPrimary} />}
          <Text style={[styles.modeTxt, { color: colors.textPrimary }]}>{viewMode === 'grid' ? 'List' : 'Grid'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        key={viewMode}
        data={combined}
        keyExtractor={(item) => `${item.kind}_${item.node.id}`}
        numColumns={numColumns}
        columnWrapperStyle={isGrid ? { gap: 12 } : undefined}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, gap: 12, paddingBottom: 120 }}
        data-testid="hn-notes-grid"
        renderItem={({ item }) => {
          if (item.kind === 'folder') {
            if (!isGrid) {
              return (
                <TouchableOpacity
                  onPress={() => onOpenFolder(item.node.id)}
                  style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  data-testid={`hn-grid-folder-${item.node.id}`}
                >
                  <Folder size={20} color="#f59e0b" />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.node.title}</Text>
                    <Text style={[styles.listSub, { color: colors.textTertiary }]}>Folder</Text>
                  </View>
                  <ChevronRight size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                onPress={() => onOpenFolder(item.node.id)}
                activeOpacity={0.7}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                data-testid={`hn-grid-folder-${item.node.id}`}
              >
                <View style={[styles.thumb, { backgroundColor: '#f59e0b10' }]}>
                  <Folder size={36} color="#f59e0b" strokeWidth={1.5} />
                </View>
                <View style={styles.meta}>
                  <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{item.node.title}</Text>
                  <Text style={[styles.sub, { color: colors.textTertiary }]}>Folder</Text>
                </View>
              </TouchableOpacity>
            );
          }

          const note = item.node.note_id ? notesById.get(item.node.note_id) : null;
          const pointCount = note?.items?.length || 0;
          const isPinned = !!item.node.is_pinned;

          const openNote = () =>
            router.push({
              pathname: '/hardnotes/editor',
              params: { noteId: item.node.note_id || '', nodeId: item.node.id, title: item.node.title },
            } as any);

          if (!isGrid) {
            return (
              <TouchableOpacity
                onPress={openNote}
                style={[styles.listRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                data-testid={`hn-grid-note-${item.node.id}`}
              >
                <FileText size={20} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.listTitle, { color: colors.textPrimary }]} numberOfLines={1}>{item.node.title}</Text>
                  <Text style={[styles.listSub, { color: colors.textTertiary }]}>
                    {new Date(item.node.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {pointCount} {pointCount === 1 ? 'point' : 'points'}
                  </Text>
                </View>
                {isPinned && <Pin size={14} color={colors.primary} fill={colors.primary} />}
                <ChevronRight size={16} color={colors.textTertiary} />
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              onPress={openNote}
              activeOpacity={0.75}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
              data-testid={`hn-grid-note-${item.node.id}`}
            >
              <View style={[styles.thumb, { backgroundColor: colors.primary + '08' }]}>
                <View style={styles.thumbLinesWrap}>
                  {[0.9, 0.7, 0.85, 0.5, 0.75].map((w, i) => (
                    <View
                      key={i}
                      style={[styles.thumbLine, { width: `${w * 100}%`, backgroundColor: colors.textTertiary + '40' }]}
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
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>{item.node.title}</Text>
                <View style={styles.metaRow}>
                  <Clock size={10} color={colors.textTertiary} />
                  <Text style={[styles.sub, { color: colors.textTertiary }]}>
                    {new Date(item.node.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                  <Text style={[styles.dot, { color: colors.textTertiary }]}>·</Text>
                  <Text style={[styles.sub, { color: colors.textTertiary }]}>{pointCount} {pointCount === 1 ? 'point' : 'points'}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 2,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modeBtn: {
    borderWidth: 1,
    borderRadius: 10,
    height: 32,
    paddingHorizontal: 10,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  modeTxt: { fontSize: 11, fontWeight: '800' },

  card: { flex: 1, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  thumb: { height: 90, alignItems: 'center', justifyContent: 'center', padding: 10 },
  thumbLinesWrap: { width: '100%', gap: 5 },
  thumbLine: { height: 4, borderRadius: 3 },
  pinBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { padding: 10, gap: 4 },
  title: { fontSize: 12, fontWeight: '800', letterSpacing: -0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sub: { fontSize: 10, fontWeight: '700' },
  dot: { fontSize: 10, fontWeight: '900' },

  listRow: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 58,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listTitle: { fontSize: 13, fontWeight: '800' },
  listSub: { fontSize: 10, fontWeight: '700', marginTop: 2 },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 },
  emptyIcon: { width: 78, height: 78, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '900' },
  emptySub: { fontSize: 13, fontWeight: '600', textAlign: 'center', maxWidth: 280 },
});
