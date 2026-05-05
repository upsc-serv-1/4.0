# PRD — UPSC Study App (5.3 branch)

## Live work history

### Iteration 1 — Knowledge Vault (Notes tab)  [completed earlier]
Subject Hub grid + Aichii tree + Glance Mode + chip filter (review-tag catalog) +
Focus Mode (`?focus=1`) + UnifiedExportSheet integration. Files: `app/notes/index.tsx`,
`app/notes/editor.tsx`, `src/components/notes/{SubjectHubGrid, SemanticChipRow, GlancePanel}.tsx`,
`src/hooks/useNoteTagCatalog.ts`. *Notes-Pro left untouched, as instructed.*

### Iteration 2 — Hardnotes "Three-Lens" Editor  [this iteration]

**Problem**: Two capture popups (Add to Notebook vs Add to Hardnote), two destinations
(classic editor vs Skia pro-editor) and no way to pen-annotate existing bullets.

**Solution**: A single editor at `/hardnotes/editor` with three lenses, anchored
per-bullet ink, and a unified `Point` data shape.

#### New files
- `src/components/hardnotes/useHardnoteDoc.ts` — debounced load/save hook with a
  canonical `Point` type. Normalises legacy `highlight`, `microTopicHeading`,
  `base_layer` items on read; nothing to migrate manually.
- `src/components/hardnotes/InkBulletCard.tsx` — atomic bullet card. Renders rich
  HTML (RenderHtml) in display mode, swaps to a TextInput with B/I/highlight
  toolbar in edit mode, and overlays a transparent Skia canvas in Ink lens.
  **Strokes are stored on `point.strokes[]` so they follow the bullet on
  reorder/delete** (no orphaned ink).
- `src/components/hardnotes/InkToolbar.tsx` — floating Notability-style palette
  (pen / highlighter / eraser · 6 colors · 3 widths · undo).
- `src/components/hardnotes/LensSwitcher.tsx` — segmented control: 🔍 Glance · 📖 Focus · ✏️ Ink.
- `app/hardnotes/editor.tsx` — orchestrator page.
- `app/hardnotes/_layout.tsx` — Expo Router stack layout.

#### Edited files
- `src/components/hardnotes/QuizCaptureSheet.tsx` — routes to `/hardnotes/editor` on commit.
- `src/components/hardnotes/NotesGrid.tsx` — opens notes in `/hardnotes/editor`.
- `app/(tabs)/hardnotes.tsx` — "New Note" CTA routes to `/hardnotes/editor`.
- `src/components/hardnotes/HardnotesSidebar.tsx` — fixed pre-existing PowerShell
  `` `n `` literal-escape corruption that blocked TS compile.

#### Deliberately untouched (user's safety nets)
- `app/notes/pro-editor.tsx` (legacy Skia canvas editor)
- `app/notes/editor.tsx` (classic rich editor + Knowledge Vault flow)
- The "Add to Notebook" inline popup inside `app/unified/engine.tsx`

## Architecture decisions

1. **Per-bullet stroke anchoring** — strokes live inside the point object
   (`point.strokes[]`) using the point's local coord space. Reordering a bullet
   moves its ink with it, deleting a bullet deletes its annotations, and Glance/
   Focus lenses still render the strokes read-only as visual decoration.
2. **Three lenses share data, swap behaviour** — same `Point[]` rendered three
   ways. No content duplication, instant lens flip.
3. **Inline text-edit + highlight pill** — selection → 4-color highlight pill
   wraps in `<mark style="background:X">…</mark>`; B/I wrap in `<b>`/`<i>`. All
   stored as HTML inside `point.text`; rendered via `react-native-render-html`.
4. **Locked references survive** — old `base_layer` items are surfaced as
   `point.locked = true` with a "LOCKED REFERENCE" chip and a sepia tint. User
   can toggle the lock per-point.

## Validation
- `npx tsc --noEmit` clean across the entire project (excluding the unrelated
  `5.1/` documentation folder, which contains `.tsx`-suffixed prose files).
- *Cannot run automated E2E inside the kubernetes preview* — this is a native
  Expo app. The user must `yarn install && npx expo start` and test on device.

## P1 / Next iteration
- Drag-to-reorder bullets in Glance lens (gesture wired, just needs hook-up to
  `doc.reorderPoints`).
- Lasso + move + scissor inside Ink lens (existing primitives in `SkiaCanvas`
  can be ported into the per-bullet flow).
- Per-item "Tag with review tag" picker (catalog already merged via
  `useNoteTagCatalog`).
- PDF export rendering Skia overlays alongside bullets (currently exports text
  only via `UnifiedExportSheet`).
- Add a "Migrate this note → Hardnote" action in `app/notes/editor.tsx` so the
  user can move a classic note into the new lens system without losing data.
