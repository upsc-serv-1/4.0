/**
 * AddToNotebookSheet — destination chooser for "Add to Notebook" actions.
 * Consolidates choice and capsule picker logic into a single premium popup.
 */
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Platform, KeyboardAvoidingView,
  ActivityIndicator, ScrollView, TextInput, Alert,
} from 'react-native';
import {
  Sparkles, Layers, FileText, X, ChevronDown, ChevronRight, Plus, Wand2, ListTree, ArrowLeft, BookOpen, Rocket,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  fetchAllCapsuleNodes, createCapsuleNode, createNotebookRow, buildCapsuleTree,
  findOrCreateNotebook, CapsuleTreeNode,
} from '../../repositories/capsuleRepo';
import {
  CapsuleNode, CapsuleNodeType, CAPSULE_SUBJECT_PALETTE,
} from '../../types/capsule';

export type SaveDestination = 'flashcard' | 'capsule' | 'notes' | 'pilot-v2';

interface AutoSeed {
  subject?: string | null;
  topic?: string | null;
  subtopic?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (dest: SaveDestination) => void;
  options?: SaveDestination[];

  // Capsule picker integration props
  userId?: string;
  autoSeed?: AutoSeed;
  defaultNotebookTitle?: string;
  onPickCapsule?: (result: { node_id: string; note_id: string; title: string }) => void;
  initialStep?: 'choose' | 'capsule';
}

const META: Record<SaveDestination, { Icon: any; title: string; subtitle: string; tint: string }> = {
  flashcard: { Icon: Layers,    title: 'Flashcards',    subtitle: 'Convert into a spaced-repetition card', tint: '#5B7ADB' },
  capsule:   { Icon: Sparkles,  title: 'Capsule',       subtitle: 'Append structured block to Capsule notebook', tint: '#FF6A88' },
  notes:     { Icon: FileText,  title: 'Notes',         subtitle: 'Save to your classic Notes tab',         tint: '#10b981' },
  'pilot-v2':{ Icon: Rocket,    title: 'Pilot V2',      subtitle: 'Auto-routed by subject → topic → microtopic', tint: '#5B4EFA' },
};

type Step = 'choose' | 'capsule';
type Mode = 'manual' | 'auto';

export const AddToNotebookSheet: React.FC<Props> = ({
  visible, onClose, onPick, options,
  userId, autoSeed, defaultNotebookTitle, onPickCapsule,
  initialStep,
}) => {
  const { colors } = useTheme();
  const order: SaveDestination[] = options || ['flashcard', 'capsule', 'notes'];

  const [step, setStep] = useState<Step>(initialStep || 'choose');
  const [mode, setMode] = useState<Mode>(autoSeed?.subject ? 'auto' : 'manual');
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<CapsuleNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [showSubtopicDropdown, setShowSubtopicDropdown] = useState(false);
  const [showNotebookDropdown, setShowNotebookDropdown] = useState(false);

  /* manual selection */
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [newNotebookTitle, setNewNotebookTitle] = useState('');
  const [creating, setCreating] = useState(false);

  /* auto fields */
  const [autoSubject,  setAutoSubject]  = useState(autoSeed?.subject  || '');
  const [autoTopic,    setAutoTopic]    = useState(autoSeed?.topic    || '');
  const [autoSubtopic, setAutoSubtopic] = useState(autoSeed?.subtopic || '');
  const [autoNotebook, setAutoNotebook] = useState(defaultNotebookTitle || '');

  const reload = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await fetchAllCapsuleNodes(userId);
      setNodes(list || []);
    } catch (err) {
      console.warn('Failed to load capsule nodes:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!visible) return;
    setStep(initialStep || 'choose');
    setMode(autoSeed?.subject ? 'auto' : 'manual');
    setSelectedParentId(null);
    setNewNotebookTitle('');
    setAutoSubject(autoSeed?.subject || '');
    setAutoTopic(autoSeed?.topic || '');
    setAutoSubtopic(autoSeed?.subtopic || '');
    setAutoNotebook(defaultNotebookTitle || '');
    if (userId) {
      reload();
    } else {
      setLoading(false);
    }
  }, [visible, reload, autoSeed, defaultNotebookTitle, userId, initialStep]);

  const tree = useMemo(() => buildCapsuleTree(nodes), [nodes]);

  const toggleExpand = (id: string) =>
    setExpandedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const handlePickNotebook = (n: CapsuleTreeNode) => {
    if (n.type !== 'notebook' || !n.note_id) return;
    if (onPickCapsule) {
      onPickCapsule({ node_id: n.id, note_id: n.note_id, title: n.title });
    }
    onClose();
  };

  const handleSaveNewNotebook = async () => {
    const title = newNotebookTitle.trim();
    if (!title || !selectedParentId || !userId) return;
    setCreating(true);
    try {
      const parent = nodes.find((n) => n.id === selectedParentId);
      const subjectTitle = walkUpToSubject(parent, nodes)?.title || 'Capsule';
      const noteId = await createNotebookRow({ userId, subject: subjectTitle, title });
      if (!noteId) return;
      const node = await createCapsuleNode({
        userId, type: 'notebook', title, parentId: selectedParentId, noteId,
      });
      if (node) {
        if (onPickCapsule) onPickCapsule({ node_id: node.id, note_id: noteId, title });
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSaveAuto = async () => {
    const subject  = autoSubject.trim();
    const topic    = autoTopic.trim();
    const subtopic = autoSubtopic.trim();
    const notebook = autoNotebook.trim();
    if (!subject || !notebook || !userId) return;
    setCreating(true);
    try {
      const result = await ensureCapsulePath({
        userId, nodes, subject, topic, subtopic, notebookTitle: notebook,
      });
      await reload();
      if (onPickCapsule) onPickCapsule(result);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  // Get unique subject titles from nodes
  const getUniqueSubjects = useCallback((nodeList: CapsuleNode[]): string[] => {
    return Array.from(
      new Set(
        nodeList
          .filter(n => n.type === 'subject')
          .map(n => n.title)
      )
    ).sort();
  }, []);

  // Get topics under a subject
  const getTopicsUnderSubject = useCallback((nodeList: CapsuleNode[], subject: string): string[] => {
    const subjectNode = nodeList.find(n => n.type === 'subject' && n.title === subject);
    if (!subjectNode) return [];
    
    return Array.from(
      new Set(
        nodeList
          .filter(n => n.type === 'topic' && n.parent_id === subjectNode.id)
          .map(n => n.title)
      )
    ).sort();
  }, []);

  // Get subtopics under a topic
  const getSubtopicsUnderTopic = useCallback((nodeList: CapsuleNode[], subject: string, topic: string): string[] => {
    const subjectNode = nodeList.find(n => n.type === 'subject' && n.title === subject);
    if (!subjectNode) return [];
    
    const topicNode = nodeList.find(n => n.type === 'topic' && n.parent_id === subjectNode.id && n.title === topic);
    if (!topicNode) return [];
    
    return Array.from(
      new Set(
        nodeList
          .filter(n => n.type === 'subtopic' && n.parent_id === topicNode.id)
          .map(n => n.title)
      )
    ).sort();
  }, []);

  // Get notebooks under a subtopic
  const getNotebooksUnderSubtopic = useCallback((nodeList: CapsuleNode[], subject: string, topic: string, subtopic: string): string[] => {
    const subjectNode = nodeList.find(n => n.type === 'subject' && n.title === subject);
    if (!subjectNode) return [];
    
    const topicNode = nodeList.find(n => n.type === 'topic' && n.parent_id === subjectNode.id && n.title === topic);
    if (!topicNode) return [];
    
    const subtopicNode = nodeList.find(n => n.type === 'subtopic' && n.parent_id === topicNode.id && n.title === subtopic);
    if (!subtopicNode) return [];
    
    return Array.from(
      new Set(
        nodeList
          .filter(n => n.type === 'notebook' && n.parent_id === subtopicNode.id)
          .map(n => n.title)
      )
    ).sort();
  }, []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <View style={[s.moveSheet, { backgroundColor: colors.surface, maxHeight: '90%' }]} testID="add-to-notebook-sheet">
            {/* Header */}
            <View style={s.moveHeader}>
              {step === 'capsule' ? (
                <TouchableOpacity onPress={() => setStep('choose')} style={[s.closeCircle, { backgroundColor: colors.border + '40' }]}>
                  <ArrowLeft size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              ) : <View style={{ width: 40 }} />}
              <Text style={[s.moveTitle, { color: colors.textPrimary }]}>
                {step === 'choose' ? 'Select location' : 'Save to Capsule'}
              </Text>
              <TouchableOpacity onPress={onClose} style={[s.closeCircle, { backgroundColor: colors.border + '40' }]} testID="add-to-notebook-close">
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {step === 'choose' ? (
              <View style={{ paddingBottom: 20 }}>
                {order.map((d) => {
                  const m = META[d];
                  return (
                    <TouchableOpacity
                      key={d}
                      testID={`add-to-notebook-pick-${d}`}
                      onPress={() => {
                        if (d === 'capsule') setStep('capsule');
                        else onPick(d);
                      }}
                      activeOpacity={0.85}
                      style={[s.premiumChoice, { backgroundColor: colors.surfaceStrong, borderColor: colors.border + '40', marginBottom: 12 }]}
                    >
                      <View style={[s.choiceIcon, { backgroundColor: m.tint + '15' }]}>
                        <m.Icon color={m.tint} size={22} strokeWidth={2.2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.choiceTitle, { color: colors.textPrimary }]}>{m.title}</Text>
                        <Text style={[s.choiceSub, { color: colors.textTertiary }]}>{m.subtitle}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <View style={[s.modeRow, { borderColor: colors.border + '30' }]}>
                  <ModeBtn
                    Icon={ListTree} label="Manual" active={mode === 'manual'}
                    onPress={() => setMode('manual')} testID="capsule-picker-mode-manual"
                  />
                  <ModeBtn
                    Icon={Wand2} label="Auto" active={mode === 'auto'}
                    onPress={() => setMode('auto')} testID="capsule-picker-mode-auto"
                  />
                </View>

                {loading ? (
                  <View style={s.loaderWrap}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : mode === 'manual' ? (
                  <View style={{ flex: 1 }}>
                    <ScrollView style={s.tree} contentContainerStyle={{ paddingVertical: 6 }}>
                      {tree.length === 0 ? (
                        <Text style={[s.empty, { color: colors.textTertiary }]}>No subjects found.</Text>
                      ) : (
                        tree.map((n) => renderRow(n, 0, expandedIds, toggleExpand, selectedParentId, setSelectedParentId, handlePickNotebook, colors))
                      )}
                    </ScrollView>

                    {selectedParentId && (
                      <View style={[s.createRow, { borderTopColor: colors.border + '40' }]}>
                        <TextInput
                          testID="capsule-new-nb-input"
                          value={newNotebookTitle}
                          onChangeText={setNewNotebookTitle}
                          placeholder="New Notebook Name…"
                          placeholderTextColor={colors.textTertiary}
                          style={[s.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
                        />
                        <TouchableOpacity
                          testID="capsule-create-nb-btn"
                          onPress={handleSaveNewNotebook}
                          disabled={creating || !newNotebookTitle.trim()}
                          style={[s.cta, { backgroundColor: colors.primary, opacity: newNotebookTitle.trim() ? 1 : 0.5 }]}
                        >
                          <Plus color="#fff" size={14} strokeWidth={2.5} />
                          <Text style={s.ctaTxt}>{creating ? 'Creating…' : 'Create'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={s.autoWrap}>
                    <Text style={[s.autoHint, { color: colors.textSecondary }]}>
                      Pre-filled from the question (Subject → Section Group → Microtopic). Adjust and save — any missing levels will be created automatically.
                    </Text>

                    {/* Subject Dropdown - Get existing subjects from real nodes */}
                    <View style={s.formGroup}>
                      <Text style={[s.fieldLabel, { color: colors.textTertiary }]}>Subject</Text>
                      <TouchableOpacity
                        style={[s.dropdownButton, { borderColor: colors.border }]}
                        onPress={() => setShowSubjectDropdown(!showSubjectDropdown)}
                      >
                        <Text style={[s.dropdownButtonText, { color: colors.textPrimary }]}>
                          {autoSubject || 'Select subject...'}
                        </Text>
                        <ChevronDown size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {showSubjectDropdown && (
                        <View style={[s.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {getUniqueSubjects(nodes).map((subject, idx) => (
                            <TouchableOpacity
                              key={`${subject}-${idx}`}
                              style={[
                                s.dropdownItem,
                                autoSubject === subject && s.dropdownItemSelected,
                                { borderBottomColor: colors.border }
                              ]}
                              onPress={() => {
                                setAutoSubject(subject);
                                setAutoTopic('');
                                setAutoSubtopic('');
                                setShowSubjectDropdown(false);
                              }}
                            >
                              <Text style={[s.dropdownItemText, { color: autoSubject === subject ? '#5B4EFA' : colors.textPrimary }]}>
                                {subject}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Topic Dropdown */}
                    <View style={s.formGroup}>
                      <Text style={[s.fieldLabel, { color: colors.textTertiary }]}>Topic</Text>
                      <TouchableOpacity
                        style={[s.dropdownButton, { borderColor: colors.border }]}
                        onPress={() => setShowTopicDropdown(!showTopicDropdown)}
                        disabled={!autoSubject}
                      >
                        <Text style={[s.dropdownButtonText, { color: autoSubject ? colors.textPrimary : colors.textTertiary }]}>
                          {autoTopic || (autoSubject ? 'Select topic...' : '(Select subject first)')}
                        </Text>
                        <ChevronDown size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {showTopicDropdown && autoSubject && (
                        <View style={[s.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {getTopicsUnderSubject(nodes, autoSubject).map((topic, idx) => (
                            <TouchableOpacity
                              key={`${topic}-${idx}`}
                              style={[
                                s.dropdownItem,
                                autoTopic === topic && s.dropdownItemSelected,
                                { borderBottomColor: colors.border }
                              ]}
                              onPress={() => {
                                setAutoTopic(topic);
                                setAutoSubtopic('');
                                setShowTopicDropdown(false);
                              }}
                            >
                              <Text style={[s.dropdownItemText, { color: autoTopic === topic ? '#5B4EFA' : colors.textPrimary }]}>
                                {topic}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Subtopic Dropdown */}
                    <View style={s.formGroup}>
                      <Text style={[s.fieldLabel, { color: colors.textTertiary }]}>Subtopic</Text>
                      <TouchableOpacity
                        style={[s.dropdownButton, { borderColor: colors.border }]}
                        onPress={() => setShowSubtopicDropdown(!showSubtopicDropdown)}
                        disabled={!autoTopic}
                      >
                        <Text style={[s.dropdownButtonText, { color: autoTopic ? colors.textPrimary : colors.textTertiary }]}>
                          {autoSubtopic || (autoTopic ? 'Select subtopic...' : '(Select topic first)')}
                        </Text>
                        <ChevronDown size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {showSubtopicDropdown && autoTopic && (
                        <View style={[s.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {getSubtopicsUnderTopic(nodes, autoSubject, autoTopic).map((subtopic, idx) => (
                            <TouchableOpacity
                              key={`${subtopic}-${idx}`}
                              style={[
                                s.dropdownItem,
                                autoSubtopic === subtopic && s.dropdownItemSelected,
                                { borderBottomColor: colors.border }
                              ]}
                              onPress={() => {
                                setAutoSubtopic(subtopic);
                                setShowSubtopicDropdown(false);
                              }}
                            >
                              <Text style={[s.dropdownItemText, { color: autoSubtopic === subtopic ? '#5B4EFA' : colors.textPrimary }]}>
                                {subtopic}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Notebook Dropdown */}
                    <View style={s.formGroup}>
                      <Text style={[s.fieldLabel, { color: colors.textTertiary }]}>Notebook</Text>
                      <TouchableOpacity
                        style={[s.dropdownButton, { borderColor: colors.border }]}
                        onPress={() => setShowNotebookDropdown(!showNotebookDropdown)}
                        disabled={!autoSubtopic}
                      >
                        <Text style={[s.dropdownButtonText, { color: autoSubtopic ? colors.textPrimary : colors.textTertiary }]}>
                          {autoNotebook || (autoSubtopic ? 'Select or create...' : '(Select subtopic first)')}
                        </Text>
                        <ChevronDown size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {showNotebookDropdown && autoSubtopic && (
                        <View style={[s.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          {/* Show existing notebooks */}
                          {getNotebooksUnderSubtopic(nodes, autoSubject, autoTopic, autoSubtopic).map((notebook, idx) => (
                            <TouchableOpacity
                              key={`${notebook}-${idx}`}
                              style={[
                                s.dropdownItem,
                                autoNotebook === notebook && s.dropdownItemSelected,
                                { borderBottomColor: colors.border }
                              ]}
                              onPress={() => {
                                setAutoNotebook(notebook);
                                setShowNotebookDropdown(false);
                              }}
                            >
                              <Text style={[s.dropdownItemText, { color: autoNotebook === notebook ? '#5B4EFA' : colors.textPrimary }]}>
                                📌 {notebook}
                              </Text>
                            </TouchableOpacity>
                          ))}
                          {/* Divider */}
                          {getNotebooksUnderSubtopic(nodes, autoSubject, autoTopic, autoSubtopic).length > 0 && (
                            <View style={[s.divider, { borderBottomColor: colors.border }]} />
                          )}
                          {/* Or create new */}
                          <View style={s.createNewSection}>
                            <TextInput
                              style={[s.createNewInput, { color: colors.textPrimary, borderColor: colors.border }]}
                              placeholder="Create new notebook..."
                              placeholderTextColor={colors.textTertiary}
                              value={autoNotebook}
                              onChangeText={setAutoNotebook}
                            />
                          </View>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      testID="capsule-auto-save"
                      onPress={handleSaveAuto}
                      disabled={creating || !autoSubject.trim() || !autoNotebook.trim()}
                      style={[s.cta, { backgroundColor: colors.primary, opacity: (autoSubject.trim() && autoNotebook.trim()) ? 1 : 0.55, marginTop: 12, alignSelf: 'flex-end' }]}
                    >
                      <Plus color="#fff" size={14} strokeWidth={2.5} />
                      <Text style={s.ctaTxt}>{creating ? 'Saving…' : 'Save to Capsule'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const renderRow = (
  n: CapsuleTreeNode,
  depth: number,
  expandedIds: Set<string>,
  onToggleExpand: (id: string) => void,
  selectedParentId: string | null,
  onSelectParent: (id: string | null) => void,
  onPickNotebook: (n: CapsuleTreeNode) => void,
  colors: any
): React.ReactNode => {
  const isExpanded = expandedIds.has(n.id);
  const isParentChosen = selectedParentId === n.id;
  const tint = n.type === 'subject'
    ? (n.color || CAPSULE_SUBJECT_PALETTE[n.title] || CAPSULE_SUBJECT_PALETTE.default)
    : null;

  return (
    <View key={n.id}>
      <View style={[s.row, { paddingLeft: 12 + depth * 14, borderBottomColor: colors.border + '20' }, isParentChosen && { backgroundColor: colors.primary + '15' }]}>
        {n.type !== 'notebook' ? (
          <TouchableOpacity onPress={() => onToggleExpand(n.id)} style={s.chev} hitSlop={4}>
            {isExpanded ? <ChevronDown color={colors.textTertiary} size={14} /> : <ChevronRight color={colors.textTertiary} size={14} />}
          </TouchableOpacity>
        ) : <View style={s.chev} />}

        {tint
          ? <View style={[s.chip, { backgroundColor: tint }]}><Text style={s.chipTxt}>{n.title.charAt(0).toUpperCase()}</Text></View>
          : <BookOpen color={colors.textTertiary} size={14} />}

        <TouchableOpacity
          style={{ flex: 1 }}
          testID={`capsule-picker-row-${n.id}`}
          onPress={() => {
            if (n.type === 'notebook') onPickNotebook(n);
            else onSelectParent(n.id);
          }}
        >
          <Text
            numberOfLines={1}
            style={[s.rowTxt, {
              color: isParentChosen ? colors.primary : colors.textPrimary,
              fontWeight: n.type === 'subject' ? '600' : '400',
            }]}
          >
            {n.title}
          </Text>
        </TouchableOpacity>

        {n.type !== 'notebook' && n.notebookCount > 0 && (
          <Text style={[s.count, { color: colors.textTertiary }]}>{n.notebookCount}</Text>
        )}
      </View>

      {isExpanded && n.children.map((c) => renderRow(c, depth + 1, expandedIds, onToggleExpand, selectedParentId, onSelectParent, onPickNotebook, colors))}
    </View>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (s: string) => void; testID?: string }> = ({
  label, value, onChange, testID,
}) => {
  const { colors } = useTheme();
  return (
    <View style={s.fieldWrap}>
      <Text style={[s.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        style={[s.input, { flex: undefined, width: '100%', color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
        placeholder="—"
        placeholderTextColor={colors.textTertiary}
      />
    </View>
  );
};

const ModeBtn: React.FC<{ Icon: any; label: string; active: boolean; onPress: () => void; testID?: string }> = ({
  Icon, label, active, onPress, testID,
}) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[
        s.modeBtn,
        active && { backgroundColor: hex(colors.primary, 0.12), borderColor: colors.primary },
        !active && { borderColor: colors.border },
      ]}
    >
      <Icon size={14} color={active ? colors.primary : colors.textTertiary} />
      <Text style={[s.modeBtnTxt, { color: active ? colors.primary : colors.textTertiary }]}>{label}</Text>
    </TouchableOpacity>
  );
};

function walkUpToSubject(start: CapsuleNode | undefined, all: CapsuleNode[]): CapsuleNode | null {
  if (!start) return null;
  let cur: CapsuleNode | undefined = start;
  const map = new Map(all.map((n) => [n.id, n]));
  while (cur && cur.type !== 'subject') {
    if (!cur.parent_id) return null;
    cur = map.get(cur.parent_id);
  }
  return cur || null;
}

export async function ensureCapsulePath(input: {
  userId: string;
  nodes: CapsuleNode[];
  subject: string;
  topic?: string;
  subtopic?: string;
  notebookTitle: string;
}): Promise<{ node_id: string; note_id: string; title: string }> {
  const { userId, subject, topic, subtopic, notebookTitle } = input;
  let nodes = [...input.nodes];

  const findChild = (parentId: string | null, type: CapsuleNodeType, title: string) =>
    nodes.find(
      (n) =>
        n.parent_id === parentId &&
        n.type === type &&
        (n.title || '').trim().toLowerCase() === title.trim().toLowerCase()
    );

  const ensure = async (parentId: string | null, type: CapsuleNodeType, title: string, color?: string) => {
    const existing = findChild(parentId, type, title);
    if (existing) return existing;
    const created = await createCapsuleNode({
      userId, type, title, parentId,
      color: color || (type === 'subject' ? CAPSULE_SUBJECT_PALETTE[title] || null : null),
    });
    if (created) nodes.push(created);
    return created!;
  };

  const subjectNode = await ensure(null, 'subject', subject);
  let parent: CapsuleNode = subjectNode;
  if (topic) parent = await ensure(parent.id, 'topic', topic) || parent;
  if (subtopic) parent = await ensure(parent.id, 'subtopic', subtopic) || parent;

  const { noteId, nodeId } = await findOrCreateNotebook({
    userId,
    title: notebookTitle,
    parentId: parent.id,
    subject,
  });
  return { node_id: nodeId, note_id: noteId, title: notebookTitle };
}

function hex(c: string, alpha: number): string {
  if (!c?.startsWith('#') || c.length !== 7) return c;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${c}${a}`;
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  moveSheet: { borderRadius: 40, padding: 20, paddingBottom: 30, width: '94%', maxWidth: 500, height: '82%', overflow: 'hidden' },
  moveHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  moveTitle: { fontSize: 18, fontWeight: '900' },
  closeCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  premiumChoice: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, borderWidth: 1 },
  choiceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontSize: 16, fontWeight: '900' },
  choiceSub: { fontSize: 12, marginTop: 4 },

  modeRow: { flexDirection: 'row', gap: 8, paddingBottom: 14, borderBottomWidth: 1 },
  modeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 8, borderWidth: 1 },
  modeBtnTxt: { fontSize: 13, fontWeight: '500' },
  loaderWrap: { padding: 24, alignItems: 'center' },

  /* manual */
  tree: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingRight: 12, gap: 8, borderBottomWidth: 1, borderRadius: 12 },
  chev: { width: 16, alignItems: 'center', justifyContent: 'center' },
  chip: { width: 18, height: 18, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  chipTxt: { color: '#fff', fontSize: 10, fontWeight: '700' },
  rowTxt: { fontSize: 15, fontWeight: '600', flex: 1 },
  count: { fontSize: 11 },

  createRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderTopWidth: 1 },
  input: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  cta: { paddingHorizontal: 14, height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empty: { padding: 24, fontSize: 13, textAlign: 'center' },

  /* auto */
  autoWrap: { paddingVertical: 16 },
  autoHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  fieldWrap: { marginBottom: 10 },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 4 },

  formGroup: {
    marginBottom: 14,
  },
  dropdownButton: {
    height: 46,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dropdownButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dropdown: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 200,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  dropdownItemSelected: {
    backgroundColor: '#F5F3FF',
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  createNewSection: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  createNewInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  divider: {
    height: 1,
    borderBottomWidth: 1,
  },
});
