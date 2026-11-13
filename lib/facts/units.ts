// Unit comparison (NFR-18, FR-24, D-020). PURE. The ONE place two units are compared for equality.
//
// Units are never converted. To COMPARE two unit strings we apply Unicode NFKC, collapse runs of whitespace and
// trim. That folds look-alike characters, the case that prompted it being the micro sign U+00B5 versus the Greek
// mu U+03BC in "µmol/L": identical on screen, different characters, and a model may return either.
//
// Limits (decided by the owner, D-020):
//   - comparison only. The stored text is whatever the model (or the hospital, or the patient) supplied. We do not
//     rewrite it, and we do not claim it is "as printed" at the character level, because we cannot verify the glyph.
//   - units only. Never applied to labels, values, ranges, medicines or allergies.
//   - NFKC, trim and whitespace collapse ONLY: no case folding, no other character mapping, no unit conversion.
//     "mmol/L" vs "µmol/L", "g/dL" vs "g/L" and "mmol/L" vs "mmol/l" are all still different.
// Known consequence of NFKC: superscript digits fold to plain digits ("10⁹/L" equals "109/L"). Accepted.

/** The comparison form of a unit. Not for storage or display. */
export function normaliseUnit(unit: string | null | undefined): string {
  return (unit ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}

/** Are these the same unit for comparison purposes? The shared helper: use it everywhere units are compared. */
export const unitsEqual = (a: string | null | undefined, b: string | null | undefined): boolean => normaliseUnit(a) === normaliseUnit(b);

const rawTrim = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/** Equal only because of the folding above: different characters, same unit. False when identical or genuinely different. */
export const isGlyphVariantOnly = (a: string | null | undefined, b: string | null | undefined): boolean =>
  rawTrim(a) !== rawTrim(b) && unitsEqual(a, b);
