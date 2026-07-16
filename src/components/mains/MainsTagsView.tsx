import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Pressable,
  Alert,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useMainsTaggedVault, MainsTaggedQuestion } from '../../hooks/useMainsTaggedQuestions';
import {
  Search,
  Filter,
  LayoutGrid,
  List,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  BookOpen,
  Database,
  Layers,
  FolderOpen,
  MoreVertical,
  Plus,
  Pencil,
  Trash2,
  Check,
  Tag,
  PenTool,
  Scale,
  Scroll,
  TrendingUp,
  Globe,
  Leaf,
  Atom,
  Hash,
  Palette,
  Shield,
  Map as MapIcon,
  Heart,
  Users,
  Settings,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react-native';
import { normalizeTag, formatTagLabel } from '../../utils/tagUtils';
import Markdown from 'react-native-markdown-display';
import { getMarkdownStyles, getMarkdownRules, cleanMarkdownContent, ValueAdditionCard } from '../../../app/mains';
import { ValueAdditionItem } from '../../data/mainsValueAdditionLoader';
import { ConsolidatedQuestion } from '../../data/mainsConsolidatedLoader';
import { supabase } from '../../lib/supabase';

// Card for rendering subjective questions in the tags view
const MainsRepoQuestionCard = ({
  question,
  onUpdate,
  onOpenQuestionBank,
  colors,
}: {
  question: MainsTaggedQuestion;
  onUpdate?: () => void;
  onOpenQuestionBank: (q: MainsTaggedQuestion) => void;
  colors: any;
}) => {
  const { session } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [activeAnswerIdx, setActiveAnswerIdx] = useState(0);

  const handleRemoveTag = async (tag: string) => {
    if (!session?.user?.id) return;
    Alert.alert(
      'Remove Tag',
      `Remove tag "${tag}" from this question?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const nextTags = question.reviewTags.filter(t => normalizeTag(t) !== normalizeTag(tag));
              const { error } = await supabase
                .from('mains_question_states')
                .update({ review_tags: nextTags.length ? nextTags : null })
                .eq('user_id', session.user.id)
                .eq('question_id', question.id);
              
              if (error) throw error;
              if (onUpdate) onUpdate();
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceStrong + '10', borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        {/* Row 1: Badges + Show in QB button */}
        <View style={[styles.cardMetaRow, { justifyContent: 'space-between', width: '100%', marginBottom: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.paperBadge, { backgroundColor: colors.primary + '15' }]}>
              <Text style={[styles.paperBadgeText, { color: colors.primary }]}>
                {question.paper || 'GS'}
              </Text>
            </View>
            {question.year && (
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {question.year}
              </Text>
            )}
            {question.marks && (
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {question.marks} Marks
              </Text>
            )}
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => onOpenQuestionBank(question)}
            style={[styles.smallTopBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
          >
            <Database size={12} color={colors.primary} />
            <Text style={[styles.smallTopBtnText, { color: colors.primary }]}>
              Show in QB
            </Text>
          </TouchableOpacity>
        </View>

        {/* Row 2: Question Text (toggles expand) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setExpanded(!expanded)}
        >
          <Text style={[styles.questionText, { color: colors.textPrimary }]} numberOfLines={expanded ? undefined : 3}>
            {question.questionText}
          </Text>
        </TouchableOpacity>

        {/* Row 3: Tag chips (clicking them directly removes them, outside of the toggler) */}
        {question.reviewTags && question.reviewTags.length > 0 && (
          <View style={[styles.tagWrap, { marginTop: 4, marginBottom: 8 }]}>
            {question.reviewTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                activeOpacity={0.7}
                onPress={() => handleRemoveTag(tag)}
                style={[styles.tagChip, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
              >
                <Text style={[styles.tagChipText, { color: colors.primary }]}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Row 4: Expand toggle row */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setExpanded(!expanded)}
          style={styles.expandRow}
        >
          <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
            {expanded ? 'Hide Model Answers' : 'Show Model Answers'}
          </Text>
          {expanded ? (
            <ChevronDown size={16} color={colors.primary} />
          ) : (
            <ChevronRight size={16} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>

      {expanded && (
        <View style={[styles.cardExpanded, { borderTopColor: colors.border }]}>
          {question.answers.length === 0 ? (
            <Text style={{ color: colors.textTertiary, fontStyle: 'italic', padding: 12 }}>
              No model answers available.
            </Text>
          ) : (
            <View>
              {/* Answer Source Tabs */}
              <View style={styles.sourceSelector}>
                {question.answers.map((ans, idx) => (
                  <TouchableOpacity
                    key={ans.id}
                    onPress={() => setActiveAnswerIdx(idx)}
                    style={[
                      styles.sourceTab,
                      {
                        borderBottomColor: activeAnswerIdx === idx ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sourceTabText,
                        {
                          color: activeAnswerIdx === idx ? colors.primary : colors.textTertiary,
                          fontWeight: activeAnswerIdx === idx ? '700' : '400',
                        },
                      ]}
                    >
                      {ans.institute}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Markdown Rendered Answer Text */}
              <View style={styles.answerContent}>
                <Markdown
                  style={getMarkdownStyles(colors)}
                  rules={getMarkdownRules(colors, false)}
                >
                  {cleanMarkdownContent(question.answers[activeAnswerIdx]?.answerText || '')}
                </Markdown>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

export default function MainsTagsView({
  colors,
  isTablet,
  insets,
  onBack,
  onOpenDetailed,
  onOpenQuestionBank,
  valueAddItems = [],
  valueAddTags = {},
  onToggleValueAddTag,
  onCreateTag,
  userTags = [],
  questions = [],
}: {
  colors: any;
  isTablet: boolean;
  insets: any;
  onBack: () => void;
  onOpenDetailed: (q: MainsTaggedQuestion) => void;
  onOpenQuestionBank: (q: MainsTaggedQuestion) => void;
  valueAddItems?: ValueAdditionItem[];
  valueAddTags?: Record<string, string[]>;
  onToggleValueAddTag?: (cardId: string, tag: string) => void;
  onCreateTag?: (tag: string) => void;
  userTags?: string[];
  questions?: ConsolidatedQuestion[];
}) {
  const { isDark } = useTheme();
  const { session } = useAuth();
  const {
    loading,
    vaultData,
    allQuestions,
    uniqueTags: questionTags,
    filters,
    refresh,
    addTagToReview,
    renameTagGlobally,
    removeTagFromReview,
  } = useMainsTaggedVault(session?.user?.id, questions);

  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const handleCopy = (id: string, text: string) => {
    // use React Native clipboard
    try {
      const { Clipboard } = require('react-native');
      Clipboard.setString(text);
    } catch {}
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Local UI State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeSubject, setActiveSubject] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedMicroTopics, setExpandedMicroTopics] = useState<Record<string, boolean>>({});
  const [expandedSubTopics, setExpandedSubTopics] = useState<Record<string, boolean>>({});
  const [expandedNanoTopics, setExpandedNanoTopics] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(false);

  const hasAnyExpanded = Object.values(expandedSections).some(v => v) || Object.values(expandedMicroTopics).some(v => v);

  // Tag management state
  const [menuVisible, setMenuVisible] = useState(false);
  const [manageVisible, setManageVisible] = useState(false);
  const [newTagText, setNewTagText] = useState('');
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingTag, setSavingTag] = useState(false);

  const toggleSection = (secName: string) => {
    setExpandedSections((prev) => ({ ...prev, [secName]: !prev[secName] }));
  };

  const toggleMicroTopic = (topicKey: string) => {
    setExpandedMicroTopics((prev) => ({ ...prev, [topicKey]: !prev[topicKey] }));
  };

  const toggleExpandAll = (subjectData: any) => {
    const sections = subjectData ? Object.values(subjectData.sectionGroups) : [];
    
    if (hasAnyExpanded) {
      setExpandedSections({});
      setExpandedMicroTopics({});
      setExpandedSubTopics({});
      setExpandedNanoTopics({});
    } else {
      const nextSec: Record<string, boolean> = {};
      const nextMicro: Record<string, boolean> = {};
      const nextSub: Record<string, boolean> = {};
      const nextNano: Record<string, boolean> = {};
      
      sections.forEach((sec: any) => {
        nextSec[sec.name] = true;
        Object.values(sec.microTopics).forEach((topic: any) => {
          const microKey = `${sec.name}-${topic.name}`;
          nextMicro[microKey] = true;
          
          Object.values(topic.subTopics || {}).forEach((sub: any) => {
            const subKey = `${microKey}-${sub.name}`;
            nextSub[subKey] = true;
            
            Object.values(sub.nanoTopics || {}).forEach((nano: any) => {
              const nanoKey = `${subKey}-${nano.name}`;
              nextNano[nanoKey] = true;
            });
          });
        });
      });
      
      setExpandedSections(nextSec);
      setExpandedMicroTopics(nextMicro);
      setExpandedSubTopics(nextSub);
      setExpandedNanoTopics(nextNano);
    }
  };

  const addTag = async () => {
    if (!newTagText.trim()) return;
    setSavingTag(true);
    try {
      await addTagToReview(newTagText);
      setNewTagText('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingTag(false);
    }
  };

  const renameTag = async () => {
    if (!renamingTag || !renameValue.trim()) return;
    setSavingTag(true);
    try {
      const ok = await renameTagGlobally(renamingTag, renameValue.trim());
      if (ok) {
        setRenamingTag(null);
        setRenameValue('');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSavingTag(false);
    }
  };

  const removeTagEverywhere = async (tag: string) => {
    Alert.alert(
      'Remove Tag',
      `Are you sure you want to remove the tag "${tag}" from all Mains questions?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeTagFromReview(tag);
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  // Extended unique tags: combine question tags + value addition tags
  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    questionTags.forEach(t => tags.add(t));
    valueAddItems.forEach(item => {
      (valueAddTags[item.id] || []).forEach(t => tags.add(formatTagLabel(t)));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [questionTags, valueAddItems, valueAddTags]);

  // Count of tagged value additions
  const totalTaggedVAs = useMemo(() => {
    return valueAddItems.filter(item => (valueAddTags[item.id] || []).length > 0).length;
  }, [valueAddItems, valueAddTags]);

  // Combined vault data: merge questions + tagged value additions into Subject > Section > MicroTopic hierarchy
  const combinedVaultData = useMemo(() => {
    const normalizedSelectedTag = normalizeTag(filters.selectedTag);
    const normalizedSelectedSubject = (filters.selectedSubject || 'All');
    const searchQueryClean = (filters.searchQuery || '').trim().toLowerCase();

    // Filter questions (same logic as the hook, but we re-filter allQuestions here)
    const filteredQuestions = allQuestions.filter(q => {
      if (normalizedSelectedTag !== 'all') {
        const hasTag = (q.normalizedReviewTags || []).includes(normalizedSelectedTag);
        if (!hasTag) return false;
      }
      if (normalizedSelectedSubject !== 'All') {
        if (q.subject.toLowerCase() !== normalizedSelectedSubject.toLowerCase()) return false;
      }
      if (searchQueryClean) {
        const inText = q.questionText.toLowerCase().includes(searchQueryClean);
        const inSubject = q.subject.toLowerCase().includes(searchQueryClean);
        const inSec = q.sectionGroup.toLowerCase().includes(searchQueryClean);
        const inMicro = q.microTopic.toLowerCase().includes(searchQueryClean);
        if (!inText && !inSubject && !inSec && !inMicro) return false;
      }
      return true;
    });

    // Filter tagged value additions
    const filteredVAs = valueAddItems.filter(item => {
      const activeTags = valueAddTags[item.id] || [];
      if (activeTags.length === 0) return false;
      if (normalizedSelectedTag !== 'all') {
        const hasTag = activeTags.map(normalizeTag).includes(normalizedSelectedTag);
        if (!hasTag) return false;
      }
      if (normalizedSelectedSubject !== 'All') {
        if ((item.subject || '').toLowerCase() !== normalizedSelectedSubject.toLowerCase()) return false;
      }
      if (searchQueryClean) {
        const inTitle = (item.title || item.metric || '').toLowerCase().includes(searchQueryClean);
        const inSubject = (item.subject || '').toLowerCase().includes(searchQueryClean);
        const inSec = (item.sectionGroup || '').toLowerCase().includes(searchQueryClean);
        const inMicro = (item.microtopic || '').toLowerCase().includes(searchQueryClean);
        const inContent = (item.rawContent || '').toLowerCase().includes(searchQueryClean);
        if (!inTitle && !inSubject && !inSec && !inMicro && !inContent) return false;
      }
      return true;
    });

    // Build nested Subject > SectionGroup > MicroTopic > SubTopic > NanoTopic hierarchy
    const subjectsMap: Record<string, any> = {};

    const getOrCreateMicro = (subName: string, secName: string, microName: string) => {
      if (!subjectsMap[subName]) subjectsMap[subName] = { name: subName, totalCount: 0, sectionGroups: {} };
      if (!subjectsMap[subName].sectionGroups[secName]) subjectsMap[subName].sectionGroups[secName] = { name: secName, totalCount: 0, microTopics: {} };
      if (!subjectsMap[subName].sectionGroups[secName].microTopics[microName]) {
        subjectsMap[subName].sectionGroups[secName].microTopics[microName] = {
          name: microName,
          questions: [],
          valueAdditions: [],
          subTopics: {}
        };
      }
      return subjectsMap[subName].sectionGroups[secName].microTopics[microName];
    };

    const getOrCreateSub = (microNode: any, subTopicName: string) => {
      if (!microNode.subTopics[subTopicName]) {
        microNode.subTopics[subTopicName] = {
          name: subTopicName,
          questions: [],
          valueAdditions: [],
          nanoTopics: {}
        };
      }
      return microNode.subTopics[subTopicName];
    };

    const getOrCreateNano = (subNode: any, nanoTopicName: string) => {
      if (!subNode.nanoTopics) {
        subNode.nanoTopics = {};
      }
      if (!subNode.nanoTopics[nanoTopicName]) {
        subNode.nanoTopics[nanoTopicName] = {
          name: nanoTopicName,
          questions: [],
          valueAdditions: []
        };
      }
      return subNode.nanoTopics[nanoTopicName];
    };

    filteredQuestions.forEach(q => {
      const subName = q.subject || 'General';
      const secName = q.sectionGroup || 'General';
      const microName = q.microTopic || 'General';
      const subTopicName = q.subTopic || q.subtopic || '';
      const nanoTopicName = q.nanoTopic || q.nanotopic || '';

      const microNode = getOrCreateMicro(subName, secName, microName);
      
      if (subTopicName) {
        const subNode = getOrCreateSub(microNode, subTopicName);
        if (nanoTopicName) {
          const nanoNode = getOrCreateNano(subNode, nanoTopicName);
          nanoNode.questions.push(q);
        } else {
          subNode.questions.push(q);
        }
      } else {
        microNode.questions.push(q);
      }
      
      subjectsMap[subName].totalCount++;
      subjectsMap[subName].sectionGroups[secName].totalCount++;
    });

    filteredVAs.forEach(item => {
      const subName = item.subject || 'General';
      const secName = item.sectionGroup || 'General';
      const microName = item.microtopic || 'General';
      const subTopicName = item.subtopic || '';
      const nanoTopicName = item.nanotopic || '';

      const microNode = getOrCreateMicro(subName, secName, microName);
      
      if (subTopicName) {
        const subNode = getOrCreateSub(microNode, subTopicName);
        if (nanoTopicName) {
          const nanoNode = getOrCreateNano(subNode, nanoTopicName);
          nanoNode.valueAdditions.push(item);
        } else {
          subNode.valueAdditions.push(item);
        }
      } else {
        microNode.valueAdditions.push(item);
      }
      
      subjectsMap[subName].totalCount++;
      subjectsMap[subName].sectionGroups[secName].totalCount++;
    });

    return subjectsMap;
  }, [allQuestions, valueAddItems, valueAddTags, filters.selectedTag, filters.selectedSubject, filters.searchQuery]);

  // Stats calculation
  const stats = useMemo(() => {
    return [
      { label: 'Tagged Questions', value: allQuestions.length, icon: PenTool },
      { label: 'Tagged Value Adds', value: totalTaggedVAs, icon: Database },
      { label: 'Active Tags', value: uniqueTags.length, icon: Tag },
    ];
  }, [allQuestions, totalTaggedVAs, uniqueTags]);

  const getSubjectIcon = (sub: string) => {
    const n = sub.toLowerCase();
    if (n.includes('polity')) return Scale;
    if (n.includes('history')) return Scroll;
    if (n.includes('economy')) return TrendingUp;
    if (n.includes('geography')) return Globe;
    if (n.includes('environment')) return Leaf;
    if (n.includes('science') || n.includes('tech')) return Atom;
    if (n.includes('csat')) return Hash;
    if (n.includes('art') || n.includes('culture')) return Palette;
    if (n.includes('security')) return Shield;
    if (n.includes('international') || n.includes('ir')) return MapIcon;
    if (n.includes('ethics')) return Heart;
    if (n.includes('social')) return Users;
    if (n.includes('governance')) return Settings;
    return BookOpen;
  };

  // Subject folders drill-down
  if (activeSubject) {
    const subjectData = combinedVaultData[activeSubject];
    const sections = subjectData ? Object.values(subjectData.sectionGroups) : [];

    const renderItemsList = (questionsList: any[], vaList: any[]) => {
      return (
        <View style={styles.questionsList}>
          {questionsList.map((q: any) => (
            <MainsRepoQuestionCard
              key={q.id}
              question={q}
              onUpdate={refresh}
              onOpenQuestionBank={onOpenQuestionBank}
              colors={colors}
            />
          ))}
          {(vaList || []).length > 0 && (
            <View style={{ marginTop: questionsList.length > 0 ? 8 : 0 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textTertiary, marginBottom: 6, marginLeft: 4, letterSpacing: 0.5 }}>VALUE ADDITIONS</Text>
              {(vaList || []).map((item: ValueAdditionItem) => (
                <ValueAdditionCard
                  key={item.id}
                  item={item}
                  colors={colors}
                  isDark={isDark}
                  copiedId={copiedId}
                  onCopy={handleCopy}
                  width="100%"
                  initialCollapsed={false}
                  userTags={userTags}
                  valueAddTags={valueAddTags}
                  onToggleValueAddTag={onToggleValueAddTag}
                  onCreateTag={onCreateTag}
                />
              ))}
            </View>
          )}
        </View>
      );
    };

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: (insets?.top || 0) + 12 }]}>
          <TouchableOpacity
            onPress={() => setActiveSubject(null)}
            style={[
              styles.inlineBackButton,
              {
                backgroundColor: colors.surface + 'b3',
                borderColor: colors.border,
                marginRight: 10,
              }
            ]}
          >
            <ChevronLeft size={20} color={colors.textPrimary} />
            <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Back</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {activeSubject}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>
              {subjectData?.totalCount || 0} tagged items
            </Text>
          </View>
          {/* Expand/Collapse All Button */}
          {subjectData && (
            <TouchableOpacity
              onPress={() => toggleExpandAll(subjectData)}
              style={[
                styles.iconBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.surface + 'b3',
                  marginRight: 8,
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  justifyContent: 'center',
                  alignItems: 'center',
                }
              ]}
            >
              {hasAnyExpanded ? (
                <ChevronsUp size={16} color={colors.textPrimary} />
              ) : (
                <ChevronsDown size={16} color={colors.textPrimary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Drill-down accordion list */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
          {sections.length === 0 ? (
            <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 32 }}>
              No questions inside subject.
            </Text>
          ) : (
            (sections as any[]).map((section: any) => (
              <View key={section.name} style={styles.sectionContainer}>
                <TouchableOpacity
                  onPress={() => toggleSection(section.name)}
                  style={[
                    styles.sectionHeader,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Layers size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sectionName, { color: colors.textPrimary }]}>{section.name}</Text>
                    <Text style={[styles.sectionStats, { color: colors.textTertiary }]}>{section.totalCount} items</Text>
                  </View>
                  {expandedSections[section.name] ? (
                    <ChevronDown size={18} color={colors.textTertiary} />
                  ) : (
                    <ChevronRight size={18} color={colors.textTertiary} />
                  )}
                </TouchableOpacity>
 
                {expandedSections[section.name] && (
                  <View style={styles.microTopicContainer}>
                    {Object.values(section.microTopics).map((topic: any) => {
                      const microKey = `${section.name}-${topic.name}`;
                      const hasSubtopics = Object.keys(topic.subTopics || {}).length > 0;
                      
                      return (
                        <View key={topic.name} style={styles.topicBlock}>
                          <TouchableOpacity
                            onPress={() => toggleMicroTopic(microKey)}
                            style={[styles.topicAccordion, { borderBottomColor: colors.border }]}
                          >
                            <FolderOpen size={14} color={colors.textSecondary} />
                            <Text style={[styles.topicName, { color: colors.textSecondary }]}>{topic.name}</Text>
                            <View style={[styles.countBadge, { backgroundColor: colors.surfaceStrong + '20' }]}>
                              <Text style={[styles.countText, { color: colors.textSecondary }]}>
                                {topic.questions.length + (topic.valueAdditions || []).length + 
                                 Object.values(topic.subTopics || {}).reduce((acc: number, sub: any) => {
                                   return acc + sub.questions.length + sub.valueAdditions.length + 
                                          Object.values(sub.nanoTopics || {}).reduce((acc2: number, nano: any) => {
                                            return acc2 + nano.questions.length + nano.valueAdditions.length;
                                          }, 0);
                                 }, 0)}
                              </Text>
                            </View>
                          </TouchableOpacity>
                          
                          {expandedMicroTopics[microKey] && (
                            <View style={{ paddingLeft: 8, paddingVertical: 4 }}>
                              {/* Direct MicroTopic Items */}
                              {(topic.questions.length > 0 || (topic.valueAdditions || []).length > 0) && (
                                renderItemsList(topic.questions, topic.valueAdditions)
                              )}
                              
                              {/* Nested Subtopics */}
                              {hasSubtopics && (
                                <View style={{ marginTop: 4, gap: 8 }}>
                                  {Object.values(topic.subTopics).map((sub: any) => {
                                    const subKey = `${microKey}-${sub.name}`;
                                    const hasNanotopics = Object.keys(sub.nanoTopics || {}).length > 0;
                                    
                                    return (
                                      <View key={sub.name} style={{ borderRadius: 8, borderLeftWidth: 2, borderLeftColor: colors.border + '50', paddingLeft: 6 }}>
                                        <TouchableOpacity
                                          onPress={() => setExpandedSubTopics(prev => ({ ...prev, [subKey]: !prev[subKey] }))}
                                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 6 }}
                                        >
                                          <ChevronRight size={12} color={colors.textTertiary} style={{ transform: [{ rotate: expandedSubTopics[subKey] ? '90deg' : '0deg' }] }} />
                                          <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, flex: 1 }}>{sub.name}</Text>
                                        </TouchableOpacity>
                                        
                                        {expandedSubTopics[subKey] && (
                                          <View style={{ paddingLeft: 6 }}>
                                            {/* Direct SubTopic Items */}
                                            {(sub.questions.length > 0 || (sub.valueAdditions || []).length > 0) && (
                                              renderItemsList(sub.questions, sub.valueAdditions)
                                            )}
                                            
                                            {/* Nested Nanotopics */}
                                            {hasNanotopics && (
                                              <View style={{ marginTop: 4, gap: 6 }}>
                                                {Object.values(sub.nanoTopics || {}).map((nano: any) => {
                                                  const nanoKey = `${subKey}-${nano.name}`;
                                                  return (
                                                    <View key={nano.name} style={{ borderRadius: 6, borderLeftWidth: 1.5, borderLeftColor: colors.border + '40', paddingLeft: 6 }}>
                                                      <TouchableOpacity
                                                        onPress={() => setExpandedNanoTopics(prev => ({ ...prev, [nanoKey]: !prev[nanoKey] }))}
                                                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 6 }}
                                                      >
                                                        <ChevronRight size={10} color={colors.textTertiary} style={{ transform: [{ rotate: expandedNanoTopics[nanoKey] ? '90deg' : '0deg' }] }} />
                                                        <Text style={{ fontSize: 10.5, fontWeight: '600', color: colors.textTertiary, flex: 1 }}>{nano.name}</Text>
                                                      </TouchableOpacity>
                                                      
                                                      {expandedNanoTopics[nanoKey] && (
                                                        <View style={{ paddingLeft: 4 }}>
                                                          {renderItemsList(nano.questions, nano.valueAdditions)}
                                                        </View>
                                                      )}
                                                    </View>
                                                  );
                                                })}
                                              </View>
                                            )}
                                          </View>
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )))}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Top Bar Controls — uses insets for safe area */}
      <View style={[
        styles.commandBar,
        { backgroundColor: colors.surface, borderBottomColor: colors.border, paddingTop: (insets?.top || 0) + 12 }
      ]}>
        <TouchableOpacity
          onPress={onBack}
          style={[
            styles.inlineBackButton,
            {
              backgroundColor: colors.surface + 'b3',
              borderColor: colors.border,
            }
          ]}
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
          <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Hub</Text>
        </TouchableOpacity>
        <View style={styles.searchContainer}>
          <Search size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search mains tags..."
            placeholderTextColor={colors.textTertiary}
            value={filters.searchQuery}
            onChangeText={filters.setSearchQuery}
          />
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(!showFilters)}
          style={[styles.filterButton, { backgroundColor: showFilters ? colors.primary : colors.surfaceStrong + '20' }]}
        >
          <Filter size={16} color={showFilters ? '#fff' : colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setMenuVisible(true)} style={[styles.iconBtn, { borderColor: colors.border }]}>
          <MoreVertical size={16} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={[styles.filtersPanel, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>Filter by Tag</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            <TouchableOpacity
              onPress={() => filters.setSelectedTag('All')}
              style={[styles.filterChip, filters.selectedTag === 'All' && { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.filterChipText, { color: filters.selectedTag === 'All' ? '#fff' : colors.textSecondary }]}>
                All Tags
              </Text>
            </TouchableOpacity>
            {uniqueTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                onPress={() => filters.setSelectedTag(tag)}
                style={[styles.filterChip, filters.selectedTag === tag && { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.filterChipText, { color: filters.selectedTag === tag ? '#fff' : colors.textSecondary }]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Folders & Cards Grid */}
      {loading && Object.keys(combinedVaultData).length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.mainScroll}>
        <View style={styles.statsRow}>
            {stats.map((stat, idx) => (
              <View key={idx} style={[styles.statCard, { backgroundColor: colors.surface }]}>
                <stat.icon size={18} color={colors.primary} />
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textTertiary }]} numberOfLines={2}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.gridHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Subject Folders</Text>
            <View style={styles.viewToggle}>
              <TouchableOpacity onPress={() => setViewMode('grid')} style={styles.iconBtnSimple}>
                <LayoutGrid size={18} color={viewMode === 'grid' ? colors.primary : colors.textTertiary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setViewMode('list')} style={styles.iconBtnSimple}>
                <List size={18} color={viewMode === 'list' ? colors.primary : colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={viewMode === 'grid' ? styles.grid : styles.list}>
            {Object.keys(combinedVaultData).length === 0 ? (
              <View style={styles.emptyState}>
                <Database size={48} color={colors.textTertiary} opacity={0.3} />
                <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No tagged items found.</Text>
              </View>
            ) : (
              Object.values(combinedVaultData)
                .filter((x) => x.totalCount > 0)
                .map((subject) => (
                  <TouchableOpacity
                    key={subject.name}
                    onPress={() => setActiveSubject(subject.name)}
                    activeOpacity={0.7}
                    style={[viewMode === 'grid' ? styles.subjectCard : styles.subjectListRow, { backgroundColor: colors.surface }]}
                  >
                    <View style={[styles.subjectIcon, { backgroundColor: colors.primary + '10' }]}>
                      {React.createElement(getSubjectIcon(subject.name), { size: 20, color: colors.primary })}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.subjectName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {subject.name}
                      </Text>
                      <Text style={[styles.subjectCount, { color: colors.textTertiary }]}>{subject.totalCount} items</Text>
                    </View>
                    <ChevronRight size={16} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))
            )}
          </View>
        </ScrollView>
      )}

      {/* Menu Modal */}
      <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuVisible(false)}>
          <View style={[styles.actionMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setManageVisible(true);
              }}
            >
              <Pencil size={16} color={colors.textPrimary} />
              <Text style={[styles.menuText, { color: colors.textPrimary }]}>Edit Tags Catalog</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Manage Catalog Modal */}
      <Modal transparent visible={manageVisible} animationType="fade" onRequestClose={() => setManageVisible(false)}>
        <View style={styles.modalBackdropStrong}>
          <View style={[styles.sheet, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <View style={[styles.sheetHead, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Mains Tags Catalog</Text>
              <TouchableOpacity onPress={() => setManageVisible(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Done</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.addTagRow}>
              <TextInput
                value={newTagText}
                onChangeText={setNewTagText}
                placeholder="Add new review tag..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.addTagInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surface }]}
              />
              <TouchableOpacity onPress={addTag} disabled={savingTag} style={[styles.addTagBtn, { backgroundColor: colors.primary }]}>
                <Plus size={14} color="#04223a" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {uniqueTags.length === 0 ? (
                <Text style={{ color: colors.textTertiary }}>No tags in catalog yet.</Text>
              ) : (
                uniqueTags.map((tag) => (
                  <View key={tag} style={[styles.tagRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.tagRowText, { color: colors.textPrimary }]}>{tag}</Text>
                    <View style={styles.tagRowActions}>
                      <TouchableOpacity
                        onPress={() => {
                          setRenamingTag(tag);
                          setRenameValue(tag);
                        }}
                        style={styles.tagActionBtn}
                      >
                        <Pencil size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => removeTagEverywhere(tag)} style={styles.tagActionBtn}>
                        <Trash2 size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Rename Tag Modal */}
      <Modal transparent visible={!!renamingTag} animationType="fade" onRequestClose={() => setRenamingTag(null)}>
        <View style={styles.modalBackdropStrong}>
          <View style={[styles.renameCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.renameTitle, { color: colors.textPrimary }]}>Rename tag</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Tag name"
              placeholderTextColor={colors.textTertiary}
              style={[styles.addTagInput, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity onPress={() => setRenamingTag(null)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={renameTag} disabled={savingTag}>
                <Text style={{ color: colors.primary, fontWeight: '900' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  commandBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 12,
    borderBottomWidth: 1,
    gap: 8,
    minHeight: 60,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    marginLeft: 6,
    padding: 0,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersPanel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderBottomWidth: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainScroll: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    minWidth: 0,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  gridHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  viewToggle: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtnSimple: {
    padding: 6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  list: {
    flexDirection: 'column',
    gap: 10,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  subjectCard: {
    width: '48%',
    padding: 16,
    borderRadius: 20,
    gap: 12,
  },
  subjectListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  subjectIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '700',
  },
  subjectCount: {
    fontSize: 11,
    marginTop: 2,
  },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionContainer: {
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    gap: 12,
  },
  sectionName: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionStats: {
    fontSize: 11,
    marginTop: 2,
  },
  microTopicContainer: {
    paddingLeft: 12,
    marginTop: 8,
    gap: 8,
  },
  topicBlock: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  topicAccordion: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  topicName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
  questionsList: {
    padding: 8,
    gap: 10,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: 14,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  paperBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  paperBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 8,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  tagChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  cardExpanded: {
    borderTopWidth: 1,
    padding: 14,
  },
  sourceSelector: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    marginBottom: 10,
  },
  sourceTab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
  },
  sourceTabText: {
    fontSize: 12,
  },
  answerContent: {
    paddingVertical: 6,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdropStrong: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  actionMenu: {
    width: 200,
    borderWidth: 1,
    borderRadius: 14,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
  },
  menuText: {
    fontSize: 13,
    fontWeight: '600',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: '80%',
  },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  addTagRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  addTagInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  addTagBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagRowText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tagRowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tagActionBtn: {
    padding: 4,
  },
  renameCard: {
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  renameTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginTop: 8,
  },
  smallTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  smallTopBtnText: {
    fontSize: 10,
    fontWeight: '800',
  },
  inlineBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
});
