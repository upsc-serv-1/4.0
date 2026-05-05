/**
 * CompareWindowsPanel — Side-by-side comparison of two year windows for the
 * currently filtered `rawQuestions`. Shows ▲ ▼ deltas at the chosen group level.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { GroupLevel } from '../../lib/pyqPredictive';

interface Props {
  rawQuestions: any[];
  getYear: (q: any) => number | null;
  getSubject: (q: any) => string;
  level?: GroupLevel;
  defaultA?: [number, number];
  defaultB?: [number, number];
}

const bucketKey = (q: any, level: GroupLevel, getSubject: (q: any) => string) => {
  if (level === 'subject') return getSubject(q).trim();
  if (level === 'section_group') return String(q.section_group || 'General').trim();
  return String(q.micro_topic || 'Other').trim();
};

export const CompareWindowsPanel: React.FC<Props> = ({
  rawQuestions, getYear, getSubject, level = 'subject',
  defaultA = [2014, 2018], defaultB = [2020, 2025],
}) => {
  const { colors } = useTheme();
  const [aStart, setAStart] = useState(String(defaultA[0]));
  const [aEnd, setAEnd] = useState(String(defaultA[1]));
  const [bStart, setBStart] = useState(String(defaultB[0]));
  const [bEnd, setBEnd] = useState(String(defaultB[1]));

  const rows = useMemo(() => {
    const aS = Number(aStart), aE = Number(aEnd), bS = Number(bStart), bE = Number(bEnd);
    if (![aS, aE, bS, bE].every(Number.isFinite)) return [];
    const aMap: Record<string, number> = {};
    const bMap: Record<string, number> = {};
    for (const q of rawQuestions) {
      const y = getYear(q);
      if (!y) continue;
      const k = bucketKey(q, level, getSubject);
      if (y >= Math.min(aS, aE) && y <= Math.max(aS, aE)) aMap[k] = (aMap[k] || 0) + 1;
      if (y >= Math.min(bS, bE) && y <= Math.max(bS, bE)) bMap[k] = (bMap[k] || 0) + 1;
    }
    const keys = new Set([...Object.keys(aMap), ...Object.keys(bMap)]);
    const list = Array.from(keys).map((k) => {
      const a = aMap[k] || 0;
      const b = bMap[k] || 0;
      const delta = b - a;
      const pct = a === 0 ? (b > 0 ? 100 : 0) : Math.round(((b - a) / a) * 100);
      return { key: k, a, b, delta, pct };
    });
    list.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    return list.slice(0, 20);
  }, [rawQuestions, getYear, getSubject, level, aStart, aEnd, bStart, bEnd]);

  const yi = (v: string, set: (v: string) => void, testID: string) => (
    <TextInput
      testID={testID}
      keyboardType="number-pad"
      maxLength={4}
      value={v}
      onChangeText={set}
      style={[styles.year, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.surfaceStrong }]}
    />
  );

  return (
    <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Compare Windows</Text>

      <View style={styles.windows}>
        <View style={styles.window}>
          <Text style={[styles.windowLabel, { color: colors.textTertiary }]}>WINDOW A</Text>
          <View style={styles.yearRow}>{yi(aStart, setAStart, 'cmp-a-start')}<Text style={[styles.dash, { color: colors.textTertiary }]}>—</Text>{yi(aEnd, setAEnd, 'cmp-a-end')}</View>
        </View>
        <View style={styles.window}>
          <Text style={[styles.windowLabel, { color: colors.textTertiary }]}>WINDOW B</Text>
          <View style={styles.yearRow}>{yi(bStart, setBStart, 'cmp-b-start')}<Text style={[styles.dash, { color: colors.textTertiary }]}>—</Text>{yi(bEnd, setBEnd, 'cmp-b-end')}</View>
        </View>
      </View>

      <View style={[styles.headerRow, { borderColor: colors.border }]}>
        <Text style={[styles.h, { color: colors.textTertiary, flex: 1 }]}>{level.toUpperCase()}</Text>
        <Text style={[styles.h, { color: colors.textTertiary, width: 50, textAlign: 'right' }]}>A</Text>
        <Text style={[styles.h, { color: colors.textTertiary, width: 50, textAlign: 'right' }]}>B</Text>
        <Text style={[styles.h, { color: colors.textTertiary, width: 80, textAlign: 'right' }]}>Δ</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>Set both windows to see comparison.</Text>
      ) : rows.map((r) => {
        const Icon = r.delta > 0 ? ArrowUpRight : r.delta < 0 ? ArrowDownRight : Minus;
        const fg = r.delta > 0 ? '#10b981' : r.delta < 0 ? '#ef4444' : colors.textTertiary;
        return (
          <View key={r.key} style={[styles.row, { borderBottomColor: colors.border + '60' }]}>
            <Text style={[styles.k, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>{r.key}</Text>
            <Text style={[styles.v, { color: colors.textSecondary, width: 50, textAlign: 'right' }]}>{r.a}</Text>
            <Text style={[styles.v, { color: colors.textSecondary, width: 50, textAlign: 'right' }]}>{r.b}</Text>
            <View style={styles.delta}>
              <Icon size={14} color={fg} />
              <Text style={{ color: fg, fontWeight: '800', fontSize: 12 }}>{r.delta > 0 ? '+' : ''}{r.delta} ({r.pct > 0 ? '+' : ''}{r.pct}%)</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, marginVertical: 8 },
  title: { fontSize: 14, fontWeight: '900', marginBottom: 10 },
  windows: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  window: { flex: 1 },
  windowLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4, marginBottom: 4 },
  yearRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  year: { width: 64, height: 38, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, fontWeight: '700', textAlign: 'center' },
  dash: { fontSize: 14, fontWeight: '800' },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, paddingBottom: 6, marginBottom: 4 },
  h: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
  k: { fontWeight: '700', fontSize: 13 },
  v: { fontWeight: '700', fontSize: 12 },
  delta: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 80, justifyContent: 'flex-end' },
  empty: { fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
});

export default CompareWindowsPanel;
