const fs = require('fs');

const normalizeExplanation = (txt) => {
  if (!txt) return '';
  return txt
    .replace(/<[^>]*>?/gm, '')
    .toLowerCase()
    .replace(/[\s\n\r\t]+/g, ' ')
    .replace(/[^\w ]/g, '')
    .trim();
};

const mergeData = (
  existing,
  q,
  inst,
  year,
  normalizeExplanation
) => {
  if (!existing._institutes) {
    existing._institutes = [existing.tests?.institute || 'UPSC'];
  }
  if (!existing._institutes.includes(inst)) {
    existing._institutes.push(inst);
  }

  if (!existing._mergedIds) existing._mergedIds = [existing.id];
  if (!existing._mergedIds.includes(q.id)) existing._mergedIds.push(q.id);

  if (!existing._explanations) {
    const base = String(existing.explanation_markdown || existing.explanation || '').trim();
    const baseAns = String(existing.correct_answer || '').trim();
    existing._explanations = (base || baseAns)
      ? [{
          source: existing._institutes[0],
          text: base,
          year: String(existing.exam_year || existing.source?.year || ''),
          answer: baseAns,
        }]
      : [];
  }

  const qText = String(q.explanation_markdown || q.explanation || '').trim();
  const qAnswer = String(q.correct_answer || '').trim().toUpperCase();

  if (qText || qAnswer) {
    const qNorm = normalizeExplanation(qText);

    const alreadyPresent = existing._explanations.some((e) => {
      const eNorm = normalizeExplanation(String(e.text || ''));
      const sameSource = String(e.source || '').trim().toLowerCase() === inst.toLowerCase();
      const sameYear = String(e.year || '') === String(year || '');
      const sameAnswer = String(e.answer || '').trim().toUpperCase() === qAnswer;
      return sameSource && sameYear && sameAnswer && eNorm === qNorm;
    });

    if (!alreadyPresent) {
      existing._explanations.push({
        source: inst,
        text: qText,
        year,
        answer: q.correct_answer || '',
      });
    }

    if (!existing.explanation_markdown && qText) existing.explanation_markdown = qText;
  }
};

const q1 = {
  id: '1',
  question_text: 'The Rowlatt Act was based on',
  correct_answer: 'b',
  explanation_markdown: '220. Solution (b)',
  tests: { institute: 'PMF IAS' },
};
const q2 = {
  id: '2',
  question_text: 'The Rowlatt Act was based on',
  correct_answer: 'b',
  explanation_markdown: '220. Solution (b)',
  tests: { institute: 'X-IAS' },
};

mergeData(q1, q2, 'X-IAS', '', normalizeExplanation);
console.log(JSON.stringify(q1, null, 2));

const normalizeInstituteLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return 'Primary';
  const compact = raw.replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return compact
    .split(' ')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

const normalizedExplanations = (() => {
  const item = q1;
  const list = Array.isArray(item._explanations) ? item._explanations : [];
  const seen = new Set();
  const out = [];
  list.forEach((e, idx) => {
    const source = normalizeInstituteLabel(e?.source || e?.institute || e?.provider || e?.tests?.institute || item.tests?.institute || `Source ${idx + 1}`);
    const sourceKey = source.toLowerCase();
    const year = String(e?.year || item.exam_year || '').trim();
    const answer = String(e?.answer || item.correct_answer || '').trim().toUpperCase();
    const text = String(e?.text || e?.explanation || '').trim();
    
    const dedupeKey = `${sourceKey}__${year}__${answer}__${text.replace(/\s+/g, ' ').toLowerCase()}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push({ source, sourceKey, year, answer, text });
  });

  if (item.explanation_markdown) {
    const source = normalizeInstituteLabel(item.tests?.institute || item.source?.institute || 'Primary');
    const sourceKey = source.toLowerCase();
    const text = String(item.explanation_markdown).trim();
    const year = String(item.exam_year || '').trim();
    const answer = String(item.correct_answer || '').trim().toUpperCase();
    const dedupeKey = `${sourceKey}__${year}__${answer}__${text.replace(/\s+/g, ' ').toLowerCase()}`;
    if (text && !seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      out.push({ source, sourceKey, year, answer, text });
    }
  }

  return out;
})();

console.log("OUT", normalizedExplanations);
