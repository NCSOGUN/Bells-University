// EXTRACTION GUARDS (C06, FR-04, NFR-15, NFR-17, NFR-18). Mandatory; keep this file short.
// The model transcribes. OUR code decides what is kept. Nothing here ever confirms a fact.
//
//  G1  value_num is derived by us from value_as_printed. A model-supplied number is never read.
//  G2  range_low / range_high are derived by us from range_as_printed; if it does not parse, only text is kept.
//  G3  value_as_printed must appear inside source_quote (whitespace and case ignored, digit boundaries respected).
//      If not: the item becomes unreadable, values cleared, check_carefully set (Locked decision L19).
//  G4  readable=false forces every value field to null and unreadable=true (FR-04).
//  G5  medication and allergy items are check_carefully unless confidence is "high" and readable.
//  G6  dates are parsed day-first (L18); the printed text is always kept.
//  Also: an item with no label and no quote is dropped; a bad source_box becomes null.
//  Referral reason/urgency (L21): kept only if the words appear in the quote, else dropped (null).
import { parseDate } from "./dates";
import { parseRange, parseValueNum } from "./numbers";
import type { ExtractedItem, ModelOutput } from "./schema";

export type TestKeyLookup = (label: string) => string | null;

export interface GuardedItem {
  kind: ExtractedItem["kind"];
  label_as_printed: string;
  value_as_printed: string | null;
  unit_as_printed: string | null;
  range_as_printed: string | null;
  flag_as_printed: string | null;
  value_num: number | null;
  range_low: number | null;
  range_high: number | null;
  fact_date: string | null;
  fact_date_as_printed: string | null;
  unreadable: boolean;
  check_carefully: boolean;
  confidence: ExtractedItem["confidence"];
  source_quote: string;
  source_box: [number, number, number, number] | null;
  source_page: number;
  test_key: string | null;
  /** Kind-specific data; `guard_failed` records which guard cleared the item (L19). */
  extra: { guard_failed?: string };
}

export interface GuardedWritten {
  text: string;
  source_quote: string;
  source_box: [number, number, number, number] | null;
  source_page: number;
}

export interface GuardedReferral {
  reason_as_written: GuardedWritten | null;
  urgency_as_written: GuardedWritten | null;
  referring_clinician_as_written: GuardedWritten | null;
  referral_date_as_written: GuardedWritten | null;
}

export interface GuardedOutput {
  doc_type: ModelOutput["doc_type"];
  facility_as_printed: string | null;
  document_date_as_printed: string | null;
  document_date: string | null;
  items: GuardedItem[];
  referral: GuardedReferral | null;
  /** Content-free notes (item numbers and guard codes only; never document text, L31). */
  notes: string[];
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
const clean = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True if `value` appears in `quote`. Digits must not be glued to other digits: "9.8" is not in "19.8". */
function appearsIn(value: string, quote: string): boolean {
  const v = squash(value);
  if (!v) return false;
  const pre = /^\d/.test(v) ? String.raw`(?<![0-9])(?<![0-9]\.)` : "";
  const post = /\d$/.test(v) ? String.raw`(?![0-9])(?!\.[0-9])` : "";
  return new RegExp(pre + escapeRe(v) + post).test(squash(quote));
}

/** [ymin,xmin,ymax,xmax] on 0..1000, ordered. Anything else is null; never throws (format UNVERIFIED). */
function cleanBox(b: number[] | null): [number, number, number, number] | null {
  if (!b || b.length !== 4 || !b.every((n) => Number.isFinite(n) && n >= 0 && n <= 1000)) return null;
  const [ymin, xmin, ymax, xmax] = b;
  return ymin < ymax && xmin < xmax ? [ymin, xmin, ymax, xmax] : null;
}

const cleanPage = (p: number) => (Number.isInteger(p) && p >= 1 ? p : 1);

export function applyGuards(
  raw: ModelOutput,
  opts: { lookupTestKey?: TestKeyLookup } = {},
): GuardedOutput {
  const lookupTestKey = opts.lookupTestKey ?? (() => null);
  const notes: string[] = [];
  const docDatePrinted = clean(raw.document_date_as_printed);
  const items: GuardedItem[] = [];

  raw.items.forEach((it, idx) => {
    const label = clean(it.label_as_printed);
    const quote = it.source_quote.trim();
    if (!label && !quote) {
      notes.push(`item ${idx + 1}: dropped (no label and no source quote)`);
      return;
    }

    let value = clean(it.value_as_printed);
    let unit = clean(it.unit_as_printed);
    let range = clean(it.range_as_printed);
    let unreadable = false;
    let guardFailed: string | undefined;

    // G4: the model said it could not read it. Empty, flagged unreadable (FR-04).
    if (!it.readable) unreadable = true;

    // G3: the value must be visible in the quoted source text (L19).
    if (!unreadable && value && !appearsIn(value, quote)) {
      unreadable = true;
      guardFailed = "value_not_in_quote";
      notes.push(`item ${idx + 1}: value_not_in_quote`);
    }

    if (unreadable) {
      value = null;
      unit = null;
      range = null;
    }

    // G1 and G2: numbers come from the printed strings, by our parsers, or not at all.
    const value_num = unreadable ? null : parseValueNum(value);
    const { low, high } = unreadable ? { low: null, high: null } : parseRange(range);

    // G5: medicines and allergies are never trusted without a look, unless clearly read.
    const careful =
      unreadable ||
      guardFailed !== undefined ||
      ((it.kind === "medication" || it.kind === "allergy") && !(it.confidence === "high" && it.readable));

    // G6: item date, else the document's date. Printed text is always kept.
    const datePrinted = clean(it.date_as_printed) ?? docDatePrinted;

    items.push({
      kind: it.kind,
      label_as_printed: label ?? "",
      value_as_printed: value,
      unit_as_printed: unit,
      range_as_printed: range,
      flag_as_printed: unreadable ? null : clean(it.flag_as_printed),
      value_num,
      range_low: low,
      range_high: high,
      fact_date: parseDate(datePrinted),
      fact_date_as_printed: datePrinted,
      unreadable,
      check_carefully: careful,
      confidence: it.confidence,
      source_quote: quote,
      source_box: cleanBox(it.source_box),
      source_page: cleanPage(it.source_page),
      test_key: it.kind === "lab" && label ? lookupTestKey(label) : null,
      extra: guardFailed ? { guard_failed: guardFailed } : {},
    });
  });

  return {
    doc_type: raw.doc_type,
    facility_as_printed: clean(raw.facility_as_printed),
    document_date_as_printed: docDatePrinted,
    document_date: parseDate(docDatePrinted),
    items,
    referral: raw.referral ? guardReferral(raw.referral, notes) : null,
    notes,
  };
}

/** Reason, urgency, clinician and date are carried verbatim or not at all (hard rule 7, L21). */
function guardReferral(r: NonNullable<ModelOutput["referral"]>, notes: string[]): GuardedReferral {
  const keep = (name: string, f: NonNullable<ModelOutput["referral"]>["reason_as_written"]) => {
    const text = clean(f?.text);
    if (!f || !text) return null;
    if (!appearsIn(text, f.source_quote)) {
      notes.push(`referral.${name}: not_in_quote`);
      return null;
    }
    return { text, source_quote: f.source_quote.trim(), source_box: cleanBox(f.source_box), source_page: cleanPage(f.source_page) };
  };
  return {
    reason_as_written: keep("reason", r.reason_as_written),
    urgency_as_written: keep("urgency", r.urgency_as_written),
    referring_clinician_as_written: keep("clinician", r.referring_clinician_as_written),
    referral_date_as_written: keep("date", r.referral_date_as_written),
  };
}
