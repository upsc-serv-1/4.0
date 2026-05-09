/**
 * Smart Block Matcher (gap #5)
 * ----------------------------
 * Given a piece of imported content (e.g. a quiz selection) and a target
 * notebook's current blocks, suggest the most relevant *heading block*
 * the import should append under. Falls back to a fast keyword overlap
 * heuristic so it works fully offline (Expo Go).
 *
 * Example use case:
 *   - User saves "GDP fell 7.5% in FY21" from a quiz.
 *   - Notebook contains: "GDP Implications", "Imports & Exports", "Inflation".
 *   - This module returns "GDP Implications" with confidence 0.81.
 */
import { PilotV2Block } from './types';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'as', 'at',
  'this', 'that', 'these', 'those', 'it', 'its', 'from', 'into', 'about',
  'than', 'then', 'so', 'such', 'no', 'not', 'but', 'has', 'have', 'had',
]);

export interface BlockMatch {
  blockId: string;
  blockText: string;
  score: number;          // 0..1 confidence
  reason: 'keyword' | 'exact' | 'low';
}

/** Tokenise text into normalised lowercase words minus stopwords. */
const tokenise = (text: string): string[] => {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
};

/** Jaccard similarity between two token sets. */
const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((t) => { if (b.has(t)) intersection += 1; });
  const union = new Set([...a, ...b]);
  return intersection / Math.max(1, union.size);
};

/**
 * Score every heading block in the notebook against the imported content
 * and return them in descending order. Top result is the recommended
 * append target.
 */
export function suggestBlockMatches(
  importedText: string,
  blocks: PilotV2Block[],
  topK = 5,
): BlockMatch[] {
  if (!importedText || !blocks?.length) return [];

  const importTokens = new Set(tokenise(importedText));
  const headings = blocks.filter((b) => b.type === 'heading' && b.text.trim());

  const scored: BlockMatch[] = headings.map((h) => {
    const text = h.text;
    const tokens = new Set(tokenise(text));
    let score = jaccard(importTokens, tokens);

    // Boost: exact substring match of any 2+ word phrase (min 8 chars to
    // avoid over-matching common heading prefixes like "The Indian").
    const importedLc = importedText.toLowerCase();
    const headingLc = text.toLowerCase();
    if (importedLc.includes(headingLc)) score = Math.max(score, 0.95);
    else {
      const firstTwo = headingLc.split(/\s+/).slice(0, 2).join(' ');
      if (firstTwo.length >= 8 && importedLc.includes(firstTwo)) {
        score = Math.max(score, 0.6);
      }
    }

    return {
      blockId: h.id,
      blockText: text,
      score,
      reason: score > 0.9 ? 'exact' : score > 0.15 ? 'keyword' : 'low',
    };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Convenience — returns just the best match (or null when no headings). */
export function bestBlockMatch(
  importedText: string,
  blocks: PilotV2Block[],
): BlockMatch | null {
  const list = suggestBlockMatches(importedText, blocks, 1);
  if (!list.length || list[0].score < 0.05) return null;
  return list[0];
}
