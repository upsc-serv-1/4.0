// ==========================================================================
// usePagination — pagination state management
// ==========================================================================

import { useState, useMemo } from 'react';

interface PaginationState {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  setPage: (p: number) => void;
  setPerPage: (n: number) => void;
  setTotal: (n: number) => void;
  next: () => void;
  prev: () => void;
  from: number;
  to: number;
}

export function usePagination(initialPerPage: number = 50): PaginationState {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [total, setTotal] = useState(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / perPage)), [total, perPage]);
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const next = () => setPage((p) => Math.min(p + 1, totalPages));
  const prev = () => setPage((p) => Math.max(p - 1, 1));

  return { page, perPage, total, totalPages, setPage, setPerPage, setTotal, next, prev, from, to };
}