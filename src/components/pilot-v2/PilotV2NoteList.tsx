/** Pilot V2 — NoteList placeholder (Step 7 stub). */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export function PilotV2NoteList() {
  const { colors } = useTheme();
  return (
    <View testID="pilot-v2-notelist-placeholder" style={[styles.root, { backgroundColor: colors.bg }]}>
      <Text style={{ color: colors.textSecondary }}>Note List — wired in Step 7</Text>
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
