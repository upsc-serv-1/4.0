/**
 * ActiveFiltersBar — Always-visible chips showing current filters; tap × to remove.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export interface ActiveFilter {
  id: string;
  label: string;
  onRemove?: () => void;
}

export const ActiveFiltersBar: React.FC<{ filters: ActiveFilter[] }> = ({ filters }) => {
  const { colors } = useTheme();
  if (filters.length === 0) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {filters.map((f) => (
        <View key={f.id} style={[styles.chip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.text, { color: colors.textPrimary }]} numberOfLines={1}>{f.label}</Text>
          {f.onRemove && (
            <TouchableOpacity testID={`filter-remove-${f.id}`} onPress={f.onRemove} hitSlop={8}>
              <X size={12} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { paddingVertical: 6, gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '700', maxWidth: 160 },
});

export default ActiveFiltersBar;
