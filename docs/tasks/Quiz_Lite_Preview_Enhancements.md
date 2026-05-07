# 🎯 Task: Quiz Lite Preview Functional Parity & UX Enhancements

**Objective:** Transform the Quiz Lite Preview popup into a high-fidelity, fully functional interface that matches the Quiz Engine in utility, typography, and interactivity.
**Priority:** High
**Scope:** `app/ai-search.tsx` and related components (`SharedQuestionCard.tsx`).

---

## 📋 Requirements

### Functional Requirements
- **[REQ-001] Pinch-to-Zoom:** Implement smooth, responsive zoom across the entire question viewer (text, tables, options, explanations).
- **[REQ-002] Notebook Integration:** Add an "Add to Notebook" button that reuses the existing Quiz Engine selection and save flow.
- **[REQ-003] Tag Synchronization:** Ensure user tags and metadata sync bidirectionally between the Lite Preview and the backend/Arena.
- **[REQ-004] Functional Parity:** All buttons (AI Explain, Save, Tags, Explanation Toggles) must behave exactly like the main Quiz Engine.
- **[REQ-005] Typography Normalization:** Standardize explanation font sizes to match the core design system.

### Technical Requirements
- **[TECH-001] Gesture Handling:** Use `react-native-gesture-handler` or similar for stable pinch-to-zoom without layout breaking.
- **[TECH-002] Service Reuse:** Utilize `FlashcardSvc`, `StudentSync`, and `LocalQuery` to ensure state consistency.
- **[TECH-003] Design System:** Use tokens from `ThemeContext` for all typography and spacing.

---

## 🏗️ Implementation Plan

### Phase 1: UI & Typography
- [ ] Normalize `explanation_markdown` font size in `mdStyles`.
- [ ] Adjust hierarchy between metadata and question text.
- [ ] Add "Add to Notebook" button to the fixed footer or action bar.

### Phase 2: Core Interactivity
- [x] Fix Flashcard button logic (Initial implementation complete).
- [ ] Implement `handleAddToNotebook` handler with folder/notebook picker.
- [ ] Implement `handleToggleTag` to sync with `question_states`.
- [ ] Verify AI Explain triggers correctly and shows the result in the preview.

### Phase 3: Gesture & Zoom
- [ ] Wrap the question content in a zoomable container.
- [ ] Ensure tables and images scale correctly within the zoom context.
- [ ] Test gesture stability on iPad and mobile.

### Phase 4: Verification & Handoff
- [ ] Audit all buttons for "Disabled/Placeholder" behavior.
- [ ] Compare side-by-side with the real Quiz Engine for visual parity.
- [ ] Verify backend persistence for all actions (Flashcards, Notebooks, Tags).

---

## 📁 Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `app/ai-search.tsx` | Modify | Primary implementation of handlers and layout updates. |
| `src/components/unified/SharedQuestionCard.tsx` | Modify | Update props/styles if needed for zoom or tags. |

---

## ✅ Success Criteria

### Code Quality
- [ ] TypeScript compliant
- [ ] Reuses existing services (`FlashcardSvc`, `LocalQuery`)
- [ ] No redundant state logic

### UX/Performance
- [ ] Zoom is "smooth and responsive" with no clipping.
- [ ] Layout remains stable during scaling.
- [ ] Typography feels "premium and consistent".

---

## 🔗 Dependencies

**Depends on:** `FlashcardService.ts`, `ThemeContext.tsx`, `StudentSync.ts`
**Used by:** `app/ai-search.tsx`

---

## 🚀 Getting Started

1. Read this task prompt completely
2. Review related files
3. Begin with Phase 1
4. Provide progress updates after each phase
