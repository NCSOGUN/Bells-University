// POST /api/shares/{id}/revoke: revoke now (FR-11). Idempotent. The viewer is refused on their very next request.
import { getHolderActor } from "@/lib/auth";
import { denied, errorResponse, isUuid, json, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";
import { can } from "@/lib/policy";
import { revokeShare, shareRecordId } from "@/lib/share/service";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  const recordId = await shareRecordId(id);
  if (!recordId) return notFound();
  // A share on a record the caller does not hold is 404, the same as one that does not exist (NFR-06).
  const d = can(actor, "create_or_revoke_share", { recordId });
  if (!d.allowed) return denied(d);
  const result = await revokeShare(id, actor.recordIds);
  return result.ok ? json(result.data, result.status) : errorResponse(result.code, result.message, result.status);
});
