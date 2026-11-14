"use client";
// Same-origin calls to /api/* for the patient screens (docs/HANDOVER-DEV-A.md sections 4 and 5).
// 401: refresh the session once and retry; still 401 means "sign in again". 503: Supabase Auth was slow, the user is NOT
// signed out, so we wait for Retry-After and try again before giving up.
import type { ApiError } from "@/lib/api-types";
import { supabase } from "@/lib/supabase-browser";

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter: number | null = null,
  ) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const send = (path: string, init: RequestInit) => fetch(path, { credentials: "same-origin", ...init });

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  let res = await send(path, init);
  if (res.status === 401) {
    await supabase().auth.refreshSession();
    res = await send(path, init);
  }
  for (let i = 0; i < 2 && res.status === 503; i++) {
    await sleep((Number(res.headers.get("retry-after")) || 5) * 1000);
    res = await send(path, init);
  }
  return res;
}

async function failure(res: Response): Promise<ApiFailure> {
  let code = "internal_error";
  let message = "Something went wrong. Please try again.";
  try {
    const body = (await res.json()) as ApiError;
    code = body.error.code;
    message = body.error.message;
  } catch {
    // not JSON: keep the generic message
  }
  const ra = Number(res.headers.get("retry-after"));
  return new ApiFailure(res.status, code, message, Number.isFinite(ra) && ra > 0 ? ra : null);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

export const getJson = <T>(path: string) => api<T>(path);

export const postJson = <T>(path: string, body?: unknown) =>
  api<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export const deleteJson = <T>(path: string) => api<T>(path, { method: "DELETE" });

export const isUnauthenticated = (e: unknown) => e instanceof ApiFailure && e.status === 401;

/** Plain words for the person. Never shows raw server text for transport-level failures. */
export function describeError(e: unknown): string {
  if (e instanceof ApiFailure) {
    switch (e.code) {
      case "unauthenticated":
        return "Please sign in again.";
      case "service_unavailable":
        return "Sign-in could not be checked just now. Please try again.";
      case "consent_required":
        return "Please accept the consent screen first.";
      case "unsupported_type":
        return "This file is not a JPEG, PNG or PDF.";
      case "file_too_large":
        return "This file is too large. Photos must be under 1 MB and PDFs under 4 MB.";
      case "too_many_attempts":
        return "Too many attempts. Please wait a few minutes and try again.";
      case "mfa_required":
        return "Enter your two-step code first.";
      case "extraction_in_progress":
        return "This document is still being read. Please wait a moment.";
      default:
        return e.message;
    }
  }
  return "No connection, or something went wrong. Please try again.";
}
