/**
 * Pilot V2 — Sidebar (Subject mode)
 *
 * Renders the subject-scoped sidebar:
 *   • Back-to-Home button
 *   • Subject header tile
 *   • Numbered topic list (auto-expanding subtopics)
 *   • "Other subjects" footer for fast subject switching
 *
 * Topic data comes from a static seed mirroring the Figma comp
 * (Polity → Fundamental Rights → Right to Equality, etc.). Future iterations
 * can swap this for a live feed off `user_note_nodes`.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import {
  ChevronLeft, ChevronDown, ChevronRight,
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import { PILOT_V2_SUBJECT_PALETTE } from './types';

const SUBJECT_ICONS: Record<string, any> = {
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical,
};

interface Topic {
  id: string;
  label: string;
  subtopics?: { id: string; label: string }[];
}

const SUBJECT_TOPICS: Record<string, Topic[]> = {
  polity: [
    { id: 'constitution', label: 'Constitution' },
    {
      id: 'fundamental-rights',
      label: 'Fundamental Rights',
      subtopics: [
        { id: 'preamble', label: 'Preamble' },
        { id: 'right-to-equality', label: 'Right to Equality' },
        { id: 'right-to-freedom', label: 'Right to Freedom' },
        { id: 'exploitation', label: 'Right against Exploitation' },
        { id: 'religious-freedom', label: 'Right to Freedom of Religion' },
        { id: 'cultural-rights', label: 'Cultural & Educational Rights' },
        { id: 'constitutional-remedies', label: 'Right to Constitutional Remedies' },
      ],
    },
    { id: 'directive-principles', label: 'Directive Principles' },
    { id: 'fundamental-duties', label: 'Fundamental Duties' },
    { id: 'executive', label: 'Executive' },
    { id: 'legislature', label: 'Legislature' },
    { id: 'judiciary', label: 'Judiciary' },
    { id: 'federalism', label: 'Federalism' },
    { id: 'local-government', label: 'Local Government' },
    { id: 'election-commission', label: 'Election Commission' },
    { id: 'constitutional-bodies', label: 'Constitutional Bodies' },
    { id: 'amendments', label: 'Amendments' },
    { id: 'important-articles', label: 'Important Articles' },
  ],
  economy:      [{ id: 'overview', label: 'Indian Economy Overview' }, { id: 'budget', label: 'Budget 2025-26' }],
  history:      [{ id: 'ancient', label: 'Ancient India' }, { id: 'medieval', label: 'Medieval India' }, { id: 'modern', label: 'Modern India' }],
  geography:    [{ id: 'physical', label: 'Physical Geography' }, { id: 'human', label: 'Human Geography' }],
  ethics:       [{ id: 'theories', label: 'Ethical Theories' }, { id: 'case-studies', label: 'Case Studies' }],
  environment:  [{ id: 'biodiversity', label: 'Biodiversity' }, { id: 'climate', label: 'Climate Change' }],
  'science-tech': [{ id: 'space', label: 'Space' }, { id: 'biotech', label: 'Biotechnology' }],
};

export function PilotV2SidebarSubject() {
  const { colors } = useTheme();
  const { state, dispatch } = usePilotV2();
  const [expanded, setExpanded] = useState<string[]>(['fundamental-rights']);

  const subjectId = state.view.selectedSubject;
  const subject = PILOT_V2_SUBJECT_PALETTE.find(s => s.id === subjectId);
  if (!subject) return null;

  const Icon = SUBJECT_ICONS[subject.icon] ?? Book;
  const topics = SUBJECT_TOPICS[subject.id] ?? [];

  const toggleTopic = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectTopic = (topicId: string, hasSubtopics: boolean) => {
    if (hasSubtopics) { toggleTopic(topicId); return; }
    dispatch({ type: 'SET_SELECTED_TOPIC', payload: topicId });
  };

  const handleSelectSubtopic = (subtopicId: string) => {
    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: subtopicId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
  };

  return (
    <View
      testID="pilot-v2-sidebar-subject"
      style={[styles.root, { backgroundColor: colors.surface, borderRightColor: colors.border }]}
    >
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          testID="pilot-v2-sidebar-back-home"
          onPress={() => dispatch({ type: 'NAVIGATE_HOME' })}
          style={styles.backRow}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={colors.textSecondary} />
          <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }}>Back</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 }}>
          <View style={[styles.subjectIcon, { backgroundColor: subject.bg }]}>
            <Icon size={18} color={subject.text} />
          </View>
          <Text style={[styles.subjectTitle, { color: colors.textPrimary }]}>{subject.label}</Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 12 }}>
        {topics.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textTertiary }]}>No topics available</Text>
        ) : (
          topics.map((t, idx) => {
            const isExpanded = expanded.includes(t.id);
            const isSelectedTopic = state.view.selectedTopic === t.id;
            const hasSub = !!t.subtopics?.length;
            return (
              <View key={t.id}>
                <TouchableOpacity
                  testID={`pilot-v2-topic-${t.id}`}
                  activeOpacity={0.7}
                  onPress={() => handleSelectTopic(t.id, hasSub)}
                  style={[
                    styles.topicRow,
                    isSelectedTopic ? { backgroundColor: '#EEECFF' } : null,
                  ]}
                >
                  <Text style={{ color: colors.textTertiary, fontSize: 11, width: 22 }}>{idx + 1}.</Text>
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      fontWeight: '500',
                      color: isSelectedTopic ? '#5B4EFA' : colors.textPrimary,
                    }}
                  >
                    {t.label}
                  </Text>
                  {hasSub && (
                    <ChevronDown
                      size={14}
                      color={colors.textTertiary}
                      style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
                    />
                  )}
                </TouchableOpacity>

                {hasSub && isExpanded && (
                  <View style={{ marginLeft: 32, marginTop: 4, gap: 4 }}>
                    {t.subtopics!.map(st => {
                      const isSelected = state.view.selectedSubtopic === st.id;
                      return (
                        <TouchableOpacity
                          key={st.id}
                          testID={`pilot-v2-subtopic-${st.id}`}
                          activeOpacity={0.7}
                          onPress={() => handleSelectSubtopic(st.id)}
                          style={[
                            styles.subtopicRow,
                            isSelected ? { backgroundColor: '#EEECFF' } : null,
                          ]}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              color: isSelected ? '#5B4EFA' : colors.textSecondary,
                              fontWeight: isSelected ? '600' : '400',
                            }}
                          >
                            {st.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerLabel, { color: colors.textTertiary }]}>OTHER SUBJECTS</Text>
        {PILOT_V2_SUBJECT_PALETTE.filter(s => s.id !== subject.id).slice(0, 4).map(s => {
          const I = SUBJECT_ICONS[s.icon] ?? Book;
          return (
            <TouchableOpacity
              key={s.id}
              testID={`pilot-v2-other-${s.id}`}
              activeOpacity={0.7}
              onPress={() => dispatch({ type: 'SET_SELECTED_SUBJECT', payload: s.id })}
              style={styles.otherRow}
            >
              <View style={[styles.otherIcon, { backgroundColor: s.bg }]}>
                <I size={12} color={s.text} />
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>{s.label}</Text>
              <ChevronRight size={12} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 300, borderRightWidth: 1, flexDirection: 'column' },
  header: { paddingHorizontal: 24, paddingVertical: 24, borderBottomWidth: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  subjectIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  subjectTitle: { fontSize: 20, fontWeight: '700' },
  empty: { fontSize: 13, textAlign: 'center', paddingTop: 32 },
  topicRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8,
  },
  subtopicRow: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  footer: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 16, gap: 4 },
  footerLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 8 },
  otherRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 8, paddingVertical: 8, borderRadius: 8,
  },
  otherIcon: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
});
