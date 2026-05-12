export type ExportOptions = {
  columns: 1 | 2;
  paper: 'plain' | 'lined' | 'grid' | 'dotted';
  theme: 'classic' | 'modern' | 'historical' | 'dark';
  font: 'serif' | 'sans' | 'handwriting' | 'mono';
  showAnswers: boolean;     // questions only
  showExplanation: boolean; // questions only
  pageSize: 'A4' | 'Letter';
  title: string;
};

export const themeTokens: Record<ExportOptions['theme'], {bg:string;fg:string;accent:string;rule:string}> = {
  classic:    { bg: '#fff',     fg: '#111',    accent: '#1d4ed8', rule: '#e5e7eb' },
  modern:     { bg: '#fafafa',  fg: '#0f172a', accent: '#10b981', rule: '#e2e8f0' },
  historical: { bg: '#f7efe1',  fg: '#3b2a18', accent: '#9a3412', rule: '#d9c7a3' },
  dark:       { bg: '#0b0f17',  fg: '#e5e7eb', accent: '#60a5fa', rule: '#1f2937' },
};

export const fontFamily: Record<ExportOptions['font'], string> = {
  serif:       `'Georgia','Times New Roman',serif`,
  sans:        `'Inter','Helvetica Neue',Arial,sans-serif`,
  handwriting: `'Caveat','Patrick Hand',cursive`,
  mono:        `'JetBrains Mono','Courier New',monospace`,
};

export const paperBg: Record<ExportOptions['paper'], string> = {
  plain:  'none',
  lined:  `repeating-linear-gradient(to bottom, transparent 0, transparent 27px, var(--rule) 28px)`,
  grid:   `linear-gradient(to right, var(--rule) 1px, transparent 1px) 0 0/24px 24px,
           linear-gradient(to bottom, var(--rule) 1px, transparent 1px) 0 0/24px 24px`,
  dotted: `radial-gradient(var(--rule) 1px, transparent 1px) 0 0/16px 16px`,
};

export const baseStyles = (o: ExportOptions) => {
  const t = themeTokens[o.theme];
  return `
    :root { --bg:${t.bg}; --fg:${t.fg}; --accent:${t.accent}; --rule:${t.rule}; }
    @page { size: ${o.pageSize}; margin: 0; }
    * { box-sizing: border-box; }
    body { background: var(--bg); color: var(--fg); font-family: ${fontFamily[o.font]};
           font-size: 12pt; line-height: 1.55; margin: 0; padding: 18mm 14mm; }
    .paper { background-image: ${paperBg[o.paper]}; padding: 4px; }
    h1.cover { font-size: 26pt; margin: 0 0 6mm 0; color: var(--accent); }
    .meta { color: var(--accent); font-size: 10pt; margin-bottom: 8mm; }
    .cols { column-count: ${o.columns}; column-gap: 10mm; }
    .item { break-inside: avoid; padding: 6mm 0; border-bottom: 1px solid var(--rule); }
    .qstem { font-weight: 600; }
    .opts { margin: 2mm 0 0 4mm; padding: 0; list-style: none; }
    .opts li { margin: 1mm 0; }
    .ans { color: var(--accent); font-weight: 600; margin-top: 2mm; }
    .expl { font-size: 11pt; margin-top: 1mm; opacity: .9; }
    .card { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm;
            border: 1px solid var(--rule); border-radius: 6px; padding: 4mm; margin: 3mm 0; break-inside: avoid;}
    .card .side { border-right: 1px dashed var(--rule); padding-right: 4mm; }
    .card .side:last-child { border-right: none; padding-right: 0; }
    .tag-section { margin-top: 6mm; break-inside: avoid; }
    .tag-title { color: var(--accent); border-bottom: 2px solid var(--accent); padding-bottom: 2mm;
                 margin: 6mm 0 3mm 0; font-size: 14pt; }
    .note h1,.note h2,.note h3 { color: var(--accent); }
  `;
};

const wrap = (o: ExportOptions, body: string) => `<!doctype html>
<html><head><meta charset="utf-8"/><style>${baseStyles(o)}</style></head>
<body><div class="paper">
  <h1 class="cover">${escape(o.title)}</h1>
  <div class="meta">Generated · ${new Date().toLocaleString()}</div>
  ${body}
</div></body></html>`;

const escape = (s: string = '') =>
  s.replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'} as Record<string, string>)[c] || c);

// ---------------- Questions ----------------
export type QuestionRow = {
  id: string; statement?: string; question_text?: string; statement_lines?: string[];
  options?: { a?: string; b?: string; c?: string; d?: string };
  answer?: 'a'|'b'|'c'|'d'|string; correct_answer?: string;
  explanation?: string; explanation_markdown?: string;
  tag?: string; subject?: string; section_group?: string; micro_topic?: string; exam_year?: number;
};

export const buildQuestionsHtml = (rows: QuestionRow[], o: ExportOptions) => {
  const items = rows.map((q, i) => {
    const opts = q.options ?? {};
    const optHtml = ['a','b','c','d']
      .filter(k => (opts as any)[k])
      .map(k => `<li><b>${k.toUpperCase()}.</b> ${escape((opts as any)[k])}</li>`).join('');
    const stem = q.statement_lines && Array.isArray(q.statement_lines) && q.statement_lines.length
      ? q.statement_lines.map(escape).join('<br/>')
      : escape(q.question_text ?? q.statement ?? '');
    const meta = [q.subject, q.section_group, q.micro_topic, q.exam_year]
      .filter(Boolean).join(' · ');
    const answer = q.correct_answer ?? q.answer;
    const explanation = q.explanation_markdown ?? q.explanation;
    return `<div class="item">
      <div class="qstem">${i+1}. ${stem}</div>
      ${meta ? `<div style="opacity:.7;font-size:10pt;margin-top:1mm">${escape(meta)}</div>` : ''}
      ${optHtml ? `<ul class="opts">${optHtml}</ul>` : ''}
      ${o.showAnswers && answer ? `<div class="ans">Answer: ${String(answer).toUpperCase()}</div>` : ''}
      ${o.showExplanation && explanation ? `<div class="expl">${escape(explanation)}</div>` : ''}
    </div>`;
  }).join('');
  return wrap(o, `<div class="cols">${items}</div>`);
};

// ---------------- Flashcards ----------------
export type CardRow = { id: string; front: string; back: string; deck?: string };

export const buildFlashcardsHtml = (rows: CardRow[], o: ExportOptions) => {
  const cards = rows.map(c => `
    <div class="card">
      <div class="side"><b>Front</b><div>${escape(c.front)}</div></div>
      <div class="side"><b>Back</b><div>${escape(c.back)}</div></div>
    </div>`).join('');
  return wrap(o, cards);
};

// ---------------- Notes ----------------
export const buildNotesHtml = (noteHtmlBlocks: { title: string; html: string }[], o: ExportOptions) => {
  const body = noteHtmlBlocks.map(n => `
    <section class="note item">
      <h2>${escape(n.title)}</h2>
      <div>${n.html}</div>
    </section>`).join('');
  return wrap(o, `<div class="cols">${body}</div>`);
};

// ---------------- Tags (questions grouped by tag) ----------------
export const buildTagsHtml = (
  groups: { tag: string; questions: QuestionRow[] }[],
  o: ExportOptions,
) => {
  const sections = groups.map(g => {
    const items = g.questions.map((q, i) => `
      <div class="item">
        <div class="qstem">${i+1}. ${escape(q.statement)}</div>
        ${o.showAnswers && q.answer ? `<div class="ans">Answer: ${String(q.answer).toUpperCase()}</div>` : ''}
        ${o.showExplanation && q.explanation ? `<div class="expl">${escape(q.explanation)}</div>` : ''}
      </div>`).join('');
    return `<div class="tag-section">
      <div class="tag-title">#${escape(g.tag)} (${g.questions.length})</div>
      <div class="cols">${items}</div>
    </div>`;
  }).join('');
  return wrap(o, sections);
};
