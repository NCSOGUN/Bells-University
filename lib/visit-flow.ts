import { daysFromToday, formatRelativeDay, formatTime, nurseShortName } from "./format";
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

export interface VisitWorkflow {
  checkInGps: GpsState;
  report: VisitReportDraft;
  savedAt?: string;
  /** Demo toggle: simulate losing signal mid-report. */
  offline: boolean;
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

const inRange = (value: string, min: number, max: number) => {
  const n = Number(value);
  return value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max;
};

export function validateReport(report: VisitReportDraft): ReportErrors {
  const errors: ReportErrors = {};
  if (!parseBloodPressure(`${report.systolic}/${report.diastolic}`) || !inRange(report.systolic, 60, 260) || !inRange(report.diastolic, 30, 160)) {
    errors.bloodPressure = "Enter both blood pressure numbers, for example 128 over 82.";
  }
  if (!inRange(report.pulse, 30, 220)) errors.pulse = "Enter a pulse between 30 and 220 bpm.";
  if (!inRange(report.temperature, 33, 43)) errors.temperature = "Enter a temperature between 33 and 43 °C.";
  if (!inRange(report.weight, 20, 250)) errors.weight = "Enter a weight between 20 and 250 kg.";
  if (!report.medicationAdherence) errors.medicationAdherence = "Choose how medication was taken.";
  return errors;
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

  const now = new Date().toISOString();
  const { report } = workflow;
  const trimmed = (s: string) => s.trim() || undefined;
  let next = updateVisit(state, visitId, {
    status: "complete",
    checkOutAt: now,
    checkOutGpsConfirmed: workflow.checkInGps === "confirmed",
    vitals: toVitals(report),
    medicationAdherence: report.medicationAdherence || undefined,
    mobilityNote: trimmed(report.mobilityNote),
    wellbeingNote: trimmed(report.wellbeingNote),
    nurseNotes: trimmed(report.nurseNotes),
  });

  // A Green client's status line described a visit that hadn't happened yet;
  // replace it with what this visit recorded. Yellow/Red lines explain a
  // concern and are left for a nurse to resolve.
  const nurse = next.nurses.find((n) => n.id === visit.nurseId);
  const bp = toVitals(report).bloodPressure;
  next = {
    ...next,
    elders: next.elders.map((e) =>
      e.id === visit.elderId && e.careStatus === "green"
        ? {
            ...e,
            careStatusMessage: `Visited ${formatRelativeDay(now)} at ${formatTime(now)}${
              nurse ? ` by ${nurseShortName(nurse.name)}` : ""
            }. Blood pressure ${bp} mmHg.`,
          }
        : e,
    ),
  };
  return updateWorkflow(next, visitId, { familyUpdateSentAt: now });
}
