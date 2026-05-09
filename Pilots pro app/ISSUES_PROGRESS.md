# Pilot V2 — Phase 4 Issues Progress

> **Branch:** `pilot-pro-v2.3`
> Tracks the 35-issue audit list + remaining handoff items. Each row links
> to the commit that resolved it. **Sequential implementation order.**

---

## Carryover from previous session

| # | Item | Status | Commit |
|---|------|--------|--------|
| C1 | Migrate `shadow*` → `boxShadow` web deprecations | ⏳ pending | — |
| C2 | Active Recall Washi-Tape system (Item 11) | ⏳ pending | — |
| C3 | Smart Block Matcher (gap #5) | ⏳ pending | — |

---

## Issue Set 1 — 35 audit items (in order)

| # | Title | Status | Commit | Notes |
|---|-------|--------|--------|-------|
| 1 | Empty question state → auto-delete from Supabase | ⏳ pending | — | Add `isQuestionStateEmpty` util + cascade delete |
| 2 | Tag tab question view missing AI features | ⏳ pending | — | Unify with `QuestionActionBar` |
| 3 | Merged questions must show all institute answers | ⏳ pending | — | Unified answer renderer |
| 4 | Tag rename broken | ⏳ pending | — | Transactional rename across all references |
| 5 | Tag delete should cascade | ⏳ pending | — | Cascade via Supabase mutation |
| 6 | New tags require manual refresh | ⏳ pending | — | Realtime tag store |
| 7 | Plus button to create tag missing | ⏳ pending | — | Universal create-tag button |
| 8 | Arena Index button exits screen | ⏳ pending | — | Embedded panel routing |
| 9 | AI Search filter panel empty | ⏳ pending | — | Hierarchical Subject→SectionGroup→Microtopic |
| 10 | Filter options disappear after selection | ⏳ pending | — | `PersistentFilterList` |
| 11 | AI Search filters re-querying Supabase | ⏳ pending | — | Client-side filter engine |
| 12 | Semantic search engine | 🛑 deferred | — | User: "leave for now" |
| 13 | Flashcard delete not cascading to Supabase | ⏳ pending | — | Cascade delete |
| 14 | Add "View Source" secondary action | ⏳ pending | — | Universal source button |
| 15 | Tags tab list-view folder click broken | ⏳ pending | — | Shared FolderNavigationHandler |
| 16 | Export hierarchical sorting incorrect | ⏳ pending | — | Recursive grouping |
| 17 | Year/difficulty filter merged with sorting | ⏳ pending | — | Decouple filter/sort state |
| 18 | Export filters non-functional | ⏳ pending | — | Pipe `filteredQuestions[]` into export |
| 19 | Global filter/sort audit | ⏳ pending | — | App-wide |
| 20 | PYQ heatmap auto-scroll | ⏳ pending | — | scrollIntoView |
| 21 | Replace play icon in PYQ analysis | ⏳ pending | — | List/document icon |
| 22 | Remove duplicate plus button in flashcards | ⏳ pending | — | Single FAB only |
| 23 | Flashcard color palettes non-functional | ⏳ pending | — | Persist & apply |
| 24 | Universal back gesture / nav consistency | ⏳ pending | — | Stack navigation |
| 25 | Flashcard save false-positive | ⏳ pending | — | Async confirmation state |
| 26 | Auto-placed decks break after move | ⏳ pending | — | Stable deck UUID registry |
| 27 | Flashcard expand/collapse touch target | ⏳ pending | — | Split interaction zones |
| 28 | Flashcard study reminders | ⏳ pending | — | Notification scheduler |
| 29 | Custom app icon support | ⏳ pending | — | AppIconManager |
| 30 | Dark mode | ⏳ pending | — | Unified theme tokens |
| 31 | Unified scrolling header behavior | ⏳ pending | — | CollapsibleHeaderContainer |
| 32 | Tags tab question view feature parity | ⏳ pending | — | Full QuestionExplanationRenderer |
| 33 | Export engine filter/sort separation | ⏳ pending | — | Two-section UI |
| 34 | Tag filters incomplete tag list | ⏳ pending | — | Global tag registry |
| 35 | Export UI standardization | ⏳ pending | — | UnifiedExportModal |

---

## Strategy

Many of these items touch deep cross-cutting architectures (Supabase
schema, navigation stack, realtime subscriptions). The previous agent
finished Pilot V2 Steps 5-8 in 5 commits; this audit is 35× larger and
will be tackled in waves:

* **Wave 1 (this session):** Quick wins — shadow→boxShadow migration,
  remove duplicate plus button, replace play icon, view-source button,
  flashcard touch-target split, custom app icon stub.
* **Wave 2 (next session):** Tag system (rename cascade, delete cascade,
  global registry, realtime store).
* **Wave 3:** Export engine rewrite (filter/sort decoupling, hierarchical
  grouping, unified popup UI).
* **Wave 4:** Question viewer parity (QuestionActionBar +
  QuestionExplanationRenderer unification).
* **Wave 5:** Active Recall Washi-Tape, Smart Block Matcher, dark mode,
  collapsible headers, study reminders.

Each completed item is committed individually with the format:
```
Issue N: <short clear description>
```
