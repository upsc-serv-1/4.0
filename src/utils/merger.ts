/**
 * Unified merging logic for Canonical questions across the app.
 * Groups questions by canonicalId (from vaultMeta) or falls back to robust text matching.
 *
 * IMPORTANT (2026): For PYQ questions, when text matches, we ALSO require the exam year to match.
 * This is based on the invariant that two repeating PYQs from different institutes/programs
 * will always share the same exam year. This prevents false-positive merges when two
 * different questions happen to have similar text stems.
 */
export const mergeQuestions = (questions: any[]) => {
  const mergedQs: any[] = [];
  const canonicalMap = new Map<string, any>();
  const textMap = new Map<string, any>();
  const explanationMap = new Map<string, any>();
  const optionsMap = new Map<string, any>();
  const idToMergedId = new Map<string, string>();

  const cleanText = (text: string) => {
    if (!text) return "";
    return text
      .replace(/<[^>]*>?/gm, '') // Strip HTML
      .toLowerCase()
      .replace(/[^\w]/g, '')     // Strip EVERYTHING except letters and numbers (removes spaces, punctuation, slashes)
      .trim();
  };

  const getInstitute = (q: any) => {
    let inst = q.tests?.institute || q.provider;
    if (!inst && q.test_id) {
      const parts = q.test_id.split('-');
      if (parts.length > 0) {
        const first = parts[0].toLowerCase();
        if (['forum', 'vision', 'insights', 'iasbaba', 'vajiram', 'nextias', 'pw', 'raus'].includes(first)) {
          inst = first.charAt(0).toUpperCase() + first.slice(1);
        }
      }
    }
    return inst || 'UPSC';
  };

  const getYear = (q: any): string => {
    const y = q.exam_year || q.source?.year || q.tests?.exam_year || q.tests?.launch_year || '';
    return String(y || '').trim();
  };

  questions.forEach(q => {
    let vaultMeta: any = null;
    try {
      if (q.source_attribution_label) {
        const parsed = typeof q.source_attribution_label === 'string'
          ? JSON.parse(q.source_attribution_label)
          : q.source_attribution_label;
        vaultMeta = parsed.__vaultMeta;
      }
    } catch (e) { /* ignore */ }

    // Priority 1: Official Canonical ID
    const cId = vaultMeta?.canonicalId || (vaultMeta?.isCanonical ? q.id : null) || vaultMeta?._canonicalQuestionId;

    // Priority 2: Text Match (PYQ requires same year too)
    const textKey = cleanText(q.question_text);
    const year = getYear(q);
    const isPyq = !!q.is_pyq;
    // For PYQs, attach year to key so cross-year same-stem questions don't merge
    const textKeyFinal = isPyq && year ? `${textKey}__${year}` : textKey;

    const explKey = cleanText(q.explanation_markdown);
    const explKeyFinal = isPyq && year ? `${explKey}__${year}` : explKey;

    // Priority 3: Options Match (Very aggressive)
    const optionsKey = q.options ? Object.values(q.options).sort().join('|').toLowerCase().replace(/[^\w]/g, '') : null;
    const optionsKeyFinal = isPyq && year && optionsKey ? `${optionsKey}__${year}` : optionsKey;

    let existing: any = null;

    if (cId) {
      existing = canonicalMap.get(cId);
    } else if (textKeyFinal && textKey.length > 30) {
      existing = textMap.get(textKeyFinal);
    } else if (explKeyFinal && explKey.length > 100) {
      existing = explanationMap.get(explKeyFinal);
    } else if (optionsKeyFinal && optionsKey && optionsKey.length > 50) {
      existing = optionsMap.get(optionsKeyFinal);
    }

    if (existing) {
      idToMergedId.set(q.id, existing.id);
      mergeData(existing, q, getInstitute(q));
    } else {
      prepareQuestion(q, getInstitute(q));
      if (cId) canonicalMap.set(cId, q);
      if (textKeyFinal) textMap.set(textKeyFinal, q);
      if (explKeyFinal) explanationMap.set(explKeyFinal, q);
      if (optionsKeyFinal) optionsMap.set(optionsKeyFinal, q);
      idToMergedId.set(q.id, q.id);
      mergedQs.push(q);
    }
  });

  return { mergedQs, idToMergedId };
};

const prepareQuestion = (q: any, inst: string) => {
  q._institutes = [inst];
  q._explanations = q.explanation_markdown
    ? [{ source: inst, text: q.explanation_markdown, year: q.exam_year || q.source?.year || '' }]
    : [];
  q._mergedIds = [q.id];
};

const mergeData = (existing: any, q: any, inst: string) => {
  if (!existing._institutes) existing._institutes = [existing.tests?.institute || existing.provider || 'UPSC'];
  if (!existing._institutes.includes(inst)) {
    existing._institutes.push(inst);
  }

  if (!existing._mergedIds) existing._mergedIds = [existing.id];
  if (!existing._mergedIds.includes(q.id)) existing._mergedIds.push(q.id);

  if (!existing._explanations) {
    existing._explanations = existing.explanation_markdown
      ? [{ source: existing._institutes[0], text: existing.explanation_markdown, year: existing.exam_year || existing.source?.year || '' }]
      : [];
  }

  if (q.explanation_markdown && q.explanation_markdown.trim()) {
    const qExplStripped = q.explanation_markdown.toLowerCase().replace(/[^\w\s]/g, '');
    const hasSimilar = existing._explanations.some((e: any) => {
      const eStripped = e.text.toLowerCase().replace(/[^\w\s]/g, '');
      return eStripped.includes(qExplStripped.substring(0, 100)) || qExplStripped.includes(eStripped.substring(0, 100));
    });

    if (!hasSimilar) {
      existing._explanations.push({
        source: inst,
        text: q.explanation_markdown,
        year: q.exam_year || q.source?.year || ''
      });
      // Keep the main markdown field as the first one for backward compatibility
      if (!existing.explanation_markdown) existing.explanation_markdown = q.explanation_markdown;
    }
  }
};
