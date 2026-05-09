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
import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Platform, LayoutAnimation, Animated } from 'react-native';
import {
  Home as HomeIcon, Pin, Clock, Share2, Trash2, Plus, Settings, ChevronRight, ChevronDown, ChevronLeft,
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical, Book, X, Search,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import { PILOT_V2_SUBJECT_PALETTE, PilotV2QuickFilter } from './types';
import { PilotV2SidebarSubject, SUBJECT_TOPICS } from './PilotV2SidebarSubject';
import { createPilotV2Node, archivePilotV2Node, fetchAllPilotV2Nodes, fetchPilotV2NotesForUser } from '../../repositories/pilotV2Repo';
import { Swipeable } from 'react-native-gesture-handler';

const SUBJECT_ICONS: Record<string, any> = {
  Landmark, TrendingUp, ScrollText, Globe2, Scale, Leaf, FlaskConical,
};

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
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string[]>(['fundamental-rights']);
  const [expandedSubjects, setExpandedSubjects] = useState<string[]>([]);

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
          icon: 'Book',
          bg: '#E9D5FF',
          text: '#7C3AED',
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
  }, [state.notes, subjectsList]);

  const toggleTopic = (id: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectTopic = (topicId: string, hasSubtopics: boolean) => {
    if (hasSubtopics) {
      if (state.view.selectedTopic === topicId) {
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
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedSubjects(prev =>
      prev.includes(subjId) ? prev.filter(id => id !== subjId) : [...prev, subjId]
    );
  };

  const handleSelectSubject = (subjectId: string) => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }

    if (state.view.selectedSubject === subjectId) {
      toggleSubjectExpanded(subjectId);
    } else {
      dispatch({ type: 'SET_QUICK_FILTER', payload: 'home' });
      dispatch({ type: 'SET_SELECTED_SUBJECT', payload: subjectId });
      dispatch({ type: 'SET_SELECTED_TOPIC', payload: null });
      dispatch({ type: 'SET_SELECTED_SUBTOPIC', payload: null });
      dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
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
      `Delete Subject`,
      `Are you sure you want to delete the subject "${s.label}" and all its topics and notes? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!session?.user?.id) {
              Alert.alert('Sign in required', 'Please sign in to delete subjects.');
              return;
            }
            dispatch({ type: 'SET_LOADING', payload: true });
            try {
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
          }
        }
      ]
    );
  };

  const handleTopicLongPress = (t: any, subjectLabel: string) => {
    Alert.alert(
      `Delete Topic`,
      `Are you sure you want to delete the topic "${t.label}" and all its subtopics and notes? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!session?.user?.id) {
              Alert.alert('Sign in required', 'Please sign in to delete topics.');
              return;
            }
            dispatch({ type: 'SET_LOADING', payload: true });
            try {
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
          }
        }
      ]
    );
  };

  const handleSubtopicLongPress = (st: any, t: any, subjectLabel: string) => {
    Alert.alert(
      `Delete Subtopic`,
      `Are you sure you want to delete the subtopic "${st.label}" and all its notes? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!session?.user?.id) {
              Alert.alert('Sign in required', 'Please sign in to delete subtopics.');
              return;
            }
            dispatch({ type: 'SET_LOADING', payload: true });
            try {
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
          }
        }
      ]
    );
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

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32, paddingTop: 16 }}>
        {/* Small search bar like in Notability */}
        <View style={styles.sbContainer}>
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

        {/* Quick nav */}
        <View style={{ paddingHorizontal: 12, paddingBottom: 8, paddingTop: 4 }}>
          <NavRow active={activeFilter === 'home'}    label="Home"           Icon={HomeIcon} colors={colors} testID="pilot-v2-nav-home"    onPress={() => handleQuickNav('home')} />
          <NavRow active={activeFilter === 'pinned'}  label="Pinned"         Icon={Pin}      colors={colors} testID="pilot-v2-nav-pinned"  onPress={() => handleQuickNav('pinned')} />
          <NavRow active={activeFilter === 'recent'}  label="Recent"         Icon={Clock}    colors={colors} testID="pilot-v2-nav-recent"  onPress={() => handleQuickNav('recent')} />
          <NavRow active={activeFilter === 'shared'}  label="Shared with me" Icon={Share2}   colors={colors} testID="pilot-v2-nav-shared"  onPress={() => handleQuickNav('shared')} />
          <NavRow active={activeFilter === 'trash'}   label="Trash"          Icon={Trash2}   colors={colors} testID="pilot-v2-nav-trash"   onPress={() => handleQuickNav('trash')} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Subjects */}
        <View style={{ paddingHorizontal: 12, paddingVertical: 16 }}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary, paddingHorizontal: 16 }]}>SUBJECTS</Text>
          {subjectsList.map((s, idx) => {
            const Icon = SUBJECT_ICONS[s.icon] ?? Book;
            const isSelectedSubject = state.view.selectedSubject === s.id && (state.view.mode === 'subject' || (state.view.mode === 'noteList' && !state.view.selectedSubtopic));

            return (
              <View key={`subject-${s.id}-${idx}`}>
                <Swipeable
                  renderRightActions={(progress, dragX) => {
                    const trans = dragX.interpolate({
                      inputRange: [-70, 0],
                      outputRange: [0, 70],
                      extrapolate: 'clamp',
                    });
                    return (
                      <Animated.View style={{ transform: [{ translateX: trans }], width: 70 }}>
                        <TouchableOpacity
                          onPress={() => handleSubjectLongPress(s)}
                          style={{
                            backgroundColor: '#ef4444',
                            justifyContent: 'center',
                            alignItems: 'center',
                            width: '100%',
                            height: '100%',
                            borderRadius: 12,
                            marginVertical: 1,
                          }}
                        >
                          <Trash2 size={20} color="#fff" />
                        </TouchableOpacity>
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
                    onLongPress={() => handleSubjectLongPress(s)}
                    style={[
                      styles.subjectRow,
                      isSelectedSubject ? { backgroundColor: '#F3F4F6' } : null,
                    ]}
                  >
                    <View style={[styles.subjectIcon, { backgroundColor: s.bg }]}>
                      <Icon size={16} color={s.text} />
                    </View>
                    <Text style={[styles.subjectText, { color: colors.textPrimary, fontWeight: isSelectedSubject ? '600' : '500' }]}>{s.label}</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        toggleSubjectExpanded(s.id);
                      }}
                      style={{ padding: 6 }}
                    >
                      <ChevronDown
                        size={16}
                        color={colors.textTertiary}
                        style={{ transform: [{ rotate: expandedSubjects.includes(s.id) ? '0deg' : '-90deg' }] }}
                      />
                    </TouchableOpacity>
                  </TouchableOpacity>
                </Swipeable>

                {expandedSubjects.includes(s.id) && (
                  <View style={{ paddingLeft: 16, marginTop: 4, marginBottom: 8 }}>
                    {getTopicsForSubject(s.id).map((t, idx) => {
                      const isExpanded = expanded.includes(t.id);
                      const isSelectedTopic = state.view.selectedTopic === t.id && state.view.mode === 'noteList';
                      const hasSub = !!t.subtopics?.length;

                      return (
                        <View key={`${s.id}-${t.id}-${idx}`}>
                          <Swipeable
                            renderRightActions={(progress, dragX) => {
                              const trans = dragX.interpolate({
                                inputRange: [-60, 0],
                                outputRange: [0, 60],
                                extrapolate: 'clamp',
                              });
                              return (
                                <Animated.View style={{ transform: [{ translateX: trans }], width: 60 }}>
                                  <TouchableOpacity
                                    onPress={() => handleTopicLongPress(t, s.label)}
                                    style={{
                                      backgroundColor: '#ef4444',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      width: '100%',
                                      height: '100%',
                                      borderRadius: 8,
                                    }}
                                  >
                                    <Trash2 size={16} color="#fff" />
                                  </TouchableOpacity>
                                </Animated.View>
                              );
                            }}
                            friction={1.5}
                            rightThreshold={30}
                          >
                            <TouchableOpacity
                              onPress={() => handleSelectTopic(t.id, hasSub)}
                              onLongPress={() => handleTopicLongPress(t, s.label)}
                              style={[
                                styles.topicRow,
                                isSelectedTopic ? { backgroundColor: '#EEECFF' } : null,
                              ]}
                            >
                              <Text style={{ color: colors.textTertiary, fontSize: 11, width: 22 }}>{idx + 1}.</Text>
                              <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: isSelectedTopic ? '#5B4EFA' : colors.textPrimary }}>
                                {t.label}
                              </Text>
                              {hasSub && (
                                <ChevronDown
                                  size={12}
                                  color={colors.textTertiary}
                                  style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}
                                />
                              )}
                            </TouchableOpacity>
                          </Swipeable>

                          {hasSub && isExpanded && (
                            <View style={{ paddingLeft: 22, marginTop: 2, gap: 2 }}>
                              {t.subtopics!.map((st, stIdx) => {
                                const isSelectedSub = state.view.selectedSubtopic === st.id && state.view.mode === 'noteList';
                                return (
                                  <View key={`${t.id}-${st.id}-${stIdx}`}>
                                    <Swipeable
                                      renderRightActions={(progress, dragX) => {
                                        const trans = dragX.interpolate({
                                          inputRange: [-50, 0],
                                          outputRange: [0, 50],
                                          extrapolate: 'clamp',
                                        });
                                        return (
                                          <Animated.View style={{ transform: [{ translateX: trans }], width: 50 }}>
                                            <TouchableOpacity
                                              onPress={() => handleSubtopicLongPress(st, t, s.label)}
                                              style={{
                                                backgroundColor: '#ef4444',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                width: '100%',
                                                height: '100%',
                                                borderRadius: 6,
                                              }}
                                            >
                                              <Trash2 size={14} color="#fff" />
                                            </TouchableOpacity>
                                          </Animated.View>
                                        );
                                      }}
                                      friction={1.5}
                                      rightThreshold={30}
                                    >
                                      <TouchableOpacity
                                        onPress={() => handleSelectSubtopic(st.id)}
                                        onLongPress={() => handleSubtopicLongPress(st, t, s.label)}
                                        style={[
                                          styles.subtopicRow,
                                          isSelectedSub ? { backgroundColor: '#EEECFF' } : null,
                                        ]}
                                      >
                                        <Text style={{ fontSize: 12, color: isSelectedSub ? '#5B4EFA' : colors.textSecondary, fontWeight: isSelectedSub ? '600' : '400' }}>
                                          {st.label}
                                        </Text>
                                      </TouchableOpacity>
                                    </Swipeable>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
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
        </View>

      </ScrollView>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16, backgroundColor: colors.surface }}>
        <TouchableOpacity testID="pilot-v2-settings" onPress={handleSettings} style={[styles.settingsRow, { flex: 1 }]}>
          <Settings size={18} color={colors.textSecondary} />
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: '500' }}>Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="pilot-v2-hide-sidebar"
          onPress={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          style={{ padding: 12, borderRadius: 8 }}
        >
          <ChevronLeft size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

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
    width: 320,
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
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
  },
  sbInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
    paddingHorizontal: 4,
    height: 34,
    textAlignVertical: 'center',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
});
