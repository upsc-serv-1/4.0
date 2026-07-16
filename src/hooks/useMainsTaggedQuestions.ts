import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeSetItem } from '../lib/safeAsyncStorage';
import { supabase } from '../lib/supabase';
import { formatTagLabel, normalizeTag } from '../utils/tagUtils';
import { useTagStore } from '../store/tagStore';
import { useCourse } from '../context/CourseContext';
import { mainsConsolidatedQuestions } from '../data/mainsConsolidatedLoader';
import { StudentSync } from '../services/StudentSync';

export interface MainsTaggedQuestion {
  id: string;
  questionNumber?: number;
  questionText: string;
  marks?: number;
  year?: number;
  paper?: string;
  subject: string;
  sectionGroup: string;
  microTopic: string;
  subTopic?: string;
  nanoTopic?: string;
  macrotag?: string;
  microtag?: string;
  is_pyq?: boolean;
  answers: Array<{
    id: string;
    institute: string;
    answerText: string;
  }>;
  reviewTags: string[];
  normalizedReviewTags: string[];
  confidence?: string;
  difficultyLevel?: string;
  createdAt: string;
}

export interface VaultMicroTopic {
  name: string;
  questions: MainsTaggedQuestion[];
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

export function useMainsTaggedVault(userId: string | undefined, localQuestionsList?: any[]) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [rawQuestions, setRawQuestions] = useState<MainsTaggedQuestion[]>([]);
  const [customReviewTags, setCustomReviewTags] = useState<string[]>([]);

  // Filtering States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const { selectedCourse } = useCourse();

  const cacheKey = useMemo(() => `mains_tagged_vault_cache_${userId || 'anonymous'}`, [userId]);
  const tagCatalogKey = useMemo(() => `review_tag_catalog_${userId || 'anonymous'}`, [userId]);

  // Load custom-tag catalog from AsyncStorage
  const loadCustomReviewTags = useCallback(async () => {
    try {
      const cached = await AsyncStorage.getItem(tagCatalogKey).then((v) => (v ? JSON.parse(v) : []));
      
      // Proactively fetch all active review tags from mains_question_states
      const { data: states } = await supabase
        .from('mains_question_states')
        .select('review_tags')
        .eq('user_id', userId)
        .not('review_tags', 'is', null);

      const serverTags: string[] = [];
      states?.forEach(row => {
        const parsed = parseReviewTags(row.review_tags);
        parsed.forEach(t => serverTags.push(t));
      });

      const list = dedupeTags([...(Array.isArray(cached) ? cached.map(String) : []), ...serverTags]);
      setCustomReviewTags(list.sort((a, b) => a.localeCompare(b)));
    } catch {
      setCustomReviewTags([]);
    }
  }, [tagCatalogKey, userId]);

  const fetchVaultData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Force fresh fetch from Supabase to ensure Tags tab stays in sync
      const { data: states, error: fetchError } = await supabase
        .from('mains_question_states')
        .select('id, question_id, review_tags, confidence, difficulty_level, updated_at')
        .eq('user_id', userId)
        .not('review_tags', 'is', null);

      if (fetchError) throw fetchError;

      const questionIds = Array.from(new Set((states || []).map(row => row.question_id).filter(Boolean)));
      if (questionIds.length === 0) {
        setRawQuestions([]);
        await safeSetItem(cacheKey, JSON.stringify([]));
        setLoading(false);
        return;
      }

      // Map from local questions list instead of querying Supabase
      const questionsList = localQuestionsList && localQuestionsList.length > 0 
        ? localQuestionsList 
        : mainsConsolidatedQuestions;

      const qMap = new Map<string, any>();
      questionsList.forEach(q => {
        qMap.set(String(q.id), q);
      });

      // Keep track of the active review_tags per questionId
      const activeTagsMap = new Map<string, { tags: string[], row: any }>();
      (states || []).forEach(row => {
        // Filter by selectedCourse if course info is present
        const q = qMap.get(String(row.question_id));
        if (q && q.course === selectedCourse) {
          const tags = parseReviewTags(row.review_tags);
          if (tags.length > 0) {
            activeTagsMap.set(String(row.question_id), { tags, row });
          }
        }
      });

      // Overlay pending local offline writes for mains_question_state
      try {
        const queue = await StudentSync.getQueue();
        queue.forEach(item => {
          if (item.kind === 'mains_question_state') {
            const { questionId, patch } = item.payload;
            if (patch && patch.hasOwnProperty('review_tags')) {
              const tags = parseReviewTags(patch.review_tags);
              if (tags.length > 0) {
                // Get existing row values if any
                const existing = activeTagsMap.get(String(questionId));
                activeTagsMap.set(String(questionId), {
                  tags,
                  row: {
                    ...(existing?.row || {}),
                    confidence: patch.confidence !== undefined ? patch.confidence : (existing?.row?.confidence),
                    difficulty_level: patch.difficultyLevel !== undefined ? patch.difficultyLevel : (existing?.row?.difficulty_level),
                    updated_at: new Date().toISOString()
                  }
                });
              } else {
                activeTagsMap.delete(String(questionId));
              }
            }
          }
        });
      } catch (queueErr) {
        console.warn('[useMainsTaggedVault] Failed to read sync queue:', queueErr);
      }

      const nextQuestions: MainsTaggedQuestion[] = [];
      activeTagsMap.forEach((val, qId) => {
        const q = qMap.get(qId);
        if (q) {
          nextQuestions.push({
            id: q.id,
            questionNumber: q.questionNumber || q.question_number,
            questionText: q.questionText || q.question_text,
            marks: q.marks,
            year: q.year || q.exam_year,
            paper: q.paper,
            subject: q.subject || 'General',
            sectionGroup: q.sectionGroup || q.section_group || 'General',
            microTopic: q.microTopic || q.microtopic || 'General',
            subTopic: q.subTopic || q.subtopic,
            nanoTopic: q.nanoTopic || q.nanotopic,
            macrotag: q.macrotag,
            microtag: q.microtag,
            reviewTags: val.tags,
            normalizedReviewTags: val.tags.map(normalizeTag),
            confidence: val.row.confidence || undefined,
            difficultyLevel: val.row.difficulty_level || undefined,
            createdAt: val.row.updated_at || new Date().toISOString(),
            answers: (q.answers || []).map((ans: any) => ({
              id: ans.id,
              institute: ans.institute,
              answerText: ans.answerText || ans.answer_text,
            }))
          });
        }
      });

      setRawQuestions(nextQuestions);
      await safeSetItem(cacheKey, JSON.stringify(nextQuestions));
      setError(null);
    } catch (err) {
      console.error('[MainsTags] fetchVaultData error:', err);
      setError(err);
      
      // Fallback cache load
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setRawQuestions(JSON.parse(cached));
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, [cacheKey, userId, selectedCourse, localQuestionsList]);

  // Load cache on mount & focus
  useEffect(() => {
    const init = async () => {
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached) {
          setRawQuestions(JSON.parse(cached));
        }
      } catch {}
      fetchVaultData();
      loadCustomReviewTags();
    };
    init();
  }, [cacheKey, fetchVaultData, loadCustomReviewTags]);

  // Subscribing to useTagStore updates from other screens
  useEffect(() => {
    return useTagStore.subscribe((state) => {
      if (state.lastUpdate) {
        const { type } = state.lastUpdate;
        if (type === 'add' || type === 'remove' || type === 'rename') {
          fetchVaultData();
          loadCustomReviewTags();
        }
      }
    });
  }, [fetchVaultData, loadCustomReviewTags]);

  const uniqueTags = useMemo(() => {
    const tags = new Set<string>();
    customReviewTags.forEach((tag) => tags.add(formatTagLabel(tag)));
    rawQuestions.forEach((q) => {
      q.reviewTags.forEach((tag) => tags.add(formatTagLabel(tag)));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [customReviewTags, rawQuestions]);

  // Transform raw data into nested Subject > Section Group > Micro Topic structures
  const vaultData = useMemo(() => {
    const normalizedSelectedTag = normalizeTag(selectedTag);
    const normalizedSelectedSubject = selectedSubject.toLowerCase();

    // 1. Filter raw questions list
    const filtered = rawQuestions.filter((q) => {
      // Tag filter
      if (normalizedSelectedTag !== 'all') {
        const hasTag = q.normalizedReviewTags.includes(normalizedSelectedTag);
        if (!hasTag) return false;
      }

      // Subject filter
      if (normalizedSelectedSubject !== 'all') {
        if (q.subject.toLowerCase() !== normalizedSelectedSubject) return false;
      }

      // Search Query
      if (searchQuery.trim().length > 0) {
        const cleanQuery = searchQuery.toLowerCase().trim();
        const inText = q.questionText.toLowerCase().includes(cleanQuery);
        const inSubject = q.subject.toLowerCase().includes(cleanQuery);
        const inSec = q.sectionGroup.toLowerCase().includes(cleanQuery);
        const inMicro = q.microTopic.toLowerCase().includes(cleanQuery);
        if (!inText && !inSubject && !inSec && !inMicro) return false;
      }

      return true;
    });

    // 2. Build the nested Subject > Section Group > Micro Topic hierarchy
    const subjectsMap: Record<string, VaultSubject> = {};

    filtered.forEach((q) => {
      const subName = q.subject || 'General';
      const secName = q.sectionGroup || 'General';
      const microName = q.microTopic || 'General';

      if (!subjectsMap[subName]) {
        subjectsMap[subName] = {
          name: subName,
          totalCount: 0,
          sectionGroups: {},
        };
      }

      const subject = subjectsMap[subName];
      subject.totalCount++;

      if (!subject.sectionGroups[secName]) {
        subject.sectionGroups[secName] = {
          name: secName,
          totalCount: 0,
          microTopics: {},
        };
      }

      const secGroup = subject.sectionGroups[secName];
      secGroup.totalCount++;

      if (!secGroup.microTopics[microName]) {
        secGroup.microTopics[microName] = {
          name: microName,
          questions: [],
        };
      }

      secGroup.microTopics[microName].questions.push(q);
    });

    return subjectsMap;
  }, [rawQuestions, selectedTag, selectedSubject, searchQuery]);

  const syncCacheFromQuestions = useCallback(async (questionsList: MainsTaggedQuestion[]) => {
    setRawQuestions(questionsList);
    await safeSetItem(cacheKey, JSON.stringify(questionsList));
  }, [cacheKey]);

  const persistCatalog = useCallback(async (tagList: string[]) => {
    const sorted = dedupeTags(tagList).sort((a, b) => a.localeCompare(b));
    setCustomReviewTags(sorted);
    await AsyncStorage.setItem(tagCatalogKey, JSON.stringify(sorted));
  }, [tagCatalogKey]);

  const addTagToReview = useCallback(async (tagName: string) => {
    if (!tagName.trim()) return;
    const cleanTag = formatTagLabel(tagName.trim());
    if (customReviewTags.map(normalizeTag).includes(normalizeTag(cleanTag))) return;

    const next = [...customReviewTags, cleanTag];
    await persistCatalog(next);
    useTagStore.getState().bump({ type: 'add', tag: cleanTag, at: Date.now() });
  }, [customReviewTags, persistCatalog]);

  const renameTagGlobally = useCallback(async (oldTag: string, nextLabel: string) => {
    if (!userId) return false;
    const oldNorm = normalizeTag(oldTag);
    const newNorm = normalizeTag(nextLabel);
    if (!oldNorm || !newNorm || oldNorm === newNorm) return false;

    // Load states to replace on Supabase
    const { data: rows, error: loadErr } = await supabase
      .from('mains_question_states')
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
          .from('mains_question_states')
          .update({ review_tags: row.nextTags })
          .eq('id', row.id)
          .eq('user_id', userId)
      )
    );

    // Update locally
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

    const catalogNext = customReviewTags.map((tag) => (normalizeTag(tag) === oldNorm ? nextLabel : tag));
    await persistCatalog(catalogNext);

    if (normalizeTag(selectedTag) === oldNorm) {
      setSelectedTag(nextLabel);
    }

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

    const { data: rows, error: loadErr } = await supabase
      .from('mains_question_states')
      .select('id, question_id, review_tags')
      .eq('user_id', userId)
      .not('review_tags', 'is', null);
    if (loadErr) throw loadErr;

    const updates: Array<{ id: string; nextTags: string[] | null }> = [];
    (rows || []).forEach((row: any) => {
      const tags = parseReviewTags(row.review_tags);
      if (!tags.some(tag => normalizeTag(tag) === targetNorm)) return;
      const filtered = tags.filter(tag => normalizeTag(tag) !== targetNorm);
      updates.push({ id: row.id, nextTags: filtered.length ? filtered : null });
    });

    await Promise.all(
      updates.map((row) =>
        supabase
          .from('mains_question_states')
          .update({ review_tags: row.nextTags })
          .eq('id', row.id)
          .eq('user_id', userId)
      )
    );

    // Update local cache
    const nextQuestions = rawQuestions
      .map((q) => {
        if (!q.normalizedReviewTags.includes(targetNorm)) return q;
        const filtered = q.reviewTags.filter(tag => normalizeTag(tag) !== targetNorm);
        return {
          ...q,
          reviewTags: filtered,
          normalizedReviewTags: filtered.map(normalizeTag),
        };
      })
      .filter((q) => q.reviewTags.length > 0);
    await syncCacheFromQuestions(nextQuestions);

    await persistCatalog(customReviewTags.filter(tag => normalizeTag(tag) !== targetNorm));

    if (normalizeTag(selectedTag) === targetNorm) {
      setSelectedTag('All');
    }

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
