// ==========================================================================
// useSupabaseQuery — generic query hook with loading/error state
// ==========================================================================

import { useEffect, useState } from 'react';

interface QueryState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T[] | null; error: any; count?: number }>,
  deps: any[] = []
): QueryState<T> & { count: number } {
  const [data, setData] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await queryFn();
      if (result.error) {
        setError(result.error.message || 'An error occurred');
        setData([]);
      } else {
        setData(result.data || []);
        setCount(result.count ?? (result.data?.length || 0));
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, deps);

  return { data, count, loading, error, refetch: fetchData };
}