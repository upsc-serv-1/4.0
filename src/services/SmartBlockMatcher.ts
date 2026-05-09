/**
 * SmartBlockMatcher — picks the most likely existing block for an incoming
 * snippet of text (typically a quiz import).
 *
 * Design goals (per PILOT_V2_GAPS.md):
 *   • OFFLINE-FIRST  — runs entirely on-device with zero network for the common
 *     path. The user must not see any lag while the export sheet opens, even
 *     for notebooks with hundreds of blocks.
 *   • OPTIONAL AI ASSIST — if the user has Groq / Gemini / OpenRouter wired up
 *     via the existing GeminiService.ts settings, callers can opt-in to a
 *     ranking pass that re-ranks the top offline candidates for higher quality
 *     suggestions. We never block the UI on this — it always falls back to the
 *     offline result.
 *   • CRASH-PROOF    — accepts both legacy flat blocks (`PilotV2Block[]`) and
 *     the new nested blocks (`PilotV2NestedBlock[]`) via the
 *     `ensureNestedBlocks` converter from `types.ts`.
 *
 * Algorithm (offline):
 *   1. Tokenise both the candidate text and each block's plain-text projection
 *      (block name + heading + every child element).
 *   2. Score with a hybrid: Jaccard set similarity + token-frequency cosine,
 *      averaged. This gives reasonable performance without TF-IDF lookups.
 *   3. Boost the user's last-edited / last-used block if the snippet was
 *      authored within the last 30 minutes.
 *   4. Boost direct keyword hits in the block name (e.g. "GDP Implications" →
 *      "GDP" hit gives the block a strong nudge).
 *   5. Return the best candidate above the configured threshold (default 0.18)
 *      together with a confidence score and the runner-up list for the UI.
 *
 * Algorithm (AI assist, optional):
 *   • Sends the snippet + the top-K offline candidate names to the user's
 *     configured AI provider (`callAI` from GeminiService) and asks for a
 *     1-line index pick. Robust to bad output: if the response is not a valid
 *     index, the offline best stays.
 */

import {
  PilotV2Block,
  PilotV2NestedBlock,
  ensureNestedBlocks,
  nestedBlockPlainText,
  PilotV2UserPreferences,
} from '../components/pilot-v2/types';

/* ------------------------------------------------------------------------- */
/* Tokenisation                                                               */
/* ------------------------------------------------------------------------- */

const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'or', 'but', 'the', 'is', 'are', 'was', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'them',
  'his', 'her', 'its', 'our', 'their', 'in', 'on', 'at', 'by', 'for', 'with',
  'about', 'against', 'between', 'into', 'through', 'during', 'before',
  'after', 'above', 'below', 'to', 'from', 'up', 'down', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'of', 'as', 'so', 'if', 'than',
  'too', 'very', 'no', 'not', 'just', 'also', 'such', 'only', 'same', 'most',
  'each', 'all', 'any', 'some', 'few', 'more', 'less', 'other', 'own', 'who',
  'what', 'which', 'when', 'where', 'why', 'how',
]);

/** Lowercase + strip punctuation + remove stopwords + drop tokens shorter than 2 chars. */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/g, ' ')
    .replace(/[\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return [];
  return cleaned
    .split(' ')
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

/** Build a frequency map from a token list. */
function freqMap(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

/** Jaccard similarity of two token sets. */
function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  // Iterate over the smaller set for speed.
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  smaller.forEach(t => { if (larger.has(t)) intersect++; });
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

/** Cosine similarity of two frequency maps. */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  a.forEach((va, key) => {
    magA += va * va;
    const vb = b.get(key);
    if (vb) dot += va * vb;
  });
  b.forEach(vb => { magB += vb * vb; });
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/** Top-N keyword extraction by raw frequency (used by the keyword-hit boost). */
export function extractKeywords(text: string, limit = 8): string[] {
  const tokens = tokenize(text);
  const freq = freqMap(tokens);
  return Array.from(freq.entries())
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([t]) => t);
}

/* ------------------------------------------------------------------------- */
/* Scoring                                                                    */
/* ------------------------------------------------------------------------- */

export interface BlockMatchCandidate {
  block: PilotV2NestedBlock;
  /** 0..1 final confidence. */
  confidence: number;
  /** Raw breakdown — handy for tooltip / debugging. */
  scores: {
    jaccard: number;
    cosine: number;
    keywordBoost: number;
    recencyBoost: number;
    nameHitBoost: number;
  };
}

export interface SuggestOptions {
  /** Cutoff under which `null` is returned for the top match. Default 0.18. */
  threshold?: number;
  /** How many runners-up to return alongside the best match. Default 5. */
  topK?: number;
  /** User preferences (drives recency boost on the last-used block). */
  preferences?: PilotV2UserPreferences | null;
  /** Override the "now" timestamp — testing only. */
  now?: number;
}

const DEFAULT_THRESHOLD = 0.18;
const DEFAULT_TOPK = 5;
const RECENCY_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

/** Compute one candidate's confidence + breakdown. */
function scoreBlock(
  blockTokens: string[],
  block: PilotV2NestedBlock,
  inputTokens: string[],
  inputKeywords: string[],
  preferences: PilotV2UserPreferences | null | undefined,
  now: number
): BlockMatchCandidate {
  const inputSet = new Set(inputTokens);
  const blockSet = new Set(blockTokens);
  const inputFreq = freqMap(inputTokens);
  const blockFreq = freqMap(blockTokens);

  const jaccard = jaccardSimilarity(inputSet, blockSet);
  const cosine = cosineSimilarity(inputFreq, blockFreq);

  // Keyword boost: how many of the input's top keywords appear in the block's
  // *name* (not body). A direct name match ("GDP" in "GDP Implications") is a
  // very strong signal.
  const blockName = (block.customName || block.blockName || '').toLowerCase();
  let nameHits = 0;
  for (const kw of inputKeywords) {
    if (blockName.includes(kw)) nameHits++;
  }
  const nameHitBoost = inputKeywords.length === 0
    ? 0
    : Math.min(0.35, nameHits / inputKeywords.length * 0.35);

  // Generic keyword boost — how many of the input's top keywords appear
  // anywhere in the block (body included).
  let bodyHits = 0;
  for (const kw of inputKeywords) {
    if (blockSet.has(kw)) bodyHits++;
  }
  const keywordBoost = inputKeywords.length === 0
    ? 0
    : Math.min(0.15, bodyHits / inputKeywords.length * 0.15);

  // Recency boost — last-edited or last-used block, only if updated recently.
  let recencyBoost = 0;
  const lastUsedId = preferences?.lastUsedBlockId;
  if (lastUsedId && lastUsedId === block.id) {
    const updatedTs = block.updatedAt ? new Date(block.updatedAt).getTime() : 0;
    if (updatedTs > 0 && now - updatedTs <= RECENCY_WINDOW_MS) {
      recencyBoost = 0.15;
    } else {
      recencyBoost = 0.05; // Weaker boost outside the recency window.
    }
  }

  // Final blended score. Weights chosen empirically — keep them close to 1.0
  // so a perfect Jaccard + cosine match alone can clear the threshold.
  const blended =
    jaccard * 0.45 +
    cosine * 0.35 +
    nameHitBoost +
    keywordBoost +
    recencyBoost;

  const confidence = Math.max(0, Math.min(1, blended));

  return {
    block,
    confidence,
    scores: { jaccard, cosine, keywordBoost, recencyBoost, nameHitBoost },
  };
}

export interface SuggestResult {
  best: BlockMatchCandidate | null;
  ranked: BlockMatchCandidate[];
  /** True if no block scored above the threshold. */
  fellThroughThreshold: boolean;
}

/**
 * Pure offline matcher — synchronous and lag-free even on 500+ block notebooks.
 * Returns the best candidate (or null) and the ranked top-K for the UI list.
 */
export function suggestBestMatchingBlockOffline(
  userContent: string,
  availableBlocks: PilotV2Block[] | PilotV2NestedBlock[] | null | undefined,
  options: SuggestOptions = {}
): SuggestResult {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const topK = Math.max(1, options.topK ?? DEFAULT_TOPK);
  const now = options.now ?? Date.now();
  const preferences = options.preferences;

  const nested = ensureNestedBlocks(availableBlocks as any);
  if (nested.length === 0) {
    return { best: null, ranked: [], fellThroughThreshold: true };
  }

  const inputTokens = tokenize(userContent);
  const inputKeywords = extractKeywords(userContent, 8);

  // Empty input — nothing to match against, surface the last-used block (if
  // any) or the first block as a soft default so the UI always has *something*
  // selectable.
  if (inputTokens.length === 0) {
    const fallback = preferences?.lastUsedBlockId
      ? nested.find(b => b.id === preferences.lastUsedBlockId) ?? nested[0]
      : nested[0];
    const fallbackCandidate: BlockMatchCandidate = {
      block: fallback,
      confidence: 0,
      scores: { jaccard: 0, cosine: 0, keywordBoost: 0, recencyBoost: 0, nameHitBoost: 0 },
    };
    return { best: null, ranked: [fallbackCandidate], fellThroughThreshold: true };
  }

  const candidates: BlockMatchCandidate[] = nested.map(block => {
    const blockText = nestedBlockPlainText(block);
    const blockTokens = tokenize(blockText);
    return scoreBlock(blockTokens, block, inputTokens, inputKeywords, preferences, now);
  });

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  const ranked = candidates.slice(0, topK);
  const fellThroughThreshold = !best || best.confidence < threshold;

  return {
    best: fellThroughThreshold ? null : best,
    ranked,
    fellThroughThreshold,
  };
}

/* ------------------------------------------------------------------------- */
/* Optional AI assist                                                         */
/* ------------------------------------------------------------------------- */

interface AiAssistOptions extends SuggestOptions {
  /** When true, attempts a single AI re-rank of the top-K offline candidates. */
  useAi?: boolean;
  /** Hard cap (ms) on the AI call; falls back to offline on timeout. Default 4000. */
  aiTimeoutMs?: number;
}

const AI_DEFAULT_TIMEOUT_MS = 4000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race<T | null>([
    promise.then(v => v as T),
    new Promise<null>(resolve => setTimeout(() => resolve(null), ms)),
  ]).catch(() => null);
}

/**
 * AI re-rank — sends a tiny prompt to the user's configured AI provider asking
 * which of the top-K offline candidates is the closest match. The response is
 * intentionally constrained to a single integer index so we can parse it
 * defensively. Any failure falls back to the offline winner.
 *
 * The provider routing reuses `callAI` indirectly through the lazy import of
 * `GeminiService` (Groq / Gemini / OpenRouter selectable in the user's
 * Settings → AI Settings panel). No new SDK is introduced.
 */
async function aiRerank(
  userContent: string,
  ranked: BlockMatchCandidate[],
  timeoutMs: number
): Promise<BlockMatchCandidate | null> {
  if (ranked.length <= 1) return ranked[0] ?? null;

  // Build a short, fixed-format prompt — keep token cost minimal.
  const list = ranked
    .map((c, i) => `${i + 1}. ${c.block.customName || c.block.blockName}`)
    .join('\n');
  const prompt = `You are a study-notes router. Pick the single block whose topic best matches the snippet.

SNIPPET (max 600 chars):
${userContent.slice(0, 600)}

CANDIDATE BLOCKS:
${list}

Respond with ONLY the candidate number (e.g. "2"). No explanation.`;

  // Lazy import to avoid pulling AsyncStorage / fetch on the offline path.
  let aiText: string | null = null;
  try {
    const mod = await import('./GeminiService');
    // `callAI` is internal in GeminiService — fall back via aiAskDoubt which
    // wraps the same router. Both end up at the user's configured provider.
    const responder = (mod as any).aiAskDoubt as
      | ((q: string, ctx: any) => Promise<string>)
      | undefined;
    if (typeof responder !== 'function') return null;
    aiText = await withTimeout(responder(prompt, {}), timeoutMs);
  } catch {
    return null;
  }
  if (!aiText) return null;

  const match = aiText.match(/\d+/);
  if (!match) return null;
  const idx = parseInt(match[0], 10) - 1;
  if (Number.isNaN(idx) || idx < 0 || idx >= ranked.length) return null;
  return ranked[idx];
}

/**
 * Public entry — async wrapper that runs the offline matcher synchronously
 * first (so the caller can render an instant suggestion), then optionally
 * upgrades the result via AI re-rank. Always resolves with the offline winner
 * if AI is unavailable / disabled / fails / times out.
 */
export async function suggestBestMatchingBlock(
  userContent: string,
  availableBlocks: PilotV2Block[] | PilotV2NestedBlock[] | null | undefined,
  options: AiAssistOptions = {}
): Promise<SuggestResult> {
  const offline = suggestBestMatchingBlockOffline(userContent, availableBlocks, options);
  if (!options.useAi) return offline;

  // Only re-rank when we have a meaningful set of candidates AND offline gave
  // us at least one above-threshold result; otherwise the AI call adds latency
  // for nothing.
  if (offline.ranked.length <= 1 || offline.fellThroughThreshold) {
    return offline;
  }

  const timeout = options.aiTimeoutMs ?? AI_DEFAULT_TIMEOUT_MS;
  const aiPick = await aiRerank(userContent, offline.ranked, timeout);
  if (!aiPick) return offline;

  // Promote the AI pick to `best` while keeping the offline ranking visible.
  return {
    best: aiPick,
    ranked: offline.ranked,
    fellThroughThreshold: false,
  };
}

/* ------------------------------------------------------------------------- */
/* Local search filter                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Lightweight client-side block-list filter — used by the export sheet's
 * search input so the user can narrow down to a specific block in O(blocks)
 * without re-running the matcher. Matches against block name + plain-text body.
 */
export function filterBlocksByQuery(
  blocks: (PilotV2Block | PilotV2NestedBlock)[] | null | undefined,
  query: string
): PilotV2NestedBlock[] {
  const nested = ensureNestedBlocks(blocks as any);
  const trimmed = (query || '').trim().toLowerCase();
  if (!trimmed) return nested;
  return nested.filter(b => {
    const name = (b.customName || b.blockName || '').toLowerCase();
    if (name.includes(trimmed)) return true;
    return nestedBlockPlainText(b).toLowerCase().includes(trimmed);
  });
}
