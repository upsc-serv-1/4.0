import { supabase } from '../lib/supabase';
import { PilotNote } from '../context/PilotContext';

export async function fetchPilotNotes(userId: string): Promise<PilotNote[]> {
  const { data, error } = await supabase
    .from('user_notes')
    .select('*')
    .eq('user_id', userId)
    .eq('deleted', false)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => {
    let blocks = [];
    if (row.items && Array.isArray(row.items) && row.items.length > 0) {
      blocks = row.items.map((b: any, idx: number) => {
        if (typeof b === 'string') {
          return { id: `b_${idx}_${Date.now()}`, type: 'paragraph', text: b };
        }
        return {
          id: b.id || `b_${idx}_${Date.now()}`,
          type: b.type || 'paragraph',
          text: b.text || '',
          checked: b.checked ?? false,
          highlightColor: b.color || b.highlightColor
        };
      });
    } else if (row.content) {
      try {
        const parsed = JSON.parse(row.content);
        blocks = parsed.blocks || parsed || [];
      } catch {
        blocks = [{ id: '1', type: 'paragraph', text: row.content }];
      }
    }

    if (blocks.length === 0) {
      blocks = [{ id: '1', type: 'paragraph', text: '' }];
    }

    return {
      id: row.id,
      title: row.title || 'Untitled Note',
      subject: row.subject || 'General',
      topic: row.topic || 'General',
      subtopic: row.subtopic || 'General',
      content: { blocks },
      created_at: row.created_at,
      updated_at: row.updated_at || new Date().toISOString()
    };
  });
}

export async function savePilotNote(
  userId: string,
  note: Partial<PilotNote>
): Promise<PilotNote> {
  const noteId = note.id;
  const dbPayload = {
    title: note.title,
    subject: note.subject || 'General',
    items: note.content?.blocks || [],
    content: JSON.stringify(note.content),
    updated_at: new Date().toISOString()
  };

  if (noteId) {
    const { data, error } = await supabase
      .from('user_notes')
      .update(dbPayload)
      .eq('id', noteId)
      .select()
      .single();

    if (error) throw error;
    return mapDbRowToPilotNote(data);
  } else {
    const { data, error } = await supabase
      .from('user_notes')
      .insert([
        {
          ...dbPayload,
          user_id: userId,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return mapDbRowToPilotNote(data);
  }
}

export async function deletePilotNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notes')
    .update({ deleted: true, updated_at: new Date().toISOString() })
    .eq('id', noteId);

  if (error) throw error;
}

function mapDbRowToPilotNote(row: any): PilotNote {
  let blocks = [];
  if (row.items && Array.isArray(row.items)) {
    blocks = row.items.map((b: any, idx: number) => ({
      id: b.id || `b_${idx}_${Date.now()}`,
      type: b.type || 'paragraph',
      text: b.text || '',
      checked: b.checked ?? false,
      highlightColor: b.color || b.highlightColor
    }));
  } else if (row.content) {
    try {
      const parsed = JSON.parse(row.content);
      blocks = parsed.blocks || parsed || [];
    } catch {
      blocks = [{ id: '1', type: 'paragraph', text: row.content }];
    }
  }

  if (blocks.length === 0) {
    blocks = [{ id: '1', type: 'paragraph', text: '' }];
  }

  return {
    id: row.id,
    title: row.title || 'Untitled Note',
    subject: row.subject || 'General',
    topic: row.topic || 'General',
    subtopic: row.subtopic || 'General',
    content: { blocks },
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
