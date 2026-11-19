import { runCareCheck, type CareCheckInput, type CareCheckResult } from "./care-check";

const SERVER_TIMEOUT_MS = 4000;

export type CareCheckOutcome =
  | { ok: true; result: CareCheckResult }
  | { ok: false; errors: string[] };

/**
 * Asks the server for a Care Check and falls back to running the same rules on
 * this device when there's no connection (or the demo's offline switch is on),
 * so a nurse in a low-signal area still gets the check. The result says which
 * one produced it.
 */
export async function requestCareCheck(
  input: CareCheckInput,
  options: { offline: boolean; signal?: AbortSignal },
): Promise<CareCheckOutcome> {
  if (options.offline) return { ok: true, result: runCareCheck(input, "on-device") };

  try {
    const timeout = AbortSignal.timeout(SERVER_TIMEOUT_MS);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const response = await fetch("/api/care-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (response.status === 422) {
      const body = (await response.json()) as { errors?: string[] };
      return { ok: false, errors: body.errors ?? ["Those readings were not accepted."] };
    }
    if (!response.ok) throw new Error(`care-check ${response.status}`);
    const body = (await response.json()) as CareCheckResult;
    return { ok: true, result: { ...body, source: "server" } };
  } catch (error) {
    // A cancelled request is the caller moving on, not a network failure.
    if (options.signal?.aborted) throw error;
    return { ok: true, result: runCareCheck(input, "on-device") };
  }
}
