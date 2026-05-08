/** Pilot V2 — GlanceView placeholder (Step 8 stub). */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export function PilotV2GlanceView() {
  const { colors } = useTheme();
  return (
    <View testID="pilot-v2-glance-placeholder" style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.textSecondary }}>Glance View — wired in Step 8</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
