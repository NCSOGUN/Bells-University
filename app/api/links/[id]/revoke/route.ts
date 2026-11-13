// POST /api/links/{id}/revoke: unlink now (C14, FR-25). Idempotent. The hospital's next delivery gets 403.
import { getHolderActor } from "@/lib/auth";
import { denied, errorResponse, isUuid, json, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";
import { linkRecordId, revokeLink } from "@/lib/links/service";
import { can } from "@/lib/policy";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  const recordId = await linkRecordId(id);
  if (!recordId) return notFound();
  // A link on a record the caller does not hold is 404, the same as one that does not exist (NFR-06).
  const d = can(actor, "link_or_unlink_hospital", { recordId });
  if (!d.allowed) return denied(d);
  const result = await revokeLink(id, actor.recordIds);
  return result.ok ? json(result.data, result.status) : errorResponse(result.code, result.message, result.status);
});
