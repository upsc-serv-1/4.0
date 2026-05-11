/**
 * PilotV2SaveAIPanel
 *
 * Inline AI prompt panel embedded inside the Save-to-Pilot-V2 sheet.
 * Opened by tapping the Brain icon in the SaveSheet header.
 *
 * Features (per user spec):
 *   • Expandable height — defaults to ~70% of sheet, can expand to ~95%.
 *   • Prompt TextInput (top) — user types a custom command e.g. "Convert to Hindi".
 *   • Horizontal scrollable preset chips (small icons) under the input —
 *     replaces the old "Running AI" tab.  Tap a preset → command is auto-sent.
 *     If the user has typed something in the prompt input, that text is
 *     joined to the preset prompt with a newline before being sent.
 *   • AI output is rendered inside the *full* RichNoteEditor + RichToolbar
 *     stack (same one used by the SaveSheet body) so the user can edit /
 *     re-format / copy the answer just like a normal Pilot note.
 *   • "Insert into note" button — pushes the (possibly edited) HTML into
 *     the SaveSheet body so it can be saved with one tap.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Alert
} from 'react-native';
import * as ExpoClipboard from 'expo-clipboard';
import { Send, Maximize2, Minimize2, Plus, ArrowDownToLine, Sparkles, X, Copy, Undo2, Redo2, Brain, Clipboard } from 'lucide-react-native';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import RichNoteEditor from '../RichNoteEditor';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { AIPromptManager, DEFAULT_QUIZ_TEMPLATES, PromptTemplate } from '../../services/AIPromptManager';
import { generateWithHistory } from '../../services/GeminiService';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Called with the (possibly edited) HTML output when the user taps
   *  "Insert into note".  Parent should append this to the SaveSheet body. */
  onInsert: (html: string) => void;
  /** Optional context to seed AI presets (subject, question, options). */
  seedContext?: {
    subject?: string | null;
    topic?: string | null;
    question?: string | null;
    options?: Record<string, string> | null;
    correctAnswer?: string | null;
    /** Existing body the user has already typed — sent as base context. */
    body?: string | null;
  };
};

const PilotV2SaveAIPanel: React.FC<Props> = ({ visible, onClose, onInsert, seedContext }) => {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { height: screenHeight } = useWindowDimensions();
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>(DEFAULT_QUIZ_TEMPLATES);
  const promptManager = AIPromptManager.getInstance();
  const richRef = useRef<any>(null);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        const temps = await promptManager.fetchPromptTemplates(session.user.id, 'quiz');
        if (temps.length > 0) setTemplates(temps);
      } catch { }
    })();
  }, [session?.user?.id]);

  if (!visible) return null;

  const computedPrompt = (presetTemplate?: PromptTemplate): string => {
    const ctxQuestion =
      seedContext?.question || seedContext?.body || seedContext?.topic || seedContext?.subject || '';
    const optionsObj = seedContext?.options || {};
    const optionsStr = Object.entries(optionsObj)
      .map(([k, v]) => `${k}) ${v}`)
      .join('\n');
    const wrongOptions = Object.entries(optionsObj)
      .filter(([k]) => k.toLowerCase() !== (seedContext?.correctAnswer || '').toLowerCase())
      .map(([k, v]) => `${k}) ${v}`)
      .join('\n');

    let presetText = '';
    if (presetTemplate) {
      presetText = promptManager.fillTemplate(presetTemplate.prompt_text, {
        question: ctxQuestion,
        options: optionsStr,
        correct_answer: seedContext?.correctAnswer || '',
        wrong_options: wrongOptions,
      });
    }

    const userText = (prompt || '').trim();
    if (presetText && userText) return `${userText}\n\n${presetText}`;
    return presetText || userText;
  };

  const runAI = async (presetTemplate?: PromptTemplate) => {
    const final = computedPrompt(presetTemplate);
    if (!final.trim() || loading) return;

    setLoading(true);
    try {
      const bodyText = seedContext?.body || '';
      
      // Strip HTML tags from body for AI processing
      const bodyTextPlain = bodyText ? bodyText.replace(/<[^>]*>/g, '').trim() : '';
      
      // Only include the actual Pilot Sheet editor content, NOT the question
      const fullPrompt = bodyTextPlain 
        ? `${final}\n\n---\n\nPILOT SHEET CONTENT:\n${bodyTextPlain}` 
        : final;

      // For AI context, only send the body content the user typed
      const optionsArr = Object.entries(seedContext?.options || {}).map(([k, v]) => `${k}) ${v}`);
      const response = await generateWithHistory(
        [{ role: 'user', content: fullPrompt }],
        {
          question: bodyTextPlain || 'General UPSC Context',
          options: optionsArr,
          correct_answer: seedContext?.correctAnswer || '',
        }
      );
      // Convert plain markdown-ish AI output into HTML so the rich editor
      // displays it cleanly.  Headings (#), bullets (-), bold (**) etc.
      const html = markdownishToHtml(response || '');
      setOutput(html);
      setEditorKey((k) => k + 1);
    } catch (e: any) {
      setOutput(`<p style="color:#dc2626"><b>AI request failed:</b> ${(e?.message || 'Unknown error')}</p>`);
      setEditorKey((k) => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleInsert = async () => {
    let html = output;
    try {
      const live = await richRef.current?.getContentHtml?.();
      if (typeof live === 'string' && live.trim().length > 0) html = live;
    } catch { }
    if (!html.trim()) return;
    onInsert(html);
  };

  const handlePasteFormatted = async () => {
    const text = await ExpoClipboard.getStringAsync();
    if (!text) return;
    const html = markdownishToHtml(text);
    richRef.current?.insertHTML(html);
    setTimeout(async () => {
      const live = await richRef.current?.getContentHtml?.();
      if (live) setOutput(live);
    }, 100);
  };

  const panelHeight = isFullscreen ? screenHeight * 0.92 : screenHeight * 0.62;

  return (
    <View
      testID="pilot-v2-save-ai-panel"
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          height: panelHeight,
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.brain, { backgroundColor: '#EEECFF' }]}>
            <Sparkles size={16} color="#5B4EFA" />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>AI Assistant</Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
              Type a command or tap a preset to run instantly
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            testID="pilot-v2-save-ai-expand"
            onPress={() => setIsFullscreen((v) => !v)}
            style={[styles.headerBtn, { borderColor: colors.border }]}
          >
            {isFullscreen ? (
              <Minimize2 size={14} color={colors.textSecondary} />
            ) : (
              <Maximize2 size={14} color={colors.textSecondary} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            testID="pilot-v2-save-ai-close"
            onPress={onClose}
            style={[styles.headerBtn, { borderColor: colors.border }]}
          >
            <X size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Prompt input row */}
      <View style={[styles.promptRow, { borderBottomColor: colors.border }]}>
        <TextInput
          testID="pilot-v2-save-ai-input"
          value={prompt}
          onChangeText={setPrompt}
          placeholder='Ask AI anything — e.g. "Convert to Hindi"'
          placeholderTextColor={colors.textTertiary}
          style={[
            styles.promptInput,
            {
              color: colors.textPrimary,
              backgroundColor: colors.surfaceStrong,
              borderColor: colors.border,
            },
          ]}
          multiline
        />
        <TouchableOpacity
          testID="pilot-v2-save-ai-send"
          onPress={() => runAI()}
          disabled={loading || !prompt.trim()}
          style={[
            styles.sendBtn,
            { backgroundColor: '#5B4EFA', opacity: loading || !prompt.trim() ? 0.5 : 1 },
          ]}
        >
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <Send size={14} color="#FFF" />}
        </TouchableOpacity>
      </View>

      {/* Preset chips (replaces the old "Running AI" tab) */}
      <View style={[styles.presetsBar, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetsContent}
        >
          {templates.map((t) => (
            <TouchableOpacity
              key={t.template_key}
              testID={`pilot-v2-save-ai-preset-${t.template_key}`}
              onPress={() => runAI(t)}
              disabled={loading}
              style={[
                styles.presetChip,
                {
                  backgroundColor: colors.surfaceStrong,
                  borderColor: colors.border,
                  opacity: loading ? 0.6 : 1,
                },
              ]}
            >
              <Text style={styles.presetEmoji}>{t.button_emoji || '🤖'}</Text>
              <Text
                style={[styles.presetLabel, { color: colors.textPrimary }]}
                numberOfLines={1}
              >
                {t.button_label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Loading indicator */}
      {loading && (
        <View style={[styles.loadingRow, { borderBottomColor: colors.border }]}>
          <ActivityIndicator size="small" color="#5B4EFA" />
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginLeft: 8 }}>
            Thinking…
          </Text>
        </View>
      )}

      {/* Rich-editor output area — full formatting toolbar copied as-is */}
      <View style={[styles.outputShell, { borderColor: colors.border, backgroundColor: colors.surfaceStrong, flex: 1 }]}>
        <View style={[styles.toolbarSticky, { backgroundColor: colors.surfaceStrong, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}>
          <RichToolbar
            getEditor={() => richRef.current}
            selectedIconTint="#5B4EFA"
            iconTint={colors.textPrimary}
            style={{ backgroundColor: 'transparent', height: 40, flex: 1 }}
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
            ]}
            iconMap={{
              [actions.undo]: ({ tintColor }: any) => <Undo2 size={16} color={tintColor} />,
              [actions.redo]: ({ tintColor }: any) => <Redo2 size={16} color={tintColor} />,
              [actions.heading1]: ({ tintColor }: any) => (
                <Text style={{ color: tintColor, fontWeight: '900', fontSize: 13 }}>H1</Text>
              ),
              [actions.heading2]: ({ tintColor }: any) => (
                <Text style={{ color: tintColor, fontWeight: '800', fontSize: 11 }}>H2</Text>
              ),
            }}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 8 }}>
            <TouchableOpacity
              onPress={() => handlePasteFormatted()}
              style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#EEECFF', borderColor: '#5B4EFA', borderWidth: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <Clipboard size={13} color="#5B4EFA" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                richRef.current?.getContentHtml?.().then((html: string) => {
                  if (html) ExpoClipboard.setStringAsync(html.replace(/<[^>]*>/g, ''));
                  Alert.alert('Copied', 'AI response copied to clipboard.');
                });
              }}
              style={[styles.headerBtn, { borderColor: colors.border, width: 28, height: 28 }]}
            >
              <Copy size={13} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={{ width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }}
            >
              <Brain size={15} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <RichNoteEditor
            key={editorKey}
            ref={richRef}
            html={output}
            onChange={setOutput}
            themeColors={{
              bg: colors.surfaceStrong,
              surface: colors.surface,
              textPrimary: colors.textPrimary,
              border: colors.border,
              primary: '#5B4EFA',
            }}
            placeholder="AI response will appear here. Tap a preset above or type & send."
            editorStyle={{ minHeight: 300 }}
            useContainer={false}
          />
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          testID="pilot-v2-save-ai-clear"
          onPress={() => {
            setOutput('');
            setEditorKey((k) => k + 1);
          }}
          style={[styles.footerBtnGhost, { borderColor: colors.border }]}
        >
          <Plus size={14} color={colors.textPrimary} style={{ transform: [{ rotate: '45deg' }] }} />
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 12 }}>Clear</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="pilot-v2-save-ai-insert"
          onPress={handleInsert}
          style={[styles.footerBtnPrimary, { backgroundColor: '#5B4EFA' }]}
        >
          <ArrowDownToLine size={14} color="#FFF" />
          <Text style={{ color: '#FFF', fontWeight: '800', fontSize: 12 }}>Insert into note</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/** Minimal markdown → HTML converter that keeps things readable inside the
 *  Pell rich editor (which only knows simple HTML).  We deliberately avoid a
 *  full markdown lib to keep WebView payload tiny. */
function markdownishToHtml(text: string): string {
  if (!text) return '';
  let t = text;
  // Escape < and > first
  t = t.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Bold **x**
  t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  // Italic *x*
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>');
  // Headings
  t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  t = t.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  t = t.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bullets
  const lines = t.split(/\r?\n/);
  const out: string[] = [];
  let inUl = false;
  for (const ln of lines) {
    if (/^\s*[-*]\s+/.test(ln)) {
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${ln.replace(/^\s*[-*]\s+/, '')}</li>`);
    } else {
      if (inUl) { out.push('</ul>'); inUl = false; }
      if (ln.trim() === '') out.push('<p><br></p>');
      else if (/^<h[1-3]>/.test(ln)) out.push(ln);
      else out.push(`<p>${ln}</p>`);
    }
  }
  if (inUl) out.push('</ul>');
  return out.join('\n');
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brain: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, fontWeight: '800' },
  subtitle: { fontSize: 10, marginTop: 1 },
  headerBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
  },
  promptInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 110,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetsBar: { paddingVertical: 8, borderBottomWidth: 1 },
  presetsContent: { paddingHorizontal: 12, gap: 6, flexDirection: 'row' },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 130,
  },
  presetEmoji: { fontSize: 13 },
  presetLabel: { fontSize: 11, fontWeight: '700' },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  outputShell: {
    flex: 1,
    margin: 10,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  toolbarSticky: {
    borderBottomWidth: 1,
    paddingHorizontal: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  footerBtnGhost: {
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerBtnPrimary: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

export default PilotV2SaveAIPanel;
