# PRD — Knowledge Vault (Notes Tab Transformation)

## Original problem statement
Repo: `upsc-serv-1/4.0` (branch `5.0`). Expo / React Native / Supabase study app for UPSC.

User wanted the **Notes tab** transformed into a "Knowledge Vault & Dual-Mode Note System" with:
1. Subject Hub home (icon grid, no auto-seed)
2. Aichii hierarchy tree (Folder → Notebook → Note with vertical lines)
3. Glance Mode — inline-unfold a note's items (highlights, headings, checklist)
4. Semantic chip filter (use existing review-tag system: defaults + `user_settings.custom_tags`)
5. Focus Mode — immersive parchment/serif reader (existing Zen mode, deep-linked)
6. Unified export engine for notes (with notes-specific injections)

User explicit constraints:
- Don't auto-fetch / auto-seed subjects
- Use the existing review-tag catalog (Tags-tab parity)
- Use the existing UnifiedExportSheet
- No changes to Tags / Flashcards / Notes-Pro Skia editor

## Architecture
- **Tech**: Expo Router, React Native 0.81, Supabase JS, Zustand (`useTagStore`), TS 5.3.
- **DB**: Supabase tables `user_note_nodes` (tree) + `user_notes` (content). No migration needed — `items` JSONB silently extended with optional `tags: string[]` per item (forward-compatible).
- **Tag catalog**: `useNoteTagCatalog` merges built-in defaults (Imp. Fact / Imp. Concept / Trap Question / Must Revise / Memorize) + `user_settings.custom_tags` + AsyncStorage cache + items-discovered tags. Subscribes to `useTagStore.version` for cross-screen sync.

## Files
**New**
- `src/hooks/useNoteTagCatalog.ts`
- `src/components/notes/SubjectHubGrid.tsx`
- `src/components/notes/SemanticChipRow.tsx`
- `src/components/notes/GlancePanel.tsx`

**Edited**
- `src/components/notes/NoteRow.tsx` — added Play (Focus mode), Export, and Glance toggle
- `app/notes/index.tsx` — full rewrite around Knowledge Vault flow
- `app/notes/editor.tsx` — added `?focus=1` deep-link → auto-enables Zen + parchment-serif preview

## What's implemented (Jan 2026)
- ✅ Subject Hub grid (2-col card layout, auto-mapped subject icons, palette-stable colors, child counters, inline action dots)
- ✅ Hub list/grid view toggle
- ✅ Aichii tree inside folders (existing vertical-line tree retained)
- ✅ Per-note Glance unfold with checklist toggle persisting to Supabase
- ✅ Semantic chip row (live-synced with Tags-tab catalog)
- ✅ "Stream-mode": selecting a chip auto-opens glance for every note in the subtree, fallback heuristic maps `microTopicHeading→Imp.Concept` and `highlight→Imp.Fact` when items aren't yet explicitly tagged
- ✅ Focus mode deep-link via `/notes/editor?focus=1` (oversized title, sepia parchment, serif preview)
- ✅ Per-row swipe actions: Read, Add, Export, Rename, Move, Duplicate, Delete
- ✅ UnifiedExportSheet integration (`kind: 'notes'`) with notes-specific defaults: sepia theme + lined paper + serif font + TOC on
- ✅ Unfiled root-level notes/notebooks shown under "UNFILED" section
- ✅ Empty states for both root and inside-folder views

## P1 / next iteration
- Per-item Tag picker inside the editor (button to attach review tags to a single highlight, persisting `tags` field to `items` JSONB)
- Bulk-tag actions in Glance Mode
- Drag-to-reorder items inside a notebook
- "Last revised" badge on Subject Hub cards (sourced from `user_notes.updated_at`)
- Quiz-engine "Save to notebook" picker that creates folders/notebooks inline (user said they'll wire this themselves; component is ready to receive it)

## Known limitations
- The pre-existing files `src/components/hardnotes/HardnotesSidebar.tsx` and `src/components/hardnotes/QuizCaptureSheet.tsx` carry user-staged local edits with TS syntax errors (visible from `git status` at task start) — untouched by this iteration.
- Cannot run an automated headless E2E for this stack inside the kubernetes preview (Expo bundler not provisioned). Manual testing required on device.
