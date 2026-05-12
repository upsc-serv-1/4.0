import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../shared/PageHeader';
import { DataTable } from '../shared/DataTable';
import { DetailModal } from '../shared/DetailModal';
import { usePagination } from '../../hooks/usePagination';
import type { Card, ColumnDef } from '../../lib/types';
import { Edit3, Save } from 'lucide-react';

export default function FlashcardsPage() {
  const [rows, setRows] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Card | null>(null);
  const pagination = usePagination(50);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, count } = await supabase.from('cards')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);
    setRows((data || []) as Card[]);
    pagination.setTotal(count || 0);
    setLoading(false);
  }, [pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    await supabase.from('cards').update({
      front_text: editing.front_text,
      back_text: editing.back_text,
      subject: editing.subject,
      section_group: editing.section_group,
      microtopic: editing.microtopic,
    }).eq('id', editing.id);
    setEditing(null); load();
  };

  const columns: ColumnDef[] = [
    { key: 'front_text', label: 'Front', width: '30%', render: (v: string) => v?.substring(0, 80) },
    { key: 'back_text', label: 'Back', width: '30%', render: (v: string) => v?.substring(0, 80) },
    { key: 'subject', label: 'Subject', width: '12%' },
    { key: 'card_type', label: 'Type', width: '8%' },
    { key: 'created_at', label: 'Created', width: '12%' },
  ];

  return (
    <div className="p-8">
      <PageHeader title="Flashcards" subtitle={`${pagination.total} cards`} />
      <DataTable
        columns={columns} data={rows} keyField="id" loading={loading}
        pagination={pagination}
        actions={(row) => (
          <button onClick={() => setEditing(row)} className="p-1.5 text-muted hover:text-primary"><Edit3 size={14} /></button>
        )}
      />
      {editing && (
        <DetailModal
          open={!!editing} onClose={() => setEditing(null)}
          title="Edit Card"
          footer={<button onClick={save} className="flex-1 py-3 bg-primary text-black font-black rounded flex items-center justify-center gap-2"><Save size={16} /> SAVE</button>}
        >
          <div className="space-y-4">
            <label className="block">
              <div className="text-[10px] tracking-widest text-muted font-bold mb-1">FRONT TEXT</div>
              <textarea rows={3} className="w-full bg-bg border border-border rounded p-3"
                value={editing.front_text || ''}
                onChange={e => setEditing({ ...editing, front_text: e.target.value })} />
            </label>
            <label className="block">
              <div className="text-[10px] tracking-widest text-muted font-bold mb-1">BACK TEXT</div>
              <textarea rows={3} className="w-full bg-bg border border-border rounded p-3"
                value={editing.back_text || ''}
                onChange={e => setEditing({ ...editing, back_text: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">SUBJECT</div>
                <input className="w-full bg-bg border border-border rounded p-2"
                  value={editing.subject || ''}
                  onChange={e => setEditing({ ...editing, subject: e.target.value })} />
              </label>
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">SECTION</div>
                <input className="w-full bg-bg border border-border rounded p-2"
                  value={editing.section_group || ''}
                  onChange={e => setEditing({ ...editing, section_group: e.target.value })} />
              </label>
            </div>
          </div>
        </DetailModal>
      )}
    </div>
  );
}