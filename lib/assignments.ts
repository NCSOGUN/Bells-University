import type { DemoState } from "./mock-data";

// State transitions for assignment requests. Pure, so the dashboard can apply
// them optimistically through `update` and they persist like any other change.

export const DECLINE_REASONS = [
  "Too far from my other clients",
  "My schedule is full",
  "Outside my specialisation",
  "Other",
] as const;

export type DeclineReason = (typeof DECLINE_REASONS)[number];

/** Accepting assigns the client to the nurse, so they join that nurse's client list. */
export function acceptAssignment(state: DemoState, requestId: string): DemoState {
  const request = state.assignmentRequests.find((r) => r.id === requestId);
  if (!request || request.status !== "pending") return state;

  return {
    ...state,
    assignmentRequests: state.assignmentRequests.map((r) =>
      r.id === requestId ? { ...r, status: "accepted", declineReason: undefined } : r,
    ),
    elders: state.elders.map((e) =>
      e.id === request.elderId ? { ...e, assignedNurseId: request.nurseId } : e,
    ),
  };
}

/** Declining keeps the client unassigned, back in the coordinator's queue. */
export function declineAssignment(state: DemoState, requestId: string, reason: string): DemoState {
  const request = state.assignmentRequests.find((r) => r.id === requestId);
  if (!request || request.status !== "pending" || !reason.trim()) return state;

  return {
    ...state,
    assignmentRequests: state.assignmentRequests.map((r) =>
      r.id === requestId ? { ...r, status: "declined", declineReason: reason.trim() } : r,
    ),
  };
}
