# UI Unification Audit — Duplicate & Inconsistent Patterns

## 1. 🚚 Move/Pick Destination Modals (DUPLICATED x5)

There are **5 different "move to folder" implementations** with near-identical layouts:

| File | Used In | Key Difference |
|---|---|---|
| [`src/components/common/PremiumMoveSheet.tsx`](src/components/common/PremiumMoveSheet.tsx) | General purpose | Generic, well-made |
| [`src/components/flashcards/PremiumMoveModal.tsx`](src/components/flashcards/PremiumMoveModal.tsx) | Flashcards | Flashcards-specific tree |
| [`src/components/pilot-v2/PilotV2MoveModal.tsx`](src/components/pilot-v2/PilotV2MoveModal.tsx) | Pilot V2 | Folders/notes tree |
| [`src/components/capsule/AddToNotebookSheet.tsx`](src/components/capsule/AddToNotebookSheet.tsx) | Capsules | Capsule-specific picker |
| [`src/components/flashcards/AddToFlashcardSheet.tsx`](src/components/flashcards/AddToFlashcardSheet.tsx) | Flashcards | Flashcard-specific picker |

**Fix:** Create ONE reusable `DestinationPickerSheet` component. All other "move" modals use it with different data sources (tree, flat list, search).

---

## 2. 📋 Bottom Sheet Modals (INCONSISTENT x20+)

Every modal uses different styling patterns for the same bottom-sheet layout:

```tsx
// Pattern A: Modal + Pressable backdrop (used 12+ times)
<Modal visible={v} transparent animationType="fade" onRequestClose={c}>
  <Pressable style={styles.overlay} onPress={c}>
    <View style={[s.sheet, { bg: colors.surface }]}>
```

```tsx
// Pattern B: Modal + absolute fill Touchable (used 8+ times)
<Modal ...>
  <TouchableOpacity activeOpacity={1} onPress={c} style={StyleSheet.absoluteFill} />
  <View style={[...]}>
```

```tsx
// Pattern C: Modal + justifyContent flex-end (used 6+ times)
<Modal ...>
  <View style={{ flex: 1, justifyContent: 'flex-end', bg: 'rgba(0,0,0,0.5)' }}>
```

**Standardization needed:**
- Overlay backdrop opacity: `0.5` vs `0.55` vs `0.6` vs `0.7` — PICK ONE (`0.5`)
- Border radius: `40` vs `28` vs `32` vs `24` vs `16` — PICK ONE (`28` for sheets, `16` for cards)
- Animation: `fade` vs `slide` vs `none` — PICK ONE (`slide` for sheets, `fade` for menus)
- Width: `94%` vs `80%` vs `100%` — PICK ONE (`94%` max 500px for sheets)
- Close method: `onRequestClose` vs Pressable backdrop vs `X` button — USE ALL THREE

**Fix:** Create a `<StandardSheet>` wrapper:
```tsx
interface StandardSheetProps {
  visible: boolean; onClose: () => void;
  title?: string; children: React.ReactNode;
  height?: 'full' | 'large' | 'medium' | 'small';
  animation?: 'slide' | 'fade';
}
```

---

## 3. 📤 Export System (DUPLICATED x5)

| File | Purpose |
|---|---|
| [`src/components/export/UnifiedExportSheet.tsx`](src/components/export/UnifiedExportSheet.tsx) | Main export (PDF/Image) |
| [`src/components/export/AnalysisExportSheet.tsx`](src/components/export/AnalysisExportSheet.tsx) | Analysis export |
| [`src/components/export/SyllabusExportSheet.tsx`](src/components/export/SyllabusExportSheet.tsx) | Syllabus export |
| [`src/components/exports/UnifiedExportModal.tsx`](src/components/exports/UnifiedExportModal.tsx) | **Another** export modal (different path!) |
| [`src/components/pilot-v2/PilotV2UnifiedExport.tsx`](src/components/pilot-v2/PilotV2UnifiedExport.tsx) | Wraps UnifiedExportSheet |

**Fix:** Merge `UnifiedExportSheet` and `UnifiedExportModal` (different paths: `export/` vs `exports/`). Delete the duplicate.

---

## 4. 🏷️ Add-to-Flashcard (DUPLICATED x2)

| File | Used In |
|---|---|
| [`src/components/flashcards/AddToFlashcardSheet.tsx`](src/components/flashcards/AddToFlashcardSheet.tsx) | Quiz engine, notes, repo |
| [`src/components/AddBlockToFlashcardSheet.tsx`](src/components/AddBlockToFlashcardSheet.tsx) | Notes editor blocks |

**Fix:** Merge both into one unified `AddToFlashcardSheet` that handles both question-based and block-based flashcard creation.

---

## 5. 🔲 Card / List Row Patterns (INCONSISTENT)

Multiple files define their own card row components with varying styles:

| File | Border Radius | Card Type |
|---|---|---|
| [`RepoQuestionCard`](src/components/RepoQuestionCard.tsx) | `16` | Question card |
| [`DeckRow`](src/components/flashcards/DeckRow.tsx) | `16` | Deck card |
| [`CapsuleNoteCard`](src/components/capsule/CapsuleNoteCard.tsx) | `14` | Capsule card |
| [`PilotNoteCard`](src/components/PilotNoteCard.tsx) | `16` | Pilot card |
| [`InkBulletCard`](src/components/hardnotes/InkBulletCard.tsx) | `16` | Hardnote card |
| [`NoteRow`](src/components/notes/NoteRow.tsx) | `14` | Note row |
| [`QuestionActionBar`](src/components/unified/QuestionActionBar.tsx) | inline | Action bar |

**Fix:** Create a `<StandardCard>` component with:
- `variant: 'card' | 'row' | 'compact'`
- Consistent border radius (`16` for cards, `12` for rows)
- Consistent padding (`20` for cards, `14` for rows)
- Consistent shadow/elevation

---

## 6. 🔄 Filter Sheets (DUPLICATED)

| File | Purpose |
|---|---|
| [`FilterSheet`](src/components/flashcards/FilterSheet.tsx) | Flashcard filter |
| [`SortSheet`](src/components/flashcards/SortSheet.tsx) | Flashcard sort |
| [`GlobalSearchBar`](src/components/GlobalSearchBar.tsx) | Has inline filter modal |
| [`Pyq ActiveFiltersBar`](src/components/pyq/ActiveFiltersBar.tsx) | PYQ filter |
| [`SelectionDrawer`](src/components/pyq/SelectionDrawer.tsx) | PYQ selection |

**Fix:** Create a universal `<FilterPanel>` that can be embedded or shown as a sheet — consistent checkboxes, chips, multi-select.

---

## 7. 🎨 Theme / Color Usage (INCONSISTENT)

Many components use **hardcoded colors** instead of theme colors:

```tsx
// BAD — hardcoded
backgroundColor: 'rgba(0,0,0,0.5)'
color: '#7c3aed'
bg: '#ffffff'
```

**Fix:** Audit all components for hardcoded colors. All backgrounds, text colors, borders should use `colors.bg` / `colors.surface` / `colors.textPrimary` / `colors.border` from `useTheme()`.

---

## 8. 📝 Summary of Standardization Needed

| Pattern | Current State | Standard |
|---|---|---|
| **Bottom Sheet** | 3+ different overlay patterns | Single `<StandardSheet>` |
| **Move/ Pick** | 5+ implementations | Single `<DestinationPicker>` |
| **Export** | 5 implementations | Single `<ExportSystem>` |
| **Add to Flashcard** | 2 implementations | Single `<AddToFlashcard>` |
| **Card Component** | 7+ variants | Single `<StandardCard>` |
| **Filter Panels** | 5+ implementations | Single `<FilterPanel>` |
| **Modal Animations** | `fade`/`slide`/`none` mixed | `slide` for sheets, `fade` for menus |
| **Border Radii** | 14/16/24/28/32/40 mixed | 28 for sheets, 16 for cards, 12 for rows |
| **Backdrop Opacity** | 0.35/0.5/0.55/0.6/0.7 mixed | 0.5 |
| **Hardcoded Colors** | Many components | All via `useTheme()` |

---

## 9. Recommended Consolidation Order

1. **Phase A** — Create shared base components:
   - `src/components/common/StandardSheet.tsx` — replaces all bottom sheet boilerplate
   - `src/components/common/StandardCard.tsx` — replaces all card/row variants
   - `src/components/common/DestinationPicker.tsx` — replaces all move/pick modals
   - `src/components/common/FilterPanel.tsx` — replaces all filter/sort sheets

2. **Phase B** — Refactor existing components to use shared primitives:
   - Flashcard modals → `DestinationPicker`
   - Capsule picker → `DestinationPicker`
   - Pilot V2 move → `DestinationPicker`
   - All sheets → `StandardSheet`
   - All cards → `StandardCard`

3. **Phase C** — Merge export system + fix hardcoded colors
