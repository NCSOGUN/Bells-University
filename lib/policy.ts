// C04 POLICY: the ONLY place permissions are decided (NFR-01, NFR-06, NFR-22; design section 8).
// Pure function: no database, no clock, no I/O. Callers load what is needed and pass it in.
// Every cell of the matrix is written out below; anything not written is DENIED (default deny).
//
// Status convention: anonymous -> 401; a known actor who is denied -> 403; a holder (or viewer) reaching for a
// record that is not theirs -> 404, so it looks the same as a record that does not exist (NFR-06).

export type Actor =
  | { kind: "holder"; accountId: string; recordIds: string[] }
  | { kind: "clinician"; viewerSessionId: string; shareId: string; recordId: string; shareValid: boolean; purpose: "general" | "referral" }
  | { kind: "partner"; hospitalId: string; linkActive: boolean; linkHospitalMatches: boolean }
  | { kind: "anonymous" };

/** One action per row of the section 8 table, plus dispute_fact and tag_sensitive_category. */
export type Action =
  | "upload_document"
  | "see_whole_record"
  | "see_shared_summary"
  | "see_hidden_category_via_share"
  | "see_source_image"
  | "confirm_or_correct_fact"
  | "edit_provider_fact"
  | "create_or_revoke_share"
  | "read_access_log"
  | "set_urgency_or_reason"
  | "acknowledge_referral"
  | "link_or_unlink_hospital"
  | "write_feed"
  | "read_feed"
  | "dispute_fact"
  | "tag_sensitive_category";

export const ACTIONS: readonly Action[] = [
  "upload_document",
  "see_whole_record",
  "see_shared_summary",
  "see_hidden_category_via_share",
  "see_source_image",
  "confirm_or_correct_fact",
  "edit_provider_fact",
  "create_or_revoke_share",
  "read_access_log",
  "set_urgency_or_reason",
  "acknowledge_referral",
  "link_or_unlink_hospital",
  "write_feed",
  "read_feed",
  "dispute_fact",
  "tag_sensitive_category",
];

export interface Resource {
  recordId?: string;
  fact?: { origin: "ai_read" | "patient_added" | "provider_entered"; sensitiveCategory: string | null; documentId: string | null };
  share?: { hiddenCategories: string[]; hiddenDocumentIds: string[] };
}

export type Reason =
  | "ok"
  | "no_credential"
  | "not_a_holder"
  | "wrong_record"
  | "share_invalid"
  | "hidden_category"
  | "provider_entered_immutable"
  | "dispute_provider_only"
  | "carried_from_source_only"
  | "not_a_referral_share"
  | "read_not_supported"
  | "link_not_active"
  | "not_applicable";

export interface Decision {
  allowed: boolean;
  reason: Reason;
  status: 200 | 401 | 403 | 404;
}

const ALLOW: Decision = { allowed: true, reason: "ok", status: 200 };
const deny = (reason: Reason, status: 401 | 403 | 404 = 403): Decision => ({ allowed: false, reason, status });

type Cell = (r: Resource) => Decision;
const allow: Cell = () => ALLOW;
const denyCell = (reason: Reason, status: 403 | 404 = 403): Cell => () => deny(reason, status);

/** Is this fact hidden by the share the clinician holds? (FR-15) */
const hiddenByShare = (r: Resource) =>
  !!r.fact &&
  !!r.share &&
  ((r.fact.sensitiveCategory !== null && r.share.hiddenCategories.includes(r.fact.sensitiveCategory)) ||
    (r.fact.documentId !== null && r.share.hiddenDocumentIds.includes(r.fact.documentId)));

// ---------------------------------------------------------------- the matrix (design section 8)

const HOLDER: Record<Action, Cell> = {
  upload_document: allow,
  see_whole_record: allow,
  see_shared_summary: allow, // own record
  see_hidden_category_via_share: denyCell("not_applicable"), // "—": the holder sees everything directly
  see_source_image: allow,
  // Confirm or correct AI-read facts (and the patient's own added facts). Never a provider-entered one.
  confirm_or_correct_fact: (r) => (r.fact?.origin === "provider_entered" ? deny("provider_entered_immutable") : ALLOW),
  edit_provider_fact: denyCell("provider_entered_immutable"), // may dispute instead
  create_or_revoke_share: allow,
  read_access_log: allow,
  set_urgency_or_reason: denyCell("carried_from_source_only"),
  acknowledge_referral: denyCell("not_applicable"),
  link_or_unlink_hospital: allow,
  write_feed: denyCell("not_applicable"),
  read_feed: denyCell("read_not_supported"),
  dispute_fact: (r) => (r.fact?.origin === "provider_entered" ? ALLOW : deny("dispute_provider_only")),
  // The patient's privacy tag, not an edit of clinical content: any origin (docs/DEVIATIONS.md).
  tag_sensitive_category: allow,
};

const CLINICIAN: Record<Action, Cell> = {
  upload_document: denyCell("not_a_holder"),
  see_whole_record: denyCell("not_a_holder"),
  see_shared_summary: allow, // only while the code is valid: checked before this table
  see_hidden_category_via_share: denyCell("hidden_category"), // told items are hidden, never shown them
  see_source_image: (r) => (hiddenByShare(r) ? deny("hidden_category", 404) : ALLOW), // logged by the caller
  confirm_or_correct_fact: denyCell("not_a_holder"),
  edit_provider_fact: denyCell("provider_entered_immutable"),
  create_or_revoke_share: denyCell("not_a_holder"),
  read_access_log: denyCell("not_a_holder"),
  set_urgency_or_reason: denyCell("carried_from_source_only"),
  acknowledge_referral: allow, // only with a referral share: checked before this table
  link_or_unlink_hospital: denyCell("not_a_holder"),
  write_feed: denyCell("not_applicable"),
  read_feed: denyCell("read_not_supported"),
  dispute_fact: denyCell("not_a_holder"),
  tag_sensitive_category: denyCell("not_a_holder"),
};

const PARTNER: Record<Action, Cell> = {
  upload_document: denyCell("not_a_holder"),
  see_whole_record: denyCell("not_a_holder"),
  see_shared_summary: denyCell("not_a_holder"),
  see_hidden_category_via_share: denyCell("not_a_holder"),
  see_source_image: denyCell("not_a_holder"),
  confirm_or_correct_fact: denyCell("not_a_holder"),
  edit_provider_fact: denyCell("provider_entered_immutable"),
  create_or_revoke_share: denyCell("not_a_holder"),
  read_access_log: denyCell("not_a_holder"),
  set_urgency_or_reason: denyCell("carried_from_source_only"), // it sends them inside a ServiceRequest instead
  acknowledge_referral: denyCell("not_a_holder"),
  link_or_unlink_hospital: denyCell("not_a_holder"),
  write_feed: denyCell("link_not_active"), // allowed only for an active link to that hospital: checked before this table
  read_feed: denyCell("read_not_supported"), // no read route exists
  dispute_fact: denyCell("not_a_holder"),
  tag_sensitive_category: denyCell("not_a_holder"),
};

export function can(actor: Actor, action: Action, resource: Resource = {}): Decision {
  switch (actor.kind) {
    case "anonymous":
      return deny("no_credential", 401);

    case "holder": {
      // A record the caller does not hold looks like one that does not exist (NFR-06).
      if (resource.recordId !== undefined && !actor.recordIds.includes(resource.recordId)) return deny("wrong_record", 404);
      return (HOLDER[action] ?? denyCell("not_applicable"))(resource);
    }

    case "clinician": {
      if (!actor.shareValid) return deny("share_invalid"); // expired or revoked: nothing at all
      if (resource.recordId !== undefined && resource.recordId !== actor.recordId) return deny("wrong_record", 404);
      if (action === "acknowledge_referral" && actor.purpose !== "referral") return deny("not_a_referral_share");
      return (CLINICIAN[action] ?? denyCell("not_a_holder"))(resource);
    }

    case "partner": {
      if (action === "write_feed") {
        // Identical refusal for unknown, revoked and other-hospital links (NFR-22): one reason, one status.
        return actor.linkActive && actor.linkHospitalMatches ? ALLOW : deny("link_not_active");
      }
      return (PARTNER[action] ?? denyCell("not_a_holder"))(resource);
    }
  }
}
