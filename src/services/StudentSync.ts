import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { isQuestionStateEmpty } from './isQuestionStateEmpty';

const PENDING_WRITES_KEY = '@pending_writes';
const USER_STATES_PREFIX = '@user_states_';
const USER_NOTES_PREFIX = '@user_notes_';
const USER_ATTEMPTS_PREFIX = '@user_attempts_';

export type WriteKind = 
  | 'attempt_draft' 
  | 'question_state' 
  | 'mains_question_state' 
  | 'mains_value_add_state' 
  | 'attempt_submit' 
  | 'user_note' 
  | 'note_content' 
  | 'tag_update';

export interface PendingWrite {
  id: string;
  kind: WriteKind;
  payload: any;
  enqueuedAt: number;
  failedAttempts: number;
  lastError?: string;
}

class StudentSyncService {
  private processing = false;

  private withoutUndefined<T extends Record<string, any>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
    ) as T;
  }

  /**
   * Drain (remove) any pending question_state writes for the given question IDs.
   * This prevents stale auto-sync writes from overwriting final submit data.
   * Call this BEFORE enqueuing fresh submit-time writes.
   */
  async drainPendingForQuestionIds(questionIds: string[]) {
    const idSet = new Set(questionIds);
    try {
      const queue = await this.getQueue();
      const remaining = queue.filter(item => {
        if (item.kind !== 'question_state') return true;
        return !idSet.has(item.payload.questionId);
      });
      if (remaining.length !== queue.length) {
        await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(remaining));
        console.log(`[Sync] Drained ${queue.length - remaining.length} stale question_state writes`);
      }
    } catch (err) {
      console.warn('[Sync] Failed to drain pending writes', err);
    }
  }

  async enqueue(kind: WriteKind, payload: any) {
    const newWrite: PendingWrite = {
      id: Math.random().toString(36).substring(7),
      kind,
      payload,
      enqueuedAt: Date.now(),
      failedAttempts: 0
    };

    try {
      const existing = await this.getQueue();
      await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify([...existing, newWrite]));
      console.log(`[Sync] Enqueued ${kind}`);
      
      // Dual-Path: Update local cache immediately so UI is instant
      this.updateLocalCache(newWrite).catch(e => console.warn('[Sync] Local cache update failed', e));

      this.processQueue();
    } catch (err) {
      console.error('[Sync] Failed to enqueue', err);
    }
  }

  private async updateLocalCache(write: PendingWrite) {
    const { kind, payload } = write;
    const userId = payload.userId;
    if (!userId) return;

    try {
      if (kind === 'question_state') {
        const key = `${USER_STATES_PREFIX}${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        const map = new Map(existing.map(s => [s.question_id, s]));
        
        // Merge patch into existing or create new
        const qid = payload.questionId;
        const current = map.get(qid) || { user_id: userId, question_id: qid };
        const nextState = { ...current, ...payload.patch, updated_at: new Date().toISOString() };
        if (isQuestionStateEmpty(nextState)) {
          map.delete(qid);
        } else {
          map.set(qid, nextState);
        }
        
        await AsyncStorage.setItem(key, JSON.stringify(Array.from(map.values())));
      } 
      else if (kind === 'attempt_submit') {
        const key = `${USER_ATTEMPTS_PREFIX}${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        
        // Add new attempt to the front
        const newAttempt = {
          id: write.id, // Temporary ID if we don't have one, but for submit it's usually real
          ...payload.attempt,
          user_id: userId,
          test_id: payload.testId,
          submitted_at: payload.attempt.submitted_at || new Date().toISOString()
        };
        await AsyncStorage.setItem(key, JSON.stringify([newAttempt, ...existing].slice(0, 500)));
      }
      else if (kind === 'user_note') {
        const key = `${USER_NOTES_PREFIX}${userId}`;
        const raw = await AsyncStorage.getItem(key);
        const existing: any[] = raw ? JSON.parse(raw) : [];
        const map = new Map(existing.map(n => [n.question_id, n]));
        
        const qid = payload.questionId;
        map.set(qid, { 
          user_id: userId, 
          question_id: qid, 
          content: payload.content, 
          updated_at: new Date().toISOString() 
        });
        await AsyncStorage.setItem(key, JSON.stringify(Array.from(map.values())));
      }
      else if (kind === 'mains_value_add_state') {
        const key = 'mains_value_add_tags';
        const raw = await AsyncStorage.getItem(key);
        const existing: Record<string, string[]> = raw ? JSON.parse(raw) : {};
        const cardId = payload.cardId;
        if (payload.patch && payload.patch.hasOwnProperty('review_tags')) {
          existing[cardId] = payload.patch.review_tags || [];
        }
        await AsyncStorage.setItem(key, JSON.stringify(existing));
      }
    } catch (err) {
      console.warn('[Sync] Dual-path local update failed:', err);
    }
  }

  async getQueue(): Promise<PendingWrite[]> {
    const data = await AsyncStorage.getItem(PENDING_WRITES_KEY);
    return data ? JSON.parse(data) : [];
  }

  async processQueue() {
    if (this.processing) return;
    this.processing = true;

    try {
      let queue = await this.getQueue();
      if (queue.length === 0) {
        this.processing = false;
        return;
      }

      console.log(`[Sync] Processing ${queue.length} pending writes`);
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      for (const item of queue) {
        // SAFETY: Discard items that don't match current session user
        if (!currentUserId || item.payload.userId !== currentUserId) {
          console.warn(`[Sync] Discarding stale item for user ${item.payload.userId}`);
          queue = queue.filter(i => i.id !== item.id);
          await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
          continue;
        }

        try {
          await this.applyWrite(item);
          // Success: remove from queue
          queue = queue.filter(i => i.id !== item.id);
          await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
        } catch (err: any) {
          // If it's an RLS error, foreign key failure, or schema error, remove it silently (or with a warning) so it doesn't block the queue
          if (err.code === '42501' || err.code === '23503' || err.code === '42703' || err.code === 'PGRST204') {
            console.warn(`[Sync] Discarding permanently failing write ${item.id} (${err.code}): ${err.message}`);
            queue = queue.filter(i => i.id !== item.id);
            await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
            continue;
          }

          // Otherwise, it is a transient error (e.g. network offline), log error and retry later
          console.error(`[Sync] Failed to apply write ${item.id} (will retry):`, err);

          item.failedAttempts++;
          item.lastError = err.message;
          await AsyncStorage.setItem(PENDING_WRITES_KEY, JSON.stringify(queue));
          // Stop processing if it's likely a network error
          break;
        }
      }
    } finally {
      this.processing = false;
    }
  }

  private async applyWrite(item: PendingWrite) {
    const { kind, payload } = item;

    switch (kind) {
      case 'question_state':
        return this.saveQuestionState(payload);
      case 'mains_question_state':
        return this.saveMainsQuestionState(payload);
      case 'mains_value_add_state':
        return this.saveMainsValueAddState(payload);
      case 'user_note':
        return this.saveUserNote(payload);
      case 'tag_update':
        return this.saveTagUpdate(payload);
      case 'attempt_submit':
        return this.saveAttemptSubmit(payload);
      // Add more cases as needed
      default:
        console.warn(`[Sync] Unknown write kind: ${kind}`);
    }
  }

  private async saveQuestionState(payload: any): Promise<void> {
    const { userId, questionId, testId, attemptId, patch } = payload;
    if (!questionId) {
      console.warn('[Sync] Skipping question_state because questionId is missing');
      return;
    }

    
    // ALIGN WITH WEBSITE SCHEMA:
    // 1. 'personal_note' in app -> 'note' in website DB
    // 2. 'review_tags' is jsonb in website DB
    // 3. Track 'is_incorrect_last_attempt' based on performance
    
    const sanitizedPatch: any = { ...patch };
    
    // SAFETY: Proactively strip the non-existent 'is_correct' column 
    // to prevent errors from stale writes in the local queue.
    if (sanitizedPatch.hasOwnProperty('is_correct')) {
      delete sanitizedPatch.is_correct;
    }

    if (sanitizedPatch.hasOwnProperty('last_attempt_at')) {
      delete sanitizedPatch.last_attempt_at;
    }
    
    if (sanitizedPatch.hasOwnProperty('personal_note')) {
      sanitizedPatch.note = sanitizedPatch.personal_note;
      delete sanitizedPatch.personal_note;
    }
    if (sanitizedPatch.hasOwnProperty('review_difficulty')) {
      sanitizedPatch.difficulty_level = sanitizedPatch.review_difficulty;
      delete sanitizedPatch.review_difficulty;
    }
    if (sanitizedPatch.hasOwnProperty('review_tags')) {
      sanitizedPatch.marked_must_revise = Array.isArray(sanitizedPatch.review_tags) && sanitizedPatch.review_tags.includes('Must Revise');
    }

    if (sanitizedPatch.hasOwnProperty('status')) {
      const isCorrect = sanitizedPatch.status === 'Correct';
      sanitizedPatch.is_incorrect_last_attempt = !isCorrect;
      delete sanitizedPatch.status; // Strip after mapping
      
      // WEBSITE INTEROPERABILITY: Create a history entry matching the CSV format
      const historyEntry = {
        wasCorrect: isCorrect,
        submittedAt: new Date().toISOString(),
        selectedAnswer: sanitizedPatch.selected_answer || "",
        confidence: sanitizedPatch.confidence || ""
      };
    }

    console.log(`[Sync] Saving state for Q:${questionId} User:${userId}`, sanitizedPatch);
    
    // WORKAROUND for missing unique constraint (42P10):
    // 1. Try to find existing record
    const { data: existingRows, error: selectError } = await supabase
      .from('question_states')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId);

    if (selectError) {
      throw new Error(`Select failed: ${selectError.message}`);
    }

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    const updateData: any = this.withoutUndefined({
      user_id: userId,
      question_id: questionId,
      test_id: testId,
      attempt_id: attemptId,
      selected_answer: sanitizedPatch.selected_answer,
      confidence: sanitizedPatch.confidence,
      review_tags: sanitizedPatch.hasOwnProperty('review_tags') ? sanitizedPatch.review_tags : undefined,
      user_tags: sanitizedPatch.hasOwnProperty('review_tags')
        ? (Array.isArray(sanitizedPatch.review_tags) ? sanitizedPatch.review_tags : null)
        : undefined,
      highlight_text: sanitizedPatch.note,
      note: sanitizedPatch.note,
      is_incorrect_last_attempt: sanitizedPatch.is_incorrect_last_attempt,
      marked_must_revise: sanitizedPatch.marked_must_revise,
      attempt_hour: sanitizedPatch.hasOwnProperty('attempt_hour') 
        ? sanitizedPatch.attempt_hour 
        : (existing?.id ? undefined : new Date().getHours()),
      time_spent_seconds: sanitizedPatch.hasOwnProperty('time_spent_seconds')
        ? sanitizedPatch.time_spent_seconds
        : (existing?.id ? undefined : 0),
      difficulty_level: sanitizedPatch.difficulty_level,
      error_category: sanitizedPatch.error_category,
      updated_at: new Date().toISOString()
    });
    const mergedState = existing?.id ? { ...existing, ...updateData } : updateData;

    if (existing?.id) {
      // Issue 1 — if the merged state would be empty, delete the row instead of updating.
      if (isQuestionStateEmpty(mergedState)) {
        const { error } = await supabase
          .from('question_states')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }
      // 2a. Update by ID
      const { error } = await supabase
        .from('question_states')
        .update(updateData)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      // Issue 1 — never insert an entirely-empty row.
      if (isQuestionStateEmpty(updateData)) return;
      // 2b. Insert new
      const { error } = await supabase
        .from('question_states')
        .insert(updateData);

      // Handle race condition: if someone inserted it between our select and insert
      if (error && error.code === '23505') {
        return this.saveQuestionState(payload); // Retry
      }
      if (error) throw error;
    }
  }

  private async saveMainsQuestionState(payload: any): Promise<void> {
    const { userId, questionId, patch } = payload;
    if (!questionId || !userId) {
      console.warn('[Sync] Skipping mains_question_state because questionId/userId is missing');
      return;
    }

    console.log(`[Sync] Saving mains state for Q:${questionId} User:${userId}`, patch);

    const updateData: any = {
      user_id: userId,
      question_id: questionId,
      updated_at: new Date().toISOString()
    };

    if (patch.hasOwnProperty('review_tags')) {
      updateData.review_tags = patch.review_tags;
    }
    if (patch.hasOwnProperty('confidence')) {
      updateData.confidence = patch.confidence;
    }
    if (patch.hasOwnProperty('review_difficulty')) {
      updateData.difficulty_level = patch.review_difficulty;
    }

    // SELECT + UPDATE/INSERT pattern (100% robust, matches saveQuestionState)
    const { data: existingRows, error: selectError } = await supabase
      .from('mains_question_states')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId);

    if (selectError) {
      throw selectError;
    }

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing?.id) {
      const { error } = await supabase
        .from('mains_question_states')
        .update(updateData)
        .eq('id', existing.id);

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabase
        .from('mains_question_states')
        .insert(updateData);

      // Handle race condition
      if (error && error.code === '23505') {
        return this.saveMainsQuestionState(payload); // Retry
      }
      if (error) {
        throw error;
      }
    }
  }

  private async saveMainsValueAddState(payload: any): Promise<void> {
    const { userId, cardId, patch } = payload;
    if (!cardId || !userId) {
      console.warn('[Sync] Skipping mains_value_add_state because cardId/userId is missing');
      return;
    }

    console.log(`[Sync] Saving mains value add state for Card:${cardId} User:${userId}`, patch);

    const updateData: any = {
      user_id: userId,
      card_id: cardId,
      updated_at: new Date().toISOString()
    };

    if (patch.hasOwnProperty('review_tags')) {
      updateData.review_tags = patch.review_tags;
    }

    // SELECT + UPDATE/INSERT pattern (100% robust)
    const { data: existingRows, error: selectError } = await supabase
      .from('mains_value_add_states')
      .select('id')
      .eq('user_id', userId)
      .eq('card_id', cardId);

    if (selectError) {
      throw selectError;
    }

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing?.id) {
      const isEmpty = !updateData.review_tags || updateData.review_tags.length === 0;
      if (isEmpty) {
        const { error } = await supabase
          .from('mains_value_add_states')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mains_value_add_states')
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      }
    } else {
      const isEmpty = !updateData.review_tags || updateData.review_tags.length === 0;
      if (isEmpty) return; // Don't insert empty rows

      const { error } = await supabase
         .from('mains_value_add_states')
         .insert(updateData);

      // Handle race condition
      if (error && error.code === '23505') {
        return this.saveMainsValueAddState(payload); // Retry
      }
      if (error) {
        throw error;
      }
    }
  }

  private async saveUserNote(payload: any): Promise<void> {
    const { userId, questionId, content } = payload;
    if (!questionId) {
      console.warn('[Sync] Skipping user_note because questionId is missing');
      return;
    }

    
    // WORKAROUND for missing unique constraint
    const { data: existingRows, error: selectError } = await supabase
      .from('user_notes')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', questionId);

    if (selectError) {
      throw new Error(`Select failed: ${selectError.message}`);
    }

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    const updateData = {
      user_id: userId,
      question_id: questionId,
      content,
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('user_notes')
        .update(updateData)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('user_notes')
        .insert(updateData);
      
      if (error && error.code === '23505') {
        return this.saveUserNote(payload); // Retry
      }
      if (error) throw error;
    }
  }

  private async saveTagUpdate(payload: any): Promise<void> {
    const { userId, questionId, tags } = payload;
    if (!questionId) {
      console.warn('[Sync] Skipping tag_update because questionId is missing');
      return;
    }

    
    // WORKAROUND for missing unique constraint
    const { data: existingRows, error: selectError } = await supabase
      .from('question_states')
      .select('*')
      .eq('user_id', userId)
      .eq('question_id', questionId);

    if (selectError) {
      throw new Error(`Select failed: ${selectError.message}`);
    }

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    const updateData = {
      user_id: userId,
      question_id: questionId,
      review_tags: tags,
      user_tags: tags,
      marked_must_revise: Array.isArray(tags) && tags.includes('Must Revise'),
      updated_at: new Date().toISOString()
    };

    if (existing?.id) {
      const mergedState = { ...existing, ...updateData };
      if (isQuestionStateEmpty(mergedState)) {
        const { error } = await supabase
          .from('question_states')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('question_states')
          .update(updateData)
          .eq('id', existing.id);
        if (error) throw error;
      }
    } else {
      if (isQuestionStateEmpty(updateData)) return;
      const { error } = await supabase
        .from('question_states')
        .insert(updateData);
      
      if (error && error.code === '23505') {
        return this.saveTagUpdate(payload); // Retry
      }
      if (error) throw error;
    }
  }

  private uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private async saveAttemptSubmit(payload: any) {
    const { userId, testId, attempt } = payload;
    const attemptId = attempt.id || this.uuidv4();
    
    const { data, error } = await supabase
      .from('test_attempts')
      .insert({
        id: attemptId,
        user_id: userId,
        test_id: testId,
        score: attempt.score ?? 0,
        attempt_payload: attempt.attempt_payload ?? attempt,
        started_at: attempt.started_at ?? null,
        submitted_at: attempt.submitted_at ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) throw error;
    return data?.id as string | undefined;
  }

  /**
   * Synchronously insert a test_attempts row and return its id.
   * Use this when the UI needs the attempt_id immediately
   * (e.g. to navigate to the result screen).
   */
  async submitAttemptNow(payload: {
    userId: string;
    testId: string;
    attempt: {
      score: number;
      attempt_payload: any;
      started_at: string;
      submitted_at: string;
    };
  }): Promise<string | undefined> {
    const attemptId = await this.saveAttemptSubmit(payload);
    
    // Dual-Path: Update local cache immediately
    if (attemptId) {
      const key = `${USER_ATTEMPTS_PREFIX}${payload.userId}`;
      const raw = await AsyncStorage.getItem(key);
      const existing: any[] = raw ? JSON.parse(raw) : [];
      const newAttempt = {
        id: attemptId,
        ...payload.attempt,
        user_id: payload.userId,
        test_id: payload.testId
      };
      await AsyncStorage.setItem(key, JSON.stringify([newAttempt, ...existing].slice(0, 500)));
    }

    return attemptId;
  }
}

export const StudentSync = new StudentSyncService();
