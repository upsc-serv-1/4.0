/**
 * Unified Export Engine — single source of truth for generating
 * styled, rich-text preserving HTML/PDF exports across the app.
 *
 * Content kinds:
 *   - questions   (quiz / test / search / tag results / analysis drilldown)
 *   - flashcards  (decks)
 *   - notes       (notebook with microTopic headings + highlight cards)
 *   - tags        (tag-grouped questions)
 *
 * Features (surfaces in UnifiedExportSheet UI):
 *   - Font family (sans, serif, handwriting, mono)
 *   - Font size (px)
 *   - Columns (1 or 2)
 *   - Theme (modern / classic / sepia / historical / dark)
 *   - Paper style (plain / lined / grid / dotted)
 *   - Content scope (questions-only / questions+options / questions+options+explanations)
 *   - Answer key placement (inline or end-of-document)
 *   - Filters (status: correct/incorrect/unattempted + revision tags + pyq tag + ncert filter)
 *   - Sort (subject, microtopic, difficulty, date)
 *   - Table of contents (auto)
 *   - Custom header / footer / watermark
 *   - Performance metrics (accuracy, time taken) — useful for analysis export
 *   - Rich-text preservation: <b>, <i>, <u>, <mark>, <span style="background…">, <ul>, <ol>
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';

export type ExportFontFamily = 'sans' | 'serif' | 'handwriting' | 'mono';
export type ExportTheme = 'modern' | 'classic' | 'sepia' | 'historical' | 'dark';
export type ExportPaperStyle = 'plain' | 'lined' | 'grid' | 'dotted';
export type ExportColumns = 1 | 2;
export type ExportContentScope = 'q_only' | 'q_options' | 'q_options_expl';
export type ExportAnswerPlacement = 'inline' | 'end';
export type ExportSortBy = 'default' | 'subject' | 'microtopic' | 'difficulty' | 'date' | 'year' | 'subject_section' | 'subject_section_microtopic';
export type ExportGroupingLevel = 'subject' | 'section_group' | 'microtopic';
export type ExportQaLayoutMode = 'unified' | 'split';
export type ExportVisualStyle = 'document' | 'flashcard';

export interface ExportOptions {
  title: string;
  fontFamily: ExportFontFamily;
  fontSize: number;
  columns: ExportColumns;
  theme: ExportTheme;
  paperStyle: ExportPaperStyle;
  contentScope: ExportContentScope;
  answerPlacement: ExportAnswerPlacement;
  sortBy: ExportSortBy;
  /** Multi-select grouping levels — composes hierarchical export structure
   *  independently of filters. e.g. ['subject','section_group'] groups by both. */
  groupingLevels?: ExportGroupingLevel[];

  // Page setup (cm)
  pageMarginTopCm: number;
  pageMarginRightCm: number;
  pageMarginBottomCm: number;
  pageMarginLeftCm: number;

  // Question/answer background customization
  qaBackgroundColor: string; // unified mode background
  qaQuestionBackgroundColor: string; // split mode question background
  qaAnswerBackgroundColor: string; // split mode answer background
  qaLayoutMode: ExportQaLayoutMode;
  visualStyle: ExportVisualStyle;

  showTOC: boolean;
  headerText: string;
  footerText: string;
  watermark: string;
  moduleName?: string;

  includePerformanceMetrics?: boolean;
  hideResponses?: boolean;
  showMyResponses?: boolean; // When true, show user's response colors (red for wrong, green for correct); when false, don't show any coloring

  // Question filters (apply before render)
  statusFilter?: 'all' | 'correct' | 'incorrect' | 'unattempted';
  revisionTags?: string[];
  pyqOnly?: boolean;
  ncertOnly?: boolean;
  subjectFilters?: string[];
  sectionGroupFilters?: string[];
  microTopicFilters?: string[];
  yearStart?: number | null;
  yearEnd?: number | null;

  instituteFilters?: string[];

  // Meta chips display
  showMetaChips?: boolean;   // Show subject / section_group / micro_topic / year chips
  showPYQChips?: boolean;    // Show PYQ categorization chip (UPSC CSE 2025, etc.)

  // Notes-specific injections
  notesSubheadingColor?: string;
  notesChecklistMode?: boolean;
}

export const defaultExportOptions = (overrides: Partial<ExportOptions> = {}): ExportOptions => ({
  title: 'Export',
  fontFamily: 'sans',
  fontSize: 6,
  columns: 1,
  theme: 'modern',
  paperStyle: 'plain',
  contentScope: 'q_options_expl',
  answerPlacement: 'inline',
  sortBy: 'default',
  pageMarginTopCm: 1,
  pageMarginRightCm: 1,
  pageMarginBottomCm: 1,
  pageMarginLeftCm: 1,
  qaBackgroundColor: '#f8fafc',
  qaQuestionBackgroundColor: '#f8fafc',
  qaAnswerBackgroundColor: '#f8fafc',
  qaLayoutMode: 'unified',
  visualStyle: 'document',
  showTOC: false,
  headerText: 'Dr. UPSC',
  footerText: '',
  watermark: '',
  moduleName: '',
  includePerformanceMetrics: false,
  hideResponses: false,
  showMyResponses: false,
  statusFilter: 'all',
  revisionTags: [],
  pyqOnly: false,
  ncertOnly: false,
  subjectFilters: [],
  sectionGroupFilters: [],
  microTopicFilters: [],
  instituteFilters: [],
  yearStart: null,
  yearEnd: null,
  notesSubheadingColor: '#6A5BFF20',
  notesChecklistMode: true,
  showMetaChips: true,
  showPYQChips: true,
  ...overrides,
});

// ---------- Data Types ----------

export interface ExportQuestion {
  id: string;
  statement?: string;
  question_text?: string;
  options?: { a?: string; b?: string; c?: string; d?: string };
  correct_answer?: string;
  selected_answer?: string;
  is_correct?: boolean;
  explanation_markdown?: string;
  explanation?: string;
  subject?: string;
  section_group?: string;
  micro_topic?: string;
  exam_year?: number | string;
  is_pyq?: boolean;
  is_ncert?: boolean;
  difficulty?: string;
  review_tags?: string[];
  time_taken_seconds?: number;
  attempted_at?: string;
  _explanations?: Array<{ source: string; text: string; year?: string }>;
  // PYQ categorization fields (used for proper chip rendering matching SharedQuestionCard)
  is_upsc_cse?: boolean;
  is_allied?: boolean;
  is_others?: boolean;
  exam_group?: string;
  source?: Record<string, any>;
  exam_info?: Record<string, any>;
}

export interface ExportFlashcard {
  id: string;
  front: string;
  back: string;
  deck?: string;
  state?: 'learning' | 'learned' | 'mastered' | 'due';
  subject?: string;
  micro_topic?: string;
}

export interface ExportNoteBlock {
  id: string;
  type: 'microTopicHeading' | 'highlight' | 'point' | 'checklist';
  text: string;
  color?: string;
  sourceLabel?: string;
  checked?: boolean;
}

/**
 * Hardnotes canvas export — a single Skia-drawn note rendered as SVG on A4.
 * strokes carry the same vector schema used by src/components/hardnotes/strokes.ts
 * so PDF rendering stays pixel-perfect with the on-device canvas.
 */
export interface ExportHardnoteStrokePoint {
  x: number;
  y: number;
  p?: number; // pressure 0..1
}
export interface ExportHardnoteStroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser' | 'lasso';
  color: string;
  width: number;
  opacity?: number;
  points: ExportHardnoteStrokePoint[];
}
export interface ExportHardnote {
  title: string;
  subject?: string;
  baseLayerMarkdown?: string | null;
  strokes: ExportHardnoteStroke[];
  canvasWidth: number;
  canvasHeight: number;
  updatedAt?: string;
  /** Optional breadcrumb e.g. ["Polity", "Constitution"] */
  breadcrumb?: string[];
}

// ---------- Theme tokens ----------

const themeTokens: Record<ExportTheme, { bg: string; fg: string; accent: string; rule: string; card: string }> = {
  modern: { bg: '#ffffff', fg: '#111827', accent: '#6366f1', rule: '#e5e7eb', card: '#ffffff' },
  classic: { bg: '#ffffff', fg: '#111111', accent: '#1d4ed8', rule: '#e5e7eb', card: '#ffffff' },
  sepia: { bg: '#F4ECD8', fg: '#433422', accent: '#9a3412', rule: '#d9c7a3', card: '#fdf6e3' },
  historical: { bg: '#fdf6e3', fg: '#2d2419', accent: '#7c2d12', rule: '#d6c9a8', card: '#fffaf0' },
  dark: { bg: '#0b0f17', fg: '#e5e7eb', accent: '#60a5fa', rule: '#1f2937', card: '#111827' },
};

const fontFamilyCss: Record<ExportFontFamily, string> = {
  sans: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  serif: `'Georgia', 'Times New Roman', serif`,
  handwriting: `'Caveat', 'Patrick Hand', cursive`,
  mono: `'Menlo', 'Consolas', 'JetBrains Mono', 'Courier New', monospace`,
};

const paperBg: Record<ExportPaperStyle, string> = {
  plain: 'none',
  lined: `repeating-linear-gradient(to bottom, #ffffff 0, #ffffff 27px, #dbe4f3 28px)`,
  grid: `linear-gradient(to right, var(--rule) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(to bottom, var(--rule) 1px, transparent 1px) 0 0/24px 24px`,
  dotted: `radial-gradient(var(--rule) 1px, transparent 1px) 0 0/16px 16px`,
};

// ---------- CSS builder ----------

const clampCm = (value: number, fallback = 1): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.3, Math.min(4, n));
};

const toBool = (value: any): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
};

const getExportExamInfo = (q: ExportQuestion): Record<string, any> => {
  if (q?.exam_info && typeof q.exam_info === 'object' && !Array.isArray(q.exam_info)) return q.exam_info as Record<string, any>;
  if (q?.source && typeof q.source === 'object' && !Array.isArray(q.source)) return q.source as Record<string, any>;
  return {};
};

/**
 * Build a PYQ chip label matching the SharedQuestionCard behavior.
 * Returns null when no PYQ data should be shown.
 */
interface PyqChipInfo {
  label: string;
  isUPSC: boolean;
  isAllied: boolean;
  isOther: boolean;
}

const getExportPyqChip = (q: ExportQuestion): PyqChipInfo | null => {
  if (!toBool(q.is_pyq)) return null;
  const examInfo = getExportExamInfo(q);
  let rawGroup = String(examInfo?.group || examInfo?.exam_name || '').trim();
  if (!rawGroup && q.exam_group) {
    rawGroup = String(q.exam_group).trim();
  }
  const groupNameUpper = rawGroup.toUpperCase();

  const isUPSC = toBool(examInfo?.is_upsc_cse) || toBool(q.is_upsc_cse) || groupNameUpper === 'UPSC' || groupNameUpper.includes('UPSC CSE') || groupNameUpper.includes('IAS');
  const isAllied = toBool(examInfo?.is_allied) || toBool(q.is_allied) || ['CAPF', 'CDS', 'NDA', 'EPFO', 'CISF', 'ALLIED'].some(g => groupNameUpper.includes(g));
  const isOther = toBool(examInfo?.is_others) || toBool(q.is_others) || ['UPPCS', 'BPSC', 'MPSC', 'RPSC', 'UKPSC', 'MPPSC', 'CGPSC', 'STATE PSC', 'OTHER'].some(g => groupNameUpper.includes(g));

  const rawYear = examInfo?.year ?? '';
  let year = typeof rawYear === 'string' ? rawYear.trim() : String(rawYear).trim();
  if (!year) {
    const colYear = q.exam_year;
    if (colYear !== undefined && colYear !== null && String(colYear).trim()) {
      year = String(colYear).trim();
    }
  }

  if (!rawGroup && !year) return null; // No meaningful PYQ data

  let groupName = rawGroup;
  if (!groupName) {
    if (isUPSC) groupName = 'UPSC CSE';
    else if (isAllied) groupName = 'Allied';
    else if (isOther) groupName = 'Other';
    else groupName = 'PYQ';
  }

  return {
    label: `${groupName} ${year}`.trim(),
    isUPSC,
    isAllied,
    isOther,
  };
};

const baseCss = (o: ExportOptions) => {
  const t = themeTokens[o.theme];
  const qaBg = o.qaBackgroundColor || 'transparent';
  const qBg = o.qaQuestionBackgroundColor || qaBg;
  const aBg = o.qaAnswerBackgroundColor || qaBg;
  const anyBgVisible = qaBg !== 'transparent' || qBg !== 'transparent' || aBg !== 'transparent';
  const qaBorder = anyBgVisible ? 'rgba(15, 23, 42, 0.12)' : 'transparent';
  return `
    :root { --bg:${t.bg}; --fg:${t.fg}; --accent:${t.accent}; --rule:${t.rule}; --card:${t.card}; --qa-bg:${qaBg}; --qa-q-bg:${qBg}; --qa-a-bg:${aBg}; --qa-border:${qaBorder}; }
    /* 🔧 FIX: @page margin is unreliable on Android (Chromium WebView via expo-print
       ignores the @page margin CSS rule). We keep @page margin for top/bottom (the
       ONLY mechanism that re-applies top/bottom spacing at each page break in paged
       media), and additionally apply padding on the .paper wrapper for reliable
       left/right spacing on all platforms. */
    @page { size: A4 !important; margin: ${clampCm(o.pageMarginTopCm)}cm ${clampCm(o.pageMarginRightCm)}cm ${clampCm(o.pageMarginBottomCm)}cm ${clampCm(o.pageMarginLeftCm)}cm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: ${fontFamilyCss[o.fontFamily]};
      font-size: ${o.fontSize}pt;
      line-height: 1.55;
      orphans: 2;
      widows: 2;
    }
    .paper { background-color: ${o.paperStyle === 'lined' ? '#ffffff' : 'var(--bg)'}; background-image: ${paperBg[o.paperStyle]}; padding: ${clampCm(o.pageMarginTopCm)}cm ${clampCm(o.pageMarginRightCm)}cm ${clampCm(o.pageMarginBottomCm)}cm ${clampCm(o.pageMarginLeftCm)}cm; min-height: 100%; }

    h1.cover { font-size: ${o.fontSize + 14}pt; margin: 0 0 6mm 0; color: var(--accent); font-weight: 900; letter-spacing: -0.5px; }
    .meta { color: var(--accent); font-size: ${o.fontSize - 2}pt; margin-bottom: 6mm; }
    .module-label { font-size: ${o.fontSize - 3}pt; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); margin-bottom: 2mm; }

    .header-bar { border-bottom: 1px solid var(--rule); padding-bottom: 2mm; margin-bottom: 6mm; display: flex; justify-content: space-between; color: var(--accent); font-size: ${o.fontSize - 3}pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }

    .cols {
      column-gap: 10mm;
      -webkit-column-count: ${o.columns};
      -webkit-column-gap: 10mm;
      display: ${o.columns === 2 ? 'grid' : 'block'};
      ${o.columns === 2 ? 'grid-template-columns: 1fr 1fr; gap: 10mm;' : ''}
    }
    .layout-flashcard .cols {
      display: block !important;
      -webkit-column-count: 1 !important;
      column-count: 1 !important;
      gap: 0 !important;
    }
    .item {
      break-inside: avoid;
      page-break-inside: avoid;
      padding: 4mm 0 4mm 0;
      border-bottom: 1px solid var(--rule);
      margin-bottom: 2mm;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .analysis-card,
    .analysis-chart,
    table,
    tr,
    svg,
    svg * {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    .qnum { color: var(--accent); font-weight: 800; margin-right: 4px; }
    .qstem {
      font-weight: 500;
      margin-bottom: 1mm;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .qstem b, .qstem strong { font-weight: 700; }
    .metarow { opacity: 0.7; font-size: ${o.fontSize - 3}pt; margin-top: 1mm; }
    .pill { display: inline-block; padding: 1px 6px; border-radius: 10px; background: var(--rule); color: var(--fg); font-size: ${o.fontSize - 4}pt; margin-right: 4px; }
    .q-chip-bar { display: flex; flex-wrap: wrap; gap: 4px; flex-shrink: 0; max-width: 50%; justify-content: flex-end; }
    .pyq-chip { display: inline-block; padding: 2px 10px; border-radius: 14px; font-size: ${o.fontSize - 2}pt; font-weight: 800; }
    .q-breadcrumb { font-size: ${o.fontSize - 3}pt; color: var(--fg); opacity: 0.7; margin-bottom: 1mm; }
    .q-breadcrumb-arrow { margin: 0 2px; opacity: 0.5; }
    .q-breadcrumb-chip { display: inline-block; padding: 0 6px; border-radius: 6px; background: #e0f2fe; color: #0369a1; font-weight: 700; font-size: ${o.fontSize - 4}pt; margin-left: 4px; }
    .opts { margin: 2mm 0 0 4mm; padding: 0; list-style: none; }
    .opts li { margin: 1mm 0; padding: 1mm 2mm; border-radius: 4px; }
    .opts li.correct { background: rgba(34,197,94,0.12); border-left: 3px solid #22c55e; }
    .opts li.wrong { background: rgba(239,68,68,0.12); border-left: 3px solid #ef4444; }
    .ans { color: var(--accent); font-weight: 700; margin-top: 2mm; font-size: ${o.fontSize - 1}pt; }
    .expl {
      font-size: ${o.fontSize - 1}pt;
      margin-top: 2mm;
      opacity: 0.92;
      padding: 2mm 3mm;
      background: rgba(0,0,0,0.03);
      border-radius: 4px;
      border-left: 3px solid var(--accent);
      overflow-wrap: break-word;
      word-break: break-word;
    }
    .expl b, .expl strong { font-weight: 700; }

    /* Q&A highlight customization */
    .qa-unified,
    .qa-question-box,
    .qa-answer-box {
      border: 1px solid var(--qa-border);
      border-radius: 8px;
      padding: 3mm 3.5mm;
    }
    .qa-unified { background: var(--qa-bg); }
    .qa-question-box { background: var(--qa-q-bg); }
    .qa-answer-box { background: var(--qa-a-bg); }
    .qa-unified .qa-answer {
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 1px dotted var(--qa-border);
    }
    .qa-split-stack {
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    /* Rich text preservation */
    b, strong { font-weight: 700; }
    i, em { font-style: italic; }
    u { text-decoration: underline; text-decoration-skip-ink: auto; text-underline-offset: 2px; text-underline-position: under; vertical-align: baseline; }
    s, strike, del { text-decoration: line-through; }
    mark, .highlight { background-color: #FFF59D; color: inherit; padding: 0 2px; border-radius: 2px; font-size: inherit !important; line-height: inherit !important; }
    span[style*="background"] { padding: 0 2px; border-radius: 2px; font-size: inherit !important; line-height: inherit !important; }
    blockquote { border-left: 3px solid var(--accent); padding: 4px 12px; margin: 6px 0; color: var(--fg); background: rgba(0,0,0,0.04); border-radius: 4px; }
    ul, ol { padding-left: 22px; margin: 4px 0; }
    li { margin: 2px 0; }
    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 8px 0 4px 0; color: var(--fg); }
    a { color: var(--accent); text-decoration: underline; text-decoration-skip-ink: auto; text-underline-offset: 2px; }
    code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-family: Menlo, monospace; font-size: 0.9em; }

    /* Flashcards */
    .card { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; border: 1px solid var(--rule); border-radius: 6px; padding: 4mm; margin: 3mm 0; break-inside: avoid; }
    .card .side { border-right: 1px dotted var(--rule); padding-right: 4mm; }
    .card .side:last-child { border-right: none; padding-right: 0; }
    .card-face-label { font-size: ${o.fontSize - 3}pt; font-weight: 800; color: var(--accent); letter-spacing: 1px; margin-bottom: 1mm; text-transform: uppercase; }
    .card-state { display: inline-block; font-size: ${o.fontSize - 4}pt; padding: 0 6px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; background: var(--accent); color: #fff; }

    /* Tags */
    .tag-section { margin-top: 6mm; break-inside: avoid; }
    .tag-title { color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 2mm; margin: 6mm 0 3mm 0; font-size: ${o.fontSize + 2}pt; font-weight: 900; }

    /* Notes */
    .note h1, .note h2, .note h3, .note h4, .note h5, .note h6 {
      color: var(--accent);
      font-size: inherit !important;
      line-height: inherit !important;
      font-weight: 700;
      margin: 0 0 1mm 0;
    }
    .note { break-inside: avoid; page-break-inside: avoid; padding: 4mm; border: 1px solid var(--rule); border-left: 4px solid var(--accent); border-radius: 6px; margin-bottom: 4mm; }
    .microheading { font-weight: 900; font-size: ${o.fontSize + 1}pt; color: var(--accent); margin: 6mm 0 2mm 0; padding: 3mm 4mm; background: rgba(99,102,241,0.08); border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* TOC */
    .toc { margin: 0 0 10mm 0; padding: 4mm 6mm; background: rgba(0,0,0,0.03); border-radius: 6px; border: 1px solid var(--rule); }
    .toc-title { font-weight: 900; margin-bottom: 2mm; font-size: ${o.fontSize + 1}pt; color: var(--accent); }
    .toc-item { font-size: ${o.fontSize - 1}pt; padding: 1mm 0; border-bottom: 1px dotted var(--rule); }

    /* Executive summary prepend support */
    .executive-summary { margin-bottom: 8mm; }
    .page-break { break-before: page; page-break-before: always; }

    /* Watermark */
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80pt; font-weight: 900; color: rgba(0,0,0,0.04); white-space: nowrap; pointer-events: none; z-index: -1; }

    /* Footer */
    .footer { position: fixed; bottom: -8mm; left: 0; right: 0; font-size: ${o.fontSize - 4}pt; color: #9ca3af; text-align: center; text-transform: uppercase; letter-spacing: 1px; }

    /* Answer Key appendix */
    .answer-key { page-break-before: always; margin-top: 10mm; }
    .answer-key h2 { color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 2mm; }
    .ak-row { padding: 2mm 0; border-bottom: 1px dotted var(--rule); font-size: ${o.fontSize - 1}pt; }
    .ak-num { color: var(--accent); font-weight: 800; margin-right: 6px; }

    /* Perf metrics */
    .metrics { display: inline-block; font-size: ${o.fontSize - 3}pt; margin-left: 6px; padding: 1px 6px; border-radius: 10px; background: rgba(99,102,241,0.12); color: var(--accent); font-weight: 700; }
  `;
};

// ---------- HTML helpers ----------

const escapeHtml = (s: string = ''): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c] || c);

const HTML_TAG_REGEX = /<\/?(b|strong|i|em|u|mark|span|ul|ol|li|p|br|div|h[1-6]|blockquote)(\s|>|\/)/i;

const sanitizeRichHtml = (raw: string = ''): string => {
  if (!raw) return '';
  const stripStyleProps = (styles: string) => {
    const cleaned = styles
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .filter((part) => !/^(font-size|font-family|line-height)\s*:/i.test(part));
    return cleaned.join('; ');
  };

  return raw
    // Normalize legacy <font> tags so export typography remains consistent.
    .replace(/<(\/?)font\b[^>]*>/gi, (_m, closing: string) => (closing ? '</span>' : '<span>'))
    .replace(/style="([^"]*)"/gi, (_, styles: string) => {
      const next = stripStyleProps(styles);
      return next ? `style="${next}"` : '';
    })
    .replace(/style='([^']*)'/gi, (_, styles: string) => {
      const next = stripStyleProps(styles);
      return next ? `style='${next}'` : '';
    });
};

// Preserve rich HTML; convert markdown for plain text
const renderInline = (txt: string = ''): string => {
  if (!txt) return '';
  if (HTML_TAG_REGEX.test(txt)) return sanitizeRichHtml(txt);
  return escapeHtml(txt)
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/__(.*?)__/g, '<u>$1</u>')
    .replace(/==(.*?)==/g, '<mark>$1</mark>')
    .replace(/\*(.*?)\*/g, '<i>$1</i>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/\n/g, '<br/>');
};

const wrap = (o: ExportOptions, body: string, extras: string = '') => `<!doctype html>
<html><head><meta charset="utf-8"/><style>${baseCss(o)}</style></head>
<body class="${o.visualStyle === 'flashcard' ? 'layout-flashcard' : ''}">
  ${o.watermark ? `<div class="watermark">${escapeHtml(o.watermark)}</div>` : ''}
  ${o.footerText ? `<div class="footer">${escapeHtml(o.footerText)} • ${new Date().toLocaleDateString()}</div>` : ''}
  <div class="paper">
    ${o.moduleName ? `<div class="module-label">${escapeHtml(o.moduleName)}</div>` : ''}
    <h1 class="cover">${escapeHtml(o.title)}</h1>
    ${o.headerText ? `<div class="header-bar"><span>${escapeHtml(o.headerText)}</span><span>${new Date().toLocaleDateString()}</span></div>` : `<div class="meta">Generated · ${new Date().toLocaleString()}</div>`}
    ${body}
    ${extras}
  </div>
</body></html>`;

// ---------- Helper: filter _explanations by institute filters ----------
const filterExplanationsByInstitute = (explanations: any[] | undefined, o: ExportOptions): any[] => {
  if (!Array.isArray(explanations)) return [];
  if (!o.instituteFilters || o.instituteFilters.length === 0) return explanations;
  const filterSet = new Set(o.instituteFilters.map((s: string) => s.toLowerCase().trim()));
  return explanations.filter((e: any) => filterSet.has((e.source || '').toLowerCase().trim()));
};

// ---------- Filtering & Sorting ----------

const normalize = (s: string = '') => s.toLowerCase().replace(/[^\w]/g, '').trim();

export const filterQuestions = (rows: ExportQuestion[], o: ExportOptions): ExportQuestion[] => {
  let out = [...rows];
  if (o.statusFilter && o.statusFilter !== 'all') {
    out = out.filter(q => {
      const attempted = !!q.selected_answer;
      if (o.statusFilter === 'correct') return attempted && q.is_correct === true;
      if (o.statusFilter === 'incorrect') return attempted && q.is_correct === false;
      if (o.statusFilter === 'unattempted') return !attempted;
      return true;
    });
  }
  if (o.revisionTags && o.revisionTags.length > 0) {
    const needles = o.revisionTags.map(normalize);
    out = out.filter(q => {
      const tags = (q.review_tags || []).map(normalize);
      return needles.some(n => tags.includes(n));
    });
  }
  if (o.pyqOnly) out = out.filter(q => !!q.is_pyq);
  if (o.ncertOnly) out = out.filter(q => !!q.is_ncert);

  if (o.subjectFilters && o.subjectFilters.length > 0) {
    const subjectSet = new Set(o.subjectFilters.map(normalize));
    out = out.filter((q) => subjectSet.has(normalize(q.subject || 'General')));
  }

  if (o.sectionGroupFilters && o.sectionGroupFilters.length > 0) {
    const sectionSet = new Set(o.sectionGroupFilters.map(normalize));
    out = out.filter((q) => sectionSet.has(normalize(q.section_group || 'General')));
  }

  if (o.microTopicFilters && o.microTopicFilters.length > 0) {
    const microSet = new Set(o.microTopicFilters.map(normalize));
    out = out.filter((q) => microSet.has(normalize(q.micro_topic || 'Other')));
  }

  if (o.yearStart != null || o.yearEnd != null) {
    const start = o.yearStart != null ? Number(o.yearStart) : -Infinity;
    const end = o.yearEnd != null ? Number(o.yearEnd) : Infinity;
    const minYear = Math.min(start, end);
    const maxYear = Math.max(start, end);
    out = out.filter((q) => {
      const year = Number(q.exam_year);
      if (!Number.isFinite(year)) return false;
      return year >= minYear && year <= maxYear;
    });
  }

  return out;
};

export const sortQuestions = (rows: ExportQuestion[], o: ExportOptions): ExportQuestion[] => {
  const out = [...rows];
  // Composable grouping levels take precedence (independent multi-select).
  // The presence of ANY grouping levels triggers hierarchical sort, regardless
  // of legacy o.sortBy. Filtering remains entirely separate.
  const lvls = o.groupingLevels || [];
  if (lvls.length > 0) {
    out.sort((a, b) => {
      for (const lvl of lvls) {
        const av =
          lvl === 'subject' ? (a.subject || '')
            : lvl === 'section_group' ? (a.section_group || '')
              : (a.micro_topic || '');
        const bv =
          lvl === 'subject' ? (b.subject || '')
            : lvl === 'section_group' ? (b.section_group || '')
              : (b.micro_topic || '');
        const cmp = av.localeCompare(bv);
        if (cmp !== 0) return cmp;
      }
      return String(a.exam_year || '').localeCompare(String(b.exam_year || ''));
    });
    return out;
  }
  switch (o.sortBy) {
    case 'subject':
      out.sort((a, b) => (a.subject || '').localeCompare(b.subject || '') || (a.micro_topic || '').localeCompare(b.micro_topic || ''));
      break;
    case 'microtopic':
      out.sort((a, b) => (a.micro_topic || '').localeCompare(b.micro_topic || ''));
      break;
    case 'difficulty': {
      const rank = (d?: string) => {
        const x = (d || '').toLowerCase();
        if (x.startsWith('e')) return 1;
        if (x.startsWith('m')) return 2;
        if (x.startsWith('h')) return 3;
        return 0;
      };
      out.sort((a, b) => rank(a.difficulty) - rank(b.difficulty));
      break;
    }
    case 'date':
      out.sort((a, b) => String(b.attempted_at || '').localeCompare(String(a.attempted_at || '')));
      break;
    case 'year':
      out.sort((a, b) => {
        const ay = Number(a.exam_year) || 0;
        const by = Number(b.exam_year) || 0;
        return by - ay;
      });
      break;
    case 'subject_section':
      out.sort((a, b) =>
        (a.subject || '').localeCompare(b.subject || '') ||
        (a.section_group || '').localeCompare(b.section_group || '')
      );
      break;
    case 'subject_section_microtopic':
      out.sort((a, b) =>
        (a.subject || '').localeCompare(b.subject || '') ||
        (a.section_group || '').localeCompare(b.section_group || '') ||
        (a.micro_topic || '').localeCompare(b.micro_topic || '') ||
        String(a.exam_year || '').localeCompare(String(b.exam_year || ''))
      );
      break;
    default:
      break;
  }
  return out;
};

// ---------- Questions ----------

/** Build hierarchy breadcrumb: Subject → Section → Microtopic */
const buildHierarchyBreadcrumb = (q: ExportQuestion): string => {
  const parts: string[] = [];
  if (q.subject) parts.push(escapeHtml(q.subject));
  if (q.section_group) parts.push(escapeHtml(q.section_group));
  if (q.micro_topic) parts.push(escapeHtml(q.micro_topic));
  if (parts.length === 0) return '';
  return `<div class="q-breadcrumb">${parts.join(' <span class="q-breadcrumb-arrow">→</span> ')}${q.is_ncert ? ' <span class="q-breadcrumb-chip">NCERT</span>' : ''}</div>`;
};

/** Build PYQ + chip bar (styled with SharedQuestionCard colors) */
const buildQuestionChips = (q: ExportQuestion, o: ExportOptions): string => {
  const chips: string[] = [];

  // PYQ chip using the proper categorization that matches SharedQuestionCard
  if (o.showPYQChips) {
    const pyqChip = getExportPyqChip(q);
    if (pyqChip) {
      const chipBg = pyqChip.isUPSC ? '#dcfce7' : pyqChip.isAllied ? '#fef9c3' : pyqChip.isOther ? '#f1f5f9' : '#ede9fe';
      const chipFg = pyqChip.isUPSC ? '#15803d' : pyqChip.isAllied ? '#a16207' : pyqChip.isOther ? '#475569' : '#7c3aed';
      chips.push(`<span class="pyq-chip" style="background:${chipBg};color:${chipFg}">${escapeHtml(pyqChip.label)}</span>`);
    }
  }

  if (chips.length === 0) return '';
  return `<div class="q-chip-bar">${chips.join('')}</div>`;
};

const renderQaLayoutBlock = (questionHtml: string, answerHtml: string, chipsHtml: string, o: ExportOptions): string => {
  if (o.qaLayoutMode === 'split') {
    const qBox = chipsHtml
      ? `<div class="qa-question-box"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="flex:1">${questionHtml}</div>${chipsHtml}</div></div>${answerHtml ? `<div class="qa-answer-box">${answerHtml}</div>` : ''}`
      : `<div class="qa-split-stack"><div class="qa-question-box">${questionHtml}</div>${answerHtml ? `<div class="qa-answer-box">${answerHtml}</div>` : ''}</div>`;
    return qBox;
  }
  const unifiedInner = chipsHtml
    ? `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="flex:1">${questionHtml}</div>${chipsHtml}</div>${answerHtml ? `<div class="qa-answer">${answerHtml}</div>` : ''}`
    : `<div class="qa-question">${questionHtml}</div>${answerHtml ? `<div class="qa-answer">${answerHtml}</div>` : ''}`;
  return `<div class="qa-unified">${unifiedInner}</div>`;
};

export const buildQuestionsHtml = (rowsRaw: ExportQuestion[], o: ExportOptions): string => {
  const rows = sortQuestions(filterQuestions(rowsRaw, o), o);

  const showOpts = o.contentScope !== 'q_only';
  const showExpl = o.contentScope === 'q_options_expl';
  const isFlashStyle = o.visualStyle === 'flashcard';
  const inline = isFlashStyle ? true : o.answerPlacement === 'inline';

  // Helper to render a single question item
  const renderQuestionItem = (q: ExportQuestion, i: number) => {
    const stem = q.question_text || q.statement || '';
    
    // Build chips bar for top-right of QA box (controlled by toggles)
    const chipsHtml = buildQuestionChips(q, o);

    const answer = o.hideResponses ? '' : (q.correct_answer || '').toUpperCase();
    
    // Build explanation: use merged explanations from all institutes if available, otherwise fall back to single explanation
    let explanation = '';
    if (!o.hideResponses) {
      // Check if this question has merged explanations from multiple institutes
      const explList = filterExplanationsByInstitute(q._explanations, o);
      if (Array.isArray(explList) && explList.length > 0) {
        // Render combined explanations from all institutes
        explanation = explList
          .map((expl: any) => {
            const source = expl.source || 'Unknown Source';
            const year = expl.year ? ` (${expl.year})` : '';
            const ans = expl.answer ? ` • Answer: ${expl.answer.toUpperCase()}` : '';
            const text = expl.text || expl.explanation || '';
            const header = `<strong>${escapeHtml(source)}${year}${ans}:</strong>`;
            return text ? `${header}<br/>${renderInline(text)}` : header;
          })
          .join('<br/><br/>---<br/><br/>');
      } else {
        // Fall back to single explanation
        explanation = q.explanation_markdown || q.explanation || '';
      }
    }

    const optsBlock = showOpts && q.options ? (() => {
      const opts = q.options!;
      const correctAnswer = (q.correct_answer || '').toLowerCase();
      const selectedAnswer = (q.selected_answer || '').toLowerCase();
      const showColors = o.showMyResponses && !o.hideResponses;
      
      return `<ul class="opts">${['a', 'b', 'c', 'd'].filter(k => (opts as any)[k]).map(k => {
        const label = k.toUpperCase();
        let className = '';
        
        if (showColors) {
          // When showing responses, highlight user's choice and correct answer
          if (k === correctAnswer) {
            className = 'correct'; // Mark correct answer in green
          }
          if (k === selectedAnswer && selectedAnswer !== correctAnswer) {
            className = 'wrong'; // Mark user's incorrect choice in red
          }
          if (k === selectedAnswer && selectedAnswer === correctAnswer) {
            className = 'correct'; // If user selected correct answer, mark in green
          }
        }
        
        return `<li class="${className}"><b>${label}.</b> ${renderInline(String((opts as any)[k]))}</li>`;
      }).join('')}</ul>`;
    })() : '';

    const metricsBlock = (o.includePerformanceMetrics && !o.hideResponses)
      ? `${q.time_taken_seconds ? `<span class="metrics">⏱ ${q.time_taken_seconds}s</span>` : ''}${q.is_correct === true ? '<span class="metrics">✓ Correct</span>' : q.is_correct === false ? '<span class="metrics">✗ Incorrect</span>' : q.selected_answer ? '' : '<span class="metrics">— Skipped</span>'}`
      : '';

    const questionBlock = `
      <div class="qstem"><span class="qnum">${i + 1}.</span>${renderInline(stem)}${metricsBlock}</div>
      ${o.showMetaChips ? buildHierarchyBreadcrumb(q) : ''}
      ${optsBlock}
    `;

    const answerBlock = `
      ${inline && showOpts && answer ? `<div class="ans">Answer: ${answer}</div>` : ''}
      ${inline && showExpl && explanation ? `<div class="expl">${renderInline(explanation)}</div>` : ''}
    `.trim();

    if (isFlashStyle) {
      const right = answerBlock || `<div class="expl">Answer/explanation hidden for this card.</div>`;
      return `<div class="card">
        <div class="side"><div class="card-face-label">Question</div>${chipsHtml}${questionBlock}</div>
        <div class="side"><div class="card-face-label">Answer & Explanation</div>${right}</div>
      </div>`;
    }
    return `<div class="item">${renderQaLayoutBlock(questionBlock, answerBlock, chipsHtml, o)}</div>`;
  };

  // ── Hierarchical grouping for subject-based sorts ──
  // Composable grouping levels (multi-select, independent of sortBy) take
  // precedence and drive the hierarchy. Falls back to legacy o.sortBy.
  const lvls = o.groupingLevels || [];
  const hasSubject = lvls.includes('subject');
  const hasSection = lvls.includes('section_group');
  const hasMicro = lvls.includes('microtopic');
  const needsGrouping =
    lvls.length > 0
      ? hasSubject || hasSection || hasMicro
      : ['subject', 'subject_section', 'subject_section_microtopic'].includes(o.sortBy);
  // Legacy mapping for the rendering paths below
  const renderLevel: 'subject' | 'subject_section' | 'subject_section_microtopic' =
    lvls.length > 0
      ? (hasMicro ? 'subject_section_microtopic' : hasSection ? 'subject_section' : 'subject')
      : (o.sortBy === 'subject_section' ? 'subject_section'
        : o.sortBy === 'subject_section_microtopic' ? 'subject_section_microtopic'
          : 'subject');

  if (needsGrouping) {
    // Build grouped structure: Subject → Section Group → Microtopic → Questions
    const groups: Map<string, Map<string, Map<string, ExportQuestion[]>>> = new Map();
    rows.forEach(q => {
      const sub = q.subject || 'General';
      const sec = q.section_group || 'General';
      const mic = q.micro_topic || 'Other';
      if (!groups.has(sub)) groups.set(sub, new Map());
      const secMap = groups.get(sub)!;
      if (!secMap.has(sec)) secMap.set(sec, new Map());
      const micMap = secMap.get(sec)!;
      if (!micMap.has(mic)) micMap.set(mic, []);
      micMap.get(mic)!.push(q);
    });

    // TOC with hierarchy
    const tocItems: string[] = [];
    groups.forEach((secMap, sub) => {
      tocItems.push(`<div class="toc-item" style="font-weight:800">${escapeHtml(sub)}</div>`);
      if (renderLevel !== 'subject') {
        secMap.forEach((micMap, sec) => {
          tocItems.push(`<div class="toc-item" style="padding-left:12px">${escapeHtml(sec)}</div>`);
        });
      }
    });
    const tocHtml = o.showTOC && tocItems.length > 0 ? `
      <div class="toc">
        <div class="toc-title">Table of Contents</div>
        ${tocItems.join('')}
      </div>` : '';

    // Render grouped HTML with headings
    let globalIdx = 0;
    const sectionsHtml: string[] = [];

    groups.forEach((secMap, sub) => {
      sectionsHtml.push(`<h1 style="color:var(--accent);font-size:${o.fontSize + 6}pt;font-weight:900;margin:8mm 0 4mm 0;border-bottom:2px solid var(--accent);padding-bottom:2mm">${escapeHtml(sub)}</h1>`);

      if (renderLevel === 'subject') {
        // Flat list under subject heading
        secMap.forEach((micMap) => {
          micMap.forEach((questions) => {
            questions.forEach(q => {
              sectionsHtml.push(renderQuestionItem(q, globalIdx++));
            });
          });
        });
      } else {
        secMap.forEach((micMap, sec) => {
          sectionsHtml.push(`<h2 style="color:var(--fg);font-size:${o.fontSize + 3}pt;font-weight:800;margin:6mm 0 3mm 0;opacity:0.85">${escapeHtml(sec)}</h2>`);

          if (renderLevel === 'subject_section') {
            // Flat list under section heading
            micMap.forEach((questions) => {
              questions.forEach(q => {
                sectionsHtml.push(renderQuestionItem(q, globalIdx++));
              });
            });
          } else {
            // subject_section_microtopic — full 3-level hierarchy
            micMap.forEach((questions, mic) => {
              sectionsHtml.push(`<h3 style="color:var(--accent);font-size:${o.fontSize + 1}pt;font-weight:700;margin:4mm 0 2mm 2mm;opacity:0.75">${escapeHtml(mic)}</h3>`);
              questions.forEach(q => {
                sectionsHtml.push(renderQuestionItem(q, globalIdx++));
              });
            });
          }
        });
      }
    });

    // Answer key appendix
    const answerKey = !isFlashStyle && !inline && !o.hideResponses && (o.contentScope !== 'q_only')
      ? `<div class="answer-key">
          <h2>Answer Key${showExpl ? ' & Explanations' : ''}</h2>
          ${rows.map((q, i) => {
        const a = (q.correct_answer || '').toUpperCase();
        // Use merged explanations if available, otherwise fall back to single explanation
        let e = '';
        const explList = filterExplanationsByInstitute(q._explanations, o);
        if (explList.length > 0) {
          e = explList
            .map((expl: any) => {
              const source = expl.source || 'Unknown Source';
              const year = expl.year ? ` (${expl.year})` : '';
              const ans = expl.answer ? ` • Answer: ${expl.answer.toUpperCase()}` : '';
              const text = expl.text || expl.explanation || '';
              const header = `<strong>${escapeHtml(source)}${year}${ans}:</strong>`;
              return text ? `${header}<br/>${renderInline(text)}` : header;
            })
            .join('<br/><br/>---<br/><br/>');
        } else {
          e = q.explanation_markdown || q.explanation || '';
        }
        return `<div class="ak-row">
              <span class="ak-num">${i + 1}.</span>${a ? `<b>Ans: ${a}</b>` : ''}
              ${showExpl && e ? `<div class="expl" style="margin-top:1mm">${renderInline(e)}</div>` : ''}
            </div>`;
      }).join('')}
        </div>`
      : '';

    return wrap(o, `${tocHtml}<div class="cols">${sectionsHtml.join('')}</div>`, answerKey);
  }

  // ── Flat rendering for non-subject sorts ──
  const subjectsUsed: string[] = [];
  rows.forEach(r => {
    const s = r.subject || 'General';
    if (!subjectsUsed.includes(s)) subjectsUsed.push(s);
  });
  const tocHtml = o.showTOC && subjectsUsed.length > 0 ? `
    <div class="toc">
      <div class="toc-title">Table of Contents</div>
      ${subjectsUsed.map(s => `<div class="toc-item">${escapeHtml(s)}</div>`).join('')}
    </div>` : '';

  const itemsHtml = rows.map((q, i) => renderQuestionItem(q, i)).join('');

  // Answer key appendix if not inline
  const answerKey = !isFlashStyle && !inline && !o.hideResponses && (o.contentScope !== 'q_only')
    ? `<div class="answer-key">
        <h2>Answer Key${showExpl ? ' & Explanations' : ''}</h2>
        ${rows.map((q, i) => {
      const a = (q.correct_answer || '').toUpperCase();
      // Use merged explanations if available, otherwise fall back to single explanation
      let e = '';
      const explList = filterExplanationsByInstitute(q._explanations, o);
      if (explList.length > 0) {
        e = explList
          .map((expl: any) => {
            const source = expl.source || 'Unknown Source';
            const year = expl.year ? ` (${expl.year})` : '';
            const ans = expl.answer ? ` • Answer: ${expl.answer.toUpperCase()}` : '';
            const text = expl.text || expl.explanation || '';
            const header = `<strong>${escapeHtml(source)}${year}${ans}:</strong>`;
            return text ? `${header}<br/>${renderInline(text)}` : header;
          })
          .join('<br/><br/>---<br/><br/>');
      } else {
        e = q.explanation_markdown || q.explanation || '';
      }
      return `<div class="ak-row">
            <span class="ak-num">${i + 1}.</span>${a ? `<b>Ans: ${a}</b>` : ''}
            ${showExpl && e ? `<div class="expl" style="margin-top:1mm">${renderInline(e)}</div>` : ''}
          </div>`;
    }).join('')}
      </div>`
    : '';

  return wrap(o, `${tocHtml}<div class="cols">${itemsHtml}</div>`, answerKey);
};

// ---------- Flashcards ----------

export const buildFlashcardsHtml = (rows: ExportFlashcard[], o: ExportOptions): string => {
  const qaBg = o.qaBackgroundColor || 'transparent';
  const qBg = o.qaQuestionBackgroundColor || qaBg;
  const aBg = o.qaAnswerBackgroundColor || qaBg;
  const boxBg = o.qaLayoutMode === 'split' ? qBg : qaBg;
  const answerBoxBg = o.qaLayoutMode === 'split' ? aBg : qaBg;
  const anyBgVisible = boxBg !== 'transparent' || answerBoxBg !== 'transparent';
  const cardBorder = anyBgVisible ? 'rgba(15, 23, 42, 0.12)' : 'var(--rule)';

  const cards = rows.map(c => `
    <div class="card" style="background:${boxBg};border-color:${cardBorder}">
      <div class="side" style="${o.qaLayoutMode === 'split' ? `background:${qBg};` : ''}border-right-color:${cardBorder}"><div style="font-size:${o.fontSize - 3}pt;font-weight:800;color:var(--accent);letter-spacing:1px;margin-bottom:1mm">FRONT</div><div>${renderInline(c.front)}</div></div>
      <div class="side" style="${o.qaLayoutMode === 'split' ? `background:${aBg};` : ''}border-right:none"><div style="font-size:${o.fontSize - 3}pt;font-weight:800;color:var(--accent);letter-spacing:1px;margin-bottom:1mm">BACK</div><div>${renderInline(c.back)}</div>${c.state ? `<div style="margin-top:2mm"><span class="card-state">${c.state}</span></div>` : ''}</div>
    </div>`).join('');
  return wrap(o, cards);
};

// ---------- Notes ----------

export const buildNotesBlocksHtml = (blocks: ExportNoteBlock[], o: ExportOptions, selectedHeadingIds?: Set<string>): string => {
  const selected = selectedHeadingIds && selectedHeadingIds.size > 0 ? selectedHeadingIds : null;
  const headingBg = o.notesSubheadingColor || '#f3f4f6';
  const includeChecklist = !!o.notesChecklistMode;

  let currentHeading = '';
  let isRendering = true;
  const filtered = blocks.filter((b) => {
    if (b.type === 'microTopicHeading') {
      currentHeading = b.id;
      isRendering = selected ? selected.has(b.id) : true;
      return isRendering;
    }
    if (!currentHeading) return true;
    return isRendering;
  }).filter((b) => includeChecklist || b.type !== 'checklist');

  const toc = o.showTOC
    ? `<div class="toc"><div class="toc-title">Table of Contents</div>${filtered.filter((f) => f.type === 'microTopicHeading').map((h) => `<div class="toc-item">${renderInline(h.text)}</div>`).join('')}</div>`
    : '';

  const body = filtered.map((b) => {
    if (b.type === 'microTopicHeading') {
      return `<div class="microheading" style="background:${headingBg}">${renderInline(b.text)}</div>`;
    }

    if (b.type === 'checklist') {
      return `<div class="note" style="display:flex;align-items:flex-start;gap:8px;border-left-color:${b.color || 'var(--accent)'}">
        <span style="width:16px;height:16px;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;border:1px solid #94a3b8;border-radius:3px;background:${b.checked ? '#6366f1' : 'transparent'};color:#fff;font-size:${o.fontSize - 3}pt;line-height:1">${b.checked ? '✓' : ''}</span>
        <div style="flex:1;${b.checked ? 'text-decoration:line-through;opacity:0.65;' : ''}">${renderInline(b.text)}</div>
      </div>`;
    }

    return `<div class="note" style="border-left-color:${b.color || 'var(--accent)'}">${renderInline(b.text)}${b.sourceLabel ? `<div style="font-size:${o.fontSize - 4}pt;font-weight:700;color:var(--accent);margin-top:2mm;text-transform:uppercase;letter-spacing:0.5px">${escapeHtml(b.sourceLabel)}</div>` : ''}</div>`;
  }).join('');

  return wrap(o, `${toc}<div class="cols">${body}</div>`);
};

// ---------- Tags ----------

export const buildTagsHtml = (groups: { tag: string; questions: ExportQuestion[] }[], o: ExportOptions): string => {
  const toc = o.showTOC
    ? `<div class="toc"><div class="toc-title">Table of Contents</div>${groups.map(g => `<div class="toc-item">#${escapeHtml(g.tag)} (${g.questions.length})</div>`).join('')}</div>`
    : '';

  const showOpts = o.contentScope !== 'q_only';
  const showExpl = o.contentScope === 'q_options_expl';
  const isFlashStyle = o.visualStyle === 'flashcard';
  const inline = isFlashStyle ? true : o.answerPlacement === 'inline';

  const sections = groups.map(g => {
    const rows = sortQuestions(filterQuestions(g.questions, o), o);
    const items = rows.map((q, i) => {
      const stem = q.question_text || q.statement || '';
      
      // Build chips using the same engine as buildQuestionsHtml
      const chipsHtml = buildQuestionChips(q, o);
      
      const answer = (q.correct_answer || '').toUpperCase();
      // Use merged explanations if available
      let explanation = '';
      if (Array.isArray(q._explanations) && q._explanations.length > 0) {
        explanation = q._explanations
          .map((expl: any) => {
            const source = expl.source || 'Unknown Source';
            const year = expl.year ? ` (${expl.year})` : '';
            const ans = expl.answer ? ` • Answer: ${expl.answer.toUpperCase()}` : '';
            const text = expl.text || expl.explanation || '';
            const header = `<strong>${escapeHtml(source)}${year}${ans}:</strong>`;
            return text ? `${header}<br/>${renderInline(text)}` : header;
          })
          .join('<br/><br/>---<br/><br/>');
      } else {
        explanation = q.explanation_markdown || q.explanation || '';
      }
      // Apply response coloring if enabled
      const correctAnswer = (q.correct_answer || '').toLowerCase();
      const selectedAnswer = (q.selected_answer || '').toLowerCase();
      const showColors = o.showMyResponses && !o.hideResponses;
      
      const optsBlock = showOpts && q.options ? `<ul class="opts">${['a', 'b', 'c', 'd'].filter(k => (q.options as any)[k]).map(k => {
        let className = '';
        if (showColors) {
          // When showing responses, highlight user's choice and correct answer
          if (k === correctAnswer) {
            className = 'correct'; // Mark correct answer in green
          }
          if (k === selectedAnswer && selectedAnswer !== correctAnswer) {
            className = 'wrong'; // Mark user's incorrect choice in red
          }
          if (k === selectedAnswer && selectedAnswer === correctAnswer) {
            className = 'correct'; // If user selected correct answer, mark in green
          }
        }
        return `<li class="${className}"><b>${k.toUpperCase()}.</b> ${renderInline(String((q.options as any)[k]))}</li>`;
      }).join('')}</ul>` : '';
      const questionBlock = `
        <div class="qstem"><span class="qnum">${i + 1}.</span>${renderInline(stem)}</div>
        ${optsBlock}
      `;
      const answerBlock = `
        ${inline && showOpts && answer ? `<div class="ans">Answer: ${answer}</div>` : ''}
        ${inline && showExpl && explanation ? `<div class="expl">${renderInline(explanation)}</div>` : ''}
      `.trim();
      if (isFlashStyle) {
        const right = answerBlock || `<div class="expl">Answer/explanation hidden for this card.</div>`;
        return `<div class="card">
        <div class="side"><div class="card-face-label">Question</div>${chipsHtml}${questionBlock}</div>
        <div class="side"><div class="card-face-label">Answer & Explanation</div>${right}</div>
      </div>`;
      }
      return `<div class="item">${renderQaLayoutBlock(questionBlock, answerBlock, chipsHtml, o)}</div>`;
    }).join('');
    return `<div class="tag-section">
      <div class="tag-title">#${escapeHtml(g.tag)} <span style="font-weight:500;opacity:0.7">(${rows.length})</span></div>
      <div class="cols">${items}</div>
    </div>`;
  }).join('');

  // Appendix answer key (if placement === 'end')
  const answerKey = !isFlashStyle && !inline && showOpts
    ? `<div class="answer-key">
        <h2>Answer Key${showExpl ? ' & Explanations' : ''}</h2>
        ${groups.flatMap((g, gi) => g.questions.map((q, i) => {
      const a = (q.correct_answer || '').toUpperCase();
      // Use merged explanations if available
      let e = '';
      if (Array.isArray(q._explanations) && q._explanations.length > 0) {
        e = q._explanations
          .map((expl: any) => {
            const source = expl.source || 'Unknown Source';
            const year = expl.year ? ` (${expl.year})` : '';
            const ans = expl.answer ? ` • Answer: ${expl.answer.toUpperCase()}` : '';
            const text = expl.text || expl.explanation || '';
            const header = `<strong>${escapeHtml(source)}${year}${ans}:</strong>`;
            return text ? `${header}<br/>${renderInline(text)}` : header;
          })
          .join('<br/><br/>---<br/><br/>');
      } else {
        e = q.explanation_markdown || q.explanation || '';
      }
      return `<div class="ak-row"><span class="ak-num">#${escapeHtml(g.tag)} · ${i + 1}.</span>${a ? `<b>Ans: ${a}</b>` : ''}${showExpl && e ? `<div class="expl" style="margin-top:1mm">${renderInline(e)}</div>` : ''}</div>`;
    })).join('')}
      </div>`
    : '';

  return wrap(o, `${toc}${sections}`, answerKey);
};

// ---------- Hardnote (Skia canvas) ----------

/**
 * Convert a stroke's point series to an SVG path `d` attribute using the
 * same midpoint-quadratic smoothing used by the on-device Skia canvas.
 * Keeps the exported PDF visually identical to what the user sees.
 */
const hardnoteStrokeToSvgPath = (pts: ExportHardnoteStrokePoint[]): string => {
  if (!pts.length) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const p = pts[i];
    const mx = (prev.x + p.x) / 2;
    const my = (prev.y + p.y) / 2;
    d += ` Q ${prev.x.toFixed(2)} ${prev.y.toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`;
  return d;
};

export const buildHardnoteHtml = (note: ExportHardnote, o: ExportOptions): string => {
  const W = note.canvasWidth || 800;
  const H = note.canvasHeight || 1200;

  const strokesSvg = (note.strokes || [])
    .filter((s) => s && s.tool !== 'eraser' && s.points?.length > 0)
    .map((s) => {
      // No Y-axis adjustment — strokes are rendered at their exact
      // coordinates which already match the SVG viewBox / foreignObject
      // coordinate system.  The previous -fontSize*6.5 hack was causing
      // strokes to shift vertically in every exported PDF.
      const d = hardnoteStrokeToSvgPath(s.points);
      if (!d) return '';
      const avgP = s.points.reduce((a, p) => a + (p.p ?? 0.5), 0) / s.points.length;
      const isHL = s.tool === 'highlighter';
      const width = isHL ? s.width * 1.8 : s.width * (0.5 + 0.5 * avgP);
      const opacity = isHL ? s.opacity ?? 0.35 : 1;
      const mix = isHL ? 'multiply' : 'normal';
      return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" style="mix-blend-mode:${mix}"/>`;
    })
    .join('');

  const breadcrumb = (note.breadcrumb || []).filter(Boolean);
  const crumbLine = breadcrumb.length
    ? `<div class="hn-crumb">${breadcrumb.map((c) => escapeHtml(c)).join(' › ')}</div>`
    : '';

  const updated = note.updatedAt ? new Date(note.updatedAt).toLocaleString() : '';
  const strokeCount = (note.strokes || []).filter((s) => s.tool !== 'eraser').length;

  const hasMeta = Boolean(crumbLine || updated || note.subject || strokeCount);
  const meta = hasMeta
    ? `<div class="hn-meta">
         ${crumbLine}
         <div class="hn-stats">
           ${strokeCount > 0 ? `<span class="hn-pill-soft">${strokeCount} strokes</span>` : ''}
           ${note.subject ? `<span class="hn-pill-soft">${escapeHtml(note.subject)}</span>` : ''}
           ${updated ? `<span class="hn-pill-soft">Updated ${escapeHtml(updated)}</span>` : ''}
         </div>
       </div>`
    : '';

  // Pencil strokes and the markdown body are rendered INSIDE the same
  // SVG via <foreignObject>, so both share the W×H coordinate space.
  // Strokes paint pixel-accurately on top of the words they were drawn on.
  // We grow the viewBox height beyond `canvasHeight` when a stroke endpoint
  // extends below it, so the auto-flowing markdown is never clipped.
  let strokeMaxY = 0;
  for (const s of note.strokes || []) {
    if (!s || s.tool === 'eraser' || !s.points?.length) continue;
    for (const p of s.points) if (p.y > strokeMaxY) strokeMaxY = p.y;
  }
  const Hgrow = Math.max(H, Math.ceil(strokeMaxY + 80));

  const baseLayerInner = note.baseLayerMarkdown
    ? renderInline(note.baseLayerMarkdown)
    : '';

  const body = `
    ${meta}
    <div class="hn-stack">
      <svg class="hn-stack-svg" viewBox="0 0 ${W} ${Hgrow}" width="100%" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">
        <foreignObject x="0" y="0" width="${W}" height="${Hgrow}">
          <div xmlns="http://www.w3.org/1999/xhtml" class="hn-base-body">${baseLayerInner}</div>
        </foreignObject>
        ${strokesSvg}
      </svg>
    </div>
  `;

  const extraCss = `
    .hn-meta { display:flex; flex-direction:column; gap:2mm; margin-bottom:4mm; }
    .hn-crumb { font-size:9pt; font-weight:800; letter-spacing:0.5px; text-transform:uppercase; color:var(--muted); }
    .hn-stats { display:flex; gap:3mm; flex-wrap:wrap; }
    .hn-pill-soft { font-size:8pt; font-weight:700; padding:1mm 3mm; border-radius:4mm; background:var(--rule); color:var(--fg); }
    .hn-stack { position:relative; width:100%; background:transparent; margin:0; padding:0; }
    .hn-stack-svg { display:block; width:100%; height:auto; overflow:visible; background:transparent; margin:0; padding:0; }
    .hn-base-body {
      width:100%; box-sizing:border-box;
      font-size:${o.fontSize}pt; line-height:1.45;
      color:var(--fg); background:transparent;
      font-family:${fontFamilyCss[o.fontFamily]};
      margin:0; padding:0;
      display:flex; flex-direction:column; gap:0;
    }
    .hn-base-body p, .hn-base-body div, .hn-base-body ul, .hn-base-body ol, .hn-base-body blockquote { 
      margin:0; padding:0; line-height:1.45; 
    }
    .hn-base-body h1, .hn-base-body h2, .hn-base-body h3, .hn-base-body h4, .hn-base-body h5, .hn-base-body h6 { 
      margin:0; padding:0; line-height:1.4; 
    }
  `;

  return wrap(
    o,
    `<style>${extraCss}</style>${body}`
  );
};

export const buildSnapshotHtml = (
  payload: { base64: string; pageWidth: number; pageHeight: number; title: string },
  o: ExportOptions
): string => {
  const rawW = payload.pageWidth > 0 ? payload.pageWidth : 794;
  const rawH = payload.pageHeight > 0 ? payload.pageHeight : 1123;

  // Calculate content area ratio factoring in margins
  // Standard A4: 21cm x 29.7cm.
  const mTop = clampCm(o.pageMarginTopCm);
  const mBottom = clampCm(o.pageMarginBottomCm);
  const mLeft = clampCm(o.pageMarginLeftCm);
  const mRight = clampCm(o.pageMarginRightCm);
  const contentW = 21 - mLeft - mRight;
  const contentH = 29.7 - mTop - mBottom;
  // Force contentH explicitly or default to safe ratio if clamped strangely
  const pdfPageRatio = contentW > 0 ? contentH / contentW : 1.4142;

  const viewRatio = rawH / rawW;
  // Total pages needed to fit the snapshot
  const numPages = Math.max(1, Math.ceil(viewRatio / pdfPageRatio));

  // Clean Base64 against whitespace errors
  const cleanBase64 = (payload.base64 || '').replace(/\s/g, '');

  // Build segmented pages. We use the image nested in a viewport container.
  // Shifting it by -100% container height each iteration correctly aligns subsequent segments.
  let html = '';
  for (let i = 0; i < numPages; i++) {
    html += `
      <div class="snapshot-page-slice">
        <img src="data:image/png;base64,${cleanBase64}" class="slice-img" style="top: -${i * 100}%;" />
      </div>
    `;
  }

  const extraCss = `
    .snapshot-page-slice {
      position: relative;
      width: 100%;
      /* Aspect ratio force height */
      padding-top: ${pdfPageRatio * 100}%;
      overflow: hidden;
      page-break-after: always;
      background: #fff;
      margin: 0;
    }
    .slice-img {
      position: absolute;
      left: 0;
      width: 100%;
      /* Natural flow dictates image will stretch taller than container, which is what we want */
      height: auto; 
    }
    /* For high fidelity export, hide standard title/headers that would displace slice 1 */
    h1.cover, .header-bar, .meta { display: none !important; }
    /* Reset outer paper constraints */
    .paper { padding: 0 !important; }
  `;

  return wrap(
    o,
    `<style>${extraCss}</style>${html}`
  );
};

export type PyqHeatmapPalette = 'spectral' | 'ocean';

export interface PyqHeatmapRow {
  key?: string;
  label: string;
  byYear: Record<string, number>;
}

export interface BuildPyqAnalysisSummaryInput {
  selectedReports: Record<string, boolean>;
  examStage: string;
  selectedPaper: string;
  selectedRange: string;
  customYearStart?: string;
  customYearEnd?: string;
  questionCount: number;
  years: string[];
  distributionData: Array<{ name: string; value: number }>;
  overviewSeries: Array<{ label: string; values: number[]; color?: string }>;
  focusTrendSeries: Array<{ label: string; values: number[]; color?: string }>;
  focusSubject: string;
  focusSection: string;
  focusMicro: string;
  subjectHeatmapRows: PyqHeatmapRow[];
  topicHeatmapRows: PyqHeatmapRow[];
  heatmapPalette: PyqHeatmapPalette;
  momentumTitle?: string;
  distributionTitle?: string;
  focusedTitle?: string;
  primaryHeatmapTitle?: string;
  primaryHeatmapLabel?: string;
  secondaryHeatmapTitle?: string;
  secondaryHeatmapLabel?: string;
  /**
   * Optional Forecast (Predictive Insights) data — when supplied and
   * `selectedReports.forecast` (or `full_report`) is true, an executive
   * summary section listing probable hot topics, rising topics and the
   * frequency-weighted importance leaderboard is appended to the report.
   */
  forecastRows?: Array<{
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
  forecastTitle?: string;
}

const normalizeHex = (value: string | undefined, fallback = '#2563EB'): string => {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return fallback;
};

const escHtml = (value: string | number) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const hslToHex = (h: number, s: number, l: number): string => {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s));
  const ll = Math.max(0, Math.min(100, l));
  const c = (1 - Math.abs(2 * ll / 100 - 1)) * (ss / 100);
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll / 100 - c / 2;
  let r = 0, g = 0, b = 0;

  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else[r, g, b] = [c, 0, x];

  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
};

const renderPyqLineChartSvg = (
  title: string,
  labels: string[],
  series: Array<{ label: string; values: number[]; color?: string }>,
) => {
  if (!labels.length || !series.length) return '';
  const widthSvg = 980;
  const heightSvg = 320;
  const leftPad = 56;
  const rightPad = 24;
  const topPad = 26;
  const bottomPad = 56;
  const plotW = widthSvg - leftPad - rightPad;
  const plotH = heightSvg - topPad - bottomPad;
  const maxValue = Math.max(...series.flatMap((item) => item.values), 1);
  const x = (index: number) => leftPad + (labels.length === 1 ? 0 : (index * plotW) / (labels.length - 1));
  const y = (value: number) => topPad + plotH - (value / maxValue) * plotH;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const yy = topPad + plotH - step * plotH;
    const val = Math.round(maxValue * step);
    return `<line x1="${leftPad}" y1="${yy}" x2="${widthSvg - rightPad}" y2="${yy}" stroke="#E2E8F0" stroke-width="1" fill="none" fill-opacity="1" />
            <text x="${leftPad - 8}" y="${yy + 4}" text-anchor="end" font-size="10" fill="#64748B" fill-opacity="1">${val}</text>`;
  }).join('');

  const seriesSvg = series.map((item, idx) => {
    const color = normalizeHex(item.color, idx % 2 === 0 ? '#2563EB' : '#0EA5E9');
    const points = item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    const dots = item.values
      .map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="${color}" fill-opacity="1" stroke="#FFFFFF" stroke-width="1" />`)
      .join('');
    return `<polyline fill="none" fill-opacity="1" stroke="${color}" stroke-width="3" points="${points}"/>${dots}`;
  }).join('');

  const xLabels = labels
    .map((label, index) => `<text x="${x(index)}" y="${heightSvg - 18}" text-anchor="middle" font-size="10" fill="#475569" fill-opacity="1">${escHtml(label)}</text>`)
    .join('');

  const legend = series.map((item, idx) => {
    const color = normalizeHex(item.color, idx % 2 === 0 ? '#2563EB' : '#0EA5E9');
    return `<span class="legend-item"><span class="legend-dot" style="background:${color}"></span>${escHtml(item.label)}</span>`;
  }).join('');

  return `
    <section class="analysis-card">
      <h3>${escHtml(title)}</h3>
      <div class="legend-wrap">${legend}</div>
      <div class="analysis-chart">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${widthSvg} ${heightSvg}" width="100%" height="${heightSvg}">
          <rect x="${leftPad}" y="${topPad}" width="${plotW}" height="${plotH}" fill="#FFFFFF" fill-opacity="1" stroke="#E2E8F0" stroke-width="1" />
          ${gridLines}
          ${seriesSvg}
          ${xLabels}
        </svg>
      </div>
    </section>
  `;
};

const renderPyqDonutSvg = (title: string, rows: Array<{ name: string; value: number }>) => {
  if (!rows.length) return '';
  const palette = ['#2563EB', '#14B8A6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#84CC16'];
  const topRows = rows.slice(0, 8);
  const rest = rows.slice(8).reduce((sum, item) => sum + item.value, 0);
  const compact = [...topRows];
  if (rest > 0) compact.push({ name: 'Others', value: rest });
  const total = Math.max(compact.reduce((sum, item) => sum + item.value, 0), 1);
  const radius = 66;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  const segments = compact.map((item, index) => {
    const color = normalizeHex(palette[index % palette.length], '#2563EB');
    const len = (item.value / total) * circumference;
    const segment = `<circle cx="90" cy="90" r="${radius}" fill="none" fill-opacity="1" stroke="${color}" stroke-width="34" stroke-dasharray="${len} ${circumference}" stroke-dashoffset="${-cumulative}" transform="rotate(-90 90 90)"/>`;
    cumulative += len;
    return segment;
  }).join('');

  const legend = compact.map((item, index) => {
    const color = normalizeHex(palette[index % palette.length], '#2563EB');
    return `<div class="donut-legend-row"><span class="donut-legend-dot" style="background:${color}"></span><span>${escHtml(item.name)}</span><strong>${item.value}</strong></div>`;
  }).join('');

  return `
    <section class="analysis-card">
      <h3>${escHtml(title)}</h3>
      <div class="donut-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" width="200" height="200">
          <circle cx="90" cy="90" r="${radius}" fill="none" fill-opacity="1" stroke="#E2E8F0" stroke-width="34"/>
          ${segments}
          <text x="90" y="86" text-anchor="middle" font-size="18" font-weight="700" fill="#0F172A" fill-opacity="1">${total}</text>
          <text x="90" y="104" text-anchor="middle" font-size="10" fill="#64748B" fill-opacity="1">QUESTIONS</text>
        </svg>
        <div class="donut-legend">${legend}</div>
      </div>
    </section>
  `;
};

const renderPyqHeatmapSvg = (
  title: string,
  labelHeader: string,
  rows: PyqHeatmapRow[],
  years: string[],
  palette: PyqHeatmapPalette,
) => {
  if (!rows.length) return '';
  return `
    <section class="analysis-card">
      <h3>${escHtml(title)}</h3>
      <table class="analysis-heatmap-table">
        <thead><tr><th>${escHtml(labelHeader)}</th>${years.map((year) => `<th>${escHtml(year)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>${escHtml(row.label)}</td>
              ${years.map((year) => {
    const count = row.byYear[year] || 0;
    let bg = '#F8FAFC';
    let tc = '#94A3B8';
    if (count > 0) {
      const capped = Math.min(count, 22);
      const ratio = (capped - 1) / 21;
      if (palette === 'spectral') {
        const h = 70 + (ratio * 155);
        const s = 65 + (ratio * 20);
        const l = 85 - (ratio * 55);
        bg = hslToHex(h, s, l);
        tc = l < 55 ? '#FFFFFF' : '#065F46';
      } else {
        const h = 210 + (ratio * 15);
        const s = 60 + (ratio * 35);
        const l = 90 - (ratio * 65);
        bg = hslToHex(h, s, l);
        tc = l < 55 ? '#FFFFFF' : '#1E3A8A';
      }
    }

    return `<td style="padding: 1px; border: none; width: 44px; height: 32px;">
                  <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg">
                    <rect width="44" height="32" rx="5" fill="${normalizeHex(bg, '#F8FAFC')}" fill-opacity="1" />
                    <text x="22" y="20.5" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="800" fill="${normalizeHex(tc, '#0F172A')}" fill-opacity="1">${count || ''}</text>
                  </svg>
                </td>`;
  }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `;
};

const renderPyqForecastSection = (
  title: string,
  rows: Array<{
    key: string;
    label: string;
    totalQuestions: number;
    streak: number;
    trend: 'rising' | 'falling' | 'stable';
    forecastPoint: number;
    forecastLow: number;
    forecastHigh: number;
    hotScore: number;
  }>,
) => {
  if (!rows.length) return '';
  const trendColor: Record<string, string> = {
    rising: '#15803D',
    falling: '#B91C1C',
    stable: '#475569',
  };
  const trendBg: Record<string, string> = {
    rising: '#DCFCE7',
    falling: '#FEE2E2',
    stable: '#E5E7EB',
  };
  const body = rows.map((r, i) => `
    <tr>
      <td style="text-align:center;color:#94A3B8;font-weight:800;">${i + 1}</td>
      <td><strong>${escHtml(r.label || r.key)}</strong></td>
      <td style="text-align:right;">${r.totalQuestions}</td>
      <td style="text-align:right;">${r.streak}y</td>
      <td style="text-align:right;">${r.forecastPoint}<span style="color:#94A3B8;font-size:9pt;"> (${r.forecastLow}–${r.forecastHigh})</span></td>
      <td style="text-align:center;"><span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${trendBg[r.trend]};color:${trendColor[r.trend]};font-weight:800;font-size:9pt;">${r.trend.toUpperCase()}</span></td>
      <td style="text-align:right;color:#1E40AF;font-weight:800;">${r.hotScore}</td>
    </tr>
  `).join('');

  return `
    <section class="analysis-card">
      <h3>${escHtml(title)}</h3>
      <table class="analysis-heatmap-table">
        <thead>
          <tr>
            <th style="width:32px;text-align:center;">#</th>
            <th>Topic</th>
            <th style="text-align:right;">Total</th>
            <th style="text-align:right;">Streak</th>
            <th style="text-align:right;">2026 Forecast</th>
            <th style="text-align:center;">Trend</th>
            <th style="text-align:right;">Hot Score</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
      <p style="font-size:9pt;color:#64748B;margin-top:6px;font-style:italic;">
        Forecast = linear projection over the last 8 years with an 80% confidence band.
        Hot Score combines FWI (0.55), recent slope (0.30) and 2026 forecast (0.15).
      </p>
    </section>
  `;
};

export const buildPyqAnalysisSummaryHtml = (input: BuildPyqAnalysisSummaryInput): string => {
  const {
    selectedReports,
    examStage,
    selectedPaper,
    selectedRange,
    customYearStart,
    customYearEnd,
    questionCount,
    years,
    distributionData,
    overviewSeries,
    focusTrendSeries,
    focusSubject,
    focusSection,
    focusMicro,
    subjectHeatmapRows,
    topicHeatmapRows,
    heatmapPalette,
    momentumTitle,
    distributionTitle,
    focusedTitle,
    primaryHeatmapTitle,
    primaryHeatmapLabel,
    secondaryHeatmapTitle,
    secondaryHeatmapLabel,
  } = input;

  const includeAll = !!selectedReports.full_report;
  const includeMomentum = includeAll || !!selectedReports.subject_momentum;
  const includeDistribution = includeAll || !!selectedReports.subject_distribution;
  const includeHeatmaps = includeAll || !!selectedReports.heatmaps;
  const includeFocused = includeAll || !!selectedReports.focused_trend;
  const includeForecast = includeAll || !!selectedReports.forecast;

  const sections: string[] = [];

  if (includeMomentum && overviewSeries.length > 0) {
    sections.push(renderPyqLineChartSvg(momentumTitle || 'Subject Momentum', years, overviewSeries));
  }

  if (includeDistribution && distributionData.length > 0) {
    sections.push(renderPyqDonutSvg(distributionTitle || 'Subject Distribution (Donut)', distributionData));
  }

  if (includeHeatmaps) {
    if (subjectHeatmapRows.length > 0) {
      sections.push(renderPyqHeatmapSvg(primaryHeatmapTitle || 'Subject × Year Heatmap', primaryHeatmapLabel || 'Subject', subjectHeatmapRows, years, heatmapPalette));
    }
    if (topicHeatmapRows.length > 0) {
      sections.push(renderPyqHeatmapSvg(secondaryHeatmapTitle || 'Top 20 Topics × Year Heatmap', secondaryHeatmapLabel || 'Topic', topicHeatmapRows, years, heatmapPalette));
    }
  }

  if (includeFocused && focusTrendSeries.length > 0) {
    const focusedLabel = focusMicro !== 'All'
      ? focusMicro
      : focusSection !== 'All'
        ? `${focusSubject} / ${focusSection}`
        : focusSubject !== 'All'
          ? focusSubject
          : 'All PYQ';

    const series = focusTrendSeries.map((row, index) => ({ ...row, color: row.color || (index === 0 ? '#2563EB' : '#14B8A6') }));
    const focusHeading = focusedTitle || 'Focused Trend';
    sections.push(renderPyqLineChartSvg(`${focusHeading} · ${focusedLabel}`, years, series));
  }

  if (includeForecast && input.forecastRows && input.forecastRows.length > 0) {
    sections.push(renderPyqForecastSection(input.forecastTitle || 'Forecast — Probable 2026 Topics', input.forecastRows));
  }

  if (!sections.length) return '';

  const customRangeLabel = selectedRange === 'Custom Range'
    ? ` (${escHtml(customYearStart || '')} - ${escHtml(customYearEnd || '')})`
    : '';

  return `
    <style>
      .analysis-summary { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .analysis-summary h1 { font-size: 21pt; margin: 0 0 3mm; color: #1E40AF; }
      .analysis-summary .muted { color: #475569; font-size: 9pt; margin: 0 0 3mm; }
      .analysis-summary .analysis-card { margin-bottom: 6mm; padding: 4mm; border: 1px solid #DBEAFE; border-radius: 10px; background: #F8FBFF; break-inside: avoid !important; page-break-inside: avoid !important; }
      .analysis-summary h3 { font-size: 12pt; margin: 0 0 2mm; color: #334155; }
      .analysis-summary .analysis-chart { border: 1px solid #D1D5DB; border-radius: 12px; padding: 10px; background: #FFFFFF; break-inside: avoid !important; page-break-inside: avoid !important; }
      .analysis-summary .legend-wrap { margin-bottom: 8px; display: flex; flex-wrap: wrap; gap: 8px; }
      .analysis-summary .legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; color: #334155; }
      .analysis-summary .legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; }
      .analysis-summary .donut-wrap { border: 1px solid #D1D5DB; border-radius: 12px; display: flex; gap: 18px; padding: 12px; align-items: center; margin-bottom: 2px; break-inside: avoid !important; page-break-inside: avoid !important; }
      .analysis-summary .donut-legend { flex: 1; }
      .analysis-summary .donut-legend-row { display: flex; align-items: center; justify-content: space-between; font-size: 11px; padding: 4px 0; color: #334155; }
      .analysis-summary .donut-legend-dot { width: 10px; height: 10px; border-radius: 999px; display: inline-block; margin-right: 7px; }
      .analysis-summary .analysis-heatmap-table { width: 100%; border-collapse: collapse; margin-top: 2mm; }
      .analysis-summary .analysis-heatmap-table th,
      .analysis-summary .analysis-heatmap-table td { border: 1px solid #CBD5E1; padding: 6px 7px; font-size: 9pt; text-align: left; }
      .analysis-summary .analysis-heatmap-table th { background: #E2E8F0; font-weight: 800; }
      .analysis-summary table,
      .analysis-summary tr,
      .analysis-summary svg,
      .analysis-summary svg * { break-inside: avoid !important; page-break-inside: avoid !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    </style>
    <section class="analysis-summary">
      <h1>Executive Summary · PYQ Analysis Reports</h1>
      <p class="muted">${escHtml(examStage)} • ${escHtml(selectedPaper)} • ${escHtml(selectedRange)}${customRangeLabel} • ${questionCount} questions</p>
      ${sections.join('')}
    </section>
  `;
};

// ---------- Generic dispatcher ----------

export type ExportPayload =
  | { kind: 'questions'; rows: ExportQuestion[] }
  | { kind: 'flashcards'; rows: ExportFlashcard[] }
  | { kind: 'notes'; blocks: ExportNoteBlock[]; selectedHeadingIds?: Set<string> }
  | { kind: 'tags'; groups: { tag: string; questions: ExportQuestion[] }[] }
  | { kind: 'hardnote'; note: ExportHardnote }
  | { kind: 'snapshot'; base64: string; pageWidth: number; pageHeight: number; title: string };

export const renderHtml = (payload: ExportPayload, options: ExportOptions): string => {
  switch (payload.kind) {
    case 'questions': return buildQuestionsHtml(payload.rows, options);
    case 'flashcards': return buildFlashcardsHtml(payload.rows, options);
    case 'notes': return buildNotesBlocksHtml(payload.blocks, options, payload.selectedHeadingIds);
    case 'tags': return buildTagsHtml(payload.groups, options);
    case 'hardnote': return buildHardnoteHtml(payload.note, options);
    case 'snapshot': return buildSnapshotHtml(payload, options);
  }
};

export interface ExportRenderExtras {
  prependHtml?: string;
}

const injectExecutiveSummary = (html: string, prependHtml?: string): string => {
  if (!prependHtml || !prependHtml.trim()) return html;
  const insertion = `<section class="executive-summary">${prependHtml}</section><div class="page-break"></div>`;
  if (html.includes('<div class="paper">')) {
    return html.replace('<div class="paper">', `<div class="paper">${insertion}`);
  }
  return `${insertion}${html}`;
};

const sharePdfWithTimeout = async (uri: string, dialogTitle: string): Promise<void> => {
  // On iPad/iOS, the share sheet can take time to render and animate, especially
  // with large PDFs. We don't want to block the UI, so we start the share operation
  // and resolve immediately, letting it happen in the background.
  try {
    // Share with generous timeout for large PDFs
    await Promise.race([
      Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle }),
      new Promise<void>((resolve) => setTimeout(resolve, 25000)), // 25 second timeout for large PDFs
    ]).catch((e) => {
      console.warn('[Export] Share operation failed (non-fatal):', e?.message || e);
    });
  } catch (e) {
    console.warn('[Export] Share error (non-fatal):', e);
  }
  
  // Wait a bit to let the system share sheet start appearing
  await new Promise<void>((resolve) => setTimeout(resolve, 500));
};

export async function exportToPdf(payload: ExportPayload, options: ExportOptions, extras: ExportRenderExtras = {}): Promise<string> {
  let tempUri: string | null = null;
  try {
    const html = injectExecutiveSummary(renderHtml(payload, options), extras.prependHtml);
    
    // Log HTML size for debugging crashes with large PDFs
    console.log(`[exportToPdf] HTML size: ${(html.length / 1024).toFixed(2)}KB`);
    
    // Set timeout for print rendering - prevents hanging on large PDFs
    let uri: string;
    try {
      const printResult = await Promise.race<any>([
        Print.printToFileAsync({ html, base64: false }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Print timeout after 30s')), 30000))
      ]);
      uri = printResult.uri;
    } catch (printError) {
      console.error('[exportToPdf] Print failed:', printError);
      throw new Error(`PDF rendering failed: ${printError instanceof Error ? printError.message : 'Unknown error'}`);
    }
    
    const safe = options.title.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 48) || 'export';
    const dest = `${FileSystem.cacheDirectory}${safe}_${Date.now()}.pdf`;
    try { await FileSystem.moveAsync({ from: uri, to: dest }); } catch { }
    
    const info = await FileSystem.getInfoAsync(dest);
    const finalUri = info.exists ? dest : uri;
    tempUri = finalUri;
    
    if (await Sharing.isAvailableAsync()) {
      await sharePdfWithTimeout(finalUri, options.title);
    } else {
      await Linking.openURL(finalUri).catch(() => null);
    }
    return finalUri;
  } catch (err) {
    console.error('[exportToPdf] Fatal error:', err);
    throw err;
  } finally {
    // Cleanup: schedule deletion of temp files to avoid memory bloat
    if (tempUri) {
      setTimeout(() => {
        FileSystem.deleteAsync(tempUri!, { idempotent: true })
          .catch(e => console.warn('[exportToPdf] Cleanup failed:', e));
      }, 3000); // Wait 3 seconds before cleanup
    }
  }
}
