/**
 * PilotV2Migration — data conversion + stability layer for Pilot V2.
 *
 * Responsibilities (per PILOT_V2_HANDOFF.md "Step 8 — Migration & Testing"):
 *
 *   1. **migrateNoteContent(content)** — pure function that runs every time a
 *      note is loaded. Detects the schema version, lifts legacy flat blocks
 *      into the nested format, validates required fields and stamps a fresh
 *      `version: 2` so subsequent loads short-circuit. Crash-proof: any
 *      malformed block is replaced with an empty paragraph instead of
 *      throwing.
 *
 *   2. **migrateAllUserNotes(userId)** — bulk migrator that walks every Pilot
 *      V2 note for a user and rewrites it through `migrateNoteContent`. Used
 *      once on first launch of v2.2 (or via a debug menu). Returns the count
 *      of notes touched.
 *
 *   3. **addTagToBlock / removeTagFromBlock / setBlockTags** — pure mutators
 *      for the block-level tagging system. Tags live on the nested block; the
 *      legacy flat schema is preserved by re-flattening on save so existing
 *      consumers stay unaffected.
 *
 *   4. **searchBlocks(query, notes)** — search across block contents (block
 *      name, heading, every child element's text) instead of just notebook
 *      titles. Returns `BlockSearchHit[]` ranked by simple keyword presence
 *      so the NoteList screen can render a "Found in 3 blocks" affordance.
 *
 *   5. **listAllTags(notes)** — aggregate every distinct tag in use across a
 *      user's notebooks. Drives the tag filter UI in NoteList.
 */

import {
  ContentElement,
  PilotV2Block,
  PilotV2NestedBlock,
  PilotV2Note,
  PilotV2NoteContent,
  ensureNestedBlocks,
  flatBlocksToNested,
  nestedBlockPlainText,
  nestedToFlatBlocks,
} from '../components/pilot-v2/types';
import {
  fetchPilotV2NotesForUser,
  savePilotV2NoteContent,
} from '../repositories/pilotV2Repo';

const SCHEMA_VERSION = 2;

const newId = (): string => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `pv2_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

/* ------------------------------------------------------------------------- */
/* Sanitizers — never throw on malformed input                                */
/* ------------------------------------------------------------------------- */

const VALID_ELEMENT_TYPES: ReadonlySet<string> = new Set([
  'heading', 'paragraph', 'bullet', 'numbered', 'checklist',
  'quote', 'code', 'divider', 'table',
]);

function sanitizeContentElement(raw: any, fallbackId: string): ContentElement {
  if (!raw || typeof raw !== 'object') {
    return { id: fallbackId, type: 'paragraph', spans: [] };
  }
  const id = typeof raw.id === 'string' && raw.id ? raw.id : fallbackId;
  const type = VALID_ELEMENT_TYPES.has(raw.type) ? raw.type : 'paragraph';
  const out: ContentElement = { id, type };
  if (Array.isArray(raw.spans)) {
    out.spans = raw.spans
      .filter((s: any) => s && typeof s === 'object')
      .map((s: any) => ({
        text: typeof s.text === 'string' ? s.text : '',
        marks: s.marks && typeof s.marks === 'object' ? {
          bold: !!s.marks.bold,
          italic: !!s.marks.italic,
          underline: !!s.marks.underline,
          strikethrough: !!s.marks.strikethrough,
        } : undefined,
        highlightColor: typeof s.highlightColor === 'string' ? s.highlightColor : undefined,
        link: s.link && typeof s.link.url === 'string' ? { url: s.link.url, title: s.link.title } : undefined,
      }));
  }
  if (typeof raw.checked === 'boolean') out.checked = raw.checked;
  if (raw.level === 1 || raw.level === 2 || raw.level === 3) out.level = raw.level;
  if (Array.isArray(raw.tableRows)) {
    out.tableRows = raw.tableRows
      .filter((r: any) => Array.isArray(r))
      .map((r: any[]) => r.map(c => (typeof c === 'string' ? c : String(c ?? ''))));
  }
  if (raw.meta && typeof raw.meta === 'object') out.meta = { ...raw.meta };
  return out;
}

function sanitizeNestedBlock(raw: any): PilotV2NestedBlock {
  const id = typeof raw?.id === 'string' && raw.id ? raw.id : newId();
  const blockName = typeof raw?.blockName === 'string' && raw.blockName.trim()
    ? raw.blockName
    : (typeof raw?.customName === 'string' ? raw.customName : 'Notes');
  const heading = raw?.heading ? sanitizeContentElement(raw.heading, `${id}_h`) : undefined;
  const childrenRaw = Array.isArray(raw?.children) ? raw.children : [];
  const children = childrenRaw.map((c: any, i: number) =>
    sanitizeContentElement(c, `${id}_c_${i}`)
  );
  const tags = Array.isArray(raw?.tags)
    ? raw.tags.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
    : undefined;
  return {
    id,
    blockName,
    customName: typeof raw?.customName === 'string' ? raw.customName : undefined,
    heading,
    children,
    pencilStrokes: Array.isArray(raw?.pencilStrokes) ? raw.pencilStrokes : undefined,
    tags,
    sourceQuizId: typeof raw?.sourceQuizId === 'string' ? raw.sourceQuizId : undefined,
    isDirty: !!raw?.isDirty,
    lastSyncedAt: typeof raw?.lastSyncedAt === 'string' ? raw.lastSyncedAt : undefined,
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------------- */
/* Schema migration                                                           */
/* ------------------------------------------------------------------------- */

export interface MigratedNote {
  /** The legacy flat list — written back to Supabase so existing consumers stay happy. */
  flatBlocks: PilotV2Block[];
  /** The nested view — used by every v2.2+ UI surface. */
  nestedBlocks: PilotV2NestedBlock[];
  /** Bumped after migration. */
  version: number;
  /** True when the migration actually changed something. */
  changed: boolean;
}

/**
 * Crash-proof migration of a single PilotV2NoteContent. Accepts:
 *   • Legacy flat blocks (`PilotV2Block[]`)
 *   • Nested blocks (`PilotV2NestedBlock[]`)
 *   • Mixed / corrupted JSON (always returns a valid empty content if all else fails)
 */
export function migrateNoteContent(content: PilotV2NoteContent | undefined | null): MigratedNote {
  const safeBlocks = Array.isArray(content?.blocks) ? content!.blocks : [];
  const version = content?.version ?? 1;

  // Detect shape: nested block has `children` array; flat block has `type` + `text`.
  const looksNested = safeBlocks.length > 0 && safeBlocks.every((b: any) =>
    b && typeof b === 'object' && Array.isArray(b.children)
  );

  let nestedBlocks: PilotV2NestedBlock[];
  let changed = false;
  if (looksNested) {
    nestedBlocks = safeBlocks.map(sanitizeNestedBlock);
    // No structural change — but we still bump the version if it was < SCHEMA_VERSION.
    changed = version < SCHEMA_VERSION;
  } else {
    nestedBlocks = flatBlocksToNested(safeBlocks as PilotV2Block[]);
    changed = true;
  }

  // Always re-flatten so the legacy schema stays canonical on the wire.
  const flatBlocks = nestedToFlatBlocks(nestedBlocks);

  return {
    flatBlocks,
    nestedBlocks,
    version: SCHEMA_VERSION,
    changed,
  };
}

/**
 * Walk every Pilot V2 note for the user and persist a migrated content blob.
 * Returns counts so the caller can show "Migrated 12 notes" in a debug menu.
 *
 * Only writes when `changed === true` to keep this idempotent.
 */
export async function migrateAllUserNotes(userId: string): Promise<{
  scanned: number;
  migrated: number;
  failed: number;
}> {
  let scanned = 0;
  let migrated = 0;
  let failed = 0;

  let notes: PilotV2Note[] = [];
  try {
    notes = await fetchPilotV2NotesForUser(userId);
  } catch {
    return { scanned, migrated, failed: 1 };
  }
  for (const note of notes) {
    scanned++;
    try {
      const result = migrateNoteContent(note.content);
      if (!result.changed) continue;
      const ok = await savePilotV2NoteContent(note.id, {
        blocks: result.flatBlocks,
        version: result.version,
      });
      if (ok) migrated++; else failed++;
    } catch {
      failed++;
    }
  }
  return { scanned, migrated, failed };
}

/* ------------------------------------------------------------------------- */
/* Block tagging                                                              */
/* ------------------------------------------------------------------------- */

const normalizeTag = (t: string): string => t.trim().toLowerCase().replace(/\s+/g, '-');

/** Pure mutator — adds a tag to a nested block. Returns a new array (immutable). */
export function addTagToBlock(
  blocks: PilotV2NestedBlock[],
  blockId: string,
  tag: string
): PilotV2NestedBlock[] {
  const norm = normalizeTag(tag);
  if (!norm) return blocks;
  return blocks.map(b => {
    if (b.id !== blockId) return b;
    const tags = b.tags ? [...b.tags] : [];
    if (tags.includes(norm)) return b;
    tags.push(norm);
    return { ...b, tags, isDirty: true, updatedAt: new Date().toISOString() };
  });
}

export function removeTagFromBlock(
  blocks: PilotV2NestedBlock[],
  blockId: string,
  tag: string
): PilotV2NestedBlock[] {
  const norm = normalizeTag(tag);
  return blocks.map(b => {
    if (b.id !== blockId) return b;
    const tags = (b.tags || []).filter(t => t !== norm);
    return { ...b, tags, isDirty: true, updatedAt: new Date().toISOString() };
  });
}

export function setBlockTags(
  blocks: PilotV2NestedBlock[],
  blockId: string,
  tags: string[]
): PilotV2NestedBlock[] {
  const cleaned = Array.from(new Set(tags.map(normalizeTag).filter(Boolean)));
  return blocks.map(b => {
    if (b.id !== blockId) return b;
    return { ...b, tags: cleaned, isDirty: true, updatedAt: new Date().toISOString() };
  });
}

/** Aggregate distinct tags across all notes (sorted alphabetically). */
export function listAllTags(notes: PilotV2Note[]): string[] {
  const seen = new Set<string>();
  for (const note of notes) {
    const nested = ensureNestedBlocks(note.content?.blocks);
    for (const block of nested) {
      for (const t of block.tags || []) {
        if (typeof t === 'string' && t.trim()) seen.add(t.trim().toLowerCase());
      }
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/* ------------------------------------------------------------------------- */
/* Search-within-blocks                                                       */
/* ------------------------------------------------------------------------- */

export interface BlockSearchHit {
  noteId: string;
  noteTitle: string;
  blockId: string;
  blockName: string;
  /** Number of substring hits across name + heading + children + tags. */
  hits: number;
  /** Up to 2 snippets containing the query — for the search results UI. */
  snippets: string[];
}

/** Lowercase-substring search across block contents. */
export function searchBlocks(
  query: string,
  notes: PilotV2Note[],
  options: { tagFilter?: string | null; limit?: number } = {}
): BlockSearchHit[] {
  const q = (query || '').trim().toLowerCase();
  const tagFilter = options.tagFilter ? normalizeTag(options.tagFilter) : null;
  const limit = Math.max(1, options.limit ?? 50);
  if (!q && !tagFilter) return [];

  const hits: BlockSearchHit[] = [];

  for (const note of notes) {
    const nested = ensureNestedBlocks(note.content?.blocks);
    for (const block of nested) {
      // Tag filter — short-circuit if requested and not present.
      if (tagFilter && !(block.tags || []).includes(tagFilter)) continue;
      if (!q) {
        // Tag-only filter mode — surface every tagged block.
        hits.push({
          noteId: note.id,
          noteTitle: note.title || '(untitled)',
          blockId: block.id,
          blockName: block.customName || block.blockName,
          hits: 1,
          snippets: [],
        });
        if (hits.length >= limit) return hits;
        continue;
      }
      const blockText = nestedBlockPlainText(block).toLowerCase();
      if (!blockText.includes(q)) continue;

      const matches = blockText.split(q).length - 1;
      const snippets: string[] = [];
      let cursor = 0;
      while (snippets.length < 2) {
        const idx = blockText.indexOf(q, cursor);
        if (idx < 0) break;
        const start = Math.max(0, idx - 24);
        const end = Math.min(blockText.length, idx + q.length + 24);
        snippets.push((start > 0 ? '…' : '') + blockText.slice(start, end) + (end < blockText.length ? '…' : ''));
        cursor = idx + q.length;
      }

      hits.push({
        noteId: note.id,
        noteTitle: note.title || '(untitled)',
        blockId: block.id,
        blockName: block.customName || block.blockName,
        hits: matches,
        snippets,
      });
      if (hits.length >= limit) return hits;
    }
  }

  // Rank — most hits first, then alphabetically by note title.
  hits.sort((a, b) => {
    if (b.hits !== a.hits) return b.hits - a.hits;
    return a.noteTitle.localeCompare(b.noteTitle);
  });
  return hits;
}

/* ------------------------------------------------------------------------- */
/* Bootstrap helper                                                           */
/* ------------------------------------------------------------------------- */

import { KVStore } from '../lib/kvStore';

const K_MIGRATION_DONE = (userId: string) => `pv2:migration:v${SCHEMA_VERSION}:${userId}`;

/**
 * Idempotent bootstrap — runs the bulk migration once per user per app
 * version and remembers it via KVStore so subsequent launches skip the work.
 */
export async function bootstrapPilotV2Migration(userId: string): Promise<void> {
  if (!userId) return;
  if (KVStore.getString(K_MIGRATION_DONE(userId)) === '1') return;
  try {
    const result = await migrateAllUserNotes(userId);
    if (result.failed === 0) {
      KVStore.setString(K_MIGRATION_DONE(userId), '1');
    }
    // eslint-disable-next-line no-console
    console.log('[pilot-v2] migration result', result);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[pilot-v2] migration failed', e);
  }
}
