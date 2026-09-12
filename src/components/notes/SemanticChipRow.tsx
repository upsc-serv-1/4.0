/**
 * SemanticChipRow — horizontal chip row of "All + review tags" used as the
 * Knowledge Vault's content filter. Tags are sourced from the same
 * useNoteTagCatalog so adds/renames/removes from Tags-tab propagate live.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Filter } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { normalizeTag } from '../../utils/tagUtils';

interface Props {
  tags: string[];
  selected: string;
  onChange: (tag: string) => void;
  hint?: string;
}

const ALL_KEY = 'All';

export function SemanticChipRow({ tags, selected, onChange, hint }: Props) {
  const { colors } = useTheme();
  const isAll = normalizeTag(selected) === normalizeTag(ALL_KEY);

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <Filter size={13} color={colors.textTertiary} strokeWidth={2.4} />
          <Text style={[styles.headLabel, { color: colors.textTertiary }]}>Glance filter</Text>
        </View>
        {!isAll && (
          <TouchableOpacity
            onPress={() => onChange(ALL_KEY)}
            data-testid="vault-chip-clear"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.clearText, { color: colors.primary }]}>RESET</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {[ALL_KEY, ...tags].map((tag) => {
          const active = normalizeTag(selected) === normalizeTag(tag);
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => onChange(tag)}
              data-testid={`vault-chip-${normalizeTag(tag).replace(/\s+/g, '-')}`}
              activeOpacity={0.75}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.textPrimary : 'transparent',
                  borderColor: active ? colors.textPrimary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: active ? colors.bg : colors.textSecondary,
                    fontWeight: active ? '900' : '700',
                  },
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {hint && !isAll && (
        <Text style={[styles.hint, { color: colors.textTertiary }]} numberOfLines={1}>
          {hint}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 4, paddingBottom: 8 },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  clearText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  scrollContent: { paddingHorizontal: 12, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: { fontSize: 12, letterSpacing: 0.2 },
  hint: { paddingHorizontal: 16, marginTop: 6, fontSize: 11, fontWeight: '600' },
});
