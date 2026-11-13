// POST /api/facts/{id}/confirm: unverified -> confirmed (FR-06).
import { loadFactForAction } from "@/lib/facts/route-helpers";
import { transitionFact } from "@/lib/facts/service";
import { errorResponse, json, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const loaded = await loadFactForAction(request, id, "confirm_or_correct_fact");
  if (!loaded.ok) return loaded.response;
  const r = await transitionFact(loaded.fact, loaded.actor.accountId, "confirm");
  return r.ok ? json({ fact: r.data }) : errorResponse(r.code, r.message, r.status);
});
