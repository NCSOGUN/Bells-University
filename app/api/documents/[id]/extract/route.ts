// POST /api/documents/{id}/extract: read the document with the model, guard, store facts (FR-03, FR-04, FR-05).
// Consent gate (NFR-03, L23), atomic claim (L22), no partial writes. Runs inside the request (design section 11).
import { getHolderActor } from "@/lib/auth";
import { extractForDocument, getDocumentForRecord } from "@/lib/documents/service";
import { denied, errorResponse, forbidden, isUuid, json, notFound, unauthenticated, withErrors, type RouteCtx } from "@/lib/http";
import { can } from "@/lib/policy";
import { hasAiConsent } from "@/lib/records";

export const runtime = "nodejs";
export const maxDuration = 120;

export const POST = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  if (!isUuid(id)) return notFound();
  const doc = await getDocumentForRecord(id, actor.recordIds);
  if (!doc) return notFound();

  const d = can(actor, "upload_document", { recordId: doc.record_id });
  if (!d.allowed) return denied(d);
  if (!(await hasAiConsent(actor.accountId))) {
    return forbidden("consent_required", "Please read and accept the AI processing notice before Itan reads a document.");
  }

  const result = await extractForDocument(doc);
  if (!result.ok) return errorResponse(result.code, result.message, result.status);
  const { ms: _ms, ...data } = result.data;
  void _ms;
  return json(data, result.status);
});
