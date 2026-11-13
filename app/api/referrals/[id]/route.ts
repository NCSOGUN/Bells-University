// GET /api/referrals/{id}: preview the packet, acknowledgements and the disclaimer (FR-14, FR-19).
import { getHolderActor } from "@/lib/auth";
import { denied, isUuid, json, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";
import { can } from "@/lib/policy";
import { getReferralForHolder, referralRecordId } from "@/lib/referral/service";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  const recordId = await referralRecordId(id);
  if (!recordId) return notFound();
  // A referral on a record the caller does not hold is 404 (NFR-06).
  const d = can(actor, "see_whole_record", { recordId });
  if (!d.allowed) return denied(d);
  const data = await getReferralForHolder(id, actor.recordIds);
  return data ? json(data) : notFound();
});
