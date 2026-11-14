// POST /api/links: link one chosen hospital to a record and get a link reference (C14, FR-25, L25).
import { getHolderActor, requireStepUp } from "@/lib/auth";
import { denied, errorResponse, json, parseBody, unauthenticated, withErrors } from "@/lib/http";
import { createLink, createLinkSchema } from "@/lib/links/service";
import { can } from "@/lib/policy";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  const body = await parseBody(request, createLinkSchema);
  if (!body.ok) return body.response;
  const d = can(actor, "link_or_unlink_hospital", { recordId: body.data.record_id });
  if (!d.allowed) return denied(d);
  const stepUp = await requireStepUp(request); // FR-28: enrolled accounts must have passed the authenticator code
  if (stepUp) return stepUp;
  const result = await createLink(body.data, actor.accountId);
  return result.ok ? json(result.data, result.status) : errorResponse(result.code, result.message, result.status);
});
