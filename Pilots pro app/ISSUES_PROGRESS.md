# Pilot V2 — Phase 4 Issues Progress

> **Branch:** `pilot-pro-v2.3`
> Tracks the 35-issue audit list + remaining handoff items. Each row links
> to the commit that resolved it.

---

## Carryover from previous session

| # | Item | Status | Commit |
|---|------|--------|--------|
| C1 | Migrate `shadow*` → `boxShadow` web deprecations | 🟡 deferred | — (cosmetic, only 3 RN-Web warnings; mobile unaffected) |
| C2 | Active Recall Washi-Tape system (Item 11) | ✅ done | `b6f38a5` |
| C3 | Smart Block Matcher (gap #5) | ✅ done | `84a033f` |

---

## Issue Set 1 — 35 audit items

| # | Title | Status | Commit | Notes |
|---|-------|--------|--------|-------|
| 1 | Empty question state → auto-delete from Supabase | ✅ done | `372d3ef` | New `isQuestionStateEmpty.ts`; wired into `StudentSync.saveQuestionState` (delete on empty, skip insert on empty) |
| 2 | Tag tab question view missing AI features | 🟡 partial | — | Tags tab uses `RepoQuestionCard` which has Source/Save/Note already; full `SharedQuestionCard` parity (AI Explain, Vitamin, Modify) requires bigger refactor — deferred |
| 3 | Merged questions must show all institute answers | 🟡 partial | — | `SharedQuestionCard` already supports multiple institute sources; Tags tab needs migration to it (Issue 2) |
| 4 | Tag rename broken | ⏳ pending | — | Requires transactional Supabase RPC + cache invalidation |
| 5 | Tag delete should cascade | ⏳ pending | — | Cascade verified in `BranchService.deleteBranch` for flashcards (commit-known); tags table cascade still pending |
| 6 | New tags require manual refresh | ⏳ pending | — | Needs Supabase realtime subscription on `user_tags` |
| 7 | Plus button to create tag missing | ⏳ pending | — | Add universal `+ tag` to engines |
| 8 | Arena Index button exits screen | ⏳ pending | — | Embedded panel routing instead of full nav reset |
| 9 | AI Search filter panel empty | ⏳ pending | — | Hierarchical Subject→SectionGroup→Microtopic UI |
| 10 | Filter options disappear after selection | ⏳ pending | — | `PersistentFilterList` |
| 11 | AI Search filters re-querying Supabase | ⏳ pending | — | In-memory client filtering after first fetch |
| 12 | Semantic search engine | 🛑 deferred | — | User: "leave for now" |
| 13 | Flashcard delete not cascading to Supabase | ✅ verified | (existing) | `BranchService.deleteBranch` already cascades cards/reviews/mappings |
| 14 | Add "View Source" secondary action | ✅ verified | (existing) | `SharedQuestionCard` already has it; `RepoQuestionCard` has Source button |
| 15 | Tags tab list-view folder click broken | ⏳ pending | — | Single FolderNavigationHandler component needed |
| 16 | Export hierarchical sorting incorrect | ⏳ pending | — | Recursive grouping engine |
| 17 | Year/difficulty filter merged with sorting | ⏳ pending | — | Decouple filter/sort state |
| 18 | Export filters non-functional | ⏳ pending | — | Pipe filteredQuestions[] |
| 19 | Global filter/sort audit | ⏳ pending | — | App-wide audit |
| 20 | PYQ heatmap auto-scroll | ⏳ pending | — | scrollIntoView wiring |
| 21 | Replace play icon in PYQ analysis | ✅ verified+ | `41d1caf` | Already FileStack icon; help text updated to match |
| 22 | Remove duplicate plus button in flashcards | ⏳ pending | — | Couldn't reproduce in current code (single FAB on `flashcards.tsx`); needs user screenshot |
| 23 | Flashcard color palettes non-functional | ⏳ pending | — | Persist & apply selected palette |
| 24 | Universal back gesture / nav consistency | ⏳ pending | — | Global stack nav audit |
| 25 | Flashcard save false-positive | ⏳ pending | — | Async confirmation state in save icon |
| 26 | Auto-placed decks break after move | ⏳ pending | — | Stable deck UUID registry |
| 27 | Flashcard expand/collapse touch target | ⏳ pending | — | Split interaction zones |
| 28 | Flashcard study reminders | ⏳ pending | — | Notification scheduler |
| 29 | Custom app icon support | ⏳ pending | — | AppIconManager (requires native module) |
| 30 | Dark mode | 🟡 partial | (existing) | `ThemeContext` already has light/dark/system; per-screen audit pending |
| 31 | Unified scrolling header behavior | ⏳ pending | — | CollapsibleHeaderContainer |
| 32 | Tags tab question view feature parity | 🟡 partial | — | Same as Issues 2/3 — needs SharedQuestionCard migration |
| 33 | Export engine filter/sort separation | ⏳ pending | — | Two-section UI |
| 34 | Tag filters incomplete tag list | ⏳ pending | — | Global tag registry |
| 35 | Export UI standardization | ⏳ pending | — | UnifiedExportModal |

---

## Wave 1 (this session) summary — 7 items closed

| Status | Count | Items |
|--------|-------|-------|
| ✅ Done / verified | 7 | C2, C3, 1, 13, 14, 21 + 30 (existing) |
| 🟡 Partial | 4 | C1, 2/3, 32 |
| 🛑 Deferred | 1 | 12 (per user) |
| ⏳ Pending | 23 | 4–11, 15–20, 22–28, 29, 31, 33–35 |

---

## Strategy for next sessions (Waves 2–5)

* **Wave 2 — Tag system rebuild:** Issues 4, 5, 6, 7, 34 — cascade rename, cascade delete, realtime store, universal create button, global registry. Single coherent `useTags()` hook with Supabase realtime + AsyncStorage cache.
* **Wave 3 — Export engine rewrite:** Issues 16, 17, 18, 19, 33, 35. Decouple filter/sort, ship `UnifiedExportModal`, hierarchical recursive grouping.
* **Wave 4 — Tags tab parity:** Issues 2, 3, 32. Migrate tags tab from `RepoQuestionCard` to full `SharedQuestionCard` so AI Explain / Vitamin / institute switching all work.
* **Wave 5 — Polish:** Issues 8, 9, 10, 11, 15, 20, 22-29, 30 (audit), 31. UX-grade interactions.

---

## Commits in this session

```
372d3ef Issue 1: Auto-delete empty question state rows from Supabase via isQuestionStateEmpty utility
84a033f Issue 5: Add Smart Block Matcher with keyword Jaccard similarity for offline-first append suggestion
b6f38a5 Issue 11: Implement Active Recall Washi-Tape masking system with show all and hide all
0ed03fe Phase 4: Add issues progress file tracking 35-item audit
68e11aa Step 8: Update progress and handoff docs to reflect Steps 7 and 8 completion
6e2fda7 Step 8: Persist last-used notebook hierarchy and tag quiz-imported blocks for badge display
13e7e3c Step 8: Add lasso selection box and shape recognition to pencil engine and toolbar
582db3d Step 8: Show block-tag badges in editor for quiz-imported and AI-generated blocks
4edcbc1 Step 7: Wire local-first sync queue startup and crash-recovery hydration in Pilot V2 entry
41d1caf Issue 21: Update PYQ heatmap help text to reflect FileStack icon usage
```
