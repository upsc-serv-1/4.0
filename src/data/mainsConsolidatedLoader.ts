export interface ConsolidatedAnswer {
  id: string;
  institute: string;
  answerText: string;
}

export interface ConsolidatedQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  marks: number;
  year: number;
  subject: string;
  sectionGroup: string;
  microTopic: string;
  subTopic: string;
  nanoTopic?: string;
  macrotag: string;
  microtag: string;
  hierarchy_path: string[];
  answers: ConsolidatedAnswer[];
  paper: string; // Dynamic field mapped from hierarchy_path[0]
  is_pyq?: boolean;
  source_attribution_label?: string | null;
  exam_info?: any;
  stage?: string;
  exam?: string;
  exam_group?: string;
  is_upsc_cse?: boolean;
  is_allied?: boolean;
  is_others?: boolean;
  exam_category?: string;
  course?: string;
  institute?: string;
  program_id?: string;
  program_name?: string;
}

export function normalizePaper(paper: string | null | undefined): string {
  if (!paper) return '';
  const p = paper.trim().toUpperCase();
  if (p.includes('GS1') || p.includes('GS-1') || p === 'GS-I' || p === 'GSI') return 'GS1';
  if (p.includes('GS2') || p.includes('GS-2') || p === 'GS-II' || p === 'GSII') return 'GS2';
  if (p.includes('GS3') || p.includes('GS-3') || p === 'GS-III' || p === 'GSIII') return 'GS3';
  if (p.includes('GS4') || p.includes('GS-4') || p === 'GS-IV' || p === 'GSIV') return 'GS4';
  if (p.includes('ESSAY')) return 'Essay';
  if (p.includes('OPTIONAL') || p.includes('ANTHRO') || p === 'ANTHRO1') return 'Optional';
  return paper;
}

export function normalizeSubject(subject: string | null | undefined): string {
  if (!subject) return '';
  const s = subject.trim().toUpperCase();
  if (s === 'ETHICS' || s.includes('INTEGRITY') || s.includes('APTITUDE')) {
    return 'ETHICS, INTEGRITY & APTITUDE';
  }
  if (s === 'ECONOMY' || s === 'INDIAN ECONOMY') {
    return 'INDIAN ECONOMY';
  }
  if (s === 'SCIENCE AND TECHNOLOGY' || s === 'SCIENCE & TECHNOLOGY' || s === 'S&T') {
    return 'SCIENCE & TECHNOLOGY';
  }
  if (s === 'INTERNATIONAL RELATIONS' || s === 'IR') {
    return 'INTERNATIONAL RELATIONS';
  }
  if (s === 'SOCIAL JUSTICE' || s === 'JUSTICE') {
    return 'SOCIAL JUSTICE';
  }
  if (s === 'INTERNAL SECURITY' || s === 'SECURITY') {
    return 'INTERNAL SECURITY';
  }
  if (s === 'DISASTER MANAGEMENT' || s === 'DM') {
    return 'DISASTER MANAGEMENT';
  }
  return s;
}

// Statically load the parsed consolidated JSON files
let gs1Questions: any[] = [];
let gs2Questions: any[] = [];
let gs3Questions: any[] = [];
let gs4Questions: any[] = [];

try {
  const gs1Data = require('../../mains json files/mains_gs1_consolidated.json');
  gs1Questions = gs1Data.questions || [];
} catch (e) {
  console.log('[MainsLoader] GS1 consolidated JSON not found or failed to load:', e);
}

try {
  const gs2Data = require('../../mains json files/mains_gs2_consolidated.json');
  gs2Questions = gs2Data.questions || [];
} catch (e) {
  console.log('[MainsLoader] GS2 consolidated JSON not found or failed to load:', e);
}

try {
  const gs3Data = require('../../mains json files/mains_gs3_consolidated.json');
  gs3Questions = gs3Data.questions || [];
} catch (e) {
  console.log('[MainsLoader] GS3 consolidated JSON not found or failed to load:', e);
}

try {
  const gs4Data = require('../../mains json files/mains_gs4_consolidated.json');
  gs4Questions = gs4Data.questions || [];
} catch (e) {
  console.log('[MainsLoader] GS4 consolidated JSON not found or failed to load:', e);
}

let anthro1Questions: any[] = [];
try {
  const anthro1Pre = require('../../mains json files/mains_anthro1_pre2012.json');
  const anthro1New = require('../../mains json files/mains_anthro1_new_consolidated.json');
  anthro1Questions = [...(anthro1Pre.questions || []), ...(anthro1New.questions || [])];
} catch (e) {
  console.log('[MainsLoader] Anthro1 JSON files failed to load:', e);
}

let anthro2Questions: any[] = [];
try {
  const anthro2Pre = require('../../mains json files/mains_anthro2_pre2012.json');
  const anthro2New = require('../../mains json files/mains_anthro2_new_consolidated.json');
  anthro2Questions = [...(anthro2Pre.questions || []), ...(anthro2New.questions || [])];
} catch (e) {
  console.log('[MainsLoader] Anthro2 JSON files failed to load:', e);
}

export function resolvePaper(q: any): string {
  const norm = normalizePaper(q.paper);
  if (norm && ['GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional'].includes(norm)) {
    return norm;
  }
  if (q.hierarchy_path && q.hierarchy_path.length > 0) {
    const first = q.hierarchy_path[0];
    if (first === 'Anthropology' || first === 'Anthro1' || first.toUpperCase().includes('ANTHRO') || first.toUpperCase().includes('OPTIONAL')) {
      return 'Optional';
    } else {
      const second = q.hierarchy_path[1];
      if (second && (second === 'Anthropology' || second.toUpperCase().includes('ANTHRO') || second.toUpperCase().includes('OPTIONAL'))) {
        return 'Optional';
      }
      return normalizePaper(first);
    }
  }
  return norm || 'GS1';
}

// Load Forum MGP questions
let forumMGPQuestions: any[] = [];
const loadMGP = (numStr: string) => {
  try {
    switch(numStr) {
      case '01': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t01se.json').questions || [];
      case '02': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t02se.json').questions || [];
      case '03': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t03se.json').questions || [];
      case '04': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t04se.json').questions || [];
      case '05': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t05se.json').questions || [];
      case '06': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t06se.json').questions || [];
      case '07': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t07se.json').questions || [];
      case '08': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t08se.json').questions || [];
      case '09': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t09se.json').questions || [];
      case '10': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t10se.json').questions || [];
      case '11': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t11se.json').questions || [];
      case '12': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t12se.json').questions || [];
      case '13': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t13se.json').questions || [];
      case '14': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t14se.json').questions || [];
      case '15': return require('../../mains json files/forum mgp 2026/forum-mgp-2026-csm26t15se.json').questions || [];
      default: return [];
    }
  } catch (e) {
    console.log(`[MainsLoader] Forum MGP ${numStr} failed to load:`, e);
    return [];
  }
};

for (let i = 1; i <= 15; i++) {
  const pad = i.toString().padStart(2, '0');
  forumMGPQuestions = forumMGPQuestions.concat(loadMGP(pad));
}

// Standardize and export
export const mainsConsolidatedQuestions: ConsolidatedQuestion[] = [
  ...gs1Questions.map((q: any) => ({ ...q, subject: normalizeSubject(q.subject), paper: resolvePaper(q) })),
  ...gs2Questions.map((q: any) => ({ ...q, subject: normalizeSubject(q.subject), paper: resolvePaper(q) })),
  ...gs3Questions.map((q: any) => ({ ...q, subject: normalizeSubject(q.subject), paper: resolvePaper(q) })),
  ...gs4Questions.map((q: any) => ({ ...q, subject: normalizeSubject(q.subject), paper: resolvePaper(q) })),
  ...anthro1Questions.map((q: any) => ({ ...q, subject: normalizeSubject(q.subject), paper: resolvePaper(q) })),
  ...anthro2Questions.map((q: any) => ({ ...q, subject: normalizeSubject(q.subject), paper: resolvePaper(q) })),
  ...forumMGPQuestions.map((q: any) => ({ ...q, subject: normalizeSubject(q.subject), paper: resolvePaper(q), is_pyq: q.is_pyq || false })),
];

import { supabase } from '../lib/supabase';

export async function fetchMainsQuestionsFromSupabase(): Promise<ConsolidatedQuestion[]> {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('mains_questions')
      .select('*, answers:mains_answers(*)')
      .range(from, from + step - 1);
      
    if (error) {
      throw error;
    }
    
    if (!data || data.length === 0) {
      break;
    }
    
    const publishedData = data.filter((row: any) => row.status === undefined || row.status === 'published');
    allData = allData.concat(publishedData);
    if (data.length < step) {
      break;
    }
    from += step;
  }
  
  return allData.map((q: any) => ({
    id: q.id,
    questionNumber: q.question_number,
    questionText: q.question_text,
    marks: q.marks,
    year: q.exam_year,
    subject: normalizeSubject(q.subject),
    sectionGroup: q.section_group || q.sectionGroup || q.sectiongroup || '',
    microTopic: q.microtopic || q.micro_topic || q.microTopic || '',
    subTopic: q.subtopic || q.sub_topic || q.subTopic || '',
    nanoTopic: q.nanotopic || q.nano_topic || q.nanoTopic || '',
    macrotag: q.macrotag || q.macro_tag || '',
    microtag: q.microtag || q.micro_tag || '',
    hierarchy_path: q.hierarchy_path || q.hierarchyPath || [],
    paper: resolvePaper(q),
    is_pyq: q.is_pyq,
    source_attribution_label: q.source_attribution_label,
    exam_info: q.exam_info,
    stage: q.stage,
    exam: q.exam,
    exam_group: q.exam_group,
    is_upsc_cse: q.is_upsc_cse,
    is_allied: q.is_allied,
    is_others: q.is_others,
    exam_category: q.exam_category,
    course: q.course,
    institute: q.institute,
    program_id: q.program_id,
    program_name: q.program_name,
    answers: (q.answers || []).map((ans: any) => ({
      id: ans.id,
      institute: ans.institute,
      answerText: ans.answer_text,
    }))
  }));
}

