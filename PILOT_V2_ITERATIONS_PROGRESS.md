# Pilot V2 — Iteration-by-Iteration Progress Log

Living progress tracker so we can resume safely between sessions. Every
iteration lists: scope, files touched, root-cause / approach, and an
"acceptance" section the user verifies on their iPad Pro before we close
that iteration and move on.

Target branch: `pilot-pro-v2.3`
Test device: iOS — iPad Pro

---

## Master roadmap (user-confirmed order)

| # | Theme | Section | Status |
|---|-------|---------|--------|
| 0 | Quiz "Save to Notebook" — duplicate notebooks + cross-subject dropdowns | – | ✅ Done (commit `a9778bb`) |
| 1 | Pencil smoothness in Pilot Writing / Glance / Editor (match Soft Notes) | 1 / Priority #1 | ✅ Code shipped — awaiting on-device verification |
| 2 | Persistence + anchoring (strokes / underlines / highlights stay attached) | 1 / Priority #2 | ⏳ Pending |
| 3 | Lasso + movement stability (no teleporting / disappearing) | 1 / Priority #3 | ⏳ Pending |
| 4 | Zoom + glance/editor scaling (no fit-width snap-back, free zoom) | 1 / Priority #4 | ⏳ Pending |
| 5 | Toolbar UX + interaction polish (spring expansion, unified favourites) | 1 / Priority #5 | ⏳ Pending |
| 6 | AI integration into notes workflow (save reply, regenerate, persist) | 2 | ⏳ Pending |
| 7 | "Save to Pilot" → real rich editor instead of raw HTML preview | 3 | ⏳ Pending |
| 8 | AI Explanation regenerate / evolve flow (map / mains / pointwise) | 4 | ⏳ Pending |

---

## Iteration 0 — Quiz "Save to Notebook" hygiene  ✅
**Commit:** `a9778bb`

- Duplicate notebooks: scoped `findOrCreatePilotV2Note.ensureNode` strictly
  to `metadata->>surface = 'pilot_v2'` and replaced `.maybeSingle()` with
  `.order('created_at', { ascending: true }).limit(1)` so repeated saves
  consistently append to the same canonical note.
- Subject / Topic / Microtopic dropdowns in the Save Sheet now merge the
  user's actual Pilot V2 hierarchy (`fetchPilotV2HierarchyOptions`) with
  the static palette, so users can re-route a quiz save into ANY branch
  they already own — not just the auto-seeded one.

Files: `src/repositories/pilotV2Repo.ts`, `src/components/pilot-v2/PilotV2SaveSheet.tsx`

---

## Iteration 1 — Pencil smoothness  ✅ (code shipped)
**Commit:** `514fba3`

### Root cause (verified by reading both pipelines side-by-side)
Soft Notes already runs at full 120 Hz on iPad Pro because its `<Path>`
elements receive the path data as **strings** — Skia accepts both strings
and `SkPath` objects, and string paths stay on the JS thread with zero
JSI bridge work per frame.

Pilot V2's `PencilCanvas` was doing the opposite for the **active stroke**:
1. `engine.addPoint()` reassigns `currentStroke = { ...current, points: [...] }`
   on every captured point, so the React identity of the active stroke
   changes every ~4 ms.
2. `getCachedPath(activeStroke)` keys its cache by `strokeRef === stroke`,
   so the cache always missed for the live stroke.
3. On every miss it called `Skia.Path.MakeFromSVGString(d)` — a fresh
   native `SkPath` allocation across the JSI bridge, every single point.
4. `pencilStrokeToSvgPath` rebuilt the **entire** SVG string from all
   accumulated points (O(n) per frame), which compounded the cost on long
   continuous strokes — exactly matching the user's "long strokes stutter,
   ink lags behind finger" report.

Committed (already-finished) strokes were fine — their cache key holds
because the ref is stable post-commit.

### Fix (PencilCanvas.tsx only — minimal blast radius)
- Added an **incremental string-path builder** (`buildActivePath`) that
  appends one quadratic segment per new point (O(1)) into a ref, plus a
  trailing `L` to the latest finger position so the stroke head is crisp.
- The active stroke is now rendered with `<Path path={pathString} />`
  directly — no `Skia.Path.MakeFromSVGString` call during drawing, no
  per-point native allocation.
- The incremental cache resets automatically when the active stroke ID
  changes (new stroke after `endStroke`, tool/colour change, mount).
- On `endStroke` / cancel, `resetActivePath()` flushes the cache and lets
  the just-committed stroke render via the existing committed-stroke
  Skia.Path cache on the next frame — no visual gap, no flicker.

Files: `src/components/pilot-v2/PencilCanvas.tsx`

### Acceptance — please verify on iPad Pro
- [ ] Drawing fast inside Pilot Writing / Glance / Editor: ink stays under the finger, no perceptible lag.
- [ ] Long continuous strokes (e.g. a wide loop) no longer stutter.
- [ ] No frame-drop or visual hitch when releasing a stroke (the hand-off from active to committed render).
- [ ] Highlighter / pen / pressure all still render correctly.
- [ ] Eraser, lasso, undo/redo continue to work as before.

If any of the above misses, we'll iterate further (next candidates: move
the gesture handler off `runOnJS` per-point and feed the Skia canvas
directly via `useSharedValue` + `useDerivedValue`; throttle subscribe
notifications during active drawing).

---

## Iteration 2 — Persistence + anchoring  ⏳
_Pending — not yet started._

Planned scope:
- Stop relying on visual coordinates for underline/highlight anchoring;
  switch to stable text-range anchors (block ID + character offset) with
  a re-anchor pass on text edits.
- Persist Pilot V2 strokes via the engine's relative coordinates on every
  block reorder / editor-glance transition (today they live on the host
  hook only — verify both legs persist).
- Reload-stability test on app restart, note reopen, block reorder.

---

## Iteration 3 — Lasso + movement stability  ⏳
## Iteration 4 — Zoom (no fit-width snap-back)  ⏳
## Iteration 5 — Toolbar UX polish  ⏳
## Iteration 6 — AI integration into notes  ⏳
## Iteration 7 — Save to Pilot → real rich editor  ⏳
## Iteration 8 — AI Explanation regenerate / evolve  ⏳

(_Each iteration's section will be filled in the same shape as
Iteration 1 above — root cause, fix, files, acceptance checklist — at the
time it's worked on._)
