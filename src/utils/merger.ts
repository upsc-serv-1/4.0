/**
 * Unified merging logic for canonical questions across the app.
 *
 * Updated rule:
 *   1) Compare by YEAR + TEXT first (primary dedupe key)
 *   2) Then canonical id
 *   3) Then text / explanation / options fallbacks
 *
 * This prevents duplicate rows in Arena when same question is repeated
 * across institutes and ensures merged rows retain all institutes + explanations.
 */
export const mergeQuestions = (questions: any[]) => {
  const mergedQs: any[] = [];
  const canonicalMap = new Map<string, any>();
  const yearTextMap = new Map<string, any>();
  const textMap = new Map<string, any>();
  const explanationMap = new Map<string, any>();
  const optionsMap = new Map<string, any>();
  const idToMergedId = new Map<string, string>();

  const cleanText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/<[^>]*>?/gm, '')
      .toLowerCase()
      .replace(/[\s\n\r\t]+/g, ' ')
      .replace(/[^\w ]/g, '')
      .trim();
  };

  const getQuestionText = (q: any): string =>
    String(q?.question_text || q?.statement_line || q?.statement || '');

  const normalizeInstituteLabel = (value: any) => {
    const raw = String(value || '').trim();
    if (!raw) return 'UPSC';

    const compact = raw.toLowerCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
    const key = compact.replace(/[^a-z0-9]/g, '');

    const map: Record<string, string> = {
      forum: 'Forum',
      forumias: 'Forum',
      vision: 'Vision',
      visionias: 'Vision',
      next: 'Next',
      nextias: 'Next',
      insights: 'Insights',
      insightsias: 'Insights',
      iasbaba: 'IASBABA',
      vajiram: 'Vajiram',
      pw: 'PW',
      raus: 'Raus',
      drishti: 'Drishti',
      upsc: 'UPSC',
    };

    if (map[key]) return map[key];
    return compact
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getInstitute = (q: any) => {
    const testsObj = Array.isArray(q?.tests) ? q.tests[0] : q?.tests;
    let inst = testsObj?.institute || q?.tests?.institute || q?.provider || q?.source?.institute;
    if (!inst && q?.test_id) {
      const parts = String(q.test_id).split('-');
      if (parts.length > 0) {
        const first = parts[0].toLowerCase();
        if (['forum', 'vision', 'insights', 'iasbaba', 'vajiram', 'nextias', 'next', 'pw', 'raus', 'drishti'].includes(first)) {
          inst = first;
        }
      }
    }
    return normalizeInstituteLabel(inst || 'UPSC');
  };

  const getYear = (q: any): string => {
    const y = q?.exam_year || q?.source?.year || q?.tests?.exam_year || q?.tests?.launch_year || '';
    return String(y || '').trim();
  };

  const buildYearTextKey = (q: any): string => {
    const year = getYear(q) || 'na';
    const txt = cleanText(getQuestionText(q));
    if (!txt) return '';
    return `${year}__${txt}`;
  };

  const normalizeExplanation = (txt: string) =>
    cleanText(txt || '').replace(/\s+/g, ' ').trim();

  questions.forEach((q) => {
    let vaultMeta: any = null;
    try {
      if (q.source_attribution_label) {
        const parsed = typeof q.source_attribution_label === 'string'
          ? JSON.parse(q.source_attribution_label)
          : q.source_attribution_label;
        vaultMeta = parsed?.__vaultMeta;
      }
    } catch {
      // ignore malformed attribution json
    }

    const cId = vaultMeta?.canonicalId || (vaultMeta?.isCanonical ? q.id : null) || vaultMeta?._canonicalQuestionId;

    const questionText = cleanText(getQuestionText(q));
    const year = getYear(q);
    const yearTextKey = buildYearTextKey(q);

    const explKey = normalizeExplanation(String(q.explanation_markdown || q.explanation || ''));
    const explanationYearKey = explKey ? `${year || 'na'}__${explKey}` : '';

    const optionsKey = q.options
      ? Object.values(q.options).map((v: any) => String(v || '')).sort().join('|').toLowerCase().replace(/[^\w]/g, '')
      : '';
    const optionsYearKey = optionsKey ? `${year || 'na'}__${optionsKey}` : '';

    let existing: any = null;

    // 1) PRIMARY: year + text
    if (yearTextKey && questionText.length > 20) {
      existing = yearTextMap.get(yearTextKey) || null;
    }

    // 2) Canonical fallback (only when year doesn't conflict)
    if (!existing && cId) {
      const byCanonical = canonicalMap.get(cId) || null;
      if (byCanonical) {
        const existingYear = getYear(byCanonical);
        const yearCompatible = !existingYear || !year || existingYear === year;
        if (yearCompatible) existing = byCanonical;
      }
    }

    // 3) Secondary text fallback
    if (!existing && questionText && questionText.length > 40) {
      existing = textMap.get(questionText) || null;
    }

    // 4) Explanation fallback
    if (!existing && explanationYearKey && explKey.length > 80) {
      existing = explanationMap.get(explanationYearKey) || null;
    }

    // 5) Options fallback
    if (!existing && optionsYearKey && optionsKey.length > 50) {
      existing = optionsMap.get(optionsYearKey) || null;
    }

    const institute = getInstitute(q);

    if (existing) {
      idToMergedId.set(q.id, existing.id);
      mergeData(existing, q, institute, getYear(q), normalizeExplanation);
      return;
    }

    prepareQuestion(q, institute, getYear(q));

    if (cId) canonicalMap.set(cId, q);
    if (yearTextKey) yearTextMap.set(yearTextKey, q);
    if (questionText) textMap.set(questionText, q);
    if (explanationYearKey) explanationMap.set(explanationYearKey, q);
    if (optionsYearKey) optionsMap.set(optionsYearKey, q);

    idToMergedId.set(q.id, q.id);
    mergedQs.push(q);
  });

  return { mergedQs, idToMergedId };
};

const prepareQuestion = (q: any, inst: string, year: string) => {
  q._institutes = [inst];
  q._mergedIds = [q.id];

  const expl = String(q.explanation_markdown || q.explanation || '').trim();
  const ans = String(q.correct_answer || '').trim();
  q._explanations = (expl || ans)
    ? [{ source: inst, text: expl, year, answer: ans }]
    : [];
};

const mergeData = (
  existing: any,
  q: any,
  inst: string,
  year: string,
  normalizeExplanation: (txt: string) => string,
) => {
  if (!existing._institutes) {
    const testsObj = Array.isArray(existing.tests) ? existing.tests[0] : existing.tests;
    const baseInstRaw = testsObj?.institute || existing.tests?.institute || existing.provider || 'UPSC';
    const baseInst = String(baseInstRaw || 'UPSC').trim();
    existing._institutes = [baseInst];
  }
  const instKey = String(inst || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hasInstitute = existing._institutes.some((x: string) => {
    const key = String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return key === instKey || key.includes(instKey) || instKey.includes(key);
  });
  if (!hasInstitute) {
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

    // Keep one record per institute/year/answer/text combination.
    const alreadyPresent = existing._explanations.some((e: any) => {
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
