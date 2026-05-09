# 🚀 EMERGEN.SH AI - PILOT V2 IMPLEMENTATION BLUEPRINT & HANDOFF

> [!IMPORTANT]
> **CRITICAL DIRECTIVE FOR THE AGENT:**
> This document is your canonical source of truth and progress ledger. You are expected to deliver **100% production-ready, deployment-grade code** with absolute coverage and zero placeholders. This handoff system is designed for continuity, but **under no circumstances should you leave work incomplete or deferred for a future agent.** Put in 100% effort to complete every single task in this list flawlessly.

---

## 📊 PROGRESS TRACKER (Update after every completed step)

- [ ] **PHASE 1: Core Schema & Types**
  - [ ] Update `src/components/pilot-v2/types.ts` with structured element and nested container types
  - [ ] Write a safe migration function to convert flat blocks to nested blocks (`heading` + `children[]`)
  - [ ] Update `src/repositories/pilotV2Repo.ts` database queries for nested structure compatibility
- [ ] **PHASE 2: Smart Block Matching & Preferences**
  - [ ] Implement `src/services/SmartBlockMatcher.ts` with semantic similarity and keyword detection
  - [ ] Implement `PilotV2UserPreferences` storage for last-used notebook and block memory
- [ ] **PHASE 3: Smart Append & Import Pipeline**
  - [ ] Create `src/services/PilotV2SmartAppend.ts` with separator and re-numbering support
  - [ ] Build content converter parser from quiz text selection to structured `ContentElement[]`
- [ ] **PHASE 4: Pencil Annotations Canvas**
  - [ ] Implement `src/services/PencilAnnotationEngine.ts` with stroke smoothing and shape detection
  - [ ] Implement `src/components/pilot-v2/PencilCanvas.tsx` using Shopify Skia
  - [ ] Add Apple Pencil pressure force and coalesced touch tracking
- [ ] **PHASE 5: Local-First Synchronization**
  - [ ] Create `src/services/PilotV2SyncManager.ts` using MMKV for instant local saving
  - [ ] Implement debounced batch syncing on editor close, app backgrounding, or milestone edits
  - [ ] Implement automatic rolling backup management and app-launch crash recovery
- [ ] **PHASE 6: UI & Advanced Polish**
  - [ ] Update `PilotV2EditorView.tsx` to support collapsible nested blocks with outlines
  - [ ] Build `PilotV2BlockRenderer.tsx` for inline element editing
  - [ ] Build `PencilToolbar.tsx` with high-fidelity drawing controls
  - [ ] Upgrade `PilotV2ExportSheet.tsx` with premium directory cards and preview options

---

## 🛠️ MODULE ARCHITECTURE & SPECIFICATIONS

### 1. Core Block Schema
**Target File:** [src/components/pilot-v2/types.ts](file:///c:/Users/Dr.%20Yogesh/Videos/APP%20FOLDER%20-%20V1%20-%20Copy/app/frontend-noji-2.6.2/3/pilot-v2-pro-final/src/components/pilot-v2/types.ts)
*   Convert blocks from simple flat text items to nested block containers:
    ```typescript
    export interface PilotV2Block {
      id: string;
      blockName: string;
      heading?: ContentElement;
      children: ContentElement[]; // paragraphs, lists, checklists, tables
      pencilStrokes?: PencilStroke[];
      isDirty: boolean;
    }
    ```

### 2. Smart Block Matching
**Target File:** `src/services/SmartBlockMatcher.ts`
*   Input: User's highlighted quiz text selection.
*   Action: Process cosine similarity against existing notebook blocks using Gemini embeddings, fallback to keyword matching, and reference the user's `lastUsedBlockId`.
*   Output: Suggest the single best-matching block container with a confidence score.

### 3. Smart Append & Import Pipeline
**Target File:** `src/services/PilotV2SmartAppend.ts`
*   Take text selection, convert it to standard elements, and append to the selected block.
*   If `addSeparator: true` is enabled, prepend a visual divider element.
*   If `continueNumbering: true` is enabled, read the last numbered element's index and increment the imported indices continuously (e.g., continuing from `3.` to `4.`, `5.`).

### 4. Pencil Annotations Canvas
**Target Files:** `src/components/pilot-v2/PencilCanvas.tsx` & `src/services/PencilAnnotationEngine.ts`
*   Provide a smooth drawing layer using `@shopify/react-native-skia` over the notes canvas.
*   Listen for iOS touch events, detect Apple Pencil specifically using `force > 0`, and apply Catmull-Rom spline smoothing to drawing paths.
*   Recognize shapes (underlines, circles) and save stroke data directly inside the active block's `pencilStrokes` array.

### 5. Local-First Sync Manager
**Target File:** `src/services/PilotV2SyncManager.ts`
*   Ensure every edit is written instantly (<1ms) to local MMKV storage first.
*   Debounce server writes: batch update modified blocks to Supabase only when the user exits the editor, backgrounds the app, or after 10 edits.
*   Keep up to 5 rolling backups locally to prevent data loss on unexpected crashes.

---

## 🚦 RESUMPTION INSTRUCTIONS FOR AGENTS
1. **Locate Current Progress**: Read this file (`PILOT_V2_HANDOFF.md`) first. Check which items under the **Progress Tracker** are ticked.
2. **Resume Work**: Start with the first unchecked item in the tracker.
3. **Verify Compliance**: Ensure all code written is fully typed, compiles with `tsc --noEmit`, has no placeholder mock data, and handles network failure cases gracefully.
4. **Update Tracker**: When completing a task, check it off (`- [x]`) and commit your changes with a descriptive message before moving to the next task.
