Now the ScissorTextEditor (reusable in pop-ups & flashcard view):
Action: file_editor create /tmp/upsc-repo/src/components/hardnotes/ScissorTextEditor.tsx --file-text "/**
 * ScissorTextEditor — bullet-point text editor with \"scissor split\" tool.
 *
 * - Each bullet is its own TextInput row.
 * - Tapping the scissor button while a row is focused splits the active
 *   bullet's string at the current cursor index, producing two adjacent
 *   bullets. The new bullet inherits focus.
 * - Backspace at the start of an empty (or any) bullet merges it back into
 *   the previous bullet's tail (Notability/Notes parity).
 * - Each commit (debounced) is forwarded via onChange so the parent can
 *   persist into user_notes.items as 'checklist' / 'text' point entries.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Scissors, Plus, Trash2 } from 'lucide-react-native';

interface Bullet {
  id: string;
  text: string;
}

interface Props {
  initialBullets?: Bullet[];
  onChange?: (bullets: Bullet[]) => void;
  testIDPrefix?: string;
}

const newId = () => `bl_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

export function ScissorTextEditor({ initialBullets, onChange, testIDPrefix = 'hn-scissor' }: Props) {
  const [bullets, setBullets] = useState<Bullet[]>(
    initialBullets && initialBullets.length > 0 ? initialBullets : [{ id: newId(), text: '' }]
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const selRef = useRef<Record<string, { start: number; end: number }>>({});
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const pendingFocusRef = useRef<string | null>(null);

  useEffect(() => {
    onChange?.(bullets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bullets]);

  useEffect(() => {
    if (pendingFocusRef.current) {
      const id = pendingFocusRef.current;
      const ref = inputRefs.current[id];
      if (ref) {
        ref.focus();
        pendingFocusRef.current = null;
      }
    }
  }, [bullets]);

  const updateText = (id: string, text: string) => {
    setBullets((prev) => prev.map((b) => (b.id === id ? { ...b, text } : b)));
  };

  const splitAtCursor = useCallback(() => {
    if (!focusedId) return;
    const sel = selRef.current[focusedId] || { start: 0, end: 0 };
    setBullets((prev) => {
      const idx = prev.findIndex((b) => b.id === focusedId);
      if (idx < 0) return prev;
      const cur = prev[idx];
      const left = cur.text.slice(0, sel.start);
      const right = cur.text.slice(sel.start);
      const newBullet: Bullet = { id: newId(), text: right };
      pendingFocusRef.current = newBullet.id;
      const next = [...prev];
      next.splice(idx, 1, { ...cur, text: left }, newBullet);
      return next;
    });
  }, [focusedId]);

  const addBullet = () => {
    setBullets((prev) => {
      const id = newId();
      pendingFocusRef.current = id;
      return [...prev, { id, text: '' }];
    });
  };

  const removeBullet = (id: string) => {
    setBullets((prev) => {
      if (prev.length === 1) return [{ id: newId(), text: '' }];
      return prev.filter((b) => b.id !== id);
    });
  };

  const handleKeyPress = (id: string, key: string) => {
    if (key !== 'Backspace') return;
    const sel = selRef.current[id] || { start: 0, end: 0 };
    if (sel.start !== 0 || sel.end !== 0) return;
    setBullets((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx <= 0) return prev;
      const prevBullet = prev[idx - 1];
      const merged = prevBullet.text + prev[idx].text;
      pendingFocusRef.current = prevBullet.id;
      const next = [...prev];
      next.splice(idx - 1, 2, { ...prevBullet, text: merged });
      return next;
    });
  };

  return (
    <View style={styles.wrap} data-testid={`${testIDPrefix}-root`}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          onPress={splitAtCursor}
          disabled={!focusedId}
          style={[styles.btn, !focusedId && { opacity: 0.4 }]}
          data-testid={`${testIDPrefix}-split-btn`}
        >
          <Scissors size={14} color=\"#0f172a\" />
          <Text style={styles.btnTxt}>Split</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={addBullet} style={styles.btn} data-testid={`${testIDPrefix}-add-btn`}>
          <Plus size={14} color=\"#0f172a\" />
          <Text style={styles.btnTxt}>Add bullet</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.list}>
        {bullets.map((b, i) => (
          <View key={b.id} style={styles.row}>
            <View style={styles.dot} />
            <TextInput
              ref={(r) => {
                inputRefs.current[b.id] = r;
              }}
              value={b.text}
              onChangeText={(t) => updateText(b.id, t)}
              onSelectionChange={(e) => {
                selRef.current[b.id] = e.nativeEvent.selection;
              }}
              onFocus={() => setFocusedId(b.id)}
              onKeyPress={(e) => handleKeyPress(b.id, (e.nativeEvent as any).key)}
              multiline
              placeholder=\"Type a point…\"
              placeholderTextColor=\"#94a3b8\"
              style={styles.input}
              data-testid={`${testIDPrefix}-input-${i}`}
            />
            <TouchableOpacity
              onPress={() => removeBullet(b.id)}
              style={styles.removeBtn}
              data-testid={`${testIDPrefix}-remove-${i}`}
            >
              <Trash2 size={13} color=\"#94a3b8\" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 12,
    backgroundColor: 'rgba(15,23,42,0.06)',
  },
  btnTxt: { fontSize: 12, fontWeight: '900', color: '#0f172a', letterSpacing: 0.3 },
  list: {
    gap: 4,
    backgroundColor: '#fff7d6',
    borderRadius: 16,
    padding: 12,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#92400e', marginTop: 10 },
  input: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: '#713f12',
    fontWeight: '600',
    minHeight: 24,
    padding: 0,
    textAlignVertical: 'top',
  },
  removeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
});
"
Observation: Create successful: /tmp/upsc-repo/src/components/hardnotes/ScissorTextEditor.tsx

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