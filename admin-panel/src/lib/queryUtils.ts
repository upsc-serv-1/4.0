// ==========================================================================
// Query Utilities — reusable Supabase query builders, health checks, import
// ==========================================================================

import { supabase } from './supabase';
import type { FilterDef, ImportPreviewRow } from './types';

// ── Build a dynamic question query from filters ──
export function buildQuestionQuery(filters: Record<string, any>) {
  let query: any = supabase.from('questions').select('*', { count: 'exact' });

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    switch (key) {
      case 'search':
        query = query.ilike('question_text', `%${value}%`);
        break;
      case 'subject':
        query = query.eq('subject', value);
        break;
      case 'section_group':
        query = query.eq('section_group', value);
        break;
      case 'micro_topic':
        query = query.ilike('micro_topic', `%${value}%`);
        break;
      case 'exam_year':
        query = query.eq('exam_year', parseInt(value));
        break;
      case 'exam_category':
        query = query.eq('exam_category', value);
        break;
      case 'exam_stage':
        query = query.eq('exam_stage', value);
        break;
      case 'exam_paper':
        query = query.eq('exam_paper', value);
        break;
      case 'is_pyq':
        query = query.eq('is_pyq', value === 'true' || value === true);
        break;
      case 'is_cancelled':
        query = query.eq('is_cancelled', value === 'true' || value === true);
        break;
      case 'test_id':
        query = query.eq('test_id', value);
        break;
      case 'has_correct_answer':
        if (value === 'missing') query = query.is('correct_answer', null);
        else if (value === 'present') query = query.not('correct_answer', 'is', null);
        break;
      default:
        break;
    }
  });

  return query;
}

// ── Build a dynamic test query from filters ──
export function buildTestQuery(filters: Record<string, any>) {
  let query: any = supabase.from('tests').select('*', { count: 'exact' });

  Object.entries(filters).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    switch (key) {
      case 'search':
        query = query.ilike('title', `%${value}%`);
        break;
      case 'subject':
        query = query.eq('subject', value);
        break;
      case 'level':
        query = query.eq('level', value);
        break;
      case 'paper_type':
        query = query.eq('paper_type', value);
        break;
      case 'provider':
        query = query.ilike('provider', `%${value}%`);
        break;
      case 'institute':
        query = query.ilike('institute', `%${value}%`);
        break;
      default:
        break;
    }
  });

  return query;
}

// ── Run a health check scan on a specific data quality metric ──
export async function runHealthCheck(type: string): Promise<{ count: number; items: any[] }> {
  let query: any;

  switch (type) {
    case 'missing_correct_answer':
      query = supabase.from('questions').select('id, question_text, subject, test_id').is('correct_answer', null).limit(500);
      break;
    case 'empty_option':
      query = supabase.from('questions').select('id, question_text, subject, options').not('options', 'is', null).limit(500);
      break;
    case 'blank_question_text':
      query = supabase.from('questions').select('id, question_text, test_id, subject').or('question_text.is.null,question_text.eq.').limit(500);
      break;
    case 'no_explanation':
      query = supabase.from('questions').select('id, question_text, subject, test_id').or('explanation_markdown.is.null,explanation_markdown.eq.').limit(500);
      break;
    case 'duplicate_questions':
      query = supabase.from('questions').select('id, question_text, test_id, subject').limit(2000);
      break;
    case 'orphan_cards':
      query = supabase.from('cards').select('id, question_id, front_text, subject').is('question_id', null).limit(500);
      break;
    case 'unlinked_test':
      query = supabase.from('questions').select('id, question_text, test_id, subject').is('test_id', null).limit(500);
      break;
    case 'cancelled_questions':
      query = supabase.from('questions').select('id, question_text, subject, test_id').eq('is_cancelled', true).limit(500);
      break;
    default:
      return { count: 0, items: [] };
  }

  const { data, error } = await query;
  if (error) {
    console.error(`Health check "${type}" failed:`, error);
    return { count: 0, items: [] };
  }

  // For empty_option, check option values client-side
  if (type === 'empty_option') {
    const itemsWithEmptyOptions = (data || []).filter((q: any) => {
      const opts = q.options;
      if (!opts) return false;
      return Object.values(opts).some((v: any) => v === null || v === undefined || String(v).trim() === '');
    });
    return { count: itemsWithEmptyOptions.length, items: itemsWithEmptyOptions };
  }

  // For duplicate_questions, detect duplicates client-side
  if (type === 'duplicate_questions') {
    const textMap = new Map<string, any[]>();
    (data || []).forEach((q: any) => {
      const text = (q.question_text || '').trim().toLowerCase();
      if (!text) return;
      if (!textMap.has(text)) textMap.set(text, []);
      textMap.get(text)!.push(q);
    });
    const duplicates: any[] = [];
    textMap.forEach((items) => {
      if (items.length > 1) duplicates.push(...items);
    });
    return { count: duplicates.length, items: duplicates.slice(0, 500) };
  }

  return { count: data?.length || 0, items: data || [] };
}

// ── Parse uploaded JSON file into preview rows ──
export async function parseJSONImport(file: File): Promise<ImportPreviewRow[]> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const items = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || []);

  return items.map((item: any, idx: number) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const questionText = item.question_text || item.question || item.text || '';

    if (!questionText) errors.push('Missing question text');
    if (!item.subject) warnings.push('No subject set');
    if (!item.correct_answer) warnings.push('No correct answer');

    return {
      rowNumber: idx + 1,
      questionText: String(questionText).substring(0, 100),
      subject: item.subject || null,
      sectionGroup: item.section_group || item.sectionGroup || null,
      microtopic: item.micro_topic || item.microtopic || null,
      errors,
      warnings,
    };
  });
}

// ── Parse uploaded CSV file into preview rows ──
export async function parseCSVImport(file: File): Promise<ImportPreviewRow[]> {
  // Dynamic import of papaparse
  const Papa = await import('papaparse');
  const text = await file.text();

  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const rows: ImportPreviewRow[] = results.data.map((row: any, idx: number) => {
          const errors: string[] = [];
          const warnings: string[] = [];
          const questionText = row.question_text || row.question || row.text || '';

          if (!questionText) errors.push('Missing question text');
          if (!row.subject) warnings.push('No subject set');

          return {
            rowNumber: idx + 1,
            questionText: String(questionText).substring(0, 100),
            subject: row.subject || null,
            sectionGroup: row.section_group || null,
            microtopic: row.micro_topic || null,
            errors,
            warnings,
          };
        });
        resolve(rows);
      },
      error: (err: any) => reject(err),
    });
  });
}

// ── Validate an import row against a schema ──
export function validateImportRow(row: Record<string, any>, schema: Record<string, { required?: boolean; type: string }>): string[] {
  const errors: string[] = [];
  Object.entries(schema).forEach(([field, rules]) => {
    if (rules.required && (row[field] === undefined || row[field] === null || String(row[field]).trim() === '')) {
      errors.push(`${field} is required`);
    }
  });
  return errors;
}

// ── Utility: build filter bar definitions for common pages ──
export const QUESTION_FILTERS: FilterDef[] = [
  { key: 'search', label: 'Search', type: 'text', placeholder: 'Search question text...' },
  { key: 'subject', label: 'Subject', type: 'select', placeholder: 'All subjects' },
  { key: 'section_group', label: 'Section', type: 'text', placeholder: 'Section group...' },
  { key: 'exam_year', label: 'Year', type: 'number', placeholder: 'e.g. 2024' },
  { key: 'exam_category', label: 'Category', type: 'select', placeholder: 'All categories' },
  { key: 'exam_stage', label: 'Stage', type: 'select', placeholder: 'All stages' },
  { key: 'is_pyq', label: 'PYQ', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
  { key: 'is_cancelled', label: 'Cancelled', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
  { key: 'has_correct_answer', label: 'Answer', type: 'select', options: [{ value: 'missing', label: 'Missing' }, { value: 'present', label: 'Present' }] },
];

export const TEST_FILTERS: FilterDef[] = [
  { key: 'search', label: 'Search', type: 'text', placeholder: 'Search test title...' },
  { key: 'subject', label: 'Subject', type: 'select', placeholder: 'All subjects' },
  { key: 'level', label: 'Level', type: 'select', placeholder: 'All levels' },
  { key: 'paper_type', label: 'Paper Type', type: 'select', placeholder: 'All types' },
  { key: 'provider', label: 'Provider', type: 'text', placeholder: 'Provider...' },
];