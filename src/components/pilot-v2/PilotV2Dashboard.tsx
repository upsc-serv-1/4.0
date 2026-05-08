/** Pilot V2 — Dashboard placeholder (Step 6 stub). */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export function PilotV2Dashboard() {
  const { colors } = useTheme();
  return (
    <View testID="pilot-v2-dashboard-placeholder" style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.textSecondary }}>Dashboard — wired in Step 6</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
