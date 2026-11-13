// C16 SIMULATED partner hospital. NOT a real system and NOT deployed. Run: npm run sim -- <command> [options]
// It imports NOTHING from lib/ or app/: like a real hospital system it knows only Itan's public BASE_URL and its
// own bearer key (HOSPITAL_KEY, written to tools/sim-hospital/.env.local by `npm run db:seed`). It never prints the key.
//
//   send-results   --link ITN-LNK-XXXXXXXX --mrn DEMO-00123
//   send-referral  --link ... --mrn ...
//   correct-result --link ... --mrn ... [--value 11.6]   re-sends the haemoglobin result with a new value (supersedes)
//   refusals       --link ... --mrn ... [--revoked-link ITN-LNK-...]   runs the refusal suite; exit 1 on any FAIL
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// `npm run sim` runs from the repo root.
const HERE = path.resolve(process.cwd(), "tools", "sim-hospital");
const BANNER = "SIMULATED HOSPITAL (Demo General Hospital): not a real system";

function loadLocalEnv(): void {
  const file = path.join(HERE, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function args(argv: string[]): { cmd: string; opts: Record<string, string> } {
  const [cmd = "", ...rest] = argv;
  const opts: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) opts[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith("--") ? rest[++i] : "true";
  }
  return { cmd, opts };
}

type Bundle = { entry: { resource: Record<string, unknown> }[] } & Record<string, unknown>;

function fixture(name: string, linkRef: string, mrn: string): Bundle {
  const raw = readFileSync(path.join(HERE, "fixtures", name), "utf8");
  return JSON.parse(raw.replaceAll("{{LINK_REF}}", linkRef).replaceAll("{{MRN}}", mrn));
}

interface Sent {
  status: number;
  text: string;
  json: Record<string, unknown> | null;
}

async function send(
  base: string,
  opts: { method?: string; path?: string; key?: string | null; idem?: string | null; body?: string; contentType?: string },
): Promise<Sent> {
  const headers: Record<string, string> = {};
  if (opts.key) headers.authorization = `Bearer ${opts.key}`;
  if (opts.idem) headers["idempotency-key"] = opts.idem;
  if (opts.body !== undefined) headers["content-type"] = opts.contentType ?? "application/fhir+json";
  const r = await fetch(`${base}${opts.path ?? "/api/feed/v1/bundles"}`, { method: opts.method ?? "POST", headers, body: opts.body });
  const text = await r.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: r.status, text, json };
}

const print = (label: string, s: Sent) => console.log(`${label}: HTTP ${s.status}\n${s.json ? JSON.stringify(s.json, null, 2) : s.text}`);

function need(opts: Record<string, string>, name: string): string {
  const v = opts[name];
  if (!v || v === "true") {
    console.error(`Missing --${name}`);
    process.exit(2);
  }
  return v;
}

async function refusals(base: string, key: string, link: string, mrn: string, revoked: string | null): Promise<number> {
  const rows: { name: string; expected: string; got: string; pass: boolean }[] = [];
  const row = (name: string, expected: string, got: string, pass: boolean) => rows.push({ name, expected, got, pass });
  const body = (l = link) => JSON.stringify(fixture("results.json", l, mrn));

  for (const method of ["GET", "PUT", "DELETE"]) {
    const s = await send(base, { method, key });
    row(`read attempt: ${method} /api/feed/v1/bundles`, "405", String(s.status), s.status === 405);
  }
  const probe = await send(base, { method: "GET", path: "/api/feed/v1/patients", key });
  row("read attempt: GET /api/feed/v1/patients", "405", String(probe.status), probe.status === 405);

  const wrong = await send(base, { key: `itnk_${randomBytes(32).toString("base64url")}`, idem: randomUUID(), body: body() });
  row("wrong key", "401", String(wrong.status), wrong.status === 401);

  const noKey = await send(base, { key: null, idem: randomUUID(), body: body() });
  row("no key", "401", String(noKey.status), noKey.status === 401);

  const unlinked = await send(base, { key, idem: randomUUID(), body: body("ITN-LNK-ZZZZZZZZ") });
  row("unlinked reference ITN-LNK-ZZZZZZZZ", "403", String(unlinked.status), unlinked.status === 403);

  if (revoked) {
    const rv = await send(base, { key, idem: randomUUID(), body: body(revoked) });
    row("revoked link", "403", String(rv.status), rv.status === 403);
    row("403 bodies for unlinked and revoked are byte-identical", "identical", rv.text === unlinked.text ? "identical" : "different", rv.text === unlinked.text);
  } else {
    row("revoked link (pass --revoked-link to run)", "403", "SKIPPED", true);
  }

  const med = fixture("results.json", link, mrn);
  med.entry.push({ resource: { resourceType: "MedicationRequest", status: "active" } });
  const m = await send(base, { key, idem: randomUUID(), body: JSON.stringify(med) });
  row("bundle with a MedicationRequest", "422", String(m.status), m.status === 422);

  const big = JSON.stringify({ ...fixture("results.json", link, mrn), padding: "x".repeat(1_200_000) });
  let bigStatus = "error";
  try {
    bigStatus = String((await send(base, { key, idem: randomUUID(), body: big })).status);
  } catch {
    // The server may close the connection after answering 413; fetch then cannot read the reply.
    bigStatus = "connection closed";
  }
  row("oversized body (1.2 MB)", "413", bigStatus, bigStatus === "413");

  const noIdem = await send(base, { key, idem: null, body: body() });
  row("missing Idempotency-Key", "400", String(noIdem.status), noIdem.status === 400);

  const idem = randomUUID();
  const first = await send(base, { key, idem, body: body() });
  const second = await send(base, { key, idem, body: body() });
  row("same Idempotency-Key: first", "202", String(first.status), first.status === 202);
  const same = !!first.json?.receipt_id && first.json.receipt_id === second.json?.receipt_id;
  row("same Idempotency-Key: second", "200 + same receipt_id", `${second.status}${same ? " + same receipt_id" : ""}`, second.status === 200 && same);

  const w = Math.max(...rows.map((r) => r.name.length));
  console.log(`\n${"check".padEnd(w)}  expected               got                    result`);
  for (const r of rows) console.log(`${r.name.padEnd(w)}  ${r.expected.padEnd(22)} ${r.got.padEnd(22)} ${r.pass ? "PASS" : "FAIL"}`);
  const fails = rows.filter((r) => !r.pass).length;
  console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`);
  return fails === 0 ? 0 : 1;
}

async function main(): Promise<number> {
  console.log(BANNER);
  loadLocalEnv();
  const base = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const key = process.env.HOSPITAL_KEY ?? "";
  const { cmd, opts } = args(process.argv.slice(2));
  if (!["send-results", "send-referral", "correct-result", "refusals"].includes(cmd)) {
    console.log("Commands: send-results | send-referral | correct-result | refusals   (options: --link ITN-LNK-XXXXXXXX --mrn DEMO-00123)");
    return 2;
  }
  if (!key) {
    console.error("HOSPITAL_KEY is not set. Run `npm run db:seed` (it writes tools/sim-hospital/.env.local).");
    return 2;
  }
  const link = need(opts, "link");
  const mrn = need(opts, "mrn");
  console.log(`Target: ${base}`);

  if (cmd === "refusals") return refusals(base, key, link, mrn, opts["revoked-link"] ?? null);

  let bundle: Bundle;
  if (cmd === "send-referral") bundle = fixture("referral.json", link, mrn);
  else if (cmd === "send-results") bundle = fixture("results.json", link, mrn);
  else {
    // correct-result: the haemoglobin Observation again, same identifier, a new value.
    const full = fixture("results.json", link, mrn);
    const hb = full.entry.find((e) => (e.resource.code as { text?: string } | undefined)?.text === "Haemoglobin")!;
    hb.resource.valueString = opts.value && opts.value !== "true" ? opts.value : "11.6";
    bundle = { ...full, entry: [full.entry[0], hb] };
  }
  const s = await send(base, { key, idem: randomUUID(), body: JSON.stringify(bundle) });
  print(cmd, s);
  return s.status === 202 || s.status === 200 ? 0 : 1;
}

// process.exitCode, not process.exit(): exiting while fetch sockets are closing crashes Node on Windows
// ("Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)").
main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error("sim-hospital failed:", (e as Error).message);
    process.exitCode = 1;
  },
);
