import { describe, expect, it } from "vitest";
import { attachPrevious, getPreviousValue, latestPerTestKey } from "@/lib/facts/compare";
import type { FactDTO } from "@/lib/facts/dto";

let n = 0;
function lab(over: Partial<FactDTO> = {}): FactDTO {
  n++;
  return {
    id: `f${n}`, record_id: "r1", document_id: "d1", origin: "ai_read", state: "confirmed", kind: "lab",
    label_as_printed: "HbA1c", value_as_printed: "7.4", unit_as_printed: "%", range_as_printed: "4.0 - 5.6", flag_as_printed: null,
    value_num: 7.4, range_low: 4, range_high: 5.6, unreadable: false, check_carefully: false, confidence: "high",
    source_quote: "q", source_box: null, source_page: 1, fact_date: "2026-11-03", fact_date_as_printed: "03/11/2026",
    test_key: "hba1c", sensitive_category: null, facility_name: null, extra: {}, superseded_by: null, has_image: true,
    created_at: `2026-11-13T00:00:${String(n).padStart(2, "0")}.000Z`, ...over,
  };
}

describe("last-value comparison (FR-24, L20)", () => {
  it("two values give a previous with exactly four keys and no direction", () => {
    const old = lab({ value_as_printed: "8.1", value_num: 8.1, fact_date: "2026-05-14" });
    const latest = lab();
    const prev = getPreviousValue([old, latest], latest)!;
    expect(prev).toEqual({ value_as_printed: "8.1", unit_as_printed: "%", fact_date: "2026-05-14", fact_id: old.id });
    expect(Object.keys(prev).sort()).toEqual(["fact_date", "fact_id", "unit_as_printed", "value_as_printed"]);
  });
  it("the older value has no previous; one value has none", () => {
    const old = lab({ fact_date: "2026-05-14" });
    const latest = lab();
    expect(getPreviousValue([old, latest], old)).toBeNull();
    expect(getPreviousValue([latest], latest)).toBeNull();
  });
  it("two values on the same date give none", () => {
    const a = lab();
    const b = lab();
    expect(getPreviousValue([a, b], b)).toBeNull();
  });
  it("different units give none and are never converted (NFR-18)", () => {
    const old = lab({ unit_as_printed: "mmol/mol", fact_date: "2026-05-14" });
    expect(getPreviousValue([old, lab()], lab())).toBeNull();
    const latest = lab();
    expect(getPreviousValue([old, latest], latest)).toBeNull();
  });
  it("trims units before comparing", () => {
    const old = lab({ unit_as_printed: " % ", fact_date: "2026-05-14" });
    const latest = lab();
    expect(getPreviousValue([old, latest], latest)).not.toBeNull();
  });
  it("skips unreadable, superseded and non-numeric facts", () => {
    const latest = lab();
    const facts = [
      lab({ unreadable: true, fact_date: "2026-08-01" }),
      lab({ superseded_by: "x", fact_date: "2026-08-02" }),
      lab({ value_num: null, value_as_printed: "Positive", fact_date: "2026-08-03" }),
      latest,
    ];
    expect(getPreviousValue(facts, latest)).toBeNull();
  });
  it("picks the next older date, not the oldest", () => {
    const oldest = lab({ value_as_printed: "9.0", value_num: 9, fact_date: "2025-01-01" });
    const mid = lab({ value_as_printed: "8.1", value_num: 8.1, fact_date: "2026-05-14" });
    const latest = lab();
    expect(getPreviousValue([oldest, mid, latest], latest)?.fact_id).toBe(mid.id);
  });
  it("never crosses tests or records", () => {
    const other = lab({ test_key: "creatinine", fact_date: "2026-05-14" });
    const otherRecord = lab({ record_id: "r2", fact_date: "2026-05-14" });
    const latest = lab();
    expect(getPreviousValue([other, otherRecord, latest], latest)).toBeNull();
  });
  it("facts without a test_key or date are not compared", () => {
    const a = lab({ test_key: null });
    expect(getPreviousValue([lab({ test_key: null, fact_date: "2026-01-01" }), a], a)).toBeNull();
    const b = lab({ fact_date: null });
    expect(getPreviousValue([lab({ fact_date: "2026-01-01" }), b], b)).toBeNull();
  });
  it("attachPrevious adds previous only where one exists; the demo pair behaves", () => {
    const old = lab({ value_as_printed: "8.1", value_num: 8.1, fact_date: "2026-05-14" });
    const latest = lab();
    const out = attachPrevious([old, latest]);
    expect(out.find((f) => f.id === latest.id)?.previous?.value_as_printed).toBe("8.1");
    expect(out.find((f) => f.id === old.id)?.previous).toBeUndefined();
  });
  it("latestPerTestKey keeps the newest per test and every untyped lab", () => {
    const old = lab({ fact_date: "2026-05-14" });
    const latest = lab();
    const untyped1 = lab({ test_key: null });
    const untyped2 = lab({ test_key: null });
    const ids = latestPerTestKey([old, latest, untyped1, untyped2]).map((f) => f.id);
    expect(ids).toContain(latest.id);
    expect(ids).not.toContain(old.id);
    expect(ids).toEqual(expect.arrayContaining([untyped1.id, untyped2.id]));
  });
});
