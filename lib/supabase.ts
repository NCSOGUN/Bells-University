// Server-only Supabase clients. The service-role (secret) key never reaches the browser.
// The project uses the newer `sb_secret_` / `sb_publishable_` key format; that supabase-js 2.119
// accepts them in createClient is UNVERIFIED until storage:init runs (docs/DEVIATIONS.md).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/config";

let service: SupabaseClient | undefined;

/** Service-role client: Storage and the Auth admin API. Bypasses RLS; use only on the server. */
export function serviceClient(): SupabaseClient {
  if (!service) {
    const e = env();
    service = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return service;
}

export const DOCUMENTS_BUCKET = "documents";
