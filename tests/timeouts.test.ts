// Outbound calls to Supabase have a deadline (R1 S-06). No network: global fetch is stubbed.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout, SERVICE_FETCH_TIMEOUT_MS } from "@/lib/supabase";

/** A fetch that never answers, and rejects with the signal's reason when aborted (as real fetch does). */
const hangingFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  }),
);

afterEach(() => {
  vi.unstubAllGlobals();
  hangingFetch.mockClear();
});

describe("fetchWithTimeout", () => {
  it("aborts a call that does not answer in time", async () => {
    vi.stubGlobal("fetch", hangingFetch);
    await expect(fetchWithTimeout(20)("https://example.invalid/storage")).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("still honours the caller's own abort signal", async () => {
    vi.stubGlobal("fetch", hangingFetch);
    const ctl = new AbortController();
    const p = fetchWithTimeout(10_000)("https://example.invalid/storage", { signal: ctl.signal });
    ctl.abort(new Error("caller gave up"));
    await expect(p).rejects.toThrow("caller gave up");
  });

  it("passes the request through unchanged apart from the signal", async () => {
    const ok = vi.fn(async () => new Response("ok"));
    vi.stubGlobal("fetch", ok);
    await fetchWithTimeout()("https://example.invalid/x", { method: "PUT", headers: { a: "b" } });
    const [, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.headers).toEqual({ a: "b" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("the default deadline sits above the 8 s auth race and well inside the 120 s extraction budget", () => {
    expect(SERVICE_FETCH_TIMEOUT_MS).toBeGreaterThan(8_000);
    expect(SERVICE_FETCH_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
  });
});
