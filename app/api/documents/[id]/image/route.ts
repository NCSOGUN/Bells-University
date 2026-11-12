// GET /api/documents/{id}/image: 302 to a 60-second signed URL of the private file (FR-05, L14).
import { getHolderActor } from "@/lib/auth";
import { getDocumentForRecord } from "@/lib/documents/service";
import { denied, isUuid, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";
import { can } from "@/lib/policy";
import { supabaseStorage } from "@/lib/storage";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  const doc = await getDocumentForRecord(id, actor.recordIds);
  if (!doc) return notFound();
  const d = can(actor, "see_source_image", { recordId: doc.record_id });
  if (!d.allowed) return denied(d);
  const url = await supabaseStorage.signedUrl(doc.storage_path);
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "no-store" } });
});
