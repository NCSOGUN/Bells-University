// POST /api/view/ack {status}: a clinician on a REFERRAL share acknowledges "received, service offered here".
// Never a statement about beds (FR-19, Stage 1 Decision 2). Simulated in this version.
import { acknowledge, ackSchema } from "@/lib/referral/service";
import { errorResponse, json, parseBody, withErrors } from "@/lib/http";
import { getViewerFromRequest } from "@/lib/share/service";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const viewer = await getViewerFromRequest(request);
  if (!viewer.ok) return errorResponse(viewer.reason, "This access is no longer valid.", 403);
  const body = await parseBody(request, ackSchema);
  if (!body.ok) return body.response;
  const r = await acknowledge(viewer, body.data.status);
  return r.ok ? json(r.data, r.status) : errorResponse(r.code, r.message, r.status);
});
