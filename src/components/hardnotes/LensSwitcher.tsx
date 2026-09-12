/**
 * LensSwitcher — segmented control that flips the editor between
 * Glance (read/edit bullets), Focus (parchment reader) and Ink (pencil).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Sparkles, BookOpen, PenTool } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

export type Lens = 'glance' | 'focus' | 'ink';

interface Props {
  value: Lens;
  onChange: (l: Lens) => void;
}

const LENSES: { key: Lens; label: string; icon: any; color: string }[] = [
  { key: 'glance', label: 'Glance', icon: Sparkles, color: '#6366f1' },
  { key: 'focus', label: 'Focus', icon: BookOpen, color: '#b45309' },
  { key: 'ink', label: 'Ink', icon: PenTool, color: '#0ea5e9' },
];

export function LensSwitcher({ value, onChange }: Props) {
  const { colors } = useTheme();

  const ping = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  return (
    <View style={[s.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]} data-testid="lens-switcher">
      {LENSES.map((l) => {
        const active = value === l.key;
        const Icon = l.icon;
        return (
          <TouchableOpacity
            key={l.key}
            onPress={() => {
              if (!active) {
                onChange(l.key);
                ping();
              }
            }}
            data-testid={`lens-${l.key}`}
            activeOpacity={0.8}
            style={[
              s.seg,
              active && { backgroundColor: l.color + '14', borderColor: l.color + '50' },
            ]}
          >
            <Icon size={13} color={active ? l.color : colors.textTertiary} strokeWidth={active ? 2.5 : 2} />
            <Text
              style={[
                s.segLabel,
                { color: active ? l.color : colors.textTertiary, fontWeight: active ? '900' : '700' },
              ]}
            >
              {l.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 2,
  },
  seg: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segLabel: { fontSize: 11, letterSpacing: 0.3 },
});
