// Glossary lint (NFR-17, NFR-19, NFR-20) and lookup (Locked decision L16). A failing entry fails the test:
// fix the glossary row, never the lint.
import { describe, expect, it } from "vitest";
import { DRUG_ALLERGY_RULES, FACILITIES, GLOSSARY } from "@/lib/db/seed-data";
import { getGlossaryRow, lookupTestKey, normaliseKey } from "@/lib/glossary";

const ADVICE = /indicat|caus|mean(s)? you|diagnos|normal range|reference range|high|low|elevated|deficien|risk/i;

describe("glossary lint", () => {
  it("has the 25 tests the design names", () => {
    expect(GLOSSARY).toHaveLength(25);
    expect(new Set(GLOSSARY.map((g) => g.test_key)).size).toBe(25);
  });
  it.each(GLOSSARY.map((g) => [g.test_key, g] as const))("%s: no digits, no advice words, 2+ questions", (_k, g) => {
    for (const text of [g.description, ...g.questions]) {
      expect(text, `digit in: ${text}`).not.toMatch(/\d/);
      expect(text, `advice word in: ${text}`).not.toMatch(ADVICE);
    }
    expect(g.questions.length).toBeGreaterThanOrEqual(2);
    expect(g.description.trim().endsWith(".")).toBe(true);
  });
  it("no alias is claimed by two tests (a label must resolve to one test)", () => {
    const seen = new Map<string, string>();
    for (const g of GLOSSARY) {
      for (const a of [g.test_key, g.display_name, ...g.aliases]) {
        const k = normaliseKey(a);
        const prev = seen.get(k);
        expect(prev === undefined || prev === g.test_key, `"${a}" is claimed by ${prev} and ${g.test_key}`).toBe(true);
        seen.set(k, g.test_key);
      }
    }
  });
  it("contains no reference ranges anywhere in the repo's seed content (NFR-17)", () => {
    const all = JSON.stringify(GLOSSARY) + JSON.stringify(DRUG_ALLERGY_RULES);
    expect(all).not.toMatch(/\d+(\.\d+)?\s*[-–]\s*\d+(\.\d+)?\s*(g\/dl|mmol|mg|%)/i);
  });
});

describe("lookupTestKey", () => {
  it.each([
    ["Hb", "haemoglobin"],
    ["HAEMOGLOBIN", "haemoglobin"],
    ["Haemoglobin (Hb)", "haemoglobin"],
    ["Hemoglobin", "haemoglobin"],
    ["  hgb ", "haemoglobin"],
    ["HbA1c", "hba1c"],
    ["Fasting Blood Sugar", "fasting_glucose"],
    ["WBC", "wbc"],
    ["Serum creatinine", "creatinine"],
    ["ALT (SGPT)", "alt"],
    ["HBsAg", "hbsag"],
  ])("%j -> %s", (label, key) => {
    expect(lookupTestKey(label)).toBe(key);
  });
  it.each(["", "Unknown test", "Hb-like thing", "Zzz"])("%j -> null", (label) => {
    expect(lookupTestKey(label)).toBeNull();
  });
  it("getGlossaryRow returns the row or null", () => {
    expect(getGlossaryRow("haemoglobin")?.display_name).toBe("Haemoglobin");
    expect(getGlossaryRow(null)).toBeNull();
    expect(getGlossaryRow("nope")).toBeNull();
  });
});

describe("seed content", () => {
  it("every facility and the hospital are labelled SIMULATED (hard rule 8)", () => {
    expect(FACILITIES.length).toBeGreaterThanOrEqual(6);
    for (const f of FACILITIES) expect(f.name).toMatch(/\(SIMULATED\)/);
  });
  it("drug-allergy rules are neutral: no advice verbs in notes", () => {
    for (const r of DRUG_ALLERGY_RULES) expect(r.note).not.toMatch(/avoid|do not take|should|dangerous|contraindicat/i);
  });
});
