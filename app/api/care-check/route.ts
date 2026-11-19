import { parseCareCheckInput, runCareCheck } from "@/lib/care-check";

// POST /api/care-check
//
// The server side of the Care Check. It receives readings only (no name,
// address or contact detail), validates them, runs the rules and returns the
// result with the rule that fired for each finding. It stores nothing and
// logs no readings. In this prototype the earlier readings travel in the
// request; in the real product the server would read them from the record.

const MAX_BODY_BYTES = 8 * 1024;

const headers = (requestId: string) => ({
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Request-Id": requestId,
});

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const fail = (status: number, errors: string[]) =>
    Response.json({ requestId, errors }, { status, headers: headers(requestId) });

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return fail(415, ["Send the readings as JSON."]);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    return fail(413, ["That request is too large for a care check."]);
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, ["The request was not valid JSON."]);
  }

  const parsed = parseCareCheckInput(body);
  if (!parsed.ok) return fail(422, parsed.errors);

  const result = runCareCheck(parsed.input, "server");
  return Response.json({ requestId, ...result }, { headers: headers(requestId) });
}
