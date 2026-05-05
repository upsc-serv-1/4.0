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

const getYear = (q: any): string => {
  const y = q?.exam_year || q?.source?.year || q?.tests?.exam_year || q?.tests?.launch_year || '';
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
  text: string;
  year: string;
  answer: string;
}

const buildExplanationEntry = (q: any, inst: string, year: string): ExplanationEntry | null => {
  const text = String(q?.explanation_markdown || q?.explanation || '').trim();
  const answer = String(q?.correct_answer || '').trim();
  if (!text && !answer) return null;
  return { source: inst, text, year, answer };
};

const addExplanation = (existing: any[], entry: ExplanationEntry) => {
  const norm = (s: string) => cleanText(s).slice(0, 200);
  const dup = existing.some(e =>
    String(e.source).toLowerCase() === entry.source.toLowerCase() &&
    String(e.year) === entry.year &&
    norm(e.text) === norm(entry.text) &&
    String(e.answer || '').toUpperCase() === String(entry.answer || '').toUpperCase()
  );
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
