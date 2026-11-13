// SQL for shares, viewer sessions, attempts and the access log. No business rules here (see service.ts).
import { and, count, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { getDb, type Executor } from "@/lib/db/client";
import {
  access_log,
  code_attempt,
  document,
  fact,
  patient_record,
  referral,
  share,
  share_hidden_category,
  share_hidden_document,
  viewer_session,
} from "@/lib/db/schema";
import type { SessionRow, SessionShare } from "./session";

type ShareRow = typeof share.$inferSelect;
export type ShareWithHidden = ShareRow & { hiddenCategories: string[]; hiddenDocumentIds: string[] };

async function hiddenFor(db: Executor, shareIds: string[]) {
  if (!shareIds.length) return { cats: new Map<string, string[]>(), docs: new Map<string, string[]>() };
  const [cats, docs] = await Promise.all([
    db.select().from(share_hidden_category).where(inArray(share_hidden_category.share_id, shareIds)),
    db.select().from(share_hidden_document).where(inArray(share_hidden_document.share_id, shareIds)),
  ]);
  const group = <T extends { share_id: string }>(rows: T[], pick: (r: T) => string) => {
    const m = new Map<string, string[]>();
    for (const r of rows) m.set(r.share_id, [...(m.get(r.share_id) ?? []), pick(r)]);
    return m;
  };
  return { cats: group(cats, (r) => r.category), docs: group(docs, (r) => r.document_id) };
}

async function withHidden(db: Executor, rows: ShareRow[]): Promise<ShareWithHidden[]> {
  const { cats, docs } = await hiddenFor(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, hiddenCategories: cats.get(r.id) ?? [], hiddenDocumentIds: docs.get(r.id) ?? [] }));
}

export async function findShareByHash(codeHash: string, db: Executor = getDb()): Promise<ShareWithHidden | null> {
  const rows = await db.select().from(share).where(eq(share.code_hash, codeHash));
  return (await withHidden(db, rows))[0] ?? null;
}

export async function findShareById(shareId: string, db: Executor = getDb()): Promise<ShareWithHidden | null> {
  const rows = await db.select().from(share).where(eq(share.id, shareId));
  return (await withHidden(db, rows))[0] ?? null;
}

export async function insertShare(
  tx: Executor,
  v: { recordId: string; codeHash: string; purpose: "general" | "referral"; expiresAt: Date; referralId: string | null; categories: string[]; documentIds: string[] },
): Promise<string> {
  const [row] = await tx
    .insert(share)
    .values({ record_id: v.recordId, code_hash: v.codeHash, purpose: v.purpose, expires_at: v.expiresAt, referral_id: v.referralId })
    .returning({ id: share.id });
  if (v.categories.length) await tx.insert(share_hidden_category).values(v.categories.map((category) => ({ share_id: row.id, category })));
  if (v.documentIds.length) await tx.insert(share_hidden_document).values(v.documentIds.map((document_id) => ({ share_id: row.id, document_id })));
  return row.id;
}

/** Sets revoked_at only if not already set. Returns true when this call revoked it. */
export async function markRevoked(tx: Executor, shareId: string): Promise<boolean> {
  const rows = await tx.update(share).set({ revoked_at: sql`now()` }).where(and(eq(share.id, shareId), isNull(share.revoked_at))).returning({ id: share.id });
  return rows.length > 0;
}

export async function listSharesForRecord(recordId: string, db: Executor = getDb()) {
  const rows = await db.select().from(share).where(eq(share.record_id, recordId)).orderBy(desc(share.created_at));
  const withH = await withHidden(db, rows);
  const counts = rows.length
    ? await db.select({ share_id: viewer_session.share_id, n: count() }).from(viewer_session).where(inArray(viewer_session.share_id, rows.map((r) => r.id))).groupBy(viewer_session.share_id)
    : [];
  const byShare = new Map(counts.map((c) => [c.share_id, Number(c.n)]));
  return withH.map((s) => ({ ...s, viewerCount: byShare.get(s.id) ?? 0 }));
}

// ---- rate limit

export async function countRecentFailures(ipHash: string, since: Date, db: Executor = getDb()): Promise<number> {
  const [r] = await db.select({ n: count() }).from(code_attempt).where(and(eq(code_attempt.ip_hash, ipHash), eq(code_attempt.success, false), gt(code_attempt.at, since)));
  return Number(r.n);
}

export async function recordAttempt(ipHash: string, success: boolean, db: Executor = getDb()): Promise<void> {
  await db.insert(code_attempt).values({ ip_hash: ipHash, success });
}

// ---- viewer sessions

export async function insertViewerSession(
  tx: Executor,
  v: { tokenHash: string; shareId: string; name: string; practiceNo: string; expiresAt: Date },
): Promise<void> {
  await tx.insert(viewer_session).values({ token_hash: v.tokenHash, share_id: v.shareId, viewer_name: v.name, practice_no: v.practiceNo, expires_at: v.expiresAt });
}

/** The session and the share it belongs to, loaded fresh so the share's state is re-checked every request. */
export async function findSessionAndShare(tokenHash: string, db: Executor = getDb()): Promise<{ session: SessionRow; share: SessionShare } | null> {
  const [s] = await db.select().from(viewer_session).where(eq(viewer_session.token_hash, tokenHash));
  if (!s) return null;
  const sh = await findShareById(s.share_id, db);
  if (!sh) return null;
  return {
    session: { token_hash: s.token_hash, viewer_name: s.viewer_name, practice_no: s.practice_no, expires_at: s.expires_at },
    share: {
      id: sh.id,
      record_id: sh.record_id,
      purpose: sh.purpose as "general" | "referral",
      referral_id: sh.referral_id,
      expires_at: sh.expires_at,
      revoked_at: sh.revoked_at,
      hiddenCategories: sh.hiddenCategories,
      hiddenDocumentIds: sh.hiddenDocumentIds,
    },
  };
}

// ---- ownership checks used when creating a share

export async function countDocumentsInRecord(recordId: string, ids: string[], db: Executor = getDb()): Promise<number> {
  if (!ids.length) return 0;
  const [r] = await db.select({ n: count() }).from(document).where(and(eq(document.record_id, recordId), inArray(document.id, ids)));
  return Number(r.n);
}

export async function referralInRecord(recordId: string, referralId: string, db: Executor = getDb()): Promise<boolean> {
  const [r] = await db.select({ id: referral.id }).from(referral).where(and(eq(referral.id, referralId), eq(referral.record_id, recordId)));
  return !!r;
}

// ---- reads for the clinician

export async function loadRecordHeader(recordId: string, db: Executor = getDb()) {
  const [r] = await db.select({ display_name: patient_record.display_name, birth_year: patient_record.birth_year, is_self: patient_record.is_self }).from(patient_record).where(eq(patient_record.id, recordId));
  return r ?? null;
}

/** A fact with the storage path of its document (null if it has no document). */
export async function getFactWithStoragePath(factId: string, db: Executor = getDb()) {
  const [row] = await db
    .select({ fact, storage_path: document.storage_path })
    .from(fact)
    .leftJoin(document, eq(document.id, fact.document_id))
    .where(eq(fact.id, factId));
  return row ?? null;
}

// ---- the access log (read side; writes are in lib/audit.ts)

export async function listAccessLog(recordId: string, limit: number, db: Executor = getDb()) {
  return db.select().from(access_log).where(eq(access_log.record_id, recordId)).orderBy(desc(access_log.at)).limit(limit);
}
