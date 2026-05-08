/**
 * SoftNotesService — Supabase CRUD for the Soft Notes (Notability clone) subsystem.
 *
 * Tables: soft_notebooks, soft_pages, soft_strokes, soft_text_boxes
 * (See `Hardnotes upgrade/SOFTNOTES_MIGRATION.sql`.)
 *
 * Strokes & text boxes are rate-limited via debounced upsert from the editor;
 * this service is intentionally thin — no caching, no realtime here.
 */
import { supabase } from '../lib/supabase';
import {
  Notebook, Page, SoftStroke, TextBox,
  DEFAULT_PAGE_WIDTH, DEFAULT_PAGE_HEIGHT,
} from './types';

// ===== Notebooks =====
export const SoftNotebookService = {
  async list(userId: string, opts?: { archived?: boolean }): Promise<Notebook[]> {
    let q = supabase
      .from('soft_notebooks')
      .select('id,user_id,name,cover_color,paper_style,archived,pinned,created_at,updated_at')
      .eq('user_id', userId)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (opts?.archived !== undefined) q = q.eq('archived', opts.archived);
    const { data, error } = await q;
    if (error) { console.warn('[soft] list notebooks', error); return []; }
    return (data || []) as Notebook[];
  },

  async create(userId: string, init?: Partial<Notebook>): Promise<Notebook | null> {
    const row = {
      user_id: userId,
      name: init?.name || 'Untitled notebook',
      cover_color: init?.cover_color || '#fde68a',
      paper_style: init?.paper_style || 'plain',
    };
    const { data, error } = await supabase
      .from('soft_notebooks').insert(row)
      .select('id,user_id,name,cover_color,paper_style,archived,pinned,created_at,updated_at')
      .single();
    if (error || !data) { console.warn('[soft] create notebook', error); return null; }
    // Seed first page so the editor opens to something.
    await SoftPageService.create((data as any).id, 0);
    return data as Notebook;
  },

  async update(id: string, patch: Partial<Notebook>): Promise<void> {
    const { error } = await supabase.from('soft_notebooks').update(patch).eq('id', id);
    if (error) console.warn('[soft] update notebook', error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('soft_notebooks').delete().eq('id', id);
    if (error) console.warn('[soft] delete notebook', error);
  },
};

// ===== Pages =====
export const SoftPageService = {
  async list(notebookId: string): Promise<Page[]> {
    const { data, error } = await supabase
      .from('soft_pages')
      .select('id,notebook_id,order_index,width,height,paper_style,created_at,updated_at')
      .eq('notebook_id', notebookId)
      .order('order_index', { ascending: true });
    if (error) { console.warn('[soft] list pages', error); return []; }
    return (data || []) as Page[];
  },

  async create(notebookId: string, orderIndex: number): Promise<Page | null> {
    const { data, error } = await supabase
      .from('soft_pages')
      .insert({
        notebook_id: notebookId,
        order_index: orderIndex,
        width: DEFAULT_PAGE_WIDTH,
        height: DEFAULT_PAGE_HEIGHT,
      })
      .select('id,notebook_id,order_index,width,height,paper_style,created_at,updated_at')
      .single();
    if (error || !data) { console.warn('[soft] create page', error); return null; }
    return data as Page;
  },

  async remove(pageId: string): Promise<void> {
    const { error } = await supabase.from('soft_pages').delete().eq('id', pageId);
    if (error) console.warn('[soft] delete page', error);
  },

  async reorder(pageId: string, orderIndex: number): Promise<void> {
    const { error } = await supabase.from('soft_pages').update({ order_index: orderIndex }).eq('id', pageId);
    if (error) console.warn('[soft] reorder page', error);
  },
};

// ===== Strokes =====
export const SoftStrokeService = {
  async list(pageId: string): Promise<SoftStroke[]> {
    const { data, error } = await supabase
      .from('soft_strokes')
      .select('id,page_id,tool,color,width,opacity,raw_points,bezier_points,bounding_box,z_index,created_at')
      .eq('page_id', pageId)
      .order('z_index', { ascending: true });
    if (error) { console.warn('[soft] list strokes', error); return []; }
    return (data || []) as SoftStroke[];
  },

  /** Insert a single stroke. */
  async insert(stroke: SoftStroke): Promise<void> {
    const { error } = await supabase.from('soft_strokes').insert({
      id: stroke.id,
      page_id: stroke.page_id,
      tool: stroke.tool,
      color: stroke.color,
      width: stroke.width,
      opacity: stroke.opacity,
      raw_points: stroke.raw_points,
      bezier_points: stroke.bezier_points || null,
      bounding_box: stroke.bounding_box || null,
      z_index: stroke.z_index,
    });
    if (error) console.warn('[soft] insert stroke', error);
  },

  /** Bulk-insert strokes (used when batching). */
  async insertMany(strokes: SoftStroke[]): Promise<void> {
    if (strokes.length === 0) return;
    const rows = strokes.map((s) => ({
      id: s.id, page_id: s.page_id, tool: s.tool, color: s.color,
      width: s.width, opacity: s.opacity, raw_points: s.raw_points,
      bezier_points: s.bezier_points || null, bounding_box: s.bounding_box || null,
      z_index: s.z_index,
    }));
    const { error } = await supabase.from('soft_strokes').insert(rows);
    if (error) console.warn('[soft] insert strokes', error);
  },

  async remove(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await supabase.from('soft_strokes').delete().in('id', ids);
    if (error) console.warn('[soft] delete strokes', error);
  },

  async clearPage(pageId: string): Promise<void> {
    const { error } = await supabase.from('soft_strokes').delete().eq('page_id', pageId);
    if (error) console.warn('[soft] clear page strokes', error);
  },
};

// ===== Text boxes =====
export const SoftTextBoxService = {
  async list(pageId: string): Promise<TextBox[]> {
    const { data, error } = await supabase
      .from('soft_text_boxes')
      .select('id,page_id,x,y,width,height,content,font_size,font_family,color,z_index,created_at,updated_at')
      .eq('page_id', pageId)
      .order('z_index', { ascending: true });
    if (error) { console.warn('[soft] list text boxes', error); return []; }
    return (data || []) as TextBox[];
  },

  async create(tb: Omit<TextBox, 'created_at' | 'updated_at'>): Promise<void> {
    const { error } = await supabase.from('soft_text_boxes').insert(tb);
    if (error) console.warn('[soft] create text box', error);
  },

  async update(id: string, patch: Partial<TextBox>): Promise<void> {
    const { error } = await supabase.from('soft_text_boxes').update(patch).eq('id', id);
    if (error) console.warn('[soft] update text box', error);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('soft_text_boxes').delete().eq('id', id);
    if (error) console.warn('[soft] delete text box', error);
  },
};
