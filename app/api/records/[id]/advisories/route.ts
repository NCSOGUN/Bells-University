// GET /api/records/{id}/advisories: non-blocking drug-allergy flags (FR-17, NFR-21). `validated` is always false.
import { requireHolder } from "@/lib/auth";
import { getAdvisories } from "@/lib/advisory/service";
import { denied, isUuid, json, notFound, withErrors, type RouteCtx } from "@/lib/http";
import { can } from "@/lib/policy";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const holder = await requireHolder(request, id);
  if (!holder.ok) return holder.response;
  const d = can(holder.actor, "see_whole_record", { recordId: id });
  if (!d.allowed) return denied(d);
  return json(await getAdvisories(id));
});
