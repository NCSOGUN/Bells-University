// Referral business rules and orchestration (C13 server side; FR-14, FR-19, FR-20, NFR-19).
// Reason and urgency can only be CARRIED from a source fact; no input field, anywhere, sets them (hard rule 7).
import { z } from "zod";
import { writeAccessLog } from "@/lib/audit";
import { getDb, withTransaction, type Db } from "@/lib/db/client";
import { loadRules } from "@/lib/advisory/queries";
import { toFactDTO } from "@/lib/facts/dto";
import { listActiveFacts } from "@/lib/facts/queries";
import { can } from "@/lib/policy";
import { loadRecordHeader } from "@/lib/share/queries";
import { AI_NOTICE_CLINICIAN } from "@/lib/notices";
import { PARTIAL_NOTICE, RECORDED_NOTICE } from "@/lib/share/summary";
import type { ViewerContext } from "@/lib/share/session";
import { buildPacket, type Packet } from "./packet";
import * as q from "./queries";
import { ACK_DISCLAIMER, ACK_NOT_OFFERED, ACK_OFFERED, ackLabel, type AckStatus } from "./wording";

export type Result<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string };
const fail = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });

/** Fields no caller may ever send: they are carried from a source only. */
export const FORBIDDEN_FIELDS = ["reason", "reason_as_written", "urgency", "urgency_as_written", "urgency_code"] as const;

export const createReferralSchema = z.strictObject({
  record_id: z.uuid(),
  source_fact_id: z.uuid().optional(),
  destination_facility_id: z.uuid().optional(),
  referring_clinician_as_written: z.string().trim().min(1).max(200).optional(),
  referral_date_as_written: z.string().trim().min(1).max(50).optional(),
});

/** Parse a create-referral body. A forbidden field gets its own error code before the strict schema runs. */
export function parseReferralBody(body: unknown): { ok: true; data: z.infer<typeof createReferralSchema> } | { ok: false; code: string; message: string } {
  if (body && typeof body === "object") {
    const bad = FORBIDDEN_FIELDS.filter((k) => k in (body as object));
    if (bad.length) return { ok: false, code: "field_not_allowed", message: "Reason and urgency cannot be set here. They are carried from the referring clinician's own record or letter." };
  }
  const r = createReferralSchema.safeParse(body);
  if (!r.success) return { ok: false, code: "invalid_request", message: `Invalid or missing fields: ${[...new Set(r.error.issues.map((i) => i.path.join(".") || "(body)"))].join(", ")}` };
  return { ok: true, data: r.data };
}

const asStr = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

export async function createReferral(accountId: string, input: z.infer<typeof createReferralSchema>, db: Db = getDb()): Promise<Result<{ referral_id: string }>> {
  let source = null;
  if (input.source_fact_id) {
    source = await q.getReferralFactInRecord(input.source_fact_id, input.record_id, db);
    if (!source) return fail(400, "invalid_source", "The source must be a referral in this record.");
  }
  if (input.destination_facility_id && !(await q.facilityExists(input.destination_facility_id, db))) return fail(400, "invalid_destination", "Unknown facility.");

  // The strings below are COPIED from the source fact's own text; no code path writes them from anything else (L21).
  const extra = (source?.extra ?? {}) as Record<string, unknown>;
  const id = await withTransaction((tx) =>
    q.insertReferral(tx, {
      record_id: input.record_id,
      created_by_account_id: accountId,
      destination_facility_id: input.destination_facility_id ?? null,
      source_fact_id: source?.id ?? null,
      reason_as_written: asStr(extra.reason_as_written),
      urgency_as_written: asStr(extra.urgency_as_written),
      urgency_code: asStr(extra.urgency_code),
      referring_clinician_as_written: input.referring_clinician_as_written ?? asStr(extra.requester),
      referral_date_as_written: input.referral_date_as_written ?? asStr(extra.referral_date_as_written) ?? source?.fact_date_as_printed ?? null,
    }),
  );
  return { ok: true, status: 201, data: { referral_id: id } };
}

/** Load everything and build the packet. `share` set means "as a clinician sees it" (hidden items removed). */
async function packetFor(referralRow: q.ReferralRow, share: ViewerContext["share"] | undefined, db: Db): Promise<Packet | null> {
  const record = await loadRecordHeader(referralRow.record_id, db);
  if (!record) return null;
  const [facts, sourceRow, destinationName, advisoryRules] = await Promise.all([
    listActiveFacts(referralRow.record_id, db),
    q.getFactById(referralRow.source_fact_id, db),
    q.facilityName(referralRow.destination_facility_id, db),
    loadRules(db),
  ]);
  return buildPacket({
    record,
    referral: referralRow,
    destinationName,
    sourceFact: sourceRow && sourceRow.record_id === referralRow.record_id ? toFactDTO(sourceRow) : null,
    facts,
    advisoryRules,
    share: share ? { hiddenCategories: share.hiddenCategories, hiddenDocumentIds: share.hiddenDocumentIds } : undefined,
  });
}

export async function getReferralForHolder(id: string, recordIds: string[], db: Db = getDb()) {
  const row = await q.getReferral(id, db);
  if (!row || !recordIds.includes(row.record_id)) return null;
  const [packet, acks] = await Promise.all([packetFor(row, undefined, db), q.listAcks(row.id, db)]);
  return {
    referral: {
      id: row.id,
      record_id: row.record_id,
      source_fact_id: row.source_fact_id,
      destination_facility_id: row.destination_facility_id,
      referring_clinician_as_written: row.referring_clinician_as_written,
      referral_date_as_written: row.referral_date_as_written,
      created_at: row.created_at,
    },
    packet,
    acknowledgements: acks.map((a) => ({ status: a.status, label: ackLabel(a.status as AckStatus), at: a.at, viewer_name: a.viewer_name })),
    disclaimer: ACK_DISCLAIMER,
  };
}

/** For Dev A's /v/referral page. Null unless this is a referral share. */
export async function getReferralPacketForViewer(ctx: ViewerContext, db: Db = getDb()) {
  if (ctx.purpose !== "referral" || !ctx.share.referralId) return null;
  const row = await q.getReferral(ctx.share.referralId, db);
  if (!row || row.record_id !== ctx.recordId) return null;
  const [packet, acks] = await Promise.all([packetFor(row, ctx.share, db), q.listAcks(row.id, db)]);
  if (!packet) return null;
  const mine = acks.find((a) => a.viewer_name === ctx.viewer.name && a.practice_no === ctx.viewer.practiceNo);
  return {
    packet,
    viewer: { name: ctx.viewer.name, practice_no: ctx.viewer.practiceNo },
    recorded_notice: RECORDED_NOTICE,
    partial_notice: ctx.share.hiddenCategories.length || ctx.share.hiddenDocumentIds.length ? PARTIAL_NOTICE : null,
    ai_notice: AI_NOTICE_CLINICIAN,
    current_acknowledgement: mine ? { status: mine.status, label: ackLabel(mine.status as AckStatus), at: mine.at } : null,
    ack_labels: { service_offered: ACK_OFFERED, service_not_offered: ACK_NOT_OFFERED },
    disclaimer: ACK_DISCLAIMER,
    expires_at: ctx.share.expiresAt.toISOString(),
  };
}

export const ackSchema = z.strictObject({ status: z.enum(["service_offered", "service_not_offered"]) });

/** POST /api/view/ack. Only a clinician on a referral share (checked by can()). */
export async function acknowledge(ctx: ViewerContext, status: AckStatus): Promise<Result<{ label: string; disclaimer: string }>> {
  const d = can(ctx.actor, "acknowledge_referral", { recordId: ctx.recordId });
  if (!d.allowed) return fail(403, "forbidden", "This code does not allow acknowledging a referral.");
  if (!ctx.share.referralId) return fail(403, "forbidden", "This code does not allow acknowledging a referral.");
  await withTransaction(async (tx) => {
    await q.insertAck(tx, { referralId: ctx.share.referralId!, viewerSessionId: ctx.viewer.sessionId, status });
    await writeAccessLog(
      {
        recordId: ctx.recordId,
        actorType: "clinician",
        actorLabel: `${ctx.viewer.name} · ${ctx.viewer.practiceNo} (unverified)`,
        action: "referral_acknowledged",
        outcome: "allowed",
        reason: status,
        shareId: ctx.share.id,
      },
      tx,
    );
  });
  return { ok: true, status: 200, data: { label: ackLabel(status), disclaimer: ACK_DISCLAIMER } };
}
