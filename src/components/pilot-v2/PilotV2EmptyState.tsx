/**
 * Pilot V2 — Empty State (placeholder topic prompt)
 *
 * Shown when the user expanded a subject in the sidebar but has not picked a
 * subtopic yet. Mirrors the EmptyState from the Knowledge Management app.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

export function PilotV2EmptyState() {
  const { colors } = useTheme();
  return (
    <View
      testID="pilot-v2-empty-state"
      style={[styles.root, { backgroundColor: colors.bg }]}
    >
      <View style={[styles.bubble, { backgroundColor: colors.primary + '1A' }]}>
        <BookOpen size={36} color={colors.primary} />
      </View>
      <Text style={[styles.line, { color: colors.textSecondary }]}>
        Select a topic to view notes
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bubble: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  line: { fontSize: 14, fontWeight: '500' },
});
