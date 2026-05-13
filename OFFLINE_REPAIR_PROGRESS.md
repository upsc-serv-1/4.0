# Offline Repair Progress — Branch `2.8-offline-repair-by-emergent`

**Goal**: Make the app **fully offline** for Arena, PYQ Analysis, Tags, Pilot V2 Notes, Flashcards. All offline mutations must sync to Supabase on reconnect (last-write-wins).

**Source log analyzed**: `NEW LOG OFFLINE TEST 2.txt` — 337 Supabase calls fired while offline simulator was active.

## Root cause summary

The repo already has an offline scaffold (`OfflineManager`, `LocalQuery`, `SyncQueue`, `KVStore` over MMKV). The failures are caused by:

1. The "Simulate Offline" toggle in `offline-diag.tsx` only patches `global.fetch` — it does **not** flip `useNetwork().online`. So every consumer that gates Supabase on `online` keeps firing.
2. Some hot call sites do not gate at all (e.g. `(tabs)/index.tsx` background refresh, Pilot V2 repo).
3. `OfflineManager.syncAllContent` does not cache `user_tags`, `user_syllabus_progress`, `prompt_templates`, `folder_algorithm_settings`.
4. `src/repositories/pilotV2Repo.ts` is 100% online-only (no KVStore fallback, no SyncQueue writes).
5. Direct `supabase.from(...)` calls in `app/notes/*`, `app/unified/arena.tsx`, `WidgetService`, `AIPromptManager`, `BranchService` etc.

## Step-by-step status

| # | Title | Status | Notes |
|---|-------|--------|-------|
| 1 | Add NetworkStatus singleton + progress sheet | ✅ Done | `src/lib/networkStatus.ts` — singleton with isOnline/isOffline |
| 2 | Wire diagnostic Simulate Offline into NetworkStatus | ✅ Done | `app/offline-diag.tsx` calls `NetworkStatus.setSimulatedOffline()` |
| 3 | Supabase customFetch — fast-fail when offline | ✅ Done | `src/lib/supabase.ts` — interceptor short-circuits when offline |
| 4 | Extend OfflineManager full-sync (tags, syllabus, prompts, folder settings) | ✅ Done | All tables cached including user_tags, syllabus_progress, prompt_templates |
| 5 | Gate (tabs)/index.tsx background refresh on online flag | ✅ Done | Line 186-208 reads from OfflineManager cache; onPullRefresh gates on NetworkStatus |
| 6 | Make pilotV2Repo offline-first (KVStore reads + SyncQueue writes) | ✅ Done | Has NetworkStatus gates + KVStore fallback |
| 7 | Pilot V2 note content writes through SyncQueue | ✅ Done | PilotV2SyncQueue handles offline writes |
| 8 | app/notes/index.tsx — offline-aware notebook listing & ops | ⚠️ Partial | Reads from cache but some create/rename/archive ops still call Supabase directly |
| 9 | Audit remaining call sites (WidgetService, AIPromptManager, BranchService) | ⚠️ Partial | AIPromptManager ✅. BranchService ❌ — `listCardIdsInBranch` has NO offline fallback. WidgetService ✅ |
| 10 | Enhance offline-diag UI (real NetInfo + per-table cache stats) | ✅ Done | Shows sync status, per-table counts, blocked calls |
| 11 | Verify 0 blocked calls in diagnostic flow | ❌ Not yet | BranchService.listCardIdsInBranch and engine.tsx fetchQuestions still hit Supabase without offline fallbacks |

## How to continue this work (if context is lost)

1. Pull this branch: `git checkout 2.8-offline-repair-by-emergent`
2. Read this file's table to find the last completed step.
3. The runtime offline strategy is:
   - **Reads**: every screen first reads `OfflineManager.getCollectionSync(table, userId)` or KVStore directly; Supabase is only called as a background refresh when `NetworkStatus.isOnline()` is true.
   - **Writes**: immediately persist to KVStore (so UI reflects instantly), then `SyncQueue.enqueue(kind, payload)`. The queue drains every 30s and on online-reconnect.
   - **Conflict policy**: last-write-wins (using `updated_at` timestamps).
4. The diagnostic test is at Profile → Settings → "Offline Diagnostic" route (`app/offline-diag.tsx`). It now BOTH patches `global.fetch` AND flips `NetworkStatus`, so the simulation accurately mirrors airplane mode.
5. All offline keys live in MMKV (`react-native-mmkv`) via `src/lib/kvStore.ts` with AsyncStorage fallback for Expo Go / web.
6. SyncQueue kinds are defined in `src/services/SyncQueue.ts` — add new ones there if a new mutation type is needed.

## Verification checklist (run after each round of fixes)

- [ ] Open Profile → Offline Diagnostic.
- [ ] Confirm Cache Status shows all numbers > 0 (Tests, Questions, States, Notebooks, Attempts, Flashcards, Tags).
- [ ] Tap **Simulate Offline** → app stays usable.
- [ ] Navigate to: Home, Arena, PYQ, Flashcards, Pilot V2, Tags. Each shows real data, not spinners.
- [ ] Mark a flashcard `Good`, write a note in Pilot V2, tag a question — go back to diagnostic and confirm `BLOCKED SUPABASE CALLS = 0`.
- [ ] Tap **Stop Simulation**. Pending Sync Queue should drain within ~30s.
- [ ] Confirm Supabase received the offline mutations (verifiable via admin panel or DB).
