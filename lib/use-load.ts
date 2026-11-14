"use client";
// Load data from /api for a screen. A 401 sends the person to sign in; everything else is handed back as an error to show.
// The first load starts in the loading state; reload() (called from a button or after a change) sets it again.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { isUnauthenticated } from "@/lib/client-api";

export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  // First load, and again whenever the inputs change. State is set only after the request settles.
  useEffect(() => {
    let off = false;
    void (async () => {
      try {
        const v = await loadRef.current();
        if (!off) {
          setData(v);
          setError(null);
        }
      } catch (e) {
        if (off) return;
        if (isUnauthenticated(e)) router.replace("/sign-in");
        else setError(e);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, ...deps]);

  // Called from buttons and after changes.
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await loadRef.current());
    } catch (e) {
      if (isUnauthenticated(e)) router.replace("/sign-in");
      else setError(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  return { data, error, loading, reload, setData };
}
