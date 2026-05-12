/**
 * PilotV2BlockRichEditModal
 *
 * Modal that pops up when the user taps "Edit block" in the Pilot V2
 * editor.  It hosts the *exact same* RichNoteEditor + RichToolbar that the
 * Save-to-Pilot-V2 sheet uses, so editing a block now offers the full
 * formatting palette (bold, italic, underline, headings, lists, blockquote,
 * highlight, etc.) instead of the previous plain-text TextInput.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { X, Check, Highlighter, Eraser } from 'lucide-react-native';
import { RichToolbar, actions } from 'react-native-pell-rich-editor';
import RichNoteEditor from '../RichNoteEditor';
import { useTheme } from '../../context/ThemeContext';

type Props = {
  visible: boolean;
  initialHtml: string;
  onClose: () => void;
  onSave: (html: string) => void;
};

export const PilotV2BlockRichEditModal: React.FC<Props> = ({
  visible,
  initialHtml,
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();
  const richRef = useRef<any>(null);
  const [html, setHtml] = useState(initialHtml || '');
  const [editorKey, setEditorKey] = useState(0);
  const [showHlPicker, setShowHlPicker] = useState(false);
  const [hlColor, setHlColor] = useState('#FFF59D');

  useEffect(() => {
    if (visible) {
      setHtml(initialHtml || '');
      setEditorKey((k) => k + 1);
    }
  }, [visible, initialHtml]);

  const commitSave = async () => {
    let final = html;
    try {
      const live = await richRef.current?.getContentHtml?.();
      if (typeof live === 'string') final = live;
    } catch {}
    onSave(final);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end' }}
        >
          <View
            testID="pilot-v2-block-rich-edit-modal"
            style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>Edit block</Text>
                <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                  Full formatting toolbar ΓÇö bold, italic, headings, lists, highlight
                </Text>
              </View>
              <TouchableOpacity
                testID="pilot-v2-block-rich-edit-close"
                onPress={onClose}
                style={[styles.headerBtn, { borderColor: colors.border }]}
              >
                <X size={16} color={colors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                testID="pilot-v2-block-rich-edit-save"
                onPress={commitSave}
                style={[styles.headerBtnPrimary, { backgroundColor: '#5B4EFA' }]}
              >
                <Check size={14} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12, marginLeft: 4 }}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sticky toolbar */}
            <View
              style={[
                styles.toolbarSticky,
                { backgroundColor: colors.surfaceStrong, borderBottomColor: colors.border },
              ]}
            >
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
                  [actions.heading1]: ({ tintColor }: any) => (
                    <Text style={{ color: tintColor, fontWeight: '900', fontSize: 13 }}>H1</Text>
                  ),
                  [actions.heading2]: ({ tintColor }: any) => (
                    <Text style={{ color: tintColor, fontWeight: '800', fontSize: 11 }}>H2</Text>
                  ),
                  highlight: ({ tintColor }: any) => (
                    <View
                      style={{
                        padding: 4,
                        borderRadius: 4,
                        backgroundColor: hlColor === 'transparent' ? 'transparent' : hlColor,
                      }}
                    >
                      <Highlighter size={15} color={tintColor} />
                    </View>
                  ),
                }}
                onPress={(action) => {
                  if (action === 'highlight') {
                    setShowHlPicker((v) => !v);
                    return;
                  }
                  richRef.current?.sendAction?.(action as any);
                }}
              />
              {showHlPicker && (
                <View style={styles.hlRow}>
                  {[
                    'transparent',
                    '#FBCFE8',
                    '#DDD6FE',
                    '#BFDBFE',
                    '#BBF7D0',
                    '#FDE68A',
                    '#FED7AA',
                    '#CFFAFE',
                    '#E9D5FF',
                    '#FFF59D',
                  ].map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => {
                        setHlColor(c);
                        setShowHlPicker(false);
                        richRef.current?.focusContentEditor?.();
                        setTimeout(() => {
                          richRef.current?.commandDOM?.(`
                            (function(){
                              try {
                                document.execCommand('styleWithCSS', false, true);
                                if ('${c}' === 'transparent') {
                                  document.execCommand('hiliteColor', false, 'transparent');
                                  document.execCommand('backColor', false, 'transparent');
                                } else {
                                  document.execCommand('hiliteColor', false, '${c}');
                                  document.execCommand('backColor', false, '${c}');
                                }
                              } catch(e) {}
                            })();
                          `);
                        }, 60);
                      }}
                      style={[
                        styles.hlSwatch,
                        {
                          backgroundColor: c === 'transparent' ? colors.surface : c,
                          borderColor: hlColor === c ? '#5B4EFA' : colors.border,
                        },
                      ]}
                    >
                      {c === 'transparent' && <Eraser size={12} color={colors.textSecondary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
              <View
                style={[
                  styles.richShell,
                  { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
                ]}
              >
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
                  placeholder="Edit block content with full formattingΓÇª"
                  editorStyle={{ minHeight: 300 }}
                />
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    width: '100%',
    height: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontWeight: '900' },
  subtitle: { fontSize: 11, marginTop: 2 },
  headerBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 8,
  },
  toolbarSticky: { borderBottomWidth: 1, paddingHorizontal: 4 },
  richShell: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
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
});

export default PilotV2BlockRichEditModal;
