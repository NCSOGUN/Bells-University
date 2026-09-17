import { DEMO_TIME_ZONE, EARNINGS_PER_VISIT_NGN, type DemoState, type Visit } from "./mock-data";

// Everything a nurse sees about pay is visits × EARNINGS_PER_VISIT_NGN.

/** The deck's example: one visit a week, about four a month, per client. */
export const EXAMPLE_VISITS_PER_CLIENT = 4;

export function monthlyEarningsFor(clients: number, visitsPerClient = EXAMPLE_VISITS_PER_CLIENT): number {
  return clients * visitsPerClient * EARNINGS_PER_VISIT_NGN;
}

const monthKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: DEMO_TIME_ZONE, year: "numeric", month: "2-digit" });
const monthNameFmt = new Intl.DateTimeFormat("en-GB", { timeZone: DEMO_TIME_ZONE, month: "long", year: "numeric" });

export type PayoutStatus = "paid" | "due";

export interface EarningsPeriod {
  key: string;
  /** "September 2026" */
  label: string;
  visits: Visit[];
  amount: number;
  /** Past months have been paid out; the current one is paid at month end. */
  payout: PayoutStatus;
}

/** The nurse's completed visits grouped by calendar month, newest first. */
export function earningsByMonth(state: DemoState, nurseId: string, now = new Date()): EarningsPeriod[] {
  const currentKey = monthKeyFmt.format(now);
  const groups = new Map<string, Visit[]>();
  for (const visit of state.visits) {
    if (visit.nurseId !== nurseId || visit.status !== "complete") continue;
    const key = monthKeyFmt.format(new Date(visit.scheduledAt));
    groups.set(key, [...(groups.get(key) ?? []), visit]);
  }
  if (!groups.has(currentKey)) groups.set(currentKey, []);

  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, visits]) => ({
      key,
      label: monthNameFmt.format(new Date(`${key}-15T12:00:00Z`)),
      visits: [...visits].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)),
      amount: visits.length * EARNINGS_PER_VISIT_NGN,
      payout: key === currentKey ? "due" : "paid",
    }));
}
