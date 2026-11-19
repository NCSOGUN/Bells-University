import { MESSAGE_STATUS_LABEL } from "./care-status";
import { familyTermFor, firstName } from "./format";
import type { CareStatus, DemoState, Visit } from "./mock-data";

// What a family's phone receives after a visit. The notification itself shows
// only the status and one line, never readings: anyone can glance at a lock
// screen. The visit record travels with it so the family's device shows the
// same record the nurse submitted, once they sign in.

export interface VisitUpdate {
  id: string;
  sentAt: string;
  elderId: string;
  /** "Update on Dad's visit today" */
  title: string;
  /** "Keeping a close eye. Tap to see what the nurse found." */
  body: string;
  status: CareStatus;
  statusLabel: string;
  visit: Visit;
  elderStatus: { careStatus: CareStatus; careStatusMessage: string };
}

export function buildVisitUpdate(state: DemoState, visitId: string): VisitUpdate | null {
  const visit = state.visits.find((v) => v.id === visitId);
  const elder = visit && state.elders.find((e) => e.id === visit.elderId);
  if (!visit || !elder || visit.status !== "complete") return null;
  const term = familyTermFor(elder.relationship, elder.name);
  const nurse = state.nurses.find((n) => n.id === visit.nurseId);
  const { title, body } = notificationText(term, nurse ? firstName(nurse.name) : null, elder.careStatus);
  return {
    id: `${visit.id}:${visit.checkOutAt ?? ""}`,
    sentAt: new Date().toISOString(),
    elderId: elder.id,
    title,
    body,
    status: elder.careStatus,
    statusLabel: MESSAGE_STATUS_LABEL[elder.careStatus],
    visit,
    elderStatus: { careStatus: elder.careStatus, careStatusMessage: elder.careStatusMessage },
  };
}

// The emoji repeats the status for a quick glance; the words always say it too.
const STATUS_MARK: Record<CareStatus, string> = { green: "✅", yellow: "🟡", red: "🔴" };

/**
 * Lock-screen wording, in the warm voice of a WhatsApp update: who visited,
 * the status, and what tapping does. Never a reading: anyone can see a lock screen.
 */
export function notificationText(term: string, nurseFirstName: string | null, status: CareStatus) {
  const nurse = nurseFirstName ? `Nurse ${nurseFirstName}` : "Your nurse";
  const who = nurseFirstName ?? "the nurse";
  const label = `${MESSAGE_STATUS_LABEL[status]} ${STATUS_MARK[status]}`;
  const next = {
    green: `Everything looked good today. Tap to see how ${term} is doing.`,
    yellow: `There's one reading to keep an eye on. Tap to see what ${who} found.`,
    red: `Please tap to see what ${who} found and what to do next.`,
  }[status];
  return { title: `${nurse} has just finished ${term}'s visit`, body: `${label} ${next}` };
}

/** Puts the nurse's submitted visit and the resulting status onto this device's records. */
export function applyVisitUpdate(state: DemoState, update: VisitUpdate): DemoState {
  const known = state.visits.some((v) => v.id === update.visit.id);
  return {
    ...state,
    visits: known
      ? state.visits.map((v) => (v.id === update.visit.id ? update.visit : v))
      : [...state.visits, update.visit],
    elders: state.elders.map((e) => (e.id === update.elderId ? { ...e, ...update.elderStatus } : e)),
  };
}

/** For a notification, the elder's first name, e.g. "Joseph". */
export function elderFirstName(state: DemoState, elderId: string): string {
  const elder = state.elders.find((e) => e.id === elderId);
  return elder ? firstName(elder.name) : "";
}
