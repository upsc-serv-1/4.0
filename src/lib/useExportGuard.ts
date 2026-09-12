/**
 * useExportGuard — Prevents double-click spam on Export buttons and centralises
 * "Preparing your export…" state. Pair with DownloadManagerContext for full UX.
 */
import { useCallback, useRef, useState } from 'react';

export function useExportGuard() {
  const [isExporting, setIsExporting] = useState(false);
  const lockRef = useRef(false);

  const guard = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (lockRef.current) return null;
    lockRef.current = true;
    setIsExporting(true);
    try {
      return await fn();
    } finally {
      lockRef.current = false;
      setIsExporting(false);
    }
  }, []);

  return { isExporting, guard };
}
