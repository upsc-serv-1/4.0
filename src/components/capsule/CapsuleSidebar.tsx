/**
 * Capsule sidebar — primary navigation rail with the dynamic expandable
 * Subject -> Topic -> Subtopic -> Notebook tree.
 *
 * Single sidebar that transforms in-place per the bible spec — no second
 * column is introduced. Top section stays static (Home / Pinned / Recent
 * etc); bottom section is the tree.
 */
import React, { useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import {
  Home, Star, Clock, Users, Trash2, Settings, Plus,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { CapsuleNode } from '../../types/capsule';
import { CapsuleTreeNode } from '../../repositories/capsuleRepo';
import { CapsuleTreeNav } from './CapsuleTreeNav';

export type CapsuleSidebarSection = 'home' | 'pinned' | 'recent' | 'shared' | 'trash';

interface Props {
  tree: CapsuleTreeNode[];
  expandedIds: Set<string>;
  selectedId: string | null;
  activeSection: CapsuleSidebarSection;
  onSelectSection: (section: CapsuleSidebarSection) => void;
  onSelectNode: (node: CapsuleTreeNode) => void;
  onToggleExpand: (node: CapsuleTreeNode) => void;
  onAddSubject: () => void;
  onAddChild: (parent: CapsuleTreeNode) => void;
  onOpenSettings?: () => void;
}

interface NavRowProps {
  Icon: any;
  label: string;
  active?: boolean;
  onPress: () => void;
  testID?: string;
}

const NavRow: React.FC<NavRowProps> = ({ Icon, label, active, onPress, testID }) => {
  const { colors } = useTheme();
  const tint = active ? colors.primary : colors.textTertiary;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.navRow,
        active && { backgroundColor: hex(colors.primary, 0.10), borderLeftColor: colors.primary },
      ]}
    >
      <Icon color={tint} size={18} strokeWidth={active ? 2.5 : 2} />
      <Text style={[styles.navLabel, { color: active ? colors.primary : colors.textPrimary }, active && { fontWeight: '600' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export const CapsuleSidebar: React.FC<Props> = ({
  tree, expandedIds, selectedId, activeSection, onSelectSection, onSelectNode,
  onToggleExpand, onAddSubject, onAddChild, onOpenSettings,
}) => {
  const { colors } = useTheme();

  const handleSection = useCallback(
    (s: CapsuleSidebarSection) => () => onSelectSection(s),
    [onSelectSection]
  );

  const noSelection = !selectedId;

  return (
    <View
      testID="capsule-sidebar"
      style={[styles.container, { backgroundColor: colors.surface, borderRightColor: colors.border }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Capsule</Text>
      </View>

      <View style={styles.staticSection}>
        <NavRow Icon={Home}   label="Home"           active={activeSection === 'home' && noSelection}   onPress={handleSection('home')}   testID="capsule-nav-home" />
        <NavRow Icon={Star}   label="Pinned"         active={activeSection === 'pinned'  && noSelection} onPress={handleSection('pinned')} testID="capsule-nav-pinned" />
        <NavRow Icon={Clock}  label="Recent"         active={activeSection === 'recent'  && noSelection} onPress={handleSection('recent')} testID="capsule-nav-recent" />
        <NavRow Icon={Users}  label="Shared with me" active={activeSection === 'shared'  && noSelection} onPress={handleSection('shared')} testID="capsule-nav-shared" />
        <NavRow Icon={Trash2} label="Trash"          active={activeSection === 'trash'   && noSelection} onPress={handleSection('trash')}  testID="capsule-nav-trash" />
        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>SUBJECTS</Text>
      </View>

      <View style={styles.treeWrap}>
        <CapsuleTreeNav
          tree={tree}
          expandedIds={expandedIds}
          selectedId={selectedId}
          onToggleExpand={onToggleExpand}
          onSelect={onSelectNode}
          onAddChild={(p) => p && onAddChild(p)}
        />
      </View>

      <TouchableOpacity
        testID="capsule-add-subject-btn"
        onPress={onAddSubject}
        activeOpacity={0.7}
        style={[styles.navRow, { borderTopWidth: 1, borderTopColor: colors.border }]}
      >
        <Plus color={colors.primary} size={18} />
        <Text style={[styles.navLabel, { color: colors.primary, fontWeight: '500' }]}>New Subject</Text>
      </TouchableOpacity>

      {onOpenSettings && (
        <TouchableOpacity
          testID="capsule-nav-settings"
          onPress={onOpenSettings}
          activeOpacity={0.7}
          style={[styles.navRow, { borderTopColor: colors.border, borderTopWidth: 1 }]}
        >
          <Settings color={colors.textTertiary} size={18} />
          <Text style={[styles.navLabel, { color: colors.textPrimary }]}>Settings</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

function hex(c: string, alpha: number): string {
  if (!c?.startsWith('#') || c.length !== 7) return c;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${c}${a}`;
}

const styles = StyleSheet.create({
  container: {
    width: 280,
    borderRightWidth: 1,
    flexDirection: 'column',
  },
  header: {
    height: 60, paddingHorizontal: 16, justifyContent: 'center', borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  staticSection: { paddingTop: 4 },
  treeWrap: { flex: 1 },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
    gap: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  navLabel: { fontSize: 14, flex: 1 },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
});
