// GET /v/facts/{id}/image: a clinician opens the source image of one shared fact (FR-05, NFR-16).
// Re-checks the share on every request, refuses hidden facts as if they did not exist, logs the view, and redirects
// to a 60-second signed URL of the private file.
import { errorResponse, isUuid, notFound, withErrors, type RouteCtx } from "@/lib/http";
import { getSharedFactImageUrl, getViewerFromRequest } from "@/lib/share/service";

export const runtime = "nodejs";

export const GET = withErrors(async (request: Request, ctx: RouteCtx<{ id: string }>) => {
  const { id } = await ctx.params;
  const viewer = await getViewerFromRequest(request);
  if (!viewer.ok) return errorResponse(viewer.reason, "This access is no longer valid.", 403);
  if (!isUuid(id)) return notFound();
  const result = await getSharedFactImageUrl(viewer, id);
  if (!result.ok) return errorResponse(result.code, result.message, result.status);
  return new Response(null, { status: 302, headers: { Location: result.data.url, "Cache-Control": "no-store" } });
});
