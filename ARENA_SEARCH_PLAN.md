# Arena Search Redesign – Implementation Plan (Branch 5.8)

## Current State Audit (already shipped in branch `5.8`)
Commit `eed6d57 feat(search): open Arena search directly in index and remove results screen flow` already implemented:

1. **Search routes directly to Arena Index** – `src/components/GlobalSearchBar.tsx` (`openArenaIndexSearch`) pushes to `/unified/engine` with `view=list`, `mode=learning`.
2. **Arena Index is the default view in learning mode** – `app/unified/engine.tsx` line 568: `useState(arenaMode === 'learning')` defaults `showIndex` to `true`.
3. **40-word snippet** – `renderQuestionIndex` (line 1930-1952) slices first 40 words from `question_text`/`statement_line`.
4. **Click a question → opens single question view** – `setCurrentIndex(actualIndex); setShowIndex(false)` (line 1957-1959).
5. **Learn / Exam mode buttons** at the bottom of Arena Index (lines 2034-2057).
6. **Old separate search-results screen removed** – no `/search-results` route exists.
7. **Multi-institute explanations + dedupe untouched** – `buildCanonicalExplanations`, `availableExplSources`, source pills all intact.

## Tasks Still To Do

### Task 1 — Add **"View Source"** secondary action on every question card
- File: `app/unified/engine.tsx`
- Location: inside `renderQuestionBlock` (list & card view), in the explanation-mode action row (where Notebook/Hardnotes/Flashcard/Save sit).
- Behaviour: `router.push({ pathname: '/unified/engine', params: { testId: item.test_id, questionId: item.id, mode: 'learning', view: 'list' } })`.
- Disabled / hidden when `item.test_id` is missing.
- Add a small icon in the header row too (next to flag/notebook/zap) so it's reachable even before explanation is revealed.
- Independent of dedupe / multi-institute flow.

### Task 2 — Tablet-aware 40-word snippet in Arena Index
- File: `app/unified/engine.tsx` `renderQuestionIndex`.
- On large screens (`width >= 768`), drop the `numberOfLines={2}` limit so the full 40-word snippet renders.
- On phones (`< 768`), keep the existing `numberOfLines={2}` truncation.

### Task 3 — Documentation commit
- Commit this plan file at the start so the user can resume if credit runs out.

## Commit Strategy (per user request: many tiny commits)
1. `docs: add ARENA_SEARCH_PLAN.md`
2. `feat(arena-index): show full 40-word snippet on tablets, keep 2-line on phones`
3. `feat(arena): add View Source quick action in question header`
4. `feat(arena): add View Source action in explanation action row`

Each commit is pushed to `origin/5.8` immediately after creation.

## Out-of-Scope (explicitly preserved, not touched)
- Dedupe logic (`buildCanonicalExplanations`)
- Multi-institute explanation source pills
- MMKV cache / sync indicator behaviour
- Paper/Exam mode rendering
