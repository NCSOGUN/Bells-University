// Date parser (Locked decision L18). A date printed as dd/mm/yyyy is DAY-FIRST (Nigerian convention).
// Accepts: dd/mm/yyyy (also - or . separators), ISO yyyy-mm-dd, "3 Nov 2026" / "03 November 2026".
// Anything else (including two-digit years, which are ambiguous) gives null: the UI then shows
// "date not readable" and the printed text is still kept.

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
];

function iso(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Reject overflow such as 31/02/2026 (JS would roll it into March).
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y.toString().padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Printed date text -> ISO "yyyy-mm-dd", or null. Pure; no timezone involved. */
export function parseDate(printed: string | null | undefined): string | null {
  if (printed == null) return null;
  const s = printed.trim().replace(/\s+/g, " ");

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return iso(+m[3], +m[2], +m[1]); // day first

  m = /^(\d{1,2})(?:st|nd|rd|th)?[ -]([A-Za-z]{3,9}),?[ -](\d{4})$/.exec(s);
  if (m) {
    const idx = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (idx < 0) return null;
    return iso(+m[3], idx + 1, +m[1]);
  }
  return null;
}
