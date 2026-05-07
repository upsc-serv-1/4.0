/**
 * Capsule sidebar — primary navigation rail for the Capsule tab.
 *
 * In Step 3 it shows the static structure (Home, Pinned, Recent, Shared,
 * Trash, Subjects, +New Subject, Settings). In Step 4 it transforms into the
 * dynamic expandable tree (Subject -> Topic -> Subtopic).
 */
import React, { useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import {
  Home, Star, Clock, Users, Trash2, Settings, Plus,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { CapsuleNode, CAPSULE_SUBJECT_PALETTE } from '../../types/capsule';

export type CapsuleSidebarSection = 'home' | 'pinned' | 'recent' | 'shared' | 'trash';

interface Props {
  subjects: CapsuleNode[];
  activeSection: CapsuleSidebarSection;
  activeSubjectId?: string | null;
  onSelectSection: (section: CapsuleSidebarSection) => void;
  onSelectSubject: (subjectId: string) => void;
  onAddSubject: () => void;
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

const SubjectRow: React.FC<{
  subject: CapsuleNode;
  active?: boolean;
  onPress: () => void;
}> = ({ subject, active, onPress }) => {
  const { colors } = useTheme();
  const color = subject.color || CAPSULE_SUBJECT_PALETTE[subject.title] || CAPSULE_SUBJECT_PALETTE.default;
  const initial = (subject.title || '?').charAt(0).toUpperCase();
  return (
    <TouchableOpacity
      testID={`capsule-sidebar-subject-${subject.id}`}
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.navRow,
        active && { backgroundColor: hex(colors.primary, 0.10), borderLeftColor: colors.primary },
      ]}
    >
      <View style={[styles.subjectChip, { backgroundColor: color }]}>
        <Text style={styles.subjectChipText}>{initial}</Text>
      </View>
      <Text
        numberOfLines={1}
        style={[
          styles.navLabel,
          { color: active ? colors.primary : colors.textPrimary, fontWeight: active ? '600' : '400' },
        ]}
      >
        {subject.title}
      </Text>
    </TouchableOpacity>
  );
};

export const CapsuleSidebar: React.FC<Props> = ({
  subjects, activeSection, activeSubjectId, onSelectSection, onSelectSubject, onAddSubject, onOpenSettings,
}) => {
  const { colors } = useTheme();

  const handleSection = useCallback(
    (s: CapsuleSidebarSection) => () => onSelectSection(s),
    [onSelectSection]
  );

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => (a.title || '').localeCompare(b.title || '')),
    [subjects]
  );

  return (
    <View
      testID="capsule-sidebar"
      style={[styles.container, { backgroundColor: colors.surface, borderRightColor: colors.border }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Capsule</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <NavRow
          Icon={Home} label="Home"
          active={activeSection === 'home' && !activeSubjectId}
          onPress={handleSection('home')}
          testID="capsule-nav-home"
        />
        <NavRow
          Icon={Star} label="Pinned"
          active={activeSection === 'pinned'}
          onPress={handleSection('pinned')}
          testID="capsule-nav-pinned"
        />
        <NavRow
          Icon={Clock} label="Recent"
          active={activeSection === 'recent'}
          onPress={handleSection('recent')}
          testID="capsule-nav-recent"
        />
        <NavRow
          Icon={Users} label="Shared with me"
          active={activeSection === 'shared'}
          onPress={handleSection('shared')}
          testID="capsule-nav-shared"
        />
        <NavRow
          Icon={Trash2} label="Trash"
          active={activeSection === 'trash'}
          onPress={handleSection('trash')}
          testID="capsule-nav-trash"
        />

        <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>SUBJECTS</Text>

        {sortedSubjects.map((s) => (
          <SubjectRow
            key={s.id}
            subject={s}
            active={activeSubjectId === s.id}
            onPress={() => onSelectSubject(s.id)}
          />
        ))}

        <TouchableOpacity
          testID="capsule-add-subject-btn"
          onPress={onAddSubject}
          activeOpacity={0.7}
          style={styles.navRow}
        >
          <Plus color={colors.primary} size={18} />
          <Text style={[styles.navLabel, { color: colors.primary, fontWeight: '500' }]}>New Subject</Text>
        </TouchableOpacity>
      </ScrollView>

      {onOpenSettings && (
        <TouchableOpacity
          testID="capsule-nav-settings"
          onPress={onOpenSettings}
          activeOpacity={0.7}
          style={[styles.navRow, styles.settingsRow, { borderTopColor: colors.border }]}
        >
          <Settings color={colors.textTertiary} size={18} />
          <Text style={[styles.navLabel, { color: colors.textPrimary }]}>Settings</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/* simple alpha helper */
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
    height: 60,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { paddingVertical: 8 },
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
    paddingTop: 18,
    paddingBottom: 6,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  subjectChip: {
    width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
  },
  subjectChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  settingsRow: { borderTopWidth: 1, height: 52 },
});
