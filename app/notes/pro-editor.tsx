/**
 * Pro-Note Editor — Apple Pencil-optimized Skia canvas.
 *
 * Route params:
 *   - noteId  : user_notes.id to open (required for saves)
 *   - nodeId  : optional user_note_nodes.id (for breadcrumb title)
 *   - title   : optional initial title override
 *   - baseLayer : optional JSON-encoded { markdown, source } — when coming from
 *                 the quiz engine we preload this as a locked base layer.
 *
 * Persistence:
 *   Vector strokes and any base-layer metadata are stored in user_notes.items
 *   as a heterogenous JSONB array:
 *     { type: 'stroke',     ...Stroke }
 *     { type: 'base_layer', markdown, source, locked }
 *     { type: 'text'|'checklist', ... } (future)
 *
 * Auto-save uses a 800ms debounce on item array changes.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Check, Cloud, CloudOff, Loader2 } from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { HardnotesService } from '../../src/services/HardnotesService';
import { SkiaCanvas } from '../../src/components/hardnotes/SkiaCanvas';
import { ToolPalette } from '../../src/components/hardnotes/ToolPalette';
import { Stroke, ToolKind } from '../../src/components/hardnotes/strokes';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function ProEditor() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const { width: winW, height: winH } = useWindowDimensions();
  const params = useLocalSearchParams<{
    noteId?: string;
    nodeId?: string;
    title?: string;
    baseLayer?: string;
  }>();

  const [title, setTitle] = useState<string>((params.title as string) || 'Untitled Note');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [baseLayerText, setBaseLayerText] = useState<string | null>(null);
  const [tool, setTool] = useState<ToolKind>('pen');
  const [color, setColor] = useState<string>('#0f172a');
  const [brushWidth, setBrushWidth] = useState<number>(3);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Undo/redo stacks — store snapshots of the strokes array.
  const undoStackRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const [historyVer, setHistoryVer] = useState(0); // forces re-render to toggle canUndo/canRedo

  const saveTimerRef = useRef<any>(null);
  const isInitialLoadRef = useRef(true);

  // Load note content on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!params.noteId) {
          // Open with an inline base layer only — still need to create the note first.
          setLoading(false);
          return;
        }
        const note = await HardnotesService.getNote(params.noteId as string);
        if (note) {
          setTitle(note.title || 'Untitled Note');
          const items = Array.isArray(note.items) ? note.items : [];
          const loadedStrokes: Stroke[] = items
            .filter((it: any) => it && it.type === 'stroke')
            .map((it: any) => ({
              id: it.id,
              tool: it.tool,
              color: it.color,
              width: it.width,
              opacity: it.opacity,
              points: it.points || [],
              created_at: it.created_at,
            }));
          setStrokes(loadedStrokes);

          const base = items.find((it: any) => it && it.type === 'base_layer');
          if (base?.markdown) setBaseLayerText(base.markdown as string);
        }

        // If this load was triggered with a baseLayer param (quiz explanation), merge it.
        if (params.baseLayer) {
          try {
            const parsed = JSON.parse(String(params.baseLayer));
            if (parsed?.markdown) {
              setBaseLayerText(parsed.markdown);
              // Persist into the note items if not already present.
              const existing = await HardnotesService.getNote(String(params.noteId));
              const currentItems = Array.isArray(existing?.items) ? existing!.items : [];
              const hasBase = currentItems.some((it: any) => it?.type === 'base_layer');
              if (!hasBase) {
                const nextItems = [
                  ...currentItems,
                  {
                    id: `base_${Date.now()}`,
                    type: 'base_layer',
                    markdown: parsed.markdown,
                    source: parsed.source || 'quiz_explanation',
                    locked: true,
                    created_at: new Date().toISOString(),
                  },
                ];
                await HardnotesService.saveNoteContent(String(params.noteId), { items: nextItems });
              }
            }
          } catch {}
        }
      } catch (e: any) {
        Alert.alert('Load failed', e?.message || 'Could not open note');
      } finally {
        setLoading(false);
        setTimeout(() => {
          isInitialLoadRef.current = false;
        }, 200);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.noteId]);

  // Debounced auto-save
  const scheduleSave = useCallback(() => {
    if (!params.noteId) return;
    if (isInitialLoadRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveState('saving');
    saveTimerRef.current = setTimeout(async () => {
      try {
        // Rebuild items: keep base_layer if present, then all strokes as 'stroke' entries.
        const items: any[] = [];
        if (baseLayerText) {
          items.push({
            id: `base_current`,
            type: 'base_layer',
            markdown: baseLayerText,
            source: 'quiz_explanation',
            locked: true,
          });
        }
        for (const s of strokes) {
          items.push({ type: 'stroke', ...s });
        }
        await HardnotesService.saveNoteContent(params.noteId as string, { items });
        setSaveState('saved');
      } catch (e) {
        console.error('Save failed', e);
        setSaveState('error');
      }
    }, 800);
  }, [strokes, baseLayerText, params.noteId]);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [scheduleSave]);

  const pushHistory = useCallback(() => {
    undoStackRef.current.push([...strokes]);
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    setHistoryVer((v) => v + 1);
  }, [strokes]);

  const handleStrokeCommit = useCallback(
    (s: Stroke) => {
      pushHistory();
      setStrokes((prev) => [...prev, s]);
    },
    [pushHistory]
  );

  const handleErase = useCallback(
    (ids: string[]) => {
      if (!ids.length) return;
      pushHistory();
      setStrokes((prev) => prev.filter((s) => !ids.includes(s.id)));
    },
    [pushHistory]
  );

  const undo = useCallback(() => {
    const snap = undoStackRef.current.pop();
    if (!snap) return;
    redoStackRef.current.push([...strokes]);
    setStrokes(snap);
    setHistoryVer((v) => v + 1);
  }, [strokes]);

  const redo = useCallback(() => {
    const snap = redoStackRef.current.pop();
    if (!snap) return;
    undoStackRef.current.push([...strokes]);
    setStrokes(snap);
    setHistoryVer((v) => v + 1);
  }, [strokes]);

  const canvasWidth = winW;
  const canvasHeight = Math.max(winH - 110, 800); // scrollable tall canvas

  const baseLayerForCanvas = baseLayerText ? { text: baseLayerText, height: 260 } : null;

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.loadWrap}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ color: colors.textTertiary, marginTop: 12, fontWeight: '700' }}>Loading canvas…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: '#f1f5f9' }]} edges={['top']} data-testid="hn-pro-editor">
      <View style={[styles.header, { backgroundColor: '#ffffff', borderBottomColor: '#e5e7eb' }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="hn-editor-back">
          <ArrowLeft size={18} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          <Text style={styles.subText}>{strokes.length} stroke{strokes.length === 1 ? '' : 's'}</Text>
        </View>
        <SaveBadge state={saveState} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center', paddingVertical: 12 }}
        minimumZoomScale={0.5}
        maximumZoomScale={3}
        pinchGestureEnabled
        showsVerticalScrollIndicator
      >
        {/* Paper shadow wrapper */}
        <View style={[styles.paper, { width: canvasWidth - 16 }]}>
          {baseLayerText && (
            <View style={styles.baseLayerPreview}>
              <Text style={styles.baseLayerLabel}>QUIZ EXPLANATION · LOCKED</Text>
              <Text style={styles.baseLayerBody} numberOfLines={12}>{baseLayerText}</Text>
            </View>
          )}
          <SkiaCanvas
            width={canvasWidth - 16}
            height={canvasHeight}
            strokes={strokes}
            tool={tool}
            color={color}
            baseWidth={brushWidth}
            baseLayer={baseLayerForCanvas}
            onStrokeCommit={handleStrokeCommit}
            onEraseStrokes={handleErase}
          />
        </View>
      </ScrollView>

      <ToolPalette
        tool={tool}
        onToolChange={setTool}
        color={color}
        onColorChange={setColor}
        width={brushWidth}
        onWidthChange={setBrushWidth}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStackRef.current.length > 0}
        canRedo={redoStackRef.current.length > 0}
      />
    </SafeAreaView>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
        <ActivityIndicator size="small" color="#b45309" />
        <Text style={[styles.badgeTxt, { color: '#b45309' }]}>Saving…</Text>
      </View>
    );
  }
  if (state === 'saved') {
    return (
      <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
        <Check size={12} color="#15803d" strokeWidth={3} />
        <Text style={[styles.badgeTxt, { color: '#15803d' }]}>Saved</Text>
      </View>
    );
  }
  if (state === 'error') {
    return (
      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
        <CloudOff size={12} color="#b91c1c" />
        <Text style={[styles.badgeTxt, { color: '#b91c1c' }]}>Error</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: '#e2e8f0' }]}>
      <Cloud size={12} color="#475569" />
      <Text style={[styles.badgeTxt, { color: '#475569' }]}>Synced</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  titleText: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  subText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  paper: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  baseLayerPreview: { padding: 14, backgroundColor: '#fef3c7', borderLeftWidth: 4, borderLeftColor: '#f59e0b' },
  baseLayerLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, color: '#b45309', marginBottom: 6 },
  baseLayerBody: { fontSize: 12, fontWeight: '600', color: '#713f12', lineHeight: 18 },
});
