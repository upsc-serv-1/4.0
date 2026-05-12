import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { PageHeader } from '../shared/PageHeader';
import { DataTable } from '../shared/DataTable';
import { usePagination } from '../../hooks/usePagination';
import type { AppUser, ColumnDef } from '../../lib/types';
import { Search } from 'lucide-react';

export default function UsersPage() {
  const [rows, setRows] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const pagination = usePagination(50);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('users').select('*', { count: 'exact' });
    if (search) query = query.ilike('email', `%${search}%`);
    const { data, count } = await query
      .order('created_at', { ascending: false })
      .range((pagination.page - 1) * pagination.perPage, pagination.page * pagination.perPage - 1);
    setRows((data || []) as AppUser[]);
    pagination.setTotal(count || 0);
    setLoading(false);
  }, [search, pagination.page, pagination.perPage]);

  useEffect(() => { load(); }, [load]);

  const columns: ColumnDef[] = [
    { key: 'id', label: 'User ID', width: '30%', render: (v: string) => <span className="font-mono text-xs">{v?.substring(0, 12)}...</span> },
    { key: 'email', label: 'Email', width: '40%' },
    { key: 'created_at', label: 'Joined', width: '15%' },
  ];

  return (
    <div className="p-8">
      <PageHeader title="Users" subtitle={`${pagination.total} registered users`}>
        <div className="flex items-center gap-2 bg-panel border border-border rounded px-3 py-2">
          <Search size={16} className="text-muted" />
          <input className="bg-transparent text-sm outline-none" placeholder="Search by email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </PageHeader>
      <DataTable
        columns={columns} data={rows} keyField="id" loading={loading}
        pagination={pagination}
      />
    </div>
  );
}