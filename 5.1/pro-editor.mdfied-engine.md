Now rewrite the pro-editor.tsx to integrate the new pill toolbar, paper picker, soft pastel base layer, scissor sheet, and stroke move/delete CRUD:
Action: file_editor create /tmp/upsc-repo/app/notes/pro-editor.tsx --file-text "/**
 * Pro-Note Editor — Notability-style Skia canvas with a single horizontal
 * floating-pill toolbar, paper-background picker, frosted-glass UI, and a
 * scissor-split text editor for splitting bullets at the cursor.
 *
 * Route params:
 *   - noteId    : user_notes.id to open (required for saves)
 *   - nodeId    : optional user_note_nodes.id (for breadcrumb title)
 *   - title     : optional initial title override
 *   - baseLayer : optional JSON-encoded { markdown, source } — when coming from
 *                 the quiz engine we preload this as a locked base layer.
 *
 * Persistence: items[] inside user_notes is a heterogenous JSONB array of
 *   - { type: 'stroke', ... }
 *   - { type: 'base_layer', markdown, source, locked }
 *   - { type: 'bullet', text }   (from the scissor editor)
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
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Check, Cloud, CloudOff, Scissors, X } from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { HardnotesService } from '../../src/services/HardnotesService';
import { SkiaCanvas, PaperKind } from '../../src/components/hardnotes/SkiaCanvas';
import { ToolPalette } from '../../src/components/hardnotes/ToolPalette';
import { ScissorTextEditor } from '../../src/components/hardnotes/ScissorTextEditor';
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
  const [bullets, setBullets] = useState<{ id: string; text: string }[]>([]);
  const [tool, setTool] = useState<ToolKind | 'scissor'>('pen');
  const [color, setColor] = useState<string>('#0f172a');
  const [brushWidth, setBrushWidth] = useState<number>(3);
  const [paper, setPaper] = useState<PaperKind>('lined');
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [scissorOpen, setScissorOpen] = useState(false);

  const undoStackRef = useRef<Stroke[][]>([]);
  const redoStackRef = useRef<Stroke[][]>([]);
  const [, setHistoryVer] = useState(0);
  const saveTimerRef = useRef<any>(null);
  const isInitialLoadRef = useRef(true);

  // Open the scissor sheet whenever the user selects the scissor tool.
  useEffect(() => {
    if (tool === 'scissor') setScissorOpen(true);
  }, [tool]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (!params.noteId) {
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

          const loadedBullets = items
            .filter((it: any) => it && it.type === 'bullet')
            .map((it: any) => ({ id: it.id, text: it.text || '' }));
          setBullets(loadedBullets);

          const savedPaper = items.find((it: any) => it && it.type === 'paper');
          if (savedPaper?.kind) setPaper(savedPaper.kind as PaperKind);
        }

        if (params.baseLayer) {
          try {
            const parsed = JSON.parse(String(params.baseLayer));
            if (parsed?.markdown) setBaseLayerText(parsed.markdown);
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
        const items: any[] = [];
        items.push({ id: 'paper', type: 'paper', kind: paper });
        if (baseLayerText) {
          items.push({
            id: 'base_current',
            type: 'base_layer',
            markdown: baseLayerText,
            source: 'quiz_explanation',
            locked: true,
          });
        }
        for (const b of bullets) items.push({ id: b.id, type: 'bullet', text: b.text });
        for (const s of strokes) items.push({ type: 'stroke', ...s });
        await HardnotesService.saveNoteContent(params.noteId as string, { items });
        setSaveState('saved');
      } catch (e) {
        console.error('Save failed', e);
        setSaveState('error');
      }
    }, 800);
  }, [strokes, bullets, baseLayerText, paper, params.noteId]);

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

  const handleMoveSelection = useCallback(
    (ids: string[], dx: number, dy: number) => {
      if (!ids.length || (Math.abs(dx) < 1 && Math.abs(dy) < 1)) return;
      pushHistory();
      setStrokes((prev) =>
        prev.map((s) =>
          ids.includes(s.id)
            ? { ...s, points: s.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })) }
            : s
        )
      );
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

  const canvasWidth = winW - 16;
  const canvasHeight = Math.max(winH - 110, 800);

  const baseLayerForCanvas = baseLayerText
    ? { text: baseLayerText, height: 240 }
    : null;

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
    <SafeAreaView style={[styles.flex, { backgroundColor: '#f4f4f0' }]} edges={['top']} data-testid=\"hn-pro-editor\">
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid=\"hn-editor-back\">
          <ArrowLeft size={18} color=\"#0f172a\" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
          <Text style={styles.subText}>{strokes.length} stroke{strokes.length === 1 ? '' : 's'} · {bullets.length} bullet{bullets.length === 1 ? '' : 's'}</Text>
        </View>
        <SaveBadge state={saveState} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ alignItems: 'center', paddingVertical: 12, paddingBottom: 80 }}
        minimumZoomScale={0.5}
        maximumZoomScale={3}
        pinchGestureEnabled
        showsVerticalScrollIndicator
      >
        <View style={[styles.paper, { width: canvasWidth }]}>
          {baseLayerText && (
            <View style={styles.baseLayerCard} data-testid=\"hn-base-layer\">
              <Text style={styles.baseLayerLabel}>QUIZ EXPLANATION · LOCKED</Text>
              <Text style={styles.baseLayerBody}>{baseLayerText}</Text>
            </View>
          )}

          {bullets.length > 0 && (
            <View style={styles.bulletsPreview} data-testid=\"hn-bullets-preview\">
              {bullets.map((b) => (
                <View key={b.id} style={styles.bulletRow}>
                  <View style={styles.bulletDot} />
                  <Text style={styles.bulletText}>{b.text || ' '}</Text>
                </View>
              ))}
            </View>
          )}

          <SkiaCanvas
            width={canvasWidth}
            height={canvasHeight}
            strokes={strokes}
            tool={tool}
            color={color}
            baseWidth={brushWidth}
            paper={paper}
            baseLayer={baseLayerForCanvas}
            onStrokeCommit={handleStrokeCommit}
            onEraseStrokes={handleErase}
            onMoveSelection={handleMoveSelection}
          />
        </View>
      </ScrollView>

      <ToolPalette
        tool={tool}
        onToolChange={(t) => setTool(t)}
        color={color}
        onColorChange={setColor}
        width={brushWidth}
        onWidthChange={setBrushWidth}
        paper={paper}
        onPaperChange={setPaper}
        onUndo={undo}
        onRedo={redo}
        canUndo={undoStackRef.current.length > 0}
        canRedo={redoStackRef.current.length > 0}
      />

      {/* Scissor text editor sheet */}
      <Modal visible={scissorOpen} transparent animationType=\"slide\" onRequestClose={() => setScissorOpen(false)}>
        <Pressable style={styles.scissorBackdrop} onPress={() => setScissorOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.scissorSheet, { backgroundColor: colors.surface }]}
            data-testid=\"hn-scissor-sheet\"
          >
            <View style={styles.scissorHandle} />
            <View style={styles.scissorHead}>
              <View style={[styles.scissorIcon, { backgroundColor: colors.primary + '18' }]}>
                <Scissors size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.scissorTitle, { color: colors.textPrimary }]}>Scissor · Bullets</Text>
                <Text style={[styles.scissorSub, { color: colors.textTertiary }]}>
                  Place the cursor anywhere then tap “Split” to break the line into two bullets.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setScissorOpen(false);
                  setTool('pen');
                }}
                style={[styles.scissorClose, { backgroundColor: colors.border + '40' }]}
                data-testid=\"hn-scissor-close\"
              >
                <X size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScissorTextEditor
              initialBullets={bullets}
              onChange={setBullets}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  if (state === 'saving') {
    return (
      <View style={[styles.badge, { backgroundColor: '#fef3c7' }]}>
        <ActivityIndicator size=\"small\" color=\"#b45309\" />
        <Text style={[styles.badgeTxt, { color: '#b45309' }]}>Saving…</Text>
      </View>
    );
  }
  if (state === 'saved') {
    return (
      <View style={[styles.badge, { backgroundColor: '#dcfce7' }]}>
        <Check size={12} color=\"#15803d\" strokeWidth={3} />
        <Text style={[styles.badgeTxt, { color: '#15803d' }]}>Saved</Text>
      </View>
    );
  }
  if (state === 'error') {
    return (
      <View style={[styles.badge, { backgroundColor: '#fee2e2' }]}>
        <CloudOff size={12} color=\"#b91c1c\" />
        <Text style={[styles.badgeTxt, { color: '#b91c1c' }]}>Error</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: '#e2e8f0' }]}>
      <Cloud size={12} color=\"#475569\" />
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
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  titleText: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  subText: { fontSize: 11, fontWeight: '700', color: '#94a3b8' },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  paper: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  // Soft pastel locked-explanation card — no harsh borders.
  baseLayerCard: {
    margin: 12,
    padding: 14,
    backgroundColor: '#fff7d6',
    borderRadius: 16,
  },
  baseLayerLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: '#92400e',
    marginBottom: 6,
  },
  baseLayerBody: { fontSize: 13, fontWeight: '600', color: '#713f12', lineHeight: 19 },

  bulletsPreview: {
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    gap: 6,
  },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#047857', marginTop: 8 },
  bulletText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600', color: '#064e3b' },

  // Scissor sheet
  scissorBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  scissorSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    gap: 14,
    minHeight: '40%',
  },
  scissorHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
  },
  scissorHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scissorIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scissorTitle: { fontSize: 15, fontWeight: '900' },
  scissorSub: { fontSize: 11, fontWeight: '700' },
  scissorClose: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
"
Observation: Overwrite successful: /tmp/upsc-repo/app/notes/pro-editor.tsx

Fetching debug logs for expo

==> /var/log/supervisor/expo.err.log <==
Unable to reach well-known versions endpoint. Using local dependency map expo/bundledNativeModules.json for version validation
Dependency validation is unreliable in offline-mode
λ  WARN  Image: style.resizeMode is deprecated. Please use props.resizeMode. 
Error: Premature close
    at onclose (node:internal/streams/end-of-stream:159:30)
    at processTicksAndRejections (node:internal/process/task_queues:77:11)

==> /var/log/supervisor/expo.out.log <==
Tunnel ready.
Networking has been disabled
Waiting on http://localhost:3000
Logs for your project will appear below.
Web node_modules/expo-router/entry.js ░░░░░░░░░░░░░░░░  0.0% (0/1)
Web node_modules/expo-router/entry.js ▓▓▓▓░░░░░░░░░░░░ 25.0% ( 40/161)
λ node_modules/expo-router/node/render.js ░░░░░░░░░░░░░░░░  4.4% ( 16/127)
Web node_modules/expo-router/entry.js ▓▓▓▓░░░░░░░░░░░░ 25.0% (136/314)
λ node_modules/expo-router/node/render.js ▓▓░░░░░░░░░░░░░░ 17.0% (125/303)
Web node_modules/expo-router/entry.js ▓▓▓▓░░░░░░░░░░░░ 30.7% (210/379)
λ node_modules/expo-router/node/render.js ▓▓▓▓▓▓▓░░░░░░░░░ 45.3% (299/444)
Web node_modules/expo-router/entry.js ▓▓▓▓▓▓▓▓░░░░░░░░ 52.8% (354/487)
λ node_modules/expo-router/node/render.js ▓▓▓▓▓▓▓▓▓▓▓░░░░░ 70.4% (444/529)
Web node_modules/expo-router/entry.js ▓▓▓▓▓▓▓▓▓▓▓░░░░░ 72.8% (477/559)
λ node_modules/expo-router/node/render.js ▓▓▓▓▓▓▓▓▓▓▓░░░░░ 75.0% (458/529)
Web node_modules/expo-router/entry.js ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 92.4% (623/675)
λ node_modules/expo-router/node/render.js ▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 93.0% (596/618)
Web Bundled 23774ms node_modules/expo-router/entry.js (748 modules)
λ Bundled 23882ms node_modules/expo-router/node/render.js (717 modules)
λ  LOG  https://quiz-capture-notes.preview.emergentagent.com EXPO_PUBLIC_BACKEND_URL


Fetching debug logs for backend

==> /var/log/supervisor/backend.err.log <==
INFO:     Will watch for changes in these directories: ['/app/backend']
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process [171] using WatchFiles
INFO:     Started server process [202]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Shutting down
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete.
INFO:     Finished server process [202]
INFO:     Stopping reloader process [171]
INFO:     Will watch for changes in these directories: ['/app/backend']
INFO:     Uvicorn running on http://0.0.0.0:8001 (Press CTRL+C to quit)
INFO:     Started reloader process [317] using WatchFiles
INFO:     Started server process [349]
INFO:     Waiting for application startup.
INFO:     Application startup complete.

==> /var/log/supervisor/backend.out.log <==


Fetching debug logs for mongodb

tail: cannot open '/var/log/supervisor/mongodb*.log' for reading: No such file or directory