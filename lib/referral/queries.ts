// SQL for referrals, facilities and acknowledgements. No business rules here (see service.ts).
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { getDb, type Executor } from "@/lib/db/client";
import { facility, fact, referral, referral_ack, viewer_session, type FactRow } from "@/lib/db/schema";

export type ReferralRow = typeof referral.$inferSelect;

export async function listFacilities(db: Executor = getDb()) {
  return db.select({ id: facility.id, name: facility.name, city: facility.city, is_simulated: facility.is_simulated }).from(facility).orderBy(asc(facility.name));
}

export async function facilityName(id: string | null, db: Executor = getDb()): Promise<string | null> {
  if (!id) return null;
  const [r] = await db.select({ name: facility.name }).from(facility).where(eq(facility.id, id));
  return r?.name ?? null;
}

export async function facilityExists(id: string, db: Executor = getDb()): Promise<boolean> {
  const [r] = await db.select({ id: facility.id }).from(facility).where(eq(facility.id, id));
  return !!r;
}

/** A not-removed fact of kind referral in this record, else null. */
export async function getReferralFactInRecord(factId: string, recordId: string, db: Executor = getDb()): Promise<FactRow | null> {
  const [r] = await db.select().from(fact).where(and(eq(fact.id, factId), eq(fact.record_id, recordId), eq(fact.kind, "referral"), isNull(fact.removed_at)));
  return r ?? null;
}

export async function getFactById(factId: string | null, db: Executor = getDb()): Promise<FactRow | null> {
  if (!factId) return null;
  const [r] = await db.select().from(fact).where(and(eq(fact.id, factId), isNull(fact.removed_at)));
  return r ?? null;
}

export async function insertReferral(db: Executor, v: typeof referral.$inferInsert): Promise<string> {
  const [r] = await db.insert(referral).values(v).returning({ id: referral.id });
  return r.id;
}

export async function getReferral(id: string, db: Executor = getDb()): Promise<ReferralRow | null> {
  const [r] = await db.select().from(referral).where(eq(referral.id, id));
  return r ?? null;
}

export async function listAcks(referralId: string, db: Executor = getDb()) {
  return db
    .select({ status: referral_ack.status, at: referral_ack.at, viewer_name: viewer_session.viewer_name, practice_no: viewer_session.practice_no })
    .from(referral_ack)
    .innerJoin(viewer_session, eq(viewer_session.token_hash, referral_ack.viewer_session_id))
    .where(eq(referral_ack.referral_id, referralId))
    .orderBy(desc(referral_ack.at));
}

export async function insertAck(db: Executor, v: { referralId: string; viewerSessionId: string; status: string }): Promise<void> {
  await db.insert(referral_ack).values({ referral_id: v.referralId, viewer_session_id: v.viewerSessionId, status: v.status });
}
