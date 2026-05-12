import type { FilterDef } from '../../lib/types';
import { SUBJECTS, EXAM_CATEGORIES, EXAM_STAGES, EXAM_PAPERS, TEST_LEVELS, PAPER_TYPES } from '../../lib/constants';

const FILTER_OPTIONS: Record<string, { value: string; label: string }[]> = {
  subject: SUBJECTS.map((s) => ({ value: s, label: s })),
  exam_category: EXAM_CATEGORIES.map((e) => ({ value: e.value, label: e.label })),
  exam_stage: EXAM_STAGES.map((e) => ({ value: e.value, label: e.label })),
  exam_paper: EXAM_PAPERS.map((e) => ({ value: e.value, label: e.label })),
  level: TEST_LEVELS.map((l) => ({ value: l.value, label: l.label })),
  paper_type: PAPER_TYPES.map((p) => ({ value: p.value, label: p.label })),
};

interface FilterBarProps {
  filters: FilterDef[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onReset?: () => void;
}

export function FilterBar({ filters, values, onChange, onReset }: FilterBarProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== '' && v !== null && v !== undefined);

  return (
    <div className="flex flex-wrap items-end gap-3 mb-4">
      {filters.map((f) => {
        const options = f.options || FILTER_OPTIONS[f.key] || [];

        switch (f.type) {
          case 'text':
            return (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[10px] tracking-widest text-muted font-bold">{f.label}</label>
                <input
                  className="bg-panel border border-border rounded px-3 py-2 text-sm min-w-[160px]"
                  placeholder={f.placeholder || `Search ${f.label}...`}
                  value={values[f.key] || ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              </div>
            );

          case 'number':
            return (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[10px] tracking-widest text-muted font-bold">{f.label}</label>
                <input
                  className="bg-panel border border-border rounded px-3 py-2 text-sm min-w-[120px]"
                  type="number"
                  placeholder={f.placeholder}
                  value={values[f.key] || ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                />
              </div>
            );

          case 'select':
            return (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[10px] tracking-widest text-muted font-bold">{f.label}</label>
                <select
                  className="bg-panel border border-border rounded px-3 py-2 text-sm min-w-[140px]"
                  value={values[f.key] || ''}
                  onChange={(e) => onChange(f.key, e.target.value)}
                >
                  <option value="">{f.placeholder || 'All'}</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            );

          case 'boolean':
            return (
              <div key={f.key} className="flex flex-col gap-1">
                <label className="text-[10px] tracking-widest text-muted font-bold">{f.label}</label>
                <select
                  className="bg-panel border border-border rounded px-3 py-2 text-sm min-w-[120px]"
                  value={values[f.key] ?? ''}
                  onChange={(e) => onChange(f.key, e.target.value === '' ? null : e.target.value === 'true')}
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
            );

          default:
            return null;
        }
      })}

      {hasActiveFilters && onReset && (
        <button
          onClick={onReset}
          className="px-3 py-2 text-xs font-bold text-muted hover:text-ink border border-border rounded"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}