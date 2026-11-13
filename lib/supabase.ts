// Server-only Supabase clients. The service-role (secret) key never reaches the browser.
// The project uses the newer `sb_secret_` / `sb_publishable_` key format; supabase-js 2.119 accepts them
// (verified live, docs/DEVIATIONS.md D-010).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/config";

/** Deadline for any one Storage or Auth-admin HTTP call (R1 S-06). Auth verification has its own, shorter
 *  race in lib/auth.ts (8 s); this one stops a stalled Storage upload or download from holding a request
 *  until the platform kills it. A timeout surfaces as the existing 502 storage_failed / extraction_failed. */
export const SERVICE_FETCH_TIMEOUT_MS = 20_000;

/** fetch with a deadline, combined with any signal the caller passed. */
export function fetchWithTimeout(timeoutMs = SERVICE_FETCH_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const deadline = AbortSignal.timeout(timeoutMs);
    const signal = init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    return fetch(input, { ...init, signal });
  };
}

let service: SupabaseClient | undefined;

/** Service-role client: Storage and the Auth admin API. Bypasses RLS; use only on the server. */
export function serviceClient(): SupabaseClient {
  if (!service) {
    const e = env();
    service = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout() },
    });
  }
  return service;
}

export const DOCUMENTS_BUCKET = "documents";
