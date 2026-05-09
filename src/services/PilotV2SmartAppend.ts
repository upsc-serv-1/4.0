/**
 * PilotV2SmartAppend — single source of truth for "append text into a Pilot V2
 * notebook block" semantics.
 *
 * Used by:
 *   • PilotV2ExportSheet.tsx (Step 3) — when the user picks a target block.
 *   • PilotV2SaveSheet.tsx   (legacy Quiz save) — Step 4 wires the existing
 *     basic appendBlocksToPilotV2Note flow through this richer helper so the
 *     "Undo Save" toast and metadata badge land everywhere consistently.
 *
 * Behaviour (per PILOT_V2_COMPLETE_ARCHITECTURE.md §"Smart Append Logic"):
 *   1. Optional separator divider before the new content.
 *   2. Auto-continue numbered-list numbering.
 *   3. Stamp every imported element with `meta.addedAt` + `meta.source` and a
 *      visible "Added by quiz import" badge (consumed by the renderer).
 *   4. Convert plain quiz text → ContentElement[] (lines, bullets, headings).
 *   5. Persist through `pilotV2Repo.savePilotV2NoteContent` so existing
 *      consumers stay on the legacy flat-block schema (`PilotV2Block[]`) while
 *      the new structure lives logically inside.
 *   6. Return an undo handle — the caller (typically a toast) can call
 *      `undoSmartAppend(handle)` to restore the pre-append snapshot atomically.
 */

import {
  ContentElement,
  PilotV2Block,
  PilotV2NestedBlock,
  PilotV2Note,
  PilotV2NoteContent,
  TextSpan,
  ensureNestedBlocks,
  flatBlocksToNested,
  nestedToFlatBlocks,
} from '../components/pilot-v2/types';
import {
  fetchPilotV2Note,
  savePilotV2NoteContent,
} from '../repositories/pilotV2Repo';
import { textToPilotV2Blocks } from '../components/pilot-v2/PilotV2SaveSheet';

const newId = (): string => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `pv2_b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const nowIso = (): string => new Date().toISOString();

/* ------------------------------------------------------------------------- */
/* Public types                                                               */
/* ------------------------------------------------------------------------- */

export interface SmartAppendOptions {
  /** Insert a divider element before the imported content. Default `true` if the target block already has children. */
  addSeparator?: boolean;
  /** Auto-continue numbering for any 'numbered' elements being appended. Default `true`. */
  continueNumbering?: boolean;
  /** Source attribution string ("Quiz · Polity 2024"). */
  source?: string;
  /** Source quiz id — kept on each appended element for traceability. */
  sourceQuizId?: string;
  /** Source question text — propagated onto element meta for the renderer badge. */
  sourceQuestion?: string;
  /** Visual badge label. Defaults to "Added by quiz import". */
  badgeLabel?: string;
}

export interface SmartAppendResult {
  ok: boolean;
  /** ID of the block that received the content (existing or newly created). */
  targetBlockId: string;
  /** Whether `targetBlockId` is brand-new (i.e. block was created by this call). */
  createdBlock: boolean;
  /** Number of ContentElements appended (excluding any divider). */
  addedElementCount: number;
  /** Undo handle — pass this to `undoSmartAppend` to revert the change. */
  undo: SmartAppendUndoHandle | null;
}

export interface SmartAppendUndoHandle {
  noteId: string;
  /** Snapshot of the previous note content before the append. */
  previousContent: PilotV2NoteContent;
  /** Timestamp the append was committed — toast can show "X seconds ago". */
  committedAt: number;
}

/* ------------------------------------------------------------------------- */
/* Conversion: plain text → ContentElement[]                                  */
/* ------------------------------------------------------------------------- */

/**
 * Convert a snippet of selected quiz/markdown text into a list of nested
 * `ContentElement`s. Reuses `textToPilotV2Blocks` (the legacy flat parser) and
 * lifts each result into a ContentElement so the new nested API can consume it
 * without re-implementing the markdown grammar.
 */
export function convertSelectedTextToElements(text: string): ContentElement[] {
  const flat = textToPilotV2Blocks(text);
  if (flat.length === 0) return [];

  // Convert each flat block to a single ContentElement.
  const elements: ContentElement[] = flat.map((b: PilotV2Block) => {
    const spans: TextSpan[] = b.text
      ? [{
          text: b.text,
          marks: { bold: b.bold, italic: b.italic, underline: b.underline },
          highlightColor: b.highlightColor,
          link: b.link ? { url: b.link } : undefined,
        }]
      : [];
    switch (b.type) {
      case 'heading':
        return { id: b.id, type: 'heading', level: b.level ?? 2, spans };
      case 'bullet':
        return { id: b.id, type: 'bullet', spans };
      case 'numbered':
        return { id: b.id, type: 'numbered', spans };
      case 'checklist':
        return { id: b.id, type: 'checklist', checked: !!b.checked, spans };
      case 'quote':
        return { id: b.id, type: 'quote', spans };
      case 'code':
        return { id: b.id, type: 'code', spans };
      case 'highlight':
      case 'paragraph':
      default:
        return { id: b.id, type: 'paragraph', spans };
    }
  });

  return elements;
}

/* ------------------------------------------------------------------------- */
/* Pure helpers — separator, numbering, stamping                              */
/* ------------------------------------------------------------------------- */

function makeDivider(meta?: ContentElement['meta']): ContentElement {
  return {
    id: newId(),
    type: 'divider',
    meta,
  };
}

function stampElements(
  elements: ContentElement[],
  options: SmartAppendOptions
): ContentElement[] {
  const stamp = nowIso();
  const badge = options.badgeLabel ?? 'Added by quiz import';
  const source = options.source ?? 'quiz_import';
  return elements.map(el => ({
    ...el,
    meta: {
      ...(el.meta || {}),
      addedAt: stamp,
      source,
      badge,
      sourceQuizId: options.sourceQuizId,
      sourceQuestion: options.sourceQuestion,
    },
  }));
}

/**
 * Continue numbering — find the last `numbered` element in the existing block
 * and rewrite the leading numeric prefix on each incoming numbered element so
 * the imported list starts where the existing list left off.
 */
function applyAutoNumbering(
  existing: ContentElement[],
  incoming: ContentElement[]
): ContentElement[] {
  const lastNumbered = [...existing].reverse().find(c => c.type === 'numbered');
  const lastText = lastNumbered?.spans?.[0]?.text || '';
  const lastMatch = lastText.match(/^(\d+)\./);
  let next = lastMatch ? parseInt(lastMatch[1], 10) + 1 : 1;

  return incoming.map(el => {
    if (el.type !== 'numbered') return el;
    const span = (el.spans && el.spans[0]) ? el.spans[0] : { text: '' };
    const stripped = (span.text || '').replace(/^\d+\.\s*/, '');
    const renumbered: TextSpan = { ...span, text: `${next}. ${stripped}` };
    next++;
    return { ...el, spans: [renumbered, ...(el.spans?.slice(1) || [])] };
  });
}

/* ------------------------------------------------------------------------- */
/* Public entry — smart append                                                */
/* ------------------------------------------------------------------------- */

export interface SmartAppendInput {
  noteId: string;
  /** Existing block id to append into. When `null` a new block is appended at the end of the note. */
  blockId: string | null;
  /** Display name to use when creating a new block. Ignored when `blockId` is set. */
  newBlockName?: string;
  /** Either pre-built ContentElements or raw text. Text is parsed via `convertSelectedTextToElements`. */
  content: ContentElement[] | { text: string };
  options?: SmartAppendOptions;
}

/**
 * Append content into a target block (or create one). Persists through
 * `savePilotV2NoteContent` so the legacy flat schema stays the canonical wire
 * format. Returns an undo handle the caller can use to revert.
 */
export async function smartAppendToBlock(input: SmartAppendInput): Promise<SmartAppendResult> {
  const { noteId, blockId, newBlockName, content, options = {} } = input;

  // 1. Load the latest note content so concurrent edits aren't clobbered.
  const note: PilotV2Note | null = await fetchPilotV2Note(noteId);
  if (!note) {
    return { ok: false, targetBlockId: '', createdBlock: false, addedElementCount: 0, undo: null };
  }
  const previousContent: PilotV2NoteContent = {
    blocks: [...(note.content?.blocks || [])],
    version: note.content?.version ?? 1,
  };

  // 2. Resolve the elements to append.
  let toAppend: ContentElement[] = Array.isArray(content)
    ? content
    : convertSelectedTextToElements(content.text);
  if (toAppend.length === 0) {
    return { ok: false, targetBlockId: blockId || '', createdBlock: false, addedElementCount: 0, undo: null };
  }

  // 3. Lift the legacy flat blocks into the nested model so we can target a
  //    specific PilotV2NestedBlock by id (or create a fresh one at the end).
  const nested = ensureNestedBlocks(note.content?.blocks);

  let target: PilotV2NestedBlock | null = blockId
    ? nested.find(b => b.id === blockId) ?? null
    : null;
  let createdBlock = false;
  if (!target) {
    target = {
      id: newId(),
      blockName: (newBlockName || 'Imported Notes').trim() || 'Imported Notes',
      children: [],
      isDirty: true,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    nested.push(target);
    createdBlock = true;
  }

  // 4. Optional auto-numbering.
  const wantNumbering = options.continueNumbering !== false;
  const numbered = wantNumbering ? applyAutoNumbering(target.children, toAppend) : toAppend;

  // 5. Stamp metadata onto every appended element.
  const stamped = stampElements(numbered, options);

  // 6. Optional divider — only when the target block already has content.
  const wantSeparator = options.addSeparator !== false && target.children.length > 0;
  if (wantSeparator) {
    target.children.push(makeDivider({
      addedAt: nowIso(),
      source: options.source || 'quiz_import',
      sourceQuizId: options.sourceQuizId,
    }));
  }
  target.children.push(...stamped);
  target.updatedAt = nowIso();
  target.isDirty = true;

  // 7. Flatten back to the legacy schema and save.
  const flatBack: PilotV2Block[] = nestedToFlatBlocks(nested);
  const ok = await savePilotV2NoteContent(noteId, { blocks: flatBack, version: 1 });
  if (!ok) {
    return {
      ok: false,
      targetBlockId: target.id,
      createdBlock,
      addedElementCount: stamped.length,
      undo: null,
    };
  }

  const undo: SmartAppendUndoHandle = {
    noteId,
    previousContent,
    committedAt: Date.now(),
  };

  return {
    ok: true,
    targetBlockId: target.id,
    createdBlock,
    addedElementCount: stamped.length,
    undo,
  };
}

/**
 * Revert a prior smart append. Restores the exact note content captured at
 * commit time. Safe to call multiple times — each call writes the same
 * snapshot.
 */
export async function undoSmartAppend(handle: SmartAppendUndoHandle): Promise<boolean> {
  return savePilotV2NoteContent(handle.noteId, handle.previousContent);
}

/* ------------------------------------------------------------------------- */
/* Convenience: re-export so callers only need this module                   */
/* ------------------------------------------------------------------------- */

export { flatBlocksToNested };
