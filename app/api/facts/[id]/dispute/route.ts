// POST /api/facts/{id}/dispute {note} and DELETE (withdraw). Provider-entered facts only (FR-27, NFR-24).
// A dispute is a state change plus an event carrying the patient's note; the hospital's content is untouched.
import { z } from "zod";
import { loadFactForAction } from "@/lib/facts/route-helpers";
import { transitionFact } from "@/lib/facts/service";
import { errorResponse, json, parseBody, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

const disputeSchema = z.strictObject({ note: z.string().trim().min(1).max(500) });

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const loaded = await loadFactForAction(request, id, "dispute_fact");
  if (!loaded.ok) return loaded.response;
  const body = await parseBody(request, disputeSchema);
  if (!body.ok) return body.response;
  const r = await transitionFact(loaded.fact, loaded.actor.accountId, "dispute", body.data.note);
  return r.ok ? json({ fact: r.data }) : errorResponse(r.code, r.message, r.status);
});

export const DELETE = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const loaded = await loadFactForAction(request, id, "dispute_fact");
  if (!loaded.ok) return loaded.response;
  const r = await transitionFact(loaded.fact, loaded.actor.accountId, "withdraw_dispute");
  return r.ok ? json({ fact: r.data }) : errorResponse(r.code, r.message, r.status);
});
