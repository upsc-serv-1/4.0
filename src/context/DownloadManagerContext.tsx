/**
 * DownloadManagerContext — Global, intentional download manager.
 *
 * Persists history under `pyq_dl_history` in your existing KVStore.
 * Use anywhere with `useDownloadManager()`.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { KVStore } from '../lib/kvStore';

export type DLStatus = 'preparing' | 'downloading' | 'completed' | 'failed';

export interface DLItem {
  id: string;
  label: string;
  status: DLStatus;
  progress: number;       // 0..1
  uri?: string;           // file:// path or share URI
  mime?: string;
  ts: number;
  error?: string;
}

interface Ctx {
  items: DLItem[];
  visible: boolean;        // drawer open
  minimized: boolean;      // minimized into FAB
  start: (label: string) => string;             // returns id
  update: (id: string, patch: Partial<DLItem>) => void;
  complete: (id: string, uri: string, mime?: string) => void;
  fail: (id: string, error: string) => void;
  remove: (id: string) => void;
  clearAll: () => void;
  open: () => void;
  close: () => void;
  minimize: () => void;
  restore: () => void;
}

const KEY = 'pyq_dl_history';
const Context = createContext<Ctx | null>(null);

export const DownloadManagerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<DLItem[]>([]);
  const [visible, setVisible] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // hydrate
  useEffect(() => {
    try {
      const cached = KVStore.getJson(KEY) as DLItem[] | null;
      if (Array.isArray(cached)) setItems(cached);
    } catch {}
  }, []);

  // persist
  useEffect(() => {
    try { KVStore.setJson(KEY, items); } catch {}
  }, [items]);

  const start = useCallback((label: string) => {
    const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setItems((prev) => [{ id, label, status: 'preparing', progress: 0, ts: Date.now() }, ...prev].slice(0, 50));
    setVisible(true);
    setMinimized(false);
    return id;
  }, []);

  const update = useCallback((id: string, patch: Partial<DLItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const complete = useCallback((id: string, uri: string, mime = 'application/pdf') => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'completed', progress: 1, uri, mime } : it)));
  }, []);

  const fail = useCallback((id: string, error: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'failed', error } : it)));
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const value: Ctx = useMemo(() => ({
    items, visible, minimized,
    start, update, complete, fail, remove, clearAll,
    open: () => { setVisible(true); setMinimized(false); },
    close: () => setVisible(false),
    minimize: () => setMinimized(true),
    restore: () => setMinimized(false),
  }), [items, visible, minimized, start, update, complete, fail, remove, clearAll]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
};

export function useDownloadManager(): Ctx {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('useDownloadManager must be used inside DownloadManagerProvider');
  return ctx;
}
