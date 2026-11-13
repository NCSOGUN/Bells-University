// One test per cell of the design section 8 permission matrix (14 rows x 4 actors = 56), plus the extra cases.
// If this file and docs/SYSTEM-DESIGN.md section 8 disagree, one of them is wrong: fix it before the freeze.
import { describe, expect, it } from "vitest";
import { can, ACTIONS, type Action, type Actor, type Resource } from "@/lib/policy";

const R = "record-1";
const OTHER = "record-2";

const holder: Actor = { kind: "holder", accountId: "acc-1", recordIds: [R] };
const clinician: Actor = { kind: "clinician", viewerSessionId: "vs-1", shareId: "sh-1", recordId: R, shareValid: true, purpose: "referral" };
const partner: Actor = { kind: "partner", hospitalId: "h-1", linkActive: true, linkHospitalMatches: true };
const anonymous: Actor = { kind: "anonymous" };
const ACTORS = { holder, clinician, partner, anonymous } as const;

const aiFact: Resource["fact"] = { origin: "ai_read", sensitiveCategory: null, documentId: "doc-1" };
const resource: Resource = { recordId: R, fact: aiFact, share: { hiddenCategories: [], hiddenDocumentIds: [] } };

// [action, holder, clinician, partner, no credential]  A = allowed, D = denied.   "—" cells are denied.
const MATRIX: [Action, "A" | "D", "A" | "D", "A" | "D", "A" | "D"][] = [
  ["upload_document", "A", "D", "D", "D"],
  ["see_whole_record", "A", "D", "D", "D"],
  ["see_shared_summary", "A", "A", "D", "D"],
  ["see_hidden_category_via_share", "D", "D", "D", "D"],
  ["see_source_image", "A", "A", "D", "D"],
  ["confirm_or_correct_fact", "A", "D", "D", "D"],
  ["edit_provider_fact", "D", "D", "D", "D"],
  ["create_or_revoke_share", "A", "D", "D", "D"],
  ["read_access_log", "A", "D", "D", "D"],
  ["set_urgency_or_reason", "D", "D", "D", "D"],
  ["acknowledge_referral", "D", "A", "D", "D"],
  ["link_or_unlink_hospital", "A", "D", "D", "D"],
  ["write_feed", "D", "D", "A", "D"],
  ["read_feed", "D", "D", "D", "D"],
];

const cases = MATRIX.flatMap(([action, ...cells]) =>
  (["holder", "clinician", "partner", "anonymous"] as const).map((who, i) => ({ action, who, expected: cells[i] === "A" })),
);

describe("policy matrix", () => {
  it("covers 14 rows x 4 actors = 56 cells", () => {
    expect(cases).toHaveLength(56);
  });

  it.each(cases)("$action as $who is allowed=$expected", ({ action, who, expected }) => {
    const d = can(ACTORS[who], action, resource);
    expect(d.allowed).toBe(expected);
    expect(d.status).toBe(expected ? 200 : who === "anonymous" ? 401 : 403);
  });

  it("every Action is listed in ACTIONS (no action added without a policy decision)", () => {
    expect(ACTIONS).toHaveLength(16);
  });
});

describe("policy: record scoping (NFR-06)", () => {
  it("a holder reaching for a record they do not hold gets 404, for every action", () => {
    for (const action of ACTIONS) {
      const d = can(holder, action, { recordId: OTHER });
      expect(d.allowed).toBe(false);
      expect(d.status).toBe(404);
    }
  });
  it("a clinician on a different record than the share is denied 404", () => {
    const d = can(clinician, "see_shared_summary", { recordId: OTHER });
    expect(d).toMatchObject({ allowed: false, status: 404 });
  });
  it("a clinician with an invalid (expired or revoked) share is denied everything", () => {
    const dead: Actor = { ...clinician, shareValid: false } as Actor;
    for (const action of ACTIONS) expect(can(dead, action, resource).allowed).toBe(false);
  });
  it("a clinician never gets a holder's actions, even on the same record", () => {
    for (const a of ["upload_document", "see_whole_record", "confirm_or_correct_fact", "create_or_revoke_share", "read_access_log", "link_or_unlink_hospital", "dispute_fact", "tag_sensitive_category"] as const) {
      expect(can(clinician, a, resource).allowed).toBe(false);
    }
  });
});

describe("policy: hidden items and share rules", () => {
  const hiddenFact: Resource = {
    recordId: R,
    fact: { origin: "ai_read", sensitiveCategory: "mental_health", documentId: null },
    share: { hiddenCategories: ["mental_health"], hiddenDocumentIds: [] },
  };
  it("a clinician cannot open the image of a fact hidden by category (404, same as not existing)", () => {
    expect(can(clinician, "see_source_image", hiddenFact)).toMatchObject({ allowed: false, status: 404, reason: "hidden_category" });
  });
  it("a clinician cannot open the image of a fact in a hidden document", () => {
    const r: Resource = { recordId: R, fact: { origin: "ai_read", sensitiveCategory: null, documentId: "doc-9" }, share: { hiddenCategories: [], hiddenDocumentIds: ["doc-9"] } };
    expect(can(clinician, "see_source_image", r).allowed).toBe(false);
  });
  it("the holder still sees a hidden-category fact's image", () => {
    expect(can(holder, "see_source_image", { ...hiddenFact, share: undefined }).allowed).toBe(true);
  });
  it("acknowledging a referral needs a referral share: a general share is denied", () => {
    const general: Actor = { ...clinician, purpose: "general" } as Actor;
    expect(can(general, "acknowledge_referral", resource)).toMatchObject({ allowed: false, reason: "not_a_referral_share" });
  });
});

describe("policy: provider-entered facts (NFR-24)", () => {
  const providerFact: Resource = { recordId: R, fact: { origin: "provider_entered", sensitiveCategory: null, documentId: null } };
  it("a holder may dispute a provider-entered fact", () => {
    expect(can(holder, "dispute_fact", providerFact).allowed).toBe(true);
  });
  it("a holder may not dispute an AI-read fact", () => {
    expect(can(holder, "dispute_fact", resource)).toMatchObject({ allowed: false, reason: "dispute_provider_only" });
  });
  it("a holder may not confirm or correct a provider-entered fact", () => {
    expect(can(holder, "confirm_or_correct_fact", providerFact)).toMatchObject({ allowed: false, reason: "provider_entered_immutable" });
  });
  it("nobody may edit a provider-entered fact", () => {
    for (const a of [holder, clinician, partner, anonymous]) expect(can(a, "edit_provider_fact", providerFact).allowed).toBe(false);
  });
  it("only a holder may tag a privacy category, on any origin", () => {
    expect(can(holder, "tag_sensitive_category", providerFact).allowed).toBe(true);
    expect(can(holder, "tag_sensitive_category", resource).allowed).toBe(true);
    for (const a of [clinician, partner, anonymous]) expect(can(a, "tag_sensitive_category", resource).allowed).toBe(false);
  });
  it("nobody may set urgency or reason (carried from a source only)", () => {
    for (const a of [holder, clinician, partner, anonymous]) expect(can(a, "set_urgency_or_reason", resource).allowed).toBe(false);
  });
});

describe("policy: partner feed (NFR-22)", () => {
  it("a partner with an inactive link is denied with link_not_active", () => {
    const p: Actor = { ...partner, linkActive: false } as Actor;
    expect(can(p, "write_feed", {})).toMatchObject({ allowed: false, reason: "link_not_active", status: 403 });
  });
  it("a partner whose link belongs to another hospital is denied with the SAME decision", () => {
    const inactive = can({ ...partner, linkActive: false } as Actor, "write_feed", {});
    const other = can({ ...partner, linkHospitalMatches: false } as Actor, "write_feed", {});
    expect(other).toEqual(inactive);
  });
  it("a partner can never read anything", () => {
    for (const a of ["read_feed", "see_whole_record", "see_shared_summary", "see_source_image"] as const) {
      expect(can(partner, a, resource).allowed).toBe(false);
    }
  });
});
