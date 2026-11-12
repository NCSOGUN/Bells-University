import { describe, expect, it } from "vitest";
import { applyGuards } from "@/lib/extract/guards";
import type { ExtractedItem, ModelOutput } from "@/lib/extract/schema";
import type { FixtureKey, KeyItem } from "../tools/fixtures/key-schema";
import { nfr15, scoreDocument } from "../tools/extract-score";

const kItem = (o: Partial<KeyItem> = {}): KeyItem => ({
  kind: "lab", label: "Haemoglobin", value: "9.8", unit: "g/dL", range: "12.0 - 16.0", readable: true, critical: true, ...o,
});
const key = (items: KeyItem[], o: Partial<FixtureKey> = {}): FixtureKey => ({
  id: "doc", file: "doc.pdf", doc_type: "lab_report", facility: null, document_date: null, items, referral: null, ...o,
});
const mItem = (o: Partial<ExtractedItem> = {}): ExtractedItem => ({
  kind: "lab", label_as_printed: "Haemoglobin", value_as_printed: "9.8", unit_as_printed: "g/dL", range_as_printed: "12.0 - 16.0",
  flag_as_printed: null, date_as_printed: null, readable: true, confidence: "high",
  source_quote: "Haemoglobin 9.8 g/dL 12.0 - 16.0", source_box: null, source_page: 1, ...o,
});
const out = (items: ExtractedItem[], referral: ModelOutput["referral"] = null) =>
  applyGuards({ doc_type: "lab_report", facility_as_printed: null, document_date_as_printed: null, items, referral });
const score = (k: FixtureKey, items: ExtractedItem[], referral: ModelOutput["referral"] = null) =>
  scoreDocument(k, out(items, referral), 1000);

describe("Prep B scoring", () => {
  it("a perfect read has no critical errors and full rates", () => {
    const s = score(key([kItem()]), [mItem()]);
    expect(s.critical).toEqual([]);
    expect(s.rates.value).toEqual({ hit: 1, total: 1 });
    expect(s.hallucinated).toEqual([]);
  });

  it("a confident wrong value is a critical error", () => {
    const s = score(key([kItem()]), [mItem({ value_as_printed: "8.9", source_quote: "Haemoglobin 8.9 g/dL" })]);
    expect(s.critical).toHaveLength(1);
    expect(s.critical[0].reason).toBe("value differs from key");
  });

  it("the same wrong value at medium confidence is not a critical error", () => {
    const s = score(key([kItem()]), [mItem({ value_as_printed: "8.9", source_quote: "Haemoglobin 8.9 g/dL", confidence: "medium" })]);
    expect(s.critical).toEqual([]);
  });

  it("a wrong unit is critical (NFR-18)", () => {
    const s = score(key([kItem()]), [mItem({ unit_as_printed: "g/L" })]);
    expect(s.critical[0].reason).toBe("unit differs from key");
  });

  it("a wrong medicine name at high confidence is critical (not in key)", () => {
    const med = kItem({ kind: "medication", label: "Amoxicillin 500 mg", value: "1 tab tds", unit: null, range: null });
    const s = score(key([med]), [mItem({ kind: "medication", label_as_printed: "Amoxapine 500 mg", value_as_printed: "1 tab tds", unit_as_printed: null, range_as_printed: null, source_quote: "Amoxapine 500 mg 1 tab tds" })]);
    expect(s.critical.map((c) => c.reason)).toEqual(["high-confidence item not in key (wrong name or invented)"]);
    expect(s.missed).toEqual(["Amoxicillin 500 mg"]);
  });

  it("an invented low-confidence item is hallucinated but not critical", () => {
    const s = score(key([kItem()]), [mItem(), mItem({ label_as_printed: "Ferritin", confidence: "low", value_as_printed: null, source_quote: "Ferritin" })]);
    expect(s.hallucinated).toEqual(["Ferritin"]);
    expect(s.critical).toEqual([]);
  });

  it("an unreadable key item: flagged unreadable is handled, a confident value is critical", () => {
    const k = key([kItem({ value: null, unit: null, range: null, readable: false })]);
    const ok = score(k, [mItem({ readable: false, confidence: "low" })]);
    expect(ok.unreadable).toEqual({ total: 1, handled: 1 });
    expect(ok.critical).toEqual([]);
    const bad = score(k, [mItem()]);
    expect(bad.unreadable).toEqual({ total: 1, handled: 0 });
    expect(bad.critical[0].reason).toBe("confident value on an unreadable item");
  });

  it("guards turn a bad quote into unreadable, so the model's wrong value is caught, not critical", () => {
    const s = score(key([kItem()]), [mItem({ value_as_printed: "8.9" })]); // quote still says 9.8
    expect(s.critical).toEqual([]);
  });

  it("pairs items despite spacing differences in the label", () => {
    const k = key([kItem({ kind: "medication", label: "Amoxicillin 500 mg", value: null, unit: null, range: null })]);
    const s = score(k, [mItem({ kind: "medication", label_as_printed: "Amoxicillin 500mg", value_as_printed: null, unit_as_printed: null, range_as_printed: null, source_quote: "Amoxicillin 500mg" })]);
    expect(s.items_matched).toBe(1);
    expect(s.rates.label.hit).toBe(0); // label text is not an exact match
    expect(s.critical).toEqual([]);
  });

  it("a stated urgency that is not in the key is critical", () => {
    const w = (text: string) => ({ text, source_quote: text, source_box: null, source_page: 1 });
    const referral = { reason_as_written: null, urgency_as_written: w("URGENT"), referring_clinician_as_written: null, referral_date_as_written: null };
    const s = score(key([], { doc_type: "lab_report", referral: null }), [], referral);
    expect(s.critical[0].reason).toBe("urgency is not the letter's words");
  });

  it("NFR-15 verdict lines", () => {
    expect(nfr15([]).line).toBe("NFR-15: NOT RUN (no documents were scored)");
    expect(nfr15([score(key([kItem()]), [mItem()])]).line).toBe("NFR-15: PASS");
    const bad = score(key([kItem()]), [mItem({ unit_as_printed: "g/L" })]);
    expect(nfr15([bad]).line).toBe("NFR-15: FAIL (1 critical errors)");
  });
});
