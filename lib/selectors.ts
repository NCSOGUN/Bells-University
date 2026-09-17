import { daysFromToday } from "./format";
import {
  EARNINGS_PER_VISIT_NGN,
  type AssignmentRequest,
  type DemoState,
  type Elder,
  type Nurse,
  type Plan,
  type Visit,
} from "./mock-data";

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

/** The most recent flagged visit, if any. */
export function latestFlaggedVisit(completed: Visit[]): Visit | undefined {
  return completed.findLast((v) => v.flagged);
}

// ── Nurse side ──────────────────────────────────────────────────────────────
// The nurse screens read the same elders and visits as the family screens;
// these only decide which of them belong to a nurse.

/** Clients currently assigned to the nurse, in seed order. */
export function nurseClients(state: DemoState, nurseId: string): Elder[] {
  return state.elders.filter((e) => e.assignedNurseId === nurseId);
}

export function isNurseClient(state: DemoState, nurseId: string, elderId: string): boolean {
  return state.elders.some((e) => e.id === elderId && e.assignedNurseId === nurseId);
}

export type TodayVisitState = "complete" | "in_progress" | "next" | "upcoming";

export interface TodayVisit {
  visit: Visit;
  state: TodayVisitState;
}

/**
 * The nurse's visits scheduled for today, earliest first. Anything not yet
 * complete is "next" if it's the first one left, otherwise "upcoming".
 */
export function todaysVisits(state: DemoState, nurseId: string): TodayVisit[] {
  const today = state.visits
    .filter((v) => v.nurseId === nurseId && daysFromToday(v.scheduledAt) === 0)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));

  let nextTaken = false;
  return today.map((visit): TodayVisit => {
    if (visit.status === "complete") return { visit, state: "complete" };
    if (visit.status === "in_progress") {
      nextTaken = true;
      return { visit, state: "in_progress" };
    }
    const visitState = nextTaken ? "upcoming" : "next";
    nextTaken = true;
    return { visit, state: visitState };
  });
}

export function assignmentsForNurse(state: DemoState, nurseId: string): AssignmentRequest[] {
  return state.assignmentRequests.filter((r) => r.nurseId === nurseId);
}

/** Pay for every visit the nurse has completed, at the per-visit rate. */
export function nurseEarnings(state: DemoState, nurseId: string): { visits: number; amount: number } {
  const visits = state.visits.filter((v) => v.nurseId === nurseId && v.status === "complete").length;
  return { visits, amount: visits * EARNINGS_PER_VISIT_NGN };
}
