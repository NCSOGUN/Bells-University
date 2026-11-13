// Document reads (C06 server side; FR-03, FR-05). SQL only, no model or storage client, so the read-only
// routes (GET /api/documents/{id}, /image) stay light at cold start (R1 N-03).
import { and, eq, isNull } from "drizzle-orm";
import { getDb, type Db } from "@/lib/db/client";
import { document, fact, type DocumentRow } from "@/lib/db/schema";
import { toFactDTO, type FactDTO } from "@/lib/facts/dto";
import { AI_NOTICE_PATIENT } from "@/lib/notices";

export async function getDocumentForRecord(documentId: string, recordIds: string[], db: Db = getDb()): Promise<DocumentRow | null> {
  const [row] = await db.select().from(document).where(eq(document.id, documentId));
  return row && recordIds.includes(row.record_id) ? row : null;
}

export async function listDocumentFacts(documentId: string, db: Db = getDb()): Promise<FactDTO[]> {
  const rows = await db
    .select()
    .from(fact)
    .where(and(eq(fact.document_id, documentId), isNull(fact.removed_at)))
    .orderBy(fact.source_page, fact.created_at);
  return rows.map(toFactDTO);
}

export function documentView(d: DocumentRow, facts: FactDTO[]) {
  return {
    document_id: d.id,
    status: d.status,
    error_code: d.error_code,
    doc_type: d.doc_type,
    mime: d.mime,
    uploaded_at: d.uploaded_at,
    extracted_at: d.extracted_at,
    facility_as_printed: d.facility_as_printed,
    document_date_as_printed: d.document_date_as_printed,
    facts,
    ai_notice: AI_NOTICE_PATIENT, // NFR-13
  };
}
