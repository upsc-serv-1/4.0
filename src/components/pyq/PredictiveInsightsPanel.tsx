/**
 * PredictiveInsightsPanel — Renders the output of `buildPredictive()` as three sections:
 *   • 🔥 Probable Hot Topics for 2026
 *   • 📈 Rising Topics
 *   • ⭐ Frequency-Weighted Importance Leaderboard
 *
 * Tap any row → calls `onRowPress(level, key)` so caller can wire it to Learn mode.
 */
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Flame, Star, TrendingUp } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { buildPredictive, GroupLevel, PredictiveRow, probableHotsFor2026, risingTopics } from '../../lib/pyqPredictive';

interface Props {
  rawQuestions: any[];
  getYear: (q: any) => number | null;
  getSubject: (q: any) => string;
  level?: GroupLevel;            // default: 'micro_topic'
  onRowPress?: (level: GroupLevel, key: string) => void;
}

const TrendBadge: React.FC<{ row: PredictiveRow }> = ({ row }) => {
  const { colors } = useTheme();
  const map: Record<PredictiveRow['trend'], { bg: string; fg: string; label: string }> = {
    rising: { bg: '#dcfce7', fg: '#15803d', label: 'Rising' },
    falling: { bg: '#fee2e2', fg: '#b91c1c', label: 'Falling' },
    stable: { bg: '#e5e7eb', fg: '#374151', label: 'Stable' },
  };
  const t = map[row.trend];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={{ color: t.fg, fontWeight: '800', fontSize: 10 }}>{t.label}</Text>
    </View>
  );
};

const Row: React.FC<{ row: PredictiveRow; rank: number; onPress?: () => void }> = ({ row, rank, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      testID={`pred-row-${row.key}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.row, { borderBottomColor: colors.border + '70' }]}
    >
      <Text style={[styles.rank, { color: colors.textTertiary }]}>{rank}</Text>
      <View style={{ flex: 1, paddingHorizontal: 8 }}>
        <Text style={[styles.label, { color: colors.textPrimary }]} numberOfLines={1}>{row.key}</Text>
        <Text style={[styles.sub, { color: colors.textTertiary }]}>
          Total {row.totalQuestions} · Streak {row.streak}y · 2026 fc {row.forecast2026.point} ({row.forecast2026.low}–{row.forecast2026.high})
        </Text>
      </View>
      <TrendBadge row={row} />
      <Text style={[styles.score, { color: colors.primary }]}>{row.hotScore}</Text>
    </TouchableOpacity>
  );
};

export const PredictiveInsightsPanel: React.FC<Props> = ({ rawQuestions, getYear, getSubject, level = 'micro_topic', onRowPress }) => {
  const { colors } = useTheme();
  const predictive = useMemo(
    () => buildPredictive(rawQuestions, getYear, { level, getSubject }),
    [rawQuestions, getYear, getSubject, level]
  );

  const hots = useMemo(() => probableHotsFor2026(predictive, 2, 10), [predictive]);
  const rising = useMemo(() => risingTopics(predictive, 10), [predictive]);
  const fwiTop = useMemo(() => predictive.slice(0, 10), [predictive]);

  const Section: React.FC<{ title: string; icon: React.ReactNode; rows: PredictiveRow[]; emptyText: string }> = ({ title, icon, rows, emptyText }) => (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.sectionHead}>
        {icon}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>{emptyText}</Text>
      ) : (
        rows.map((r, i) => <Row key={r.key} row={r} rank={i + 1} onPress={() => onRowPress?.(level, r.key)} />)
      )}
    </View>
  );

  if (predictive.length === 0) {
    return (
      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.empty, { color: colors.textTertiary }]}>Not enough data for predictions yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
      <Section
        title="Probable Hot Topics — 2026"
        icon={<Flame size={16} color="#ef4444" />}
        rows={hots}
        emptyText="No clear forecast yet."
      />
      <Section
        title="Rising Topics"
        icon={<TrendingUp size={16} color="#10b981" />}
        rows={rising}
        emptyText="No topic is rising significantly in the chosen window."
      />
      <Section
        title="Frequency-Weighted Importance"
        icon={<Star size={16} color="#f59e0b" />}
        rows={fwiTop}
        emptyText="—"
      />
      <Text style={[styles.disclaimer, { color: colors.textTertiary }]}>
        Forecast = linear projection over the last 8 years with an 80% confidence band.
        Hot Score combines FWI (0.55), recent slope (0.30) and 2026 forecast (0.15).
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  section: { borderWidth: 1, borderRadius: 14, padding: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '900' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  rank: { width: 22, textAlign: 'center', fontWeight: '800', fontSize: 12 },
  label: { fontWeight: '800', fontSize: 13 },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  badge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, marginLeft: 6 },
  score: { fontSize: 14, fontWeight: '900', minWidth: 36, textAlign: 'right' },
  empty: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
  disclaimer: { fontSize: 10, fontStyle: 'italic', textAlign: 'center', marginTop: 4, lineHeight: 14, paddingHorizontal: 8 },
});

export default PredictiveInsightsPanel;
