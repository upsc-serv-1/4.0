/**
 * Pilot V2 — placeholder Sidebar (Step 3 stub).
 * Replaced fully in Steps 4 & 5 (Home mode + Subject mode).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

export function PilotV2Sidebar({ mode }: { mode: 'home' | 'subject' }) {
  const { colors } = useTheme();
  return (
    <View
      testID="pilot-v2-sidebar-placeholder"
      style={[styles.root, { backgroundColor: colors.surface, borderRightColor: colors.border }]}
    >
      <Text style={{ color: colors.textTertiary, fontSize: 12 }}>
        Sidebar ({mode}) — wired in Step 4/5
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: 300, borderRightWidth: 1, padding: 16 },
});
