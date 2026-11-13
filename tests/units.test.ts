// D-020: the ONE unit comparison. NFKC, trim, collapse whitespace; for comparison only; units only.
// These tests pin the limits the owner set, so the rule cannot quietly grow.
import { describe, expect, it } from "vitest";
import { attachPrevious, getPreviousValue } from "@/lib/facts/compare";
import type { FactDTO } from "@/lib/facts/dto";
import { isGlyphVariantOnly, normaliseUnit, unitsEqual } from "@/lib/facts/units";

const MICRO = "µ"; // MICRO SIGN
const MU = "μ"; // GREEK SMALL LETTER MU

describe("unitsEqual (the shared helper)", () => {
  // The three cases the owner asked for by name.
  it("µmol/L equals μmol/L", () => {
    expect(unitsEqual(`${MICRO}mol/L`, `${MU}mol/L`)).toBe(true);
    expect(unitsEqual(`${MU}mol/L`, `${MICRO}mol/L`)).toBe(true);
  });
  it("mmol/L differs from µmol/L", () => {
    expect(unitsEqual("mmol/L", `${MICRO}mol/L`)).toBe(false);
    expect(unitsEqual("mmol/L", `${MU}mol/L`)).toBe(false);
  });
  it("g/dL differs from g/L", () => {
    expect(unitsEqual("g/dL", "g/L")).toBe(false);
  });

  it("trims and collapses whitespace, and nothing more", () => {
    expect(unitsEqual("  g/dL ", "g/dL")).toBe(true);
    expect(unitsEqual("x10^9  /L", "x10^9 /L")).toBe(true);
    expect(unitsEqual(" g/dL", "g/dL")).toBe(true); // non-breaking space folds under NFKC
    expect(unitsEqual("g / dL", "g/dL")).toBe(false); // a space inside is not removed
  });

  it("does no case folding", () => {
    expect(unitsEqual("mmol/L", "mmol/l")).toBe(false);
    expect(unitsEqual("MG/DL", "mg/dL")).toBe(false);
    expect(unitsEqual("IU/L", "iu/l")).toBe(false);
  });

  it("never converts: different units stay different", () => {
    expect(unitsEqual("mg/dL", "mmol/L")).toBe(false);
    expect(unitsEqual("mg/L", "g/L")).toBe(false);
    expect(unitsEqual("%", "mmol/mol")).toBe(false);
  });

  it("treats null and empty alike, and null against a unit as different", () => {
    expect(unitsEqual(null, "")).toBe(true);
    expect(unitsEqual(undefined, null)).toBe(true);
    expect(unitsEqual(null, "%")).toBe(false);
  });

  it("is plain NFKC: it folds compatibility characters, including superscript digits (a known, accepted consequence)", () => {
    expect(normaliseUnit("％")).toBe("%"); // fullwidth percent
    expect(unitsEqual("Ω", "Ω")).toBe(true); // OHM SIGN and OMEGA: canonically equal
    expect(unitsEqual("10⁹/L", "109/L")).toBe(true); // superscript nine folds to 9: accepted (D-020), do not widen
    expect(unitsEqual("10^9/L", "10⁹/L")).toBe(false); // but a caret is not a superscript
  });

  it("isGlyphVariantOnly is true only for different characters that are equal after folding", () => {
    expect(isGlyphVariantOnly(`${MICRO}mol/L`, `${MU}mol/L`)).toBe(true);
    expect(isGlyphVariantOnly(`${MU}mol/L`, `${MU}mol/L`)).toBe(false); // identical
    expect(isGlyphVariantOnly(" g/dL", "g/dL")).toBe(false); // whitespace alone is not a glyph variant
    expect(isGlyphVariantOnly("mmol/L", `${MU}mol/L`)).toBe(false); // genuinely different
  });
});

describe("previous value uses the shared helper (FR-24, NFR-18)", () => {
  let n = 0;
  const lab = (over: Partial<FactDTO>): FactDTO => {
    n++;
    return {
      id: `f${n}`, record_id: "r1", document_id: "d1", origin: "ai_read", state: "confirmed", kind: "lab",
      label_as_printed: "Creatinine", value_as_printed: "88", unit_as_printed: `${MICRO}mol/L`, range_as_printed: "45 - 90", flag_as_printed: null,
      value_num: 88, range_low: 45, range_high: 90, unreadable: false, check_carefully: false, confidence: "high",
      source_quote: "q", source_box: null, source_page: 1, fact_date: "2026-11-09", fact_date_as_printed: "09/11/2026",
      test_key: "creatinine", sensitive_category: null, facility_name: null, extra: {}, superseded_by: null, has_image: true,
      created_at: `2026-11-13T00:00:${String(n).padStart(2, "0")}.000Z`, ...over,
    };
  };

  it("a previous value appears across the two mu characters; each unit text is returned exactly as stored", () => {
    const older = lab({ value_as_printed: "95", value_num: 95, unit_as_printed: `${MU}mol/L`, fact_date: "2026-05-01" });
    const latest = lab({});
    const prev = getPreviousValue([older, latest], latest);
    expect(prev).toEqual({ value_as_printed: "95", unit_as_printed: `${MU}mol/L`, fact_date: "2026-05-01", fact_id: older.id });
    expect(prev!.unit_as_printed).toBe(`${MU}mol/L`); // not rewritten to the other glyph
    expect(latest.unit_as_printed).toBe(`${MICRO}mol/L`); // the fact itself is untouched
  });

  it("the hospital-feed versus AI-read path: a provider-entered result and an AI-read one compare the same way", () => {
    const fromHospital = lab({ origin: "provider_entered", state: "confirmed", unit_as_printed: `${MU}mol/L`, value_as_printed: "101", value_num: 101, fact_date: "2026-08-01", facility_name: "Demo General Hospital (SIMULATED)" });
    const fromPhoto = lab({ origin: "ai_read", state: "unverified", unit_as_printed: `${MICRO}mol/L` });
    expect(getPreviousValue([fromHospital, fromPhoto], fromPhoto)).toMatchObject({ value_as_printed: "101", fact_id: fromHospital.id });
    const withPrev = attachPrevious([fromHospital, fromPhoto]);
    expect(withPrev.find((f) => f.id === fromPhoto.id)?.previous?.value_as_printed).toBe("101");
  });

  it("no previous value when the units genuinely differ (never converted)", () => {
    const latest = lab({});
    expect(getPreviousValue([lab({ unit_as_printed: "mg/dL", value_as_printed: "1.0", value_num: 1, fact_date: "2026-05-01" }), latest], latest)).toBeNull();
    expect(getPreviousValue([lab({ unit_as_printed: "mmol/L", fact_date: "2026-04-01" }), latest], latest)).toBeNull();
    expect(getPreviousValue([lab({ unit_as_printed: "g/dL", fact_date: "2026-03-01" }), lab({ unit_as_printed: "g/L" })].slice(0, 2), lab({ unit_as_printed: "g/L" }))).toBeNull();
  });
});
