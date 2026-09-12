/**
 * Reusable Capsule "create node" prompt.
 *
 * Modal that asks for a title (and optionally a colour) to create a Capsule
 * subject / topic / subtopic / notebook. Mirrors the +New dialog from the
 * bible (centered card, purple primary CTA).
 */
import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { CAPSULE_SUBJECT_PALETTE, CapsuleNodeType } from '../../types/capsule';

interface Props {
  visible: boolean;
  type: CapsuleNodeType;
  defaultColor?: string | null;
  onCancel: () => void;
  onCreate: (input: { title: string; color?: string }) => Promise<void> | void;
}

const SWATCHES = [
  '#7F77DD', '#FF9500', '#D1654B', '#4CAF50', '#5B7ADB', '#52A884', '#F5A623', '#E83E8C',
];

const TITLE_BY_TYPE: Record<CapsuleNodeType, string> = {
  subject:  'New Subject',
  topic:    'New Topic',
  subtopic: 'New Subtopic',
  notebook: 'New Notebook',
};

const PLACEHOLDER_BY_TYPE: Record<CapsuleNodeType, string> = {
  subject:  'e.g. Polity, Economy, Geography',
  topic:    'e.g. Fundamental Rights, Parliament',
  subtopic: 'e.g. Right to Equality',
  notebook: 'e.g. Article 14 Cases',
};

export const CapsuleCreatePrompt: React.FC<Props> = ({ visible, type, defaultColor, onCancel, onCreate }) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [color, setColor] = useState<string>(defaultColor || CAPSULE_SUBJECT_PALETTE.default);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setColor(defaultColor || CAPSULE_SUBJECT_PALETTE.default);
      setBusy(false);
    }
  }, [visible, defaultColor]);

  const handleSubmit = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await onCreate({ title: trimmed, color: type === 'subject' ? color : undefined });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity activeOpacity={1} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View style={[styles.card, { backgroundColor: colors.surface }]} testID={`capsule-create-${type}`}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{TITLE_BY_TYPE[type]}</Text>

          <TextInput
            testID="capsule-create-title-input"
            value={title}
            onChangeText={setTitle}
            placeholder={PLACEHOLDER_BY_TYPE[type]}
            placeholderTextColor={colors.textTertiary}
            autoFocus
            style={[
              styles.input,
              { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong },
            ]}
            onSubmitEditing={handleSubmit}
            returnKeyType="done"
          />

          {type === 'subject' && (
            <View style={styles.swatchRow}>
              {SWATCHES.map((c) => (
                <TouchableOpacity
                  key={c}
                  testID={`capsule-swatch-${c}`}
                  onPress={() => setColor(c)}
                  style={[
                    styles.swatch,
                    { backgroundColor: c, borderColor: color === c ? colors.textPrimary : 'transparent' },
                  ]}
                />
              ))}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              testID="capsule-create-cancel"
              onPress={onCancel}
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.btnTxt, { color: colors.textPrimary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="capsule-create-submit"
              onPress={handleSubmit}
              disabled={busy || !title.trim()}
              style={[
                styles.btn, { backgroundColor: colors.primary, opacity: !title.trim() ? 0.6 : 1 },
              ]}
            >
              <Text style={[styles.btnTxt, { color: '#fff', fontWeight: '600' }]}>
                {busy ? 'Creating…' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  card: { width: '100%', maxWidth: 420, borderRadius: 16, padding: 20 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  input: {
    height: 44, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  swatch: { width: 28, height: 28, borderRadius: 8, borderWidth: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  btn: {
    paddingHorizontal: 16, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { borderWidth: 1, backgroundColor: 'transparent' },
  btnTxt: { fontSize: 14 },
});
