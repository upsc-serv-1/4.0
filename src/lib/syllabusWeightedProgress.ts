import { supabase } from '../lib/supabase';
import { OfflineManager } from '../services/OfflineManager';
import { prelimsTaxonomy } from '../data/taxonomy';

type YearMode = 'all' | 'single' | 'range';

export interface WeightedYearFilter {
  mode: YearMode;
  singleYear?: number | null;
  startYear?: number | null;
  endYear?: number | null;
}

export interface WeightedSyllabusResult {
  topicCounts: Record<string, number>;
  sectionCounts: Record<string, number>;
  subjectCounts: Record<string, number>;
  years: number[];
}

const PAGE_SIZE = 1000;

const normalizeText = (value: any) => String(value || '').trim();
const normalizeKey = (value: any) => normalizeText(value).toLowerCase();

const normalizePaperGroup = (value = '', fallbackStage = '') => {
  const text = String(value || '').trim().toLowerCase();
  const stage = String(fallbackStage || '').trim().toLowerCase();
  if (!text) return '';
  if (text === 'gs paper 1' || text === 'paper 1' || text === 'gs1' || text === 'pre_gs1' || text.includes('gs paper 1')) return 'GS Paper 1';
  if (text === 'csat' || text === 'gs paper 2' || text === 'paper 2' || text === 'gs2' || text === 'pre_csat' || text.includes('csat') || text.includes('paper 2') || (text === 'pre_gs2' && stage.includes('prelim'))) return 'GS Paper 2';
  return normalizeText(value);
};

const getTestYear = (test: any) => {
  const extracted = String(test?.title || '').match(/(20\d{2})/)?.[1];
  const n = Number(test?.launch_year || test?.exam_year || extracted);
  return Number.isFinite(n) && n > 1900 ? n : null;
};

const getQuestionYear = (q: any, testsMetaById: Record<string, any>) => {
  const test = testsMetaById[String(q.test_id)] || {};
  const n = Number(q.exam_year || q.year || q.launch_year || q.source?.year || test.launch_year || test.exam_year);
  return Number.isFinite(n) && n > 1900 ? n : null;
};

const matchesYear = (year: number | null, filter: WeightedYearFilter) => {
  if (!year) return false;
  if (filter.mode === 'single') {
    return year === Number(filter.singleYear);
  }
  if (filter.mode === 'range') {
    const a = Number(filter.startYear);
    const b = Number(filter.endYear);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return true;
    return year >= Math.min(a, b) && year <= Math.max(a, b);
  }
  return true;
};

const buildTaxonomyMaps = () => {
  const microToSubject: Record<string, string> = {};
  const sectionToSubject: Record<string, string> = {};
  prelimsTaxonomy.forEach((entry) => {
    if (entry.microTopic) microToSubject[normalizeKey(entry.microTopic)] = entry.subject;
    if (entry.sectionGroup) sectionToSubject[normalizeKey(entry.sectionGroup)] = entry.subject;
  });
  return { microToSubject, sectionToSubject };
};

const getAnalyticsSubject = (q: any, maps: ReturnType<typeof buildTaxonomyMaps>) => {
  const micro = normalizeText(q.micro_topic);
  const section = normalizeText(q.section_group);
  const rawSubject = normalizeText(q.subject);
  const lowerSubject = rawSubject.toLowerCase();

  if (micro && maps.microToSubject[micro.toLowerCase()]) return maps.microToSubject[micro.toLowerCase()];
  if (section && maps.sectionToSubject[section.toLowerCase()]) return maps.sectionToSubject[section.toLowerCase()];

  const isCsat = /(^|\b)(csat|aptitude|comprehension|logical reasoning|maths|numeracy|paper\s*ii|paper\s*2)(\b|$)/i.test(`${rawSubject} ${section}`);
  if (isCsat) return 'CSAT';
  if (rawSubject && maps.sectionToSubject[lowerSubject]) return maps.sectionToSubject[lowerSubject];
  return rawSubject || 'Miscellaneous';
};

const fetchQuestionsForTests = async (testIds: string[]) => {
  const offlineQuestions = OfflineManager.getOfflineQuestionsAllSync() || [];
  const offlineRows = offlineQuestions.filter((q: any) => testIds.includes(q.test_id));
  if (offlineRows.length > 0) return offlineRows;

  const rows: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .in('test_id', testIds)
      .order('test_id', { ascending: true })
      .order('question_number', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
};

export async function buildWeightedSyllabusData(filter: WeightedYearFilter): Promise<WeightedSyllabusResult> {
  const maps = buildTaxonomyMaps();
  let tests: any[] = OfflineManager.getOfflineTestsSync() || [];
  if (!tests.length) {
    const { data, error } = await supabase
      .from('tests')
      .select('id, title, subject, level, paper_type, section_group, exam_year, launch_year, institute, program_id, program_name, series');
    if (error) throw error;
    tests = data || [];
  }

  const relevantTests = tests.filter((test: any) => {
    const institute = normalizeKey(test.institute);
    const programId = normalizeKey(test.program_id);
    const programName = normalizeKey(test.program_name);
    const series = normalizeKey(test.series);
    const paperType = normalizeKey(test.paper_type);
    if (institute !== 'upsc') return false;
    if (programId !== 'cse' && programName !== 'cse') return false;
    if (series !== 'prelims (official)') return false;
    if (paperType && !['test-paper', 'question bank'].includes(paperType)) return false;
    return normalizePaperGroup(test.section_group || test.sectionGroup || test.level || test.title || '', test.level || test.series || '') === 'GS Paper 1';
  });

  const visibleTests = relevantTests.filter((test: any) => matchesYear(getTestYear(test), filter));
  const testIds = visibleTests.map((test: any) => test.id);
  if (!testIds.length) {
    return { topicCounts: {}, sectionCounts: {}, subjectCounts: {}, years: [] };
  }

  const testsMetaById = Object.fromEntries(visibleTests.map((test: any) => [String(test.id), test]));
  const questions = await fetchQuestionsForTests(testIds);
  const topicCounts: Record<string, number> = {};
  const sectionCounts: Record<string, number> = {};
  const subjectCounts: Record<string, number> = {};
  const yearsSet = new Set<number>();

  questions.forEach((q) => {
    const year = getQuestionYear(q, testsMetaById);
    if (!matchesYear(year, filter)) return;
    if (year) yearsSet.add(year);

    const topic = normalizeText(q.micro_topic || q.section_group || 'Other');
    const section = normalizeText(q.section_group || 'General');
    const subject = getAnalyticsSubject(q, maps);

    topicCounts[normalizeKey(topic)] = (topicCounts[normalizeKey(topic)] || 0) + 1;
    sectionCounts[normalizeKey(section)] = (sectionCounts[normalizeKey(section)] || 0) + 1;
    subjectCounts[normalizeKey(subject)] = (subjectCounts[normalizeKey(subject)] || 0) + 1;
  });

  return {
    topicCounts,
    sectionCounts,
    subjectCounts,
    years: Array.from(yearsSet).sort((a, b) => b - a),
  };
}
