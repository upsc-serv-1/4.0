/**
 * ActiveFiltersBar — Always-visible chips showing current filters; tap × to remove.
 *
 * Section 3 fix: chips now wrap onto multiple lines and are fully visible —
 * no clipping, no overlap with surrounding UI. A horizontal ScrollView used
 * to truncate long labels like "Prelims GS Paper 1" behind adjacent chips,
 * so we switched to a flex-wrap container with comfortable spacing.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
    <View style={styles.container} testID="active-filters-bar">
      <View style={styles.row}>
        {filters.map((f) => (
          <View
            key={f.id}
            testID={`filter-chip-${f.id}`}
            style={[
              styles.chip,
              {
                borderColor: colors.primary + '55',
                backgroundColor: colors.primary + '14',
              },
            ]}
          >
            <Text
              style={[styles.text, { color: colors.textPrimary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {f.label}
            </Text>
            {f.onRemove && (
              <TouchableOpacity testID={`filter-remove-${f.id}`} onPress={f.onRemove} hitSlop={8} style={styles.removeBtn}>
                <X size={12} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: '100%',
  },
  text: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
  removeBtn: { padding: 2 },
});

export default ActiveFiltersBar;
