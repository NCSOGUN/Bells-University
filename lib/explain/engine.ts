// C09 EXPLANATION ENGINE (FR-09, NFR-13, NFR-17, NFR-19, NFR-20). PURE and DETERMINISTIC.
// No language model is ever called here (Gemini's terms bar medical advice). Every sentence is one of the
// templates below or a glossary row; there is no other source of text. Comparison uses ONLY the range printed
// on the same document (range_low / range_high of this fact): the system holds no reference range of its own.
// Units are repeated exactly as printed and never converted (NFR-18). Direction words are limited to
// "below", "within", "above". No cause, diagnosis, severity, reassurance or action other than "discuss with your doctor".
import type { FactDTO } from "@/lib/facts/dto";

export type ExplainStatus = "below" | "within" | "above" | "no_range" | "not_comparable" | "unreadable" | "not_a_lab";

export interface GlossaryRow {
  test_key: string;
  description: string;
  questions: string[];
}

export interface Explanation {
  status: ExplainStatus;
  sentences: string[];
  glossary: { description: string; questions: string[] } | null;
  questions: string[];
  notices: string[];
}

export const TEXT = {
  unverified: "You have not confirmed this value yet.",
  checkCarefully: "Please check this value against your document.",
  unreadable: "Itan could not read this result, so it cannot explain it. Please check the original document.",
  noGlossary: "Itan has no description of this test yet.",
  noticeMain: "Explained by Itan using only the range printed on your own report. This is not medical advice. Please discuss it with your doctor.",
  noticeAi: "Read by AI from your document. It may contain errors.",
  genericQuestions: ["What does this result mean for me?", "Do I need any other tests or a follow-up?"],
} as const;

const join = (...parts: (string | null | undefined)[]) => parts.filter((p) => p && p.trim()).join(" ");

/** Where the number sits against the printed range. Two-sided ranges are inclusive. A one-sided "< n" range
 *  holds values below n, so a value equal to or above n is "above"; a "> n" range holds values above n, so a
 *  value equal to or below n is "below". */
export function compareToPrintedRange(value: number, low: number | null, high: number | null): "below" | "within" | "above" | null {
  if (low !== null && high !== null) return value < low ? "below" : value > high ? "above" : "within";
  if (high !== null) return value < high ? "within" : "above"; // "< high"
  if (low !== null) return value > low ? "within" : "below"; // "> low"
  return null;
}

export function explainFact(fact: FactDTO, glossary: GlossaryRow | null): Explanation {
  const notices: string[] = [TEXT.noticeMain];
  if (fact.origin === "ai_read") notices.push(TEXT.noticeAi);

  if (fact.kind !== "lab") return { status: "not_a_lab", sentences: [], glossary: null, questions: [], notices };

  const prefix: string[] = [];
  if (fact.state === "unverified") prefix.push(TEXT.unverified);
  if (fact.check_carefully) prefix.push(TEXT.checkCarefully);

  const gloss = glossary && fact.test_key === glossary.test_key ? glossary : null;
  const tail: string[] = [gloss ? gloss.description : TEXT.noGlossary];
  const questions = gloss ? [...gloss.questions] : [...TEXT.genericQuestions];
  const glossaryOut = gloss ? { description: gloss.description, questions: [...gloss.questions] } : null;
  const done = (status: ExplainStatus, body: string[]): Explanation => ({
    status,
    sentences: [...prefix, ...body, ...tail],
    glossary: glossaryOut,
    questions,
    notices,
  });

  const label = fact.label_as_printed;
  const value = fact.value_as_printed;
  const unit = fact.unit_as_printed;

  if (fact.unreadable || value === null || value.trim() === "") {
    return { status: "unreadable", sentences: [...prefix, TEXT.unreadable], glossary: glossaryOut, questions, notices };
  }
  if (fact.value_num === null) {
    return done("not_comparable", [
      `Your ${label} result is ${join(value, unit)}. Itan only compares numeric results with a printed range, so it cannot compare this one.`,
    ]);
  }
  if (fact.range_low === null && fact.range_high === null) {
    return done("no_range", [`Your ${label} was ${join(value, unit)}. This report does not print a range for this test, so Itan cannot compare it.`]);
  }
  const where = compareToPrintedRange(fact.value_num, fact.range_low, fact.range_high)!;
  return done(where, [
    `Your ${label} was ${join(value, unit)}. The range printed on this report is ${fact.range_as_printed}. Your result is ${where} that printed range.`,
  ]);
}
