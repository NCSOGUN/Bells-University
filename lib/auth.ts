// Patient identity (Locked decision L2). Supabase Auth: the access token comes from an
// `Authorization: Bearer <jwt>` header or the Supabase session cookie (@supabase/ssr), and is VERIFIED with
// Supabase on every call (auth.getUser), never just decoded.
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";
import { env } from "@/lib/config";
import type { Actor } from "./policy";
import { recordIdsForAccount } from "./records";
import { serviceClient } from "./supabase";
import { notFound, ServiceUnavailableError, unauthenticated } from "./http";

/** How long we wait for Supabase Auth before answering 503 (seen live: 10 to 45 s stalls from Nigeria). */
export const AUTH_TIMEOUT_MS = 8000;

type GetUserResult = { data: { user: User | null }; error: unknown };

/** Run a getUser call. A rejected token gives null (401); a network failure, a 5xx or no answer in time
 *  throws ServiceUnavailableError (503), so a signed-in patient is never told they are signed out. */
export async function verifiedUserId(call: () => Promise<GetUserResult>, timeoutMs = AUTH_TIMEOUT_MS): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ServiceUnavailableError("auth")), timeoutMs);
  });
  let result: GetUserResult;
  try {
    result = await Promise.race([call(), timeout]);
  } catch (e) {
    if (e instanceof ServiceUnavailableError || isAuthRetryableFetchError(e)) throw new ServiceUnavailableError("auth");
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (result.error) {
    if (isAuthRetryableFetchError(result.error)) throw new ServiceUnavailableError("auth");
    return null;
  }
  return result.data.user?.id ?? null;
}

/** The verified Supabase user id, or null. Throws ServiceUnavailableError when Auth cannot be reached. */
export async function getAccountId(request: Request): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const jwt = header.slice(7).trim();
    if (!jwt) return null;
    return verifiedUserId(() => serviceClient().auth.getUser(jwt));
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
  return verifiedUserId(() => sb.auth.getUser());
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
