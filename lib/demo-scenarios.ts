import type { DemoState } from "./mock-data";
import { checkIn, saveReportDraft, type VisitReportDraft } from "./visit-flow";

// Shortcuts for the demo navigator only: they fill in the visit checklist the
// way a nurse would, so the Care Check can be tried without typing every field.

export type DemoReading = "flagged" | "normal" | "subtle" | "subtleMissed";

export const DEMO_READINGS: Record<DemoReading, Partial<VisitReportDraft>> = {
  flagged: {
    systolic: "148",
    diastolic: "92",
    pulse: "88",
    temperature: "36.8",
    weight: "78",
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Brief dizziness on standing.",
    wellbeingNote: "Felt lightheaded earlier in the day.",
  },
  // Ibrahim: 138/86 is under the textbook 140/90 line, but 21 above his own usual of 117/75.
  subtle: {
    systolic: "138",
    diastolic: "86",
    pulse: "74",
    temperature: "36.6",
    weight: "72",
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Walking independently.",
    wellbeingNote: "In good spirits.",
  },
  // The same reading on a day he missed doses: the check reads the two signals together.
  subtleMissed: {
    systolic: "138",
    diastolic: "86",
    pulse: "74",
    temperature: "36.6",
    weight: "72",
    medicationAdherence: "missed",
    mobilityNote: "Walking independently.",
    wellbeingNote: "Said he forgot his tablets for two days.",
  },
  normal: {
    systolic: "132",
    diastolic: "84",
    pulse: "77",
    temperature: "36.6",
    weight: "78",
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Walking independently, no dizziness.",
    wellbeingNote: "In good spirits.",
  },
};

/**
 * Checks the visit in if the nurse hasn't yet, then fills the checklist with the
 * chosen reading. Does nothing for a visit that is already complete.
 */
export function prepareReading(state: DemoState, visitId: string, reading: DemoReading): DemoState {
  let next = state;
  const visit = next.visits.find((v) => v.id === visitId);
  if (!visit) return state;
  if (visit.status === "scheduled") {
    const address = next.elders.find((e) => e.id === visit.elderId)?.address ?? "";
    next = checkIn(next, visitId, "confirmed", address);
  }
  if (next.visits.find((v) => v.id === visitId)?.status !== "in_progress") return state;
  return saveReportDraft(next, visitId, DEMO_READINGS[reading]);
}
