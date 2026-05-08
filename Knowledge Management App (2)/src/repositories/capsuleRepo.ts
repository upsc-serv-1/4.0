import { supabase } from '../lib/supabase';

export type CapsuleNodeType = 'subject' | 'topic' | 'subtopic' | 'notebook';

export interface CapsuleNode {
  id: string;
  user_id: string;
  parent_id: string | null;
  type: CapsuleNodeType;
  title: string;
  color: string | null;
  icon: string | null;
  note_id: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface CapsuleBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'bullet' | 'code' | 'image' | 'flashcard';
  text: string;
  metadata?: Record<string, any>;
}

export interface CapsuleNotebookContent {
  blocks: CapsuleBlock[];
  highlights?: any[];
  version?: number;
}

const CAPSULE_SURFACE_KEY = 'capsule';
const CAPSULE_TYPES: CapsuleNodeType[] = ['subject', 'topic', 'subtopic', 'notebook'];

const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `web_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

/* -------------------------------------------------------------------------- */
/* Hierarchy CRUD                                                            */
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

/* -------------------------------------------------------------------------- */
/* Notebook Content (Blocks)                                                 */
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
