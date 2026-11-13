// Every method on every other path under /api/feed is 405 with Allow: POST (C15, NFR-22).
// There is nothing to read through the feed, so a probe learns nothing.
import { handleFeedReadAttempt } from "@/lib/feed/service";
import { withErrors } from "@/lib/http";

export const runtime = "nodejs";

const notAllowed = withErrors(async (request: Request) => handleFeedReadAttempt(request));
export const GET = notAllowed;
export const POST = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const HEAD = notAllowed;
export const OPTIONS = notAllowed;
