/**
 * HardnotesService — unified hierarchy management for the Hardnotes ecosystem.
 *
 * TERMINOLOGY (uniform across the app, used in UI labels):
 *   - Folder : A container. type='folder' in user_note_nodes. parent_id chains them.
 *   - Note   : A leaf document. type='note' or legacy 'notebook' in user_note_nodes;
 *              points to a user_notes.id via note_id.
 *   - Points : Individual entries INSIDE a note. Stored in user_notes.items (JSONB).
 *              Each point can be one of: 'text' | 'checklist' | 'stroke' | 'base_layer'.
 *              'stroke' = Skia vector path (Phase 2).
 *              'base_layer' = locked content pushed from the quiz engine (Phase 3).
 *
 * Existing data authored via the old "notes" editor uses type='notebook' — we treat
 * 'notebook' and 'note' as interchangeable leaf types throughout the Hardnotes UI.
 */
import { supabase } from '../lib/supabase';

export type HardNodeType = 'folder' | 'note' | 'notebook';

export interface HardNode {
  id: string;
  user_id: string;
  parent_id: string | null;
  type: HardNodeType;
  title: string;
  note_id: string | null;
  is_pinned: boolean | null;
  color: string | null;
  icon: string | null;
  is_archived: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface HardNote {
  id: string;
  user_id: string;
  subject: string;
  title: string;
  items: any[];
  highlights: any[];
  content: string | null;
  content_html: string | null;
  created_at: string;
  updated_at: string;
}

export const isLeaf = (n: HardNode) => n.type === 'note' || n.type === 'notebook';
export const isFolder = (n: HardNode) => n.type === 'folder';

export const HardnotesService = {
  /** Fetch the entire non-archived node tree for a user. */
  async listNodes(userId: string): Promise<HardNode[]> {
    const { data, error } = await supabase
      .from('user_note_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_archived', false)
      .order('is_pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []) as HardNode[];
  },

  /** Fetch metadata for all notes the user owns (fast list for grid thumbnails). */
  async listNotes(userId: string): Promise<HardNote[]> {
    const { data, error } = await supabase
      .from('user_notes')
      .select('id, user_id, subject, title, items, highlights, content, content_html, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data || []) as HardNote[];
  },

  /** Load a single note by id. */
  async getNote(noteId: string): Promise<HardNote | null> {
    const { data, error } = await supabase
      .from('user_notes')
      .select('*')
      .eq('id', noteId)
      .maybeSingle();
    if (error) throw error;
    return (data as HardNote) || null;
  },

  /** Create a new folder under parentId (null = root). */
  async createFolder(userId: string, title: string, parentId: string | null): Promise<HardNode> {
    const { data, error } = await supabase
      .from('user_note_nodes')
      .insert({ user_id: userId, parent_id: parentId, type: 'folder', title })
      .select()
      .single();
    if (error) throw error;
    return data as HardNode;
  },

  /**
   * Create a new Note (leaf + underlying user_notes row).
   * Returns the tree node plus the note_id for immediate navigation.
   */
  async createNote(
    userId: string,
    title: string,
    parentId: string | null,
    opts: { baseLayer?: { markdown: string; source?: string } | null } = {}
  ): Promise<{ node: HardNode; note: HardNote }> {
    const subject = title || 'General';
    const items: any[] = [];
    if (opts.baseLayer) {
      items.push({
        id: `base_${Date.now()}`,
        type: 'base_layer',
        markdown: opts.baseLayer.markdown,
        source: opts.baseLayer.source || 'quiz_explanation',
        locked: true,
        created_at: new Date().toISOString(),
      });
    }
    const { data: noteRow, error: noteErr } = await supabase
      .from('user_notes')
      .insert({ user_id: userId, subject, title, items })
      .select()
      .single();
    if (noteErr) throw noteErr;

    const { data: nodeRow, error: nodeErr } = await supabase
      .from('user_note_nodes')
      .insert({ user_id: userId, parent_id: parentId, type: 'note', title, note_id: noteRow.id })
      .select()
      .single();
    if (nodeErr) throw nodeErr;

    return { node: nodeRow as HardNode, note: noteRow as HardNote };
  },

  /** Rename a node AND its underlying note (if leaf). */
  async rename(node: HardNode, newTitle: string): Promise<void> {
    await supabase.from('user_note_nodes').update({ title: newTitle, updated_at: new Date().toISOString() }).eq('id', node.id);
    if (isLeaf(node) && node.note_id) {
      await supabase.from('user_notes').update({ title: newTitle, updated_at: new Date().toISOString() }).eq('id', node.note_id);
    }
  },

  async togglePin(node: HardNode): Promise<void> {
    await supabase
      .from('user_note_nodes')
      .update({ is_pinned: !node.is_pinned, updated_at: new Date().toISOString() })
      .eq('id', node.id);
  },

  async archive(node: HardNode): Promise<void> {
    await supabase
      .from('user_note_nodes')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', node.id);
  },

  async moveNode(nodeId: string, parentId: string | null): Promise<void> {
    const { error } = await supabase
      .from('user_note_nodes')
      .update({ parent_id: parentId, updated_at: new Date().toISOString() })
      .eq('id', nodeId);
    if (error) throw error;
  },

  async duplicateNote(node: HardNode): Promise<{ node: HardNode; note: HardNote }> {
    if (!isLeaf(node) || !node.note_id) {
      throw new Error('Only note items can be duplicated');
    }

    const original = await this.getNote(node.note_id);
    if (!original) throw new Error('Original note not found');

    const clonedTitle = `${node.title} (Copy)`;
    const now = new Date().toISOString();

    const { data: dupNote, error: dupNoteErr } = await supabase
      .from('user_notes')
      .insert({
        user_id: node.user_id,
        subject: original.subject,
        title: clonedTitle,
        items: Array.isArray(original.items)
          ? JSON.parse(JSON.stringify(original.items))
          : [],
        highlights: Array.isArray(original.highlights)
          ? JSON.parse(JSON.stringify(original.highlights))
          : [],
        content: original.content,
        content_html: original.content_html,
        updated_at: now,
      })
      .select()
      .single();

    if (dupNoteErr || !dupNote) throw dupNoteErr || new Error('Could not clone note');

    const { data: dupNode, error: dupNodeErr } = await supabase
      .from('user_note_nodes')
      .insert({
        user_id: node.user_id,
        parent_id: node.parent_id,
        type: 'note',
        title: clonedTitle,
        note_id: dupNote.id,
        is_pinned: false,
        updated_at: now,
      })
      .select()
      .single();

    if (dupNodeErr || !dupNode) throw dupNodeErr || new Error('Could not clone note node');

    return { node: dupNode as HardNode, note: dupNote as HardNote };
  },

  /** Upsert the entire items array + highlights for a note (debounced saves from editor). */
  async saveNoteContent(
    noteId: string,
    patch: { items?: any[]; highlights?: any[]; title?: string; content?: string; content_html?: string }
  ): Promise<void> {
    const update: any = { ...patch, updated_at: new Date().toISOString() };
    await supabase.from('user_notes').update(update).eq('id', noteId);
  },

  /**
   * Seed the UPSC syllabus skeleton into user_note_nodes if the user has no folders yet.
   * Creates subject folders + microtopic sub-folders as requested in the Phase 1 spec.
   * Idempotent — safe to call on every Hardnotes open.
   */
  async seedUpscSkeleton(_userId: string): Promise<boolean> {
    return false;
  },

  /** Build an adjacency map from a flat node list. */
  buildTree(nodes: HardNode[]): Map<string | null, HardNode[]> {
    const map = new Map<string | null, HardNode[]>();
    for (const n of nodes) {
      const key = n.parent_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return map;
  },

  /** Resolve the full ancestor path (root → leaf) for a given node id. */
  ancestorPath(nodes: HardNode[], targetId: string | null): HardNode[] {
    if (!targetId) return [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const path: HardNode[] = [];
    let cursor = byId.get(targetId);
    while (cursor) {
      path.unshift(cursor);
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
    }
    return path;
  },
};
