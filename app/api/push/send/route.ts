import { MAX_PUSH_BYTES, updatePageUrl, type PushMessage } from "@/lib/push-message";
import { pushSetupProblem, sendToPhones } from "@/lib/push-store";

// POST /api/push/send: sends a visit notification to every subscribed phone.
//
// Body: { update: VisitUpdate } after a nurse submits a visit, or { test: true }
// from the family's settings page. The visit record is passed straight into
// the encrypted push and is not stored or logged here.

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const MAX_BODY_BYTES = 16 * 1024;

const TEST: PushMessage = {
  title: "CareCircle notifications are on",
  body: "This is how visit updates will arrive on this phone. Tap to open CareCircle.",
  tag: "carecircle-test",
  url: "/family/alerts",
};

const text = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);

function messageFor(body: Record<string, unknown>): PushMessage | null {
  if (body.test === true) return TEST;
  const update = (typeof body.update === "object" && body.update !== null ? body.update : null) as Record<string, unknown> | null;
  if (!update) return null;
  const id = text(update.id, 120);
  const title = text(update.title, 120);
  const line = text(update.body, 200);
  if (!id || !title || !line) return null;
  return { title, body: line, tag: `visit-${id}`, url: updatePageUrl(id), record: JSON.stringify(update) };
}

export async function POST(request: Request) {
  const problem = pushSetupProblem();
  if (problem) return Response.json({ error: problem, sent: 0 }, { status: 503, headers });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "That update is too large." }, { status: 413, headers });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "The request was not valid JSON." }, { status: 400, headers });
  }

  const message = messageFor(body);
  if (!message) return Response.json({ error: "Nothing to send." }, { status: 422, headers });

  let payload = JSON.stringify(message);
  let recordIncluded = Boolean(message.record);
  if (new TextEncoder().encode(payload).length > MAX_PUSH_BYTES) {
    // Too big for one push: send the notification alone. The phone then
    // shows the family's dashboard instead of this visit's record.
    payload = JSON.stringify({ ...message, record: undefined });
    recordIncluded = false;
  }

  try {
    const result = await sendToPhones(payload);
    return Response.json({ ...result, recordIncluded, bytes: payload.length }, { headers });
  } catch {
    return Response.json({ error: "The notification couldn't be sent.", sent: 0 }, { status: 502, headers });
  }
}
