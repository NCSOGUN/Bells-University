// What travels in a Web Push message from the server to the family's phone.
// Shared by the send route and the browser code, so it imports nothing.
//
// The service worker shows `title` and `body` (status and one line, never a
// reading). `record` is the submitted visit, encrypted end to end by Web Push;
// the service worker keeps it on the phone until the family signs in. The
// server passes it through and stores none of it.

export interface PushMessage {
  title: string;
  body: string;
  /** Same tag replaces an earlier notification for the same visit. */
  tag: string;
  /** Where tapping the notification goes. */
  url: string;
  /** The VisitUpdate, as JSON. Left out when it would not fit in one push. */
  record?: string;
}

/** Web Push allows about 4 KB once encrypted; keep well under that. */
export const MAX_PUSH_BYTES = 3600;

/** The page a tapped notification opens, carrying the update's id. */
export function updatePageUrl(updateId?: string): string {
  return updateId ? `/family/update?u=${encodeURIComponent(updateId)}` : "/family/update";
}

/** Where the service worker keeps a record until the page reads it. */
export const RECORD_CACHE = "carecircle-visit-records";
export const recordCacheKey = (updateId: string) => `/__visit-record/${encodeURIComponent(updateId)}`;
