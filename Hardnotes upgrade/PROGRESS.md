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
| 0 | Branch + progress.md scaffolding | 🔄 in progress | — |
| 1 | iPad polish + Underline/Strikethrough in toolbar | ⬜ todo | — |
| 2 | Hierarchical bullets (parent/child) | ⬜ todo | — |
| 3 | Real-time Notes ↔ Hardnotes sync | ⬜ todo | — |
| 4 | Notes-tab "Open in Hardnotes" + iPad dockable toolbar | ⬜ todo | — |

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
