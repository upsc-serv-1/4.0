/**
 * pilotV2Migration — Step 8 backward-compatibility converter
 * ----------------------------------------------------------
 * Old Pilot V2 notes were stored as a flat block array without any pencil
 * strokes field. New notes store `{ blocks, version, pencilStrokes }`.
 *
 * This module shapes any legacy content into the new schema BEFORE it
 * reaches the editor so users on the latest build never see crashes when
 * opening a note that was created before the Phase-3 pencil release.
 *
 * Also normalises:
 *   • Missing `version` (defaults to 1)
 *   • Missing `pencilStrokes` (defaults to [])
 *   • Block `meta.tag` values (used by Step 8 block-tag badges)
 *   • Stroke `anchor` fields (Step 6+) — assigned retroactively for legacy
 *     notes using estimated block layout heights so strokes track reorders.
 */
import {
  PilotV2Block,
  PilotV2Note,
  PilotV2NoteContent,
  PilotV2PencilStroke,
} from './types';

const TARGET_VERSION = 2;

/** Convert any legacy `note.content` to the latest schema. */
export function migratePilotV2NoteContent(
  raw: any,
): PilotV2NoteContent {
  if (!raw || typeof raw !== 'object') {
    return { blocks: [], version: TARGET_VERSION, pencilStrokes: [] };
  }

  // Case 1: very old shape — `content` is itself the block array.
  if (Array.isArray(raw)) {
    return {
      blocks: normaliseBlocks(raw),
      version: TARGET_VERSION,
      pencilStrokes: [],
    };
  }

  // Case 2: pre-pencil shape — `{ blocks, version }` only.
  const blocks = Array.isArray(raw.blocks) ? normaliseBlocks(raw.blocks) : [];
  const rawStrokes = Array.isArray(raw.pencilStrokes)
    ? normaliseStrokes(raw.pencilStrokes)
    : [];
  // Assign block-level anchors to any legacy strokes that lack them.
  const pencilStrokes = assignLegacyAnchors(rawStrokes, blocks);
  const washiTapes = Array.isArray(raw.washiTapes) ? raw.washiTapes : [];
  const version = typeof raw.version === 'number' ? raw.version : TARGET_VERSION;

  return {
    blocks,
    version: Math.max(version, TARGET_VERSION),
    pencilStrokes,
    washiTapes,
  } as PilotV2NoteContent;
}

/** Apply the migrator to every note in a fetched list. */
export function migratePilotV2Notes(notes: PilotV2Note[]): PilotV2Note[] {
  return notes.map((n) => ({
    ...n,
    content: migratePilotV2NoteContent(n.content),
  }));
}

/** Strip unknown fields & ensure required defaults on every block. */
function normaliseBlocks(raw: any[]): PilotV2Block[] {
  return raw
    .filter((b) => b && typeof b === 'object')
    .map((b) => {
      const block: PilotV2Block = {
        id: typeof b.id === 'string' && b.id ? b.id : `pv2_b_${Math.random().toString(36).slice(2, 8)}`,
        type: (b.type as PilotV2Block['type']) || 'paragraph',
        text: typeof b.text === 'string' ? b.text : '',
      };
      if (b.level === 1 || b.level === 2 || b.level === 3) block.level = b.level;
      if (typeof b.checked === 'boolean') block.checked = b.checked;
      if (typeof b.highlightColor === 'string') block.highlightColor = b.highlightColor;
      if (typeof b.bold === 'boolean') block.bold = b.bold;
      if (typeof b.italic === 'boolean') block.italic = b.italic;
      if (typeof b.underline === 'boolean') block.underline = b.underline;
      if (typeof b.link === 'string') block.link = b.link;
      if (typeof b.imageBase64 === 'string') block.imageBase64 = b.imageBase64;
      if (typeof b.imageUri === 'string') block.imageUri = b.imageUri;
      if (b.attachment && typeof b.attachment === 'object') block.attachment = b.attachment;
      if (typeof b.remindAt === 'string') block.remindAt = b.remindAt;
      if (Array.isArray(b.tableRows)) block.tableRows = b.tableRows;
      if (b.meta && typeof b.meta === 'object') block.meta = b.meta;
      if (typeof b.created_at === 'string') block.created_at = b.created_at;
      return block;
    });
}

function normaliseStrokes(raw: any[]): PilotV2PencilStroke[] {
  return raw
    .filter((s) => s && typeof s === 'object' && Array.isArray(s.points))
    .map((s, idx) => ({
      id: typeof s.id === 'string' && s.id ? s.id : `pv2_str_legacy_${idx}`,
      tool: (s.tool as PilotV2PencilStroke['tool']) || 'pen',
      color: typeof s.color === 'string' ? s.color : '#0F172A',
      width: typeof s.width === 'number' ? s.width : 2,
      opacity: typeof s.opacity === 'number' ? s.opacity : 1,
      points: s.points
        .filter((p: any) => p && typeof p.x === 'number' && typeof p.y === 'number')
        .map((p: any) => ({
          x: Math.max(0, Math.min(1, p.x)),
          y: Math.max(0, Math.min(1, p.y)),
          pressure: typeof p.pressure === 'number' ? p.pressure : 0.5,
          t: typeof p.t === 'number' ? p.t : Date.now(),
        })),
      zIndex: typeof s.zIndex === 'number' ? s.zIndex : idx,
      createdAt: typeof s.createdAt === 'string' ? s.createdAt : new Date().toISOString(),
      bounds: s.bounds && typeof s.bounds === 'object' ? s.bounds : undefined,
      // Preserve existing anchor if already present (idempotent migration).
      anchor: s.anchor && typeof s.anchor.blockId === 'string' ? s.anchor : undefined,
    }));
}

/* ------------------------------------------------------------------ */
/* Step 6 migration — assign anchor.blockId to legacy unanchored strokes */
/* ------------------------------------------------------------------ */

/** Estimate block y-positions from text content alone (no rendering).
 *  Used only at migration time; real positions come from onLayout in the editor. */
function estimateBlockLayouts(blocks: PilotV2Block[]): Map<string, { y: number; h: number }> {
  const map = new Map<string, { y: number; h: number }>();
  const AVG_CHARS_PER_LINE = 60;
  const LINE_PX = 26;   // average line height in px (rough)
  const HEADING_PX = 42; // heading row height
  const GAP_PX = 8;      // gap between blocks
  let y = 0;
  for (const b of blocks) {
    const textLen = (b.text || '').length;
    const lines = Math.max(1, Math.ceil(textLen / AVG_CHARS_PER_LINE));
    const h = b.type === 'heading' ? HEADING_PX : lines * LINE_PX;
    map.set(b.id, { y, h });
    y += h + GAP_PX;
  }
  return map;
}

/** Assign `anchor.blockId` + `anchor.blockOriginY` to strokes that do not
 *  already carry an anchor.  Uses estimated block positions — accurate
 *  enough for the migration heuristic. */
function assignLegacyAnchors(
  strokes: PilotV2PencilStroke[],
  blocks: PilotV2Block[],
): PilotV2PencilStroke[] {
  if (!blocks.length || !strokes.length) return strokes;
  // Quick check: if all strokes already have anchors, skip the work.
  if (strokes.every(s => s.anchor)) return strokes;

  const layout = estimateBlockLayouts(blocks);
  const totalH = Array.from(layout.values()).reduce(
    (acc, r) => Math.max(acc, r.y + r.h), 0,
  );
  if (totalH <= 0) return strokes;

  return strokes.map((s) => {
    if (s.anchor) return s; // already anchored — leave untouched
    const pts = s.points;
    if (!pts.length) return s;
    // Centroid y in estimated page pixels.
    let cy = 0;
    for (const p of pts) cy += p.y;
    cy = (cy / pts.length) * totalH;

    let bestId: string | null = null;
    let bestDist = Infinity;
    for (const [id, rect] of layout.entries()) {
      if (cy >= rect.y && cy <= rect.y + rect.h) {
        bestId = id; bestDist = 0; break;
      }
      const d = Math.min(Math.abs(cy - rect.y), Math.abs(cy - (rect.y + rect.h)));
      if (d < bestDist) { bestDist = d; bestId = id; }
    }
    if (!bestId) return s;
    const blockOriginY = (layout.get(bestId)?.y ?? 0) / totalH;
    return { ...s, anchor: { blockId: bestId, blockOriginY } };
  });
}

/**
 * Tag presets used by the Step 8 block-tag badge UI.
 * Keys MUST match `block.meta.tag` written by the importer.
 */
export const PILOT_V2_BLOCK_TAGS: Record<string, { label: string; color: string }> = {
  quiz_import: { label: 'Added by quiz import', color: '#3B82F6' },
  ai_generated: { label: 'AI generated', color: '#8B5CF6' },
  manual: { label: 'Manual', color: '#6B7280' },
  pinned: { label: 'Pinned', color: '#F59E0B' },
};

/** Cheap getter — returns null when the block has no recognised tag. */
export function getBlockTag(block: PilotV2Block): { label: string; color: string } | null {
  const tag = (block.meta as any)?.tag;
  if (typeof tag !== 'string') return null;
  return PILOT_V2_BLOCK_TAGS[tag] ?? null;
}
