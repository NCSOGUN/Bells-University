// POST /api/facts/{id}/category {sensitive_category}: the patient's privacy tag (FR-15). Any origin: it is not an
// edit of clinical content (docs/DEVIATIONS.md D-011). One category or null.
import { z } from "zod";
import { sensitiveCategorySchema } from "@/lib/categories";
import { loadFactForAction } from "@/lib/facts/route-helpers";
import { tagCategory } from "@/lib/facts/service";
import { errorResponse, json, parseBody, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.strictObject({ sensitive_category: sensitiveCategorySchema.nullable() });

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const loaded = await loadFactForAction(request, id, "tag_sensitive_category");
  if (!loaded.ok) return loaded.response;
  const body = await parseBody(request, schema);
  if (!body.ok) return body.response;
  const r = await tagCategory(loaded.fact, loaded.actor.accountId, body.data.sensitive_category);
  return r.ok ? json({ fact: r.data }) : errorResponse(r.code, r.message, r.status);
});
