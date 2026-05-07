/**
 * Capsule Tab — placeholder home screen (replaced in Step 3 with the full
 * Subject Hub implementation).
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { PageWrapper } from '../../src/components/PageWrapper';

export default function CapsuleHomePlaceholder() {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <PageWrapper>
      <View style={styles.topBar}>
        <TouchableOpacity testID="capsule-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft color={colors.textPrimary} size={22} />
          <Text style={[styles.backTxt, { color: colors.textPrimary }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Capsule</Text>
      </View>

      <View style={styles.center} testID="capsule-empty">
        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceStrong || '#F0EBFF' }]}>
          <Sparkles color={colors.primary} size={48} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Capsule is being built</Text>
        <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
          Subject &gt; Topic &gt; Subtopic &gt; Notebook hierarchy and the
          infinite-glance reading workspace are landing in the next steps.
        </Text>
      </View>
    </PageWrapper>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 12,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backTxt: { fontSize: 15, marginLeft: 2, fontWeight: '500' },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center', marginRight: 56 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconWrap: {
    width: 96, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
