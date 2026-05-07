# CAPSULE TAB — IMPLEMENTATION PROGRESS

> **Repo:** `upsc-serv-1/4.0`
> **Source branch:** `hardnotes-renovation`
> **Working branch:** `capsule-tab`
> **Bible file:** `New Capsule Tab  (An advance version of notes tab)/COMPLETE_BLUEPRINT_FOR_AI_for_Notes_Tab.md`
> **Screenshots:** Same folder, `Screenshot 2026-05-08 *.png` (UI/UX truth)

---

## OBJECTIVE

Build a brand-new **"Capsule"** tab inside Buffer UPSC that becomes a continuously evolving UPSC knowledge ingestion + revision system.

* New hierarchy: **Subject → Topic → Subtopic → Notebook**
* Editor stores **structured appendable blocks** (not giant docs)
* Continuous ingestion from quiz engine via **Add to Notebook** popup (Manual + Auto modes)
* Reuse **Premium Move Module** for hierarchy navigation
* Persistent highlights + infinite glance reading workspace
* iPad-first UX exactly matching screenshots

The Capsule tab mirrors the existing Notes tab visually (the screenshots are derived from Notes UX) but uses the new 4-level hierarchy and block engine.

---

## DATA MODEL (REUSING EXISTING SUPABASE TABLES)

Existing tables we leverage:

* `user_note_nodes` — generic tree (`type`, `parent_id`, `note_id`, `metadata`).
  We add new node types: `subject`, `topic`, `subtopic`, `notebook` (folder/notebook/note remain valid for legacy Notes tab).
  `metadata.surface = 'capsule'` flags Capsule nodes so they don't pollute the legacy Notes hierarchy.
* `user_notes` — actual content. We use `content` column to store JSON (`{ blocks: [...] }`) for block-based content. Highlights live in `highlights` jsonb.
* `cards` — source for auto-hierarchy mapping (subject → section_group → microtopic → notebook name).

No schema migration is required — the schema is flexible enough.

---

## STEP-BY-STEP PLAN (each step ⇒ one commit)

* [x] **Step 1:** Scaffold Capsule tab — branch + progress file + types + repository skeleton
* [x] **Step 2:** Register `capsule` tab key + add Capsule route to bottom tab bar
* [x] **Step 3:** Capsule home screen — Subject Hub layout (top bar, search, sidebar, main content sections)
* [ ] **Step 4:** Dynamic expandable sidebar (Subject → Topic → Subtopic transformation, breadcrumb)
* [ ] **Step 5:** Notebook list right pane + create notebook flow
* [ ] **Step 6:** Glance reading mode (infinite scroll, full-screen toggle)
* [ ] **Step 7:** Capsule block editor (heading / paragraph / bullet / numbered / checklist / highlight / quote)
* [ ] **Step 8:** Persistent highlights + annotations
* [ ] **Step 9:** Add-to-Notebook popup integration (Manual + Auto modes, Premium Move reuse)
* [ ] **Step 10:** Quiz-engine append pipeline (block-preserving auto-append)
* [ ] **Step 11:** Polish — iPad layout pass, performance/virtualization, empty states

After each step the agent commits with message
`Step <n>: <short description>` and pushes to `origin/capsule-tab`.

---

## CURRENT STATUS

| Step | Status | Commit |
|------|--------|--------|
| 1 | done | `Step 1: Scaffold Capsule tab (progress doc + types + repo skeleton)` |
| 2 | done | `Step 2: Register capsule tab + bottom-tab route` |
| 3 | done | `Step 3: Capsule home screen with Subject Hub layout` |
| 4 | pending | — |

---

## HANDOFF NOTES (for next agent)

If a new agent picks this up:

1. Read **this file** + the **Bible markdown** + **all 6 screenshots** in `New Capsule Tab  (An advance version of notes tab)/`.
2. The Capsule code lives under `app/capsule/*` (Expo Router) and `src/components/capsule/*` + `src/repositories/capsuleRepo.ts`.
3. `src/services/TabConfigService.ts` has `'capsule'` registered as a TabKey — capsule appears in the bottom tab bar via `app/(tabs)/_layout.tsx` (route `/capsule`).
4. Supabase rows for Capsule are tagged with `metadata.surface = 'capsule'` to keep them isolated from the legacy Notes tab hierarchy.
5. Continue at the first unchecked step in the table above.
6. **Each step must end with**: `git add -A && git commit -m "Step <n>: <desc>" && git push origin capsule-tab`.

