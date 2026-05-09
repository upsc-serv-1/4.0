/**
 * Pilot V2 — Sidebar (Subject mode)
 *
 * Renders the subject-scoped sidebar with Notability-style smoothly expandable left navigation tree.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate, 
  Extrapolate,
  FadeInUp,
  FadeOutUp,
  Layout,
  useDerivedValue,
  withTiming
} from 'react-native-reanimated';
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

export const SUBJECT_TOPICS: Record<string, Topic[]> = {};

// Sub-component for smooth, masked collapsible topic-to-subtopics expand animations
function CollapsibleTopicItem({ 
  t, 
  idx, 
  isExpanded, 
  state, 
  colors, 
  handleSelectTopic, 
  handleSelectSubtopic 
}: {
  t: Topic;
  idx: number;
  isExpanded: boolean;
  state: any;
  colors: any;
  handleSelectTopic: (topicId: string, hasSubtopics: boolean) => void;
  handleSelectSubtopic: (subtopicId: string) => void;
}) {
  const hasSub = !!t.subtopics?.length;
  const isSelectedTopic = state.view.selectedTopic === t.id;
  const subtopicsCount = t.subtopics?.length ?? 0;
  const containerHeight = subtopicsCount * 36; // 32 height + 4 margin/gap per item

  // Shared progress value (runs on UI thread, extremely fast and reliable)
  const animationProgress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    animationProgress.value = withSpring(isExpanded ? 1 : 0, { 
      damping: 22, 
      stiffness: 160,
      mass: 0.75,
      overshootClamping: true // Avoid bouncing below 0 or beyond height
    });
  }, [isExpanded]);

  // Chevron rotation animation
  const chevronStyle = useAnimatedStyle(() => {
    const rotate = interpolate(animationProgress.value, [0, 1], [-90, 0]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  // Height and Opacity animation style (100% compatible with Expo Go, iOS, Android, Web)
  const collapsibleStyle = useAnimatedStyle(() => {
    const height = interpolate(animationProgress.value, [0, 1], [0, containerHeight]);
    const opacity = interpolate(animationProgress.value, [0, 0.2, 1], [0, 0.4, 1]);
    
    return {
      height,
      opacity,
      overflow: 'hidden',
    };
  });

  // Slide-in and Scale transition for subtopic items
  const childItemStyle = useAnimatedStyle(() => {
    const translateY = interpolate(animationProgress.value, [0, 1], [-8, 0]);
    const scale = interpolate(animationProgress.value, [0, 1], [0.96, 1]);
    
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <View style={{ marginBottom: 4 }}>
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
          <Animated.View style={chevronStyle}>
            <ChevronDown size={14} color={colors.textTertiary} />
          </Animated.View>
        )}
      </TouchableOpacity>

      {hasSub && (
        <Animated.View style={[collapsibleStyle, { marginLeft: 32 }]}>
          <Animated.View style={[childItemStyle, { gap: 4 }]}>
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
                    { height: 32, justifyContent: 'center' }
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
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

export function PilotV2SidebarSubject() {
  const { colors } = useTheme();
  const { state, dispatch } = usePilotV2();
  const [expanded, setExpanded] = useState<string[]>(['fundamental-rights']);

  const subjectId = state.view.selectedSubject;
  const subject = PILOT_V2_SUBJECT_PALETTE.find(s => s.id === subjectId);
  if (!subject) return null;

  const Icon = SUBJECT_ICONS[subject.icon] ?? Book;
  const staticTopics = SUBJECT_TOPICS[subject.id] ?? [];

  const topics = useMemo(() => {
    const list = [...staticTopics.map(t => ({ ...t, subtopics: t.subtopics ? [...t.subtopics] : [] }))];

    const activeNotes = state.notes.filter(n =>
      n.subject && n.subject.toLowerCase() === subject.label.toLowerCase()
    );

    activeNotes.forEach(note => {
      if (!note.subtopic) return;

      const subtopicLabel = note.subtopic;
      const topicLabel = note.topic || 'General Notes';

      let topicObj = list.find(t => t.label.toLowerCase() === topicLabel.toLowerCase());
      if (!topicObj) {
        topicObj = {
          id: topicLabel.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          label: topicLabel,
          subtopics: []
        };
        list.push(topicObj);
      }

      const hasSub = topicObj.subtopics?.some(st => st.label.toLowerCase() === subtopicLabel.toLowerCase());
      if (!hasSub) {
        topicObj.subtopics?.push({
          id: subtopicLabel,
          label: subtopicLabel
        });
      }
    });

    return list;
  }, [staticTopics, state.notes, subject.label]);

  const toggleTopic = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectTopic = (topicId: string, hasSubtopics: boolean) => {
    if (hasSubtopics) { toggleTopic(topicId); return; }
    dispatch({ type: 'SET_SELECTED_TOPIC', payload: topicId });
    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: topicId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
            return (
              <CollapsibleTopicItem
                key={t.id}
                t={t}
                idx={idx}
                isExpanded={isExpanded}
                state={state}
                colors={colors}
                handleSelectTopic={handleSelectTopic}
                handleSelectSubtopic={handleSelectSubtopic}
              />
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
