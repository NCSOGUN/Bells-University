import type { VisitUpdate } from "./visit-update";

// Gets a visit update from the nurse's device to the family's device.
//
// Two routes, used together:
// 1. The server (POST/GET /api/updates), which works between two separate
//    devices. Updates expire after an hour.
// 2. A BroadcastChannel, which works between two windows of the same browser
//    with no network at all: the backup if Wi-Fi fails during the demo.
// The receiver ignores an update it has already seen, whichever route it came by.

const CHANNEL = "carecircle-visit-updates";
const POLL_MS = 2000;

export async function publishUpdate(update: VisitUpdate): Promise<"server" | "local-only"> {
  try {
    new BroadcastChannel(CHANNEL).postMessage(update);
  } catch {
    // Not supported: the server route still works.
  }
  try {
    const res = await fetch("/api/updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    return res.ok ? "server" : "local-only";
  } catch {
    return "local-only";
  }
}

export type ChannelStatus = "connecting" | "server" | "local-only";

/**
 * Calls `onUpdate` for each new update, from either route. `onStatus` reports
 * whether the server route is reachable. Returns a function that stops listening.
 */
export function subscribeUpdates(
  onUpdate: (update: VisitUpdate) => void,
  onStatus: (status: ChannelStatus) => void,
  since: string = new Date().toISOString(),
): () => void {
  const seen = new Set<string>();
  const deliver = (u: VisitUpdate) => {
    if (!u?.id || seen.has(u.id)) return;
    seen.add(u.id);
    onUpdate(u);
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => deliver(e.data as VisitUpdate);
  } catch {
    channel = null;
  }

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    try {
      const res = await fetch(`/api/updates?since=${encodeURIComponent(since)}`, { cache: "no-store" });
      if (res.ok) {
        onStatus("server");
        const body = (await res.json()) as { updates?: VisitUpdate[] };
        for (const u of body.updates ?? []) deliver(u);
      } else {
        onStatus("local-only");
      }
    } catch {
      onStatus("local-only");
    }
    if (!stopped) timer = setTimeout(poll, POLL_MS);
  };
  void poll();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    channel?.close();
  };
}
