# OFFLINE-FIRST FIX — All 5 Broken Features
# For: emergent.sh AI agent
# Files: arena.tsx, pyq.tsx, useTaggedQuestions.ts, BranchService.ts, notes/index.tsx

---

## CRITICAL INSTRUCTION
**STRICT FILE SCOPE:** Only edit the 5 files listed above. Do NOT read other files. Do NOT modify OfflineManager.ts or KVStore.ts.

---

## THE PROBLEM
All 5 tabs call Supabase directly without checking local cache first. When offline:
- Arena: "Network request failed"
- PYQ: blank/loading forever
- Tags: blank/loading forever
- Flashcards: blank/empty
- Notes: blank/empty

**The fix:** Check OfflineManager cache BEFORE every Supabase call. If cache exists, use it. Only hit Supabase if online or cache is empty.

---

## FIX 1 — Arena (app/unified/arena.tsx)

**Location:** Line 344 (the main Supabase question query in `fetchSearchResults`)

**Find this code block:**
```typescript
let query = supabase
  .from('questions')
  .select('id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_allied, is_others, source, test_id, tests(*)');
```

**Replace with (add BEFORE the Supabase call):**
```typescript
// OFFLINE-FIRST: Check cache before Supabase
const cachedQuestions = OfflineManager.getOfflineQuestionsAllSync() || [];
if (searchQuery.trim().length > 0 && cachedQuestions.length > 0) {
  const searchLower = searchQuery.toLowerCase();
  const filtered = cachedQuestions.filter(q =>
    (q.question_text?.toLowerCase().includes(searchLower)) ||
    (q.explanation_markdown?.toLowerCase().includes(searchLower)) ||
    (q.subject?.toLowerCase().includes(searchLower))
  );
  if (filtered.length > 0) {
    setSearchResults(filtered.slice(0, 100));
    setLoading(false);
    return;
  }
}

// Network fallback
let query = supabase
  .from('questions')
  .select('id, question_number, question_text, options, correct_answer, explanation_markdown, subject, section_group, micro_topic, is_pyq, is_ncert, exam_group, exam_year, is_upsc_cse, is_allied, is_others, source, test_id, tests(*)');
```

**Ensure OfflineManager is imported at top:**
```typescript
import { OfflineManager } from '../../src/services/OfflineManager';
```

---

## FIX 2 — PYQ (app/pyq.tsx)

**Location 1:** Line 458 (in `fetchQuestionsForTests()`)

**Find:**
```typescript
const { data: questions, error: qError } = await supabase
  .from('questions')
  .select('...')
```

**Replace with:**
```typescript
// OFFLINE-FIRST: Try cache first
let questions = [];
const cachedQuestions = OfflineManager.getOfflineQuestionsAllSync() || [];

if (cachedQuestions.length > 0) {
  // Filter cached questions by testIds
  questions = cachedQuestions.filter(q => testIds.includes(q.test_id));
}

// Network fallback if no cache
let qError = null;
if (questions.length === 0) {
  const { data: networkQuestions, error } = await supabase
    .from('questions')
    .select('...')
    .in('test_id', testIds)
    .limit(5000);
  questions = networkQuestions || [];
  qError = error;
}
```

**Location 2:** Line 495 (in `fetchPyqData()`)

**Find:**
```typescript
const { data: tests, error: tError } = await supabase
  .from('tests')
  .select('...')
```

**Before that line, add:**
```typescript
// OFFLINE-FIRST: Get tests from cache metadata
const cachedMeta = OfflineManager.getConsolidatedMetadata() || {};
let tests = Object.values(cachedMeta).filter((t: any) => t && t.id) || [];
let tError = null;

if (tests.length === 0) {
  // Network fallback
  const result = await supabase
    .from('tests')
    .select('...');
  tests = result.data || [];
  tError = result.error;
}
```

**Ensure OfflineManager import at top:**
```typescript
import { OfflineManager } from '../src/services/OfflineManager';
```

---

## FIX 3 — Tags (src/hooks/useTaggedQuestions.ts)

**Location:** Line 138 (in the main fetch function)

**Find:**
```typescript
const { data: states } = await supabase
  .from('question_states')
  .select('...')
```

**Add BEFORE this block:**
```typescript
// OFFLINE-FIRST: Check cache first
try {
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached);
    setTaggedQuestions(parsed);
    return;
  }
} catch {}

// Network fetch if no cache
```

**Find line 156:**
```typescript
const { data: qdata } = await supabase
  .from('questions')
  .select('...')
```

**Wrap the entire Supabase section (lines 138–201) in:**
```typescript
try {
  // Try cache first (already added above)
  
  // Then Supabase fetches
  const { data: states } = await supabase...
  const { data: qdata } = await supabase...
  const { data: tests } = await supabase...
  
  // Merge and cache
  const merged = [...states, ...qdata, ...tests];
  await AsyncStorage.setItem(cacheKey, JSON.stringify(merged));
  setTaggedQuestions(merged);
  
} catch (err) {
  // If network fails, load from cache as fallback
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      setTaggedQuestions(parsed);
      setError(null);
      return;
    }
  } catch {}
  setError(err);
}
```

---

## FIX 4 — Flashcards (src/services/BranchService.ts)

**Location:** Line 55 (in `buildTree()`)

**Find:**
```typescript
const { data: branches, error: bError } = await supabase
  .from('flashcard_branches')
  .select('...')
```

**Replace with:**
```typescript
let branches = [];
let bError = null;

// OFFLINE-FIRST: Try local storage first
try {
  const cached = await AsyncStorage.getItem(`flashcard_branches_${userId}`);
  if (cached) {
    branches = JSON.parse(cached);
  }
} catch {}

// Network fallback
if (branches.length === 0) {
  const result = await supabase
    .from('flashcard_branches')
    .select('...');
  branches = result.data || [];
  bError = result.error;
  
  // Cache for offline
  if (branches.length > 0) {
    try {
      await AsyncStorage.setItem(`flashcard_branches_${userId}`, JSON.stringify(branches));
    } catch {}
  }
}
```

**Add imports at top:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

**Repeat the same pattern for other Supabase calls in BranchService:**
- Line 213 (flashcard_branch_cards)
- Line 239 (user_cards)

Same logic: cache first, network fallback, save to cache.

---

## FIX 5 — Notes Pro (app/notes/index.tsx)

**Location:** Line 96 (in `fetchNotes()`)

**Find:**
```typescript
const { data: nodes, error } = await supabase
  .from('user_note_nodes')
  .select('...')
```

**Replace with:**
```typescript
let nodes = [];
let error = null;

// OFFLINE-FIRST: Try cache first
try {
  const cached = await AsyncStorage.getItem(`user_notes_${userId}`);
  if (cached) {
    nodes = JSON.parse(cached);
  }
} catch {}

// Network fallback
if (nodes.length === 0) {
  const result = await supabase
    .from('user_note_nodes')
    .select('...');
  nodes = result.data || [];
  error = result.error;
  
  // Cache for offline
  if (nodes.length > 0) {
    try {
      await AsyncStorage.setItem(`user_notes_${userId}`, JSON.stringify(nodes));
    } catch {}
  }
}
```

**Also for create/update operations (lines 273+, 276, 281, 320, 325, 330):**

Wrap each Supabase insert/update/delete in try-catch and cache the result:

```typescript
// Before Supabase call:
const optimisticUpdate = { ...newData }; // local state update

// Supabase call:
const { data, error } = await supabase
  .from('user_notes')
  .insert([optimisticUpdate])
  .select();

// Cache update:
if (!error && data) {
  const cached = await AsyncStorage.getItem(`user_notes_${userId}`) || '[]';
  const parsed = JSON.parse(cached);
  parsed.push(data[0]);
  await AsyncStorage.setItem(`user_notes_${userId}`, JSON.stringify(parsed));
}
```

**Add imports at top:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
```

---

## SUMMARY OF CHANGES

| File | Change | Why |
|------|--------|-----|
| `arena.tsx` | Check `OfflineManager.getOfflineQuestionsAllSync()` before Supabase | Show cached questions offline |
| `pyq.tsx` | Check cache metadata before Supabase tests/questions queries | Show PYQ heatmap offline |
| `useTaggedQuestions.ts` | Cache-first + fallback to cache on network error | Show tagged questions offline |
| `BranchService.ts` | AsyncStorage cache for branches + cards before Supabase | Show flashcard tree offline |
| `notes/index.tsx` | AsyncStorage cache for notes before Supabase | Show notes offline |

---

## VERIFICATION CHECKLIST

After all edits:
- [ ] Turn off WiFi
- [ ] Open Arena → search for a topic → should show cached results instantly
- [ ] Open PYQ → should show heatmap from cached data
- [ ] Open Tags → should show tagged questions
- [ ] Open Flashcards → should show branch tree
- [ ] Open Notes → should show note list
- [ ] All tabs should NOT show "Network request failed"
- [ ] Turn WiFi back on, refresh → all tabs sync new data from Supabase

---

## NOTES FOR EMERGENT.SH

1. Do NOT modify `OfflineManager.ts` — it already works.
2. Do NOT touch `KVStore.ts` or `QuestionCache.ts`.
3. All caching uses `AsyncStorage` (same as existing code patterns in these files).
4. For each Supabase call, the pattern is identical:
   - Try cache/local storage first
   - If empty, hit Supabase
   - Save result to cache
   - On network error, fallback to cache
5. Use one commit per file (5 commits total).
