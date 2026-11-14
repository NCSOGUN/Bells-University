// POST /api/shares: create a share code (FR-10, FR-15). The code is returned ONCE and never again.
import { getHolderActor, requireStepUp } from "@/lib/auth";
import { denied, errorResponse, json, parseBody, unauthenticated, withErrors } from "@/lib/http";
import { can } from "@/lib/policy";
import { createShare, createShareSchema } from "@/lib/share/service";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  const body = await parseBody(request, createShareSchema);
  if (!body.ok) return body.response;
  const d = can(actor, "create_or_revoke_share", { recordId: body.data.record_id });
  if (!d.allowed) return denied(d);
  const stepUp = await requireStepUp(request); // FR-28: enrolled accounts must have passed the authenticator code
  if (stepUp) return stepUp;
  const result = await createShare(body.data, new URL(request.url).origin);
  return result.ok ? json(result.data, result.status) : errorResponse(result.code, result.message, result.status);
});
