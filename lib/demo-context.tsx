"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createSeedState, type DemoState } from "./mock-data";
import { loadDemoState, saveDemoState } from "./demo-storage";

type DemoUpdater = (prev: DemoState) => DemoState;

interface DemoContextValue {
  state: DemoState;
  /** False until localStorage has been read on the client. */
  hydrated: boolean;
  update: (updater: DemoUpdater) => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  // Server and first client render both use the seed, so markup matches;
  // any saved progress is swapped in after mount.
  const [state, setState] = useState<DemoState>(createSeedState);
  const [hydrated, setHydrated] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time sync from localStorage, which only exists after mount */
  useEffect(() => {
    const saved = loadDemoState();
    if (saved) {
      setState(saved);
    } else {
      saveDemoState(state);
    }
    setHydrated(true);
    // Runs once on mount; `state` here is the initial seed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const update = useCallback((updater: DemoUpdater) => {
    setState((prev) => {
      const next = updater(prev);
      saveDemoState(next);
      return next;
    });
  }, []);

  const resetDemo = useCallback(() => {
    const fresh = createSeedState();
    saveDemoState(fresh);
    setState(fresh);
  }, []);

  const value = useMemo(
    () => ({ state, hydrated, update, resetDemo }),
    [state, hydrated, update, resetDemo],
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("useDemo must be used inside <DemoProvider>");
  return ctx;
}
