// POST /api/feed/v1/bundles: the WRITE-ONLY partner feed (C15; FR-26, FR-27, NFR-22). No read route exists:
// every other method here is 405 with Allow: POST. The logic is in lib/feed/intake.ts.
import { handleFeedPost, handleFeedReadAttempt } from "@/lib/feed/service";
import { withErrors } from "@/lib/http";

export const runtime = "nodejs";

export const POST = withErrors(async (request: Request) => handleFeedPost(request));

const notAllowed = withErrors(async (request: Request) => handleFeedReadAttempt(request));
export const GET = notAllowed;
export const PUT = notAllowed;
export const PATCH = notAllowed;
export const DELETE = notAllowed;
export const HEAD = notAllowed;
export const OPTIONS = notAllowed;
