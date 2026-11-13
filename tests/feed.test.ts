// C15/C16 partner feed (FR-26, FR-27, NFR-22, NFR-24). No network, no database: the intake runs on in-memory deps.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "@/lib/crypto";
import { LINK_SYSTEM, parseBundle } from "@/lib/feed/fhir-subset";
import {
  LINK_NOT_ACTIVE,
  processFeedReadAttempt,
  processFeedRequest,
  type AcceptedWrite,
  type FeedDeps,
  type LinkRow,
  type Refusal,
  type WriteOutcome,
} from "@/lib/feed/intake";
import { datePart, observationToFact, serviceRequestToFact } from "@/lib/feed/map";

vi.mock("@/lib/feed/queries", () => ({
  findCredentialByKeyHash: vi.fn(async () => null),
  findLinkByRef: vi.fn(async () => null),
  findAcceptedReceipt: vi.fn(async () => null),
  recordRefusal: vi.fn(async () => {}),
  writeAccepted: vi.fn(async () => ({ kind: "duplicate" })),
}));

// ---------------------------------------------------------------- fixtures and fakes

const KEY = "itnk_test-key-for-demo-general";
const OTHER_KEY = "itnk_test-key-for-another-hospital";
const H1 = { hospitalId: "h1", hospitalName: "Demo General Hospital (SIMULATED)", keyHash: sha256Hex(KEY) };
const H2 = { hospitalId: "h2", hospitalName: "Other Hospital (SIMULATED)", keyHash: sha256Hex(OTHER_KEY) };
const RECORD_ID = "11111111-2222-3333-4444-555555555555";
const PATIENT_NAME = "Demo Patient (SYNTHETIC)";

const LINKS: Record<string, LinkRow> = {
  "ITN-LNK-ACTIVE01": { id: "l-active", recordId: RECORD_ID, hospitalId: "h1", hospitalPatientRef: null, revokedAt: null },
  "ITN-LNK-REVOKED1": { id: "l-revoked", recordId: RECORD_ID, hospitalId: "h1", hospitalPatientRef: null, revokedAt: new Date("2026-11-12") },
  "ITN-LNK-OTHERH01": { id: "l-other", recordId: RECORD_ID, hospitalId: "h2", hospitalPatientRef: null, revokedAt: null },
  "ITN-LNK-HASMRN01": { id: "l-mrn", recordId: RECORD_ID, hospitalId: "h1", hospitalPatientRef: "DEMO-00123", revokedAt: null },
};

const fixture = (name: string, link = "ITN-LNK-ACTIVE01", mrn = "DEMO-00123") =>
  JSON.parse(
    readFileSync(path.join("tools", "sim-hospital", "fixtures", name), "utf8").replaceAll("{{LINK_REF}}", link).replaceAll("{{MRN}}", mrn),
  );

interface Fake extends FeedDeps {
  refusals: Refusal[];
  writes: AcceptedWrite[];
  receipts: Map<string, { receiptId: string; factsCreated: number }>;
  nextOutcome: WriteOutcome | null;
}

function fakeDeps(): Fake {
  const f: Fake = {
    refusals: [],
    writes: [],
    receipts: new Map(),
    nextOutcome: null,
    findCredentialByKeyHash: async (h) => [H1, H2].find((c) => c.keyHash === h) ?? null,
    findLinkByRef: async (r) => LINKS[r] ?? null,
    findAcceptedReceipt: async (h, k) => f.receipts.get(`${h}|${k}`) ?? null,
    recordRefusal: async (r) => {
      f.refusals.push(r);
    },
    writeAccepted: async (w) => {
      f.writes.push(w);
      if (f.nextOutcome) return f.nextOutcome;
      const receiptId = `r${f.writes.length}`;
      const facts = w.buildFacts(receiptId);
      f.receipts.set(`${w.hospitalId}|${w.idempotencyKey}`, { receiptId, factsCreated: facts.length });
      return { kind: "accepted", receiptId, factsCreated: facts.length };
    },
  };
  return f;
}

const URL_ = "http://localhost/api/feed/v1/bundles";
let idemCounter = 0;
const newIdem = () => `00000000-0000-4000-8000-${String(++idemCounter).padStart(12, "0")}`;

function req(opts: { body?: unknown; key?: string | null; idem?: string | null; method?: string; contentType?: string; raw?: string; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.key !== null) headers.authorization = `Bearer ${opts.key ?? KEY}`;
  if (opts.idem !== null) headers["idempotency-key"] = opts.idem ?? newIdem();
  headers["content-type"] = opts.contentType ?? "application/fhir+json";
  const method = opts.method ?? "POST";
  const body = method === "GET" || method === "HEAD" ? undefined : (opts.raw ?? JSON.stringify(opts.body ?? fixture("results.json")));
  return new Request(URL_, { method, headers, body });
}

let deps: Fake;
beforeEach(() => {
  deps = fakeDeps();
});

// ---------------------------------------------------------------- the FHIR subset

describe("parseBundle (FHIR R4-aligned subset, L29)", () => {
  it("both SIMULATED fixtures validate after placeholder substitution (freeze item 11)", () => {
    const r = parseBundle(fixture("results.json"));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.patient).toEqual({ linkRef: "ITN-LNK-ACTIVE01", hospitalPatientRef: "DEMO-00123" });
      expect(r.observations).toHaveLength(3);
    }
    const s = parseBundle(fixture("referral.json"));
    expect(s.ok && s.serviceRequests.length).toBe(1);
  });

  it("every fixture in tools/sim-hospital/fixtures that is JSON validates", () => {
    for (const f of readdirSync(path.join("tools", "sim-hospital", "fixtures")).filter((n) => n.endsWith(".json"))) {
      expect(parseBundle(fixture(f)).ok, f).toBe(true);
    }
  });

  it("refuses a MedicationRequest (anything outside Observation and ServiceRequest)", () => {
    const b = fixture("results.json");
    b.entry.push({ resource: { resourceType: "MedicationRequest", status: "active" } });
    const r = parseBundle(b);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0].path).toBe("entry[4].resource.resourceType");
  });

  it("refuses two Patients, no Patient, 51 entries, a wrong link system and a missing hospital number", () => {
    const two = fixture("results.json");
    two.entry.push(structuredClone(two.entry[0]));
    expect(parseBundle(two).ok).toBe(false);

    const none = fixture("results.json");
    none.entry.shift();
    expect(parseBundle(none).ok).toBe(false);

    const many = fixture("results.json");
    while (many.entry.length < 51) many.entry.push(structuredClone(many.entry[1]));
    expect(parseBundle(many).ok).toBe(false);

    const sys = fixture("results.json");
    sys.entry[0].resource.identifier[0].system = "urn:itan:lnk";
    expect(parseBundle(sys).ok).toBe(false);

    const noMrn = fixture("results.json");
    noMrn.entry[0].resource.identifier = [{ system: LINK_SYSTEM, value: "ITN-LNK-ACTIVE01" }];
    expect(parseBundle(noMrn).ok).toBe(false);
  });

  it("refuses a non-collection bundle, a missing code.text, both value types, and a partial date", () => {
    expect(parseBundle({ ...fixture("results.json"), type: "transaction" }).ok).toBe(false);
    const noCode = fixture("results.json");
    delete noCode.entry[1].resource.code;
    expect(parseBundle(noCode).ok).toBe(false);
    const both = fixture("results.json");
    both.entry[1].resource.valueQuantity = { value: 11.2, unit: "g/dL" };
    expect(parseBundle(both).ok).toBe(false);
    const partial = fixture("results.json");
    partial.entry[1].resource.effectiveDateTime = "2026";
    expect(parseBundle(partial).ok).toBe(false);
    expect(parseBundle("not a bundle").ok).toBe(false);
    expect(parseBundle(null).ok).toBe(false);
  });

  it("strips unknown fields inside accepted resources", () => {
    const b = fixture("results.json");
    b.entry[1].resource.interpretation = [{ text: "H" }];
    const r = parseBundle(b);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.observations[0]).not.toHaveProperty("interpretation");
  });

  it("issues carry paths and messages only, never the submitted values", () => {
    const b = fixture("results.json");
    b.entry[1].resource.valueString = 12345.678;
    b.entry[1].resource.code = { text: 999 };
    const r = parseBundle(b);
    expect(r.ok).toBe(false);
    const text = JSON.stringify(r);
    expect(text).not.toContain("12345.678");
    expect(text).not.toContain("999");
  });
});

// ---------------------------------------------------------------- mapping to facts

describe("FHIR to fact mapping (L21, L27, L28)", () => {
  const ctx = { recordId: RECORD_ID, hospitalId: "h1", facilityName: H1.hospitalName, receiptId: "r1" };
  const parsed = parseBundle(fixture("results.json"));
  if (!parsed.ok) throw new Error("fixture invalid");
  const [hb, fbs, creat] = parsed.observations.map((o) => observationToFact(o, ctx));

  it("provider_entered, confirmed, with hospital, facility name and receipt", () => {
    for (const f of [hb, fbs, creat]) {
      expect(f).toMatchObject({ origin: "provider_entered", state: "confirmed", hospital_id: "h1", facility_name: H1.hospitalName, feed_receipt_id: "r1", record_id: RECORD_ID });
    }
  });

  it("keeps valueString exactly and takes the unit from the range bounds", () => {
    expect(hb).toMatchObject({ kind: "lab", label_as_printed: "Haemoglobin", test_key: "haemoglobin", value_as_printed: "11.2", value_num: 11.2, unit_as_printed: "g/dL" });
    expect(hb).toMatchObject({ range_as_printed: "12.0 - 16.0", range_low: 12, range_high: 16 });
    const exact = parseBundle({ ...fixture("results.json") });
    if (exact.ok) {
      exact.observations[0].valueString = "12.0";
      expect(observationToFact(exact.observations[0], ctx).value_as_printed).toBe("12.0");
    }
  });

  it("maps valueQuantity with its unit, the number rendered as text (L28)", () => {
    expect(creat).toMatchObject({ value_as_printed: "88", value_num: 88, unit_as_printed: "µmol/L", range_as_printed: "45 - 90", range_low: 45, range_high: 90 });
  });

  it("builds the range text from low and high when no text was sent", () => {
    const o = { resourceType: "Observation" as const, code: { text: "Creatinine" }, valueQuantity: { value: 70, unit: "µmol/L" }, referenceRange: [{ low: { value: 45 }, high: { value: 90 } }] };
    expect(observationToFact(o, ctx)).toMatchObject({ range_as_printed: "45 - 90", range_low: 45, range_high: 90 });
    const highOnly = { ...o, referenceRange: [{ high: { value: 5.7 } }] };
    expect(observationToFact(highOnly, ctx)).toMatchObject({ range_as_printed: "< 5.7", range_low: null, range_high: 5.7 });
  });

  it("takes the date part only, with no timezone shifting", () => {
    expect(hb.fact_date).toBe("2026-11-10");
    expect(hb.fact_date_as_printed).toBe("2026-11-10T09:30:00+01:00");
    expect(datePart("2026-11-10T23:59:00-08:00")).toBe("2026-11-10");
    expect(datePart(undefined)).toBeNull();
  });

  it("stores the identifier as <system>|<value> for superseding", () => {
    expect(hb.source_identifier).toBe("urn:demo-general-hospital:lab|LAB-20261110-HB");
  });

  it("a ServiceRequest becomes a referral fact with reason and urgency carried verbatim", () => {
    const r = parseBundle(fixture("referral.json"));
    if (!r.ok) throw new Error("fixture invalid");
    const f = serviceRequestToFact(r.serviceRequests[0], ctx);
    expect(f).toMatchObject({ kind: "referral", origin: "provider_entered", state: "confirmed" });
    expect(f.extra).toEqual({
      reason_as_written: "Persistent anaemia, needs specialist review",
      urgency_as_written: "urgent",
      urgency_code: "urgent",
      requester: "Dr Demo Physician (SIMULATED)",
    });
  });

  it("joins several reasons with '; ' and leaves missing reason and urgency null (never derived)", () => {
    const two = serviceRequestToFact({ resourceType: "ServiceRequest", reasonCode: [{ text: "A" }, { text: "B" }] }, ctx);
    expect(two.extra).toEqual({ reason_as_written: "A; B", urgency_as_written: null, urgency_code: null, requester: null });
    const none = serviceRequestToFact({ resourceType: "ServiceRequest" }, ctx);
    expect(none.extra).toEqual({ reason_as_written: null, urgency_as_written: null, urgency_code: null, requester: null });
  });
});

// ---------------------------------------------------------------- the refusal table (design 5.4, NFR-22)

describe("intake refusals", () => {
  it.each(["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"])("%s is 405 with Allow: POST, before authentication", async (method) => {
    const r = await processFeedRequest(req({ method, key: null }), deps);
    expect(r.status).toBe(405);
    expect(r.headers.Allow).toBe("POST");
    expect(deps.refusals).toEqual([{ hospitalId: null, linkId: null, reason: "read_attempt", bundleBytes: null, recordLog: null }]);
  });

  it("no key, a malformed header and a wrong key are 401; the attempt is logged unattributed", async () => {
    for (const r of [req({ key: null }), req({ headers: { authorization: "Basic abc" }, key: null }), req({ key: "itnk_wrong" })]) {
      const out = await processFeedRequest(r, deps);
      expect(out.status).toBe(401);
    }
    expect(deps.refusals.map((r) => [r.reason, r.hospitalId])).toEqual([
      ["bad_key", null],
      ["bad_key", null],
      ["bad_key", null],
    ]);
    expect(deps.writes).toHaveLength(0);
  });

  it("a revoked key is 401 (revoked credentials are not found by the lookup)", async () => {
    deps.findCredentialByKeyHash = async () => null;
    expect((await processFeedRequest(req(), deps)).status).toBe(401);
  });

  it("the key is checked before anything else: a bad key with a bad bundle is still 401", async () => {
    const r = await processFeedRequest(req({ key: "itnk_wrong", idem: null, raw: "{" }), deps);
    expect(r.status).toBe(401);
  });

  it("a missing or non-UUID Idempotency-Key is 400 idempotency_key_required", async () => {
    for (const idem of [null, "abc"]) {
      const r = await processFeedRequest(req({ idem }), deps);
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ error: { code: "idempotency_key_required" } });
    }
    expect(deps.refusals.every((r) => r.hospitalId === "h1" && r.reason === "idempotency_key_missing")).toBe(true);
  });

  it("a declared body over the limit is 413 without reading it", async () => {
    const r = await processFeedRequest(req({ headers: { "content-length": "1200000" } }), deps);
    expect(r.status).toBe(413);
    expect(deps.refusals[0]).toMatchObject({ reason: "too_large", bundleBytes: 1200000 });
  });

  it("a streamed body over the limit is 413 even without Content-Length", async () => {
    const r = await processFeedRequest(req(), deps, 100);
    expect(r.status).toBe(413);
    expect(deps.refusals[0].reason).toBe("too_large");
    expect(deps.writes).toHaveLength(0);
  });

  it("a wrong content type is 415", async () => {
    const r = await processFeedRequest(req({ contentType: "text/plain" }), deps);
    expect(r.status).toBe(415);
  });

  it("application/json is accepted as well as application/fhir+json", async () => {
    expect((await processFeedRequest(req({ contentType: "application/json; charset=utf-8" }), deps)).status).toBe(202);
  });

  it("invalid JSON and an out-of-subset bundle are 422 with issues, and nothing is written", async () => {
    const bad = await processFeedRequest(req({ raw: "{not json" }), deps);
    expect(bad.status).toBe(422);
    const med = fixture("results.json");
    med.entry.push({ resource: { resourceType: "MedicationRequest" } });
    const r = await processFeedRequest(req({ body: med }), deps);
    expect(r.status).toBe(422);
    expect((r.body as { error: { issues: unknown[] } }).error.issues.length).toBeGreaterThan(0);
    expect(deps.writes).toHaveLength(0);
    expect(deps.refusals.map((x) => x.reason)).toEqual(["bundle_invalid", "bundle_invalid"]);
  });

  it("unknown, revoked, other-hospital and changed-patient links give the IDENTICAL 403", async () => {
    const cases = [
      fixture("results.json", "ITN-LNK-ZZZZZZZZ"),
      fixture("results.json", "ITN-LNK-REVOKED1"),
      fixture("results.json", "ITN-LNK-OTHERH01"),
      fixture("results.json", "ITN-LNK-HASMRN01", "DEMO-99999"),
    ];
    const results = [];
    for (const b of cases) results.push(await processFeedRequest(req({ body: b }), deps));
    for (const r of results) {
      expect(r.status).toBe(403);
      expect(JSON.stringify(r.body)).toBe(JSON.stringify(results[0].body));
      expect(r.headers).toEqual(results[0].headers);
    }
    expect(results[0]).toEqual(LINK_NOT_ACTIVE);
    expect(deps.writes).toHaveLength(0);
  });

  it("a refused delivery for an existing link logs on the patient's record; an unknown link writes only a receipt", async () => {
    await processFeedRequest(req({ body: fixture("results.json", "ITN-LNK-ZZZZZZZZ") }), deps);
    await processFeedRequest(req({ body: fixture("results.json", "ITN-LNK-REVOKED1") }), deps);
    const [unknown, revoked] = deps.refusals;
    expect(unknown).toMatchObject({ reason: "link_not_active", linkId: null, recordLog: null, hospitalId: "h1" });
    expect(revoked).toMatchObject({ reason: "link_not_active", linkId: "l-revoked", recordLog: { recordId: RECORD_ID, actorLabel: H1.hospitalName } });
  });

  it("refusal records carry no idempotency key, so a corrected retry is not blocked", async () => {
    const idem = newIdem();
    await processFeedRequest(req({ idem, body: fixture("results.json", "ITN-LNK-ZZZZZZZZ") }), deps);
    for (const r of deps.refusals) expect(r).not.toHaveProperty("idempotencyKey");
    const retry = await processFeedRequest(req({ idem }), deps);
    expect(retry.status).toBe(202);
  });

  it("a link belonging to another hospital is refused even with that hospital's valid link ref", async () => {
    const r = await processFeedRequest(req({ body: fixture("results.json", "ITN-LNK-ACTIVE01"), key: OTHER_KEY }), deps);
    expect(r).toEqual(LINK_NOT_ACTIVE);
  });

  it("no refusal body contains the patient's name, the record id or any fact content", async () => {
    const bodies = [
      await processFeedRequest(req({ method: "GET", key: null }), deps),
      await processFeedRequest(req({ key: "itnk_wrong" }), deps),
      await processFeedRequest(req({ idem: null }), deps),
      await processFeedRequest(req({ contentType: "text/plain" }), deps),
      await processFeedRequest(req({ raw: "{" }), deps),
      await processFeedRequest(req({ body: fixture("results.json", "ITN-LNK-REVOKED1") }), deps),
      await processFeedRequest(req({ body: { ...fixture("results.json"), type: "batch" } }), deps),
      await processFeedRequest(req(), deps, 10),
    ].map((r) => JSON.stringify(r.body));
    for (const b of bodies) {
      for (const secret of [PATIENT_NAME, RECORD_ID, "Haemoglobin", "11.2", "DEMO-00123", "ITN-LNK", KEY]) expect(b).not.toContain(secret);
    }
  });

  it("a failure to log a refusal never changes the refusal", async () => {
    deps.recordRefusal = async () => {
      throw Object.assign(new Error("db down"), { code: "57P01" });
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await processFeedRequest(req({ key: "itnk_wrong" }), deps)).status).toBe(401);
    expect((await processFeedReadAttempt(deps)).status).toBe(405);
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------- acceptance, replay, races

describe("intake acceptance", () => {
  it("202 with receipt_id and facts_created; facts are provider_entered with the hospital's name", async () => {
    const r = await processFeedRequest(req(), deps);
    expect(r.status).toBe(202);
    expect(r.body).toEqual({ receipt_id: "r1", facts_created: 3 });
    const w = deps.writes[0];
    expect(w).toMatchObject({ hospitalId: "h1", hospitalName: H1.hospitalName, hospitalPatientRef: "DEMO-00123", link: { id: "l-active" } });
    const facts = w.buildFacts("r1");
    expect(facts.every((f) => f.origin === "provider_entered" && f.state === "confirmed" && f.facility_name === H1.hospitalName)).toBe(true);
    expect(r.headers["Cache-Control"]).toBe("no-store");
  });

  it("accepts a link whose stored hospital number matches", async () => {
    expect((await processFeedRequest(req({ body: fixture("results.json", "ITN-LNK-HASMRN01") }), deps)).status).toBe(202);
  });

  it("the same Idempotency-Key again returns 200 with the same receipt and writes nothing", async () => {
    const idem = newIdem();
    const first = await processFeedRequest(req({ idem }), deps);
    const second = await processFeedRequest(req({ idem }), deps);
    expect(first.status).toBe(202);
    expect(second.status).toBe(200);
    expect((second.body as { receipt_id: string }).receipt_id).toBe((first.body as { receipt_id: string }).receipt_id);
    expect(deps.writes).toHaveLength(1);
  });

  it("the same Idempotency-Key from a DIFFERENT hospital is not a replay", async () => {
    deps.findLinkByRef = async () => ({ ...LINKS["ITN-LNK-ACTIVE01"], hospitalId: "h2" });
    const idem = newIdem();
    deps.receipts.set(`h1|${idem}`, { receiptId: "r-h1", factsCreated: 3 });
    const r = await processFeedRequest(req({ idem, key: OTHER_KEY }), deps);
    expect(r.status).toBe(202);
  });

  it("a concurrent duplicate (unique violation) becomes the replay response", async () => {
    const idem = newIdem();
    deps.nextOutcome = { kind: "duplicate" };
    deps.receipts.set(`h1|${idem}`, { receiptId: "r-winner", factsCreated: 3 });
    const real = deps.findAcceptedReceipt;
    let calls = 0;
    deps.findAcceptedReceipt = async (h, k) => (++calls === 1 ? null : real(h, k)); // the first lookup races
    const r = await processFeedRequest(req({ idem }), deps);
    expect(r).toMatchObject({ status: 200, body: { receipt_id: "r-winner", replayed: true } });
  });

  it("a link revoked between the check and the write gives the same 403", async () => {
    deps.nextOutcome = { kind: "link_not_active" };
    const r = await processFeedRequest(req(), deps);
    expect(r).toEqual(LINK_NOT_ACTIVE);
    expect(deps.refusals[0]).toMatchObject({ reason: "link_not_active", linkId: "l-active" });
  });
});

// ---------------------------------------------------------------- write-only by construction

describe("the feed is write-only", () => {
  it("the bundles route exports POST, the 405 handlers and the runtime only", async () => {
    const mod = await import("@/app/api/feed/v1/bundles/route");
    expect(Object.keys(mod).sort()).toEqual(["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT", "runtime"]);
    for (const m of ["GET", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
      const r = await mod[m](new Request(URL_, { method: m }), undefined as never);
      expect(r.status, m).toBe(405);
      expect(r.headers.get("allow")).toBe("POST");
    }
    const head = await mod.HEAD(new Request(URL_, { method: "HEAD" }), undefined as never);
    expect(head.status).toBe(405);
    expect(await head.text()).toBe("");
  });

  it("every method on any other path under /api/feed is 405", async () => {
    const mod = await import("@/app/api/feed/[[...path]]/route");
    for (const m of ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const) {
      const r = await mod[m](new Request("http://localhost/api/feed/v1/patients", { method: m }), undefined as never);
      expect(r.status, m).toBe(405);
    }
  });

  it("no feed module imports anything that reads patient facts, shares or referrals", () => {
    for (const f of readdirSync(path.join("lib", "feed"))) {
      const src = readFileSync(path.join("lib", "feed", f), "utf8");
      expect(src, f).not.toMatch(/from\s+["']@\/lib\/(facts|share|referral|advisory|explain)\//);
    }
  });

  it("the simulated hospital imports nothing from lib/ or app/ and prints the SIMULATED banner", () => {
    const src = readFileSync(path.join("tools", "sim-hospital", "cli.ts"), "utf8");
    expect(src).not.toMatch(/from\s+["'](@\/|\.\.\/\.\.\/)(lib|app)/);
    expect(src).toContain("SIMULATED HOSPITAL (Demo General Hospital): not a real system");
  });
});
