# CAPSULE TAB — IMPLEMENTATION PROGRESS

> **Repo:** `upsc-serv-1/4.0`
> **Source branch:** `hardnotes-renovation`
> **Working branch:** `capsule-tab`
> **Bible file:** `New Capsule Tab  (An advance version of notes tab)/COMPLETE_BLUEPRINT_FOR_AI_for_Notes_Tab.md`
> **Screenshots:** Same folder, `Screenshot 2026-05-08 *.png` (UI/UX truth — overrides bible whenever they conflict)

---

## OBJECTIVE

A brand-new **"Capsule"** tab inside Buffer UPSC — a continuously evolving UPSC
knowledge ingestion + revision system.

* New hierarchy: **Subject → Topic → Subtopic → Notebook**
* Editor stores **structured appendable blocks** (not giant docs)
* Continuous ingestion from quiz engine via the **Add to Notebook** popup
  (Manual + Auto modes)
* Reuse Premium Move Module for hierarchy navigation (planned)
* Persistent highlights + infinite glance reading workspace
* iPad-first UX exactly matching the supplied screenshots

The Capsule tab mirrors the existing Notes tab visually but uses the new
4-level hierarchy and block engine.

---

## DATA MODEL (REUSING EXISTING SUPABASE TABLES)

| Table             | Use                                                                                                       |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| `user_note_nodes` | Generic tree. We add types `subject` / `topic` / `subtopic` / `notebook` with `metadata.surface='capsule'`. |
| `user_notes`      | Per-notebook content. We use `content` to store JSON `{ blocks, highlights, version }`.                   |
| `cards`           | Source for Auto-mode hierarchy mapping (subject / section_group / microtopic).                            |

`metadata.surface = 'capsule'` is the isolation flag — without it nodes belong
to the legacy Notes tab and are filtered out by `fetchAllCapsuleNodes`.

No SQL migration required. Existing RLS works because we only insert with
`user_id = auth.uid()`.

---

## DELIVERED IN THIS BRANCH

### Code surface

```
app/capsule/
 ├ _layout.tsx
 ├ index.tsx                  ← Subject Hub home (dynamic sidebar + dashboard)
 ├ glance/[id].tsx            ← Infinite glance reading workspace
 └ editor/[id].tsx            ← Block-based editor with debounced autosave

src/components/capsule/
 ├ AddToNotebookSheet.tsx     ← Destination chooser (Capsule / Notes / Flashcards)
 ├ CapsuleBreadcrumb.tsx
 ├ CapsuleCreatePrompt.tsx    ← Modal for creating subjects / topics / etc
 ├ CapsuleLocationPicker.tsx  ← Manual + Auto-mode hierarchy picker
 ├ CapsuleNoteCard.tsx        ← Card used in Continue Studying / Pinned / Recent
 ├ CapsuleSidebar.tsx
 ├ CapsuleTopBar.tsx
 └ CapsuleTreeNav.tsx         ← Recursive expandable tree

src/repositories/capsuleRepo.ts   ← Supabase CRUD + tree builder + appendBlocks
src/types/capsule.ts              ← CapsuleNode / CapsuleBlock / palette
src/utils/capsuleAppend.ts        ← textToCapsuleBlocks + appendTextToCapsule

Wiring into existing screens:
 - app/ai-search.tsx        : Add-to-Notebook now opens dest chooser
 - app/unified/engine.tsx   : Quiz engine "Save to Notebook" wired to Capsule
 - src/services/TabConfigService.ts : 'capsule' added to tab keys
 - app/(tabs)/_layout.tsx   : Capsule registered in bottom tab bar
```

### Functionality complete

* ✅ Bottom tab "Capsule" (Sparkles icon)
* ✅ Subject Hub home with Continue Studying / Pinned / Recent sections
* ✅ Single dynamic expandable sidebar — Subject → Topic → Subtopic → Notebook
* ✅ Inline create flow at every level (+ New Subject / Topic / Subtopic / Notebook)
* ✅ Breadcrumb that reflects the active path
* ✅ Glance reading mode (full-screen toggle, share, edit, pin)
* ✅ Block editor with paragraph / heading / bullet / numbered / checklist /
       highlight / quote types, reorder, delete, debounced autosave
* ✅ Add-to-Notebook destination chooser (Capsule / Notes / Flashcards)
* ✅ Capsule location picker with Manual + Auto modes
       (Auto = subject / section_group / microtopic / notebook title)
* ✅ Quiz-engine + AI-search → Capsule append pipeline (preserves existing content)

---

## REMAINING WORK (PICK UP FROM HERE)

The next agent can continue at the first unchecked item. Each step is its own
commit on the `capsule-tab` branch.

* [ ] **Step 10:** In-editor selection-based highlights UI
       (data model already supports `CapsuleHighlight[]`).
* [ ] **Step 11:** Reuse `PremiumMoveSheet` so notebooks/topics can be moved
       across the hierarchy.
* [ ] **Step 12:** "See All" navigation for Continue Studying / Pinned / Recent.
* [ ] **Step 13:** Trash (soft-delete + restore) + Shared (multi-user) views.
* [ ] **Step 14:** iPad split-pane glance — sidebar + reading on the same screen.
* [ ] **Step 15:** Virtualize large notebooks (`FlatList` / `FlashList`).
* [ ] **Step 16:** Voice-note + AI-explanation block ingestion endpoints.

After each step:
```bash
git add -A
git commit -m "Step N: <short description>"
git push origin capsule-tab
```

---

## STEP HISTORY

| Step | Status | Commit |
|------|--------|--------|
| 1 | done | `Step 1: Scaffold Capsule tab (progress doc + types + repo skeleton)` |
| 2 | done | `Step 2: Register capsule tab + bottom-tab route` |
| 3 | done | `Step 3: Capsule home screen with Subject Hub layout` |
| 4 | done | `Step 4: Dynamic expandable sidebar tree + breadcrumb + scoped notebook list` |
| 5 | done | `Step 5: Glance reading workspace with block renderer + sidebar toggle` |
| 6 | done | `Step 6: Block editor (paragraph/heading/bullet/numbered/checklist/highlight/quote with autosave)` |
| 7 | done | `Step 7: Add-to-Notebook destination chooser + Capsule picker (Manual + Auto)` |
| 8 | done | `Step 8: Wire Capsule destination into quiz engine + ai-search` |
| 9 | done | `Step 9: Final polish + handoff documentation` |

---

## TESTING NOTES

* The preview environment redirects unauthenticated visitors to `/login`.
  Log in with any existing Buffer UPSC test account, then navigate to
  `/capsule` (or tap **Capsule** in the bottom tab bar) to exercise the flow.
* On first visit the empty state renders a CTA `+ Create your first subject`.
  Creating a subject expands the sidebar and exposes inline `+ New Topic` etc.
* In a quiz session, opening a question and using the
  **Add to Notebook** action surfaces the dest chooser; pick **Capsule** to
  see the picker with auto-filled hierarchy fields.

## KEY DESIGN DECISIONS

1. **Single-route Capsule home.** Bible explicitly says one dynamic sidebar —
   we deliberately do NOT use nested Expo-Router routes for subject/topic/
   subtopic. The whole tree lives in `app/capsule/index.tsx` with internal
   state. The Glance + Editor screens are routed because they're full-screen
   workspaces.
2. **Block-first storage.** Everything that lands in a notebook becomes a
   `CapsuleBlock`. `appendTextToCapsule` parses incoming markdown-ish text
   (bullets / headings / numbered / `==highlight==` / `> quote`) into structured
   blocks so the formatting survives long-term editing.
3. **Capsule isolation flag.** `metadata.surface='capsule'` keeps the legacy
   Notes hierarchy unaffected. The legacy Notes tab continues to read its
   nodes the same way (no `surface` filter on its side).
4. **Premium Move reuse.** Not done yet — `PremiumMoveSheet` exists at
   `src/components/common/PremiumMoveSheet.tsx`; Step 11 should plumb it into
   the Capsule editor's "Move to" action.
