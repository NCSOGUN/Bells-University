// Shared HTTP glue for the fact routes: identity, holder check (404 if not held, NFR-06), then can().
// The routes stay thin; business rules live in service.ts / lifecycle.ts / policy.ts.
import { getHolderActor } from "@/lib/auth";
import type { FactRow } from "@/lib/db/schema";
import { denied, isUuid, notFound, unauthenticated } from "@/lib/http";
import { can, type Action, type Actor } from "@/lib/policy";
import { getFactForHolder } from "./queries";

type Holder = Extract<Actor, { kind: "holder" }>;

export async function loadFactForAction(
  request: Request,
  factId: string,
  action: Action,
): Promise<{ ok: true; actor: Holder; fact: FactRow } | { ok: false; response: Response }> {
  const actor = await getHolderActor(request);
  if (!actor) return { ok: false, response: unauthenticated() };
  if (!isUuid(factId)) return { ok: false, response: notFound() };
  const fact = await getFactForHolder(factId, actor.recordIds);
  if (!fact) return { ok: false, response: notFound() };
  const d = can(actor, action, {
    recordId: fact.record_id,
    fact: { origin: fact.origin as "ai_read" | "patient_added" | "provider_entered", sensitiveCategory: fact.sensitive_category, documentId: fact.document_id },
  });
  if (!d.allowed) return { ok: false, response: denied(d) };
  return { ok: true, actor, fact };
}
