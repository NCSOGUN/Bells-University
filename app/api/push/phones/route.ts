import { parseSubscription, phoneCount, pushSetupProblem, removePhone, savePhone } from "@/lib/push-store";

// /api/push/phones: the phones that get visit notifications.
// GET says whether notifications are set up and how many phones are on.
// POST adds this phone's push subscription; DELETE removes it.
// Only push addresses are stored, never a name, number or reading.

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const MAX_BODY_BYTES = 4 * 1024;

export async function GET() {
  const problem = pushSetupProblem();
  if (problem) return Response.json({ ready: false, problem, phones: 0 }, { headers });
  try {
    return Response.json({ ready: true, phones: await phoneCount() }, { headers });
  } catch {
    return Response.json({ ready: false, problem: "The server couldn't reach its store.", phones: 0 }, { headers });
  }
}

async function readSubscription(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return null;
  try {
    return parseSubscription(JSON.parse(text));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const problem = pushSetupProblem();
  if (problem) return Response.json({ error: problem }, { status: 503, headers });
  const sub = await readSubscription(request);
  if (!sub) return Response.json({ error: "That isn't a push subscription." }, { status: 422, headers });
  try {
    await savePhone(sub);
    return Response.json({ ok: true, phones: await phoneCount() }, { headers });
  } catch {
    return Response.json({ error: "The server couldn't save this phone." }, { status: 502, headers });
  }
}

export async function DELETE(request: Request) {
  const sub = await readSubscription(request);
  if (!sub) return Response.json({ error: "That isn't a push subscription." }, { status: 422, headers });
  try {
    await removePhone(sub.endpoint);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ error: "The server couldn't remove this phone." }, { status: 502, headers });
  }
}
