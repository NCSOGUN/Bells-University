import { CARE_STATUS_COPY, MESSAGE_STATUS_LABEL } from "./care-status";
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
  return {
    id: `${visit.id}:${visit.checkOutAt ?? ""}`,
    sentAt: new Date().toISOString(),
    elderId: elder.id,
    title: `Update on ${term}'s visit today`,
    body:
      elder.careStatus === "green"
        ? `${CARE_STATUS_COPY.green.label}. Tap to see the visit summary.`
        : `${CARE_STATUS_COPY[elder.careStatus].label}. Tap to see what the nurse found.`,
    status: elder.careStatus,
    statusLabel: MESSAGE_STATUS_LABEL[elder.careStatus],
    visit,
    elderStatus: { careStatus: elder.careStatus, careStatusMessage: elder.careStatusMessage },
  };
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
