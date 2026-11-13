// `npm run smoke`: end-to-end checks against a running server (BASE_URL, default http://localhost:3000).
// Signs in the demo user, uploads a synthetic document, extracts it and checks the facts. P8 and P12 extend it.
// Needs .env.local and a seeded database. Never prints tokens, codes or document contents.
import "./load-env";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { getViewerFromRequest, getViewerSummary } from "../lib/share/service";
import { getReferralPacketForViewer } from "../lib/referral/service";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SMOKE_RECORD = "SMOKE TEST (SYNTHETIC)";
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
  const demoId: string | undefined = recs.records?.find((r: { display_name: string }) => r.display_name === "Demo Patient (SYNTHETIC)")?.id;
  check("demo record listed", !!demoId);
  if (!demoId) throw new Error("no demo record");
  const adv = await (await fetch(`${BASE}/api/records/${demoId}/advisories`, { headers: H })).json();
  check("demo record returns exactly one advisory (penicillin + amoxicillin), validated:false", adv.advisories?.length === 1 && adv.validated === false && adv.advisories[0].medicine_label === "Amoxicillin 500 mg");
  check("advisories need sign-in (401)", (await fetch(`${BASE}/api/records/${demoId}/advisories`)).status === 401);
  // Everything that writes uses a separate throwaway record, so the demo record stays clean
  // (audit tables are append-only, so test rows cannot be deleted afterwards).
  let recordId: string | undefined = recs.records?.find((r: { display_name: string }) => r.display_name === SMOKE_RECORD)?.id;
  if (!recordId) {
    const c = await fetch(`${BASE}/api/records`, { method: "POST", headers: { ...H, "content-type": "application/json" }, body: JSON.stringify({ display_name: SMOKE_RECORD, is_self: false }) });
    recordId = (await c.json()).record_id;
  }
  check("smoke record ready", !!recordId);
  if (!recordId) throw new Error("could not create the smoke record");
  const rid: string = recordId;

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
    f.set("record_id", rid);
    f.set("client_upload_id", clientUploadId);
    f.set("file", new Blob([new Uint8Array(bytes)], { type: mime }), path.basename(file));
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
  await factChecks(H, demoId, rid);
  await shareChecks(H, rid);
  await referralChecks(H, rid);
}

// ---- P6: fact lifecycle, timeline, previous value, provider-entered immutability
async function factChecks(H: Record<string, string>, demoId: string, recordId: string) {
  const J = { ...H, "content-type": "application/json" };
  const post = (p: string, body?: unknown, method = "POST") => fetch(`${BASE}${p}`, { method, headers: J, body: body ? JSON.stringify(body) : undefined });

  const tl = await (await fetch(`${BASE}/api/records/${demoId}/facts`, { headers: H })).json(); // read-only, on the demo record
  const hba = (tl.facts as { test_key: string; value_as_printed: string; previous?: { value_as_printed: string } }[]).filter((f) => f.test_key === "hba1c");
  const latest = hba.find((f) => f.value_as_printed === "7.4");
  const older = hba.find((f) => f.value_as_printed === "8.1");
  check("timeline: latest HbA1c has previous 8.1, older has none (FR-24)", latest?.previous?.value_as_printed === "8.1" && !!older && !older.previous);
  check("timeline: no direction wording in previous", !JSON.stringify(latest?.previous ?? {}).match(/better|worse|improv|worsen/i));

  const add = await post("/api/facts", { record_id: recordId, kind: "lab", label_as_printed: "Hb", value_as_printed: "10.1", unit_as_printed: "g/dL", range_as_printed: "12.0 - 16.0", fact_date_as_printed: "01/11/2026" });
  const added = (await add.json()).fact;
  check("POST /api/facts 201: patient_added, confirmed, test_key haemoglobin", add.status === 201 && added.origin === "patient_added" && added.state === "confirmed" && added.test_key === "haemoglobin");
  const bad = await post("/api/facts", { record_id: recordId, kind: "lab", label_as_printed: "x", origin: "provider_entered" });
  check("POST /api/facts rejects origin in the body (strict)", bad.status === 400);

  const cor = await post(`/api/facts/${added.id}/correct`, { value_as_printed: "10.5" });
  const corj = (await cor.json()).fact;
  check("correct re-derives value_num", cor.status === 200 && corj.value_num === 10.5);
  const cat = await post(`/api/facts/${added.id}/category`, { sensitive_category: "mental_health" });
  check("category tag", cat.status === 200 && (await cat.json()).fact.sensitive_category === "mental_health");
  const catBad = await post(`/api/facts/${added.id}/category`, { sensitive_category: "made_up" });
  check("unknown category is 400", catBad.status === 400);
  const rm = await post(`/api/facts/${added.id}/remove`);
  check("remove 200", rm.status === 200);
  const again = await post(`/api/facts/${added.id}/confirm`);
  check("a removed fact cannot be changed (409)", again.status === 409);
  const tl2 = await (await fetch(`${BASE}/api/records/${recordId}/facts`, { headers: H })).json();
  check("removed fact is gone from the timeline", !(tl2.facts as { id: string }[]).some((f) => f.id === added.id));
  const dispAi = await post(`/api/facts/${(tl.facts as { id: string; origin: string }[]).find((f) => f.origin === "ai_read")!.id}/dispute`, { note: "x" });
  check("dispute on an AI-read fact is refused (403)", dispAi.status === 403);

  // Provider-entered fact (inserted directly: the feed arrives in P10).
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    const [pf] = await sql`insert into fact (record_id, origin, state, kind, label_as_printed, value_as_printed, facility_name) values (${recordId}, 'provider_entered', 'confirmed', 'lab', 'SMOKE-TEST Creatinine', '88', 'Demo General Hospital (SIMULATED)') returning id`;
    const pc = await post(`/api/facts/${pf.id}/correct`, { value_as_printed: "99" });
    check("correct on a provider-entered fact is 403 provider_entered_immutable (NFR-24)", pc.status === 403 && (await pc.json()).error.code === "provider_entered_immutable");
    const pr = await post(`/api/facts/${pf.id}/remove`);
    check("remove on a provider-entered fact is 403", pr.status === 403);
    const d1 = await post(`/api/facts/${pf.id}/dispute`, { note: "This is not my result" });
    check("dispute provider-entered fact: state disputed", d1.status === 200 && (await d1.json()).fact.state === "disputed");
    const [row] = await sql`select value_as_printed from fact where id = ${pf.id}`;
    check("the hospital value is untouched after the dispute", row.value_as_printed === "88");
    const [ev] = await sql`select note from fact_event where fact_id = ${pf.id} and event = 'disputed'`;
    check("the patient note is stored beside the fact, not in place of it", ev?.note === "This is not my result");
    const d2 = await post(`/api/facts/${pf.id}/dispute`, undefined, "DELETE");
    check("withdraw dispute: back to confirmed", d2.status === 200 && (await d2.json()).fact.state === "confirmed");
    const other = await fetch(`${BASE}/api/facts/${pf.id}/confirm`, { method: "POST", headers: { authorization: "Bearer nope" } });
    check("bad token on a fact route is 401", other.status === 401);
  } finally {
    await sql.end({ timeout: 5 });
  }
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

// ---- P8: shares, viewer sessions, hidden items, rate limit, revoke, expiry, access log
async function shareChecks(H: Record<string, string>, recordId: string) {
  const J = { ...H, "content-type": "application/json" };
  const post = (p: string, body?: unknown, extra: Record<string, string> = {}) =>
    fetch(`${BASE}${p}`, { method: "POST", headers: { ...J, ...extra }, body: body ? JSON.stringify(body) : undefined });
  const open = (code: string, ip: string) =>
    fetch(`${BASE}/api/view/open`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ code, name: "Dr Smoke", practice_no: "MDCN 00000" }),
    });
  const ipOf = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    // Two extracted facts with images: hide one by category, leave the other visible.
    const tl = await (await fetch(`${BASE}/api/records/${recordId}/facts`, { headers: H })).json();
    const withImg = (tl.facts as { id: string; has_image: boolean; sensitive_category: string | null }[]).filter((f) => f.has_image);
    const hiddenFact = withImg[0];
    const visibleFact = withImg.find((f) => f.id !== hiddenFact?.id && !f.sensitive_category);
    check("have two facts with images to test hiding", !!hiddenFact && !!visibleFact);
    if (!hiddenFact || !visibleFact) return;
    await post(`/api/facts/${hiddenFact.id}/category`, { sensitive_category: "mental_health" });

    // limits
    check("expiry under 15 minutes is 400", (await post("/api/shares", { record_id: recordId, purpose: "general", expires_in_minutes: 5 })).status === 400);
    check("general expiry over 24 hours is 400", (await post("/api/shares", { record_id: recordId, purpose: "general", expires_in_minutes: 1441 })).status === 400);
    check("referral share without a referral is 400", (await post("/api/shares", { record_id: recordId, purpose: "referral" })).status === 400);
    check("hiding a category that does not exist is 400", (await post("/api/shares", { record_id: recordId, purpose: "general", hidden_categories: ["nope"] })).status === 400);
    check("anonymous cannot create a share (401)", (await fetch(`${BASE}/api/shares`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status === 401);

    // create
    const cr = await post("/api/shares", { record_id: recordId, purpose: "general", hidden_categories: ["mental_health"] });
    const share = await cr.json();
    check(
      "POST /api/shares 201 with XXXX-XXXX code, fragment url and QR svg",
      cr.status === 201 && /^[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(share.code) && share.url.endsWith(`/c#${share.code}`) && share.qr_svg.startsWith("<svg"),
    );
    const list = await (await fetch(`${BASE}/api/records/${recordId}/shares`, { headers: H })).json();
    const mine = list.shares.find((s: { id: string }) => s.id === share.share_id);
    check("share listed as valid with its hidden category", mine?.status === "valid" && mine.hidden_categories.includes("mental_health"));
    check("share list never contains the code or any hash", !JSON.stringify(list).includes(share.code) && !/hash/i.test(JSON.stringify(list)));
    const [stored] = await sql`select code_hash from share where id = ${share.share_id}`;
    check("only a 64-hex hash is stored, never the code", /^[0-9a-f]{64}$/.test(stored.code_hash) && !stored.code_hash.includes(share.code.replace("-", "")));

    // wrong code, then the right code typed sloppily (lowercase, no hyphen, O for 0)
    const unknown = await open("ZZZZ-ZZZZ", ipOf());
    const unknownBody = await unknown.text();
    check("unknown code: 403 code_not_valid", unknown.status === 403 && JSON.parse(unknownBody).error.code === "code_not_valid");
    const typed = share.code.replace("-", "").toLowerCase().replace(/0/g, "o");
    const ok = await open(typed, ipOf());
    const okBody = await ok.json();
    const cookie = ok.headers.get("set-cookie") ?? "";
    check("correct code (typed sloppily) opens: 200, next /v", ok.status === 200 && okBody.next === "/v");
    check("viewer cookie is HttpOnly, SameSite=Lax, Path=/", /itan_v=/.test(cookie) && /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie) && /Path=\//.test(cookie));
    check("open response contains no record content", !/Haemoglobin|display_name|fact/i.test(JSON.stringify(okBody)));
    const cookieHeader = cookie.split(";")[0];

    // summary through the library path (what Dev A's /v page will call)
    const viewer = await getViewerFromRequest(new Request("http://x/v", { headers: { cookie: cookieHeader } }));
    check("session resolves to a clinician on the right record", viewer.ok && viewer.recordId === recordId);
    if (viewer.ok) {
      const summary = await getViewerSummary(viewer);
      const body = JSON.stringify(summary);
      check("summary: partial notice shown, hidden fact absent, visible fact present", !!summary?.partial_notice && !body.includes(hiddenFact.id) && body.includes(visibleFact.id));
      check("summary says name and practice number are unverified", !!summary?.recorded_notice);
    }

    // image route
    const img = (id: string, cookieH?: string) => fetch(`${BASE}/v/facts/${id}/image`, { headers: cookieH ? { cookie: cookieH } : {}, redirect: "manual" });
    const visImg = await img(visibleFact.id, cookieHeader);
    check("visible fact image: 302 to a signed URL", visImg.status === 302 && !!visImg.headers.get("location"));
    check("hidden fact image: 404 (looks like it does not exist)", (await img(hiddenFact.id, cookieHeader)).status === 404);
    check("image without a cookie: 403", (await img(visibleFact.id)).status === 403);
    const recs = await (await fetch(`${BASE}/api/records`, { headers: H })).json();
    const demo = recs.records.find((r: { display_name: string }) => r.display_name.startsWith("Demo"));
    const demoFacts = await (await fetch(`${BASE}/api/records/${demo.id}/facts`, { headers: H })).json();
    check("a fact from ANOTHER record through this share is 404", (await img(demoFacts.facts[0].id, cookieHeader)).status === 404);

    // access log (holder)
    const log = await (await fetch(`${BASE}/api/records/${recordId}/access-log?limit=50`, { headers: H })).json();
    const actions = (log.entries as { action: string }[]).map((e) => e.action);
    check("access log has share_created, viewer_opened, viewer_image_viewed", ["share_created", "viewer_opened", "viewer_image_viewed"].every((a) => actions.includes(a)));
    check("access log labels name the viewer and say unverified", (log.entries as { label: string }[]).some((e) => e.label.includes("Dr Smoke") && e.label.includes("unverified")));
    check("access log is holder-only (anonymous 401)", (await fetch(`${BASE}/api/records/${recordId}/access-log`)).status === 401);

    // revoke: the very next request is refused, and the open body is identical to an unknown code's
    check("revoke 200", (await post(`/api/shares/${share.share_id}/revoke`)).status === 200);
    check("revoke is idempotent", (await post(`/api/shares/${share.share_id}/revoke`)).status === 200);
    const after = await getViewerFromRequest(new Request("http://x/v", { headers: { cookie: cookieHeader } }));
    check("after revoke the session is refused: share_revoked", !after.ok && after.reason === "share_revoked");
    const imgAfter = await img(visibleFact.id, cookieHeader);
    check("after revoke the image route is 403 share_revoked", imgAfter.status === 403 && (await imgAfter.json()).error.code === "share_revoked");
    const reopen = await open(share.code, ipOf());
    check("revoked code body is IDENTICAL to the unknown-code body (L12)", reopen.status === 403 && (await reopen.text()) === unknownBody);
    const log2 = await (await fetch(`${BASE}/api/records/${recordId}/access-log?limit=50`, { headers: H })).json();
    check("the refused attempt on a revoked code is in the patient's log", (log2.entries as { action: string; reason: string }[]).some((e) => e.action === "viewer_open_refused" && e.reason === "revoked"));

    // expiry
    const ex = await (await post("/api/shares", { record_id: recordId, purpose: "general", expires_in_minutes: 15 })).json();
    await sql`update share set expires_at = now() - interval '1 minute' where id = ${ex.share_id}`;
    const exOpen = await open(ex.code, ipOf());
    check("expired code body is IDENTICAL to the unknown-code body", exOpen.status === 403 && (await exOpen.text()) === unknownBody);
    const log3 = await (await fetch(`${BASE}/api/records/${recordId}/access-log?limit=50`, { headers: H })).json();
    check("the refused attempt on an expired code is logged with reason expired", (log3.entries as { action: string; reason: string }[]).some((e) => e.action === "viewer_open_refused" && e.reason === "expired"));

    // session lifetime is capped by the share expiry
    const short = await (await post("/api/shares", { record_id: recordId, purpose: "general", expires_in_minutes: 15 })).json();
    const sOpen = await open(short.code, ipOf());
    const maxAge = Number(/Max-Age=(\d+)/.exec(sOpen.headers.get("set-cookie") ?? "")?.[1]);
    check("cookie Max-Age is at most the share lifetime (15 min)", maxAge > 0 && maxAge <= 15 * 60);
    await post(`/api/shares/${short.share_id}/revoke`);

    // rate limit: five wrong codes from one IP, then even a CORRECT code is not checked
    const live = await (await post("/api/shares", { record_id: recordId, purpose: "general" })).json();
    const ip = ipOf();
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) codes.push((await open(`WRNG-000${i}`, ip)).status);
    check("five wrong codes are each 403", codes.every((c) => c === 403));
    const limited = await open(live.code, ip);
    check("sixth attempt is 429 with Retry-After, even with a correct code", limited.status === 429 && !!limited.headers.get("retry-after"));
    check("a different IP is unaffected", (await open(live.code, ipOf())).status === 200);
    await post(`/api/shares/${live.share_id}/revoke`);

    check("bad body on open is 400", (await fetch(`${BASE}/api/view/open`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "x" }) })).status === 400);
    check("unknown share id revoke is 404", (await post(`/api/shares/${crypto.randomUUID()}/revoke`)).status === 404);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// ---- P9: facilities, referral packet (verbatim or missing), referral share, acknowledgement
async function referralChecks(H: Record<string, string>, recordId: string) {
  const J = { ...H, "content-type": "application/json" };
  const post = (p: string, body?: unknown) => fetch(`${BASE}${p}`, { method: "POST", headers: J, body: body ? JSON.stringify(body) : undefined });
  const get = (p: string) => fetch(`${BASE}${p}`, { headers: H });
  const ipOf = () => `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const open = (code: string) =>
    fetch(`${BASE}/api/view/open`, { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": ipOf() }, body: JSON.stringify({ code, name: "Dr Ack", practice_no: "MDCN 99999" }) });
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  try {
    const fac = await get("/api/facilities");
    const facj = await fac.json();
    check("GET /api/facilities: six SIMULATED facilities", fac.status === 200 && facj.facilities.length >= 6 && facj.facilities.every((f: { name: string }) => f.name.includes("(SIMULATED)")));
    check("facilities need sign-in (401)", (await fetch(`${BASE}/api/facilities`)).status === 401);

    // Two source facts, inserted directly: a hospital ServiceRequest and an unconfirmed photographed letter.
    const [hosp] = await sql`insert into fact (record_id, origin, state, kind, label_as_printed, facility_name, extra) values (${recordId}, 'provider_entered', 'confirmed', 'referral', 'Referral', 'Demo General Hospital (SIMULATED)', ${sql.json({ reason_as_written: "Persistent anaemia, needs specialist review", urgency_as_written: "urgent", urgency_code: "urgent", requester: "Dr Demo Physician (SIMULATED)" })}) returning id`;
    const [letter] = await sql`insert into fact (record_id, origin, state, kind, label_as_printed, extra, check_carefully) values (${recordId}, 'ai_read', 'unverified', 'referral', 'Referral letter', ${sql.json({ reason_as_written: "Query diabetic nephropathy", urgency_as_written: "please see within 2 weeks", requester: "Dr Letter Writer" })}, true) returning id`;

    // The patient cannot set reason or urgency.
    for (const field of ["reason", "urgency", "urgency_as_written", "urgency_code"]) {
      const r = await post("/api/referrals", { record_id: recordId, [field]: "x" });
      check(`POST /api/referrals with "${field}" is 400 field_not_allowed`, r.status === 400 && (await r.json()).error.code === "field_not_allowed");
    }
    check("source from another record or a non-referral fact is 400", (await post("/api/referrals", { record_id: recordId, source_fact_id: crypto.randomUUID() })).status === 400);

    // No source: reason and urgency are MISSING, all seven fields still present or missing.
    const none = await (await post("/api/referrals", { record_id: recordId })).json();
    const noneView = await (await get(`/api/referrals/${none.referral_id}`)).json();
    check("no source: reason and urgency are 'Not stated by the referring clinician'", noneView.packet.reason_for_referral.status === "missing" && noneView.packet.urgency.note === "Not stated by the referring clinician" && noneView.packet.urgency.status === "missing");
    check("packet always carries all seven fields", ["results", "urgency", "medicines", "allergies", "reason_for_referral", "referring_clinician", "date"].every((k) => noneView.packet[k]?.status));

    // Unconfirmed letter: missing with the not-confirmed note; then confirmed: carried verbatim.
    const fromLetter = await (await post("/api/referrals", { record_id: recordId, source_fact_id: letter.id })).json();
    const before = await (await get(`/api/referrals/${fromLetter.referral_id}`)).json();
    check("unconfirmed letter: urgency missing, 'not yet confirmed by the patient'", before.packet.urgency.status === "missing" && /not yet confirmed/.test(before.packet.urgency.note));
    check("confirming the letter fact works", (await post(`/api/facts/${letter.id}/confirm`)).status === 200);
    const after = await (await get(`/api/referrals/${fromLetter.referral_id}`)).json();
    check("confirmed letter: urgency carried verbatim with the letter source", after.packet.urgency.value === "please see within 2 weeks" && /Read from the patient's referral letter/.test(after.packet.urgency.source) && after.packet.urgency.urgency_code === undefined);

    // Hospital ServiceRequest: verbatim, with the sender and the FHIR priority word.
    const facilityId = facj.facilities[0].id;
    const fromHosp = await (await post("/api/referrals", { record_id: recordId, source_fact_id: hosp.id, destination_facility_id: facilityId })).json();
    const hv = await (await get(`/api/referrals/${fromHosp.referral_id}`)).json();
    check("hospital referral: reason verbatim, source 'Sent by Demo General Hospital (SIMULATED)'", hv.packet.reason_for_referral.value === "Persistent anaemia, needs specialist review" && hv.packet.reason_for_referral.source === "Sent by Demo General Hospital (SIMULATED)");
    check("hospital referral: urgency 'urgent' with FHIR code 'urgent', clinician carried", hv.packet.urgency.value === "urgent" && hv.packet.urgency.urgency_code === "urgent" && hv.packet.referring_clinician.value === "Dr Demo Physician (SIMULATED)");
    check("destination facility appears on the packet", typeof hv.packet.destination === "string" && hv.packet.destination.includes("(SIMULATED)"));
    const [row] = await sql`select reason_as_written, urgency_as_written, urgency_code from referral where id = ${fromHosp.referral_id}`;
    check("referral row holds exactly the source's words", row.reason_as_written === "Persistent anaemia, needs specialist review" && row.urgency_as_written === "urgent" && row.urgency_code === "urgent");

    // Referral share -> clinician opens -> sees the packet -> acknowledges.
    const sh = await (await post("/api/shares", { record_id: recordId, purpose: "referral", referral_id: fromHosp.referral_id, expires_in_minutes: 60 })).json();
    const op = await open(sh.code);
    const opj = await op.json();
    check("referral share opens to /v/referral", op.status === 200 && opj.next === "/v/referral");
    const cookie = (op.headers.get("set-cookie") ?? "").split(";")[0];
    const viewer = await getViewerFromRequest(new Request("http://x/v/referral", { headers: { cookie } }));
    check("viewer is on a referral share", viewer.ok && viewer.purpose === "referral");
    if (viewer.ok) {
      const pk = await getReferralPacketForViewer(viewer);
      check("viewer packet: carried reason and the fixed acknowledgement labels", pk?.packet.reason_for_referral.value === "Persistent anaemia, needs specialist review" && pk.ack_labels.service_offered === "Received — service offered here");
      check("viewer packet carries the disclaimer", pk?.disclaimer === "This is not a statement that a bed is available.");
    }
    const ack = async (cookieH: string | null, status: string) =>
      fetch(`${BASE}/api/view/ack`, { method: "POST", headers: { "content-type": "application/json", ...(cookieH ? { cookie: cookieH } : {}) }, body: JSON.stringify({ status }) });
    check("ack without a cookie is 403", (await ack(null, "service_offered")).status === 403);
    check("ack with a bad status is 400", (await ack(cookie, "bed_available")).status === 400);
    const ok = await ack(cookie, "service_offered");
    const okj = await ok.json();
    check("ack 200 returns the label and the no-bed disclaimer", ok.status === 200 && okj.label === "Received — service offered here" && okj.disclaimer === "This is not a statement that a bed is available.");
    const owner = await (await get(`/api/referrals/${fromHosp.referral_id}`)).json();
    check("patient sees the acknowledgement with the clinician's name", owner.acknowledgements.some((a: { label: string; viewer_name: string }) => a.label === "Received — service offered here" && a.viewer_name === "Dr Ack"));
    const log = await (await get(`/api/records/${recordId}/access-log?limit=50`)).json();
    check("access log has referral_acknowledged", (log.entries as { action: string }[]).some((e) => e.action === "referral_acknowledged"));

    // A general share cannot acknowledge.
    const gen = await (await post("/api/shares", { record_id: recordId, purpose: "general" })).json();
    const gOpen = await open(gen.code);
    const gCookie = (gOpen.headers.get("set-cookie") ?? "").split(";")[0];
    check("ack on a general share is 403", (await ack(gCookie, "service_offered")).status === 403);
    for (const s of [sh, gen]) await post(`/api/shares/${s.share_id}/revoke`);
    check("after revoke, ack is refused 403", (await ack(cookie, "service_offered")).status === 403);
    check("unknown referral id is 404", (await get(`/api/referrals/${crypto.randomUUID()}`)).status === 404);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
