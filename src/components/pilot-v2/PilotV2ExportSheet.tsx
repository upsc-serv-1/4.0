/**
 * PilotV2ExportSheet — Smart export panel (Step 3, v2.2).
 *
 * Mirrors the *Premium Move* flow used by the Flashcards module: a multi-step
 * sheet that walks the user through Hierarchy → Notebook → Block → Options
 * before committing the append. The aim is for *one* unified UX surface to
 * route a snippet of text into the correct nested block of the correct
 * notebook with zero guesswork.
 *
 * UX contract (from PILOT_V2_COMPLETE_ARCHITECTURE.md & PILOT_V2_GAPS.md):
 *   • SMART SUGGESTION  — `SmartBlockMatcher.suggestBestMatchingBlock` runs as
 *     soon as a notebook is selected; the top match shows a "✨ Suggested"
 *     banner and is auto-selected.
 *   • LAG-FREE LIST     — block list uses `FlatList` with windowing
 *     (`removeClippedSubviews`, `initialNumToRender`, `windowSize`) so a
 *     notebook with hundreds of blocks scrolls smoothly.
 *   • OFFLINE-FIRST     — when the user has no network the matcher falls back
 *     to instant local keyword search (also exposed via the search input).
 *   • LAST-USED MEMORY  — last-used notebook + block + format persist via
 *     AsyncStorage (`PilotV2UserPreferences`) and pre-select on next open.
 *   • SELECTIVE EXPORT  — Plain text / Markdown / PDF (via system share),
 *     scoped to either the whole note OR the chosen block.
 *
 * This component is purely presentational + composable: callers feed it a
 * snippet, an optional auto-seed hierarchy and the user id; it handles every
 * Supabase round-trip via the existing `pilotV2Repo` + `SmartBlockMatcher`.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, TextInput,
  Platform, KeyboardAvoidingView, Alert, ActivityIndicator,
  useWindowDimensions, FlatList, ScrollView, Share,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Rocket, X, Plus, ChevronDown, ChevronLeft, Check, Search, Sparkles,
  FileText, FileDown, Layers,
} from 'lucide-react-native';

import { useTheme } from '../../context/ThemeContext';
import { SUBJECT_TOPICS } from './PilotV2SidebarSubject';
import {
  PILOT_V2_SUBJECT_PALETTE,
  PilotV2Note,
  PilotV2NestedBlock,
  PilotV2UserPreferences,
  ensureNestedBlocks,
  flatBlocksToNested,
  nestedToFlatBlocks,
} from './types';
import {
  findOrCreatePilotV2Note,
  appendBlocksToPilotV2Note,
  fetchNotebooksAtLevel,
  fetchPilotV2NotesForUser,
} from '../../repositories/pilotV2Repo';
import { textToPilotV2Blocks } from './PilotV2SaveSheet';
import {
  suggestBestMatchingBlock,
  filterBlocksByQuery,
  BlockMatchCandidate,
} from '../../services/SmartBlockMatcher';

/* ------------------------------------------------------------------------- */
/* Constants                                                                  */
/* ------------------------------------------------------------------------- */

type Step = 'hierarchy' | 'notebook' | 'block' | 'options';

type ExportFormat = 'append' | 'plain' | 'markdown' | 'pdf';

const PREFERENCES_STORAGE_KEY = 'pilot_v2_user_preferences';

const ACCENT = '#5B4EFA';

/* ------------------------------------------------------------------------- */
/* Preferences storage                                                        */
/* ------------------------------------------------------------------------- */

async function loadPreferences(userId: string): Promise<PilotV2UserPreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(`${PREFERENCES_STORAGE_KEY}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as PilotV2UserPreferences;
    }
  } catch {}
  return null;
}

async function savePreferences(prefs: PilotV2UserPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(
      `${PREFERENCES_STORAGE_KEY}:${prefs.userId}`,
      JSON.stringify({ ...prefs, updatedAt: new Date().toISOString() })
    );
  } catch {}
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

function nestedBlockToMarkdown(block: PilotV2NestedBlock): string {
  const lines: string[] = [];
  const heading = block.heading;
  const headingText = (heading?.spans || []).map(s => s.text).join('') || (block.customName || block.blockName);
  const lvl = heading?.level ?? 2;
  lines.push(`${'#'.repeat(lvl)} ${headingText}`);
  for (const c of block.children) {
    const text = (c.spans || []).map(s => s.text).join('');
    switch (c.type) {
      case 'heading':
        lines.push(`${'#'.repeat(c.level ?? 3)} ${text}`);
        break;
      case 'bullet':
        lines.push(`- ${text}`);
        break;
      case 'numbered':
        lines.push(`1. ${text}`);
        break;
      case 'checklist':
        lines.push(`- [${c.checked ? 'x' : ' '}] ${text}`);
        break;
      case 'quote':
        lines.push(`> ${text}`);
        break;
      case 'code':
        lines.push('```');
        lines.push(text);
        lines.push('```');
        break;
      case 'divider':
        lines.push('\n---\n');
        break;
      case 'table':
        if (c.tableRows?.length) {
          lines.push(c.tableRows.map(r => '| ' + r.join(' | ') + ' |').join('\n'));
        }
        break;
      case 'paragraph':
      default:
        if (text) lines.push(text);
    }
  }
  return lines.join('\n');
}

function nestedBlocksToMarkdown(blocks: PilotV2NestedBlock[]): string {
  return blocks.map(nestedBlockToMarkdown).join('\n\n');
}

function nestedBlockToPlain(block: PilotV2NestedBlock): string {
  const heading = (block.heading?.spans || []).map(s => s.text).join('')
    || (block.customName || block.blockName);
  const body = block.children
    .map(c => (c.spans || []).map(s => s.text).join(''))
    .filter(Boolean)
    .join('\n');
  return [heading, body].filter(Boolean).join('\n\n');
}

function nestedBlocksToPlain(blocks: PilotV2NestedBlock[]): string {
  return blocks.map(nestedBlockToPlain).join('\n\n');
}

/* ------------------------------------------------------------------------- */
/* Props                                                                      */
/* ------------------------------------------------------------------------- */

export interface PilotV2ExportSheetProps {
  visible: boolean;
  userId: string;
  /** Snippet of selected text being saved (e.g. quiz explanation). */
  selectedText: string;
  /** Optional auto-seed of the hierarchy / notebook. */
  autoSeed?: {
    subject?: string | null;
    topic?: string | null;
    subtopic?: string | null;
    notebookTitle?: string | null;
  };
  /** Source label for the import (e.g. "Quiz · Polity 2024"). */
  source?: string;
  /** Optional source quiz id — propagated onto the appended elements as metadata. */
  sourceQuizId?: string;
  onClose: () => void;
  /**
   * Called after a successful save with the targeted noteId / blockId. The
   * caller can use this to navigate the user into the editor.
   */
  onSaved?: (info: { noteId: string; blockId?: string; format: ExportFormat }) => void;
}

/* ------------------------------------------------------------------------- */
/* Component                                                                  */
/* ------------------------------------------------------------------------- */

export const PilotV2ExportSheet: React.FC<PilotV2ExportSheetProps> = ({
  visible, userId, selectedText, autoSeed, source, sourceQuizId, onClose, onSaved,
}) => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [step, setStep] = useState<Step>('hierarchy');

  /* Hierarchy ----------------------------------------------------------- */
  const [subject, setSubject]   = useState<string>(autoSeed?.subject || '');
  const [topic, setTopic]       = useState<string>(autoSeed?.topic || '');
  const [subtopic, setSubtopic] = useState<string>(autoSeed?.subtopic || '');

  const allSubjects = useMemo(() => PILOT_V2_SUBJECT_PALETTE.map(s => s.label), []);
  const allTopics = useMemo(() => {
    const s = PILOT_V2_SUBJECT_PALETTE.find(x => x.label === subject);
    if (!s) return [] as string[];
    return (SUBJECT_TOPICS[s.id] || []).map(t => t.label);
  }, [subject]);
  const allSubtopics = useMemo(() => {
    const s = PILOT_V2_SUBJECT_PALETTE.find(x => x.label === subject);
    if (!s) return [] as string[];
    const t = (SUBJECT_TOPICS[s.id] || []).find(x => x.label === topic);
    return t?.subtopics?.map(st => st.label) || [];
  }, [subject, topic]);

  /* Notebook ------------------------------------------------------------ */
  const [notebooks, setNotebooks] = useState<string[]>([]);
  const [allUserNotes, setAllUserNotes] = useState<PilotV2Note[]>([]);
  const [notebookTitle, setNotebookTitle] = useState<string>(autoSeed?.notebookTitle || '');
  const [notebookMode, setNotebookMode] = useState<'select' | 'create'>('select');
  const [loadingNotebooks, setLoadingNotebooks] = useState(false);

  /* Block --------------------------------------------------------------- */
  const [activeNote, setActiveNote] = useState<PilotV2Note | null>(null);
  const [blocks, setBlocks] = useState<PilotV2NestedBlock[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [suggestedBlockId, setSuggestedBlockId] = useState<string | null>(null);
  const [suggestionRanked, setSuggestionRanked] = useState<BlockMatchCandidate[]>([]);
  const [blockSearch, setBlockSearch] = useState<string>('');
  const [matching, setMatching] = useState(false);

  /* Options ------------------------------------------------------------- */
  const [addSeparator, setAddSeparator]         = useState(true);
  const [continueNumbering, setContinueNumbering] = useState(true);
  const [exportFormat, setExportFormat]         = useState<ExportFormat>('append');
  const [exportScope, setExportScope]           = useState<'block' | 'note'>('block');
  const [saving, setSaving] = useState(false);

  /* Preferences --------------------------------------------------------- */
  const preferencesRef = useRef<PilotV2UserPreferences | null>(null);

  /* ------- Reset on open ------- */
  useEffect(() => {
    if (!visible) return;
    setStep('hierarchy');
    setSubject(autoSeed?.subject || '');
    setTopic(autoSeed?.topic || '');
    setSubtopic(autoSeed?.subtopic || '');
    setNotebookTitle(autoSeed?.notebookTitle || '');
    setNotebookMode('select');
    setBlocks([]);
    setSelectedBlockId(null);
    setSuggestedBlockId(null);
    setSuggestionRanked([]);
    setBlockSearch('');
    setActiveNote(null);
    setSaving(false);
  }, [visible, autoSeed]);

  /* ------- Load user preferences once ------- */
  useEffect(() => {
    if (!visible || !userId) return;
    (async () => {
      const prefs = await loadPreferences(userId);
      preferencesRef.current = prefs;
      if (prefs?.defaultExportFormat) {
        // Default format only — pre-applied so the options step opens with the
        // user's preferred format.
        const fmt = prefs.defaultExportFormat;
        if (fmt === 'pdf' || fmt === 'markdown' || fmt === 'plain') setExportFormat(fmt);
      }
      if (prefs?.lastUsedNotebook && !autoSeed?.subject) {
        setSubject(prefs.lastUsedNotebook.subject || '');
        setTopic(prefs.lastUsedNotebook.topic || '');
        setSubtopic(prefs.lastUsedNotebook.microtopic || '');
        setNotebookTitle(prefs.lastUsedNotebook.title || '');
      }
      if (typeof prefs?.autoSeparators === 'boolean') setAddSeparator(prefs.autoSeparators);
      if (typeof prefs?.continueNumbering === 'boolean') setContinueNumbering(prefs.continueNumbering);
    })();
  }, [visible, userId, autoSeed?.subject]);

  /* ------- Fetch notebooks when hierarchy changes ------- */
  useEffect(() => {
    if (!visible || !subject) {
      setNotebooks([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingNotebooks(true);
      try {
        const list = await fetchNotebooksAtLevel(
          userId,
          subject,
          topic || null,
          subtopic || null
        );
        if (!cancelled) setNotebooks(list);
      } finally {
        if (!cancelled) setLoadingNotebooks(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, userId, subject, topic, subtopic]);

  /* ------- Auto-suggest block when a notebook is chosen ------- */
  useEffect(() => {
    if (step !== 'block' || !notebookTitle || !subject) return;
    let cancelled = false;
    (async () => {
      setMatching(true);
      try {
        // Resolve the active PilotV2Note for the chosen notebook title (under
        // the same hierarchy). We fetch the user's note list once and keep it
        // in state so subsequent block-step entries are instant.
        let notes = allUserNotes;
        if (notes.length === 0) {
          notes = await fetchPilotV2NotesForUser(userId);
          if (!cancelled) setAllUserNotes(notes);
        }
        const match = notes.find(n =>
          (n.title || '').trim() === notebookTitle.trim() &&
          (n.subject || '') === subject &&
          ((n.topic || '') === (topic || '')) &&
          ((n.subtopic || '') === (subtopic || ''))
        ) || null;
        if (cancelled) return;
        setActiveNote(match);
        const nested = ensureNestedBlocks(match?.content?.blocks);
        setBlocks(nested);

        // Run smart suggestion (offline-first, optional AI re-rank).
        const result = await suggestBestMatchingBlock(
          selectedText,
          nested,
          {
            preferences: preferencesRef.current,
            useAi: false, // keep instant by default — the user can opt-in via long-press in a future step
            topK: Math.min(8, nested.length),
          }
        );
        if (cancelled) return;
        setSuggestionRanked(result.ranked);
        const best = result.best?.block.id ?? result.ranked[0]?.block.id ?? null;
        setSuggestedBlockId(best);
        setSelectedBlockId(best);
      } finally {
        if (!cancelled) setMatching(false);
      }
    })();
    return () => { cancelled = true; };
  }, [step, notebookTitle, subject, topic, subtopic, selectedText, userId, allUserNotes]);

  /* ------- Filtered visible blocks (lag-free search) ------- */
  const visibleBlocks = useMemo(
    () => filterBlocksByQuery(blocks, blockSearch),
    [blocks, blockSearch]
  );

  /* ------- Save flow ------- */
  const handleSaveAppend = useCallback(async () => {
    setSaving(true);
    try {
      const result = await findOrCreatePilotV2Note({
        userId,
        subject: subject.trim(),
        topic: topic.trim() || null,
        subtopic: subtopic.trim() || null,
        title: notebookTitle.trim(),
      });

      const importedFlat = textToPilotV2Blocks(selectedText);
      const importedNested = flatBlocksToNested(importedFlat);

      // Stitch metadata onto every imported child element (badge + source).
      const stamp = new Date().toISOString();
      const importChildren = importedNested.flatMap(b => {
        const out = b.heading ? [b.heading, ...b.children] : [...b.children];
        for (const el of out) {
          el.meta = {
            ...(el.meta || {}),
            addedAt: stamp,
            source: source || 'quiz_import',
            sourceQuizId,
            badge: 'Added by quiz import',
          };
        }
        return out;
      });

      // Merge into the targeted nested block (or create a fresh block at the
      // end of the note if no block was selected — e.g. brand-new notebook).
      const allNested = await (async () => {
        // Reload the latest state from server so concurrent edits don't clobber.
        const fresh = await fetchPilotV2NotesForUser(userId);
        const target = fresh.find(n => n.id === result.noteId) || activeNote;
        return ensureNestedBlocks(target?.content?.blocks);
      })();

      let targetBlockId = selectedBlockId;
      let targetBlock = allNested.find(b => b.id === targetBlockId);

      if (!targetBlock) {
        targetBlock = {
          id: `pv2_b_${Date.now().toString(36)}`,
          blockName: notebookTitle.trim() || 'Imported Notes',
          children: [],
          isDirty: true,
          createdAt: stamp,
          updatedAt: stamp,
        };
        allNested.push(targetBlock);
        targetBlockId = targetBlock.id;
      }

      // Insert separator (optional) before the new content.
      if (addSeparator && targetBlock.children.length > 0) {
        targetBlock.children.push({
          id: `pv2_div_${Date.now().toString(36)}`,
          type: 'divider',
          meta: { addedAt: stamp, source: source || 'quiz_import' },
        });
      }

      // Auto-continue numbering: find last numbered element and shift incoming.
      if (continueNumbering) {
        const lastNumbered = [...targetBlock.children].reverse().find(c => c.type === 'numbered');
        const lastNumMatch = (lastNumbered?.spans?.[0]?.text || '').match(/^(\d+)\./);
        let next = lastNumMatch ? parseInt(lastNumMatch[1], 10) + 1 : 1;
        for (const el of importChildren) {
          if (el.type === 'numbered' && el.spans?.[0]) {
            el.spans[0].text = el.spans[0].text.replace(/^\d+\.\s*/, '');
            el.spans[0].text = `${next}. ${el.spans[0].text}`;
            next++;
          }
        }
      }

      targetBlock.children.push(...importChildren);
      targetBlock.updatedAt = stamp;
      targetBlock.isDirty = true;

      // Persist back as flat blocks (legacy schema) so existing editors still work.
      const flatBack = nestedToFlatBlocks(allNested);
      const ok = await appendBlocksToPilotV2Note(result.noteId, []);
      // appendBlocksToPilotV2Note merely concatenates; here we *replace* the
      // content with the rebuilt list to preserve the smart-merge result.
      const { savePilotV2NoteContent } = await import('../../repositories/pilotV2Repo');
      const saved = await savePilotV2NoteContent(result.noteId, { blocks: flatBack, version: 1 });
      if (!ok || !saved) throw new Error('Failed to save block');

      // Persist last-used preferences for next time.
      const newPrefs: PilotV2UserPreferences = {
        userId,
        lastUsedNotebook: {
          noteId: result.noteId,
          title: notebookTitle.trim(),
          subject: subject.trim(),
          topic: topic.trim() || null,
          microtopic: subtopic.trim() || null,
        },
        lastUsedBlockId: targetBlockId || undefined,
        autoSeparators: addSeparator,
        continueNumbering,
        defaultExportFormat: exportFormat === 'append' ? preferencesRef.current?.defaultExportFormat : (exportFormat as any),
      };
      await savePreferences(newPrefs);
      preferencesRef.current = newPrefs;

      onSaved?.({ noteId: result.noteId, blockId: targetBlockId || undefined, format: 'append' });
      Alert.alert(
        'Saved',
        result.isNew
          ? `Created new notebook "${notebookTitle.trim()}" and added your snippet.`
          : `Appended to "${(targetBlock.customName || targetBlock.blockName)}" in "${notebookTitle.trim()}".`
      );
      onClose();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    userId, subject, topic, subtopic, notebookTitle, selectedText, source, sourceQuizId,
    selectedBlockId, addSeparator, continueNumbering, activeNote, exportFormat, onSaved, onClose,
  ]);

  const handleExport = useCallback(async () => {
    if (exportFormat === 'append') {
      await handleSaveAppend();
      return;
    }
    setSaving(true);
    try {
      const scopeBlocks = exportScope === 'block' && selectedBlockId
        ? blocks.filter(b => b.id === selectedBlockId)
        : blocks;
      let payload = '';
      let title = notebookTitle || 'Pilot V2 Export';
      switch (exportFormat) {
        case 'plain':
          payload = nestedBlocksToPlain(scopeBlocks);
          break;
        case 'markdown':
          payload = nestedBlocksToMarkdown(scopeBlocks);
          break;
        case 'pdf':
          // Without a native PDF library, fall back to system-share a Markdown
          // body. Caller / OS will route to the PDF print dialog on iOS / web.
          payload = nestedBlocksToMarkdown(scopeBlocks);
          title = `${title}.md`;
          break;
      }
      if (!payload.trim()) {
        Alert.alert('Nothing to export', 'The selected block or notebook is empty.');
        return;
      }
      try {
        await Share.share({ title, message: `${title}\n\n${payload}` });
      } catch {
        Alert.alert('Export ready', `${title} (${exportFormat}) generated. Sharing was cancelled.`);
      }

      const newPrefs: PilotV2UserPreferences = {
        ...(preferencesRef.current || { userId, autoSeparators: addSeparator, continueNumbering }),
        userId,
        defaultExportFormat: exportFormat as any,
      };
      await savePreferences(newPrefs);
      preferencesRef.current = newPrefs;

      onSaved?.({ noteId: activeNote?.id || '', blockId: selectedBlockId || undefined, format: exportFormat });
      onClose();
    } catch (e) {
      Alert.alert('Export failed', (e as Error).message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [exportFormat, exportScope, selectedBlockId, blocks, notebookTitle, handleSaveAppend, userId, addSeparator, continueNumbering, activeNote?.id, onSaved, onClose]);

  /* ------- Step gates ------- */
  const canProceedHierarchy = subject.trim().length > 0;
  const canProceedNotebook  = notebookTitle.trim().length > 0;
  const canProceedBlock     = !!selectedBlockId || blocks.length === 0; // empty notebook → create first block

  /* ------- Render helpers ------- */
  const renderHeader = () => (
    <View style={styles.header}>
      {step !== 'hierarchy' ? (
        <TouchableOpacity
          testID="pilot-v2-export-back"
          onPress={() => setStep(step === 'options' ? 'block' : step === 'block' ? 'notebook' : 'hierarchy')}
          style={styles.backBtn}
        >
          <ChevronLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={[styles.brand, { backgroundColor: ACCENT }]}>
          <Rocket size={18} color="#fff" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {step === 'hierarchy' && 'Choose Subject → Topic → Microtopic'}
          {step === 'notebook' && 'Choose notebook'}
          {step === 'block' && 'Choose block'}
          {step === 'options' && 'Append options'}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          {source ? `From: ${source}` : 'Smart-routed by hierarchy. Same path appends to the same note.'}
        </Text>
      </View>
      <TouchableOpacity onPress={onClose} testID="pilot-v2-export-close" style={styles.closeBtn}>
        <X size={20} color={colors.textPrimary} />
      </TouchableOpacity>
    </View>
  );

  const renderStepDots = () => {
    const order: Step[] = ['hierarchy', 'notebook', 'block', 'options'];
    return (
      <View style={styles.dotsRow}>
        {order.map((s, idx) => (
          <View
            key={s}
            style={[
              styles.dot,
              { backgroundColor: order.indexOf(step) >= idx ? ACCENT : '#E5E7EB' },
            ]}
          />
        ))}
      </View>
    );
  };

  const sheetStyle = [
    styles.sheet,
    isTablet ? {
      width: 520, height: '100%' as any, borderRadius: 0,
      borderTopLeftRadius: 28, borderBottomLeftRadius: 28,
    } : null,
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, isTablet ? { justifyContent: 'flex-end', alignItems: 'flex-end' } : null]}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ width: '100%' }}
        >
          <View
            testID="pilot-v2-export-sheet"
            style={[sheetStyle, { backgroundColor: colors.surface }]}
          >
            {renderHeader()}
            {renderStepDots()}

            {step === 'hierarchy' && (
              <HierarchyStep
                colors={colors}
                subject={subject} setSubject={setSubject}
                topic={topic} setTopic={setTopic}
                subtopic={subtopic} setSubtopic={setSubtopic}
                allSubjects={allSubjects}
                allTopics={allTopics}
                allSubtopics={allSubtopics}
              />
            )}

            {step === 'notebook' && (
              <NotebookStep
                colors={colors}
                notebooks={notebooks}
                loadingNotebooks={loadingNotebooks}
                notebookTitle={notebookTitle}
                setNotebookTitle={setNotebookTitle}
                notebookMode={notebookMode}
                setNotebookMode={setNotebookMode}
              />
            )}

            {step === 'block' && (
              <BlockStep
                colors={colors}
                matching={matching}
                blocks={visibleBlocks}
                allBlocksCount={blocks.length}
                blockSearch={blockSearch}
                setBlockSearch={setBlockSearch}
                selectedBlockId={selectedBlockId}
                setSelectedBlockId={setSelectedBlockId}
                suggestedBlockId={suggestedBlockId}
                suggestionRanked={suggestionRanked}
                onCreateNewBlock={() => {
                  setSelectedBlockId(null);
                  setStep('options');
                }}
              />
            )}

            {step === 'options' && (
              <OptionsStep
                colors={colors}
                addSeparator={addSeparator} setAddSeparator={setAddSeparator}
                continueNumbering={continueNumbering} setContinueNumbering={setContinueNumbering}
                exportFormat={exportFormat} setExportFormat={setExportFormat}
                exportScope={exportScope} setExportScope={setExportScope}
                hasSelectedBlock={!!selectedBlockId}
                blockName={blocks.find(b => b.id === selectedBlockId)?.customName
                  || blocks.find(b => b.id === selectedBlockId)?.blockName
                  || '(new block)'}
              />
            )}

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {step !== 'options' ? (
                <TouchableOpacity
                  testID="pilot-v2-export-next"
                  disabled={
                    (step === 'hierarchy' && !canProceedHierarchy) ||
                    (step === 'notebook' && !canProceedNotebook) ||
                    (step === 'block' && !canProceedBlock)
                  }
                  onPress={() => {
                    if (step === 'hierarchy') setStep('notebook');
                    else if (step === 'notebook') setStep('block');
                    else setStep('options');
                  }}
                  style={[
                    styles.btnPrimary,
                    { backgroundColor: ACCENT, opacity: (
                      (step === 'hierarchy' && !canProceedHierarchy) ||
                      (step === 'notebook' && !canProceedNotebook) ||
                      (step === 'block' && !canProceedBlock)
                    ) ? 0.5 : 1 },
                  ]}
                >
                  <Text style={styles.btnPrimaryText}>
                    {step === 'hierarchy' && 'Continue to notebook'}
                    {step === 'notebook' && 'Continue to block'}
                    {step === 'block' && 'Continue to options'}
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  testID="pilot-v2-export-confirm"
                  disabled={saving}
                  onPress={handleExport}
                  style={[styles.btnPrimary, { backgroundColor: ACCENT, opacity: saving ? 0.6 : 1 }]}
                >
                  {saving ? <ActivityIndicator color="#fff" /> : (
                    <Text style={styles.btnPrimaryText}>
                      {exportFormat === 'append' ? '✓ Save to block' :
                       exportFormat === 'pdf' ? 'Export as PDF' :
                       exportFormat === 'markdown' ? 'Export as Markdown' : 'Export plain text'}
                    </Text>
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

/* ------------------------------------------------------------------------- */
/* Step: Hierarchy                                                            */
/* ------------------------------------------------------------------------- */

interface HierarchyStepProps {
  colors: any;
  subject: string; setSubject: (v: string) => void;
  topic: string; setTopic: (v: string) => void;
  subtopic: string; setSubtopic: (v: string) => void;
  allSubjects: string[];
  allTopics: string[];
  allSubtopics: string[];
}

const HierarchyStep: React.FC<HierarchyStepProps> = ({
  colors, subject, setSubject, topic, setTopic, subtopic, setSubtopic,
  allSubjects, allTopics, allSubtopics,
}) => {
  const [openId, setOpenId] = useState<'subject' | 'topic' | 'subtopic' | null>(null);

  const Drop = ({
    label, value, options, onSelect, disabled, id, placeholder,
  }: any) => (
    <View style={styles.formGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textTertiary }]}>{label}</Text>
      <TouchableOpacity
        testID={`pilot-v2-export-${id}-trigger`}
        disabled={disabled}
        style={[styles.dropdownButton, { borderColor: colors.border, opacity: disabled ? 0.5 : 1 }]}
        onPress={() => setOpenId(openId === id ? null : id)}
      >
        <Text style={[styles.dropdownButtonText, { color: value ? colors.textPrimary : colors.textTertiary }]}>
          {value || placeholder}
        </Text>
        <ChevronDown size={16} color={colors.textSecondary} />
      </TouchableOpacity>
      {openId === id && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 220 }}>
            {options.length === 0 && (
              <Text style={[styles.dropdownItem, { color: colors.textTertiary }]}>No options available.</Text>
            )}
            {options.map((opt: string) => (
              <TouchableOpacity
                key={opt}
                testID={`pilot-v2-export-${id}-option-${opt}`}
                onPress={() => { onSelect(opt); setOpenId(null); }}
                style={[styles.dropdownItem, value === opt && styles.dropdownItemSelected]}
              >
                <Text style={[styles.dropdownItemText, { color: value === opt ? ACCENT : colors.textPrimary }]}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
      <Drop
        id="subject"
        label="Subject"
        value={subject}
        options={allSubjects}
        placeholder="Select subject…"
        onSelect={(v: string) => { setSubject(v); setTopic(''); setSubtopic(''); }}
      />
      <Drop
        id="topic"
        label="Topic"
        value={topic}
        options={allTopics}
        placeholder={subject ? 'Select topic…' : 'Select subject first'}
        disabled={!subject}
        onSelect={(v: string) => { setTopic(v); setSubtopic(''); }}
      />
      <Drop
        id="subtopic"
        label="Microtopic"
        value={subtopic}
        options={allSubtopics}
        placeholder={topic ? 'Select microtopic…' : 'Select topic first'}
        disabled={!topic}
        onSelect={(v: string) => setSubtopic(v)}
      />
    </ScrollView>
  );
};

/* ------------------------------------------------------------------------- */
/* Step: Notebook                                                             */
/* ------------------------------------------------------------------------- */

interface NotebookStepProps {
  colors: any;
  notebooks: string[];
  loadingNotebooks: boolean;
  notebookTitle: string;
  setNotebookTitle: (v: string) => void;
  notebookMode: 'select' | 'create';
  setNotebookMode: (v: 'select' | 'create') => void;
}

const NotebookStep: React.FC<NotebookStepProps> = ({
  colors, notebooks, loadingNotebooks, notebookTitle, setNotebookTitle,
  notebookMode, setNotebookMode,
}) => {
  return (
    <View style={{ flex: 1 }}>
      <View style={styles.modeToggle}>
        <TouchableOpacity
          testID="pilot-v2-export-notebook-mode-select"
          onPress={() => {
            setNotebookMode('select');
            if (notebooks.length > 0) setNotebookTitle(notebooks[0]);
          }}
          style={[styles.modeButton, notebookMode === 'select' && styles.modeButtonActive]}
        >
          <Text style={styles.modeButtonText}>📌 Use existing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="pilot-v2-export-notebook-mode-create"
          onPress={() => { setNotebookMode('create'); setNotebookTitle(''); }}
          style={[styles.modeButton, notebookMode === 'create' && styles.modeButtonActive]}
        >
          <Text style={styles.modeButtonText}>✨ Create new</Text>
        </TouchableOpacity>
      </View>

      {notebookMode === 'select' ? (
        loadingNotebooks ? (
          <ActivityIndicator color={colors.textTertiary} style={{ marginTop: 16 }} />
        ) : notebooks.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={{ color: colors.textTertiary, fontSize: 13, marginBottom: 8 }}>
              No notebooks under this hierarchy yet. Create the first one:
            </Text>
            <TextInput
              testID="pilot-v2-export-notebook-input"
              value={notebookTitle}
              onChangeText={setNotebookTitle}
              placeholder="Notebook name"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            />
          </View>
        ) : (
          <FlatList
            data={notebooks}
            keyExtractor={(item, idx) => `${item}-${idx}`}
            removeClippedSubviews
            initialNumToRender={12}
            windowSize={5}
            style={{ flex: 1, marginTop: 8 }}
            contentContainerStyle={{ paddingBottom: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`pilot-v2-export-notebook-${item}`}
                onPress={() => setNotebookTitle(item)}
                style={[
                  styles.listRow,
                  { borderBottomColor: colors.border },
                  notebookTitle === item && { backgroundColor: '#F5F3FF' },
                ]}
              >
                <Text style={[styles.listRowText, { color: notebookTitle === item ? ACCENT : colors.textPrimary }]}>
                  {item}
                </Text>
                {notebookTitle === item && <Check size={18} color={ACCENT} />}
              </TouchableOpacity>
            )}
          />
        )
      ) : (
        <View style={styles.emptyBox}>
          <TextInput
            testID="pilot-v2-export-notebook-input"
            value={notebookTitle}
            onChangeText={setNotebookTitle}
            placeholder="New notebook name"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
          />
        </View>
      )}
    </View>
  );
};

/* ------------------------------------------------------------------------- */
/* Step: Block                                                                */
/* ------------------------------------------------------------------------- */

interface BlockStepProps {
  colors: any;
  matching: boolean;
  blocks: PilotV2NestedBlock[];
  allBlocksCount: number;
  blockSearch: string;
  setBlockSearch: (v: string) => void;
  selectedBlockId: string | null;
  setSelectedBlockId: (v: string | null) => void;
  suggestedBlockId: string | null;
  suggestionRanked: BlockMatchCandidate[];
  onCreateNewBlock: () => void;
}

const BlockStep: React.FC<BlockStepProps> = ({
  colors, matching, blocks, allBlocksCount, blockSearch, setBlockSearch,
  selectedBlockId, setSelectedBlockId, suggestedBlockId, suggestionRanked,
  onCreateNewBlock,
}) => {
  const renderItem = useCallback(({ item }: { item: PilotV2NestedBlock }) => {
    const isSelected = selectedBlockId === item.id;
    const isSuggested = suggestedBlockId === item.id;
    const candidate = suggestionRanked.find(c => c.block.id === item.id);
    const subline = `${item.children.length} item${item.children.length === 1 ? '' : 's'}` +
      (item.updatedAt ? ` • Updated ${new Date(item.updatedAt).toLocaleDateString()}` : '');
    return (
      <TouchableOpacity
        testID={`pilot-v2-export-block-${item.id}`}
        onPress={() => setSelectedBlockId(item.id)}
        activeOpacity={0.85}
        style={[
          styles.blockCard,
          { borderColor: colors.border },
          isSelected && { borderColor: ACCENT, backgroundColor: '#F5F3FF' },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Layers size={14} color={isSelected ? ACCENT : colors.textTertiary} />
            <Text style={[styles.blockName, { color: isSelected ? ACCENT : colors.textPrimary }]} numberOfLines={1}>
              {item.customName || item.blockName}
            </Text>
            {isSuggested && (
              <View style={styles.suggestedTag}>
                <Sparkles size={10} color="#fff" />
                <Text style={styles.suggestedTagText}>Suggested</Text>
              </View>
            )}
          </View>
          <Text style={[styles.blockMeta, { color: colors.textTertiary }]} numberOfLines={1}>
            {subline}{candidate ? ` • Match ${(candidate.confidence * 100).toFixed(0)}%` : ''}
          </Text>
        </View>
        {isSelected && <Check size={18} color={ACCENT} />}
      </TouchableOpacity>
    );
  }, [selectedBlockId, suggestedBlockId, suggestionRanked, colors, setSelectedBlockId]);

  if (matching) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 28 }}>
        <ActivityIndicator color={ACCENT} />
        <Text style={{ marginTop: 8, fontSize: 12, color: colors.textTertiary }}>
          Finding the best block…
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.searchRow, { borderColor: colors.border }]}>
        <Search size={14} color={colors.textTertiary} />
        <TextInput
          testID="pilot-v2-export-block-search"
          value={blockSearch}
          onChangeText={setBlockSearch}
          placeholder={allBlocksCount === 0 ? 'No blocks yet — create the first one below' : `Search ${allBlocksCount} block${allBlocksCount === 1 ? '' : 's'}…`}
          placeholderTextColor={colors.textTertiary}
          style={{ flex: 1, color: colors.textPrimary, fontSize: 13, paddingVertical: 4 }}
        />
        {blockSearch.length > 0 && (
          <TouchableOpacity testID="pilot-v2-export-block-search-clear" onPress={() => setBlockSearch('')}>
            <X size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={blocks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        removeClippedSubviews
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        style={{ flex: 1, marginTop: 8 }}
        contentContainerStyle={{ paddingBottom: 12 }}
        ListEmptyComponent={(
          <Text style={{ fontSize: 13, color: colors.textTertiary, paddingVertical: 16, textAlign: 'center' }}>
            {allBlocksCount === 0 ? 'This notebook has no blocks yet. Tap "Create new block" below.' : 'No blocks match your search.'}
          </Text>
        )}
        ListFooterComponent={(
          <TouchableOpacity
            testID="pilot-v2-export-create-block"
            onPress={onCreateNewBlock}
            style={[styles.createBlockRow, { borderColor: colors.border }]}
          >
            <Plus size={16} color={ACCENT} />
            <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 13 }}>Create new block</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

/* ------------------------------------------------------------------------- */
/* Step: Options                                                              */
/* ------------------------------------------------------------------------- */

interface OptionsStepProps {
  colors: any;
  addSeparator: boolean; setAddSeparator: (v: boolean) => void;
  continueNumbering: boolean; setContinueNumbering: (v: boolean) => void;
  exportFormat: ExportFormat; setExportFormat: (v: ExportFormat) => void;
  exportScope: 'block' | 'note'; setExportScope: (v: 'block' | 'note') => void;
  hasSelectedBlock: boolean;
  blockName: string;
}

const OptionsStep: React.FC<OptionsStepProps> = ({
  colors, addSeparator, setAddSeparator, continueNumbering, setContinueNumbering,
  exportFormat, setExportFormat, exportScope, setExportScope, hasSelectedBlock, blockName,
}) => (
  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
    <View style={[styles.banner, { backgroundColor: '#F5F3FF' }]}>
      <Text style={{ fontSize: 12, color: ACCENT, fontWeight: '700' }}>
        Target: {hasSelectedBlock ? blockName : 'New block at end of notebook'}
      </Text>
    </View>

    <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>Append behaviour</Text>
    <View style={styles.optionsRow}>
      <Toggle
        testID="pilot-v2-export-toggle-separator"
        label="Add separator divider"
        active={addSeparator}
        onPress={() => setAddSeparator(!addSeparator)}
      />
      <Toggle
        testID="pilot-v2-export-toggle-numbering"
        label="Continue auto-numbering"
        active={continueNumbering}
        onPress={() => setContinueNumbering(!continueNumbering)}
      />
    </View>

    <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 16 }]}>Export format</Text>
    <View style={styles.optionsRow}>
      <FormatPill
        testID="pilot-v2-export-format-append"
        icon={<FileText size={14} color={exportFormat === 'append' ? '#fff' : colors.textPrimary} />}
        label="Save to block"
        active={exportFormat === 'append'}
        onPress={() => setExportFormat('append')}
      />
      <FormatPill
        testID="pilot-v2-export-format-markdown"
        icon={<FileDown size={14} color={exportFormat === 'markdown' ? '#fff' : colors.textPrimary} />}
        label="Markdown"
        active={exportFormat === 'markdown'}
        onPress={() => setExportFormat('markdown')}
      />
      <FormatPill
        testID="pilot-v2-export-format-pdf"
        icon={<FileDown size={14} color={exportFormat === 'pdf' ? '#fff' : colors.textPrimary} />}
        label="PDF"
        active={exportFormat === 'pdf'}
        onPress={() => setExportFormat('pdf')}
      />
      <FormatPill
        testID="pilot-v2-export-format-plain"
        icon={<FileText size={14} color={exportFormat === 'plain' ? '#fff' : colors.textPrimary} />}
        label="Plain text"
        active={exportFormat === 'plain'}
        onPress={() => setExportFormat('plain')}
      />
    </View>

    {exportFormat !== 'append' && (
      <>
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 16 }]}>Scope</Text>
        <View style={styles.optionsRow}>
          <Toggle
            testID="pilot-v2-export-scope-block"
            label="Selected block only"
            active={exportScope === 'block'}
            onPress={() => setExportScope('block')}
          />
          <Toggle
            testID="pilot-v2-export-scope-note"
            label="Whole notebook"
            active={exportScope === 'note'}
            onPress={() => setExportScope('note')}
          />
        </View>
      </>
    )}
  </ScrollView>
);

const Toggle: React.FC<{ label: string; active: boolean; onPress: () => void; testID?: string }> = ({
  label, active, onPress, testID,
}) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    style={[styles.toggle, active && { backgroundColor: '#F5F3FF', borderColor: ACCENT }]}
  >
    <View style={[styles.toggleDot, { backgroundColor: active ? ACCENT : '#E5E7EB' }]} />
    <Text style={{ fontSize: 13, color: active ? ACCENT : '#374151', fontWeight: '600' }}>{label}</Text>
  </TouchableOpacity>
);

const FormatPill: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onPress: () => void; testID?: string }> = ({
  icon, label, active, onPress, testID,
}) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    style={[
      styles.formatPill,
      active ? { backgroundColor: ACCENT, borderColor: ACCENT } : { backgroundColor: '#fff', borderColor: '#E5E7EB' },
    ]}
  >
    {icon}
    <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#fff' : '#0F172A' }}>{label}</Text>
  </TouchableOpacity>
);

/* ------------------------------------------------------------------------- */
/* Styles                                                                     */
/* ------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 0,
  },
  sheet: {
    width: '100%', maxWidth: 520, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 18, paddingBottom: 22, maxHeight: '92%',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  brand: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { padding: 6 },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 2 },

  dotsRow: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  dot: { width: 24, height: 4, borderRadius: 2 },

  formGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 6 },
  dropdownButton: {
    height: 46, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dropdownButtonText: { fontSize: 14, fontWeight: '500' },
  dropdown: { borderWidth: 1, borderRadius: 10, marginTop: 6, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16 },
  dropdownItemSelected: { backgroundColor: '#F5F3FF' },
  dropdownItemText: { fontSize: 14, fontWeight: '500' },

  modeToggle: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  modeButton: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 12,
    borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, alignItems: 'center',
  },
  modeButtonActive: { borderColor: ACCENT, backgroundColor: '#F5F3FF' },
  modeButtonText: { fontSize: 13, fontWeight: '700', color: '#333' },

  emptyBox: { paddingVertical: 12 },
  input: {
    height: 46, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },

  listRow: {
    paddingVertical: 14, paddingHorizontal: 14, borderBottomWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: 48,
  },
  listRowText: { fontSize: 14, fontWeight: '600' },

  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
  },

  blockCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8,
    minHeight: 56,
  },
  blockName: { fontSize: 14, fontWeight: '700', flex: 1 },
  blockMeta: { fontSize: 11, marginTop: 4 },
  suggestedTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: ACCENT, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
  },
  suggestedTagText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  createBlockRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', marginTop: 4,
  },

  banner: { padding: 10, borderRadius: 10, marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 6 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E0E0E0',
    minHeight: 44,
  },
  toggleDot: { width: 12, height: 12, borderRadius: 6 },
  formatPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5,
    minHeight: 44,
  },

  footer: { paddingTop: 12, marginTop: 8, borderTopWidth: 1 },
  btnPrimary: {
    height: 48, borderRadius: 12, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
});

export default PilotV2ExportSheet;
