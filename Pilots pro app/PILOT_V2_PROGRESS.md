# Pilot V2 — Implementation Progress

> **Branch:** `pilot-pro-v2.3` (push target). Push as `emergent bot`.
> **Last updated:** see `git log`.
> Continuous handoff so any agent (or human) can pick up where the
> previous session stopped.

---

## ✅ Completed (Phase 1 → Phase 3)

### Step 5 — PencilAnnotationEngine (`bcde702`)
Stroke tracker, palm rejection, relative 0..1 coords, undo/redo (200 deep),
velocity pressure, eraser hit-test.

### Step 6 — PencilCanvas + Toolbar + Export (`79af826`, `ada1682`)
Skia continuous overlay, Notability-style toolbar (pen / highlighter /
eraser / lasso / 6 widths / palette + favorites / undo redo), pencil-only
toggle, hook with AsyncStorage. Wired into editor + glance. Unified PDF /
Image / Markdown export with flattened pencil strokes.

### Step 7 — Local-First Sync (`2ed0ef4`, `4edcbc1`)
MMKV-backed cache + retry queue + crash-recovery hydration on app load.

### Step 8 — Migration & UI (`4edcbc1`, `582db3d`, `13e7e3c`, `6e2fda7`, `68e11aa`)
Backward-compat schema migrator, block-tag badges, search across block
contents, Save-Sheet last-used preferences, lasso selection, shape
recognition (rectangle / circle / arrow).

---

## ✅ Phase 4 — Issue audit (35 items + 3 carryover)

See `Pilots pro app/ISSUES_PROGRESS.md` for the full status table. **Done so
far in Phase 4:** Active Recall Washi-Tape (Item 11), Smart Block Matcher
(Gap 5), Tags-tab inline AI Panel (Issues 2/3/32), CollapsibleHeaderContainer
(Issue 31), UnifiedExportModal (Issues 16/17/18/33/35), StudyReminders
(Issue 28), `isQuestionStateEmpty` cascade delete (Issue 1), PYQ help text
(Issue 21).

**Verified pre-existing implementations:** flashcard cascade delete (#13),
View Source secondary action (#14), dark mode infra (#30), export
filter/sort separation in engine (#16-19, 33).

---

## 🚧 Active wave — Wave 2 (Tag system rebuild)

Targets Issues **4, 5, 6, 7, 34**:
- 4 — Tag rename broken (transactional update across all references)
- 5 — Tag delete cascade
- 6 — New tags require manual refresh (realtime / global store)
- 7 — Plus button to create tag missing
- 34 — Tag filters incomplete tag list (global registry)

**Plan:**
1. Add `useGlobalTagStore.ts` zustand-style hook with Supabase realtime + AsyncStorage cache.
2. Add `renameTagEverywhere()` and `deleteTagEverywhere()` Supabase RPC wrappers.
3. Add `<CreateTagButton />` universal component used by Arena, AI search, Tags tab, Quiz engine.
4. Migrate Tags tab + AI search + Arena/Quiz engine to consume the global store.

---

## 🛑 Deferred / not in current scope
- 253 pre-existing TypeScript errors in `services/`, `softnotes/`, `utils/`, `supabase/functions/` — keep app on Expo Go (per user).
- Apple Pencil 2 hardware double-tap (native module).
- Custom app icon (Issue 29) — requires native dev-build, breaks Expo Go.
- Semantic search engine (Issue 12) — user: "leave for now".
- Full inline AI chat replacement of `/unified/engine` deep-link from Tags tab.

---

## File map (current)

```
src/components/pilot-v2/
  PencilAnnotationEngine.ts        ✅ Step 5 + Step 8 (lasso & shape rec)
  PencilCanvas.tsx                  ✅ Step 6 + Step 8 (lasso UI)
  PencilToolbar.tsx                 ✅ Step 6 + Step 8 (shape toggle)
  usePilotV2Pencil.ts               ✅ Step 6 + Step 8 (shape state)
  pilotV2Export.ts                  ✅ Step 6
  pilotV2LocalStore.ts              ✅ Step 7
  pilotV2SyncQueue.ts               ✅ Step 7
  pilotV2OfflineSave.ts             ✅ Step 7
  pilotV2Migration.ts               ✅ Step 8
  pilotV2ShapeRecognition.ts        ✅ Step 8
  washiTape.ts                      ✅ Phase 4 (Item 11)
  WashiTapeLayer.tsx                ✅ Phase 4 (Item 11)
  smartBlockMatcher.ts              ✅ Phase 4 (Gap 5)
  PilotV2EditorView.tsx             ✅ wired (pencil + export + tag badges + washi)
  PilotV2GlanceView.tsx             ✅ wired (pencil + washi reveal)
  PilotV2NoteList.tsx               ✅ block-content search
  PilotV2SaveSheet.tsx              ✅ last-used + quiz-import tag
  types.ts                          ✅ extended
src/services/
  isQuestionStateEmpty.ts           ✅ Phase 4 (Issue 1)
  StudyReminders.ts                 ✅ Phase 4 (Issue 28)
src/components/tags/
  TagsQuestionAIPanel.tsx           ✅ Phase 4 (Issues 2, 3, 32)
src/components/common/
  CollapsibleHeaderContainer.tsx    ✅ Phase 4 (Issue 31)
src/components/exports/
  UnifiedExportModal.tsx            ✅ Phase 4 (Issues 16, 17, 18, 33, 35)
```

---

## Push command (for any continuation agent)
```bash
cd /app/frontend
git add -A
git commit -m "Wave N — short clear description"
git push origin pilot-pro-v2.3
```
PAT used: `github_pat_11CCGLRGQ0L5nrITIwONXh_…` (already in remote URL).
Author: `emergent bot <emergent-bot@users.noreply.github.com>`.

## Recent commit log
```
dfe1e59 Phase 4 polish: Apply testing agent code-review nits across new modules
ca23124 Phase 4: Update issues progress doc reflecting Waves 3 4 5 closures
9d15a9f Issue 28: Add Expo Go-friendly study reminders polling service
09f7b56 Issues 16+17+18+33+35: Add UnifiedExportModal helper
380b617 Issue 32: Add inline TagsQuestionAIPanel to Tags tab cards
cce54fa Issue 1+5: Convert require to ES import + min-length guard
03a12d9 Phase 4: Update issues progress doc with Wave 1 closure status
41d1caf Issue 21: Update PYQ heatmap help text
372d3ef Issue 1: Auto-delete empty question state rows
84a033f Gap 5: Add Smart Block Matcher
b6f38a5 Item 11: Implement Active Recall Washi-Tape masking system
0ed03fe Phase 4: Add issues progress file
68e11aa Step 8: Update progress and handoff docs
6e2fda7 Step 8: Persist last-used notebook hierarchy + quiz-import tag
13e7e3c Step 8: Add lasso selection box and shape recognition
582db3d Step 8: Block-tag badges
4edcbc1 Step 7: Wire local-first sync queue startup + hydration
2ed0ef4 Step 7: Add local-first sync layer
ada1682 Step 6: Mark steps 5/6 complete + softnotes borrow plan
79af826 Step 6: Add Notability-style pencil canvas, toolbar, unified export
bcde702 Step 5: Pencil annotation engine + palm rejection + undo redo
```
