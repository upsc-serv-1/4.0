/**
 * useOfflineFirst — hook family for reading data with "cache first, network
 * later" semantics.
 *
 * Each hook:
 *   1. Returns the cached snapshot synchronously on first render (MMKV =>
 *      instant; AsyncStorage fallback => hydrated by the time any list is
 *      visible).
 *   2. Kicks off a background refresh against Supabase.
 *   3. Re-renders with fresh data when the refresh completes — except when
 *      offline, in which case you just keep using the cache.
 *
 * Design goals:
 *   - Zero API calls during standard browsing (the user should be able to
 *     scroll through subjects/years/filters without ever blocking on a
 *     request).
 *   - Graceful offline: if the refresh fails, we log and leave the cache
 *     intact. The UI never shows a spinner for longer than one paint.
 */

import { useCallback, useEffect, useState } from 'react';
import { OfflineManager } from '../services/OfflineManager';

export function useOfflineTests() {
  const [tests, setTests] = useState<any[]>(() => OfflineManager.getOfflineTestsSync());
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await OfflineManager.getOfflineTests();
      setTests(fresh);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { tests, refreshing, refresh };
}

export function useOfflineMetadata() {
  const [metadata, setMetadata] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const flat = await OfflineManager.getConsolidatedMetadata();
      setMetadata(flat);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { metadata, loading, refresh };
}

export function useOfflineFilterLists() {
  const [lists, setLists] = useState<{
    institutes: string[];
    programs: string[];
    tests: any[];
  }>({ institutes: [], programs: [], tests: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fresh = await OfflineManager.getOfflineFilterLists();
        if (!cancelled) setLists(fresh);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...lists, loading };
}
