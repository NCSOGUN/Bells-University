// POST /api/facts/{id}/remove: soft delete a wrong AI/patient fact; the event is kept (FR-07). Never provider-entered.
import { loadFactForAction } from "@/lib/facts/route-helpers";
import { transitionFact } from "@/lib/facts/service";
import { errorResponse, json, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const loaded = await loadFactForAction(request, id, "confirm_or_correct_fact");
  if (!loaded.ok) return loaded.response;
  const r = await transitionFact(loaded.fact, loaded.actor.accountId, "remove");
  return r.ok ? json({ removed: true, fact_id: r.data.id }) : errorResponse(r.code, r.message, r.status);
});
