# Pilot V2 Pencil — Iteration Progress (handoff)

Branch: `pilot-pro-v2.3` · Last updated by: emergent-bot

This file is the single source of truth for what was fixed, what is still
open, and what the next agent should pick up next on the Pilot V2 pencil
/ annotation system. Keep it updated in every iteration.

---

## ✅ Completed in this iteration

### Step 1 — `49f2b85` Pilot V2 pencil ultra-low-latency rendering
**Priority #1 (smoothness).** Eliminated the dominant lag source: the
`forceTick` in `usePilotV2Pencil` was firing on every engine notify,
causing the entire `PilotV2EditorView` (and every block inside it) to
re-render on every pen point.

Key changes:
- `PencilAnnotationEngine` now exposes split listeners:
  `subscribePersisted(fn)` (commit / undo / redo / replace / move /
  remove) and `subscribeActive(fn)` (every move event during drawing).
  Active-stroke updates do NOT fire any persisted listener anymore.
- `addPoint()` is now allocation-free: pushes into the same array
  referenced by `currentStroke.points`, no object spread, no array
  clone per move.
- `usePilotV2Pencil` hook subscribes only to `subscribePersisted`.
- `PencilCanvas` subscribes split: persisted → `setCommittedStrokes`,
  active → `setActiveStroke` + incremental SVG path string.
- New `<CommittedStrokesLayer>` (React.memo with reference-equality)
  contains the committed-strokes Skia tree; it does not reconcile while
  the active stroke is updating.

### Step 2 — `27b8053` UI-thread throttle + dedupe end events
- 4 ms throttle inside the Pan worklet drops sub-frame samples before
  paying the `runOnJS` bridge cost.
- `onEnd` and `onFinalize` now share a guard so each stroke commits
  exactly once (Pan emits both events on a normal finger lift).

### Step 3 — `72bb682` Lasso selection move teleport / disappear bug
**Priority #3.** SelectionPill's drag gesture used mutable closure vars
inside a worklet, which Reanimated 3 does not preserve across
invocations. Each `onUpdate` saw `lastX = 0` and applied the cumulative
`translationX` as a single-frame delta — multiplying offset every
frame, sending strokes off-canvas, where the `[0,1]` clamp inside
`engine.moveStrokes()` snapped all points to a corner. That is what
the user experienced as "selection deletes itself / teleports".

Fix: use `e.changeX` / `e.changeY` (RNGH-provided per-frame deltas).
Movement now follows the finger 1:1.

### Step 4 — `497b85c` Flush pending stroke saves on editor unmount
**Priority #2 (partial).** `PilotV2EditorView.persistStrokes` debounces
saves by 600 ms. If the user navigated away within that window, the
last commit was lost — matches the "drawings disappear after
navigation" symptom.

Fix: track the latest pending payload in a ref, flush it from the
component unmount cleanup. Persistence is offline-first (MMKV) so the
fire-and-forget call lands before the screen actually swaps.

### Step 5 — `9450625` PILOT_PENCIL_PROGRESS.md handoff doc

---

## ✅ Completed in this iteration (continued — anchoring)

### Step 6 — `03212a3` Block-level anchor assignment
**Priority #2 (anchoring — freehand).** Extended `PilotV2PencilStroke`
with an `anchor?: { blockId, blockOriginY }` field.

Key changes:
- `types.ts`: `anchor` field added to `PilotV2PencilStroke`.
  `blockOriginY` is the block's top-edge Y as a fraction (0..1) of the
  page height at stroke-commit time. This scalar is all that is needed
  to derive the reorder delta later.
- `PencilAnnotationEngine.ts`: new `setStrokeAnchor(id, anchor)` method
  that silently patches the in-memory stroke without firing listeners
  (callers persist after).
- `PilotV2EditorView.tsx`:
  - `blockLayoutsRef` (`Map<blockId, {y,h}>`) populated by `onLayout`
    callbacks wired into each `<BlockRow>`.
  - `blockLayoutVersion` state counter incremented whenever a block's
    y or h changes by more than 2 px.
  - `assignAnchorToStrokes` callback: after each `onCommit`, finds the
    block whose y-range contains the stroke centroid and writes
    `anchor.blockId` + `anchor.blockOriginY`.
  - `persistStrokes` now calls `assignAnchorToStrokes` before saving.
  - `<PencilCanvas>` receives `blockLayouts` ref + `blockLayoutVersion`.

### Step 7 — `af8c736` Per-block display transform
Strokes now follow their host block when blocks are reordered.

Key changes:
- `PencilCanvas.tsx`: `Props` gains `blockLayouts` and
  `blockLayoutVersion`.
- `CommittedLayerProps` extended with the same two fields.
- `CommittedStrokesLayer` memo comparator now checks
  `blockLayoutVersion` so it re-runs on any block-position change.
- `applyBlockOffset(stroke)`: when a stroke has `anchor.blockId`,
  computes `dy = currentBlockY/height − anchor.blockOriginY` and
  shifts all path points vertically by `dy`. The Skia path cache is
  cleared on every `blockLayoutVersion` bump so stale paths never
  appear.
- Offset threshold: `|dy| < 0.002` (0.2 % of page) is treated as zero
  to avoid churn from sub-pixel measurement noise.

### Step 8 — `3b5d376` Migration script for legacy unanchored strokes
**Priority #2 (anchoring — migration).** Old notes that were saved
before Step 6 have no `anchor` on their strokes. On first open the
migrator now retroactively assigns `anchor.blockId`.

Key changes (all in `pilotV2Migration.ts`):
- `estimateBlockLayouts(blocks)`: approximates block y/h from text
  length + block type (heading 42 px, paragraph 26 px/line). Used only
  during migration — real positions come from `onLayout` in the editor.
- `assignLegacyAnchors(strokes, blocks)`: for each stroke without an
  `anchor`, finds the block whose estimated rect contains the stroke's
  centroid (or is nearest). Idempotent — strokes that already carry an
  anchor are left untouched.
- `normaliseStrokes`: preserves existing `anchor` fields when
  normalising persisted data so re-migration never clobbers real anchors.
- `migratePilotV2NoteContent`: calls `assignLegacyAnchors` in Case 2
  (the standard persisted shape), so every note is upgraded on load.

---

## 🟡 Still OPEN — span-offset underline/highlight anchoring

Freehand-stroke anchoring is complete (Steps 6–8). The remaining
anchoring work is for underlines and highlights that need to track
specific text runs, not just block Y-positions.

### What is still broken

- Underlines / highlights shift when the user edits the text they cover
  (the stroke stays at the old pixel Y, but the text moves under it).
- No per-span anchor is stored yet (`elementId`, `spanIndex`,
  `startOffset`, `endOffset` are all absent from `anchor`).

### Recommended fix path (text-range anchoring)

1. Extend `anchor` in `PilotV2PencilStroke` with the optional span
   fields from the original spec:
   ```ts
   elementId?: string;    // ContentElement id
   spanIndex?: number;
   startOffset?: number;
   endOffset?: number;
   ```
2. At `startStroke`, if the touch point lands within a rendered text
   run, record the span offset from the text layout measurement.
3. At render time, re-derive the screen rect from the current text
   layout and apply the offset — replacing the simple Y-shift used today.

### Risk areas

- `pilotV2Export.ts` consumes the page-level array for PDF/Image export.
- `PilotV2GlanceView` reads strokes via `note.content.pencilStrokes`
  without block-layout callbacks — glance rendering still uses raw page
  coords and will benefit from the same `blockLayouts` wiring done for
  the editor.

---

## 📂 Files of interest (jumping off points)

| File | What it does |
| --- | --- |
| `src/components/pilot-v2/PencilAnnotationEngine.ts` | In-memory stroke model, smoothing, undo/redo. **Modified in Steps 1, 6.** |
| `src/components/pilot-v2/PencilCanvas.tsx` | Skia drawing surface + lasso selection pill. **Modified in Steps 1–3, 7.** |
| `src/components/pilot-v2/usePilotV2Pencil.ts` | Hook owning the engine + persistence callback. **Modified in Step 1.** |
| `src/components/pilot-v2/PilotV2EditorView.tsx` | Editor host with blocks + canvas. **Modified in Steps 4, 6.** |
| `src/components/pilot-v2/PilotV2GlanceView.tsx` | Read-only glance host with same canvas. |
| `src/components/pilot-v2/pilotV2Migration.ts` | Content normaliser. **Modified in Step 8.** |
| `src/components/pilot-v2/types.ts` | Type definitions — `PilotV2PencilStroke`. **Modified in Step 6.** |
| `src/softnotes/SoftCanvas.tsx` | Reference implementation that already has the smooth feel. |

---

## 🔁 Conventions for the next agent

- Branch: `pilot-pro-v2.3`. Each step = one commit + one push.
- Commit message: `Step N: Short clear description`.
- Push as `emergent bot` (configured in repo `.gitconfig`).
- Update this file at the end of every step so the chain of context
  survives credit-cap rotations.
- Code-only changes (no automated UI tests). Pencil smoothness can only
  be felt on real iPad / S-Pen hardware.

---

## 🎯 Suggested next steps (ordered)

1. **Span-offset anchoring for underlines/highlights** — extend `anchor`
   with `elementId / spanIndex / startOffset / endOffset` and wire up
   text-layout measurement in the editor (see "Still OPEN" section).
2. **Glance view block-layout wiring** — `PilotV2GlanceView` renders the
   same strokes but currently has no `blockLayouts` ref. Add `onLayout`
   callbacks to `BlockRenderer` rows and pass `blockLayouts` /
   `blockLayoutVersion` to its `<PencilCanvas>` so anchored strokes
   follow reorders in the read-only view as well.
3. **Stress test**: open a note with 200+ strokes on a 10-block page,
   reorder blocks, edit headings, close + reopen, verify strokes
   remain attached to the correct blocks.
