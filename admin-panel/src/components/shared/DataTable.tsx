import { useState, useMemo, type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { ColumnDef } from '../../lib/types';

interface DataTableProps<T extends Record<string, any>> {
  columns: ColumnDef[];
  data: T[];
  keyField?: string;
  loading?: boolean;
  emptyMessage?: string;
  selectable?: boolean;
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: () => void;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
    setPage: (p: number) => void;
    setPerPage: (n: number) => void;
    from: number;
    to: number;
  };
  actions?: (row: T) => ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  loading = false,
  emptyMessage = 'No data found',
  selectable = false,
  selected,
  onToggleSelect,
  onSelectAll,
  onRowClick,
  pagination,
  actions,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const allSelected = selected && data.length > 0 && selected.size === data.length;

  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-border/40 text-muted text-[11px] tracking-widest">
            <tr>
              {selectable && (
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={!!allSelected}
                    onChange={onSelectAll}
                    className="accent-primary"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`p-3 text-left ${col.sortable !== false ? 'cursor-pointer select-none hover:text-ink' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                    )}
                    {col.sortable !== false && sortKey !== col.key && (
                      <ChevronsUpDown size={14} className="opacity-30" />
                    )}
                  </div>
                </th>
              ))}
              {actions && <th className="p-3 w-20 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} className="p-12 text-center text-muted">
                  Loading...
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0) + (actions ? 1 : 0)} className="p-12 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const rowId = String(row[keyField] || '');
                return (
                  <tr
                    key={rowId}
                    className={`border-t border-border transition ${
                      onRowClick ? 'cursor-pointer hover:bg-border/20' : 'hover:bg-border/10'
                    } ${selected?.has(rowId) ? 'bg-primary/5' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selected?.has(rowId) || false}
                          onChange={() => onToggleSelect?.(rowId)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-primary"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className="p-3 max-w-md truncate">
                        {col.render ? col.render(row[col.key], row) : formatValue(row[col.key])}
                      </td>
                    ))}
                    {actions && (
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted">
          <div className="flex items-center gap-2">
            <span>Showing {pagination.from}–{pagination.to} of {pagination.total}</span>
            <select
              className="bg-bg border border-border rounded px-2 py-1 text-xs"
              value={pagination.perPage}
              onChange={(e) => pagination.setPerPage(Number(e.target.value))}
            >
              {[25, 50, 100, 200].map((n) => (
                <option key={n} value={n}>{n} / page</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => pagination.setPage(1)}
              disabled={pagination.page === 1}
              className="px-2 py-1 rounded hover:bg-border/20 disabled:opacity-30"
            >
              First
            </button>
            <button
              onClick={() => pagination.setPage(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-2 py-1 rounded hover:bg-border/20 disabled:opacity-30"
            >
              Prev
            </button>
            <span className="font-bold px-2">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => pagination.setPage(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-2 py-1 rounded hover:bg-border/20 disabled:opacity-30"
            >
              Next
            </button>
            <button
              onClick={() => pagination.setPage(pagination.totalPages)}
              disabled={pagination.page === pagination.totalPages}
              className="px-2 py-1 rounded hover:bg-border/20 disabled:opacity-30"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'boolean') return val ? '✓' : '✗';
  if (typeof val === 'object') return JSON.stringify(val).substring(0, 60);
  return String(val);
}