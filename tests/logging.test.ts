// Error shaping and content-free structured logs (R1 S-08, S-09, N-02; Locked decisions L7, L31).
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConfigError } from "@/lib/config";
import { fieldList, parseBody, withErrors } from "@/lib/http";
import { logEvent, requestContext } from "@/lib/log";

afterEach(() => vi.restoreAllMocks());

const lines = (spy: { mock: { calls: unknown[][] } }) => spy.mock.calls.map((c) => JSON.parse(String(c[0])));

describe("fieldList", () => {
  const schema = z.strictObject({ a: z.string(), nested: z.strictObject({ b: z.number() }) });

  it("names unknown keys of a strict object instead of (body)", () => {
    const r = schema.safeParse({ a: "x", nested: { b: 1 }, origin: "x", state: "y" });
    expect(r.success).toBe(false);
    expect(fieldList(r.error!.issues)).toBe("origin, state");
  });

  it("names nested unknown keys with their path, and missing fields by path", () => {
    const r = schema.safeParse({ nested: { b: "no", extra: 1 } });
    expect(fieldList(r.error!.issues).split(", ").sort()).toEqual(["a", "nested.b", "nested.extra"]);
  });

  it("never includes submitted values", async () => {
    const req = new Request("http://x/api/records", { method: "POST", body: JSON.stringify({ a: "SECRET-VALUE", bogus: "SECRET-2" }) });
    const r = await parseBody(req, schema);
    expect(r.ok).toBe(false);
    const text = await (r as { response: Response }).response.text();
    expect(text).toContain("bogus");
    expect(text).not.toContain("SECRET");
  });
});

describe("logEvent and requestContext", () => {
  it("writes one JSON object per line", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    logEvent("warn", "extraction", { document_id: "d1", facts: 3 });
    expect(lines(warn)).toEqual([{ event: "extraction", document_id: "d1", facts: 3 }]);
  });

  it("takes the path without the query string, and prefers x-vercel-id", () => {
    const req = new Request("http://x/api/records/r1/access-log?limit=5", { headers: { "x-vercel-id": "lhr1::abc" } });
    expect(requestContext(req)).toEqual({ route: "/api/records/r1/access-log", request_id: "lhr1::abc" });
    expect(requestContext(new Request("http://x/a")).request_id).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("withErrors", () => {
  it("a missing env var is a 500 whose log line names the variable (never a value)", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = withErrors(async () => {
      throw new ConfigError("Missing or invalid environment variables: SHARE_PEPPER");
    });
    const res = await h(new Request("http://x/api/shares"), {});
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: { code: "internal_error", message: "Something went wrong. Please try again." } });
    const [line] = lines(err);
    expect(line).toMatchObject({ event: "config_error", route: "/api/shares", detail: expect.stringContaining("SHARE_PEPPER") });
    expect(line.request_id).toBeTruthy();
  });

  it("any other error logs name and Postgres code only, never the message", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = withErrors(async () => {
      throw Object.assign(new Error("duplicate key value (patient text here)"), { code: "23505" });
    });
    const res = await h(new Request("http://x/api/documents"), {});
    expect(res.status).toBe(500);
    const [line] = lines(err);
    expect(line).toMatchObject({ event: "route_error", route: "/api/documents", name: "Error", pg_code: "23505" });
    expect(JSON.stringify(line)).not.toContain("patient text");
  });
});
