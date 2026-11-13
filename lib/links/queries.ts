// C14 hospital link SQL (FR-25, NFR-23).
import { and, asc, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { getDb, type Executor } from "@/lib/db/client";
import { feed_receipt, hospital, hospital_link } from "@/lib/db/schema";

export async function listHospitals(db: Executor = getDb()) {
  return db.select({ id: hospital.id, name: hospital.name, simulated: hospital.simulated }).from(hospital).orderBy(asc(hospital.name));
}

export async function findHospital(id: string, db: Executor = getDb()) {
  const [row] = await db.select({ id: hospital.id, name: hospital.name, simulated: hospital.simulated }).from(hospital).where(eq(hospital.id, id));
  return row ?? null;
}

/** Insert a link. Returns null if the link_ref collided (the caller retries with a fresh one). */
export async function insertLink(
  db: Executor,
  v: { recordId: string; hospitalId: string; linkRef: string; accountId: string },
): Promise<{ id: string; created_at: Date } | null> {
  const rows = await db
    .insert(hospital_link)
    .values({ record_id: v.recordId, hospital_id: v.hospitalId, link_ref: v.linkRef, linked_by_account_id: v.accountId })
    .onConflictDoNothing({ target: hospital_link.link_ref })
    .returning({ id: hospital_link.id, created_at: hospital_link.created_at });
  return rows[0] ?? null;
}

export async function findLinkWithHospital(id: string, db: Executor = getDb()) {
  const [row] = await db
    .select({ id: hospital_link.id, record_id: hospital_link.record_id, revoked_at: hospital_link.revoked_at, hospital_name: hospital.name })
    .from(hospital_link)
    .innerJoin(hospital, eq(hospital.id, hospital_link.hospital_id))
    .where(eq(hospital_link.id, id));
  return row ?? null;
}

/** True only for the call that actually revoked it (idempotent revoke). */
export async function markLinkRevoked(db: Executor, id: string): Promise<boolean> {
  const rows = await db
    .update(hospital_link)
    .set({ revoked_at: sql`now()` })
    .where(and(eq(hospital_link.id, id), isNull(hospital_link.revoked_at)))
    .returning({ id: hospital_link.id });
  return rows.length > 0;
}

export async function listLinksForRecord(recordId: string, db: Executor = getDb()) {
  const links = await db
    .select({
      id: hospital_link.id,
      link_ref: hospital_link.link_ref,
      hospital_id: hospital.id,
      hospital_name: hospital.name,
      hospital_simulated: hospital.simulated,
      created_at: hospital_link.created_at,
      revoked_at: hospital_link.revoked_at,
    })
    .from(hospital_link)
    .innerJoin(hospital, eq(hospital.id, hospital_link.hospital_id))
    .where(eq(hospital_link.record_id, recordId))
    .orderBy(desc(hospital_link.created_at));
  if (!links.length) return [];

  const counts = await db
    .select({
      link_id: feed_receipt.link_id,
      accepted: sql<number>`count(*) filter (where ${feed_receipt.status} = 'accepted')`.mapWith(Number),
      refused: sql<number>`count(*) filter (where ${feed_receipt.status} = 'refused')`.mapWith(Number),
      last: max(feed_receipt.received_at),
    })
    .from(feed_receipt)
    .where(inArray(feed_receipt.link_id, links.map((l) => l.id)))
    .groupBy(feed_receipt.link_id);
  const byLink = new Map(counts.map((c) => [c.link_id, c]));
  return links.map((l) => ({ ...l, counts: byLink.get(l.id) ?? null }));
}
