import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Play, Layers, Check, ChevronDown } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../src/context/ThemeContext';
import { supabase } from '../src/lib/supabase';
import { mergeQuestions } from '../src/utils/merger';

const DEFAULT_KEY = 'dedup_default_explanations';

export default function DedupManagerScreen() {
  const { colors } = useTheme();
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [yearStart, setYearStart] = useState('');
  const [yearEnd, setYearEnd] = useState('');
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<{ total: number; merged: number; unique: number } | null>(null);
  const [clusters, setClusters] = useState<any[]>([]);
  const [defaults, setDefaults] = useState<Record<string, string>>({});
  const [showSubs, setShowSubs] = useState(false);

  React.useEffect(() => {
    AsyncStorage.getItem(DEFAULT_KEY).then(s => {
      try { if (s) setDefaults(JSON.parse(s)); } catch {}
    });
  }, []);

  const loadSubjects = async () => {
    if (allSubjects.length) { setShowSubs(s => !s); return; }
    const { data } = await supabase.from('questions').select('subject')
      .eq('is_pyq', true).eq('is_upsc_cse', true).limit(5000);
    const uniq = Array.from(new Set((data || []).map((r: any) => r.subject).filter(Boolean))).sort();
    setAllSubjects(uniq as string[]);
    setShowSubs(true);
  };

  const toggleSub = (s: string) => {
    setSubjects(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s]);
  };

  const run = async () => {
    setRunning(true); setClusters([]); setStats(null);
    try {
      let q = supabase.from('questions')
        .select('id, question_text, explanation_markdown, correct_answer, subject, exam_year, source, test_id, is_pyq, is_upsc_cse, is_upsc_cms, is_neetpg, is_inicet, tests(institute)')
        .eq('is_pyq', true).eq('is_upsc_cse', true).limit(10000);
      if (subjects.length) q = q.in('subject', subjects);
      if (yearStart) q = q.gte('exam_year', yearStart);
      if (yearEnd) q = q.lte('exam_year', yearEnd);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data || [];

      const { mergedQs } = mergeQuestions(rows as any[]);
      const dupClusters = mergedQs.filter((m: any) => (m._institutes?.length || 0) > 1);
      const merged = rows.length - mergedQs.length;
      setStats({ total: rows.length, merged, unique: mergedQs.length });
      setClusters(dupClusters.sort((a: any, b: any) => (b._institutes.length - a._institutes.length)));
    } catch (e: any) {
      Alert.alert('Dedup failed', e.message || 'Unknown error');
    } finally { setRunning(false); }
  };

  const setDefault = async (clusterId: string, inst: string) => {
    const next = { ...defaults, [clusterId]: inst };
    setDefaults(next);
    await AsyncStorage.setItem(DEFAULT_KEY, JSON.stringify(next));
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} testID="dedup-back" style={{ padding: 8 }}>
          <ChevronLeft color={colors.textPrimary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={{ color: colors.textPrimary, fontWeight: '900', fontSize: 18 }}>Dedup Manager</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: '700' }}>Smart-merge UPSC PYQs across institutes</Text>
        </View>
        <Layers color={colors.primary} size={22} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[s.lbl, { color: colors.textTertiary }]}>SUBJECTS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            <TouchableOpacity onPress={() => setSubjects([])}
              style={[s.chip, { borderColor: colors.border }, subjects.length === 0 && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              <Text style={{ color: subjects.length === 0 ? '#fff' : colors.textSecondary, fontWeight: '800', fontSize: 12 }}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="dedup-load-subjects" onPress={loadSubjects}
              style={[s.chip, { borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
              <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 12 }}>
                {allSubjects.length ? `${subjects.length || 'Pick'} of ${allSubjects.length}` : 'Load list'}
              </Text>
              <ChevronDown size={12} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
          {showSubs && allSubjects.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              {allSubjects.map(sub => {
                const sel = subjects.includes(sub);
                return (
                  <TouchableOpacity key={sub} onPress={() => toggleSub(sub)}
                    style={[s.chip, { borderColor: colors.border, paddingHorizontal: 10 }, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={{ color: sel ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 11 }}>{sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.lbl, { color: colors.textTertiary }]}>YEAR FROM</Text>
              <TextInput value={yearStart} onChangeText={setYearStart} keyboardType="numeric" placeholder="2018"
                placeholderTextColor={colors.textTertiary}
                style={[s.input, { borderColor: colors.border, color: colors.textPrimary }]} testID="dedup-year-start" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.lbl, { color: colors.textTertiary }]}>YEAR TO</Text>
              <TextInput value={yearEnd} onChangeText={setYearEnd} keyboardType="numeric" placeholder="2024"
                placeholderTextColor={colors.textTertiary}
                style={[s.input, { borderColor: colors.border, color: colors.textPrimary }]} testID="dedup-year-end" />
            </View>
          </View>

          <TouchableOpacity testID="dedup-run-btn" disabled={running} onPress={run}
            style={[s.runBtn, { backgroundColor: colors.primary, opacity: running ? 0.6 : 1 }]}>
            {running ? <ActivityIndicator color="#fff" /> : <Play size={16} color="#fff" />}
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>
              {running ? 'Analyzing…' : 'Run Dedup Preview'}
            </Text>
          </TouchableOpacity>
        </View>

        {stats && (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <Stat label="Scanned" value={stats.total} c={colors} />
            <Stat label="Merged" value={stats.merged} c={colors} />
            <Stat label="Unique" value={stats.unique} c={colors} />
          </View>
        )}

        {clusters.map((cl: any) => {
          const allInsts: string[] = cl._institutes || [];
          const def = defaults[cl.id];
          return (
            <View key={cl.id} style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border, padding: 12 }]}>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                <View style={{ backgroundColor: colors.primary + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: colors.primary, fontWeight: '900', fontSize: 9 }}>{cl.exam_year || 'NA'}</Text>
                </View>
                <View style={{ backgroundColor: colors.surfaceStrong, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ color: colors.textTertiary, fontWeight: '900', fontSize: 9 }}>{allInsts.length} INSTITUTES</Text>
                </View>
              </View>
              <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }} numberOfLines={2}>
                {(cl.question_text || '').replace(/<[^>]*>/g, '')}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {allInsts.map((inst: string) => {
                  const sel = def === inst;
                  return (
                    <TouchableOpacity key={inst} onPress={() => setDefault(cl.id, inst)}
                      style={[s.chip, { borderColor: colors.border }, sel && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                      <Text style={{ color: sel ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 11 }}>{inst}</Text>
                      {sel && <Check size={10} color="#fff" style={{ marginLeft: 4 }} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {def && (
                <Text style={{ color: colors.textTertiary, fontSize: 10, marginTop: 6 }}>
                  Default explanation: <Text style={{ color: colors.primary, fontWeight: '800' }}>{def}</Text>
                </Text>
              )}
            </View>
          );
        })}

        {stats && clusters.length === 0 && (
          <Text style={{ color: colors.textTertiary, textAlign: 'center', marginTop: 20 }}>
            No duplicate clusters found in this slice.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, c }: any) {
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 12, padding: 10 }}>
      <Text style={{ color: c.textPrimary, fontWeight: '900', fontSize: 22 }}>{value}</Text>
      <Text style={{ color: c.textTertiary, fontWeight: '800', fontSize: 9, letterSpacing: 1, marginTop: 2 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 12 },
  lbl: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4, fontWeight: '700' },
  runBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 14 },
});
