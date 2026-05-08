# Pilot V2 Tab — Implementation Progress

**Branch:** `Pilot-Pro-1.0` (was requested as "Pilot Pro 1.0" — git does not allow spaces; using hyphenated form)
**Source design:** `Pilots pro app/Knowledge management app (pilot pro app files)`
**Bible / reference docs:**
- `Pilots pro app/complete-design-specification.md`
- `Pilots pro app/PILOT_INTEGRATION_GUIDE.md`
- `Pilots pro app/QUICK_START_IMPLEMENTATION.md`
- `Pilots pro app/INTEGRATION_SUMMARY.md`

---

## Why a NEW tab (Pilot V2) instead of editing Capsule?

From the bible files: Capsule has integration & ingestion problems (fragmented blocks, non-functional toolbar, plain glance, duplicate notebooks). A clean parallel "Pilot V2" tab is being introduced so:
- Existing Capsule data and flows stay intact (no breaking changes).
- The Knowledge Management app design (Samsung Notes-style) ships unmodified.
- Quiz Engine gets a NEW "Save to Pilot V2" button alongside existing destinations.
- Migration path from Capsule → Pilot V2 stays open for later.

---

## Approach (Option B: Deep Dive)

Drop-in port of every screen from the KM Vite/React app to React Native (Expo)
**without deviating from the Figma UI/UX**. Tailwind classes map 1-to-1 to
StyleSheet rules; the design tokens from `theme.css` become the colors object.

---

## Step Checklist

| Step | Title | Status | Commit |
|------|-------|--------|--------|
| 1 | Bootstrap Pilot V2 — types, context, repository skeleton, folder structure | ✅ | TBD |
| 2 | Register `pilot-v2` in TabConfigService + tabs layout | ✅ | TBD |
| 3 | Pilot V2 entry route + view-mode router (`/pilot-v2`) | ✅ | TBD |
| 4 | Sidebar — Home mode (subjects list + quick actions) | ✅ | TBD |
| 5 | Sidebar — Subject mode (dynamic topic/subtopic tree, expand/collapse) | ✅ | TBD |
| 6 | Dashboard — greeting, breadcrumb, search, Continue Studying carousel, Pinned grid | ✅ | TBD |
| 7  | NoteList screen — search + new note + pinned + per-note row + 3-dot menu (Pin/Rename/Delete) | ✅ | TBD |
| 8  | GlanceView — block renderer + Bell/Share/Upload/More wired (reminder, share, copy export, action menu) | ✅ | TBD |
| 9  | EditorView — block-based editor, full toolbar (H1/H2/B/I/U/lists/highlight/link/image/undo/redo) | ⏳ | |
| 10 | Pilot V2 Repository — Supabase CRUD on `user_notes` + `user_note_nodes` (surface = `pilot_v2`) | ⏳ | |
| 11 | Quiz Engine integration — new "Save to Pilot V2" button on the shared question card | ⏳ | |
| 12 | Auto-hierarchy `findOrCreateNotebook` for Pilot V2 (no duplicate notebooks) | ⏳ | |
| 13 | Final polish — full button audit + handoff docs (this file + checklist closure) | ⏳ | |
| 14 | Pushing explanation from quiz engine gives popup like flashcard for auto save or manually save and multiple new point from same subject,topic and subtopic and micro topc come and get saved to same notes, and are fully editable at quiz enbgine bedore saving and inside pilot pro after saving. highligher anda ll oter tools used inside pilot pro are refelcted same to as in glance view , outside editor. Ensure all logical and common sense butons, gestures are wred up and are oresent. 


### Detailed Implementation Steps

| Step | Title / Description | Status | Details |
| :--- | :--- | :---: | :--- |
| **1** | Bootstrap Pilot V2 — types, context, repository skeleton, folder structure | ✅ | Core models, context, and directory skeleton |
| **2** | Register `pilot-v2` in TabConfigService + tabs layout | ✅ | Application tab layout configuration |
| **3** | Pilot V2 entry route + view-mode router (`/pilot-v2`) | ✅ | Base navigation and entry point |
| **4** | Sidebar — Home mode (subjects list + quick actions) | ✅ | Home side panel lists and actions |
| **5** | Sidebar — Subject mode (dynamic topic/subtopic tree, expand/collapse) | ✅ | Interactive folders & document tree hierarchy |
| **6** | Dashboard — greeting, breadcrumb, search, Continue Studying carousel, Pinned grid | ✅ | Main high-fidelity dashboard views |
| **7** | NoteList — sticky header, search, new note CTA, pinned & per-note rows | ✅ | Complete NoteList shell and layout |
| **7b** | NoteList — wire New Note creation + 3-dot menu (Pin/Rename/Delete) | ✅ | Fully operational notes list management |
| **8** | GlanceView — block renderer with highlights, sticky header, infinite scroll | ✅ | Dynamic reading mode for highlights & content |
| **8b** | GlanceView — wire Bell/Share/Upload/More header buttons | ✅ | Reminder, share, copy/export, action menu |
| **9** | EditorView — block-based editor, full toolbar (H1/H2/B/I/U/lists/highlight/link/image), outline, autosave | ⏳ | Block-based editor foundation |
| **14** | Bootstrap Pilot V2 dev env on Emergent (add `@expo/ngrok` devDep for tunnel preview) | ✅ | Tunnel-preview capabilities |
| **15** | Editor — wire Bold / Italic / Underline as block-level inline marks | ⏳ | Inline formatting implementation |
| **16** | Editor — wire Undo / Redo with 100-step history stack | ⏳ | Undo-redo history management |
| **17** | Editor — wire Link / Image / Calendar / Paperclip / Table / Code | ⏳ | Complete multi-block integrations |
| **18** | Editor — wire bottom-bar font scale (Aa) + zoom controls | ⏳ | Typography adjustments and scaling |
| **19** | Sidebar — wire Pinned/Recent/Shared/Trash quick filters, New Subject hint, Settings sheet (sign-out) | ⏳ | Dynamic navigation filtering |
| **20** | Dashboard — wire + New, See All (Recent/Pinned), search input + quick-filter badge | ⏳ | Live dashboard interactions & widgets |
| **21** | Sync progress markdown with actual completed steps | 🔄 | Keeping progress documentation in perfect sync |
| **22** | Quiz Engine integration — add `pilot-v2` destination chip to AddToNotebookSheet | ⏳ | Auto-hierarchy picker in quiz card |
| **23** | Quiz Engine integration — wire `pilot-v2` save flow in `engine.tsx` and `ai-search.tsx` | ⏳ | `appendBlocksToPilotV2Note` via auto-hierarchy |
| **24** | Sidebar — wire "New Subject" CTA to actually create a subject node | ⏳ | Subject creation dialog & API |
| **25** | Final polish + handoff documentation (this checklist closure) | ⏳ | Hand-off reviews and validations |

---

## Where the team should resume if credits expire

1. Read this file top-to-bottom — every commit on the `Pilot-Pro-1.0` branch is
   prefixed `Step N:` so progress is visible from `git log`.
2. The exact UI/UX source-of-truth is the seven-screen spec in
   `Pilots pro app/complete-design-specification.md` (sections 12 & 13).
3. The React Native ports live under `src/components/pilot-v2/` and the routes
   live under `app/pilot-v2/`. Both are isolated from Capsule and Notes.
4. Repository functions: `src/repositories/pilotV2Repo.ts`. They reuse the
   existing `user_notes` + `user_note_nodes` tables with
   `metadata.surface = 'pilot_v2'` for full isolation.
5. Quiz engine button: `src/components/capsule/AddToNotebookSheet.tsx` (new
   destination type) and the call sites in `app/unified/engine.tsx` and
   `app/ai-search.tsx`.

---

## Open items (parked for follow-up)

- Migration of Capsule data into Pilot V2 (one-time importer).
- Supabase realtime sync (auto-refresh dashboards across devices).
- AI suggestions / summarisation (will reuse the existing Groq + Gemini keys
  already configured in `app/ai-settings.tsx`).
