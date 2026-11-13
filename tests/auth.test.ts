// Identity verification outcomes (L2, NFR-06). Found live in P12: a slow Supabase Auth made signed-in calls 401.
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { verifiedUserId } from "@/lib/auth";
import { ServiceUnavailableError, withErrors } from "@/lib/http";

const user = { id: "u-1" } as never;

describe("verifiedUserId", () => {
  it("a valid token gives the user id", async () => {
    await expect(verifiedUserId(async () => ({ data: { user }, error: null }))).resolves.toBe("u-1");
  });

  it("a rejected token gives null (401), not an outage", async () => {
    const error = new AuthApiError("invalid JWT", 403, "bad_jwt");
    await expect(verifiedUserId(async () => ({ data: { user: null }, error }))).resolves.toBeNull();
  });

  it("a network failure or 5xx from Auth throws ServiceUnavailableError (503), returned or thrown", async () => {
    const error = new AuthRetryableFetchError("fetch failed", 0);
    await expect(verifiedUserId(async () => ({ data: { user: null }, error }))).rejects.toBeInstanceOf(ServiceUnavailableError);
    await expect(verifiedUserId(async () => Promise.reject(new AuthRetryableFetchError("Bad Gateway", 502)))).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("no answer within the timeout throws ServiceUnavailableError", async () => {
    await expect(verifiedUserId(() => new Promise(() => {}), 20)).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it("an unrelated programming error is not disguised as an outage", async () => {
    await expect(verifiedUserId(async () => Promise.reject(new TypeError("boom")))).rejects.toBeInstanceOf(TypeError);
  });
});

describe("withErrors", () => {
  it("maps ServiceUnavailableError to 503 service_unavailable with Retry-After, no detail leaked", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const h = withErrors(async () => {
      throw new ServiceUnavailableError("auth");
    });
    const r = await h(new Request("http://x"), {});
    expect(r.status).toBe(503);
    expect(r.headers.get("retry-after")).toBe("5");
    expect((await r.json()).error.code).toBe("service_unavailable");
    spy.mockRestore();
  });
});
