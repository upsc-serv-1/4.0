import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../lib/safeAsyncStorage';
import { supabase } from '../lib/supabase';
import { formatTagLabel, normalizeTag } from '../utils/tagUtils';
import { useTagStore } from '../store/tagStore';

// MASTER SUBJECT LIST (The Total Taxonomy)
const MASTER_SUBJECTS = [
  'Polity', 'History', 'Economy', 'Geography', 'Environment',
  'Science & Tech', 'CSAT', 'Art & Culture', 'Internal Security',
  'International Relations', 'Social Issues', 'Governance', 'Ethics'
];

export interface TaggedQuestion {
  id: string;
  testId: string;
  testTitle?: string;
  subject: string;
  sectionGroup: string;
  microTopic: string;
  questionText: string;
  explanation: string;
  correctAnswer: string;
  selectedAnswer: string;
  options?: any;
  reviewTags: string[];
  normalizedReviewTags: string[];
  difficultyLevel?: string;
  createdAt: string;
}

export interface VaultMicroTopic {
  name: string;
  questions: TaggedQuestion[];
}

export interface VaultSectionGroup {
  name: string;
  microTopics: Record<string, VaultMicroTopic>;
  totalCount: number;
}

export interface VaultSubject {
  name: string;
  totalCount: number;
  sectionGroups: Record<string, VaultSectionGroup>;
}

const parseReviewTags = (input: any): string[] => {
  if (Array.isArray(input)) return input.map(String).map(t => t.trim()).filter(Boolean);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      return Array.isArray(parsed) ? parsed.map(String).map(t => t.trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const dedupeTags = (tags: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  tags.forEach((tag) => {
    const normalized = normalizeTag(tag);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    next.push(formatTagLabel(tag));
  });
  return next;
};

const replaceTagInList = (tags: string[], oldTag: string, newTag: string) => {
  const oldNorm = normalizeTag(oldTag);
  const next = tags.map((tag) => (normalizeTag(tag) === oldNorm ? newTag : tag));
  return dedupeTags(next);
};

export function useTaggedVault(userId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [rawQuestions, setRawQuestions] = useState<TaggedQuestion[]>([]);
  const [customReviewTags, setCustomReviewTags] = useState<string[]>([]);

  // Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');

  const cacheKey = useMemo(() => `tagged_vault_cache_${userId || 'anonymous'}`, [userId]);
  const tagCatalogKey = useMemo(() => `review_tag_catalog_${userId || 'anonymous'}`, [userId]);

  const persistCatalog = useCallback(async (nextTags: string[]) => {
    const clean = dedupeTags(nextTags).sort((a, b) => a.localeCompare(b));
    setCustomReviewTags(clean);
    await safeSetItem(tagCatalogKey, JSON.stringify(clean));
    return clean;
  }, [tagCatalogKey]);

  const loadTagCatalog = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(tagCatalogKey);
      if (!raw) {
        setCustomReviewTags([]);
        return;
      }
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? dedupeTags(parsed.map(String)) : [];
      setCustomReviewTags(list.sort((a, b) => a.localeCompare(b)));
    } catch {
      setCustomReviewTags([]);
    }
  }, [tagCatalogKey]);

  const fetchVaultData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // ISSUE FIX #8: Always fetch from server first to avoid showing stale data
    // after external database changes (e.g., manual row deletions).
    // We'll only fall back to cache if the network request fails.
    setLoading(true);

    try {
      // Force fresh fetch from Supabase to ensure Tags tab stays in sync
      const { data: states, error: fetchError } = await supabase
        .from('question_states')
        .select('id, question_id, test_id, selected_answer, review_tags, updated_at')
        .eq('user_id', userId)
        .not('review_tags', 'is', null);

      if (fetchError) throw fetchError;

      const filteredStates = (states || []).filter(row => parseReviewTags(row.review_tags).length > 0);

      if (filteredStates.length === 0) {
        setRawQuestions([]);
        await safeSetItem(cacheKey, JSON.stringify([]));
        setLoading(false);
        return;
      }

      const questionIds = Array.from(new Set(filteredStates.map(row => row.question_id).filter(Boolean)));
      const { data: questions, error: questionsError } = await supabase
        .from('questions')
        .select('id, test_id, subject, section_group, micro_topic, question_text, explanation_markdown, correct_answer, options')
        .in('id', questionIds as string[]);

      if (questionsError) throw questionsError;

      const questionsById = new Map((questions || []).map(q => [q.id, q]));
      const testIds = Array.from(new Set((questions || []).map(q => q.test_id).filter(Boolean)));

      let testsById = new Map<string, string>();
      if (testIds.length > 0) {
        const { data: tests } = await supabase
          .from('tests')
          .select('id, title')
          .in('id', testIds as string[]);
        testsById = new Map((tests || []).map(t => [t.id, t.title || '']));
      }

      const transformed: TaggedQuestion[] = filteredStates
        .map(row => {
          const qData = questionsById.get(row.question_id);
          const tags = parseReviewTags(row.review_tags);

          return {
            id: row.question_id,
            testId: row.test_id || qData?.test_id,
            testTitle: testsById.get((qData?.test_id || row.test_id || '') as string) || 'Custom Session',
            subject: qData?.subject || 'Unassigned',
            sectionGroup: qData?.section_group || 'General',
            microTopic: qData?.micro_topic || 'Unmapped',
            questionText: qData?.question_text || 'Question text not available',
            explanation: qData?.explanation_markdown || 'No explanation available',
            correctAnswer: qData?.correct_answer || '',
            selectedAnswer: row.selected_answer || '',
            options: qData?.options,
            reviewTags: tags.map((tag: string) => formatTagLabel(tag)),
            normalizedReviewTags: tags.map((tag: string) => normalizeTag(tag)),
            createdAt: row.updated_at || new Date().toISOString(),
          };
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setRawQuestions(transformed);

      // Save to cache. Use safeSetItem so an Android SQLITE_FULL doesn't
      // crash the Vault. Cap the cached payload at ~3 MB worth of JSON so
      // a single very large session can't push the AsyncStorage backing
      // database past its on-device ceiling.
      const cachePayload = JSON.stringify(transformed);
      const MAX_CACHE_BYTES = 3 * 1024 * 1024;
      if (cachePayload.length > MAX_CACHE_BYTES) {
        // Cache only the most recent slice to stay under the ceiling.
        const truncated = transformed.slice(0, Math.max(50, Math.floor(transformed.length / 2)));
        await safeSetItem(cacheKey, JSON.stringify(truncated));
      } else {
        await safeSetItem(cacheKey, cachePayload);
      }
    } catch (err) {
      console.error('Vault Engine Error:', err);

      // Network failed -> fall back to cache if present.
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setRawQuestions(parsed);
            setError(null);
            return;
          }
        }
      } catch {}

      setError(err);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, userId]);

  useEffect(() => {
    fetchVaultData();
    loadTagCatalog();
  }, [userId, fetchVaultData, loadTagCatalog]);

  // Auto-refresh whenever another screen renames/adds/removes a tag.
  const tagStoreVersion = useTagStore((s) => s.version);
  useEffect(() => {
    if (tagStoreVersion === 0) return; // skip the initial zero bump
    loadTagCatalog();
    fetchVaultData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagStoreVersion]);

  // The 3-Level Filtering & Grouping Logic
  const vaultData = useMemo(() => {
    const filtered = rawQuestions.filter(q => {
      const matchesSearch = searchQuery === '' ||
        q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.sectionGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.microTopic.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTag = selectedTag === 'All' || q.normalizedReviewTags.includes(normalizeTag(selectedTag));
      const matchesSubject = selectedSubject === 'All' || q.subject === selectedSubject;

      return matchesSearch && matchesTag && matchesSubject;
    });

    const subjects: Record<string, VaultSubject> = {};

    // Initialize with Master Subjects (Dummy Folders)
    MASTER_SUBJECTS.forEach(s => {
      subjects[s] = { name: s, totalCount: 0, sectionGroups: {} };
    });

    filtered.forEach(q => {
      if (!subjects[q.subject]) {
        subjects[q.subject] = { name: q.subject, totalCount: 0, sectionGroups: {} };
      }

      const secName = q.sectionGroup || 'General';
      if (!subjects[q.subject].sectionGroups[secName]) {
        subjects[q.subject].sectionGroups[secName] = { name: secName, microTopics: {}, totalCount: 0 };
      }

      const microName = q.microTopic || 'Unmapped';
      if (!subjects[q.subject].sectionGroups[secName].microTopics[microName]) {
        subjects[q.subject].sectionGroups[secName].microTopics[microName] = { name: microName, questions: [] };
      }

      subjects[q.subject].sectionGroups[secName].microTopics[microName].questions.push(q);
      subjects[q.subject].sectionGroups[secName].totalCount++;
      subjects[q.subject].totalCount++;
    });

    return {
      filteredQuestions: filtered,
      subjects: Object.values(subjects).sort((a, b) => b.totalCount - a.totalCount),
      totalCount: filtered.length,
      allSubjects: Array.from(new Set([...MASTER_SUBJECTS, ...rawQuestions.map(q => q.subject)])).sort()
    };
  }, [rawQuestions, searchQuery, selectedTag, selectedSubject]);

  const uniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    rawQuestions.forEach(q => q.reviewTags.forEach(tag => tagsSet.add(formatTagLabel(tag))));
    customReviewTags.forEach(tag => tagsSet.add(formatTagLabel(tag)));
    return Array.from(tagsSet).sort((a, b) => a.localeCompare(b));
  }, [rawQuestions, customReviewTags]);

  const syncCacheFromQuestions = useCallback(async (nextQuestions: TaggedQuestion[]) => {
    setRawQuestions(nextQuestions);
    const payload = JSON.stringify(nextQuestions);
    const MAX_CACHE_BYTES = 3 * 1024 * 1024;
    if (payload.length > MAX_CACHE_BYTES) {
      const truncated = nextQuestions.slice(0, Math.max(50, Math.floor(nextQuestions.length / 2)));
      await safeSetItem(cacheKey, JSON.stringify(truncated));
    } else {
      await safeSetItem(cacheKey, payload);
    }
  }, [cacheKey]);

  const addTagToReview = useCallback(async (tagName: string) => {
    const label = formatTagLabel(tagName);
    if (!label) return false;
    const exists = uniqueTags.some(tag => normalizeTag(tag) === normalizeTag(label));
    if (exists) return true;
    // Atomic server-side add (updates user_settings.custom_tags in one RPC call).
    try {
      const { error } = await supabase.rpc('add_user_tag', { p_tag: label });
      if (error) throw error;
    } catch (e) {
      // Fall back to legacy client-side persist if the RPC hasn't been deployed yet.
      console.warn('[tags] add_user_tag RPC failed, falling back to client write', e);
    }
    await persistCatalog([...customReviewTags, label]);
    useTagStore.getState().bump({ type: 'add', tag: label, at: Date.now() });
    return true;
  }, [customReviewTags, persistCatalog, uniqueTags]);

  const renameTagGlobally = useCallback(async (oldTag: string, newTag: string) => {
    if (!userId) return false;
    const oldNorm = normalizeTag(oldTag);
    const nextLabel = formatTagLabel(newTag);
    const nextNorm = normalizeTag(nextLabel);
    if (!oldNorm || !nextNorm) return false;

    // 1. Atomic server-side rename (one RPC, one transaction).
    //    Covers question_states.review_tags AND user_settings.custom_tags.
    let usedRpc = false;
    try {
      const { error } = await supabase.rpc('rename_user_tag', {
        p_old_tag: oldTag,
        p_new_tag: nextLabel,
      });
      if (error) throw error;
      usedRpc = true;
    } catch (e) {
      console.warn('[tags] rename_user_tag RPC unavailable, falling back to legacy per-row updates', e);
    }

    // 2. Fallback path (in case the RPC migration hasn't been applied yet).
    if (!usedRpc) {
      const { data: rows, error: loadErr } = await supabase
        .from('question_states')
        .select('id, question_id, review_tags')
        .eq('user_id', userId)
        .not('review_tags', 'is', null);
      if (loadErr) throw loadErr;

      const updates: Array<{ id: string; nextTags: string[] | null }> = [];
      (rows || []).forEach((row: any) => {
        const tags = parseReviewTags(row.review_tags);
        if (!tags.some(tag => normalizeTag(tag) === oldNorm)) return;
        const replaced = replaceTagInList(tags, oldTag, nextLabel);
        updates.push({ id: row.id, nextTags: replaced.length ? replaced : null });
      });
      await Promise.all(
        updates.map((row) =>
          supabase
            .from('question_states')
            .update({ review_tags: row.nextTags })
            .eq('id', row.id)
            .eq('user_id', userId)
        )
      );
    }

    // 3. Update the local in-memory cache so the current screen re-renders immediately.
    const nextQuestions = rawQuestions.map((q) => {
      if (!q.normalizedReviewTags.includes(oldNorm)) return q;
      const replaced = replaceTagInList(q.reviewTags, oldTag, nextLabel);
      return {
        ...q,
        reviewTags: replaced,
        normalizedReviewTags: replaced.map(normalizeTag),
      };
    });
    await syncCacheFromQuestions(nextQuestions);

    // 4. Update the custom-tag catalog locally as well.
    const catalogNext = customReviewTags.map((tag) => (normalizeTag(tag) === oldNorm ? nextLabel : tag));
    await persistCatalog(catalogNext);

    if (normalizeTag(selectedTag) === oldNorm) {
      setSelectedTag(nextLabel);
    }

    // 5. Broadcast to every other screen that subscribes to useTagStore.
    useTagStore.getState().bump({
      type: 'rename',
      oldTag,
      newTag: nextLabel,
      at: Date.now(),
    });

    return true;
  }, [customReviewTags, persistCatalog, rawQuestions, selectedTag, syncCacheFromQuestions, userId]);

  const removeTagFromReview = useCallback(async (tagName: string) => {
    if (!userId) return false;
    const targetNorm = normalizeTag(tagName);
    if (!targetNorm) return false;

    // 1. Atomic server-side delete via RPC.
    let usedRpc = false;
    try {
      const { error } = await supabase.rpc('remove_user_tag', { p_tag: tagName });
      if (error) throw error;
      usedRpc = true;
    } catch (e) {
      console.warn('[tags] remove_user_tag RPC unavailable, falling back', e);
    }

    // 2. Legacy fallback.
    if (!usedRpc) {
      const { data: rows, error: loadErr } = await supabase
        .from('question_states')
        .select('id, review_tags')
        .eq('user_id', userId)
        .not('review_tags', 'is', null);
      if (loadErr) throw loadErr;

      const updates: Array<{ id: string; nextTags: string[] | null }> = [];
      (rows || []).forEach((row: any) => {
        const tags = parseReviewTags(row.review_tags);
        if (!tags.some(tag => normalizeTag(tag) === targetNorm)) return;
        const next = dedupeTags(tags.filter(tag => normalizeTag(tag) !== targetNorm));
        updates.push({ id: row.id, nextTags: next.length ? next : null });
      });
      await Promise.all(
        updates.map((row) =>
          supabase
            .from('question_states')
            .update({ review_tags: row.nextTags })
            .eq('id', row.id)
            .eq('user_id', userId)
        )
      );
    }

    // 3. Local cache update.
    const nextQuestions = rawQuestions
      .map((q) => {
        const nextTags = q.reviewTags.filter(tag => normalizeTag(tag) !== targetNorm);
        return {
          ...q,
          reviewTags: nextTags,
          normalizedReviewTags: nextTags.map(normalizeTag),
        };
      })
      .filter((q) => q.reviewTags.length > 0);
    await syncCacheFromQuestions(nextQuestions);

    await persistCatalog(customReviewTags.filter(tag => normalizeTag(tag) !== targetNorm));

    if (normalizeTag(selectedTag) === targetNorm) {
      setSelectedTag('All');
    }

    // 4. Broadcast.
    useTagStore.getState().bump({ type: 'remove', tag: tagName, at: Date.now() });

    return true;
  }, [customReviewTags, persistCatalog, rawQuestions, selectedTag, syncCacheFromQuestions, userId]);

  return {
    loading,
    error,
    vaultData,
    allQuestions: rawQuestions,
    uniqueTags,
    addTagToReview,
    renameTagGlobally,
    removeTagFromReview,
    filters: {
      searchQuery,
      setSearchQuery,
      selectedTag,
      setSelectedTag,
      selectedSubject,
      setSelectedSubject
    },
    refresh: fetchVaultData
  };
}
