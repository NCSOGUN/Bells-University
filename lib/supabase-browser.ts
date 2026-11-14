"use client";
// The browser Supabase client. AUTH ONLY (D-021): sign up, sign in, sign out, two-step sign-in. All data goes through /api/*.
// createBrowserClient (not createClient) stores the session in a cookie, which is how the server sees who is calling.
// The two NEXT_PUBLIC_ reads are written out literally because Next.js only inlines literal reads.
import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | null = null;

/** One client per tab, created on first use so a missing public variable fails where it is used, not at import. */
export function supabase() {
  if (!client) {
    client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return client;
}
