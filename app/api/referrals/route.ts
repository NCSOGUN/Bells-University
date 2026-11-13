// POST /api/referrals: the patient builds a referral from a source (FR-14, FR-20).
// Reason and urgency cannot be sent: any such field is rejected 400 field_not_allowed. They are carried from the
// referral fact the patient points to (a hospital's ServiceRequest or a confirmed photographed letter).
import { getHolderActor } from "@/lib/auth";
import { denied, errorResponse, json, unauthenticated, withErrors } from "@/lib/http";
import { can } from "@/lib/policy";
import { createReferral, parseReferralBody } from "@/lib/referral/service";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("invalid_request", "The request body must be JSON.", 400);
  }
  const parsed = parseReferralBody(raw);
  if (!parsed.ok) return errorResponse(parsed.code, parsed.message, 400);
  // Building a referral is a patient act on their own record (same permission as creating a share).
  const d = can(actor, "create_or_revoke_share", { recordId: parsed.data.record_id });
  if (!d.allowed) return denied(d);
  const r = await createReferral(actor.accountId, parsed.data);
  return r.ok ? json(r.data, r.status) : errorResponse(r.code, r.message, r.status);
});
