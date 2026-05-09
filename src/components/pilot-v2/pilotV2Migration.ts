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
  const pencilStrokes = Array.isArray(raw.pencilStrokes)
    ? normaliseStrokes(raw.pencilStrokes)
    : [];
  const version = typeof raw.version === 'number' ? raw.version : TARGET_VERSION;

  return {
    blocks,
    version: Math.max(version, TARGET_VERSION),
    pencilStrokes,
  };
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
    }));
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
