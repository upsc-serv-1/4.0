/**
 * UnifiedExportModal — Wave 3 (Issues 16, 17, 18, 19, 33, 35)
 * -----------------------------------------------------------
 * Single source-of-truth export modal for the entire app. Replaces the
 * fragmented per-tab export popups and fixes the architectural mistakes
 * highlighted in the Issue Set 1 audit:
 *
 *   • SORT and FILTER are completely separate sections (Issue 17, 33).
 *   • SORT supports multi-select hierarchical grouping
 *     Subject → Section Group → Microtopic (Issue 16).
 *   • FILTERS (year, difficulty, tags, institute, revision tags, curriculum)
 *     never disable each other (Issue 17, 33).
 *   • Export pipeline always consumes filteredQuestions[], not the master
 *     list, so visible UI count == export count (Issue 18).
 *   • Visual style follows the "Settings → Download Tagged Questions"
 *     popup the user prefers, while keeping the rich functionality of the
 *     advanced export engine (Issue 35).
 *
 * Consumers pass:
 *   - `questions`: array of TaggedQuestion (or compatible shape)
 *   - `availableTags`, `availableInstitutes`, `availableYears`,
 *     `availableDifficulties`: filter universes
 *   - `onExport({ filteredQuestions, sortBy, format })`
 */
import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Pressable,
} from 'react-native';
import { X, FileText, Image as ImageIcon, FileDown, Check } from 'lucide-react-native';

export type SortLevel = 'subject' | 'section_group' | 'micro_topic';
export type ExportFormat = 'pdf' | 'markdown' | 'image';

export interface UnifiedExportQuestion {
  id: string;
  questionText?: string;
  question_text?: string;
  subject?: string;
  sectionGroup?: string;
  section_group?: string;
  microTopic?: string;
  micro_topic?: string;
  reviewTags?: string[];
  review_tags?: string[];
  difficultyLevel?: string;
  difficulty_level?: string;
  exam_year?: string | number;
  year?: string | number;
  source?: { institute?: string };
  tests?: { institute?: string };
  curriculum?: string;
  [k: string]: any;
}

export interface UnifiedExportFilters {
  tags: string[];
  institutes: string[];
  years: string[];
  difficulties: string[];
  curricula: string[];
}

export interface UnifiedExportSelection {
  filteredQuestions: UnifiedExportQuestion[];
  sortBy: SortLevel[];
  format: ExportFormat;
  filters: UnifiedExportFilters;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  questions: UnifiedExportQuestion[];
  availableTags?: string[];
  availableInstitutes?: string[];
  availableYears?: string[];
  availableDifficulties?: string[];
  availableCurricula?: string[];
  defaultFilters?: Partial<UnifiedExportFilters>;
  onExport: (selection: UnifiedExportSelection) => void;
}

const FORMATS: { id: ExportFormat; label: string; icon: any }[] = [
  { id: 'pdf', label: 'PDF', icon: FileDown },
  { id: 'markdown', label: 'Markdown', icon: FileText },
  { id: 'image', label: 'Image', icon: ImageIcon },
];

const SORT_OPTIONS: { id: SortLevel; label: string }[] = [
  { id: 'subject', label: 'Subject' },
  { id: 'section_group', label: 'Section Group' },
  { id: 'micro_topic', label: 'Microtopic' },
];

const getField = <T extends UnifiedExportQuestion, K extends string>(
  q: T, ...keys: K[]
): string => {
  for (const k of keys) {
    const v = (q as any)[k];
    if (v != null && v !== '') return String(v);
  }
  return '';
};

/** The single source-of-truth filter pipeline. */
export function applyUnifiedExportFilters(
  questions: UnifiedExportQuestion[],
  filters: UnifiedExportFilters,
): UnifiedExportQuestion[] {
  const tagSet = new Set(filters.tags.map((t) => t.toLowerCase()));
  const instSet = new Set(filters.institutes.map((t) => t.toLowerCase()));
  const yearSet = new Set(filters.years);
  const diffSet = new Set(filters.difficulties.map((t) => t.toLowerCase()));
  const curriculaSet = new Set(filters.curricula.map((t) => t.toLowerCase()));

  return questions.filter((q) => {
    if (tagSet.size) {
      const qTags = (q.reviewTags || q.review_tags || []) as any[];
      const has = qTags.some((t) => tagSet.has(String(t).toLowerCase()));
      if (!has) return false;
    }
    if (instSet.size) {
      const inst = String(q.source?.institute || q.tests?.institute || '').toLowerCase();
      if (!instSet.has(inst)) return false;
    }
    if (yearSet.size) {
      const year = String(q.exam_year || q.year || '');
      if (!yearSet.has(year)) return false;
    }
    if (diffSet.size) {
      const d = String(q.difficultyLevel || q.difficulty_level || '').toLowerCase();
      if (!diffSet.has(d)) return false;
    }
    if (curriculaSet.size) {
      const c = String(q.curriculum || '').toLowerCase();
      if (!curriculaSet.has(c)) return false;
    }
    return true;
  });
}

/** Recursively group questions by the chosen hierarchy. */
export interface GroupedNode {
  label: string;
  level: number;
  questions: UnifiedExportQuestion[];
  children: GroupedNode[];
}
export function groupQuestionsHierarchically(
  questions: UnifiedExportQuestion[],
  hierarchy: SortLevel[],
): GroupedNode[] {
  if (hierarchy.length === 0) {
    return [{ label: 'All Questions', level: 0, questions, children: [] }];
  }
  const fieldFor = (q: UnifiedExportQuestion, level: SortLevel): string => {
    if (level === 'subject') return getField(q, 'subject') || 'Uncategorised';
    if (level === 'section_group') return getField(q, 'sectionGroup', 'section_group') || 'Other';
    return getField(q, 'microTopic', 'micro_topic') || 'General';
  };
  const groupAt = (
    qs: UnifiedExportQuestion[],
    levels: SortLevel[],
    levelIndex: number,
  ): GroupedNode[] => {
    if (levelIndex >= levels.length) return [];
    const map = new Map<string, UnifiedExportQuestion[]>();
    for (const q of qs) {
      const key = fieldFor(q, levels[levelIndex]);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(q);
    }
    const nodes: GroupedNode[] = [];
    for (const [label, list] of map.entries()) {
      const children = groupAt(list, levels, levelIndex + 1);
      nodes.push({
        label,
        level: levelIndex,
        questions: list,
        children,
      });
    }
    nodes.sort((a, b) => a.label.localeCompare(b.label));
    return nodes;
  };
  return groupAt(questions, hierarchy, 0);
}

export function UnifiedExportModal({
  visible, onClose, questions,
  availableTags = [], availableInstitutes = [], availableYears = [],
  availableDifficulties = ['easy', 'medium', 'hard'], availableCurricula = [],
  defaultFilters,
  onExport,
}: Props) {
  const [filters, setFilters] = useState<UnifiedExportFilters>(() => ({
    tags: defaultFilters?.tags || [],
    institutes: defaultFilters?.institutes || [],
    years: defaultFilters?.years || [],
    difficulties: defaultFilters?.difficulties || [],
    curricula: defaultFilters?.curricula || [],
  }));
  const [sortBy, setSortBy] = useState<SortLevel[]>(['subject', 'section_group', 'micro_topic']);
  const [format, setFormat] = useState<ExportFormat>('pdf');

  const filtered = useMemo(
    () => applyUnifiedExportFilters(questions, filters),
    [questions, filters],
  );

  const toggle = (key: keyof UnifiedExportFilters, value: string) => {
    setFilters((f) => {
      const cur = new Set(f[key]);
      if (cur.has(value)) cur.delete(value); else cur.add(value);
      return { ...f, [key]: Array.from(cur) } as UnifiedExportFilters;
    });
  };
  const toggleSort = (id: SortLevel) => {
    setSortBy((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      // Keep canonical hierarchy order for predictable rendering.
      const canon: SortLevel[] = ['subject', 'section_group', 'micro_topic'];
      return canon.filter((x) => next.includes(x));
    });
  };

  const handleExport = () => {
    onExport({ filteredQuestions: filtered, sortBy, format, filters });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Custom Export</Text>
            <TouchableOpacity onPress={onClose} testID="unified-export-close">
              <X size={20} color="#0f172a" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            {/* Format selector */}
            <Section title="Format">
              <View style={styles.row}>
                {FORMATS.map((f) => {
                  const Icon = f.icon;
                  const active = format === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => setFormat(f.id)}
                      style={[styles.formatBtn, active && styles.formatBtnActive]}
                      testID={`unified-export-format-${f.id}`}
                    >
                      <Icon size={14} color={active ? '#fff' : '#0f172a'} />
                      <Text style={[styles.formatBtnText, active && { color: '#fff' }]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {/* SORT — independent multi-select hierarchical grouping */}
            <Section title="Sort By (hierarchical grouping)">
              <Text style={styles.helper}>Pick the levels you want to group questions under. They are applied in the canonical order Subject → Section Group → Microtopic.</Text>
              <View style={styles.row}>
                {SORT_OPTIONS.map((opt) => {
                  const active = sortBy.includes(opt.id);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => toggleSort(opt.id)}
                      style={[styles.chip, active && styles.chipActive]}
                      testID={`unified-export-sort-${opt.id}`}
                    >
                      {active ? <Check size={11} color="#fff" /> : null}
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Section>

            {/* FILTERS — completely independent of SORT */}
            {availableTags.length ? (
              <FilterChipGroup
                title="Tags"
                items={availableTags}
                active={filters.tags}
                onToggle={(v) => toggle('tags', v)}
                testIdPrefix="unified-export-tag"
              />
            ) : null}
            {availableInstitutes.length ? (
              <FilterChipGroup
                title="Institute"
                items={availableInstitutes}
                active={filters.institutes}
                onToggle={(v) => toggle('institutes', v)}
                testIdPrefix="unified-export-institute"
              />
            ) : null}
            {availableYears.length ? (
              <FilterChipGroup
                title="Year"
                items={availableYears}
                active={filters.years}
                onToggle={(v) => toggle('years', v)}
                testIdPrefix="unified-export-year"
              />
            ) : null}
            <FilterChipGroup
              title="Difficulty"
              items={availableDifficulties}
              active={filters.difficulties}
              onToggle={(v) => toggle('difficulties', v)}
              testIdPrefix="unified-export-diff"
            />
            {availableCurricula.length ? (
              <FilterChipGroup
                title="Curriculum"
                items={availableCurricula}
                active={filters.curricula}
                onToggle={(v) => toggle('curricula', v)}
                testIdPrefix="unified-export-curr"
              />
            ) : null}

            {/* Live count — must always equal the eventual export count. */}
            <View style={styles.countBox} testID="unified-export-count">
              <Text style={styles.countLabel}>Exporting</Text>
              <Text style={styles.countNumber}>{filtered.length}</Text>
              <Text style={styles.countLabel}>of {questions.length} questions</Text>
            </View>
          </ScrollView>

          {/* Footer actions */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} testID="unified-export-cancel">
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleExport}
              style={[styles.exportBtn, filtered.length === 0 && { opacity: 0.4 }]}
              disabled={filtered.length === 0}
              testID="unified-export-confirm"
            >
              <Text style={styles.exportText}>Export</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface SectionProps { title: string; children: React.ReactNode; }
function Section({ title, children }: SectionProps) {
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

interface FilterChipGroupProps {
  title: string; items: string[]; active: string[];
  onToggle: (v: string) => void; testIdPrefix: string;
}
function FilterChipGroup({ title, items, active, onToggle, testIdPrefix }: FilterChipGroupProps) {
  return (
    <Section title={title}>
      <View style={styles.row}>
        {items.map((it) => {
          const isActive = active.includes(it);
          return (
            <TouchableOpacity
              key={it}
              onPress={() => onToggle(it)}
              style={[styles.chip, isActive && styles.chipActive]}
              testID={`${testIdPrefix}-${it}`}
            >
              {isActive ? <Check size={11} color="#fff" /> : null}
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{it}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 1.2 },
  helper: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
  },
  chipActive: { backgroundColor: '#5b4efa', borderColor: '#5b4efa' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#0f172a' },
  chipTextActive: { color: '#fff' },
  formatBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc',
  },
  formatBtnActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  formatBtnText: { fontSize: 12, fontWeight: '800', color: '#0f172a' },
  countBox: {
    margin: 16, padding: 14, borderRadius: 14,
    backgroundColor: '#f1f5f9',
    flexDirection: 'row', alignItems: 'baseline', gap: 6, justifyContent: 'center',
  },
  countLabel: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  countNumber: { fontSize: 22, color: '#0f172a', fontWeight: '900' },
  footer: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1, borderTopColor: '#e5e7eb',
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#cbd5e1',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 13, fontWeight: '800', color: '#475569' },
  exportBtn: {
    flex: 2, paddingVertical: 12, borderRadius: 12,
    backgroundColor: '#0f172a',
    alignItems: 'center', justifyContent: 'center',
  },
  exportText: { fontSize: 13, fontWeight: '900', color: '#fff' },
});
