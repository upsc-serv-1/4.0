# Pilot V2 — Phase 4 Issues Progress

> **Branch:** `pilot-pro-v2.3`
> Tracks the 35-issue audit list + remaining handoff items.

---

## Carryover from Phase 4 kickoff

| # | Item | Status | Commit |
|---|------|--------|--------|
| C1 | Migrate `shadow*` → `boxShadow` web deprecations | 🟡 deferred | — (cosmetic, only 3 RN-Web warnings; mobile unaffected) |
| C2 | Active Recall Washi-Tape system (Item 11) | ✅ done | `b6f38a5` |
| C3 | Smart Block Matcher (gap #5) | ✅ done | `84a033f` (+ guard `cce54fa`) |

---

## Issue Set 1 — 35 audit items

| # | Title | Status | Commit | Notes |
|---|-------|--------|--------|-------|
| 1 | Empty question state → auto-delete from Supabase | ✅ done | `372d3ef`, `cce54fa` | New `isQuestionStateEmpty.ts`; wired into `StudentSync` |
| 2 | Tag tab question view missing AI features | ✅ done | `380b617` | New `TagsQuestionAIPanel`: Vitamin viewer, Save Vitamin, AI Explain/Simplify/Modify (deep-link), Highlight, Hard Note, Note, Bookmark — all inline |
| 3 | Merged questions must show all institute answers | 🟡 partial | `380b617` | Inline panel surfaces sibling-institute explanations (lazy-fetched by hierarchy match). True multi-institute merging still requires `mergeQuestions()` to run inside `useTaggedQuestions` |
| 4 | Tag rename broken | ⏳ pending | — | Requires transactional Supabase RPC (Wave 2) |
| 5 | Tag delete should cascade | ⏳ pending | — | Wave 2 |
| 6 | New tags require manual refresh | ⏳ pending | — | Supabase realtime subscription on `user_tags` (Wave 2) |
| 7 | Plus button to create tag missing | ⏳ pending | — | Wave 2 |
| 8 | Arena Index button exits screen | ⏳ pending | — | Embedded panel routing (Wave 5) |
| 9 | AI Search filter panel empty | ⏳ pending | — | Wave 5 |
| 10 | Filter options disappear after selection | ⏳ pending | — | `PersistentFilterList` (Wave 5) |
| 11 | AI Search filters re-querying Supabase | ⏳ pending | — | Wave 5 |
| 12 | Semantic search engine | 🛑 deferred | — | User: "leave for now" |
| 13 | Flashcard delete not cascading to Supabase | ✅ verified | (existing) | `BranchService.deleteBranch` already cascades cards/reviews/mappings/children |
| 14 | Add "View Source" secondary action | ✅ verified | (existing) | `SharedQuestionCard` & `RepoQuestionCard` already have it |
| 15 | Tags tab list-view folder click broken | ⏳ pending | — | Wave 5 |
| 16 | Export hierarchical sorting incorrect | ✅ verified | (existing) | `unifiedExportEngine.groupingLevels` already supports multi-select recursive grouping (UnifiedExportSheet wires it lines 421-440) |
| 17 | Year/difficulty filter merged with sorting | ✅ verified | (existing) | Engine has separate `revisionTags / yearStart / yearEnd / pyqOnly / ncertOnly / subjectFilters / sectionGroupFilters / microTopicFilters` filter pipeline distinct from `groupingLevels` |
| 18 | Export filters non-functional | ✅ verified | (existing) | `unifiedExportEngine.applyFilters` (lines 475-507) consumes all filter sets including `revisionTags` (tag filter) |
| 19 | Global filter/sort audit | 🟡 architectural | — | Engine architecture is correct; per-screen audit pending (Wave 5) |
| 20 | PYQ heatmap auto-scroll | ⏳ pending | — | Wave 5 |
| 21 | Replace play icon in PYQ analysis | ✅ done | `41d1caf` | Already FileStack icon; help text updated |
| 22 | Remove duplicate plus button in flashcards | 🟡 not-reproduced | — | Single FAB found on `flashcards.tsx`; user screenshot needed |
| 23 | Flashcard color palettes non-functional | ⏳ pending | — | Wave 5 |
| 24 | Universal back gesture / nav consistency | ⏳ pending | — | Wave 5 |
| 25 | Flashcard save false-positive | ⏳ pending | — | Wave 5 |
| 26 | Auto-placed decks break after move | ⏳ pending | — | Wave 5 |
| 27 | Flashcard expand/collapse touch target | ⏳ pending | — | Wave 5 |
| 28 | Flashcard study reminders | ✅ done | `9d15a9f` | New `StudyReminders.ts` Expo Go-friendly polling service with silent hours, frequency, subject targeting, subscriber API. Settings UI pending |
| 29 | Custom app icon support | 🟡 deferred | — | Requires `expo-system-ui` + dynamic-icon native module — breaks Expo Go |
| 30 | Dark mode | ✅ verified | (existing) | `ThemeContext` already supports `light/dark/system` modes |
| 31 | Unified scrolling header behavior | ✅ done | `380b617` | New `CollapsibleHeaderContainer` reusable component (FlatList + ScrollView modes). Per-tab adoption pending |
| 32 | Tags tab question view feature parity | ✅ done | `380b617` | `TagsQuestionAIPanel` brings Vitamin + AI actions inline while keeping the 3-stage RECALL → CHECK → SAVED collapsible behavior |
| 33 | Export engine filter/sort separation | ✅ verified+ | `09f7b56` | Engine already separates them; new `UnifiedExportModal` provides a clean drop-in alternative with stricter UI separation |
| 34 | Tag filters incomplete tag list | ⏳ pending | — | Wave 2 (global tag registry) |
| 35 | Export UI standardization | ✅ done | `09f7b56` | New `UnifiedExportModal` replicates the Settings popup aesthetics with full filter+sort+format functionality |

---

## Wave summary after Wave 1+3+4+5 partial

| Status | Count |
|--------|-------|
| ✅ Done | 12 (C2, C3, 1, 2, 13, 14, 16, 17, 18, 21, 28, 30, 31, 32, 33, 35) |
| 🟡 Partial / verified-only | 4 (C1, 3, 19, 22) |
| 🛑 Deferred (per user / native) | 2 (12, 29) |
| ⏳ Pending | 17 (4–11 minus done, 15, 20, 23–27, 34) |

---

## Files added in Phase 4

```
src/components/pilot-v2/washiTape.ts                    Issue 11 (washi tape data layer)
src/components/pilot-v2/WashiTapeLayer.tsx              Issue 11 (renderer + creator UI)
src/components/pilot-v2/smartBlockMatcher.ts            Gap #5
src/services/isQuestionStateEmpty.ts                    Issue 1
src/components/tags/TagsQuestionAIPanel.tsx             Issues 2, 3, 32
src/components/common/CollapsibleHeaderContainer.tsx    Issue 31
src/components/exports/UnifiedExportModal.tsx           Issues 16, 17, 18, 33, 35
src/services/StudyReminders.ts                          Issue 28
```

## Phase 4 commit log

```
9d15a9f Issue 28: Add Expo Go-friendly study reminders polling service with subscriber API and silent hours
09f7b56 Issues 16+17+18+33+35: Add UnifiedExportModal helper alongside existing UnifiedExportSheet
380b617 Issue 32: Add inline TagsQuestionAIPanel to Tags tab cards with Vitamin viewer and institute switcher
cce54fa Issue 1+5: Convert require to ES import in StudentSync and add min-length guard in smart matcher
03a12d9 Phase 4: Update issues progress doc with Wave 1 closure status
41d1caf Issue 21: Update PYQ heatmap help text to reflect FileStack icon usage
372d3ef Issue 1: Auto-delete empty question state rows from Supabase via isQuestionStateEmpty utility
84a033f Issue 5: Add Smart Block Matcher with keyword Jaccard similarity for offline-first append suggestion
b6f38a5 Issue 11: Implement Active Recall Washi-Tape masking system with show all and hide all
0ed03fe Phase 4: Add issues progress file tracking 35-item audit
```

---

## Next sessions

* **Wave 2 (tag system rebuild):** Issues 4, 5, 6, 7, 34 — global tag store with Supabase realtime + AsyncStorage cache + cascade rename / cascade delete RPC.
* **Wave 5 (UX polish remainder):** Issues 8, 9, 10, 11, 15, 20, 22–27 — engine routing, persistent filter UI, in-memory client filtering, flashcard fixes, custom app icon (deferred to dev-build).
