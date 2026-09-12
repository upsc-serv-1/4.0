import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface StatusMeterProps {
  correct: number;
  incorrect: number;
  skipped: number;
  total: number;
  height?: number;
}

export const StatusMeter = ({ correct, incorrect, skipped, total, height = 10 }: StatusMeterProps) => {
  const { colors } = useTheme();
  
  if (total === 0) return null;

  const correctPct = (correct / total) * 100;
  const incorrectPct = (incorrect / total) * 100;
  const skippedPct = (skipped / total) * 100;

  return (
    <View style={[styles.container, { height, backgroundColor: '#f1f5f9' }]}>
      <View style={[styles.segment, { width: `${correctPct}%`, backgroundColor: '#10b981', minWidth: correctPct > 0 ? 2 : 0 }]} />
      <View style={[styles.segment, { width: `${incorrectPct}%`, backgroundColor: '#ef4444', minWidth: incorrectPct > 0 ? 2 : 0 }]} />
      <View style={[styles.segment, { width: `${skippedPct}%`, backgroundColor: '#94a3b8', minWidth: skippedPct > 0 ? 2 : 0 }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: 5,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
});
