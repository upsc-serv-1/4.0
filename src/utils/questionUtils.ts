
export const toBool = (value: any) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }
  return false;
};

export const getExamInfo = (item: any) => {
  if (item?.exam_info && typeof item.exam_info === 'object' && !Array.isArray(item.exam_info)) return item.exam_info;
  if (item?.source && typeof item.source === 'object' && !Array.isArray(item.source)) return item.source;
  return {} as any;
};

export const normalizeInstituteLabel = (i: string) => {
  const s = String(i || '').trim().replace(/\s+/g, ' ');
  return s || 'Primary';
};

export const extractYearFromText = (value: any): string => {
  const match = String(value || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
};

export const normalizeProgramLabel = (p: string) => {
  const raw = String(p || '').trim();
  if (raw.toLowerCase() === 'upsc') return 'Civil Services';
  return raw.toUpperCase();
};

export const normalizeExplText = (value: any): string =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const buildCanonicalExplanations = (item: any) => {
  const list = Array.isArray(item?._explanations) ? item._explanations : [];
  const out: any[] = [];
  const seen = new Map<string, number>();

  const pushEntry = (entry: any) => {
    const source = normalizeInstituteLabel(entry?.source || entry?.institute || entry?.provider || entry?.tests?.institute || item?.tests?.institute || item?.source?.institute || 'Primary');
    const sourceKey = source.toLowerCase();
    const rawProgram = String(entry?.program || item?.tests?.program_name || '').trim();
    const program = normalizeProgramLabel(rawProgram);
    const year = String(entry?.year || item?.exam_year || extractYearFromText(rawProgram) || '').trim();
    const answer = String(entry?.answer || item?.correct_answer || '').trim().toUpperCase();
    const text = String(entry?.text || entry?.explanation || '').trim();

    if (!text && !answer) return;

    const dedupeKey = `${sourceKey}__${program.toLowerCase()}__${answer}__${normalizeExplText(text)}`;
    const existingIdx = seen.get(dedupeKey);

    if (existingIdx !== undefined) {
      const existing = out[existingIdx];
      if (!existing.year && year) existing.year = year;
      if (!existing.text && text) existing.text = text;
      return;
    }

    seen.set(dedupeKey, out.length);
    out.push({ source, sourceKey, program, year, answer, text });
  };

  list.forEach((e: any) => pushEntry(e));

  if (item?.explanation_markdown) {
    pushEntry({
      source: item?.tests?.institute || item?.source?.institute || 'Primary',
      program: item?.tests?.program_name || '',
      year: item?.exam_year || '',
      answer: item?.correct_answer || '',
      text: item?.explanation_markdown,
    });
  }

  return out;
};

export const getPYQCategorization = (item: any) => {
  const examInfo = getExamInfo(item);
  const isPYQ = toBool(item?.is_pyq);

  if (!isPYQ) {
    return {
      hasPYQData: false,
      isUPSC: false,
      isAllied: false,
      isOther: false,
      isGenericPYQ: false,
      groupName: '',
      year: '',
    };
  }

  let rawGroup = String(examInfo?.group || examInfo?.exam_name || '').trim();
  if (!rawGroup && item?.exam_group) {
    rawGroup = String(item.exam_group).trim();
  }
  const groupNameUpper = rawGroup.toUpperCase();

  const isUPSC = toBool(examInfo?.is_upsc_cse) || toBool(item?.is_upsc_cse) || groupNameUpper === 'UPSC' || groupNameUpper.includes('UPSC CSE') || groupNameUpper.includes('IAS');
  const isAllied = toBool(examInfo?.is_allied) || toBool(item?.is_allied) || ['CAPF', 'CDS', 'NDA', 'EPFO', 'CISF', 'ALLIED'].some(g => groupNameUpper.includes(g));
  const isOther = toBool(examInfo?.is_others) || toBool(item?.is_others) || ['UPPCS', 'BPSC', 'MPSC', 'RPSC', 'UKPSC', 'MPPSC', 'CGPSC', 'STATE PSC', 'OTHER'].some(g => groupNameUpper.includes(g));

  const rawYear = examInfo?.year ?? '';
  let year = typeof rawYear === 'string' ? rawYear.trim() : String(rawYear).trim();

  if (!year) {
    const colYear = item?.exam_year;
    if (colYear !== undefined && colYear !== null && String(colYear).trim()) {
      year = String(colYear).trim();
    }
  }

  if (!rawGroup && !year) {
    return {
      hasPYQData: false,
      isUPSC: false,
      isAllied: false,
      isOther: false,
      isGenericPYQ: true, // Tagged as PYQ but missing metadata
      groupName: 'PYQ',
      year: '',
    };
  }

  let displayGroup = rawGroup || (isUPSC ? 'Civil Services' : isAllied ? 'Allied' : isOther ? 'Other' : 'PYQ');

  if (displayGroup) {
    const hasMains = displayGroup.toLowerCase().includes('mains');
    if (hasMains) {
      // Keep UPSC, but remove CSE
      displayGroup = displayGroup
        .replace(/upsc\s+cse/gi, 'UPSC')
        .replace(/cse/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    } else {
      // Remove both UPSC and CSE
      displayGroup = displayGroup
        .replace(/upsc\s+cse/gi, '')
        .replace(/upsc/gi, '')
        .replace(/cse/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }

  if (!displayGroup && !year) {
    return {
      hasPYQData: false,
      isUPSC,
      isAllied,
      isOther,
      isGenericPYQ: true,
      groupName: 'PYQ',
      year: '',
    };
  }

  return {
    hasPYQData: true,
    isUPSC,
    isAllied,
    isOther,
    isGenericPYQ: !isUPSC && !isAllied && !isOther,
    groupName: displayGroup,
    year,
  };
};
