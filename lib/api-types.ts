// The API contract as TypeScript types, for Dev A's pages and components (R1 S-15). docs/api.md is the prose.
//
// TYPE-ONLY FILE. It contains `import type` and type declarations and nothing else, so importing it from a
// client component pulls no server code (database, Gemini, Supabase service client) into the browser bundle.
// tests/static.test.ts fails if a runtime import or a runtime statement is added here.
//
// Use: `import type { FactDTO, TimelineResponse, ApiError } from "@/lib/api-types";`
// Request bodies are the Zod input types of the schemas the routes validate with, so they cannot drift.
// Responses are the builders' return types with Date turned into string (JSON carries ISO 8601 UTC text).
import type { z } from "zod";
import type { Advisory } from "./advisory/types";
import type { getAdvisories } from "./advisory/service";
import type { SensitiveCategory } from "./categories";
import type { documentView } from "./documents/queries";
import type { Explanation } from "./explain/engine";
import type { FactWithPrevious, PreviousValue } from "./facts/compare";
import type { correctionSchema } from "./facts/correct";
import type { FactDTO } from "./facts/dto";
import type { listRecordDocuments } from "./facts/queries";
import type { addFactSchema } from "./facts/service";
import type { createLink, createLinkSchema, listHospitals, listLinks } from "./links/service";
import type { Packet, PacketField } from "./referral/packet";
import type { listFacilities } from "./referral/queries";
import type { ackSchema, createReferralSchema, getReferralForHolder, getReferralPacketForViewer } from "./referral/service";
import type { createShare, createShareSchema, listShares, openSchema, readAccessLog } from "./share/service";
import type { ViewerResult } from "./share/session";
import type { ViewerSummary } from "./share/summary";

/** JSON form of a server type: Date becomes an ISO string; everything else is unchanged. */
export type Jsonify<T> = T extends Date
  ? string
  : T extends readonly (infer U)[]
    ? Jsonify<U>[]
    : T extends object
      ? { [K in keyof T]: Jsonify<T[K]> }
      : T;

type Ok<R> = Extract<Awaited<R>, { ok: true }> extends { data: infer D } ? Jsonify<D> : never;

// ---------------------------------------------------------------- shared shapes

export type { Advisory, Explanation, FactDTO, FactWithPrevious, Packet, PacketField, PreviousValue, SensitiveCategory, ViewerSummary };

/** Every error body (Locked decision L7). Switch on `code`, never on `message`. */
export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Feed 422 only: where the bundle is outside the subset (paths and messages, never values). */
    issues?: { path: string; message: string }[];
  };
}

/** Every `error.code` the API sends. `(string & {})` keeps the union open so a new code does not break builds. */
export type ApiErrorCode =
  // 400
  | "invalid_request"
  | "unsupported_type"
  | "invalid_expiry"
  | "document_not_in_record"
  | "referral_not_in_record"
  | "invalid_source"
  | "invalid_destination"
  | "field_not_allowed"
  | "hospital_not_found"
  | "not_explainable"
  // 401 / 403
  | "unauthenticated"
  | "forbidden"
  | "consent_required"
  | "provider_entered_immutable"
  | "dispute_provider_only"
  | "code_not_valid"
  | ViewerRefusal
  // 404 / 409 / 413 / 429
  | "not_found"
  | "invalid_transition"
  | "already_removed"
  | "extraction_in_progress"
  | "client_upload_id_conflict"
  | "file_too_large"
  | "too_many_attempts"
  // 5xx
  | "internal_error"
  | "extraction_failed"
  | "storage_failed"
  | "service_unavailable"
  // partner feed only
  | "method_not_allowed"
  | "idempotency_key_required"
  | "payload_too_large"
  | "unsupported_media_type"
  | "bundle_invalid"
  | "link_not_active"
  | (string & {});

/** 403 codes on clinician routes when the viewer session can no longer be used. Show "This access is no longer valid." */
export type ViewerRefusal = Extract<ViewerResult, { ok: false }>["reason"];

// ---------------------------------------------------------------- records and consent

export interface RecordSummary {
  id: string;
  display_name: string;
  birth_year: number | null;
  is_self: boolean;
  held_by_caregiver: boolean;
  created_at: string;
}
/** GET /api/records */
export interface RecordsResponse {
  records: RecordSummary[];
}
/** POST /api/records (strict) */
export interface CreateRecordBody {
  display_name: string;
  birth_year?: number | null;
  is_self: boolean;
}
export interface CreateRecordResponse {
  record_id: string;
}
/** GET and POST /api/consent */
export interface ConsentResponse {
  ai_consent_at: string | null;
}

// ---------------------------------------------------------------- documents

/** POST /api/documents is multipart/form-data: record_id, client_upload_id (uuid, reused on retry), file. */
export interface UploadDocumentResponse {
  document_id: string;
  status: DocumentStatus;
}
export type DocumentStatus = "uploaded" | "extracting" | "extracted" | "failed";
/** GET /api/documents/{id} */
export type DocumentResponse = Jsonify<ReturnType<typeof documentView>>;
/** POST /api/documents/{id}/extract */
export interface ExtractResponse {
  document_id: string;
  status: "extracted";
  facts: FactDTO[];
  ai_notice: string;
}

// ---------------------------------------------------------------- facts

/** GET /api/records/{id}/facts */
export interface TimelineResponse {
  facts: FactWithPrevious[];
  documents: Jsonify<Awaited<ReturnType<typeof listRecordDocuments>>>;
  ai_notice: string;
}
/** POST /api/facts (strict) */
export type AddFactBody = z.input<typeof addFactSchema>;
/** POST /api/facts/{id}/correct (strict) */
export type CorrectFactBody = z.input<typeof correctionSchema>;
/** POST /api/facts/{id}/dispute (strict). DELETE takes no body. */
export interface DisputeFactBody {
  note: string;
}
/** POST /api/facts/{id}/category (strict) */
export interface CategoryBody {
  sensitive_category: SensitiveCategory | null;
}
/** POST /api/facts, /confirm, /correct, /dispute (POST and DELETE), /category */
export interface FactResponse {
  fact: FactDTO;
}
/** POST /api/facts/{id}/remove */
export interface RemoveFactResponse {
  removed: true;
  fact_id: string;
}
/** GET /api/facts/{id}/explanation */
export type ExplanationResponse = Explanation;
/** GET /api/records/{id}/advisories */
export type AdvisoriesResponse = Jsonify<Awaited<ReturnType<typeof getAdvisories>>>;

// ---------------------------------------------------------------- shares, access log, viewer

/** POST /api/shares (strict) */
export type CreateShareBody = z.input<typeof createShareSchema>;
/** POST /api/shares: the code is returned ONCE. */
export type CreateShareResponse = Ok<ReturnType<typeof createShare>>;
/** GET /api/records/{id}/shares */
export interface SharesResponse {
  shares: Jsonify<Awaited<ReturnType<typeof listShares>>>;
}
/** POST /api/shares/{id}/revoke, POST /api/links/{id}/revoke */
export interface RevokeResponse {
  revoked: true;
}
/** GET /api/records/{id}/access-log?limit= */
export interface AccessLogResponse {
  entries: Jsonify<Awaited<ReturnType<typeof readAccessLog>>>;
}
/** POST /api/view/open (strict, anonymous). Sets the itan_v cookie on 200. */
export type ViewOpenBody = z.input<typeof openSchema>;
export interface ViewOpenResponse {
  ok: true;
  next: "/v" | "/v/referral";
}

// ---------------------------------------------------------------- referrals

/** GET /api/facilities */
export interface FacilitiesResponse {
  facilities: Jsonify<Awaited<ReturnType<typeof listFacilities>>>;
}
/** POST /api/referrals (strict). Reason and urgency can never be sent (400 field_not_allowed). */
export type CreateReferralBody = z.input<typeof createReferralSchema>;
export interface CreateReferralResponse {
  referral_id: string;
}
/** GET /api/referrals/{id} */
export type ReferralPreviewResponse = Jsonify<NonNullable<Awaited<ReturnType<typeof getReferralForHolder>>>>;
/** getReferralPacketForViewer(ctx), for the /v/referral server component. */
export type ViewerReferralPacket = Jsonify<NonNullable<Awaited<ReturnType<typeof getReferralPacketForViewer>>>>;
/** POST /api/view/ack (strict, itan_v cookie of a referral share) */
export type AckBody = z.input<typeof ackSchema>;
export interface AckResponse {
  label: string;
  disclaimer: string;
}

// ---------------------------------------------------------------- hospital links

/** GET /api/hospitals */
export interface HospitalsResponse {
  hospitals: Jsonify<Awaited<ReturnType<typeof listHospitals>>>;
}
/** POST /api/links (strict) */
export type CreateLinkBody = z.input<typeof createLinkSchema>;
export type CreateLinkResponse = Ok<ReturnType<typeof createLink>>;
/** GET /api/records/{id}/links */
export interface LinksResponse {
  links: Jsonify<Awaited<ReturnType<typeof listLinks>>>;
}

// ---------------------------------------------------------------- ops

/** GET /api/health (no auth, no database) */
export interface HealthResponse {
  ok: true;
  region: string;
  node: string;
}
