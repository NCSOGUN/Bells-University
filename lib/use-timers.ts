"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * setTimeout that is cleared when the component unmounts, for the simulated
 * delays in §4.3. `cancelAll` supports "Skip".
 */
export function useTimers() {
  const ids = useRef<number[]>([]);

  useEffect(() => {
    const pending = ids.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const after = useCallback((ms: number, fn: () => void) => {
    ids.current.push(window.setTimeout(fn, ms));
  }, []);

  const cancelAll = useCallback(() => {
    ids.current.forEach((id) => window.clearTimeout(id));
    // Emptied in place so the unmount cleanup still sees the same array.
    ids.current.length = 0;
  }, []);

  return { after, cancelAll };
}
