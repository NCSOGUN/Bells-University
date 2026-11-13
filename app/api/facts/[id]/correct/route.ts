// POST /api/facts/{id}/correct: edit printed fields; the original reading stays in fact_event (FR-07).
// Provider-entered facts are never editable (403 provider_entered_immutable, NFR-24).
import { correctionSchema } from "@/lib/facts/correct";
import { loadFactForAction } from "@/lib/facts/route-helpers";
import { correctFact } from "@/lib/facts/service";
import { errorResponse, json, parseBody, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const loaded = await loadFactForAction(request, id, "confirm_or_correct_fact");
  if (!loaded.ok) return loaded.response;
  const body = await parseBody(request, correctionSchema);
  if (!body.ok) return body.response;
  const r = await correctFact(loaded.fact, loaded.actor.accountId, body.data);
  return r.ok ? json({ fact: r.data }) : errorResponse(r.code, r.message, r.status);
});
