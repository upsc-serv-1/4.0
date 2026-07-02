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
}

export function normalizePaper(paper: string | null | undefined): string {
  if (!paper) return '';
  const p = paper.trim().toUpperCase();
  if (p.includes('GS1') || p.includes('GS-1') || p === 'GS-I' || p === 'GSI') return 'GS1';
  if (p.includes('GS2') || p.includes('GS-2') || p === 'GS-II' || p === 'GSII') return 'GS2';
  if (p.includes('GS3') || p.includes('GS-3') || p === 'GS-III' || p === 'GSIII') return 'GS3';
  if (p.includes('GS4') || p.includes('GS-4') || p === 'GS-IV' || p === 'GSIV') return 'GS4';
  if (p.includes('ESSAY')) return 'Essay';
  if (p.includes('OPTIONAL')) return 'Optional';
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

// Standardize and export
export const mainsConsolidatedQuestions: ConsolidatedQuestion[] = [
  ...gs1Questions.map((q: any) => ({ ...q, paper: normalizePaper(q.hierarchy_path?.[0] || 'GS1') })),
  ...gs2Questions.map((q: any) => ({ ...q, paper: normalizePaper(q.hierarchy_path?.[0] || 'GS2') })),
  ...gs3Questions.map((q: any) => ({ ...q, paper: normalizePaper(q.hierarchy_path?.[0] || 'GS3') })),
  ...gs4Questions.map((q: any) => ({ ...q, paper: normalizePaper(q.hierarchy_path?.[0] || 'GS4') })),
  ...anthro1Questions.map((q: any) => ({ ...q, paper: normalizePaper(q.hierarchy_path?.[0] || 'Anthro1') })),
];

import { supabase } from '../lib/supabase';

export async function fetchMainsQuestionsFromSupabase(): Promise<ConsolidatedQuestion[]> {
  const { data, error } = await supabase
    .from('mains_questions')
    .select('*, answers:mains_answers(*)');
  
  if (error) {
    throw error;
  }
  
  return (data || []).map((q: any) => ({
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
    paper: normalizePaper(q.hierarchy_path?.[0] || q.paper || 'GS1'),
    answers: (q.answers || []).map((ans: any) => ({
      id: ans.id,
      institute: ans.institute,
      answerText: ans.answer_text,
    }))
  }));
}

