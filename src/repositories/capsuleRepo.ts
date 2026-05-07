/**
 * Capsule repository — Supabase data layer for the Capsule tab.
 *
 * Reuses the existing `user_note_nodes` and `user_notes` tables. Capsule rows
 * carry `metadata.surface = 'capsule'` to stay isolated from the legacy Notes
 * tab. Notebook content is stored as JSON inside `user_notes.content` using
 * `{ blocks: CapsuleBlock[], highlights?: CapsuleHighlight[] }`.
 */
import { supabase } from '../lib/supabase';
import type {
  CapsuleNode,
  CapsuleNodeType,
  CapsuleNotebookContent,
  CapsuleBlock,
} from '../types/capsule';
import { CAPSULE_SURFACE_KEY } from '../types/capsule';

const CAPSULE_TYPES: CapsuleNodeType[] = ['subject', 'topic', 'subtopic', 'notebook'];

const newId = () => {
  // Lightweight random id — Supabase will assign uuid via DEFAULT for inserts
  // that omit the column, but we also need a temp id for optimistic UI.
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `tmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

/* -------------------------------------------------------------------------- */
/* Hierarchy                                                                  */
/* -------------------------------------------------------------------------- */

export async function fetchAllCapsuleNodes(userId: string): Promise<CapsuleNode[]> {
  const { data, error } = await supabase
    .from('user_note_nodes')
    .select('*')
    .eq('user_id', userId)
    .in('type', CAPSULE_TYPES)
    .eq('is_archived', false);
  if (error) {
    console.warn('[capsule] fetch nodes error', error.message);
    return [];
  }
  return (data || []).filter((row: any) => {
    const surface = row?.metadata?.surface;
    return surface === CAPSULE_SURFACE_KEY;
  }) as CapsuleNode[];
}

export async function createCapsuleNode(input: {
  userId: string;
  type: CapsuleNodeType;
  title: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
  noteId?: string | null;
  metadata?: Record<string, any>;
}): Promise<CapsuleNode | null> {
  const payload: any = {
    user_id: input.userId,
    parent_id: input.parentId ?? null,
    type: input.type,
    title: input.title,
    color: input.color ?? null,
    icon: input.icon ?? null,
    note_id: input.noteId ?? null,
    metadata: { ...(input.metadata || {}), surface: CAPSULE_SURFACE_KEY },
  };
  const { data, error } = await supabase
    .from('user_note_nodes')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    console.warn('[capsule] createNode error', error.message);
    return null;
  }
  return data as CapsuleNode;
}

export async function renameCapsuleNode(id: string, title: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_note_nodes')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function archiveCapsuleNode(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_note_nodes')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function pinCapsuleNode(id: string, pinned: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('user_note_nodes')
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

/* -------------------------------------------------------------------------- */
/* Notebook content (block-based)                                             */
/* -------------------------------------------------------------------------- */

const EMPTY_CONTENT: CapsuleNotebookContent = { blocks: [], highlights: [], version: 1 };

const parseContent = (raw: string | null | undefined): CapsuleNotebookContent => {
  if (!raw) return { ...EMPTY_CONTENT };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.blocks)) {
      return {
        blocks: parsed.blocks,
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        version: parsed.version ?? 1,
      };
    }
  } catch {
    /* legacy plain text — convert to a single paragraph block */
    return {
      blocks: [{ id: newId(), type: 'paragraph', text: String(raw) }],
      highlights: [],
      version: 1,
    };
  }
  return { ...EMPTY_CONTENT };
};

export async function fetchNotebookContent(noteId: string): Promise<CapsuleNotebookContent> {
  const { data, error } = await supabase
    .from('user_notes')
    .select('content, highlights')
    .eq('id', noteId)
    .maybeSingle();
  if (error || !data) return { ...EMPTY_CONTENT };
  const parsed = parseContent(data.content);
  if (!parsed.highlights?.length && Array.isArray((data as any).highlights)) {
    parsed.highlights = (data as any).highlights;
  }
  return parsed;
}

export async function saveNotebookContent(
  noteId: string,
  content: CapsuleNotebookContent
): Promise<boolean> {
  const { error } = await supabase
    .from('user_notes')
    .update({
      content: JSON.stringify(content),
      highlights: content.highlights || [],
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId);
  return !error;
}

/**
 * Create a fresh notebook (user_notes row) for a new Capsule notebook node.
 * Returns the created note_id or null on failure.
 */
export async function createNotebookRow(input: {
  userId: string;
  subject: string;
  title: string;
}): Promise<string | null> {
  const empty: CapsuleNotebookContent = { blocks: [], highlights: [], version: 1 };
  const { data, error } = await supabase
    .from('user_notes')
    .insert({
      user_id: input.userId,
      subject: input.subject,
      title: input.title,
      content: JSON.stringify(empty),
      content_html: '',
      checklist_notes: '',
      items: [],
      highlights: [],
    })
    .select('id')
    .single();
  if (error || !data) {
    console.warn('[capsule] createNotebookRow error', error?.message);
    return null;
  }
  return data.id as string;
}

/**
 * Append blocks to a notebook without overwriting existing content.
 * Used by the Add-to-Notebook / Quiz-engine append pipeline.
 */
export async function appendBlocksToNotebook(
  noteId: string,
  blocks: CapsuleBlock[]
): Promise<boolean> {
  const current = await fetchNotebookContent(noteId);
  const next: CapsuleNotebookContent = {
    ...current,
    blocks: [...(current.blocks || []), ...blocks],
  };
  return saveNotebookContent(noteId, next);
}

/* -------------------------------------------------------------------------- */
/* Tree helpers                                                               */
/* -------------------------------------------------------------------------- */

export interface CapsuleTreeNode extends CapsuleNode {
  children: CapsuleTreeNode[];
  notebookCount: number;
}

export function buildCapsuleTree(nodes: CapsuleNode[]): CapsuleTreeNode[] {
  const map = new Map<string, CapsuleTreeNode>();
  nodes.forEach((n) => map.set(n.id, { ...n, children: [], notebookCount: 0 }));

  const roots: CapsuleTreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Compute notebook counts (sum of notebook descendants).
  const countNotebooks = (n: CapsuleTreeNode): number => {
    if (n.type === 'notebook') {
      n.notebookCount = 1;
      return 1;
    }
    let total = 0;
    n.children.forEach((c) => { total += countNotebooks(c); });
    n.notebookCount = total;
    return total;
  };
  roots.forEach(countNotebooks);

  // Sort: subjects first, then alphabetic within siblings.
  const order: Record<CapsuleNodeType, number> = {
    subject: 0, topic: 1, subtopic: 2, notebook: 3,
  };
  const sortRec = (arr: CapsuleTreeNode[]) => {
    arr.sort((a, b) => {
      if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
      return (a.title || '').localeCompare(b.title || '');
    });
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}
