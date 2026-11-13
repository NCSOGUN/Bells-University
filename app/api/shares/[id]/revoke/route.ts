// POST /api/shares/{id}/revoke: revoke now (FR-11). Idempotent. The viewer is refused on their very next request.
import { getHolderActor } from "@/lib/auth";
import { errorResponse, isUuid, json, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";
import { revokeShare } from "@/lib/share/service";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  // revokeShare answers 404 for a share on a record the caller does not hold (NFR-06).
  const result = await revokeShare(id, actor.recordIds);
  return result.ok ? json(result.data, result.status) : errorResponse(result.code, result.message, result.status);
});
