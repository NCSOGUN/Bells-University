// GET /api/documents/{id}: status and facts (FR-03). What the app polls after a dropped connection.
import { getHolderActor } from "@/lib/auth";
import { documentView, getDocumentForRecord, listDocumentFacts } from "@/lib/documents/service";
import { isUuid, json, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  const doc = await getDocumentForRecord(id, actor.recordIds);
  if (!doc) return notFound();
  return json(documentView(doc, await listDocumentFacts(doc.id)));
});
