// `npm run throttle` (P12 item 3): measure NFR-10 and NFR-11 on an APPROXIMATION of Chrome's Fast 3G.
//   (a) NFR-10: upload and extract five synthetic fixtures through the real API as the demo user, from inside a
//       real Chrome whose network is throttled with the DevTools Protocol. Reports each total and the slowest.
//   (b) NFR-11: if the clinician page /v is built, open it with a fresh viewer session and report bytes and time to
//       first render. If /v does not exist yet, prints "SKIPPED: /v not built" and writes nothing for it.
// Uses an INSTALLED Chrome or Edge through Playwright (no browser download). SYNTHETIC documents only (hard rule 8).
// Never prints tokens, share codes or document contents. Needs .env.local and a running server (BASE_URL, default
// http://localhost:3000; for realistic numbers use a production build: `npm run build && npm run start`).
// Writes docs/evidence/throttle.md only from numbers it measured. It does not guess and does not fill gaps.
import "./load-env";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";
import { FAST_3G, kbitToBytesPerSecond, renderThrottleReport, type DocTiming, type ViewerTiming } from "./throttle-report";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const FIXTURES = path.join("tools", "fixtures");
const RECORD_NAME = "THROTTLE TEST (SYNTHETIC)";
// Four phone-photo style images (what the app sends) and one PDF, all single page.
const DEFAULT_FILES = ["lab-fbc-photo.jpg", "lab-chem-photo.jpg", "rx-printed-photo.jpg", "referral-letter-photo.jpg", "lab-hba1c-2026-pdf.pdf"];
const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf" };

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function launch(): Promise<Browser> {
  for (const channel of ["chrome", "msedge"] as const) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // try the next one
    }
  }
  throw new Error("No installed Chrome or Edge could be launched (or run: npx playwright install chromium)");
}

/** Throttle ONE page's network (and anything it loads). Applied after the first load, so only the measured calls are slow. */
async function throttle(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: FAST_3G.latencyMs,
    downloadThroughput: kbitToBytesPerSecond(FAST_3G.downKbit),
    uploadThroughput: kbitToBytesPerSecond(FAST_3G.upKbit),
  });
  return cdp;
}

interface InPageResult {
  status: number;
  ms: number;
  body: { document_id?: string; status?: string; facts?: unknown[]; error?: { code?: string } } | null;
}

/** Runs INSIDE the page, so the browser's throttled network carries it. Times the whole call, body included. */
async function timedCall(
  page: Page,
  args: { path: string; token: string; method: string; form?: { recordId: string; uploadId: string; b64: string; mime: string; name: string } },
): Promise<InPageResult> {
  return page.evaluate(async (a) => {
    const t0 = performance.now();
    const init: RequestInit = { method: a.method, headers: { authorization: `Bearer ${a.token}` } };
    if (a.form) {
      const bin = atob(a.form.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const fd = new FormData();
      fd.set("record_id", a.form.recordId);
      fd.set("client_upload_id", a.form.uploadId);
      fd.set("file", new File([bytes], a.form.name, { type: a.form.mime }));
      init.body = fd;
    }
    const r = await fetch(a.path, init);
    let body: InPageResult["body"] = null;
    try {
      body = await r.json();
    } catch {
      body = null;
    }
    return { status: r.status, ms: Math.round(performance.now() - t0), body };
  }, args);
}

async function findOrCreateRecord(token: string): Promise<string> {
  const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const recs = await (await fetch(`${BASE}/api/records`, { headers: H })).json();
  const found = recs.records?.find((r: { display_name: string }) => r.display_name === RECORD_NAME)?.id;
  if (found) return found;
  const c = await fetch(`${BASE}/api/records`, { method: "POST", headers: H, body: JSON.stringify({ display_name: RECORD_NAME, is_self: false }) });
  const id = (await c.json()).record_id;
  if (!id) throw new Error("could not create the throttle test record");
  return id;
}

async function measureDocuments(page: Page, token: string, recordId: string, files: string[]): Promise<{ docs: DocTiming[]; ids: string[] }> {
  const docs: DocTiming[] = [];
  const ids: string[] = [];
  for (const name of files) {
    const file = path.join(FIXTURES, name);
    const row: DocTiming = { file: name, bytes: 0, uploadMs: null, extractMs: null, totalMs: null, facts: null, error: null };
    docs.push(row);
    if (!existsSync(file)) {
      row.error = "fixture_missing";
      continue;
    }
    const buf = readFileSync(file);
    row.bytes = buf.byteLength;
    const mime = MIME[path.extname(name).toLowerCase()];
    const up = await timedCall(page, {
      path: "/api/documents",
      token,
      method: "POST",
      form: { recordId, uploadId: crypto.randomUUID(), b64: buf.toString("base64"), mime, name },
    });
    row.uploadMs = up.ms;
    const id = up.body?.document_id;
    if (!(up.status === 200 || up.status === 201) || !id) {
      row.error = `upload_failed_${up.status}${up.body?.error?.code ? `_${up.body.error.code}` : ""}`;
      continue;
    }
    ids.push(id);
    const ex = await timedCall(page, { path: `/api/documents/${id}/extract`, token, method: "POST" });
    row.extractMs = ex.ms;
    row.totalMs = up.ms + ex.ms;
    if (ex.status !== 200 || ex.body?.status !== "extracted") {
      row.error = `extract_failed_${ex.status}${ex.body?.error?.code ? `_${ex.body.error.code}` : ""}`;
      row.totalMs = null;
      continue;
    }
    row.facts = ex.body.facts?.length ?? 0;
    console.log(`${name.padEnd(28)} upload ${(up.ms / 1000).toFixed(1)} s  extract ${(ex.ms / 1000).toFixed(1)} s  total ${(row.totalMs / 1000).toFixed(1)} s  ${row.facts} facts`);
    await sleep(3000); // be gentle with the AI service
  }
  return { docs, ids };
}

/** (b) NFR-11. Only runs if the /v page exists. NOT exercised until Dev A builds /v: the flow below follows
 *  docs/api.md (create a share, open it with a name and practice number, load /v with the viewer cookie). */
async function measureViewer(browser: Browser, token: string, recordId: string): Promise<ViewerTiming | null> {
  if (!existsSync(path.join("app", "v", "page.tsx"))) return null;
  const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };
  const share = await (await fetch(`${BASE}/api/shares`, { method: "POST", headers: H, body: JSON.stringify({ record_id: recordId, purpose: "general", expires_in_minutes: 15 }) })).json();
  let context: BrowserContext | undefined;
  try {
    const open = await fetch(`${BASE}/api/view/open`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.${Math.floor(Math.random() * 250)}.1.1` },
      body: JSON.stringify({ code: share.code, name: "Dr Throttle", practice_no: "MDCN 00000" }),
    });
    const cookie = (open.headers.get("set-cookie") ?? "").split(";")[0];
    const [cname, ...cval] = cookie.split("=");
    if (!cname || !cval.length) return null;
    context = await browser.newContext();
    await context.addCookies([{ name: cname, value: cval.join("="), url: BASE }]);
    const page = await context.newPage();
    const cdp = await throttle(page);
    let bytes = 0;
    cdp.on("Network.loadingFinished", (e: { encodedDataLength: number }) => (bytes += e.encodedDataLength));
    await page.goto(`${BASE}/v`, { waitUntil: "load" });
    const fcp = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? null);
    return fcp === null ? null : { bytes, firstRenderMs: Math.round(fcp) };
  } finally {
    await context?.close();
    await fetch(`${BASE}/api/shares/${share.share_id}/revoke`, { method: "POST", headers: H }).catch(() => {});
  }
}

async function main(): Promise<number> {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error(`No server answering at ${BASE}. Start one (production build recommended: npm run build && npm run start) and retry.`);
    return 1;
  }
  const token = await signIn();
  const consent = await fetch(`${BASE}/api/consent`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
  if (!consent.ok) throw new Error(`consent failed (${consent.status})`);
  const recordId = await findOrCreateRecord(token);
  const files = (arg("files") ?? DEFAULT_FILES.join(",")).split(",").map((s) => s.trim()).filter(Boolean);

  console.log(`Throttling to an approximation of Fast 3G: ${FAST_3G.downKbit / 1000} Mbit/s down, ${FAST_3G.upKbit / 1000} Mbit/s up, ${FAST_3G.latencyMs} ms latency. Server: ${BASE}`);
  const browser = await launch();
  try {
    // Load once unthrottled so only the measured calls are slow, then throttle and take the network floor.
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${BASE}/api/health`, { waitUntil: "load" });
    await throttle(page);
    const f0 = Date.now();
    const floor = await page.evaluate(async () => (await fetch("/api/health")).status);
    const floorMs = floor === 200 ? Date.now() - f0 : null;
    console.log(`network floor under the throttle: ${floorMs === null ? "n/a" : `${(floorMs / 1000).toFixed(1)} s`}`);

    const { docs, ids } = await measureDocuments(page, token, recordId, files);
    await context.close();

    const viewer = await measureViewer(browser, token, recordId);
    if (!viewer) console.log("NFR-11: SKIPPED: /v not built");

    // Which model actually ran: the server records it against each document.
    let models: string[] = [];
    if (ids.length && process.env.DATABASE_URL) {
      const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
      try {
        models = (await sql`select distinct model_version from document where id = any(${ids}::uuid[]) and model_version is not null`).map((r) => String(r.model_version));
      } finally {
        await sql.end({ timeout: 5 });
      }
    }

    const measured = docs.some((d) => d.totalMs !== null);
    const report = renderThrottleReport({
      date: new Date().toISOString().slice(0, 10),
      baseUrl: BASE,
      serverMode: arg("server-mode", /localhost|127\.0\.0\.1/.test(BASE) ? "local server; set --server-mode if it is not a production build" : "deployed")!,
      models,
      network: FAST_3G,
      floorMs,
      docs,
      viewer,
    });
    const out = arg("out", path.join("docs", "evidence", "throttle.md"))!;
    if (measured) {
      mkdirSync(path.dirname(out), { recursive: true });
      writeFileSync(out, report);
      console.log(`\nwritten to ${out}`);
    } else {
      console.log("\nNothing was measured, so no evidence file was written.");
    }
    console.log(report.split("\n").filter((l) => /^\*\*NFR/.test(l)).join("\n"));
    return docs.every((d) => d.error === null) ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error("throttle failed:", (e as Error).message);
    process.exitCode = 1;
  },
);
