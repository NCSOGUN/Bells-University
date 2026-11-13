// GET /api/facts/{id}/explanation: deterministic plain-language explanation of one lab fact (FR-09).
// No model is called. Compares the value with the range printed on the same document only (NFR-17).
import { explainFact } from "@/lib/explain/engine";
import { loadFactForAction } from "@/lib/facts/route-helpers";
import { toFactDTO } from "@/lib/facts/dto";
import { getGlossaryRow } from "@/lib/glossary";
import { errorResponse, json, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const loaded = await loadFactForAction(request, id, "see_whole_record");
  if (!loaded.ok) return loaded.response;
  const dto = toFactDTO(loaded.fact);
  if (dto.kind !== "lab") return errorResponse("not_explainable", "Only lab results can be explained.", 400);
  return json(explainFact(dto, getGlossaryRow(dto.test_key)));
});
