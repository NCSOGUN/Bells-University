// Viewer sessions (FR-12, Locked decisions L8, L11). PURE helpers: token, cookie, and the decision.
// The cookie is never trusted alone: resolveViewer re-checks the share on every request, so a revoked or expired
// code stops working on the very next request (FR-11).
import { VIEWER_SESSION_MINUTES } from "@/lib/config";
import { randomToken, sha256Hex } from "@/lib/crypto";
import type { Actor } from "@/lib/policy";
import { evaluateShare } from "./evaluate";

export const VIEWER_COOKIE = "itan_v";

/** 32 random bytes base64url. Only sha256Hex(token) is stored. */
export const newViewerToken = () => randomToken(32);
export const hashViewerToken = (token: string) => sha256Hex(token);

/** Session lifetime: min(30 minutes, time until the share expires) (L11). */
export function sessionExpiry(now: Date, shareExpiresAt: Date): Date {
  return new Date(Math.min(now.getTime() + VIEWER_SESSION_MINUTES * 60_000, shareExpiresAt.getTime()));
}

export function cookieOptions(expiresAt: Date, now: Date) {
  return {
    name: VIEWER_COOKIE,
    httpOnly: true,
    // Secure everywhere except local http development, where browsers refuse to store it.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

export function serializeCookie(token: string, o: ReturnType<typeof cookieOptions>): string {
  return [
    `${o.name}=${token}`,
    `Max-Age=${o.maxAge}`,
    `Path=${o.path}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(o.secure ? ["Secure"] : []),
  ].join("; ");
}

export function readViewerCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === VIEWER_COOKIE) return part.slice(i + 1).trim() || null;
  }
  return null;
}

export interface SessionRow {
  token_hash: string;
  viewer_name: string;
  practice_no: string;
  expires_at: Date;
}
export interface SessionShare {
  id: string;
  record_id: string;
  purpose: "general" | "referral";
  referral_id: string | null;
  expires_at: Date;
  revoked_at: Date | null;
  hiddenCategories: string[];
  hiddenDocumentIds: string[];
}

export interface ViewerContext {
  actor: Extract<Actor, { kind: "clinician" }>;
  viewer: { name: string; practiceNo: string; sessionId: string };
  share: { id: string; expiresAt: Date; hiddenCategories: string[]; hiddenDocumentIds: string[]; referralId: string | null };
  recordId: string;
  purpose: "general" | "referral";
}

export type ViewerResult = ({ ok: true } & ViewerContext) | { ok: false; reason: "no_cookie" | "session_expired" | "share_expired" | "share_revoked" };

/** The decision, given what was loaded. Order: unknown session, session expiry, share revoked, share expired. */
export function resolveViewer(session: SessionRow | null, share: SessionShare | null, now: Date): ViewerResult {
  if (!session || !share) return { ok: false, reason: "no_cookie" };
  const status = evaluateShare(share, now);
  if (status === "revoked") return { ok: false, reason: "share_revoked" };
  if (status === "expired") return { ok: false, reason: "share_expired" };
  if (now.getTime() >= session.expires_at.getTime()) return { ok: false, reason: "session_expired" };
  return {
    ok: true,
    actor: { kind: "clinician", viewerSessionId: session.token_hash, shareId: share.id, recordId: share.record_id, shareValid: true, purpose: share.purpose },
    viewer: { name: session.viewer_name, practiceNo: session.practice_no, sessionId: session.token_hash },
    share: { id: share.id, expiresAt: share.expires_at, hiddenCategories: share.hiddenCategories, hiddenDocumentIds: share.hiddenDocumentIds, referralId: share.referral_id },
    recordId: share.record_id,
    purpose: share.purpose,
  };
}
