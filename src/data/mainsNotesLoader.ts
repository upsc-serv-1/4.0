import { supabase } from '../lib/supabase';

export interface MainsNoteItem {
  id: string;
  user_id: string;
  title: string;
  content_markdown: string;
  paper: string;
  subject: string;
  section_group?: string;
  microtopic?: string;
  subtopic?: string;
  nanotopic?: string;
  is_favorite?: boolean;
  revision_tags?: string[];
  created_at?: string;
  updated_at?: string;
}

let mainsNotesCache: Record<string, MainsNoteItem[]> = {};

export function getCachedMainsNotes(userId: string): MainsNoteItem[] {
  return mainsNotesCache[userId] || [];
}

export async function fetchMainsNotesFromSupabase(userId: string): Promise<MainsNoteItem[]> {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('mains_notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Error fetching mains notes from Supabase:', error.message);
      return mainsNotesCache[userId] || [];
    }

    mainsNotesCache[userId] = data || [];
    return mainsNotesCache[userId];
  } catch (err) {
    console.warn('Failed to fetch mains notes:', err);
    return mainsNotesCache[userId] || [];
  }
}

export async function insertMainsNote(userId: string, payload: Partial<MainsNoteItem>): Promise<MainsNoteItem> {
  const newNote: Partial<MainsNoteItem> = {
    user_id: userId,
    title: payload.title || 'Untitled Note',
    content_markdown: payload.content_markdown || '',
    paper: payload.paper || 'GS1',
    subject: payload.subject || 'GENERAL',
    section_group: payload.section_group || '',
    microtopic: payload.microtopic || '',
    subtopic: payload.subtopic || '',
    nanotopic: payload.nanotopic || '',
    is_favorite: payload.is_favorite || false,
    revision_tags: payload.revision_tags || [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('mains_notes')
      .insert([newNote])
      .select()
      .single();

    if (error || !data) {
      console.warn('Error inserting mains note to Supabase, fallback to local item:', error);
      const fallbackItem: MainsNoteItem = {
        id: 'local_' + Date.now(),
        ...newNote
      } as MainsNoteItem;
      mainsNotesCache[userId] = [fallbackItem, ...(mainsNotesCache[userId] || [])];
      return fallbackItem;
    }

    mainsNotesCache[userId] = [data, ...(mainsNotesCache[userId] || [])];
    return data;
  } catch (err) {
    console.warn('Error in insertMainsNote:', err);
    const fallbackItem: MainsNoteItem = {
      id: 'local_' + Date.now(),
      ...newNote
    } as MainsNoteItem;
    mainsNotesCache[userId] = [fallbackItem, ...(mainsNotesCache[userId] || [])];
    return fallbackItem;
  }
}

export async function updateMainsNote(userId: string, noteId: string, payload: Partial<MainsNoteItem>): Promise<MainsNoteItem> {
  const updatePayload = {
    ...payload,
    updated_at: new Date().toISOString()
  };

  try {
    const { data, error } = await supabase
      .from('mains_notes')
      .update(updatePayload)
      .eq('id', noteId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !data) {
      console.warn('Error updating mains note on Supabase:', error);
      const existing = (mainsNotesCache[userId] || []).find(n => n.id === noteId);
      const updatedFallback: MainsNoteItem = {
        ...(existing || { id: noteId, user_id: userId, title: '', content_markdown: '', paper: '', subject: '' }),
        ...updatePayload
      };
      mainsNotesCache[userId] = (mainsNotesCache[userId] || []).map(n => n.id === noteId ? updatedFallback : n);
      return updatedFallback;
    }

    mainsNotesCache[userId] = (mainsNotesCache[userId] || []).map(n => n.id === noteId ? data : n);
    return data;
  } catch (err) {
    console.warn('Error in updateMainsNote:', err);
    const existing = (mainsNotesCache[userId] || []).find(n => n.id === noteId);
    const updatedFallback: MainsNoteItem = {
      ...(existing || { id: noteId, user_id: userId, title: '', content_markdown: '', paper: '', subject: '' }),
      ...updatePayload
    };
    mainsNotesCache[userId] = (mainsNotesCache[userId] || []).map(n => n.id === noteId ? updatedFallback : n);
    return updatedFallback;
  }
}

export async function deleteMainsNote(userId: string, noteId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('mains_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) {
      console.warn('Error deleting mains note on Supabase:', error);
    }
  } catch (err) {
    console.warn('Error in deleteMainsNote:', err);
  }

  mainsNotesCache[userId] = (mainsNotesCache[userId] || []).filter(n => n.id !== noteId);
  return true;
}
