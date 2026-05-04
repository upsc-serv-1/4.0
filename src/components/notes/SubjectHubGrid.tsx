/**
 * SubjectHubGrid — root view of the Knowledge Vault.
 *
 * Renders the user's *own* top-level folders as a 2-column icon grid
 * (no auto-seeding of subjects). Standardised icons are auto-mapped from
 * folder name keywords to match the Tags-tab visual language.
 *
 * Each card shows: subject icon, name, item count, and child count badge.
 * Long-press exposes the actionable swipe-row (parent provides handler).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import {
  BookOpen, Scale, Scroll, TrendingUp, Globe, Leaf, Atom, Hash, Palette, Shield,
  Map as MapIcon, Heart, Users, Settings as SettingsIcon, Folder, FileDown, Edit2,
  Trash2, FolderInput, FolderPlus, Play,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { NoteNode } from './NoteRow';

interface Props {
  folders: NoteNode[];
  onOpen: (node: NoteNode) => void;
  onAction: (
    node: NoteNode,
    action: 'add' | 'export' | 'rename' | 'move' | 'delete' | 'duplicate' | 'play',
  ) => void;
}

const SUBJECT_PALETTE = [
  { bg: '#fff7ed', fg: '#ea580c' }, // orange
  { bg: '#ecfdf5', fg: '#10b981' }, // green
  { bg: '#eff6ff', fg: '#2563eb' }, // blue
  { bg: '#fef2f2', fg: '#dc2626' }, // red
  { bg: '#fdf4ff', fg: '#a21caf' }, // magenta
  { bg: '#f0fdfa', fg: '#0d9488' }, // teal
  { bg: '#fefce8', fg: '#ca8a04' }, // yellow
  { bg: '#eef2ff', fg: '#4f46e5' }, // indigo
];

const subjectIconFor = (name: string) => {
  const n = (name || '').toLowerCase();
  if (n.includes('polity') || n.includes('constitut')) return Scale;
  if (n.includes('history') || n.includes('ancient') || n.includes('medieval') || n.includes('modern')) return Scroll;
  if (n.includes('econom')) return TrendingUp;
  if (n.includes('geograph')) return Globe;
  if (n.includes('environ') || n.includes('ecolog')) return Leaf;
  if (n.includes('science') || n.includes('tech')) return Atom;
  if (n.includes('csat') || n.includes('math') || n.includes('reasoning')) return Hash;
  if (n.includes('art') || n.includes('cultur')) return Palette;
  if (n.includes('security') || n.includes('defence')) return Shield;
  if (n.includes('international') || n.includes(' ir ') || n.startsWith('ir ') || n === 'ir') return MapIcon;
  if (n.includes('ethic') || n.includes('integrity')) return Heart;
  if (n.includes('social')) return Users;
  if (n.includes('govern')) return SettingsIcon;
  return BookOpen;
};

const paletteFor = (name: string, idx: number) => {
  // Stable per-name palette pick using a tiny hash so colors don't flicker.
  let seed = idx;
  for (let i = 0; i < name.length; i++) seed = (seed * 31 + name.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[seed % SUBJECT_PALETTE.length];
};

const countDescendants = (node: NoteNode) => {
  let folders = 0, notebooks = 0, notes = 0;
  const walk = (n: NoteNode) => {
    n.children.forEach((c) => {
      if (c.type === 'folder') folders++;
      else if (c.type === 'notebook') notebooks++;
      else if (c.type === 'note') notes++;
      walk(c);
    });
  };
  walk(node);
  return { folders, notebooks, notes, total: folders + notebooks + notes };
};

export function SubjectHubGrid({ folders, onOpen, onAction }: Props) {
  const { colors } = useTheme();

  if (folders.length === 0) {
    return (
      <View style={styles.empty}>
        <Folder size={56} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Your vault is empty</Text>
        <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
          Create your first folder to start organising notes by subject.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {folders.map((node, idx) => {
        const Icon = subjectIconFor(node.title);
        const { bg, fg } = paletteFor(node.title, idx);
        const counts = countDescendants(node);
        return (
          <Pressable
            key={node.id}
            data-testid={`vault-subject-${node.id}`}
            onPress={() => onOpen(node)}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.iconWrap, { backgroundColor: bg }]}>
              <Icon size={26} color={fg} strokeWidth={1.8} />
            </View>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {node.title}
              </Text>
            </View>
            <View style={[styles.countBadge, { backgroundColor: fg + '14', borderColor: fg + '33' }]}>
              <Text style={[styles.countText, { color: fg }]}>{counts.total}</Text>
              <Text style={[styles.countLabel, { color: fg }]}>
                item{counts.total === 1 ? '' : 's'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              {counts.folders > 0 && (
                <Text style={[styles.metaPill, { color: colors.textTertiary }]}>
                  {counts.folders} fld
                </Text>
              )}
              {counts.notebooks > 0 && (
                <Text style={[styles.metaPill, { color: colors.textTertiary }]}>
                  {counts.notebooks} nb
                </Text>
              )}
              {counts.notes > 0 && (
                <Text style={[styles.metaPill, { color: colors.textTertiary }]}>
                  {counts.notes} note{counts.notes === 1 ? '' : 's'}
                </Text>
              )}
            </View>

            <View style={styles.actionRow}>
              <ActionDot icon={<Play size={13} color={fg} />} onPress={() => onAction(node, 'play')} bg={fg + '14'} testID={`vault-subject-play-${node.id}`} />
              <ActionDot icon={<FolderPlus size={13} color="#10b981" />} onPress={() => onAction(node, 'add')} bg="#dcfce7" testID={`vault-subject-add-${node.id}`} />
              <ActionDot icon={<FileDown size={13} color="#0ea5e9" />} onPress={() => onAction(node, 'export')} bg="#e0f2fe" testID={`vault-subject-export-${node.id}`} />
              <ActionDot icon={<Edit2 size={13} color="#f59e0b" />} onPress={() => onAction(node, 'rename')} bg="#fef3c7" testID={`vault-subject-rename-${node.id}`} />
              <ActionDot icon={<FolderInput size={13} color="#8b5cf6" />} onPress={() => onAction(node, 'move')} bg="#ede9fe" testID={`vault-subject-move-${node.id}`} />
              <ActionDot icon={<Trash2 size={13} color="#ef4444" />} onPress={() => onAction(node, 'delete')} bg="#fee2e2" testID={`vault-subject-delete-${node.id}`} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActionDot({ icon, onPress, bg, testID }: { icon: React.ReactNode; onPress: () => void; bg: string; testID?: string }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      data-testid={testID}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      style={[styles.actionDot, { backgroundColor: bg }]}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  card: {
    width: '47.5%',
    flexGrow: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    minHeight: 180,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 2,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
    flex: 1,
  },
  countBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
  },
  countText: { fontSize: 13, fontWeight: '900', letterSpacing: -0.3 },
  countLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  metaPill: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 'auto',
  },
  actionDot: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginTop: 16,
    letterSpacing: -0.3,
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
});
