import React, { useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Switch, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { X, FileDown, Layout, ChevronDown, ChevronRight, Settings, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import {
  ExportOptions, ExportPayload, defaultExportOptions, exportToPdf,
  ExportFontFamily, ExportTheme, ExportPaperStyle, ExportContentScope,
  ExportAnswerPlacement, ExportSortBy, ExportQaLayoutMode, ExportVisualStyle,
} from '../../lib/unifiedExportEngine';

export interface AnalysisReportOption {
  key: string;
  label: string;
  defaultSelected?: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  payload: ExportPayload | null;
  initialOptions?: Partial<ExportOptions>;
  title?: string;
  /**
   * Optional executive-summary report toggles shown at the top of the sheet.
   * These are intentionally isolated from core export options state.
   */
  analysisReports?: AnalysisReportOption[];
  /**
   * Build optional HTML summary pages from selected analysis toggles.
   * Returned HTML is prepended before main export content with a page break.
   */
  onBuildAnalysisHtml?: (selectedAnalysisReports: Record<string, boolean>) => string;
  /**
   * Module-specific filter extras shown under "Filters". Optional.
   * Example: revision tags chips, or flashcard state chips.
   */
  renderExtraFilters?: (opts: ExportOptions, setOpts: React.Dispatch<React.SetStateAction<ExportOptions>>) => React.ReactNode;
  /**
   * Hide specific sections of the sheet (use when irrelevant for a module).
   */
  hideSections?: Array<'content' | 'sort' | 'answer' | 'filters' | 'advanced'>;
}

const CHOICES = {
  fonts: [
    { id: 'sans' as ExportFontFamily, label: 'Sans' },
    { id: 'serif' as ExportFontFamily, label: 'Serif' },
    { id: 'mono' as ExportFontFamily, label: 'Mono' },
    { id: 'handwriting' as ExportFontFamily, label: 'Hand' },
  ],
  fontSizes: [6, 8, 10, 11, 12, 13, 14, 16, 18, 20, 24],
  marginsCm: [0.5, 0.75, 1, 1.25, 1.5, 2],
  qaLayouts: [
    { id: 'unified' as ExportQaLayoutMode, label: 'Unified Box' },
    { id: 'split' as ExportQaLayoutMode, label: 'Split Boxes' },
  ],
  qaColors: [
    { id: 'transparent', label: 'None', swatch: 'transparent' },
    { id: '#f8fafc', label: 'Mist', swatch: '#f8fafc' },
    { id: '#fefce8', label: 'Cream', swatch: '#fefce8' },
    { id: '#ecfeff', label: 'Aqua', swatch: '#ecfeff' },
    { id: '#fdf2f8', label: 'Blush', swatch: '#fdf2f8' },
    { id: '#f0fdf4', label: 'Mint', swatch: '#f0fdf4' },
  ],
  themes: [
    { id: 'modern' as ExportTheme, label: 'Modern' },
    { id: 'classic' as ExportTheme, label: 'Classic' },
    { id: 'sepia' as ExportTheme, label: 'Sepia' },
    { id: 'historical' as ExportTheme, label: 'Historical' },
    { id: 'dark' as ExportTheme, label: 'Dark' },
  ],
  papers: [
    { id: 'plain' as ExportPaperStyle, label: 'Plain' },
    { id: 'lined' as ExportPaperStyle, label: 'Lined' },
    { id: 'grid' as ExportPaperStyle, label: 'Grid' },
    { id: 'dotted' as ExportPaperStyle, label: 'Dotted' },
  ],
  contentScopes: [
    { id: 'q_only' as ExportContentScope, label: 'Q only' },
    { id: 'q_options' as ExportContentScope, label: 'Q + Options' },
    { id: 'q_options_expl' as ExportContentScope, label: 'Q + Options + Expl' },
  ],
  answerPlacements: [
    { id: 'inline' as ExportAnswerPlacement, label: 'Inline' },
    { id: 'end' as ExportAnswerPlacement, label: 'End (Answer Key)' },
  ],
  sortBys: [
    { id: 'default' as ExportSortBy, label: 'Default' },
    { id: 'subject' as ExportSortBy, label: 'Subject' },
    { id: 'subject_section' as ExportSortBy, label: 'Subject + Section Group' },
    { id: 'subject_section_microtopic' as ExportSortBy, label: 'Subject + Section Group + Micro Topic' },
    { id: 'year' as ExportSortBy, label: 'Year' },
    { id: 'difficulty' as ExportSortBy, label: 'Difficulty' },
    { id: 'microtopic' as ExportSortBy, label: 'Microtopic' },
    { id: 'date' as ExportSortBy, label: 'Date' },
  ],
  visualStyles: [
    { id: 'document' as ExportVisualStyle, label: 'Document' },
    { id: 'flashcard' as ExportVisualStyle, label: 'Flashcard Style' },
  ],
  statusFilters: [
    { id: 'all', label: 'All' },
    { id: 'correct', label: 'Correct' },
    { id: 'incorrect', label: 'Incorrect' },
    { id: 'unattempted', label: 'Unattempted' },
  ],
};

export const UnifiedExportSheet: React.FC<Props> = ({
  visible,
  onClose,
  payload,
  initialOptions,
  title,
  analysisReports = [],
  onBuildAnalysisHtml,
  renderExtraFilters,
  hideSections = [],
}) => {
  const { colors } = useTheme();
  const [opts, setOpts] = useState<ExportOptions>(() => defaultExportOptions({
    title: title || initialOptions?.title || 'Export',
    ...(initialOptions || {}),
  }));
  const [isExporting, setIsExporting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const initialAnalysisState = useMemo<Record<string, boolean>>(
    () => analysisReports.reduce((acc, report) => {
      acc[report.key] = !!report.defaultSelected;
      return acc;
    }, {} as Record<string, boolean>),
    [analysisReports]
  );
  const [selectedAnalysisReports, setSelectedAnalysisReports] = useState<Record<string, boolean>>(initialAnalysisState);

  // Re-seed when sheet opens
  React.useEffect(() => {
    if (visible) {
      setOpts(defaultExportOptions({ title: title || initialOptions?.title || 'Export', ...(initialOptions || {}) }));
      setSelectedAnalysisReports(initialAnalysisState);
      setIsExporting(false);
    }
  }, [visible, title, initialOptions, initialAnalysisState]);

  React.useEffect(() => {
    if (!visible) setIsExporting(false);
  }, [visible]);

  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => {
    setOpts(prev => ({ ...prev, [k]: v }));
  };

  const run = async (cols: 1 | 2) => {
    if (!payload || isExporting) return;
    let didSucceed = false;
    const watchdog = setTimeout(() => setIsExporting(false), 22000);
    try {
      setIsExporting(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const hasAnalysisSelection = Object.values(selectedAnalysisReports).some(Boolean);
      const prependHtml = hasAnalysisSelection && onBuildAnalysisHtml
        ? onBuildAnalysisHtml(selectedAnalysisReports)
        : '';

      await exportToPdf(payload, { ...opts, columns: cols }, { prependHtml });
      didSucceed = true;
    } catch (e: any) {
      console.error('Export failed', e);
      Alert.alert('Export failed', e?.message || 'Could not generate PDF right now.');
    } finally {
      clearTimeout(watchdog);
      setIsExporting(false);
      if (didSucceed) onClose();
    }
  };

  const Chip = ({ active, onPress, children, testID }: any) => (
    <TouchableOpacity
      onPress={onPress}
      testID={testID}
      style={[styles.chip, {
        backgroundColor: active ? colors.primary : colors.surfaceStrong,
        borderColor: active ? colors.primary : colors.border,
      }]}
    >
      <Text style={{ color: active ? '#fff' : colors.textPrimary, fontWeight: active ? '900' : '700', fontSize: 12 }}>{children}</Text>
    </TouchableOpacity>
  );

  const AnalysisChip = ({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) => (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.analysisChip,
        {
          backgroundColor: active ? colors.primary + '16' : colors.surfaceStrong,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <View style={[
        styles.analysisCheckbox,
        {
          borderColor: active ? colors.primary : colors.textTertiary,
          backgroundColor: active ? colors.primary : 'transparent',
        },
      ]}>
        {active ? <Check size={11} color="#fff" /> : null}
      </View>
      <Text style={{ color: active ? colors.primary : colors.textPrimary, fontWeight: '800', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]}>{title || 'Export'}</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>Customize and export to PDF</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={{ padding: 8 }}><X size={22} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 520 }} showsVerticalScrollIndicator={false}>
            {analysisReports.length > 0 && (
              <Section title="Analysis Reports (Optional)" colors={colors}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 10 }}>
                  Add executive-summary analysis pages before the question bank in the same PDF.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.analysisRow}>
                  {analysisReports.map((report) => {
                    const active = !!selectedAnalysisReports[report.key];
                    return (
                      <AnalysisChip
                        key={`analysis-${report.key}`}
                        active={active}
                        label={report.label}
                        onPress={() => setSelectedAnalysisReports((prev) => ({ ...prev, [report.key]: !prev[report.key] }))}
                      />
                    );
                  })}
                </ScrollView>
              </Section>
            )}

            <TextInput
              testID="export-title-input"
              style={[styles.titleInput, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
              value={opts.title}
              onChangeText={(t) => set('title', t)}
              placeholder="Document title"
              placeholderTextColor={colors.textTertiary}
            />

            <Section title="Typography" colors={colors}>
              <Label colors={colors}>FONT</Label>
              <Row>{CHOICES.fonts.map(f => <Chip key={f.id} active={opts.fontFamily === f.id} onPress={() => set('fontFamily', f.id)} testID={`export-font-${f.id}`}>{f.label}</Chip>)}</Row>
              <Label colors={colors}>FONT SIZE</Label>
              <Row>{CHOICES.fontSizes.map(sz => <Chip key={sz} active={opts.fontSize === sz} onPress={() => set('fontSize', sz)}>{sz}</Chip>)}</Row>
            </Section>

            <Section title="Look & Feel" colors={colors}>
              <Label colors={colors}>THEME</Label>
              <Row>{CHOICES.themes.map(t => <Chip key={t.id} active={opts.theme === t.id} onPress={() => set('theme', t.id)} testID={`export-theme-${t.id}`}>{t.label}</Chip>)}</Row>
              <Label colors={colors}>PAPER</Label>
              <Row>{CHOICES.papers.map(p => <Chip key={p.id} active={opts.paperStyle === p.id} onPress={() => set('paperStyle', p.id)}>{p.label}</Chip>)}</Row>
            </Section>


            {(payload?.kind === 'questions' || payload?.kind === 'tags') && (
              <Section title="Visual Style" colors={colors}>
                <Row>{CHOICES.visualStyles.map(v => <Chip key={v.id} active={opts.visualStyle === v.id} onPress={() => set('visualStyle', v.id)}>{v.label}</Chip>)}</Row>
              </Section>
            )}

            {(payload?.kind === 'questions' || payload?.kind === 'tags') && (
              <Section title="Q&A Highlight" colors={colors}>
                <Label colors={colors}>LAYOUT</Label>
                <Row>{CHOICES.qaLayouts.map(q => <Chip key={q.id} active={opts.qaLayoutMode === q.id} onPress={() => set('qaLayoutMode', q.id)}>{q.label}</Chip>)}</Row>

                {opts.qaLayoutMode === 'split' ? (
                  <>
                    <Label colors={colors}>QUESTION BOX COLOR</Label>
                    <Row>
                      {CHOICES.qaColors.map(color => {
                        const active = opts.qaQuestionBackgroundColor === color.id;
                        return (
                          <TouchableOpacity
                            key={`q-${color.id}`}
                            onPress={() => set('qaQuestionBackgroundColor', color.id)}
                            style={[
                              styles.colorChip,
                              {
                                borderColor: active ? colors.primary : colors.border,
                                backgroundColor: color.id === 'transparent' ? colors.surfaceStrong : color.swatch,
                              },
                            ]}
                          >
                            <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>{color.label}</Text>
                            {active ? <Check size={13} color={colors.primary} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </Row>
                    <Label colors={colors}>ANSWER BOX COLOR</Label>
                    <Row>
                      {CHOICES.qaColors.map(color => {
                        const active = opts.qaAnswerBackgroundColor === color.id;
                        return (
                          <TouchableOpacity
                            key={`a-${color.id}`}
                            onPress={() => set('qaAnswerBackgroundColor', color.id)}
                            style={[
                              styles.colorChip,
                              {
                                borderColor: active ? colors.primary : colors.border,
                                backgroundColor: color.id === 'transparent' ? colors.surfaceStrong : color.swatch,
                              },
                            ]}
                          >
                            <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>{color.label}</Text>
                            {active ? <Check size={13} color={colors.primary} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </Row>
                  </>
                ) : (
                  <>
                    <Label colors={colors}>UNIFIED BOX COLOR</Label>
                    <Row>
                      {CHOICES.qaColors.map(color => {
                        const active = opts.qaBackgroundColor === color.id;
                        return (
                          <TouchableOpacity
                            key={`u-${color.id}`}
                            onPress={() => set('qaBackgroundColor', color.id)}
                            style={[
                              styles.colorChip,
                              {
                                borderColor: active ? colors.primary : colors.border,
                                backgroundColor: color.id === 'transparent' ? colors.surfaceStrong : color.swatch,
                              },
                            ]}
                          >
                            <Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: '700' }}>{color.label}</Text>
                            {active ? <Check size={13} color={colors.primary} /> : null}
                          </TouchableOpacity>
                        );
                      })}
                    </Row>
                  </>
                )}
              </Section>
            )}

            {!hideSections.includes('content') && payload?.kind !== 'notes' && payload?.kind !== 'flashcards' && payload?.kind !== 'hardnote' && (
              <Section title="Content" colors={colors}>
                <Label colors={colors}>INCLUDE</Label>
                <Row>{CHOICES.contentScopes.map(c => <Chip key={c.id} active={opts.contentScope === c.id} onPress={() => set('contentScope', c.id)} testID={`export-scope-${c.id}`}>{c.label}</Chip>)}</Row>
                {!hideSections.includes('answer') && opts.contentScope !== 'q_only' && (
                  <>
                    <Label colors={colors}>ANSWER PLACEMENT</Label>
                    <Row>{CHOICES.answerPlacements.map(a => <Chip key={a.id} active={opts.answerPlacement === a.id} onPress={() => set('answerPlacement', a.id)}>{a.label}</Chip>)}</Row>
                  </>
                )}
              </Section>
            )}

            {!hideSections.includes('sort') && (payload?.kind === 'questions' || payload?.kind === 'tags') && (
              <Section title="Sort By" colors={colors}>
                <Row>{CHOICES.sortBys.map(s => <Chip key={s.id} active={opts.sortBy === s.id} onPress={() => set('sortBy', s.id)}>{s.label}</Chip>)}</Row>
              </Section>
            )}

            {!hideSections.includes('filters') && payload?.kind === 'questions' && (
              <Section title="Filters" colors={colors}>
                <Label colors={colors}>STATUS</Label>
                <Row>{CHOICES.statusFilters.map(s => <Chip key={s.id} active={opts.statusFilter === (s.id as any)} onPress={() => set('statusFilter', s.id as any)} testID={`export-status-${s.id}`}>{s.label}</Chip>)}</Row>
                <ToggleRow label="PYQ only" value={!!opts.pyqOnly} onChange={v => set('pyqOnly', v)} colors={colors} />
                <ToggleRow label="NCERT only" value={!!opts.ncertOnly} onChange={v => set('ncertOnly', v)} colors={colors} />
                {renderExtraFilters && renderExtraFilters(opts, setOpts)}
                <ToggleRow label="Performance metrics (time / correctness)" value={!!opts.includePerformanceMetrics} onChange={v => set('includePerformanceMetrics', v)} colors={colors} />
              </Section>
            )}

            {!hideSections.includes('filters') && payload?.kind !== 'questions' && renderExtraFilters && (
              <Section title="Filters" colors={colors}>
                {renderExtraFilters(opts, setOpts)}
              </Section>
            )}

            <TouchableOpacity
              style={[styles.advToggle, { borderTopColor: colors.border }]}
              onPress={() => setShowAdvanced(v => !v)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Settings size={16} color={colors.textTertiary} />
                <Text style={{ color: colors.textSecondary, fontWeight: '800', fontSize: 12 }}>Advanced Configuration</Text>
              </View>
              {showAdvanced ? <ChevronDown size={18} color={colors.textTertiary} /> : <ChevronRight size={18} color={colors.textTertiary} />}
            </TouchableOpacity>

            {showAdvanced && !hideSections.includes('advanced') && (
              <Section title="" colors={colors}>
                <ToggleRow label="Table of Contents" value={!!opts.showTOC} onChange={v => set('showTOC', v)} colors={colors} />
                <Label colors={colors}>PAGE MARGINS (CM)</Label>
                <Text style={{ fontSize: 11, color: colors.textTertiary, marginBottom: 6 }}>Default is 1cm on all sides.</Text>
                <Label colors={colors}>LEFT</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`m-left-${m}`} active={opts.pageMarginLeftCm === m} onPress={() => set('pageMarginLeftCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>RIGHT</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`m-right-${m}`} active={opts.pageMarginRightCm === m} onPress={() => set('pageMarginRightCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>TOP</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`m-top-${m}`} active={opts.pageMarginTopCm === m} onPress={() => set('pageMarginTopCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>BOTTOM</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`m-bottom-${m}`} active={opts.pageMarginBottomCm === m} onPress={() => set('pageMarginBottomCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>HEADER</Label>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={opts.headerText} onChangeText={t => set('headerText', t)}
                  placeholder="App / author name (top right)" placeholderTextColor={colors.textTertiary}
                />
                <Label colors={colors}>FOOTER</Label>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={opts.footerText} onChangeText={t => set('footerText', t)}
                  placeholder="e.g. Generated by Dr. UPSC" placeholderTextColor={colors.textTertiary}
                />
                <Label colors={colors}>WATERMARK</Label>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={opts.watermark} onChangeText={t => set('watermark', t)}
                  placeholder="e.g. DRAFT, CONFIDENTIAL" placeholderTextColor={colors.textTertiary}
                />
                <Label colors={colors}>MODULE NAME</Label>
                <TextInput
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={opts.moduleName || ''} onChangeText={t => set('moduleName', t)}
                  placeholder="e.g. Quiz Arena, Tags, Analysis" placeholderTextColor={colors.textTertiary}
                />
              </Section>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              testID="export-1col-button"
              disabled={isExporting || !payload}
              onPress={() => run(1)}
              style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
            >
              {isExporting ? <ActivityIndicator color="#fff" /> : <FileDown size={18} color="#fff" />}
              <Text style={styles.exportBtnText}>Export 1-Column</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="export-2col-button"
              disabled={isExporting || !payload}
              onPress={() => run(2)}
              style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
            >
              {isExporting ? <ActivityIndicator color="#fff" /> : <Layout size={18} color="#fff" />}
              <Text style={styles.exportBtnText}>Export 2-Column</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const Section = ({ title, children, colors }: any) => (
  <View style={{ marginTop: 16 }}>
    {!!title && <Text style={{ fontSize: 12, fontWeight: '900', color: colors.textPrimary, letterSpacing: 0.5, marginBottom: 8 }}>{title}</Text>}
    {children}
  </View>
);

const Row = ({ children }: any) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{children}</View>
);

const Label = ({ children, colors }: any) => (
  <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 1, marginTop: 4, marginBottom: 6 }}>{children}</Text>
);

const ToggleRow = ({ label, value, onChange, colors }: any) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
    <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 }}>{label}</Text>
    <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary, false: colors.border }} />
  </View>
);

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, maxHeight: '92%' },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#ccc', marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.2 },
  titleInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  analysisRow: { gap: 8, paddingBottom: 4 },
  analysisChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  analysisCheckbox: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  colorChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  advToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 6, marginTop: 10, borderTopWidth: 1 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16 },
  exportBtn: { flex: 1, height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  exportBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
});

export default UnifiedExportSheet;

