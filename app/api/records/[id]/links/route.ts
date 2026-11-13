// GET /api/records/{id}/links: the patient's hospital links and their deliveries (C14, FR-25, NFR-23).
import { requireHolder } from "@/lib/auth";
import { denied, isUuid, json, notFound, withErrors, type RouteCtx } from "@/lib/http";
import { listLinks } from "@/lib/links/service";
import { can } from "@/lib/policy";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const holder = await requireHolder(request, id);
  if (!holder.ok) return holder.response;
  const d = can(holder.actor, "link_or_unlink_hospital", { recordId: id });
  if (!d.allowed) return denied(d);
  return json({ links: await listLinks(id) });
});
