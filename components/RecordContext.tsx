"use client";
// The record the patient is looking at (FR-18: caregivers can switch). The choice is remembered on this device only.
// Records are picked by NAME ("Demo Patient (SYNTHETIC)"), never by a hard-coded id (docs/HANDOVER-DEV-A.md S-17).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { RecordsResponse, RecordSummary } from "@/lib/api-types";
import { getJson } from "@/lib/client-api";

interface Ctx {
  records: RecordSummary[];
  record: RecordSummary | null;
  selectRecord: (id: string) => void;
  reload: () => Promise<RecordSummary[]>;
  loading: boolean;
  error: unknown;
}

const RecordCtx = createContext<Ctx | null>(null);
const KEY = "itan:record";

function remembered(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function RecordProvider({ children }: { children: ReactNode }) {
  const [records, setRecords] = useState<RecordSummary[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const apply = useCallback((rs: RecordSummary[]) => {
    setRecords(rs);
    setId((cur) => {
      const want = cur ?? remembered();
      if (want && rs.some((x) => x.id === want)) return want;
      return (rs.find((x) => x.display_name === "Demo Patient (SYNTHETIC)") ?? rs.find((x) => x.is_self) ?? rs[0])?.id ?? null;
    });
  }, []);

  // First load. State is set only after the request settles.
  useEffect(() => {
    let off = false;
    void (async () => {
      try {
        const r = await getJson<RecordsResponse>("/api/records");
        if (!off) {
          apply(r.records);
          setError(null);
        }
      } catch (e) {
        if (!off) setError(e);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [apply]);

  // Called from buttons and after creating a record.
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getJson<RecordsResponse>("/api/records");
      apply(r.records);
      return r.records;
    } catch (e) {
      setError(e);
      return [];
    } finally {
      setLoading(false);
    }
  }, [apply]);

  const selectRecord = useCallback((next: string) => {
    setId(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // remembering the choice is a convenience only
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({ records, record: records.find((r) => r.id === id) ?? null, selectRecord, reload, loading, error }),
    [records, id, selectRecord, reload, loading, error],
  );
  return <RecordCtx.Provider value={value}>{children}</RecordCtx.Provider>;
}

export function useRecord(): Ctx {
  const c = useContext(RecordCtx);
  if (!c) throw new Error("useRecord must be used inside RecordProvider");
  return c;
}
