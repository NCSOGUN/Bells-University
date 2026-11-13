import { ApiError } from "@google/genai";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ExtractionError, extractDocument } from "@/lib/extract/gemini";
import { PROMPT_V1, PROMPT_VERSION } from "@/lib/extract/prompt";
import { modelJsonSchema, parseModelOutput } from "@/lib/extract/schema";

const input = { bytes: new Uint8Array([1, 2, 3]), mime: "application/pdf" as const };
const good = JSON.stringify({ doc_type: "lab_report", facility_as_printed: null, document_date_as_printed: null, items: [], referral: null });
const api = (status: number) => new ApiError({ message: "x", status });

let saved: NodeJS.ProcessEnv;
beforeEach(() => {
  saved = { ...process.env };
  process.env.GEMINI_API_KEY = "test-key";
  process.env.GEMINI_MODEL = "test-model";
});
afterEach(() => {
  process.env = saved;
});

function harness(script: (Error | string)[]) {
  const sleeps: number[] = [];
  let calls = 0;
  return {
    sleeps,
    calls: () => calls,
    deps: {
      generate: async () => {
        const step = script[Math.min(calls++, script.length - 1)];
        if (typeof step === "string") return step;
        throw step;
      },
      sleep: async (ms: number) => void sleeps.push(ms),
    },
  };
}

describe("extractDocument adapter", () => {
  it("returns the parsed JSON, model name and elapsed time", async () => {
    const h = harness([good]);
    const r = await extractDocument(input, h.deps);
    expect(r.model).toBe("test-model");
    expect(r.raw).toEqual(JSON.parse(good));
    expect(typeof r.ms).toBe("number");
  });

  it("retries 5xx and 429 with 1 s, 2 s, 4 s backoff, then succeeds", async () => {
    const h = harness([api(503), api(429), api(500), good]);
    await extractDocument(input, h.deps);
    expect(h.calls()).toBe(4);
    expect(h.sleeps).toEqual([1000, 2000, 4000]);
  });

  it("gives up after 3 retries with model_unavailable", async () => {
    const h = harness([api(503)]);
    await expect(extractDocument(input, h.deps)).rejects.toMatchObject({ code: "model_unavailable", httpStatus: 503 });
    expect(h.calls()).toBe(4);
  });

  it("does not retry a 400", async () => {
    const h = harness([api(400)]);
    await expect(extractDocument(input, h.deps)).rejects.toMatchObject({ code: "model_unavailable", httpStatus: 400 });
    expect(h.calls()).toBe(1);
  });

  it("retries a timeout once, then succeeds", async () => {
    const h = harness([new DOMException("timed out", "TimeoutError"), good]);
    await extractDocument(input, h.deps);
    expect(h.calls()).toBe(2);
  });

  it("two timeouts in a row give model_timeout (no endless waiting)", async () => {
    const h = harness([new DOMException("timed out", "TimeoutError")]);
    await expect(extractDocument(input, h.deps)).rejects.toMatchObject({ code: "model_timeout" });
    expect(h.calls()).toBe(2);
  });

  it("maps non-JSON text to model_output_invalid", async () => {
    const h = harness(["not json"]);
    await expect(extractDocument(input, h.deps)).rejects.toBeInstanceOf(ExtractionError);
    await expect(extractDocument(input, harness(["not json"]).deps)).rejects.toMatchObject({ code: "model_output_invalid" });
  });

  it("errors carry a code and status only, never provider text", async () => {
    const h = harness([new ApiError({ message: "SECRET DOCUMENT TEXT", status: 400 })]);
    const err = await extractDocument(input, h.deps).catch((e) => e);
    expect(String(err.message)).not.toMatch(/SECRET/);
  });

  it("names the missing variable when GEMINI_MODEL is unset (no guessing)", async () => {
    process.env.GEMINI_MODEL = "";
    await expect(extractDocument(input, harness([good]).deps)).rejects.toThrow(/GEMINI_MODEL/);
  });
});

describe("prompt and schema", () => {
  it("prompt.ts is an exact copy of prompt-v1.md", () => {
    const md = readFileSync("lib/extract/prompt-v1.md", "utf8").replace(/\r\n/g, "\n").trimEnd();
    expect(PROMPT_V1).toBe(md);
    expect(PROMPT_VERSION).toBe("v1");
  });

  it("the prompt forbids the things the design forbids", () => {
    for (const phrase of ["Copy only what is printed", "readable to false", "Never infer", "source_quote", "urgency_as_written must be null", "Do not give opinions"]) {
      expect(PROMPT_V1).toContain(phrase);
    }
  });

  it("the JSON schema has no $schema key and no numeric derived fields", () => {
    const s = JSON.stringify(modelJsonSchema());
    expect(s).not.toContain("$schema");
    expect(s).not.toContain("value_num");
    expect(s).not.toContain("range_low");
  });

  it("parseModelOutput accepts valid output and reports paths, not content, for invalid", () => {
    expect(parseModelOutput(JSON.parse(good)).ok).toBe(true);
    const bad = parseModelOutput({ doc_type: "lab_report", items: [{ label_as_printed: "SECRET VALUE" }] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.issues.join(" ")).not.toContain("SECRET");
  });
});
