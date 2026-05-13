/**
 * Pilot V2 Repository — offline-first data layer.
 *
 * As of branch `2.8-offline-repair-by-emergent` every Pilot V2 read first
 * pulls from the local MMKV cache (populated by OfflineManager.syncAllContent)
 * and only attempts Supabase when `NetworkStatus.isOnline()` is true. Every
 * write updates the cache immediately and enqueues a `SyncQueue` job so the
 * change pushes to Supabase when connectivity returns.
 *
 * Storage keys (owned by OfflineManager):
 *   @user_note_nodes_<userId>   — full node hierarchy for that user
 *   @user_notes_<userId>        — every notebook the user has (any surface)
 *
 * Conflict policy: last-write-wins via `updated_at`.
 */
import { supabase } from '../lib/supabase';
import { NetworkStatus } from '../lib/networkStatus';
import { OfflineManager } from '../services/OfflineManager';
import { KVStore } from '../lib/kvStore';
import { SyncQueue } from '../services/SyncQueue';
import {
  PILOT_V2_SURFACE,
  PilotV2Block,
  PilotV2Node,
  PilotV2NodeType,
  PilotV2Note,
  PilotV2NoteContent,
} from '../components/pilot-v2/types';

const PILOT_V2_TYPES: PilotV2NodeType[] = ['subject', 'topic', 'subtopic', 'note'];

const USER_NOTE_NODES_PREFIX = '@user_note_nodes_';
const USER_NOTES_PREFIX = '@user_notes_';

const newId = (): string => {
  if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `pv2_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

// ───────────────────────────── KVStore helpers ────────────────────────────

function readLocalNodes(userId: string): PilotV2Node[] {
  return KVStore.getJson<PilotV2Node[]>(`${USER_NOTE_NODES_PREFIX}${userId}`) ?? [];
}
function writeLocalNodes(userId: string, nodes: PilotV2Node[]) {
  KVStore.setJson(`${USER_NOTE_NODES_PREFIX}${userId}`, nodes);
}
function upsertLocalNode(userId: string, node: PilotV2Node) {
  const all = readLocalNodes(userId);
  const idx = all.findIndex((n) => n.id === node.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...node };
  else all.push(node);
  writeLocalNodes(userId, all);
}
function patchLocalNode(userId: string, id: string, patch: Partial<PilotV2Node>) {
  const all = readLocalNodes(userId);
  const idx = all.findIndex((n) => n.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    writeLocalNodes(userId, all);
  }
}
function removeLocalNode(userId: string, id: string) {
  writeLocalNodes(userId, readLocalNodes(userId).filter((n) => n.id !== id));
}

function readLocalNotes(userId: string): any[] {
  return KVStore.getJson<any[]>(`${USER_NOTES_PREFIX}${userId}`) ?? [];
}
function writeLocalNotes(userId: string, notes: any[]) {
  KVStore.setJson(`${USER_NOTES_PREFIX}${userId}`, notes);
}
function upsertLocalNote(userId: string, note: any) {
  const all = readLocalNotes(userId);
  const idx = all.findIndex((n) => n.id === note.id);
  if (idx >= 0) all[idx] = { ...all[idx], ...note };
  else all.push(note);
  writeLocalNotes(userId, all);
}
function patchLocalNote(userId: string, id: string, patch: any) {
  const all = readLocalNotes(userId);
  const idx = all.findIndex((n) => n.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    writeLocalNotes(userId, all);
  }
}
function removeLocalNote(userId: string, id: string) {
  writeLocalNotes(userId, readLocalNotes(userId).filter((n) => n.id !== id));
}

/* -------------------------------------------------------------------------- */
/* Hierarchy                                                                  */
/* -------------------------------------------------------------------------- */

export async function fetchAllPilotV2Nodes(userId: string, includeArchived = false): Promise<PilotV2Node[]> {
  // 1. Always start from the local cache so the UI has data offline.
  const localNodes = readLocalNodes(userId)
    .filter((n) => PILOT_V2_TYPES.includes(n.type as PilotV2NodeType))
    .filter((n) => includeArchived || !(n as any).is_archived)
    .filter((n: any) => n?.metadata?.surface === PILOT_V2_SURFACE);

  // 2. If offline, this is all we can offer.
  if (!NetworkStatus.isOnline()) return localNodes;

  // 3. Online: refresh from Supabase and merge into the cache.
  try {
    let query = supabase
      .from('user_note_nodes')
      .select('*')
      .eq('user_id', userId)
      .in('type', PILOT_V2_TYPES);
    if (!includeArchived) query = query.eq('is_archived', false);
    const { data, error } = await query;
    if (error) return localNodes;
    const fresh = (data || []).filter((row: any) => row?.metadata?.surface === PILOT_V2_SURFACE) as PilotV2Node[];

    // Merge: server is source of truth for non-dirty rows; local _dirty rows
    // (not yet synced) take precedence so the user's edits aren't lost.
    const localAll = readLocalNodes(userId);
    const localById = new Map(localAll.map((n) => [n.id, n]));
    const merged = new Map<string, PilotV2Node>();
    fresh.forEach((n) => merged.set(n.id, n));
    localById.forEach((n: any, id) => {
      if (n._dirty) merged.set(id, n);
    });
    const mergedArr = Array.from(merged.values());
    writeLocalNodes(userId, mergedArr);
    return mergedArr.filter((n) => includeArchived || !(n as any).is_archived);
  } catch {
    return localNodes;
  }
}

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
  const now = new Date().toISOString();
  const node: any = {
    id: newId(),
    user_id: input.userId,
    parent_id: input.parentId ?? null,
    type: input.type,
    title: input.title,
    color: input.color ?? null,
    icon: input.icon ?? null,
    note_id: input.noteId ?? null,
    is_archived: false,
    is_pinned: false,
    metadata: { ...(input.metadata || {}), surface: PILOT_V2_SURFACE },
    created_at: now,
    updated_at: now,
    _dirty: true,
  };

  // 1. Write locally so it shows up instantly.
  upsertLocalNode(input.userId, node);

  // 2. Enqueue for server sync.
  const { _dirty, ...payload } = node;
  SyncQueue.enqueue('note_node_insert', payload);

  return node as PilotV2Node;
}

export async function renamePilotV2Node(id: string, title: string): Promise<boolean> {
  const updated_at = new Date().toISOString();
  // Locate node to find the user_id so we can update the cache.
  const allKeys = KVStore.getAllKeys().filter((k) => k.startsWith(USER_NOTE_NODES_PREFIX));
  let userId: string | null = null;
  for (const k of allKeys) {
    const rows = KVStore.getJson<any[]>(k) ?? [];
    if (rows.some((n) => n.id === id)) {
      userId = k.replace(USER_NOTE_NODES_PREFIX, '');
      patchLocalNode(userId, id, { title, updated_at } as any);
      break;
    }
  }
  SyncQueue.enqueue('note_node_update', { id, title, updated_at });
  return true;
}

export async function updatePilotV2NodeParent(id: string, parentId: string | null): Promise<boolean> {
  const updated_at = new Date().toISOString();
  const allKeys = KVStore.getAllKeys().filter((k) => k.startsWith(USER_NOTE_NODES_PREFIX));
  for (const k of allKeys) {
    const rows = KVStore.getJson<any[]>(k) ?? [];
    if (rows.some((n) => n.id === id)) {
      const userId = k.replace(USER_NOTE_NODES_PREFIX, '');
      patchLocalNode(userId, id, { parent_id: parentId, updated_at } as any);
      break;
    }
  }
  SyncQueue.enqueue('note_node_update', { id, parent_id: parentId, updated_at });
  return true;
}

export async function archivePilotV2Node(id: string): Promise<boolean> {
  const updated_at = new Date().toISOString();
  const allKeys = KVStore.getAllKeys().filter((k) => k.startsWith(USER_NOTE_NODES_PREFIX));
  for (const k of allKeys) {
    const rows = KVStore.getJson<any[]>(k) ?? [];
    if (rows.some((n) => n.id === id)) {
      const userId = k.replace(USER_NOTE_NODES_PREFIX, '');
      patchLocalNode(userId, id, { is_archived: true, updated_at } as any);
      break;
    }
  }
  SyncQueue.enqueue('note_node_update', { id, is_archived: true, updated_at });
  return true;
}

export async function restorePilotV2Node(id: string): Promise<boolean> {
  const updated_at = new Date().toISOString();
  const allKeys = KVStore.getAllKeys().filter((k) => k.startsWith(USER_NOTE_NODES_PREFIX));
  for (const k of allKeys) {
    const rows = KVStore.getJson<any[]>(k) ?? [];
    if (rows.some((n) => n.id === id)) {
      const userId = k.replace(USER_NOTE_NODES_PREFIX, '');
      patchLocalNode(userId, id, { is_archived: false, updated_at } as any);
      break;
    }
  }
  SyncQueue.enqueue('note_node_update', { id, is_archived: false, updated_at });
  return true;
}

export async function pinPilotV2Node(id: string, pinned: boolean): Promise<boolean> {
  const updated_at = new Date().toISOString();
  const allKeys = KVStore.getAllKeys().filter((k) => k.startsWith(USER_NOTE_NODES_PREFIX));
  for (const k of allKeys) {
    const rows = KVStore.getJson<any[]>(k) ?? [];
    if (rows.some((n) => n.id === id)) {
      const userId = k.replace(USER_NOTE_NODES_PREFIX, '');
      patchLocalNode(userId, id, { is_pinned: pinned, updated_at } as any);
      break;
    }
  }
  SyncQueue.enqueue('note_node_update', { id, is_pinned: pinned, updated_at });
  return true;
}

export async function purgePilotV2NoteNode(input: { nodeId: string; noteId?: string | null }): Promise<boolean> {
  const allKeys = KVStore.getAllKeys().filter((k) => k.startsWith(USER_NOTE_NODES_PREFIX));
  for (const k of allKeys) {
    const rows = KVStore.getJson<any[]>(k) ?? [];
    if (rows.some((n) => n.id === input.nodeId)) {
      const userId = k.replace(USER_NOTE_NODES_PREFIX, '');
      removeLocalNode(userId, input.nodeId);
      if (input.noteId) removeLocalNote(userId, input.noteId);
      break;
    }
  }
  SyncQueue.enqueue('note_node_delete', { id: input.nodeId });
  if (input.noteId) SyncQueue.enqueue('note_delete', { id: input.noteId });
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
    return {
      blocks: [{ id: newId(), type: 'paragraph', text: String(raw) }],
      version: 1,
    };
  }
  return { ...EMPTY_CONTENT };
};

function findUserIdForNote(noteId: string): string | null {
  const keys = KVStore.getAllKeys().filter((k) => k.startsWith(USER_NOTES_PREFIX));
  for (const k of keys) {
    const rows = KVStore.getJson<any[]>(k) ?? [];
    if (rows.some((n) => n.id === noteId)) {
      return k.replace(USER_NOTES_PREFIX, '');
    }
  }
  return null;
}

export async function fetchPilotV2Note(noteId: string): Promise<PilotV2Note | null> {
  // 1. Try local cache.
  const uid = findUserIdForNote(noteId);
  let local: any = null;
  if (uid) local = readLocalNotes(uid).find((n) => n.id === noteId) || null;

  if (!NetworkStatus.isOnline()) {
    if (!local) return null;
    return {
      id: local.id,
      user_id: local.user_id,
      title: local.title,
      subject: local.subject,
      content: parseContent(local.content),
      created_at: local.created_at,
      updated_at: local.updated_at,
    };
  }

  try {
    const { data, error } = await supabase
      .from('user_notes')
      .select('id, user_id, title, subject, content, created_at, updated_at')
      .eq('id', noteId)
      .maybeSingle();
    if (error || !data) {
      if (!local) return null;
      return {
        id: local.id, user_id: local.user_id, title: local.title, subject: local.subject,
        content: parseContent(local.content), created_at: local.created_at, updated_at: local.updated_at,
      };
    }
    if (data.user_id) upsertLocalNote(data.user_id, data);
    return {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      subject: data.subject,
      content: parseContent(data.content),
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  } catch {
    if (!local) return null;
    return {
      id: local.id, user_id: local.user_id, title: local.title, subject: local.subject,
      content: parseContent(local.content), created_at: local.created_at, updated_at: local.updated_at,
    };
  }
}

export async function fetchPilotV2NotesForUser(userId: string): Promise<PilotV2Note[]> {
  // Fetch hierarchy (offline-aware).
  const nodes = await fetchAllPilotV2Nodes(userId, true);
  const noteIds = nodes.filter((n) => n.type === 'note' && n.note_id).map((n) => n.note_id as string);
  if (noteIds.length === 0) return [];

  // 1. Local notes.
  const localNotes = readLocalNotes(userId).filter((n) => noteIds.includes(n.id));

  let data: any[] = localNotes;
  if (NetworkStatus.isOnline()) {
    try {
      const res = await supabase
        .from('user_notes')
        .select('id, user_id, title, subject, content, created_at, updated_at')
        .in('id', noteIds)
        .order('updated_at', { ascending: false });
      if (!res.error && res.data) {
        // Merge: server wins for non-dirty, dirty local rows survive.
        const localById = new Map(readLocalNotes(userId).map((n: any) => [n.id, n]));
        const merged = new Map<string, any>();
        res.data.forEach((row: any) => merged.set(row.id, row));
        localById.forEach((row: any, id) => {
          if (row._dirty) merged.set(id, row);
        });
        const mergedArr = Array.from(merged.values());
        // Persist merged set back to cache (including non-pilot notes for safety).
        const existingAll = readLocalNotes(userId);
        const otherIds = new Set(existingAll.map((n: any) => n.id));
        mergedArr.forEach((n: any) => otherIds.add(n.id));
        const persist = existingAll.filter((n: any) => !mergedArr.find((m: any) => m.id === n.id)).concat(mergedArr);
        writeLocalNotes(userId, persist);
        data = mergedArr.filter((n: any) => noteIds.includes(n.id));
      }
    } catch { /* keep local */ }
  }

  const nodeByNoteId = new Map<string, PilotV2Node>();
  nodes.forEach((n) => { if (n.note_id) nodeByNoteId.set(n.note_id, n); });
  const nodeById = new Map<string, PilotV2Node>();
  nodes.forEach((n) => nodeById.set(n.id, n));

  const labelChain = (leaf: PilotV2Node | undefined): { subject?: string; topic?: string; subtopic?: string } => {
    const result: any = {};
    let cur: PilotV2Node | undefined = leaf?.parent_id ? nodeById.get(leaf.parent_id) : undefined;
    const chain: PilotV2Node[] = [];
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id ? nodeById.get(cur.parent_id) : undefined;
    }
    chain.forEach((n) => {
      if (n.type === 'subject') result.subject = n.title;
      else if (n.type === 'topic') result.topic = n.title;
      else if (n.type === 'subtopic') result.subtopic = n.title;
    });
    return result;
  };

  return (data || []).map((row: any) => {
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
  }).sort((a: any, b: any) => (b.updated_at || '').localeCompare(a.updated_at || ''));
}

export async function savePilotV2NoteContent(
  noteId: string,
  content: PilotV2NoteContent
): Promise<boolean> {
  const updated_at = new Date().toISOString();
  const contentJson = JSON.stringify(content);
  const uid = findUserIdForNote(noteId);
  if (uid) patchLocalNote(uid, noteId, { content: contentJson, updated_at, _dirty: true });
  SyncQueue.enqueue('note_content_upsert', { id: noteId, content: contentJson, updated_at });
  return true;
}

export async function renamePilotV2Note(noteId: string, title: string): Promise<boolean> {
  const updated_at = new Date().toISOString();
  const uid = findUserIdForNote(noteId);
  if (uid) patchLocalNote(uid, noteId, { title, updated_at, _dirty: true });
  SyncQueue.enqueue('note_content_upsert', { id: noteId, title, updated_at });
  return true;
}

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
  const now = new Date().toISOString();
  const noteRow: any = {
    id: newId(),
    user_id: input.userId,
    subject: input.subject,
    title: input.title,
    content: JSON.stringify(empty),
    content_html: '',
    checklist_notes: '',
    items: [],
    highlights: [],
    created_at: now,
    updated_at: now,
    _dirty: true,
  };
  upsertLocalNote(input.userId, noteRow);

  // Sync note row (strip _dirty).
  const { _dirty, ...notePayload } = noteRow;
  SyncQueue.enqueue('note_insert', notePayload);

  const node = await createPilotV2Node({
    userId: input.userId,
    type: 'note',
    title: input.title,
    parentId: input.parentNodeId,
    noteId: noteRow.id,
  });
  if (!node) return null;
  return { noteId: noteRow.id, nodeId: node.id };
}

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
  nodes.forEach((n) => map.set(n.id, { ...n, children: [], noteCount: 0 }));

  const roots: PilotV2TreeNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const countNotes = (n: PilotV2TreeNode): number => {
    if (n.type === 'note') { n.noteCount = 1; return 1; }
    let total = 0;
    n.children.forEach((c) => { total += countNotes(c); });
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
    arr.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

/**
 * Find an existing Pilot V2 note by hierarchy or create one — offline-aware.
 * Uses local cache lookups when offline; falls back to Supabase only when online.
 */
export async function findOrCreatePilotV2Note(input: {
  userId: string;
  subject: string;
  topic?: string | null;
  subtopic?: string | null;
  title: string;
  layout?: 'standard' | 'wide';
}): Promise<{ noteId: string; nodeId: string; isNew: boolean }> {
  const findLocalNode = (
    type: PilotV2NodeType,
    title: string,
    parentId: string | null
  ): PilotV2Node | null => {
    const all = readLocalNodes(input.userId);
    return (all.find((n: any) =>
      n.type === type &&
      n.title === title &&
      ((parentId === null && (n.parent_id == null)) || n.parent_id === parentId) &&
      !n.is_archived &&
      n?.metadata?.surface === PILOT_V2_SURFACE
    ) as any) || null;
  };

  const ensureNode = async (
    type: PilotV2NodeType,
    title: string,
    parentId: string | null
  ): Promise<PilotV2Node> => {
    const local = findLocalNode(type, title, parentId);
    if (local) return local;
    const created = await createPilotV2Node({
      userId: input.userId, type, title, parentId,
    });
    if (!created) throw new Error(`[pilot-v2] failed to create ${type} node`);
    return created;
  };

  const subjectNode = await ensureNode('subject', input.subject, null);
  let parent = subjectNode;
  if (input.topic) parent = await ensureNode('topic', input.topic, subjectNode.id);
  if (input.subtopic) parent = await ensureNode('subtopic', input.subtopic, parent.id);

  const existing = findLocalNode('note', input.title, parent.id);
  if (existing && existing.note_id) {
    return { noteId: existing.note_id, nodeId: existing.id, isNew: false };
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

export async function fetchPilotV2HierarchyOptions(userId: string): Promise<{
  subjects: string[];
  topicsBySubject: Record<string, string[]>;
  subtopicsByTopic: Record<string, string[]>;
}> {
  const nodes = await fetchAllPilotV2Nodes(userId, false);
  const byId = new Map<string, PilotV2Node>();
  nodes.forEach((n) => byId.set(n.id, n));

  const subjects = new Set<string>();
  const topicsBySubject: Record<string, Set<string>> = {};
  const subtopicsByTopic: Record<string, Set<string>> = {};

  const subjectTitleOf = (n: PilotV2Node): string | null => {
    let cur: PilotV2Node | undefined = n;
    while (cur && cur.type !== 'subject') {
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return cur?.type === 'subject' ? cur.title : null;
  };

  nodes.forEach((n) => {
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

export async function fetchNotebooksAtLevel(
  userId: string,
  subject: string,
  topic?: string | null,
  subtopic?: string | null
): Promise<string[]> {
  const nodes = await fetchAllPilotV2Nodes(userId, false);
  const findChild = (type: PilotV2NodeType, title: string, parentId: string | null): PilotV2Node | null => {
    return (nodes.find((n: any) =>
      n.type === type && n.title === title &&
      ((parentId === null && (n.parent_id == null)) || n.parent_id === parentId) &&
      n?.metadata?.surface === PILOT_V2_SURFACE
    ) as any) || null;
  };
  let parent: PilotV2Node | null = findChild('subject', subject, null);
  if (!parent) return [];
  if (topic) {
    parent = findChild('topic', topic, parent.id);
    if (!parent) return [];
  }
  if (subtopic) {
    parent = findChild('subtopic', subtopic, parent.id);
    if (!parent) return [];
  }
  const seen = new Set<string>();
  return nodes
    .filter((n: any) => n.parent_id === parent!.id && n.type === 'note' && !n.is_archived && n?.metadata?.surface === PILOT_V2_SURFACE)
    .map((n) => n.title)
    .filter((t) => {
      if (seen.has(t)) return false;
      seen.add(t);
      return true;
    });
}

export async function ensurePilotV2SubjectNode(userId: string, title: string): Promise<PilotV2Node | null> {
  const nodes = await fetchAllPilotV2Nodes(userId, false);
  const existing = nodes.find((n: any) =>
    n.type === 'subject' && n.title === title && !n.parent_id && !n.is_archived
  );
  if (existing) return existing as any;
  return createPilotV2Node({ userId, type: 'subject', title, parentId: null });
}

export async function ensurePilotV2TopicNode(
  userId: string,
  subjectTitle: string,
  topicTitle: string
): Promise<PilotV2Node | null> {
  const subj = await ensurePilotV2SubjectNode(userId, subjectTitle);
  if (!subj) return null;
  const nodes = await fetchAllPilotV2Nodes(userId, false);
  const existing = nodes.find((n: any) =>
    n.type === 'topic' && n.title === topicTitle && n.parent_id === subj.id && !n.is_archived
  );
  if (existing) return existing as any;
  return createPilotV2Node({ userId, type: 'topic', title: topicTitle, parentId: subj.id });
}

export async function ensurePilotV2SubtopicNode(
  userId: string,
  subjectTitle: string,
  topicTitle: string,
  subtopicTitle: string
): Promise<PilotV2Node | null> {
  const topic = await ensurePilotV2TopicNode(userId, subjectTitle, topicTitle);
  if (!topic) return null;
  const nodes = await fetchAllPilotV2Nodes(userId, false);
  const existing = nodes.find((n: any) =>
    n.type === 'subtopic' && n.title === subtopicTitle && n.parent_id === topic.id && !n.is_archived
  );
  if (existing) return existing as any;
  return createPilotV2Node({ userId, type: 'subtopic', title: subtopicTitle, parentId: topic.id });
}

// Re-export OfflineManager so consumers don't need a direct import (kept for
// backward compat with any callers that imported it from this module).
export { OfflineManager };
