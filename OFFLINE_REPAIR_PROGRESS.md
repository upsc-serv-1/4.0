# Offline Repair Progress — Branch `2.8-offline-repair-by-emergent`

**Goal**: Make the app **fully offline** for Arena (quiz engine), Pilot V2 notes, Flashcards, PYQ Analysis, Tags. All offline mutations must sync to Supabase on reconnect (last-write-wins).

**Source log analyzed**: `NEW LOG OFFLINE TEST 2.txt` — 337 Supabase calls fired while offline simulator was active.

## Root Cause Summary

The app already has an offline scaffold (`OfflineManager`, `LocalQuery`, `SyncQueue`, `KVStore` over MMKV). The failures are caused by:

1. No `NetworkStatus` singleton — offline-diag simulation only patches `global.fetch`, but many consumers don't check connectivity before firing Supabase calls.
2. Supabase client has no `customFetch` that fast-fails when offline — so every call waits for a timeout instead of failing fast with a fallback.
3. `OfflineManager.syncAllContent` does NOT cache `user_tags`, `user_syllabus_progress`, `prompt_templates`, `folder_algorithm_settings`.
4. `src/repositories/pilotV2Repo.ts` is 100% online-only — no KVStore fallback, no SyncQueue writes.
5. `SyllabusService` always hits Supabase first, only falls back to AsyncStorage on error.
6. `(tabs)/index.tsx` fires background Supabase refreshes without checking online state.

## Architecture Decisions

- **Reads**: KVStore → Supabase background refresh (when online)
- **Writes**: KVStore immediately → try Supabase → if offline, enqueue in SyncQueue
- **SyncQueue**: drains every 30s and on reconnect
- **Conflict policy**: last-write-wins via `updated_at` timestamps
- **KVStore**: MMKV on native, AsyncStorage+memCache on Expo Go/web

## Step-by-Step Status

| # | Title | Status | Commit |
|---|-------|--------|--------|
| 1 | NetworkStatus singleton | ✅ Done | Step 1 |
| 2 | Supabase customFetch fast-fail when offline | ✅ Done | Step 2 |
| 3 | Wire offline-diag to flip NetworkStatus | ✅ Done | Step 3 |
| 4 | Extend OfflineManager sync: user_tags, user_syllabus_progress | ✅ Done | Step 4 |
| 5 | Extend SyncQueue with new kinds (note_node_upsert, note_content_upsert, syllabus_progress_upsert, note_node_delete, note_delete) | ✅ Done | Step 5 |
| 6 | pilotV2Repo offline-first (KVStore reads + SyncQueue writes) | ✅ Done | Step 6 |
| 7 | SyllabusService KVStore-first with queued offline writes | ✅ Done | Step 7 |
| 8 | Gate home screen background refresh on NetworkStatus | ✅ Done | Step 8 |
| 9 | Verify 0 blocked calls in offline diagnostic | ⏳ Pending manual test | — |

## Files Changed

- `src/services/NetworkStatus.ts` — NEW: NetworkStatus singleton
- `src/lib/supabase.ts` — customFetch that fast-fails when !NetworkStatus.isOnline()
- `app/offline-diag.tsx` — start/stop simulation flips NetworkStatus
- `src/services/OfflineManager.ts` — added user_tags + user_syllabus_progress to full sync; added to getCollectionSync()
- `src/services/SyncQueue.ts` — added note_node_upsert, note_content_upsert, note_delete, note_node_delete, syllabus_progress_upsert
- `src/repositories/pilotV2Repo.ts` — all reads have KVStore fallback; all writes go to KVStore first + SyncQueue
- `src/services/SyllabusService.ts` — KVStore-first reads; writes go to KVStore + SyncQueue
- `app/(tabs)/index.tsx` — background supabase refresh gated on NetworkStatus.isOnline()

## How to Continue (if context is lost)

1. Pull branch: `git checkout 2.8-offline-repair-by-emergent`
2. Check this table — find last ✅ step.
3. Offline strategy:
   - **Reads**: check KVStore first → Supabase in background (when NetworkStatus.isOnline())
   - **Writes**: KVStore immediately → try Supabase → catch → SyncQueue.enqueue(kind, payload)
   - **Simulation**: offline-diag.tsx Simulate Offline flips NetworkStatus.setSimulatedOffline(true)
4. KV key naming:
   - `@user_note_nodes_{userId}` — Pilot V2 nodes
   - `@pilot_v2_note_{noteId}` — individual note content
   - `@user_syllabus_progress_{userId}` — syllabus progress rows
   - `@user_tags_{userId}` — user tags
5. SyncQueue kinds defined in `src/services/SyncQueue.ts`
6. Diagnostic: Profile → Settings → "Offline Diagnostic"

## Verification Checklist

- [ ] Open Profile → Offline Diagnostic
- [ ] Confirm Cache Status shows: Tests > 0, Questions > 0, Flashcards > 0, Notebooks > 0
- [ ] Tap **Simulate Offline** → no spinners or error screens
- [ ] Navigate to: Home, Arena (topic + paper tabs), Flashcards, Pilot V2, Tags
- [ ] Each shows real cached data, NOT blank
- [ ] Mark a flashcard `Good` → go to diag → `BLOCKED SUPABASE CALLS = 0` (or only SyncQueue drain)
- [ ] Write a note in Pilot V2 → diag shows no blocked calls
- [ ] Tap **Stop Simulation** → SyncQueue drains within ~30s
- [ ] Confirm Supabase received the mutations
