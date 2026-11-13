// C15: wires the real database into the feed intake. Routes call these two functions and nothing else.
import { logEvent, requestContext } from "@/lib/log";
import { processFeedReadAttempt, processFeedRequest, type FeedDeps, type FeedResult } from "./intake";
import * as q from "./queries";

const deps: FeedDeps = {
  findCredentialByKeyHash: (h) => q.findCredentialByKeyHash(h),
  findLinkByRef: (r) => q.findLinkByRef(r),
  findAcceptedReceipt: (h, k) => q.findAcceptedReceipt(h, k),
  recordRefusal: (r) => q.recordRefusal(r),
  writeAccepted: (w) => q.writeAccepted(w),
};

export function toResponse(r: FeedResult): Response {
  // HEAD responses must not carry a body.
  return new Response(r.body === null ? null : JSON.stringify(r.body), {
    status: r.status,
    headers: { "Content-Type": "application/json", ...r.headers },
  });
}

/** One content-free line per delivery attempt (R1 S-09): status, the refusal code or the receipt id. */
function logDelivery(request: Request, r: FeedResult): void {
  const b = (r.body ?? {}) as { error?: { code?: string }; receipt_id?: string; facts_created?: number; replayed?: boolean };
  logEvent("warn", "feed_delivery", {
    ...requestContext(request),
    method: request.method,
    status: r.status,
    error_code: b.error?.code ?? null,
    receipt_id: b.receipt_id ?? null,
    facts_created: b.facts_created ?? null,
    replayed: b.replayed ?? false,
  });
}

/** POST /api/feed/v1/bundles. */
export async function handleFeedPost(request: Request): Promise<Response> {
  const r = await processFeedRequest(request, deps);
  logDelivery(request, r);
  return toResponse(r);
}

/** Any other method on any path under /api/feed: 405 Allow: POST. */
export async function handleFeedReadAttempt(request: Request): Promise<Response> {
  const r = await processFeedReadAttempt(deps);
  logDelivery(request, r);
  return toResponse(request.method === "HEAD" ? { ...r, body: null } : r);
}
