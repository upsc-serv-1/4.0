# 🛠️ Hardnotes Renovation — Progress Log

> **Branch:** `hardnotes-renovation` (forked from `6.1`)
> **Scope:** Renovate the **Hardnotes** tab for iPad first; phone compatibility comes later.
> **Plan source:** `Hardnotes upgrade/1. EXECUTIVE_SUMMARY_AND_ACTION_PLAN.md` + `2. HARD_NOTES_RENOVATION_PLAN.md`
> **Phase 2 (Notability clone / Soft Notes):** intentionally out of scope.

This file is the single hand-off document. **Any agent picking up the work should read this first.**
Update it after every batch. Keep it append-only at the bottom for the activity log.

---

## 🎯 Goal Summary

Transform Hardnotes from a 3-lens annotator into a full-featured iPad editor:
1. Rich-text formatting (highlight, underline, strikethrough, bold, italic)
2. Hierarchical (parent→child) bullet nesting
3. Real-time bi-directional sync with the Notes tab (both already point at `user_notes` via Supabase)
4. Three viewing modes (Glance / Focus / Ink) — already present, polish for iPad
5. Download / export — already present via `UnifiedExportSheet`
6. iPad-optimised layout (wider canvas, larger touch targets, dockable toolbar, multi-pane)

---

## 🗺️ Codebase Map (Hardnotes-relevant files only)

| Path | Role |
|---|---|
| `app/(tabs)/hardnotes.tsx` | Hub: sidebar + breadcrumbs + notes grid (tablet-aware) |
| `app/hardnotes/_layout.tsx` | Stack layout for the editor |
| `app/hardnotes/editor.tsx` | Editor screen — header, lens switcher, scroll list of bullet cards, ink dock |
| `src/components/hardnotes/useHardnoteDoc.ts` | Persistence hook — owns `points[]`, debounced save to `user_notes.items` |
| `src/components/hardnotes/InkBulletCard.tsx` | Per-point card — text edit, B/I/highlight toolbar, Skia ink overlay |
| `src/components/hardnotes/LensSwitcher.tsx` | Glance / Focus / Ink segmented control |
| `src/components/hardnotes/InkToolbar.tsx` | Floating ink dock (pen / highlighter / eraser / undo / redo / text-mode) |
| `src/components/hardnotes/HardnotesSidebar.tsx` | Folder tree (left pane on tablets) |
| `src/components/hardnotes/NotesGrid.tsx` | Right-pane notes/folders grid with swipe + long-press menu |
| `src/components/hardnotes/strokes.ts` | `Stroke`, `StrokePoint` types + svg-path helper |
| `src/services/HardnotesService.ts` | CRUD on `user_note_nodes` (folders/leaves) and `user_notes` |

**Data model today:**
- `user_note_nodes` — tree of folders + leaves; one leaf points to one `user_notes` row
- `user_notes.items` — JSONB array of points: `{ id, type: 'point' | 'heading' | 'checklist', text, color, source, locked, checked, strokes[], tags[], createdAt }`
- **No `parentId` on points yet** — points are flat. The hierarchical-nesting phase will add it.

---

## ✅ What is **already** working (verified by code reading, not run)

- Three lenses (Glance / Focus / Ink) with colour-coded segmented switcher
- Quick-add buttons for Heading / Checklist / Point in Glance mode
- Inline edit on double-tap; Bold / Italic / 4-colour highlight; Done button
- Locked references from quiz capture (`base_layer` → locked point)
- Ink: pen / highlighter / eraser / undo / redo / pinch-zoom per card
- Folder tree with create / pin / move / duplicate / archive
- Notes grid with grid + list view, swipe-delete, stroke thumbnail preview
- Export sheet (`UnifiedExportSheet`) — PDF + Markdown
- Auto-save every 3 s; flush on back-press

---

## 🚧 What is **missing** vs. the plan

| # | Gap | Plan ref | Priority |
|---|---|---|---|
| 1 | Underline + Strikethrough in inline formatting toolbar | Phase 2 §2 | **P0 (Batch 1)** |
| 2 | iPad-specific spacing, wider content max-width, larger lens chips | Phase 2 §1 | **P0 (Batch 1)** |
| 3 | Hierarchical bullets — `parentId`, indentation, "add child" | Phase 4 | **P1 (Batch 2)** |
| 4 | Real-time Supabase subscription so Notes ↔ Hardnotes auto-update | Phase 3 | **P1 (Batch 3)** |
| 5 | "Open in Hardnotes" entry-point from Notes tab | Phase 1 §1.3 | **P2 (Batch 4)** |
| 6 | Optional: persistent dockable formatting bar for iPad keyboard | Phase 2 polish | **P2 (Batch 4)** |

Out of scope for this branch:
- Notability clone / Soft Notes (Phase B, future)
- Apple Pencil pressure capture upgrade (current Skia overlay is enough)
- New Supabase columns — we keep formatting inside the existing `items` JSONB to avoid schema migrations

---

## 📦 Batch Plan

| Batch | Title | Status | Branch commit |
|---|---|---|---|
| 0 | Branch + progress.md scaffolding | ✅ done | `83d91c4` |
| 1 | iPad polish + Underline/Strikethrough in toolbar | ✅ done | `af0b966` |
| 2 | Hierarchical bullets (parent/child) | ✅ done | (this commit) |
| 3 | Real-time Notes ↔ Hardnotes sync | ✅ done | (this commit) |
| 4 | Notes-tab "Open in Hardnotes" + iPad dockable toolbar | ⬜ todo | — |
| 5 | Notability spec — page-wide ink (file 3) | ✅ done | (this commit) |
| 6 | Notability spec — tape mask + lasso | ✅ tape done; lasso deferred | (this commit) |
| 7 | Notability impl-guide patterns (file 4) | 📋 docs only — items deferred | (this commit) |
| 8 | Soft notes quick-ref polish (file 5) | 📋 explicitly out of scope (Phase B) | — |

Each batch ends with a commit + push to `origin/hardnotes-renovation`.

---

## 🧠 Hand-off rules for the next agent

1. **Read this file end-to-end before opening any code.**
2. Stay on branch `hardnotes-renovation`. Do **not** rebase onto `6.1` — owner reviews via PR.
3. Touch only the files listed in the **Codebase Map** above unless absolutely necessary.
4. Keep the `items` JSONB shape backwards-compatible — `useHardnoteDoc.normalize()` is the single migration boundary.
5. Treat iPad (width ≥ 760) as the primary form factor. Phone fallbacks are **OK to leave functional but unstyled** for now.
6. After each batch: update the **Activity Log** below, bump the corresponding row in the Batch Plan to ✅, commit + push.

---

## 📜 Activity Log (newest at the bottom)

### 2026-02 · Batch 0 — Scaffolding (this commit)
- Cloned `upsc-serv-1/4.0` at branch `6.1`
- Created branch `hardnotes-renovation`
- Read plan files 1 & 2 (`Hardnotes upgrade/`)
- Mapped existing Hardnotes architecture (see Codebase Map)
- Identified six gaps vs. plan and grouped them into four batches
- Created this `PROGRESS.md`

_Next step → Batch 1: iPad polish + Underline + Strikethrough._

### 2026-02 · Batch 1 — Underline / Strikethrough + iPad polish

**Files touched**
- `src/components/hardnotes/InkBulletCard.tsx`
- `app/hardnotes/editor.tsx`

**Changes**
- **Inline format toolbar (every bullet card)** now has `B`, `I`, `U`, `S`, four highlight swatches, `Done`. Underline / Strikethrough use Lucide icons inside the same `FormatBtn` component (extended to accept `children` so we can render an icon instead of a letter).
- `wrapSelection` is reused — Underline wraps in `<u>…</u>`, Strikethrough in `<s>…</s>`. Both legacy `<del>` and `<s>` are styled in `tagsStyles` for backwards compatibility.
- `RenderHtml` `tagsStyles` updated in **both** the editing-preview block and the read block — so the formatting renders correctly whether the user is editing or just viewing.
- **iPad polish in `editor.tsx`**:
  - Added `isTablet = winW >= 760` derived state.
  - `contentWidth` now scales: focus mode caps at **720 px** (optimal reading width), glance/ink caps at **920 px** on iPad (vs. 740 px on phone).
  - Header padding → 24/14 on iPad (was 12/8). Title font → 26 px. Eyebrow 10 px. Back chevron 28 px.
  - Lens row gets matching 24/12 padding on iPad.
  - Quick-add chips (`H` `✓` `•`) grow to 36 × 12 on iPad with bigger icons, easier finger-tap.
  - ScrollView content-container now centers on iPad and the inner `<View>` enforces the max-width — long lines stop sprawling across the whole screen.

**Why these are safe**
- Pure styling / new optional props. Backwards-compatible.
- No DB-schema or `useHardnoteDoc` changes, so saved notes load identically.
- Phone (< 760 px) layout is unchanged — the conditional only kicks in on tablets.

**Manual smoke test plan (cannot run code from this sandbox)**
1. Select text in a bullet → tap `U` → text becomes underlined; tap `S` → strikethrough.
2. Save & re-open the note → formatting persists (it's stored as HTML in `point.text`).
3. Resize to ≥ 760 px → header & lens row expand, cards stay max 920 px and sit centred.

**Known follow-ups (deferred)**
- LensSwitcher chips themselves still use ~30 px height — fine on iPad but could grow.
- The format toolbar still wraps onto two lines on small phones with all 4 swatches + B/I/U/S/Done; intentional for now.

### 2026-02 · Batch 2 — Hierarchical bullets (parent → child nesting)

**Files touched**
- `src/components/hardnotes/useHardnoteDoc.ts`
- `src/components/hardnotes/InkBulletCard.tsx`
- `app/hardnotes/editor.tsx`

**Changes**
- `Point` interface gains `parentId?: string | null`. Persistence stays a **flat array** in `user_notes.items`; depth is computed at render time. No DB schema change.
- `normalize()` preserves `parentId` from any legacy item shape.
- `removePoint()` cascade-deletes descendants (any point whose ancestor chain includes the removed id).
- `insertPoint(afterId, draft)` is hierarchy-aware: when called against a parent, it places the new point **after** all of that parent's descendants so the subtree stays contiguous.
- `editor.tsx` builds `depthByPointId` once per render (cycle-guarded, capped at 4) and passes `depth` to each card.
- `editor.tsx` adds an `onAddChild` callback that creates a sibling with `parentId = parent.id`. The "Add below" button now lives next to a new "Add child" pill.
- `InkBulletCard.tsx` accepts `depth` + `onAddChild`. Cards indent visually via `marginLeft = 12 + depth*22`. Lucide `CornerDownRight` icon used for the child pill.

**Why these are safe**
- Backwards-compatible: existing notes with no `parentId` render at depth 0, identical to today.
- All hierarchy data lives inside the existing `items` JSONB. No migration.

**Manual smoke test plan**
1. Create a top-level point → tap "Add child" → new card appears indented one level.
2. Add another child → both nested under same parent.
3. Tap "Add below" on a child → new card is at the same depth, *after* its siblings.
4. Delete the parent → confirms parent + all descendants disappear.
5. Reload note → hierarchy persists.

**Known follow-ups (deferred)**
- No drag-to-re-parent UI yet (existing reorderPoints helper is order-only).
- No collapse/expand toggle on parents — all subtrees always render.

_Next → Batch 3 (Phase 3 of plan): real-time Notes ↔ Hardnotes sync via Supabase channel._

### 2026-02 · Batch 3 — Real-time Notes ↔ Hardnotes sync (Phase 3 of plan)

**File touched**
- `src/components/hardnotes/useHardnoteDoc.ts`

**Change**
- Added a Supabase realtime subscription scoped to `user_notes` rows where `id = noteId`.
- Any INSERT / UPDATE / DELETE on the row triggers a `refresh()` so the editor reflects external edits (e.g. a change saved from the Notes tab on another device).
- Conflict-avoidance: if a local debounced save is pending (`saveTimer.current` set), the remote-change handler is a no-op — our save will land within 3 s and become the new source of truth. Prevents overwriting a typing user.
- Channel is torn down via `supabase.removeChannel()` on unmount or noteId change.

**What this enables**
- Edit a note in the Notes tab → switch to Hardnotes tab → see the update without pull-to-refresh.
- Open the same note on iPad + iPhone → typing on one shows on the other within ~1 s of each save.

**Manual smoke test plan**
1. Open the same note on two devices/sessions.
2. Type & save on device A → device B's editor reflects the change (so long as B isn't actively editing).
3. Type *simultaneously* on both → last save wins, but neither side gets clobbered mid-keystroke.

**Known follow-ups (deferred)**
- No CRDT / OT — true two-way merging of concurrent edits is Phase B (Soft Notes).
- The realtime feature must be enabled on the Supabase project for `user_notes` (Database → Replication). Owner action — not a code change.

_Next → Batch 4 (Phase 5 polish + Notes-tab "Open in Hardnotes" entry-point)._

### 2026-02 · Batch 5 — Page-wide ink canvas (Notability spec, file 3)

User said: *"my pencil should work on whole page"*. This batch implements that.

**Files**
- `src/components/hardnotes/PageInkOverlay.tsx` (new, ~190 lines)
- `src/components/hardnotes/useHardnoteDoc.ts`
- `app/hardnotes/editor.tsx`

**Architecture**
- Strokes that cover the whole page are stored as `pageStrokes: Stroke[]` on the doc.
- Persistence reuses the existing `user_notes.items` JSONB by writing a single sentinel record at index 0: `{ id: 'page_canvas', type: 'page_canvas', strokes: [...] }`. `normalize()` skips this record so `points` stays clean.
- `extractPageStrokes()` reads it back. **No DB schema migration needed.**
- New doc API: `pageStrokes`, `addPageStroke`, `removePageStrokes`, `clearPageStrokes`.
- `scheduleSave` / `flushSave` now serialize via a shared `buildItemsPayload(points, pageStrokes)` helper.

**Component**
- `PageInkOverlay` renders one Skia `<Canvas>` over the whole content area (both display + interactive layers). Coordinates are in content-space — strokes anchor to the page, not the viewport.
- Display layer is `pointerEvents="none"` so scrolling passes through. Interactive layer mounts only when `lens === 'ink'` so single-finger pan = draw, two-finger pan = scroll (Notability convention).
- Pen / highlighter / eraser already share the existing `Stroke` model; tool/colour/width come from the same `inkTool/inkColor/inkWidth` state already used by the floating dock — no toolbar duplication.

**Manual smoke test**
1. Switch to Ink lens → draw a line crossing 3 bullets → ink renders over text & gaps.
2. Switch to Glance lens → ink is still visible (read-only).
3. Reload note → strokes persist via the `page_canvas` items record.
4. Two-finger drag in Ink lens → page scrolls (gesture surface uses `maxPointers(1)`).

**Known follow-ups (next batch)**
- Tape / lasso / rectangle mask (Notability §Selection + §Tape) — Batch 6.
- Pen-only mode toggle for palm rejection (currently every single-finger pan draws) — defer to Batch 7.
- Page-stroke undo/redo (currently only per-bullet has undo). Defer.

_Next → Batch 6: tape/mask + lasso, then files 4 & 5._

### 2026-02 · Batch 6 — Tape / mask tool (Notability spec, file 3)

User said: *"tape like masking feature of notability"*. Done.

**Files**
- `src/components/hardnotes/strokes.ts` — `'tape'` added to `ToolKind`
- `src/components/hardnotes/InkToolbar.tsx` — Tape button, `TAPE_COLORS`, `TAPE_WIDTHS`
- `src/components/hardnotes/PageInkOverlay.tsx` — opaque-fill render branch for `tool === 'tape'`
- `app/hardnotes/editor.tsx` — `handleToolChange()` smart defaults

**How tape behaves**
- Pick **Tape** in the floating ink dock → palette swaps to mask-friendly colours: `#ffffff`, `#fffbeb`, `#f1f5f9`, `#fef3c7`, `#fee2e2`, `#0f172a`. Widths jump to 16/28/44 px.
- Drag with single finger / pencil → the stroke renders as a **fully opaque, square-cap, miter-joined wide path**, painting OVER existing pen/highlighter ink. That gives the "correction tape" effect — the underlying ink is masked but not deleted.
- Stored as a normal `Stroke` with `tool: 'tape'` inside the same `pageStrokes` array, so it round-trips through the existing persistence + realtime sync.
- `handleToolChange('tape')` resets colour to white and width to 28 — so the very first stroke after switching makes a clean visible mask.
- `handleToolChange('pen' | 'highlighter')` resets to their conventional defaults too — prevents the user being stuck with white pen after switching back.

**Why we did NOT make tape a separate "mask record"**
- Re-using `Stroke` keeps undo/redo/eraser/realtime behaviour unchanged.
- Eraser already deletes any stroke type — so tapping eraser on a tape stroke removes it, exactly like Notability.

**Lasso (deferred)**
- `'lasso'` is already in `ToolKind` but no UI button yet. Spec calls for a closed-path selection that moves/copies/deletes contained strokes. Worth its own batch — slated for Batch 7 alongside file 4 patterns.

_Next → Read files 4 (Notability Implementation Guide) and 5 (Soft Notes Quick Ref) and apply._

### 2026-02 · Batch 7 — Files 4 & 5 review + extension hooks

**File 4 (Notability Implementation Guide) — what we already cover and what's deferred**

Already covered by batches 5 + 6:
- Single-page Skia canvas spanning the full scrollable note (`PageInkOverlay`)
- Shared `Stroke` model with pen / highlighter / tape / eraser tools
- Two-finger pan to scroll, single-finger to draw (Notability convention)
- Realtime persistence via the existing `user_notes` row + Supabase channel

Deferred (good extension points for the next agent):
| Item | Where to hook in | Effort |
|---|---|---|
| Apple-Pencil-only mode (palm rejection) | `PageInkOverlay` already accepts a `pencilOnly` prop. Wire `Gesture.Pan().onTouchesDown((e, manager) => { if (pencilOnly && !e.allTouches.some(t => (t as any).force > 0.05)) manager.fail(); })`. | S |
| Catmull-Rom stroke smoothing | `strokes.ts → strokeToSvgPath`. Replace mid-point quadratic with the Catmull-Rom-to-cubic snippet from file 4. | S |
| Pinch-to-zoom + pan transform | Wrap the entire `<View>` that owns `PageInkOverlay` + bullet cards in an `Animated.View` driven by `useCanvasTransforms()` from file 4. Translate touch coords by `screenToCanvasCoords(zoom, panX, panY)` before storage. | M |
| Lasso selection | `'lasso'` already in `ToolKind`. Add a button in `InkToolbar`. On end-of-pan, run point-in-polygon over `pageStrokes` and surface a selection toolbar (move/copy/delete). | M-L |
| Stroke virtualization (perf) | When `pageStrokes.length > ~500`, group by Y-buckets and only render buckets within `[scrollY-200, scrollY+viewport+200]`. Bucket index can live in-memory (no DB). | M |

**File 5 (Soft Notes Quick Ref) — explicitly Phase B / out of scope**

Per the original brief: *"we will stick to file 1 and 2, as building notability clone would be phase 2 sometime later."* File 5 describes the standalone Soft Notes / Notebooks Hub product (separate Supabase schema, Redux store, multi-page notebooks). **None of it is implemented in this branch.** Pulling any of it requires:
- New tables: `notebooks`, `pages`, `strokes`, `text_boxes`
- A Redux store (currently the app uses bare React state + Supabase)
- A new Notebook hub screen + per-page editor

When that phase begins, fork from `main` (not from `hardnotes-renovation`), as the Hardnotes-tab work in this branch is intentionally non-disruptive to the existing `user_notes` schema.

**Pencil-only prop (extension hook shipped this batch)**
- `PageInkOverlay` accepts `pencilOnly?: boolean` (default `false`). It is currently a no-op — wiring it to `onTouchesDown(... manager.fail())` is the next concrete file-4 task.

_Branch state: 8 batches recorded. Ready for review / merge._
