/**
 * SelectionDrawer — Accordion selection flow for Subjects → Section Groups → Microtopics.
 *
 * Reads from already-fetched `rawQuestions` (no extra Supabase calls).
 * Columns used (questions): subject, section_group, micro_topic.
 * Auto-expands the chosen subject → section. Includes Search + Select-All per level.
 */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';

export interface SelectionState {
  subjects: string[];
  sections: string[];
  micros: string[];
}

interface Props {
  rawQuestions: any[];
  /** Use the same `getAnalyticsSubject` you already have in pyq.tsx so taxonomy stays consistent. */
  getSubject: (q: any) => string;
  value: SelectionState;
  onChange: (s: SelectionState) => void;
}

const TOUCH_MIN = 44;

const Counter: React.FC<{ n: number; total: number; color: string }> = ({ n, total, color }) => (
  <Text style={{ fontSize: 11, color, fontWeight: '700' }}>{n}/{total}</Text>
);

export const SelectionDrawer: React.FC<Props> = ({ rawQuestions, getSubject, value, onChange }) => {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [openSubject, setOpenSubject] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const tree = useMemo(() => {
    // build subject -> section -> micros[] tree from rawQuestions only
    const t: Record<string, Record<string, Set<string>>> = {};
    for (const q of rawQuestions) {
      const sub = getSubject(q);
      const sec = String(q.section_group || 'General').trim();
      const mic = String(q.micro_topic || 'Other').trim();
      if (!t[sub]) t[sub] = {};
      if (!t[sub][sec]) t[sub][sec] = new Set();
      t[sub][sec].add(mic);
    }
    return t;
  }, [rawQuestions, getSubject]);

  const filterMatch = (s: string) => !search || s.toLowerCase().includes(search.toLowerCase());

  const subjects = useMemo(() => Object.keys(tree).sort(), [tree]);

  const toggle = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const onSubject = (sub: string) => {
    Haptics.selectionAsync();
    const next = { ...value, subjects: toggle(value.subjects, sub) };
    onChange(next);
    setOpenSubject((prev) => (prev === sub ? null : sub));
    setOpenSection(null);
  };

  const selectAllSections = (sub: string, all: boolean) => {
    const all_secs = Object.keys(tree[sub] || {});
    onChange({
      ...value,
      sections: all
        ? Array.from(new Set([...value.sections, ...all_secs]))
        : value.sections.filter((s) => !all_secs.includes(s)),
    });
  };

  const selectAllMicros = (sub: string, sec: string, all: boolean) => {
    const all_mic = Array.from(tree[sub]?.[sec] || []);
    onChange({
      ...value,
      micros: all
        ? Array.from(new Set([...value.micros, ...all_mic]))
        : value.micros.filter((m) => !all_mic.includes(m)),
    });
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Search */}
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
        <Search size={16} color={colors.textTertiary} />
        <TextInput
          testID="sel-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search subject, section, or topic"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.textPrimary }]}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}><X size={14} color={colors.textTertiary} /></TouchableOpacity>
        )}
      </View>

      <ScrollView style={{ maxHeight: 460 }} keyboardShouldPersistTaps="handled">
        {subjects.filter(filterMatch).map((sub) => {
          const sectionsObj = tree[sub] || {};
          const totalSecs = Object.keys(sectionsObj).length;
          const selSecs = Object.keys(sectionsObj).filter((s) => value.sections.includes(s)).length;
          const isOpen = openSubject === sub;
          const isChecked = value.subjects.includes(sub);
          return (
            <Animated.View key={sub} layout={Layout.springify()}>
              <TouchableOpacity
                testID={`sel-subject-${sub}`}
                onPress={() => onSubject(sub)}
                style={[styles.subjectRow, { borderBottomColor: colors.border }, isChecked && { backgroundColor: colors.primary + '14' }]}
              >
                {isOpen ? <ChevronDown size={16} color={colors.textSecondary} /> : <ChevronRight size={16} color={colors.textSecondary} />}
                <View style={[styles.checkbox, { borderColor: colors.border }, isChecked && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
                <Text style={[styles.subjectName, { color: colors.textPrimary }]} numberOfLines={1}>{sub}</Text>
                <Counter n={selSecs} total={totalSecs} color={colors.textTertiary} />
              </TouchableOpacity>

              {isOpen && (
                <Animated.View entering={FadeIn.duration(180)} layout={Layout}>
                  <View style={styles.toolRow}>
                    <TouchableOpacity testID={`sel-all-secs-${sub}`} onPress={() => selectAllSections(sub, true)}>
                      <Text style={[styles.linkText, { color: colors.primary }]}>Select all sections</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => selectAllSections(sub, false)}>
                      <Text style={[styles.linkText, { color: colors.textTertiary }]}>Clear</Text>
                    </TouchableOpacity>
                  </View>

                  {Object.keys(sectionsObj).filter(filterMatch).map((sec) => {
                    const micros = Array.from(sectionsObj[sec]);
                    const totalMic = micros.length;
                    const selMic = micros.filter((m) => value.micros.includes(m)).length;
                    const secOpen = openSection === sec;
                    const secChecked = value.sections.includes(sec);
                    return (
                      <Animated.View key={`${sub}-${sec}`} layout={Layout.springify()}>
                        <TouchableOpacity
                          testID={`sel-section-${sec}`}
                          onPress={() => {
                            Haptics.selectionAsync();
                            onChange({ ...value, sections: toggle(value.sections, sec) });
                            setOpenSection((prev) => (prev === sec ? null : sec));
                          }}
                          style={[styles.sectionRow, { borderBottomColor: colors.border + '70' }]}
                        >
                          {secOpen ? <ChevronDown size={14} color={colors.textTertiary} /> : <ChevronRight size={14} color={colors.textTertiary} />}
                          <View style={[styles.checkbox, { borderColor: colors.border, width: 16, height: 16 }, secChecked && { backgroundColor: colors.primary, borderColor: colors.primary }]} />
                          <Text style={[styles.sectionName, { color: colors.textSecondary }]} numberOfLines={1}>{sec}</Text>
                          <Counter n={selMic} total={totalMic} color={colors.textTertiary} />
                        </TouchableOpacity>

                        {secOpen && (
                          <Animated.View entering={FadeIn.duration(180)} layout={Layout} style={styles.microWrap}>
                            <View style={styles.toolRow}>
                              <TouchableOpacity onPress={() => selectAllMicros(sub, sec, true)}>
                                <Text style={[styles.linkText, { color: colors.primary }]}>Select all topics</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => selectAllMicros(sub, sec, false)}>
                                <Text style={[styles.linkText, { color: colors.textTertiary }]}>Clear</Text>
                              </TouchableOpacity>
                            </View>
                            <View style={styles.microGrid}>
                              {micros.filter(filterMatch).map((m) => {
                                const on = value.micros.includes(m);
                                return (
                                  <TouchableOpacity
                                    key={m}
                                    testID={`sel-micro-${m}`}
                                    onPress={() => { Haptics.selectionAsync(); onChange({ ...value, micros: toggle(value.micros, m) }); }}
                                    style={[styles.microChip, { borderColor: colors.border, backgroundColor: colors.surfaceStrong }, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                                  >
                                    <Text style={[styles.microText, { color: on ? '#fff' : colors.textSecondary }]} numberOfLines={1}>{m}</Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </Animated.View>
                        )}
                      </Animated.View>
                    );
                  })}
                </Animated.View>
              )}
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 16, padding: 8, marginVertical: 8 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, marginBottom: 6 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, minHeight: TOUCH_MIN, borderBottomWidth: 1 },
  subjectName: { flex: 1, fontWeight: '800', fontSize: 14 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24, minHeight: TOUCH_MIN, borderBottomWidth: 1 },
  sectionName: { flex: 1, fontWeight: '700', fontSize: 13 },
  microWrap: { paddingHorizontal: 32, paddingVertical: 8 },
  microGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  microChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, maxWidth: 220 },
  microText: { fontSize: 12, fontWeight: '700' },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5 },
  toolRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 6 },
  linkText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
});

export default SelectionDrawer;
