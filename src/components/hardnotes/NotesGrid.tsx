/**
 * NotesGrid — right pane thumbnail grid/list of notes in the currently selected folder.
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, Pressable, ScrollView } from 'react-native';
import {
  FileText,
  Clock,
  Pin,
  Folder,
  List,
  Grid3X3,
  ChevronRight,
  Trash2,
  Copy,
  FolderInput,
  PinOff,
  X,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Canvas, Path } from '@shopify/react-native-skia';
import { useTheme } from '../../context/ThemeContext';
import { HardNode, HardNote, HardnotesService } from '../../services/HardnotesService';
import { strokeToSvgPath, StrokePoint } from './strokes';

interface Props {
  folderNodes: HardNode[]; // child folders of current selection
  noteNodes: HardNode[]; // child note leaves of current selection
  notesById: Map<string, HardNote>;
  allFolders?: HardNode[];
  onOpenFolder: (folderId: string) => void;
  onDataChanged?: () => Promise<void> | void;
}

type ViewMode = 'grid' | 'list';

type PreviewStroke = {
  id: string;
  path: string;
  color: string;
  width: number;
  opacity: number;
  tool?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

function buildStrokePreview(items: any[] | undefined, width: number, height: number): PreviewStroke[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const rawStrokes = items
    .flatMap((it) => {
      if (Array.isArray(it?.strokes)) return it.strokes;
      if (it?.type === 'stroke' && Array.isArray(it?.points)) return [it];
      return [];
    })
    .filter((s) => Array.isArray(s?.points) && s.points.length > 1)
    .slice(0, 14);

  if (rawStrokes.length === 0) return [];

  const allPoints = rawStrokes.flatMap((s) => s.points as StrokePoint[]);
  const minX = Math.min(...allPoints.map((p) => Number(p.x) || 0));
  const maxX = Math.max(...allPoints.map((p) => Number(p.x) || 0));
  const minY = Math.min(...allPoints.map((p) => Number(p.y) || 0));
  const maxY = Math.max(...allPoints.map((p) => Number(p.y) || 0));

  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);
  const pad = 6;
  const drawW = Math.max(1, width - pad * 2);
  const drawH = Math.max(1, height - pad * 2);
  const scale = Math.max(0.2, Math.min(drawW / rangeX, drawH / rangeY));

  return rawStrokes
    .map((s, idx) => {
      const pts = (s.points as StrokePoint[]).map((p) => ({
        ...p,
        x: (Number(p.x) - minX) * scale + pad,
        y: (Number(p.y) - minY) * scale + pad,
      }));
      const path = strokeToSvgPath(pts);
      if (!path) return null;

      return {
        id: String(s.id || `pv_${idx}`),
        path,
        color: typeof s.color === 'string' ? s.color : '#64748b',
        width: clamp((Number(s.width) || 2) * Math.max(0.3, scale * 0.25), 0.7, 5.5),
        opacity: typeof s.opacity === 'number' ? s.opacity : 1,
        tool: typeof s.tool === 'string' ? s.tool : undefined,
      } satisfies PreviewStroke;
    })
    .filter(Boolean) as PreviewStroke[];
}

function NoteCoverThumbnail({ note, pinned }: { note: HardNote | null; pinned: boolean }) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 120, h: 90 });

  const paths = useMemo(
    () => buildStrokePreview(note?.items, size.w, size.h),
    [note?.items, size.h, size.w],
  );

  return (
    <View
      style={[styles.thumb, { backgroundColor: colors.primary + '08' }]}
      onLayout={(e) => {
        const w = Math.max(60, Math.round(e.nativeEvent.layout.width));
        const h = Math.max(60, Math.round(e.nativeEvent.layout.height));
        setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
      }}
    >
      {paths.length > 0 ? (
        <Canvas style={StyleSheet.absoluteFillObject}>
          {paths.map((s) => (
            <Path
              key={s.id}
              path={s.path}
              color={s.color}
              style="stroke"
              strokeWidth={s.tool === 'highlighter' ? s.width * 1.8 : s.width}
              strokeCap="round"
              strokeJoin="round"
              opacity={s.tool === 'highlighter' ? Math.min(s.opacity, 0.5) : s.opacity}
              blendMode={s.tool === 'highlighter' ? 'multiply' : undefined}
            />
          ))}
        </Canvas>
      ) : (
        <View style={styles.thumbLinesWrap}>
          {[0.9, 0.7, 0.85, 0.5, 0.75].map((w, i) => (
            <View
              key={i}
              style={[styles.thumbLine, { width: `${w * 100}%`, backgroundColor: colors.textTertiary + '40' }]}
            />
          ))}
        </View>
      )}

      {pinned && (
        <View style={[styles.pinBadge, { backgroundColor: colors.primary }]}> 
          <Pin size={10} color="#fff" fill="#fff" />
        </View>
      )}
    </View>
  );
}

function SwipeDeleteWrap({
  children,
  onDelete,
  style,
}: {
  children: React.ReactNode;
  onDelete: () => void;
  style?: any;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      rightThreshold={30}
      renderRightActions={() => (
        <RectButton
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          style={styles.deleteActionBtn}
        >
          <Trash2 size={16} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </RectButton>
      )}
      containerStyle={style}
    >
      {children}
    </Swipeable>
  );
}

function SheetAction({
  icon,
  label,
  danger,
  disabled,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.sheetAction, disabled && { opacity: 0.5 }]}
    >
      {icon}
      <Text style={[styles.sheetActionText, danger && { color: '#ef4444' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function NotesGrid({ folderNodes, noteNodes, notesById, allFolders = [], onOpenFolder, onDataChanged }: Props) {
  const { colors } = useTheme();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [menuNode, setMenuNode] = useState<HardNode | null>(null);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const combined = [
    ...folderNodes.map((n) => ({ kind: 'folder' as const, node: n })),
    ...noteNodes.map((n) => ({ kind: 'note' as const, node: n })),
  ];

  const folderChoices = useMemo(
    () => allFolders
      .filter((f) => f.type === 'folder')
      .sort((a, b) => a.title.localeCompare(b.title)),
    [allFolders],
  );

  const closeMenu = () => {
    setMenuNode(null);
    setShowMovePicker(false);
  };

  const refreshAfterAction = async () => {
    if (onDataChanged) await onDataChanged();
  };

  const runMenuAction = async (fn: () => Promise<void>) => {
    if (!menuNode || actionBusy) return;
    setActionBusy(true);
    try {
      await fn();
      await refreshAfterAction();
      closeMenu();
    } catch (e: any) {
      Alert.alert('Action failed', e?.message || 'Could not complete action');
    } finally {
      setActionBusy(false);
    }
  };

  const confirmDelete = (node: HardNode) => {
    Alert.alert('Delete note?', 'This will remove the note from your library.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await HardnotesService.archive(node);
            await refreshAfterAction();
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Could not delete note');
          }
        },
      },
    ]);
  };

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

          const note = item.node.note_id ? notesById.get(item.node.note_id) || null : null;
          const pointCount = note?.items?.length || 0;
          const isPinned = !!item.node.is_pinned;

          const openNote = () =>
            router.push({
              pathname: '/hardnotes/editor',
              params: { noteId: item.node.note_id || '', nodeId: item.node.id, title: item.node.title },
            } as any);

          if (!isGrid) {
            return (
              <SwipeDeleteWrap onDelete={() => confirmDelete(item.node)}>
                <TouchableOpacity
                  onPress={openNote}
                  onLongPress={() => setMenuNode(item.node)}
                  delayLongPress={260}
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
              </SwipeDeleteWrap>
            );
          }

          return (
            <SwipeDeleteWrap onDelete={() => confirmDelete(item.node)} style={styles.gridSwipeWrap}>
              <TouchableOpacity
                onPress={openNote}
                onLongPress={() => setMenuNode(item.node)}
                delayLongPress={260}
                activeOpacity={0.75}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
                data-testid={`hn-grid-note-${item.node.id}`}
              >
                <NoteCoverThumbnail note={note} pinned={isPinned} />
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
            </SwipeDeleteWrap>
          );
        }}
      />

      <Modal
        visible={!!menuNode}
        transparent
        animationType="slide"
        onRequestClose={closeMenu}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeMenu}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheetCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {menuNode?.title || 'Note'}
              </Text>
              <TouchableOpacity onPress={closeMenu}>
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {!showMovePicker ? (
              <View style={{ gap: 4 }}>
                <SheetAction
                  icon={menuNode?.is_pinned ? <PinOff size={16} color={colors.textPrimary} /> : <Pin size={16} color={colors.textPrimary} />}
                  label={menuNode?.is_pinned ? 'Unpin' : 'Pin'}
                  disabled={actionBusy}
                  onPress={() => runMenuAction(async () => {
                    if (!menuNode) return;
                    await HardnotesService.togglePin(menuNode);
                  })}
                />
                <SheetAction
                  icon={<FolderInput size={16} color={colors.textPrimary} />}
                  label="Move to folder"
                  disabled={actionBusy}
                  onPress={() => setShowMovePicker(true)}
                />
                <SheetAction
                  icon={<Copy size={16} color={colors.textPrimary} />}
                  label="Duplicate"
                  disabled={actionBusy}
                  onPress={() => runMenuAction(async () => {
                    if (!menuNode) return;
                    await HardnotesService.duplicateNote(menuNode);
                  })}
                />
                <SheetAction
                  icon={<Trash2 size={16} color="#ef4444" />}
                  label="Delete"
                  danger
                  disabled={actionBusy}
                  onPress={() => {
                    if (!menuNode) return;
                    Alert.alert('Delete note?', 'This will remove the note from your library.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          void runMenuAction(async () => {
                            if (!menuNode) return;
                            await HardnotesService.archive(menuNode);
                          });
                        },
                      },
                    ]);
                  }}
                />
              </View>
            ) : (
              <>
                <Text style={[styles.moveLabel, { color: colors.textSecondary }]}>Move to…</Text>
                <ScrollView style={{ maxHeight: 250 }} contentContainerStyle={{ gap: 4, paddingBottom: 8 }}>
                  <TouchableOpacity
                    onPress={() => runMenuAction(async () => {
                      if (!menuNode) return;
                      await HardnotesService.moveNode(menuNode.id, null);
                    })}
                    style={[styles.moveRow, { borderColor: colors.border }]}
                  >
                    <HomeFolderLabel colors={colors} label="All Notes (root)" />
                  </TouchableOpacity>

                  {folderChoices.map((folder) => (
                    <TouchableOpacity
                      key={folder.id}
                      onPress={() => runMenuAction(async () => {
                        if (!menuNode) return;
                        await HardnotesService.moveNode(menuNode.id, folder.id);
                      })}
                      style={[styles.moveRow, { borderColor: colors.border }]}
                    >
                      <Folder size={16} color="#f59e0b" />
                      <Text style={[styles.moveRowText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {folder.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <TouchableOpacity
                  onPress={() => setShowMovePicker(false)}
                  style={[styles.backBtn, { borderColor: colors.border }]}
                >
                  <Text style={[styles.backBtnText, { color: colors.textSecondary }]}>Back</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HomeFolderLabel({ colors, label }: { colors: any; label: string }) {
  return (
    <>
      <Folder size={16} color={colors.primary} />
      <Text style={[styles.moveRowText, { color: colors.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
    </>
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

  gridSwipeWrap: { flex: 1 },

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

  deleteActionBtn: {
    width: 88,
    marginLeft: 6,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  deleteActionText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
    gap: 8,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 15, fontWeight: '900', flex: 1, marginRight: 10 },
  sheetAction: {
    minHeight: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
  },
  sheetActionText: { fontSize: 14, fontWeight: '700' },

  moveLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  moveRow: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  moveRowText: { flex: 1, fontSize: 13, fontWeight: '700' },
  backBtn: {
    height: 36,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  backBtnText: { fontSize: 12, fontWeight: '800' },
});
