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

export type ExportFontFamily = 'sans' | 'serif' | 'handwriting' | 'mono';
export type ExportTheme = 'modern' | 'classic' | 'sepia' | 'historical' | 'dark';
export type ExportPaperStyle = 'plain' | 'lined' | 'grid' | 'dotted';
export type ExportColumns = 1 | 2;
export type ExportContentScope = 'q_only' | 'q_options' | 'q_options_expl';
export type ExportAnswerPlacement = 'inline' | 'end';
export type ExportSortBy = 'default' | 'subject' | 'microtopic' | 'difficulty' | 'date';
export type ExportQaLayoutMode = 'unified' | 'split';

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

  // Page setup (cm)
  pageMarginTopCm: number;
  pageMarginRightCm: number;
  pageMarginBottomCm: number;
  pageMarginLeftCm: number;

  // Question/answer background customization
  qaBackgroundColor: string; // 'transparent' for none
  qaLayoutMode: ExportQaLayoutMode;

  showTOC: boolean;
  headerText: string;
  footerText: string;
  watermark: string;
  moduleName?: string;

  includePerformanceMetrics?: boolean;

  // Question filters (apply before render)
  statusFilter?: 'all' | 'correct' | 'incorrect' | 'unattempted';
  revisionTags?: string[];
  pyqOnly?: boolean;
  ncertOnly?: boolean;
}

export const defaultExportOptions = (overrides: Partial<ExportOptions> = {}): ExportOptions => ({
  title: 'Export',
  fontFamily: 'sans',
  fontSize: 12,
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
  qaBackgroundColor: 'transparent',
  qaLayoutMode: 'unified',
  showTOC: false,
  headerText: 'Dr. UPSC',
  footerText: '',
  watermark: '',
  moduleName: '',
  includePerformanceMetrics: false,
  statusFilter: 'all',
  revisionTags: [],
  pyqOnly: false,
  ncertOnly: false,
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
  type: 'microTopicHeading' | 'highlight';
  text: string;
  color?: string;
  sourceLabel?: string;
}

// ---------- Theme tokens ----------

const themeTokens: Record<ExportTheme, { bg: string; fg: string; accent: string; rule: string; card: string }> = {
  modern:     { bg: '#ffffff', fg: '#111827', accent: '#6366f1', rule: '#e5e7eb', card: '#ffffff' },
  classic:    { bg: '#ffffff', fg: '#111111', accent: '#1d4ed8', rule: '#e5e7eb', card: '#ffffff' },
  sepia:      { bg: '#F4ECD8', fg: '#433422', accent: '#9a3412', rule: '#d9c7a3', card: '#fdf6e3' },
  historical: { bg: '#fdf6e3', fg: '#2d2419', accent: '#7c2d12', rule: '#d6c9a8', card: '#fffaf0' },
  dark:       { bg: '#0b0f17', fg: '#e5e7eb', accent: '#60a5fa', rule: '#1f2937', card: '#111827' },
};

const fontFamilyCss: Record<ExportFontFamily, string> = {
  sans:        `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  serif:       `'Georgia', 'Times New Roman', serif`,
  handwriting: `'Caveat', 'Patrick Hand', cursive`,
  mono:        `'Menlo', 'Consolas', 'JetBrains Mono', 'Courier New', monospace`,
};

const paperBg: Record<ExportPaperStyle, string> = {
  plain:  'none',
  lined:  `repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--rule) 28px)`,
  grid:   `linear-gradient(to right, var(--rule) 1px, transparent 1px) 0 0/24px 24px, linear-gradient(to bottom, var(--rule) 1px, transparent 1px) 0 0/24px 24px`,
  dotted: `radial-gradient(var(--rule) 1px, transparent 1px) 0 0/16px 16px`,
};

// ---------- CSS builder ----------

const clampCm = (value: number, fallback = 1): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0.3, Math.min(4, n));
};

const baseCss = (o: ExportOptions) => {
  const t = themeTokens[o.theme];
  const qaBg = o.qaBackgroundColor || 'transparent';
  const qaBorder = qaBg === 'transparent' ? 'transparent' : 'rgba(15, 23, 42, 0.12)';
  return `
    :root { --bg:${t.bg}; --fg:${t.fg}; --accent:${t.accent}; --rule:${t.rule}; --card:${t.card}; --qa-bg:${qaBg}; --qa-border:${qaBorder}; }
    @page { size: A4; margin: ${clampCm(o.pageMarginTopCm)}cm ${clampCm(o.pageMarginRightCm)}cm ${clampCm(o.pageMarginBottomCm)}cm ${clampCm(o.pageMarginLeftCm)}cm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
    .paper { background-image: ${paperBg[o.paperStyle]}; padding: 4px; min-height: 100%; }

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
    .item {
      break-inside: avoid;
      page-break-inside: avoid;
      padding: 4mm 0 4mm 0;
      border-bottom: 1px solid var(--rule);
      margin-bottom: 2mm;
      overflow-wrap: break-word;
      word-break: break-word;
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
      background: var(--qa-bg);
      border: 1px solid var(--qa-border);
      border-radius: 8px;
      padding: 3mm 3.5mm;
    }
    .qa-unified .qa-answer {
      margin-top: 2mm;
      padding-top: 2mm;
      border-top: 1px dashed var(--qa-border);
    }
    .qa-split-stack {
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }

    /* Rich text preservation */
    b, strong { font-weight: 700; }
    i, em { font-style: italic; }
    u { text-decoration: underline; }
    s, strike, del { text-decoration: line-through; }
    mark, .highlight { background-color: #FFF59D; color: inherit; padding: 0 2px; border-radius: 2px; }
    span[style*="background"] { padding: 0 2px; border-radius: 2px; }
    blockquote { border-left: 3px solid var(--accent); padding: 4px 12px; margin: 6px 0; color: var(--fg); background: rgba(0,0,0,0.04); border-radius: 4px; }
    ul, ol { padding-left: 22px; margin: 4px 0; }
    li { margin: 2px 0; }
    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 8px 0 4px 0; color: var(--fg); }
    a { color: var(--accent); text-decoration: underline; }
    code { background: rgba(0,0,0,0.06); padding: 1px 4px; border-radius: 3px; font-family: Menlo, monospace; font-size: 0.9em; }

    /* Flashcards */
    .card { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; border: 1px solid var(--rule); border-radius: 6px; padding: 4mm; margin: 3mm 0; break-inside: avoid; }
    .card .side { border-right: 1px dashed var(--rule); padding-right: 4mm; }
    .card .side:last-child { border-right: none; padding-right: 0; }
    .card-state { display: inline-block; font-size: ${o.fontSize - 4}pt; padding: 0 6px; border-radius: 8px; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; background: var(--accent); color: #fff; }

    /* Tags */
    .tag-section { margin-top: 6mm; break-inside: avoid; }
    .tag-title { color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 2mm; margin: 6mm 0 3mm 0; font-size: ${o.fontSize + 2}pt; font-weight: 900; }

    /* Notes */
    .note h1, .note h2, .note h3 { color: var(--accent); }
    .note { break-inside: avoid; page-break-inside: avoid; padding: 4mm; border: 1px solid var(--rule); border-left: 4px solid var(--accent); border-radius: 6px; margin-bottom: 4mm; }
    .microheading { font-weight: 900; font-size: ${o.fontSize + 1}pt; color: var(--accent); margin: 6mm 0 2mm 0; padding: 3mm 4mm; background: rgba(99,102,241,0.08); border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

    /* TOC */
    .toc { margin: 0 0 10mm 0; padding: 4mm 6mm; background: rgba(0,0,0,0.03); border-radius: 6px; border: 1px solid var(--rule); }
    .toc-title { font-weight: 900; margin-bottom: 2mm; font-size: ${o.fontSize + 1}pt; color: var(--accent); }
    .toc-item { font-size: ${o.fontSize - 1}pt; padding: 1mm 0; border-bottom: 1px dashed var(--rule); }

    /* Watermark */
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 80pt; font-weight: 900; color: rgba(0,0,0,0.04); white-space: nowrap; pointer-events: none; z-index: -1; }

    /* Footer */
    .footer { position: fixed; bottom: -8mm; left: 0; right: 0; font-size: ${o.fontSize - 4}pt; color: #9ca3af; text-align: center; text-transform: uppercase; letter-spacing: 1px; }

    /* Answer Key appendix */
    .answer-key { page-break-before: always; margin-top: 10mm; }
    .answer-key h2 { color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 2mm; }
    .ak-row { padding: 2mm 0; border-bottom: 1px dashed var(--rule); font-size: ${o.fontSize - 1}pt; }
    .ak-num { color: var(--accent); font-weight: 800; margin-right: 6px; }

    /* Perf metrics */
    .metrics { display: inline-block; font-size: ${o.fontSize - 3}pt; margin-left: 6px; padding: 1px 6px; border-radius: 10px; background: rgba(99,102,241,0.12); color: var(--accent); font-weight: 700; }
  `;
};

// ---------- HTML helpers ----------

const escapeHtml = (s: string = ''): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c] || c);

const HTML_TAG_REGEX = /<\/?(b|strong|i|em|u|mark|span|ul|ol|li|p|br|div|h[1-6]|blockquote)(\s|>|\/)/i;

// Preserve rich HTML; convert markdown for plain text
const renderInline = (txt: string = ''): string => {
  if (!txt) return '';
  if (HTML_TAG_REGEX.test(txt)) return txt;
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
<body>
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
  return out;
};

export const sortQuestions = (rows: ExportQuestion[], o: ExportOptions): ExportQuestion[] => {
  const out = [...rows];
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
    default:
      break;
  }
  return out;
};

// ---------- Questions ----------

const renderQaLayoutBlock = (questionHtml: string, answerHtml: string, o: ExportOptions): string => {
  if (o.qaLayoutMode === 'split') {
    return `<div class="qa-split-stack"><div class="qa-question-box">${questionHtml}</div>${answerHtml ? `<div class="qa-answer-box">${answerHtml}</div>` : ''}</div>`;
  }
  return `<div class="qa-unified"><div class="qa-question">${questionHtml}</div>${answerHtml ? `<div class="qa-answer">${answerHtml}</div>` : ''}</div>`;
};

export const buildQuestionsHtml = (rowsRaw: ExportQuestion[], o: ExportOptions): string => {
  const rows = sortQuestions(filterQuestions(rowsRaw, o), o);

  // TOC groups by subject
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

  const showOpts = o.contentScope !== 'q_only';
  const showExpl = o.contentScope === 'q_options_expl';
  const inline = o.answerPlacement === 'inline';

  const itemsHtml = rows.map((q, i) => {
    const stem = q.question_text || q.statement || '';
    const meta = [q.subject, q.section_group, q.micro_topic, q.exam_year, q.is_pyq ? 'PYQ' : null, q.is_ncert ? 'NCERT' : null]
      .filter(Boolean).map(x => `<span class="pill">${escapeHtml(String(x))}</span>`).join('');

    const answer = (q.correct_answer || '').toUpperCase();
    const explanation = q.explanation_markdown || q.explanation || '';

    const optsBlock = showOpts && q.options ? (() => {
      const opts = q.options!;
      return `<ul class="opts">${['a', 'b', 'c', 'd'].filter(k => (opts as any)[k]).map(k => {
        const label = k.toUpperCase();
        let cls = '';
        if (inline && answer === label) cls = 'correct';
        return `<li class="${cls}"><b>${label}.</b> ${renderInline(String((opts as any)[k]))}</li>`;
      }).join('')}</ul>`;
    })() : '';

    const metricsBlock = o.includePerformanceMetrics
      ? `${q.time_taken_seconds ? `<span class="metrics">⏱ ${q.time_taken_seconds}s</span>` : ''}${q.is_correct === true ? '<span class="metrics">✓ Correct</span>' : q.is_correct === false ? '<span class="metrics">✗ Incorrect</span>' : q.selected_answer ? '' : '<span class="metrics">— Skipped</span>'}`
      : '';

    const questionBlock = `
      <div class="qstem"><span class="qnum">${i + 1}.</span>${renderInline(stem)}${metricsBlock}</div>
      ${meta ? `<div class="metarow">${meta}</div>` : ''}
      ${optsBlock}
    `;

    const answerBlock = `
      ${inline && showOpts && answer ? `<div class="ans">Answer: ${answer}</div>` : ''}
      ${inline && showExpl && explanation ? `<div class="expl">${renderInline(explanation)}</div>` : ''}
    `.trim();

    return `<div class="item">${renderQaLayoutBlock(questionBlock, answerBlock, o)}</div>`;
  }).join('');

  // Answer key appendix if not inline
  const answerKey = !inline && (o.contentScope !== 'q_only')
    ? `<div class="answer-key">
        <h2>Answer Key${showExpl ? ' & Explanations' : ''}</h2>
        ${rows.map((q, i) => {
          const a = (q.correct_answer || '').toUpperCase();
          const e = q.explanation_markdown || q.explanation || '';
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
  const cards = rows.map(c => `
    <div class="card">
      <div class="side"><div style="font-size:${o.fontSize - 3}pt;font-weight:800;color:var(--accent);letter-spacing:1px;margin-bottom:1mm">FRONT</div><div>${renderInline(c.front)}</div></div>
      <div class="side"><div style="font-size:${o.fontSize - 3}pt;font-weight:800;color:var(--accent);letter-spacing:1px;margin-bottom:1mm">BACK</div><div>${renderInline(c.back)}</div>${c.state ? `<div style="margin-top:2mm"><span class="card-state">${c.state}</span></div>` : ''}</div>
    </div>`).join('');
  return wrap(o, cards);
};

// ---------- Notes ----------

export const buildNotesBlocksHtml = (blocks: ExportNoteBlock[], o: ExportOptions, selectedHeadingIds?: Set<string>): string => {
  const selected = selectedHeadingIds && selectedHeadingIds.size > 0 ? selectedHeadingIds : null;
  let currentHeading = '';
  let isRendering = true;
  const filtered = blocks.filter(b => {
    if (b.type === 'microTopicHeading') {
      currentHeading = b.id;
      isRendering = selected ? selected.has(b.id) : true;
      return isRendering;
    }
    if (!currentHeading) return true;
    return isRendering;
  });

  const toc = o.showTOC
    ? `<div class="toc"><div class="toc-title">Table of Contents</div>${filtered.filter(f => f.type === 'microTopicHeading').map(h => `<div class="toc-item">${renderInline(h.text)}</div>`).join('')}</div>`
    : '';

  const body = filtered.map(b => {
    if (b.type === 'microTopicHeading') {
      return `<div class="microheading">${renderInline(b.text)}</div>`;
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
  const inline = o.answerPlacement === 'inline';

  const sections = groups.map(g => {
    const rows = sortQuestions(filterQuestions(g.questions, o), o);
    const items = rows.map((q, i) => {
      const stem = q.question_text || q.statement || '';
      const meta = [q.subject, q.micro_topic, q.exam_year].filter(Boolean).map(x => `<span class="pill">${escapeHtml(String(x))}</span>`).join('');
      const answer = (q.correct_answer || '').toUpperCase();
      const explanation = q.explanation_markdown || q.explanation || '';
      const optsBlock = showOpts && q.options ? `<ul class="opts">${['a','b','c','d'].filter(k => (q.options as any)[k]).map(k => `<li class="${inline && answer === k.toUpperCase() ? 'correct' : ''}"><b>${k.toUpperCase()}.</b> ${renderInline(String((q.options as any)[k]))}</li>`).join('')}</ul>` : '';
      const questionBlock = `
        <div class="qstem"><span class="qnum">${i + 1}.</span>${renderInline(stem)}</div>
        ${meta ? `<div class="metarow">${meta}</div>` : ''}
        ${optsBlock}
      `;
      const answerBlock = `
        ${inline && showOpts && answer ? `<div class="ans">Answer: ${answer}</div>` : ''}
        ${inline && showExpl && explanation ? `<div class="expl">${renderInline(explanation)}</div>` : ''}
      `.trim();
      return `<div class="item">${renderQaLayoutBlock(questionBlock, answerBlock, o)}</div>`;
    }).join('');
    return `<div class="tag-section">
      <div class="tag-title">#${escapeHtml(g.tag)} <span style="font-weight:500;opacity:0.7">(${rows.length})</span></div>
      <div class="cols">${items}</div>
    </div>`;
  }).join('');

  // Appendix answer key (if placement === 'end')
  const answerKey = !inline && showOpts
    ? `<div class="answer-key">
        <h2>Answer Key${showExpl ? ' & Explanations' : ''}</h2>
        ${groups.flatMap((g, gi) => g.questions.map((q, i) => {
          const a = (q.correct_answer || '').toUpperCase();
          const e = q.explanation_markdown || q.explanation || '';
          return `<div class="ak-row"><span class="ak-num">#${escapeHtml(g.tag)} · ${i + 1}.</span>${a ? `<b>Ans: ${a}</b>` : ''}${showExpl && e ? `<div class="expl" style="margin-top:1mm">${renderInline(e)}</div>` : ''}</div>`;
        })).join('')}
      </div>`
    : '';

  return wrap(o, `${toc}${sections}`, answerKey);
};

// ---------- Generic dispatcher ----------

export type ExportPayload =
  | { kind: 'questions'; rows: ExportQuestion[] }
  | { kind: 'flashcards'; rows: ExportFlashcard[] }
  | { kind: 'notes'; blocks: ExportNoteBlock[]; selectedHeadingIds?: Set<string> }
  | { kind: 'tags'; groups: { tag: string; questions: ExportQuestion[] }[] };

export const renderHtml = (payload: ExportPayload, options: ExportOptions): string => {
  switch (payload.kind) {
    case 'questions':  return buildQuestionsHtml(payload.rows, options);
    case 'flashcards': return buildFlashcardsHtml(payload.rows, options);
    case 'notes':      return buildNotesBlocksHtml(payload.blocks, options, payload.selectedHeadingIds);
    case 'tags':       return buildTagsHtml(payload.groups, options);
  }
};

const sharePdfWithTimeout = async (uri: string, dialogTitle: string): Promise<void> => {
  const timeoutMs = 20000;
  await Promise.race([
    Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle }).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
};

export async function exportToPdf(payload: ExportPayload, options: ExportOptions): Promise<string> {
  const html = renderHtml(payload, options);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const safe = options.title.replace(/[^a-z0-9-_ ]/gi, '_').slice(0, 48) || 'export';
  const dest = `${FileSystem.cacheDirectory}${safe}.pdf`;
  try { await FileSystem.moveAsync({ from: uri, to: dest }); } catch {}
  const info = await FileSystem.getInfoAsync(dest);
  const finalUri = info.exists ? dest : uri;
  if (await Sharing.isAvailableAsync()) {
    await sharePdfWithTimeout(finalUri, options.title);
  }
  return finalUri;
}
