// D-021: the browser signs in with @supabase/ssr (createBrowserClient), which stores the session in a cookie.
// getAccountId must read that cookie, and the Bearer fallback must still work. Supabase is stubbed (no network):
// the cookie is produced by the real @supabase/ssr library so the name, encoding and chunking are the real ones.
import { createServerClient } from "@supabase/ssr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountId } from "@/lib/auth";
import { resetEnvCache } from "@/lib/config";
import { touchesBucket } from "@/scripts/rls-check";

const URL_ = "https://abcdefgh.supabase.co";
const ENV = {
  DATABASE_URL: "postgres://x", SUPABASE_URL: URL_, SUPABASE_ANON_KEY: "anon", SUPABASE_SERVICE_ROLE_KEY: "service",
  GEMINI_API_KEY: "g", GEMINI_MODEL: "m", SHARE_PEPPER: "p".repeat(20), DEMO_PASSWORD: "password-1",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const user = { id: "u-cookie", aud: "authenticated", role: "authenticated", email: "a@b.example", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" };

let seen: { url: string; auth: string | null }[];

beforeEach(() => {
  seen = [];
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  resetEnvCache();
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
    if (url.includes("/auth/v1/user")) return json(user);
    return json({ error: "unexpected" }, 500);
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetEnvCache();
});

/** Sign in through the real @supabase/ssr client against a stubbed token endpoint; return the Cookie header. */
async function browserCookieHeader(): Promise<string> {
  const jar = new Map<string, string>();
  const session = { access_token: "access-jwt", refresh_token: "refresh", token_type: "bearer", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user };
  const sb = createServerClient(URL_, "anon", {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (cs) => cs.forEach((c) => jar.set(c.name, c.value)) },
    global: { fetch: async () => json(session) },
  });
  const { error } = await sb.auth.signInWithPassword({ email: "a@b.example", password: "password-1" });
  expect(error).toBeNull();
  expect([...jar.keys()].some((n) => /^sb-abcdefgh-auth-token/.test(n))).toBe(true);
  return [...jar].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
}

describe("getAccountId reads the @supabase/ssr session cookie (D-021)", () => {
  it("a session cookie from the browser client gives the verified user id, checked with Supabase", async () => {
    const cookie = await browserCookieHeader();
    await expect(getAccountId(new Request("http://x/api/records", { headers: { cookie } }))).resolves.toBe("u-cookie");
    const call = seen.find((c) => c.url.includes("/auth/v1/user"));
    expect(call, "the token was verified with Supabase, not just decoded").toBeDefined();
    expect(call?.auth).toBe("Bearer access-jwt");
  });

  it("the Bearer header still works (the fallback) and wins over a cookie", async () => {
    const cookie = await browserCookieHeader();
    seen = [];
    await expect(getAccountId(new Request("http://x/api/records", { headers: { authorization: "Bearer from-header", cookie } }))).resolves.toBe("u-cookie");
    expect(seen.find((c) => c.url.includes("/auth/v1/user"))?.auth).toBe("Bearer from-header");
  });

  it("no credentials, an empty Bearer, or an unrelated cookie give null (401), with no call to Supabase", async () => {
    await expect(getAccountId(new Request("http://x"))).resolves.toBeNull();
    await expect(getAccountId(new Request("http://x", { headers: { authorization: "Bearer " } }))).resolves.toBeNull();
    await expect(getAccountId(new Request("http://x", { headers: { cookie: "theme=dark; itan_v=abc" } }))).resolves.toBeNull();
    expect(seen).toEqual([]);
  });
});

describe("rls-check: which storage policies reach the documents bucket", () => {
  it("flags a policy that names the bucket, or names no bucket at all", () => {
    expect(touchesBucket({ qual: "(bucket_id = 'documents'::text)", with_check: null }, "documents")).toBe(true);
    expect(touchesBucket({ qual: "true", with_check: null }, "documents")).toBe(true);
    expect(touchesBucket({ qual: null, with_check: null }, "documents")).toBe(true);
  });
  it("does not flag a policy limited to another bucket", () => {
    expect(touchesBucket({ qual: "(bucket_id = 'avatars'::text)", with_check: null }, "documents")).toBe(false);
  });
});
