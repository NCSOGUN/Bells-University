// C02 data layer (FR-01 to FR-14, NFR-16, NFR-24). The ERD in docs/SYSTEM-DESIGN.md section 6 is
// authoritative; columns it does not draw come from Locked decision L5 (logged "ERD gap" in DEVIATIONS.md).
// Conventions (L4): singular snake_case tables, uuid PKs with gen_random_uuid(), timestamptz default now(),
// enums as text + CHECK. Every value is kept AS PRINTED; numeric columns are derived by our parsers only.
// Row level security is enabled deny-all in a separate migration (a backstop: permissions live in lib/policy.ts).
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { SENSITIVE_CATEGORIES } from "../categories";

const id = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
/** CHECK (col IN ('a','b',...)). Values must be inlined: DDL cannot take bind parameters.
 *  They are fixed constants from this file, never user input; the regex refuses anything else. */
const oneOf = (col: AnyPgColumn, values: readonly string[]) => {
  if (!values.every((v) => /^[a-z0-9_/+.-]+$/.test(v))) throw new Error("oneOf: unsafe CHECK value");
  return sql`${col} in (${sql.raw(values.map((v) => `'${v}'`).join(", "))})`;
};

// ---------------------------------------------------------------- people and records

export const account = pgTable("account", {
  /** Same id as the Supabase auth user (L3). No FK to auth.users (cross-schema FKs complicate migrations). */
  id: uuid("id").primaryKey(),
  ai_consent_at: ts("ai_consent_at"),
  created_at: createdAt(),
});

export const patient_record = pgTable("patient_record", {
  id: id(),
  display_name: text("display_name").notNull(),
  birth_year: integer("birth_year"),
  /** false = held by a caregiver on behalf of someone else (FR-18). */
  is_self: boolean("is_self").notNull().default(true),
  created_at: createdAt(),
});

export const record_member = pgTable(
  "record_member",
  {
    account_id: uuid("account_id").notNull().references(() => account.id),
    record_id: uuid("record_id").notNull().references(() => patient_record.id),
    role: text("role").notNull().default("holder"),
    created_at: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.account_id, t.record_id] }), check("record_member_role_chk", oneOf(t.role, ["holder"]))],
);

// ---------------------------------------------------------------- documents and facts

export const DOCUMENT_STATUSES = ["uploaded", "extracting", "extracted", "failed"] as const;

export const document = pgTable(
  "document",
  {
    id: id(),
    record_id: uuid("record_id").notNull().references(() => patient_record.id),
    client_upload_id: uuid("client_upload_id").notNull(),
    storage_path: text("storage_path").notNull(),
    mime: text("mime").notNull(),
    byte_size: integer("byte_size").notNull(),
    status: text("status").notNull().default("uploaded"),
    error_code: text("error_code"),
    doc_type: text("doc_type"),
    model_version: text("model_version"),
    prompt_version: text("prompt_version"),
    /** Raw model output. Never returned to a client. */
    raw_extraction: jsonb("raw_extraction"),
    facility_as_printed: text("facility_as_printed"),
    document_date_as_printed: text("document_date_as_printed"),
    uploaded_at: ts("uploaded_at").notNull().defaultNow(),
    /** Set when an extraction claims the row (Locked decision L22). */
    started_at: ts("started_at"),
    extracted_at: ts("extracted_at"),
  },
  (t) => [
    unique("document_client_upload_id_uq").on(t.client_upload_id),
    check("document_status_chk", oneOf(t.status, DOCUMENT_STATUSES)),
    check("document_mime_chk", oneOf(t.mime, ["image/jpeg", "image/png", "application/pdf"])),
    index("document_record_idx").on(t.record_id),
  ],
);

export const FACT_ORIGINS = ["ai_read", "patient_added", "provider_entered"] as const;
export const FACT_STATES = ["unverified", "confirmed", "disputed"] as const;
export const FACT_KINDS = ["lab", "medication", "allergy", "diagnosis", "referral", "other"] as const;

export const fact = pgTable(
  "fact",
  {
    id: id(),
    record_id: uuid("record_id").notNull().references(() => patient_record.id),
    // Provenance (NFR-16): exactly one of these explains where the fact came from.
    document_id: uuid("document_id").references(() => document.id),
    feed_receipt_id: uuid("feed_receipt_id").references(() => feed_receipt.id),
    created_by_account_id: uuid("created_by_account_id").references(() => account.id),
    hospital_id: uuid("hospital_id").references(() => hospital.id),
    facility_name: text("facility_name"),

    origin: text("origin").notNull(),
    state: text("state").notNull(),
    kind: text("kind").notNull(),

    label_as_printed: text("label_as_printed").notNull(),
    test_key: text("test_key"),
    value_as_printed: text("value_as_printed"),
    value_num: numeric("value_num", { mode: "number" }),
    unit_as_printed: text("unit_as_printed"),
    range_as_printed: text("range_as_printed"),
    range_low: numeric("range_low", { mode: "number" }),
    range_high: numeric("range_high", { mode: "number" }),
    flag_as_printed: text("flag_as_printed"),
    fact_date: date("fact_date", { mode: "string" }),
    fact_date_as_printed: text("fact_date_as_printed"),

    unreadable: boolean("unreadable").notNull().default(false),
    check_carefully: boolean("check_carefully").notNull().default(false),
    confidence: text("confidence"),
    source_quote: text("source_quote"),
    source_box: jsonb("source_box"),
    source_page: integer("source_page"),

    sensitive_category: text("sensitive_category"),
    /** "<system>|<value>" of a partner Observation identifier (L27). */
    source_identifier: text("source_identifier"),
    superseded_by: uuid("superseded_by").references((): AnyPgColumn => fact.id),
    removed_at: ts("removed_at"),
    /** Kind-specific data, e.g. referral reason/urgency as written (L21), guard notes (L19). */
    extra: jsonb("extra").notNull().default(sql`'{}'::jsonb`),
    created_at: createdAt(),
  },
  (t) => [
    check("fact_origin_chk", oneOf(t.origin, FACT_ORIGINS)),
    check("fact_state_chk", oneOf(t.state, FACT_STATES)),
    check("fact_kind_chk", oneOf(t.kind, FACT_KINDS)),
    check("fact_confidence_chk", sql`${t.confidence} is null or ${oneOf(t.confidence, ["high", "medium", "low"])}`),
    check("fact_sensitive_category_chk", sql`${t.sensitive_category} is null or ${oneOf(t.sensitive_category, SENSITIVE_CATEGORIES)}`),
    index("fact_record_test_date_idx").on(t.record_id, t.test_key, t.fact_date),
    index("fact_document_idx").on(t.document_id),
  ],
);

/** Append-only history of every change to a fact (NFR-24). The AI's original reading is never lost. */
export const fact_event = pgTable(
  "fact_event",
  {
    id: id(),
    fact_id: uuid("fact_id").notNull().references(() => fact.id),
    at: ts("at").notNull().defaultNow(),
    actor_type: text("actor_type").notNull(),
    actor_account_id: uuid("actor_account_id").references(() => account.id),
    event: text("event").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    /** The patient's dispute note (FR-27). */
    note: text("note"),
  },
  (t) => [
    check("fact_event_actor_chk", oneOf(t.actor_type, ["system", "patient", "partner"])),
    index("fact_event_fact_idx").on(t.fact_id),
  ],
);

// ---------------------------------------------------------------- shares and viewing

export const share = pgTable(
  "share",
  {
    id: id(),
    record_id: uuid("record_id").notNull().references(() => patient_record.id),
    /** HMAC-SHA256(SHARE_PEPPER, code). The code itself is never stored (hard rule 5). */
    code_hash: text("code_hash").notNull(),
    purpose: text("purpose").notNull().default("general"),
    hidden_categories: text("hidden_categories").array().notNull().default(sql`'{}'::text[]`),
    hidden_document_ids: uuid("hidden_document_ids").array().notNull().default(sql`'{}'::uuid[]`),
    referral_id: uuid("referral_id").references(() => referral.id),
    expires_at: ts("expires_at").notNull(),
    revoked_at: ts("revoked_at"),
    created_at: createdAt(),
  },
  (t) => [
    unique("share_code_hash_uq").on(t.code_hash),
    check("share_purpose_chk", oneOf(t.purpose, ["general", "referral"])),
    index("share_record_idx").on(t.record_id),
  ],
);

export const viewer_session = pgTable(
  "viewer_session",
  {
    /** SHA-256 hex of the cookie token (L8). */
    token_hash: text("token_hash").primaryKey(),
    share_id: uuid("share_id").notNull().references(() => share.id),
    viewer_name: text("viewer_name").notNull(),
    /** Entered by the viewer; NOT verified against any register. */
    practice_no: text("practice_no").notNull(),
    expires_at: ts("expires_at").notNull(),
    created_at: createdAt(),
  },
  (t) => [index("viewer_session_share_idx").on(t.share_id)],
);

/** Append-only (FR-13). There is no update or delete path for this table anywhere in the codebase. */
export const access_log = pgTable(
  "access_log",
  {
    id: id(),
    record_id: uuid("record_id").notNull().references(() => patient_record.id),
    at: ts("at").notNull().defaultNow(),
    actor_type: text("actor_type").notNull(),
    /** Viewer name and practice number, hospital name, or "patient". */
    actor_label: text("actor_label").notNull(),
    action: text("action").notNull(),
    outcome: text("outcome").notNull(),
    reason: text("reason"),
    share_id: uuid("share_id").references(() => share.id),
    link_id: uuid("link_id").references(() => hospital_link.id),
    fact_id: uuid("fact_id").references(() => fact.id),
  },
  (t) => [
    check("access_log_outcome_chk", oneOf(t.outcome, ["allowed", "refused"])),
    check("access_log_actor_chk", oneOf(t.actor_type, ["patient", "clinician", "partner", "system"])),
    index("access_log_record_at_idx").on(t.record_id, t.at.desc()),
  ],
);

/** Failed and successful share-code attempts per hashed IP, for the rate limit (L10). */
export const code_attempt = pgTable(
  "code_attempt",
  {
    id: id(),
    ip_hash: text("ip_hash").notNull(),
    at: ts("at").notNull().defaultNow(),
    success: boolean("success").notNull(),
  },
  (t) => [index("code_attempt_ip_at_idx").on(t.ip_hash, t.at)],
);

// ---------------------------------------------------------------- referrals

export const facility = pgTable(
  "facility",
  {
    id: id(),
    name: text("name").notNull(),
    city: text("city").notNull(),
    is_simulated: boolean("is_simulated").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [unique("facility_name_uq").on(t.name)],
);

export const referral = pgTable(
  "referral",
  {
    id: id(),
    record_id: uuid("record_id").notNull().references(() => patient_record.id),
    created_by_account_id: uuid("created_by_account_id").references(() => account.id),
    destination_facility_id: uuid("destination_facility_id").references(() => facility.id),
    /** The only place reason and urgency may come from (hard rule 7, L21). */
    source_fact_id: uuid("source_fact_id").references(() => fact.id),
    reason_as_written: text("reason_as_written"),
    urgency_as_written: text("urgency_as_written"),
    /** FHIR priority code, partner only. */
    urgency_code: text("urgency_code"),
    referring_clinician_as_written: text("referring_clinician_as_written"),
    referral_date_as_written: text("referral_date_as_written"),
    created_at: createdAt(),
  },
  (t) => [
    check("referral_urgency_code_chk", sql`${t.urgency_code} is null or ${oneOf(t.urgency_code, ["routine", "urgent", "asap", "stat"])}`),
    index("referral_record_idx").on(t.record_id),
  ],
);

export const referral_ack = pgTable(
  "referral_ack",
  {
    id: id(),
    referral_id: uuid("referral_id").notNull().references(() => referral.id),
    viewer_session_id: text("viewer_session_id").notNull().references(() => viewer_session.token_hash),
    /** "Received, service offered here" never means a bed is available (hard rule 7). */
    status: text("status").notNull(),
    at: ts("at").notNull().defaultNow(),
  },
  (t) => [check("referral_ack_status_chk", oneOf(t.status, ["service_offered", "service_not_offered"]))],
);

// ---------------------------------------------------------------- partner hospitals and the feed

export const hospital = pgTable(
  "hospital",
  {
    id: id(),
    name: text("name").notNull(),
    simulated: boolean("simulated").notNull().default(true),
    created_at: createdAt(),
  },
  (t) => [unique("hospital_name_uq").on(t.name)],
);

export const hospital_credential = pgTable(
  "hospital_credential",
  {
    id: id(),
    hospital_id: uuid("hospital_id").notNull().references(() => hospital.id),
    /** SHA-256 hex of the bearer key (L8). The key itself is never stored. */
    key_hash: text("key_hash").notNull(),
    created_at: createdAt(),
    revoked_at: ts("revoked_at"),
  },
  (t) => [unique("hospital_credential_key_hash_uq").on(t.key_hash)],
);

export const hospital_link = pgTable(
  "hospital_link",
  {
    id: id(),
    record_id: uuid("record_id").notNull().references(() => patient_record.id),
    hospital_id: uuid("hospital_id").notNull().references(() => hospital.id),
    link_ref: text("link_ref").notNull(),
    /** Recorded from the first accepted delivery (L25). */
    hospital_patient_ref: text("hospital_patient_ref"),
    linked_by_account_id: uuid("linked_by_account_id").references(() => account.id),
    created_at: createdAt(),
    revoked_at: ts("revoked_at"),
  },
  (t) => [unique("hospital_link_link_ref_uq").on(t.link_ref), index("hospital_link_record_idx").on(t.record_id)],
);

export const feed_receipt = pgTable(
  "feed_receipt",
  {
    id: id(),
    /** Null when the request could not be attributed (no valid key). */
    hospital_id: uuid("hospital_id").references(() => hospital.id),
    link_id: uuid("link_id").references(() => hospital_link.id),
    /** Null on refusals, so a later correct retry is not blocked. */
    idempotency_key: text("idempotency_key"),
    status: text("status").notNull(),
    refusal_reason: text("refusal_reason"),
    facts_created: integer("facts_created").notNull().default(0),
    bundle_bytes: integer("bundle_bytes"),
    received_at: ts("received_at").notNull().defaultNow(),
  },
  (t) => [
    // NULLs are distinct in Postgres, so refused rows without a key never collide.
    unique("feed_receipt_hospital_idem_uq").on(t.hospital_id, t.idempotency_key),
    check("feed_receipt_status_chk", oneOf(t.status, ["accepted", "refused"])),
  ],
);

// ---------------------------------------------------------------- reference data (seeded)

/** Plain-language descriptions and questions (FR-09). NO reference ranges, ever (NFR-17). */
export const glossary = pgTable("glossary", {
  test_key: text("test_key").primaryKey(),
  display_name: text("display_name").notNull(),
  aliases: text("aliases").array().notNull(),
  description: text("description").notNull(),
  questions: text("questions").array().notNull(),
  reviewed_by: text("reviewed_by"),
});

/** Hand-built, NOT clinically validated (FR-17, NFR-21). */
export const drug_allergy_rule = pgTable(
  "drug_allergy_rule",
  {
    id: id(),
    rule_key: text("rule_key").notNull(),
    allergy_aliases: text("allergy_aliases").array().notNull(),
    medicine_aliases: text("medicine_aliases").array().notNull(),
    note: text("note").notNull(),
    reviewed_by: text("reviewed_by"),
  },
  (t) => [unique("drug_allergy_rule_key_uq").on(t.rule_key)],
);

export type FactRow = typeof fact.$inferSelect;
export type NewFact = typeof fact.$inferInsert;
export type DocumentRow = typeof document.$inferSelect;
export type ShareRow = typeof share.$inferSelect;
