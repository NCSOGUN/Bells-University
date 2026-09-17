import type { DemoState, Elder, Nurse, Plan, Visit } from "./mock-data";

// Pure lookups over demo state. Screens compose these; none of them mutate.

export function findElder(state: DemoState, id: string): Elder | undefined {
  return state.elders.find((e) => e.id === id);
}

export function findNurse(state: DemoState, id: string): Nurse | undefined {
  return state.nurses.find((n) => n.id === id);
}

export function findPlan(state: DemoState, id: string): Plan | undefined {
  return state.plans.find((p) => p.id === id);
}

export function findVisit(state: DemoState, id: string): Visit | undefined {
  return state.visits.find((v) => v.id === id);
}

/** Family screens only show elders on the signed-in family account. */
export function isFamilyElder(state: DemoState, elderId: string): boolean {
  return state.familyAccount.elderIds.includes(elderId);
}

/** All visits for an elder, oldest first. */
export function visitsForElder(state: DemoState, elderId: string): Visit[] {
  return state.visits
    .filter((v) => v.elderId === elderId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

/** Completed visits, oldest first. */
export function completedVisits(visits: Visit[]): Visit[] {
  return visits.filter((v) => v.status === "complete");
}

export function nextScheduledVisit(visits: Visit[]): Visit | undefined {
  return visits.find((v) => v.status === "scheduled");
}

/** Position of a completed visit in the elder's history, starting at 1. */
export function visitNumber(completed: Visit[], visitId: string): number | undefined {
  const index = completed.findIndex((v) => v.id === visitId);
  return index === -1 ? undefined : index + 1;
}

/** The flagged visit this one followed up on, if the previous completed visit was flagged. */
export function followedUpVisit(completed: Visit[], visitId: string): Visit | undefined {
  const index = completed.findIndex((v) => v.id === visitId);
  const previous = index > 0 ? completed[index - 1] : undefined;
  return previous?.flagged ? previous : undefined;
}

/** The visit that followed up on this one, if this one was flagged. */
export function followUpVisit(completed: Visit[], visitId: string): Visit | undefined {
  const index = completed.findIndex((v) => v.id === visitId);
  if (index === -1 || !completed[index].flagged) return undefined;
  return completed[index + 1];
}
