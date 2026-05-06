import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  ChevronRight, Minus, Plus, Folder, BookOpen, FileText,
  Edit2, FolderPlus, Trash2, FolderInput, FileDown, Play, Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { Swipeable, RectButton } from 'react-native-gesture-handler';

export type NoteRowAction = 'add' | 'duplicate' | 'rename' | 'move' | 'delete' | 'play' | 'export';

type NodeType = 'folder' | 'notebook' | 'note';

export type NoteNode = {
  id: string;
  user_id: string;
  parent_id: string | null;
  type: NodeType;
  title: string;
  note_id: string | null;
  is_archived: boolean;
  updated_at?: string;
  created_at?: string;
  depth: number;
  children: NoteNode[];
  childrenCount: number; // Only for subtitle
};

interface Props {
  node: NoteNode;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  onAction: (action: NoteRowAction) => void;
  /** Show the Glance "unfold" inline toggle. Only meaningful for notes/notebooks. */
  glanceExpanded?: boolean;
  onToggleGlance?: () => void;
  /** Optional style override for the row container */
  style?: any;
  /** Highlight the row (e.g. for selection in split view) */
  isHighlighted?: boolean;
}

export function NoteRow({ node, expanded, onToggle, onOpen, onAction, glanceExpanded = false, onToggleGlance, style, isHighlighted }: Props) {
  const { colors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  const closeSwipe = () => {
    swipeableRef.current?.close();
  };

  const showPlay = node.type === 'note' || (node.type === 'notebook' && !!node.note_id);
  const showGlanceBtn = (node.type === 'note' || (node.type === 'notebook' && !!node.note_id)) && !!onToggleGlance;

  const renderRightActions = () => {
    return (
      <View style={[styles.actionsRow, { backgroundColor: colors.bg }]}>
        {showPlay && (
          <ActionBtn
            icon={<Play size={18} />} bg="#0ea5e9"
            label="Read" onPress={() => { closeSwipe(); onAction('play'); }}
          />
        )}
        {(node.type === 'folder' || node.type === 'notebook') && (
          <ActionBtn
            icon={<FolderPlus size={18} />} bg="#10b981"
            label="Add" onPress={() => { closeSwipe(); onAction('add'); }}
          />
        )}
        <ActionBtn
          icon={<FileDown size={18} />} bg="#06b6d4"
          label="Export" onPress={() => { closeSwipe(); onAction('export'); }}
        />
        <ActionBtn
          icon={<Edit2 size={18} />} bg="#f59e0b"
          label="Rename" onPress={() => { closeSwipe(); onAction('rename'); }}
        />
        <ActionBtn
          icon={<FolderInput size={18} />} bg="#8b5cf6"
          label="Move" onPress={() => { closeSwipe(); onAction('move'); }}
        />
        <ActionBtn
          icon={<FileText size={18} />} bg="#94a3b8"
          label="Duplicate" onPress={() => { closeSwipe(); onAction('duplicate'); }}
        />
        <ActionBtn
          icon={<Trash2 size={18} />} bg="#ef4444"
          label="Delete" onPress={() => { closeSwipe(); onAction('delete'); }}
        />
      </View>
    );
  };

  const hasChildren = node.children.length > 0;
  const indentWidth = 40;

  const getIcon = () => {
    if (node.type === 'note') return <FileText size={18} color={colors.primary} />;
    if (node.type === 'notebook') return <BookOpen size={18} color={colors.primary} />;
    return <Folder size={18} color={colors.textSecondary} />;
  };

  const getIconBg = () => {
    if (node.type === 'note') return colors.primary + '15';
    if (node.type === 'notebook') return colors.primary + '15';
    return colors.surfaceStrong;
  };

  // Depth-specific container styles
  const getContainerStyles = () => {
    if (node.depth === 0) {
      return {
        backgroundColor: colors.surface,
        borderRadius: expanded ? 14 : 14,
        borderBottomLeftRadius: expanded ? 0 : 14,
        borderBottomRightRadius: expanded ? 0 : 14,
        marginHorizontal: 0,
        marginBottom: 3,
        paddingVertical: 10,
        paddingHorizontal: 12,
      };
    } else if (node.depth === 1) {
      return {
        backgroundColor: colors.surfaceStrong,
        borderRadius: expanded ? 10 : 10,
        borderBottomLeftRadius: expanded ? 0 : 10,
        borderBottomRightRadius: expanded ? 0 : 10,
        marginLeft: 10,
        marginBottom: 2,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderLeftWidth: 1.5,
        borderLeftColor: colors.border + '60',
        paddingLeft: 10,
      };
    } else {
      return {
        backgroundColor: colors.surface,
        borderRadius: 8,
        marginLeft: 20,
        marginBottom: 2,
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderLeftWidth: 1.5,
        borderLeftColor: colors.border + '60',
      };
    }
  };

  const containerStyle = getContainerStyles();

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <View
        style={[
          styles.row,
          { backgroundColor: colors.bg, borderBottomColor: colors.border + 'A0' },
          containerStyle,
          isHighlighted && { borderColor: colors.primary, borderWidth: 1.5, shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
          style,
        ]}
        data-testid={`vault-row-${node.id}`}
      >
        <View style={styles.content}>
          {/* Icon */}
          <TouchableOpacity onPress={onOpen} style={styles.iconWrap}>
            <View style={[styles.iconBox, { backgroundColor: getIconBg() }]}>
              {getIcon()}
            </View>
          </TouchableOpacity>

          {/* Text Area */}
          <TouchableOpacity
            onPress={onOpen}
            style={styles.textContainer}
            activeOpacity={0.6}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {node.title}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                {node.type === 'note' ? 'Note' : `${node.childrenCount} item${node.childrenCount === 1 ? '' : 's'}`}
              </Text>
            </View>

            {showGlanceBtn && (
              <TouchableOpacity
                onPress={onToggleGlance}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                data-testid={`vault-glance-toggle-${node.id}`}
                style={[
                  styles.glancePill,
                  {
                    backgroundColor: glanceExpanded ? colors.primary + '18' : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.glancePillText, { color: colors.primary }]}>Glances</Text>
              </TouchableOpacity>
            )}

            {showPlay && (
              <TouchableOpacity
                onPress={() => onAction('play')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                data-testid={`vault-play-${node.id}`}
                style={[styles.playBtn, { backgroundColor: colors.primary + '12' }]}
              >
                <Play size={13} color={colors.primary} fill={colors.primary} />
              </TouchableOpacity>
            )}

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
  row: { paddingHorizontal: 4, borderBottomWidth: 0 },
  content: { flexDirection: 'row', alignItems: 'center', minHeight: 60 },
  iconWrap: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
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
  glancePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  glancePillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
