/**
 * AnalysisExportSheet — Unified, granular Export Engine for the Analysis tab.
 *
 * Structure (top → bottom):
 *   1. Export Scope: Report only / Report + PYQs / Only PYQs
 *   2. Subjects → Sections → Microtopics (hierarchical multi-select)
 *   3. Year filter: single year OR year range (min/max)
 *   4. Report Types (visible when scope includes Report):
 *        • Full report  • Subject momentum  • Subject distribution
 *        • Heatmaps     • Focused trend     • Forecast
 *   5. Look & Feel (theme, paper)
 *   6. Q&A Highlight (visible only when PYQs included)
 *   7. Content scope, Answer placement (visible only when PYQs included)
 *   8. Sort-by (Default / Subject / Subject+Section /
 *               Subject+Section+Microtopic / Year / Difficulty)
 *        (visible only when PYQs included)
 *   9. Advanced (margins, header/footer, watermark)
 *
 * Chart rendering for Analysis reports uses the SAME engines already in
 * the codebase — unifiedExportEngine.buildPyqAnalysisSummaryHtml and
 * utils/pdf-helpers.generateAnalyticsPdfHtml — so colors and donuts stay
 * pixel-identical to the on-screen previews.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, Switch, ActivityIndicator, Platform, Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { X, FileDown, Layout, ChevronDown, ChevronRight, Settings, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../context/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { supabase } from '../../lib/supabase';
import {
  ExportOptions, ExportPayload, ExportQuestion,
  defaultExportOptions, exportToPdf,
  ExportFontFamily, ExportTheme, ExportPaperStyle, ExportContentScope,
  ExportAnswerPlacement, ExportSortBy, ExportQaLayoutMode, ExportVisualStyle,
  buildPyqAnalysisSummaryHtml, type PyqHeatmapRow,
} from '../../lib/unifiedExportEngine';
import { generateAnalyticsPdfHtml } from '../../utils/pdf-helpers';

export type AnalysisExportScope = 'report_only' | 'report_with_pyqs' | 'pyqs_only';

export interface AnalysisReportToggles {
  full_report: boolean;
  subject_momentum: boolean;
  subject_distribution: boolean;
  heatmaps: boolean;
  forecast: boolean;
  trajectory_graph: boolean;
  score_history_table: boolean;
  raw_data_csv: boolean;
}

export interface AnalysisExportQuestion {
  id: string;
  question_text?: string;
  statement?: string;
  options?: { a?: string; b?: string; c?: string; d?: string };
  correct_answer?: string;
  selected_answer?: string;
  is_correct?: boolean;
  explanation_markdown?: string;
  explanation?: string;
  subject?: string;
  section_group?: string;
  micro_topic?: string;
  sub_topic?: string;
  exam_year?: number | string;
  is_pyq?: boolean;
  is_ncert?: boolean;
  difficulty?: string;
  review_tags?: string[];
  time_taken_seconds?: number;
}

export interface AnalysisExportSheetProps {
  visible: boolean;
  onClose: () => void;
  /** All questions available for export (test-history questions or PYQ bank) */
  questions: AnalysisExportQuestion[];
  /** Aggregated analytics computed by useAggregateTestAnalytics */
  trends?: any;
  cumulative?: any;
  weaknesses?: string[];
  /** Forecast rows builder (optional — if not provided forecast will be skipped) */
  buildForecastRows?: (filteredQuestions: AnalysisExportQuestion[]) => Array<{
    key: string;
    label: string;
    totalQuestions: number;
    streak: number;
    trend: 'rising' | 'falling' | 'stable';
    forecastPoint: number;
    forecastLow: number;
    forecastHigh: number;
    hotScore: number;
  }>;
  title?: string;
  userName?: string;
  /**
   * analytics: keeps existing performance full-report page
   * pyq: uses PYQ summary engine for full report and toggles
   */
  reportVariant?: 'analytics' | 'pyq';
  /** Optional metadata used by PYQ summary header. */
  pyqMeta?: {
    examStage?: string;
    selectedPaper?: string;
    selectedRange?: string;
    heatmapPalette?: 'spectral' | 'ocean';
    heatmapMetric?: 'count' | 'marks';
  };
  /** Global revision tags (if provided, replaces derived tags) */
  allRevisionTags?: string[];
}

const CHOICES = {
  fonts: [
    { id: 'sans' as ExportFontFamily, label: 'Sans' },
    { id: 'serif' as ExportFontFamily, label: 'Serif' },
    { id: 'mono' as ExportFontFamily, label: 'Mono' },
    { id: 'handwriting' as ExportFontFamily, label: 'Hand' },
  ],
  fontSizes: [8, 10, 11, 12, 13, 14, 16, 18],
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
    { id: 'subject_section' as ExportSortBy, label: 'Subject + Section' },
    { id: 'subject_section_microtopic' as ExportSortBy, label: 'Subject + Section + Micro' },
  ],
  scopes: [
    { id: 'report_only' as AnalysisExportScope, label: 'Report only' },
    { id: 'report_with_pyqs' as AnalysisExportScope, label: 'Report + PYQs' },
    { id: 'pyqs_only' as AnalysisExportScope, label: 'Only PYQs' },
  ],
  visualStyles: [
    { id: 'document' as ExportVisualStyle, label: 'Document' },
    { id: 'flashcard' as ExportVisualStyle, label: 'Flashcard Style' },
  ],
};

const ANALYTICS_REPORT_TOGGLES: Array<{ key: keyof AnalysisReportToggles; label: string }> = [
  { key: 'trajectory_graph', label: 'Performance Trajectory (Graph)' },
  { key: 'score_history_table', label: 'Score History Table' },
  { key: 'heatmaps', label: 'Mastery Heatmaps (Drill-down)' },
  { key: 'subject_momentum', label: 'Subject Momentum' },
  { key: 'subject_distribution', label: 'Subject Distribution (Donut)' },
  { key: 'forecast', label: 'Probable 2026 Topics (Forecast)' },
  { key: 'raw_data_csv', label: 'Export Raw Data (CSV)' },
];

const PYQ_REPORT_TOGGLES: Array<{ key: keyof AnalysisReportToggles; label: string }> = [
  { key: 'subject_momentum', label: 'Subject momentum' },
  { key: 'subject_distribution', label: 'Subject distribution' },
  { key: 'heatmaps', label: 'Heatmap' },
  { key: 'forecast', label: 'Forecast' },
];

const defaultReports: AnalysisReportToggles = {
  full_report: true,
  subject_momentum: true,
  subject_distribution: true,
  heatmaps: true,
  forecast: true,
  trajectory_graph: true,
  score_history_table: true,
  raw_data_csv: false,
};

export const AnalysisExportSheet: React.FC<AnalysisExportSheetProps> = ({
  visible,
  onClose,
  questions,
  trends,
  cumulative,
  weaknesses = [],
  buildForecastRows,
  title = 'Analysis Export',
  userName = 'Aspirant',
  reportVariant = 'analytics',
  pyqMeta,
  allRevisionTags,
}) => {
  const { colors } = useTheme();
  const { isTablet } = useResponsive();

  const [scope, setScope] = useState<AnalysisExportScope>('report_only');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [selectedMicros, setSelectedMicros] = useState<string[]>([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState<string[]>([]);
  const [selectedRevisionTags, setSelectedRevisionTags] = useState<string[]>([]);
  const [selectedInstitutes, setSelectedInstitutes] = useState<string[]>(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (Array.isArray((q as any)._institutes)) {
        (q as any)._institutes.forEach((inst: string) => {
          const value = String(inst || '').trim();
          if (value) set.add(value);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  });
  const [selectedGroupingLevels, setSelectedGroupingLevels] = useState<Array<'subject' | 'section_group' | 'microtopic'>>([]);
  const [yearMode, setYearMode] = useState<'all' | 'single' | 'range'>('all');
  const [singleYear, setSingleYear] = useState<string>('');
  const [yearStartIn, setYearStartIn] = useState<string>('');
  const [yearEndIn, setYearEndIn] = useState<string>('');

  const [reports, setReports] = useState<AnalysisReportToggles>(defaultReports);
  const [opts, setOpts] = useState<ExportOptions>(() => defaultExportOptions({
    title, moduleName: 'Analysis', headerText: 'Dr. UPSC · Analysis',
    contentScope: 'q_options_expl', answerPlacement: 'inline', sortBy: 'default',
    fontSize: 10, showTOC: true, watermark: 'Dr. UPSC',
  }));
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDetailedReport, setIsDetailedReport] = useState(true);
  const [heatmapMetric, setHeatmapMetric] = useState<'count' | 'marks'>(pyqMeta?.heatmapMetric || 'count');

  // Re-seed on open
  useEffect(() => {
    if (visible) {
      setScope('report_only');
      setSelectedSubjects([]);
      setSelectedSections([]);
      setSelectedMicros([]);
      setSelectedDifficulties([]);
      setSelectedRevisionTags([]);
      const allInsts = (() => {
        const set = new Set<string>();
        questions.forEach((q) => {
          if (Array.isArray((q as any)._institutes)) {
            (q as any)._institutes.forEach((inst: string) => {
              const value = String(inst || '').trim();
              if (value) set.add(value);
            });
          }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
      })();
      setSelectedInstitutes(allInsts);
      setSelectedGroupingLevels([]);
      setYearMode('all');
      setSingleYear('');
      setYearStartIn('');
      setYearEndIn('');
      setReports(defaultReports);
      setHeatmapMetric(pyqMeta?.heatmapMetric || 'count');
      setOpts(defaultExportOptions({
        title, moduleName: 'Analysis', headerText: 'Dr. UPSC · Analysis',
        contentScope: 'q_options_expl', answerPlacement: 'inline', sortBy: 'default',
        fontSize: 10, showTOC: true, watermark: 'Dr. UPSC',
      }));
      setIsExporting(false);
      setShowAdvanced(false);
    }
  }, [visible, title, questions, pyqMeta]);

  const includeReport = scope === 'report_only' || scope === 'report_with_pyqs';
  const includePyqs = scope === 'report_with_pyqs' || scope === 'pyqs_only';
  const reportToggleChoices = reportVariant === 'pyq' ? PYQ_REPORT_TOGGLES : ANALYTICS_REPORT_TOGGLES;

  // Derive subject → section → micro hierarchy from supplied questions
  const hierarchy = useMemo(() => {
    const subjMap = new Map<string, Map<string, Set<string>>>();
    questions.forEach(q => {
      const s = (q.subject || 'General').trim() || 'General';
      const sg = (q.section_group || 'General').trim() || 'General';
      const mt = (q.micro_topic || 'Other').trim() || 'Other';
      if (!subjMap.has(s)) subjMap.set(s, new Map());
      const secMap = subjMap.get(s)!;
      if (!secMap.has(sg)) secMap.set(sg, new Set());
      secMap.get(sg)!.add(mt);
    });
    return subjMap;
  }, [questions]);

  const allSubjects = useMemo(() => Array.from(hierarchy.keys()).sort(), [hierarchy]);
  const visibleSections = useMemo(() => {
    if (selectedSubjects.length === 0) return [];
    const set = new Set<string>();
    selectedSubjects.forEach(sub => {
      const secMap = hierarchy.get(sub);
      if (secMap) secMap.forEach((_, k) => set.add(k));
    });
    return Array.from(set).sort();
  }, [hierarchy, selectedSubjects]);
  const visibleMicros = useMemo(() => {
    if (selectedSubjects.length === 0 || selectedSections.length === 0) return [];
    const set = new Set<string>();
    selectedSubjects.forEach(sub => {
      const secMap = hierarchy.get(sub);
      if (!secMap) return;
      selectedSections.forEach(sec => {
        const mSet = secMap.get(sec);
        if (mSet) mSet.forEach(m => set.add(m));
      });
    });
    return Array.from(set).sort();
  }, [hierarchy, selectedSubjects, selectedSections]);

  const difficultyOptions = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      const value = String(q.difficulty || '').trim();
      if (value) set.add(value);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  const revisionTagOptions = useMemo(() => {
    if (allRevisionTags && allRevisionTags.length > 0) return allRevisionTags;
    const set = new Set<string>();
    questions.forEach((q) => {
      (q.review_tags || []).forEach((tag) => {
        const value = String(tag || '').trim();
        if (value) set.add(value);
      });
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questions, allRevisionTags]);

  const instituteOptions = useMemo(() => {
    const set = new Set<string>();
    questions.forEach((q) => {
      if (Array.isArray((q as any)._institutes)) {
        (q as any)._institutes.forEach((inst: string) => {
          const value = String(inst || '').trim();
          if (value) set.add(value);
        });
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [questions]);

  // ---- Filtering pipeline (applies to both analysis and PYQ export) ----
  const yearBounds = useMemo(() => {
    if (yearMode === 'all') return { start: null as number | null, end: null as number | null };
    if (yearMode === 'single') {
      const y = Number(singleYear);
      if (!Number.isFinite(y)) return { start: null, end: null };
      return { start: y, end: y };
    }
    const s = Number(yearStartIn);
    const e = Number(yearEndIn);
    if (!Number.isFinite(s) || !Number.isFinite(e)) return { start: null, end: null };
    return { start: Math.min(s, e), end: Math.max(s, e) };
  }, [yearMode, singleYear, yearStartIn, yearEndIn]);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (selectedSubjects.length > 0) {
        const s = (q.subject || 'General').trim() || 'General';
        if (!selectedSubjects.includes(s)) return false;
      }
      if (selectedSections.length > 0) {
        const sg = (q.section_group || 'General').trim() || 'General';
        if (!selectedSections.includes(sg)) return false;
      }
      if (selectedMicros.length > 0) {
        const mt = (q.micro_topic || 'Other').trim() || 'Other';
        if (!selectedMicros.includes(mt)) return false;
      }
      if (selectedDifficulties.length > 0) {
        const difficulty = String(q.difficulty || '').trim();
        if (!difficulty || !selectedDifficulties.includes(difficulty)) return false;
      }
      if (selectedRevisionTags.length > 0) {
        const rowTags = (q.review_tags || []).map((tag) => String(tag || '').trim().toLowerCase()).filter(Boolean);
        if (!rowTags.length) return false;
        const wanted = selectedRevisionTags.map((tag) => tag.toLowerCase());
        if (!wanted.some((tag) => rowTags.includes(tag))) return false;
      }
      if (yearBounds.start != null || yearBounds.end != null) {
        const y = Number(q.exam_year);
        if (!Number.isFinite(y)) return false;
        if (yearBounds.start != null && y < yearBounds.start) return false;
        if (yearBounds.end != null && y > yearBounds.end) return false;
      }
      return true;
    });
  }, [questions, selectedSubjects, selectedSections, selectedMicros, selectedDifficulties, selectedRevisionTags, yearBounds]);

  // ---- Build analysis summary input (same structure as pyq.tsx) ----
  const buildAnalysisHtml = (): string => {
    if (!includeReport) return '';
    const pieces: string[] = [];
    let analyticsCss = ''; // Capture CSS from generateAnalyticsPdfHtml to re-apply in the PDF shell

    const canRenderAnalyticsFullReport = reportVariant === 'analytics' && !!trends && !!cumulative;

    if (reports.full_report && canRenderAnalyticsFullReport) {
      const fullHtml = generateAnalyticsPdfHtml({
        userName,
        timestamp: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
        filterLabel: selectedSubjects.length === 0 ? 'All Subjects' : selectedSubjects.join(', '),
        trends,
        cumulative,
        weaknesses,
        sections: {
          trajectory: true,
          proficiency: true,
          heatmap: true,
          fatigue: true,
          mistakes: true,
          weaknesses: true,
          drilldown: true,
          isDetailedReport,
        },
        marginTopCm: opts.pageMarginTopCm,
        marginRightCm: opts.pageMarginRightCm,
        marginBottomCm: opts.pageMarginBottomCm,
        marginLeftCm: opts.pageMarginLeftCm,
      });
      // Extract the <style> block + <body> content so analytics chart styles
      // survive injection into any parent HTML shell.
      const styleMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
      if (styleMatch) analyticsCss = styleMatch[1];
      const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      pieces.push(bodyMatch ? bodyMatch[1] : fullHtml);
    }

    const summaryReports: AnalysisReportToggles = canRenderAnalyticsFullReport
      ? { ...reports, full_report: false }
      : reports;

    const needSummary = Object.values(summaryReports).some(Boolean);
    if (needSummary) {
      const summary = buildSummaryFromFilteredQuestions(
        filteredQuestions,
        summaryReports,
        buildForecastRows,
        yearBounds,
        selectedSubjects,
        selectedSections,
        selectedMicros,
        pyqMeta,
        heatmapMetric,
      );
      if (summary) pieces.push(summary);
    }

    if (pieces.length === 0) return '';
    const joinedHtml = pieces.join('<div style="page-break-before: always;"></div>');
    // Embed the analytics CSS as an inline <style> tag within the fragment so it
    // survives injection into any parent HTML shell (both printStandaloneReport
    // and exportToPdf/injectExecutiveSummary). The <style> tag in body is valid HTML5.
    return analyticsCss
      ? `<style>${analyticsCss}</style>\n${joinedHtml}`
      : joinedHtml;
  };

  const pyqPayload = useMemo<ExportPayload | null>(() => {
    if (!includePyqs) return null;
    if (!filteredQuestions.length) return null;
    const rows: ExportQuestion[] = filteredQuestions.map(q => ({
      id: String(q.id),
      question_text: q.question_text || q.statement || '',
      options: q.options,
      correct_answer: q.correct_answer,
      selected_answer: q.selected_answer,
      is_correct: q.is_correct,
      explanation_markdown: q.explanation_markdown,
      explanation: q.explanation,
      subject: q.subject || 'General',
      section_group: q.section_group || 'General',
      micro_topic: q.micro_topic || 'Other',
      sub_topic: q.sub_topic || q.subtopic || (q as any).subTopic || '',
      exam_year: q.exam_year,
      marks: q.marks,
      is_pyq: !!q.is_pyq,
      is_upsc_cse: !!(q as any).is_upsc_cse,
      is_upsc_cms: !!(q as any).is_upsc_cms,
      is_neetpg: !!(q as any).is_neetpg,
      is_inicet: !!(q as any).is_inicet,
      is_allied: !!(q as any).is_allied,
      is_others: !!(q as any).is_others,
      exam_group: (q as any).exam_group,
      source: (q as any).source,
      exam_info: (q as any).exam_info,
      is_ncert: !!q.is_ncert,
      difficulty: q.difficulty,
      review_tags: q.review_tags,
      time_taken_seconds: q.time_taken_seconds,
      _explanations: Array.isArray((q as any)._explanations) ? (q as any)._explanations : [],
    }));
    return { kind: 'questions', rows };
  }, [includePyqs, filteredQuestions]);

  const set = <K extends keyof ExportOptions>(k: K, v: ExportOptions[K]) => {
    setOpts(prev => ({ ...prev, [k]: v }));
  };

  const cleanAnswerText = (txt: string): string => {
    if (!txt) return '';
    let cleaned = txt;
    // Replace HTML img tags with a clean placeholder link
    cleaned = cleaned.replace(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi, (match, src) => {
      return `<div style="margin: 4px 0; padding: 6px; background: #F1F5F9; border-radius: 4px; font-size: 8.5pt; display: inline-block;"><a href="${src}" target="_blank" style="color: #2563EB; font-weight: 700; text-decoration: underline;">[View Image / Diagram]</a></div>`;
    });
    // Replace Markdown image links with the same
    cleaned = cleaned.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
      return `<div style="margin: 4px 0; padding: 6px; background: #F1F5F9; border-radius: 4px; font-size: 8.5pt; display: inline-block;"><a href="${src}" target="_blank" style="color: #2563EB; font-weight: 700; text-decoration: underline;">[View Image / Diagram: ${alt || 'Link'}]</a></div>`;
    });
    return cleaned;
  };

  const hasAnyReport = Object.values(reports).some(Boolean);

  const runExport = async (columns: 1 | 2) => {
    if (isExporting) return;
    if (includeReport && !hasAnyReport) {
      Alert.alert('Select at least one report', 'Choose one or more report types to include.');
      return;
    }
    if (includePyqs && (!pyqPayload || !filteredQuestions.length)) {
      Alert.alert('No questions match', 'Adjust subject/section/year filters and try again.');
      return;
    }

    setIsExporting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    // Prepare final payload rows and fetch missing answer texts from Supabase
    let payloadRows = pyqPayload ? [...(pyqPayload.rows as ExportQuestion[])] : [];
    if (includePyqs && payloadRows.length > 0) {
      try {
        const questionIds = payloadRows.map(r => r.id);
        const chunkSize = 200;
        let allAnswers: any[] = [];
        for (let i = 0; i < questionIds.length; i += chunkSize) {
          const chunkIds = questionIds.slice(i, i + chunkSize).map(id => {
            const num = Number(id);
            return isNaN(num) ? id : num;
          });
          
          const queryPromise = supabase
            .from('mains_answers')
            .select('id, question_id, institute, answer_text')
            .in('question_id', chunkIds);
            
          const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
            setTimeout(() => reject(new Error('Supabase fetch timeout')), 8000)
          );
          
          const response = await Promise.race([queryPromise, timeoutPromise]);
          const { data, error } = response as { data: any[] | null; error: any };
          
          if (!error && data) {
            allAnswers = allAnswers.concat(data);
          }
        }

        const answersByQuestionId: Record<string, any[]> = {};
        allAnswers.forEach(ans => {
          if (!answersByQuestionId[ans.question_id]) {
            answersByQuestionId[ans.question_id] = [];
          }
          const cleanedText = cleanAnswerText(ans.answer_text);
          answersByQuestionId[ans.question_id].push({
            id: ans.id,
            institute: ans.institute,
            source: ans.institute,
            answerText: cleanedText,
            text: cleanedText,
          });
        });

        payloadRows = payloadRows.map(row => {
          const mergedExpls = answersByQuestionId[row.id] || [];
          return {
            ...row,
            _explanations: mergedExpls.length > 0 ? mergedExpls : row._explanations || [],
          };
        });
      } catch (err) {
        console.warn('[Export] Failed to load explanations from Supabase:', err);
      }
    }

    // Specialized CSV Export for Trends — runs inline, no heavy PDF work
    if (reports.raw_data_csv) {
      try {
        await exportTrendsToCsv(trends, cumulative);
      } catch (e) { /* already alerted in exportTrendsToCsv */ }
      setIsExporting(false);
      onClose();
      return;
    }

    // Capture all export data into local constants
    const prependHtml = includeReport ? buildAnalysisHtml() : '';
    const payload: ExportPayload | null = pyqPayload ? { kind: 'questions', rows: payloadRows } : null;

    // Build a descriptive PDF title for PYQ exports: "Dr. UPSC - Ethics, Geography PYQ Analysis"
    const pyqExportTitle = reportVariant === 'pyq'
      ? (() => {
          const subjsInData = Array.from(new Set(filteredQuestions.map(q => q.subject || '').filter(Boolean)));
          const subjectList = selectedSubjects.length > 0 ? selectedSubjects : subjsInData;
          const subjLabel = subjectList.length > 0
            ? subjectList.slice(0, 4).join(', ') + (subjectList.length > 4 ? ', ...' : '')
            : (pyqMeta?.selectedPaper || 'All Subjects');
          return `Dr. UPSC - ${subjLabel} PYQ Analysis`;
        })()
      : opts.title;

    const exportOptions = {
      ...opts,
      title: pyqExportTitle,
      groupingLevels: selectedGroupingLevels.length > 0 ? selectedGroupingLevels : undefined,
      columns,
      yearStart: yearBounds.start,
      yearEnd: yearBounds.end,
      subjectFilters: selectedSubjects,
      sectionGroupFilters: selectedSections,
      microTopicFilters: selectedMicros,
      revisionTags: selectedRevisionTags,
      instituteFilters: selectedInstitutes,
    };
    const isReportOnly = scope === 'report_only';

    // Keep the sheet open with loading indicator during the export
    // so the user sees progress and the app doesn't appear to freeze.
    try {
      if (isReportOnly) {
        if (!prependHtml) {
          Alert.alert('Nothing to export', 'Selected reports produced no content. Try selecting different report options.');
          setIsExporting(false);
          return;
        }
        await printStandaloneReport(prependHtml, { ...opts, title: pyqExportTitle });
      } else {
        if (!payload || (payload.kind === 'questions' && !payload.rows.length)) {
          Alert.alert('Nothing to export', 'No questions matched your filters.');
          setIsExporting(false);
          return;
        }
        await exportToPdf(payload, exportOptions, { prependHtml });
      }
      onClose();
    } catch (err: any) {
      console.error('[AnalysisExport] failed', err);
      setIsExporting(false);
      Alert.alert('Export failed', err?.message || 'Could not generate the PDF.');
    }
  };

  const Chip = ({ active, onPress, children, testID }: any) => (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.chip, {
        backgroundColor: active ? colors.primary : colors.surfaceStrong,
        borderColor: active ? colors.primary : colors.border,
      }]}
    >
      <Text style={{ color: active ? '#fff' : colors.textPrimary, fontWeight: active ? '900' : '700', fontSize: 12 }}>{children}</Text>
    </TouchableOpacity>
  );

  const CheckRow = ({ active, onPress, label, testID }: any) => (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.checkRow, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary + '12' : colors.surfaceStrong }]}
    >
      <View style={[styles.checkbox, { borderColor: active ? colors.primary : colors.textTertiary, backgroundColor: active ? colors.primary : 'transparent' }]}>
        {active ? <Check size={11} color="#fff" /> : null}
      </View>
      <Text style={{ color: active ? colors.primary : colors.textPrimary, fontWeight: '800', fontSize: 12 }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  const toggleArr = (arr: string[], v: string): string[] =>
    arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];

  const sheetBorderRadius = isTablet ? 24 : undefined;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={[
          styles.overlay,
          isTablet && { justifyContent: 'center', alignItems: 'center', padding: 40 },
        ]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface },
            isTablet && {
              width: 540,
              borderRadius: sheetBorderRadius,
              borderBottomLeftRadius: sheetBorderRadius,
              borderBottomRightRadius: sheetBorderRadius,
            },
          ]}
        >
          {!isTablet && <View style={styles.sheetHandle} />}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.textPrimary }]} testID="analysis-export-sheet-title">{title}</Text>
              <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>Configure and export to PDF</Text>
            </View>
            <TouchableOpacity testID="analysis-export-close-btn" onPress={onClose} style={{ padding: 8 }}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 560 }} showsVerticalScrollIndicator={false}>
            {reportVariant === 'pyq' && (
              <Section title="What to Export" colors={colors}>
                <Row>
                  {CHOICES.scopes.map(s => (
                    <Chip
                      key={`scope-${s.id}`}
                      active={scope === s.id}
                      onPress={() => setScope(s.id)}
                      testID={`analysis-scope-${s.id}`}
                    >
                      {s.label}
                    </Chip>
                  ))}
                </Row>
              </Section>
            )}

            {reportVariant === 'pyq' && includePyqs && (
              <Section title="Grouping Levels" colors={colors}>
                <Label colors={colors}>STRUCTURAL GROUPING</Label>
                <Row>
                  <Chip
                    key="subject"
                    active={selectedGroupingLevels.includes('subject')}
                    onPress={() => setSelectedGroupingLevels(prev => 
                      prev.includes('subject') 
                        ? prev.filter(x => x !== 'subject')
                        : [...prev, 'subject']
                    )}
                    testID="analysis-grouping-subject"
                  >
                    Subject
                  </Chip>
                  <Chip
                    key="section_group"
                    active={selectedGroupingLevels.includes('section_group')}
                    onPress={() => setSelectedGroupingLevels(prev => 
                      prev.includes('section_group') 
                        ? prev.filter(x => x !== 'section_group')
                        : [...prev, 'section_group']
                    )}
                    testID="analysis-grouping-section"
                  >
                    Section Group
                  </Chip>
                  <Chip
                    key="microtopic"
                    active={selectedGroupingLevels.includes('microtopic')}
                    onPress={() => setSelectedGroupingLevels(prev => 
                      prev.includes('microtopic') 
                        ? prev.filter(x => x !== 'microtopic')
                        : [...prev, 'microtopic']
                    )}
                    testID="analysis-grouping-micro"
                  >
                    Microtopic
                  </Chip>
                </Row>
              </Section>
            )}

            <Section title="Subjects" colors={colors}>
              {allSubjects.length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No subjects available.</Text>
              ) : (
                <Row>
                  {allSubjects.map(sub => (
                    <CheckRow
                      key={`sub-${sub}`}
                      active={selectedSubjects.includes(sub)}
                      onPress={() => {
                        const next = toggleArr(selectedSubjects, sub);
                        setSelectedSubjects(next);
                        if (!next.includes(sub)) {
                          setSelectedSections(prev => prev.filter(sg => {
                            return next.some(nsub => hierarchy.get(nsub)?.has(sg));
                          }));
                          setSelectedMicros(prev => prev.filter(m => {
                            return next.some(nsub => {
                              const secMap = hierarchy.get(nsub);
                              if (!secMap) return false;
                              for (const sgKeys of secMap.values()) if (sgKeys.has(m)) return true;
                              return false;
                            });
                          }));
                        }
                      }}
                      label={sub}
                      testID={`analysis-subject-${sub}`}
                    />
                  ))}
                </Row>
              )}
            </Section>

            {selectedSubjects.length > 0 && visibleSections.length > 0 && (
              <Section title="Section Groups" colors={colors}>
                <Row>
                  {visibleSections.map(sec => (
                    <CheckRow
                      key={`sec-${sec}`}
                      active={selectedSections.includes(sec)}
                      onPress={() => {
                        const next = toggleArr(selectedSections, sec);
                        setSelectedSections(next);
                        if (!next.includes(sec)) {
                          setSelectedMicros(prev => prev.filter(m => {
                            return selectedSubjects.some(sub => {
                              const secMap = hierarchy.get(sub);
                              if (!secMap) return false;
                              for (const sgName of next) {
                                const mSet = secMap.get(sgName);
                                if (mSet && mSet.has(m)) return true;
                              }
                              return false;
                            });
                          }));
                        }
                      }}
                      label={sec}
                    />
                  ))}
                </Row>
              </Section>
            )}

            {selectedSections.length > 0 && visibleMicros.length > 0 && (
              <Section title="Microtopics" colors={colors}>
                <Row>
                  {visibleMicros.map(m => (
                    <CheckRow
                      key={`mt-${m}`}
                      active={selectedMicros.includes(m)}
                      onPress={() => setSelectedMicros(prev => toggleArr(prev, m))}
                      label={m}
                    />
                  ))}
                </Row>
              </Section>
            )}

            <Section title="Year Filter" colors={colors}>
              <Row>
                <Chip active={yearMode === 'all'} onPress={() => setYearMode('all')} testID="analysis-year-all">All Years</Chip>
                <Chip active={yearMode === 'single'} onPress={() => setYearMode('single')} testID="analysis-year-single">Single Year</Chip>
                <Chip active={yearMode === 'range'} onPress={() => setYearMode('range')} testID="analysis-year-range">Year Range</Chip>
              </Row>
              {yearMode === 'single' && (
                <TextInput
                  testID="analysis-year-single-input"
                  style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={singleYear}
                  onChangeText={setSingleYear}
                  placeholder="e.g. 2023"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  maxLength={4}
                />
              )}
              {yearMode === 'range' && (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    testID="analysis-year-start-input"
                    style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border, flex: 1 }]}
                    value={yearStartIn}
                    onChangeText={setYearStartIn}
                    placeholder="From (e.g. 2013)"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                  <TextInput
                    testID="analysis-year-end-input"
                    style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border, flex: 1 }]}
                    value={yearEndIn}
                    onChangeText={setYearEndIn}
                    placeholder="To (e.g. 2024)"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              )}
            </Section>
            <Section title="Difficulty Filter" colors={colors}>
              {difficultyOptions.length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No difficulty labels available.</Text>
              ) : (
                <Row>
                  {difficultyOptions.map((difficulty) => (
                    <CheckRow
                      key={`diff-${difficulty}`}
                      active={selectedDifficulties.includes(difficulty)}
                      onPress={() => setSelectedDifficulties((prev) => toggleArr(prev, difficulty))}
                      label={difficulty}
                      testID={`analysis-difficulty-${difficulty}`}
                    />
                  ))}
                </Row>
              )}
            </Section>

            <Section title="Revision Type Filter" colors={colors}>
              {revisionTagOptions.length === 0 ? (
                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>No revision tags available in this scope.</Text>
              ) : (
                <Row>
                  {revisionTagOptions.map((tag) => (
                    <CheckRow
                      key={`rev-${tag}`}
                      active={selectedRevisionTags.includes(tag)}
                      onPress={() => setSelectedRevisionTags((prev) => toggleArr(prev, tag))}
                      label={tag}
                      testID={`analysis-revision-${tag}`}
                    />
                  ))}
                </Row>
              )}
            </Section>

            {reportVariant === 'pyq' && includePyqs && instituteOptions.length > 0 && (
              <Section title="Institute Filters" colors={colors}>
                <Row>
                  {instituteOptions.map((institute) => (
                    <CheckRow
                      key={`inst-${institute}`}
                      active={selectedInstitutes.includes(institute)}
                      onPress={() => setSelectedInstitutes((prev) => toggleArr(prev, institute))}
                      label={institute}
                      testID={`analysis-institute-${institute}`}
                    />
                  ))}
                </Row>
              </Section>
            )}

             {includeReport && (
              <Section title="Report Options" colors={colors}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                   <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '700' }}>Subject-wise Detailed Pages</Text>
                   <Switch 
                     value={isDetailedReport} 
                     onValueChange={setIsDetailedReport} 
                     trackColor={{ true: colors.primary, false: colors.border }}
                   />
                </View>
                {reportVariant === 'pyq' && (
                  <View style={{ marginBottom: 16 }}>
                    <Label colors={colors}>HEATMAP METRIC</Label>
                    <Row style={{ marginTop: 4 }}>
                      <Chip
                        active={heatmapMetric === 'count'}
                        onPress={() => setHeatmapMetric('count')}
                      >
                        Question Count
                      </Chip>
                      <Chip
                        active={heatmapMetric === 'marks'}
                        onPress={() => setHeatmapMetric('marks')}
                      >
                        Total Marks
                      </Chip>
                    </Row>
                  </View>
                )}
                <Row>
                  {reportToggleChoices.map(t => (
                    <CheckRow
                      key={`rep-${t.key}`}
                      active={reports[t.key]}
                      onPress={() => setReports(prev => ({ ...prev, [t.key]: !prev[t.key] }))}
                      label={t.label}
                      testID={`analysis-report-${t.key}`}
                    />
                  ))}
                </Row>
              </Section>
            )}

            <TextInput
              testID="analysis-export-title-input"
              style={[styles.titleInput, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
              value={opts.title}
              onChangeText={(t) => set('title', t)}
              placeholder="Document title"
              placeholderTextColor={colors.textTertiary}
            />

            <Section title="Look & Feel" colors={colors}>
              <Label colors={colors}>THEME</Label>
              <Row>{CHOICES.themes.map(t => <Chip key={t.id} active={opts.theme === t.id} onPress={() => set('theme', t.id)}>{t.label}</Chip>)}</Row>
              <Label colors={colors}>PAPER</Label>
              <Row>{CHOICES.papers.map(p => <Chip key={p.id} active={opts.paperStyle === p.id} onPress={() => set('paperStyle', p.id)}>{p.label}</Chip>)}</Row>
              <Label colors={colors}>FONT</Label>
              <Row>{CHOICES.fonts.map(f => <Chip key={f.id} active={opts.fontFamily === f.id} onPress={() => set('fontFamily', f.id)}>{f.label}</Chip>)}</Row>
              <Label colors={colors}>FONT SIZE</Label>
              <Row>{CHOICES.fontSizes.map(sz => <Chip key={sz} active={opts.fontSize === sz} onPress={() => set('fontSize', sz)}>{sz}</Chip>)}</Row>
            </Section>

            {/* Only show PYQ specific settings if in PYQ variant and scope includes them */}
            {reportVariant === 'pyq' && includePyqs && (
              <>
                <Section title="Visual Style" colors={colors}>
                  <Row>
                    {CHOICES.visualStyles.map(v => (
                      <Chip
                        key={v.id}
                        active={opts.visualStyle === v.id}
                        onPress={() => set('visualStyle', v.id)}
                        testID={`analysis-export-visual-${v.id}`}
                      >
                        {v.label}
                      </Chip>
                    ))}
                  </Row>
                  {opts.visualStyle === 'flashcard' && (
                    <Text style={{ fontSize: 10, color: colors.textTertiary, fontWeight: '600', marginTop: 4 }}>
                      Each question is printed as a two-sided card (Question | Answer & Explanation)
                    </Text>
                  )}
                </Section>

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
                              style={[styles.colorChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: color.id === 'transparent' ? colors.surfaceStrong : color.swatch }]}
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
                              style={[styles.colorChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: color.id === 'transparent' ? colors.surfaceStrong : color.swatch }]}
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
                              style={[styles.colorChip, { borderColor: active ? colors.primary : colors.border, backgroundColor: color.id === 'transparent' ? colors.surfaceStrong : color.swatch }]}
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

                <Section title="Content" colors={colors}>
                  <Label colors={colors}>INCLUDE</Label>
                  <Row>{CHOICES.contentScopes.map(c => <Chip key={c.id} active={opts.contentScope === c.id} onPress={() => set('contentScope', c.id)}>{c.label}</Chip>)}</Row>
                  {opts.contentScope !== 'q_only' && (
                    <>
                      <Label colors={colors}>ANSWER PLACEMENT</Label>
                      <Row>{CHOICES.answerPlacements.map(a => <Chip key={a.id} active={opts.answerPlacement === a.id} onPress={() => set('answerPlacement', a.id)}>{a.label}</Chip>)}</Row>
                    </>
                  )}
                </Section>

                <Section title="Filters" colors={colors}>
                  <ToggleRow label="PYQ only" value={!!opts.pyqOnly} onChange={(v: boolean) => set('pyqOnly', v)} colors={colors} />
                  <ToggleRow label="NCERT only" value={!!opts.ncertOnly} onChange={(v: boolean) => set('ncertOnly', v)} colors={colors} />
                  <ToggleRow label="Performance metrics (time / correctness)" value={!!opts.includePerformanceMetrics} onChange={(v: boolean) => set('includePerformanceMetrics', v)} colors={colors} />
                </Section>
              </>
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

            {showAdvanced && (
              <Section title="" colors={colors}>
                <ToggleRow label="Table of Contents" value={!!opts.showTOC} onChange={(v: boolean) => set('showTOC', v)} colors={colors} />
                <Label colors={colors}>PAGE MARGINS (CM)</Label>
                <Label colors={colors}>LEFT</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`ml-${m}`} active={opts.pageMarginLeftCm === m} onPress={() => set('pageMarginLeftCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>RIGHT</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`mr-${m}`} active={opts.pageMarginRightCm === m} onPress={() => set('pageMarginRightCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>TOP</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`mt-${m}`} active={opts.pageMarginTopCm === m} onPress={() => set('pageMarginTopCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>BOTTOM</Label>
                <Row>{CHOICES.marginsCm.map(m => <Chip key={`mb-${m}`} active={opts.pageMarginBottomCm === m} onPress={() => set('pageMarginBottomCm', m)}>{m}</Chip>)}</Row>
                <Label colors={colors}>HEADER</Label>
                <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={opts.headerText} onChangeText={(t: string) => set('headerText', t)}
                  placeholder="Top-right header" placeholderTextColor={colors.textTertiary} />
                <Label colors={colors}>FOOTER</Label>
                <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={opts.footerText} onChangeText={(t: string) => set('footerText', t)}
                  placeholder="Bottom footer" placeholderTextColor={colors.textTertiary} />
                <Label colors={colors}>WATERMARK</Label>
                <TextInput style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.bg, borderColor: colors.border }]}
                  value={opts.watermark} onChangeText={(t: string) => set('watermark', t)}
                  placeholder="e.g. DRAFT" placeholderTextColor={colors.textTertiary} />
              </Section>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              testID="analysis-export-1col-btn"
              disabled={isExporting}
              onPress={() => runExport(1)}
              style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
            >
              {isExporting ? <ActivityIndicator color="#fff" /> : <FileDown size={18} color="#fff" />}
              <Text style={styles.exportBtnText}>{scope === 'report_only' ? 'Export Report' : 'Export 1-Col'}</Text>
            </TouchableOpacity>
            {scope !== 'report_only' && (
              <TouchableOpacity
                testID="analysis-export-2col-btn"
                disabled={isExporting}
                onPress={() => runExport(2)}
                style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: isExporting ? 0.6 : 1 }]}
              >
                {isExporting ? <ActivityIndicator color="#fff" /> : <Layout size={18} color="#fff" />}
                <Text style={styles.exportBtnText}>Export 2-Col</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ---------- helpers ----------

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

/**
 * Standalone "Report only" exporter — wraps the fragment in a minimal A4
 * HTML shell and hands it to expo-print + Sharing.  Mirrors what
 * unifiedExportEngine.exportToPdf does for questions, but without the
 * question-bank body, so users can export analytics alone.
 *
 */
async function printStandaloneReport(fragmentHtml: string, o: ExportOptions): Promise<void> {
  let tempUri: string | null = null;
  try {
    // Use @page for top/bottom margins (re-applied at each page break) + .paper wrapper
    // with padding as fallback for left/right (reliable on Android WebView).
    // This mirrors the approach in unifiedExportEngine.ts line 335-352.
    const mt = clamp(o.pageMarginTopCm, 1);
    const mr = clamp(o.pageMarginRightCm, 1);
    const mb = clamp(o.pageMarginBottomCm, 1);
    const ml = clamp(o.pageMarginLeftCm, 1);
    const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <style>
      @page { size: A4; margin: ${mt}cm ${mr}cm ${mb}cm ${ml}cm; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { font-family: ${o.fontFamily === 'serif' ? "'Georgia', serif" : o.fontFamily === 'mono' ? "'Menlo', monospace" : o.fontFamily === 'handwriting' ? "'Caveat', cursive" : "-apple-system, Segoe UI, Roboto, sans-serif"}; color: #0f172a; font-size: ${o.fontSize}pt; line-height: 1.5; }
      .paper { padding: ${mt}cm ${mr}cm ${mb}cm ${ml}cm; min-height: 100%; }
      ${o.watermark ? `.watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 80pt; font-weight: 900; color: rgba(0,0,0,0.06); pointer-events: none; z-index: -1; }` : ''}
    </style></head><body>
      <div class="paper">
      ${o.watermark ? `<div class="watermark">${escapeHtml(o.watermark)}</div>` : ''}
      ${fragmentHtml}
      </div>
    </body></html>`;
    
    const { uri } = await Promise.race([
      Print.printToFileAsync({ html, base64: false }),
      new Promise<{ uri: string }>((_, reject) => 
        setTimeout(() => reject(new Error('Print timeout')), 90000) // 90s timeout
      ),
    ]);
    
    tempUri = uri;
    const safe = (o.title || 'analysis').replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 48) || 'analysis';
    const dest = `${FileSystem.cacheDirectory}${safe}_${Date.now()}.pdf`;
    
    try { 
      await FileSystem.moveAsync({ from: uri, to: dest }); 
      tempUri = dest;
    } catch (e) {
      console.warn('[AnalysisExport] Move failed, using temp uri', e);
    }
    
    const info = await FileSystem.getInfoAsync(tempUri || dest);
    const finalUri = info.exists ? (tempUri || dest) : uri;
    
    if (await Sharing.isAvailableAsync()) {
      try {
        // Share without timeout — let the system share sheet complete naturally.
        // The user will dismiss it when done. No timeout so Telegram uploads
        // can finish without the file being deleted underneath.
        await Sharing.shareAsync(finalUri, { 
          mimeType: 'application/pdf', 
          dialogTitle: o.title || 'Analysis Report' 
        }).catch(() => {
          console.warn('[AnalysisExport] Share operation completed/cancelled');
        });
      } catch (e) {
        console.warn('[AnalysisExport] Share error (non-fatal):', e);
      }
    } else {
      // Fallback when share is not available
      Alert.alert('Export Ready', `PDF saved. You can find it at the export location.`);
    }
  } catch (e) {
    console.error('[AnalysisExport] Print operation failed:', e);
    throw e;
  } finally {
    // Cleanup intentionally skipped — temp file must stay until share target finishes.
    // OS will clean up temp files automatically.
  }
}

function clamp(n: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0.3, Math.min(4, v));
}

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"' } as any)[c] || c);
}

/**
 * Produces an `<section class="analysis-summary">…</section>` block using
 * the same engine as PyQ analysis export.  Derives subject/section/micro
 * heatmaps and momentum from the currently filtered questions so the
 * export honours all top-level selections.
 */
function buildSummaryFromFilteredQuestions(
  rows: AnalysisExportQuestion[],
  reports: AnalysisReportToggles,
  buildForecastRows: AnalysisExportSheetProps['buildForecastRows'],
  yearBounds: { start: number | null; end: number | null },
  selectedSubjects: string[],
  selectedSections: string[],
  selectedMicros: string[],
  pyqMeta?: AnalysisExportSheetProps['pyqMeta'],
  heatmapMetric?: 'count' | 'marks',
): string {
  if (!rows.length) return '';

  const subjectTotals: Record<string, number> = {};
  const subjectByYear: Record<string, Record<string, number>> = {};
  const sectionTotals: Record<string, number> = {};
  const sectionByYear: Record<string, Record<string, number>> = {};
  const microTotals: Record<string, number> = {};
  const microByYear: Record<string, Record<string, number>> = {};
  const topicTotals: Record<string, number> = {};
  const topicByYear: Record<string, Record<string, number>> = {};
  const subtopicTotals: Record<string, number> = {};
  const subtopicByYear: Record<string, Record<string, number>> = {};
  const totalsByYear: Record<string, number> = {};

  rows.forEach(q => {
    const yearNum = Number(q.exam_year);
    if (!Number.isFinite(yearNum)) return;
    const year = String(yearNum);
    const subject = q.subject || 'General';
    const section = q.section_group || 'General';
    const micro = q.micro_topic || 'Other';
    const topic = micro || section;
    const subtopic = (q as any).sub_topic || (q as any).subtopic || 'Other';

    const val = heatmapMetric === 'marks' ? (Number(q.marks) || 0) : 1;

    subjectTotals[subject] = (subjectTotals[subject] || 0) + val;
    if (!subjectByYear[year]) subjectByYear[year] = {};
    subjectByYear[year][subject] = (subjectByYear[year][subject] || 0) + val;

    sectionTotals[section] = (sectionTotals[section] || 0) + val;
    if (!sectionByYear[section]) sectionByYear[section] = {};
    sectionByYear[section][year] = (sectionByYear[section][year] || 0) + val;

    microTotals[micro] = (microTotals[micro] || 0) + val;
    if (!microByYear[micro]) microByYear[micro] = {};
    microByYear[micro][year] = (microByYear[micro][year] || 0) + val;

    topicTotals[topic] = (topicTotals[topic] || 0) + val;
    if (!topicByYear[topic]) topicByYear[topic] = {};
    topicByYear[topic][year] = (topicByYear[topic][year] || 0) + val;

    subtopicTotals[subtopic] = (subtopicTotals[subtopic] || 0) + val;
    if (!subtopicByYear[subtopic]) subtopicByYear[subtopic] = {};
    subtopicByYear[subtopic][year] = (subtopicByYear[subtopic][year] || 0) + val;

    totalsByYear[year] = (totalsByYear[year] || 0) + val;
  });

  const summaryYears = Object.keys(totalsByYear).sort((a, b) => Number(b) - Number(a));
  if (!summaryYears.length) return '';

  const subjectSorted = Object.entries(subjectTotals).sort((a, b) => b[1] - a[1]);
  const sectionSorted = Object.entries(sectionTotals).sort((a, b) => b[1] - a[1]);
  const microSorted = Object.entries(microTotals).sort((a, b) => b[1] - a[1]);
  const subtopicSorted = Object.entries(subtopicTotals).sort((a, b) => b[1] - a[1]);

  const isSingleSubject = selectedSubjects.length === 1;
  const deepDiveSubject = isSingleSubject ? selectedSubjects[0] : null;

  const subjectHeatmapRows: PyqHeatmapRow[] = subjectSorted.slice(0, 16).map(([name]) => ({
    key: `subject-${name}`, label: name,
    byYear: summaryYears.reduce((acc, year) => {
      const count = subjectByYear[year]?.[name] || 0;
      if (count) acc[year] = count;
      return acc;
    }, {} as Record<string, number>),
  }));
  const topicHeatmapRows: PyqHeatmapRow[] = Object.entries(topicTotals)
    .sort((a, b) => b[1] - a[1]).slice(0, 20)
    .map(([name]) => ({ key: `topic-${name}`, label: name, byYear: topicByYear[name] || {} }));
  const sectionHeatmapRows: PyqHeatmapRow[] = sectionSorted.slice(0, 20).map(([name]) => ({
    key: `section-${name}`, label: name, byYear: sectionByYear[name] || {},
  }));
  const microHeatmapRows: PyqHeatmapRow[] = microSorted.slice(0, 24).map(([name]) => ({
    key: `micro-${name}`, label: name, byYear: microByYear[name] || {},
  }));
  const subtopicHeatmapRows: PyqHeatmapRow[] = subtopicSorted.slice(0, 20).map(([name]) => ({
    key: `subtopic-${name}`, label: name, byYear: subtopicByYear[name] || {},
  }));

  const distributionData = isSingleSubject
    ? sectionSorted.map(([name, value]) => ({ name, value }))
    : subjectSorted.map(([name, value]) => ({ name, value }));

  const TREND_PALETTE = ['#2563EB', '#14B8A6', '#F59E0B', '#EF4444'];
  const topTrendSubjects = subjectSorted.slice(0, 4).map(([name]) => name);
  const overviewSeries = isSingleSubject && deepDiveSubject
    ? [{ label: deepDiveSubject, values: summaryYears.map(y => subjectByYear[y]?.[deepDiveSubject] || 0), color: '#2563EB' }]
    : topTrendSubjects.map((subject, idx) => ({
        label: subject,
        values: summaryYears.map(y => subjectByYear[y]?.[subject] || 0),
        color: TREND_PALETTE[idx % TREND_PALETTE.length],
      }));

  const focusLabel = selectedMicros.length === 1
    ? selectedMicros[0]
    : selectedMicros.length > 1 ? 'Selected Micro Topics'
      : selectedSections.length === 1 ? selectedSections[0]
      : selectedSections.length > 1 ? 'Selected Section Groups'
      : deepDiveSubject || 'Selected Scope';

  const focusTrendSeries = [{
    label: focusLabel,
    values: summaryYears.map(y => totalsByYear[y] || 0),
    color: '#2563EB',
  }];

  const yearLabel = yearBounds.start == null || yearBounds.end == null
    ? 'All Years'
    : yearBounds.start === yearBounds.end
      ? `Year ${yearBounds.start}`
      : `${yearBounds.start}-${yearBounds.end}`;

  let forecastRows;
  if ((reports.forecast || reports.full_report) && buildForecastRows) {
    try { forecastRows = buildForecastRows(rows); } catch { forecastRows = undefined; }
  }

  const subjectsInData = Array.from(new Set(rows.map(r => r.subject || 'General').filter(Boolean)));

  return buildPyqAnalysisSummaryHtml({
    filteredQuestionsForSummary: rows,
    selectedSubjectsList: selectedSubjects.length > 0 ? selectedSubjects : subjectsInData,
    selectedReports: {
      full_report: reports.full_report,
      subject_momentum: reports.subject_momentum,
      subject_distribution: reports.subject_distribution,
      heatmaps: reports.heatmaps,
      forecast: reports.forecast,
    },
    examStage: pyqMeta?.examStage || 'Analysis',
    selectedPaper: pyqMeta?.selectedPaper || (selectedSubjects.length ? selectedSubjects.join(', ') : 'All Subjects'),
    selectedRange: pyqMeta?.selectedRange || yearLabel,
    heatmapPalette: pyqMeta?.heatmapPalette || 'spectral',
    heatmapMetric,
    questionCount: rows.length,
    years: summaryYears,
    distributionData,
    overviewSeries,
    focusTrendSeries,
    focusSubject: deepDiveSubject || 'All',
    focusSection: selectedSections.length === 1 ? selectedSections[0] : 'All',
    focusMicro: selectedMicros.length === 1 ? selectedMicros[0] : 'All',
    subjectHeatmapRows: isSingleSubject ? sectionHeatmapRows : subjectHeatmapRows,
    topicHeatmapRows: isSingleSubject ? microHeatmapRows : topicHeatmapRows,
    subtopicHeatmapRows: subtopicHeatmapRows,
    momentumTitle: isSingleSubject && deepDiveSubject ? `${deepDiveSubject} Momentum` : 'Subject Momentum',
    distributionTitle: isSingleSubject ? `${deepDiveSubject} Section Distribution` : 'Subject Distribution (Donut)',
    focusedTitle: isSingleSubject ? `${deepDiveSubject} Focused Trend` : 'Focused Trend',
    primaryHeatmapTitle: isSingleSubject && deepDiveSubject ? `${deepDiveSubject} Section × Year Heatmap` : 'Subject × Year Heatmap',
    primaryHeatmapLabel: isSingleSubject ? 'Section Group' : 'Subject',
    secondaryHeatmapTitle: isSingleSubject && deepDiveSubject ? `${deepDiveSubject} Micro Topic × Year Heatmap` : 'Top 20 Topics × Year Heatmap',
    secondaryHeatmapLabel: isSingleSubject ? 'Micro Topic' : 'Topic',
    forecastRows,
    forecastTitle: deepDiveSubject
      ? `Forecast — ${deepDiveSubject} (Probable 2026 Topics)`
      : 'Forecast — Probable 2026 Topics',
  });
}

const exportTrendsToCsv = async (trends: any, cumulative: any) => {
  try {
    if (!trends || !trends.historicalScores) {
      Alert.alert('No data', 'No performance trends available to export.');
      return;
    }

    let csv = 'Attempt #,Date,Title,Score,Accuracy (%)\n';
    trends.historicalScores.forEach((t: any) => {
      const date = t.date ? new Date(t.date).toLocaleDateString() : 'N/A';
      csv += `${t.attemptIndex},"${date}","${t.title || 'Attempt'}","${t.score}","${Math.round(t.accuracy)}"\n`;
    });

    const filename = `Performance_Trends_${new Date().getTime()}.csv`;
    const filePath = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, csv);
    await Sharing.shareAsync(filePath);
  } catch (e: any) {
    Alert.alert('CSV Export Failed', e.message);
  }
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20 },
  sheetHandle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#ccc', marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '900', letterSpacing: -0.2 },
  titleInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontWeight: '700', marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  checkRow: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  checkbox: { width: 16, height: 16, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  colorChip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  advToggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, paddingBottom: 6, marginTop: 10, borderTopWidth: 1 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 16 },
  exportBtn: { flex: 1, height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  exportBtnText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
});

export default AnalysisExportSheet;