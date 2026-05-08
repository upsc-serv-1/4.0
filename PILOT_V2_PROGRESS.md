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
| 3 | Pilot V2 entry route + view-mode router (`/pilot-v2`) | ⏳ | |
| 4 | Sidebar — Home mode (subjects list + quick actions) | ⏳ | |
| 5 | Sidebar — Subject mode (dynamic topic/subtopic tree, expand/collapse) | ⏳ | |
| 6 | Dashboard — greeting, breadcrumb, search, Continue Studying carousel, Pinned grid | ⏳ | |
| 7 | NoteList screen — search + new note + pinned + per-note row | ⏳ | |
| 8 | GlanceView — block renderer with highlights, tags, sticky header, infinite scroll | ⏳ | |
| 9 | EditorView — block-based editor, full toolbar (H1/H2/B/I/U/lists/highlight/link/image), outline panel | ⏳ | |
| 10 | Pilot V2 Repository — Supabase CRUD on `user_notes` + `user_note_nodes` (surface = `pilot_v2`) | ⏳ | |
| 11 | Quiz Engine integration — new "Save to Pilot V2" button on the shared question card | ⏳ | |
| 12 | Auto-hierarchy `findOrCreateNotebook` for Pilot V2 (no duplicate notebooks) | ⏳ | |
| 13 | Final polish + handoff docs (this file + checklist closure) | ⏳ | |

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
