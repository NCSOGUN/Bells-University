// GET /api/records: the caller's records (record switcher, home). POST /api/records: create one (FR-01, FR-18).
import { z } from "zod";
import { getAccountId } from "@/lib/auth";
import { json, parseBody, unauthenticated, withErrors } from "@/lib/http";
import { createRecord, ensureAccount, listRecordsForAccount } from "@/lib/records";

export const runtime = "nodejs";

const createSchema = z.strictObject({
  display_name: z.string().trim().min(1).max(80),
  birth_year: z.number().int().min(1900).max(new Date().getFullYear()).nullable().optional(),
  /** false = "I hold this record for someone else" (caregiver, FR-18). */
  is_self: z.boolean(),
});

export const GET = withErrors(async (request: Request) => {
  const accountId = await getAccountId(request);
  if (!accountId) return unauthenticated();
  await ensureAccount(accountId);
  const records = await listRecordsForAccount(accountId);
  return json({
    records: records.map((r) => ({
      id: r.id,
      display_name: r.display_name,
      birth_year: r.birth_year,
      is_self: r.is_self,
      held_by_caregiver: !r.is_self,
      created_at: r.created_at,
    })),
  });
});

export const POST = withErrors(async (request: Request) => {
  const accountId = await getAccountId(request);
  if (!accountId) return unauthenticated();
  const body = await parseBody(request, createSchema);
  if (!body.ok) return body.response;
  await ensureAccount(accountId);
  const { recordId } = await createRecord(accountId, {
    displayName: body.data.display_name,
    birthYear: body.data.birth_year ?? null,
    isSelf: body.data.is_self,
  });
  return json({ record_id: recordId }, 201);
});
