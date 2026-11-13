// GET /api/records/{id}/shares: the patient's shares and their state. Never returns codes or hashes.
import { requireHolder } from "@/lib/auth";
import { denied, isUuid, json, notFound, withErrors, type RouteCtx } from "@/lib/http";
import { can } from "@/lib/policy";
import { listShares } from "@/lib/share/service";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const holder = await requireHolder(request, id);
  if (!holder.ok) return holder.response;
  const d = can(holder.actor, "create_or_revoke_share", { recordId: id });
  if (!d.allowed) return denied(d);
  return json({ shares: await listShares(id) });
});
