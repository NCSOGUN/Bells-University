// Response helpers for route handlers (Locked decision L7).
// Every error is { "error": { "code": string, "message": string } }. Messages never contain record content,
// codes, tokens or keys (L31).
import type { z } from "zod";
import { ConfigError } from "./config";
import { logEvent, requestContext } from "./log";
import type { Decision } from "./policy";

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export function errorResponse(code: string, message: string, status: number, headers: HeadersInit = {}): Response {
  return json({ error: { code, message } }, status, headers);
}

export const unauthenticated = () => errorResponse("unauthenticated", "Sign in to continue.", 401);
export const notFound = () => errorResponse("not_found", "Not found.", 404);
export const forbidden = (code = "forbidden", message = "You do not have permission to do this.") =>
  errorResponse(code, message, 403);

/** Turn a denied can() decision into the right response. */
export function denied(d: Decision): Response {
  if (d.status === 401) return unauthenticated();
  if (d.status === 404) return notFound();
  if (d.reason === "provider_entered_immutable") {
    return forbidden("provider_entered_immutable", "This was sent by a hospital and cannot be changed. You can mark it as disputed.");
  }
  return forbidden(d.reason === "not_a_holder" ? "forbidden" : d.reason);
}

/** Parse a JSON body with a Zod schema. Returns the data or a 400 response. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false, response: errorResponse("invalid_request", "The request body must be JSON.", 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: errorResponse("invalid_request", `Invalid or missing fields: ${fieldList(parsed.error.issues)}`, 400) };
  }
  return { ok: true, data: parsed.data };
}

/** The field names a Zod failure is about, never the submitted values. An unknown key in a strict object has an
 *  empty path, so its own name is used instead of "(body)" (R1 N-02). */
export function fieldList(issues: readonly z.core.$ZodIssue[]): string {
  const names = issues.flatMap((i) => {
    const at = i.path.map(String).join(".");
    if (i.code === "unrecognized_keys") return i.keys.map((k) => (at ? `${at}.${k}` : k));
    return [at || "(body)"];
  });
  return [...new Set(names)].join(", ");
}

type Handler<C> = (request: Request, ctx: C) => Promise<Response>;

/** A dependency we must check (Supabase Auth) could not be reached in time. Becomes 503, never 401:
 *  a signed-in patient on a poor connection must not be told they are signed out. */
export class ServiceUnavailableError extends Error {
  constructor(public readonly dependency: string) {
    super(`${dependency} unavailable`);
    this.name = "ServiceUnavailableError";
  }
}

/** Wrap a route handler: an unexpected throw becomes a 500 with no detail leaked. Each failure is one JSON log
 *  line with the route path and a request id (R1 S-09), so concurrent failures can be told apart. */
export function withErrors<C>(handler: Handler<C>): Handler<C> {
  return async (request, ctx) => {
    try {
      return await handler(request, ctx);
    } catch (e) {
      const where = requestContext(request);
      if (e instanceof ServiceUnavailableError) {
        logEvent("error", "dependency_unavailable", { ...where, dependency: e.dependency });
        return errorResponse("service_unavailable", "We could not check your sign-in just now. Please try again.", 503, { "Retry-After": "5" });
      }
      if (e instanceof ConfigError) {
        // The message names missing variables only, never values (R1 S-08).
        logEvent("error", "config_error", { ...where, detail: e.message });
        return errorResponse("internal_error", "Something went wrong. Please try again.", 500);
      }
      // Name and Postgres code only (L31): no message, which could contain data.
      logEvent("error", "route_error", { ...where, name: (e as Error)?.name ?? "unknown", pg_code: (e as { code?: string })?.code ?? null });
      return errorResponse("internal_error", "Something went wrong. Please try again.", 500);
    }
  };
}

/** Next.js 16: route params arrive as a Promise (L32). */
export type RouteCtx<P extends Record<string, string>> = { params: Promise<P> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: string) => UUID_RE.test(s);
