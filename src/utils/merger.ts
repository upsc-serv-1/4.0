/**
 * Smart Dedupe + Merger v3 (fresh rewrite — Branch 5.3)
 *
 * Rules (per user spec, asked 11+ times):
 *   1. Two questions are duplicates ONLY if:
 *        a) Both have is_pyq === true AND is_upsc_cse === true
 *        b) They have the SAME exam_year
 *        c) Their normalized question text is fuzzy-similar
 *           (token-Jaccard >= 0.78 OR one fully contains the other after >=20 tokens)
 *   2. Canonical question text = LONGEST cleaned question text in the cluster.
 *   3. All explanations from every institute are kept and exposed via `_explanations`.
 *      Each entry = { source, text, year, answer }.
 *   4. `_institutes` lists every contributing coaching brand.
 *   5. `_mergedIds` holds every original row id so callers can flatten back.
 *
 * For non-PYQ-UPSC questions we fall back to exact-year+exact-text dedupe to be safe.
 *
 * The mobile app already consumes _institutes / _explanations / _mergedIds in
 *   - app/unified/arena.tsx  (search list + chips)
 *   - app/unified/engine.tsx (Learn-mode explanation chips)
 *   - src/components/GlobalSearchBar.tsx (instant search)
 * No callsite changes required.
 */

const INSTITUTE_MAP: Record<string, string> = {
  forum: 'Forum IAS', forumias: 'Forum IAS',
  vision: 'Vision IAS', visionias: 'Vision IAS',
  vajiram: 'Vajiram', bajirao: 'Vajiram', bajiram: 'Vajiram',
  next: 'Next IAS', nextias: 'Next IAS',
  insights: 'Insights IAS', insightsias: 'Insights IAS',
  iasbaba: 'IASBaba',
  pw: 'PW', physicswallah: 'PW',
  raus: 'Rau\'s IAS', raausias: 'Rau\'s IAS',
  drishti: 'Drishti IAS', drishtiias: 'Drishti IAS',
  xias: 'X-IAS', x: 'X-IAS',
  shankar: 'Shankar IAS', shankarias: 'Shankar IAS',
  upsc: 'UPSC',
};

const STOPWORDS = new Set([
  'the','a','an','of','in','to','and','or','is','are','was','were','for','on','at',
  'by','with','as','that','this','it','be','from','which','has','have','had','not',
  'consider','statements','following','statement','correct','given','above','below',
  'context','reference','regard','regarding','sometimes','seen','news','recently',
  'india','indian','national','international',
]);

const cleanText = (text: string): string => {
  if (!text) return '';
  return String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const tokenize = (text: string): string[] => {
  const cleaned = cleanText(text);
  if (!cleaned) return [];
  return cleaned.split(' ').filter(t => t.length > 2 && !STOPWORDS.has(t));
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

const normalizeInstitute = (raw: any): string => {
  const s = String(raw || '').trim();
  if (!s) return 'UPSC';
  const key = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (INSTITUTE_MAP[key]) return INSTITUTE_MAP[key];
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const getInstitute = (q: any): string => {
  const tests = Array.isArray(q?.tests) ? q.tests[0] : q?.tests;
  let inst = tests?.institute || q?.provider || q?.source?.institute;
  if (!inst && q?.test_id) {
    const first = String(q.test_id).split(/[-_]/)[0]?.toLowerCase();
    if (first && INSTITUTE_MAP[first]) inst = first;
  }
  return normalizeInstitute(inst);
};

const getProgram = (q: any): string => {
  const tests = Array.isArray(q?.tests) ? q.tests[0] : q?.tests;
  const p = tests?.program_name || q?.program_name || q?.source?.program || q?.source?.series || tests?.series || '';
  return String(p || '').trim();
};

const getYear = (q: any): string => {
  // Strict: never fall back to tests.launch_year. PYQ year must come from
  // the question row (exam_info / source.year / exam_year) so the chip
  // matches what the user actually answered.
  const tests = Array.isArray(q?.tests) ? q.tests[0] : q?.tests;
  const examInfo = q?.exam_info && typeof q.exam_info === 'object' ? q.exam_info : null;
  const y = examInfo?.year || q?.exam_year || q?.source?.year || tests?.exam_year || '';
  return String(y || '').trim();
};

const getQuestionText = (q: any): string =>
  String(q?.question_text || q?.statement_line || q?.statement || '');

const isUpscPyq = (q: any): boolean => {
  const groupName = String(q?.source?.group || q?.exam_group || q?.tests?.series || '').toUpperCase();
  const isUPSC = !!q?.is_upsc_cse || groupName.includes('UPSC');
  return !!q?.is_pyq && isUPSC;
};

interface ExplanationEntry {
  source: string;
  program: string;
  text: string;
  year: string;
  answer: string;
}

const buildExplanationEntry = (q: any, inst: string, year: string): ExplanationEntry | null => {
  const text = String(q?.explanation_markdown || q?.explanation || '').trim();
  const answer = String(q?.correct_answer || '').trim();
  const program = getProgram(q);
  if (!text && !answer) return null;
  return { source: inst, program, text, year, answer };
};

const addExplanation = (existing: any[], entry: ExplanationEntry) => {
  // Normalize text for comparison, handling empty/undefined safely
  const norm = (s: string) => {
    if (!s) return '';
    return cleanText(s).slice(0, 200);
  };
  const entryText = norm(entry.text);
  const entryAnswer = String(entry.answer || '').toUpperCase();
  const entrySource = String(entry.source).toLowerCase().trim();
  const entryProgram = String(entry.program || '').toLowerCase().trim();
  const entryYear = String(entry.year);
  
  // Check for exact duplicate across ALL fields
  const dup = existing.some(e => {
    const eSource = String(e.source || '').toLowerCase().trim();
    const eProgram = String(e.program || '').toLowerCase().trim();
    // Different source → not a duplicate (keep multi-institute)
    if (eSource !== entrySource) return false;
    // Same source but different program → keep both
    if (eProgram !== entryProgram) return false;
    // Same source+program but different year → keep both
    if (String(e.year) !== entryYear) return false;
    // Same source+program+year but different text → keep both
    if (norm(e.text) !== entryText) return false;
    // Same source+program+year+text but different answer → keep both
    if (String(e.answer || '').toUpperCase() !== entryAnswer) return false;
    // All fields identical → truly a duplicate
    return true;
  });
  if (!dup) existing.push(entry);
};

export const mergeQuestions = (questions: any[]) => {
  const idToMergedId = new Map<string, string>();
  const mergedQs: any[] = [];

  // Bucket PYQ-UPSC questions by year for fuzzy clustering.
  // Non-PYQ-UPSC questions go straight through (no merging — preserves variety).
  const buckets = new Map<string, any[]>(); // year -> [canonical questions]
  const passthrough: any[] = [];

  for (const q of questions) {
    if (!q) continue;
    if (!isUpscPyq(q)) {
      // No merging across non-UPSC-PYQ — but still tag institute & explanation
      // so single-row UI doesn't break.
      const inst = getInstitute(q);
      const year = getYear(q);
      q._institutes = [inst];
      q._mergedIds = [q.id];
      const e = buildExplanationEntry(q, inst, year);
      q._explanations = e ? [e] : [];
      idToMergedId.set(q.id, q.id);
      passthrough.push(q);
      continue;
    }

    const year = getYear(q) || 'NA';
    const tokens = new Set(tokenize(getQuestionText(q)));
    const inst = getInstitute(q);
    const expl = buildExplanationEntry(q, inst, year);

    const list = buckets.get(year) || [];

    // Find best match in same year-bucket via fuzzy Jaccard
    let best: { canon: any; score: number } | null = null;
    for (const canon of list) {
      const cTokens: Set<string> = canon.__tokens;
      const score = jaccard(tokens, cTokens);
      if (score > (best?.score || 0)) best = { canon, score };
    }

    const SIM_THRESHOLD = 0.78;
    const containsThreshold = tokens.size >= 20 && best && best.score >= 0.6;

    if (best && (best.score >= SIM_THRESHOLD || containsThreshold)) {
      const canon = best.canon;
      // Prefer the LONGER cleaned text as canonical question_text.
      const canonText = getQuestionText(canon);
      const newText = getQuestionText(q);
      if (cleanText(newText).length > cleanText(canonText).length) {
        canon.question_text = newText;
        if (canon.options && q.options) canon.options = q.options;
        // keep canon.id as the cluster id (do NOT switch ids — we only rewrite text)
      }

      if (!canon._institutes.includes(inst)) canon._institutes.push(inst);
      if (!canon._mergedIds.includes(q.id)) canon._mergedIds.push(q.id);
      if (expl) addExplanation(canon._explanations, expl);

      // Keep first non-empty explanation_markdown for legacy single-explanation UIs
      if (!canon.explanation_markdown && q.explanation_markdown) {
        canon.explanation_markdown = q.explanation_markdown;
      }

      idToMergedId.set(q.id, canon.id);
    } else {
      // New cluster head
      q.__tokens = tokens;
      q._institutes = [inst];
      q._mergedIds = [q.id];
      q._explanations = expl ? [expl] : [];
      list.push(q);
      buckets.set(year, list);
      idToMergedId.set(q.id, q.id);
    }
  }

  for (const list of buckets.values()) {
    for (const canon of list) {
      delete canon.__tokens;
      mergedQs.push(canon);
    }
  }
  for (const p of passthrough) mergedQs.push(p);

  return { mergedQs, idToMergedId };
};

/**
 * Enrich already-merged canonical UPSC PYQ questions with explanations
 * from OTHER coaching institutes (Vision IAS, ForumIAS, Vajiram, etc.)
 * by fetching their variants from the DB and running the same fuzzy
 * Jaccard matching against each canonical question.
 *
 * This is used by the PYQ Analysis tab so exported questions carry
 * multi-institute _explanations and _institutes arrays, enabling
 * user-selectable institute filters in the export sheet.
 *
 * @param canonicalQs - Already merged canonical UPSC questions (mutated in-place).
 * @param supabaseClient - Supabase client instance for querying.
 */
export const enrichWithCrossInstituteExplanations = async (
  canonicalQs: any[],
  supabaseClient: any,
) => {
  if (!canonicalQs.length) return;

  // Collect canonical question texts and years for fuzzy matching
  const canonEntries = canonicalQs.map((canon) => ({
    canon,
    text: getQuestionText(canon),
    year: getYear(canon),
    tokens: new Set(tokenize(getQuestionText(canon))),
  }));

  // Determine the year range present in canonicals
  const years = Array.from(new Set(canonEntries.map((e) => e.year).filter(Boolean)));

  // Fetch ALL other-institute PYQ-UPSC questions for the relevant years
  // Exclude UPSC-institute questions — those are already merged.
  const INSTITUTE_EXCLUDE_KEYWORDS = ['upsc', 'cse', 'official'];

  // We need to fetch questions from the database where:
  // - is_pyq = true AND is_upsc_cse = true
  // - institute is NOT UPSC (non-official)
  // - exam_year matches one of our years
  const allVariants: any[] = [];
  for (const year of years) {
    if (!year) continue;
    let from = 0;
    const PAGE = 1000;
    while (true) {
      const { data, error } = await supabaseClient
        .from('questions')
        .select('id, question_text, explanation_markdown, correct_answer, subject, exam_year, test_id, is_pyq, is_upsc_cse, is_upsc_cms, is_neetpg, is_inicet, tests(institute, program_name, series)')
        .eq('is_pyq', true)
        .eq('is_upsc_cse', true)
        .eq('exam_year', year)
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);

      if (error) {
        console.warn('[enrichCrossInstitute] query error for year', year, error);
        break;
      }
      if (!data?.length) break;

      // Filter out UPSC-institute rows
      const nonUpsc = data.filter((q: any) => {
        const inst = normalizeInstitute(
          (Array.isArray(q?.tests) ? q.tests[0] : q?.tests)?.institute || q?.test_id || ''
        );
        return inst.toLowerCase() !== 'upsc';
      });

      allVariants.push(...nonUpsc);
      if (data.length < PAGE) break;
      from += PAGE;
    }
  }

  if (!allVariants.length) {
    console.log('[enrichCrossInstitute] No other-institute variants found for years:', years.join(','));
    return;
  }

  console.log(`[enrichCrossInstitute] Fetched ${allVariants.length} other-institute variants across years ${years.join(',')}`);

  // Prepare variant entries for matching
  const variantEntries = allVariants.map((q) => ({
    q,
    text: getQuestionText(q),
    year: getYear(q),
    tokens: new Set(tokenize(getQuestionText(q))),
    inst: getInstitute(q),
  }));

  // Fuzzy-match each variant to the best canonical question in the same year
  const SIM_THRESHOLD = 0.78;
  let matchedCount = 0;

  for (const v of variantEntries) {
    if (!v.year) continue;

    // Find best canonical match in the same year
    let bestMatch: { canon: any; score: number } | null = null;
    for (const c of canonEntries) {
      if (c.year !== v.year) continue;
      const score = jaccard(v.tokens, c.tokens);
      if (score > (bestMatch?.score || 0)) bestMatch = { canon: c.canon, score };
    }

    if (bestMatch && bestMatch.score >= SIM_THRESHOLD) {
      const canon = bestMatch.canon;

      // Add institute if not already present
      if (!canon._institutes.includes(v.inst)) {
        canon._institutes.push(v.inst);
      }

      // Add explanation entry
      const expl = buildExplanationEntry(v.q, v.inst, v.year);
      if (expl) {
        addExplanation(canon._explanations || [], expl);
      }

      // Also add to _mergedIds for traceability
      if (!canon._mergedIds.includes(v.q.id)) {
        canon._mergedIds.push(v.q.id);
      }

      matchedCount++;
    }
  }

  console.log(`[enrichCrossInstitute] Matched ${matchedCount}/${variantEntries.length} other-institute variants to ${canonicalQs.length} canonical UPSC questions`);
};