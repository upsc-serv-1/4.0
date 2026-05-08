# Pilot V2 Tab — Implementation Progress

**Branch:** `pilot-pro-v2.1` (continuation of `Pilot-Pro-1.0`/`pilot-v2-pro`)
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

## Step Checklist (canonical)

| Step | Title / Description | Status | Commit |
|------|---------------------|:------:|--------|
| 1  | Bootstrap Pilot V2 — types, context, repository skeleton, folder structure | ✅ | (initial) |
| 2  | Register `pilot-v2` in TabConfigService + tabs layout | ✅ | (initial) |
| 3  | Pilot V2 entry route + view-mode router (`/pilot-v2`) | ✅ | (initial) |
| 4  | Sidebar — Home mode (subjects list + quick actions) | ✅ | (initial) |
| 5  | Sidebar — Subject mode (dynamic topic/subtopic tree, expand/collapse) | ✅ | (initial) |
| 6  | Dashboard — greeting, breadcrumb, search, Continue Studying carousel, Pinned grid | ✅ | (initial) |
| 7  | NoteList — sticky header, search, new note CTA, pinned & per-note rows | ✅ | b63ea03 |
| 8  | GlanceView — block renderer with highlights, sticky header, infinite scroll | ✅ | e958c15 |
| 8b | GlanceView — wire Bell/Share/Upload/More header buttons | ✅ | 2023dcd |
| 9  | EditorView — block-based editor, full toolbar (H1/H2/B/I/U/lists/highlight/link/image), outline, autosave | ✅ | e958c15 |
| 10 | Pilot V2 Repository — Supabase CRUD on `user_notes` + `user_note_nodes` (surface = `pilot_v2`) | ✅ | (skeleton + Step 12) |
| 11 | Quiz Engine integration — new "Save to Pilot V2" button on the shared question card (popup like flashcards, auto-or-manual save) | ✅ | Step 23 |
| 12 | Auto-hierarchy `findOrCreatePilotV2Note` for Pilot V2 (no duplicate notebooks; same subject/topic/subtopic/microtopic appends to same note) | ✅ | (in pilotV2Repo.ts) |
| 13 | Final polish — full button audit + handoff docs | ✅ | Step 25 |
| 14 | Bootstrap Pilot V2 dev env on Emergent (add `@expo/ngrok` devDep for tunnel preview) | ✅ | a320f59 |
| 15 | Editor — wire Bold / Italic / Underline as block-level inline marks | ✅ | 7a4d290 |
| 16 | Editor — wire Undo / Redo with 100-step history stack | ✅ | 01a14a2 |
| 17 | Editor — wire Link / Image / Calendar / Paperclip / Table / Code (modals, pickers, render in Editor + Glance) | ✅ | f16c61f |
| 18 | Editor — wire bottom-bar font scale (Aa) + zoom controls | ✅ | 6d2ec2d |
| 19 | Sidebar — wire Pinned/Recent/Shared/Trash quick filters, New Subject hint, Settings sheet (sign-out) | ✅ | 374477e |
| 20 | Dashboard — wire + New, See All (Recent/Pinned), search input + quick-filter badge | ✅ | 8862bd7 |
| 21 | Sync progress markdown with actual completed steps | ✅ | this commit |
| 22 | Quiz Engine integration — add `pilot-v2` destination chip to AddToNotebookSheet | ✅ | Step 22 |
| 23 | Quiz Engine integration — wire `pilot-v2` save flow in `engine.tsx` and `ai-search.tsx` (`appendBlocksToPilotV2Note` via auto-hierarchy) | ✅ | Step 23 |
| 24 | Sidebar — wire "New Subject" CTA to actually create a subject node | ✅ | Step 24 |
| 25 | Final polish + handoff documentation (this checklist closure) | ✅ | Step 25 |

---

## Step 11/14 — Quiz → Pilot V2 UX (the "flashcard-like popup")

The user's bigger requirement (originally numbered Step 14 in the open list)
is now satisfied by the Quiz integration:

1. From the quiz engine / ai-search question card the user taps **Save to
   Pilot V2** (new chip in the destination sheet alongside Capsule / Notes /
   Flashcards).
2. A popup mirroring the flashcard popup appears with the question's
   `subject → section_group (topic) → micro_topic (subtopic) → notebook title`
   pre-filled. The user can:
   * **Auto-save** with one tap (uses `findOrCreatePilotV2Note`).
   * **Manually adjust** any of the four fields before saving.
3. When the same subject/topic/subtopic/microtopic is saved again, the new
   blocks are **appended** to the existing Pilot V2 note (no duplicate
   notebooks). This is delivered by `appendBlocksToPilotV2Note`.
4. The block payload is editable in the popup *before* saving and stays fully
   editable inside the Pilot V2 editor *after* saving.
5. Highlights, lists, code, links, images and tables created inside the
   Pilot V2 editor are rendered with the same colours/typography in the
   GlanceView (the block renderer is shared).

---

## Where the team should resume if credits expire

1. Read this file top-to-bottom — every commit on the `pilot-pro-v2.1`
   branch is prefixed `Step N:` so progress is visible from `git log`.
2. The exact UI/UX source-of-truth is the seven-screen spec in
   `Pilots pro app/complete-design-specification.md` (sections 12 & 13).
3. The React Native ports live under `src/components/pilot-v2/` and the
   routes live under `app/pilot-v2/`. Both are isolated from Capsule and
   Notes.
4. Repository functions: `src/repositories/pilotV2Repo.ts`. They reuse the
   existing `user_notes` + `user_note_nodes` tables with
   `metadata.surface = 'pilot_v2'` for full isolation.
5. Quiz engine button: `src/components/capsule/AddToNotebookSheet.tsx` (new
   destination type `pilot-v2`) and the call sites in
   `app/unified/engine.tsx` and `app/ai-search.tsx`.

---

## Open items (parked for follow-up)

- Migration of Capsule data into Pilot V2 (one-time importer).
- Supabase realtime sync (auto-refresh dashboards across devices).
- AI suggestions / summarisation (will reuse the existing Groq + Gemini keys
  already configured in `app/ai-settings.tsx`).
- Cross-device push for note-level reminders (currently insertable but not
  notified outside the app).
