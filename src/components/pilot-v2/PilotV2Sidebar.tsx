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
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform, Animated, KeyboardAvoidingView } from 'react-native';
import {
  Home as HomeIcon, Pin, Clock, Share2, Trash2, Plus, Settings, ChevronRight, ChevronDown, ChevronLeft,
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book, X, Search,
  FolderPlus, Edit2, FolderInput,
  Shield, Palette, Flag, Columns, Building, Briefcase, Sprout, Rocket, Dna, Cpu, Mountain, Wind, Waves, TreePine, Coins, BookOpen, Brain, Calculator, FileText,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import { PILOT_V2_SUBJECT_PALETTE, PilotV2QuickFilter, iconForSubject, iconForTopic } from './types';
import { PilotV2SidebarSubject, SUBJECT_TOPICS } from './PilotV2SidebarSubject';
import { createPilotV2Node, archivePilotV2Node, fetchAllPilotV2Nodes, fetchPilotV2NotesForUser } from '../../repositories/pilotV2Repo';
import { PilotV2MoveModal, NodeToMove } from './PilotV2MoveModal';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import AnimatedReanimated, { useSharedValue, useAnimatedStyle, withSpring, interpolate, FadeInUp } from 'react-native-reanimated';
import { usePilotV2DoubleTap } from './usePilotV2DoubleTap';

const SUBJECT_ICONS: Record<string, any> = {
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book,
};

const TOPIC_ICONS: Record<string, any> = {
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book,
  Shield, Palette, Flag, Columns, Building, Briefcase, Sprout, Rocket, Dna, Cpu, Mountain, Wind, Waves, TreePine, Coins, BookOpen, Brain, Calculator, FileText,
};

function ActionBtn({ icon, label, onPress }: any) {
  const { colors } = useTheme();
  return (
    <RectButton
      onPress={onPress}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingHorizontal: 10,
        height: '100%',
        minWidth: 55,
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        }}
      >
        {React.cloneElement(icon, { color: colors.textPrimary, size: 16 })}
      </View>
      <Text
        style={{
          fontSize: 7,
          fontWeight: '800',
          textTransform: 'uppercase',
          color: colors.textSecondary,
        }}
      >
        {label}
      </Text>
    </RectButton>
  );
}

function CollapsibleTopicItem({
  t,
  idx,
  subjectLabel,
  isExpanded,
  state,
  colors,
  handleSelectTopic,
  handleSelectSubtopic,
  onAddTopic,
  onRenameTopic,
  onDeleteTopic,
  onMoveTopic,
  onAddSubtopic,
  onRenameSubtopic,
  onDeleteSubtopic,
  onMoveSubtopic,
  handleTopicLongPress,
  handleSubtopicLongPress,
}: {
  t: any;
  idx: number;
  subjectLabel: string;
  isExpanded: boolean;
  state: any;
  colors: any;
  handleSelectTopic: (topicId: string, hasSub: boolean) => void;
  handleSelectSubtopic: (subtopicId: string) => void;
  onAddTopic: (t: any) => void;
  onRenameTopic: (t: any) => void;
  onDeleteTopic: (t: any) => void;
  onMoveTopic: (t: any) => void;
  onAddSubtopic: (st: any, t: any) => void;
  onRenameSubtopic: (st: any, t: any) => void;
  onDeleteSubtopic: (st: any, t: any) => void;
  onMoveSubtopic: (st: any, t: any) => void;
  handleTopicLongPress?: (t: any, label: string) => void;
  handleSubtopicLongPress?: (st: any, t: any, label: string) => void;
}) {
  const hasSub = !!t.subtopics?.length;
  const isSelectedTopic = state.view.selectedTopic === t.id && state.view.mode === 'noteList';
  const topicIconKey = iconForTopic(t.label);
  const TopicIconComponent = TOPIC_ICONS[topicIconKey] || FileText;

  return (
    <View style={{ marginBottom: 4 }}>
      <Swipeable
        renderRightActions={(progress, dragX) => {
          const trans = dragX.interpolate({
            inputRange: [-220, 0],
            outputRange: [0, 220],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View style={{ transform: [{ translateX: trans }], width: 220, flexDirection: 'row', height: '100%', paddingLeft: 5, backgroundColor: colors.surfaceStrong }}>
              <ActionBtn
                icon={<FolderPlus />}
                label="Add"
                onPress={() => onAddTopic(t)}
              />
              <ActionBtn
                icon={<FolderInput />}
                label="Move"
                onPress={() => onMoveTopic(t)}
              />
              <ActionBtn
                icon={<Edit2 />}
                label="Rename"
                onPress={() => onRenameTopic(t)}
              />
              <ActionBtn
                icon={<Trash2 />}
                label="Delete"
                onPress={() => onDeleteTopic(t)}
              />
            </Animated.View>
          );
        }}
        friction={1.5}
        rightThreshold={30}
      >
        <TouchableOpacity
          onPress={() => handleSelectTopic(t.id, hasSub)}
          onLongPress={() => handleTopicLongPress ? handleTopicLongPress(t, subjectLabel) : null}
          style={[
            styles.topicRow,
            isSelectedTopic ? { backgroundColor: '#F3F4F6' } : null,
          ]}
        >
          <Text style={{ color: colors.textTertiary, fontSize: 11, width: 22 }}>{idx + 1}.</Text>
          <TopicIconComponent size={15} color={colors.textSecondary} style={{ marginRight: 6 }} />
          <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: colors.textPrimary }}>
            {t.label}
          </Text>
          {hasSub && (
            <View style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}>
              <ChevronDown size={12} color={colors.textTertiary} />
            </View>
          )}
        </TouchableOpacity>
      </Swipeable>

      {hasSub && isExpanded && (
        <View style={{ paddingLeft: 22, marginTop: 2, gap: 2 }}>
          {t.subtopics!.map((st: any, stIdx: number) => {
            const isSelectedSub = state.view.selectedSubtopic === st.id && state.view.mode === 'noteList';
            const subIconKey = iconForTopic(t.label); // Key Requirement: Map based on parent Topic's name!
            const SubIconComponent = TOPIC_ICONS[subIconKey] || FileText;
            
            return (
              <Swipeable
                key={`${t.id}-${st.id}-${stIdx}`}
                renderRightActions={(progress, dragX) => {
                  const trans = dragX.interpolate({
                    inputRange: [-220, 0],
                    outputRange: [0, 220],
                    extrapolate: 'clamp',
                  });
                  return (
                    <Animated.View style={{ transform: [{ translateX: trans }], width: 220, flexDirection: 'row', height: '100%', paddingLeft: 5, backgroundColor: colors.surfaceStrong }}>
                      <ActionBtn
                        icon={<Plus />}
                        label="Add"
                        onPress={() => onAddSubtopic(st, t)}
                      />
                      <ActionBtn
                        icon={<FolderInput />}
                        label="Move"
                        onPress={() => onMoveSubtopic(st, t)}
                      />
                      <ActionBtn
                        icon={<Edit2 />}
                        label="Rename"
                        onPress={() => onRenameSubtopic(st, t)}
                      />
                      <ActionBtn
                        icon={<Trash2 />}
                        label="Delete"
                        onPress={() => onDeleteSubtopic(st, t)}
                      />
                    </Animated.View>
                  );
                }}
                friction={1.5}
                rightThreshold={30}
              >
                <TouchableOpacity
                  onPress={() => handleSelectSubtopic(st.id)}
                  onLongPress={() => handleSubtopicLongPress ? handleSubtopicLongPress(st, t, subjectLabel) : null}
                  style={[
                    styles.subtopicRow,
                    isSelectedSub ? { backgroundColor: '#F9FAFB' } : null,
                    { flexDirection: 'row', alignItems: 'center' }
                  ]}
                >
                  <SubIconComponent size={13} color={colors.textSecondary} style={{ marginRight: 6, opacity: 0.75 }} />
                  <Text style={{ flex: 1, fontSize: 12, color: isSelectedSub ? colors.textPrimary : colors.textSecondary, fontWeight: isSelectedSub ? '600' : '400' }}>
                    {st.label}
                  </Text>
                </TouchableOpacity>
              </Swipeable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function CollapsibleSubjectItem({
  s,
  state,
  colors,
  isExpanded,
  toggleSubjectExpanded,
  handleSelectSubject,
  getTopicsForSubject,
  expanded,
  handleSelectTopic,
  handleSelectSubtopic,
  onAddSubject,
  onRenameSubject,
  onDeleteSubject,
  onMoveSubject,
  onAddTopic,
  onRenameTopic,
  onDeleteTopic,
  onMoveTopic,
  onAddSubtopic,
  onRenameSubtopic,
  onDeleteSubtopic,
  onMoveSubtopic,
  handleSubjectLongPress,
  isFocused,
  onClearFocus,
}: {
  s: any;
  state: any;
  colors: any;
  isExpanded: boolean;
  toggleSubjectExpanded: (subjId: string) => void;
  handleSelectSubject: (subjId: string) => void;
  getTopicsForSubject: (subjId: string) => any[];
  expanded: string[];
  handleSelectTopic: (topicId: string, hasSub: boolean) => void;
  handleSelectSubtopic: (subtopicId: string) => void;
  onAddSubject: (s: any) => void;
  onRenameSubject: (s: any) => void;
  onDeleteSubject: (s: any) => void;
  onMoveSubject: (s: any) => void;
  onAddTopic: (t: any) => void;
  onRenameTopic: (t: any) => void;
  onDeleteTopic: (t: any) => void;
  onMoveTopic: (t: any) => void;
  onAddSubtopic: (st: any, t: any) => void;
  onRenameSubtopic: (st: any, t: any) => void;
  onDeleteSubtopic: (st: any, t: any) => void;
  onMoveSubtopic: (st: any, t: any) => void;
  handleSubjectLongPress?: (subject: any) => void;
  isFocused?: boolean;
  onClearFocus?: () => void;
}) {
  // Use s.icon if available; otherwise derive from the subject label.
  const iconKey = s.icon || iconForSubject(s.label || '');
  const Icon = SUBJECT_ICONS[iconKey] || Book;
  const isSelectedSubject = state.view.selectedSubject === s.id && (state.view.mode === 'subject' || (state.view.mode === 'noteList' && !state.view.selectedSubtopic));
  const topics = getTopicsForSubject(s.id);

  return (
    <View style={{ marginBottom: 4 }}>
      <Swipeable
        renderRightActions={(progress, dragX) => {
          const trans = dragX.interpolate({
            inputRange: [-220, 0],
            outputRange: [0, 220],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View style={{ transform: [{ translateX: trans }], width: 220, flexDirection: 'row', height: '100%', paddingLeft: 5, marginVertical: 1, backgroundColor: colors.surfaceStrong }}>
              <ActionBtn
                icon={<FolderPlus />}
                label="Add"
                onPress={() => onAddSubject(s)}
              />
              <ActionBtn
                icon={<FolderInput />}
                label="Move"
                onPress={() => onMoveSubject(s)}
              />
              <ActionBtn
                icon={<Edit2 />}
                label="Rename"
                onPress={() => onRenameSubject(s)}
              />
              <ActionBtn
                icon={<Trash2 />}
                label="Delete"
                onPress={() => onDeleteSubject(s)}
              />
            </Animated.View>
          );
        }}
        friction={1.5}
        rightThreshold={30}
      >
        <TouchableOpacity
          testID={`pilot-v2-subject-${s.id}`}
          activeOpacity={0.7}
          onPress={() => handleSelectSubject(s.id)}
          onLongPress={() => handleSubjectLongPress ? handleSubjectLongPress(s) : null}
          style={[
            styles.subjectRow,
            isSelectedSubject ? { backgroundColor: '#F3F4F6' } : null,
            isFocused ? { paddingLeft: 8 } : null,
          ]}
        >
          {isFocused && onClearFocus && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                onClearFocus();
              }}
              style={{ padding: 10, marginRight: -2 }}
            >
              <ChevronLeft size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={[styles.subjectIcon, { backgroundColor: s.bg }]}>
            <Icon size={16} color={s.text} />
          </View>
          <Text style={[styles.subjectText, { color: colors.textPrimary, fontWeight: isSelectedSubject ? '600' : '500' }]}>
            {s.label}
          </Text>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              toggleSubjectExpanded(s.id);
            }}
            style={{ padding: 6 }}
          >
            <View style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}>
              <ChevronDown size={16} color={colors.textTertiary} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Swipeable>

      {isExpanded && (
        <View style={{ paddingLeft: 16, marginTop: 4, marginBottom: 4 }}>
          {topics.map((t, idx) => (
            <CollapsibleTopicItem
              key={t.id}
              t={t}
              idx={idx}
              subjectLabel={s.label}
              isExpanded={expanded.includes(t.id)}
              state={state}
              colors={colors}
              handleSelectTopic={handleSelectTopic}
              handleSelectSubtopic={handleSelectSubtopic}
              onAddTopic={onAddTopic}
              onRenameTopic={onRenameTopic}
              onDeleteTopic={onDeleteTopic}
              onMoveTopic={onMoveTopic}
              onAddSubtopic={onAddSubtopic}
              onRenameSubtopic={onRenameSubtopic}
              onDeleteSubtopic={onDeleteSubtopic}
              onMoveSubtopic={onMoveSubtopic}
            />
          ))}
        </View>
      )}
    </View>
  );
}

interface PilotV2SidebarProps {
  mode: 'home' | 'subject';
}

export function PilotV2Sidebar({ mode }: PilotV2SidebarProps) {
  return <PilotV2SidebarHome />;
}

function PilotV2SidebarHome() {
  const { colors } = useTheme();
  const { state, dispatch } = usePilotV2();
  const { signOut, session } = useAuth();
  const activeFilter = state.view.mode === 'dashboard' ? state.view.quickFilter : 'none';
  const [newSubjectModal, setNewSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  const [newTopicModal, setNewTopicModal] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');
  const [targetSubject, setTargetSubject] = useState<any>(null);

  const [newSubtopicModal, setNewSubtopicModal] = useState(false);
  const [newSubtopicName, setNewSubtopicName] = useState('');
  const [targetTopic, setTargetTopic] = useState<{ id: string; label: string; subjectLabel: string } | null>(null);

  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [targetRenameNode, setTargetRenameNode] = useState<any>(null);
  const [moveModalVisible, setMoveModalVisible] = useState(false);
  const [targetMoveNode, setTargetMoveNode] = useState<NodeToMove | null>(null);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['fundamental-rights']);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const [subjectPositions, setSubjectPositions] = useState<Record<string, number>>({});

  const focusedSubject = state.view.focusedSubject;



  const selectedSubjectId = state.view.selectedSubject;
  const subjectsList = useMemo(() => {
    const list = [...PILOT_V2_SUBJECT_PALETTE];
    state.notes.forEach(note => {
      if (!note.subject || note.is_archived) return;
      const subjectName = note.subject;
      const exists = list.some(s => s.label.toLowerCase() === subjectName.toLowerCase());
      if (!exists) {
        list.push({
          id: subjectName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          label: subjectName,
          icon: iconForSubject(subjectName),
          bg: '#F3F4F6',
          text: '#4B5563',
        });
      }
    });
    return list;
  }, [state.notes]);

  const activeSubjectMeta = useMemo(
    () => subjectsList.find(s => s.id === selectedSubjectId),
    [selectedSubjectId, subjectsList]
  );

  const getTopicsForSubject = useCallback((subjId: string) => {
    const subjMeta = subjectsList.find(s => s.id === subjId);
    if (!subjMeta) return [];

    const staticTopics = SUBJECT_TOPICS[subjId] ?? [];
    const list = [...staticTopics.map(t => ({ ...t, subtopics: t.subtopics ? [...t.subtopics] : [] }))];

    const activeNotes = state.notes.filter(n =>
      !n.is_archived && n.subject && n.subject.toLowerCase() === subjMeta.label.toLowerCase()
    );

    activeNotes.forEach(note => {
      if (!note.topic) return;
      const topicLabel = note.topic;

      let topicObj = list.find(t => t.label.toLowerCase() === topicLabel.toLowerCase());
      if (!topicObj) {
        topicObj = {
          id: topicLabel.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          label: topicLabel,
          subtopics: []
        };
        list.push(topicObj);
      }

      if (note.subtopic) {
        const subtopicLabel = note.subtopic;
        const hasSub = topicObj.subtopics?.some(st => st.label.toLowerCase() === subtopicLabel.toLowerCase());
        if (!hasSub) {
          topicObj.subtopics?.push({
            id: subtopicLabel,
            label: subtopicLabel
          });
        }
      }
    });

    return list;
  }, [state.notes, subjectsList]);

  const toggleTopic = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectTopic = (topicId: string, hasSubtopics: boolean) => {
    if (hasSubtopics) {
      if (state.view.selectedTopic === topicId) {
        // Already on this topic — show topic-level notes (clear subtopic filter)
        dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
        dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
        // Also toggle sidebar expansion
        toggleTopic(topicId);
      } else {
        dispatch({ type: 'SET_QUICK_FILTER', payload: 'home' });
        dispatch({ type: 'SET_SELECTED_TOPIC', payload: topicId });
        dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
        dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
      }
    } else {
      dispatch({ type: 'SET_QUICK_FILTER', payload: 'home' });
      dispatch({ type: 'SET_SELECTED_TOPIC', payload: topicId });
      dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: topicId });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
    }
  };

  const handleSelectSubtopic = (subtopicId: string) => {
    dispatch({ type: 'SET_QUICK_FILTER', payload: 'home' });
    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: subtopicId });
    dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
  };

  const toggleSubjectExpanded = (subjId: string) => {
    setExpandedSubjects(prev => {
      const isCurrentlyExpanded = prev.includes(subjId);
      const newExpanded = isCurrentlyExpanded ? prev.filter(id => id !== subjId) : [...prev, subjId];
      
      // Auto-scroll to expanded subject (only on expand, not collapse)
      if (!isCurrentlyExpanded && subjectPositions[subjId] !== undefined) {
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: Math.max(0, subjectPositions[subjId] - 60),
            animated: false,
          });
        }, 100);
      }
      
      return newExpanded;
    });
  };

  const handleSelectSubject = (subjectId: string) => {
    if (state.view.selectedSubject === subjectId) {
      // Already on this subject — show subject-level notes (clear topic/subtopic filters)
      dispatch({ type: 'SET_SELECTED_TOPIC', payload: null });
      dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
    } else {
      dispatch({ type: 'SET_QUICK_FILTER', payload: 'home' });
      dispatch({ type: 'SET_SELECTED_SUBJECT', payload: subjectId });
      dispatch({ type: 'SET_SELECTED_TOPIC', payload: null });
      dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
      if (!expandedSubjects.includes(subjectId)) {
        setExpandedSubjects(prev => [...prev, subjectId]);
      }
    }
  };

  const handleQuickNav = (filter: PilotV2QuickFilter) => {
    dispatch({ type: 'SET_QUICK_FILTER', payload: filter });
    dispatch({ type: 'SET_SELECTED_SUBJECT', payload: null });
    dispatch({ type: 'SET_SELECTED_TOPIC', payload: null });
    dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
    if (filter === 'trash') {
      dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
    } else {
      dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' });
    }
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

  const handleSubjectLongPress = (s: any) => {
    Alert.alert(
      `Subject Options`,
      `Manage subject "${s.label}":`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Add Topic', 
          onPress: () => {
            setTargetSubject(s);
            setNewTopicName('');
            setNewTopicModal(true);
          } 
        },
        { 
          text: 'Rename Subject', 
          onPress: () => {
            setTargetRenameNode({ id: s.id, type: 'subject', label: s.label });
            setRenameValue(s.label);
            setRenameModal(true);
          }
        },
        { 
          text: 'Delete Subject', 
          style: 'destructive',
          onPress: () => promptDeleteSubject(s) 
        }
      ]
    );
  };

  const promptDeleteSubject = (s: any) => {
    Alert.alert(
      `Delete Subject`,
      `Are you sure you want to delete the subject "${s.label}" and all its topics and notes? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => executeSubjectDeletion(s) }
      ]
    );
  };

  const executeSubjectDeletion = async (s: any) => {
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to delete subjects.');
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { fetchAllPilotV2Nodes, archivePilotV2Node, fetchPilotV2NotesForUser } = await import('../../repositories/pilotV2Repo');
      const nodes = await fetchAllPilotV2Nodes(session.user.id);
      const subjectNode = nodes.find(
        n => n.type === 'subject' && (n.id === s.id || n.title.toLowerCase() === s.label.toLowerCase())
      );

      if (subjectNode) {
        await archivePilotV2Node(subjectNode.id);
        const archiveChildren = async (parentId: string) => {
          const children = nodes.filter(n => n.parent_id === parentId);
          for (const child of children) {
            await archivePilotV2Node(child.id);
            await archiveChildren(child.id);
          }
        };
        await archiveChildren(subjectNode.id);
      } else {
        const subjectNotes = state.notes.filter(
          n => n.subject && n.subject.toLowerCase() === s.label.toLowerCase()
        );
        for (const note of subjectNotes) {
          const noteNode = nodes.find(nd => nd.note_id === note.id);
          if (noteNode) {
            await archivePilotV2Node(noteNode.id);
          }
        }
      }

      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });

      if (state.view.selectedSubject === s.id) {
        dispatch({ type: 'SET_SELECTED_SUBJECT', payload: null });
        dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' });
      }
      Alert.alert('Success', `Subject "${s.label}" has been deleted.`);
    } catch (err) {
      Alert.alert('Error', `Could not delete subject: ${(err as Error).message}`);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleMoveSuccess = async () => {
    if (!session?.user?.id) return;
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });
      Alert.alert('Success', 'Item moved successfully.');
    } catch (err) {
      console.warn('[Sidebar] Failed to refresh notes post-move:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const submitNewTopic = async () => {
    const topName = newTopicName.trim();
    if (!topName || !targetSubject) return;
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to create topics.');
      return;
    }
    setCreating(true);
    try {
      const title = `Untitled notebook · ${new Date().toLocaleString([], { month: 'short', day: 'numeric' })}`;
      const { findOrCreatePilotV2Note, fetchPilotV2NotesForUser } = await import('../../repositories/pilotV2Repo');
      const result = await findOrCreatePilotV2Note({
        userId: session.user.id,
        subject: targetSubject.label,
        topic: topName,
        subtopic: null,
        title,
      });
      if (!result) throw new Error('Failed to create topic');
      
      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });

      if (!expandedSubjects.includes(targetSubject.id)) {
        setExpandedSubjects(prev => [...prev, targetSubject.id]);
      }
      setNewTopicModal(false);
    } catch (err) {
      Alert.alert('Error', `Could not create topic: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const submitNewSubtopic = async () => {
    const subName = newSubtopicName.trim();
    if (!subName || !targetTopic) return;
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to create subtopics.');
      return;
    }
    setCreating(true);
    try {
      const title = `Untitled notebook · ${new Date().toLocaleString([], { month: 'short', day: 'numeric' })}`;
      const { findOrCreatePilotV2Note, fetchPilotV2NotesForUser } = await import('../../repositories/pilotV2Repo');
      const result = await findOrCreatePilotV2Note({
        userId: session.user.id,
        subject: targetTopic.subjectLabel,
        topic: targetTopic.label,
        subtopic: subName,
        title,
      });
      if (!result) throw new Error('Failed to create node');

      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });

      const topicId = targetTopic.id || targetTopic.label.toLowerCase().replace(/[^a-z0-9]/g, '-');
      if (!expanded.includes(topicId)) {
        setExpanded(prev => [...prev, topicId]);
      }
      setNewSubtopicModal(false);
    } catch (err) {
      Alert.alert('Error', `Could not create subtopic: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const handleTopicLongPress = (t: any, subjectLabel: string) => {
    Alert.alert(
      `Topic Options`,
      `Manage topic "${t.label}":`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add Subtopic',
          onPress: () => {
            setTargetTopic({ id: t.id, label: t.label, subjectLabel });
            setNewSubtopicName('');
            setNewSubtopicModal(true);
          },
        },
        {
          text: 'Rename Topic',
          onPress: () => {
            setTargetRenameNode({ id: t.id, type: 'topic', label: t.label, subjectLabel });
            setRenameValue(t.label);
            setRenameModal(true);
          }
        },
        {
          text: 'Delete Topic',
          style: 'destructive',
          onPress: () => promptDeleteTopic(t, subjectLabel),
        },
      ]
    );
  };

  const promptDeleteTopic = (t: any, subjectLabel: string) => {
    Alert.alert(
      `Delete Topic`,
      `Are you sure you want to delete the topic "${t.label}" and all its subtopics and notes? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => executeTopicDeletion(t, subjectLabel) }
      ]
    );
  };

  const executeTopicDeletion = async (t: any, subjectLabel: string) => {
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to delete topics.');
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { fetchAllPilotV2Nodes, archivePilotV2Node, fetchPilotV2NotesForUser } = await import('../../repositories/pilotV2Repo');
      const nodes = await fetchAllPilotV2Nodes(session.user.id);
      const subjectNode = nodes.find(
        n => n.type === 'subject' && n.title.toLowerCase() === subjectLabel.toLowerCase()
      );

      const topicNode = nodes.find(
        n => n.type === 'topic' &&
             (n.id === t.id || n.title.toLowerCase() === t.label.toLowerCase()) &&
             (!subjectNode || n.parent_id === subjectNode.id)
      );

      if (topicNode) {
        await archivePilotV2Node(topicNode.id);
        const archiveChildren = async (parentId: string) => {
          const children = nodes.filter(n => n.parent_id === parentId);
          for (const child of children) {
            await archivePilotV2Node(child.id);
            await archiveChildren(child.id);
          }
        };
        await archiveChildren(topicNode.id);
      } else {
        const topicNotes = state.notes.filter(
          n => n.subject && n.subject.toLowerCase() === subjectLabel.toLowerCase() &&
               n.topic && n.topic.toLowerCase() === t.label.toLowerCase()
        );
        for (const note of topicNotes) {
          const noteNode = nodes.find(nd => nd.note_id === note.id);
          if (noteNode) {
            await archivePilotV2Node(noteNode.id);
          }
        }
      }

      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });

      if (state.view.selectedTopic === t.id) {
        dispatch({ type: 'SET_SELECTED_TOPIC', payload: null });
        dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
        dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' });
      }
      Alert.alert('Success', `Topic "${t.label}" has been deleted.`);
    } catch (err) {
      Alert.alert('Error', `Could not delete topic: ${(err as Error).message}`);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSubtopicLongPress = (st: any, t: any, subjectLabel: string) => {
    Alert.alert(
      `Subtopic Options`,
      `Manage subtopic "${st.label}":`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Add Notebook', 
          onPress: () => addNewNoteToSubtopic(subjectLabel, t.label, st.label) 
        },
        { 
          text: 'Rename Subtopic', 
          onPress: () => {
            setTargetRenameNode({ id: st.id, type: 'subtopic', label: st.label, subjectLabel, topicLabel: t.label });
            setRenameValue(st.label);
            setRenameModal(true);
          } 
        },
        {
          text: 'Delete Subtopic',
          style: 'destructive',
          onPress: () => promptDeleteSubtopic(st, t, subjectLabel)
        }
      ]
    );
  };

  const promptDeleteSubtopic = (st: any, t: any, subjectLabel: string) => {
    Alert.alert(
      `Delete Subtopic`,
      `Are you sure you want to delete the subtopic "${st.label}" and all its notes? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => executeSubtopicDeletion(st, t, subjectLabel) }
      ]
    );
  };

  const executeSubtopicDeletion = async (st: any, t: any, subjectLabel: string) => {
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to delete subtopics.');
      return;
    }
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const { fetchAllPilotV2Nodes, archivePilotV2Node, fetchPilotV2NotesForUser } = await import('../../repositories/pilotV2Repo');
      const nodes = await fetchAllPilotV2Nodes(session.user.id);
      const subjectNode = nodes.find(
        n => n.type === 'subject' && n.title.toLowerCase() === subjectLabel.toLowerCase()
      );

      const topicNode = nodes.find(
        n => n.type === 'topic' &&
             (n.id === t.id || n.title.toLowerCase() === t.label.toLowerCase()) &&
             (!subjectNode || n.parent_id === subjectNode.id)
      );

      const subtopicNode = nodes.find(
        n => n.type === 'subtopic' &&
             (n.id === st.id || n.title.toLowerCase() === st.label.toLowerCase()) &&
             (!topicNode || n.parent_id === topicNode.id)
      );

      if (subtopicNode) {
        await archivePilotV2Node(subtopicNode.id);
        const archiveChildren = async (parentId: string) => {
          const children = nodes.filter(n => n.parent_id === parentId);
          for (const child of children) {
            await archivePilotV2Node(child.id);
            await archiveChildren(child.id);
          }
        };
        await archiveChildren(subtopicNode.id);
      } else {
        const subtopicNotes = state.notes.filter(
          n => n.subject && n.subject.toLowerCase() === subjectLabel.toLowerCase() &&
               n.topic && n.topic.toLowerCase() === t.label.toLowerCase() &&
               n.subtopic && n.subtopic.toLowerCase() === st.label.toLowerCase()
        );
        for (const note of subtopicNotes) {
          const noteNode = nodes.find(nd => nd.note_id === note.id);
          if (noteNode) {
            await archivePilotV2Node(noteNode.id);
          }
        }
      }

      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });

      if (state.view.selectedSubtopic === st.id) {
        dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
        dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' });
      }
      Alert.alert('Success', `Subtopic "${st.label}" has been deleted.`);
    } catch (err) {
      Alert.alert('Error', `Could not delete subtopic: ${(err as Error).message}`);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const addNewNoteToSubtopic = async (subjectLabel: string, topicLabel: string, subtopicLabel: string) => {
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to create notebooks.');
      return;
    }
    setCreating(true);
    try {
      const title = `Untitled notebook · ${new Date().toLocaleString([], { month: 'short', day: 'numeric' })}`;
      const { findOrCreatePilotV2Note, fetchPilotV2NotesForUser } = await import('../../repositories/pilotV2Repo');
      const result = await findOrCreatePilotV2Note({
        userId: session.user.id,
        subject: subjectLabel,
        topic: topicLabel,
        subtopic: subtopicLabel,
        title,
      });
      if (!result) throw new Error('Failed to create note');
      
      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });
      Alert.alert('Success', `Notebook seeded inside "${subtopicLabel}".`);
    } catch (err) {
      Alert.alert('Error', `Could not create notebook: ${(err as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  const submitRenameNode = async () => {
    const val = renameValue.trim();
    if (!val || !targetRenameNode) return;
    if (!session?.user?.id) {
      Alert.alert('Sign in required', 'Please sign in to rename items.');
      return;
    }
    setCreating(true);
    try {
      const { renamePilotV2Node, fetchAllPilotV2Nodes, fetchPilotV2NotesForUser } = await import('../../repositories/pilotV2Repo');
      const nodes = await fetchAllPilotV2Nodes(session.user.id);
      let dbNode = null;

      if (targetRenameNode.type === 'subject') {
        dbNode = nodes.find(n => n.type === 'subject' && (n.id === targetRenameNode.id || n.title.toLowerCase() === targetRenameNode.label.toLowerCase()));
      } else if (targetRenameNode.type === 'topic') {
        const parentSubjectNode = nodes.find(n => n.type === 'subject' && n.title.toLowerCase() === targetRenameNode.subjectLabel.toLowerCase());
        dbNode = nodes.find(n => n.type === 'topic' && (n.id === targetRenameNode.id || n.title.toLowerCase() === targetRenameNode.label.toLowerCase()) && (!parentSubjectNode || n.parent_id === parentSubjectNode.id));
      } else if (targetRenameNode.type === 'subtopic') {
        const parentSubjectNode = nodes.find(n => n.type === 'subject' && n.title.toLowerCase() === targetRenameNode.subjectLabel.toLowerCase());
        const parentTopicNode = nodes.find(n => n.type === 'topic' && n.title.toLowerCase() === targetRenameNode.topicLabel.toLowerCase() && (!parentSubjectNode || n.parent_id === parentSubjectNode.id));
        dbNode = nodes.find(n => n.type === 'subtopic' && (n.id === targetRenameNode.id || n.title.toLowerCase() === targetRenameNode.label.toLowerCase()) && (!parentTopicNode || n.parent_id === parentTopicNode.id));
      }

      if (dbNode) {
        const success = await renamePilotV2Node(dbNode.id, val);
        if (!success) throw new Error('Database update failure');
      } else {
        const { ensurePilotV2SubjectNode, ensurePilotV2TopicNode, ensurePilotV2SubtopicNode } = await import('../../repositories/pilotV2Repo');
        if (targetRenameNode.type === 'subject') {
          const provisioned = await ensurePilotV2SubjectNode(session.user.id, targetRenameNode.label);
          if (provisioned) await renamePilotV2Node(provisioned.id, val);
        } else if (targetRenameNode.type === 'topic') {
          const provisioned = await ensurePilotV2TopicNode(session.user.id, targetRenameNode.subjectLabel, targetRenameNode.label);
          if (provisioned) await renamePilotV2Node(provisioned.id, val);
        } else if (targetRenameNode.type === 'subtopic') {
          const provisioned = await ensurePilotV2SubtopicNode(session.user.id, targetRenameNode.subjectLabel, targetRenameNode.topicLabel, targetRenameNode.label);
          if (provisioned) await renamePilotV2Node(provisioned.id, val);
        }
      }

      const fresh = await fetchPilotV2NotesForUser(session.user.id);
      dispatch({ type: 'SET_NOTES', payload: fresh });
      setRenameModal(false);
    } catch (err) {
      Alert.alert('Error', `Could not rename: ${(err as Error).message}`);
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

      {/* Fixed search bar like in Notability -> Extracted above ScrollView */}
      <View style={[styles.sbContainer, { paddingTop: 16 }]}>
        <View style={[styles.sbBox, { backgroundColor: '#F3F4F6', borderColor: colors.border }]}>
          <Search size={13} color={colors.textTertiary} />
          <TextInput
            testID="pilot-v2-sidebar-search"
            value={state.view.search}
            onChangeText={(text) => dispatch({ type: 'SET_SEARCH', payload: text })}
            style={[styles.sbInput, { color: colors.textPrimary }]}
            placeholder="Search..."
            placeholderTextColor={colors.textTertiary}
          />
          {state.view.search.length > 0 && (
            <TouchableOpacity onPress={() => dispatch({ type: 'SET_SEARCH', payload: '' })} hitSlop={6}>
              <X size={13} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView ref={scrollViewRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Quick nav — animated slide-up when focusedSubject is set */}
        {!focusedSubject && (
          <View style={{ paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4 }}>
            <NavRow active={activeFilter === 'home'}    label="Home"           Icon={HomeIcon} colors={colors} testID="pilot-v2-nav-home"    onPress={() => handleQuickNav('home')} />
            <NavRow active={activeFilter === 'pinned'}  label="Pinned"         Icon={Pin}      colors={colors} testID="pilot-v2-nav-pinned"  onPress={() => handleQuickNav('pinned')} />
            <NavRow active={activeFilter === 'recent'}  label="Recent"         Icon={Clock}    colors={colors} testID="pilot-v2-nav-recent"  onPress={() => handleQuickNav('recent')} />
            <NavRow active={activeFilter === 'trash'}   label="Trash"          Icon={Trash2}   colors={colors} testID="pilot-v2-nav-trash"   onPress={() => handleQuickNav('trash')} />
          </View>
        )}

        {!focusedSubject && <View style={[styles.divider, { backgroundColor: colors.border }]} />}

        {/* Subjects */}
        <View style={{ paddingHorizontal: 12, paddingVertical: 16 }}>
          {!focusedSubject && (
            <Text style={[styles.sectionLabel, { color: colors.textTertiary, paddingHorizontal: 16 }]}>SUBJECTS</Text>
          )}
          {subjectsList
            .filter(s => !focusedSubject || s.id === focusedSubject)
            .map((s, idx) => (
            <View
              key={s.id}
              onLayout={(e) => {
                const y = e.nativeEvent.layout.y;
                setSubjectPositions(prev => ({
                  ...prev,
                  [s.id]: y,
                }));
              }}
            >
              <CollapsibleSubjectItem
                s={s}
                state={state}
                colors={colors}
                isExpanded={expandedSubjects.includes(s.id)}
                toggleSubjectExpanded={toggleSubjectExpanded}
                handleSelectSubject={handleSelectSubject}
                getTopicsForSubject={getTopicsForSubject}
                expanded={expanded}
                handleSelectTopic={handleSelectTopic}
                handleSelectSubtopic={handleSelectSubtopic}
                isFocused={focusedSubject === s.id}
                onClearFocus={() => dispatch({ type: 'SET_FOCUSED_SUBJECT', payload: null })}
                onAddSubject={(subject) => {
                  setTargetSubject(subject);
                  setNewTopicName('');
                  setNewTopicModal(true);
                }}
                onRenameSubject={(subject) => {
                  setTargetRenameNode({ id: subject.id, type: 'subject', label: subject.label });
                  setRenameValue(subject.label);
                  setRenameModal(true);
                }}
                onDeleteSubject={(subject) => promptDeleteSubject(subject)}
                onMoveSubject={(subject) => {
                  Alert.alert('Root Folder', 'Top-level Subjects are root folders and cannot be nested.');
                }}
                onAddTopic={(topic) => {
                  setTargetTopic({ ...topic, subjectLabel: s.label });
                  setNewSubtopicName('');
                  setNewSubtopicModal(true);
                }}
                onRenameTopic={(topic) => {
                  setTargetRenameNode({ id: topic.id, type: 'topic', label: topic.label, subjectLabel: s.label });
                  setRenameValue(topic.label);
                  setRenameModal(true);
                }}
                onDeleteTopic={(topic) => promptDeleteTopic(topic, s.label)}
                onMoveTopic={(topic) => {
                  setTargetMoveNode({ id: topic.id, type: 'topic', label: topic.label, currentParentLabel: s.label });
                  setMoveModalVisible(true);
                }}
                onAddSubtopic={(st, t) => addNewNoteToSubtopic(s.label, t.label, st.label)}
                onRenameSubtopic={(st, t) => {
                  setTargetRenameNode({ id: st.id, type: 'subtopic', label: st.label, subjectLabel: s.label, topicLabel: t.label });
                  setRenameValue(st.label);
                  setRenameModal(true);
                }}
                onDeleteSubtopic={(st, t) => promptDeleteSubtopic(st, t, s.label)}
                onMoveSubtopic={(st, t) => {
                  setTargetMoveNode({ id: st.id, type: 'subtopic', label: st.label, currentParentLabel: t.label });
                  setMoveModalVisible(true);
                }}
                handleSubjectLongPress={handleSubjectLongPress}
              />
            </View>
          ))}

          {!focusedSubject && (
            <TouchableOpacity
              testID="pilot-v2-new-subject"
              activeOpacity={0.7}
              onPress={handleNewSubject}
              style={[styles.newSubjectRow]}
            >
              <Plus size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>New Subject</Text>
            </TouchableOpacity>
          )}
        </View>

      </ScrollView>

      {/* Footer completely removed to ensure subject lists have unrestricted top-to-bottom scroll visibility */}

      {/* New Subject modal — Step 24 */}
      <Modal
        visible={newSubjectModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNewSubjectModal(false)}
      >
        <View style={styles.nsBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => setNewSubjectModal(false)} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ width: '100%', alignItems: 'center', padding: 20 }}
          >
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
                  style={[styles.nsBtnPrimary, { backgroundColor: colors.primary, opacity: newSubjectName.trim() && !creating ? 1 : 0.5 }]}
                >
                  <Plus size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{creating ? 'Creating…' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* New Topic Modal */}
      <Modal
        visible={newTopicModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNewTopicModal(false)}
      >
        <View style={styles.nsBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => setNewTopicModal(false)} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ width: '100%', alignItems: 'center', padding: 20 }}
          >
            <View style={[styles.nsCard, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="pilot-v2-new-topic-modal">
              <View style={styles.nsHeader}>
                <Text style={[styles.nsTitle, { color: colors.textPrimary }]}>New Topic</Text>
                <TouchableOpacity onPress={() => setNewTopicModal(false)}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.nsHint, { color: colors.textTertiary }]}>
                Create a new topic folder inside "{targetSubject?.label}". This will seed an empty notebook inside it!
              </Text>
              <TextInput
                value={newTopicName}
                onChangeText={setNewTopicName}
                placeholder="e.g. Fundamental Rights"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={[styles.nsInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
                onSubmitEditing={submitNewTopic}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setNewTopicModal(false)}
                  style={[styles.nsBtnGhost, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitNewTopic}
                  disabled={!newTopicName.trim() || creating}
                  style={[styles.nsBtnPrimary, { backgroundColor: colors.primary, opacity: newTopicName.trim() && !creating ? 1 : 0.5 }]}
                >
                  <Plus size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{creating ? 'Creating…' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* New Subtopic Modal */}
      <Modal
        visible={newSubtopicModal}
        transparent
        animationType="fade"
        onRequestClose={() => setNewSubtopicModal(false)}
      >
        <View style={styles.nsBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => setNewSubtopicModal(false)} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ width: '100%', alignItems: 'center', padding: 20 }}
          >
            <View style={[styles.nsCard, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="pilot-v2-new-subtopic-modal">
              <View style={styles.nsHeader}>
                <Text style={[styles.nsTitle, { color: colors.textPrimary }]}>New Subtopic</Text>
                <TouchableOpacity onPress={() => setNewSubtopicModal(false)}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.nsHint, { color: colors.textTertiary }]}>
                Create a new nested folder inside "{targetTopic?.label}". This will seed an empty notebook inside it!
              </Text>
              <TextInput
                testID="pilot-v2-new-subtopic-input"
                value={newSubtopicName}
                onChangeText={setNewSubtopicName}
                placeholder="e.g. Case Studies"
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={[styles.nsInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
                onSubmitEditing={submitNewSubtopic}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setNewSubtopicModal(false)}
                  style={[styles.nsBtnGhost, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="pilot-v2-new-subtopic-submit"
                  onPress={submitNewSubtopic}
                  disabled={!newSubtopicName.trim() || creating}
                  style={[styles.nsBtnPrimary, { backgroundColor: colors.primary, opacity: newSubtopicName.trim() && !creating ? 1 : 0.5 }]}
                >
                  <Plus size={14} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{creating ? 'Creating…' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Universal Rename Modal */}
      <Modal
        visible={renameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModal(false)}
      >
        <View style={styles.nsBackdrop}>
          <TouchableOpacity activeOpacity={1} onPress={() => setRenameModal(false)} style={StyleSheet.absoluteFill} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={{ width: '100%', alignItems: 'center', padding: 20 }}
          >
            <View style={[styles.nsCard, { backgroundColor: colors.surface, borderColor: colors.border }]} testID="pilot-v2-rename-modal">
              <View style={styles.nsHeader}>
                <Text style={[styles.nsTitle, { color: colors.textPrimary }]}>Rename {targetRenameNode?.type ? targetRenameNode.type.charAt(0).toUpperCase() + targetRenameNode.type.slice(1) : 'Item'}</Text>
                <TouchableOpacity onPress={() => setRenameModal(false)}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.nsHint, { color: colors.textTertiary }]}>
                Enter a new label for this {targetRenameNode?.type}. This will update all matching views instantly!
              </Text>
              <TextInput
                value={renameValue}
                onChangeText={setRenameValue}
                placeholder="Updated label..."
                placeholderTextColor={colors.textTertiary}
                autoFocus
                style={[styles.nsInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
                onSubmitEditing={submitRenameNode}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setRenameModal(false)}
                  style={[styles.nsBtnGhost, { borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submitRenameNode}
                  disabled={!renameValue.trim() || creating}
                  style={[styles.nsBtnPrimary, { backgroundColor: colors.primary, opacity: renameValue.trim() && !creating ? 1 : 0.5 }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>{creating ? 'Saving…' : 'Save Change'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <PilotV2MoveModal
        visible={moveModalVisible}
        node={targetMoveNode}
        onClose={() => setMoveModalVisible(false)}
        onSuccess={handleMoveSuccess}
      />
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
        active ? { backgroundColor: '#F3F4F6' } : null,
      ]}
    >
      <Icon size={18} color={active ? colors.textPrimary : colors.textSecondary} />
      <Text
        style={{
          color: colors.textPrimary,
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
    width: 416,
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
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 48,
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 48,
  },
  subjectIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  subjectText: { flex: 1, fontSize: 14, fontWeight: '500' },
  newSubjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
    minHeight: 48,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
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
  topicRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10,
    minHeight: 44,
  },
  subtopicRow: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    minHeight: 40,
  },
  sbContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 4,
  },
  sbBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  sbInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0, // CRITICAL: fixes text-clipping/bleeding caused by padding+height conflict
    paddingHorizontal: 4,
    textAlignVertical: 'center',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
});
