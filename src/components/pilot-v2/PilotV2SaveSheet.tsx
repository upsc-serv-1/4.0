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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Rocket, X, Plus, Wand2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import {
  findOrCreatePilotV2Note,
  appendBlocksToPilotV2Note,
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

  const [subject, setSubject]     = useState(autoSeed.subject || '');
  const [topic, setTopic]         = useState(autoSeed.topic || '');
  const [subtopic, setSubtopic]   = useState(autoSeed.subtopic || '');
  const [notebook, setNotebook]   = useState(autoSeed.notebookTitle || autoSeed.subtopic || autoSeed.topic || autoSeed.subject || '');
  const [body, setBody]           = useState(initialBody || '');
  const [saving, setSaving]       = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [appendCount, setAppendCount] = useState(0);

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

  const blocksPreview = useMemo(() => textToPilotV2Blocks(body), [body]);

  const canSave = !!userId && subject.trim().length > 0 && notebook.trim().length > 0 && body.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const result = await findOrCreatePilotV2Note({
        userId,
        subject: subject.trim(),
        topic: topic.trim() || null,
        subtopic: subtopic.trim() || null,
        title: notebook.trim(),
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
          <View
            testID="pilot-v2-save-sheet"
            style={[styles.sheet, { backgroundColor: colors.surface }]}
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

            <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
              <Field label="Subject" value={subject} onChange={setSubject} testID="pilot-v2-save-subject" />
              <Field label="Topic" value={topic} onChange={setTopic} testID="pilot-v2-save-topic" />
              <Field label="Subtopic / Microtopic" value={subtopic} onChange={setSubtopic} testID="pilot-v2-save-subtopic" />
              <Field label="Notebook title" value={notebook} onChange={setNotebook} testID="pilot-v2-save-notebook" />

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
});

export default PilotV2SaveSheet;
