// `npm run smoke`: end-to-end checks against a running server (BASE_URL, default http://localhost:3000).
// Signs in the demo user, uploads a synthetic document, extracts it and checks the facts. P8 and P12 extend it.
// Needs .env.local and a seeded database. Never prints tokens, codes or document contents.
import "./load-env";
import { readFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
};

async function signIn(): Promise<string> {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, DEMO_PASSWORD } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !DEMO_PASSWORD) throw new Error("SUPABASE_URL, SUPABASE_ANON_KEY and DEMO_PASSWORD must be set");
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: "demo@itan.example", password: DEMO_PASSWORD }),
  });
  if (!r.ok) throw new Error(`demo sign-in failed (${r.status}); run npm run db:seed:demo`);
  return (await r.json()).access_token as string;
}

async function main() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  check("health", !!health?.ok, `region ${health?.region}`);
  if (!health) throw new Error(`no server at ${BASE}`);

  const anon = await fetch(`${BASE}/api/records`);
  check("GET /api/records without auth is 401", anon.status === 401);

  const token = await signIn();
  const H = { authorization: `Bearer ${token}` };
  const recs = await fetch(`${BASE}/api/records`, { headers: H }).then((r) => r.json());
  const recordId: string | undefined = recs.records?.[0]?.id;
  check("demo record listed", !!recordId);
  if (!recordId) throw new Error("no demo record");

  const consent = await fetch(`${BASE}/api/consent`, { method: "POST", headers: H });
  check("POST /api/consent", consent.status === 200);

  const file = process.env.SMOKE_FILE ?? path.join("scratch", "tiny.pdf");
  let bytes: Buffer;
  try {
    bytes = readFileSync(file);
  } catch {
    console.log(`SKIP  upload/extract (no file at ${file}; set SMOKE_FILE to a synthetic PDF or image)`);
    return;
  }
  const mime = file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".png") ? "image/png" : "image/jpeg";
  const clientUploadId = crypto.randomUUID();
  const form = () => {
    const f = new FormData();
    f.set("record_id", recordId);
    f.set("client_upload_id", clientUploadId);
    f.set("file", new Blob([bytes], { type: mime }), path.basename(file));
    return f;
  };
  const up1 = await fetch(`${BASE}/api/documents`, { method: "POST", headers: H, body: form() });
  const d1 = await up1.json();
  check("POST /api/documents 201", up1.status === 201, `document ${d1.document_id}`);
  const up2 = await fetch(`${BASE}/api/documents`, { method: "POST", headers: H, body: form() });
  const d2 = await up2.json();
  check("same client_upload_id returns 200 and the same id (NFR-12)", up2.status === 200 && d2.document_id === d1.document_id);

  const t0 = Date.now();
  const ex = await fetch(`${BASE}/api/documents/${d1.document_id}/extract`, { method: "POST", headers: H });
  const exj = await ex.json();
  check("POST extract 200", ex.status === 200, `${Date.now() - t0} ms, ${exj.facts?.length ?? 0} facts, status ${exj.status ?? exj.error?.code}`);
  const facts: { origin: string; state: string; has_image: boolean }[] = exj.facts ?? [];
  check("every fact is ai_read + unverified with an image", facts.length > 0 && facts.every((f) => f.origin === "ai_read" && f.state === "unverified" && f.has_image));

  const again = await fetch(`${BASE}/api/documents/${d1.document_id}/extract`, { method: "POST", headers: H });
  const againj = await again.json();
  check("second extract returns existing facts without the model", again.status === 200 && againj.facts?.length === facts.length);

  const get = await fetch(`${BASE}/api/documents/${d1.document_id}`, { headers: H });
  check("GET /api/documents/{id}", get.status === 200);
  const img = await fetch(`${BASE}/api/documents/${d1.document_id}/image`, { headers: H, redirect: "manual" });
  check("GET image is a 302 to a signed URL", img.status === 302 && !!img.headers.get("location"));
  const bogus = await fetch(`${BASE}/api/documents/${crypto.randomUUID()}`, { headers: H });
  check("unknown document is 404", bogus.status === 404);
}

main()
  .then(() => {
    console.log(failures ? `\n${failures} FAILED` : "\nALL PASS");
    process.exit(failures ? 1 : 0);
  })
  .catch((e) => {
    console.error("smoke aborted:", (e as Error).message);
    process.exit(1);
  });
