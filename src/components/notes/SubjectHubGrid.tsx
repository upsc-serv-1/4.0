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
  Trash2, FolderInput, FolderPlus, Play, MoreHorizontal,
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

export const SUBJECT_PALETTE = [
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

export const paletteFor = (name: string, idx: number) => {
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

  return (    <View style={styles.grid}>
      {folders.map((node, idx) => {
        const Icon = subjectIconFor(node.title);
        const { bg, fg } = paletteFor(node.title, idx);
        const counts = countDescendants(node);
        const isNotebook = node.type === 'notebook';
        const isNote = node.type === 'note';

        return (
          <Pressable
            key={node.id}
            data-testid={`vault-subject-${node.id}`}
            onPress={() => onOpen(node)}
            onLongPress={() => onAction(node, 'delete')}
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
            {/* Delete button */}
            <TouchableOpacity
              onPress={() => onAction(node, 'delete')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={[styles.moreBtn, { backgroundColor: '#fee2e2' }]}
            >
              <Trash2 size={10} color="#dc2626" />
            </TouchableOpacity>

            <View style={[styles.iconWrap, { backgroundColor: bg }]}>
              <Icon size={22} color={fg} strokeWidth={2} />
            </View>
            
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: colors.textPrimary }]}
                numberOfLines={2}
              >
                {node.title}
              </Text>
            </View>

            {!isNote && (
              <View style={[styles.countBadge, { backgroundColor: fg + '14', borderColor: fg + '33' }]}>
                <Text style={[styles.countText, { color: fg }]}>{counts.total}</Text>
                <Text style={[styles.countLabel, { color: fg }]}>
                  {counts.total === 1 ? 'item' : 'items'}
                </Text>
              </View>
            )}

            {isNote && (
               <View style={[styles.countBadge, { backgroundColor: '#e0f2fe12', borderColor: '#0ea5e933' }]}>
                <Text style={[styles.countText, { color: '#0ea5e9' }]}>1</Text>
                <Text style={[styles.countLabel, { color: '#0ea5e9' }]}>note</Text>
              </View>
            )}

            {/* Type indicator for non-folders in grid */}
            {(isNotebook || isNote) && (
              <View style={[styles.typeIndicator, { backgroundColor: isNotebook ? '#10b98122' : '#0ea5e922' }]}>
                <Text style={[styles.typeIndicatorText, { color: isNotebook ? '#10b981' : '#0ea5e9' }]}>
                  {isNotebook ? 'Notebook' : 'Note'}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>

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
    width: '31%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    minHeight: 140,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 4,
  },
  moreBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    flex: 1,
    lineHeight: 16,
  },
  countBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 'auto',
  },
  countText: { fontSize: 11, fontWeight: '900', letterSpacing: -0.3 },
  countLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  typeIndicator: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  typeIndicatorText: {
    fontSize: 7,
    fontWeight: '900',
    textTransform: 'uppercase',
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
