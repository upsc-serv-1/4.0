// ==========================================================================
// useBulkSelect — generic multi-select checkbox state for tables
// ==========================================================================

import { useState, useCallback } from 'react';

export function useBulkSelect<T = string>() {
  const [selected, setSelected] = useState<Set<T>>(new Set());

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: T[]) => {
    setSelected(new Set(ids));
  }, []);

  const clear = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isSelected = useCallback((id: T) => selected.has(id), [selected]);

  const count = selected.size;

  return { selected, toggle, selectAll, clear, isSelected, count };
}