/**
 * Soft Notes — Notebooks Hub.
 *
 * Routes here at `/softnotes`. Owner can deep-link from anywhere or wire it
 * into the bottom tab bar via `TabConfigService` (separate change).
 *
 * Spec: file 5 §"Home screen (Notebooks Hub)" + file 3 §"Notebook list".
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import FeatureGate from '../../src/components/FeatureGate';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert,
  useWindowDimensions, Platform, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, BookOpen, Pin, Archive, Trash2, ChevronLeft, MoreVertical } from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { SoftNotebookService } from '../../src/softnotes/service';
import { Notebook } from '../../src/softnotes/types';

const COVER_PALETTE = ['#fde68a', '#fca5a5', '#a7f3d0', '#93c5fd', '#d8b4fe', '#fdba74', '#67e8f9', '#f9a8d4'];

function SoftNotesHub() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { width: winW } = useWindowDimensions();
  const isTablet = winW >= 760;
  const cols = isTablet ? (winW >= 1100 ? 5 : 4) : 2;

  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(COVER_PALETTE[0]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const list = await SoftNotebookService.list(userId, { archived: showArchived });
    setNotebooks(list);
    setLoading(false);
  }, [userId, showArchived]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!userId) return;
    const nb = await SoftNotebookService.create(userId, {
      name: draftName.trim() || 'Untitled notebook',
      cover_color: draftColor,
    });
    setCreateOpen(false);
    setDraftName('');
    setDraftColor(COVER_PALETTE[0]);
    if (nb) {
      router.push(`/softnotes/${nb.id}` as any);
    } else {
      Alert.alert('Could not create notebook', 'If this is the first run, did you apply the SOFTNOTES_MIGRATION.sql in Supabase?');
      load();
    }
  };

  const togglePin = async (nb: Notebook) => {
    await SoftNotebookService.update(nb.id, { pinned: !nb.pinned });
    load();
  };

  const archive = async (nb: Notebook) => {
    await SoftNotebookService.update(nb.id, { archived: !nb.archived });
    load();
  };

  const remove = (nb: Notebook) => {
    Alert.alert('Delete notebook?', `"${nb.name}" and all its pages, strokes and text will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await SoftNotebookService.remove(nb.id);
          load();
        },
      },
    ]);
  };

  const empty = notebooks.length === 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} data-testid="soft-back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>SOFT NOTES</Text>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Notebooks</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowArchived((s) => !s)}
          style={[styles.headerChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
          data-testid="soft-toggle-archived"
        >
          <Archive size={14} color={showArchived ? colors.primary : colors.textTertiary} />
          <Text style={[styles.headerChipTxt, { color: showArchived ? colors.primary : colors.textTertiary }]}>
            {showArchived ? 'Archived' : 'Active'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color={colors.primary} /></View>
      ) : empty ? (
        <View style={styles.emptyWrap}>
          <BookOpen size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {showArchived ? 'No archived notebooks' : 'Start your first notebook'}
          </Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            {showArchived ? 'Archived notebooks will appear here.' : 'Tap the + button to create one.'}
          </Text>
        </View>
      ) : (
        <FlatList
          key={cols}
          data={notebooks}
          keyExtractor={(it) => it.id}
          numColumns={cols}
          contentContainerStyle={{ padding: isTablet ? 24 : 12, gap: 12 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={({ item }) => (
            <NotebookCard
              notebook={item}
              cols={cols}
              onOpen={() => router.push(`/softnotes/${item.id}` as any)}
              onTogglePin={() => togglePin(item)}
              onArchive={() => archive(item)}
              onDelete={() => remove(item)}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        onPress={() => setCreateOpen(true)}
        style={[styles.fab, { backgroundColor: colors.primary }]}
        data-testid="soft-fab-new"
      >
        <Plus size={isTablet ? 28 : 24} color={colors.buttonText} />
      </TouchableOpacity>

      {/* Create modal */}
      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalScrim}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New notebook</Text>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Notebook name"
              placeholderTextColor={colors.textTertiary}
              style={[styles.modalInput, { color: colors.textPrimary, borderColor: colors.border }]}
              autoFocus
              data-testid="soft-create-name"
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Cover</Text>
            <View style={styles.swatchRow}>
              {COVER_PALETTE.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setDraftColor(c)}
                  style={[styles.swatch, { backgroundColor: c, borderColor: draftColor === c ? colors.primary : 'transparent' }]}
                  data-testid={`soft-cover-${c.replace('#', '')}`}
                />
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setCreateOpen(false)} style={styles.modalBtnGhost}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreate}
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                data-testid="soft-create-confirm"
              >
                <Text style={{ color: colors.buttonText, fontWeight: '900' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================================
// Notebook card
// ============================================================================
function NotebookCard({
  notebook, cols, onOpen, onTogglePin, onArchive, onDelete,
}: {
  notebook: Notebook;
  cols: number;
  onOpen: () => void;
  onTogglePin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const { width: winW } = useWindowDimensions();
  const isTablet = winW >= 760;
  const padding = isTablet ? 48 : 24;
  const gap = 12 * (cols - 1);
  const cardW = (winW - padding - gap) / cols;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <TouchableOpacity
      onPress={onOpen}
      style={[styles.card, { width: cardW, borderColor: colors.border }]}
      data-testid={`soft-notebook-${notebook.id}`}
    >
      <View style={[styles.cardCover, { backgroundColor: notebook.cover_color }]}>
        {notebook.pinned && (
          <View style={styles.pinBadge}><Pin size={10} color="#0f172a" /></View>
        )}
        <BookOpen size={isTablet ? 36 : 28} color="rgba(15,23,42,0.5)" />
      </View>
      <View style={styles.cardFoot}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]} numberOfLines={2}>
          {notebook.name}
        </Text>
        <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.cardMenuBtn} data-testid={`soft-notebook-menu-${notebook.id}`}>
          <MoreVertical size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <Modal transparent visible={menuOpen} animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <TouchableOpacity style={styles.menuScrim} onPress={() => setMenuOpen(false)}>
            <View style={[styles.menuCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MenuRow icon={<Pin size={16} color={colors.textPrimary} />} label={notebook.pinned ? 'Unpin' : 'Pin'} onPress={() => { setMenuOpen(false); onTogglePin(); }} />
              <MenuRow icon={<Archive size={16} color={colors.textPrimary} />} label={notebook.archived ? 'Unarchive' : 'Archive'} onPress={() => { setMenuOpen(false); onArchive(); }} />
              <MenuRow icon={<Trash2 size={16} color="#ef4444" />} label="Delete" destructive onPress={() => { setMenuOpen(false); onDelete(); }} />
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </TouchableOpacity>
  );
}

function MenuRow({ icon, label, onPress, destructive }: any) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.menuRow}>
      {icon}
      <Text style={[styles.menuRowLabel, destructive && { color: '#ef4444' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  headerBtn: { padding: 4 },
  eyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  headerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1,
  },
  headerChipTxt: { fontSize: 11, fontWeight: '800' },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '900' },
  emptySub: { fontSize: 13, textAlign: 'center', maxWidth: 280 },
  card: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden',
  },
  cardCover: {
    aspectRatio: 0.75,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  cardFoot: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 8,
  },
  cardTitle: { flex: 1, fontSize: 13, fontWeight: '800' },
  cardMenuBtn: { padding: 4 },
  pinBadge: {
    position: 'absolute', top: 8, right: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  fab: {
    position: 'absolute', right: 24, bottom: 24,
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, android: { elevation: 6 } }),
  },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, borderRadius: 16, borderWidth: 1, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  modalLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 4 },
  swatchRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  modalBtnGhost: { paddingHorizontal: 16, paddingVertical: 10 },
  modalBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  menuScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center' },
  menuCard: { minWidth: 220, borderRadius: 12, borderWidth: 1, paddingVertical: 6 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  menuRowLabel: { fontSize: 14, fontWeight: '700' },
});

export default function SoftNotesScreen() {
  return (
    <FeatureGate feature="soft_notes" featureLabel="Soft Notes">
      <SoftNotesHub />
    </FeatureGate>
  );
}
