/**
 * useSoftPage — React hook for managing one Soft Notes page.
 *
 * Owns:
 *   - strokes: SoftStroke[]              (loaded + locally appended)
 *   - addStroke(s)                       (immediately persists to Supabase)
 *   - removeStrokes(ids)                 (immediately persists)
 *   - undoStroke / redoStroke
 *
 * History is in-memory only; that's fine for a single editing session.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { SoftStroke } from './types';
import { SoftStrokeService } from './service';

export function useSoftPage(pageId: string | null) {
  const [strokes, setStrokes] = useState<SoftStroke[]>([]);
  const [loading, setLoading] = useState(true);
  const undoStack = useRef<{ kind: 'add' | 'remove'; strokes: SoftStroke[] }[]>([]);
  const redoStack = useRef<{ kind: 'add' | 'remove'; strokes: SoftStroke[] }[]>([]);

  const load = useCallback(async () => {
    if (!pageId) { setStrokes([]); setLoading(false); return; }
    setLoading(true);
    const list = await SoftStrokeService.list(pageId);
    setStrokes(list);
    undoStack.current = [];
    redoStack.current = [];
    setLoading(false);
  }, [pageId]);

  useEffect(() => { load(); }, [load]);

  const addStroke = useCallback(async (stroke: SoftStroke) => {
    setStrokes((prev) => [...prev, stroke]);
    undoStack.current.push({ kind: 'add', strokes: [stroke] });
    redoStack.current = [];
    await SoftStrokeService.insert(stroke);
  }, []);

  const removeStrokes = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    let removed: SoftStroke[] = [];
    setStrokes((prev) => {
      removed = prev.filter((s) => ids.includes(s.id));
      return prev.filter((s) => !ids.includes(s.id));
    });
    if (removed.length) {
      undoStack.current.push({ kind: 'remove', strokes: removed });
      redoStack.current = [];
    }
    await SoftStrokeService.remove(ids);
  }, []);

  const undo = useCallback(async () => {
    const op = undoStack.current.pop();
    if (!op) return;
    if (op.kind === 'add') {
      // Undo add → remove
      const ids = op.strokes.map((s) => s.id);
      setStrokes((prev) => prev.filter((s) => !ids.includes(s.id)));
      await SoftStrokeService.remove(ids);
    } else {
      // Undo remove → re-insert
      setStrokes((prev) => [...prev, ...op.strokes]);
      await SoftStrokeService.insertMany(op.strokes);
    }
    redoStack.current.push(op);
  }, []);

  const redo = useCallback(async () => {
    const op = redoStack.current.pop();
    if (!op) return;
    if (op.kind === 'add') {
      setStrokes((prev) => [...prev, ...op.strokes]);
      await SoftStrokeService.insertMany(op.strokes);
    } else {
      const ids = op.strokes.map((s) => s.id);
      setStrokes((prev) => prev.filter((s) => !ids.includes(s.id)));
      await SoftStrokeService.remove(ids);
    }
    undoStack.current.push(op);
  }, []);

  return {
    strokes, loading, refresh: load,
    addStroke, removeStrokes,
    undo, redo,
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
  };
}
