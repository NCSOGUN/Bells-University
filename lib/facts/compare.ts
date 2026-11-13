// Last-value comparison (FR-24, Locked decision L20, NFR-18). PURE over already-loaded facts.
// Per record and test_key, among facts that are not removed, not superseded, not unreadable and have value_num.
// Latest = newest fact_date (then created_at). Previous = the next older one on a DIFFERENT date, and only when
// the units are equal under units.ts (NFKC, trim, collapse whitespace; D-020). Never convert units. Output carries no direction word and no delta.
import type { FactDTO } from "./dto";
import { unitsEqual } from "./units";

export interface PreviousValue {
  value_as_printed: string | null;
  unit_as_printed: string | null;
  fact_date: string | null;
  fact_id: string;
}

const comparable = (f: FactDTO) =>
  f.kind === "lab" && !!f.test_key && !f.unreadable && f.value_num !== null && f.superseded_by === null && f.fact_date !== null;

/** Newest first by fact_date, then created_at. */
export const newestFirst = (a: FactDTO, b: FactDTO) =>
  (b.fact_date ?? "").localeCompare(a.fact_date ?? "") || b.created_at.localeCompare(a.created_at);

export function getPreviousValue(facts: FactDTO[], fact: FactDTO): PreviousValue | null {
  if (!comparable(fact)) return null;
  const older = facts
    .filter((f) => f.id !== fact.id && f.record_id === fact.record_id && f.test_key === fact.test_key && comparable(f))
    .filter((f) => (f.fact_date as string) < (fact.fact_date as string))
    .sort(newestFirst);
  const prev = older[0];
  if (!prev) return null;
  // The one shared unit comparison (units.ts, D-020). It folds look-alike characters such as the micro sign and the
  // Greek mu for comparison only: each fact keeps, and the result returns, the unit text exactly as stored.
  if (!unitsEqual(prev.unit_as_printed, fact.unit_as_printed)) return null;
  return { value_as_printed: prev.value_as_printed, unit_as_printed: prev.unit_as_printed, fact_date: prev.fact_date, fact_id: prev.id };
}

export type FactWithPrevious = FactDTO & { previous?: PreviousValue };

export function attachPrevious(facts: FactDTO[]): FactWithPrevious[] {
  return facts.map((f) => {
    const previous = getPreviousValue(facts, f);
    return previous ? { ...f, previous } : f;
  });
}

/** The latest comparable fact per test_key (for the clinician's recent results). */
export function latestPerTestKey(facts: FactDTO[]): FactDTO[] {
  const seen = new Set<string>();
  const out: FactDTO[] = [];
  for (const f of [...facts].sort(newestFirst)) {
    if (f.kind !== "lab") continue;
    if (!f.test_key) {
      out.push(f);
      continue;
    }
    if (seen.has(f.test_key)) continue;
    seen.add(f.test_key);
    out.push(f);
  }
  return out;
}
