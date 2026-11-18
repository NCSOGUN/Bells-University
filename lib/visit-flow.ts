import {
  PLAUSIBLE_RANGE,
  type CareCheckInput,
  type CareCheckResult,
  type CareDecision,
  type CheckStatus,
  type Reading,
  type VisitCareCheck,
} from "./care-check";
import { deriveElderStatus, readingsFromVisits } from "./elder-status";
import { daysFromToday } from "./format";
import type { DemoState, Visit, Vitals } from "./mock-data";
import { parseBloodPressure } from "./vitals";

// N9–N11 work on the existing Visit record the nurse's dashboard shows. The
// in-progress report lives beside it, keyed by visit id, until check-out
// writes it onto the visit itself.

export type Adherence = NonNullable<Visit["medicationAdherence"]>;
export type GpsState = "confirmed" | "unavailable";

export interface VisitReportDraft {
  systolic: string;
  diastolic: string;
  pulse: string;
  temperature: string;
  weight: string;
  medicationAdherence: Adherence | "";
  mobilityNote: string;
  wellbeingNote: string;
  nurseNotes: string;
}

/** The Care Check for the vitals as currently typed, and what the nurse decided about it. */
export interface DraftCareCheck {
  /** Identifies the exact readings and history the result was computed for. */
  inputKey: string;
  result: CareCheckResult;
  decision?: { finalStatus: CheckStatus; reason?: string };
}

export interface VisitWorkflow {
  checkInGps: GpsState;
  report: VisitReportDraft;
  savedAt?: string;
  /** Demo toggle: simulate losing signal mid-report. */
  offline: boolean;
  careCheck?: DraftCareCheck;
  familyUpdateSentAt?: string;
}

export const EMPTY_REPORT: VisitReportDraft = {
  systolic: "",
  diastolic: "",
  pulse: "",
  temperature: "",
  weight: "",
  medicationAdherence: "",
  mobilityNote: "",
  wellbeingNote: "",
  nurseNotes: "",
};

export type VisitFlowAccess =
  | { ok: true; visit: Visit }
  | { ok: false; reason: "not_found" | "not_today" };

/** Only the nurse's own visits booked for today can be worked through. */
export function visitForFlow(state: DemoState, visitId: string, nurseId: string): VisitFlowAccess {
  const visit = state.visits.find((v) => v.id === visitId && v.nurseId === nurseId);
  if (!visit) return { ok: false, reason: "not_found" };
  if (daysFromToday(visit.scheduledAt) !== 0) return { ok: false, reason: "not_today" };
  return { ok: true, visit };
}

function updateVisit(state: DemoState, visitId: string, patch: Partial<Visit>): DemoState {
  return { ...state, visits: state.visits.map((v) => (v.id === visitId ? { ...v, ...patch } : v)) };
}

function updateWorkflow(state: DemoState, visitId: string, patch: Partial<VisitWorkflow>): DemoState {
  const current = state.visitWorkflows[visitId];
  if (!current) return state;
  return { ...state, visitWorkflows: { ...state.visitWorkflows, [visitId]: { ...current, ...patch } } };
}

export function checkIn(state: DemoState, visitId: string, gps: GpsState, address: string): DemoState {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit || visit.status !== "scheduled") return state;
  const next = updateVisit(state, visitId, {
    status: "in_progress",
    checkInAt: new Date().toISOString(),
    gpsConfirmed: gps === "confirmed",
    // A missing GPS fix is recorded as a gap, not papered over with the address.
    gpsAddress: gps === "confirmed" ? address : undefined,
  });
  return {
    ...next,
    visitWorkflows: {
      ...next.visitWorkflows,
      [visitId]: { checkInGps: gps, report: EMPTY_REPORT, offline: false },
    },
  };
}

export function saveReportDraft(state: DemoState, visitId: string, patch: Partial<VisitReportDraft>): DemoState {
  const current = state.visitWorkflows[visitId];
  if (!current) return state;
  return updateWorkflow(state, visitId, {
    report: { ...current.report, ...patch },
    savedAt: new Date().toISOString(),
  });
}

export function setOffline(state: DemoState, visitId: string, offline: boolean): DemoState {
  return updateWorkflow(state, visitId, { offline });
}

export type ReportErrors = Partial<Record<keyof VisitReportDraft | "bloodPressure", string>>;

const inRange = (value: string, range: { min: number; max: number }) => {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= range.min && n <= range.max;
};

export function validateReport(report: VisitReportDraft): ReportErrors {
  const errors: ReportErrors = {};
  const R = PLAUSIBLE_RANGE;
  if (!parseBloodPressure(`${report.systolic}/${report.diastolic}`) || !inRange(report.systolic, R.systolic) || !inRange(report.diastolic, R.diastolic)) {
    errors.bloodPressure = "Enter both blood pressure numbers, for example 128 over 82.";
  } else if (Number(report.diastolic) >= Number(report.systolic)) {
    errors.bloodPressure = "The bottom number should be lower than the top number. Check they haven't been swapped.";
  }
  if (!inRange(report.pulse, R.pulse)) errors.pulse = `Enter a pulse between ${R.pulse.min} and ${R.pulse.max} bpm.`;
  if (!inRange(report.temperature, R.temperature)) errors.temperature = `Enter a temperature between ${R.temperature.min} and ${R.temperature.max} °C.`;
  if (!inRange(report.weight, R.weight)) errors.weight = `Enter a weight between ${R.weight.min} and ${R.weight.max} kg.`;
  if (!report.medicationAdherence) errors.medicationAdherence = "Choose how medication was taken.";
  return errors;
}

/** The readings the Care Check needs, or null until the vitals section is complete and plausible. */
export function careCheckInput(report: VisitReportDraft, history: Reading[]): CareCheckInput | null {
  if (Object.keys(validateReport(report)).length > 0 || !report.medicationAdherence) return null;
  return {
    current: {
      systolic: Number(report.systolic),
      diastolic: Number(report.diastolic),
      pulse: Number(report.pulse),
      temperature: Number(report.temperature),
      weight: Number(report.weight),
      medicationAdherence: report.medicationAdherence,
    },
    history,
  };
}

export const careCheckKey = (input: CareCheckInput): string => JSON.stringify(input);

/** Earlier completed readings for the elder a visit belongs to. */
export function historyForVisit(state: DemoState, visitId: string): Reading[] {
  const visit = state.visits.find((v) => v.id === visitId);
  if (!visit) return [];
  return readingsFromVisits(state.visits.filter((v) => v.elderId === visit.elderId && v.id !== visitId));
}

/** Stores a fresh Care Check result. A new set of readings clears any earlier decision. */
export function setCareCheck(state: DemoState, visitId: string, inputKey: string, result: CareCheckResult): DemoState {
  if (state.visitWorkflows[visitId]?.careCheck?.inputKey === inputKey) return state;
  return updateWorkflow(state, visitId, { careCheck: { inputKey, result } });
}

/**
 * The nurse confirms the suggested status, or sets a different one with a
 * reason. Changing it without a reason is refused: an override is a clinical
 * judgement and has to say why.
 */
export function decideCareCheck(
  state: DemoState,
  visitId: string,
  decision: { finalStatus: CheckStatus; reason?: string },
): DemoState {
  const draft = state.visitWorkflows[visitId]?.careCheck;
  if (!draft) return state;
  const agrees = decision.finalStatus === draft.result.suggestedStatus;
  const reason = decision.reason?.trim();
  if (!agrees && !reason) return state;
  return updateWorkflow(state, visitId, {
    careCheck: { ...draft, decision: { finalStatus: decision.finalStatus, reason: agrees ? undefined : reason } },
  });
}

/** Why a report can't be submitted yet because of the Care Check, or null if it can. */
export function careCheckBlocker(state: DemoState, visitId: string): string | null {
  const workflow = state.visitWorkflows[visitId];
  if (!workflow) return null;
  const input = careCheckInput(workflow.report, historyForVisit(state, visitId));
  if (!input) return null; // the form's own validation explains what's missing
  const draft = workflow.careCheck;
  if (!draft || draft.inputKey !== careCheckKey(input)) return "The care check is still running. Give it a moment.";
  if (draft.result.suggestedStatus !== "green" && !draft.decision) {
    return "Confirm the care check result, or change it with a reason, before you submit.";
  }
  return null;
}

function toVitals(report: VisitReportDraft): Vitals {
  return {
    bloodPressure: `${Number(report.systolic)}/${Number(report.diastolic)}`,
    pulse: Number(report.pulse),
    temperature: Number(report.temperature),
    weight: Number(report.weight),
  };
}

/**
 * Check-out: writes the report onto the existing visit, marks it complete and
 * records the family update. Refuses anything that isn't a valid, online,
 * in-progress report, so nothing is lost or half-written.
 */
export function completeVisit(state: DemoState, visitId: string): DemoState {
  const visit = state.visits.find((v) => v.id === visitId);
  const workflow = state.visitWorkflows[visitId];
  if (!visit || visit.status !== "in_progress" || !workflow || workflow.offline) return state;
  if (Object.keys(validateReport(workflow.report)).length > 0) return state;
  // The Care Check must have run on exactly these readings, and a Yellow/Red
  // suggestion must have been confirmed or changed by the nurse first.
  if (careCheckBlocker(state, visitId)) return state;
  const draft = workflow.careCheck;
  if (!draft) return state;

  const now = new Date().toISOString();
  const { report } = workflow;
  const trimmed = (s: string) => s.trim() || undefined;

  const decision: CareDecision = draft.decision
    ? {
        outcome: draft.decision.finalStatus === draft.result.suggestedStatus ? "confirmed" : "adjusted",
        finalStatus: draft.decision.finalStatus,
        reason: draft.decision.reason,
        nurseId: visit.nurseId,
        decidedAt: now,
      }
    : { outcome: "confirmed", finalStatus: draft.result.suggestedStatus, nurseId: visit.nurseId, decidedAt: now };
  const careCheck: VisitCareCheck = { ...draft.result, decision };
  const flagged = decision.finalStatus !== "green";

  let next = updateVisit(state, visitId, {
    status: "complete",
    checkOutAt: now,
    checkOutGpsConfirmed: workflow.checkInGps === "confirmed",
    vitals: toVitals(report),
    medicationAdherence: report.medicationAdherence || undefined,
    mobilityNote: trimmed(report.mobilityNote),
    wellbeingNote: trimmed(report.wellbeingNote),
    nurseNotes: trimmed(report.nurseNotes),
    careCheck,
    flagged,
    // The nurse's own words if she changed the status, otherwise what the rules saw.
    flagReason: flagged ? (decision.reason ?? draft.result.findings.find((f) => f.severity !== "info")?.reason) : undefined,
  });

  // The elder's status and status line come from their visits, the same way
  // the seed's do, so a flagged visit changes the family dashboard too.
  const nurse = next.nurses.find((n) => n.id === visit.nurseId);
  const derived = deriveElderStatus(
    next.visits.filter((v) => v.elderId === visit.elderId),
    nurse,
  );
  if (derived) {
    next = {
      ...next,
      elders: next.elders.map((e) =>
        e.id === visit.elderId ? { ...e, careStatus: derived.status, careStatusMessage: derived.message } : e,
      ),
    };
  }
  return updateWorkflow(next, visitId, { familyUpdateSentAt: now });
}
