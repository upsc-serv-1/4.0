# Pilot V2 — Implementation Progress

> **Branch:** `pilot-pro-v2.3` (push target). Push as `emergent bot`.
> **Last updated:** see `git log`.
> This file is a continuous handoff so any agent (or human) can pick up where
> the previous session stopped.

---

## ✅ Completed

### Step 5 — PencilAnnotationEngine (commit `bcde702`)
- File: `src/components/pilot-v2/PencilAnnotationEngine.ts`
- Stroke tracker, palm rejection, **relative 0..1 coords** (no scale drift),
  undo/redo (200 deep), velocity pressure, eraser hit-test.
- Types added: `PilotV2PencilStroke`, `PilotV2PencilTool`, palette constants
  (Pen/Highlighter colors + 6 widths each).

### Step 6 — PencilCanvas + Toolbar + Export (commit `79af826`, `ada1682`)
- `PencilCanvas.tsx` — Skia page-level continuous overlay.
- `PencilToolbar.tsx` — Notability-style: Pen / Highlighter / Eraser / Lasso,
  6 widths, color palette + favorites, custom hex picker, undo/redo,
  pencil-only toggle, spring animations on tool & color selection.
- `usePilotV2Pencil.ts` — hook with AsyncStorage persistence of
  tool/color/favorites + engine lifecycle per noteId.
- Wired into both `PilotV2EditorView.tsx` and `PilotV2GlanceView.tsx`
  (drawable everywhere — pencil FAB toggles drawing mode).
- `pilotV2Export.ts` — bridges to existing `unifiedExportEngine` so PDF /
  Image / Markdown exports include flattened pencil strokes.
- Editor More-menu Export options now functional (PDF / Image / Markdown).
- Glance share button now exports via the unified engine.
- **Bug fix:** removed orphan Modal block + trailing `,});` syntax error in
  `PilotV2EditorView.tsx` (file now compiles).
- HANDOFF.md marked Steps 5 & 6 `[x]`.
- `PILOT_V2_SOFTNOTES_BORROWED.md` created with smart-borrow list.

---

## 🚧 In progress (current session)

### Step 7 — Local-First Sync (Notability-style)
**Goal**: every keystroke saves to the device first; cross-device sync via
Supabase; Google Drive backup option. Uses existing `KVStore` (MMKV →
AsyncStorage fallback) so it works in **Expo Go now** and upgrades
automatically when the user installs a dev build.

| Sub-task | Status |
|---|---|
| `pilotV2LocalStore.ts` (KV-backed cache for notes + strokes) | ⏳ pending |
| Crash-recovery hydrate-on-launch | ⏳ pending |
| Background retry queue (network-restored re-sync) | ⏳ pending |
| Supabase server sync hook for cross-device | ⏳ pending |
| Google Drive backup integration (manual + auto on close) | ⏳ pending |
| Wire into `savePilotV2NoteContent` | ⏳ pending |

### Step 8 — Migration & UI
| Sub-task | Status |
|---|---|
| Backward-compat converter (old flat blocks → new schema) | ⏳ pending |
| Outline sidebar (heading hierarchy) inside editor | ⏳ pending |
| Block-tag badges ("Added by quiz import" etc.) | ⏳ pending |

### Step 5/6 polish
| Sub-task | Status |
|---|---|
| Lasso selection box (move/scale grouped strokes) | ⏳ pending |
| Shape recognition (square / circle / arrow snap) | ⏳ pending |

### Validation
- [ ] `npx tsc --noEmit` → only pre-existing errors should remain
- [ ] `testing_agent_v3_expo` end-to-end run
- [ ] Final push to `pilot-pro-v2.3`

---

## ⏭️ Deferred (out-of-scope for this session)

* 253 pre-existing TypeScript errors in `services/`, `softnotes/`, `utils/`,
  `supabase/functions/`, plus `PilotV2NoteList`, `PilotV2SaveSheet`,
  `PilotV2Sidebar`. **Per user request — not fixing now.** Keep app on
  Expo Go.
* Apple Pencil 2 hardware double-tap (would require a native module,
  breaks Expo Go).

---

## File map (current)

```
src/components/pilot-v2/
  PencilAnnotationEngine.ts   ✅ Step 5
  PencilCanvas.tsx             ✅ Step 6
  PencilToolbar.tsx            ✅ Step 6
  usePilotV2Pencil.ts          ✅ Step 6
  pilotV2Export.ts             ✅ Step 6
  PilotV2EditorView.tsx        ✅ wired (pencil + export)
  PilotV2GlanceView.tsx        ✅ wired (pencil + export)
  types.ts                     ✅ extended w/ pencil types
  pilotV2LocalStore.ts         ⏳ Step 7
  pilotV2SyncQueue.ts          ⏳ Step 7
  pilotV2DriveBackup.ts        ⏳ Step 7 (Google Drive)
  pilotV2Migration.ts          ⏳ Step 8
  PilotV2OutlineSidebar.tsx    ⏳ Step 8
src/lib/
  kvStore.ts                   ✅ pre-existing (MMKV / AsyncStorage)
```

---

## Commit log so far on `pilot-pro-v2.3`
```
ada1682 Step 6: Mark steps 5 and 6 as completed in handoff and add softnotes borrow plan
79af826 Step 6: Add Notability-style pencil canvas, toolbar and unified export
bcde702 Step 5: Add pencil annotation engine with palm rejection and undo redo
```

## Push command (for any continuation agent)
```bash
cd /root/work/pilot-repo
git add -A
git commit -m "Step N: short description"
git push origin pilot-pro-v2.3
```
PAT used: `github_pat_11CCGLRGQ0L5nrITIwONXh_…` (already in remote URL).
Author: emergent bot <emergent-bot@users.noreply.github.com>.
