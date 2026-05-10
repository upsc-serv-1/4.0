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

---

## 🟡 Still OPEN (Priority #2 — anchoring)

The deeper anchoring work was deliberately scoped out of this iteration
because it's a multi-file refactor and the user asked to ship the
smoothness fix first. Below is what the next agent must do.

### What is broken
Strokes / underlines / highlights live at PAGE level with relative
coords (`0..1` of `paperSize`). They do NOT know which block or which
text run they belong to. Therefore:

- Block reorder → strokes stay in old visual position (detach).
- Block text edit → underline shifts to a different word.
- Editor / Glance transition → coordinates may re-evaluate against
  different `paperSize`, causing visible drift.
- Reopening note may show strokes against a now-shorter document where
  their `y` is past the last block.

### Recommended fix path (text-range anchoring)
1. Extend `PilotV2PencilStroke` with optional anchor fields:
   ```ts
   anchor?: {
     blockId: string;             // ID of the nested block this stroke belongs to
     // For underlines / highlights — exact text range:
     elementId?: string;          // ID of the ContentElement inside the block
     spanIndex?: number;          // index into ContentElement.spans
     startOffset?: number;        // char offset from span start
     endOffset?: number;          // char offset (exclusive)
     // For freehand drawing — relative coords WITHIN the block:
     relX?: number;               // 0..1 of block width
     relY?: number;               // 0..1 of block height
   }
   ```
2. On `startStroke`, ask the editor for the block under the touch
   point (`PilotV2EditorView` already measures block layouts via
   `onLayout` callbacks — wire those into a ref map keyed by `blockId`
   and translate screen coords to block-relative coords there).
3. Persist strokes inside `PilotV2NestedBlock.pencilStrokes` (this
   array already exists in `types.ts` line 287) instead of
   `PilotV2NoteContent.pencilStrokes`. The flat-page array becomes a
   fallback for legacy notes only.
4. On render, walk blocks in their CURRENT order and ask each block's
   `<PencilCanvas>` (or a per-block layer) to render its own strokes
   relative to the block's measured rect. This automatically follows
   block reorder and text edits.
5. For underline / highlight specifically: store the anchor as
   `(elementId, spanIndex, startOffset, endOffset)`. Re-derive screen
   rect at render time from the rendered text's measure data.

### Risk areas to watch when implementing the above
- `PilotV2EditorView.persistStrokes` and `PilotV2GlanceView.persistGlanceStrokes`
  both write to `note.content.pencilStrokes`. Migration must tolerate
  both shapes.
- `pilotV2Export.ts` consumes the page-level array for PDF/Image export.
- `pilotV2Migration.ts` already migrates older shapes — extend it.
- `engine.replaceAll(initialStrokes)` in `usePilotV2Pencil` line ~95
  needs to know which engine instance belongs to which block.

---

## 📂 Files of interest (jumping off points)

| File | What it does |
| --- | --- |
| `src/components/pilot-v2/PencilAnnotationEngine.ts` | In-memory stroke model, smoothing, undo/redo. **Modified in Step 1.** |
| `src/components/pilot-v2/PencilCanvas.tsx` | Skia drawing surface + lasso selection pill. **Modified in Steps 1–3.** |
| `src/components/pilot-v2/usePilotV2Pencil.ts` | Hook owning the engine + persistence callback. **Modified in Step 1.** |
| `src/components/pilot-v2/PilotV2EditorView.tsx` | Editor host with blocks + canvas. **Modified in Step 4.** |
| `src/components/pilot-v2/PilotV2GlanceView.tsx` | Read-only glance host with same canvas. |
| `src/components/pilot-v2/types.ts` | Type definitions — `PilotV2PencilStroke`, `PilotV2NestedBlock`. |
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

1. **Implement block-level anchoring** as outlined above. Start with
   freehand drawing (easier — only block-relative coords). Defer the
   span-offset underline anchoring to a follow-up step.
2. **Add a per-block PencilCanvas wrapper** so each block owns its own
   Skia layer; rendering follows block layout automatically.
3. **Migration script** in `pilotV2Migration.ts` that walks the
   page-level strokes, checks which block their bounding box overlaps
   most, and assigns `anchor.blockId` accordingly — converts old notes
   to the new model on first open.
4. **Stress test**: open a note with 200+ strokes on a 10-block page,
   reorder blocks, edit headings, close + reopen, verify strokes
   remain attached to the correct blocks.
