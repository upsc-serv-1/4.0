import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight, Minus, Plus, Zap } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { BranchNode } from '../../services/BranchService';
import { Settings as SettingsIcon, Edit2, FolderPlus, Trash2, FolderInput, Folder, FileDown } from 'lucide-react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

export type DeckRowAction = 'add' | 'export' | 'settings' | 'rename' | 'move' | 'delete';

interface Props {
  node: BranchNode;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAction: (action: DeckRowAction) => void;
  color?: string;
}

// Convert a hex pastel into a darker readable accent for the icon stroke
function darken(hex: string, amount = 0.55): string {
  const m = /^#?([a-f\d]{6})$/i.exec(hex || '');
  if (!m) return '#0ea5e9';
  const num = parseInt(m[1], 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function DeckRow({ node, expanded, onToggle, onOpen, onAction, color }: Props) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipe = () => {
    swipeableRef.current?.close();
  };

  const renderRightActions = () => {
    return (
      <View style={[styles.actionsRow, { backgroundColor: colors.bg }]}>
        <ActionBtn
          icon={<FolderPlus size={18} />} bg="#10b981"
          label="Add" onPress={() => { closeSwipe(); onAction('add'); }}
        />
        <ActionBtn
          icon={<FileDown size={18} />} bg="#06b6d4"
          label="Export" onPress={() => { closeSwipe(); onAction('export'); }}
        />
        <ActionBtn
          icon={<SettingsIcon size={18} />} bg="#3b82f6"
          label="Settings" onPress={() => { closeSwipe(); onAction('settings'); }}
        />
        <ActionBtn
          icon={<Edit2 size={18} />} bg="#f59e0b"
          label="Rename" onPress={() => { closeSwipe(); onAction('rename'); }}
        />
        {!node.is_folder && (
          <ActionBtn
            icon={<FolderInput size={18} />} bg="#8b5cf6"
            label="Move" onPress={() => { closeSwipe(); onAction('move'); }}
          />
        )}
        <ActionBtn
          icon={<Trash2 size={18} />} bg="#ef4444"
          label="Delete" onPress={() => { closeSwipe(); onAction('delete'); }}
        />
      </View>
    );
  };

  const hasChildren = node.children.length > 0;
  const indentWidth = 40;

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <View style={[styles.row, { backgroundColor: colors.bg, borderBottomColor: colors.border + 'A0' }]}>
        {color ? (
          <View
            pointerEvents="none"
            style={[styles.colorAccent, { backgroundColor: color }]}
          />
        ) : null}
        <View style={styles.content}>
          {/* Hierarchy Lines */}
          {Array.from({ length: node.depth }).map((_, i) => (
            <View 
              key={i} 
              style={[styles.verticalLine, { left: i * indentWidth + 20, backgroundColor: colors.border + '80' }]} 
            />
          ))}

          {/* Toggle / Icon Area — left interaction zone (expand/collapse) */}
          <View style={[styles.iconArea, { marginLeft: node.depth * indentWidth }]}>
            {node.is_folder && node.depth === 0 ? (
              <TouchableOpacity
                onPress={onOpen}
                style={styles.folderIconWrap}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                 <View style={[styles.officialFolderIcon, { backgroundColor: color || '#e0f2fe' }]}>
                    <Folder size={18} color={color ? darken(color) : '#0ea5e9'} />
                 </View>
              </TouchableOpacity>
            ) : hasChildren ? (
              <TouchableOpacity
                onPress={onToggle}
                style={styles.toggleHitArea}
                hitSlop={{ top: 18, bottom: 18, left: 18, right: 18 }}
                accessibilityRole="button"
                accessibilityLabel={expanded ? 'Collapse deck' : 'Expand deck'}
                testID={`deck-toggle-${node.id}`}
              >
                <View style={[styles.circleIcon, { backgroundColor: color || colors.surface, borderColor: color ? darken(color, 0.2) : colors.border }]}>
                  {expanded ? (
                    <Minus size={16} color={color ? darken(color) : colors.textTertiary} strokeWidth={3} />
                  ) : (
                    <Plus size={16} color={color ? darken(color) : colors.textTertiary} strokeWidth={3} />
                  )}
                </View>
              </TouchableOpacity>
            ) : (
              color && !node.is_folder ? (
                <View style={[styles.circleIcon, { backgroundColor: color, borderColor: darken(color, 0.2) }]}>
                  <Zap size={12} color={darken(color)} />
                </View>
              ) : (
                <View style={styles.circlePlaceholder} />
              )
            )}
          </View>

          {/* Text Area */}
          <TouchableOpacity 
            onPress={onOpen} 
            style={styles.textContainer}
            activeOpacity={0.6}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {node.name}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                Cards for today: {node.due_count}/{node.total_count}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.border} />
          </TouchableOpacity>
        </View>
      </View>
    </Swipeable>
  );
}

function ActionBtn({ icon, label, onPress }: any) {
  const { colors } = useTheme();
  return (
    <RectButton
      onPress={onPress}
      style={styles.action}
    >
      <View style={[styles.actionCircle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {React.cloneElement(icon, { color: colors.textPrimary, size: 20 })}
      </View>
      <Text style={[styles.actionLabel, { color: colors.textSecondary }]}>{label}</Text>
    </RectButton>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'relative', overflow: 'hidden' },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  action: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, height: '100%' },
  actionCircle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 8, fontWeight: '800', textTransform: 'uppercase' },
  row: { paddingHorizontal: 4, borderBottomWidth: 1, position: 'relative' },
  colorAccent: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderRadius: 2,
  },
  content: { flexDirection: 'row', alignItems: 'center', minHeight: 70 },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  iconArea: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  toggleHitArea: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  circleIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePlaceholder: {
    width: 22,
  },
  folderIconWrap: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  officialFolderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
});
