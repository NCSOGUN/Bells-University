// C15 partner feed intake (FR-26, FR-27, NFR-22, NFR-23, NFR-24). WRITE-ONLY: nothing here reads patient facts
// back to the caller, and no feed route returns record content.
//
// Check order (Locked decision L26), each step refusing before the next one runs:
//   1. method            405 (handled by processFeedReadAttempt, before any authentication)
//   2. bearer key        401   hashed lookup, constant-time compare; revoked keys are not found
//   3. Idempotency-Key   400   idempotency_key_required
//   4. body size         413   streamed, stops at MAX_FEED_BYTES
//   5. content type      415   application/fhir+json or application/json (L29; docs/DEVIATIONS.md D-017)
//   6. JSON + subset     422   issues are paths and messages only
//   7. link              403   link_not_active, ONE body for unknown, revoked, other-hospital and changed-patient
//   8. replay            200   the original receipt; nothing written
//   9. write             202   one transaction: receipt, facts, fact events, supersedes, access log
//
// Dependencies (database, clock) are injected so every row of the refusal table is unit-tested without a network.
// Never log or echo the key, the bundle or any value from it (L31).
import { sha256Hex, safeEqualHex } from "@/lib/crypto";
import { MAX_FEED_BYTES } from "@/lib/config";
import { isUuid } from "@/lib/http";
import { logEvent } from "@/lib/log";
import { can } from "@/lib/policy";
import { parseBundle, type Issue } from "./fhir-subset";
import { observationToFact, serviceRequestToFact, type FeedFact } from "./map";

export type RefusalReason =
  | "read_attempt"
  | "bad_key"
  | "idempotency_key_missing"
  | "too_large"
  | "unsupported_media_type"
  | "bundle_invalid"
  | "link_not_active";

export interface HospitalCredential {
  hospitalId: string;
  hospitalName: string;
  keyHash: string;
}

export interface LinkRow {
  id: string;
  recordId: string;
  hospitalId: string;
  hospitalPatientRef: string | null;
  revokedAt: Date | null;
}

export interface Refusal {
  hospitalId: string | null;
  linkId: string | null;
  reason: RefusalReason;
  bundleBytes: number | null;
  /** Set when the link existed: the patient sees the refused delivery in their access log. */
  recordLog: { recordId: string; actorLabel: string } | null;
}

export interface AcceptedWrite {
  hospitalId: string;
  hospitalName: string;
  link: LinkRow;
  hospitalPatientRef: string;
  idempotencyKey: string;
  bundleBytes: number;
  /** Builds the fact rows once the receipt id exists (inside the transaction). */
  buildFacts: (receiptId: string) => FeedFact[];
}

export type WriteOutcome =
  | { kind: "accepted"; receiptId: string; factsCreated: number }
  /** A concurrent request with the same Idempotency-Key won the unique constraint. */
  | { kind: "duplicate" }
  /** The link was revoked, or its patient reference changed, between the check and the write. */
  | { kind: "link_not_active" };

export interface FeedDeps {
  findCredentialByKeyHash(keyHash: string): Promise<HospitalCredential | null>;
  findLinkByRef(linkRef: string): Promise<LinkRow | null>;
  findAcceptedReceipt(hospitalId: string, idempotencyKey: string): Promise<{ receiptId: string; factsCreated: number } | null>;
  /** Best effort: a failure to log a refusal never changes the refusal. */
  recordRefusal(r: Refusal): Promise<void>;
  /** ONE transaction. Throws only on unexpected errors. */
  writeAccepted(w: AcceptedWrite): Promise<WriteOutcome>;
}

export interface FeedResult {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

const NO_STORE = { "Cache-Control": "no-store" };
const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): FeedResult => ({
  status,
  body: { error: { code, message, ...extra } },
  headers: { ...NO_STORE, ...headers },
});

/** The ONE 403 body: identical for unknown, revoked and other-hospital links (NFR-22). It never says why. */
export const LINK_NOT_ACTIVE: FeedResult = err(403, "link_not_active", "This link is not active.");

const ACCEPTED_TYPES = ["application/fhir+json", "application/json"];

async function refuse(deps: FeedDeps, result: FeedResult, r: Refusal): Promise<FeedResult> {
  try {
    await deps.recordRefusal(r);
  } catch (e) {
    logEvent("error", "feed_refusal_not_recorded", { reason: r.reason, pg_code: (e as { code?: string })?.code ?? null });
  }
  return result;
}

/** 405 for every method other than POST, on every path under /api/feed. Runs before authentication, so the
 *  attempt cannot be attributed to a hospital (hospital_id null). */
export async function processFeedReadAttempt(deps: Pick<FeedDeps, "recordRefusal">): Promise<FeedResult> {
  const result = err(405, "method_not_allowed", "The feed accepts POST only. Nothing can be read through it.", {}, { Allow: "POST" });
  return refuse(deps as FeedDeps, result, { hospitalId: null, linkId: null, reason: "read_attempt", bundleBytes: null, recordLog: null });
}

/** Read at most `max` bytes. Stops reading (and cancels the stream) as soon as the limit is passed. */
export async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; bytesRead: number }> {
  if (!body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return { ok: false, bytesRead: total };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    bytes.set(c, off);
    off += c.byteLength;
  }
  return { ok: true, bytes };
}

export async function processFeedRequest(request: Request, deps: FeedDeps, maxBytes = MAX_FEED_BYTES): Promise<FeedResult> {
  // 1. Method.
  if (request.method !== "POST") return processFeedReadAttempt(deps);

  // 2. Bearer key. Nothing else is revealed until the caller is a known hospital.
  const auth = request.headers.get("authorization") ?? "";
  const presented = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const presentedHash = presented ? sha256Hex(presented) : "";
  const cred = presentedHash ? await deps.findCredentialByKeyHash(presentedHash) : null;
  if (!cred || !safeEqualHex(presentedHash, cred.keyHash)) {
    return refuse(deps, err(401, "unauthenticated", "A valid hospital key is required."), {
      hospitalId: null,
      linkId: null,
      reason: "bad_key",
      bundleBytes: null,
      recordLog: null,
    });
  }
  const refusal = (reason: RefusalReason, bundleBytes: number | null = null): Refusal => ({
    hospitalId: cred.hospitalId,
    linkId: null,
    reason,
    bundleBytes,
    recordLog: null,
  });

  // 3. Idempotency-Key.
  const idem = request.headers.get("idempotency-key")?.trim() ?? "";
  if (!isUuid(idem)) {
    return refuse(deps, err(400, "idempotency_key_required", "Send an Idempotency-Key header containing a UUID."), refusal("idempotency_key_missing"));
  }

  // 4. Body size: the declared length first, then the bytes actually streamed.
  const tooLarge = err(413, "payload_too_large", `The bundle must be at most ${maxBytes} bytes.`);
  const declared = Number(request.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) return refuse(deps, tooLarge, refusal("too_large", declared));
  const read = await readCapped(request.body, maxBytes);
  if (!read.ok) return refuse(deps, tooLarge, refusal("too_large", read.bytesRead));
  const bundleBytes = read.bytes.byteLength;

  // 5. Content type.
  const ctype = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_TYPES.includes(ctype)) {
    return refuse(
      deps,
      err(415, "unsupported_media_type", "Send Content-Type: application/fhir+json (or application/json)."),
      refusal("unsupported_media_type", bundleBytes),
    );
  }

  // 6. JSON and the FHIR subset.
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(read.bytes));
  } catch {
    const issues: Issue[] = [{ path: "(body)", message: "The body is not valid UTF-8 JSON" }];
    return refuse(deps, err(422, "bundle_invalid", "The bundle is outside the accepted subset. Nothing was written.", { issues }), refusal("bundle_invalid", bundleBytes));
  }
  const bundle = parseBundle(parsedJson);
  if (!bundle.ok) {
    return refuse(
      deps,
      err(422, "bundle_invalid", "The bundle is outside the accepted subset. Nothing was written.", { issues: bundle.issues }),
      refusal("bundle_invalid", bundleBytes),
    );
  }

  // 7. Link. The decision goes through can() (hard rule 3); every failure gives the same 403.
  const link = await deps.findLinkByRef(bundle.patient.linkRef);
  const linkActive =
    !!link &&
    link.revokedAt === null &&
    (link.hospitalPatientRef === null || link.hospitalPatientRef === bundle.patient.hospitalPatientRef);
  const decision = can(
    { kind: "partner", hospitalId: cred.hospitalId, linkActive, linkHospitalMatches: !!link && link.hospitalId === cred.hospitalId },
    "write_feed",
  );
  const linkRefused = () =>
    refuse(deps, LINK_NOT_ACTIVE, {
      ...refusal("link_not_active", bundleBytes),
      linkId: link?.id ?? null,
      // The link existed: the patient sees "A delivery from <hospital> was refused".
      recordLog: link ? { recordId: link.recordId, actorLabel: cred.hospitalName } : null,
    });
  if (!decision.allowed || !link) return linkRefused();

  // 8. Replay: the same Idempotency-Key from the same hospital returns the original receipt.
  const replay = (r: { receiptId: string; factsCreated: number }): FeedResult => ({
    status: 200,
    body: { receipt_id: r.receiptId, facts_created: r.factsCreated, replayed: true },
    headers: { ...NO_STORE },
  });
  const earlier = await deps.findAcceptedReceipt(cred.hospitalId, idem);
  if (earlier) return replay(earlier);

  // 9. Write, in one transaction.
  const outcome = await deps.writeAccepted({
    hospitalId: cred.hospitalId,
    hospitalName: cred.hospitalName,
    link,
    hospitalPatientRef: bundle.patient.hospitalPatientRef,
    idempotencyKey: idem,
    bundleBytes,
    buildFacts: (receiptId) => {
      const ctx = { recordId: link.recordId, hospitalId: cred.hospitalId, facilityName: cred.hospitalName, receiptId };
      return [...bundle.observations.map((o) => observationToFact(o, ctx)), ...bundle.serviceRequests.map((s) => serviceRequestToFact(s, ctx))];
    },
  });
  if (outcome.kind === "duplicate") {
    const winner = await deps.findAcceptedReceipt(cred.hospitalId, idem);
    if (winner) return replay(winner);
    throw new Error("idempotency conflict without a receipt");
  }
  if (outcome.kind === "link_not_active") return linkRefused();
  return { status: 202, body: { receipt_id: outcome.receiptId, facts_created: outcome.factsCreated }, headers: { ...NO_STORE } };
}
