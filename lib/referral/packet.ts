// The referral packet (FR-14, US-10). PURE: built from data the caller already loaded.
// Seven fields, each "present" or "missing" (never silently omitted): results, urgency, medicines, allergies,
// reason for referral, referring clinician, date.
// THE RULE: reason and urgency come ONLY from the referral's source fact (kind "referral", state "confirmed") and are
// copied verbatim, with where they came from. If there is no such source they are MISSING. Nothing here generates,
// infers, ranks or rewrites them (hard rule 7, NFR-19).
import { findAdvisories, type AdvisoryRule } from "@/lib/advisory/rules";
import type { Advisory } from "@/lib/advisory/types";
import { attachPrevious, latestPerTestKey, type FactWithPrevious } from "@/lib/facts/compare";
import type { FactDTO } from "@/lib/facts/dto";
import { filterFactsForShare, isHiddenByShare, type ShareHides } from "@/lib/share/filter";
import { DISPUTED, MISSING, NONE_RECORDED, NOT_CONFIRMED, SOURCE_LETTER, SOURCE_PATIENT, sourcePartner } from "./wording";

export interface PacketField<T = string> {
  status: "present" | "missing";
  value?: T;
  /** Where a carried value came from, in the fixed wording. */
  source?: string;
  note?: string;
  /** FHIR priority word as the partner sent it, shown beside the source text; nothing of Itan's own. */
  urgency_code?: string | null;
}

export interface Packet {
  patient: { display_name: string; birth_year: number | null };
  destination: string | null;
  urgency: PacketField;
  reason_for_referral: PacketField;
  referring_clinician: PacketField;
  date: PacketField;
  results: PacketField<FactWithPrevious[]>;
  medicines: PacketField<FactDTO[]>;
  allergies: PacketField<FactDTO[]>;
  advisories: Advisory[];
  /** Documents behind the included facts, so the viewer can open the sources. */
  documents: string[];
}

export interface PacketInput {
  record: { display_name: string; birth_year: number | null };
  referral: { referring_clinician_as_written: string | null; referral_date_as_written: string | null };
  destinationName: string | null;
  /** The referral-kind fact the referral points to (null if none, removed, or not found). */
  sourceFact: FactDTO | null;
  facts: FactDTO[];
  /** Present when the packet is built for a clinician: hidden items are removed first. */
  share?: ShareHides;
  /** The drug-allergy rules. The advisory is computed from the facts THIS viewer can see, so a hidden allergy never leaks. */
  advisoryRules?: AdvisoryRule[];
}

const missing = (note: string = MISSING): PacketField => ({ status: "missing", note });
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Where did the source fact's text come from? */
function sourceLabel(f: FactDTO): string {
  return f.origin === "provider_entered" ? sourcePartner(f.facility_name) : f.origin === "ai_read" ? SOURCE_LETTER : SOURCE_PATIENT;
}

export function buildPacket(input: PacketInput): Packet {
  const { share } = input;
  const visibleFacts = share ? filterFactsForShare(input.facts, share).visible : input.facts.filter((f) => f.superseded_by === null);

  // The source fact is usable only if it is a referral fact, confirmed, and not hidden from this viewer.
  let src = input.sourceFact;
  if (src && (src.kind !== "referral" || (share && isHiddenByShare(src, share)))) src = null;
  const extra = (src?.extra ?? {}) as Record<string, unknown>;
  const unconfirmed = !!src && src.state === "unverified";
  const usable = !!src && src.state !== "unverified";

  const carried = (value: string | null): PacketField => {
    if (unconfirmed) return missing(NOT_CONFIRMED);
    if (!usable || !value) return missing();
    // The hospital's words stay as sent; if the patient has disputed them, the packet says so beside them.
    return { status: "present", value, source: sourceLabel(src!), ...(src!.state === "disputed" ? { note: DISPUTED } : {}) };
  };

  const reason = carried(str(extra.reason_as_written));
  const urgency = carried(str(extra.urgency_as_written));
  if (urgency.status === "present" && src!.origin === "provider_entered") urgency.urgency_code = str(extra.urgency_code);

  // Referring clinician and date: the source's own text, else what the referral row holds (copied from the source or typed by the patient).
  const clinicianText = usable ? str(extra.requester) : null;
  const clinician: PacketField = unconfirmed
    ? missing(NOT_CONFIRMED)
    : clinicianText
      ? { status: "present", value: clinicianText, source: sourceLabel(src!) }
      : str(input.referral.referring_clinician_as_written)
        ? { status: "present", value: input.referral.referring_clinician_as_written!, source: src ? sourceLabel(src) : SOURCE_PATIENT }
        : missing();
  const dateText = usable ? (str(extra.referral_date_as_written) ?? src!.fact_date_as_printed) : null;
  const date: PacketField = unconfirmed
    ? missing(NOT_CONFIRMED)
    : dateText
      ? { status: "present", value: dateText, source: sourceLabel(src!) }
      : str(input.referral.referral_date_as_written)
        ? { status: "present", value: input.referral.referral_date_as_written!, source: src ? sourceLabel(src) : SOURCE_PATIENT }
        : missing();

  // Results: the latest value per test, with the printed range and the previous value (FR-24).
  const withPrev = attachPrevious(visibleFacts);
  const labs = latestPerTestKey(visibleFacts.filter((f) => f.kind === "lab")).map((f) => withPrev.find((w) => w.id === f.id) ?? f);
  const meds = visibleFacts.filter((f) => f.kind === "medication");
  const allergies = visibleFacts.filter((f) => f.kind === "allergy");
  const list = <T extends FactDTO>(items: T[], emptyNote: string): PacketField<T[]> =>
    items.length ? { status: "present", value: items } : { status: "missing", note: emptyNote };

  const documents = [...new Set([...labs, ...meds, ...allergies].map((f) => f.document_id).filter((d): d is string => !!d))];

  return {
    patient: { display_name: input.record.display_name, birth_year: input.record.birth_year },
    destination: input.destinationName,
    urgency,
    reason_for_referral: reason,
    referring_clinician: clinician,
    date,
    results: list(labs, NONE_RECORDED),
    medicines: list(meds, NONE_RECORDED),
    allergies: list(allergies, NONE_RECORDED),
    advisories: findAdvisories(visibleFacts, input.advisoryRules ?? []),
    documents,
  };
}
