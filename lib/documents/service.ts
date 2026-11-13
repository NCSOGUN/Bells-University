// Document upload, claim and extraction (C06 server side; FR-02 to FR-05, NFR-03, NFR-12).
// Plain functions with injected dependencies; the route files are thin wrappers.
import { and, eq, sql } from "drizzle-orm";
import { MAX_IMAGE_BYTES, MAX_PDF_BYTES } from "@/lib/config";
import { getDb, withTransaction, type Db } from "@/lib/db/client";
import { document, fact, fact_event, type DocumentRow } from "@/lib/db/schema";
import { ExtractionError, extractDocument, type ExtractMime, type ExtractResult } from "@/lib/extract/gemini";
import { applyGuards, type GuardedOutput } from "@/lib/extract/guards";
import { PROMPT_VERSION } from "@/lib/extract/prompt";
import { parseModelOutput } from "@/lib/extract/schema";
import type { FactDTO } from "@/lib/facts/dto";
import { lookupTestKey } from "@/lib/glossary";
import { AI_NOTICE_PATIENT } from "@/lib/notices";
import { listDocumentFacts } from "./queries";
import { storagePath, supabaseStorage, type DocumentStorage } from "@/lib/storage";
import { logEvent } from "@/lib/log";
import { sniffMime } from "./sniff";

export const ALLOWED_MIMES: ExtractMime[] = ["image/jpeg", "image/png", "application/pdf"];

export interface Deps {
  db: Db;
  storage: DocumentStorage;
  extract: (input: { bytes: Uint8Array; mime: ExtractMime }) => Promise<ExtractResult>;
}

export const defaultDeps = (): Deps => ({ db: getDb(), storage: supabaseStorage, extract: extractDocument });

export type ServiceResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string };
const fail = (status: number, code: string, message: string): ServiceResult<never> => ({ ok: false, status, code, message });

// ---------------------------------------------------------------- upload

export async function uploadDocument(
  input: { recordId: string; clientUploadId: string; mime: string; bytes: Uint8Array },
  deps: Deps = defaultDeps(),
): Promise<ServiceResult<{ document_id: string; status: string }>> {
  const { recordId, clientUploadId, mime, bytes } = input;
  if (!ALLOWED_MIMES.includes(mime as ExtractMime)) return fail(400, "unsupported_type", "Only JPEG, PNG and PDF files are accepted.");
  const limit = mime === "application/pdf" ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (bytes.byteLength > limit) {
    const mb = Math.round(limit / 1_048_576);
    return fail(413, "file_too_large", `This file is over the ${mb} MB limit. Try a smaller photo or a lower-resolution scan.`);
  }
  if (bytes.byteLength === 0) return fail(400, "invalid_request", "The file is empty.");
  // The declared type comes from the client; the bytes must agree (R1 S-02).
  if (sniffMime(bytes) !== mime) return fail(400, "unsupported_type", "This file is not a readable JPEG, PNG or PDF.");

  // Idempotent retry (NFR-12): the same client_upload_id returns the same document.
  const [existing] = await deps.db.select().from(document).where(eq(document.client_upload_id, clientUploadId));
  if (existing) {
    if (existing.record_id !== recordId) return fail(409, "client_upload_id_conflict", "This upload id was already used.");
    return { ok: true, status: 200, data: { document_id: existing.id, status: existing.status } };
  }

  const id = crypto.randomUUID();
  const path = storagePath(recordId, id, mime);
  await deps.db.insert(document).values({
    id,
    record_id: recordId,
    client_upload_id: clientUploadId,
    storage_path: path,
    mime,
    byte_size: bytes.byteLength,
    status: "uploaded",
  });
  try {
    await deps.storage.put(path, bytes, mime);
  } catch {
    // Start clean so a retry with the same client_upload_id works.
    await deps.db.delete(document).where(eq(document.id, id));
    return fail(502, "storage_failed", "The file could not be stored. Please try again.");
  }
  return { ok: true, status: 201, data: { document_id: id, status: "uploaded" } };
}

// ---------------------------------------------------------------- read
// The read helpers live in ./queries so read-only routes do not load the Gemini SDK (R1 N-03).
export { documentView, getDocumentForRecord, listDocumentFacts } from "./queries";

// ---------------------------------------------------------------- extraction

/** Atomic claim (Locked decision L22). Returns the claimed row, or null when another extraction holds it. */
async function claim(documentId: string, db: Db): Promise<DocumentRow | null> {
  const rows = await db
    .update(document)
    .set({ status: "extracting", started_at: sql`now()`, error_code: null })
    .where(
      and(
        eq(document.id, documentId),
        sql`(${document.status} in ('uploaded','failed') or (${document.status} = 'extracting' and ${document.started_at} < now() - interval '120 seconds'))`,
      ),
    )
    .returning();
  return rows[0] ?? null;
}

export async function extractForDocument(
  doc: DocumentRow,
  deps: Deps = defaultDeps(),
): Promise<ServiceResult<{ document_id: string; status: "extracted"; facts: FactDTO[]; ai_notice: string; ms?: number }>> {
  const claimed = await claim(doc.id, deps.db);
  if (!claimed) {
    const [fresh] = await deps.db.select().from(document).where(eq(document.id, doc.id));
    if (fresh?.status === "extracted") {
      return { ok: true, status: 200, data: { document_id: doc.id, status: "extracted", facts: await listDocumentFacts(doc.id, deps.db), ai_notice: AI_NOTICE_PATIENT } };
    }
    return fail(409, "extraction_in_progress", "This document is already being read. Try again in a moment.");
  }

  const markFailed = async (errorCode: string) => {
    await deps.db.update(document).set({ status: "failed", error_code: errorCode }).where(eq(document.id, doc.id));
    logEvent("warn", "extraction_failed", { document_id: doc.id, error_code: errorCode });
  };

  let guarded: GuardedOutput;
  let model: string;
  let raw: unknown;
  let ms = 0;
  try {
    const bytes = await deps.storage.get(doc.storage_path);
    const mime = doc.mime as ExtractMime;
    let res = await deps.extract({ bytes, mime });
    let parsed = parseModelOutput(res.raw);
    if (!parsed.ok) {
      // One retry on invalid output, then give up (never a partial write).
      res = await deps.extract({ bytes, mime });
      parsed = parseModelOutput(res.raw);
    }
    if (!parsed.ok) {
      await markFailed("model_output_invalid");
      return fail(502, "extraction_failed", "Itan could not read this document. Try again or add the facts by hand.");
    }
    guarded = applyGuards(parsed.data, { lookupTestKey });
    model = res.model;
    raw = res.raw;
    ms = res.ms;
  } catch (e) {
    await markFailed(e instanceof ExtractionError ? e.code : "extraction_error");
    return fail(502, "extraction_failed", "Itan could not read this document. Try again or add the facts by hand.");
  }

  const facts = await withTransaction(async (tx) => {
    const created: string[] = [];
    const base = {
      record_id: doc.record_id,
      document_id: doc.id,
      origin: "ai_read" as const,
      state: "unverified" as const,
      facility_name: guarded.facility_as_printed,
    };
    for (const it of guarded.items) {
      const [row] = await tx
        .insert(fact)
        .values({
          ...base,
          kind: it.kind,
          label_as_printed: it.label_as_printed,
          test_key: it.test_key,
          value_as_printed: it.value_as_printed,
          value_num: it.value_num,
          unit_as_printed: it.unit_as_printed,
          range_as_printed: it.range_as_printed,
          range_low: it.range_low,
          range_high: it.range_high,
          flag_as_printed: it.flag_as_printed,
          fact_date: it.fact_date,
          fact_date_as_printed: it.fact_date_as_printed,
          unreadable: it.unreadable,
          check_carefully: it.check_carefully,
          confidence: it.confidence,
          source_quote: it.source_quote,
          source_box: it.source_box,
          source_page: it.source_page,
          extra: it.extra,
        })
        .returning({ id: fact.id });
      created.push(row.id);
    }
    // A referral letter also yields one referral-kind fact (Locked decision L21), state unverified.
    const r = guarded.referral;
    if (guarded.doc_type === "referral_letter" && r && (r.reason_as_written || r.urgency_as_written || r.referring_clinician_as_written)) {
      const anchor = r.reason_as_written ?? r.urgency_as_written ?? r.referring_clinician_as_written!;
      const [row] = await tx
        .insert(fact)
        .values({
          ...base,
          kind: "referral",
          label_as_printed: "Referral letter",
          value_as_printed: r.reason_as_written?.text ?? null,
          fact_date_as_printed: r.referral_date_as_written?.text ?? guarded.document_date_as_printed,
          fact_date: guarded.document_date,
          unreadable: false,
          check_carefully: true,
          confidence: "medium",
          source_quote: anchor.source_quote,
          source_box: anchor.source_box,
          source_page: anchor.source_page,
          extra: {
            reason_as_written: r.reason_as_written?.text ?? null,
            urgency_as_written: r.urgency_as_written?.text ?? null,
            urgency_code: null,
            requester: r.referring_clinician_as_written?.text ?? null,
            referral_date_as_written: r.referral_date_as_written?.text ?? null,
          },
        })
        .returning({ id: fact.id });
      created.push(row.id);
    }
    if (created.length) {
      await tx.insert(fact_event).values(created.map((id) => ({ fact_id: id, actor_type: "system", event: "created", after: { state: "unverified" } })));
    }
    await tx
      .update(document)
      .set({
        status: "extracted",
        extracted_at: sql`now()`,
        doc_type: guarded.doc_type,
        model_version: model,
        prompt_version: PROMPT_VERSION,
        raw_extraction: raw,
        facility_as_printed: guarded.facility_as_printed,
        document_date_as_printed: guarded.document_date_as_printed,
        error_code: null,
      })
      .where(eq(document.id, doc.id));
    return listDocumentFacts(doc.id, tx as unknown as Db);
  });

  // Content-free log line (L31): ids, counts and timing only.
  logEvent("warn", "extraction", { document_id: doc.id, facts: facts.length, ms, notes: guarded.notes.length, model });
  return { ok: true, status: 200, data: { document_id: doc.id, status: "extracted", facts, ai_notice: AI_NOTICE_PATIENT, ms } };
}
