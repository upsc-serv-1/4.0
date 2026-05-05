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
}

export function NoteRow({ node, expanded, onToggle, onOpen, onAction, glanceExpanded = false, onToggleGlance, style }: Props) {
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
    if (node.type === 'note') return <FileText size={18} color="#0ea5e9" />;
    if (node.type === 'notebook') return <BookOpen size={18} color="#10b981" />;
    return <Folder size={18} color="#f59e0b" />;
  };

  const getIconBg = () => {
    if (node.type === 'note') return '#e0f2fe';
    if (node.type === 'notebook') return '#dcfce7';
    return '#fef3c7';
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      friction={2}
      rightThreshold={40}
    >
      <View style={[styles.row, { backgroundColor: colors.bg, borderBottomColor: colors.border + 'A0' }, style]} data-testid={`vault-row-${node.id}`}>
        <View style={styles.content}>
          {/* Hierarchy Lines */}
          {Array.from({ length: node.depth }).map((_, i) => (
            <View
              key={i}
              style={[styles.verticalLine, { left: i * indentWidth + 20, backgroundColor: colors.border + '80' }]}
            />
          ))}

          {/* Toggle / Icon Area */}
          <View style={[styles.iconArea, { marginLeft: node.depth * indentWidth }]}>
            {node.type !== 'folder' || node.depth === 0 ? (
              <TouchableOpacity onPress={onOpen} style={styles.folderIconWrap}>
                <View style={[styles.officialFolderIcon, { backgroundColor: getIconBg() }]}>
                  {getIcon()}
                </View>
              </TouchableOpacity>
            ) : hasChildren ? (
              <TouchableOpacity
                onPress={onToggle}
                style={[styles.circleIcon, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                {expanded ? (
                  <Minus size={14} color={colors.textTertiary} strokeWidth={3} />
                ) : (
                  <Plus size={14} color={colors.textTertiary} strokeWidth={3} />
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.circlePlaceholder} />
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
                  styles.glanceBtn,
                  {
                    backgroundColor: glanceExpanded ? colors.primary + '18' : colors.surface,
                    borderColor: glanceExpanded ? colors.primary + '50' : colors.border,
                  },
                ]}
              >
                <Sparkles size={13} color={glanceExpanded ? colors.primary : colors.textTertiary} />
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
  row: { paddingHorizontal: 4, borderBottomWidth: 1 },
  content: { flexDirection: 'row', alignItems: 'center', minHeight: 70 },
  verticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  iconArea: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  circleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
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
  glanceBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
