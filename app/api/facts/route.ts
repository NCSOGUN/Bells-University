// POST /api/facts: the patient adds a fact by hand (patient_added, created confirmed). FR-07.
import { getHolderActor } from "@/lib/auth";
import { addFact, addFactSchema } from "@/lib/facts/service";
import { denied, json, parseBody, unauthenticated, withErrors } from "@/lib/http";
import { can } from "@/lib/policy";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => {
  const actor = await getHolderActor(request);
  if (!actor) return unauthenticated();
  const body = await parseBody(request, addFactSchema);
  if (!body.ok) return body.response;
  const d = can(actor, "confirm_or_correct_fact", { recordId: body.data.record_id });
  if (!d.allowed) return denied(d);
  return json({ fact: await addFact(actor.accountId, body.data) }, 201);
});
