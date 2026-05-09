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
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  ScrollView, Platform, KeyboardAvoidingView, Alert, ActivityIndicator,
  useWindowDimensions, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Rocket, X, Plus, Wand2, ChevronDown } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { SUBJECT_TOPICS } from './PilotV2SidebarSubject';
import { PILOT_V2_SUBJECT_PALETTE } from './types';
import {
  findOrCreatePilotV2Note,
  appendBlocksToPilotV2Note,
  fetchNotebooksAtLevel,
} from '../../repositories/pilotV2Repo';
import { PilotV2Block } from './types';

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
  /** Editable explanation/answer text. */
  initialBody: string;
  /** Source attribution (e.g. "Quiz / Polity 2024"). */
  source?: string;
}

export const PilotV2SaveSheet: React.FC<Props> = ({
  visible, userId, onClose, autoSeed, initialBody, source,
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

  useEffect(() => {
    if (!visible) return;
    setSubject(autoSeed.subject || '');
    setTopic(autoSeed.topic || '');
    setSubtopic(autoSeed.subtopic || '');
    setNotebook(autoSeed.notebookTitle || autoSeed.subtopic || autoSeed.topic || autoSeed.subject || '');
    setBody(initialBody || '');
    setSavedNoteId(null);
    setAppendCount(0);
  }, [visible, autoSeed, initialBody]);

  // Helper: Get all subjects
  const allSubjects = useMemo(() => PILOT_V2_SUBJECT_PALETTE.map(s => s.label), []);

  // Helper: Get topics for selected subject
  const allTopics = useMemo(() => {
    const subjectData = PILOT_V2_SUBJECT_PALETTE.find(s => s.label === subject);
    if (!subjectData) return [];
    const topicsList = SUBJECT_TOPICS[subjectData.id] || [];
    return topicsList.map(t => t.label);
  }, [subject]);

  // Helper: Get subtopics for selected topic
  const allSubtopics = useMemo(() => {
    const subjectData = PILOT_V2_SUBJECT_PALETTE.find(s => s.label === subject);
    if (!subjectData) return [];
    const topicsList = SUBJECT_TOPICS[subjectData.id] || [];
    const selectedTopic = topicsList.find(t => t.label === topic);
    return selectedTopic?.subtopics?.map(st => st.label) || [];
  }, [subject, topic]);

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

      // Auto-select first if exists
      if (notebooks.length > 0) {
        setNotebook(notebooks[0]);
        setMode('select');
      }
    })();
  }, [subject, topic, subtopic, visible, userId]);

  const blocksPreview = useMemo(() => textToPilotV2Blocks(body), [body]);

  const canSave = !!userId && subject.trim().length > 0 && notebook.trim().length > 0 && body.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const notebookTitle = notebook.trim();
      const result = await findOrCreatePilotV2Note({
        userId,
        subject: subject.trim(),
        topic: topic.trim() || null,
        subtopic: subtopic.trim() || null,
        title: notebookTitle,
      });
      const blocks: PilotV2Block[] = [
        // Soft separator heading carries the source attribution so multiple
        // saves to the same note remain distinguishable.
        { id: newId(), type: 'heading', level: 3, text: source ? `📌 ${source}` : '📌 Saved from Quiz' },
        ...blocksPreview,
      ];
      const ok = await appendBlocksToPilotV2Note(result.noteId, blocks);
      if (!ok) throw new Error('append failed');
      setSavedNoteId(result.noteId);
      setAppendCount(c => c + 1);
      
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

              <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginTop: 12 }]}>Content</Text>
              <TextInput
                testID="pilot-v2-save-body"
                value={body}
                onChangeText={setBody}
                multiline
                placeholder="The explanation, bullets or answer text. Edit freely before saving."
                placeholderTextColor={colors.textTertiary}
                style={[styles.bodyInput, {
                  color: colors.textPrimary,
                  borderColor: colors.border,
                  backgroundColor: colors.surfaceStrong,
                  minHeight: isTablet ? 320 : 120,
                }]}
              />

              <Text style={[styles.preview, { color: colors.textTertiary }]}>
                Will create {blocksPreview.length} block{blocksPreview.length === 1 ? '' : 's'} (paragraphs, bullets &amp; headings).
              </Text>

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
});

export default PilotV2SaveSheet;
