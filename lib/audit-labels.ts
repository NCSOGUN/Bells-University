// Plain-English labels for access-log entries (FR-13, US-6). PURE. Dev A shows `label` on the access-log screen.
export interface LogLike {
  actor_type: string;
  actor_label: string;
  action: string;
  outcome: string;
  reason: string | null;
}

export function describeLogEntry(e: LogLike): string {
  const who = e.actor_label;
  switch (e.action) {
    case "share_created":
      return "You created a share code";
    case "share_revoked":
      return "You revoked a share code";
    case "viewer_opened":
      return `${who} opened your record`;
    case "viewer_open_refused":
      return `${who} tried to open your record with a code that was ${e.reason === "revoked" ? "revoked" : "expired"}`;
    case "viewer_image_viewed":
      return `${who} viewed a source image`;
    case "referral_acknowledged":
      return `${who} acknowledged your referral`;
    case "link_created":
      return `You linked ${who}`;
    case "link_revoked":
      return `You unlinked ${who}`;
    case "feed_delivery_accepted":
      return `${who} sent new information to your record`;
    case "feed_delivery_refused":
      return `A delivery from ${who} was refused`;
    default:
      return `${who}: ${e.action}${e.outcome === "refused" ? " (refused)" : ""}`;
  }
}
