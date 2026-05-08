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
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform } from 'react-native';
import {
  Home as HomeIcon, Pin, Clock, Share2, Trash2, Plus, Settings, ChevronRight,
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book, X,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import { PILOT_V2_SUBJECT_PALETTE, PilotV2QuickFilter } from './types';
import { PilotV2SidebarSubject } from './PilotV2SidebarSubject';
import { createPilotV2Node } from '../../repositories/pilotV2Repo';

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
  const { state, dispatch } = usePilotV2();
  const { signOut, session } = useAuth();
  const activeFilter = state.view.quickFilter;
  const [newSubjectModal, setNewSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSelectSubject = (subjectId: string) => {
    dispatch({ type: 'SET_SELECTED_SUBJECT', payload: subjectId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'subject' });
  };

  const handleQuickNav = (filter: PilotV2QuickFilter) => {
    dispatch({ type: 'SET_QUICK_FILTER', payload: filter });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' });
  };

  const handleNewSubject = () => {
    setNewSubjectName('');
    setNewSubjectModal(true);
  };

  const submitNewSubject = async () => {
    const title = newSubjectName.trim();
    if (!title) return;
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to create subjects.');
      return;
    }
    setCreating(true);
    try {
      const created = await createPilotV2Node({
        userId: session.user.id,
        type: 'subject',
        title,
        parentId: null,
      });
      if (!created) {
        Alert.alert('Could not create', 'Subject could not be created. Please try again.');
        return;
      }
      // Surface the new subject immediately by switching to its detail view.
      dispatch({ type: 'SET_SELECTED_SUBJECT', payload: created.id });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'subject' });
      setNewSubjectModal(false);
    } finally {
      setCreating(false);
    }
  };

  const handleSettings = () => {
    Alert.alert(
      'Settings',
      session?.user?.email ? `Signed in as ${session.user.email}` : 'Signed out',
      [
        {
          text: 'Toggle sidebar',
          onPress: () => dispatch({ type: 'TOGGLE_SIDEBAR' }),
        },
        ...(session ? [{
          text: 'Sign out',
          style: 'destructive' as const,
          onPress: () => { signOut().catch(() => null); },
        }] : []),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    );
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
        <NavRow active={activeFilter === 'home'}    label="Home"           Icon={HomeIcon} colors={colors} testID="pilot-v2-nav-home"    onPress={() => handleQuickNav('home')} />
        <NavRow active={activeFilter === 'pinned'}  label="Pinned"         Icon={Pin}      colors={colors} testID="pilot-v2-nav-pinned"  onPress={() => handleQuickNav('pinned')} />
        <NavRow active={activeFilter === 'recent'}  label="Recent"         Icon={Clock}    colors={colors} testID="pilot-v2-nav-recent"  onPress={() => handleQuickNav('recent')} />
        <NavRow active={activeFilter === 'shared'}  label="Shared with me" Icon={Share2}   colors={colors} testID="pilot-v2-nav-shared"  onPress={() => handleQuickNav('shared')} />
        <NavRow active={activeFilter === 'trash'}   label="Trash"          Icon={Trash2}   colors={colors} testID="pilot-v2-nav-trash"   onPress={() => handleQuickNav('trash')} />
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
          onPress={handleNewSubject}
          style={[styles.newSubjectRow]}
        >
          <Plus size={18} color="#5B4EFA" />
          <Text style={{ color: '#5B4EFA', fontSize: 14, fontWeight: '600' }}>New Subject</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <TouchableOpacity testID="pilot-v2-settings" onPress={handleSettings} style={styles.settingsRow}>
        <Settings size={18} color={colors.textSecondary} />
        <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>Settings</Text>
      </TouchableOpacity>

      {/* New Subject modal — Step 24 */}
      <Modal
        visible={newSubjectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNewSubjectModal(false)}
      >
        <View style={styles.nsBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => setNewSubjectModal(false)} style={StyleSheet.absoluteFill} />
          <View style={[styles.nsCard, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="pilot-v2-new-subject-modal">
            <View style={styles.nsHeader}>
              <Text style={[styles.nsTitle, { color: colors.textPrimary }]}>New Subject</Text>
              <TouchableOpacity onPress={() => setNewSubjectModal(false)} testID="pilot-v2-new-subject-close">
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.nsHint, { color: colors.textTertiary }]}>
              Add a custom subject to your Pilot V2 workspace. You can create topics and notes inside it afterwards.
            </Text>
            <TextInput
              testID="pilot-v2-new-subject-input"
              value={newSubjectName}
              onChangeText={setNewSubjectName}
              placeholder="e.g. International Relations"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              style={[styles.nsInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
              onSubmitEditing={submitNewSubject}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity
                onPress={() => setNewSubjectModal(false)}
                style={[styles.nsBtnGhost, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="pilot-v2-new-subject-submit"
                onPress={submitNewSubject}
                disabled={!newSubjectName.trim() || creating}
                style={[styles.nsBtnPrimary, { backgroundColor: '#5B4EFA', opacity: newSubjectName.trim() && !creating ? 1 : 0.5 }]}
              >
                <Plus size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '700' }}>{creating ? 'Creating…' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface NavRowProps {
  label: string;
  Icon: any;
  colors: any;
  active?: boolean;
  testID?: string;
  onPress?: () => void;
}

function NavRow({ label, Icon, colors, active, testID, onPress }: NavRowProps) {
  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.7}
      onPress={onPress}
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
  /* New Subject modal — Step 24 */
  nsBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  nsCard: { width: '100%', maxWidth: 420, borderRadius: 18, borderWidth: 1, padding: 18 },
  nsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  nsTitle: { fontSize: 17, fontWeight: '900' },
  nsHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  nsInput: {
    height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  nsBtnGhost: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  nsBtnPrimary: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
});
