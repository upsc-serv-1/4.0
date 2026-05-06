# HARDNOTES — Complete Bug Fixes + Feature Upgrade Instructions
# For: emergent.sh AI agent
# Codebase: React Native / Expo app (TypeScript)

---

## PART 1 — BUG FIXES (Do these first, in order)

---

### BUG FIX 1 — Double folder creation when long-pressing a folder
**File:** `src/components/hardnotes/HardnotesSidebar.tsx`

**Problem:** In `renderFolder`, `onLongPress` calls `setCreating({ parentId: n.id })`. But `onBlur` on the TextInput calls `commitNewFolder()` which saves AND the user presses Enter which ALSO triggers `commitNewFolder()`. This creates two folders.

**Fix:** In `commitNewFolder`, add a guard so it only runs once:

```typescript
// Add this ref at the top of the component:
const committingRef = useRef(false);

// Replace commitNewFolder with this:
const commitNewFolder = async () => {
  if (committingRef.current) return;
  committingRef.current = true;
  const title = newName.trim();
  setCreating(null);
  setNewName('');
  if (!title) {
    committingRef.current = false;
    return;
  }
  try {
    await HardnotesService.createFolder(userId, title, creating?.parentId ?? null);
    onNodesChanged();
  } catch (e: any) {
    Alert.alert('Could not create folder', e?.message || '');
  } finally {
    committingRef.current = false;
  }
};
```

Also change the TextInput's `onBlur` and `onSubmitEditing` so only one of them fires:
```tsx
// In the TextInput for new folder:
onSubmitEditing={commitNewFolder}
onBlur={() => {
  // Delay so onSubmitEditing fires first
  setTimeout(() => commitNewFolder(), 150);
}}
```

---

### BUG FIX 2 — Sidebar shows folder list wrong; right pane shows wrong content
**File:** `app/(tabs)/hardnotes.tsx`

**Problem:** The right pane `NotesGrid` shows all root folders AND notes even when a folder is selected. On "All Notes" it should show "Unfiled" notes only (notes with no parent folder). The `folderMeta` text showing "X folders · Y notes" is developer info — remove it.

**Fix in `hardnotes.tsx`:**

```typescript
// Replace the childNotes useMemo:
const childNotes = useMemo(() => {
  if (selectedFolderId === null) {
    // "All Notes" = only show unfiled notes (notes whose parent node has no folder)
    return nodes.filter(n => isLeaf(n) && !n.parent_id);
  }
  return (tree.get(selectedFolderId) || []).filter(isLeaf);
}, [tree, nodes, selectedFolderId]);
```

**Also remove this line from the JSX** (developer geek info — don't show to users):
```tsx
// DELETE THIS:
<Text style={[styles.folderMeta, { color: colors.textTertiary }]}>
  {filteredChildFolders.length} folder{filteredChildFolders.length === 1 ? '' : 's'} ·{' '}
  {filteredChildNotes.length} note{filteredChildNotes.length === 1 ? '' : 's'}
</Text>
```

---

### BUG FIX 3 — Drawing only works on left half of card; right half is undrawable
**File:** `src/components/hardnotes/InkBulletCard.tsx`

**Problem:** The `inkSurface` and `canvasOverlay` both use `width: contentWidth - 4`. But `contentWidth` is calculated in `editor.tsx` as `Math.min(winW - 8, 740)` which does not account for the card's `marginHorizontal: 12` and `paddingHorizontal` from the card. The gesture surface is narrower than the card, so only the left half is catchable.

**Fix in `editor.tsx`:** Change contentWidth calculation to subtract the card margins:
```typescript
// Old:
const contentWidth = Math.min(winW - 8, 740);
// New (subtract 12px margin on each side + 4px border):
const contentWidth = Math.min(winW - 32, 740);
```

**Fix in `InkBulletCard.tsx`:** The gesture surface must cover the FULL card. Remove the `width` constraint from inkSurface and canvasOverlay — use `StyleSheet.absoluteFillObject` instead:

```typescript
// Replace canvasOverlay style:
canvasOverlay: { 
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 5 
},
// Replace inkSurface style:
inkSurface: { 
  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 6, 
  backgroundColor: 'transparent' 
},
```

And update the Canvas to use `style={{ flex: 1 }}` with a parent View that fills:
```tsx
// In the canvas overlay View:
<View pointerEvents="none" style={[styles.canvasOverlay]}>
  <Canvas style={StyleSheet.absoluteFillObject}>
    {/* strokes */}
  </Canvas>
</View>
```

Also in `onLayoutBody`, store both width AND height:
```typescript
const [cardSize, setCardSize] = useState({ w: 0, h: MIN_CARD_HEIGHT });
const onLayoutBody = (e: LayoutChangeEvent) => {
  const h = Math.max(MIN_CARD_HEIGHT, Math.round(e.nativeEvent.layout.height));
  const w = Math.round(e.nativeEvent.layout.width);
  setCardSize(prev => (Math.abs(h - prev.h) > 1 || Math.abs(w - prev.w) > 1) ? { w, h } : prev);
};
// Use cardSize.h everywhere you used cardH
// Pass cardSize.w to the Canvas width for correct stroke coordinate space
```

---

### BUG FIX 4 — Single tap on card should NOT open text edit mode
**File:** `src/components/hardnotes/InkBulletCard.tsx`

**Problem:** `<TouchableOpacity onPress={beginEdit}>` fires on single tap, immediately opening keyboard. Should require double-tap OR pressing the pencil (T) button in toolbar.

**Fix:** Replace the single-tap TouchableOpacity with a double-tap handler:
```typescript
import { Pressable } from 'react-native';

// Replace:
// <TouchableOpacity onPress={beginEdit} disabled={lens === 'focus' || point.locked} activeOpacity={0.7}>
// With:
<Pressable 
  onPress={() => {}} // single tap does nothing
  onLongPress={beginEdit} // long press OR double tap opens edit
  delayLongPress={200}
  disabled={lens === 'focus' || point.locked}
>
```

Or better, use `numberOfTaps: 2` via TapGesture from react-native-gesture-handler:
```typescript
const doubleTap = Gesture.Tap()
  .numberOfTaps(2)
  .onEnd(() => { runOnJS(beginEdit)(); });
```

Wrap the RenderHtml view with `<GestureDetector gesture={doubleTap}>`.

---

### BUG FIX 5 — Add "T" (text mode) button to the Ink toolbar
**File:** `src/components/hardnotes/InkToolbar.tsx`

**Problem:** There's no dedicated "enter text mode" button. User requested a "T" button in the toolbar.

**Fix:** Add a `onTextMode` prop and a "T" button:

```typescript
// Add to Props interface:
onTextMode?: () => void;
isTextMode?: boolean;

// Add T button in the toolbar JSX after the tools group:
{onTextMode && (
  <>
    <View style={[s.divider, { backgroundColor: colors.border }]} />
    <ToolBtn active={!!isTextMode} onPress={() => { onTextMode(); ping(); }} testID="ink-tool-text">
      <Text style={{ 
        fontSize: 15, fontWeight: '900', 
        color: isTextMode ? colors.primary : colors.textTertiary 
      }}>T</Text>
    </ToolBtn>
  </>
)}
```

In `editor.tsx`, pass this to InkToolbar:
```typescript
// In the InkToolbar usage:
onTextMode={() => {
  // Find the currently visible card and begin editing it
  // Or set a global "text mode active" state that cards check
}}
```

---

### BUG FIX 6 — Bold/italic/formatting must show in edit mode too (TextInput shows raw HTML)
**File:** `src/components/hardnotes/InkBulletCard.tsx`

**Problem:** When `editing=true`, a plain `TextInput` shows raw HTML like `<b>word</b>`. User expects to see bold text while editing.

**Fix:** In edit mode, show a styled preview ABOVE the TextInput, OR switch to a rich-text input. Simplest fix: keep TextInput for raw editing but add a live preview:

```tsx
{editing ? (
  <>
    {/* Live HTML preview while editing */}
    <View style={{ marginBottom: 6, opacity: 0.7 }}>
      <RenderHtml
        source={{ html: htmlFor(draft, isHeading) }}
        contentWidth={contentWidth - 56}
        baseStyle={{ fontSize: 12, color: colors.textTertiary }}
        tagsStyles={{
          b: { fontWeight: '800' as const },
          i: { fontStyle: 'italic' as const },
          mark: { borderRadius: 3 },
        }}
      />
    </View>
    <TextInput ... />
  </>
)}
```

---

### BUG FIX 7 — App crash + screen flicker on double-tap / keyboard open
**File:** `app/hardnotes/editor.tsx`

**Problem:** `KeyboardAvoidingView` with `behavior="padding"` on iOS causes the entire ScrollView to jump violently when keyboard appears, crashing or flickering.

**Fix:** Change `KeyboardAvoidingView` behavior and add keyboard offset:
```tsx
// Replace:
<KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

// With:
<KeyboardAvoidingView 
  style={{ flex: 1 }} 
  behavior={Platform.OS === 'ios' ? 'height' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
>
```

Also on the ScrollView add:
```tsx
<ScrollView
  keyboardDismissMode="interactive"
  automaticallyAdjustKeyboardInsets={true}  // iOS 15+
  keyboardShouldPersistTaps="handled"
  ...
>
```

---

### BUG FIX 8 — Save debounce too aggressive (syncing every stroke to server)
**File:** `src/components/hardnotes/useHardnoteDoc.ts`

**Problem:** `scheduleSave` has a 450ms debounce. Every pen stroke calls `addStroke` → `scheduleSave`. With fast drawing, this fires dozens of server writes per second.

**Fix:** Increase debounce to 3000ms (3 seconds) for strokes, and save to server only on note close:

```typescript
// Change debounce time:
// Old: }, 450);
// New:
}, 3000); // 3 second debounce — prevents server spam

// Add a flushSave function for use when the user navigates away:
const flushSave = useCallback(async () => {
  if (!noteId) return;
  if (saveTimer.current) {
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
  }
  setSaving(true);
  const { error } = await supabase.from('user_notes').update({
    items: points,
    updated_at: new Date().toISOString(),
  }).eq('id', noteId);
  if (error) console.warn('[useHardnoteDoc] flush save failed', error);
  if (mounted.current) setSaving(false);
}, [noteId, points]);

// Return flushSave from the hook
```

In `editor.tsx`, call `flushSave` before back navigation:
```typescript
// In the back button handler:
const handleBack = async () => {
  await doc.flushSave();
  router.back();
};
// Replace onPress={() => router.back()} with onPress={handleBack}
```

---

### BUG FIX 9 — Focus mode width too narrow (only 2 inches wide, not full screen)
**File:** `app/hardnotes/editor.tsx`

**Problem:** In the ScrollView, when `lens === 'focus'`:
```tsx
lens === 'focus' && { maxWidth: 720, alignSelf: 'center', paddingTop: 12 }
```
This limits content to 720px centered, but on iPad that can look very narrow if window is wider. The `contentWidth` calculation already limits to 740px total — this is fine. The real issue is the InkBulletCard in focus mode uses the same limited width.

**Fix:** In focus mode, make cards span full width — remove `maxWidth` on focus scroll:
```typescript
// In editor.tsx ScrollView contentContainerStyle:
// Old: lens === 'focus' && { maxWidth: 720, alignSelf: 'center', paddingTop: 12 }
// New: lens === 'focus' && { width: '100%', paddingTop: 12, paddingHorizontal: 24 }
```

**Fix in InkBulletCard.tsx focus rendering:** In focus mode, use full screen width for the RenderHtml:
```typescript
// In InkBulletCard, the RenderHtml contentWidth prop:
// Old: contentWidth={contentWidth - 56}
// New: contentWidth={lens === 'focus' ? contentWidth : contentWidth - 56}
```

And in editor.tsx, for focus mode pass a wider contentWidth:
```typescript
const contentWidth = lens === 'focus' 
  ? winW - 48   // full screen minus padding
  : Math.min(winW - 32, 740);
```

---

### BUG FIX 10 — Export from quiz engine adds yellow background; don't add it automatically
**File:** `app/hardnotes/editor.tsx` and `src/components/hardnotes/useHardnoteDoc.ts`

**Problem 1:** In `useHardnoteDoc.ts`, legacy `base_layer` type is forced to `color: '#f59e0b'` (yellow). This yellow color is used as the left-border accent on the card AND gets exported as a highlight background.

**Fix in `useHardnoteDoc.ts`:** Don't force yellow color on base_layer — let it default:
```typescript
// In normalize(), base_layer case:
// Old: color: '#f59e0b',
// New: color: it.color || undefined,  // don't force yellow
```

**Problem 2:** In `editor.tsx`, the `exportPayload` maps all points as type `'highlight'` which adds colored backgrounds.

**Fix in `editor.tsx`:** Change export type from `'highlight'` to `'point'` for non-heading items, and only apply color if user explicitly set one:
```typescript
blocks.push({
  id: p.id,
  type: p.color ? 'highlight' : 'point',  // only highlight if user chose a color
  text: p.text,
  color: p.color,  // don't inject a color if there isn't one
  sourceLabel: p.source,
});
```

**Problem 3:** During export, ask user if they want highlight. Add a prompt in the export flow:
In `editor.tsx` `exportPayload` calculation, add an `includeHighlights` toggle. When user opens export sheet, show a toggle: "Include color highlights: YES / NO". Pass this to the export engine.

---

### BUG FIX 11 — Remove stroke count badge (the "Skia below" developer info)
**File:** `src/components/hardnotes/InkBulletCard.tsx`

**Problem:** The `strokeBadge` shows `{strokes.length}` count which is developer geek info.

**Fix:** Delete the entire strokeBadge block:
```tsx
// DELETE THIS ENTIRE BLOCK:
{strokes.length > 0 && (
  <View style={[styles.strokeBadge, { backgroundColor: '#0ea5e91A' }]}>
    <Sparkles size={9} color="#0ea5e9" />
    <Text style={styles.strokeBadgeText}>{strokes.length}</Text>
  </View>
)}
```

---

### BUG FIX 12 — Edit button on card expands then crashes (iPad hangs)
**File:** `src/components/hardnotes/InkBulletCard.tsx`

**Problem:** The pencil edit button calls `beginEdit()` which sets `editing=true` → TextInput autoFocus → keyboard → KeyboardAvoidingView re-layout → crash.

**Fix:** Same as BUG FIX 7 (KeyboardAvoidingView fix). Additionally, in `beginEdit`:
```typescript
const beginEdit = () => {
  if (lens === 'focus') return;
  if (point.locked) return;
  // Use InteractionManager to defer state update until after any animations
  InteractionManager.runAfterInteractions(() => {
    setDraft(point.text);
    setEditing(true);
  });
};
```
Import `InteractionManager` from `react-native`.

---

### BUG FIX 13 — Sidebar: add tree-line visual hierarchy (IT folder tree style)
**File:** `src/components/hardnotes/HardnotesSidebar.tsx`

**Problem:** No visual tree lines connecting parent-child folders.

**Fix:** In `renderFolder`, add depth-indicator lines:
```tsx
// Before the folder row TouchableOpacity, add connector lines:
{depth > 0 && (
  <View style={{
    position: 'absolute',
    left: 12 + (depth - 1) * 16 + 7,
    top: 0, bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  }} />
)}
{depth > 0 && (
  <View style={{
    position: 'absolute',
    left: 12 + (depth - 1) * 16 + 7,
    top: '50%',
    width: 9,
    height: 1,
    backgroundColor: colors.border,
  }} />
)}
```

Make the row a `View` with `position: 'relative'` wrapper to hold these lines.

---

### BUG FIX 14 — NotesGrid: add list/grid toggle, smaller grid tiles
**File:** `src/components/hardnotes/NotesGrid.tsx`

**Problem:** Only grid view exists. User wants list view option and smaller grid tiles.

**Fix:**
1. Add `viewMode` state: `'grid' | 'list'`, with a toggle button.
2. In grid mode, use `numColumns={4}` (was 3) and reduce thumbnail height from 130 to 90.
3. In list mode, use `numColumns={1}` and render as a horizontal row with icon + title + date.

```tsx
// Add state:
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

// Add toggle button in header area of NotesGrid:
<TouchableOpacity onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}>
  {viewMode === 'grid' ? <List size={18} /> : <Grid size={18} />}
</TouchableOpacity>

// Grid tiles smaller:
thumb: { height: 90, ... }  // was 130

// List row:
if (viewMode === 'list') {
  return (
    <TouchableOpacity style={[listRow, ...]}>
      <Folder size={20} />
      <View>
        <Text>{item.node.title}</Text>
        <Text>{date}</Text>
      </View>
      <ChevronRight size={16} />
    </TouchableOpacity>
  );
}
```

---

## PART 2 — UI/UX UPGRADES (Notability/GoodNotes parity)

These are suggested improvements to implement after the bug fixes.

---

### UPGRADE 1 — Ink Toolbar: Make it truly floating and draggable
**File:** `app/hardnotes/editor.tsx`

Right now the InkToolbar is fixed at `bottom: 26`. Make it fully draggable using `react-native-gesture-handler` `PanGesture` + `Animated.View` so the user can drag it anywhere on screen (like Notability's floating toolbar).

```typescript
import Animated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';

const toolbarX = useSharedValue(0);
const toolbarY = useSharedValue(0);

const dragGesture = Gesture.Pan().onUpdate(e => {
  toolbarX.value = e.translationX;
  toolbarY.value = e.translationY;
});

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ translateX: toolbarX.value }, { translateY: toolbarY.value }]
}));

// Wrap InkToolbar in:
<GestureDetector gesture={dragGesture}>
  <Animated.View style={[styles.inkDock, animatedStyle]} pointerEvents="box-none">
    <InkToolbar ... />
  </Animated.View>
</GestureDetector>
```

---

### UPGRADE 2 — Add larger highlighter sizes
**File:** `src/components/hardnotes/InkToolbar.tsx`

Extend WIDTHS array for highlighter:
```typescript
const HIGHLIGHTER_WIDTHS = [8, 14, 22]; // much wider than pen
// In the width section, show different sizes based on tool:
const activeWidths = tool === 'highlighter' ? HIGHLIGHTER_WIDTHS : WIDTHS;
```

---

### UPGRADE 3 — Swipe-to-delete on note cards in the grid
**File:** `src/components/hardnotes/NotesGrid.tsx`

Wrap each note card in a swipeable component (`react-native-gesture-handler` Swipeable) with a red delete action on swipe-left. This matches Notability UX.

---

### UPGRADE 4 — Long-press note card for context menu (pin, move, duplicate, delete)
**File:** `src/components/hardnotes/NotesGrid.tsx`

On `onLongPress` on any card, show a bottom sheet with options:
- 📌 Pin / Unpin
- 📁 Move to folder
- 📋 Duplicate
- 🗑 Delete

---

### UPGRADE 5 — Pinch-to-zoom on Ink canvas
**File:** `src/components/hardnotes/InkBulletCard.tsx`

Add a `PinchGesture` that scales the canvas view. Store zoom level in state. When zoomed in, strokes are drawn at the zoomed coordinate space. This allows precision annotation like Notability.

---

### UPGRADE 6 — Add "Notebook cover" image to note cards in grid
**File:** `src/components/hardnotes/NotesGrid.tsx`

Instead of the generic line-pattern thumbnail, render a small Skia snapshot of the first card's actual strokes as the thumbnail. This makes the grid look like GoodNotes.

---

### UPGRADE 7 — Export: Ask highlight preference before exporting
**File:** `app/hardnotes/editor.tsx`

Before opening the UnifiedExportSheet, show a quick Alert/ActionSheet:
```typescript
Alert.alert(
  'Export Hardnote',
  'Include color highlights?',
  [
    { text: 'Yes, with highlights', onPress: () => setExportOpen(true, true) },
    { text: 'Clean (no highlights)', onPress: () => setExportOpen(true, false) },
    { text: 'Cancel', style: 'cancel' },
  ]
);
```
Pass `includeHighlights` boolean to the export payload builder.

---

### UPGRADE 8 — Add "Today's Notes" / recents section in the All Notes view
**File:** `app/(tabs)/hardnotes.tsx`

When `selectedFolderId === null`, show a horizontal scroll of the 5 most recently edited notes at the top of the right pane (like GoodNotes recents). Sorted by `updated_at` descending.

---

### UPGRADE 9 — Glance lens: add "Add below" + button after each bullet
**File:** `src/components/hardnotes/InkBulletCard.tsx`

Show a faint `+` button between bullets (visible on hover/tap). Tapping inserts a new blank point directly after this one using `doc.insertPoint(p.id, {})`. This matches Notability's flow of typing.

---

### UPGRADE 10 — Ink lens: add Undo/Redo
**File:** `src/components/hardnotes/useHardnoteDoc.ts` + `InkToolbar.tsx`

Add stroke history stack. Each `addStroke` pushes to a `strokeHistory` array. `undoStroke` pops the last stroke. Pass `onUndo` and `canUndo` props to InkToolbar (the props already exist but are not wired up in editor.tsx).

---

## SUMMARY OF FILES TO EDIT

| File | Bugs Fixed | Upgrades |
|------|-----------|---------|
| `app/(tabs)/hardnotes.tsx` | BF2 (right pane content, remove geek meta) | U8 |
| `app/hardnotes/editor.tsx` | BF3 (contentWidth), BF7 (keyboard crash), BF8 (save flush on back), BF9 (focus width), BF10 (export highlight) | U1, U7 |
| `src/components/hardnotes/HardnotesSidebar.tsx` | BF1 (double folder), BF13 (tree lines) | — |
| `src/components/hardnotes/NotesGrid.tsx` | BF14 (list/grid toggle, smaller tiles) | U3, U4, U6, U8 |
| `src/components/hardnotes/InkBulletCard.tsx` | BF3 (full drawable area), BF4 (no single-tap edit), BF6 (bold in edit mode), BF11 (remove stroke count), BF12 (edit crash) | U5, U9 |
| `src/components/hardnotes/InkToolbar.tsx` | BF5 (T button) | U2 |
| `src/components/hardnotes/useHardnoteDoc.ts` | BF8 (3s debounce + flushSave), BF10 (remove forced yellow) | U10 |

---

## CRITICAL NOTES FOR EMERGENT.SH

1. **Import `InteractionManager`** from `react-native` in InkBulletCard.tsx for BF12.
2. **Import `useRef`** in HardnotesSidebar.tsx for BF1.
3. The `GestureDetector` + `Gesture` imports are already present in InkBulletCard.tsx.
4. **Do NOT** change the Supabase schema — all fixes are purely frontend.
5. The `scheduleSave` in `useHardnoteDoc.ts` uses `setTimeout` — keep that pattern, just change the delay from 450 to 3000.
6. The `contentWidth` prop passed to `InkBulletCard` from `editor.tsx` must be updated FIRST (BF3) before the canvas overlay fix works.
7. For Focus mode width fix (BF9), the `contentWidth` needs to be passed as a prop from editor to the card — it already is, so just change the calculation in editor.tsx.

