// GET /api/referrals/{id}: preview the packet, acknowledgements and the disclaimer (FR-14, FR-19).
import { getHolderActor } from "@/lib/auth";
import { isUuid, json, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";
import { getReferralForHolder } from "@/lib/referral/service";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  const data = await getReferralForHolder(id, actor.recordIds);
  return data ? json(data) : notFound();
});
