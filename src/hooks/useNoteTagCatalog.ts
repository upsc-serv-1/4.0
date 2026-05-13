/**
 * useNoteTagCatalog — single source of truth for the "semantic chips" used
 * in the Notes Knowledge Vault. Pulls from the same review-tag catalog
 * already powering the Tags tab so renames/adds propagate everywhere.
 *
 * Sources merged (deduped, label-formatted):
 *   1. Built-in defaults (Imp. Fact, Imp. Concept, Trap Question, Must Revise, Memorize)
 *   2. user_settings.custom_tags (server-side per user)
 *   3. AsyncStorage fallback (review_tag_catalog_<uid>) for offline parity
 *   4. Tags discovered inline on user_notes.items[i].tags (auto-discovery)
 *
 * Subscribes to useTagStore.version so any add/rename/remove flowing
 * through the existing tag flows in Tags tab refreshes this catalog.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { NetworkStatus } from '../lib/networkStatus';
import { SyncQueue } from '../services/SyncQueue';
import { formatTagLabel, normalizeTag } from '../utils/tagUtils';
import { useTagStore } from '../store/tagStore';

const DEFAULT_TAGS = ['Imp. Fact', 'Imp. Concept', 'Trap Question', 'Must Revise', 'Memorize'];

const dedupe = (tags: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  tags.forEach((t) => {
    const norm = normalizeTag(t);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push(formatTagLabel(t));
  });
  return out;
};

export interface NoteTagCatalog {
  /** Ordered, deduped list of available tags for chip filter. */
  tags: string[];
  /** True while the first remote fetch is pending. */
  loading: boolean;
  /** Force a refetch (e.g., after creating a tag from inside the editor). */
  refresh: () => Promise<void>;
  /** Persist a brand-new tag into custom_tags (mirrors Tags-tab behaviour). */
  addCustomTag: (tag: string) => Promise<boolean>;
}

export function useNoteTagCatalog(userId: string | undefined, discoveredFromItems: string[] = []): NoteTagCatalog {
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const cacheKey = useMemo(() => `review_tag_catalog_${userId || 'anonymous'}`, [userId]);
  const tagStoreVersion = useTagStore((s) => s.version);

  const loadFromCache = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) return [] as string[];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? dedupe(parsed.map(String)) : [];
    } catch {
      return [];
    }
  }, [cacheKey]);

  const persistCache = useCallback(async (next: string[]) => {
    try {
      await AsyncStorage.setItem(cacheKey, JSON.stringify(next));
    } catch {
      // best-effort
    }
  }, [cacheKey]);

  const fetchFromServer = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return [] as string[];
    }
    if (!NetworkStatus.isOnline()) return [] as string[];
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('custom_tags')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      const raw = data?.custom_tags;
      const arr = Array.isArray(raw) ? raw : (typeof raw === 'string' ? safeParseArray(raw) : []);
      return dedupe(arr.map(String));
    } catch {
      return [];
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [cached, fresh] = await Promise.all([loadFromCache(), fetchFromServer()]);
    const merged = dedupe([...cached, ...fresh]);
    setCustomTags(merged);
    await persistCache(merged);
    setLoading(false);
  }, [loadFromCache, fetchFromServer, persistCache]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Sync when other screens (Tags tab) mutate the catalog.
  useEffect(() => {
    if (tagStoreVersion === 0) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagStoreVersion]);

  const addCustomTag = useCallback(async (tag: string) => {
    const label = formatTagLabel(tag);
    if (!label) return false;
    if (customTags.some((t) => normalizeTag(t) === normalizeTag(label))) return true;
    // Push the new tag through SyncQueue when offline; otherwise hit RPC directly.
    if (NetworkStatus.isOnline()) {
      try {
        const { error } = await supabase.rpc('add_user_tag', { p_tag: label });
        if (error) throw error;
      } catch {
        SyncQueue.enqueue('tag_add', { tag: label });
      }
    } else {
      SyncQueue.enqueue('tag_add', { tag: label });
    }
    const next = dedupe([...customTags, label]);
    setCustomTags(next);
    await persistCache(next);
    useTagStore.getState().bump({ type: 'add', tag: label, at: Date.now() });
    return true;
  }, [customTags, persistCache]);

  const tags = useMemo(() => {
    const discovered = dedupe(discoveredFromItems);
    return dedupe([...DEFAULT_TAGS, ...customTags, ...discovered]).sort((a, b) => a.localeCompare(b));
  }, [customTags, discoveredFromItems]);

  return { tags, loading, refresh, addCustomTag };
}

function safeParseArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
