import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal, TextInput,
  StyleSheet, Switch, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { OfflineManager } from '../src/services/OfflineManager';
import { MasterFilterService, MasterFilters } from '../src/services/MasterFilterService';
import { exportPdf } from '../src/lib/unifiedExport';
import type { ExportOptions } from '../src/lib/exportTemplates';

type ResourceKind = 'questions' | 'flashcards' | 'notes' | 'tags';

const initialFilters: MasterFilters = {
  subjectIds: [], sectionIds: [], instituteIds: [], programmeIds: [],
  examStage: 'all', ncert: false,
};

const initialOpts: ExportOptions = {
  columns: 1, paper: 'plain', theme: 'classic', font: 'serif',
  showAnswers: true, showExplanation: true, pageSize: 'A4',
  title: 'Master Export',
};

export default function ResourcesMaster() {
  const router = useRouter();
  const [kind, setKind] = useState<ResourceKind>('questions');
  const [filters, setFilters] = useState<MasterFilters>(initialFilters);
  const [opts, setOpts] = useState<ExportOptions>(initialOpts);

  // Selections per resource type
  const [deckSel,   setDeckSel]   = useState<string[] | 'all'>('all');
  const [folderSel, setFolderSel] = useState<string[] | 'all'>('all');
  const [tagSel,    setTagSel]    = useState<string[] | 'all'>('all');

  const subjects   = (OfflineManager as any).getOfflineSubjectsSync?.() ?? [];
  const institutes = (OfflineManager as any).getOfflineInstitutesSync?.() ?? [];
  const programmes = (OfflineManager as any).getOfflineProgrammesSync?.() ?? [];
  const tags       = (OfflineManager as any).getOfflineTagsSync?.() ?? [];
  const decks      = MasterFilterService.decks();
  const folders    = MasterFilterService.noteFolders();

  const qCount = useMemo(() => MasterFilterService.questionCount(filters), [filters]);

  const toggleArr = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id];

  const handleExport = async () => {
    let payload;
    switch (kind) {
      case 'questions':
        payload = { kind: 'questions' as const, rows: MasterFilterService.filteredQuestions(filters) };
        break;
      case 'flashcards':
        payload = { kind: 'flashcards' as const, rows: MasterFilterService.cardsForDecks(deckSel) };
        break;
      case 'notes':
        payload = {
          kind: 'notes' as const,
          blocks: MasterFilterService.notesForFolders(folderSel)
            .map((n: any) => ({ title: n.title ?? 'Untitled', html: n.html ?? n.body ?? '' })),
        };
        break;
      case 'tags':
        payload = {
          kind: 'tags' as const,
          groups: MasterFilterService.questionsByTag(filters, tagSel),
        };
        break;
    }
    await exportPdf(payload!, { ...opts, title: opts.title || `Master ${kind}` });
  };

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 16 }}>
      <Text style={s.h1}>Master Download Center</Text>

      {/* Resource selector */}
      <View style={s.row}>
        {(['questions','flashcards','notes','tags'] as ResourceKind[]).map(k => (
          <TouchableOpacity
            key={k}
            testID={`master-kind-${k}`}
            onPress={() => setKind(k)}
            style={[s.pill, kind === k && s.pillOn]}>
            <Text style={[s.pillTxt, kind === k && s.pillTxtOn]}>{k.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filters (apply to questions + tags) */}
      {(kind === 'questions' || kind === 'tags') && (
        <>
          <Text style={s.h2}>Filters</Text>
          <ChipGroup label="Subject"   items={subjects}   selected={filters.subjectIds}
            onToggle={(id: string) => setFilters({ ...filters, subjectIds: toggleArr(filters.subjectIds, id) })} />
          <ChipGroup label="Institute" items={institutes} selected={filters.instituteIds}
            onToggle={(id: string) => setFilters({ ...filters, instituteIds: toggleArr(filters.instituteIds, id) })} />
          <ChipGroup label="Programme" items={programmes} selected={filters.programmeIds}
            onToggle={(id: string) => setFilters({ ...filters, programmeIds: toggleArr(filters.programmeIds, id) })} />

          <View style={s.row}>
            {(['all','prelims','mains'] as const).map(st => (
              <TouchableOpacity key={st} onPress={() => setFilters({ ...filters, examStage: st })}
                style={[s.pill, filters.examStage === st && s.pillOn]}>
                <Text style={[s.pillTxt, filters.examStage === st && s.pillTxtOn]}>{st.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={s.rowBetween}>
            <Text style={s.lbl}>NCERT only</Text>
            <Switch value={!!filters.ncert} onValueChange={v => setFilters({ ...filters, ncert: v })} />
          </View>

          <View style={s.row}>
            <TextInput placeholder="Year from" keyboardType="number-pad" style={s.input}
              onChangeText={t => setFilters({ ...filters, yearFrom: t ? Number(t) : undefined })} />
            <TextInput placeholder="Year to" keyboardType="number-pad" style={s.input}
              onChangeText={t => setFilters({ ...filters, yearTo: t ? Number(t) : undefined })} />
          </View>

          <Text style={s.count} testID="master-question-count">
            Matching questions: <Text style={{ fontWeight: '700' }}>{qCount}</Text>
          </Text>
        </>
      )}

      {/* Granularity selectors */}
      {kind === 'flashcards' && (
        <SelectionList
          label="Decks" rows={decks.map(d => ({ id: d.deck_id, name: `${d.name} (${d.count})` }))}
          selected={deckSel} onChange={setDeckSel}
        />
      )}
      {kind === 'notes' && (
        <SelectionList
          label="Folders" rows={folders.map(f => ({ id: f.folder_id, name: `${f.name} (${f.count})` }))}
          selected={folderSel} onChange={setFolderSel}
        />
      )}
      {kind === 'tags' && (
        <SelectionList
          label="Tags" rows={tags.map((t: any) => ({ id: t.id, name: t.name }))}
          selected={tagSel} onChange={setTagSel}
        />
      )}

      {/* Export Customizer */}
      <Text style={s.h2}>PDF Customizer</Text>
      <TextInput placeholder="Title"
        value={opts.title}
        onChangeText={t => setOpts({ ...opts, title: t })}
        style={[s.input, { width: '100%' }]} />

      <PickerRow label="Columns" options={[1,2]} value={opts.columns}
        onChange={(v: any) => setOpts({ ...opts, columns: v as 1|2 })} />
      <PickerRow label="Paper"   options={['plain','lined','grid','dotted']} value={opts.paper}
        onChange={(v: any) => setOpts({ ...opts, paper: v as any })} />
      <PickerRow label="Theme"   options={['classic','modern','historical','dark']} value={opts.theme}
        onChange={(v: any) => setOpts({ ...opts, theme: v as any })} />
      <PickerRow label="Font"    options={['serif','sans','handwriting','mono']} value={opts.font}
        onChange={(v: any) => setOpts({ ...opts, font: v as any })} />
      <PickerRow label="Size"    options={['A4','Letter']} value={opts.pageSize}
        onChange={(v: any) => setOpts({ ...opts, pageSize: v as any })} />

      {(kind === 'questions' || kind === 'tags') && (
        <>
          <View style={s.rowBetween}>
            <Text style={s.lbl}>Show answers</Text>
            <Switch value={opts.showAnswers} onValueChange={v => setOpts({ ...opts, showAnswers: v })} />
          </View>
          <View style={s.rowBetween}>
            <Text style={s.lbl}>Show explanations</Text>
            <Switch value={opts.showExplanation} onValueChange={v => setOpts({ ...opts, showExplanation: v })} />
          </View>
        </>
      )}

      <TouchableOpacity testID="master-export-btn" style={s.exportBtn} onPress={handleExport}>
        <Text style={s.exportTxt}>Export PDF</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------- Sub-components ----------------
const ChipGroup = ({ label, items, selected, onToggle }: any) => (
  <View style={{ marginVertical: 6 }}>
    <Text style={s.lbl}>{label}</Text>
    <View style={[s.row, { flexWrap: 'wrap' }]}>
      {items.map((it: any) => {
        const id = it.id; const name = it.name ?? it.title ?? id;
        const on = selected.includes(id);
        return (
          <TouchableOpacity key={id} onPress={() => onToggle(id)}
            style={[s.chip, on && s.chipOn]}>
            <Text style={[s.chipTxt, on && s.chipTxtOn]}>{name}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const SelectionList = ({ label, rows, selected, onChange }: {
  label: string; rows: { id: string; name: string }[];
  selected: string[] | 'all'; onChange: (sel: string[] | 'all') => void;
}) => {
  const [open, setOpen] = useState(false);
  const sel = selected === 'all' ? rows.map(r => r.id) : selected;
  const toggle = (id: string) => onChange(sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  return (
    <View style={{ marginVertical: 8 }}>
      <Text style={s.lbl}>{label}</Text>
      <View style={s.row}>
        <TouchableOpacity onPress={() => onChange('all')}
          style={[s.pill, selected === 'all' && s.pillOn]}>
          <Text style={[s.pillTxt, selected === 'all' && s.pillTxtOn]}>ALL</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOpen(true)} style={s.pill}>
          <Text style={s.pillTxt}>SELECT…</Text>
        </TouchableOpacity>
        <Text style={[s.lbl, { alignSelf: 'center', marginLeft: 8 }]}>
          {selected === 'all' ? rows.length : selected.length} selected
        </Text>
      </View>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <ScrollView style={{ flex: 1, padding: 16, paddingTop: Platform.OS === 'ios' ? 60 : 16 }}>
          <Text style={s.h2}>{label}</Text>
          {rows.map(r => (
            <TouchableOpacity key={r.id} onPress={() => toggle(r.id)}
              style={[s.chip, sel.includes(r.id) && s.chipOn, { marginVertical: 4 }]}>
              <Text style={[s.chipTxt, sel.includes(r.id) && s.chipTxtOn]}>{r.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setOpen(false)} style={[s.exportBtn, { marginTop: 16 }]}>
            <Text style={s.exportTxt}>Done</Text>
          </TouchableOpacity>
        </ScrollView>
      </Modal>
    </View>
  );
};

const PickerRow = ({ label, options, value, onChange }: any) => (
  <View style={{ marginVertical: 6 }}>
    <Text style={s.lbl}>{label}</Text>
    <View style={[s.row, { flexWrap: 'wrap' }]}>
      {options.map((o: any) => {
        const on = String(o) === String(value);
        return (
          <TouchableOpacity key={String(o)} onPress={() => onChange(o)}
            style={[s.pill, on && s.pillOn]}>
            <Text style={[s.pillTxt, on && s.pillTxtOn]}>{String(o).toUpperCase()}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  h1: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  h2: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 8, marginVertical: 4 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between',
                alignItems: 'center', marginVertical: 8 },
  lbl: { fontSize: 13, color: '#374151', marginBottom: 4 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
          backgroundColor: '#f3f4f6', marginRight: 6, marginBottom: 6 },
  pillOn: { backgroundColor: '#1d4ed8' },
  pillTxt: { color: '#374151', fontSize: 12, fontWeight: '600' },
  pillTxtOn: { color: '#fff' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
          backgroundColor: '#f3f4f6', marginRight: 6, marginBottom: 6 },
  chipOn: { backgroundColor: '#10b981' },
  chipTxt: { fontSize: 12, color: '#374151' },
  chipTxtOn: { color: '#fff', fontWeight: '600' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
           padding: 8, marginRight: 8, marginVertical: 4 },
  count: { marginTop: 10, fontSize: 14 },
  exportBtn: { backgroundColor: '#1d4ed8', padding: 14, borderRadius: 10,
               alignItems: 'center', marginTop: 18, marginBottom: 40 },
  exportTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
