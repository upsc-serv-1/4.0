# Pilot V2 — UI uniformity audit

_Static scan of `src/` (195 `.ts/.tsx` files). Generated with
`/tmp/uniformity_scan.mjs`._

This audit lists every place where the same UI primitive (button, card,
sheet, modal, accordion, input, color) is implemented in materially
different ways. Each section ends with the **recommended single
canonical pattern** to migrate to.

---

## 1. `borderRadius` is using **29 distinct values**

Buttons, chips, cards, inputs, sheets and pills should all draw from a
small, predictable scale.  Today the codebase ships:

| value (px) | sites | value (px) | sites |
|---:|---:|---:|---:|
| 0  |  1 | 16 | 39 |
| 2  | 16 | 17 |  1 |
| 3  |  9 | 18 | 21 |
| 4  | 13 | 20 | 26 |
| 5  | 11 | 22 |  4 |
| 6  | 21 | 24 | 15 |
| 7  |  5 | 26 |  1 |
| 8  | 67 | 28 |  5 |
| 9  |  6 | 34 |  2 |
| 10 | 61 | 40 |  6 |
| 11 |  4 | 48 |  1 |
| 12 | 79 | 50 |  1 |
| 13 |  3 | 99 |  2 |
| 14 | 34 | 999 / 9999 (= pill) | 10 |

**Recommendation — collapse to a 5-step radius scale**

```ts
// src/theme/radii.ts
export const radii = {
  xs: 4,     // chips, dense badges
  sm: 8,     // small buttons, inputs
  md: 12,    // standard buttons, cards
  lg: 20,    // sheet bodies, large cards
  pill: 999, // capsule chips, FABs
};
```

> 75 % of all sites already use 8 / 10 / 12 / 14 / 16 — collapsing 10→8,
> 14→12, 16→20 and 18→20 covers the majority with 4 follow-up PRs.

---

## 2. `<Modal>` animation is split 2 ways

| `animationType` | files |
|---|---:|
| `slide` | 10 |
| `fade`  | 20 |

There is no rule for when to pick which.

**Recommendation:**
- `fade` for transient confirmation / centred dialogs.
- `slide` for full-height bottom sheets that come up from the edge.
- Codify in a single `<Sheet variant="bottom" | "center">` wrapper and
  delete every direct `<Modal>` inside `src/components`.

---

## 3. Accordion / collapsible — **3 different mechanisms**

| file | technique |
|---|---|
| `src/components/CollapsibleHeaderContainer.tsx` | `react-native-collapsible-tab-view` |
| `src/components/common/CollapsibleHeaderContainer.tsx` | `react-native-collapsible-tab-view` (duplicate file!) |
| `src/components/pyq/SelectionDrawer.tsx` | manual chevron-rotate + height transition |

There are also section-style "expand on tap" rows scattered inside
`PilotV2Dashboard`, `FilterSheet`, `FolderAlgorithmModal` that animate
height by toggling JSX rather than using a shared component.

**Recommendation — single `<Accordion>` primitive**

```tsx
// src/components/common/Accordion.tsx
<Accordion
  title="Subjects"
  defaultOpen
  testID="subj-acc"
>
  <SubjectList />
</Accordion>
```

Built once on `react-native-reanimated` `withTiming(height)` + the
existing `ChevronDown` rotate. Migrate every ad-hoc expand/collapse to
this component and delete the duplicate `CollapsibleHeaderContainer`
(one of the two has been dead-code since the v2.2 refactor).

---

## 4. Bottom-sheet top radius is **9 different values**

Every bottom sheet in the app rolls its own `borderTopLeftRadius` /
`borderTopRightRadius` constant:

| file | radius |
|---|---:|
| `src/components/pilot-v2/PilotV2AIChat.tsx` | **2** ⚠ outlier |
| `src/components/pilot-v2/PilotV2Dashboard.tsx` | 12 |
| `src/components/hardnotes/NotesGrid.tsx` | 18 |
| `src/components/ai/AIModelSwitcher.tsx` | 20 |
| `src/components/flashcards/FilterSheet.tsx` | 20 |
| `src/components/flashcards/FolderAlgorithmModal.tsx` | 20 |
| `src/components/flashcards/SortSheet.tsx` | 20 |
| `src/components/pyq/DownloadManager.tsx` | 20 |
| `src/components/GlobalCreateFAB.tsx` | 22 |
| `src/components/AIQuickActionButton.tsx` | 24 |
| `src/components/AddBlockToFlashcardSheet.tsx` | 24 |
| `src/components/exports/UnifiedExportModal.tsx` | 24 |
| `src/components/flashcards/CardOverflowMenu.tsx` | 24 |
| `src/components/pilot-v2/PilotV2SaveSheet.tsx` | 28 |
| `src/components/export/AnalysisExportSheet.tsx` | 28 |
| `src/components/export/UnifiedExportSheet.tsx` | 28 |
| `src/components/hardnotes/QuizCaptureSheet.tsx` | 28 |
| `src/components/GlobalSearchBar.tsx` | 32 |
| `src/components/hardnotes/QuizToHardnotesPicker.tsx` | 32 |

**Recommendation:** standardise on **24 px** (matches Material 3 + most
existing sheets) and route every sheet through a `<BottomSheet>` wrapper
so the radius lives in exactly one place.

The `PilotV2AIChat` value of **2** is almost certainly a bug — visually
indistinguishable from a square modal.

---

## 5. `<TextInput>` does not share a shape

57 of the 59 `<TextInput>` instances have **no explicit height or radius
styling**, which means they render at the OS default (different on iOS,
Android and web). Two outliers:

| file | height | radius |
|---|---:|---:|
| `src/components/auth/...` | 36 | 28 |
| `src/components/pilot-v2/PilotV2QuickAdd.tsx` | 54 | 18 |

**Recommendation — `<AppTextInput>` primitive**

```tsx
// height: 44 (touch-target compliant), radius: radii.sm (8)
<AppTextInput value={x} onChangeText={setX} placeholder="..." />
```

Wraps `TextInput`, applies the theme colours and the radius scale, and
makes the OS-default-height divergence go away.

---

## 6. **234** distinct hex colors hard-coded outside the theme

The theme system in `src/context/ThemeContext.tsx` already exports
`colors.primary`, `.surface`, `.surfaceStrong`, `.border`, etc. Despite
that, **234 hex literals** are sprinkled across feature components.
Top offenders:

| color | uses | should be |
|---|---:|---|
| `#fff` / `#ffffff` | 189 | `colors.surface` (light) / hard-coded only inside dark-mode-fixed labels |
| `#5b4efa` | 69 | `colors.primary` |
| `#0f172a` / `#000` | 90 | `colors.textPrimary` |
| `#ef4444` | 52 | `colors.danger` (add to theme) |
| `#f59e0b` | 45 | `colors.warning` (add to theme) |
| `#10b981` / `#22c55e` | 49 | `colors.success` |
| `#7c3aed` / `#8b5cf6` | 39 | `colors.accent` |
| `#e5e7eb` / `#e2e8f0` / `#f1f5f9` / `#f8fafc` | 66 | `colors.border` / `colors.surfaceStrong` |
| `#3b82f6` / `#2563eb` / `#0ea5e9` | 45 | `colors.info` |
| `#fde68a` / `#fee2e2` / `#eeecff` | 34 | pastel tokens (already exist as `BLOCK_PASTEL_BY_TYPE`) |

**Recommendation:**
1. Add `danger`, `warning`, `success`, `info`, `accent` to `ThemeContext`.
2. Lint rule (regex `['"]\#[0-9a-fA-F]{3,8}['"]`) to fail CI on any new
   hard-coded colour outside `src/context/`, `src/theme/` and explicit
   palette consts.

---

## 7. "Card" border+radius is mostly aligned but has 4 outliers

| signature | files using |
|---|---:|
| `bw=1, br=8`  | 11 |
| `bw=1, br=12` | 10 |
| `bw=1, br=10` |  9 |
| `bw=1, br=16` |  2 |
| `bw=1, br=14` |  2 |
| `bw=1.5, br=4` |  2 ⚠ |
| `bw=1.5, br=14` |  1 ⚠ |
| `bw=1.5, br=8` |  1 ⚠ |
| `bw=0.5, br=20` |  1 ⚠ |
| `bw=1, br=4` |  1 |
| `bw=1, br=6` |  1 |

**Recommendation:** `bw=1, br=12` is the de-facto standard (used in 30+
sites if you collapse the 8 / 10 variants per §1). Migrate the four
`bw=1.5` and `bw=0.5` outliers to the standard.

---

## 8. Buttons (qualitative — not captured automatically)

The scanner doesn't yet catch this, but a manual review surfaced:

- **Primary CTA** appears as: solid filled (`PilotV2QuickAdd` New button),
  pill outlined (`PilotV2Dashboard` chips), gradient
  (`GlobalCreateFAB`), iconified circle (`AIQuickActionButton`).
- **Destructive button** is variously: red text on transparent
  (`CardOverflowMenu` Delete row) vs. red filled + white text
  (`PilotV2EditorView` confirm-delete). Pick one.
- **Secondary / ghost button** is rendered as:
  `surfaceStrong` background (most), `border-only` no fill (some flashcard
  filters), `8 % primary alpha` fill (`PilotV2UnifiedExport` Select-All).

**Recommendation — `<AppButton variant="primary"|"secondary"|"ghost"|"danger" size="sm"|"md"|"lg" />`** —
single component, single styles object, one source of truth for radius,
height (32 / 40 / 48), padding, typography weight. Migrate piecemeal.

---

## 9. Chevron-rotate icon direction is inconsistent

Pilot V2 expand/collapse rows rotate the chevron by `180°`
(`PilotV2Dashboard.tsx` subject group), but the same gesture in
`pyq/SelectionDrawer.tsx` uses `90°` and `lookup` rows in
`flashcards/FilterSheet.tsx` swap the icon component (`ChevronDown` →
`ChevronUp`) instead of rotating.

**Recommendation:** always rotate one icon (`ChevronDown`) by
`isOpen ? 180 : 0` using `react-native-reanimated`.

---

## 10. Duplicate / dead modules

Found while running the radius/accordion scan:

- `src/components/CollapsibleHeaderContainer.tsx` and
  `src/components/common/CollapsibleHeaderContainer.tsx` are byte-similar
  duplicates. Keep the `common/` one and delete the root copy (only one
  is imported anywhere).
- `src/components/exports/UnifiedExportModal.tsx` and
  `src/components/export/UnifiedExportSheet.tsx` are two different
  implementations of the same idea (note the singular vs plural folder
  name). The Pilot V2 surface uses the `export/` (singular) one;
  `exports/UnifiedExportModal.tsx` is reachable only from a deprecated
  Capsule code-path and is a candidate for deletion in the next clean-up
  pass.

---

## Suggested follow-up roadmap

| Priority | Task | Estimated touch |
|---|---|---|
| P0 | Fix `PilotV2AIChat` sheet radius `2 → 24` | 1 line |
| P0 | Add `danger / warning / success / info / accent` to `ThemeContext` | small |
| P1 | Create `src/theme/radii.ts` and replace top-3 outlier radii (sweep) | medium |
| P1 | Build `<BottomSheet>` wrapper, migrate the 19 sheets one PR at a time | large |
| P2 | Build `<AppButton>` primitive + ESLint rule against raw hex literals | large |
| P2 | Build `<AppTextInput>` + `<Accordion>` primitives | medium |
| P3 | Delete duplicate `CollapsibleHeaderContainer` and `exports/UnifiedExportModal.tsx` | small |

---

_Audit produced by `/tmp/uniformity_scan.mjs`. Re-run after each pass to
confirm the diff shrinks._
