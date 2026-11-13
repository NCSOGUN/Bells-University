// C15 feed SQL. Called only through lib/feed/service.ts, which hands these to the intake as its dependencies.
// Nothing here returns patient facts to a partner: the reads are of credentials, links and receipts only.
import { randomUUID } from "node:crypto";
import { and, eq, isNull, ne } from "drizzle-orm";
import { writeAccessLog, writeFactEvent } from "@/lib/audit";
import { getDb, withTransaction, type Executor } from "@/lib/db/client";
import { fact, feed_receipt, hospital, hospital_credential, hospital_link } from "@/lib/db/schema";
import type { AcceptedWrite, HospitalCredential, LinkRow, Refusal, WriteOutcome } from "./intake";

export async function findCredentialByKeyHash(keyHash: string, db: Executor = getDb()): Promise<HospitalCredential | null> {
  const [row] = await db
    .select({ hospitalId: hospital.id, hospitalName: hospital.name, keyHash: hospital_credential.key_hash })
    .from(hospital_credential)
    .innerJoin(hospital, eq(hospital.id, hospital_credential.hospital_id))
    .where(and(eq(hospital_credential.key_hash, keyHash), isNull(hospital_credential.revoked_at)))
    .limit(1);
  return row ?? null;
}

const linkCols = {
  id: hospital_link.id,
  recordId: hospital_link.record_id,
  hospitalId: hospital_link.hospital_id,
  hospitalPatientRef: hospital_link.hospital_patient_ref,
  revokedAt: hospital_link.revoked_at,
};

export async function findLinkByRef(linkRef: string, db: Executor = getDb()): Promise<LinkRow | null> {
  const [row] = await db.select(linkCols).from(hospital_link).where(eq(hospital_link.link_ref, linkRef)).limit(1);
  return row ?? null;
}

export async function findAcceptedReceipt(hospitalId: string, idempotencyKey: string, db: Executor = getDb()) {
  const [row] = await db
    .select({ receiptId: feed_receipt.id, factsCreated: feed_receipt.facts_created })
    .from(feed_receipt)
    .where(and(eq(feed_receipt.hospital_id, hospitalId), eq(feed_receipt.idempotency_key, idempotencyKey), eq(feed_receipt.status, "accepted")))
    .limit(1);
  return row ?? null;
}

/** A refused delivery: a receipt with NO idempotency key (so a corrected retry is not blocked) and, when the
 *  link existed, an access-log entry on that patient's record. One transaction. */
export async function recordRefusal(r: Refusal): Promise<void> {
  await withTransaction(async (tx) => {
    await tx.insert(feed_receipt).values({
      hospital_id: r.hospitalId,
      link_id: r.linkId,
      idempotency_key: null,
      status: "refused",
      refusal_reason: r.reason,
      facts_created: 0,
      bundle_bytes: r.bundleBytes,
    });
    if (r.recordLog) {
      await writeAccessLog(
        {
          recordId: r.recordLog.recordId,
          actorType: "partner",
          actorLabel: r.recordLog.actorLabel,
          action: "feed_delivery_refused",
          outcome: "refused",
          reason: r.reason,
          linkId: r.linkId,
        },
        tx,
      );
    }
  });
}

const RECEIPT_IDEM_UQ = "feed_receipt_hospital_idem_uq";

/** Postgres unique violation on the receipt's (hospital, idempotency key) constraint. Drizzle may wrap the driver
 *  error, so look at the cause as well. */
function isIdempotencyConflict(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && i < 3; x = (x as { cause?: unknown }).cause, i++) {
    const pg = x as { code?: string; constraint_name?: string; constraint?: string };
    if (pg.code === "23505" && (pg.constraint_name ?? pg.constraint) === RECEIPT_IDEM_UQ) return true;
  }
  return false;
}

class LinkNoLongerActive extends Error {}

/** Everything for one accepted delivery, in ONE transaction (NFR-24): receipt, facts, a fact_event per fact,
 *  superseding of corrected results (L27), the hospital's patient number on first delivery (L25), access log. */
export async function writeAccepted(w: AcceptedWrite): Promise<WriteOutcome> {
  try {
    return await withTransaction(async (tx) => {
      // Re-check the link under a row lock: a revoke that lands between the check and the write wins.
      const [link] = await tx
        .select({ revokedAt: hospital_link.revoked_at, ref: hospital_link.hospital_patient_ref })
        .from(hospital_link)
        .where(eq(hospital_link.id, w.link.id))
        .for("update");
      if (!link || link.revokedAt !== null || (link.ref !== null && link.ref !== w.hospitalPatientRef)) throw new LinkNoLongerActive();

      // The receipt goes in first, so a concurrent duplicate Idempotency-Key fails before any fact is written.
      const receipt = { id: randomUUID() };
      const facts = w.buildFacts(receipt.id);
      await tx.insert(feed_receipt).values({
        id: receipt.id,
        hospital_id: w.hospitalId,
        link_id: w.link.id,
        idempotency_key: w.idempotencyKey,
        status: "accepted",
        facts_created: facts.length,
        bundle_bytes: w.bundleBytes,
      });

      for (const f of facts) {
        const [created] = await tx.insert(fact).values(f).returning({ id: fact.id });
        await writeFactEvent(
          { factId: created.id, actorType: "partner", event: "created", after: { origin: f.origin, state: f.state, feed_receipt_id: receipt.id } },
          tx,
        );
        if (f.source_identifier) {
          // A corrected result: same identifier, same hospital, same record. The old fact is kept (L27).
          const older = await tx
            .select({ id: fact.id })
            .from(fact)
            .where(
              and(
                eq(fact.record_id, f.record_id),
                eq(fact.hospital_id, f.hospital_id),
                eq(fact.source_identifier, f.source_identifier),
                isNull(fact.superseded_by),
                ne(fact.id, created.id), // not the row just inserted
              ),
            );
          for (const o of older) {
            await tx.update(fact).set({ superseded_by: created.id }).where(eq(fact.id, o.id));
            await writeFactEvent({ factId: o.id, actorType: "partner", event: "superseded", after: { superseded_by: created.id, feed_receipt_id: receipt.id } }, tx);
          }
        }
      }

      if (link.ref === null) {
        await tx.update(hospital_link).set({ hospital_patient_ref: w.hospitalPatientRef }).where(eq(hospital_link.id, w.link.id));
      }
      await writeAccessLog(
        {
          recordId: w.link.recordId,
          actorType: "partner",
          actorLabel: w.hospitalName,
          action: "feed_delivery_accepted",
          outcome: "allowed",
          reason: `${facts.length} item${facts.length === 1 ? "" : "s"}`,
          linkId: w.link.id,
        },
        tx,
      );
      return { kind: "accepted" as const, receiptId: receipt.id, factsCreated: facts.length };
    });
  } catch (e) {
    if (e instanceof LinkNoLongerActive) return { kind: "link_not_active" };
    if (isIdempotencyConflict(e)) return { kind: "duplicate" };
    throw e;
  }
}
