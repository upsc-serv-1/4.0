# Pilot V2 — PRD (Product Requirements Document)

**Version:** 2.1
**Branch:** `pilot-pro-v2.1`
**Last updated:** May 2026

---

## 1. Mission

Replace Capsule's broken note-taking UX with a **Samsung Notes-style** Knowledge
Vault tab — fully integrated with the Quiz Engine so explanations save into a
single, hierarchical, editable note tree.

## 2. Personas

* **UPSC aspirant** — does 50–100 quiz questions a day; needs durable,
  searchable notes from explanations.
* **Power student** — wants block editing, highlights, attachments, and
  cross-links between subject → topic → microtopic.

## 3. Surfaces shipped (this milestone)

| # | Surface | What it does |
|---|---------|--------------|
| 1 | `/pilot-v2` Dashboard | Greeting, search, Continue Studying, Pinned, quick-filter chip |
| 2 | Sidebar (Home) | Subjects palette, quick filters, **New Subject** modal, Settings |
| 3 | Sidebar (Subject) | Topic + subtopic tree |
| 4 | Note List | Search, **+ New Note**, Pin / Rename modal / Delete via 3-dot |
| 5 | Glance View | Read-mode block renderer, Bell / Share / Upload / More |
| 6 | Editor | Block editor with H1/H2, B/I/U, lists, highlight palette, link, image, calendar, paperclip, table, code, font scale, zoom, undo/redo (100 steps), debounced auto-save |
| 7 | **Quiz → Pilot V2 popup** | New chip in `AddToNotebookSheet`, flashcard-style sheet, auto-hierarchy via `findOrCreatePilotV2Note`, editable body, Save another / Open in Pilot V2 |

## 4. Non-functional requirements

* All buttons interactive (button audit in `Pilots pro app/PILOT_V2_HANDOFF.md`).
* Same hierarchy = same note (no duplicate notebooks).
* Body of explanation is editable BEFORE save in the popup AND AFTER save in
  the editor.
* Highlights / images / tables / code authored in the editor render
  identically in Glance.

## 5. Open follow-ups (parked)

* Mobile sidebar drawer.
* Capsule → Pilot V2 importer.
* Reminder push notifications.
* Realtime cross-device sync.
* Inline (character-range) marks vs block-level marks.

## 6. Reference docs

* `Pilots pro app/PILOT_V2_PROGRESS.md` — step-by-step status table.
* `Pilots pro app/PILOT_V2_HANDOFF.md` — architecture, button audit, smoke
  tests, troubleshooting playbook.
* `Pilots pro app/complete-design-specification.md` — Figma source-of-truth.
