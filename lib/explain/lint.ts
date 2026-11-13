// Advice-language lint (NFR-19, NFR-20). Used by tests on every string the explanation engine, the referral
// packet and the advisory can produce. "below", "within" and "above" are the only direction words allowed.
const ADVICE = /normal|abnormal|\bhigh\b|\blow\b|concern|worr|risk|treat|should|need to|likely|probably|diagnos|caus|indicat|serious|danger/gi;

/** The offending words found in `text` (empty array = clean). */
export function findAdviceLanguage(text: string): string[] {
  return [...text.matchAll(ADVICE)].map((m) => m[0]);
}
