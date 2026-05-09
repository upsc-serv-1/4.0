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

### Step 6 — PencilCanvas + Toolbar + Export (commits `79af826`, `ada1682`)
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

### Step 7 — Local-First Sync (commit `2ed0ef4` + wiring `4edcbc1`)
- `pilotV2LocalStore.ts` — KV-backed (MMKV with AsyncStorage fallback) cache
  for notes + strokes, rolling backup ring (5 snapshots), dirty index.
- `pilotV2SyncQueue.ts` — NetInfo-driven background retry loop with
  exponential backoff (2s → 30s).
- `pilotV2OfflineSave.ts` — local-first save wrapper + newer-wins
  hydration helper.
- Pilot V2 entry now starts the sync queue on mount and hydrates every
  fetched note from local cache before exposing them to the UI
  (crash-recovery covered).

### Step 8 — Migration & UI (commits `4edcbc1`, `582db3d`, `13e7e3c`, `6e2fda7`)
- `pilotV2Migration.ts` — backward-compat converter (legacy flat blocks /
  no `pencilStrokes` field → new schema). Applied to every fetched note.
- `PILOT_V2_BLOCK_TAGS` + `getBlockTag` — registry of badge presets
  (`quiz_import`, `ai_generated`, `manual`, `pinned`).
- `PilotV2EditorView.tsx` — renders an absolute-positioned tag badge above
  blocks whose `meta.tag` is set.
- `PilotV2NoteList.tsx` — search now spans note titles AND every block's
  text (resolves Claude gap #9 — "Search Within Blocks").
- `PilotV2SaveSheet.tsx` — remembers last-used Subject/Topic/Subtopic/
  Notebook in AsyncStorage and pre-fills them on next open. Quiz-saved
  blocks now carry `meta.tag = 'quiz_import'` so the badge is visible.
- `pilotV2ShapeRecognition.ts` — heuristic snap of freehand strokes to
  rectangles, circles, or arrows. Toggle exposed on the toolbar via the
  ✨ Sparkles icon (persists across sessions).
- `PencilCanvas.tsx` — lasso tool now draws a polygon while dragging,
  selects strokes whose centroid lies inside, and exposes a floating
  "Drag to move / Delete / Done" pill. Engine adds `selectInsidePolygon`,
  `moveStrokes`, `removeStrokes`, `toRelative`.

---

## 🚧 Pending / deferred

### Tested-but-deferred
* 253 pre-existing TypeScript errors in `services/`, `softnotes/`, `utils/`,
  `supabase/functions/`, plus `PilotV2NoteList`, `PilotV2SaveSheet`,
  `PilotV2Sidebar`. **Per user request — not fixing now.** Keep app on
  Expo Go.

### Future work (not blocking)
- Outline sidebar with heading hierarchy (Step 8 stretch — partially done
  by existing right-hand outline panel in `PilotV2EditorView`).
- Smart Block Matcher (gap #5) — AI similarity matching for auto-block
  suggestion.
- Tagging system on regular blocks (gap #1) — UI for users to add custom
  tags beyond `quiz_import` / `ai_generated`.
- Active Recall Washi-Tape system (Item 11) — premium tape-as-mask UX.
- Flashcard Study Reminders (gap 2.1).
- Custom App Icon support (gap 2.2).
- Flashcard cascade deletion in Supabase (gap 2.4).
- View Source action inside `SharedQuestionCard` (gap 2.5).

---

## File map (current)

```
src/components/pilot-v2/
  PencilAnnotationEngine.ts    ✅ Step 5 + Step 8 (lasso & shape rec)
  PencilCanvas.tsx              ✅ Step 6 + Step 8 (lasso UI)
  PencilToolbar.tsx             ✅ Step 6 + Step 8 (shape toggle)
  usePilotV2Pencil.ts           ✅ Step 6 + Step 8 (shape state)
  pilotV2Export.ts              ✅ Step 6
  pilotV2LocalStore.ts          ✅ Step 7
  pilotV2SyncQueue.ts           ✅ Step 7
  pilotV2OfflineSave.ts         ✅ Step 7
  pilotV2Migration.ts           ✅ Step 8
  pilotV2ShapeRecognition.ts    ✅ Step 8
  PilotV2EditorView.tsx         ✅ wired (pencil + export + tag badges)
  PilotV2GlanceView.tsx         ✅ wired (pencil + export)
  PilotV2NoteList.tsx           ✅ block-content search
  PilotV2SaveSheet.tsx          ✅ last-used preferences + quiz-import tag
  types.ts                      ✅ extended w/ pencil types
src/lib/
  kvStore.ts                    ✅ pre-existing (MMKV / AsyncStorage)
```

---

## Commit log on `pilot-pro-v2.3`

```
6e2fda7 Step 8: Persist last-used notebook hierarchy and tag quiz-imported blocks for badge display
13e7e3c Step 8: Add lasso selection box and shape recognition to pencil engine and toolbar
582db3d Step 8: Show block-tag badges in editor for quiz-imported and AI-generated blocks
4edcbc1 Step 7: Wire local-first sync queue startup and crash-recovery hydration in Pilot V2 entry
2ed0ef4 Step 7: Add local-first sync layer with MMKV cache, retry queue and crash recovery
ada1682 Step 6: Mark steps 5 and 6 as completed in handoff and add softnotes borrow plan
79af826 Step 6: Add Notability-style pencil canvas, toolbar and unified export
bcde702 Step 5: Add pencil annotation engine with palm rejection and undo redo
```

## Push command (for any continuation agent)
```bash
cd /app/frontend
git add -A
git commit -m "Step N: short description"
git push origin pilot-pro-v2.3
```
PAT used: `github_pat_11CCGLRGQ0L5nrITIwONXh_…` (already in remote URL).
Author: emergent bot <emergent-bot@users.noreply.github.com>.
