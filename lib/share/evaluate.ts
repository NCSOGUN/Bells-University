// Is a share usable right now? (FR-10, FR-11, NFR-05). PURE: the clock is passed in.
export type ShareStatus = "valid" | "expired" | "revoked";

export interface ShareTimes {
  expires_at: Date;
  revoked_at: Date | null;
}

/** Revoked wins over expired. "Unknown" (no share found) is handled by the caller. */
export function evaluateShare(share: ShareTimes, now: Date): ShareStatus {
  if (share.revoked_at !== null) return "revoked";
  return now.getTime() >= share.expires_at.getTime() ? "expired" : "valid";
}
