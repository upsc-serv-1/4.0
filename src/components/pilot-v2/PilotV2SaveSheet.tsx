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
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Alert, ActivityIndicator, Animated,
  useWindowDimensions, Keyboard, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Rocket, X, Plus, Wand2, Highlighter, Eraser, Undo2, Redo2, Brain, Copy } from 'lucide-react-native';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import RichNoteEditor from '../RichNoteEditor';
import PilotV2SaveAIPanel from './PilotV2SaveAIPanel';
import { useTheme } from '../../context/ThemeContext';
import { PremiumMoveSheet, MoveTarget } from '../common/PremiumMoveSheet';
import { SUBJECT_TOPICS } from './PilotV2SidebarSubject';
import { PILOT_V2_SUBJECT_PALETTE, PilotV2Node, PilotV2Block } from './types';
import {
  findOrCreatePilotV2Note,
  appendBlocksToPilotV2Note,
  fetchNotebooksAtLevel,
  fetchPilotV2HierarchyOptions,
  fetchCanonicalPilotV2Nodes,
  createPilotV2Node,
} from '../../repositories/pilotV2Repo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { aiTransformNoteContent } from '../../services/GeminiService';

const STORAGE_LAST_USED = 'pilot-v2:save-sheet:last-used';
const STORAGE_SAVE_SHEET_AI_PROMPT = 'pilot-v2:save-sheet:ai-preset-prompt';
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
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const aiInputRef = useRef<TextInput | null>(null);
  const aiPanelYRef = useRef(0);
  const [hlColor, setHlColor] = useState('#FFF59D');
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving]       = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [appendCount, setAppendCount] = useState(0);
  // Dropdowns state
  const [activeLevel, setActiveLevel] = useState<'subject' | 'topic' | 'subtopic' | 'notebook' | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [allNodes, setAllNodes] = useState<PilotV2Node[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const [toolbarY, setToolbarY] = useState<number>(0);
  const [topAreaH, setTopAreaH] = useState(0);
  const topTranslate = useRef(new Animated.Value(0)).current;
  const sheetTranslate = useRef(new Animated.Value(0)).current;

  const snapshotFromEditor = async () => {
    try {
      const html = await richRef.current?.getContentHtml?.();
      if (typeof html === 'string') setBody(html);
    } catch {
      // keep existing body if editor snapshot fails
    }
  };

  // Notebooks
  const [existingNotebooks, setExistingNotebooks] = useState<string[]>([]);
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
      const nodes = await fetchCanonicalPilotV2Nodes(userId, false);
      if (!cancelled) setUserHierarchy(opts);
      if (!cancelled) setAllNodes(nodes);
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
    AsyncStorage.getItem(STORAGE_SAVE_SHEET_AI_PROMPT).then((preset) => {
      if (preset && preset.trim()) setAiPrompt(preset.trim());
      else setAiPrompt('');
    });
    return () => { cancelled = true; };
  }, [visible, autoSeed, initialBody]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e: any) => {
      setKeyboardOpen(true);
      const h = e?.endCoordinates?.height;
      setKeyboardHeight(typeof h === 'number' ? h : 0);
      // Smoothly roll header+chips into top edge (like Syllabus tracker)
      Animated.timing(topTranslate, {
        toValue: -Math.max(0, topAreaH + 14),
        duration: 260,
        useNativeDriver: true,
      }).start(() => {
        if (scrollRef.current && toolbarY > 0) {
          (scrollRef.current as any).scrollTo({ y: Math.max(toolbarY - 12, 0), animated: true });
        }
      });
      Animated.timing(sheetTranslate, {
        toValue: -Math.min(160, (typeof h === 'number' ? h : 0) * 0.35),
        duration: 260,
        useNativeDriver: true,
      }).start();
    });
    const h = Keyboard.addListener(hideEvt, () => {
      setKeyboardOpen(false);
      setKeyboardHeight(0);
      Animated.timing(topTranslate, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
      Animated.timing(sheetTranslate, {
        toValue: 0,
        duration: 260,
        useNativeDriver: true,
      }).start();
    });
    return () => { s.remove(); h.remove(); };
  }, [toolbarY, topAreaH, topTranslate, sheetTranslate]);

  const refreshHierarchy = async () => {
    if (!userId) return;
    const opts = await fetchPilotV2HierarchyOptions(userId);
    const nodes = await fetchCanonicalPilotV2Nodes(userId, false);
    setUserHierarchy(opts);
    setAllNodes(nodes);
  };

  const moveTargets: MoveTarget[] = useMemo(
    () =>
      allNodes.map((n) => ({
        id: n.id,
        name: n.title,
        type: n.type === 'note' ? 'notebook' : 'folder',
        parent_id: n.parent_id || null,
      })),
    [allNodes]
  );

  const applySelectionFromNode = (nodeId: string | null) => {
    if (!nodeId) return;
    const byId = new Map(allNodes.map((n) => [n.id, n]));
    let cur = byId.get(nodeId);
    let noteTitle = '';
    let subjectTitle = '';
    let topicTitle = '';
    let subtopicTitle = '';
    if (!cur) return;
    if (cur.type === 'note') noteTitle = cur.title;
    while (cur) {
      if (cur.type === 'subject') subjectTitle = cur.title;
      else if (cur.type === 'topic') topicTitle = cur.title;
      else if (cur.type === 'subtopic') subtopicTitle = cur.title;
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    if (subjectTitle) setSubject(subjectTitle);
    setTopic(topicTitle);
    setSubtopic(subtopicTitle);
    if (noteTitle) setNotebook(noteTitle);
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
      const notebooks = await fetchNotebooksAtLevel(
        userId,
        subject,
        topic || null,
        subtopic || null
      );
      setExistingNotebooks(notebooks);

      if (notebooks.length > 0) {
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

  const handleAiTransform = async () => {
    const plain = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (!plain) {
      Alert.alert('No content', 'Please add content before using AI transform.');
      return;
    }
    if (!aiPrompt.trim()) {
      Alert.alert('Command required', 'Please enter an AI command.');
      return;
    }
    setAiBusy(true);
    try {
      const transformed = await aiTransformNoteContent(plain, aiPrompt.trim());
      setAiOutput(transformed);
    } catch (e: any) {
      Alert.alert('AI failed', e?.message || 'Could not process AI command.');
    } finally {
      setAiBusy(false);
    }
  };


  const backdropStyle = [styles.backdrop];

  const sheetStyle = [
    styles.sheet,
    {
      width: isTablet ? '80%' : '92%',
      height: isTablet ? '82%' : '86%',
      maxWidth: 980,
      maxHeight: 920,
      borderRadius: 28,
      paddingTop: 18,
      paddingHorizontal: 18,
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={backdropStyle}>
        {/* Backdrop tap-to-close: explicit lower zIndex than sheet */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        />
        <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: keyboardOpen ? 'flex-start' : 'center', paddingTop: keyboardOpen ? 12 : 16, paddingBottom: 16, zIndex: 10 }}>
          <Animated.View style={{ transform: [{ translateY: sheetTranslate }], width: '100%', alignItems: 'center' }}>
            <View
              testID="pilot-v2-save-sheet"
              style={[sheetStyle, { backgroundColor: colors.surface }]}
              onStartShouldSetResponder={() => true}
              onMoveShouldSetResponder={() => true}
            >
            <Animated.View
              style={{ transform: [{ translateY: topTranslate }], zIndex: 4 }}
              onLayout={(e) => setTopAreaH(e.nativeEvent.layout.height)}
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
                <TouchableOpacity
                  testID="pilot-v2-save-ai-toggle"
                  onPress={() => setAiPanelOpen(v => !v)}
                  style={[styles.closeBtn, { marginRight: 4, backgroundColor: aiPanelOpen ? '#EEECFF' : 'transparent', borderRadius: 8 }]}
                >
                  <Brain size={20} color={aiPanelOpen ? '#5B4EFA' : colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} testID="pilot-v2-save-close" style={styles.closeBtn}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Save path + directory controls */}
              <View style={[styles.formGroup, { backgroundColor: colors.surface, paddingBottom: 10 }]}>
                <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>Save path</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <TouchableOpacity onPress={() => setActiveLevel('subject')} style={[styles.pathChip, { borderColor: '#8B5CF6', backgroundColor: '#EDE9FE' }]}><Text style={{ color: '#5B21B6', fontWeight: '800' }}>{subject || 'Subject'}</Text></TouchableOpacity>
                  <Text style={{ color: colors.textTertiary }}>→</Text>
                  <TouchableOpacity onPress={() => subject && setActiveLevel('topic')} style={[styles.pathChip, { borderColor: '#3B82F6', backgroundColor: '#DBEAFE', opacity: subject ? 1 : 0.5 }]}><Text style={{ color: '#1D4ED8', fontWeight: '800' }}>{topic || 'Section Group'}</Text></TouchableOpacity>
                  <Text style={{ color: colors.textTertiary }}>→</Text>
                  <TouchableOpacity onPress={() => topic && setActiveLevel('subtopic')} style={[styles.pathChip, { borderColor: '#10B981', backgroundColor: '#D1FAE5', opacity: topic ? 1 : 0.5 }]}><Text style={{ color: '#047857', fontWeight: '800' }}>{subtopic || 'Micro Topic'}</Text></TouchableOpacity>
                  <Text style={{ color: colors.textTertiary }}>→</Text>
                  <TouchableOpacity onPress={() => subject && setActiveLevel('notebook')} style={[styles.pathChip, { borderColor: '#F59E0B', backgroundColor: '#FEF3C7', opacity: subject ? 1 : 0.5 }]}><Text style={{ color: '#92400E', fontWeight: '800' }}>{notebook || 'Notebook'}</Text></TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity style={[styles.modeButton, { flex: 1 }]} onPress={() => setMoveOpen(true)}>
                    <Text style={styles.modeButtonText}>Change Directory</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modeButton, { flex: 1 }]} onPress={() => setMoveOpen(true)}>
                    <Text style={styles.modeButtonText}>New Directory</Text>
                  </TouchableOpacity>
                </View>
                {activeLevel && (
                  <View style={[styles.selectorCard, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
                    <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '800', marginBottom: 8 }}>
                      {activeLevel === 'subject' ? 'Choose Subject' : activeLevel === 'topic' ? 'Choose Section Group' : activeLevel === 'subtopic' ? 'Choose Micro Topic' : 'Choose Notebook'}
                    </Text>
                    <ScrollView style={{ maxHeight: 170 }}>
                      {(activeLevel === 'subject' ? allSubjects : activeLevel === 'topic' ? allTopics : activeLevel === 'subtopic' ? allSubtopics : existingNotebooks).map((item, idx) => (
                        <TouchableOpacity
                          key={`${activeLevel}-${idx}-${item}`}
                          style={[styles.selectorItem, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            if (activeLevel === 'subject') {
                              setSubject(item); setTopic(''); setSubtopic(''); setNotebook('');
                              setActiveLevel('topic');
                            } else if (activeLevel === 'topic') {
                              setTopic(item); setSubtopic(''); setNotebook('');
                              setActiveLevel('subtopic');
                            } else if (activeLevel === 'subtopic') {
                              setSubtopic(item); setNotebook('');
                              setActiveLevel('notebook');
                            } else {
                              setNotebook(item); setActiveLevel(null);
                            }
                          }}
                        >
                          <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>{item}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            </Animated.View>

            {aiPanelOpen ? (
              <PilotV2SaveAIPanel
                visible={aiPanelOpen}
                onClose={() => setAiPanelOpen(false)}
                onInsert={(html) => {
                  const next = (body || '').trim()
                    ? `${body}<p><br></p>${html}`
                    : html;
                  setBody(next);
                  pushHistory(next);
                  setEditorKey(k => k + 1);
                  setAiPanelOpen(false);
                }}
                seedContext={{
                  subject,
                  topic,
                  question: seedQuestion?.statement_line || seedQuestion?.question_text || null,
                  body,
                }}
              />
            ) : (
            <ScrollView
              ref={(r) => { scrollRef.current = r as any; }}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingBottom: Math.max(24, keyboardHeight ? keyboardHeight * 0.4 : 24) }}
              stickyHeaderIndices={[0]}
            >
              {/* Sticky formatting toolbar */}
              <View style={[styles.toolbarSticky, { backgroundColor: colors.surfaceStrong, borderBottomColor: colors.border }]}>
                <RichToolbar
                  getEditor={() => richRef.current}
                  selectedIconTint="#5B4EFA"
                  iconTint={colors.textPrimary}
                  style={{ backgroundColor: 'transparent', height: 44 }}
                  actions={[
                    actions.undo,
                    actions.redo,
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
                    'aiAssist',
                  ]}
                  iconMap={{
                    [actions.undo]: ({ tintColor }: any) => <Undo2 size={16} color={tintColor} />,
                    [actions.redo]: ({ tintColor }: any) => <Redo2 size={16} color={tintColor} />,
                    [actions.heading1]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '900', fontSize: 13 }}>H1</Text>,
                    [actions.heading2]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '800', fontSize: 11 }}>H2</Text>,
                    highlight: ({ tintColor }: any) => (
                      <View style={{ padding: 4, borderRadius: 4, backgroundColor: hlColor === 'transparent' ? 'transparent' : hlColor }}>
                        <Highlighter size={15} color={tintColor} />
                      </View>
                    ),
                    aiAssist: ({ tintColor }: any) => <Brain size={16} color={tintColor} />,
                  }}
                  onPress={(action) => {
                    if (action === 'highlight') {
                      setShowHlPicker(v => !v);
                      return;
                    }
                    if (action === 'aiAssist') {
                      setShowHlPicker(false);
                      setShowAiPanel(v => !v);
                      return;
                    }

                    richRef.current?.focusContentEditor?.();
                    if (action === actions.heading1) {
                      richRef.current?.commandDOM?.(`
                        (function(){
                          try {
                            const s = window.getSelection && window.getSelection();
                            if (s && s.rangeCount) { window.__pv2_savedRange = s.getRangeAt(0); }
                          } catch(e) {}
                        })();
                      `);
                      setTimeout(() => {
                        richRef.current?.commandDOM?.(`
                          (function(){
                            try {
                              const s = window.getSelection && window.getSelection();
                              if (window.__pv2_savedRange && s) { s.removeAllRanges(); s.addRange(window.__pv2_savedRange); }
                            } catch(e) {}
                            try {
                              const sel = window.getSelection && window.getSelection();
                              if (!sel || !sel.anchorNode) return;
                              let n = sel.anchorNode.nodeType===3 ? sel.anchorNode.parentElement : sel.anchorNode;
                              while (n && n.tagName && !['h1','p','div'].includes(n.tagName.toLowerCase())) n = n.parentElement;
                              if (n && n.tagName && n.tagName.toLowerCase() === 'h1') {
                                const p = document.createElement('p');
                                p.innerHTML = n.innerHTML;
                                n.parentNode && n.parentNode.replaceChild(p, n);
                              } else {
                                document.execCommand('formatBlock', false, 'h1');
                              }
                            } catch(e) {}
                          })();
                        `);
                        setTimeout(() => { snapshotFromEditor(); }, 120);
                      }, 40);
                      return;
                    }

                    setTimeout(() => {
                      richRef.current?.sendAction?.(action as any);
                    }, 50);
                  }}
                />
                {showHlPicker && (
                  <View style={styles.hlRow}>
                    {['transparent', '#FBCFE8', '#DDD6FE', '#BFDBFE', '#BBF7D0', '#FDE68A', '#FED7AA', '#CFFAFE', '#E9D5FF', '#FFF59D'].map(c => (
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
                          }, 60);
                        }}
                        style={[styles.hlSwatch, { backgroundColor: c === 'transparent' ? colors.surface : c, borderColor: hlColor === c ? '#5B4EFA' : colors.border }]}
                      >
                        {c === 'transparent' && <Eraser size={12} color={colors.textSecondary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginTop: 12 }]}>Content</Text>
              <View style={[styles.richShell, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
                <View onLayout={(e) => setToolbarY(e.nativeEvent.layout.y)} />
                <RichNoteEditor
                  key={editorKey}
                  ref={richRef}
                  html={body}
                  onChange={setBody}
                  onFocus={() => {
                    setActiveLevel(null);
                    if (scrollRef.current && toolbarY > 0) {
                      (scrollRef.current as any).scrollTo({ y: Math.max(toolbarY - 10, 0), animated: true });
                    }
                  }}
                  themeColors={{
                    bg: colors.surfaceStrong,
                    surface: colors.surface,
                    textPrimary: colors.textPrimary,
                    border: colors.border,
                    primary: '#5B4EFA',
                  }}
                  editorStyle={{ minHeight: keyboardOpen ? 260 : 320 }}
                  placeholder="Edit explanation — bold, lists, and highlights match Pilot notes."
                />
                <TouchableOpacity onPress={addSectionBreak} style={styles.splitBtn}>
                  <Plus size={14} color="#5B4EFA" />
                  <Text style={{ color: '#5B4EFA', fontWeight: '800', fontSize: 12 }}>Add block break in editor</Text>
                </TouchableOpacity>
              </View>
              {showAiPanel && (
                <View
                  style={[styles.aiPanel, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  onLayout={(e) => { aiPanelYRef.current = e.nativeEvent.layout.y; }}
                >
                  <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>AI command</Text>
                  <TextInput
                    ref={(r) => { aiInputRef.current = r; }}
                    value={aiPrompt}
                    onChangeText={setAiPrompt}
                    placeholder="Example: Convert to bullet points in Hindi"
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    editable={!aiBusy}
                    style={[styles.aiInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity
                      onPress={handleAiTransform}
                      disabled={aiBusy}
                      style={[styles.miniBtn, { backgroundColor: '#5B4EFA', flex: 1, opacity: aiBusy ? 0.6 : 1 }]}
                    >
                      {aiBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Run AI</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={async () => {
                        if (!aiOutput.trim()) return;
                        await Clipboard.setStringAsync(aiOutput);
                        Alert.alert('Copied', 'AI output copied. Paste it where you want.');
                      }}
                      style={[styles.miniBtn, { borderColor: colors.border, borderWidth: 1, flexDirection: 'row', gap: 6 }]}
                    >
                      <Copy size={14} color={colors.textPrimary} />
                      <Text style={{ color: colors.textPrimary, fontWeight: '700' }}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginTop: 10 }]}>AI output</Text>
                  <View style={[styles.aiOutputBox, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
                    <ScrollView style={{ maxHeight: 180 }}>
                      <Text style={{ color: colors.textPrimary, fontSize: 13, lineHeight: 20 }}>
                        {aiOutput || 'AI output will appear here. Your existing content remains unchanged.'}
                      </Text>
                    </ScrollView>
                  </View>
                </View>
              )}

              {savedNoteId && (
                <View style={[styles.savedRow, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Wand2 size={14} color="#047857" />
                  <Text style={{ color: '#047857', fontWeight: '600', fontSize: 13, flex: 1 }}>
                    Appended ({appendCount} block group{appendCount === 1 ? '' : 's'} saved this session). Same path appends to the same note.
                  </Text>
                </View>
              )}
            </ScrollView>
            )}

            {/* Footer actions */}
            {!keyboardOpen && (
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
            )}
            <PremiumMoveSheet
              visible={moveOpen}
              title="Change Directory"
              targets={moveTargets}
              currentSelectedId={selectedNodeId}
              allowCreate
              onCreate={async (name, parentId) => {
                if (!userId) return;
                const parent = parentId ? allNodes.find((n) => n.id === parentId) : null;
                const type: PilotV2Node['type'] =
                  !parent ? 'subject' :
                  parent.type === 'subject' ? 'topic' :
                  parent.type === 'topic' ? 'subtopic' :
                  parent.type === 'subtopic' ? 'subtopic' : 'subtopic';
                const created = await createPilotV2Node({
                  userId,
                  type,
                  title: name,
                  parentId: parentId || null,
                });
                if (created) {
                  await refreshHierarchy();
                  setSelectedNodeId(created.id);
                  applySelectionFromNode(created.id);
                }
              }}
              onClose={() => setMoveOpen(false)}
              onConfirm={(targetId) => {
                setSelectedNodeId(targetId);
                applySelectionFromNode(targetId);
                setMoveOpen(false);
              }}
            />
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  pathChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  selectorCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 10 },
  selectorItem: { paddingVertical: 10, borderBottomWidth: 1 },
  sheet: { width: '94%', maxWidth: 520, borderRadius: 28, padding: 18, paddingBottom: 22, overflow: 'hidden' },
  toolbarSticky: {
    borderBottomWidth: 1,
    paddingTop: 2,
    paddingBottom: 2,
    marginBottom: 8,
    // Stretch to sheet edges (iPad-friendly)
    marginHorizontal: -18,
    paddingHorizontal: 8,
  },
  formGroup: {
    marginBottom: 6,
  },
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
  aiPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
  },
  aiInput: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  aiOutputBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
});

export default PilotV2SaveSheet;
