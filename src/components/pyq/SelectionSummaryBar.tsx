/**
 * SelectionSummaryBar — Sticky bar showing total selections + Clear / Review actions.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Eye, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  subjects: number;
  sections: number;
  micros: number;
  onClear: () => void;
  onReview?: () => void;
}

export const SelectionSummaryBar: React.FC<Props> = ({ subjects, sections, micros, onClear, onReview }) => {
  const { colors } = useTheme();
  const total = subjects + sections + micros;
  if (total === 0) return null;
  return (
    <View style={[styles.bar, { backgroundColor: colors.primary }]}> 
      <Text style={styles.text}>
        {subjects} Subject{subjects === 1 ? '' : 's'} · {sections} Section{sections === 1 ? '' : 's'} · {micros} Topic{micros === 1 ? '' : 's'} selected
      </Text>
      <View style={styles.actions}>
        {onReview && (
          <TouchableOpacity testID="sel-review" onPress={onReview} style={styles.actionBtn}>
            <Eye size={14} color="#fff" />
            <Text style={styles.actionText}>Review</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity testID="sel-clear-all" onPress={onClear} style={styles.actionBtn}>
          <Trash2 size={14} color="#fff" />
          <Text style={styles.actionText}>Clear All</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, marginVertical: 6 },
  text: { color: '#fff', fontWeight: '800', fontSize: 12, flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8 },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 11 },
});

export default SelectionSummaryBar;
