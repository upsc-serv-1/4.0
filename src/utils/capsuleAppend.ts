/**
 * Capsule append helpers — convert free-form text or quiz-engine payloads
 * into structured CapsuleBlock[] and persist them to a notebook without
 * destroying the existing content.
 *
 * Used by:
 *   - Add to Notebook flow (Capsule destination)
 *   - Quiz engine "Add explanation to my notes" pipeline (Step 8)
 *   - AI Search "Save to Capsule" action
 */
import { appendBlocksToNotebook } from '../repositories/capsuleRepo';
import type { CapsuleBlock, CapsuleBlockType } from '../types/capsule';

const newId = () => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const block = (type: CapsuleBlockType, text: string, extras: Partial<CapsuleBlock> = {}): CapsuleBlock => ({
  id: newId(), type, text, created_at: new Date().toISOString(), ...extras,
});

/**
 * Convert plain text or markdown-ish content into structured blocks.
 *  - "# Heading"            → heading
 *  - "- foo" / "* foo"      → bullet
 *  - "1. foo"               → numbered
 *  - "[ ] foo" / "[x] foo"  → checklist
 *  - "> quote"              → quote
 *  - "==text=="             → highlight
 *  - blank line             → separator (skipped)
 *  - everything else        → paragraph
 */
export function textToCapsuleBlocks(input: string): CapsuleBlock[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n');
  const out: CapsuleBlock[] = [];
  let numberedCounter = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { numberedCounter = 0; continue; }

    if (/^#{1,3}\s+/.test(line)) {
      const level = (line.match(/^#+/)?.[0].length || 1) as 1 | 2 | 3;
      out.push(block('heading', line.replace(/^#+\s+/, ''), { level }));
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      out.push(block('bullet', line.replace(/^[-*]\s+/, '')));
      continue;
    }
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      numberedCounter++;
      out.push(block('numbered', numMatch[2], { meta: { index: numberedCounter } }));
      continue;
    }
    const checkMatch = line.match(/^\[( |x|X)\]\s+(.*)$/);
    if (checkMatch) {
      out.push(block('checklist', checkMatch[2], { checked: checkMatch[1].toLowerCase() === 'x' }));
      continue;
    }
    if (line.startsWith('>')) {
      out.push(block('quote', line.replace(/^>\s*/, '')));
      continue;
    }
    const hi = line.match(/^==([\s\S]+)==$/);
    if (hi) {
      out.push(block('highlight', hi[1], { highlightColor: '#FFF3B0' }));
      continue;
    }
    out.push(block('paragraph', line));
  }

  return out;
}

/**
 * Append a single text payload (e.g. quiz explanation, AI answer) to a
 * Capsule notebook as structured blocks. Caller may pass a pre-heading
 * (e.g. "Article 14 explanation") that becomes a heading block separating
 * this append from the existing content.
 */
export async function appendTextToCapsule(input: {
  noteId: string;
  text: string;
  heading?: string;
  source?: string;
}): Promise<boolean> {
  const blocks: CapsuleBlock[] = [];
  if (input.heading) blocks.push(block('heading', input.heading, { level: 2 }));
  blocks.push(...textToCapsuleBlocks(input.text));
  if (input.source) {
    blocks.push(block('paragraph', `— from ${input.source}`, { meta: { kind: 'source' } }));
  }
  if (blocks.length === 0) return false;
  return appendBlocksToNotebook(input.noteId, blocks);
}
