import { runCareCheck, type CareCheckInput, type Reading, type VisitCareCheck } from "./care-check";
import { formatRelativeDay, formatTime, nurseShortName } from "./format";
import type { CareStatus, Nurse, Visit } from "./mock-data";
import { parseBloodPressure } from "./vitals";

// An elder's care status is never typed in by hand: it is derived from their
// completed visits, each of which carries a Care Check result and the nurse's
// decision on it. Seed data, the nurse's checklist and every family screen all
// go through the functions here, so they cannot drift apart.

/** A visit before the check has been applied. `flagged` and `careCheck` are derived from it. */
export type VisitRecord = Omit<Visit, "flagged" | "careCheck">;

/** The status a nurse settled on for a visit. */
export function finalStatusOf(visit: Visit): CareStatus {
  return visit.careCheck?.decision.finalStatus ?? (visit.flagged ? "yellow" : "green");
}

/** Earlier readings for the check, from completed visits only, oldest first. */
export function readingsFromVisits(visits: Visit[]): Reading[] {
  const readings: Reading[] = [];
  for (const visit of visits) {
    if (visit.status !== "complete" || !visit.vitals) continue;
    const bp = parseBloodPressure(visit.vitals.bloodPressure);
    if (!bp) continue;
    readings.push({
      recordedAt: visit.checkOutAt ?? visit.scheduledAt,
      systolic: bp.systolic,
      diastolic: bp.diastolic,
      pulse: visit.vitals.pulse,
    });
  }
  return readings.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
}

/** Builds the check input for a visit's recorded vitals, or null if it has none to check. */
export function inputForVisit(visit: Visit | VisitRecord, earlier: Visit[]): CareCheckInput | null {
  if (!visit.vitals) return null;
  const bp = parseBloodPressure(visit.vitals.bloodPressure);
  if (!bp) return null;
  return {
    current: {
      systolic: bp.systolic,
      diastolic: bp.diastolic,
      pulse: visit.vitals.pulse,
      temperature: visit.vitals.temperature,
      weight: visit.vitals.weight,
      medicationAdherence: visit.medicationAdherence ?? "taken_as_scheduled",
    },
    history: readingsFromVisits(earlier),
  };
}

/**
 * Runs the Care Check over records that were saved without one (the seed),
 * in date order per elder, with each visit judged only against the visits
 * before it. The nurse on the record is treated as having confirmed it.
 */
export function applyCareChecks(records: VisitRecord[]): Visit[] {
  const done: Visit[] = [];
  const byTime = [...records].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const checked = new Map<string, Visit>();

  for (const record of byTime) {
    const earlier = done.filter((v) => v.elderId === record.elderId);
    const input = record.status === "complete" ? inputForVisit(record, earlier) : null;
    let visit: Visit = { ...record, flagged: false };
    if (input) {
      const at = record.checkOutAt ?? record.scheduledAt;
      const result = runCareCheck(input, "server", new Date(at));
      const careCheck: VisitCareCheck = {
        ...result,
        decision: { outcome: "confirmed", finalStatus: result.suggestedStatus, nurseId: record.nurseId, decidedAt: at },
      };
      const flagged = result.suggestedStatus !== "green";
      visit = {
        ...record,
        careCheck,
        flagged,
        // A nurse's own words win; otherwise say what the rules saw.
        flagReason: flagged
          ? (record.flagReason ?? result.findings.find((f) => f.severity !== "info")?.reason)
          : undefined,
      };
    }
    done.push(visit);
    checked.set(record.id, visit);
  }
  return records.map((r) => checked.get(r.id) as Visit);
}

function headlineOf(visit: Visit): string {
  const finding = visit.careCheck?.findings.find((f) => f.severity !== "info");
  if (finding) return finding.headline;
  return visit.careCheck?.decision.reason ? "The nurse flagged a concern" : "A reading was flagged";
}

export interface DerivedStatus {
  status: CareStatus;
  message: string;
}

/**
 * The elder's status and plain-language line, from their visits (any order).
 * Not green stays on the elder until a normal visit follows, and then one more
 * visit is shown as "monitoring", so a single good reading never clears it.
 * Returns null when nobody has visited yet: there is nothing to derive from.
 */
export function deriveElderStatus(elderVisits: Visit[], nurse?: Nurse): DerivedStatus | null {
  const sorted = [...elderVisits].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const completed = sorted.filter((v) => v.status === "complete");
  const last = completed.at(-1);
  if (!last) return null;
  const previous = completed.at(-2);
  const next = sorted.find((v) => v.status === "scheduled");
  const who = nurse ? nurseShortName(nurse.name) : "The nurse";
  const when = (v: Visit) => v.checkOutAt ?? v.scheduledAt;
  const nextClause = next
    ? `${who} is checking again ${formatRelativeDay(next.scheduledAt)} at ${formatTime(next.scheduledAt)}.`
    : `${who} will check again at the next visit.`;

  const lastStatus = finalStatusOf(last);
  if (lastStatus !== "green") {
    return {
      status: lastStatus,
      message: `${headlineOf(last)} ${formatRelativeDay(when(last))}. ${nextClause}`,
    };
  }
  if (previous && finalStatusOf(previous) !== "green") {
    return {
      status: "yellow",
      message: `${headlineOf(previous)} ${formatRelativeDay(when(previous))} and came back down ${formatRelativeDay(when(last))}. ${nextClause}`,
    };
  }
  const bp = last.vitals?.bloodPressure;
  return {
    status: "green",
    message: `Visited ${formatRelativeDay(when(last))} at ${formatTime(when(last))}${nurse ? ` by ${nurseShortName(nurse.name)}` : ""}.${bp ? ` Blood pressure ${bp} mmHg.` : ""}`,
  };
}
