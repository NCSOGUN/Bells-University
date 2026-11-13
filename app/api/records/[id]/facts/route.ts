// GET /api/records/{id}/facts: the timeline (FR-08, FR-24). Active facts only, newest fact_date first,
// null dates last. Labs with a test_key carry `previous` (last-value comparison, no direction wording).
import { requireHolder } from "@/lib/auth";
import { attachPrevious } from "@/lib/facts/compare";
import { listActiveFacts, listRecordDocuments } from "@/lib/facts/queries";
import { can } from "@/lib/policy";
import { denied, isUuid, json, notFound, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const holder = await requireHolder(request, id);
  if (!holder.ok) return holder.response;
  const d = can(holder.actor, "see_whole_record", { recordId: id });
  if (!d.allowed) return denied(d);
  const [facts, documents] = await Promise.all([listActiveFacts(id), listRecordDocuments(id)]);
  return json({ facts: attachPrevious(facts), documents });
});
