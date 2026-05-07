/**
 * Breadcrumb bar — Polity > Fundamental Rights > Right to Equality.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import type { CapsuleNode } from '../../types/capsule';

interface Props {
  trail: CapsuleNode[];
  onJump: (index: number) => void;
  onJumpRoot?: () => void;
}

export const CapsuleBreadcrumb: React.FC<Props> = ({ trail, onJump, onJumpRoot }) => {
  const { colors } = useTheme();
  if (trail.length === 0) return null;
  return (
    <View style={[styles.wrap, { borderBottomColor: colors.border }]} testID="capsule-breadcrumb">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <TouchableOpacity onPress={onJumpRoot}>
          <Text style={[styles.crumb, { color: colors.primary }]}>Capsule</Text>
        </TouchableOpacity>
        {trail.map((n, i) => {
          const last = i === trail.length - 1;
          return (
            <View key={n.id} style={styles.row}>
              <ChevronRight color={colors.textTertiary} size={14} style={styles.sep} />
              {last ? (
                <Text style={[styles.crumb, styles.crumbActive, { color: colors.textPrimary }]} numberOfLines={1}>
                  {n.title}
                </Text>
              ) : (
                <TouchableOpacity onPress={() => onJump(i)}>
                  <Text style={[styles.crumb, { color: colors.primary }]} numberOfLines={1}>{n.title}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  sep: { marginHorizontal: 6 },
  crumb: { fontSize: 13, fontWeight: '400' },
  crumbActive: { fontWeight: '600' },
});
