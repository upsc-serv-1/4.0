/**
 * usePilotV2DoubleTap — 300ms double-tap detection hook
 *
 * Returns a `onTap(key)` callback that fires `onSingleTap` on first press
 * and `onDoubleTap` when the same `key` is pressed twice within 300ms.
 */
import { useRef, useCallback } from 'react';

const DOUBLE_TAP_DELAY = 300;

export function usePilotV2DoubleTap(
  onSingleTap: () => void,
  onDoubleTap: () => void,
) {
  const lastKeyRef = useRef<string | null>(null);
  const lastTapRef = useRef<number>(0);

  return useCallback(
    (key: string) => {
      const now = Date.now();
      const isDoubleTap =
        key === lastKeyRef.current &&
        now - lastTapRef.current < DOUBLE_TAP_DELAY;

      lastKeyRef.current = key;
      lastTapRef.current = now;

      if (isDoubleTap) {
        onDoubleTap();
      } else {
        onSingleTap();
      }
    },
    [onSingleTap, onDoubleTap],
  );
}
