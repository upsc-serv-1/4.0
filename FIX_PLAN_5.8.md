# Branch 5.8 — Fix Plan

This document captures the exact set of code-level fixes that must land on
branch `5.8`, along with the ordering requested by the user (1 commit per
logical change).

> If implementation is interrupted half-way, you can resume from the next
> unchecked item in section **Execution Order** below.

---

## 1. Paperwise vs Search Order (commit: `fix(paperwise-order): preserve uploaded sequence`)
**Symptom**
* Opening any test from *Paper-Wise* (or via Topic-Wise → Learn → switch to
  Paper-Wise) reorders questions by the *search relevance / PYQ-priority /
  newest-year* heuristic.
* Required: when `params.testId` is set, questions must appear in the EXACT
  order the book/test was uploaded — i.e. by `question_number ASC, id ASC`.

**Root cause**
1. `OfflineManager.runFullSync()` caches questions per test but never asks
   Supabase to order by `question_number`, so the MMKV-cached array is in
   arbitrary insertion order.
2. `engine.tsx → processResults()` falls back to *array index* when
   `question_number` is missing, which leaks the random cache order.

**Fix**
* `src/services/OfflineManager.ts` – when fetching questions per test, add
  `.order('question_number', { ascending: true }).order('id', { ascending: true })`.
* `app/unified/engine.tsx → processResults()` – when `useExactPaperSequence`
  is on, sort by `question_number ASC` and use `id` as the secondary stable
  key (not the array index, which depends on cache-write order).
* Even if every row has a missing `question_number` we still want a
  deterministic sequence, so always sort (don't bail out to "as-is" order).

---

## 2. PYQ Tagging — strict `exam_info` source (commit: `fix(pyq-tag): drive chip strictly from is_pyq + exam_info`)
**Symptom**
* Forum-SFG / mock / non-PYQ rows are showing tags like `UPSC CSE 2026`.
* `2026` is impossible (the exam hasn't happened) → year is leaking from
  `tests.launch_year` or stale `exam_info` blobs.

**Required behaviour (per user spec)**
* Show a PYQ chip **only when `item.is_pyq === true`** (the canonical
  boolean column on `questions`).
* Exam name comes **only** from `exam_info.group` / `exam_info.exam_name`.
* Year comes **only** from `exam_info.year`.
* If those fields are missing → show NO PYQ chip (do not fall back to
  `exam_year`, `exam_group`, `tests.launch_year`, etc.).

**Fix**
* `app/unified/engine.tsx → getPYQCategorization()` – tighten the source
  fields:
  - `isPYQ` = `toBool(item.is_pyq)` (drop the `examInfo.isPyq` fallback).
  - `groupName` = `examInfo.group ?? examInfo.exam_name ?? ''` (drop the
    `item.exam_group` fallback).
  - `year` = `examInfo.year ?? ''` (drop the `item.exam_year` fallback).
  - Hide chip when both `groupName` and `year` are empty.
* `src/components/GlobalSearchBar.tsx → getPYQCategorization()` – mirror
  the same three rules.
* `src/utils/merger.ts → getYear()` – remove `q?.tests?.launch_year` from
  the fallback chain so merged `_explanations[].year` never picks up
  `launch_year`.

---

## 3. Arena Performance (commit: `perf(arena): instant paint, silent background sync`)
**Symptom**
* Arena entry shows `Syncing filters…` banner and feels slow even when
  metadata is already cached.

**Fix**
* `app/unified/arena.tsx`
  - Persist the consolidated metadata to MMKV (`@arena_metadata_cache`)
    so reload is instant after a cold start.
  - Skip the `Syncing filters…` banner when warm/MMKV cache is present
    (refresh continues silently in the background).
  - Bump the in-memory cache TTL from 90 s → 5 min — enough for typical
    session length, prevents repeated heavy `getConsolidatedMetadata()`
    calls.
* `src/services/OfflineManager.ts`
  - Cache the result of `getConsolidatedMetadata()` in MMKV under
    `@offline_metadata_consolidated_v1` and return it synchronously when
    available; refresh in the background.

---

## 4. Offline Mode (MMKV) — never blow away cached questions (commit: `fix(offline): keep cached questions when network fetch returns empty`)
**Symptom**
* With Wi-Fi off, Arena → Learn shows *Network error* and zero questions
  even though the questions are already cached in MMKV.

**Root cause**
`engine.tsx → fetchQuestions()`:
1. Loads cache → `processResults(cached)` (good).
2. Fires Supabase fetch which fails (no internet) or returns 0 rows.
3. Falls through to `processResults(allFreshData /* = [] */)` which
   overwrites the previously rendered questions with `[]`.

**Fix**
* In `fetchQuestions()` (`app/unified/engine.tsx`), only call
  `processResults(allFreshData)` when `allFreshData.length > 0`.
* In the `catch` block, do **not** call `setQuestions([])` if `localFound`
  is true.
* When offline and cache hit, mark sync silently as deferred (no error
  alert, no loading spinner takeover).

---

## 5. Palette Navigation — List View jumps (commit: `fix(palette): list-view jump uses scrollToIndex with retry`)
**Symptom**
* In Card View tapping a number in the palette jumps to the question.
* In List View it does NOT jump.

**Root cause**
* The palette-press handler only calls `scrollToIndex` once with
  `requestAnimationFrame`. For items beyond the FlatList's render window
  (`initialNumToRender=10`) `scrollToIndex` silently fails; the existing
  `onScrollToIndexFailed` retries once after 500 ms but the modal-close
  animation eats that window so the retry sees stale layout.

**Fix**
* `app/unified/engine.tsx`
  - Make the palette's *list view* branch:
    1. Close the modal.
    2. Wait one tick.
    3. Call `setCurrentIndex(idx)`.
    4. Use a robust scroll helper that:
       - tries `scrollToIndex` with `viewPosition: 0`,
       - on `onScrollToIndexFailed` falls back to
         `scrollToOffset({ offset: idx * AVERAGE_ITEM_HEIGHT })` then
         re-tries `scrollToIndex` after a short delay.
  - Update the existing `useEffect` that performs the *return-from-index*
    scroll to also depend on `currentIndex` so any state-driven jump (not
    just a `viewMode` change) ends with the desired item visible.

---

## Execution Order

Each commit must be pushed to `origin/5.8` immediately after it lands.

- [ ] **1.** Paperwise vs Search Order
- [ ] **2.** PYQ Tagging cleanup
- [ ] **3.** Arena performance (silent metadata cache)
- [ ] **4.** Offline mode — preserve cached questions
- [ ] **5.** Palette List-View jump

---

## Verification snippets

Quick sanity checks after each commit:

```bash
# Lint just the touched TS files
npx eslint <changed files> --max-warnings=0
```

For #1 / #4 the runtime flow is best verified inside the app; for #2 use
a row that has `is_pyq=false` and confirm no chip renders.
