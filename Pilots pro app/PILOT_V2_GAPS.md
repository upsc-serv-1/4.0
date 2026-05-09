# ⚠️ PILOT V2 - CLAUDE MISSING FEATURES & USER ANNOTATION GAPS

This document contains the exact ditto missing features and gaps identified by Claude, followed by the specific Phase 3 Pencil Annotation and Active Recall Washi Tape requirements. The builder agent must resolve these items during implementation.

---

## ❌ CLAUDE REPORTED GAPS & MISSING FEATURES (VERBATIM)

#### 3. **SEARCH/FILTERING** ✅
**Status:** FULLY IMPLEMENTED
**Location:** `PilotV2NoteList.tsx` lines 203-205
**What you have:**
```typescript
const globalSearch = state.view.search;
filteredList = filteredList.filter(n =>
  (!globalSearch || n.title.toLowerCase().includes(globalSearch.toLowerCase()))
);
```
**Visible in UI:** Search box in NoteList
**Status:** ✅ **WORKS** - filters notebooks by title
**Gap:** Only searches NOTEBOOK titles, not block contents or tags


#### 5. **EXPORT** ✅
**Status:** PARTIALLY IMPLEMENTED
**Location:** `PilotV2GlanceView.tsx` lines 134-137
**What you have:**
```typescript
const handleExport = async () => {
  await Clipboard.setStringAsync(text);
  Alert.alert('Note exported', 'Plain-text export copied to clipboard');
};
```
**What it does:** Copies entire notebook as plain text
**Status:** ⚠️ **BASIC ONLY**
- ✅ Exports to clipboard as plain text
- ❌ No PDF export
- ❌ No block-by-block export
- ❌ No Markdown export
- ❌ No Word export


#### 6. **BULK OPERATIONS** ✅
**Status:** PARTIALLY IMPLEMENTED
**Location:** `PilotV2NoteList.tsx` lines 125-170
**What you have:**
```typescript
const bulkWithNodes()      // Get selected items
const bulkMoveToTrash()    // Bulk archive
const bulkRestore()        // Bulk restore
const bulkPin()            // Bulk pin
const bulkDeletePermanently() // Bulk permanent delete
```
**Visible in UI:** Checkboxes + bulk action buttons
**Status:** ⚠️ **PARTIALLY WORKS**
- ✅ Bulk archive/restore/delete
- ❌ No bulk move to another notebook
- ❌ No bulk tag operations (no tagging system yet)


#### 8. **AI CHAT** ✅
**Status:** EXISTS
**Location:** `PilotV2AIChat.tsx` (570 lines)
**What you have:**
```typescript
// Full AI chat system integrated into Pilot V2
// Can ask AI about notes
// Can get explanations
```
**Status:** ✅ **WORKS** but purpose unclear in context


#### 9. **LOCAL AUTO-SAVE WITH DEBOUNCE** ✅
**Status:** FULLY IMPLEMENTED
**Location:** `PilotV2EditorView.tsx` lines 168-188
**What you have:**
```typescript
const scheduleSave = (nextBlocks, nextTitle) => {
  setSavingState('saving');
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(async () => {
    // Save to Supabase after 600ms of no edits
    await savePilotV2NoteContent(note.id, { blocks, version: 1 });
  }, 600);
};
```
**Status:** ✅ **WORKS WELL**
- ✅ Debounced save (600ms)
- ✅ Saving state indicator
- ❌ NOT true "local-first" (saves directly to server)



## ❌ **NOT IMPLEMENTED / GAPS**

### 1. **TAGGING SYSTEM** ❌
**Status:** COMPLETELY MISSING
**Why it matters:** With 50+ blocks, need quick filtering
**What's needed:**
- Block-level tags (not just notebooks)
- Tag suggestions/auto-tag
- Filter by tags
- UI in editor to add tags


### 3. **OFFLINE SYNC & RELIABILITY** ❌
**Status:** MISSING
**Current issue:**
```typescript
// SaveSheet line 170:
const handleSave = async () => {
  // If network fails here → data lost or stuck
  // No backup, no retry, no offline queue
}
```

*What's missing:*
- ❌ Offline queue (save to local, sync when online)
- ❌ Retry mechanism on network failure
- ❌ Conflict resolution
- ❌ Backup/recovery
- ❌ Sync status indicator
- ❌ "Pending sync" badge

**Where to add:** New `SyncManager.ts` service



### 5. **SMART BLOCK MATCHING** ❌
**Status:** MISSING
**What you wanted:**
When importing from quiz:
- Suggest "GDP Implications" block automatically
- Based on content similarity
- Allow manual selection from visible block list

**Current:** Just appends to end of notebook blindly

**Where to add:** `SmartBlockMatcher.ts` + upgrade `PilotV2SaveSheet.tsx`



### 6. **BLOCK METADATA TRACKING** ❌
**Status:** PARTIALLY MISSING
**What you have:**
```typescript
meta?: Record<string, any>;  // Exists but unused
```

**What you need:**
- Track: sourceQuizId, import timestamp, quiz question
- Visual indicator: "Added by quiz import"
- Separator divider before imports (optional)
- Auto-continue numbering

**Where to add:** Upgrade types + save logic


### 7. **ADVANCED EXPORT FORMATS** ❌
**Status:** BASIC ONLY (plain text)
**What's missing:**
- ❌ PDF export (block or full notebook)
- ❌ Markdown export
- ❌ Word document export
- ❌ Block-by-block selective export
- ❌ Export to Notability/iPad apps

**Where to add:** New `PilotV2ExportEngine.ts`


### 9. **SEARCH WITHIN BLOCKS** ❌
**Status:** MISSING
**Current:** Only searches notebook titles
**Need:** Search across all block contents

**Where to add:** Upgrade search logic in `PilotV2NoteList.tsx`


### 10. **LAST-USED PREFERENCES** ❌
**Status:** PARTIALLY MISSING
**In SaveSheet you need:**
- Remember last-used notebook ← **MISSING**
- Remember last-used block ← **MISSING**
- Auto-select them by default ← **MISSING**

**Where to add:** `PilotV2UserPreferences` service

---

## ✏️ PHASE 3 - PENCIL ANNOTATIONS GAPS & USER REQUIREMENTS

### 1. Palm Rejection
*   The canvas must ignore finger touches when stylus/Apple Pencil touch is active to prevent accidental stray marks.

### 2. Zoom & Scale Drift
*   Drawing vectors must scale relatively to block boundaries so drawings do not drift or misalign when zooming or panning.

### 3. Undo / Redo Actions
*   A quick action button is needed on the pencil toolbar to undo or redo recent strokes.

### 4. Continuous Overlay Canvas (Notability-Style)
*   Creating multiple canvases per block causes severe lag.
*   **Requirement**: A single continuous drawing layer must cover the entire page (top-to-bottom, left-to-right). Drawing on top of text must remain on an independent overlay layer—allowing users to edit or select the underlying text at any time while drawings stay perfectly in place.

---

## 🎨 PREMIUM "WASHI TAPE" ACTIVE RECALL SYSTEM

Create a premium "Washi Tape" system for the notes editor inspired by Notability, Goodnotes, and Japanese stationery aesthetics.

### 1. Style Goal
*   Soft matte academic feel, handmade paper texture, subtle grain, slightly translucent, elegant and minimal. Realistic paper tape, NOT glossy stickers or flat CSS rectangles.

### 2. Color Palette (Soft Pastel Matte Only)
*   **Yellow**: `#FFE88A`, `#F7E27C`
*   **Green**: `#BEECC4`, `#C8F2D0`
*   **Blue**: `#B7DCFF`, `#C8E6FF`
*   **Pink**: `#FFD1DC`, `#FFC7D1`
*   **Gray**: `#D9D9D9`, `#E6E6E6`

### 3. Functional Requirements
*   **Tape Masking Tool**: Add a dedicated "Tape" tool inside the pencil/annotations toolbar to place masking tape over text, lines, keywords, headings, diagrams, and answers.
*   **Interactive Hide/Reveal**: Applying tape hides the underlying content. Tapping the tape reveals the content with a softly blurred, faded, slightly translucent readable state. Tapping again re-hides it. Transitions must animate smoothly without abrupt flashing.
*   **Global Controls**: Add "Show All Tapes" and "Hide All Tapes" controls in the notebook toolbar/menu.
*   **Glance View Integration**: Include a tape toggle UI inside Glance Mode to reveal/hide all tapes with smooth fluid transitions.
*   **Persistence**: Tape coordinates, dimensions, placements, and reveal states must persist on reopen and database save.
