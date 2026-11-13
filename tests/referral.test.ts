// FR-14, FR-19, NFR-19 and hard rule 7: reason and urgency are carried verbatim from a source or MISSING.
import { describe, expect, it } from "vitest";
import { findAdviceLanguage } from "@/lib/explain/lint";
import type { FactDTO } from "@/lib/facts/dto";
import { can, type Actor } from "@/lib/policy";
import { buildPacket, type Packet, type PacketInput } from "@/lib/referral/packet";
import { acknowledge, FORBIDDEN_FIELDS, parseReferralBody } from "@/lib/referral/service";
import * as W from "@/lib/referral/wording";
import type { ViewerContext } from "@/lib/share/session";

let n = 0;
const fact = (over: Partial<FactDTO> = {}): FactDTO => {
  n++;
  return {
    id: `f${n}`, record_id: "r1", document_id: "d1", origin: "ai_read", state: "confirmed", kind: "lab",
    label_as_printed: "Haemoglobin", value_as_printed: "9.8", unit_as_printed: "g/dL", range_as_printed: "12.0 - 16.0", flag_as_printed: null,
    value_num: 9.8, range_low: 12, range_high: 16, unreadable: false, check_carefully: false, confidence: "high", source_quote: "q",
    source_box: null, source_page: 1, fact_date: "2026-11-03", fact_date_as_printed: "03/11/2026", test_key: "haemoglobin",
    sensitive_category: null, facility_name: null, extra: {}, superseded_by: null, has_image: true,
    created_at: `2026-11-13T00:00:${String(n % 60).padStart(2, "0")}.000Z`, ...over,
  };
};

/** A ServiceRequest that arrived from a partner hospital (provider_entered, confirmed). */
const partnerReferral = (over: Partial<FactDTO> = {}) =>
  fact({
    kind: "referral", origin: "provider_entered", state: "confirmed", document_id: null, label_as_printed: "Referral", test_key: null,
    facility_name: "Demo General Hospital (SIMULATED)", fact_date: "2026-11-10", fact_date_as_printed: "10/11/2026",
    extra: { reason_as_written: "Persistent anaemia, needs specialist review", urgency_as_written: "urgent", urgency_code: "urgent", requester: "Dr Demo Physician (SIMULATED)" },
    ...over,
  });
/** A referral read from a photographed letter (ai_read). */
const letterReferral = (state: "unverified" | "confirmed", over: Partial<FactDTO> = {}) =>
  fact({
    kind: "referral", origin: "ai_read", state, label_as_printed: "Referral letter", test_key: null,
    extra: { reason_as_written: "Query diabetic nephropathy", urgency_as_written: "please see within 2 weeks", requester: "Dr Letter Writer", referral_date_as_written: "05/11/2026" },
    ...over,
  });

const base = (over: Partial<PacketInput> = {}): PacketInput => ({
  record: { display_name: "Demo Patient (SYNTHETIC)", birth_year: 1972 },
  referral: { referring_clinician_as_written: null, referral_date_as_written: null },
  destinationName: "Sample Teaching Hospital (SIMULATED)",
  sourceFact: null,
  facts: [fact()],
  ...over,
});

const SEVEN = ["results", "urgency", "medicines", "allergies", "reason_for_referral", "referring_clinician", "date"] as const;

describe("referral packet: reason and urgency (hard rule 7)", () => {
  it("a confirmed partner ServiceRequest is carried verbatim, with its source and FHIR code", () => {
    const p = buildPacket(base({ sourceFact: partnerReferral() }));
    expect(p.reason_for_referral).toEqual({ status: "present", value: "Persistent anaemia, needs specialist review", source: "Sent by Demo General Hospital (SIMULATED)" });
    expect(p.urgency).toEqual({ status: "present", value: "urgent", source: "Sent by Demo General Hospital (SIMULATED)", urgency_code: "urgent" });
    expect(p.referring_clinician).toMatchObject({ status: "present", value: "Dr Demo Physician (SIMULATED)" });
  });
  it("a confirmed letter is carried verbatim with the letter source and NO urgency code", () => {
    const p = buildPacket(base({ sourceFact: letterReferral("confirmed") }));
    expect(p.urgency).toEqual({ status: "present", value: "please see within 2 weeks", source: W.SOURCE_LETTER });
    expect(p.urgency).not.toHaveProperty("urgency_code");
    expect(p.date).toMatchObject({ status: "present", value: "05/11/2026" });
  });
  it("an unconfirmed letter is MISSING with the not-confirmed note, for reason, urgency, clinician and date", () => {
    const p = buildPacket(base({ sourceFact: letterReferral("unverified") }));
    for (const f of [p.reason_for_referral, p.urgency, p.referring_clinician, p.date]) expect(f).toEqual({ status: "missing", note: W.NOT_CONFIRMED });
  });
  it("no source at all: MISSING for reason and urgency, and the packet still has all seven fields", () => {
    const p = buildPacket(base());
    expect(p.reason_for_referral).toEqual({ status: "missing", note: W.MISSING });
    expect(p.urgency).toEqual({ status: "missing", note: W.MISSING });
    for (const k of SEVEN) expect(["present", "missing"]).toContain(p[k].status);
  });
  it("a source that states no urgency leaves urgency missing: never inferred", () => {
    const p = buildPacket(base({ sourceFact: letterReferral("confirmed", { extra: { reason_as_written: "Review", urgency_as_written: null, requester: null } }) }));
    expect(p.urgency).toEqual({ status: "missing", note: W.MISSING });
    expect(p.reason_for_referral.status).toBe("present");
  });
  it("a fact that is not a referral can never be a source", () => {
    const p = buildPacket(base({ sourceFact: fact({ kind: "lab", extra: { reason_as_written: "sneaky", urgency_as_written: "stat" } }) }));
    expect(p.reason_for_referral.status).toBe("missing");
    expect(p.urgency.status).toBe("missing");
  });
  it("a disputed hospital referral is still carried as sent, with the disputed note beside it", () => {
    const p = buildPacket(base({ sourceFact: partnerReferral({ state: "disputed" }) }));
    expect(p.reason_for_referral).toMatchObject({ status: "present", value: "Persistent anaemia, needs specialist review", note: W.DISPUTED });
  });
  it("clinician and date typed by the patient are labelled as entered by the patient", () => {
    const p = buildPacket(base({ referral: { referring_clinician_as_written: "Dr Typed", referral_date_as_written: "01/11/2026" } }));
    expect(p.referring_clinician).toEqual({ status: "present", value: "Dr Typed", source: W.SOURCE_PATIENT });
    expect(p.date).toEqual({ status: "present", value: "01/11/2026", source: W.SOURCE_PATIENT });
  });
  it("the packet never invents text for reason or urgency: every present value appears in the source's own words", () => {
    const src = partnerReferral();
    const p = buildPacket(base({ sourceFact: src }));
    expect(Object.values(src.extra)).toContain(p.reason_for_referral.value);
    expect(Object.values(src.extra)).toContain(p.urgency.value);
  });
});

describe("referral packet: clinical sections", () => {
  it("results carry the printed range and the previous value; empty sections are 'missing', not omitted", () => {
    const old = fact({ test_key: "hba1c", label_as_printed: "HbA1c", value_as_printed: "8.1", value_num: 8.1, unit_as_printed: "%", fact_date: "2026-05-14" });
    const latest = fact({ test_key: "hba1c", label_as_printed: "HbA1c", value_as_printed: "7.4", value_num: 7.4, unit_as_printed: "%" });
    const p = buildPacket(base({ facts: [old, latest] }));
    expect(p.results.value?.[0].previous?.value_as_printed).toBe("8.1");
    expect(p.results.value?.[0].range_as_printed).toBe("12.0 - 16.0");
    expect(p.medicines).toEqual({ status: "missing", note: W.NONE_RECORDED });
    expect(p.allergies).toEqual({ status: "missing", note: W.NONE_RECORDED });
  });
  it("medicines and allergies that are unverified or need care are flagged, not hidden", () => {
    const med = fact({ kind: "medication", state: "unverified", check_carefully: true, label_as_printed: "Amoxicillin 500 mg", test_key: null });
    const al = fact({ kind: "allergy", label_as_printed: "Penicillin", test_key: null });
    const p = buildPacket(base({ facts: [med, al] }));
    expect(p.medicines.value?.[0]).toMatchObject({ state: "unverified", check_carefully: true });
    expect(p.allergies.value?.[0].label_as_printed).toBe("Penicillin");
  });
  it("lists the documents behind the included facts", () => {
    const p = buildPacket(base({ facts: [fact({ document_id: "docA" }), fact({ document_id: "docA", test_key: "wbc", label_as_printed: "WBC" }), fact({ document_id: null, test_key: "ast", label_as_printed: "AST" })] }));
    expect(p.documents).toEqual(["docA"]);
  });
  it("leaves a hook for the allergy advisory", () => {
    expect(buildPacket(base()).advisories).toEqual([]);
  });
});

describe("referral packet: hidden items (FR-15)", () => {
  const hides = { hiddenCategories: ["mental_health"], hiddenDocumentIds: ["docH"] };
  it("hidden labs, medicines and documents never reach the packet", () => {
    const hiddenCat = fact({ kind: "medication", label_as_printed: "SECRET-MED", sensitive_category: "mental_health", test_key: null });
    const hiddenDoc = fact({ label_as_printed: "SECRET-LAB", document_id: "docH", test_key: "wbc" });
    const ok = fact();
    const p = buildPacket(base({ facts: [hiddenCat, hiddenDoc, ok], share: hides }));
    expect(JSON.stringify(p)).not.toContain("SECRET");
    expect(p.results.value).toHaveLength(1);
  });
  it("a referral source in a hidden document or category is treated as missing", () => {
    const p = buildPacket(base({ sourceFact: partnerReferral({ sensitive_category: "mental_health" }), share: hides }));
    expect(p.reason_for_referral.status).toBe("missing");
    const p2 = buildPacket(base({ sourceFact: letterReferral("confirmed", { document_id: "docH" }), share: hides }));
    expect(p2.urgency.status).toBe("missing");
  });
  it("superseded facts are excluded with or without a share", () => {
    const sup = fact({ superseded_by: "x", label_as_printed: "OLD", test_key: "wbc" });
    expect(JSON.stringify(buildPacket(base({ facts: [sup] })))).not.toContain("OLD");
  });
});

describe("the patient cannot set reason or urgency", () => {
  const rid = "6f1f4f4e-6f4f-4f4f-8f4f-6f4f4f4f4f4f";
  it.each(FORBIDDEN_FIELDS)("a body containing %s is rejected with field_not_allowed", (field) => {
    const r = parseReferralBody({ record_id: rid, [field]: "anything" });
    expect(r).toMatchObject({ ok: false, code: "field_not_allowed" });
  });
  it("other unknown fields are invalid_request (strict)", () => {
    expect(parseReferralBody({ record_id: rid, origin: "provider_entered" })).toMatchObject({ ok: false, code: "invalid_request" });
  });
  it("a clean body is accepted", () => {
    expect(parseReferralBody({ record_id: rid, referring_clinician_as_written: "Dr A" }).ok).toBe(true);
  });
  it("can(set_urgency_or_reason) is denied for every actor", () => {
    const actors: Actor[] = [
      { kind: "holder", accountId: "a", recordIds: ["r1"] },
      { kind: "clinician", viewerSessionId: "v", shareId: "s", recordId: "r1", shareValid: true, purpose: "referral" },
      { kind: "partner", hospitalId: "h", linkActive: true, linkHospitalMatches: true },
      { kind: "anonymous" },
    ];
    for (const a of actors) expect(can(a, "set_urgency_or_reason", { recordId: "r1" }).allowed).toBe(false);
  });
});

describe("acknowledgement (FR-19)", () => {
  const ctx = (purpose: "general" | "referral"): ViewerContext => ({
    actor: { kind: "clinician", viewerSessionId: "vs", shareId: "s1", recordId: "r1", shareValid: true, purpose },
    viewer: { name: "Dr A", practiceNo: "MDCN 1", sessionId: "vs" },
    share: { id: "s1", expiresAt: new Date(), hiddenCategories: [], hiddenDocumentIds: [], referralId: purpose === "referral" ? "ref1" : null },
    recordId: "r1",
    purpose,
  });
  it("a general share cannot acknowledge (403), and no database is touched", async () => {
    const r = await acknowledge(ctx("general"), "service_offered");
    expect(r).toMatchObject({ ok: false, status: 403 });
  });
  it("labels never mention beds, capacity or availability; the disclaimer is fixed", () => {
    for (const s of [W.ackLabel("service_offered"), W.ackLabel("service_not_offered")]) expect(s).not.toMatch(/\bbed|capacity|available|admit/i);
    expect(W.ACK_DISCLAIMER).toBe("This is not a statement that a bed is available.");
    expect(W.ackLabel("service_offered")).toBe("Received — service offered here");
    expect(W.ackLabel("service_not_offered")).toBe("Received — service not offered here");
  });
});

describe("no advice language in anything the packet or wording can produce (NFR-19)", () => {
  it("wording constants are clean", () => {
    const all = [W.MISSING, W.NOT_CONFIRMED, W.NONE_RECORDED, W.DISPUTED, W.SOURCE_LETTER, W.SOURCE_PATIENT, W.sourcePartner("Demo General Hospital (SIMULATED)"), W.ACK_OFFERED, W.ACK_NOT_OFFERED];
    for (const s of all) expect(findAdviceLanguage(s), s).toEqual([]);
  });
  it("every generated string in a full packet is clean, except text copied from the source", () => {
    const src = partnerReferral();
    const p: Packet = buildPacket(base({ sourceFact: src, facts: [fact(), fact({ kind: "medication", test_key: null }), fact({ kind: "allergy", test_key: null })] }));
    const generated = [p.urgency.source, p.urgency.note, p.reason_for_referral.source, p.referring_clinician.source, p.date.source, p.medicines.note, p.allergies.note, p.results.note].filter(Boolean) as string[];
    for (const s of generated) expect(findAdviceLanguage(s), s).toEqual([]);
  });
});
