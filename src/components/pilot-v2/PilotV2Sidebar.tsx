/**
 * Pilot V2 — Sidebar (Home mode)
 *
 * Faithful port of the KM app `Sidebar` (mode === 'home'). Renders:
 *   • Brand header
 *   • Quick-nav (Home / Pinned / Recent / Shared / Trash)
 *   • Subjects list with coloured icon tile and chevron-right hover
 *   • New Subject CTA
 *   • Settings footer
 *
 * Tap a subject -> switches the parent route into 'subject' mode, which the
 * router will render via `PilotV2SidebarSubject` instead.
 *
 * UI tokens follow the Figma spec colours from `theme.css` of the Knowledge
 * Management app (#5B4EFA primary, #F9FAFB canvas, #FFFFFF surface, etc.).
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  Home as HomeIcon, Pin, Clock, Share2, Trash2, Plus, Settings, ChevronRight,
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import { PILOT_V2_SUBJECT_PALETTE } from './types';
import { PilotV2SidebarSubject } from './PilotV2SidebarSubject';

const SUBJECT_ICONS: Record<string, any> = {
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical,
};

interface PilotV2SidebarProps {
  mode: 'home' | 'subject';
}

export function PilotV2Sidebar({ mode }: PilotV2SidebarProps) {
  if (mode === 'subject') return <PilotV2SidebarSubject />;
  return <PilotV2SidebarHome />;
}

function PilotV2SidebarHome() {
  const { colors } = useTheme();
  const { dispatch } = usePilotV2();

  const handleSelectSubject = (subjectId: string) => {
    dispatch({ type: 'SET_SELECTED_SUBJECT', payload: subjectId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'subject' });
  };

  return (
    <View
      testID="pilot-v2-sidebar-home"
      style={[styles.root, { backgroundColor: colors.surface, borderRightColor: colors.border }]}
    >
      {/* Brand */}
      <View style={styles.brandRow}>
        <View style={[styles.brandLogo, { backgroundColor: '#5B4EFA' }]}>
          <Book size={22} color="#fff" />
        </View>
        <Text style={[styles.brandText, { color: colors.textPrimary }]}>Notes</Text>
      </View>

      {/* Quick nav */}
      <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
        <NavRow active label="Home" Icon={HomeIcon} colors={colors} testID="pilot-v2-nav-home" />
        <NavRow label="Pinned" Icon={Pin} colors={colors} testID="pilot-v2-nav-pinned" />
        <NavRow label="Recent" Icon={Clock} colors={colors} testID="pilot-v2-nav-recent" />
        <NavRow label="Shared with me" Icon={Share2} colors={colors} testID="pilot-v2-nav-shared" />
        <NavRow label="Trash" Icon={Trash2} colors={colors} testID="pilot-v2-nav-trash" />
      </View>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Subjects */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 16 }}>
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>SUBJECTS</Text>
        {PILOT_V2_SUBJECT_PALETTE.map((s) => {
          const Icon = SUBJECT_ICONS[s.icon] ?? Book;
          return (
            <TouchableOpacity
              key={s.id}
              testID={`pilot-v2-subject-${s.id}`}
              activeOpacity={0.7}
              onPress={() => handleSelectSubject(s.id)}
              style={[styles.subjectRow]}
            >
              <View style={[styles.subjectIcon, { backgroundColor: s.bg }]}>
                <Icon size={16} color={s.text} />
              </View>
              <Text style={[styles.subjectText, { color: colors.textPrimary }]}>{s.label}</Text>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          testID="pilot-v2-new-subject"
          activeOpacity={0.7}
          style={[styles.newSubjectRow]}
        >
          <Plus size={18} color="#5B4EFA" />
          <Text style={{ color: '#5B4EFA', fontSize: 14, fontWeight: '600' }}>New Subject</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <TouchableOpacity testID="pilot-v2-settings" style={styles.settingsRow}>
        <Settings size={18} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

interface NavRowProps {
  label: string;
  Icon: any;
  colors: any;
  active?: boolean;
  testID?: string;
}

function NavRow({ label, Icon, colors, active, testID }: NavRowProps) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.7}
      style={[
        styles.navRow,
        active ? { backgroundColor: '#EEECFF' } : null,
      ]}
    >
      <Icon size={18} color={active ? '#5B4EFA' : colors.textSecondary} />
      <Text
        style={{
          color: active ? '#5B4EFA' : colors.textPrimary,
          fontSize: 14,
          fontWeight: active ? '600' : '500',
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 300,
    borderRightWidth: 1,
    flexDirection: 'column',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  brandLogo: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 22, fontWeight: '700' },
  divider: { height: 1, marginHorizontal: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  subjectIcon: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  subjectText: { flex: 1, fontSize: 14, fontWeight: '500' },
  newSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
});
