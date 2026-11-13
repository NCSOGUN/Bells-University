// FR-09 / NFR-17 / NFR-18 / NFR-19 / NFR-20. The lint test at the bottom is the NFR-19 evidence.
import { describe, expect, it } from "vitest";
import { GLOSSARY } from "@/lib/db/seed-data";
import { compareToPrintedRange, explainFact, TEXT } from "@/lib/explain/engine";
import { findAdviceLanguage } from "@/lib/explain/lint";
import type { FactDTO } from "@/lib/facts/dto";
import { getGlossaryRow } from "@/lib/glossary";
import { parseRange, parseValueNum } from "@/lib/extract/numbers";

function lab(over: Partial<FactDTO> = {}): FactDTO {
  const value = over.value_as_printed ?? "9.8";
  const range = over.range_as_printed === undefined ? "12.0 - 16.0" : over.range_as_printed;
  const { low, high } = parseRange(range);
  return {
    id: "f", record_id: "r", document_id: "d", origin: "patient_added", state: "confirmed", kind: "lab",
    label_as_printed: "Haemoglobin", value_as_printed: value, unit_as_printed: "g/dL", range_as_printed: range, flag_as_printed: null,
    value_num: parseValueNum(value), range_low: low, range_high: high, unreadable: false, check_carefully: false, confidence: "high",
    source_quote: null, source_box: null, source_page: 1, fact_date: "2026-11-03", fact_date_as_printed: "03/11/2026",
    test_key: "haemoglobin", sensitive_category: null, facility_name: null, extra: {}, superseded_by: null, has_image: true,
    created_at: "2026-11-13T00:00:00.000Z", ...over,
  };
}
const explain = (f: FactDTO) => explainFact(f, getGlossaryRow(f.test_key));

describe("comparison against the printed range", () => {
  it.each([
    ["9.8", "12.0 - 16.0", "below"],
    ["12.0", "12.0 - 16.0", "within"], // inclusive low
    ["16.0", "12.0 - 16.0", "within"], // inclusive high
    ["14", "12.0 - 16.0", "within"],
    ["16.1", "12.0 - 16.0", "above"],
    ["6.2", "< 5.7", "above"],
    ["5.7", "< 5.7", "above"], // equal to the bound is outside "< n"
    ["5.0", "< 5.7", "within"],
    ["3", "> 3", "below"], // equal to the bound is outside "> n"
    ["4", "> 3", "within"],
    ["2", "> 3", "below"],
  ])("value %s against %j is %s", (value, range, expected) => {
    expect(explain(lab({ value_as_printed: value, range_as_printed: range })).status).toBe(expected);
  });

  it("compareToPrintedRange returns null with no bounds", () => {
    expect(compareToPrintedRange(5, null, null)).toBeNull();
  });
});

describe("the exact sentences (design section 10)", () => {
  it("haemoglobin 9.8 g/dL against 12.0 - 16.0", () => {
    const e = explain(lab());
    expect(e.status).toBe("below");
    expect(e.sentences[0]).toBe("Your Haemoglobin was 9.8 g/dL. The range printed on this report is 12.0 - 16.0. Your result is below that printed range.");
    expect(e.sentences[1]).toBe(getGlossaryRow("haemoglobin")!.description);
    expect(e.questions).toEqual(getGlossaryRow("haemoglobin")!.questions);
    expect(e.notices).toContain(TEXT.noticeMain);
  });
  it("no printed range", () => {
    const e = explain(lab({ range_as_printed: null }));
    expect(e.status).toBe("no_range");
    expect(e.sentences[0]).toBe("Your Haemoglobin was 9.8 g/dL. This report does not print a range for this test, so Itan cannot compare it.");
  });
  it("a non-numeric result", () => {
    const e = explain(lab({ label_as_printed: "Malaria parasite", test_key: "malaria_parasite", value_as_printed: "Positive", unit_as_printed: null, range_as_printed: null }));
    expect(e.status).toBe("not_comparable");
    expect(e.sentences[0]).toBe("Your Malaria parasite result is Positive. Itan only compares numeric results with a printed range, so it cannot compare this one.");
  });
  it("an unreadable result", () => {
    const e = explain(lab({ unreadable: true, value_as_printed: null, value_num: null }));
    expect(e.status).toBe("unreadable");
    expect(e.sentences).toContain(TEXT.unreadable);
  });
  it("a missing value is treated as unreadable", () => {
    expect(explain(lab({ value_as_printed: null as unknown as string, value_num: null })).status).toBe("unreadable");
  });
  it("a fact that is not a lab", () => {
    const e = explain(lab({ kind: "medication" }));
    expect(e.status).toBe("not_a_lab");
    expect(e.sentences).toEqual([]);
  });
});

describe("prefixes, glossary and notices", () => {
  it("unverified and check_carefully prefixes come first", () => {
    const e = explain(lab({ state: "unverified", check_carefully: true }));
    expect(e.sentences[0]).toBe(TEXT.unverified);
    expect(e.sentences[1]).toBe(TEXT.checkCarefully);
    expect(e.sentences[2]).toMatch(/^Your Haemoglobin was/);
  });
  it("a test not in the glossary says so and gets the two generic questions", () => {
    const e = explain(lab({ test_key: null, label_as_printed: "Mystery enzyme" }));
    expect(e.sentences).toContain(TEXT.noGlossary);
    expect(e.glossary).toBeNull();
    expect(e.questions).toEqual([...TEXT.genericQuestions]);
  });
  it("the AI-read disclosure appears only for AI-read facts (NFR-13)", () => {
    expect(explain(lab({ origin: "ai_read" })).notices).toContain(TEXT.noticeAi);
    expect(explain(lab({ origin: "patient_added" })).notices).not.toContain(TEXT.noticeAi);
  });
  it("the notice always says it is not medical advice", () => {
    for (const o of ["ai_read", "patient_added", "provider_entered"] as const) {
      expect(explain(lab({ origin: o })).notices.join(" ")).toMatch(/not medical advice/);
    }
  });
});

describe("units and ranges are exactly as printed (NFR-17, NFR-18)", () => {
  it("g/L with a g/L range compares correctly and repeats the printed unit", () => {
    const e = explain(lab({ value_as_printed: "98", unit_as_printed: "g/L", range_as_printed: "120 - 160 g/L" }));
    expect(e.status).toBe("below");
    expect(e.sentences[0]).toBe("Your Haemoglobin was 98 g/L. The range printed on this report is 120 - 160 g/L. Your result is below that printed range.");
  });
  it("an unusual printed range is used as printed, not replaced", () => {
    const e = explain(lab({ value_as_printed: "9.8", range_as_printed: "8.0 - 10.0" }));
    expect(e.status).toBe("within");
    expect(e.sentences[0]).toContain("8.0 - 10.0");
  });
  it("the engine never converts: the same number in different printed units is not rescaled", () => {
    const g = explain(lab({ value_as_printed: "98", unit_as_printed: "g/L", range_as_printed: "12.0 - 16.0 g/dL" }));
    expect(g.status).toBe("above"); // 98 against 12 to 16, as printed: no conversion is attempted
  });
});

// NFR-19 evidence: build facts across every status and every seeded glossary row, run the engine, and lint all text.
describe("advice-language lint over all output (NFR-19, NFR-20)", () => {
  const facts: FactDTO[] = [];
  for (const g of GLOSSARY) {
    facts.push(lab({ test_key: g.test_key, label_as_printed: g.display_name, value_as_printed: "5", range_as_printed: "6 - 9" }));
    facts.push(lab({ test_key: g.test_key, label_as_printed: g.display_name, value_as_printed: "7", range_as_printed: "6 - 9" }));
  }
  facts.push(
    lab({ value_as_printed: "10", range_as_printed: "6 - 9" }),
    lab({ range_as_printed: null }),
    lab({ value_as_printed: "Positive", range_as_printed: null }),
    lab({ unreadable: true, value_as_printed: null, value_num: null }),
    lab({ state: "unverified", check_carefully: true, origin: "ai_read" }),
    lab({ test_key: null, label_as_printed: "Unlisted test" }),
    lab({ kind: "medication" }),
    lab({ value_as_printed: "6.2", range_as_printed: "< 5.7" }),
    lab({ value_as_printed: "2", range_as_printed: "> 3" }),
  );

  it("covers at least 30 facts and every status", () => {
    expect(facts.length).toBeGreaterThanOrEqual(30);
    const statuses = new Set(facts.map((f) => explain(f).status));
    for (const s of ["below", "within", "above", "no_range", "not_comparable", "unreadable", "not_a_lab"]) expect(statuses.has(s as never)).toBe(true);
  });

  it("no sentence, notice or question contains advice language", () => {
    const offenders: string[] = [];
    for (const f of facts) {
      const e = explain(f);
      for (const text of [...e.sentences, ...e.notices, ...e.questions, ...(e.glossary ? [e.glossary.description, ...e.glossary.questions] : [])]) {
        const hits = findAdviceLanguage(text);
        if (hits.length) offenders.push(`${hits.join(",")} in: ${text}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the lint itself catches advice language (it is not vacuous)", () => {
    expect(findAdviceLanguage("This is a normal result, nothing to worry about")).toEqual(expect.arrayContaining(["normal", "worr"]));
    expect(findAdviceLanguage("You should treat this high result")).toEqual(expect.arrayContaining(["should", "treat", "high"]));
    expect(findAdviceLanguage("Your result is below that printed range.")).toEqual([]);
  });

  it("the explanation module cannot reach a model or the network", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of ["lib/explain/engine.ts", "lib/explain/lint.ts"]) {
      // Code only: the header comments are allowed to say why no model is used.
      const code = readFileSync(f, "utf8")
        .split("\n")
        .filter((l) => !l.trim().startsWith("//"))
        .join("\n");
      expect(code).not.toMatch(/genai|gemini|fetch\(|openai|anthropic/i);
    }
  });
});
