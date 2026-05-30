# Quiz Engine Answer-Saving Bug Analysis & Fix Plan

## Bug Summary

When users study for 2-3 hours and save, their answers/explanations may be lost or overwritten. Also, selected answers can change to wrong values after saving.

## Root Cause Analysis

### The Race Condition (Primary Bug)

There are TWO types of `question_state` writes created per question:

**Type A: Auto-sync writes** (created during the session)
- Triggered by `handleOptionSelect` → `store.setAnswer(..., autoSync=true)` → `store.syncAnswer(qId)`
- `syncAnswer` has a **500ms debounce** before calling `StudentSync.enqueue('question_state', ...)`
- These writes use `store.activeAttemptId` (the session attemptId)

**Type B: Final submit writes** (created at save time)
- Triggered by `commitManualSave()` or `handleFinalSubmit()`
- These writes use the **new attemptId** from `StudentSync.submitAttemptNow()`

### The Timeline That Causes Data Loss

```
TIME  User Action                          Queue State
────  ───────────────────────────────────  ──────────────────────────
T+0   User answers Q1                      Auto-sync starts 500ms timer for Q1
T+10  User answers Q2                      Auto-sync starts 500ms timer for Q2
...
T+3h  User clicks "Save & Exit"
      commitManualSave() called:
T+3h  store.syncAnswer(Q1)                 Resets Q1 timer to +500ms
T+3h  store.syncAnswer(Q2)                 Resets Q2 timer to +500ms
T+3h  StudentSync.submitAttemptNow()       Creates attempt in DB, returns new attemptId
T+3h  StudentSync.enqueue(Q1, newAttempt)  Queue: [..., Q1(new), Q2(new)]
T+3h  StudentSync.enqueue(Q2, newAttempt)  Queue: [..., Q1(new), Q2(new)]
...
T+3h+500ms:
      Debounce fires for Q1                Queue: [..., Q1(new), Q2(new), Q1(OLD)]
      → Enqueues Q1 with OLD attemptId
      → Enqueues Q1 with STALE patch data
T+3h+500ms:
      Debounce fires for Q2                Queue: [..., Q1(new), Q2(new), Q1(OLD), Q2(OLD)]
      → Enqueues Q2 with OLD attemptId
      → Enqueues Q2 with STALE patch data
```

**Result:** The OLD writes process LAST and OVERWRITE the submit's writes with:
- Old `attempt_id` (breaking the link to the submitted attempt)
- Potentially stale `selected_answer`, `time_spent_seconds`, etc.

### Why Users See Wrong Answers (Secondary Bug)

The `handleOptionSelect` function only saves the **latest** selected option:

```typescript
const handleOptionSelect = (qId: string, label: string) => {
    store.setAnswer(qId, label, undefined, true); // autoSync = true
};
```

If the user changes their answer multiple times, the auto-sync from EACH change is enqueued with a 500ms debounce. If the queue is slow to process, an OLD answer can overwrite a NEW one in the database.

Additionally, the `syncAnswer` function reads `store.answers[qId]` via `get()` at the time it's called, NOT at the time the timeout fires. But the `activeAttemptId` is read at call time. The patch data is read INSIDE the timeout callback:

```typescript
syncAnswer: (questionId) => {
    const state = get();
    const { activeTestId, activeAttemptId, userId, answers } = state;
    ...
    syncTimeouts[questionId] = setTimeout(async () => {
        const answerData = answers[questionId]; // Read at timeout fire time!
        ...
        await StudentSync.enqueue('question_state', {
            attemptId: activeAttemptId,  // Captured at CALL time
            patch: {
                selected_answer: answerData.selectedAnswer,  // Read at TIMEOUT time
                time_spent_seconds: answerData.timeSpentSeconds,  // Read at TIMEOUT time
                ...
            }
        });
    }, 500);
```

So the patch data IS fresh (read at timeout fire time), but `attemptId` is stale (captured at call time). When `commitManualSave` calls `store.syncAnswer(qId)` for each question, the `activeAttemptId` is still the old session one, not the new attempt from `submitAttemptNow`.

## Fix Plan

### Fix 1: Flush stale auto-sync writes before submitting (in `commitManualSave` and `handleFinalSubmit`)

**File:** `app/unified/engine.tsx`

**Changes:**
1. Before calling `StudentSync.submitAttemptNow()`, cancel ALL pending debounced syncs and clear the queue of any in-flight `question_state` writes for the current session questions.
2. Then directly enqueue all question states with the new attemptId.
3. **Do NOT call `store.syncAnswer(qId)` during save** — this creates stale writes.

**Implementation:**
```typescript
// In commitManualSave and handleFinalSubmit, REPLACE:
questions.forEach(q => store.syncAnswer(q.id));  // ❌ Creates stale writes

// WITH:
cancelAllPendingSyncs();  // New helper — clears debounce timeouts
// (Then directly enqueue fresh writes with new attemptId)
```

### Fix 2: Add a `cancelSync(questionId)` method to `quizStore`

**File:** `src/store/quizStore.ts`

Add a new action that cancels pending debounced syncs for specific (or all) questions.

### Fix 3: Add `processQueueNow()` to `StudentSync`

**File:** `src/services/StudentSync.ts`

Add a method that forces queue processing synchronously (or at least ensures all pending writes are flushed) so final submit writes don't compete with stale auto-sync writes.

### Fix 4: Drain stale queue entries on submit

**File:** `app/unified/engine.tsx` (in `commitManualSave` and `handleFinalSubmit`)

After `submitAttemptNow()` succeeds and before enqueuing fresh writes:
1. Get all pending queue entries
2. Remove any `question_state` entries for the current questions (they're stale)
3. Then enqueue fresh writes

## Files to Modify

| File | Changes |
|------|---------|
| `src/store/quizStore.ts` | Add `cancelSync(questionId?)` to clear debounce timeouts. Export `clearAllSyncTimeouts()`. |
| `src/services/StudentSync.ts` | Add `drainPendingForQuestionIds(questionIds: string[])` to filter stale entries from queue. |
| `app/unified/engine.tsx:2598-2697` | Fix `commitManualSave()` — stop calling `store.syncAnswer(qId)` before submit, drain stale queue entries. |
| `app/unified/engine.tsx:2404-2497` | Fix `handleFinalSubmit()` — same fix. |

## Verification Steps

After fix:
1. Start a learn/exam session with 10+ questions
2. Answer several questions, use study tags, set confidence/difficulty
3. Wait 2+ minutes (so auto-syncs have fired)
4. Click "Save & Exit"
5. Verify the attempt saves correctly with all answers
6. Navigate to result screen — verify all answers match what was selected
7. Check `test_attempts` table — verify `attempt_payload.questions` has correct data
8. Check `question_states` table — verify `attempt_id` matches the submitted attempt
