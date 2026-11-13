// GET /api/records/{id}/access-log?limit=: who saw what, and refusals, newest first (FR-13). Holder only.
import { requireHolder } from "@/lib/auth";
import { denied, isUuid, json, notFound, withErrors, type RouteCtx } from "@/lib/http";
import { can } from "@/lib/policy";
import { readAccessLog } from "@/lib/share/service";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  if (!isUuid(id)) return notFound();
  const holder = await requireHolder(request, id);
  if (!holder.ok) return holder.response;
  const d = can(holder.actor, "read_access_log", { recordId: id });
  if (!d.allowed) return denied(d);
  const raw = Number(new URL(request.url).searchParams.get("limit") ?? 100);
  const limit = Number.isInteger(raw) && raw > 0 ? Math.min(raw, 200) : 100;
  return json({ entries: await readAccessLog(id, limit) });
});
