import { DEMO_TIME_ZONE } from "./mock-data";

// All display formatting is pinned to Lagos time so server and browser agree
// and a family member abroad sees the time the visit happened locally.
const LOCALE = "en-GB";

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: DEMO_TIME_ZONE });
const timeFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DEMO_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const weekdayFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: DEMO_TIME_ZONE, weekday: "long" });
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DEMO_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const longDateFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DEMO_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const dayMonthFmt = new Intl.DateTimeFormat(LOCALE, {
  timeZone: DEMO_TIME_ZONE,
  day: "numeric",
  month: "short",
});
const nairaFmt = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

function dayNumber(date: Date): number {
  const [y, m, d] = dayKey.format(date).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Calendar days between today and the date, in Lagos. Negative = past. */
export function daysFromToday(iso: string): number {
  return dayNumber(new Date(iso)) - dayNumber(new Date());
}

/** "9:02 am" */
export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** "Fri 12 Sept" */
export function formatShortDate(iso: string): string {
  return shortDateFmt.format(new Date(iso));
}

/** "Friday 12 September" */
export function formatLongDate(iso: string): string {
  return longDateFmt.format(new Date(iso));
}

/** ["12", "Sept"] — split for narrow chart axes. */
export function formatDayMonthParts(iso: string): [string, string] {
  const parts = dayMonthFmt.formatToParts(new Date(iso));
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return [day, month];
}

/** "today", "yesterday", "on Friday", "on Fri 12 Sept" — reads after a verb. */
export function formatRelativeDay(iso: string): string {
  const diff = daysFromToday(iso);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff === 1) return "tomorrow";
  if (Math.abs(diff) < 7) return `on ${weekdayFmt.format(new Date(iso))}`;
  return `on ${formatShortDate(iso)}`;
}

/** "today", "tomorrow", "in 2 days", "3 days ago" */
export function formatCountdown(iso: string): string {
  const diff = daysFromToday(iso);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return diff > 0 ? `in ${diff} days` : `${-diff} days ago`;
}

export function minutesBetween(startIso: string, endIso: string): number {
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000);
}

/** "₦55,000" */
export function formatNaira(amount: number): string {
  return nairaFmt.format(amount);
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export function firstName(name: string): string {
  return name.split(/\s+/)[0];
}

/** "Nurse Adaeze" */
export function nurseShortName(name: string): string {
  return `Nurse ${firstName(name)}`;
}

const FAMILY_TERMS: Record<string, string> = {
  Father: "Dad",
  Mother: "Mum",
  Grandfather: "Grandpa",
  Grandmother: "Grandma",
};

/** How the family refers to the elder: "Dad", "Mum", or their first name. */
export function familyTermFor(relationship: string, name: string): string {
  return FAMILY_TERMS[relationship] ?? firstName(name);
}
