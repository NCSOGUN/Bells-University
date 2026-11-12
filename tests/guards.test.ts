import { describe, expect, it } from "vitest";
import { applyGuards } from "@/lib/extract/guards";
import type { ExtractedItem, ModelOutput } from "@/lib/extract/schema";

function item(over: Partial<ExtractedItem> = {}): ExtractedItem {
  return {
    kind: "lab",
    label_as_printed: "Haemoglobin",
    value_as_printed: "9.8",
    unit_as_printed: "g/dL",
    range_as_printed: "12.0 - 16.0",
    flag_as_printed: null,
    date_as_printed: null,
    readable: true,
    confidence: "high",
    source_quote: "Haemoglobin 9.8 g/dL 12.0 - 16.0",
    source_box: [100, 50, 120, 800],
    source_page: 1,
    ...over,
  };
}

function doc(items: ExtractedItem[], over: Partial<ModelOutput> = {}): ModelOutput {
  return {
    doc_type: "lab_report",
    facility_as_printed: "Sample Diagnostics Laboratory",
    document_date_as_printed: "03/11/2026",
    items,
    referral: null,
    ...over,
  };
}

const one = (it: ExtractedItem, over: Partial<ModelOutput> = {}) => applyGuards(doc([it], over)).items[0];

describe("G1 value_num is derived by our code", () => {
  it("parses a plain number from the printed value", () => {
    expect(one(item()).value_num).toBe(9.8);
  });
  it("ignores a number the model tried to supply", () => {
    const sneaky = { ...item(), value_num: 999, range_low: 1, range_high: 2 } as unknown as ExtractedItem;
    const g = one(sneaky);
    expect(g.value_num).toBe(9.8);
    expect(g.range_low).toBe(12);
    expect(g.range_high).toBe(16);
  });
  it.each(["<0.5", "Positive", "1,200", "Nil", "9.8.1", ""])("gives value_num null for %j", (v) => {
    const g = one(item({ value_as_printed: v, source_quote: `Test ${v}` }));
    expect(g.value_num).toBeNull();
  });
});

describe("G2 range bounds are derived from the printed range", () => {
  it.each([
    ["12.0 - 16.0", 12, 16],
    ["12.0–16.0", 12, 16],
    ["12-16", 12, 16],
    ["< 5.7", null, 5.7],
    ["> 3", 3, null],
    ["12.0 - 16.0 g/dL", 12, 16],
  ])("%j gives low=%s high=%s", (range, lo, hi) => {
    const g = one(item({ range_as_printed: range }));
    expect(g.range_low).toBe(lo);
    expect(g.range_high).toBe(hi);
    expect(g.range_as_printed).toBe(range);
  });
  it.each(["see note", "16 - 12", "Negative", "12 to 16"])("keeps only the text for %j", (range) => {
    const g = one(item({ range_as_printed: range }));
    expect(g.range_low).toBeNull();
    expect(g.range_high).toBeNull();
    expect(g.range_as_printed).toBe(range);
  });
});

describe("G3 the value must appear in the source quote", () => {
  it("passes when the value is in the quote, ignoring case and spacing", () => {
    expect(one(item({ value_as_printed: "POSITIVE", source_quote: "Malaria   parasite  positive" })).unreadable).toBe(false);
  });
  it("marks the item unreadable and clears values when it is not (L19)", () => {
    const g = one(item({ value_as_printed: "9.8", source_quote: "Haemoglobin 8.9 g/dL" }));
    expect(g.unreadable).toBe(true);
    expect(g.value_as_printed).toBeNull();
    expect(g.unit_as_printed).toBeNull();
    expect(g.range_as_printed).toBeNull();
    expect(g.value_num).toBeNull();
    expect(g.range_low).toBeNull();
    expect(g.check_carefully).toBe(true);
    expect(g.extra.guard_failed).toBe("value_not_in_quote");
  });
  it("does not accept 9.8 inside 19.8 or 9.85", () => {
    expect(one(item({ source_quote: "Haemoglobin 19.8 g/dL" })).unreadable).toBe(true);
    expect(one(item({ source_quote: "Haemoglobin 9.85 g/dL" })).unreadable).toBe(true);
  });
  it("records a content-free note", () => {
    const out = applyGuards(doc([item({ source_quote: "nothing here" })]));
    expect(out.notes).toEqual(["item 1: value_not_in_quote"]);
  });
});

describe("G4 readable=false forces empty values", () => {
  it("a blurred item has no value, unit, range or numbers", () => {
    const g = one(item({ readable: false, confidence: "low", value_as_printed: "9.8", unit_as_printed: "g/dL", range_as_printed: "12-16" }));
    expect(g.unreadable).toBe(true);
    expect(g.value_as_printed).toBeNull();
    expect(g.unit_as_printed).toBeNull();
    expect(g.range_as_printed).toBeNull();
    expect(g.value_num).toBeNull();
    expect(g.range_low).toBeNull();
    expect(g.range_high).toBeNull();
    expect(g.check_carefully).toBe(true);
  });
});

describe("G5 medicines and allergies are checked carefully unless clearly read", () => {
  const med = (over: Partial<ExtractedItem>) =>
    item({ kind: "medication", label_as_printed: "Amoxicillin 500 mg", value_as_printed: "1 tab three times daily", unit_as_printed: null, range_as_printed: null, source_quote: "Amoxicillin 500 mg 1 tab three times daily", ...over });
  it("high confidence and readable is not flagged", () => {
    expect(one(med({})).check_carefully).toBe(false);
  });
  it.each(["medium", "low"] as const)("%s confidence is flagged", (c) => {
    expect(one(med({ confidence: c })).check_carefully).toBe(true);
  });
  it("an allergy at low confidence is flagged", () => {
    expect(one(item({ kind: "allergy", label_as_printed: "Penicillin", value_as_printed: null, confidence: "low", source_quote: "Allergy: Penicillin" })).check_carefully).toBe(true);
  });
  it("a lab at high confidence is not flagged", () => {
    expect(one(item()).check_carefully).toBe(false);
  });
  it("nothing is ever confirmed: the output has no state field", () => {
    expect(Object.keys(one(item()))).not.toContain("state");
  });
});

describe("G6 dates are day-first and the printed text is kept", () => {
  it("uses the item date, else the document date", () => {
    expect(one(item({ date_as_printed: "05/11/2026" })).fact_date).toBe("2026-11-05");
    const g = one(item());
    expect(g.fact_date).toBe("2026-11-03");
    expect(g.fact_date_as_printed).toBe("03/11/2026");
  });
  it("an unreadable date gives null but keeps the text", () => {
    const g = one(item({ date_as_printed: "sometime last week" }));
    expect(g.fact_date).toBeNull();
    expect(g.fact_date_as_printed).toBe("sometime last week");
  });
});

describe("other guards", () => {
  it("never alters a unit", () => {
    expect(one(item({ unit_as_printed: "g/L", value_as_printed: "98", source_quote: "Haemoglobin 98 g/L 120 - 160", range_as_printed: "120 - 160" })).unit_as_printed).toBe("g/L");
  });
  it("drops an item with no label and no quote", () => {
    const out = applyGuards(doc([item({ label_as_printed: " ", source_quote: "" })]));
    expect(out.items).toHaveLength(0);
    expect(out.notes[0]).toMatch(/dropped/);
  });
  it("turns a malformed box into null without throwing", () => {
    expect(one(item({ source_box: [1, 2, 3] })).source_box).toBeNull();
    expect(one(item({ source_box: [500, 10, 100, 20] })).source_box).toBeNull();
    expect(one(item({ source_box: [0, 0, 5000, 10] })).source_box).toBeNull();
    expect(one(item({ source_box: null })).source_box).toBeNull();
    expect(one(item()).source_box).toEqual([100, 50, 120, 800]);
  });
  it("applies the injected test_key lookup to labs only", () => {
    const lookup = (l: string) => (l === "Haemoglobin" ? "haemoglobin" : null);
    const out = applyGuards(doc([item(), item({ kind: "diagnosis", label_as_printed: "Haemoglobin", value_as_printed: null, source_quote: "Haemoglobin" })]), { lookupTestKey: lookup });
    expect(out.items[0].test_key).toBe("haemoglobin");
    expect(out.items[1].test_key).toBeNull();
  });
});

describe("referral fields are carried verbatim or not at all", () => {
  const written = (text: string, quote: string) => ({ text, source_quote: quote, source_box: null, source_page: 1 });
  const letter = (urgency: ReturnType<typeof written> | null, reason = written("Persistent anaemia", "Reason: Persistent anaemia")) =>
    doc([], {
      doc_type: "referral_letter",
      referral: { reason_as_written: reason, urgency_as_written: urgency, referring_clinician_as_written: null, referral_date_as_written: null },
    });

  it("keeps reason and urgency that are inside their quotes", () => {
    const r = applyGuards(letter(written("please see within 2 weeks", "Urgency: please see within 2 weeks"))).referral!;
    expect(r.reason_as_written?.text).toBe("Persistent anaemia");
    expect(r.urgency_as_written?.text).toBe("please see within 2 weeks");
  });
  it("leaves urgency null when the letter states none", () => {
    expect(applyGuards(letter(null)).referral!.urgency_as_written).toBeNull();
  });
  it("drops an urgency that is not in the quote (a paraphrase or invention)", () => {
    const out = applyGuards(letter(written("URGENT", "Please see this patient when convenient")));
    expect(out.referral!.urgency_as_written).toBeNull();
    expect(out.notes).toContain("referral.urgency: not_in_quote");
  });
});
