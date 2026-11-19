// Care Check: rules-based, explainable decision support for a nurse's visit.
//
// It compares today's readings with (a) this person's own recent visits and
// (b) fixed clinical lines, and suggests a status with the reasons behind it.
// It is NOT a diagnosis and NOT machine learning: every result names the rule
// that fired and the numbers it used, and a nurse confirms or changes it
// before anyone else sees it. `MODEL_VERSION` is stamped on every result so a
// trained model can replace these rules later without losing the audit trail.
//
// This file imports nothing, so the same code runs in the API route, in the
// browser (the offline fallback) and in `node --test`.

export const MODEL_VERSION = "rules-v1";

export type CheckStatus = "green" | "yellow" | "red";
export type FindingSeverity = "info" | "watch" | "urgent";
export type CheckSource = "server" | "on-device";
export type MedicationAdherence = "taken_as_scheduled" | "partial" | "missed";

/** Readings outside these are measurement mistakes, not clinical findings. */
export const PLAUSIBLE_RANGE = {
  systolic: { min: 60, max: 260, unit: "mmHg" },
  diastolic: { min: 30, max: 160, unit: "mmHg" },
  pulse: { min: 30, max: 220, unit: "bpm" },
  temperature: { min: 33, max: 43, unit: "°C" },
  weight: { min: 20, max: 250, unit: "kg" },
} as const;

/** Every number a rule uses lives here, and the on-screen rules list is built from it. */
export const THRESHOLDS = {
  /** How many of the person's most recent visits make up their "usual". */
  baselineWindow: 4,
  /** Fewer prior visits than this and we don't claim to know their usual. */
  minVisitsForBaseline: 3,
  bpUrgent: { systolic: 180, diastolic: 120 },
  bpHigh: { systolic: 140, diastolic: 90 },
  bpLow: { systolic: 90, diastolic: 50 },
  bpRiseFromUsual: { systolic: 15, diastolic: 10 },
  bpDropFromUsual: { systolic: 20 },
  /** Consecutive rising top numbers, and the total rise, that count as creeping up. */
  bpTrend: { visits: 3, totalRise: 15 },
  pulseHigh: 100,
  pulseLow: 50,
  pulseRiseFromUsual: 10,
  temperature: { high: 38.0, urgentHigh: 39.0, low: 35.5, urgentLow: 35.0 },
} as const;

export interface Reading {
  /** ISO timestamp of the visit the reading came from. */
  recordedAt: string;
  systolic: number;
  diastolic: number;
  pulse: number;
}

export interface CurrentReadings {
  systolic: number;
  diastolic: number;
  pulse: number;
  temperature: number;
  weight?: number;
  medicationAdherence: MedicationAdherence;
}

/** All the check ever receives: numbers only. No name, address or contact detail. */
export interface CareCheckInput {
  current: CurrentReadings;
  /** Completed visits only, oldest first. */
  history: Reading[];
}

export interface Baseline {
  systolic: number;
  diastolic: number;
  pulse: number;
  basedOnVisits: number;
}

export interface Finding {
  ruleId: string;
  severity: FindingSeverity;
  /** Short, plain-language lead, e.g. "Blood pressure was higher than usual". */
  headline: string;
  /** The full reason, with the numbers and their units. */
  reason: string;
}

export interface CareCheckResult {
  modelVersion: string;
  source: CheckSource;
  evaluatedAt: string;
  suggestedStatus: CheckStatus;
  findings: Finding[];
  baseline: Baseline | null;
  /** Set by the server so a result can be traced back to its request. */
  requestId?: string;
}

/** What the nurse decided about a suggestion. Stored with the visit. */
export interface CareDecision {
  outcome: "confirmed" | "adjusted";
  finalStatus: CheckStatus;
  /** Required when adjusted: the nurse's own words. */
  reason?: string;
  nurseId: string;
  decidedAt: string;
}

/** The check result and the nurse's decision on it, as kept on a completed visit. */
export interface VisitCareCheck extends CareCheckResult {
  decision: CareDecision;
}

// ── Input validation (shared by the API route and the form) ────────────────

type Range = { min: number; max: number };
const within = (n: unknown, range: Range): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= range.min && n <= range.max;

const ADHERENCE: readonly MedicationAdherence[] = ["taken_as_scheduled", "partial", "missed"];
const MAX_HISTORY = 12;

export type ParseResult = { ok: true; input: CareCheckInput } | { ok: false; errors: string[] };

/**
 * Checks an untrusted payload and returns a clean copy containing only the
 * fields the rules use. Anything else in the payload is dropped, not stored.
 */
export function parseCareCheckInput(raw: unknown): ParseResult {
  const errors: string[] = [];
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const cur = (typeof body.current === "object" && body.current !== null ? body.current : {}) as Record<string, unknown>;

  const { systolic, diastolic, pulse, temperature, weight, medicationAdherence } = cur;
  if (!within(systolic, PLAUSIBLE_RANGE.systolic)) errors.push("Top blood pressure number is missing or not plausible.");
  if (!within(diastolic, PLAUSIBLE_RANGE.diastolic)) errors.push("Bottom blood pressure number is missing or not plausible.");
  if (typeof systolic === "number" && typeof diastolic === "number" && diastolic >= systolic) {
    errors.push("The bottom blood pressure number must be lower than the top number.");
  }
  if (!within(pulse, PLAUSIBLE_RANGE.pulse)) errors.push("Pulse is missing or not plausible.");
  if (!within(temperature, PLAUSIBLE_RANGE.temperature)) errors.push("Temperature is missing or not plausible.");
  if (weight !== undefined && !within(weight, PLAUSIBLE_RANGE.weight)) errors.push("Weight is not plausible.");
  if (!ADHERENCE.includes(medicationAdherence as MedicationAdherence)) errors.push("Medication answer is missing.");

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  if (rawHistory.length > MAX_HISTORY) errors.push(`At most ${MAX_HISTORY} earlier readings are accepted.`);
  const history: Reading[] = [];
  for (const item of rawHistory.slice(0, MAX_HISTORY)) {
    const r = (typeof item === "object" && item !== null ? item : {}) as Record<string, unknown>;
    if (
      typeof r.recordedAt === "string" &&
      !Number.isNaN(Date.parse(r.recordedAt)) &&
      within(r.systolic, PLAUSIBLE_RANGE.systolic) &&
      within(r.diastolic, PLAUSIBLE_RANGE.diastolic) &&
      within(r.pulse, PLAUSIBLE_RANGE.pulse)
    ) {
      history.push({ recordedAt: r.recordedAt, systolic: r.systolic, diastolic: r.diastolic, pulse: r.pulse });
    } else {
      errors.push("An earlier reading is malformed.");
      break;
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  history.sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return {
    ok: true,
    input: {
      current: {
        systolic: systolic as number,
        diastolic: diastolic as number,
        pulse: pulse as number,
        temperature: temperature as number,
        ...(typeof weight === "number" ? { weight } : {}),
        medicationAdherence: medicationAdherence as MedicationAdherence,
      },
      history,
    },
  };
}

// ── The rules ───────────────────────────────────────────────────────────────

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The person's usual: the middle value of their last few visits, so one odd reading can't skew it. */
export function computeBaseline(history: Reading[]): Baseline | null {
  const recent = history.slice(-THRESHOLDS.baselineWindow);
  if (recent.length < THRESHOLDS.minVisitsForBaseline) return null;
  return {
    systolic: Math.round(median(recent.map((r) => r.systolic))),
    diastolic: Math.round(median(recent.map((r) => r.diastolic))),
    pulse: Math.round(median(recent.map((r) => r.pulse))),
    basedOnVisits: recent.length,
  };
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = { urgent: 0, watch: 1, info: 2 };

export function runCareCheck(
  input: CareCheckInput,
  source: CheckSource,
  now: Date = new Date(),
): CareCheckResult {
  const { current, history } = input;
  const { systolic: s, diastolic: d, pulse, temperature: temp } = current;
  const bp = `${s}/${d} mmHg`;
  const baseline = computeBaseline(history);
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push(f);

  // Blood pressure against this person's own usual. It runs first so that, where
  // only one reason is shown, the personal one leads.
  const T = THRESHOLDS;
  if (baseline) {
    const usual = `${baseline.systolic}/${baseline.diastolic} mmHg`;
    const span = `the middle of their last ${baseline.basedOnVisits} visits`;
    const ds = s - baseline.systolic;
    const dd = d - baseline.diastolic;
    if (ds >= T.bpRiseFromUsual.systolic || dd >= T.bpRiseFromUsual.diastolic) {
      const gap =
        ds >= T.bpRiseFromUsual.systolic
          ? `${ds} mmHg higher on the top number`
          : `${dd} mmHg higher on the bottom number`;
      add({
        ruleId: "BP_RISE",
        severity: "watch",
        headline: "Blood pressure was higher than usual",
        reason: `Blood pressure ${bp} is ${gap} than their usual ${usual} (${span}).`,
      });
    } else if (-ds >= T.bpDropFromUsual.systolic) {
      add({
        ruleId: "BP_DROP",
        severity: "watch",
        headline: "Blood pressure was lower than usual",
        reason: `Blood pressure ${bp} is ${-ds} mmHg lower on the top number than their usual ${usual} (${span}).`,
      });
    }
  }

  // Blood pressure against fixed lines.
  if (s >= T.bpUrgent.systolic || d >= T.bpUrgent.diastolic) {
    add({
      ruleId: "BP_URGENT",
      severity: "urgent",
      headline: "Blood pressure is very high",
      reason: `Blood pressure ${bp} is at or above the urgent line of ${T.bpUrgent.systolic}/${T.bpUrgent.diastolic} mmHg.`,
    });
  } else if (s >= T.bpHigh.systolic || d >= T.bpHigh.diastolic) {
    add({
      ruleId: "BP_HIGH",
      severity: "watch",
      headline: "Blood pressure was higher than usual",
      reason: `Blood pressure ${bp} is at or above ${T.bpHigh.systolic}/${T.bpHigh.diastolic} mmHg.`,
    });
  } else if (s < T.bpLow.systolic || d < T.bpLow.diastolic) {
    add({
      ruleId: "BP_LOW",
      severity: "watch",
      headline: "Blood pressure was lower than usual",
      reason: `Blood pressure ${bp} is below ${T.bpLow.systolic}/${T.bpLow.diastolic} mmHg.`,
    });
  }

  // A slow climb that no single reading would reveal.
  const hasBpFinding = findings.some((f) => f.ruleId.startsWith("BP_"));
  const run = history.slice(-(T.bpTrend.visits - 1)).map((r) => r.systolic);
  if (!hasBpFinding && run.length === T.bpTrend.visits - 1) {
    const series = [...run, s];
    const rising = series.every((v, i) => i === 0 || v > series[i - 1]);
    if (rising && s - series[0] >= T.bpTrend.totalRise) {
      add({
        ruleId: "BP_TREND",
        severity: "watch",
        headline: "Blood pressure has been creeping up",
        reason: `The top number has risen across the last ${T.bpTrend.visits} visits: ${series.join(", ")} mmHg.`,
      });
    }
  }

  // Pulse.
  if (pulse > T.pulseHigh) {
    add({
      ruleId: "PULSE_HIGH",
      severity: "watch",
      headline: "Pulse was faster than usual",
      reason: `Pulse ${pulse} bpm is above ${T.pulseHigh} bpm.`,
    });
  } else if (pulse < T.pulseLow) {
    add({
      ruleId: "PULSE_LOW",
      severity: "watch",
      headline: "Pulse was slower than usual",
      reason: `Pulse ${pulse} bpm is below ${T.pulseLow} bpm.`,
    });
  } else if (baseline && pulse - baseline.pulse >= T.pulseRiseFromUsual) {
    add({
      ruleId: "PULSE_RISE",
      severity: "info",
      headline: "Pulse was a little faster than usual",
      reason: `Pulse ${pulse} bpm is ${pulse - baseline.pulse} bpm above their usual ${baseline.pulse} bpm. This alone doesn't change the status.`,
    });
  }

  // Temperature.
  const tempText = `${temp.toFixed(1)} °C`;
  if (temp >= T.temperature.urgentHigh || temp <= T.temperature.urgentLow) {
    add({
      ruleId: "TEMP_URGENT",
      severity: "urgent",
      headline: temp >= T.temperature.urgentHigh ? "Temperature is very high" : "Temperature is very low",
      reason: `Temperature ${tempText} is outside the urgent range of ${T.temperature.urgentLow.toFixed(1)} to ${T.temperature.urgentHigh.toFixed(1)} °C.`,
    });
  } else if (temp >= T.temperature.high) {
    add({
      ruleId: "TEMP_HIGH",
      severity: "watch",
      headline: "Temperature was higher than usual",
      reason: `Temperature ${tempText} is at or above ${T.temperature.high.toFixed(1)} °C.`,
    });
  } else if (temp < T.temperature.low) {
    add({
      ruleId: "TEMP_LOW",
      severity: "watch",
      headline: "Temperature was lower than usual",
      reason: `Temperature ${tempText} is below ${T.temperature.low.toFixed(1)} °C.`,
    });
  }

  // Medication.
  if (current.medicationAdherence === "missed") {
    add({
      ruleId: "MED_MISSED",
      severity: "watch",
      headline: "Medication doses were missed",
      reason: "The nurse recorded that medication doses were missed.",
    });
  } else if (current.medicationAdherence === "partial") {
    add({
      ruleId: "MED_PARTIAL",
      severity: "info",
      headline: "Some medication doses were missed",
      reason: "The nurse recorded that some doses were missed. This alone doesn't change the status.",
    });
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const suggestedStatus: CheckStatus = findings.some((f) => f.severity === "urgent")
    ? "red"
    : findings.some((f) => f.severity === "watch")
      ? "yellow"
      : "green";

  return {
    modelVersion: MODEL_VERSION,
    source,
    evaluatedAt: now.toISOString(),
    suggestedStatus,
    findings,
    baseline,
  };
}

// ── Plain-language description of the rules, for the "How this works" panel ─

export interface RuleDescription {
  id: string;
  text: string;
}

/** Built from THRESHOLDS so the panel can never disagree with the code. */
export function describeRules(): RuleDescription[] {
  const T = THRESHOLDS;
  return [
    {
      id: "BP_RISE",
      text: `Blood pressure ${T.bpRiseFromUsual.systolic} mmHg or more above their usual on the top number, or ${T.bpRiseFromUsual.diastolic} mmHg or more on the bottom number. "Usual" is the middle of their last ${T.baselineWindow} visits, once there are at least ${T.minVisitsForBaseline}.`,
    },
    {
      id: "BP_HIGH",
      text: `Blood pressure at or above ${T.bpHigh.systolic}/${T.bpHigh.diastolic} mmHg, or below ${T.bpLow.systolic}/${T.bpLow.diastolic} mmHg.`,
    },
    {
      id: "BP_URGENT",
      text: `Blood pressure at or above ${T.bpUrgent.systolic}/${T.bpUrgent.diastolic} mmHg is marked urgent.`,
    },
    {
      id: "BP_TREND",
      text: `Top number rising at each of the last ${T.bpTrend.visits} visits by ${T.bpTrend.totalRise} mmHg or more in total, even if no single reading is high. This mainly helps with new clients, who don't have a usual yet.`,
    },
    {
      id: "PULSE",
      text: `Pulse above ${T.pulseHigh} or below ${T.pulseLow} bpm. A rise of ${T.pulseRiseFromUsual} bpm over their usual is noted but doesn't change the status on its own.`,
    },
    {
      id: "TEMP",
      text: `Temperature at or above ${T.temperature.high.toFixed(1)} °C or below ${T.temperature.low.toFixed(1)} °C. Urgent at ${T.temperature.urgentHigh.toFixed(1)} °C or above, or ${T.temperature.urgentLow.toFixed(1)} °C or below.`,
    },
    { id: "MED", text: "Missed medication doses are flagged. Some missed doses are noted only." },
  ];
}

/** What the check does not do. Shown next to the rules, never hidden. */
export const CARE_CHECK_LIMITS: string[] = [
  "It is decision support, not a diagnosis. A nurse always confirms or changes the status.",
  "It reads numbers only. It does not read the nurse's notes, so symptoms such as dizziness are the nurse's call.",
  "With fewer than three earlier visits it has no personal usual to compare against, so it uses the fixed lines only.",
  "It only looks at earlier visits if the family has allowed it. If they turn that off, it uses the fixed lines only.",
  "It uses general adult limits and does not yet adjust for a person's conditions or medicines.",
  "These rules haven't been clinically validated. Do not use them for real patients.",
];
