// Server only: imported by the /api/push routes, never by a client component.
import { Redis } from "@upstash/redis";
import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";

// The phones that have turned on visit notifications. What's stored is each
// phone's push address and keys, nothing else: no name, number or reading.
// Kept in Upstash Redis (Vercel Marketplace) so the nurse's laptop can reach a
// phone that subscribed on another device. Entries expire after 30 days.

const KEY = "carecircle:push-subscriptions";
const TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_PHONES = 20;

function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

let vapidReady = false;
function vapid(): boolean {
  if (vapidReady) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  setVapidDetails(process.env.VAPID_SUBJECT ?? "https://carecircle-demo.vercel.app", publicKey, privateKey);
  vapidReady = true;
  return true;
}

/** Which part of the setup is missing, if any, in plain words for the screen. */
export function pushSetupProblem(): string | null {
  if (!vapid()) return "The server has no notification keys yet.";
  if (!redis()) return "The server has nowhere to remember phones yet.";
  return null;
}

/** A short, stable id for a subscription, so the same phone is stored once. */
async function idFor(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Checks an untrusted body is a push subscription, and returns a clean copy. */
export function parseSubscription(raw: unknown): PushSubscription | null {
  const s = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const keys = (typeof s.keys === "object" && s.keys !== null ? s.keys : {}) as Record<string, unknown>;
  if (typeof s.endpoint !== "string" || s.endpoint.length > 1024) return null;
  try {
    if (new URL(s.endpoint).protocol !== "https:") return null;
  } catch {
    return null;
  }
  const { p256dh, auth } = keys;
  if (typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) return null;
  return { endpoint: s.endpoint, keys: { p256dh, auth } };
}

export async function savePhone(sub: PushSubscription): Promise<void> {
  const db = redis();
  if (!db) throw new Error("no store");
  if ((await db.hlen(KEY)) >= MAX_PHONES && !(await db.hexists(KEY, await idFor(sub.endpoint)))) {
    // A demo needs a handful of phones; drop the lot rather than grow forever.
    await db.del(KEY);
  }
  await db.hset(KEY, { [await idFor(sub.endpoint)]: JSON.stringify(sub) });
  await db.expire(KEY, TTL_SECONDS);
}

export async function removePhone(endpoint: string): Promise<void> {
  await redis()?.hdel(KEY, await idFor(endpoint));
}

export async function phoneCount(): Promise<number> {
  return (await redis()?.hlen(KEY)) ?? 0;
}

/** Sends one message to every subscribed phone. Phones whose address has gone are forgotten. */
export async function sendToPhones(payload: string): Promise<{ sent: number; failed: number }> {
  const db = redis();
  if (!db || !vapid()) throw new Error("not configured");
  const all = (await db.hgetall<Record<string, unknown>>(KEY)) ?? {};
  let sent = 0;
  let failed = 0;
  await Promise.all(
    Object.entries(all).map(async ([id, value]) => {
      // Upstash returns stored JSON already parsed.
      const sub = parseSubscription(typeof value === "string" ? JSON.parse(value) : value);
      if (!sub) {
        await db.hdel(KEY, id);
        return;
      }
      try {
        await sendNotification(sub, payload, { TTL: 60 * 60, urgency: "high" });
        sent += 1;
      } catch (err) {
        failed += 1;
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) await db.hdel(KEY, id);
      }
    }),
  );
  return { sent, failed };
}
