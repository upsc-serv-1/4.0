/**
 * PilotV2BlockRichEditModal
 * 
 * Replaced with our native premium Vitamin Editor to match the styling, 
 * formatting, and full AI capabilities including the integrated 
 * PilotV2SaveAIPanel side-drawer and "Paste AI" features.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  SafeAreaView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert, Dimensions, ScrollView, Keyboard
} from 'react-native';
import { X, Save, Clipboard, Brain, Undo2, Redo2, Highlighter, Eraser, Plus, Sparkles, ArrowDownToLine, Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import RichNoteEditor from '../RichNoteEditor';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import PilotV2SaveAIPanel, { PilotV2SaveAIPanelHandle } from './PilotV2SaveAIPanel';
import * as ClipboardSvc from 'expo-clipboard';

type Props = {
  visible: boolean;
  initialHtml: string;
  onClose: () => void;
  onSave: (html: string) => void;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Simple Markdown -> HTML helper for pasting AI content */
function markdownishToHtml(text: string): string {
  if (!text) return '';
  let t = text;
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

export const PilotV2BlockRichEditModal: React.FC<Props> = ({
  visible,
  initialHtml,
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();
  const [html, setHtml] = useState(initialHtml || '');
  const [loading, setLoading] = useState(false);
  const richRef = useRef<any>(null);
  const aiPanelRef = useRef<PilotV2SaveAIPanelHandle>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [hlColor, setHlColor] = useState('#FFF59D');
  const [showHlPicker, setShowHlPicker] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setHtml(initialHtml || '');
      setEditorKey(k => k + 1);
      setShowAiPanel(false);
    }
  }, [visible, initialHtml]);

  const handleSave = async () => {
    let finalHtml = html;
    try {
      const live = await richRef.current?.getContentHtml?.();
      if (typeof live === 'string' && live.trim()) finalHtml = live;
    } catch { }

    setLoading(true);
    try {
      onSave(finalHtml);
      onClose();
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not save block.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasteFormatted = async () => {
    const text = await ClipboardSvc.getStringAsync();
    if (!text) return;
    const liveHtml = markdownishToHtml(text);
    richRef.current?.insertHTML(liveHtml);
    setTimeout(async () => {
      const live = await richRef.current?.getContentHtml?.();
      if (live) setHtml(live);
    }, 100);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
        />
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.surface, zIndex: 10 }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={[styles.brand, { backgroundColor: '#5B4EFA' }]}>
                <Save size={18} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Edit Block</Text>
                <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                  Full formatting toolbar & native Vitamin AI assistant
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowAiPanel(v => !v)}
                style={[styles.actionBtn, { backgroundColor: showAiPanel ? '#EEECFF' : 'transparent' }]}
              >
                <Brain size={20} color={showAiPanel ? '#5B4EFA' : colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                style={[styles.actionBtn, { marginLeft: 4 }]}
              >
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {showAiPanel ? (
              <View style={{ flex: 1 }}>
                <PilotV2SaveAIPanel
                  ref={aiPanelRef}
                  visible={showAiPanel}
                  onClose={() => setShowAiPanel(false)}
                  onInsert={(liveHtml) => {
                    const next = (html || '').trim() ? `${html}<p><br></p>${liveHtml}` : liveHtml;
                    setHtml(next);
                    setEditorKey(k => k + 1);
                    setShowAiPanel(false);
                  }}
                  seedContext={{
                    body: html || null
                  }}
                />
              </View>
            ) : (
              <>
                {/* 🔧 FIX: Toolbar is now ALWAYS visible — never hidden on keyboard open.
                    Formatting tools are needed MOST while typing.  KeyboardAvoidingView
                    handles viewport shrinkage so the toolbar stays docked at the top. */}
                <View style={[styles.toolbarContainer, { backgroundColor: colors.surfaceStrong, borderBottomColor: colors.border }]}>
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
                    }}
                    onPress={(action) => {
                      if (action === 'highlight') {
                        setShowHlPicker(v => !v);
                        return;
                      }
                      richRef.current?.focusContentEditor?.();
                      setTimeout(() => {
                        richRef.current?.sendAction?.(action as any);
                      }, 50);
                    }}
                  />
                  {showHlPicker && (
                    <View style={styles.hlRow}>
                      {['transparent', '#FFF59D', '#BBF7D0', '#BFDBFE', '#FBCFE8', '#DDD6FE'].map(c => (
                        <TouchableOpacity
                          key={c}
                          onPress={() => {
                            setHlColor(c);
                            setShowHlPicker(false);
                            richRef.current?.focusContentEditor?.();
                            setTimeout(() => {
                              if (c === 'transparent') {
                                richRef.current?.commandDOM?.("document.execCommand('hiliteColor', false, 'transparent')");
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

                {/* Editor Area */}
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                  <View style={styles.editorContainer}>
                    <RichNoteEditor
                      key={editorKey}
                      ref={richRef}
                      html={html}
                      onChange={setHtml}
                      themeColors={{
                        bg: colors.surfaceStrong,
                        surface: colors.surface,
                        textPrimary: colors.textPrimary,
                        border: colors.border,
                        primary: '#5B4EFA',
                      }}
                      placeholder="Edit block content with full Vitamin formatting…"
                      editorStyle={{ minHeight: 320 }}
                    />
                  </View>
                </ScrollView>
              </>
            )}

            {/* Footer */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {showAiPanel ? (
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <TouchableOpacity
                    onPress={handlePasteFormatted}
                    style={[styles.pasteAiBtn, { flex: 1, backgroundColor: '#EEECFF', borderColor: '#5B4EFA', paddingVertical: 12 }]}
                  >
                    <Sparkles size={14} color="#5B4EFA" />
                    <Text style={{ color: '#5B4EFA', fontWeight: '800', fontSize: 12 }}>Paste AI</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={[styles.saveBtn, { flex: 1.2, backgroundColor: colors.primary, opacity: loading ? 0.6 : 1, paddingVertical: 12 }]}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Check size={16} color="#fff" />
                        <Text style={[styles.saveText, { fontSize: 13 }]}>Save Block</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => aiPanelRef.current?.triggerInsert()}
                    style={[styles.saveBtn, { flex: 1, backgroundColor: '#10b981', paddingVertical: 12 }]}
                  >
                    <ArrowDownToLine size={14} color="#fff" />
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>Insert</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={handlePasteFormatted}
                    style={[styles.pasteAiBtn, { backgroundColor: '#EEECFF', borderColor: '#5B4EFA' }]}
                  >
                    <Sparkles size={16} color="#5B4EFA" />
                    <Text style={{ color: '#5B4EFA', fontWeight: '800', fontSize: 13 }}>Paste AI Response</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Check size={18} color="#fff" />
                        <Text style={styles.saveText}>Save Block Changes</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  sheet: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    padding: 16,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  brand: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '900' },
  subtitle: { fontSize: 12, marginTop: 2 },
  closeBtn: { padding: 4 },
  actionBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  toolbarContainer: {
    borderBottomWidth: 1,
    paddingVertical: 2,
  },
  hlRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  hlSwatch: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorContainer: {
    flex: 1,
    paddingTop: 12,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    gap: 10,
  },
  pasteAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  saveText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
});

export default PilotV2BlockRichEditModal;
