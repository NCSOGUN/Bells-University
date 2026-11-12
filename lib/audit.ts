// C12 audit writer (FR-13, NFR-23, NFR-24). APPEND-ONLY: this module only inserts.
// There is no update or delete function for access_log anywhere in the codebase (tests/static.test.ts, P12).
// Never pass secrets, codes, tokens, keys or document text in any field (L31).
import { getDb, type Executor } from "./db/client";
import { access_log, fact_event } from "./db/schema";

export type ActorType = "patient" | "clinician" | "partner" | "system";

export interface AccessLogEntry {
  recordId: string;
  actorType: ActorType;
  /** "patient", "<viewer name> · <practice no> (unverified)", or a hospital name. */
  actorLabel: string;
  /** e.g. share_created, share_revoked, viewer_opened, viewer_open_refused, viewer_image_viewed,
   *  referral_acknowledged, link_created, link_revoked, feed_delivery_accepted, feed_delivery_refused */
  action: string;
  outcome: "allowed" | "refused";
  reason?: string | null;
  shareId?: string | null;
  linkId?: string | null;
  factId?: string | null;
}

export async function writeAccessLog(e: AccessLogEntry, db: Executor = getDb()): Promise<void> {
  await db.insert(access_log).values({
    record_id: e.recordId,
    actor_type: e.actorType,
    actor_label: e.actorLabel,
    action: e.action,
    outcome: e.outcome,
    reason: e.reason ?? null,
    share_id: e.shareId ?? null,
    link_id: e.linkId ?? null,
    fact_id: e.factId ?? null,
  });
}

export interface FactEventEntry {
  factId: string;
  actorType: "system" | "patient" | "partner";
  actorAccountId?: string | null;
  /** created, confirmed, corrected, removed, disputed, dispute_withdrawn, category_tagged, superseded */
  event: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  note?: string | null;
}

export async function writeFactEvent(e: FactEventEntry, db: Executor = getDb()): Promise<void> {
  await db.insert(fact_event).values({
    fact_id: e.factId,
    actor_type: e.actorType,
    actor_account_id: e.actorAccountId ?? null,
    event: e.event,
    before: e.before ?? null,
    after: e.after ?? null,
    note: e.note ?? null,
  });
}
