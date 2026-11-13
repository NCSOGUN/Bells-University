// C14 hospital link (FR-25, NFR-23; Locked decision L25). The patient links one chosen hospital and gets a
// link reference ("ITN-LNK-" + 8 Crockford base32 characters) to hand to that hospital's records officer once.
// It stays valid until the patient revokes it. Every link and unlink is in the patient's access log.
import QRCode from "qrcode";
import { z } from "zod";
import { writeAccessLog } from "@/lib/audit";
import { withTransaction } from "@/lib/db/client";
import { generateLinkRef } from "@/lib/share/codes";
import * as q from "./queries";

export type Result<T> = { ok: true; status: number; data: T } | { ok: false; status: number; code: string; message: string };
const fail = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });

export const createLinkSchema = z.strictObject({ record_id: z.uuid(), hospital_id: z.uuid() });

export const listHospitals = () => q.listHospitals();

export async function createLink(
  input: z.infer<typeof createLinkSchema>,
  accountId: string,
): Promise<Result<{ link_id: string; link_ref: string; hospital: { id: string; name: string; simulated: boolean }; qr_svg: string; created_at: string }>> {
  const h = await q.findHospital(input.hospital_id);
  if (!h) return fail(400, "hospital_not_found", "That hospital is not available to link.");

  const created = await withTransaction(async (tx) => {
    // 40 random bits: a collision is very unlikely, but retry rather than fail if one happens.
    for (let i = 0; i < 3; i++) {
      const linkRef = generateLinkRef();
      const row = await q.insertLink(tx, { recordId: input.record_id, hospitalId: h.id, linkRef, accountId });
      if (row) {
        await writeAccessLog({ recordId: input.record_id, actorType: "patient", actorLabel: h.name, action: "link_created", outcome: "allowed", linkId: row.id }, tx);
        return { ...row, linkRef };
      }
    }
    throw new Error("link_ref collision");
  });

  const qr_svg = await QRCode.toString(created.linkRef, { type: "svg", margin: 1 });
  return {
    ok: true,
    status: 201,
    data: { link_id: created.id, link_ref: created.linkRef, hospital: h, qr_svg, created_at: created.created_at.toISOString() },
  };
}

/** Idempotent. 404 for a link on a record the caller does not hold (NFR-06). */
export async function revokeLink(linkId: string, recordIds: string[]): Promise<Result<{ revoked: true }>> {
  const l = await q.findLinkWithHospital(linkId);
  if (!l || !recordIds.includes(l.record_id)) return fail(404, "not_found", "Not found.");
  await withTransaction(async (tx) => {
    if (await q.markLinkRevoked(tx, linkId)) {
      await writeAccessLog({ recordId: l.record_id, actorType: "patient", actorLabel: l.hospital_name, action: "link_revoked", outcome: "allowed", linkId }, tx);
    }
  });
  return { ok: true, status: 200, data: { revoked: true } };
}

/** The record a link belongs to, for the policy check in the revoke route. */
export async function linkRecordId(linkId: string): Promise<string | null> {
  return (await q.findLinkWithHospital(linkId))?.record_id ?? null;
}

export async function listLinks(recordId: string) {
  const rows = await q.listLinksForRecord(recordId);
  return rows.map((l) => ({
    id: l.id,
    link_ref: l.link_ref,
    hospital: { id: l.hospital_id, name: l.hospital_name, simulated: l.hospital_simulated },
    created_at: l.created_at.toISOString(),
    revoked_at: l.revoked_at ? l.revoked_at.toISOString() : null,
    status: l.revoked_at ? ("revoked" as const) : ("active" as const),
    deliveries_accepted: l.counts?.accepted ?? 0,
    deliveries_refused: l.counts?.refused ?? 0,
    last_delivery_at: l.counts?.last ? new Date(l.counts.last).toISOString() : null,
  }));
}
