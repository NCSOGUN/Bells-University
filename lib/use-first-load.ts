"use client";

import { useEffect, useState } from "react";

// §4.3: a dashboard or list shows its skeleton for a beat on first load, so
// content arriving reads as content arriving. Only the first time per screen
// in a session; coming back later is instant.
const seen = new Set<string>();

export function useFirstLoad(key: string, ms = 600): boolean {
  const [settled, setSettled] = useState(() => seen.has(key));

  useEffect(() => {
    if (settled) return;
    const timer = window.setTimeout(() => {
      seen.add(key);
      setSettled(true);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [settled, key, ms]);

  return settled;
}
