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
  const anthro1Data = require('../../mains json files/mains_anthro1_consolidated.json');
  anthro1Questions = anthro1Data.questions || [];
} catch (e) {
  console.log('[MainsLoader] Anthro1 consolidated JSON not found or failed to load:', e);
}

export function resolvePaper(q: any): string {
  const norm = normalizePaper(q.paper || 'GS1');
  if (norm === 'Optional') return 'Optional';
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
  return norm;
}

// Standardize and export
export const mainsConsolidatedQuestions: ConsolidatedQuestion[] = [
  ...gs1Questions.map((q: any) => ({ ...q, paper: resolvePaper(q) })),
  ...gs2Questions.map((q: any) => ({ ...q, paper: resolvePaper(q) })),
  ...gs3Questions.map((q: any) => ({ ...q, paper: resolvePaper(q) })),
  ...gs4Questions.map((q: any) => ({ ...q, paper: resolvePaper(q) })),
  ...anthro1Questions.map((q: any) => ({ ...q, paper: resolvePaper(q) })),
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
    
    allData = allData.concat(data);
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
    subject: q.subject,
    sectionGroup: q.section_group,
    microTopic: q.microtopic,
    subTopic: q.subtopic,
    macrotag: q.macrotag,
    microtag: q.microtag,
    hierarchy_path: q.hierarchy_path || [],
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

