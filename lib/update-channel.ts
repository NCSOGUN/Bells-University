import type { VisitUpdate } from "./visit-update";

// Gets a visit update from the nurse's screen to the family's phone screen.
//
// In the demo both run in the same browser (the phone in its own window beside
// the nurse's), so a BroadcastChannel carries the update instantly with no
// network at all. In the real product this would be a push notification from
// the server; there is no server store in this prototype.

const CHANNEL = "carecircle-visit-updates";

export function publishUpdate(update: VisitUpdate): void {
  try {
    const channel = new BroadcastChannel(CHANNEL);
    channel.postMessage(update);
    channel.close();
  } catch {
    // BroadcastChannel unsupported: the family can still open the dashboard.
  }
}

/** Calls `onUpdate` once for each new update. Returns a function that stops listening. */
export function subscribeUpdates(onUpdate: (update: VisitUpdate) => void): () => void {
  const seen = new Set<string>();
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e) => {
      const u = e.data as VisitUpdate;
      if (!u?.id || seen.has(u.id)) return;
      seen.add(u.id);
      onUpdate(u);
    };
  } catch {
    channel = null;
  }
  return () => channel?.close();
}

/** Opens the family phone in its own narrow window, to sit beside the nurse's screen. */
export function openPhoneWindow(): void {
  const height = Math.min(940, window.screen.availHeight);
  window.open("/phone", "carecircle-phone", `popup,width=460,height=${height}`);
}
