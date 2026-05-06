/**
 * useHardnoteDoc — persistence hook for the unified Hardnotes editor.
 *
 * Owns the note's `items` array (all points, headings, checklists) and debounces
 * writes to user_notes. Exposes granular patchers so each bullet card can update
 * its text, toggle checked, or push Skia strokes without re-hydrating everything.
 *
 * The canonical item is `Point`. Legacy shapes (`highlight`, `microTopicHeading`,
 * `base_layer`) are normalized on load and re-saved in canonical form.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Stroke } from './strokes';

export type PointType = 'point' | 'heading' | 'checklist';

export interface Point {
  id: string;
  type: PointType;
  text: string;                // HTML-safe rich text
  color?: string;              // left-accent color for cards
  source?: string;             // "Q5 · PYQ 2021"
  locked?: boolean;            // locked originals (ex-base_layer) — user can toggle
  checked?: boolean;           // for checklist
  strokes?: Stroke[];          // per-bullet ink annotations
  tags?: string[];             // review-tag catalog
  createdAt?: string;
}

export interface HardnoteDoc {
  loading: boolean;
  saving: boolean;
  title: string;
  subject: string | null;
  points: Point[];
  canUndoStroke: boolean;
  setTitle: (t: string) => void;
  updatePoint: (id: string, patch: Partial<Point>) => void;
  addStroke: (pointId: string, stroke: Stroke) => void;
  removeStrokes: (pointId: string, strokeIds: string[]) => void;
  clearStrokes: (pointId: string) => void;
  undoStroke: () => void;
  insertPoint: (afterId: string | null, draft?: Partial<Point>) => string;
  removePoint: (id: string) => void;
  reorderPoints: (ids: string[]) => void;
  toggleLock: (id: string) => void;
  refresh: () => Promise<void>;
  flushSave: () => Promise<void>;
}

const normalize = (raw: any[]): Point[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((it, idx): Point => {
    if (!it || typeof it !== 'object') return mkPoint({ text: String(it || '') });
    // Legacy shapes → canonical point
    if (it.type === 'microTopicHeading') {
      return { id: String(it.id || `hd_${idx}`), type: 'heading', text: String(it.text || ''), createdAt: it.addedAt };
    }
    if (it.type === 'base_layer') {
      return {
        id: String(it.id || `bl_${idx}`),
        type: 'point',
        text: String(it.markdown || it.text || ''),
        color: it.color || undefined,
        locked: true,
        source: it.source || 'quiz_explanation',
        strokes: Array.isArray(it.strokes) ? it.strokes : [],
        createdAt: it.created_at,
      };
    }
    if (it.type === 'highlight' || it.type === 'point' || it.type === 'checklist') {
      return {
        id: String(it.id || `pt_${idx}`),
        type: it.type === 'checklist' ? 'checklist' : 'point',
        text: String(it.text || ''),
        color: it.color,
        source: it.source,
        locked: Boolean(it.locked),
        checked: Boolean(it.checked),
        strokes: Array.isArray(it.strokes) ? it.strokes : [],
        tags: Array.isArray(it.tags) ? it.tags : undefined,
        createdAt: it.addedAt || it.createdAt,
      };
    }
    // Stroke items from old pro-editor – skip or fold in as orphan strokes
    if (it.type === 'stroke') return null as any;
    return mkPoint({ text: String(it.text || '') });
  }).filter(Boolean);
};

const mkPoint = (partial: Partial<Point>): Point => ({
  id: `pt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  type: 'point',
  text: '',
  createdAt: new Date().toISOString(),
  ...partial,
});

type StrokeHistoryEntry = {
  pointId: string;
  strokeId: string;
};

export function useHardnoteDoc(noteId: string | undefined): HardnoteDoc {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitleState] = useState('');
  const [subject, setSubject] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [strokeHistory, setStrokeHistory] = useState<StrokeHistoryEntry[]>([]);
  const saveTimer = useRef<any>(null);
  const inFlight = useRef<Promise<void> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!noteId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_notes')
      .select('id, title, subject, items, content, content_html')
      .eq('id', noteId)
      .maybeSingle();
    if (!mounted.current) return;
    if (error || !data) {
      setLoading(false);
      return;
    }
    setTitleState(data.title || '');
    setSubject(data.subject || null);
    let pts = normalize(data.items || []);
    // If a user arrived from a fresh migration where only content exists,
    // surface it as a locked point so nothing is orphaned.
    if (pts.length === 0 && (data.content_html || data.content)) {
      pts = [
        {
          id: `pt_legacy_${Date.now()}`,
          type: 'point',
          text: String(data.content_html || data.content || ''),
          color: '#6366f1',
          locked: true,
          createdAt: new Date().toISOString(),
        },
      ];
    }
    setPoints(pts);
    setStrokeHistory([]);
    setLoading(false);
  }, [noteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const scheduleSave = useCallback((nextPoints: Point[], nextTitle?: string) => {
    if (!noteId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      const payload: any = {
        items: nextPoints,
        updated_at: new Date().toISOString(),
      };
      if (nextTitle !== undefined) payload.title = nextTitle;
      const p = supabase.from('user_notes').update(payload).eq('id', noteId).then(({ error }) => {
        if (error) console.warn('[useHardnoteDoc] save failed', error);
      });
      inFlight.current = p as any;
      await p;
      if (mounted.current) setSaving(false);
    }, 3000);
  }, [noteId]);

  const flushSave = useCallback(async () => {
    if (!noteId) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaving(true);
    const { error } = await supabase
      .from('user_notes')
      .update({
        items: points,
        title,
        updated_at: new Date().toISOString(),
      })
      .eq('id', noteId);
    if (error) console.warn('[useHardnoteDoc] flush save failed', error);
    if (mounted.current) setSaving(false);
  }, [noteId, points, title]);

  const updatePoint = useCallback((id: string, patch: Partial<Point>) => {
    setPoints((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, ...patch } : p));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const addStroke = useCallback((pointId: string, stroke: Stroke) => {
    setPoints((prev) => {
      const next = prev.map((p) => {
        if (p.id !== pointId) return p;
        const strokes = Array.isArray(p.strokes) ? [...p.strokes, stroke] : [stroke];
        return { ...p, strokes };
      });
      scheduleSave(next);
      return next;
    });
    setStrokeHistory((prev) => [...prev, { pointId, strokeId: stroke.id }]);
  }, [scheduleSave]);

  const removeStrokes = useCallback((pointId: string, strokeIds: string[]) => {
    const idSet = new Set(strokeIds);
    setPoints((prev) => {
      const next = prev.map((p) => {
        if (p.id !== pointId) return p;
        const strokes = (p.strokes || []).filter((s) => !idSet.has(s.id));
        return { ...p, strokes };
      });
      scheduleSave(next);
      return next;
    });
    setStrokeHistory((prev) => prev.filter((h) => !(h.pointId === pointId && idSet.has(h.strokeId))));
  }, [scheduleSave]);

  const clearStrokes = useCallback((pointId: string) => {
    setPoints((prev) => {
      const next = prev.map((p) => (p.id === pointId ? { ...p, strokes: [] } : p));
      scheduleSave(next);
      return next;
    });
    setStrokeHistory((prev) => prev.filter((h) => h.pointId !== pointId));
  }, [scheduleSave]);

  const undoStroke = useCallback(() => {
    setStrokeHistory((prevHistory) => {
      if (prevHistory.length === 0) return prevHistory;
      const history = [...prevHistory];

      while (history.length > 0) {
        const last = history.pop()!;
        let removed = false;

        setPoints((prevPoints) => {
          const next = prevPoints.map((p) => {
            if (p.id !== last.pointId) return p;
            const existing = p.strokes || [];
            if (!existing.some((s) => s.id === last.strokeId)) return p;
            removed = true;
            return { ...p, strokes: existing.filter((s) => s.id !== last.strokeId) };
          });

          if (removed) scheduleSave(next);
          return next;
        });

        if (removed) return history;
      }

      return [];
    });
  }, [scheduleSave]);

  const insertPoint = useCallback((afterId: string | null, draft?: Partial<Point>) => {
    const newPt = mkPoint(draft || {});
    setPoints((prev) => {
      let next: Point[];
      if (afterId === null) {
        next = [...prev, newPt];
      } else {
        const idx = prev.findIndex((p) => p.id === afterId);
        next = idx < 0 ? [...prev, newPt] : [...prev.slice(0, idx + 1), newPt, ...prev.slice(idx + 1)];
      }
      scheduleSave(next);
      return next;
    });
    return newPt.id;
  }, [scheduleSave]);

  const removePoint = useCallback((id: string) => {
    setPoints((prev) => {
      const next = prev.filter((p) => p.id !== id);
      scheduleSave(next);
      return next;
    });
    setStrokeHistory((prev) => prev.filter((h) => h.pointId !== id));
  }, [scheduleSave]);

  const reorderPoints = useCallback((ids: string[]) => {
    setPoints((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      const next = ids.map((id) => byId.get(id)).filter(Boolean) as Point[];
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const toggleLock = useCallback((id: string) => {
    setPoints((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, locked: !p.locked } : p));
      scheduleSave(next);
      return next;
    });
  }, [scheduleSave]);

  const setTitle = useCallback((t: string) => {
    setTitleState(t);
    scheduleSave(points, t);
  }, [points, scheduleSave]);

  return {
    loading,
    saving,
    title,
    subject,
    points,
    canUndoStroke: strokeHistory.length > 0,
    setTitle,
    updatePoint,
    addStroke,
    removeStrokes,
    clearStrokes,
    undoStroke,
    insertPoint,
    removePoint,
    reorderPoints,
    toggleLock,
    refresh,
    flushSave,
  };
}
