/**
 * usePilotV2Pencil — hook for the page-level Notability-style pencil overlay.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PencilAnnotationEngine } from './PencilAnnotationEngine';
import { getOrCreateEngine, disposeEngine } from './PencilCanvas';
import {
  PilotV2PencilStroke, PilotV2PencilTool,
  PILOT_V2_PEN_WIDTHS, PILOT_V2_HIGHLIGHTER_WIDTHS,
} from './types';

const STORAGE_FAV_KEY = 'pilot-v2:pencil:favorites';
const STORAGE_TOOL_KEY = 'pilot-v2:pencil:last';
const STORAGE_SHAPE_KEY = 'pilot-v2:pencil:shape';

const DEFAULT_FAVS = ['#0F172A', '#EF4444', '#3B82F6'];

interface Args {
  noteId: string | null;
  initialStrokes: PilotV2PencilStroke[];
  pageWidth: number;
  pageHeight: number;
  onChange?: (strokes: PilotV2PencilStroke[]) => void;
}

export function usePilotV2Pencil({
  noteId, initialStrokes, pageWidth, pageHeight, onChange,
}: Args) {
  const [tool, setToolState] = useState<PilotV2PencilTool>('pen');
  const [color, setColor] = useState<string>('#0F172A');
  const [width, setWidth] = useState<number>(PILOT_V2_PEN_WIDTHS[1]);
  const [pencilOnly, setPencilOnly] = useState(true);
  const [shapeRecognition, setShapeRecognition] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(DEFAULT_FAVS);
  const [drawingMode, setDrawingMode] = useState(false);
  const [, forceTick] = useState(0);

  const previousToolRef = useRef<PilotV2PencilTool>('pen');

  const engine = useMemo<PencilAnnotationEngine>(() => {
    return getOrCreateEngine(noteId || '__demo__', initialStrokes, pageWidth, pageHeight, pencilOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    engine.setTool(tool);
    engine.setColor(color);
    engine.setWidth(width);
    engine.setShapeRecognition(shapeRecognition);
    engine.setConfig({ pencilOnly, pageWidth, pageHeight });
  }, [engine, tool, color, width, pencilOnly, shapeRecognition, pageWidth, pageHeight]);

  useEffect(() => {
    // CRITICAL: subscribe ONLY to persisted-stroke changes here. The active
    // stroke fires its OWN listener directly inside <PencilCanvas>, so the
    // host editor (and every block inside it) does NOT re-render on every
    // pen point. This is the single change that brings ink latency from
    // sluggish (forceTick on every move event) down to Soft Notes-grade.
    const unsub = engine.subscribePersisted(() => forceTick(t => t + 1));
    return unsub;
  }, [engine]);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_FAV_KEY).then((raw: string | null) => {
      if (!alive || !raw) return;
      try { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) setFavorites(arr); }
      catch { /* ignore */ }
    });
    AsyncStorage.getItem(STORAGE_TOOL_KEY).then((raw: string | null) => {
      if (!alive || !raw) return;
      try {
        const obj = JSON.parse(raw);
        if (obj?.tool) setToolState(obj.tool);
        if (obj?.color) setColor(obj.color);
        if (obj?.width) setWidth(obj.width);
        if (typeof obj?.pencilOnly === 'boolean') setPencilOnly(obj.pencilOnly);
      } catch { /* ignore */ }
    });
    AsyncStorage.getItem(STORAGE_SHAPE_KEY).then((raw: string | null) => {
      if (!alive || !raw) return;
      setShapeRecognition(raw === '1');
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_FAV_KEY, JSON.stringify(favorites)).catch(() => null);
  }, [favorites]);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_TOOL_KEY, JSON.stringify({ tool, color, width, pencilOnly }))
      .catch(() => null);
  }, [tool, color, width, pencilOnly]);
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_SHAPE_KEY, shapeRecognition ? '1' : '0').catch(() => null);
  }, [shapeRecognition]);

  useEffect(() => {
    if (initialStrokes.length > 0 && engine.getPersisted().length === 0) {
      engine.replaceAll(initialStrokes);
    }
  }, [engine, initialStrokes]);

  useEffect(() => {
    engine.replaceAll(initialStrokes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  useEffect(() => {
    return () => {
      if (noteId) disposeEngine(noteId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]);

  const setTool = useCallback((next: PilotV2PencilTool) => {
    setToolState((prev) => {
      previousToolRef.current = prev;
      if (next === 'highlighter' && (PILOT_V2_PEN_WIDTHS as readonly number[]).includes(width)) {
        setWidth(PILOT_V2_HIGHLIGHTER_WIDTHS[2]);
      } else if (next === 'pen' && (PILOT_V2_HIGHLIGHTER_WIDTHS as readonly number[]).includes(width)) {
        setWidth(PILOT_V2_PEN_WIDTHS[1]);
      }
      return next;
    });
  }, [width]);

  const swapTool = useCallback(() => {
    setTool(previousToolRef.current === tool ? (tool === 'eraser' ? 'pen' : 'eraser') : previousToolRef.current);
  }, [setTool, tool]);

  const undo = useCallback(() => {
    engine.undo();
    onChange?.(engine.getPersisted());
  }, [engine, onChange]);
  const redo = useCallback(() => {
    engine.redo();
    onChange?.(engine.getPersisted());
  }, [engine, onChange]);

  const commit = useCallback((next: PilotV2PencilStroke[]) => {
    onChange?.(next);
  }, [onChange]);

  return {
    engine,
    strokes: engine.getPersisted(),
    tool, setTool, swapTool,
    color, setColor,
    width, setWidth,
    pencilOnly, setPencilOnly,
    shapeRecognition, setShapeRecognition,
    favorites, setFavorites,
    drawingMode, setDrawingMode,
    canUndo: engine.canUndo(),
    canRedo: engine.canRedo(),
    undo, redo,
    commit,
  };
}
