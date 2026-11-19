import { RECORD_CACHE, recordCacheKey } from "./push-message";
import type { VisitUpdate } from "./visit-update";

// Browser side of visit notifications: turning them on for this phone, sending
// one after a visit, and reading back the record a notification carried.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport = "supported" | "unsupported" | "ios-needs-install";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ok) return "supported";
  // iPhone only offers web notifications to a site added to the Home Screen.
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return ios ? "ios-needs-install" : "unsupported";
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
  return navigator.serviceWorker.ready;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport() !== "supported") return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export interface ServerStatus {
  ready: boolean;
  problem?: string;
  phones: number;
}

export async function serverStatus(): Promise<ServerStatus> {
  try {
    const res = await fetch("/api/push/phones", { cache: "no-store" });
    return (await res.json()) as ServerStatus;
  } catch {
    return { ready: false, problem: "Couldn't reach CareCircle. Check this phone's internet.", phones: 0 };
  }
}

export type TurnOnResult = { ok: true } | { ok: false; reason: "denied" | "no-key" | "failed"; message?: string };

/** Asks for permission, subscribes this phone and tells the server about it. */
export async function turnOnNotifications(): Promise<TurnOnResult> {
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: "no-key" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  try {
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    const res = await fetch("/api/push/phones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: "failed", message: body.error };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function turnOffNotifications(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await fetch("/api/push/phones", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  }).catch(() => undefined);
  await sub.unsubscribe();
}

export interface SendResult {
  sent: number;
  failed?: number;
  error?: string;
}

async function send(body: unknown): Promise<SendResult> {
  try {
    const res = await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as SendResult;
  } catch {
    return { sent: 0, error: "No internet connection." };
  }
}

/** Sends the family's phone a notification for a submitted visit. */
export const sendVisitNotification = (update: VisitUpdate) => send({ update });

export const sendTestNotification = () => send({ test: true });

/** The visit record a notification brought to this phone, if it is still here. Read once. */
export async function takeDeliveredRecord(updateId: string): Promise<VisitUpdate | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(RECORD_CACHE);
    const res = await cache.match(recordCacheKey(updateId));
    if (!res) return null;
    const update = (await res.json()) as VisitUpdate;
    await cache.delete(recordCacheKey(updateId));
    return update?.visit?.id ? update : null;
  } catch {
    return null;
  }
}
