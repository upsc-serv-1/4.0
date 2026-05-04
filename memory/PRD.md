# Dr. UPSC — Product Requirements Document

## Source
- Base repo: `https://github.com/upsc-serv-1/4.0/tree/4.6` (public)
- Stack: Expo Router (React Native 0.81, React 19), Supabase, Zustand, NativeWind, @shopify/react-native-skia, Reanimated + Gesture Handler.
- Backend: hosted Supabase (URL/anon key hardcoded in `src/lib/supabase.ts`).

## Core User Persona
- UPSC aspirants preparing on iPad using Apple Pencil; need a closed-loop study ecosystem (quiz → review → annotate → synthesize).

## Uniform Terminology (enforced across Hardnotes UI)
- **Folder** — container in `user_note_nodes` (`type='folder'`), nestable via `parent_id`.
- **Note** — leaf document; tree row in `user_note_nodes` (`type='note'` or legacy `'notebook'`) with `note_id` → `user_notes` row.
- **Points** — heterogenous items inside a note, stored in `user_notes.items` (JSONB). Types:
  - `text` / `checklist` — existing point types
  - `stroke` — Skia vector path (pen/highlighter/eraser) — Phase 2 output
  - `base_layer` — locked content pushed from the quiz engine — Phase 3 output

## What's Been Implemented (this session)
### Phase 1 — Hardnotes Hub  `app/(tabs)/hardnotes.tsx`
- New tab "Hardnotes" registered in `TabConfigService.ts`, tab-bar (`app/(tabs)/_layout.tsx`), and `app/customize_tabs.tsx`.
- Dual-pane layout (sidebar tree + grid) that adapts to mobile via a drawer modal (`< 760px`).
- Collapsible folder tree in `HardnotesSidebar.tsx`; "All Notes" root, inline "New Folder" creation, client-side filter.
- `NotesGrid.tsx` 3-column FlatList with folder cards + notebook-style note thumbnails (points count, pin badge, updated-at).
- Breadcrumb navigation, global in-folder search, `+ New` note quick-create modal.
- `HardnotesService.ts` encapsulates every `user_note_nodes` / `user_notes` CRUD; idempotent UPSC syllabus seed (History, Polity, Geography, Economy, Environment, **General Science → Physics / Chemistry / Biology / Miscellaneous**, International Relations, Anthropology, Current Affairs, Essays).
- Home tab recent notes now include legacy `type='notebook'` rows so nothing is orphaned.

### Phase 2 — Pro-Note Skia Canvas  `app/notes/pro-editor.tsx`
- `@shopify/react-native-skia` added to `package.json`.
- `SkiaCanvas.tsx` — vector canvas with paper background, ruled lines, committed strokes, live in-progress stroke, eraser hit-test.
- Apple-Pencil friendly: `PanResponder` samples `nativeEvent.force` (pressure) and `altitudeAngle` (tilt); stroke width adapts to pressure `width * (0.5 + 0.5 * p)`.
- Tools: **Pen**, **Highlighter** (uses Skia `blendMode="multiply"` so text beneath stays crisp), **Eraser** (per-stroke removal by proximity), **Lasso** (UI wired — drag-select logic deferred).
- `ToolPalette.tsx` — floating toolbar built with Reanimated v4 + Gesture Handler; draggable anywhere on screen, 6 pen + 4 highlighter colors, width slider, undo/redo.
- `strokes.ts` — `Stroke` + `StrokePoint` types and a smoothed SVG path builder.
- Persistence: 800ms-debounced upsert to `user_notes.items` — each stroke stored as `{ type: 'stroke', ... }` JSON. No raster images.
- Save-state pill in header (`Saving…`, `Saved`, `Synced`, `Error`).

### Phase 3 — Smart-Capture Bridge (Quiz → Hardnotes)
- `QuizToHardnotesPicker.tsx` — iOS-style bottom-sheet folder picker.
- `app/unified/engine.tsx` extended with a new **Hardnotes** action in the explanation action row (alongside existing "Notebook" button).
- Flow: tap Hardnotes → pick destination folder → names a new note → creates `user_notes` row with `items: [{ type: 'base_layer', markdown, locked: true, ... }]` → routes to `app/notes/pro-editor.tsx` via `router.push` with `noteId` + `baseLayer` params.
- Pro-editor renders the quiz explanation as a yellow locked banner at the top of the paper and the user can draw over/under it — auto-save merges everything back into the same `user_notes` row.

### Bug Fix
- Repaired a pre-existing syntax error in `app/unified/engine.tsx:1729-1737` (template string was mistakenly delimited by single-quotes with literal newlines, breaking Metro bundling). The app web build now succeeds.

## How to Run (user's local machine)
```bash
yarn install              # one-time
npx expo prebuild         # regenerate iOS/Android native projects (Skia is a native module)
npx expo run:ios          # open on iPad/iPad Simulator
# OR
npx expo start --web      # quick browser preview (Skia works; Apple-Pencil hw data won't be present)
```

## Files Added / Modified
### Added
- `app/(tabs)/hardnotes.tsx`
- `app/notes/pro-editor.tsx`
- `src/services/HardnotesService.ts`
- `src/components/hardnotes/HardnotesSidebar.tsx`
- `src/components/hardnotes/NotesGrid.tsx`
- `src/components/hardnotes/SkiaCanvas.tsx`
- `src/components/hardnotes/ToolPalette.tsx`
- `src/components/hardnotes/QuizToHardnotesPicker.tsx`
- `src/components/hardnotes/strokes.ts`

### Modified
- `app/(tabs)/_layout.tsx` (Hardnotes tab registration + icon + navigate handling)
- `app/(tabs)/index.tsx` (recent notes include legacy notebook rows)
- `app/notes/_layout.tsx` (route for `pro-editor`)
- `app/unified/engine.tsx` (Hardnotes action button + picker wiring + template-string bug fix)
- `app/customize_tabs.tsx` (expose Hardnotes in tab-customize screen)
- `src/services/TabConfigService.ts` (`TabKey` + default order include hardnotes)
- `package.json` (add `@shopify/react-native-skia`)

## Prioritized Backlog

### P0 — Polish / Quality
- [ ] Lasso tool — implement selection-rect + move/delete.
- [ ] Pan + pinch-zoom on the canvas paper (currently only ScrollView pinch).
- [ ] Graceful offline queue for note saves (repo already has `SyncQueue`; wire it into `HardnotesService.saveNoteContent`).

### P1 — UX
- [ ] Drag-and-drop folder/note reordering in the sidebar (repo already uses `react-native-draggable-flatlist`).
- [ ] Long-press note card → context menu (Pin / Rename / Move / Archive) — partially plumbed via `HardnotesService.togglePin / archive / rename`.
- [ ] Multi-page canvas (`pageIndex` on strokes) — currently one tall scroll canvas.
- [ ] Import existing `notes` tab content into the Hardnotes hub automatically with folder mapping (`subject → folder`).

### P2 — Depth
- [ ] Search inside note contents (full-text across `items` JSONB).
- [ ] OCR / snapshot a region and attach as base layer.
- [ ] Lasso-based clipboard between notes.

## Next Action Items
1. User runs `yarn install && npx expo prebuild && npx expo run:ios` on Mac to test on iPad.
2. User evaluates the drawing physics / toolbar ergonomics; report preferences for P0 polish.
3. Populate a real UPSC-syllabus migration path to map existing `notes`-tab folders into the Hardnotes tree if desired.
