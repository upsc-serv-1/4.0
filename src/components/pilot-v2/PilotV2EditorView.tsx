/** Pilot V2 — EditorView placeholder (Step 9 stub). */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export function PilotV2EditorView() {
  const { colors } = useTheme();
  return (
    <View testID="pilot-v2-editor-placeholder" style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.textSecondary }}>Editor — wired in Step 9</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
