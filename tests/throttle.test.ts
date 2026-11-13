// The pure part of `npm run throttle` (P12 item 3): a number appears in the evidence only if it was measured.
import { describe, expect, it } from "vitest";
import { FAST_3G, kbitToBytesPerSecond, nfr10Verdict, nfr11Verdict, renderThrottleReport, slowest, type DocTiming } from "../scripts/throttle-report";

const doc = (file: string, totalMs: number | null, o: Partial<DocTiming> = {}): DocTiming => ({
  file, bytes: 90 * 1024, uploadMs: totalMs === null ? null : 4000, extractMs: totalMs === null ? null : totalMs - 4000, totalMs, facts: totalMs === null ? null : 4, error: null, ...o,
});

describe("NFR-10 verdict (the slowest document decides)", () => {
  it("is WITHIN when every document completed and the slowest is at most 30 s", () => {
    const v = nfr10Verdict([doc("a", 14000), doc("b", 29900), doc("c", 21000)]);
    expect(v.status).toBe("WITHIN");
    expect(v.line).toContain("slowest 29.9 s");
  });

  it("is OVER when the slowest is past 30 s, even if the others are fine", () => {
    expect(nfr10Verdict([doc("a", 8000), doc("b", 30001)]).status).toBe("OVER");
  });

  it("a failed document makes it INCOMPLETE, never WITHIN, and the failure is counted", () => {
    const v = nfr10Verdict([doc("a", 9000), doc("b", null, { error: "extract_failed_502_extraction_failed" })]);
    expect(v.status).toBe("INCOMPLETE");
    expect(v.line).toContain("1 failed and not timed");
  });

  it("OVER still wins over a failure; nothing run or all failed is NOT MEASURED", () => {
    expect(nfr10Verdict([doc("a", 45000), doc("b", null, { error: "x" })]).status).toBe("OVER");
    expect(nfr10Verdict([]).status).toBe("NOT MEASURED");
    expect(nfr10Verdict([doc("a", null, { error: "x" })]).status).toBe("NOT MEASURED");
  });

  it("slowest ignores failed documents", () => {
    expect(slowest([doc("a", 5000), doc("b", null, { error: "x" }), doc("c", 7000)])?.file).toBe("c");
    expect(slowest([doc("a", null, { error: "x" })])).toBeNull();
  });
});

describe("NFR-11 verdict", () => {
  it("is SKIPPED, with the exact words, when /v is not built, and never a number", () => {
    expect(nfr11Verdict(null)).toEqual({ status: "SKIPPED", line: "NFR-11: SKIPPED: /v not built" });
  });
  it("needs both under 300 KB and under 5 s", () => {
    expect(nfr11Verdict({ bytes: 200 * 1024, firstRenderMs: 4000 }).status).toBe("WITHIN");
    expect(nfr11Verdict({ bytes: 301 * 1024, firstRenderMs: 1000 }).status).toBe("OVER");
    expect(nfr11Verdict({ bytes: 100 * 1024, firstRenderMs: 5000 }).status).toBe("OVER");
  });
});

describe("the report", () => {
  const base = { date: "2026-11-13", baseUrl: "http://localhost:3000", serverMode: "production build", models: ["gemini-3.5-flash-lite"], network: FAST_3G, floorMs: 1300, viewer: null };

  it("says it is an approximation, names the date and the model, and shows every document including failures", () => {
    const md = renderThrottleReport({ ...base, docs: [doc("a.jpg", 20000), doc("b.jpg", null, { error: "upload_failed_413_file_too_large" })] });
    expect(md).toContain("an approximation of Chrome's Fast 3G preset");
    expect(md).toContain("Date: 2026-11-13");
    expect(md).toContain("`gemini-3.5-flash-lite`");
    expect(md).toContain("| b.jpg | 90 KB | n/a | n/a | n/a | n/a | upload_failed_413_file_too_large |");
    expect(md).toContain("NFR-11: SKIPPED: /v not built");
  });

  it("an unmeasured value is shown as n/a or not recorded, never as a number", () => {
    const md = renderThrottleReport({ ...base, models: [], floorMs: null, docs: [doc("a.jpg", null, { error: "fixture_missing", bytes: 0 })] });
    expect(md).toContain("Model recorded by the server: not recorded");
    expect(md).toContain("under the same throttle): n/a");
    expect(md).toContain("NFR-10: NOT MEASURED");
  });

  it("states that only the browser-to-server link is throttled", () => {
    expect(renderThrottleReport({ ...base, docs: [doc("a", 1000)] })).toMatch(/Only the browser-to-server link is throttled/);
  });
});

describe("the throttle values", () => {
  it("converts kbit/s to bytes/s for the DevTools Protocol", () => {
    expect(kbitToBytesPerSecond(1600)).toBe(200_000);
    expect(kbitToBytesPerSecond(750)).toBe(93_750);
    expect(FAST_3G.latencyMs).toBe(562);
  });
});
