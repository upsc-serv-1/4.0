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

## ✅ Completed in this iteration (continued — span-offset & glance wiring)

### Step 9 — `85ab0f2` Span-offset anchoring for underlines/highlights
**Priority #2 (anchoring — text-range).** Extended the `anchor` field on
`PilotV2PencilStroke` with seven new optional sub-fields that record the
exact text range a horizontal annotation covers.

Key changes:
- **`types.ts`**: `anchor` interface gains `elementId?`, `spanIndex?`,
  `startOffset?`, `endOffset?`, `startRelX?`, `endRelX?`, `relY?`.
- **`PilotV2EditorView.tsx`** (`assignAnchorToStrokes`):
  - Detects underline/highlight strokes: `tool === 'highlighter'` OR
    pen with nearly-horizontal geometry (dY < 25 % of dX, dX > 5 %).
  - For detected strokes: computes `startRelX` / `endRelX` from the
    stroke's min/max X; `relY` from centroid Y relative to block height;
    `startOffset` / `endOffset` from `relX × block.text.length` (char
    estimate); `elementId = blockId`, `spanIndex = 0`.
  - Dependency array extended with `paperSize.w` and `blocks`.
- **`pilotV2Migration.ts`** (`normaliseStrokes`): all seven new fields
  are now round-tripped safely (preserved if present, omitted if absent).
- **`pilotV2Migration.ts`** (`assignLegacyAnchors`): also runs the
  span-offset detection heuristic on legacy notes so old highlighted
  strokes gain the new fields on first open.

### Step 10 — `90e8099` Wire blockLayouts into PilotV2GlanceView
**Priority #2 (anchoring — glance view).**  Until this step the
read-only Glance view rendered strokes using raw page coordinates and
had no way to follow block reorders.

Key changes (all in `PilotV2GlanceView.tsx`):
- `blockLayoutsRef` (`useRef<Map<string, {y,h}>>`) added — mirrors the
  same ref used by `PilotV2EditorView`.
- `blockLayoutVersion` state counter added.
- Each block in the render list is now wrapped in a thin `<View
  onLayout={…}>` that populates `blockLayoutsRef` and bumps
  `blockLayoutVersion` when y/h changes by > 2 px.
- `<PencilCanvas>` now receives `blockLayouts={blockLayoutsRef.current}`
  and `blockLayoutVersion={blockLayoutVersion}` — same props as the
  editor.  Anchored strokes now follow reorders in the read-only view.

### Step 11 — `ec1a468` Stress test — 220 strokes on 10-block note
**Verification.** Pure TypeScript Node script in
`scripts/stressTestPencilAnchoring.ts`.  10/10 assertions pass.

Test coverage:
1. 220 strokes generated (≥ 200 target).
2. Every stroke gets an anchor assigned (blockId + blockOriginY).
3. Anchor blockId points to a real block.
4. Horizontal / highlighter strokes carry full span-offset fields
   (elementId, spanIndex, startOffset, endOffset, startRelX, endRelX, relY).
5. Block reorder: moving block_0 to last position produces a non-trivial
   display delta (`dy ≈ 0.92` of page height).
6. Idempotent re-anchor: running the function twice does not overwrite.
7. JSON roundtrip (close + reopen): all anchor fields survive.
8. Every block owns at least one stroke (min 22, max 22 — perfect distribution).

Run with: `npx tsx scripts/stressTestPencilAnchoring.ts`

---

## ✅ All originally scoped anchoring work is COMPLETE

| Feature | Status | Step |
| --- | --- | --- |
| Ultra-low-latency rendering | ✅ Done | 1 |
| UI-thread throttle + dedupe | ✅ Done | 2 |
| Lasso teleport bug | ✅ Done | 3 |
| Flush stroke saves on unmount | ✅ Done | 4 |
| Block-level anchor (blockId + blockOriginY) | ✅ Done | 6 |
| Per-block display transform | ✅ Done | 7 |
| Legacy migration | ✅ Done | 8 |
| **Span-offset anchoring (elementId/spanIndex/startOffset/endOffset)** | ✅ Done | **9** |
| **GlanceView blockLayouts wiring** | ✅ Done | **10** |
| **Stress test 200+ strokes / 10 blocks / reorder / roundtrip** | ✅ Done | **11** |

---

## 🟡 Still OPEN — precise text-edit Y correction

Span-offset fields are now stored, but the actual Y-correction when
text is INSERTED within a block (shifting subsequent lines downward) is
not yet wired into `applyBlockOffset` in `PencilCanvas.tsx`.  This
requires per-character text-layout measurements (not available via
standard RN APIs) and was out of scope.  The fields are in place for a
future phase.

---

## 📂 Files of interest (jumping off points)

| File | What it does |
| --- | --- |
| `src/components/pilot-v2/PencilAnnotationEngine.ts` | In-memory stroke model, smoothing, undo/redo. **Modified in Steps 1, 6.** |
| `src/components/pilot-v2/PencilCanvas.tsx` | Skia drawing surface + lasso selection pill. **Modified in Steps 1–3, 7.** |
| `src/components/pilot-v2/usePilotV2Pencil.ts` | Hook owning the engine + persistence callback. **Modified in Step 1.** |
| `src/components/pilot-v2/PilotV2EditorView.tsx` | Editor host with blocks + canvas. **Modified in Steps 4, 6, 9.** |
| `src/components/pilot-v2/PilotV2GlanceView.tsx` | Read-only glance host with same canvas. **Modified in Step 10.** |
| `src/components/pilot-v2/pilotV2Migration.ts` | Content normaliser. **Modified in Steps 8, 9.** |
| `src/components/pilot-v2/types.ts` | Type definitions — `PilotV2PencilStroke`. **Modified in Steps 6, 9.** |
| `scripts/stressTestPencilAnchoring.ts` | Node stress test — run with `npx tsx`. **Added in Step 11.** |
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

## 🎯 Suggested next steps (if continuing)

1. **Precise in-block Y correction for text edits** — wire `startRelX` /
   `endRelX` / `relY` into `applyBlockOffset` together with live
   `onLayout` data from `TextInput` to shift an underline when the user
   types above it within the same block.
2. **Export** — `pilotV2Export.ts` currently reads the flat
   `note.content.pencilStrokes` array.  For the span-offset data to
   appear in PDF exports, the exporter should call
   `assignLegacyAnchors` before rendering.
3. **Highlighter tool** — consider auto-detecting a horizontal highlighter
   stroke on a text block and converting it to a styled inline annotation
   (`block.underline = true` or a background span) rather than a pixel
   path, which will survive font-size changes perfectly.
