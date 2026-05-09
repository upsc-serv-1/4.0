# Pilot V2 — Smart Borrowed Features from Soft Notes

This document lists features from `src/softnotes/*` that **could be borrowed** into
the Pilot V2 tab (`src/components/pilot-v2/*`). It includes both what was
already borrowed for Step 5/6 and what could be borrowed next.

---

## Already borrowed in Step 5 + Step 6

| Feature | Source | Borrowed into | Notes |
|---|---|---|---|
| Catmull-Rom / quadratic-midpoint stroke smoothing | `src/softnotes/strokes.ts` | `PencilAnnotationEngine.pencilStrokeToSvgPath` | Re-implemented in relative coordinates |
| Velocity-based pressure heuristic | `src/softnotes/strokes.ts:pressureFromVelocity` | `PencilAnnotationEngine.pressureFromVelocity` | Identical math |
| Skia `Canvas` + `Path` rendering pattern | `src/softnotes/SoftCanvas.tsx` | `PencilCanvas.tsx` | Same `Skia.Path.MakeFromSVGString` flow |
| Tool / color / width state shape | `src/softnotes/SoftToolbar.tsx` | `PencilToolbar.tsx` | Adapted to Pilot V2 design tokens |
| Throttled point sampling (4ms) | `src/softnotes/SoftCanvas.tsx` | `PencilAnnotationEngine.addPoint` | Prevents jaggy strokes at 120 Hz |
| Highlighter `multiply` blend with reduced alpha | `src/softnotes/SoftCanvas.tsx` | `PencilCanvas` `withAlpha()` | Mimics real highlighter ink |

---

## Recommended next-borrow candidates

> These are NOT yet wired in — all are smart-borrow opportunities for future
> phases (Step 7+) without breaking Pilot V2's block-first architecture.

### 1. Pinch-to-zoom canvas transform
- **Source:** `src/softnotes/useSoftPage.ts` zoom/pan logic
- **Why:** Lets users zoom into pencil details on long pages without scaling
  text blocks
- **Caveat:** Must avoid distorting the underlying note blocks — apply only to
  the `<PencilCanvas>` Skia surface, not the parent `ScrollView`

### 2. Lasso selection + move/scale
- **Source:** `src/softnotes/SoftCanvas.tsx:handleLassoDrag`
- **Why:** User explicitly requested a lasso tool (now wired as a tool button
  but with a TODO selection box)
- **Effort:** Medium — re-use the point-in-polygon helper

### 3. Paper guide overlays (ruled / dotted / grid)
- **Source:** `src/softnotes/SoftCanvas.tsx` paper background renderer
- **Why:** Improves handwriting guides for note-taking
- **Effort:** Low — drop-in `<Group>` underneath strokes

### 4. Tape / sticker / stamp tool
- **Source:** `src/softnotes/types.ts:SoftStamp`
- **Why:** Premium feel; Notability has these
- **Effort:** Medium — reuse stamp mesh & gesture handlers

### 5. Continuous auto-save with debounce + status indicator
- **Source:** `src/softnotes/useSoftPage.ts` save pipeline
- **Why:** The current Pilot V2 save uses a 600 ms timer; Soft Notes uses a
  smarter "save on idle + save on background" pattern
- **Effort:** Low — replace `saveTimer.current` with the soft pattern

### 6. Stroke layering with explicit z-order
- **Source:** `src/softnotes/SoftCanvas.tsx` z-index sort
- **Why:** Lets users send strokes back / forward like Notability layers
- **Effort:** Low — already partially done (`stroke.zIndex` exists)

### 7. Snap-to-shape stroke recognition
- **Source:** `src/softnotes/strokes.ts` shape-fit heuristics
- **Why:** Quick conversion of hand-drawn squares / circles into clean shapes
- **Effort:** Medium — port the existing detector

### 8. Long-press eraser radius slider
- **Source:** `src/softnotes/SoftToolbar.tsx`
- **Why:** Lets users adjust eraser width on the fly (current Pilot V2 uses
  fixed tolerance 1.8%)
- **Effort:** Trivial

### 9. Per-stroke metadata (author, timestamp, device)
- **Source:** `src/softnotes/types.ts:SoftStroke`
- **Why:** Useful for collaborative notes & analytics
- **Effort:** Trivial schema additions

---

## Architectural notes

* **Page-level overlay.** Pilot V2's `PencilCanvas` is mounted **once per
  note** (sized to the entire scrollable document) — exactly the Notability
  model. Soft Notes' `SoftCanvas` is page-bounded; Pilot V2's overlay floats
  above an arbitrarily-tall block stack so users can keep editing text while
  drawings sit on top.

* **Coordinate space.** Soft Notes stores absolute pixels; Pilot V2 stores
  **relative 0..1 coordinates** (Phase 3 gap fix). When borrowing any geometry
  helper from Soft Notes, multiply by `pageWidth / pageHeight` first.

* **Persistence.** Soft Notes saves via Supabase Realtime channels. Pilot V2
  saves via `savePilotV2NoteContent` writing `note.content.pencilStrokes`
  alongside `blocks`. Strokes survive note re-opens automatically.
