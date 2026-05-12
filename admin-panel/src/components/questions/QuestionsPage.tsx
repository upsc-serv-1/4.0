import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../shared/PageHeader';
import { DataTable } from '../shared/DataTable';
import { FilterBar } from '../shared/FilterBar';
import { DetailModal } from '../shared/DetailModal';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { Badge } from '../shared/Badge';
import { usePagination } from '../../hooks/usePagination';
import { useBulkSelect } from '../../hooks/useBulkSelect';
import { useDebounce } from '../../hooks/useDebounce';
import { exportToCSV, getTimestamp } from '../../lib/exportUtils';
import { buildQuestionQuery } from '../../lib/queryUtils';
import { QUESTION_FILTERS } from '../../lib/queryUtils';
import type { QuestionFull, ColumnDef } from '../../lib/types';
import { Plus, Edit3, Trash2, Save, X, Download } from 'lucide-react';

const emptyForm: Partial<QuestionFull> = {
  question_text: '', options: { a: '', b: '', c: '', d: '' },
  correct_answer: null, explanation_markdown: '', subject: '',
  section_group: '', micro_topic: '', is_pyq: false,
  is_upsc_cse: false, is_allied: false, is_others: false, is_cancelled: false,
  exam_year: null, exam_category: '', exam_stage: '', exam_paper: '',
};

export default function QuestionsPage() {
  const [rows, setRows] = useState<QuestionFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<QuestionFull> | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const debouncedFilters = useDebounce(filters, 400);
  const pagination = usePagination(50);
  const bulk = useBulkSelect<string>();

  const load = useCallback(async () => {
    setLoading(true);
    const query = buildQuestionQuery(debouncedFilters)
      .order('id', { ascending: false })
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);

    const { data, count } = await query;
    setRows((data || []) as QuestionFull[]);
    pagination.setTotal(count || 0);
    setLoading(false);
  }, [debouncedFilters, pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing) return;
    const payload: any = { ...editing };
    if (editing.id) {
      await supabase.from('questions').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('questions').insert(payload);
    }
    setEditing(null);
    load();
  };

  const remove = async () => {
    if (!deleteId) return;
    await supabase.from('questions').delete().eq('id', deleteId);
    setDeleteId(null);
    load();
  };

  const columns: ColumnDef[] = [
    { key: 'question_text', label: 'Question', width: '40%', render: (v: string) => <span className="line-clamp-2">{v?.substring(0, 120)}</span> },
    { key: 'subject', label: 'Subject', width: '12%' },
    { key: 'section_group', label: 'Section', width: '12%' },
    { key: 'micro_topic', label: 'Micro Topic', width: '12%' },
    { key: 'exam_year', label: 'Year', width: '6%' },
    { key: 'is_pyq', label: 'PYQ', width: '5%', render: (v: boolean) => v ? <Badge variant="success">PYQ</Badge> : null },
    { key: 'is_cancelled', label: 'X', width: '4%', render: (v: boolean) => v ? <Badge variant="danger">X</Badge> : null },
  ];

  return (
    <div className="p-8">
      <PageHeader title="Questions" subtitle={`${pagination.total} total`}>
        <button onClick={() => setEditing(emptyForm)} className="flex items-center gap-2 bg-primary text-black font-bold px-4 py-2 rounded">
          <Plus size={16} /> New
        </button>
        {bulk.count > 0 && (
          <button onClick={() => {
            const selectedData = rows.filter(r => bulk.selected.has(r.id));
            exportToCSV(selectedData, `questions-${getTimestamp()}.csv`);
          }} className="flex items-center gap-2 px-4 py-2 border border-border rounded font-bold">
            <Download size={16} /> Export {bulk.count}
          </button>
        )}
      </PageHeader>

      <FilterBar
        filters={QUESTION_FILTERS}
        values={filters}
        onChange={(key, value) => { setFilters(prev => ({ ...prev, [key]: value })); pagination.setPage(1); }}
        onReset={() => { setFilters({}); pagination.setPage(1); }}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyField="id"
        loading={loading}
        selectable
        selected={bulk.selected}
        onToggleSelect={bulk.toggle}
        onSelectAll={() => bulk.selectAll(rows.map(r => r.id))}
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
          open={!!editing}
          onClose={() => setEditing(null)}
          title={editing.id ? 'Edit Question' : 'New Question'}
          width="max-w-3xl"
          footer={
            <>
              <button onClick={() => setEditing(null)} className="flex-1 py-3 border border-border rounded font-bold">Cancel</button>
              <button onClick={save} className="flex-1 py-3 bg-primary text-black font-black rounded flex items-center justify-center gap-2"><Save size={16} /> SAVE</button>
            </>
          }
        >
          <div className="space-y-4">
            <label className="block">
              <div className="text-[10px] tracking-widest text-muted font-bold mb-1">QUESTION TEXT</div>
              <textarea rows={4} className="w-full bg-bg border border-border rounded p-3"
                value={editing.question_text || ''}
                onChange={e => setEditing({ ...editing, question_text: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['a', 'b', 'c', 'd'] as const).map(k => (
                <label key={k} className="block">
                  <div className="text-[10px] tracking-widest text-muted font-bold mb-1">OPTION {k.toUpperCase()}</div>
                  <input className="w-full bg-bg border border-border rounded p-2"
                    value={(editing.options as any)?.[k] || ''}
                    onChange={e => setEditing({ ...editing, options: { ...(editing.options as any), [k]: e.target.value } })} />
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">CORRECT ANSWER</div>
                <select className="w-full bg-bg border border-border rounded p-2"
                  value={editing.correct_answer || ''}
                  onChange={e => setEditing({ ...editing, correct_answer: e.target.value || null })}>
                  <option value="">— None —</option>
                  {['a', 'b', 'c', 'd'].map(k => <option key={k} value={k}>{k.toUpperCase()}</option>)}
                </select>
              </label>
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">SUBJECT</div>
                <input className="w-full bg-bg border border-border rounded p-2"
                  value={editing.subject || ''}
                  onChange={e => setEditing({ ...editing, subject: e.target.value })} />
              </label>
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">SECTION GROUP</div>
                <input className="w-full bg-bg border border-border rounded p-2"
                  value={editing.section_group || ''}
                  onChange={e => setEditing({ ...editing, section_group: e.target.value })} />
              </label>
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">MICRO TOPIC</div>
                <input className="w-full bg-bg border border-border rounded p-2"
                  value={editing.micro_topic || ''}
                  onChange={e => setEditing({ ...editing, micro_topic: e.target.value })} />
              </label>
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">EXAM YEAR</div>
                <input className="w-full bg-bg border border-border rounded p-2" type="number"
                  value={editing.exam_year || ''}
                  onChange={e => setEditing({ ...editing, exam_year: e.target.value ? parseInt(e.target.value) : null })} />
              </label>
              <label className="block">
                <div className="text-[10px] tracking-widest text-muted font-bold mb-1">EXAM CATEGORY</div>
                <input className="w-full bg-bg border border-border rounded p-2"
                  value={editing.exam_category || ''}
                  onChange={e => setEditing({ ...editing, exam_category: e.target.value })} />
              </label>
            </div>
            <label className="block">
              <div className="text-[10px] tracking-widest text-muted font-bold mb-1">EXPLANATION (markdown)</div>
              <textarea rows={5} className="w-full bg-bg border border-border rounded p-3 font-mono text-sm"
                value={editing.explanation_markdown || ''}
                onChange={e => setEditing({ ...editing, explanation_markdown: e.target.value })} />
            </label>
            <div className="flex gap-4 flex-wrap">
              {[
                ['is_pyq', 'PYQ'], ['is_upsc_cse', 'UPSC CSE'],
                ['is_allied', 'Allied'], ['is_others', 'Others'],
                ['is_ncert', 'NCERT'], ['is_cancelled', 'Cancelled'],
              ].map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={(editing as any)[key] || false}
                    onChange={e => setEditing({ ...editing, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </DetailModal>
      )}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete Question"
        message="Are you sure you want to delete this question? This cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}