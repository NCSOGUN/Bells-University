// Applying a patient's correction (FR-07). PURE: returns the new column values and the before/after diff.
// Editable: label, value, unit, range, date as printed. NOT editable: kind, source_quote, source_box, document_id
// (the original image stays attached). Numbers and the date are re-derived by our parsers (L17, L18); test_key is
// recomputed (L16); a human has looked, so check_carefully clears and the state becomes confirmed.
import { parseDate } from "@/lib/extract/dates";
import { parseRange, parseValueNum } from "@/lib/extract/numbers";
import { lookupTestKey } from "@/lib/glossary";
import { z } from "zod";

export const correctionSchema = z
  .strictObject({
    label_as_printed: z.string().trim().min(1).max(200).optional(),
    value_as_printed: z.string().trim().max(200).nullable().optional(),
    unit_as_printed: z.string().trim().max(50).nullable().optional(),
    range_as_printed: z.string().trim().max(100).nullable().optional(),
    fact_date_as_printed: z.string().trim().max(50).nullable().optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: "no fields to correct" });

export type Correction = z.infer<typeof correctionSchema>;

export interface Correctable {
  kind: string;
  label_as_printed: string;
  value_as_printed: string | null;
  unit_as_printed: string | null;
  range_as_printed: string | null;
  fact_date_as_printed: string | null;
}

export function applyCorrection(fact: Correctable, c: Correction) {
  const empty = (s: string | null | undefined) => (s === undefined ? undefined : s === null || s === "" ? null : s);
  const label = c.label_as_printed ?? fact.label_as_printed;
  const value = empty(c.value_as_printed) === undefined ? fact.value_as_printed : empty(c.value_as_printed)!;
  const unit = empty(c.unit_as_printed) === undefined ? fact.unit_as_printed : empty(c.unit_as_printed)!;
  const range = empty(c.range_as_printed) === undefined ? fact.range_as_printed : empty(c.range_as_printed)!;
  const datePrinted = empty(c.fact_date_as_printed) === undefined ? fact.fact_date_as_printed : empty(c.fact_date_as_printed)!;
  const { low, high } = parseRange(range);

  const after = {
    label_as_printed: label,
    value_as_printed: value,
    unit_as_printed: unit,
    range_as_printed: range,
    fact_date_as_printed: datePrinted,
    fact_date: parseDate(datePrinted),
    value_num: parseValueNum(value),
    range_low: low,
    range_high: high,
    test_key: fact.kind === "lab" ? lookupTestKey(label) : null,
    unreadable: value === null && fact.kind === "lab" ? false : false, // a human has looked: never left as unreadable
    check_carefully: false,
    state: "confirmed" as const,
  };

  // Diff of the printed fields only (the event stores what the patient changed).
  const before: Record<string, unknown> = {};
  const changed: Record<string, unknown> = {};
  for (const k of ["label_as_printed", "value_as_printed", "unit_as_printed", "range_as_printed", "fact_date_as_printed"] as const) {
    if (fact[k] !== after[k]) {
      before[k] = fact[k];
      changed[k] = after[k];
    }
  }
  return { after, diff: { before, after: changed } };
}
