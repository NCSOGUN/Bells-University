// POST /api/view/open {code, name, practice_no}: a clinician opens a patient's code (FR-10, FR-12). ANONYMOUS route.
// Unknown, expired and revoked codes all give the SAME 403 code_not_valid (L12). Too many wrong tries give 429 and
// the code is not even checked (L10). The response never contains record content. The code travels in the body (it
// lives in the URL fragment on the client, so it never reaches a server log).
import { errorResponse, json, parseBody, withErrors } from "@/lib/http";
import { openSchema, openViewer } from "@/lib/share/service";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const body = await parseBody(request, openSchema);
  if (!body.ok) return body.response;
  const result = await openViewer(body.data, request.headers);
  if (!result.ok) return errorResponse(result.code, result.message, result.status, result.headers);
  return json(result.data, 200, { "Set-Cookie": result.setCookie! });
});
