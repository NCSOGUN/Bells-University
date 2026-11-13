// Shared fact queries. Soft-deleted and superseded facts are excluded from every read except the event history.
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, type Executor } from "@/lib/db/client";
import { document, fact, type FactRow } from "@/lib/db/schema";
import { toFactDTO, type FactDTO } from "./dto";

/** Active facts of a record: newest fact_date first, null dates last, then created_at. */
export async function listActiveFacts(recordId: string, db: Executor = getDb()): Promise<FactDTO[]> {
  const rows = await db
    .select()
    .from(fact)
    .where(and(eq(fact.record_id, recordId), isNull(fact.removed_at), isNull(fact.superseded_by)))
    .orderBy(sql`${fact.fact_date} desc nulls last`, desc(fact.created_at));
  return rows.map(toFactDTO);
}

export async function listRecordDocuments(recordId: string, db: Executor = getDb()) {
  return db
    .select({
      id: document.id,
      doc_type: document.doc_type,
      status: document.status,
      uploaded_at: document.uploaded_at,
      facility_as_printed: document.facility_as_printed,
      document_date_as_printed: document.document_date_as_printed,
    })
    .from(document)
    .where(eq(document.record_id, recordId))
    .orderBy(asc(document.uploaded_at));
}

/** A fact by id (any state, including removed) so the caller can apply the holder check and the lifecycle. */
export async function getFact(factId: string, db: Executor = getDb()): Promise<FactRow | null> {
  const [row] = await db.select().from(fact).where(eq(fact.id, factId));
  return row ?? null;
}

/** The fact if the caller holds its record, else null (404 upstream, NFR-06). */
export async function getFactForHolder(factId: string, recordIds: string[], db: Executor = getDb()): Promise<FactRow | null> {
  const row = await getFact(factId, db);
  return row && recordIds.includes(row.record_id) ? row : null;
}
