// C15: wires the real database into the feed intake. Routes call these two functions and nothing else.
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

/** POST /api/feed/v1/bundles. */
export async function handleFeedPost(request: Request): Promise<Response> {
  return toResponse(await processFeedRequest(request, deps));
}

/** Any other method on any path under /api/feed: 405 Allow: POST. */
export async function handleFeedReadAttempt(request: Request): Promise<Response> {
  const r = await processFeedReadAttempt(deps);
  return toResponse(request.method === "HEAD" ? { ...r, body: null } : r);
}
