// Share business rules and orchestration (C10, C12; FR-10 to FR-13, FR-15, NFR-05, NFR-06).
// Calls the pure rules (codes, evaluate, filter, session, ratelimit) and the SQL in queries.ts.
// Every refusal carries no record content. Codes, tokens and hashes are never logged or returned (L31).
import QRCode from "qrcode";
import { z } from "zod";
import { writeAccessLog } from "@/lib/audit";
import { describeLogEntry } from "@/lib/audit-labels";
import { SENSITIVE_CATEGORIES } from "@/lib/categories";
import { DEFAULT_SHARE_MINUTES, MAX_REFERRAL_EXPIRY_DAYS, RATE_LIMIT_WINDOW_MINUTES, env } from "@/lib/config";
import { getDb, withTransaction, type Db } from "@/lib/db/client";
import { toFactDTO } from "@/lib/facts/dto";
import { listActiveFacts } from "@/lib/facts/queries";
import { can } from "@/lib/policy";
import { supabaseStorage } from "@/lib/storage";
import { formatCode, generateCode, hashCode, isPlausibleCode, normaliseCode } from "./codes";
import { evaluateShare } from "./evaluate";
import { isHiddenByShare } from "./filter";
import { clientIp, hashIp, isRateLimited } from "./ratelimit";
import * as q from "./queries";
import {
  cookieOptions,
  hashViewerToken,
  newViewerToken,
  readViewerCookie,
  resolveViewer,
  serializeCookie,
  sessionExpiry,
  type ViewerContext,
  type ViewerResult,
} from "./session";
import { buildSummary, type ViewerSummary } from "./summary";

export type Result<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string; headers?: Record<string, string> };
const fail = (status: number, code: string, message: string, headers?: Record<string, string>) => ({ ok: false as const, status, code, message, headers });

// ---------------------------------------------------------------- creating shares (holder)

export const MIN_SHARE_MINUTES = 15;
export const MAX_GENERAL_SHARE_MINUTES = 24 * 60;

export const createShareSchema = z.strictObject({
  record_id: z.uuid(),
  purpose: z.enum(["general", "referral"]),
  expires_in_minutes: z.number().int().optional(),
  hidden_categories: z.array(z.enum(SENSITIVE_CATEGORIES)).max(SENSITIVE_CATEGORIES.length).optional(),
  hidden_document_ids: z.array(z.uuid()).max(200).optional(),
  referral_id: z.uuid().optional(),
});

/** L13: 15 minutes to 24 hours for general shares; referral shares up to MAX_REFERRAL_EXPIRY_DAYS. */
export function expiryMinutes(purpose: "general" | "referral", requested: number | undefined): number | null {
  const minutes = requested ?? DEFAULT_SHARE_MINUTES;
  const max = purpose === "referral" ? MAX_REFERRAL_EXPIRY_DAYS * 24 * 60 : MAX_GENERAL_SHARE_MINUTES;
  return minutes >= MIN_SHARE_MINUTES && minutes <= max ? minutes : null;
}

export async function createShare(
  input: z.infer<typeof createShareSchema>,
  origin: string,
  now = new Date(),
  db: Db = getDb(),
): Promise<Result<{ share_id: string; code: string; url: string; qr_svg: string; expires_at: string }>> {
  const minutes = expiryMinutes(input.purpose, input.expires_in_minutes);
  if (minutes === null) return fail(400, "invalid_expiry", "Choose an expiry from 15 minutes up to the allowed maximum.");
  if (input.purpose === "referral" && !input.referral_id) return fail(400, "invalid_request", "A referral share needs a referral_id.");
  if (input.purpose === "general" && input.referral_id) return fail(400, "invalid_request", "referral_id is only for referral shares.");

  const docIds = [...new Set(input.hidden_document_ids ?? [])];
  if (docIds.length && (await q.countDocumentsInRecord(input.record_id, docIds, db)) !== docIds.length) {
    return fail(400, "document_not_in_record", "One of the hidden documents does not belong to this record.");
  }
  if (input.referral_id && !(await q.referralInRecord(input.record_id, input.referral_id, db))) {
    return fail(400, "referral_not_in_record", "That referral does not belong to this record.");
  }

  const expiresAt = new Date(now.getTime() + minutes * 60_000);
  const pepper = env().SHARE_PEPPER;
  const code = generateCode();
  const shareId = await withTransaction(async (tx) => {
    const id = await q.insertShare(tx, {
      recordId: input.record_id,
      codeHash: hashCode(code, pepper),
      purpose: input.purpose,
      expiresAt,
      referralId: input.referral_id ?? null,
      categories: [...new Set(input.hidden_categories ?? [])],
      documentIds: docIds,
    });
    await writeAccessLog({ recordId: input.record_id, actorType: "patient", actorLabel: "patient", action: "share_created", outcome: "allowed", shareId: id }, tx);
    return id;
  });

  const display = formatCode(code);
  const url = `${origin}/c#${display}`;
  const qr_svg = await QRCode.toString(url, { type: "svg", margin: 1 });
  return { ok: true, status: 201, data: { share_id: shareId, code: display, url, qr_svg, expires_at: expiresAt.toISOString() } };
}

/** The record a share belongs to, for the policy check in the revoke route. */
export async function shareRecordId(shareId: string, db: Db = getDb()): Promise<string | null> {
  return (await q.findShareById(shareId, db))?.record_id ?? null;
}

export async function revokeShare(shareId: string, recordIds: string[], db: Db = getDb()): Promise<Result<{ revoked: true }>> {
  const s = await q.findShareById(shareId, db);
  if (!s || !recordIds.includes(s.record_id)) return fail(404, "not_found", "Not found.");
  await withTransaction(async (tx) => {
    // Idempotent: the log entry is written only by the call that actually revoked it.
    if (await q.markRevoked(tx, shareId)) {
      await writeAccessLog({ recordId: s.record_id, actorType: "patient", actorLabel: "patient", action: "share_revoked", outcome: "allowed", shareId }, tx);
    }
  });
  return { ok: true, status: 200, data: { revoked: true } };
}

export async function listShares(recordId: string, now = new Date(), db: Db = getDb()) {
  const rows = await q.listSharesForRecord(recordId, db);
  return rows.map((s) => ({
    id: s.id,
    purpose: s.purpose,
    created_at: s.created_at,
    expires_at: s.expires_at,
    revoked_at: s.revoked_at,
    status: evaluateShare(s, now),
    hidden_categories: s.hiddenCategories,
    hidden_document_ids: s.hiddenDocumentIds,
    viewer_count: s.viewerCount,
  }));
}

// ---------------------------------------------------------------- opening a code (clinician, anonymous)

export const openSchema = z.strictObject({
  code: z.string().min(1).max(40),
  name: z.string().trim().min(2).max(80),
  practice_no: z.string().trim().min(2).max(40),
});

/** The one refusal for unknown, expired and revoked codes: identical body, so a guesser learns nothing (L12). */
const CODE_NOT_VALID = () => fail(403, "code_not_valid", "This code is not valid.");

export async function openViewer(
  input: z.infer<typeof openSchema>,
  headers: Headers,
  now = new Date(),
  db: Db = getDb(),
): Promise<Result<{ ok: true; next: string }> & { setCookie?: string }> {
  const pepper = env().SHARE_PEPPER;
  const ipHash = hashIp(clientIp(headers), pepper);

  // 1. Rate limit FIRST: a limited caller's code is not even checked (L10).
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MINUTES * 60_000);
  if (isRateLimited(await q.countRecentFailures(ipHash, since, db))) {
    return fail(429, "too_many_attempts", "Too many attempts. Please wait a few minutes and try again.", { "Retry-After": String(RATE_LIMIT_WINDOW_MINUTES * 60) });
  }

  // 2. Normalise, hash, look up.
  const normalised = normaliseCode(input.code);
  const found = isPlausibleCode(normalised) ? await q.findShareByHash(hashCode(normalised, pepper), db) : null;
  if (!found) {
    await q.recordAttempt(ipHash, false, db);
    return CODE_NOT_VALID();
  }

  const label = `${input.name} · ${input.practice_no} (unverified)`;
  const status = evaluateShare(found, now);
  if (status !== "valid") {
    // The code resolved to a share, so the patient is told someone tried it (the reason is logged, never returned).
    await withTransaction(async (tx) => {
      await q.recordAttempt(ipHash, false, tx);
      await writeAccessLog({ recordId: found.record_id, actorType: "clinician", actorLabel: label, action: "viewer_open_refused", outcome: "refused", reason: status, shareId: found.id }, tx);
    });
    return CODE_NOT_VALID();
  }

  // 3. Valid: session, attempt and log in ONE transaction.
  const token = newViewerToken();
  const expiresAt = sessionExpiry(now, found.expires_at);
  await withTransaction(async (tx) => {
    await q.recordAttempt(ipHash, true, tx);
    await q.insertViewerSession(tx, { tokenHash: hashViewerToken(token), shareId: found.id, name: input.name, practiceNo: input.practice_no, expiresAt });
    await writeAccessLog({ recordId: found.record_id, actorType: "clinician", actorLabel: label, action: "viewer_opened", outcome: "allowed", shareId: found.id }, tx);
  });
  return {
    ok: true,
    status: 200,
    data: { ok: true, next: found.purpose === "referral" ? "/v/referral" : "/v" },
    setCookie: serializeCookie(token, cookieOptions(expiresAt, now)),
  };
}

// ---------------------------------------------------------------- using a session (clinician)

/** Reads the itan_v cookie, loads the session AND its share, and re-checks the share every call. */
export async function getViewerFromRequest(request: Request, now = new Date(), db: Db = getDb()): Promise<ViewerResult> {
  const token = readViewerCookie(request.headers.get("cookie"));
  if (!token) return { ok: false, reason: "no_cookie" };
  const loaded = await q.findSessionAndShare(hashViewerToken(token), db);
  return resolveViewer(loaded?.session ?? null, loaded?.share ?? null, now);
}

/** For Dev A's /v page. Returns null if the actor may not see the summary. */
export async function getViewerSummary(ctx: ViewerContext, db: Db = getDb()): Promise<ViewerSummary | null> {
  if (!can(ctx.actor, "see_shared_summary", { recordId: ctx.recordId }).allowed) return null;
  const [record, facts] = await Promise.all([q.loadRecordHeader(ctx.recordId, db), listActiveFacts(ctx.recordId, db)]);
  if (!record) return null;
  return buildSummary(ctx, record, facts);
}

/** The signed image URL for one shared fact, or a refusal. Hidden facts look like facts that do not exist. */
export async function getSharedFactImageUrl(ctx: ViewerContext, factId: string, db: Db = getDb()): Promise<Result<{ url: string }>> {
  const row = await q.getFactWithStoragePath(factId, db);
  if (!row || row.fact.record_id !== ctx.recordId || row.fact.removed_at || row.fact.superseded_by) return fail(404, "not_found", "Not found.");
  const dto = toFactDTO(row.fact);
  if (isHiddenByShare(dto, ctx.share) || !row.storage_path) return fail(404, "not_found", "Not found.");
  const d = can(ctx.actor, "see_source_image", {
    recordId: ctx.recordId,
    fact: { origin: dto.origin, sensitiveCategory: dto.sensitive_category, documentId: dto.document_id },
    share: { hiddenCategories: ctx.share.hiddenCategories, hiddenDocumentIds: ctx.share.hiddenDocumentIds },
  });
  if (!d.allowed) return fail(404, "not_found", "Not found.");
  await writeAccessLog({
    recordId: ctx.recordId,
    actorType: "clinician",
    actorLabel: `${ctx.viewer.name} · ${ctx.viewer.practiceNo} (unverified)`,
    action: "viewer_image_viewed",
    outcome: "allowed",
    shareId: ctx.share.id,
    factId,
  }, db);
  return { ok: true, status: 302, data: { url: await supabaseStorage.signedUrl(row.storage_path) } };
}

// ---------------------------------------------------------------- the access log (holder)

export async function readAccessLog(recordId: string, limit: number, db: Db = getDb()) {
  const rows = await q.listAccessLog(recordId, limit, db);
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    actor_type: r.actor_type,
    actor_label: r.actor_label,
    action: r.action,
    outcome: r.outcome,
    reason: r.reason,
    share_id: r.share_id,
    link_id: r.link_id,
    fact_id: r.fact_id,
    label: describeLogEntry(r),
  }));
}
