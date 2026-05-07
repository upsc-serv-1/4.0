/**
 * AddToNotebookSheet — destination chooser for "Add to Notebook" actions.
 *
 * When a user clicks "Add to Notebook" in the Quiz / AI Search / etc. they
 * now see two save destinations per the Capsule spec:
 *
 *   1. Flashcards   — appends to a flashcard branch (legacy flow)
 *   2. Capsule      — appends as a structured block to a Capsule notebook
 *                     (Manual or Auto mode via CapsuleLocationPicker)
 *
 * Plain Notes (the legacy notes tab) remains available as a third option
 * — the Capsule tab is in addition to, not a replacement of, classic notes.
 */
import React from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Platform,
} from 'react-native';
import { Sparkles, Layers, FileText, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export type SaveDestination = 'flashcard' | 'capsule' | 'notes';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (dest: SaveDestination) => void;
  /** Hide options that are not relevant for this caller. */
  options?: SaveDestination[];
}

const META: Record<SaveDestination, { Icon: any; title: string; subtitle: string; tint: string }> = {
  flashcard: { Icon: Layers,    title: 'Flashcards',    subtitle: 'Convert into a spaced-repetition card', tint: '#5B7ADB' },
  capsule:   { Icon: Sparkles,  title: 'Capsule',       subtitle: 'Append a structured block to your Capsule notebook (Manual / Auto)', tint: '#7F77DD' },
  notes:     { Icon: FileText,  title: 'Notes',         subtitle: 'Save to your classic Notes tab',         tint: '#52A884' },
};

export const AddToNotebookSheet: React.FC<Props> = ({ visible, onClose, onPick, options }) => {
  const { colors } = useTheme();
  const order: SaveDestination[] = options || ['flashcard', 'capsule', 'notes'];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity activeOpacity={1} onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]} testID="add-to-notebook-sheet">
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Add to Notebook</Text>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="add-to-notebook-close">
              <X color={colors.textTertiary} size={20} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Where would you like to save this content?
          </Text>

          {order.map((d) => {
            const m = META[d];
            return (
              <TouchableOpacity
                key={d}
                testID={`add-to-notebook-pick-${d}`}
                onPress={() => onPick(d)}
                activeOpacity={0.85}
                style={[styles.row, { borderColor: colors.border }]}
              >
                <View style={[styles.iconBox, { backgroundColor: m.tint }]}>
                  <m.Icon color="#fff" size={20} strokeWidth={2.2} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{m.title}</Text>
                  <Text style={[styles.rowSub, { color: colors.textTertiary }]}>{m.subtitle}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    width: '100%', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 24,
  },
  head: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  title: { fontSize: 16, fontWeight: '700' },
  closeBtn: { padding: 6 },
  subtitle: { fontSize: 13, marginBottom: 14 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  iconBox: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub:   { fontSize: 12, marginTop: 2 },
});
