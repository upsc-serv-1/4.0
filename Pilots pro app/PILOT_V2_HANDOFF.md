# 🚀 EMERGEN.SH AI - SEQUENTIAL TASK CHECKLIST

> [!IMPORTANT]
> **CRITICAL DIRECTIVE:**
> This is your sequential execution checklist. Please complete these tasks in the exact order specified below. Update each step as completed (`- [x]`). Refer directly to `PILOT_V2_COMPLETE_ARCHITECTURE (1).md` and `PILOT_V2_GAPS.md` for technical specifications and resolved requirements of each task.

---

## 🚀 EXECUTION PRIORITY TASKS (IN ORDER)

- [ ] **Task 1: Update Block Types** (foundation, backward compatibility converter)
- [ ] **Task 2: Build Smart Block Matcher** (AI similarity & offline keyword fallback)
- [ ] **Task 3: Build Export Sheet UI** (UX selection panel, lazy loading, PDF/Markdown selective export)
- [ ] **Task 4: Implement Smart Append** (auto-numbering, separator, "Undo Save" toast)
- [ ] **Task 5: Add Pencil Annotation Engine** (stroke tracking, palm rejection, scale drift, Undo/Redo)
- [ ] **Task 6: Build Pencil Canvas** (Shopify Skia page-level continuous layered canvas)
- [ ] **Task 7: Implement Sync Manager** (MMKV local-first cache, sync failure retry queue)
- [ ] **Task 8: Migration & Testing** (data conversion, block tagging, search block contents)

---

## 🎯 IMPLEMENTATION CHECKLISTS

### 📦 Core Block Structure Tasks (Step 1)
- [ ] Convert flat blocks to nested blocks (`heading + children`)
- [ ] Implement `ContentElement` union type
- [ ] Run migration to convert old blocks to new nested blocks
- [ ] Update note content schema
- [ ] Implement backward-compatibility converter to prevent crashes on old note formats during load

### 🧠 Smart Export Tasks (Step 2 & Step 3)
- [ ] Implement AI similarity matching
- [ ] Build visual block selector list
- [ ] Implement last-used notebook remembering
- [ ] Implement block suggestion logic
- [ ] Implement user preferences storage
- [ ] Implement instant local keyword-search fallback for offline mode
- [ ] Implement lag-free rendering (lazy loading or search filter) for large notebooks
- [ ] Implement advanced export formats settings (PDF, Markdown, Selective block-export)

### 📤 Append Logic Tasks (Step 4)
- [ ] Implement optional separator divider insertion
- [ ] Implement auto-continue numbering
- [ ] Implement timestamp marking for imports
- [ ] Implement conversion of quiz text selections to element list
- [ ] Implement "Undo Save" popup toast immediately after appending text
- [ ] Implement block-level metadata tracking ("Added by quiz import" visual badge)

### ✏️ Pencil Annotations Tasks (Step 5 & Step 6)
- [ ] Implement stroke detection
- [ ] Implement Skia rendering
- [ ] Implement Apple Pencil pressure detection
- [ ] Implement shape recognition
- [ ] Implement auto-saving of pencil strokes
- [ ] Implement Palm Rejection
- [ ] Implement relatively-scaled drawing vectors (no zoom/scale drift)
- [ ] Implement Undo & Redo actions on the pencil toolbar
- [ ] Implement single high-performance page-level continuous drawing layer (Notability-style independent overlay)

### 💾 Local-First Sync Tasks (Step 7)
- [ ] Implement fast local storage caching (MMKV)
- [ ] Implement local-saving on edit
- [ ] Implement debounced batch syncing on close
- [ ] Implement crash recovery system
- [ ] Implement rolling backup management
- [ ] Implement local queue with automatic background retry sync on network restoration

### 🎨 UI Components Tasks (Step 8)
- [ ] Update editor view to render nested content with outline sidebars
- [ ] Implement flexible content element renderer
- [ ] Implement drawing annotation modes toolbar
- [ ] Implement enhanced export panel sheet
- [ ] Implement block tagging system and search filtering across block contents
