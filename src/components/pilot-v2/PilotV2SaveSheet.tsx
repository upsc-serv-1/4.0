/**
 * PilotV2SaveSheet — flashcard-style save popup for Pilot V2.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AIPromptManager, DEFAULT_SAVE_SHEET_TEMPLATES, PromptTemplate } from '../../services/AIPromptManager';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Platform, Alert, ActivityIndicator,
  useWindowDimensions, Keyboard, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Rocket, X, Plus, Wand2, Highlighter, Eraser, Undo2, Redo2, Brain, Copy, Clipboard, Folder, FileText, Home, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react-native';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import RichNoteEditor from '../RichNoteEditor';
import { htmlToPilotV2Blocks } from './htmlToPilotV2Blocks';
import { useTheme } from '../../context/ThemeContext';
import { PilotV2HierarchyPicker } from './PilotV2HierarchyPicker';
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
import * as ExpoClipboard from 'expo-clipboard';
import { aiTransformNoteContent } from '../../services/GeminiService';

const STORAGE_LAST_USED = 'pilot-v2:save-sheet:last-used';
const STORAGE_SAVE_SHEET_AI_PROMPT = 'pilot-v2:save-sheet:ai-preset-prompt';
const STORAGE_HEADER_INCLUDE = 'pilot-v2:save-sheet:include-header';
const STORAGE_HEADER_STYLE = 'pilot-v2:save-sheet:header-style';
const STORAGE_CUSTOM_HEADER = 'pilot-v2:save-sheet:custom-header';
const STORAGE_PAGE_LAYOUT = 'pilot-v2:save-sheet:page-layout';
type LastUsed = { subject?: string; topic?: string; subtopic?: string; notebook?: string; };
type HeaderStyle = 'auto-title' | 'question-only' | 'custom' | 'none';
const readLastUsed = async (): Promise<LastUsed> => {
  try { const raw = await AsyncStorage.getItem(STORAGE_LAST_USED); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
};
const writeLastUsed = (next: LastUsed) => { AsyncStorage.setItem(STORAGE_LAST_USED, JSON.stringify(next)).catch(() => null); };

const newId = () =>
  (typeof crypto !== 'undefined' && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : `pv2_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export function textToPilotV2Blocks(text: string): PilotV2Block[] {
  const trimmed = (text || '').trim(); if (!trimmed) return [];
  return trimmed.split(/\r?\n/).map(raw => {
    const line = raw.replace(/<br\s*\/?>(?=\s*\n?)/gi, '').replace(/<[^>]+>/g, '').trim();
    if (line.startsWith('# ')) return { id: newId(), type: 'heading' as const, level: 1, text: line.slice(2).trim() };
    if (line.startsWith('## ')) return { id: newId(), type: 'heading' as const, level: 2, text: line.slice(3).trim() };
    if (line.startsWith('- ') || line.startsWith('* ')) return { id: newId(), type: 'bullet' as const, text: line.slice(2).trim() };
    if (/^\d+\.\s+/.test(line)) return { id: newId(), type: 'numbered' as const, text: line.replace(/^\d+\.\s+/, '').trim() };
    return { id: newId(), type: 'paragraph' as const, text: line };
  });
}

function markdownishToHtml(text: string): string {
  if (!text || /<[a-zA-Z]/.test(text)) return text;
  let t = text.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/__([^_]+)__/g, '<u>$1</u>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  const lines = t.split(/\r?\n/), out: string[] = []; let inUl = false;
  for (const ln of lines) {
    if (/^\s*[-*]\s+/.test(ln)) { if (!inUl) { out.push('<ul>'); inUl = true; } out.push(`<li>${ln.replace(/^\s*[-*]\s+/, '')}</li>`); }
    else { if (inUl) { out.push('</ul>'); inUl = false; } if (ln.trim() === '') out.push('<p><br></p>'); else if (/^<h[1-3]>/.test(ln)) out.push(ln); else out.push(`<p>${ln}</p>`); }
  }
  if (inUl) out.push('</ul>'); return out.join('\n');
}

export type PilotSaveSeedQuestion = {
  subject?: string | null; section_group?: string | null; micro_topic?: string | null;
  statement_line?: string | null; question_text?: string | null;
};

interface Props {
  visible: boolean; userId: string; onClose: () => void;
  autoSeed: { subject?: string | null; topic?: string | null; subtopic?: string | null; notebookTitle?: string | null; };
  seedQuestion?: PilotSaveSeedQuestion | null; initialBody: string; source?: string;
}



export const PilotV2SaveSheet: React.FC<Props> = ({
  visible, userId, onClose, autoSeed, seedQuestion, initialBody, source,
}) => {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [subject, setSubject]     = useState(autoSeed?.subject || '');
  const [topic, setTopic]         = useState(autoSeed?.topic || '');
  const [subtopic, setSubtopic]   = useState(autoSeed?.subtopic || '');
  const [notebook, setNotebook]   = useState(autoSeed?.notebookTitle || '');
  const [body, setBody]           = useState(markdownishToHtml(initialBody || ''));
  const richRef = useRef<any>(null);
  const [showHlPicker, setShowHlPicker] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const aiInputRef = useRef<TextInput | null>(null);
  const [hlColor, setHlColor] = useState('#FFF59D');
  const [editorKey, setEditorKey] = useState(0);
  const [saving, setSaving]       = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [appendCount, setAppendCount] = useState(0);
  const [includeHeader, setIncludeHeader] = useState(true);
  const [headerStyle, setHeaderStyle] = useState<HeaderStyle>('auto-title');
  const [customHeader, setCustomHeader] = useState('');
  const [aiHeaderPreset, setAiHeaderPreset] = useState('');
  const [pageLayout, setPageLayout] = useState<'standard' | 'wide'>('standard');
  const [hierarchyPickerOpen, setHierarchyPickerOpen] = useState(false);
  const [aiHeaderTemplates, setAiHeaderTemplates] = useState<PromptTemplate[]>([]);
  const [selectedAiTemplateKey, setSelectedAiTemplateKey] = useState<string>('');
  const [allNodes, setAllNodes] = useState<PilotV2Node[]>([]);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView | null>(null);
  const [toolbarY, setToolbarY] = useState<number>(0);

  const snapshotFromEditor = async () => {
    try { const html = await richRef.current?.getContentHtml?.(); if (typeof html === 'string') setBody(html); } catch {}
  };

  const handlePasteFormatted = async () => {
    const text = await ExpoClipboard.getStringAsync();
    if (!text) return;
    const html = markdownishToHtml(text);
    richRef.current?.insertHTML(html);
    setTimeout(async () => { const live = await richRef.current?.getContentHtml?.(); if (live) setBody(live); }, 100);
  };

  const [userHierarchy, setUserHierarchy] = useState<{
    subjects: string[]; topicsBySubject: Record<string, string[]>; subtopicsByTopic: Record<string, string[]>;
  }>({ subjects: [], topicsBySubject: {}, subtopicsByTopic: {} });

  const loadData = useCallback(async () => {
    if (!userId) return;
    const [opts, nodes] = await Promise.all([
      fetchPilotV2HierarchyOptions(userId),
      fetchCanonicalPilotV2Nodes(userId, false),
    ]);
    setUserHierarchy(opts);
    setAllNodes(nodes);
  }, [userId]);

  useEffect(() => {
    if (!visible || !userId) return;
    let cancelled = false;
    (async () => {
      await loadData();
      const [headerIncStr, headerStyleStr, customHeaderStr, layoutStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_HEADER_INCLUDE),
        AsyncStorage.getItem(STORAGE_HEADER_STYLE),
        AsyncStorage.getItem(STORAGE_CUSTOM_HEADER),
        AsyncStorage.getItem(STORAGE_PAGE_LAYOUT),
      ]);
      if (!cancelled) {
        setIncludeHeader(headerIncStr !== 'false');
        setHeaderStyle((headerStyleStr as HeaderStyle) || 'auto-title');
        setCustomHeader(customHeaderStr || '');
        if (layoutStr === 'wide' || layoutStr === 'standard') setPageLayout(layoutStr);
      }
      // Load AI header templates
      try {
        const mgr = AIPromptManager.getInstance();
        const templates = await mgr.fetchPromptTemplates(userId, 'save_sheet');
        setAiHeaderTemplates(templates.length > 0 ? templates : DEFAULT_SAVE_SHEET_TEMPLATES);
        if (templates.length > 0) {
          setSelectedAiTemplateKey(templates[0].template_key);
          setAiHeaderPreset(templates[0].prompt_text);
        }
      } catch {
        setAiHeaderTemplates(DEFAULT_SAVE_SHEET_TEMPLATES);
        if (DEFAULT_SAVE_SHEET_TEMPLATES.length > 0) {
          setSelectedAiTemplateKey(DEFAULT_SAVE_SHEET_TEMPLATES[0].template_key);
          setAiHeaderPreset(DEFAULT_SAVE_SHEET_TEMPLATES[0].prompt_text);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [visible, userId, loadData]);

  const wasVisibleRef = useRef(false);
  const initialBodySnapshot = useRef('');
  const autoSeedSnapshot = useRef(autoSeed);

  useEffect(() => {
    if (!visible) { wasVisibleRef.current = false; return; }
    if (wasVisibleRef.current) return;
    wasVisibleRef.current = true;
    initialBodySnapshot.current = initialBody || '';
    autoSeedSnapshot.current = autoSeed;

    setBody(markdownishToHtml(initialBody || ''));
    setSavedNoteId(null); setAppendCount(0); setEditorKey(k => k + 1);

    let cancelled = false;
    (async () => {
      const last = await readLastUsed();
      if (cancelled) return;
      const seed = autoSeedSnapshot.current;
      setSubject(seed?.subject || last.subject || '');
      setTopic(seed?.topic || last.topic || '');
      setSubtopic(seed?.subtopic || last.subtopic || '');
      setNotebook(seed?.notebookTitle || last.notebook || seed?.subtopic || seed?.topic || seed?.subject || '');
    })();
    setSavedNoteId(null); setAppendCount(0); setEditorKey(k => k + 1);
    AsyncStorage.getItem(STORAGE_SAVE_SHEET_AI_PROMPT).then(preset => { setAiPrompt(preset?.trim() || ''); });
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e: any) => { setKeyboardOpen(true); setKeyboardHeight(typeof e?.endCoordinates?.height === 'number' ? e.endCoordinates.height : 0); });
    const h = Keyboard.addListener(hideEvt, () => { setKeyboardOpen(false); setKeyboardHeight(0); });
    return () => { s.remove(); h.remove(); };
  }, []);

  const plainTextLen = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().length;
  const canSave = !!userId && subject.trim().length > 0 && notebook.trim().length > 0 && plainTextLen(body) > 0;

  const generateHeaderText = async (): Promise<string> => {
    if (!includeHeader || headerStyle === 'none') return '';
    if (headerStyle === 'question-only') return seedQuestion?.statement_line || seedQuestion?.question_text || '';
    if (headerStyle === 'custom') return customHeader.trim() || 'Note';
    if (headerStyle === 'ai-header') {
      // Use AI to generate header from question + options + explanation context
      const questionText = seedQuestion?.statement_line || seedQuestion?.question_text || '';
      const optionsText = seedQuestion?.section_group || '';
      const explanationText = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim().slice(0, 500);
      const context = `QUESTION: ${questionText}\nOPTIONS: ${optionsText}\nEXPLANATION: ${explanationText}`;
      if (!context.trim() || context === 'QUESTION: \nOPTIONS: \nEXPLANATION: ') return notebook || 'Explanation';
      try {
        const prompt = aiHeaderPreset.trim() || 'Generate a concise 5-7 word header/title summarizing the main topic of the question, options, and explanation below. Output ONLY the header text, no quotes or formatting.';
        const result = await aiTransformNoteContent(context, prompt);
        return result.replace(/["""]/g, '').trim().slice(0, 100) || notebook || 'Explanation';
      } catch {
        return notebook || 'Explanation';
      }
    }
    const stem = ((seedQuestion?.statement_line || seedQuestion?.question_text || '') as string).trim();
    const short = stem.length > 100 ? `${stem.slice(0, 97)}…` : stem;
    return short || notebook || (source ? source.replace(/^Quiz\s*\/?\/s*/i, '').trim() : '') || 'Explanation';
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      let html = body;
      try { const fe = await richRef.current?.getContentHtml?.(); if (typeof fe === 'string' && fe.trim()) html = fe; } catch {}

      const result = await findOrCreatePilotV2Note({
        userId, subject: subject.trim(), topic: topic.trim() || null, subtopic: subtopic.trim() || null,
        title: notebook.trim(), layout: pageLayout,
      });
      const headerText = await generateHeaderText();
      const blocks: PilotV2Block[] = [];
      if (includeHeader && headerText.trim()) blocks.push({ id: newId(), type: 'heading', level: 2, text: headerText, meta: { tag: 'quiz_import', source: source || 'quiz' } });

      const contentBlocks = htmlToPilotV2Blocks(html);
      if (contentBlocks.length === 0) blocks.push({ id: newId(), type: 'paragraph', text: html.trim(), meta: { tag: 'quiz_import', importedAt: new Date().toISOString(), source: source || 'quiz' } });
      else { contentBlocks.forEach(b => { (b as any).meta = { tag: 'quiz_import', importedAt: new Date().toISOString(), source: source || 'quiz' }; }); blocks.push(...contentBlocks); }

      const ok = await appendBlocksToPilotV2Note(result.noteId, blocks);
      if (!ok) throw new Error('append failed');
      setSavedNoteId(result.noteId); setAppendCount(c => c + 1);
      writeLastUsed({ subject: subject.trim(), topic: topic.trim(), subtopic: subtopic.trim(), notebook: notebook.trim() });
      AsyncStorage.setItem(STORAGE_HEADER_INCLUDE, includeHeader.toString()).catch(() => null);
      AsyncStorage.setItem(STORAGE_HEADER_STYLE, headerStyle).catch(() => null);
      AsyncStorage.setItem(STORAGE_CUSTOM_HEADER, customHeader).catch(() => null);
      AsyncStorage.setItem(STORAGE_PAGE_LAYOUT, pageLayout).catch(() => null);
      Alert.alert('Saved!', result.isNew ? `Created: "${notebook.trim()}"` : `Appended to: "${notebook.trim()}"`);
    } catch (e) { Alert.alert('Could not save', (e as Error).message || 'Please try again.'); }
    finally { setSaving(false); }
  };

  const handleOpen = () => { onClose(); router.push('/pilot-v2'); };
  const handleSaveAnother = () => { setBody(''); setSavedNoteId(null); setEditorKey(k => k + 1); };

  const handleAiTransform = async () => {
    const plain = body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').trim();
    if (!plain) { Alert.alert('No content', 'Add content first.'); return; }
    if (!aiPrompt.trim()) { Alert.alert('Command required', 'Enter an AI command.'); return; }
    setAiBusy(true);
    try { const t = await aiTransformNoteContent(plain, aiPrompt.trim()); setAiOutput(t); setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 300); }
    catch (e: any) { Alert.alert('AI failed', e?.message || 'Could not process.'); }
    finally { setAiBusy(false); }
  };

  const handleInsertAiOutput = () => {
    if (!aiOutput.trim()) return;
    const aiHtml = markdownishToHtml(aiOutput);
    setBody(prev => (prev || '').trim() ? `${prev}<p><br></p>${aiHtml}` : aiHtml);
    setEditorKey(k => k + 1); setAiOutput(''); setAiPrompt(''); setShowAiPanel(false);
    Alert.alert('Inserted', 'AI output inserted.');
  };

  const handleCreateNotebook = async (subj: string, top: string, sub: string, name: string) => {
    try {
      await findOrCreatePilotV2Note({ userId, subject: subj, topic: top || null, subtopic: sub || null, title: name, layout: pageLayout });
      setSubject(subj); setTopic(top); setSubtopic(sub); setNotebook(name);
      await loadData();
    } catch { Alert.alert('Error', 'Could not create notebook.'); }
  };

  const handleHierarchySelect = (subj: string, top: string, sub: string, nb: string) => {
    setSubject(subj); setTopic(top); setSubtopic(sub); setNotebook(nb);
  };

  type HeaderStyle = 'auto-title' | 'question-only' | 'custom' | 'none' | 'ai-header';
  const headerOptions: { key: HeaderStyle; label: string }[] = [
    { key: 'auto-title', label: 'Auto' }, { key: 'question-only', label: 'Q Only' },
    { key: 'ai-header', label: 'AI' }, { key: 'custom', label: 'Custom' }, { key: 'none', label: 'None' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { justifyContent: 'flex-start', alignItems: 'stretch', paddingVertical: 0 }]}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={[StyleSheet.absoluteFill, { zIndex: 1 }]} />
        <View style={{ flex: 1, paddingTop: 16, paddingBottom: keyboardOpen ? 0 : 16, zIndex: 10 }}>
          <View testID="pilot-v2-save-sheet" style={[{ flex: 1, backgroundColor: colors.surface, borderRadius: 28, overflow: 'hidden' }]}>

            {/* ── TOP SECTION ── */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <View style={styles.header}>
                <View style={[styles.brand, { backgroundColor: '#5B4EFA' }]}>
                  <Rocket size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>Save to Pilot V2</Text>
                  <Text style={[styles.subtitle, { color: colors.textTertiary }]}>Select directory & notebook</Text>
                </View>
                <TouchableOpacity onPress={onClose} testID="pilot-v2-save-close" style={styles.closeBtn}>
                  <X size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* Directory selection bar */}
              <TouchableOpacity
                onPress={() => setHierarchyPickerOpen(true)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: '#EEECFF', borderWidth: 1.5, borderColor: '#5B4EFA', marginBottom: 8 }}>
                <Folder size={18} color="#5B4EFA" />
                <Text style={{ flex: 1, color: '#5B4EFA', fontWeight: '700', fontSize: 13 }}>
                  {subject ? `${subject}${topic ? ` → ${topic}` : ''}${subtopic ? ` → ${subtopic}` : ''}${notebook ? ` → ${notebook}` : ''}` : 'Choose Directory & Notebook'}
                </Text>
                <ChevronRight size={18} color="#5B4EFA" />
              </TouchableOpacity>

              {/* Include Header: now 3 rows for 5 options: Auto, Q Only, AI, Custom, None */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
                <Text style={{ color: colors.textTertiary, fontSize: 10, fontWeight: '700', marginRight: 8, minWidth: 44 }}>Header</Text>
                <View style={{ flex: 1, flexDirection: 'column', gap: 4 }}>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {headerOptions.slice(0, 3).map(opt => {
                      const active = (includeHeader && headerStyle === opt.key) || (!includeHeader && opt.key === 'none');
                      return (
                        <TouchableOpacity key={opt.key} onPress={() => { setHeaderStyle(opt.key as any); setIncludeHeader(opt.key !== 'none'); }}
                          style={{ flex: 1, paddingVertical: 4, borderRadius: 5, backgroundColor: active ? '#5B4EFA' : colors.surfaceStrong, borderWidth: 1, borderColor: active ? '#5B4EFA' : colors.border, alignItems: 'center' }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: active ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {headerOptions.slice(3, 5).map(opt => {
                      const active = (includeHeader && headerStyle === opt.key as HeaderStyle) || (!includeHeader && opt.key === 'none');
                      return (
                        <TouchableOpacity key={opt.key} onPress={() => { setHeaderStyle(opt.key as any); setIncludeHeader(opt.key !== 'none'); }}
                          style={{ flex: 1, paddingVertical: 4, borderRadius: 5, backgroundColor: active ? '#5B4EFA' : colors.surfaceStrong, borderWidth: 1, borderColor: active ? '#5B4EFA' : colors.border, alignItems: 'center' }}>
                          <Text style={{ fontSize: 9, fontWeight: '700', color: active ? '#fff' : colors.textSecondary }}>{opt.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>

              {includeHeader && headerStyle === 'ai-header' && (
                <View style={{ marginBottom: 4 }}>
                  {/* Show available AI prompt templates from Settings */}
                  <Text style={{ color: colors.textTertiary, fontSize: 9, fontWeight: '700', marginBottom: 4 }}>Choose AI Template:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                    {aiHeaderTemplates.map(t => {
                      const isActive = selectedAiTemplateKey === t.template_key;
                      return (
                        <TouchableOpacity key={t.template_key}
                          onPress={() => {
                            setSelectedAiTemplateKey(t.template_key);
                            setAiHeaderPreset(t.prompt_text);
                          }}
                          style={{ paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, backgroundColor: isActive ? '#5B4EFA' : colors.surfaceStrong, borderWidth: 1, borderColor: isActive ? '#5B4EFA' : colors.border, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                          {t.button_emoji ? <Text style={{ fontSize: 11 }}>{t.button_emoji}</Text> : null}
                          <Text style={{ fontSize: 9, fontWeight: '700', color: isActive ? '#fff' : colors.textSecondary }}>{t.button_label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={{ color: colors.textTertiary, fontSize: 8, marginTop: 2 }}>Manage templates in Profile → AI Settings → Save Sheet tab.</Text>
                </View>
              )}

              {includeHeader && headerStyle === 'custom' && (
                <TextInput placeholder="Custom header title..." placeholderTextColor={colors.textTertiary}
                  value={customHeader} onChangeText={setCustomHeader} maxLength={200}
                  style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, color: colors.textPrimary, marginBottom: 4 }}
                />
              )}
            </View>

            {/* ── SCROLLABLE AREA ── */}
            <ScrollView
              ref={(r) => { scrollRef.current = r as any; }}
              style={{ flex: 1 }} keyboardShouldPersistTaps="always"
              contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: keyboardOpen ? keyboardHeight + 60 : 80 }}
            >
              {!showAiPanel && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginBottom: 0 }]}>Content</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <TouchableOpacity onPress={handlePasteFormatted}
                      style={{ width: 26, height: 26, borderRadius: 5, backgroundColor: '#EEECFF', borderColor: '#5B4EFA', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Clipboard size={11} color="#5B4EFA" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => { try { const h = await richRef.current?.getContentHtml?.(); if (h?.trim()) { await ExpoClipboard.setStringAsync(h); Alert.alert('Copied', 'Copied.'); } else Alert.alert('Empty', 'Nothing.'); } catch { Alert.alert('Error', 'Failed.'); } }}
                      style={{ width: 26, height: 26, borderRadius: 5, backgroundColor: '#EEECFF', borderColor: '#5B4EFA', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <Copy size={11} color="#5B4EFA" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setShowAiPanel(v => !v); setAiOutput(''); setAiPrompt(''); }}
                      style={{ width: 26, height: 26, borderRadius: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEECFF' }}>
                      <Brain size={13} color="#5B4EFA" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {!showAiPanel ? (
                <View style={[styles.richShell, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
                  <View style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                    <RichToolbar
                      getEditor={() => richRef.current} selectedIconTint="#5B4EFA" iconTint={colors.textPrimary}
                      style={{ backgroundColor: 'transparent', height: 40 }}
                      actions={[actions.undo, actions.redo, actions.setBold, actions.setItalic, actions.setUnderline, actions.heading1, actions.heading2, actions.insertBulletsList, actions.insertOrderedList, 'highlight']}
                      iconMap={{
                        [actions.undo]: ({ tintColor }: any) => <Undo2 size={15} color={tintColor} />,
                        [actions.redo]: ({ tintColor }: any) => <Redo2 size={15} color={tintColor} />,
                        [actions.heading1]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '900', fontSize: 12 }}>H1</Text>,
                        [actions.heading2]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '800', fontSize: 10 }}>H2</Text>,
                        highlight: ({ tintColor }: any) => <View style={{ padding: 3, borderRadius: 3, backgroundColor: hlColor === 'transparent' ? 'transparent' : hlColor }}><Highlighter size={14} color={tintColor} /></View>,
                      }}
                      onPress={(action: any) => {
                        if (action === 'highlight') { setShowHlPicker(v => !v); return; }
                        richRef.current?.focusContentEditor?.();
                        if (action === actions.heading1) {
                          richRef.current?.commandDOM?.(`(function(){try{const s=window.getSelection&&window.getSelection();if(s&&s.rangeCount){window.__pv2_savedRange=s.getRangeAt(0);}}catch(e){}})();`);
                          setTimeout(() => {
                            richRef.current?.commandDOM?.(`(function(){try{const s=window.getSelection&&window.getSelection();if(window.__pv2_savedRange&&s){s.removeAllRanges();s.addRange(window.__pv2_savedRange);}}catch(e){}try{const sel=window.getSelection&&window.getSelection();if(!sel||!sel.anchorNode)return;let n=sel.anchorNode.nodeType===3?sel.anchorNode.parentElement:sel.anchorNode;while(n&&n.tagName&&!['h1','p','div'].includes(n.tagName.toLowerCase()))n=n.parentElement;if(n&&n.tagName&&n.tagName.toLowerCase()==='h1'){const p=document.createElement('p');p.innerHTML=n.innerHTML;n.parentNode&&n.parentNode.replaceChild(p,n);}else{document.execCommand('formatBlock',false,'h1');}}catch(e){}})();`);
                            setTimeout(() => { snapshotFromEditor(); }, 120);
                          }, 40);
                          return;
                        }
                        setTimeout(() => { richRef.current?.sendAction?.(action as any); }, 50);
                      }}
                    />
                    {showHlPicker && (
                      <View style={styles.hlRow}>
                        {['transparent', '#FBCFE8', '#DDD6FE', '#BFDBFE', '#BBF7D0', '#FDE68A', '#FED7AA', '#CFFAFE', '#FFF59D'].map(c => (
                          <TouchableOpacity key={c} onPress={() => { setHlColor(c); setShowHlPicker(false); richRef.current?.focusContentEditor?.(); setTimeout(() => { if (c === 'transparent') richRef.current?.commandDOM?.("document.execCommand('hiliteColor',false,'transparent')"); else richRef.current?.commandDOM?.(`document.execCommand('hiliteColor',false,'${c}')`); }, 60); }} style={[styles.hlSwatch, { backgroundColor: c === 'transparent' ? colors.surface : c, borderColor: hlColor === c ? '#5B4EFA' : colors.border }]}>
                            {c === 'transparent' && <Eraser size={10} color={colors.textSecondary} />}
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <View onLayout={(e) => setToolbarY(e.nativeEvent.layout.y)} />
                  <RichNoteEditor
                    key={editorKey} ref={richRef} html={body} onChange={setBody}
                    onFocus={() => {}}
                    themeColors={{ bg: colors.surfaceStrong, surface: colors.surface, textPrimary: colors.textPrimary, border: colors.border, primary: '#5B4EFA' }}
                    editorStyle={{ minHeight: keyboardOpen ? 200 : 280 }}
                    placeholder="Edit explanation — bold, lists, and highlights match Pilot notes."
                  />
                </View>
              ) : (
                <View style={[styles.aiPanel, { borderColor: colors.border, backgroundColor: colors.surface, marginTop: 0 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginBottom: 0 }]}>AI Transform</Text>
                    <TouchableOpacity onPress={() => { setShowAiPanel(false); setAiOutput(''); setAiPrompt(''); }} style={{ padding: 4 }}><X size={14} color={colors.textPrimary} /></TouchableOpacity>
                  </View>
                  <TextInput ref={(r) => { aiInputRef.current = r; }} value={aiPrompt} onChangeText={setAiPrompt}
                    placeholder="Example: Convert to bullet points in Hindi" placeholderTextColor={colors.textTertiary}
                    multiline editable={!aiBusy}
                    style={[styles.aiInput, { borderColor: colors.border, color: colors.textPrimary, backgroundColor: colors.surfaceStrong }]}
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={handleAiTransform} disabled={aiBusy}
                      style={[styles.miniBtn, { backgroundColor: '#5B4EFA', flex: 1, opacity: aiBusy ? 0.6 : 1 }]}>
                      {aiBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Run AI</Text>}
                    </TouchableOpacity>
                  </View>
                  {aiOutput ? (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textTertiary, marginBottom: 0 }]}>AI output</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          <TouchableOpacity onPress={async () => { if (!aiOutput.trim()) return; await ExpoClipboard.setStringAsync(aiOutput); Alert.alert('Copied', 'Copied.'); }}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border }}>
                            <Copy size={10} color={colors.textPrimary} />
                            <Text style={{ color: colors.textPrimary, fontSize: 9, fontWeight: '700' }}>Copy</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={handleInsertAiOutput}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: '#5B4EFA', borderWidth: 1, borderColor: '#5B4EFA' }}>
                            <Plus size={10} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>Insert</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <View style={[styles.aiOutputBox, { borderColor: colors.border, backgroundColor: colors.surfaceStrong, marginTop: 4 }]}>
                        <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>{aiOutput}</Text>
                      </View>
                    </>
                  ) : null}
                </View>
              )}

              {savedNoteId && (
                <View style={[styles.savedRow, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Wand2 size={14} color="#047857" />
                  <Text style={{ color: '#047857', fontWeight: '600', fontSize: 12, flex: 1 }}>
                    Appended ({appendCount} block group{appendCount === 1 ? '' : 's'} saved).
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* ── FOOTER ── */}
            {!keyboardOpen && (
              <View style={[styles.footer, { borderTopColor: colors.border, paddingHorizontal: 16 }]}>
                {savedNoteId ? (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity testID="pilot-v2-save-another" style={[styles.btnGhost, { borderColor: colors.border }]} onPress={handleSaveAnother}>
                      <Plus size={14} color={colors.textPrimary} />
                      <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 13 }}>Save another</Text>
                    </TouchableOpacity>
                    <TouchableOpacity testID="pilot-v2-save-open" style={[styles.btnPrimary, { backgroundColor: '#5B4EFA', flex: 1 }]} onPress={handleOpen}>
                      <Text style={styles.btnPrimaryText}>Open in Pilot V2</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity testID="pilot-v2-save-confirm" disabled={!canSave || saving}
                    onPress={handleSave} style={[styles.btnPrimary, { backgroundColor: '#5B4EFA', opacity: canSave && !saving ? 1 : 0.5 }]}>
                    {saving ? <ActivityIndicator color="#fff" size="small" /> : (
                      <><Rocket size={14} color="#fff" /><Text style={styles.btnPrimaryText}>Save to Pilot V2</Text></>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── FLASHCARD-STYLE HIERARCHY PICKER ── */}
      <PilotV2HierarchyPicker
        mode="save"
        visible={hierarchyPickerOpen}
        allNodes={allNodes}
        currentSubject={subject}
        currentTopic={topic}
        currentSubtopic={subtopic}
        currentNotebook={notebook}
        colors={colors}
        userId={userId}
        onSelectSaveTarget={handleHierarchySelect}
        onClose={() => setHierarchyPickerOpen(false)}
        onRefresh={loadData}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', paddingVertical: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  brand: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 2 },
  closeBtn: { padding: 6 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 4 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  footer: { paddingTop: 12, marginTop: 8, borderTopWidth: 1 },
  btnPrimary: { height: 46, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  btnGhost: { height: 46, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  richShell: { borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginBottom: 8 },
  hlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' },
  hlSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  miniBtn: { paddingHorizontal: 14, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aiPanel: { borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8, marginBottom: 8 },
  aiInput: { borderWidth: 1, borderRadius: 10, minHeight: 40, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  aiOutputBox: { borderWidth: 1, borderRadius: 10, padding: 10 },
});

export default PilotV2SaveSheet;
