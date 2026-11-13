import { describe, expect, it } from "vitest";
import { applyGuards } from "@/lib/extract/guards";
import type { ExtractedItem, ModelOutput } from "@/lib/extract/schema";
import type { FixtureKey, KeyItem } from "../tools/fixtures/key-schema";
import { nfr15, reclassifyGlyphVariants, scoreDocument } from "../tools/extract-score";

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

  it("a referral letter reports whether reason and urgency came back in the letter's exact words", () => {
    const w = (text: string) => ({ text, source_quote: text, source_box: null, source_page: 1 });
    const k = key([], { doc_type: "referral_letter", referral: { reason: "Query anaemia", urgency: "See within 2 weeks", clinician: "Dr X" } });
    const none = { reason_as_written: null, urgency_as_written: null, referring_clinician_as_written: null, referral_date_as_written: null };
    expect(score(k, [], none).referral).toEqual({ reason: false, urgency: false }); // returning nothing is not a pass
    const exact = { ...none, reason_as_written: w("Query anaemia"), urgency_as_written: w("See within 2 weeks") };
    expect(score(k, [], exact).referral).toEqual({ reason: true, urgency: true });
    const half = { ...none, reason_as_written: w("Query anaemia"), urgency_as_written: w("See within 2 weeks please") };
    expect(score(k, [], half).referral).toEqual({ reason: true, urgency: false });
    expect(score(key([kItem()]), [mItem()]).referral).toBeNull();
  });

  describe("unit glyph variants (D-020): reported separately, never hidden, never wider than the unit field", () => {
    const MICRO = "µ";
    const MU = "μ";
    const creat = (o: Partial<KeyItem> = {}) => kItem({ label: "Creatinine", value: "88", unit: `${MICRO}mol/L`, range: "45 - 90", ...o });
    const mCreat = (o: Partial<ExtractedItem> = {}) =>
      mItem({ label_as_printed: "Creatinine", value_as_printed: "88", unit_as_printed: `${MU}mol/L`, range_as_printed: "45 - 90", source_quote: "Creatinine 88 µmol/L 45 - 90", ...o });

    it("a mu-only unit difference is not critical, is recorded, and the strict unit rate still counts a miss", () => {
      const s = score(key([creat()]), [mCreat()]);
      expect(s.critical).toEqual([]);
      expect(s.glyph_variants).toEqual([{ document: "doc", item: "Creatinine", expected: `${MICRO}mol/L`, actual: `${MU}mol/L` }]);
      expect(s.rates.unit).toEqual({ hit: 0, total: 1 }); // strict: NOT counted as a hit
      expect(s.rates.value).toEqual({ hit: 1, total: 1 });
    });

    it("any other unit difference is still critical, including a milli/micro mix-up", () => {
      for (const unit of ["mmol/L", "mg/dL", "umol/L", `${MU}mol/l`]) {
        const s = score(key([creat()]), [mCreat({ unit_as_printed: unit })]);
        expect(s.critical.map((c) => c.reason), unit).toEqual(["unit differs from key"]);
        expect(s.glyph_variants, unit).toEqual([]);
      }
    });

    it("the allowance does not reach values, labels or ranges: a wrong value beside a mu variant is still critical", () => {
      const s = score(key([creat()]), [mCreat({ value_as_printed: "98", source_quote: "Creatinine 98 µmol/L" })]);
      expect(s.critical.map((c) => c.reason)).toEqual(["value differs from key"]);
      expect(s.glyph_variants).toHaveLength(1);
    });

    it("the verdict states both counts: reported and strict", () => {
      const s = score(key([creat()]), [mCreat()]);
      const v = nfr15([s]);
      expect(v).toMatchObject({ pass: true, critical: 0, variants: 1, strict: 1 });
      expect(v.line).toBe("NFR-15: PASS (0 critical; 1 glyph variant, reclassified, see D-020)");
    });

    it("a variant does not rescue a run that has a real critical error, or one with failed documents", () => {
      const real = score(key([kItem()]), [mItem({ unit_as_printed: "g/L" })]);
      expect(nfr15([score(key([creat()]), [mCreat()]), real]).line).toMatch(/^NFR-15: FAIL \(1 critical errors; 1 glyph variant, reclassified, see D-020\)$/);
      expect(nfr15([score(key([creat()]), [mCreat()])], 2).line).toMatch(/^NFR-15: INCOMPLETE .*1 glyph variant.*2 failed to extract/);
    });

    it("rescoring a SAVED strict score (no model call): a mu-only unit critical becomes a variant, nothing else moves", () => {
      // What the first run saved: the two mu findings were critical, and the strict unit rate counted a miss.
      const saved = score(key([creat()]), [mCreat()]);
      const strictFromFile = {
        ...saved,
        glyph_variants: [],
        critical: [{ document: "doc", item: "Creatinine", reason: "unit differs from key", expected: `${MICRO}mol/L`, actual: `${MU}mol/L` }],
      };
      const again = reclassifyGlyphVariants(strictFromFile);
      expect(again.critical).toEqual([]);
      expect(again.glyph_variants).toEqual([{ document: "doc", item: "Creatinine", expected: `${MICRO}mol/L`, actual: `${MU}mol/L` }]);
      expect(again.rates).toEqual(strictFromFile.rates); // the strict unit rate is untouched
      expect(nfr15([strictFromFile]).line).toMatch(/^NFR-15: FAIL \(1 critical errors\)$/);
      expect(nfr15([again])).toMatchObject({ pass: true, critical: 0, variants: 1, strict: 1 });
      expect(reclassifyGlyphVariants(again)).toEqual(again); // idempotent
    });

    it("rescoring leaves every other critical alone: other units, values, and unrelated reasons", () => {
      const mk = (reason: string, expected: string, actual: string) => ({ document: "doc", item: "X", reason, expected, actual });
      const s = {
        ...score(key([kItem()]), [mItem()]),
        glyph_variants: [],
        critical: [
          mk("unit differs from key", "mmol/L", `${MU}mol/L`), // milli vs micro: genuinely different
          mk("unit differs from key", "g/dL", "g/L"),
          mk("value differs from key", `${MICRO}mol/L`, `${MU}mol/L`), // same strings, but this is not a unit finding
          mk("high-confidence item not in key (wrong name or invented)", "(absent)", "Foo"),
        ],
      };
      const r = reclassifyGlyphVariants(s);
      expect(r.critical).toEqual(s.critical);
      expect(r.glyph_variants).toEqual([]);
    });
  });

  it("documents that failed to extract make the verdict INCOMPLETE, not PASS", () => {
    const ok = score(key([kItem()]), [mItem()]);
    expect(nfr15([ok], 1)).toMatchObject({ pass: false, critical: 0 });
    expect(nfr15([ok], 1).line).toMatch(/^NFR-15: INCOMPLETE .*1 failed to extract/);
    expect(nfr15([ok], 0).pass).toBe(true);
  });

  it("NFR-15 verdict lines", () => {
    expect(nfr15([]).line).toBe("NFR-15: NOT RUN (no documents were scored)");
    expect(nfr15([score(key([kItem()]), [mItem()])]).line).toBe("NFR-15: PASS");
    const bad = score(key([kItem()]), [mItem({ unit_as_printed: "g/L" })]);
    expect(nfr15([bad]).line).toBe("NFR-15: FAIL (1 critical errors)");
  });
});
