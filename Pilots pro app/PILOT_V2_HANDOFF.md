# Pilot V2 — Handoff & Button Audit (Step 25)

**Branch:** `pilot-pro-v2.1` (continuation of `pilot-v2-pro`)
**Date:** May 2026
**Owner:** Knowledge / Quiz Integration squad

This document closes out the Pilot V2 milestone and lists the audit done on
every interactive surface. It is the canonical place a future agent / engineer
should look at first when continuing the work.

---

## 1. Architecture overview

| Layer | File(s) | Purpose |
|-------|---------|---------|
| Types | `src/components/pilot-v2/types.ts` | All Pilot V2 model + view-state types |
| Context | `src/context/PilotV2Context.tsx` | useReducer-based state machine for the seven Pilot V2 screens |
| Repository | `src/repositories/pilotV2Repo.ts` | Supabase CRUD on `user_notes` + `user_note_nodes` (surface = `pilot_v2`) including the auto-hierarchy `findOrCreatePilotV2Note` and `appendBlocksToPilotV2Note` |
| Sidebar (Home) | `src/components/pilot-v2/PilotV2Sidebar.tsx` | Quick filters, subjects list, Settings, **New Subject** modal (Step 24) |
| Sidebar (Subject) | `src/components/pilot-v2/PilotV2SidebarSubject.tsx` | Topic/subtopic tree |
| Dashboard | `src/components/pilot-v2/PilotV2Dashboard.tsx` | Greeting, Continue Studying, Pinned, **+ New / See All** buttons (Step 20) |
| Note List | `src/components/pilot-v2/PilotV2NoteList.tsx` | Search, **+ New Note**, **3-dot menu** (Pin / Rename modal / Delete — Step 7b + Step 25 button audit) |
| Glance | `src/components/pilot-v2/PilotV2GlanceView.tsx` | Block renderer + **Bell / Share / Upload / More** header (Step 8b) |
| Editor | `src/components/pilot-v2/PilotV2EditorView.tsx` | Block-based editor, full toolbar, undo/redo, link/image/calendar/paperclip/table/code, font scale + zoom (Steps 9, 15-18) |
| Save sheet | `src/components/pilot-v2/PilotV2SaveSheet.tsx` | Quiz-engine save popup (Step 23) |
| Quiz integration | `src/components/capsule/AddToNotebookSheet.tsx` (Step 22), `app/unified/engine.tsx` + `app/ai-search.tsx` (Step 23) | New `pilot-v2` destination chip + wiring |

---

## 2. Feature map (Pilot V2)

### Authoring
- **Block types** supported: heading (H1/H2/H3), paragraph, bullet, numbered,
  checklist, quote, highlight, code.
- **Inline marks**: bold / italic / underline (block-level due to RN
  `TextInput` constraints).
- **Highlights**: 7-color palette (Yellow / Lime / Green / Pink / Purple / Blue
  / Red); colour selection persists for the editor session.
- **Special blocks**: Link, Image (base64 from gallery), Calendar reminder,
  Attachment (image/file via gallery picker), Table (2×2 / 3×3 / 4×4), Code.
- **Undo / Redo**: 100-step in-memory history, every mutation snapshots
  `{ blocks, title }`.
- **Auto-save**: debounced 600 ms, mirrors Supabase via
  `savePilotV2NoteContent` and `renamePilotV2Note`. The “Saved” pill in the
  top bar toggles to “Saving…” while the request is in flight.
- **Font scale**: 4 presets (85 % / 100 % / 115 % / 130 %).
- **Zoom**: 4 presets (75 % / 100 % / 125 % / 150 %).

### Reading (Glance)
- Full block renderer faithful to the editor (image, table, code, highlight
  chip, link, attachment row, reminder pill, checklist with check state).
- Sticky header buttons: **Bell** (toggle reminder), **Share** (RN Share API
  with web fallback to `navigator.share` / clipboard), **Upload** (copies
  plain-text export to clipboard), **More** (Pin / Open Editor / Copy / Delete).

### Navigation
- Tablet (≥ 768 px): persistent two-column layout (Sidebar + main pane).
- Phone: single-pane stack; the sidebar is replaced by the Dashboard which
  surfaces all entry points (subject grid, quick filters, search, + New).
  *(Dedicated mobile drawer is parked as a follow-up — see § 4.)*

### Quiz integration (Step 11 / 22 / 23)
- Quiz card → **Save to Pilot V2** (new chip alongside Capsule / Notes /
  Flashcards).
- Opens the **PilotV2SaveSheet** with `subject / topic / subtopic / notebook`
  pre-filled from the question metadata. All four are editable.
- The body (explanation / bullets) is editable in a `TextInput` BEFORE save.
- One tap → `findOrCreatePilotV2Note` → `appendBlocksToPilotV2Note`. Same
  hierarchy = same note (no duplicate notebooks).
- After save: **Save another** (clears body, keeps hierarchy) or
  **Open in Pilot V2** (jumps straight to the editor where the same content
  remains fully editable).

### Sidebar
- **Quick filters**: Home / Pinned / Recent / Shared / Trash dispatch
  `SET_QUICK_FILTER` and surface as a badge on the Dashboard header.
- **New Subject**: opens a modal that creates a `subject` node via
  `createPilotV2Node` and immediately switches into that subject's detail
  view. (Step 24)
- **Settings**: shows current sign-in email and exposes Sign-out.

---

## 3. Button audit (every Pilot V2 interactive element)

Legend: ✅ wired & verified · ⚠️ wired but follow-up suggested.

### Sidebar (Home)
| Button | testID | Status | Wires to |
|--------|--------|:------:|----------|
| Home | `pilot-v2-nav-home` | ✅ | `SET_QUICK_FILTER='home'` + `mode='dashboard'` |
| Pinned | `pilot-v2-nav-pinned` | ✅ | quick filter `pinned` |
| Recent | `pilot-v2-nav-recent` | ✅ | quick filter `recent` |
| Shared | `pilot-v2-nav-shared` | ✅ | quick filter `shared` |
| Trash | `pilot-v2-nav-trash` | ✅ | quick filter `trash` |
| Subject row × 7 | `pilot-v2-subject-<id>` | ✅ | switches to subject detail |
| New Subject | `pilot-v2-new-subject` | ✅ | opens modal → `createPilotV2Node('subject')` (Step 24) |
| Settings | `pilot-v2-settings` | ✅ | shows Toggle sidebar / Sign out |

### Sidebar (Subject)
| Button | testID | Status | Wires to |
|--------|--------|:------:|----------|
| Back-to-home | `pilot-v2-sidebar-back-home` | ✅ | `NAVIGATE_HOME` |
| Topic row | `pilot-v2-topic-<id>` | ✅ | toggles expand / sets selectedTopic |
| Subtopic row | `pilot-v2-subtopic-<id>` | ✅ | sets selectedSubtopic + opens noteList |
| Other-subjects switcher | `pilot-v2-other-<id>` | ✅ | switches subject |

### Dashboard
| Button | testID | Status | Wires to |
|--------|--------|:------:|----------|
| Search input | `pilot-v2-dashboard-search` | ✅ | filters Recent / Pinned in real time |
| + New | `pilot-v2-dashboard-new` | ✅ | `findOrCreatePilotV2Note` → editor |
| Continue Studying card | `pilot-v2-dashboard-card-<id>` | ✅ | opens Glance |
| See All Recent | `pilot-v2-dashboard-seeall-recent` | ✅ | quick filter `recent` |
| See All Pinned | `pilot-v2-dashboard-seeall-pinned` | ✅ | quick filter `pinned` |
| Pinned card | `pilot-v2-dashboard-pinned-<id>` | ✅ | opens Glance |
| Filter badge clear | `pilot-v2-clear-filter` | ✅ | quick filter back to `home` |

### Note List
| Button | testID | Status | Wires to |
|--------|--------|:------:|----------|
| Back | `pilot-v2-notelist-back` | ✅ | back to subject sidebar |
| Search | `pilot-v2-notelist-search` | ✅ | local filter |
| + New Note | `pilot-v2-notelist-new` | ✅ | `findOrCreatePilotV2Note` (auto-hierarchy) → editor |
| Note row | `pilot-v2-note-<id>` | ✅ | opens Glance |
| 3-dot menu | `pilot-v2-note-menu-<id>` | ✅ | Pin (node-id mapping fixed in Step 25) / Rename modal / Delete |
| Rename modal | `pilot-v2-rename-modal` | ✅ | persists to both note row & node row |

### Glance View
| Button | testID | Status | Wires to |
|--------|--------|:------:|----------|
| Back | `pilot-v2-glance-back` | ✅ | returns to noteList |
| Bell (reminder) | `pilot-v2-glance-bell` | ✅ | toggles local reminder flag |
| Share | `pilot-v2-glance-share` | ✅ | RN Share API + web fallback |
| Export | `pilot-v2-glance-export` | ✅ | plain-text → clipboard |
| More | `pilot-v2-glance-more` | ✅ | Pin / Open / Copy / Delete |
| Open in Editor | `pilot-v2-glance-open-editor` | ✅ | enters editor mode |

### Editor
| Button | testID | Status | Notes |
|--------|--------|:------:|-------|
| Undo | `pilot-v2-tool-undo` | ✅ | 100-step stack |
| Redo | `pilot-v2-tool-redo` | ✅ | restores from redo stack |
| Close | `pilot-v2-editor-close` | ✅ | back to Glance |
| Title input | `pilot-v2-editor-title` | ✅ | renames `user_notes.title` |
| H1 / H2 | toolbar text buttons | ✅ | `setActiveBlockType('heading', n)` |
| Bold / Italic / Underline | `pilot-v2-tool-bold/italic/underline` | ✅ | per-block boolean marks |
| OL / UL / Checklist | `pilot-v2-tool-ol/ul/checklist` | ✅ | block-type swap |
| Highlight palette | `pilot-v2-tool-highlight` + 7 swatches | ✅ | `applyHighlight` |
| Block highlight | `pilot-v2-tool-block-highlight` | ✅ | converts to highlight block |
| Link | `pilot-v2-tool-link` | ✅ | modal → text + URL |
| Image | `pilot-v2-tool-image` | ✅ | gallery picker, base64 inline |
| Calendar | `pilot-v2-tool-reminder` | ✅ | preset offsets |
| Paperclip | `pilot-v2-tool-attachment` | ✅ | gallery picker, attachment block |
| Table | `pilot-v2-tool-table` | ✅ | 2×2 / 3×3 / 4×4 |
| Code | `pilot-v2-tool-code` | ✅ | code block |
| Add block | `pilot-v2-editor-add-block` | ✅ | append paragraph |
| Outline panel rows | (tablet) | ✅ | `setActiveBlockId` |
| Aa font scale | `pilot-v2-bottom-fontscale` | ✅ | 4 presets |
| Zoom | `pilot-v2-bottom-zoom` | ✅ | 4 presets |

### Quiz Save Sheet (Step 23)
| Button | testID | Status |
|--------|--------|:------:|
| Subject / Topic / Subtopic / Notebook fields | `pilot-v2-save-{subject\|topic\|subtopic\|notebook}` | ✅ |
| Body editor | `pilot-v2-save-body` | ✅ |
| Save to Pilot V2 | `pilot-v2-save-confirm` | ✅ (calls `findOrCreatePilotV2Note` + `appendBlocksToPilotV2Note`) |
| Save another | `pilot-v2-save-another` | ✅ |
| Open in Pilot V2 | `pilot-v2-save-open` | ✅ |
| Close | `pilot-v2-save-close` | ✅ |

### AddToNotebookSheet (Step 22)
| Chip | testID | Status |
|------|--------|:------:|
| Capsule | `add-to-notebook-pick-capsule` | ✅ |
| **Pilot V2 (new)** | `add-to-notebook-pick-pilot-v2` | ✅ |
| Notes | `add-to-notebook-pick-notes` | ✅ |
| Flashcards | `add-to-notebook-pick-flashcard` | ✅ |

---

## 4. Parked / follow-up items

| # | Item | Why parked |
|---|------|------------|
| F1 | Mobile sidebar drawer (current sidebar only renders on tablets ≥ 768 px) | Phones rely on Dashboard for navigation; a hamburger drawer is nice-to-have, not blocking |
| F2 | Capsule → Pilot V2 one-time importer | Out of scope for v2.1 milestone |
| F3 | Reminder push notifications | Reminder blocks are insertable but not surfaced outside the app |
| F4 | Multi-version Vitamin export | Already tracked under AI Enhancement |
| F5 | Realtime Supabase sync (cross-device) | Currently relies on `fetchPilotV2NotesForUser` on screen focus |
| F6 | Inline marks at character range (vs. whole-block) | RN `TextInput` limitation; needs custom rich-text view |

---

## 5. How the Quiz → Pilot V2 save satisfies the original Step 14 brief

The brief was:

> *Pushing explanation from quiz engine gives popup like flashcard for auto
>  save or manually save and multiple new point from same subject, topic and
>  subtopic and micro topic come and get saved to same notes, and are fully
>  editable at quiz engine before saving and inside pilot pro after saving.
>  Highlighter and all other tools used inside pilot pro are reflected same to
>  as in glance view, outside editor.*

Mapping:
1. **Popup like flashcard** → `PilotV2SaveSheet` mirrors the flashcard sheet
   visual language and lives next to it in `AddToNotebookSheet`.
2. **Auto save or manual** → "Save to Pilot V2" button auto-creates the
   hierarchy; the four fields can be edited manually before save.
3. **Same subject/topic/subtopic/microtopic → same note** →
   `findOrCreatePilotV2Note` matches existing nodes by title under the same
   parent and reuses the linked note, so repeated saves append
   (`appendBlocksToPilotV2Note`).
4. **Editable at quiz engine before saving** → `body` field in the sheet.
5. **Editable inside Pilot Pro after saving** → "Open in Pilot V2" jumps to
   the editor; auto-save persists every keystroke.
6. **Highlights and tools reflected in Glance view** → `BlockRenderer` in
   `PilotV2GlanceView.tsx` reads the same `PilotV2Block[]` produced by the
   editor (highlight colour, image, table, link, attachment, code).

---

## 6. Smoke-test checklist

Before declaring a build green:

- [ ] Sign in, open `/pilot-v2` — Dashboard loads with greeting & quick
      filters.
- [ ] Tap **+ New** on Dashboard → editor opens with empty blocks.
- [ ] Author content (H1, bullet, highlight, image) → close → open Glance →
      highlight colour and image render identically.
- [ ] Reopen note → "Saved" pill flips to "Saving…" then back to "Saved" on
      keystrokes (auto-save loop).
- [ ] Sidebar → **New Subject** → enter name → modal closes, subject detail
      view opens.
- [ ] Run a quiz, attempt a question, tap Save to Notebook → choose
      **Pilot V2** → confirm hierarchy chips → Save → success badge appears.
- [ ] Repeat the save with the same subject/topic/subtopic/notebook → the
      success badge mentions the existing note, not a new one.
- [ ] Open Pilot V2 → the new content is appended below a `📌 Saved from
      Quiz / …` heading and is editable.

---

## 7. Where to look first if it breaks

| Symptom | Likely cause | Fix path |
|---------|--------------|----------|
| Save to Pilot V2 silently fails | Supabase RLS / missing `metadata.surface` filter | Check `pilotV2Repo` `findOrCreatePilotV2Note` & RLS policies on `user_note_nodes` |
| New Subject button does nothing | User signed-out or `createPilotV2Node` returns null | Open dev console; the alert "Sign in required" / "Could not create" surfaces the error |
| Highlights look different in Glance | Palette mismatch | Both screens import from `PILOT_V2_HIGHLIGHT_PALETTE` in `types.ts` — confirm import path |
| Editor cannot insert image | Permissions denied | iOS info.plist `NSPhotoLibraryUsageDescription` / Android `READ_MEDIA_IMAGES` runtime perm |

— end of handoff —
