import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../shared/PageHeader';
import { DataTable } from '../shared/DataTable';
import { FilterBar } from '../shared/FilterBar';
import { DetailModal } from '../shared/DetailModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { JsonUploadWidget } from './JsonUploadWidget';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { buildTestQuery, TEST_FILTERS } from '../../lib/queryUtils';
import type { TestFull, ColumnDef } from '../../lib/types';
import { Plus, Edit3, Trash2, Save } from 'lucide-react';

const emptyForm: Partial<TestFull> = {
  title: '', provider: '', institute: '', program_name: '',
  level: '', paper_type: '', series: '', subject: '',
  default_minutes: 60, question_count: 0,
};

export default function TestsPage() {
  const [rows, setRows] = useState<TestFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<TestFull> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const debouncedFilters = useDebounce(filters, 400);
  const pagination = usePagination(50);

  const load = useCallback(async () => {
    setLoading(true);
    const query = buildTestQuery(debouncedFilters)
      .order('id', { ascending: false })
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);
    const { data, count } = await query;
    setRows((data || []) as TestFull[]);
    pagination.setTotal(count || 0);
    setLoading(false);
  }, [debouncedFilters, pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    if (editing.id) {
      await supabase.from('tests').update(editing).eq('id', editing.id);
    } else {
      await supabase.from('tests').insert(editing);
    }
    setEditing(null); load();
  };

  const remove = async () => {
    if (!deleteId) return;
    await supabase.from('tests').delete().eq('id', deleteId);
    setDeleteId(null); load();
  };

  const columns: ColumnDef[] = [
    { key: 'title', label: 'Title', width: '30%' },
    { key: 'subject', label: 'Subject', width: '12%' },
    { key: 'level', label: 'Level', width: '12%' },
    { key: 'paper_type', label: 'Paper Type', width: '12%' },
    { key: 'provider', label: 'Provider', width: '12%' },
    { key: 'question_count', label: 'Qs', width: '6%' },
  ];

  return (
    <div className="p-8">
      <PageHeader title="Tests" subtitle={`${pagination.total} total`}>
        <button onClick={() => setEditing(emptyForm)} className="flex items-center gap-2 bg-primary text-black font-bold px-4 py-2 rounded">
          <Plus size={16} /> New
        </button>
      </PageHeader>

      <FilterBar
        filters={TEST_FILTERS}
        values={filters}
        onChange={(k, v) => { setFilters(p => ({ ...p, [k]: v })); pagination.setPage(1); }}
        onReset={() => { setFilters({}); pagination.setPage(1); }}
      />

      <div className="mb-8 bg-panel border border-border rounded-xl p-6">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <div className="w-2 h-5 bg-primary rounded"></div>
          Import JSON Question Papers
        </h2>
        <JsonUploadWidget onUploadComplete={load} />
      </div>

      <DataTable
        columns={columns} data={rows} keyField="id" loading={loading}
        pagination={pagination}
        actions={(row) => (
          <div className="flex gap-1 justify-end">
            <button onClick={() => setEditing(row)} className="p-1.5 text-muted hover:text-primary"><Edit3 size={14} /></button>
            <button onClick={() => setDeleteId(row.id)} className="p-1.5 text-muted hover:text-danger"><Trash2 size={14} /></button>
          </div>
        )}
      />

      {editing && (
        <DetailModal
          open={!!editing} onClose={() => setEditing(null)}
          title={editing.id ? 'Edit Test' : 'New Test'}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-border rounded font-bold">Cancel</button>
              <button onClick={save} className="flex-1 py-3 bg-primary text-black font-black rounded flex items-center justify-center gap-2"><Save size={16} /> SAVE</button>
            </>
          }
        >
          <div className="grid grid-cols-2 gap-4">
            {['title', 'provider', 'institute', 'program_name', 'level', 'paper_type', 'series', 'subject'].map(f => (
              <label key={f} className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">{f.toUpperCase()}</div>
                <input className="w-full bg-bg border border-border rounded p-2"
                  value={(editing as any)[f] || ''}
                  onChange={e => setEditing({ ...editing, [f]: e.target.value })} />
              </label>
            ))}
            <label className="block">
              <div className="text-[10px] tracking-widest text-muted font-bold mb-1">DEFAULT MINUTES</div>
              <input className="w-full bg-bg border border-border rounded p-2" type="number"
                value={editing.default_minutes || 60}
                onChange={e => setEditing({ ...editing, default_minutes: parseInt(e.target.value) || 60 })} />
            </label>
          </div>
        </DetailModal>
      )}

      <ConfirmDialog
        open={!!deleteId} title="Delete Test" message="Delete this test and all its questions?"
        variant="danger" confirmLabel="Delete"
        onConfirm={remove} onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}