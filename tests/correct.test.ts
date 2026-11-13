import { describe, expect, it } from "vitest";
import { applyCorrection, correctionSchema, type Correctable } from "@/lib/facts/correct";

const base: Correctable = {
  kind: "lab", label_as_printed: "Hb", value_as_printed: "8.9", unit_as_printed: "g/dL",
  range_as_printed: "12.0 - 16.0", fact_date_as_printed: "03/11/2026",
};

describe("applyCorrection (FR-07)", () => {
  it("re-derives numbers, date and test_key from the corrected text", () => {
    const { after } = applyCorrection(base, { value_as_printed: "9.8", label_as_printed: "Haemoglobin" });
    expect(after.value_num).toBe(9.8);
    expect(after.range_low).toBe(12);
    expect(after.range_high).toBe(16);
    expect(after.fact_date).toBe("2026-11-03");
    expect(after.test_key).toBe("haemoglobin");
  });
  it("marks the fact looked-at: confirmed, not unreadable, not check_carefully", () => {
    const { after } = applyCorrection(base, { value_as_printed: "9.8" });
    expect(after).toMatchObject({ state: "confirmed", unreadable: false, check_carefully: false });
  });
  it("records only the changed printed fields, before and after", () => {
    const { diff } = applyCorrection(base, { value_as_printed: "9.8" });
    expect(diff).toEqual({ before: { value_as_printed: "8.9" }, after: { value_as_printed: "9.8" } });
  });
  it("a non-numeric correction gives value_num null and keeps the text", () => {
    const { after } = applyCorrection(base, { value_as_printed: "Positive" });
    expect(after.value_num).toBeNull();
    expect(after.value_as_printed).toBe("Positive");
  });
  it("clearing a field with null or an empty string empties it", () => {
    expect(applyCorrection(base, { range_as_printed: null }).after.range_as_printed).toBeNull();
    expect(applyCorrection(base, { range_as_printed: "" }).after.range_low).toBeNull();
  });
  it("never produces source, kind or document fields (the original image stays attached)", () => {
    const { after } = applyCorrection(base, { value_as_printed: "9.8" });
    for (const k of ["source_quote", "source_box", "document_id", "kind", "origin"]) expect(after).not.toHaveProperty(k);
  });
  it("the schema is strict: unknown fields (origin, state, kind...) are rejected", () => {
    expect(correctionSchema.safeParse({ value_as_printed: "1" }).success).toBe(true);
    for (const bad of [{ origin: "provider_entered" }, { state: "confirmed" }, { kind: "lab" }, { superseded_by: "x" }, {}]) {
      expect(correctionSchema.safeParse(bad).success).toBe(false);
    }
  });
});
