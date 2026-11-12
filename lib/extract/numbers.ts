// Number parsers (Locked decision L17). Our code derives numbers from the PRINTED strings;
// the model never supplies them. Anything that does not match exactly gives null and the
// printed text is all that is kept. No unit conversion, no guessing (NFR-18).

const NUM = String.raw`(?:\d+(?:\.\d+)?|\.\d+)`;
const DASH = String.raw`[-–—−]`; // hyphen, en dash, em dash, minus sign
// A printed range may carry its unit after it ("12.0 - 16.0 g/dL"). The suffix must start with a
// letter, %, micro sign or slash, so a stray digit can never be absorbed as part of a bound.
const UNIT_TAIL = String.raw`(?:\s*[A-Za-zµμ%/][A-Za-zµμ%/0-9.^*\s]*)?`;

const VALUE_RE = new RegExp(String.raw`^[+-]?${NUM}$`);
const BETWEEN_RE = new RegExp(String.raw`^(${NUM})\s*${DASH}\s*(${NUM})${UNIT_TAIL}$`);
const BELOW_RE = new RegExp(String.raw`^(?:<|≤|<=)\s*(${NUM})${UNIT_TAIL}$`);
const ABOVE_RE = new RegExp(String.raw`^(?:>|≥|>=)\s*(${NUM})${UNIT_TAIL}$`);

/** value_as_printed -> number. Optional sign, digits and one decimal point only.
 *  "<0.5", "Positive", "1,200" and "" give null. */
export function parseValueNum(printed: string | null | undefined): number | null {
  if (printed == null) return null;
  const s = printed.trim();
  if (!VALUE_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface ParsedRange {
  low: number | null;
  high: number | null;
}

/** range_as_printed -> bounds. Forms: "12.0 - 16.0", "12.0–16.0", "12-16" (low and high),
 *  "< 5.7" (high only), "> 3" (low only). Anything else gives nulls. */
export function parseRange(printed: string | null | undefined): ParsedRange {
  const none: ParsedRange = { low: null, high: null };
  if (printed == null) return none;
  const s = printed.trim();

  const between = BETWEEN_RE.exec(s);
  if (between) {
    const low = Number(between[1]);
    const high = Number(between[2]);
    // A reversed range is a misprint or a misread: keep only the text.
    return low <= high ? { low, high } : none;
  }
  const below = BELOW_RE.exec(s);
  if (below) return { low: null, high: Number(below[1]) };
  const above = ABOVE_RE.exec(s);
  if (above) return { low: Number(above[1]), high: null };
  return none;
}
