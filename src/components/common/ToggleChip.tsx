/**
 * ToggleChip — Standardized chip used by export sheet & filters.
 *
 * Selected = filled (primary)
 * Unselected = outlined
 *
 * Touch target enforced ≥ 44pt height. Use `compact` for in-row dense use.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
  compact?: boolean;
  testID?: string;
}

export const ToggleChip: React.FC<Props> = ({ label, active, onPress, compact, testID }) => {
  const { colors } = useTheme();
  const handle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };
  return (
    <TouchableOpacity
      testID={testID}
      onPress={handle}
      activeOpacity={0.85}
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        { borderColor: colors.border, backgroundColor: colors.surfaceStrong },
        active && { backgroundColor: colors.primary, borderColor: colors.primary },
      ]}
    >
      <Text style={[styles.text, compact ? styles.textCompact : styles.textRegular, { color: active ? '#fff' : colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: { borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  regular: { paddingVertical: 12, paddingHorizontal: 16, minHeight: 44 },
  compact: { paddingVertical: 8, paddingHorizontal: 12, minHeight: 36 },
  text: { fontWeight: '700' },
  textRegular: { fontSize: 13 },
  textCompact: { fontSize: 12 },
});

export default ToggleChip;
