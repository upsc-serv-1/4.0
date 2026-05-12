/**
 * Pilot V2 Repository — Supabase data layer (skeleton)
 *
 * Reuses the existing `user_note_nodes` and `user_notes` tables.
 * Pilot V2 rows are tagged with `metadata.surface = 'pilot_v2'` so they live
 * alongside Capsule (`pilot`) and the legacy Notes tab without colliding.
 *
 * Step 1 lands the read/write skeleton. Step 10 fills in the auto-hierarchy
 * `findOrCreateNote` flow used by the Quiz Engine integration.
 */
import { supabase } from '../lib/supabase';
import {
  PILOT_V2_SURFACE,
  PilotV2Block,
  PilotV2Node,
  PilotV2NodeType,
  PilotV2Note,
  PilotV2NoteContent,
} from '../components/pilot-v2/types';

const PILOT_V2_TYPES: PilotV2NodeType[] = ['subject', 'topic', 'subtopic', 'note'];

const newId = (): string => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `pv2_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

/* -------------------------------------------------------------------------- */
/* Hierarchy                                                                  */
/* -------------------------------------------------------------------------- */

export async function fetchAllPilotV2Nodes(userId: string, includeArchived = false): Promise<PilotV2Node[]> {
  let query = supabase
    .from('user_note_nodes')
    .select('*')
    .eq('user_id', userId)
    .in('type', PILOT_V2_TYPES);
  if (!includeArchived) {
    query = query.eq('is_archived', false);
  }
  const { data, error } = await query;

  if (error) {
    console.warn('[pilot-v2] fetch nodes error', error.message);
    return [];
  }
  return (data || []).filter((row: any) => row?.metadata?.surface === PILOT_V2_SURFACE) as PilotV2Node[];
}

/**
 * Canonicalize hierarchy rows in-memory (UI/read path only).
 * Keeps the oldest row for an identical logical node key, without mutating DB.
 */
export function canonicalizePilotV2Nodes(nodes: PilotV2Node[]): PilotV2Node[] {
  const best = new Map<string, PilotV2Node>();
  const toTs = (n: PilotV2Node) => {
    const raw = (n as any)?.created_at ? Date.parse((n as any).created_at) : NaN;
    return Number.isFinite(raw) ? raw : Number.MAX_SAFE_INTEGER;
  };
  for (const n of nodes) {
    const key = `${n.type}::${n.parent_id || 'root'}::${(n.title || '').trim().toLowerCase()}::${n.type === 'note' ? (n.note_id || '') : ''}`;
    const prev = best.get(key);
    if (!prev || toTs(n) < toTs(prev)) best.set(key, n);
  }
  return Array.from(best.values());
}

export async function fetchCanonicalPilotV2Nodes(userId: string, includeArchived = false): Promise<PilotV2Node[]> {
  const rows = await fetchAllPilotV2Nodes(userId, includeArchived);
  return canonicalizePilotV2Nodes(rows);
}

export async function createPilotV2Node(input: {
  userId: string;
  type: PilotV2NodeType;
  title: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
  noteId?: string | null;
  metadata?: Record<string, any>;
}): Promise<PilotV2Node | null> {
  const payload: any = {
    user_id: input.userId,
    parent_id: input.parentId ?? null,
    type: input.type,
    title: input.title,
    color: input.color ?? null,
    icon: input.icon ?? null,
    note_id: input.noteId ?? null,
    metadata: { ...(input.metadata || {}), surface: PILOT_V2_SURFACE },
  };
  const { data, error } = await supabase
    .from('user_note_nodes')
    .insert(payload)
    .select('*')
    .single();
  if (error) {
    console.warn('[pilot-v2] createNode error', error.message);
    return null;
  }
  return data as PilotV2Node;
}

export async function renamePilotV2Node(id: string, title: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_note_nodes')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function archivePilotV2Node(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_note_nodes')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function restorePilotV2Node(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_note_nodes')
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function pinPilotV2Node(id: string, pinned: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('user_note_nodes')
    .update({ is_pinned: pinned, updated_at: new Date().toISOString() })
    .eq('id', id);
  return !error;
}

export async function purgePilotV2NoteNode(input: { nodeId: string; noteId?: string | null }): Promise<boolean> {
  // Best-effort: remove node, then remove the linked note row if present.
  const { error: nodeErr } = await supabase
    .from('user_note_nodes')
    .delete()
    .eq('id', input.nodeId);
  if (nodeErr) return false;

  if (input.noteId) {
    await supabase
      .from('user_notes')
      .delete()
      .eq('id', input.noteId);
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* Note content (block-based)                                                 */
/* -------------------------------------------------------------------------- */

const EMPTY_CONTENT: PilotV2NoteContent = { blocks: [], version: 1 };

const parseContent = (raw: string | null | undefined): PilotV2NoteContent => {
  if (!raw) return { ...EMPTY_CONTENT };
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.blocks)) {
      return {
        blocks: parsed.blocks,
        version: parsed.version ?? 1,
        pencilStrokes: parsed.pencilStrokes || [],
        layout: parsed.layout,
      };
    }
  } catch {
    /* legacy plain text — wrap into a single paragraph block. */
    return {
      blocks: [{ id: newId(), type: 'paragraph', text: String(raw) }],
      version: 1,
    };
  }
  return { ...EMPTY_CONTENT };
};

export async function fetchPilotV2Note(noteId: string): Promise<PilotV2Note | null> {
  const { data, error } = await supabase
    .from('user_notes')
    .select('id, user_id, title, subject, content, created_at, updated_at')
    .eq('id', noteId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    user_id: data.user_id,
    title: data.title,
    subject: data.subject,
    content: parseContent(data.content),
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function fetchPilotV2NotesForUser(userId: string): Promise<PilotV2Note[]> {
  // Fetch notes referenced by Pilot V2 nodes (note_id is set for type === 'note').
  const nodes = await fetchAllPilotV2Nodes(userId, true);
  const noteIds = nodes.filter(n => n.type === 'note' && n.note_id).map(n => n.note_id as string);
  if (noteIds.length === 0) return [];

  const { data, error } = await supabase
    .from('user_notes')
    .select('id, user_id, title, subject, content, created_at, updated_at')
    .in('id', noteIds)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  // Stitch hierarchy back onto each note (subject/topic/subtopic from nodes).
  const nodeByNoteId = new Map<string, PilotV2Node>();
  nodes.forEach(n => { if (n.note_id) nodeByNoteId.set(n.note_id, n); });
  const nodeById = new Map<string, PilotV2Node>();
  nodes.forEach(n => nodeById.set(n.id, n));

  const labelChain = (leaf: PilotV2Node | undefined): { subject?: string; topic?: string; subtopic?: string } => {
    const result: any = {};
    let cur: PilotV2Node | undefined = leaf?.parent_id ? nodeById.get(leaf.parent_id) : undefined;
    const chain: PilotV2Node[] = [];
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id ? nodeById.get(cur.parent_id) : undefined;
    }
    chain.forEach(n => {
      if (n.type === 'subject') result.subject = n.title;
      else if (n.type === 'topic') result.topic = n.title;
      else if (n.type === 'subtopic') result.subtopic = n.title;
    });
    return result;
  };

  return data.map((row: any) => {
    const node = nodeByNoteId.get(row.id);
    const chain = labelChain(node);
    return {
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      subject: chain.subject ?? row.subject ?? null,
      topic: chain.topic ?? null,
      subtopic: chain.subtopic ?? null,
      content: parseContent(row.content),
      is_pinned: !!node?.is_pinned,
      is_archived: !!node?.is_archived,
      created_at: row.created_at,
      updated_at: row.updated_at,
    } as PilotV2Note;
  });
}

export async function savePilotV2NoteContent(
  noteId: string,
  content: PilotV2NoteContent
): Promise<boolean> {
  const { error } = await supabase
    .from('user_notes')
    .update({
      content: JSON.stringify(content),
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId);
  return !error;
}

export async function renamePilotV2Note(noteId: string, title: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_notes')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', noteId);
  return !error;
}

/**
 * Create a fresh user_notes row + a Pilot V2 `note` node pointing to it.
 */
export async function createPilotV2Note(input: {
  userId: string;
  title: string;
  subject: string;
  parentNodeId: string;
  initialBlocks?: PilotV2Block[];
  layout?: 'standard' | 'wide';
}): Promise<{ noteId: string; nodeId: string } | null> {
  const empty: PilotV2NoteContent = {
    blocks: input.initialBlocks ?? [],
    version: 1,
    layout: input.layout ?? 'standard',
  };
  const { data: note, error: noteErr } = await supabase
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
  if (noteErr || !note) {
    console.warn('[pilot-v2] createNote row error', noteErr?.message);
    return null;
  }
  const node = await createPilotV2Node({
    userId: input.userId,
    type: 'note',
    title: input.title,
    parentId: input.parentNodeId,
    noteId: note.id,
  });
  if (!node) return null;
  return { noteId: note.id, nodeId: node.id };
}

/**
 * Append blocks to an existing Pilot V2 note (used by Quiz Engine integration
 * in Step 11). Loads the current content, concatenates, then saves.
 */
export async function appendBlocksToPilotV2Note(
  noteId: string,
  blocks: PilotV2Block[]
): Promise<boolean> {
  const current = await fetchPilotV2Note(noteId);
  const next: PilotV2NoteContent = {
    ...(current?.content ?? EMPTY_CONTENT),
    blocks: [...((current?.content?.blocks) || []), ...blocks],
  };
  return savePilotV2NoteContent(noteId, next);
}

/* -------------------------------------------------------------------------- */
/* Tree helpers                                                               */
/* -------------------------------------------------------------------------- */

export interface PilotV2TreeNode extends PilotV2Node {
  children: PilotV2TreeNode[];
  noteCount: number;
}

export function buildPilotV2Tree(nodes: PilotV2Node[]): PilotV2TreeNode[] {
  const map = new Map<string, PilotV2TreeNode>();
  nodes.forEach(n => map.set(n.id, { ...n, children: [], noteCount: 0 }));

  const roots: PilotV2TreeNode[] = [];
  map.forEach(node => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const countNotes = (n: PilotV2TreeNode): number => {
    if (n.type === 'note') { n.noteCount = 1; return 1; }
    let total = 0;
    n.children.forEach(c => { total += countNotes(c); });
    n.noteCount = total;
    return total;
  };
  roots.forEach(countNotes);

  const order: Record<PilotV2NodeType, number> = {
    subject: 0, topic: 1, subtopic: 2, note: 3,
  };
  const sortRec = (arr: PilotV2TreeNode[]) => {
    arr.sort((a, b) => {
      if (order[a.type] !== order[b.type]) return order[a.type] - order[b.type];
      return (a.title || '').localeCompare(b.title || '');
    });
    arr.forEach(n => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/**
 * Find an existing Pilot V2 note by hierarchy (subject -> topic -> subtopic ->
 * title) or create one. Used by the Quiz Engine "Save to Pilot V2" button to
 * avoid duplicate notebooks.
 */
export async function findOrCreatePilotV2Note(input: {
  userId: string;
  subject: string;
  topic?: string | null;
  subtopic?: string | null;
  title: string;
  layout?: 'standard' | 'wide';
}): Promise<{ noteId: string; nodeId: string; isNew: boolean }> {
  // Find-or-create a node strictly within the Pilot V2 surface. Filtering by
  // `metadata->>surface` AND using a list-with-limit (instead of maybeSingle)
  // makes this resilient to legacy duplicate rows that might exist in the
  // table — without this guard `maybeSingle()` errors on duplicates and we
  // silently fell through to creating yet another node every time, which is
  // exactly what produced the duplicate "Bhakti and Sufi" notebooks reported
  // by the user.
  const ensureNode = async (
    type: PilotV2NodeType,
    title: string,
    parentId: string | null
  ): Promise<PilotV2Node> => {
    let query = supabase
      .from('user_note_nodes')
      .select('*')
      .eq('user_id', input.userId)
      .eq('type', type)
      .eq('title', title)
      .eq('is_archived', false)
      .eq('metadata->>surface', PILOT_V2_SURFACE)
      .order('created_at', { ascending: true })
      .limit(1);
    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }
    const { data } = await query;
    const existing = Array.isArray(data) && data.length > 0 ? (data[0] as PilotV2Node) : null;
    if (existing) return existing;
    const created = await createPilotV2Node({
      userId: input.userId, type, title, parentId,
    });
    if (!created) throw new Error(`[pilot-v2] failed to create ${type} node`);
    return created;
  };

  const subjectNode = await ensureNode('subject', input.subject, null);
  let parent = subjectNode;
  if (input.topic) {
    parent = await ensureNode('topic', input.topic, subjectNode.id);
  }
  if (input.subtopic) {
    parent = await ensureNode('subtopic', input.subtopic, parent.id);
  }

  // Look for an existing note with the same title under this parent. We
  // restrict to the Pilot V2 surface and take the oldest match so repeat
  // saves consistently append to the same notebook rather than spawning a
  // duplicate every time.
  const { data: existingList } = await supabase
    .from('user_note_nodes')
    .select('id, note_id, metadata')
    .eq('user_id', input.userId)
    .eq('parent_id', parent.id)
    .eq('type', 'note')
    .eq('title', input.title)
    .eq('is_archived', false)
    .eq('metadata->>surface', PILOT_V2_SURFACE)
    .order('created_at', { ascending: true })
    .limit(1);

  const existing = Array.isArray(existingList) && existingList.length > 0 ? existingList[0] : null;
  if (existing && existing.note_id) {
    return { noteId: existing.note_id as string, nodeId: existing.id as string, isNew: false };
  }

  const created = await createPilotV2Note({
    userId: input.userId,
    title: input.title,
    subject: input.subject,
    parentNodeId: parent.id,
    layout: input.layout,
  });
  if (!created) throw new Error('[pilot-v2] failed to create note');
  return { ...created, isNew: true };
}

/**
 * Build the user's actual Pilot V2 hierarchy as plain-string option lists for
 * Subject / Topic / Microtopic dropdowns. Lets the Save Sheet show every
 * subject/topic/subtopic the user has *already* created — not just the static
 * palette — so users can re-route a quiz save into any branch they own.
 */
export async function fetchPilotV2HierarchyOptions(userId: string): Promise<{
  subjects: string[];
  topicsBySubject: Record<string, string[]>;
  subtopicsByTopic: Record<string, string[]>;
}> {
  const nodes = await fetchAllPilotV2Nodes(userId, false);
  const byId = new Map<string, PilotV2Node>();
  nodes.forEach(n => byId.set(n.id, n));

  const subjects = new Set<string>();
  const topicsBySubject: Record<string, Set<string>> = {};
  // Microtopics are keyed by `${subject}::${topic}` so that two different
  // subjects can have a topic of the same name without leaking subtopics
  // across subjects.
  const subtopicsByTopic: Record<string, Set<string>> = {};

  const subjectTitleOf = (n: PilotV2Node): string | null => {
    let cur: PilotV2Node | undefined = n;
    while (cur && cur.type !== 'subject') {
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return cur?.type === 'subject' ? cur.title : null;
  };

  nodes.forEach(n => {
    if (n.type === 'subject') {
      subjects.add(n.title);
      topicsBySubject[n.title] ??= new Set();
    } else if (n.type === 'topic') {
      const subj = subjectTitleOf(n);
      if (!subj) return;
      topicsBySubject[subj] ??= new Set();
      topicsBySubject[subj].add(n.title);
    } else if (n.type === 'subtopic') {
      const subj = subjectTitleOf(n);
      const topicNode = n.parent_id ? byId.get(n.parent_id) : null;
      if (!subj || !topicNode || topicNode.type !== 'topic') return;
      const key = `${subj}::${topicNode.title}`;
      subtopicsByTopic[key] ??= new Set();
      subtopicsByTopic[key].add(n.title);
    }
  });

  const toSorted = (s: Set<string>) => Array.from(s).sort((a, b) => a.localeCompare(b));
  return {
    subjects: toSorted(subjects),
    topicsBySubject: Object.fromEntries(
      Object.entries(topicsBySubject).map(([k, v]) => [k, toSorted(v)])
    ),
    subtopicsByTopic: Object.fromEntries(
      Object.entries(subtopicsByTopic).map(([k, v]) => [k, toSorted(v)])
    ),
  };
}

/**
 * Get all notebooks under a specific hierarchy level
 */
export async function fetchNotebooksAtLevel(
  userId: string,
  subject: string,
  topic?: string | null,
  subtopic?: string | null
): Promise<string[]> {
  const ensureNode = async (
    type: PilotV2NodeType,
    title: string,
    parentId: string | null
  ): Promise<PilotV2Node | null> => {
    let query = supabase
      .from('user_note_nodes')
      .select('id, title')
      .eq('user_id', userId)
      .eq('type', type)
      .eq('title', title)
      .eq('is_archived', false)
      .eq('metadata->>surface', PILOT_V2_SURFACE);

    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    const { data } = await query.maybeSingle();
    return data as PilotV2Node | null;
  };

  try {
    let parent: PilotV2Node | null = await ensureNode('subject', subject, null);
    if (!parent) return [];

    if (topic) {
      parent = await ensureNode('topic', topic, parent.id);
      if (!parent) return [];
    }

    if (subtopic) {
      parent = await ensureNode('subtopic', subtopic, parent.id);
      if (!parent) return [];
    }

    const { data: notebooks } = await supabase
      .from('user_note_nodes')
      .select('title')
      .eq('user_id', userId)
      .eq('parent_id', parent.id)
      .eq('type', 'note')
      .eq('is_archived', false)
      .eq('metadata->>surface', PILOT_V2_SURFACE)
      .order('updated_at', { ascending: false });

    return notebooks?.map(n => n.title) || [];
  } catch (error) {
    console.error('[pilot-v2] Failed to fetch notebooks:', error);
    return [];
  }
}

/** Ensure a Pilot V2 subject row exists (creates when missing). */
export async function ensurePilotV2SubjectNode(userId: string, title: string): Promise<PilotV2Node | null> {
  const { data } = await supabase
    .from('user_note_nodes')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'subject')
    .eq('title', title)
    .eq('is_archived', false)
    .eq('metadata->>surface', PILOT_V2_SURFACE)
    .is('parent_id', null)
    .order('created_at', { ascending: true })
    .limit(1);
  const existing = Array.isArray(data) && data[0] ? (data[0] as PilotV2Node) : null;
  if (existing) return existing;
  return createPilotV2Node({ userId, type: 'subject', title, parentId: null });
}

/** Create a section-group (topic) folder under a subject if it does not already exist. */
export async function ensurePilotV2TopicNode(
  userId: string,
  subjectTitle: string,
  topicTitle: string
): Promise<PilotV2Node | null> {
  const subj = await ensurePilotV2SubjectNode(userId, subjectTitle);
  if (!subj) return null;
  const { data } = await supabase
    .from('user_note_nodes')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'topic')
    .eq('title', topicTitle)
    .eq('parent_id', subj.id)
    .eq('is_archived', false)
    .eq('metadata->>surface', PILOT_V2_SURFACE)
    .order('created_at', { ascending: true })
    .limit(1);
  const existing = Array.isArray(data) && data[0] ? (data[0] as PilotV2Node) : null;
  if (existing) return existing;
  return createPilotV2Node({ userId, type: 'topic', title: topicTitle, parentId: subj.id });
}

/** Create a micro-topic (subtopic) folder under subject → topic if missing. */
export async function ensurePilotV2SubtopicNode(
  userId: string,
  subjectTitle: string,
  topicTitle: string,
  subtopicTitle: string
): Promise<PilotV2Node | null> {
  const topic = await ensurePilotV2TopicNode(userId, subjectTitle, topicTitle);
  if (!topic) return null;
  const { data } = await supabase
    .from('user_note_nodes')
    .select('*')
    .eq('user_id', userId)
    .eq('type', 'subtopic')
    .eq('title', subtopicTitle)
    .eq('parent_id', topic.id)
    .eq('is_archived', false)
    .eq('metadata->>surface', PILOT_V2_SURFACE)
    .order('created_at', { ascending: true })
    .limit(1);
  const existing = Array.isArray(data) && data[0] ? (data[0] as PilotV2Node) : null;
  if (existing) return existing;
  return createPilotV2Node({ userId, type: 'subtopic', title: subtopicTitle, parentId: topic.id });
}
