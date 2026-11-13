// FR-17 / NFR-21: advisory, non-blocking, "check with a doctor or pharmacist". Uses the real seeded rules.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { advisoryMessage, findAdvisories, tokens, type AdvisoryRule } from "@/lib/advisory/rules";
import { DRUG_ALLERGY_RULES } from "@/lib/db/seed-data";
import { findAdviceLanguage } from "@/lib/explain/lint";
import type { FactDTO } from "@/lib/facts/dto";
import { buildPacket } from "@/lib/referral/packet";

const RULES: AdvisoryRule[] = DRUG_ALLERGY_RULES;
let n = 0;
const f = (kind: "allergy" | "medication", label: string, over: Partial<FactDTO> = {}): FactDTO => {
  n++;
  return {
    id: `f${n}`, record_id: "r1", document_id: null, origin: "ai_read", state: "confirmed", kind, label_as_printed: label,
    value_as_printed: null, unit_as_printed: null, range_as_printed: null, flag_as_printed: null, value_num: null, range_low: null,
    range_high: null, unreadable: false, check_carefully: false, confidence: "high", source_quote: null, source_box: null, source_page: 1,
    fact_date: null, fact_date_as_printed: null, test_key: null, sensitive_category: null, facility_name: null, extra: {}, superseded_by: null,
    has_image: false, created_at: "2026-11-13T00:00:00.000Z", ...over,
  };
};
const run = (allergy: string, med: string) => findAdvisories([f("allergy", allergy), f("medication", med)], RULES);

describe("findAdvisories", () => {
  it("penicillin allergy + amoxicillin gives an advisory (the demo pair)", () => {
    const a = run("Penicillin", "Amoxicillin 500 mg");
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ rule_id: "penicillins", allergy_label: "Penicillin", medicine_label: "Amoxicillin 500 mg" });
  });
  it("penicillin allergy + cefuroxime gives an advisory carrying the rule note", () => {
    const a = run("Penicillin", "Cefuroxime 250 mg");
    expect(a).toHaveLength(1);
    expect(a[0].rule_id).toBe("penicillin_cephalosporin");
    expect(a[0].note).toBe("Cephalosporins are related to penicillins.");
  });
  it("sulfa allergy + co-trimoxazole (hyphenated alias) gives one", () => {
    expect(run("Sulfa drugs", "Co-trimoxazole 480 mg")).toHaveLength(1);
    expect(run("Sulfonamide", "Septrin")).toHaveLength(1);
  });
  it("NSAID and macrolide groups", () => {
    expect(run("Aspirin", "Ibuprofen 400 mg")).toHaveLength(1);
    expect(run("Erythromycin", "Azithromycin 500 mg")).toHaveLength(1);
  });
  it("a penicillin allergy with paracetamol gives none", () => {
    expect(run("Penicillin", "Paracetamol 500 mg")).toEqual([]);
  });
  it("a direct match without a rule: the allergy word is in the medicine name", () => {
    const a = run("Loratadine", "Loratadine 10 mg");
    expect(a).toHaveLength(1);
    expect(a[0].rule_id).toBeNull();
  });
  it("short and filler words never create a match", () => {
    expect(run("Allergy to tablets", "Paracetamol tablets")).toEqual([]);
    expect(run("Oral drugs", "Oral rehydration salts")).toEqual([]);
  });
  it("an unreadable allergy or medicine is ignored", () => {
    expect(findAdvisories([f("allergy", "Penicillin", { unreadable: true }), f("medication", "Amoxicillin")], RULES)).toEqual([]);
    expect(findAdvisories([f("allergy", "Penicillin"), f("medication", "Amoxicillin", { unreadable: true })], RULES)).toEqual([]);
  });
  it("a superseded medicine is ignored (removed facts never reach this function)", () => {
    expect(findAdvisories([f("allergy", "Penicillin"), f("medication", "Amoxicillin", { superseded_by: "x" })], RULES)).toEqual([]);
  });
  it("two matching medicines give two advisories", () => {
    const a = findAdvisories([f("allergy", "Penicillin"), f("medication", "Amoxicillin 500 mg"), f("medication", "Augmentin 625 mg")], RULES);
    expect(a).toHaveLength(2);
  });
  it("one pair gives one advisory even if several rules could match", () => {
    expect(run("Penicillin", "Amoxicillin")).toHaveLength(1);
  });
  it("tokens split on non-letters", () => {
    expect(tokens("Co-amoxiclav 625 mg")).toEqual(["co", "amoxiclav", "mg"]);
  });
});

describe("the message (NFR-21, NFR-19)", () => {
  const m = run("Penicillin", "Amoxicillin")[0].message;
  it("is exactly the fixed sentence", () => {
    expect(m).toBe(
      "Your record lists an allergy to Penicillin and a medicine called Amoxicillin. Itan cannot tell whether this is a problem. Please check with a doctor or pharmacist. This check uses a short list that has not been clinically validated. This is not medical advice.",
    );
    expect(m).toBe(advisoryMessage("Penicillin", "Amoxicillin"));
  });
  it("says to check with a doctor or pharmacist and that it is not medical advice", () => {
    expect(m).toContain("check with a doctor or pharmacist");
    expect(m).toContain("not medical advice");
  });
  it("contains no advice language, no severity, no 'avoid' or 'do not take'", () => {
    expect(findAdviceLanguage(m)).toEqual([]);
    expect(m).not.toMatch(/avoid|do not take|dangerous|alternative|stop taking|contraindicat/i);
  });
  it("rule notes are neutral too", () => {
    for (const r of RULES) {
      expect(findAdviceLanguage(r.note), r.note).toEqual([]);
      expect(r.note).not.toMatch(/avoid|do not take|dangerous|alternative/i);
    }
  });
});

describe("non-blocking and read-only (NFR-21)", () => {
  it("the advisory modules write nothing: no insert, update or delete anywhere", () => {
    for (const file of ["lib/advisory/rules.ts", "lib/advisory/queries.ts", "lib/advisory/service.ts"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/\.(insert|update|delete)\(/);
    }
  });
  it("the packet carries advisories computed from the facts the viewer can see only", () => {
    const allergy = f("allergy", "Penicillin", { sensitive_category: "mental_health" });
    const med = f("medication", "Amoxicillin 500 mg");
    const input = { record: { display_name: "x", birth_year: null }, referral: { referring_clinician_as_written: null, referral_date_as_written: null }, destinationName: null, sourceFact: null, facts: [allergy, med], advisoryRules: RULES };
    expect(buildPacket(input).advisories).toHaveLength(1);
    const hidden = buildPacket({ ...input, share: { hiddenCategories: ["mental_health"], hiddenDocumentIds: [] } });
    expect(hidden.advisories).toEqual([]);
    expect(JSON.stringify(hidden)).not.toContain("Penicillin");
  });
  it("the advisory is a flag only: the packet is built whether or not it exists", () => {
    const p = buildPacket({ record: { display_name: "x", birth_year: null }, referral: { referring_clinician_as_written: null, referral_date_as_written: null }, destinationName: null, sourceFact: null, facts: [] });
    expect(p.advisories).toEqual([]);
    expect(p.results.status).toBe("missing");
  });
});
