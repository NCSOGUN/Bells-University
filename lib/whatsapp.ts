import type { DemoState, Elder, Nurse, Visit } from "./mock-data";
import { completedVisits, findElder, findNurse, nextScheduledVisit, viewedElderId, visitsForElder } from "./selectors";

// The family's WhatsApp thread (F11) is a view of the records the dashboard
// already shows: the same elder, nurse and visits. Nothing here is stored.

export type ThreadMessageKind = "arrival" | "summary" | "next" | "reply";

export interface ThreadMessage {
  id: string;
  kind: ThreadMessageKind;
  from: "carecircle" | "family";
  at: string;
  visit?: Visit;
}

export interface FamilyThread {
  elder: Elder;
  nurse?: Nurse;
  /** The visit the latest update describes, if any has been completed. */
  latest?: Visit;
  next?: Visit;
  messages: ThreadMessage[];
}

/** Minutes after check-out that the family replies, so the thread reads in order. */
const REPLY_DELAY_MINUTES = 6;

function plus(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/**
 * Builds the thread from current demo state, so a visit completed on the nurse
 * side shows up here without a second source of truth.
 */
export function buildFamilyThread(state: DemoState): FamilyThread | undefined {
  const elder = findElder(state, viewedElderId(state));
  if (!elder) return undefined;

  const visits = visitsForElder(state, elder.id);
  const completed = completedVisits(visits);
  const latest = completed.at(-1);
  const next = nextScheduledVisit(visits);
  const nurse = findNurse(state, latest?.nurseId ?? elder.assignedNurseId);

  const messages: ThreadMessage[] = [];
  if (latest) {
    const arrivedAt = latest.checkInAt ?? latest.scheduledAt;
    const finishedAt = latest.checkOutAt ?? plus(arrivedAt, 30);
    messages.push({ id: `${latest.id}-arrival`, kind: "arrival", from: "carecircle", at: arrivedAt, visit: latest });
    messages.push({ id: `${latest.id}-summary`, kind: "summary", from: "carecircle", at: finishedAt, visit: latest });
    if (next) {
      messages.push({ id: `${next.id}-next`, kind: "next", from: "carecircle", at: plus(finishedAt, 1), visit: next });
    }
    messages.push({
      id: `${latest.id}-reply`,
      kind: "reply",
      from: "family",
      at: plus(finishedAt, REPLY_DELAY_MINUTES),
    });
  }

  return { elder, nurse, latest, next, messages };
}
