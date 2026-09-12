/**
 * Capsule expandable navigation tree.
 *
 * One dynamic sidebar — when a subject is tapped its topics expand inline,
 * when a topic is tapped its subtopics expand inline, etc. NO additional
 * sidebars are introduced (per bible spec).
 *
 * Each row carries an inline "+" button to create a child node inline,
 * matching the screenshots ("New Topic", "New Subtopic", "New Notebook").
 */
import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  ChevronRight, ChevronDown, Plus, FileText, BookOpen,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  CapsuleNode, CapsuleNodeType, CAPSULE_SUBJECT_PALETTE,
} from '../../types/capsule';
import { CapsuleTreeNode } from '../../repositories/capsuleRepo';

interface Props {
  tree: CapsuleTreeNode[];
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggleExpand: (node: CapsuleTreeNode) => void;
  onSelect: (node: CapsuleTreeNode) => void;
  onAddChild: (parent: CapsuleTreeNode | null) => void;
  /** When true the rendering reflects the tree as a sidebar (compact). */
  compact?: boolean;
}

const CHILD_LABEL: Record<CapsuleNodeType, string> = {
  subject:  'New Topic',
  topic:    'New Subtopic',
  subtopic: 'New Notebook',
  notebook: '',
};

export const CapsuleTreeNav: React.FC<Props> = ({
  tree, expandedIds, selectedId, onToggleExpand, onSelect, onAddChild,
}) => {
  const { colors } = useTheme();

  const renderNode = useCallback((node: CapsuleTreeNode, depth: number) => {
    const isExpanded = expandedIds.has(node.id);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children.length > 0;
    const canHaveChildren = node.type !== 'notebook';

    const tint = node.type === 'subject'
      ? (node.color || CAPSULE_SUBJECT_PALETTE[node.title] || CAPSULE_SUBJECT_PALETTE.default)
      : null;

    return (
      <View key={node.id}>
        <TouchableOpacity
          testID={`capsule-tree-row-${node.id}`}
          onPress={() => {
            onSelect(node);
            if (canHaveChildren) onToggleExpand(node);
          }}
          activeOpacity={0.7}
          style={[
            styles.row,
            { paddingLeft: 12 + depth * 14 },
            isSelected && { backgroundColor: hex(colors.primary, 0.10), borderLeftColor: colors.primary },
          ]}
        >
          {canHaveChildren ? (
            <TouchableOpacity
              testID={`capsule-tree-toggle-${node.id}`}
              onPress={() => onToggleExpand(node)}
              hitSlop={6}
              style={styles.chevron}
            >
              {isExpanded
                ? <ChevronDown color={colors.textTertiary} size={14} />
                : <ChevronRight color={colors.textTertiary} size={14} />}
            </TouchableOpacity>
          ) : (
            <View style={styles.chevron} />
          )}

          {tint ? (
            <View style={[styles.subjectChip, { backgroundColor: tint }]}>
              <Text style={styles.subjectChipText}>{(node.title || '?').charAt(0).toUpperCase()}</Text>
            </View>
          ) : node.type === 'notebook' ? (
            <FileText color={colors.textTertiary} size={14} />
          ) : (
            <BookOpen color={colors.textTertiary} size={14} />
          )}

          <Text
            numberOfLines={1}
            style={[
              styles.label,
              {
                color: isSelected ? colors.primary : colors.textPrimary,
                fontWeight: node.type === 'subject' ? '600' : isSelected ? '600' : '400',
              },
            ]}
          >
            {node.title}
          </Text>

          {node.type !== 'notebook' && node.notebookCount > 0 && (
            <Text style={[styles.count, { color: colors.textTertiary }]}>{node.notebookCount}</Text>
          )}
        </TouchableOpacity>

        {isExpanded && (
          <View>
            {node.children.map((c) => renderNode(c, depth + 1))}

            {canHaveChildren && CHILD_LABEL[node.type] && (
              <TouchableOpacity
                testID={`capsule-tree-add-${node.id}`}
                onPress={() => onAddChild(node)}
                activeOpacity={0.7}
                style={[styles.row, styles.addRow, { paddingLeft: 12 + (depth + 1) * 14 }]}
              >
                <View style={styles.chevron} />
                <Plus color={colors.primary} size={14} />
                <Text style={[styles.label, { color: colors.primary, fontWeight: '500' }]} numberOfLines={1}>
                  {CHILD_LABEL[node.type]}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  }, [expandedIds, selectedId, onSelect, onToggleExpand, onAddChild, colors]);

  const sortedTree = useMemo(() => tree, [tree]);

  return (
    <ScrollView
      testID="capsule-tree"
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {sortedTree.map((n) => renderNode(n, 0))}
    </ScrollView>
  );
};

function hex(c: string, alpha: number): string {
  if (!c?.startsWith('#') || c.length !== 7) return c;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${c}${a}`;
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 4, paddingRight: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingRight: 12, gap: 6,
    borderLeftWidth: 3, borderLeftColor: 'transparent',
    minHeight: 36,
  },
  chevron: { width: 16, alignItems: 'center', justifyContent: 'center' },
  subjectChip: {
    width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center',
  },
  subjectChipText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  label: { fontSize: 13, flex: 1 },
  count: { fontSize: 11 },
  addRow: { opacity: 0.85 },
});
