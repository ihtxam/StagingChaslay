import { useCallback, useRef } from 'react';

/** Opens a callback after `requiredTaps` consecutive clicks within `windowMs`. */
export function useSecretTap(requiredTaps = 5, windowMs = 2500) {
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    countRef.current = 0;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const registerTap = useCallback(
    (onUnlock: () => void) => {
      countRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(reset, windowMs);
      if (countRef.current >= requiredTaps) {
        reset();
        onUnlock();
      }
    },
    [requiredTaps, reset, windowMs]
  );

  return registerTap;
}
