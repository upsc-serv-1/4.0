/**
 * PilotV2SaveSheet — flashcard-style save popup for Pilot V2.
 *
 * Mirrors the flashcard / capsule popup UX:
 *   • Pre-filled subject → topic → subtopic → notebook title (from question).
 *   • All four fields editable before saving.
 *   • The block payload (markdown / bullets) is editable too.
 *   • One-tap Save uses `findOrCreatePilotV2Note` so repeated saves of the
 *     same subject/topic/subtopic/microtopic append to the SAME note rather
 *     than creating duplicates.
 *
 * After save the user can:
 *   • "Open in Pilot V2" — jumps to the editor screen of the note that was
 *     just appended to (so the content stays fully editable).
 *   • "Save another" — keep the popup open with cleared body for chaining.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Platform, KeyboardAvoidingView, Alert, ActivityIndicator,
  useWindowDimensions, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Rocket, X, Plus, Wand2, ChevronDown, Highlighter, Eraser } from 'lucide-react-native';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import RichNoteEditor from '../RichNoteEditor';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { SUBJECT_TOPICS } from './PilotV2SidebarSubject';
import { PILOT_V2_SUBJECT_PALETTE } from './types';
import {
  findOrCreatePilotV2Note,
  appendBlocksToPilotV2Note,
  fetchNotebooksAtLevel,
  fetchPilotV2HierarchyOptions,
  ensurePilotV2TopicNode,
  ensurePilotV2SubtopicNode,
} from '../../repositories/pilotV2Repo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PilotV2Block } from './types';

const STORAGE_LAST_USED = 'pilot-v2:save-sheet:last-used';
type LastUsed = {
  subject?: string; topic?: string; subtopic?: string; notebook?: string;
};
const readLastUsed = async (): Promise<LastUsed> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_LAST_USED);
    return raw ? (JSON.parse(raw) as LastUsed) : {};
  } catch {
    return {};
  }
};
const writeLastUsed = (next: LastUsed) => {
  AsyncStorage.setItem(STORAGE_LAST_USED, JSON.stringify(next)).catch(() => null);
};

const newId = () =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `pv2_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** Convert plain text / markdown-ish text into PilotV2Block[]. Each non-empty
 *  line becomes a paragraph or bullet block; lines starting with `# ` map to
 *  H1, `## ` to H2, `- ` to bullets, `1.` to numbered. Headings without
 *  leading `#` are kept verbatim. */
export function textToPilotV2Blocks(text: string): PilotV2Block[] {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  const lines = trimmed.split(/\r?\n/);
  const blocks: PilotV2Block[] = [];
  for (const raw of lines) {
    const line = raw.replace(/<br\s*\/?>(?=\s*\n?)/gi, '').replace(/<[^>]+>/g, '').trim();
    if (!line) continue;
    if (line.startsWith('# ')) {
      blocks.push({ id: newId(), type: 'heading', level: 1, text: line.slice(2).trim() });
    } else if (line.startsWith('## ')) {
      blocks.push({ id: newId(), type: 'heading', level: 2, text: line.slice(3).trim() });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({ id: newId(), type: 'bullet', text: line.slice(2).trim() });
    } else if (/^\d+\.\s+/.test(line)) {
      blocks.push({ id: newId(), type: 'numbered', text: line.replace(/^\d+\.\s+/, '').trim() });
    } else {
      blocks.push({ id: newId(), type: 'paragraph', text: line });
    }
  }
  return blocks;
}

export type PilotSaveSeedQuestion = {
  subject?: string | null;
  section_group?: string | null;
  micro_topic?: string | null;
  statement_line?: string | null;
  question_text?: string | null;
};

interface Props {
  visible: boolean;
  userId: string;
  onClose: () => void;
  /** Auto-seed values pulled from the question being saved. */
  autoSeed: {
    subject?: string | null;
    topic?: string | null;
    subtopic?: string | null;
    notebookTitle?: string | null;
  };
  /** Full question context for title + chips (optional). */
  seedQuestion?: PilotSaveSeedQuestion | null;
  /** Editable explanation/answer text (HTML preferred; markdown-ish ok). */
  initialBody: string;
  /** Source attribution (e.g. "Quiz / Polity 2024"). */
  source?: string;
}

export const PilotV2SaveSheet: React.FC<Props> = ({
  visible, userId, onClose, autoSeed, seedQuestion, initialBody, source,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [subject, setSubject]     = useState(autoSeed.subject || '');
  const [topic, setTopic]         = useState(autoSeed.topic || '');
  const [subtopic, setSubtopic]   = useState(autoSeed.subtopic || '');
  const [notebook, setNotebook]   = useState(autoSeed.notebookTitle || autoSeed.subtopic || autoSeed.topic || autoSeed.subject || '');
  const [body, setBody]           = useState(initialBody || '');
  const richRef = useRef<any>(null);
  const [showHlPicker, setShowHlPicker] = useState(false);
  const [hlColor, setHlColor] = useState('#FFF59D');
  const [newTopicDraft, setNewTopicDraft] = useState('');
  const [newSubtopicDraft, setNewSubtopicDraft] = useState('');
  const [folderBusy, setFolderBusy] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving]       = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [appendCount, setAppendCount] = useState(0);
  // Dropdowns state
  const [showSubjectDropdown, setShowSubjectDropdown] = useState(false);
  const [showTopicDropdown, setShowTopicDropdown] = useState(false);
  const [showSubtopicDropdown, setShowSubtopicDropdown] = useState(false);
  const [showNotebookDropdown, setShowNotebookDropdown] = useState(false);

  // Notebooks
  const [existingNotebooks, setExistingNotebooks] = useState<string[]>([]);
  const [loadingNotebooks, setLoadingNotebooks] = useState(false);
  const [mode, setMode] = useState<'select' | 'create'>('select');

  // User's actual Pilot V2 hierarchy (loaded once when sheet becomes visible)
  // — merged with the static palette so the Subject / Topic / Microtopic
  // dropdowns expose every branch the user has already created, not just the
  // hard-coded palette. This was the "only History showing" complaint.
  const [userHierarchy, setUserHierarchy] = useState<{
    subjects: string[];
    topicsBySubject: Record<string, string[]>;
    subtopicsByTopic: Record<string, string[]>;
  }>({ subjects: [], topicsBySubject: {}, subtopicsByTopic: {} });

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    (async () => {
      const opts = await fetchPilotV2HierarchyOptions(userId);
      if (!cancelled) setUserHierarchy(opts);
    })();
    return () => { cancelled = true; };
  }, [visible, userId]);

  useEffect(() => {
    if (!visible) return;
    // Read last-used preferences and merge with autoSeed (autoSeed wins).
    let cancelled = false;
    (async () => {
      const last = await readLastUsed();
      if (cancelled) return;
      setSubject(autoSeed.subject || last.subject || '');
      setTopic(autoSeed.topic || last.topic || '');
      setSubtopic(autoSeed.subtopic || last.subtopic || '');
      setNotebook(
        autoSeed.notebookTitle ||
        last.notebook ||
        autoSeed.subtopic ||
        autoSeed.topic ||
        autoSeed.subject ||
        ''
      );
    })();
    setBody(initialBody || '');
    setSavedNoteId(null);
    setAppendCount(0);
    setEditorKey(k => k + 1);
    return () => { cancelled = true; };
  }, [visible, autoSeed, initialBody]);

  const refreshHierarchy = async () => {
    if (!userId) return;
    const opts = await fetchPilotV2HierarchyOptions(userId);
    setUserHierarchy(opts);
  };

  const briefBlockTitle = useMemo(() => {
    const stem = (
      (seedQuestion?.statement_line || seedQuestion?.question_text || '') as string
    ).trim();
    const short = stem.length > 100 ? `${stem.slice(0, 97)}…` : stem;
    if (short) return short;
    if (seedQuestion?.micro_topic?.trim()) return seedQuestion.micro_topic.trim();
    return '';
  }, [seedQuestion]);

  // Helper: merged subject list — user's actual Pilot V2 subjects first, then
  // any palette subjects the user hasn't seeded yet, deduped.
  const allSubjects = useMemo(() => {
    const palette = PILOT_V2_SUBJECT_PALETTE.map(s => s.label);
    const merged = [...userHierarchy.subjects];
    palette.forEach(p => { if (!merged.includes(p)) merged.push(p); });
    return merged;
  }, [userHierarchy.subjects]);

  // Helper: merged topic list for the selected subject. Combines the user's
  // own topics under that subject with the static palette topics, deduped.
  const allTopics = useMemo(() => {
    const userTopics = subject ? (userHierarchy.topicsBySubject[subject] || []) : [];
    const subjectData = PILOT_V2_SUBJECT_PALETTE.find(s => s.label === subject);
    const paletteTopics = subjectData
      ? (SUBJECT_TOPICS[subjectData.id] || []).map(t => t.label)
      : [];
    const merged = [...userTopics];
    paletteTopics.forEach(p => { if (!merged.includes(p)) merged.push(p); });
    return merged;
  }, [subject, userHierarchy.topicsBySubject]);

  // Helper: merged microtopic list for the selected subject + topic.
  const allSubtopics = useMemo(() => {
    const key = `${subject}::${topic}`;
    const userSubs = (subject && topic) ? (userHierarchy.subtopicsByTopic[key] || []) : [];
    const subjectData = PILOT_V2_SUBJECT_PALETTE.find(s => s.label === subject);
    const topicsList = subjectData ? (SUBJECT_TOPICS[subjectData.id] || []) : [];
    const selectedTopic = topicsList.find(t => t.label === topic);
    const paletteSubs = selectedTopic?.subtopics?.map(st => st.label) || [];
    const merged = [...userSubs];
    paletteSubs.forEach(p => { if (!merged.includes(p)) merged.push(p); });
    return merged;
  }, [subject, topic, userHierarchy.subtopicsByTopic]);

  // Fetch notebooks when hierarchy changes
  useEffect(() => {
    if (!visible || !subject) return;

    (async () => {
      setLoadingNotebooks(true);
      const notebooks = await fetchNotebooksAtLevel(
        userId,
        subject,
        topic || null,
        subtopic || null
      );
      setExistingNotebooks(notebooks);
      setLoadingNotebooks(false);

      if (notebooks.length > 0) {
        setMode('select');
        setNotebook(prev => {
          if (prev.trim() && notebooks.includes(prev.trim())) return prev;
          return notebooks[0];
        });
      }
    })();
  }, [subject, topic, subtopic, visible, userId]);

  const plainTextLen = (html: string) =>
    html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().length;

  const canSave =
    !!userId &&
    subject.trim().length > 0 &&
    notebook.trim().length > 0 &&
    plainTextLen(body) > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let html = body;
      try {
        const fromEditor = await richRef.current?.getContentHtml?.();
        if (typeof fromEditor === 'string' && fromEditor.trim()) html = fromEditor;
      } catch { /* use body */ }

      const notebookTitle = notebook.trim();
      const result = await findOrCreatePilotV2Note({
        userId,
        subject: subject.trim(),
        topic: topic.trim() || null,
        subtopic: subtopic.trim() || null,
        title: notebookTitle,
      });
      const headingText =
        briefBlockTitle ||
        notebookTitle ||
        (source ? source.replace(/^Quiz\s*\/?\s*/i, '').trim() : '') ||
        'Explanation';
      const blocks: PilotV2Block[] = [
        {
          id: newId(),
          type: 'heading',
          level: 2,
          text: headingText,
          meta: { tag: 'quiz_import', source: source || 'quiz' },
        },
        {
          id: newId(),
          type: 'paragraph',
          text: html.trim(),
          meta: { tag: 'quiz_import', importedAt: new Date().toISOString(), source: source || 'quiz' },
        },
      ];
      const ok = await appendBlocksToPilotV2Note(result.noteId, blocks);
      if (!ok) throw new Error('append failed');
      setSavedNoteId(result.noteId);
      setAppendCount(c => c + 1);

      // Persist the chosen hierarchy as last-used so future Save Sheet opens
      // pre-fill the same selections (Step 8 — last-used preferences gap).
      writeLastUsed({
        subject: subject.trim(),
        topic: topic.trim(),
        subtopic: subtopic.trim(),
        notebook: notebookTitle,
      });

      // Show confirmation
      Alert.alert(
        'Saved!',
        result.isNew 
          ? `Created new notebook: "${notebookTitle}"`
          : `Appended to: "${notebookTitle}"`
      );
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = () => {
    onClose();
    // Pilot V2 has its own internal router; navigating to /pilot-v2 is enough,
    // the editor will open the most-recently-saved note via the dashboard.
    router.push('/pilot-v2');
  };

  const handleSaveAnother = () => {
    setBody('');
    setSavedNoteId(null);
    setEditorKey(k => k + 1);
  };

  const addSectionBreak = () => {
    const extra =
      '<p><br></p><p style="text-align:center;color:#94a3b8;">———</p><p><br></p>';
    setBody(prev => `${prev || ''}${extra}`);
    setEditorKey(k => k + 1);
  };

  const handleAddTopicFolder = async () => {
    const t = newTopicDraft.trim();
    if (!t || !subject.trim()) {
      Alert.alert('Subject required', 'Pick a subject and enter a section group name.');
      return;
    }
    setFolderBusy(true);
    try {
      const ok = await ensurePilotV2TopicNode(userId, subject.trim(), t);
      if (!ok) throw new Error('create topic');
      setTopic(t);
      setNewTopicDraft('');
      await refreshHierarchy();
      Alert.alert('Created', `Section group “${t}” is ready under ${subject}.`);
    } catch {
      Alert.alert('Error', 'Could not create section group.');
    } finally {
      setFolderBusy(false);
    }
  };

  const handleAddSubtopicFolder = async () => {
    const st = newSubtopicDraft.trim();
    if (!st || !subject.trim() || !topic.trim()) {
      Alert.alert('Pick topic', 'Select or create a section group first, then add a micro-topic name.');
      return;
    }
    setFolderBusy(true);
    try {
      const ok = await ensurePilotV2SubtopicNode(userId, subject.trim(), topic.trim(), st);
      if (!ok) throw new Error('create subtopic');
      setSubtopic(st);
      setNewSubtopicDraft('');
      await refreshHierarchy();
      Alert.alert('Created', `Micro-topic “${st}” is ready under ${topic}.`);
    } catch {
      Alert.alert('Error', 'Could not create micro-topic.');
    } finally {
      setFolderBusy(false);
    }
  };

  const backdropStyle = [
    styles.backdrop,
    isTablet ? { justifyContent: 'flex-end', alignItems: 'flex-end' } : null,
  ];

  const sheetStyle = [
    styles.sheet,
    isTablet ? {
      width: 480,
      maxWidth: 480,
      height: '100%',
      borderRadius: 0,
      borderTopLeftRadius: 28,
      borderBottomLeftRadius: 28,
      paddingTop: 40,
      paddingHorizontal: 24,
    } : null,
  ];

  const scrollViewStyle = {
    flex: 1,
    maxHeight: isTablet ? undefined : 460,
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={backdropStyle}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <View
            testID="pilot-v2-save-sheet"
            style={[sheetStyle, { backgroundColor: colors.surface }]}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.brand, { backgroundColor: '#5B4EFA' }]}>
                <Rocket size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Save to Pilot V2</Text>
                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                  Auto-routed by subject → topic → microtopic. Same path = same note.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} testID="pilot-v2-save-close" style={styles.closeBtn}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={scrollViewStyle} keyboardShouldPersistTaps="handled">
              {/* Subject Dropdown */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Subject</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { borderColor: colors.border }]}
                  onPress={() => setShowSubjectDropdown(!showSubjectDropdown)}
                >
                  <Text style={[styles.dropdownButtonText, { color: colors.textPrimary }]}>
                    {subject || 'Select subject...'}
                  </Text>
                  <ChevronDown size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {showSubjectDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {allSubjects.map((s, idx) => (
                      <TouchableOpacity
                        key={`${s}-${idx}`}
                        style={[
                          styles.dropdownItem,
                          subject === s && styles.dropdownItemSelected,
                          { borderBottomColor: colors.border }
                        ]}
                        onPress={() => {
                          setSubject(s);
                          setTopic('');
                          setSubtopic('');
                          setShowSubjectDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: subject === s ? '#5B4EFA' : colors.textPrimary }]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Topic Dropdown */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Topic</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { borderColor: colors.border }]}
                  onPress={() => setShowTopicDropdown(!showTopicDropdown)}
                  disabled={!subject}
                >
                  <Text style={[styles.dropdownButtonText, { color: subject ? colors.textPrimary : colors.textTertiary }]}>
                    {topic || (subject ? 'Select topic...' : '(Select subject first)')}
                  </Text>
                  <ChevronDown size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {showTopicDropdown && subject && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {allTopics.map((t, idx) => (
                      <TouchableOpacity
                        key={`${t}-${idx}`}
                        style={[
                          styles.dropdownItem,
                          topic === t && styles.dropdownItemSelected,
                          { borderBottomColor: colors.border }
                        ]}
                        onPress={() => {
                          setTopic(t);
                          setSubtopic('');
                          setShowTopicDropdown(false);
                        }}
                      >
                        <Text style={[styles.dropdownItemText, { color: topic === t ? '#5B4EFA' : colors.textPrimary }]}>
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              {/* Subtopic Dropdown */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Microtopic</Text>
                <TouchableOpacity
                  style={[styles.dropdownButton, { borderColor: colors.border }]}
                  onPress={() => setShowSubtopicDropdown(!showSubtopicDropdown)}
                  disabled={!topic}
                >
                  <Text style={[styles.dropdownButtonText, { color: topic ? colors.textPrimary : colors.textTertiary }]}>
                    {subtopic || (topic ? 'Select microtopic...' : '(Select topic first)')}
                  </Text>
                  <ChevronDown size={16} color={colors.textSecondary} />
                </TouchableOpacity>
                {showSubtopicDropdown && topic && (
                  <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {allSubtopics.length > 0 ? (
                      allSubtopics.map((st, idx) => (
                        <TouchableOpacity
                          key={`${st}-${idx}`}
                          style={[
                            styles.dropdownItem,
                            subtopic === st && styles.dropdownItemSelected,
                            { borderBottomColor: colors.border }
                          ]}
                          onPress={() => {
                            setSubtopic(st);
                            setShowSubtopicDropdown(false);
                          }}
                        >
                          <Text style={[styles.dropdownItemText, { color: subtopic === st ? '#5B4EFA' : colors.textPrimary }]}>
                            {st}
                          </Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <Text style={[styles.dropdownItem, { color: colors.textTertiary }]}>
                        No subtopics available
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Notebook Selector */}
              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Notebook</Text>
                {loadingNotebooks ? (
                  <ActivityIndicator color={colors.textTertiary} />
                ) : existingNotebooks.length > 0 ? (
                  <>
                    <View style={styles.modeToggle}>
                      <TouchableOpacity
                        style={[
                          styles.modeButton,
                          mode === 'select' && styles.modeButtonActive
                        ]}
                        onPress={() => {
                          setMode('select');
                          setNotebook(existingNotebooks[0]);
                        }}
                      >
                        <Text style={styles.modeButtonText}>📌 Use Existing</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.modeButton,
                          mode === 'create' && styles.modeButtonActive
                        ]}
                        onPress={() => setMode('create')}
                      >
                        <Text style={styles.modeButtonText}>✨ Create New</Text>
                      </TouchableOpacity>
                    </View>

                    {mode === 'select' ? (
                      <View style={[styles.notebookList, { borderColor: colors.border }]}>
                        <FlatList
                          scrollEnabled={existingNotebooks.length > 5}
                          data={existingNotebooks}
                          keyExtractor={(item, idx) => `${item}-${idx}`}
                          renderItem={({ item }) => (
                            <TouchableOpacity
                              style={[
                                styles.notebookItem,
                                notebook === item && styles.notebookItemSelected,
                                { borderBottomColor: colors.border }
                              ]}
                              onPress={() => setNotebook(item)}
                            >
                              <Text
                                style={[
                                  styles.notebookItemText,
                                  notebook === item && styles.notebookItemTextSelected,
                                  { color: notebook === item ? '#5B4EFA' : colors.textPrimary }
                                ]}
                              >
                                {item}
                              </Text>
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    ) : (
                      <TextInput
                        style={[
                          styles.input,
                          { color: colors.textPrimary, borderColor: colors.border }
                        ]}
                        placeholder="Enter notebook name"
                        placeholderTextColor={colors.textTertiary}
                        value={notebook}
                        onChangeText={setNotebook}
                      />
                    )}
                  </>
                ) : (
                  <View>
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                      No notebooks yet. Create one:
                    </Text>
                    <TextInput
                      style={[
                        styles.input,
                        { color: colors.textPrimary, borderColor: colors.border, marginTop: 8 }
                      ]}
                      placeholder="Notebook name"
                      placeholderTextColor={colors.textTertiary}
                      value={notebook}
                      onChangeText={setNotebook}
                    />
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>New folders (optional)</Text>
                <Text style={[styles.emptyText, { color: colors.textTertiary, marginBottom: 6 }]}>
                  Add a section group or micro-topic under the current subject without leaving this sheet.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="New section group name"
                    placeholderTextColor={colors.textTertiary}
                    value={newTopicDraft}
                    onChangeText={setNewTopicDraft}
                    editable={!folderBusy}
                  />
                  <TouchableOpacity
                    onPress={handleAddTopicFolder}
                    disabled={folderBusy}
                    style={[styles.miniBtn, { backgroundColor: '#5B4EFA', opacity: folderBusy ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Add</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, color: colors.textPrimary, borderColor: colors.border }]}
                    placeholder="New micro-topic name"
                    placeholderTextColor={colors.textTertiary}
                    value={newSubtopicDraft}
                    onChangeText={setNewSubtopicDraft}
                    editable={!folderBusy}
                  />
                  <TouchableOpacity
                    onPress={handleAddSubtopicFolder}
                    disabled={folderBusy || !topic}
                    style={[styles.miniBtn, { backgroundColor: '#5B4EFA', opacity: folderBusy || !topic ? 0.5 : 1 }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginTop: 12 }]}>Content</Text>
              <View style={[styles.richShell, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
                <View style={styles.toolbarWrap}>
                  <RichToolbar
                    getEditor={() => richRef.current}
                    selectedIconTint="#5B4EFA"
                    iconTint={colors.textPrimary}
                    style={{ backgroundColor: 'transparent', height: 44 }}
                    actions={[
                      actions.setBold,
                      actions.setItalic,
                      actions.setUnderline,
                      actions.setStrikethrough,
                      actions.heading1,
                      actions.heading2,
                      actions.insertBulletsList,
                      actions.insertOrderedList,
                      actions.blockquote,
                      'highlight',
                    ]}
                    iconMap={{
                      [actions.heading1]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '900', fontSize: 13 }}>H1</Text>,
                      [actions.heading2]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '800', fontSize: 11 }}>H2</Text>,
                      highlight: ({ tintColor }: any) => (
                        <View style={{ padding: 4, borderRadius: 4, backgroundColor: hlColor === 'transparent' ? 'transparent' : hlColor }}>
                          <Highlighter size={15} color={tintColor} />
                        </View>
                      ),
                    }}
                    onPress={(action) => {
                      if (action === 'highlight') {
                        setShowHlPicker(v => !v);
                        return;
                      }
                      richRef.current?.focusContentEditor?.();
                      setTimeout(() => richRef.current?.sendAction?.(action as any), 50);
                    }}
                  />
                </View>
                {showHlPicker && (
                  <View style={styles.hlRow}>
                    {['transparent', '#FF6A88', '#6A5BFF', '#4FC3F7', '#81C784', '#FFB74D', '#BA68C8', '#FFF59D'].map(c => (
                      <TouchableOpacity
                        key={c}
                        onPress={() => {
                          setHlColor(c);
                          setShowHlPicker(false);
                          richRef.current?.focusContentEditor?.();
                          setTimeout(() => {
                            if (c === 'transparent') {
                              richRef.current?.commandDOM?.("document.execCommand('hiliteColor', false, 'transparent'); document.execCommand('backColor', false, 'transparent')");
                            } else {
                              richRef.current?.commandDOM?.(`document.execCommand('hiliteColor', false, '${c}')`);
                            }
                          }, 50);
                        }}
                        style={[styles.hlSwatch, { backgroundColor: c === 'transparent' ? colors.surface : c, borderColor: hlColor === c ? '#5B4EFA' : colors.border }]}
                      >
                        {c === 'transparent' && <Eraser size={12} color={colors.textSecondary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <RichNoteEditor
                  key={editorKey}
                  ref={richRef}
                  html={body}
                  onChange={setBody}
                  themeColors={{
                    bg: colors.surfaceStrong,
                    surface: colors.surface,
                    textPrimary: colors.textPrimary,
                    border: colors.border,
                    primary: '#5B4EFA',
                  }}
                  placeholder="Edit explanation — bold, lists, and highlights match Pilot notes."
                />
                <TouchableOpacity onPress={addSectionBreak} style={styles.splitBtn}>
                  <Plus size={14} color="#5B4EFA" />
                  <Text style={{ color: '#5B4EFA', fontWeight: '800', fontSize: 12 }}>Add block break in editor</Text>
                </TouchableOpacity>
              </View>

              {savedNoteId && (
                <View style={[styles.savedRow, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Wand2 size={14} color="#047857" />
                  <Text style={{ color: '#047857', fontWeight: '600', fontSize: 13, flex: 1 }}>
                    Appended ({appendCount} block group{appendCount === 1 ? '' : 's'} saved this session). Same path appends to the same note.
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Footer actions */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {savedNoteId ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    testID="pilot-v2-save-another"
                    style={[styles.btnGhost, { borderColor: colors.border }]}
                    onPress={handleSaveAnother}
                  >
                    <Plus size={14} color={colors.textPrimary} />
                    <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>Save another</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    testID="pilot-v2-save-open"
                    style={[styles.btnPrimary, { backgroundColor: '#5B4EFA', flex: 1 }]}
                    onPress={handleOpen}
                  >
                    <Text style={styles.btnPrimaryText}>Open in Pilot V2</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  testID="pilot-v2-save-confirm"
                  disabled={!canSave || saving}
                  onPress={handleSave}
                  style={[
                    styles.btnPrimary,
                    { backgroundColor: '#5B4EFA', opacity: canSave && !saving ? 1 : 0.5 },
                  ]}
                >
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                    <>
                      <Rocket size={14} color="#fff" />
                      <Text style={styles.btnPrimaryText}>Save to Pilot V2</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; testID?: string }> = ({
  label, value, onChange, testID,
}) => {
  const { colors } = useTheme();
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder="—"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, {
          color: colors.textPrimary,
          borderColor: colors.border,
          backgroundColor: colors.surfaceStrong,
        }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 },
  sheet: { width: '94%', maxWidth: 520, borderRadius: 28, padding: 18, paddingBottom: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  brand: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 4 },
  input: {
    height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  bodyInput: {
    minHeight: 120, borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  preview: { fontSize: 11, marginTop: 6, marginBottom: 12 },
  savedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 8,
  },
  footer: { paddingTop: 12, marginTop: 8, borderTopWidth: 1 },
  btnPrimary: {
    height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btnGhost: {
    height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  // Dropdown styles
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
  // Notebook mode toggle
  modeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    marginTop: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: '#5B4EFA',
    backgroundColor: '#F5F3FF',
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  notebookList: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 250,
    marginTop: 8,
    overflow: 'hidden',
  },
  notebookItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  notebookItemSelected: {
    backgroundColor: '#F5F3FF',
  },
  notebookItemText: {
    fontSize: 14,
    fontWeight: '500',
  },
  notebookItemTextSelected: {
    fontWeight: '700',
    color: '#5B4EFA',
  },
  emptyText: {
    fontSize: 13,
    marginBottom: 8,
  },
  richShell: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  toolbarWrap: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 4,
  },
  hlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  hlSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  miniBtn: {
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PilotV2SaveSheet;
