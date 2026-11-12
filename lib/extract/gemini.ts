// C06 extraction adapter. The ONLY file that talks to a model provider (design rule: "keep extraction
// behind one adapter"). Swap the provider or prompt by changing this file and prompt.ts.
// Gemini transcribes a document the patient already holds; it never explains or advises (hard rule 1).
// Never log the response body, the prompt, the file or the key (Locked decision L31).
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { geminiEnv } from "@/lib/config";
import { PROMPT_V1 } from "./prompt";
import { modelJsonSchema } from "./schema";

export type ExtractMime = "image/jpeg" | "image/png" | "application/pdf";

export interface ExtractInput {
  bytes: Uint8Array;
  mime: ExtractMime;
}

export interface ExtractResult {
  /** Parsed JSON exactly as the model returned it. NOT yet validated: run parseModelOutput() then applyGuards(). */
  raw: unknown;
  model: string;
  ms: number;
}

export type ExtractionErrorCode = "model_unavailable" | "model_timeout" | "model_output_invalid";

/** Carries a code and an HTTP status only: never provider messages or document text. */
export class ExtractionError extends Error {
  constructor(
    public readonly code: ExtractionErrorCode,
    public readonly httpStatus?: number,
  ) {
    super(`extraction failed: ${code}${httpStatus ? ` (${httpStatus})` : ""}`);
    this.name = "ExtractionError";
  }
}

const ATTEMPT_TIMEOUT_MS = 60_000; // abort one call after 60 s
const MAX_RETRIES = 3; // after the first try, on 429 or 5xx
const BACKOFF_MS = [1000, 2000, 4000];
const TOTAL_BUDGET_MS = 100_000; // never start a retry that cannot finish inside the route's maxDuration (120 s)

export interface AdapterDeps {
  /** Replace the provider call in tests. Returns the model's response text. */
  generate?: (input: ExtractInput, model: string, apiKey: string) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function retryable(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  // Dropped connection before any HTTP status ("fetch failed").
  return err instanceof TypeError;
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

async function callGemini(input: ExtractInput, model: string, apiKey: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { data: Buffer.from(input.bytes).toString("base64"), mimeType: input.mime } },
          { text: "Transcribe this document into the schema." },
        ],
      },
    ],
    config: {
      systemInstruction: PROMPT_V1,
      temperature: 0,
      responseMimeType: "application/json",
      responseJsonSchema: modelJsonSchema(),
      // Less "thinking" means less latency (NFR-10) and nothing to gain for a transcription task.
      // Whether this model accepts MINIMAL is UNVERIFIED until the live call in docs/progress/P2.md.
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      // We own the retry policy below, so switch the SDK's own retries off.
      httpOptions: { retryOptions: { attempts: 1 } },
    },
  });
  return res.text ?? "";
}

/** Read one document into raw model JSON. The one function the rest of the app calls. */
export async function extractDocument(input: ExtractInput, deps: AdapterDeps = {}): Promise<ExtractResult> {
  const { GEMINI_API_KEY, GEMINI_MODEL } = geminiEnv();
  const generate = deps.generate ?? callGemini;
  const sleep = deps.sleep ?? realSleep;
  const now = deps.now ?? Date.now;
  const started = now();

  for (let attempt = 0; ; attempt++) {
    try {
      const text = await generate(input, GEMINI_MODEL, GEMINI_API_KEY);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        throw new ExtractionError("model_output_invalid");
      }
      return { raw, model: GEMINI_MODEL, ms: now() - started };
    } catch (err) {
      if (err instanceof ExtractionError) throw err;
      if (isTimeout(err)) throw new ExtractionError("model_timeout");
      const status = err instanceof ApiError ? err.status : undefined;
      const delay = BACKOFF_MS[attempt];
      const canRetry = retryable(err) && attempt < MAX_RETRIES && now() - started + delay < TOTAL_BUDGET_MS;
      if (!canRetry) throw new ExtractionError("model_unavailable", status);
      await sleep(delay);
    }
  }
}
