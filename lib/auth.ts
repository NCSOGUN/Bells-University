// Patient identity (Locked decision L2). Supabase Auth: the access token comes from an
// `Authorization: Bearer <jwt>` header or the Supabase session cookie (@supabase/ssr), and is VERIFIED with
// Supabase on every call (auth.getUser), never just decoded.
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { env } from "@/lib/config";
import type { Actor } from "./policy";
import { recordIdsForAccount } from "./records";
import { serviceClient } from "./supabase";
import { notFound, unauthenticated } from "./http";

/** The verified Supabase user id, or null. */
export async function getAccountId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const jwt = header.slice(7).trim();
    if (!jwt) return null;
    const { data, error } = await serviceClient().auth.getUser(jwt);
    return error || !data.user ? null : data.user.id;
  }

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  const e = env();
  const sb = createServerClient(e.SUPABASE_URL, e.SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => parseCookieHeader(cookieHeader).map((c) => ({ name: c.name, value: c.value ?? "" })),
      // Route handlers here only read the session; refreshing cookies is the page/browser client's job.
      setAll: () => {},
    },
  });
  const { data, error } = await sb.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

/** Build the holder Actor for can(). */
export async function getHolderActor(request: Request): Promise<Extract<Actor, { kind: "holder" }> | null> {
  const accountId = await getAccountId(request);
  if (!accountId) return null;
  return { kind: "holder", accountId, recordIds: await recordIdsForAccount(accountId) };
}

/** The caller must hold `recordId`: 401 with no identity, 404 if not a member (NFR-06). */
export async function requireHolder(
  request: Request,
  recordId: string,
): Promise<{ ok: true; accountId: string; actor: Extract<Actor, { kind: "holder" }> } | { ok: false; response: Response }> {
  const actor = await getHolderActor(request);
  if (!actor) return { ok: false, response: unauthenticated() };
  if (!actor.recordIds.includes(recordId)) return { ok: false, response: notFound() };
  return { ok: true, accountId: actor.accountId, actor };
}
