// Scoring for the Prep B extraction test (NFR-15). Pure: no network, no files.
// Judges the GUARDED output, i.e. what the patient would actually see.
//
// UNIT GLYPH VARIANT (D-020): a unit that differs from the key ONLY by the micro sign (U+00B5) versus the Greek
// mu (U+03BC). It is reported on its own line, never hidden: the strict unit hit-rate still counts it as a miss,
// and the verdict line states the strict count (variants counted as critical) beside the reported one. It applies
// to the unit field only; a value, label, range, medicine or allergy that differs is critical as before.
//
// CRITICAL ERROR (stop condition, NFR-15): an item presented as confident that is wrong, namely
//   - a high-confidence, readable item that is not in the answer key at all (wrong name or invented), or
//   - a high-confidence, readable item whose value (or unit) differs from the key, or that carries a value
//     where the key says the item is unreadable, or
//   - a referral reason or urgency that is not the letter's words (hard rule 7).
import type { GuardedItem, GuardedOutput } from "../lib/extract/guards";
import { isGlyphVariantOnly } from "../lib/facts/units";
import type { FixtureKey, KeyItem } from "./fixtures/key-schema";

const collapse = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
const sameText = (a: string | null | undefined, b: string | null | undefined) => collapse(a) === collapse(b);
const sameLabel = (a: string, b: string) => collapse(a).toLowerCase() === collapse(b).toLowerCase();
/** Used only to PAIR items; letters and digits, lowercase. "Amoxicillin 500mg" pairs with "amoxicillin 500 mg". */
const pairKey = (kind: string, label: string) => `${kind}:${label.toLowerCase().replace(/[^a-z0-9]/g, "")}`;

export interface CriticalError {
  document: string;
  item: string;
  reason: string;
  expected: string;
  actual: string;
}

export interface FieldRate {
  hit: number;
  total: number;
}

export interface GlyphVariant {
  document: string;
  item: string;
  expected: string;
  actual: string;
}

export interface DocScore {
  id: string;
  latency_ms: number;
  items_expected: number;
  items_found: number;
  items_matched: number;
  missed: string[];
  hallucinated: string[];
  rates: { label: FieldRate; value: FieldRate; unit: FieldRate; range: FieldRate };
  unreadable: { total: number; handled: number };
  meta: { doc_type: boolean; facility: boolean | null; date: boolean | null };
  /** Referral letters only: were the reason and the urgency returned in the letter's exact words? null = not a referral key. */
  referral: { reason: boolean; urgency: boolean } | null;
  /** Units that differ from the key only by the micro sign / Greek mu. Not critical; always reported. */
  glyph_variants: GlyphVariant[];
  guard_notes: number;
  critical: CriticalError[];
}

const confident = (f: GuardedItem) => !f.unreadable && f.confidence === "high";

export function scoreDocument(key: FixtureKey, out: GuardedOutput, latencyMs: number): DocScore {
  const critical: CriticalError[] = [];
  const crit = (item: string, reason: string, expected: string, actual: string) =>
    critical.push({ document: key.id, item, reason, expected, actual });

  // Pair found items with key items (first unused match on kind + normalised label).
  const glyph_variants: GlyphVariant[] = [];
  const used = new Set<number>();
  const pairs: { k: KeyItem; f: GuardedItem | null }[] = key.items.map((k) => {
    const idx = out.items.findIndex((f, i) => !used.has(i) && pairKey(f.kind, f.label_as_printed) === pairKey(k.kind, k.label));
    if (idx >= 0) used.add(idx);
    return { k, f: idx >= 0 ? out.items[idx] : null };
  });
  const extras = out.items.filter((_, i) => !used.has(i));

  const rate = (): FieldRate => ({ hit: 0, total: 0 });
  const rates = { label: rate(), value: rate(), unit: rate(), range: rate() };
  const unreadable = { total: 0, handled: 0 };

  for (const { k, f } of pairs) {
    rates.label.total++;
    if (f && sameLabel(f.label_as_printed, k.label)) rates.label.hit++;
    for (const [field, kv, fv] of [
      ["value", k.value, f?.value_as_printed],
      ["unit", k.unit, f?.unit_as_printed],
      ["range", k.range, f?.range_as_printed],
    ] as const) {
      if (kv === null) continue;
      rates[field].total++;
      if (f && sameText(kv, fv)) rates[field].hit++;
    }
    if (!k.readable) {
      unreadable.total++;
      // Handled = absent, flagged unreadable, or at least no value invented.
      if (!f || f.unreadable || f.value_as_printed === null) unreadable.handled++;
    }
    if (f && k.readable && k.unit !== null && f.unit_as_printed !== null && isGlyphVariantOnly(f.unit_as_printed, k.unit)) {
      glyph_variants.push({ document: key.id, item: k.label, expected: k.unit, actual: f.unit_as_printed });
    }
    if (!f || !confident(f) || !k.critical) continue;

    if (!k.readable && f.value_as_printed !== null) {
      crit(k.label, "confident value on an unreadable item", "(unreadable)", f.value_as_printed);
    } else if (k.readable) {
      if (f.value_as_printed !== null && !sameText(f.value_as_printed, k.value)) {
        crit(k.label, "value differs from key", k.value ?? "(none)", f.value_as_printed);
      }
      if (k.unit !== null && f.unit_as_printed !== null && !sameText(f.unit_as_printed, k.unit) && !isGlyphVariantOnly(f.unit_as_printed, k.unit)) {
        crit(k.label, "unit differs from key", k.unit, f.unit_as_printed);
      }
    }
  }

  for (const f of extras) {
    if (confident(f)) {
      crit(f.label_as_printed, "high-confidence item not in key (wrong name or invented)", "(absent)", `${f.label_as_printed} ${f.value_as_printed ?? ""}`.trim());
    }
  }

  // Referral letters: reason and urgency are carried verbatim or not at all.
  const got = out.referral;
  const want = key.referral;
  if (got?.urgency_as_written) {
    if (!want || !sameText(got.urgency_as_written.text, want.urgency)) {
      crit("referral urgency", "urgency is not the letter's words", want?.urgency ?? "(none stated)", got.urgency_as_written.text);
    }
  }
  if (got?.reason_as_written && (!want || !sameText(got.reason_as_written.text, want.reason))) {
    crit("referral reason", "reason is not the letter's words", want?.reason ?? "(none stated)", got.reason_as_written.text);
  }

  return {
    id: key.id,
    latency_ms: latencyMs,
    items_expected: key.items.length,
    items_found: out.items.length,
    items_matched: pairs.filter((p) => p.f).length,
    missed: pairs.filter((p) => !p.f).map((p) => p.k.label),
    hallucinated: extras.map((f) => f.label_as_printed),
    rates,
    unreadable,
    meta: {
      doc_type: out.doc_type === key.doc_type,
      facility: key.facility === null ? null : sameText(out.facility_as_printed, key.facility),
      date: key.document_date === null ? null : sameText(out.document_date_as_printed, key.document_date),
    },
    referral: want
      ? {
          reason: !!got?.reason_as_written && sameText(got.reason_as_written.text, want.reason),
          urgency: !!got?.urgency_as_written && sameText(got.urgency_as_written.text, want.urgency),
        }
      : null,
    glyph_variants,
    guard_notes: out.notes.length,
    critical,
  };
}

export function pct(r: FieldRate): string {
  return r.total === 0 ? "n/a" : `${Math.round((100 * r.hit) / r.total)}% (${r.hit}/${r.total})`;
}

/** Rescore a SAVED score under the D-020 rule. No model call. A critical error whose reason is "unit differs from key"
 *  and whose expected and actual units are equal under unitsEqual() (NFKC, trim, collapse whitespace) moves to
 *  glyph_variants. Nothing else changes: values, labels, ranges, other units and every other critical stay as they were,
 *  and the strict unit hit-rate is untouched (a variant still counts as a miss there). */
export function reclassifyGlyphVariants(score: DocScore): DocScore {
  const variants: GlyphVariant[] = [...(score.glyph_variants ?? [])];
  const critical = score.critical.filter((c) => {
    if (c.reason === "unit differs from key" && isGlyphVariantOnly(c.expected, c.actual)) {
      variants.push({ document: c.document, item: c.item, expected: c.expected, actual: c.actual });
      return false;
    }
    return true;
  });
  return { ...score, critical, glyph_variants: variants };
}

/** `failedToExtract` = documents that never produced output (provider errors). They are not scored, so a clean
 *  result with failures is INCOMPLETE, not PASS: an unscored document proves nothing.
 *  `strict` is the critical count if every unit glyph variant were also counted as critical (D-020). */
export function nfr15(scores: DocScore[], failedToExtract = 0): { pass: boolean; critical: number; variants: number; strict: number; line: string } {
  const critical = scores.reduce((n, s) => n + s.critical.length, 0);
  const variants = scores.reduce((n, s) => n + (s.glyph_variants?.length ?? 0), 0);
  const strict = critical + variants;
  const note = variants ? `; ${variants} glyph variant${variants === 1 ? "" : "s"}, reclassified, see D-020` : "";
  const base = { critical, variants, strict };
  if (scores.length === 0) return { ...base, pass: false, line: "NFR-15: NOT RUN (no documents were scored)" };
  if (critical > 0) return { ...base, pass: false, line: `NFR-15: FAIL (${critical} critical errors${note})` };
  if (failedToExtract > 0) {
    return { ...base, pass: false, line: `NFR-15: INCOMPLETE (0 critical errors in ${scores.length} scored${note}; ${failedToExtract} failed to extract, not scored)` };
  }
  return { ...base, pass: true, line: variants ? `NFR-15: PASS (0 critical${note})` : "NFR-15: PASS" };
}

const codePoints = (str: string) => [...str].filter((c) => c.codePointAt(0)! > 0x7f).map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(" ");

export function renderReport(args: {
  scores: DocScore[];
  failed: { id: string; code: string }[];
  model: string;
  promptVersion: string;
  date: string;
  runs: number;
  /** Extra lines under the header, e.g. "rescored under D-020". */
  notes?: string[];
}): string {
  const { scores, failed, model, promptVersion, date, runs } = args;
  const lat = scores.map((s) => s.latency_ms).sort((a, b) => a - b);
  const nearest = (p: number) => (lat.length ? lat[Math.ceil(p * lat.length) - 1] : "n/a");
  const docs = new Set([...scores.map((s) => s.id), ...failed.map((f) => f.id)]).size;
  const verdict = nfr15(scores, failed.length);
  const L: string[] = [
    "# Prep B extraction test report",
    "",
    `- Model: \`${model}\``,
    `- Prompt version: \`${promptVersion}\``,
    `- Date: ${date}`,
    `- Runs per document: ${runs}`,
    `- Calls in this report: ${scores.length + failed.length} (${scores.length} scored, ${failed.length} failed to extract and not scored) over ${docs} documents, ${runs} run(s) each`,
    `- Latency of the ${lat.length} scored calls (ms): median ${lat.length ? lat[Math.floor(lat.length / 2)] : "n/a"}, p90 ${nearest(0.9)}, p95 ${nearest(0.95)} (nearest rank; with n=${lat.length} this is ${lat.length < 20 ? "the maximum" : "below the maximum"}), max ${lat.length ? lat[lat.length - 1] : "n/a"}; over 25 s: ${lat.filter((x) => x > 25000).length}; over 30 s: ${lat.filter((x) => x > 30000).length}. Failed calls have no recorded time. NFR-10 is 30 s on throttled 3G; this is unthrottled server-side time, so 3G transfer is not included`,
    ...(args.notes ?? []).map((n) => `- ${n}`),
    `- **${verdict.line}**`,
    `- Critical errors: ${verdict.critical} as reported; ${verdict.strict} if unit glyph variants were counted as critical (the strict count)`,
    "",
    "Synthetic documents only. Accuracy here does not prove real-world accuracy.",
    "",
    "| Document | ms | Items found/expected | Label | Value | Unit | Range | Unreadable handled | Hallucinated | Critical |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...scores.map(
      (s) =>
        `| ${s.id} | ${s.latency_ms} | ${s.items_found}/${s.items_expected} | ${pct(s.rates.label)} | ${pct(s.rates.value)} | ${pct(s.rates.unit)} | ${pct(s.rates.range)} | ${s.unreadable.total ? `${s.unreadable.handled}/${s.unreadable.total}` : "n/a"} | ${s.hallucinated.length} | ${s.critical.length} |`,
    ),
    "",
  ];
  if (failed.length) {
    L.push("## Documents that failed to extract", "", ...failed.map((f) => `- ${f.id}: ${f.code}`), "");
  }
  const crits = scores.flatMap((s) => s.critical);
  L.push("## Critical errors", "");
  if (!crits.length) L.push("None.");
  else {
    L.push("| Document | Item | Reason | Expected | Actual |", "|---|---|---|---|---|");
    for (const c of crits) L.push(`| ${c.document} | ${c.item} | ${c.reason} | ${c.expected} | ${c.actual} |`);
  }
  const variants = scores.flatMap((s) => s.glyph_variants ?? []);
  if (variants.length) {
    L.push(
      "",
      "## Unit glyph variants (reported separately, not counted as critical; D-020)",
      "",
      "Same letter to a reader, different character: the micro sign U+00B5 versus the Greek mu U+03BC. The strict unit hit-rate above still counts each as a miss.",
      "",
      "| Document | Item | Printed (key) | Returned | Printed code point | Returned code point |",
      "|---|---|---|---|---|---|",
      ...variants.map((v) => `| ${v.document} | ${v.item} | ${v.expected} | ${v.actual} | ${codePoints(v.expected)} | ${codePoints(v.actual)} |`),
    );
  }
  const refs = scores.filter((s) => s.referral);
  if (refs.length) {
    L.push("", "## Referral letters (reason and urgency must be the letter's exact words)", "");
    for (const s of refs) L.push(`- ${s.id}: reason ${s.referral!.reason ? "exact" : "NOT returned exactly"}; urgency ${s.referral!.urgency ? "exact" : "NOT returned exactly"}`);
  }
  const missed = scores.filter((s) => s.missed.length);
  if (missed.length) {
    L.push("", "## Items the model missed (not critical)", "", ...missed.map((s) => `- ${s.id}: ${s.missed.join("; ")}`));
  }
  return L.join("\n") + "\n";
}
