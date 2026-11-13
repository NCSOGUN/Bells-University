// Structured, content-free log lines (R1 S-09, Locked decision L31). One JSON object per line, so Vercel's log
// search can filter on `event`, `route` and `request_id`. Fields are primitives only: pass ids, statuses, counts
// and error codes. NEVER pass document text, model output, share codes, viewer tokens, keys or bodies.
type Field = string | number | boolean | null | undefined;

export function logEvent(level: "warn" | "error", event: string, fields: Record<string, Field> = {}): void {
  const line = JSON.stringify({ event, ...fields });
  if (level === "error") console.error(line);
  else console.warn(line);
}

/** The route path (no query string, no fragment) and a request id: Vercel's `x-vercel-id` when present. */
export function requestContext(request: Request): { route: string; request_id: string } {
  let route = "(unknown)";
  try {
    route = new URL(request.url).pathname;
  } catch {
    // keep "(unknown)"
  }
  return { route, request_id: request.headers.get("x-vercel-id") ?? crypto.randomUUID() };
}
