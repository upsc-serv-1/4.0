/**
 * Shared Topper Copies Domain Layer & Helper Library
 * Location: src/utils/topperHelpers.ts
 *
 * Implements:
 * - Genuine topper answer & question identification
 * - False positive filtering (test series headings, generic institute series)
 * - Candidate name extraction & cleaning
 * - AIR rank extraction & normalization
 * - Page/image URL parsing with fallback to markdown images
 * - Paper normalization (GS1..GS4, Essay, Optional)
 * - Deterministic question key normalization for deduplication & attachment
 * - Dataset filtering & deduplication
 * - Topper attachment map generator for Question Bank integration
 */

import { parseImageUrls } from './imageHelpers';
import type { ConsolidatedQuestion, ConsolidatedAnswer } from '../data/mainsConsolidatedLoader';

export type { ConsolidatedQuestion, ConsolidatedAnswer };

export type QuestionBankFeedItem =
  | { kind: 'question'; data: ConsolidatedQuestion; attachedToppers: ConsolidatedAnswer[] }
  | { kind: 'valueAdd'; data: any }
  | { kind: 'topper'; data: ConsolidatedQuestion; topperAnswer: ConsolidatedAnswer };

/**
 * Non-topper institute strings to filter out if accidentally stored in `topper` field.
 */
export const NON_TOPPER_INSTITUTES = [
  'level up',
  'level up ias',
  'pw only',
  'pw onlyias',
  'ies',
  'ies master',
  'forumias',
  'forum ias',
  'vision ias',
  'visionias',
  'vajiram',
  'vajiram & ravi',
  'vajiram and ravi',
  'drishti',
  'drishti ias',
  'next ias',
  'unacademy',
  'insights ias',
  'iasbaba',
  'shankar ias',
];

/**
 * Patterns matching generic test series headings or model answers that may contain
 * the word "topper" or test labels without an actual topper individual.
 */
export const TEST_SERIES_FALSE_POSITIVES = [
  /\bgs\s*mains\s*test\b/i,
  /\bmains\s*test\s*(?:series|\d+)/i,
  /\btest\s*series\b/i,
  /\bopen\s*test\b/i,
  /\bmock\s*test\b/i,
  /\bfull\s*length\s*test\b/i,
  /\bflt\b/i,
  /\bmodel\s*answer\b/i,
  /\bsample\s*answer\b/i,
  /\bsynopsis\b/i,
  /\bbatch\b/i,
  /\bcourse\b/i,
  /\bassignment\b/i,
  /\b(?:daily\s*)?(?:answer\s*)?practice\b/i,
  /\bdaily\s*(?:answer)?\b/i,
  /\bmentorship\b/i,
  /\binitiative\b/i,
  /\bprogram(?:me)?\b/i,
  /\bdiscussion\b/i,
];

/**
 * Normalizes paper string to canonical representation ('GS1', 'GS2', 'GS3', 'GS4', 'Essay', 'Optional').
 */
export function normalizePaper(paper: string | number | null | undefined): string {
  if (paper === null || paper === undefined) return '';
  const str = typeof paper === 'string' ? paper : String(paper);
  const trimmed = str.trim();
  if (!trimmed) return '';
  const p = trimmed.toUpperCase();

  // Check Optional first so subject papers like "Anthropology Paper 2" are not misclassified as GS2
  if (
    p.includes('OPTIONAL') ||
    p.includes('ANTHRO') ||
    p.includes('SOCIO') ||
    p.includes('PSIR') ||
    p.includes('GEOGRAPHY') ||
    p.includes('HISTORY') ||
    p.includes('PUBLIC ADMINISTRATION') ||
    p.includes('POLITICAL SCIENCE') ||
    p === 'ANTHRO1' ||
    p === 'ANTHRO2' ||
    p === 'SOCIO1' ||
    p === 'SOCIO2'
  ) {
    return 'Optional';
  }

  // Generalized Optional detection:
  // If paper ends with Paper 1/2 or Paper I/II and is NOT GS/General Studies/Essay and NOT standalone PAPER 1/2
  const endsWithPaper1Or2 = /(?:^|\s+)PAPER\s*[-:]?\s*(?:1|2|I|II)$/i.test(p);
  const isExplicitGS =
    p.includes('GS') ||
    p.includes('GENERAL STUDIES') ||
    p === 'PAPER 1' ||
    p === 'PAPER-1' ||
    p === 'PAPER I' ||
    p === 'PAPER 2' ||
    p === 'PAPER-2' ||
    p === 'PAPER II';

  if (endsWithPaper1Or2 && !isExplicitGS && !p.includes('ESSAY')) {
    return 'Optional';
  }

  if (p.includes('ESSAY')) return 'Essay';

  // Evaluate GS4, GS3, GS2, GS1 in descending order to avoid Roman numeral prefix collisions (e.g. Paper I vs II/III/IV)
  if (
    p.includes('GS4') ||
    p.includes('GS-4') ||
    p.includes('GS 4') ||
    p.includes('PAPER 4') ||
    p.includes('PAPER-4') ||
    p.includes('PAPER IV') ||
    p === 'GS-IV' ||
    p === 'GSIV' ||
    p.includes('GENERAL STUDIES 4') ||
    p.includes('GENERAL STUDIES IV')
  ) {
    return 'GS4';
  }
  if (
    p.includes('GS3') ||
    p.includes('GS-3') ||
    p.includes('GS 3') ||
    p.includes('PAPER 3') ||
    p.includes('PAPER-3') ||
    p.includes('PAPER III') ||
    p === 'GS-III' ||
    p === 'GSIII' ||
    p.includes('GENERAL STUDIES 3') ||
    p.includes('GENERAL STUDIES III')
  ) {
    return 'GS3';
  }
  if (
    p.includes('GS2') ||
    p.includes('GS-2') ||
    p.includes('GS 2') ||
    p.includes('PAPER 2') ||
    p.includes('PAPER-2') ||
    p.includes('PAPER II') ||
    p === 'GS-II' ||
    p === 'GSII' ||
    p.includes('GENERAL STUDIES 2') ||
    p.includes('GENERAL STUDIES II')
  ) {
    return 'GS2';
  }
  if (
    p.includes('GS1') ||
    p.includes('GS-1') ||
    p.includes('GS 1') ||
    p.includes('PAPER 1') ||
    p.includes('PAPER-1') ||
    /\bPAPER\s*[-:]?\s*I\b/i.test(p) ||
    p === 'GS-I' ||
    p === 'GSI' ||
    p.includes('GENERAL STUDIES 1') ||
    /\bGENERAL\s*STUDIES\s*[-:]?\s*I\b/i.test(p)
  ) {
    return 'GS1';
  }
  return trimmed;
}

/**
 * Validates whether an AIR rank representation is genuine (numeric or valid rank string),
 * rejecting placeholders like 'N/A', 'None', 'null', 'undefined' or 4-digit exam years (1900-2099).
 */
export function isValidAirRank(val: any): boolean {
  if (val === undefined || val === null) return false;
  if (typeof val === 'number') {
    return val >= 0 && !(val >= 1900 && val <= 2099);
  }
  const str = String(val).trim();
  if (!str) return false;
  const lower = str.toLowerCase();
  if (lower === 'n/a' || lower === 'none' || lower === 'null' || lower === 'undefined') {
    return false;
  }
  const match = str.match(/\b(?:AIR\s*[-:]?\s*|Rank\s*[-:]?\s*)?(\d+)\b/i);
  if (!match) return false;
  const num = Number(match[1]);
  if (num >= 1900 && num <= 2099) return false;
  return true;
}

/**
 * Extracts the All India Rank (AIR) from an answer or question.
 * Checks `air`, `air_rank`, `institute`, and `topper` fields.
 * Returns clean numeric string or number (e.g. 59 or 3), or undefined if not found.
 */
export function getAir(
  a?: ConsolidatedAnswer | any | null,
  q?: ConsolidatedQuestion | any | null
): string | number | undefined {
  if (!a && !q) return undefined;

  const candidateAir = a?.air ?? a?.air_rank ?? q?.air_rank;
  if (candidateAir !== undefined && candidateAir !== null) {
    if (typeof candidateAir === 'number') {
      if (candidateAir >= 1900 && candidateAir <= 2099) return undefined;
      return candidateAir;
    }
    const str = String(candidateAir).trim();
    if (str.length > 0) {
      const lower = str.toLowerCase();
      if (lower === 'none' || lower === 'null' || lower === 'undefined') {
        return undefined;
      }
      const match = str.match(/\b(?:AIR\s*[-:]?\s*|Rank\s*[-:]?\s*)?(\d+)\b/i);
      if (match) {
        const val = Number(match[1]);
        if (val >= 1900 && val <= 2099) return undefined;
        return val;
      }
      return str;
    }
  }

  // Check institute field: e.g. "Vision IAS (AIR 59)" or "ForumIAS AIR 1" or "Uma Harathi N (AIR 3)"
  if (a?.institute && typeof a.institute === 'string') {
    const isTestSeries = TEST_SERIES_FALSE_POSITIVES.some(pat => pat.test(a.institute));
    if (!isTestSeries) {
      const match = a.institute.match(/\bAIR\s*[-:]?\s*(\d+)\b/i);
      if (match) {
        const val = Number(match[1]);
        if (!(val >= 1900 && val <= 2099)) {
          return val;
        }
      }
    }
  }

  // Check topper string field: e.g. "Shruti Sharma (AIR 1)"
  const topperNameStr =
    typeof a?.topper === 'string'
      ? a.topper
      : typeof a?.topper_name === 'string'
      ? a.topper_name
      : '';
  if (topperNameStr) {
    const isTestSeries = TEST_SERIES_FALSE_POSITIVES.some(pat => pat.test(topperNameStr));
    if (!isTestSeries) {
      const match = topperNameStr.match(/\bAIR\s*[-:]?\s*(\d+)\b/i);
      if (match) {
        const val = Number(match[1]);
        if (!(val >= 1900 && val <= 2099)) {
          return val;
        }
      }
    }
  }

  return undefined;
}

/**
 * Strict helper to identify genuine topper answers.
 * Filters out regular institute series (Level Up, PW Only, IES) and generic test series
 * (e.g. 'GS Mains Test 1 Topper') that merely contain scanned images or keywords without rank/topper.
 */
export function isGenuineTopperAnswer(a?: ConsolidatedAnswer | any | null): boolean {
  if (!a) return false;

  // 1. Explicit boolean flags
  if (a.is_topper === true || (a as any).topper === true) return true;

  // 2. Explicit AIR rank on answer (validating not 'N/A' or exam year)
  if (isValidAirRank(a.air) || isValidAirRank(a.air_rank)) return true;

  // 3. Topper candidate name field
  const topperStr =
    typeof a.topper === 'string'
      ? a.topper.trim()
      : typeof a.topper_name === 'string'
      ? a.topper_name.trim()
      : '';
  if (topperStr.length > 0) {
    const t = topperStr.toLowerCase();
    const isNonTopperInst = NON_TOPPER_INSTITUTES.some(
      inst => t === inst || t.startsWith(inst + ' ') || t.endsWith(' ' + inst)
    );
    const isTestSeries = TEST_SERIES_FALSE_POSITIVES.some(pat => pat.test(t));
    if (!isNonTopperInst && !isTestSeries) {
      return true;
    }
  }

  // 4. Institute field containing explicit AIR or topper keywords (excluding test series false positives)
  if (a.institute && typeof a.institute === 'string') {
    const inst = a.institute.trim();
    const isTestSeries = TEST_SERIES_FALSE_POSITIVES.some(pat => pat.test(inst));
    if (!isTestSeries) {
      const match = inst.match(/\bAIR\s*[-:]?\s*(\d+)\b/i);
      if (match) {
        const val = Number(match[1]);
        if (!(val >= 1900 && val <= 2099)) {
          return true;
        }
      }

      if (/\btopper\b/i.test(inst)) {
        const lowerInst = inst.toLowerCase();
        const isNonTopper = NON_TOPPER_INSTITUTES.some(
          nonInst => lowerInst === nonInst || lowerInst === nonInst + ' topper'
        );
        if (!isNonTopper) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Alias for isGenuineTopperAnswer for consistent cross-module naming.
 */
export function isTopperAnswer(a?: ConsolidatedAnswer | any | null): boolean {
  return isGenuineTopperAnswer(a);
}

/**
 * Determines whether a question is a topper copy question.
 * Returns true if the question is explicitly marked as a topper copy or
 * contains at least one genuine topper answer.
 */
export function isTopperQuestion(q?: ConsolidatedQuestion | any | null): boolean {
  if (!q) return false;
  if (q.is_topper_copy === true) return true;
  if (typeof q.id === 'string' && q.id.startsWith('topper-')) return true;
  if (Array.isArray(q.answers)) {
    return q.answers.some((a: any) => isGenuineTopperAnswer(a));
  }
  return false;
}

/**
 * Extracts and cleans the topper name from an answer or question.
 * Handles candidate names, cleans out AIR annotations (e.g. '(AIR 1)'),
 * strips institute prefixes, and falls back to 'Topper' if unavailable.
 */
export function getTopperName(
  a?: ConsolidatedAnswer | any | null,
  q?: ConsolidatedQuestion | any | null
): string {
  if (!a && !q) return 'Topper';

  let rawName = '';
  let fromTopperField = false;

  if (typeof a?.topper === 'string' && a.topper.trim().length > 0) {
    rawName = a.topper.trim();
    fromTopperField = true;
  } else if (typeof a?.topper_name === 'string' && a.topper_name.trim().length > 0) {
    rawName = a.topper_name.trim();
    fromTopperField = true;
  } else if (typeof q?.topper_name === 'string' && q.topper_name.trim().length > 0) {
    rawName = q.topper_name.trim();
    fromTopperField = true;
  } else if (a?.institute && typeof a.institute === 'string') {
    rawName = a.institute
      .replace(/\s*\([^\)]*AIR\s*\d+[^\)]*\)/i, '')
      .replace(/\bAIR\s*[-:]?\s*\d+\b/gi, '')
      .replace(/^topper\s*(?:copy)?\s*[-:]?\s*/i, '')
      .replace(/\s*-\s*topper$/i, '')
      .trim();
  }

  if (!rawName) return 'Topper';

  // Strip '(AIR 59)' or 'AIR 59' from name if present
  const cleanName = rawName
    .replace(/\s*\(\s*AIR\s*[-:]?\s*\d+\s*\)/gi, '')
    .replace(/\bAIR\s*[-:]?\s*\d+\b/gi, '')
    .replace(/^topper\s*(?:copy)?\s*[-:]?\s*/i, '')
    .replace(/\s*-\s*topper$/i, '')
    .trim();

  const t = cleanName.toLowerCase();

  // If the candidate or institute was a test series false positive, never use it as candidate name
  const isTestSeries = TEST_SERIES_FALSE_POSITIVES.some(pat => pat.test(t));
  if (isTestSeries) {
    return 'Topper';
  }

  // Guard against non-topper institutes accidentally returned as candidate name
  // If from topper field (candidate name), always reject non-topper institute strings.
  // If from institute field without parenthesized rank (e.g. "ForumIAS AIR 5"), reject institute as person name.
  // But if from institute with parenthesized rank (e.g. "Vision IAS (AIR 59)"), preserve the cleaned name.
  const hasParenthesizedAir = Boolean(
    a?.institute && typeof a.institute === 'string' && /\([^\)]*AIR\s*\d+[^\)]*\)/i.test(a.institute)
  );
  if (fromTopperField || !hasParenthesizedAir) {
    const isNonTopperInst = NON_TOPPER_INSTITUTES.some(
      inst => t === inst || t.startsWith(inst + ' ') || t.endsWith(' ' + inst)
    );
    if (isNonTopperInst) {
      return 'Topper';
    }
  }

  return cleanName || 'Topper';
}

/**
 * Resolves scanned copy page URLs from an answer.
 * Inspects `page_urls`, `image_urls`, parsed JSON strings, delimiter strings,
 * and markdown image fallbacks in answerText.
 */
export function getTopperPageUrls(a?: ConsolidatedAnswer | any | null): string[] {
  if (!a) return [];

  const raw = a.page_urls ?? a.image_urls ?? a.pageUrls ?? a.imageUrls;

  if (Array.isArray(raw)) {
    const urls = raw.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
    if (urls.length > 0) return urls;
  } else if (typeof raw === 'string' && raw.trim().length > 0) {
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((u): u is string => typeof u === 'string' && u.trim().length > 0);
          if (valid.length > 0) return valid;
        }
      } catch (e) {}
    }
    // Check delimiter fallback for comma, newline, pipe, or semicolon separated URLs
    const splitUrls = trimmed
      .split(/[\r\n,;|]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0 && (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('file://')));
    if (splitUrls.length > 0) return splitUrls;

    const parsed = parseImageUrls(raw);
    if (parsed.length > 0) return parsed;
  }

  // Fallback: extract markdown image URLs from answerText
  const text =
    typeof a.answerText === 'string'
      ? a.answerText
      : typeof a.answer_text === 'string'
      ? a.answer_text
      : '';
  if (text) {
    const matches = [...text.matchAll(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g)].map(m => m[1].trim());
    if (matches.length > 0) return matches;
  }

  return [];
}

/**
 * Normalizes question metadata into a deterministic key for cross-dataset deduplication and attachment.
 * Format: `${year}_${normalizedPaper}_${collapsedQuestionText}`
 * Question text is stripped of leading question numbers (e.g. 'Q1.', '1(a)', '1 -'), punctuation is removed,
 * and whitespace is collapsed.
 */
export function normalizeQuestionKey(q?: {
  year?: any;
  topper_year?: any;
  paper?: string;
  questionText?: string;
  question_text?: string;
  title?: string;
  question?: string;
  [key: string]: any;
} | null): string {
  if (!q) return '';

  const rawCandidate =
    q.questionText ??
    q.question_text ??
    q.title ??
    q.question ??
    '';

  const rawText = (typeof rawCandidate === 'string' ? rawCandidate : String(rawCandidate ?? '')).trim();
  if (!rawText) return '';

  // Strip leading question numbers/labels:
  // e.g. "1.", "(1)", "[1]", "Q.1", "Q1.", "Q1:", "Question 1:", "1(a)", "1. (a)", "1 - ", "(a)"
  // Does NOT strip 4-digit numbers/years in content like "1991 economic reforms..."
  const strippedNumber = rawText.replace(
    /^(?:(?:question|q)\s*\.?\s*\d{1,2}(?:\s*[\.\:\)\-\/]\s*|\s+)?(?:\([a-z0-9]+\)\s*)?|[\(\[]\s*\d{1,2}\s*[\)\]]\s*(?:\([a-z0-9]+\)\s*)?|\d{1,2}\s*(?:\([a-z0-9]+\)|[\.\:\)\-\/])\s*(?:\([a-z0-9]+\)\s*)?|\(\s*[a-z0-9]+\s*\)\s*)/i,
    ''
  );

  // Lowercase, strip all non-alphanumerics to collapse spaces, hyphens, punctuation
  const collapsedText = strippedNumber
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  if (!collapsedText) return '';

  const rawYear = q.year ?? q.topper_year ?? '';
  const year = rawYear ? String(rawYear).trim() : '';

  const normalizedPaper = normalizePaper(q.paper).toLowerCase();

  return `${year}_${normalizedPaper}_${collapsedText}`;
}

/**
 * Ingests a consolidated question dataset, deduplicates by id, and returns only questions
 * that contain at least one genuine topper answer with at least one scanned page URL.
 * Direct parity with TopperCopiesView ingestion pipeline.
 */
export function getAllTopperQuestions<T extends { id?: string; answers?: any[]; [key: string]: any } = ConsolidatedQuestion>(
  questions?: T[] | null
): T[] {
  if (!Array.isArray(questions)) return [];

  const seen = new Set<string>();
  const uniqueList: T[] = [];
  for (const item of questions) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      uniqueList.push(item);
    }
  }

  return uniqueList.filter(q => {
    if (!q.answers || !Array.isArray(q.answers) || q.answers.length === 0) return false;
    return q.answers.some(a => {
      if (!isGenuineTopperAnswer(a)) return false;
      const pageUrls = getTopperPageUrls(a);
      return pageUrls.length > 0;
    });
  });
}

/**
 * Builds a lookup map from normalizeQuestionKey -> ConsolidatedAnswer[]
 * Enables O(1) attachment of topper answers to normal Question Bank questions.
 */
export function buildTopperAttachmentMap<T extends { answers?: any[]; [key: string]: any } = ConsolidatedQuestion>(
  topperQuestions?: T[] | null
): Map<string, ConsolidatedAnswer[]> {
  const map = new Map<string, ConsolidatedAnswer[]>();
  if (!Array.isArray(topperQuestions)) return map;

  for (const tq of topperQuestions) {
    const key = normalizeQuestionKey(tq);
    if (!key) continue;

    const genuineAnswers = (tq.answers || []).filter(
      a => isGenuineTopperAnswer(a) && getTopperPageUrls(a).length > 0
    );
    if (genuineAnswers.length === 0) continue;

    const existing = map.get(key) || [];
    const existingIds = new Set(existing.map(a => a.id).filter(Boolean));
    const toAdd = genuineAnswers.filter(a => !a.id || !existingIds.has(a.id));
    map.set(key, [...existing, ...toAdd]);
  }

  return map;
}
