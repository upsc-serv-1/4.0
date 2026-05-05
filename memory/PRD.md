# UPSC Prep — Simulated Exam Mode (Branch 5.5)

## Feature: Simulated Exam Mode in Quiz Engine

### Overview
A new "paper view" mode (`viewMode='paper'`) added to `app/unified/engine.tsx` that presents the quiz as a printed question paper. Default-activated when student launches an Arena session with `arenaMode='exam'`. A header toggle (BookOpen icon) lets the student switch between `paper` and `list` views at any time.

### Layout (Section B + C)
- **Tablet (≥ 768 logical px):** strict 2-column grid (3 stacked left, 3 right) — 6 questions per page.
- **Phone (< 768):** auto-falls back to 1 column.
- Each question card shows:
  - Q-number badge, Review (flag) icon, Flashcard (zap) icon
  - Question stem in serif font (Georgia/serif) for printed-paper feel
  - Options
  - Inline chip rows: **GUESS** (Confidence), **DIFFICULTY**, **TAGS** (study/revision tags)
  - A dashed "Explanation" pill (learning mode) → opens centered modal
- Pagination footer: Prev / page-numbers / Next.

### Centered Explanation Modal (Section D)
- Triggered by tapping the "Explanation" pill on any question card.
- Backdrop with translucent dark overlay (+ `backdrop-filter: blur(8px)` on iOS/web).
- Header: question number + correct answer.
- Source tabs (when multiple institutes): horizontal scroll of source pills + "ALL" combined view.
- Scrollable body (`maxHeight: 400`): full markdown explanation, Mistake-type chips, Commit-to-Memory text input, gradient "Commit to Memory" button.
- **Sticky Action Bar** (bottom of modal, always visible): full-text labels — Mark for Review, Add to Flashcards, Save to Notebook, Hardnote, Quick Save.

### Header Wiring (Section A + E)
- New `BookOpen` toggle icon in the engine header → switches list ↔ paper view.
- New `LayoutGrid` palette icon promoted out of the quick menu — always one tap away in the header. Opens the existing Navigator modal which now also jumps to the right paper page when a question is tapped.
- Timer pill remains visible in the header whenever `timerType !== 'none'` (already present).
- Pinch-to-zoom (`PinchGestureHandler`) already wraps the entire render branch — works for paper mode too (font size 12–32 px persisted via AsyncStorage).

### Files Changed
- `app/unified/engine.tsx` — viewMode type expanded to `'list' | 'card' | 'paper'`, `paperPage` / `explanationModalQId` / `paperPageSize` state, `renderPaperQuestion` + `renderPaperPage` functions, header buttons, navigator wiring, explanation modal, `stylesPaper` StyleSheet appended.

### Sections pushed to branch `5.5`
- **Section A** — viewMode='paper' type + header palette/toggle (commit `c448834`)
- **Section B + C** — paper grid layout + inline chips (commit `f1d7f81`)
- **Section D** — explanation modal + sticky action bar (commit `df68e36`)
- **Section E** — PRD + final polish

### Test Plan (manual on iPad)
1. Arena → search/topic → tap "Exam Mode" → engine opens in paper view automatically.
2. Verify 2-column grid on iPad with 6 questions on first page; pagination shows total pages.
3. Switch to phone (or rotate to portrait narrow) → grid collapses to 1 column.
4. Tap "Explanation" pill on any question → centered modal opens with backdrop blur.
5. Inside modal: scroll body, switch source tabs, edit Commit-to-Memory note, tap each sticky action button.
6. Tap header palette icon → Navigator opens; tap any question number → paper jumps to that page.
7. Pinch-zoom on paper → font size scales between 12–32 px; persists across reload.
8. Verify timer (countdown/stopwatch) stays visible in header throughout paper mode.
