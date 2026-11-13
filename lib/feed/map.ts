// C15: FHIR subset resources -> fact rows (Locked decisions L21, L27, L28). PURE.
// Feed facts are provider_entered and confirmed (the hospital vouched for them; NFR-24 makes them immutable).
// Numbers are derived by OUR parsers from the text, exactly as for extraction (L17). Reason and urgency of a
// referral are carried exactly as sent and are never derived from anything else (hard rule 7).
import { parseRange, parseValueNum } from "@/lib/extract/numbers";
import { lookupTestKey } from "@/lib/glossary";
import { identifierKey, type FhirObservation, type FhirServiceRequest } from "./fhir-subset";

export interface FeedContext {
  recordId: string;
  hospitalId: string;
  /** The hospital's name, snapshotted onto the fact (D-014). */
  facilityName: string;
  receiptId: string;
}

/** The columns of a feed-created fact. Structurally a subset of the `fact` insert type. */
export interface FeedFact {
  record_id: string;
  hospital_id: string;
  facility_name: string;
  feed_receipt_id: string;
  origin: "provider_entered";
  state: "confirmed";
  kind: "lab" | "referral";
  label_as_printed: string;
  test_key: string | null;
  value_as_printed: string | null;
  value_num: number | null;
  unit_as_printed: string | null;
  range_as_printed: string | null;
  range_low: number | null;
  range_high: number | null;
  fact_date: string | null;
  fact_date_as_printed: string | null;
  source_identifier: string | null;
  extra: Record<string, unknown>;
}

const base = (ctx: FeedContext) => ({
  record_id: ctx.recordId,
  hospital_id: ctx.hospitalId,
  facility_name: ctx.facilityName,
  feed_receipt_id: ctx.receiptId,
  origin: "provider_entered" as const,
  state: "confirmed" as const,
});

/** The date part of a FHIR dateTime, exactly as sent: no timezone shifting. */
export const datePart = (dt: string | undefined) => (dt && /^\d{4}-\d{2}-\d{2}/.test(dt) ? dt.slice(0, 10) : null);

/** A JSON number as text. Note L28: 12.0 arrives as 12, so exact printed text needs valueString. */
const numText = (n: number) => String(n);

export function observationToFact(o: FhirObservation, ctx: FeedContext): FeedFact {
  const value = o.valueString ?? (o.valueQuantity ? numText(o.valueQuantity.value) : null);
  const rr = o.referenceRange?.[0];

  // Unit: valueQuantity.unit; with valueString, the unit of the range bounds (FHIR has no unit on valueString).
  const unit = o.valueQuantity?.unit ?? rr?.low?.unit ?? rr?.high?.unit ?? null;

  // Range: the printed text when sent (bounds parsed from it by our parser); otherwise built from low and high.
  let rangeText: string | null = null;
  let low: number | null = null;
  let high: number | null = null;
  if (rr?.text) {
    rangeText = rr.text;
    ({ low, high } = parseRange(rr.text));
  } else if (rr && (rr.low || rr.high)) {
    low = rr.low?.value ?? null;
    high = rr.high?.value ?? null;
    rangeText = low !== null && high !== null ? `${numText(low)} - ${numText(high)}` : low !== null ? `> ${numText(low)}` : `< ${numText(high!)}`;
  }

  const id = o.identifier?.[0];
  return {
    ...base(ctx),
    kind: "lab",
    label_as_printed: o.code.text,
    test_key: lookupTestKey(o.code.text),
    value_as_printed: value,
    value_num: parseValueNum(value),
    unit_as_printed: unit,
    range_as_printed: rangeText,
    range_low: low,
    range_high: high,
    fact_date: datePart(o.effectiveDateTime),
    fact_date_as_printed: o.effectiveDateTime ?? null,
    source_identifier: id ? identifierKey(id) : null,
    extra: {},
  };
}

export function serviceRequestToFact(s: FhirServiceRequest, ctx: FeedContext): FeedFact {
  const reasons = (s.reasonCode ?? []).map((r) => r.text);
  const id = s.identifier?.[0];
  return {
    ...base(ctx),
    kind: "referral",
    label_as_printed: "Referral",
    test_key: null,
    value_as_printed: null,
    value_num: null,
    unit_as_printed: null,
    range_as_printed: null,
    range_low: null,
    range_high: null,
    fact_date: null,
    fact_date_as_printed: null,
    source_identifier: id ? identifierKey(id) : null,
    // L21: verbatim or null. Null means the packet says "Not stated by the referring clinician".
    extra: {
      reason_as_written: reasons.length ? reasons.join("; ") : null,
      urgency_as_written: s.priority ?? null,
      urgency_code: s.priority ?? null,
      requester: s.requester?.display ?? null,
    },
  };
}
