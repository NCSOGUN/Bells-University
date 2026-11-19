// Single source of truth for demo data. Nothing here talks to a backend.
// Every screen reads from the state this file seeds.

import type { VisitCareCheck } from "./care-check";
import { applyCareChecks, deriveElderStatus, type VisitRecord } from "./elder-status";
import type { NurseOnboardingDraft } from "./nurse-onboarding";
import type { OnboardingDraft } from "./onboarding";
import { DEMO_TIME_ZONE } from "./time-zone";
import type { VisitWorkflow } from "./visit-flow";

export { DEMO_TIME_ZONE };

export type CareStatus = "green" | "yellow" | "red";

/** What a family member agreed to for their relative, and what the relative agreed to in person. */
export interface ElderConsent {
  choices: {
    /** Required for the service: readings are shared with the nurse and care circle. */
    sharing: boolean;
    /** Optional: the Care Check may compare readings with their own earlier visits. */
    personalisedCheck: boolean;
  };
  representative: { name: string; relationship: string };
  givenAt: string;
  /** The elder's own yes, recorded by their nurse at the first visit. */
  inPerson?: { at: string; nurseId: string };
  deletionRequestedAt?: string;
  log: { at: string; by: string; change: string }[];
}

export interface Elder {
  id: string;
  name: string;
  age: number;
  city: "Lagos" | "Ilorin";
  address: string;
  relationship: string; // "Mother", "Father"
  careNeeds: string; // plain-language free text, per PRD
  conditions: string[]; // ["Hypertension", "Type 2 diabetes"]
  medications: string[];
  planId: string;
  assignedNurseId: string;
  careStatus: CareStatus;
  careStatusMessage: string; // descriptive microcopy, per UX Addendum
  consent?: ElderConsent;
  /**
   * Who looks after this person, when it differs from the account's own relationship
   * and sponsor (which describe the first relative). Left out for that first relative.
   */
  circle?: { relationship: string; sponsor?: Sponsor };
  nextBillingDate: string; // ISO, Journey doc step 6: "payment status/history"
  paymentStatus: PaymentStatus;
}

export type PaymentStatus = "active" | "past_due";

export interface Nurse {
  id: string;
  name: string;
  initials: string;
  licenceId: string; // "NMCN/RN/482910"
  yearsExperience: number;
  specializations: string[];
  city: string;
  microBio: string; // state-level experience, per UX Addendum §3B
  verified: boolean;
  avgTravelMinutes: number;
  rating: number;
}

export interface Vitals {
  bloodPressure: string; // "148/92"
  pulse: number;
  temperature: number;
  weight: number;
  bloodSugar?: number;
}

export interface Visit {
  id: string;
  elderId: string;
  nurseId: string;
  scheduledAt: string; // ISO
  status: "scheduled" | "in_progress" | "complete";
  checkInAt?: string;
  checkOutAt?: string;
  gpsConfirmed: boolean;
  gpsAddress?: string;
  vitals?: Vitals;
  medicationAdherence?: "taken_as_scheduled" | "partial" | "missed";
  mobilityNote?: string;
  wellbeingNote?: string;
  nurseNotes?: string;
  checkOutGpsConfirmed?: boolean; // location at check-out, when the visit ends
  /** Derived: true when the nurse-confirmed status is not Green. Never set by hand. */
  flagged: boolean;
  /** A nurse's own words, or what the Care Check saw. Only present when flagged. */
  flagReason?: string;
  /** The Care Check result and the nurse's decision on it. Present on completed visits. */
  careCheck?: VisitCareCheck;
}

export interface Plan {
  id: string;
  name: string;
  priceNGN: number;
  visitsPerWeek: number; // display text is derived from this unless frequencyLabel is set
  /** For plans the weekly count doesn't describe, e.g. "Daily or live-in". */
  frequencyLabel?: string;
  features: string[];
}

export interface Sponsor {
  name: string;
  relationship: string;
  city: string; // diaspora location, shown as a second avatar on the dashboard
}

export interface FamilyAccount {
  id: string;
  name: string;
  phone: string;
  relationship: string; // relationship of this account holder to the elder
  planId: string;
  elderIds: string[];
  sponsor?: Sponsor;
}

export type AssignmentStatus = "pending" | "accepted" | "declined";

export interface AssignmentRequest {
  id: string;
  elderId: string;
  nurseId: string;
  requestedAt: string; // ISO
  status: AssignmentStatus;
  declineReason?: string;
}

export interface DemoState {
  familyAccount: FamilyAccount;
  elders: Elder[];
  nurses: Nurse[];
  visits: Visit[];
  plans: Plan[];
  assignmentRequests: AssignmentRequest[];
  /** What a visitor typed into the F1–F7 flow. Never turned into records above. */
  onboarding: OnboardingDraft;
  /** What a visitor typed into the N1–N5 flow. Never turned into a Nurse record. */
  nurseOnboarding: NurseOnboardingDraft;
  /** In-progress visit reports, keyed by the existing Visit id. */
  visitWorkflows: Record<string, VisitWorkflow>;
  /** Which of the family account's relatives the family screens show. Defaults to the first. */
  familyViewingElderId?: string;
}

export const PLANS: Plan[] = [
  {
    id: "essential",
    name: "Essential",
    priceNGN: 55000,
    visitsPerWeek: 1,
    features: ["Vitals check", "Medication reminders", "Weekly WhatsApp report"],
  },
  {
    id: "standard",
    name: "Standard",
    priceNGN: 100000,
    visitsPerWeek: 2,
    features: ["Full vitals & medication management", "Twice-weekly reports", "Priority nurse matching"],
  },
  {
    id: "live-in",
    name: "Live-In",
    priceNGN: 200000,
    visitsPerWeek: 7,
    frequencyLabel: "Daily or live-in",
    features: ["Daily care & companionship", "Real-time family updates", "Dedicated nurse"],
  },
];

const NURSE_ADAEZE_ID = "nurse-adaeze";

/** The nurse the demo's nurse screens are signed in as. */
export const DEMO_NURSE_ID = NURSE_ADAEZE_ID;

// Per-visit pay behind the earning maths: a visit fee plus a transport allowance.
export const VISIT_FEE_NGN = 6_000;
export const TRANSPORT_ALLOWANCE_NGN = 750;
/** What a nurse earns for one completed visit, transport included. */
export const EARNINGS_PER_VISIT_NGN = VISIT_FEE_NGN + TRANSPORT_ALLOWANCE_NGN;

const NURSES: Nurse[] = [
  {
    id: NURSE_ADAEZE_ID,
    name: "Adaeze Okonkwo",
    initials: "AO",
    licenceId: "NMCN/RN/482910",
    yearsExperience: 5,
    specializations: ["Geriatric care", "Post-operative care"],
    city: "Ilorin",
    microBio:
      "Five years across Kwara State's General Hospital and home-care postings, focused on elderly patients with chronic conditions.",
    verified: true,
    avgTravelMinutes: 18,
    rating: 4.9,
  },
];

// Seed dates are relative to "today" so the demo never looks stale. Times are
// pinned to Lagos (UTC+1, no DST) so the server (UTC on Vercel) and the
// browser produce identical ISO strings and hydration doesn't mismatch.
const LAGOS_UTC_OFFSET_HOURS = 1;

function daysFromNow(days: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(hour - LAGOS_UTC_OFFSET_HOURS, minute, 0, 0);
  return d.toISOString();
}

/** "Saturday", the weekday of an ISO date, in Lagos. */
function weekdayOf(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: DEMO_TIME_ZONE, weekday: "long" }).format(
    new Date(iso),
  );
}

/** "today at 1:00 pm" or "on Saturday at 9:00 am", in Lagos. */
function whenOf(iso: string): string {
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: DEMO_TIME_ZONE });
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: DEMO_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
  const isToday = dayKey.format(new Date(iso)) === dayKey.format(new Date());
  return `${isToday ? "today" : `on ${weekdayOf(iso)}`} at ${time}`;
}

/** Status copy for a client nobody has visited yet. */
function firstVisitMessage(visitAt: string): string {
  return `First visit is scheduled ${whenOf(visitAt)}. No readings yet.`;
}

const ELDER_JOSEPH_ID = "elder-joseph";
const ELDER_GRACE_ID = "elder-grace";
const ELDER_IBRAHIM_ID = "elder-ibrahim";
const ELDER_ADUNNI_ID = "elder-adunni";

interface StatusDates {
  graceFirstVisitAt: string;
  ibrahimFirstVisitAt: string;
}

// Status copy that mentions a visit is built from that visit's date, so it
// always matches the records it describes.
// An elder with completed visits has no status here: it is derived from those
// visits in createSeedState. Elders with no visits yet carry their own line.
/** A seeded consent record: the family agreed `givenDaysAgo`, and the elder may have agreed in person. */
function seedConsent(
  representative: { name: string; relationship: string },
  elderFirstName: string,
  givenDaysAgo: number,
  inPersonAt?: string,
): ElderConsent {
  const givenAt = daysFromNow(-givenDaysAgo, 10, 0);
  return {
    choices: { sharing: true, personalisedCheck: true },
    representative,
    givenAt,
    inPerson: inPersonAt ? { at: inPersonAt, nurseId: NURSE_ADAEZE_ID } : undefined,
    log: [
      { at: givenAt, by: representative.name, change: "Agreed to share readings with the nurse and care circle" },
      { at: givenAt, by: representative.name, change: "Allowed the personalised Care Check" },
      ...(inPersonAt ? [{ at: inPersonAt, by: "Nurse Adaeze", change: `Recorded that ${elderFirstName} agreed in person` }] : []),
    ],
  };
}

type SeedElder = Omit<Elder, "careStatus" | "careStatusMessage"> &
  Partial<Pick<Elder, "careStatus" | "careStatusMessage">>;

const buildElders = ({ graceFirstVisitAt, ibrahimFirstVisitAt }: StatusDates): SeedElder[] => [
  {
    id: ELDER_JOSEPH_ID,
    name: "Joseph Okafor",
    age: 74,
    city: "Ilorin",
    address: "14 Fate Road, Ilorin, Kwara State",
    relationship: "Father",
    careNeeds:
      "Needs help remembering his blood pressure medication and someone to check on him since he lives alone.",
    conditions: ["Hypertension"],
    medications: ["Amlodipine 10mg, once daily"],
    planId: "essential",
    assignedNurseId: NURSE_ADAEZE_ID,
    consent: seedConsent({ name: "Grace Okafor", relationship: "Daughter" }, "Joseph", 45, daysFromNow(-40, 9, 2)),
    nextBillingDate: daysFromNow(18),
    paymentStatus: "active",
  },
  {
    id: "elder-bola",
    name: "Bola Adeyemi",
    age: 68,
    city: "Ilorin",
    address: "22 Sango Road, Ilorin, Kwara State",
    relationship: "Mother",
    careNeeds: "Help with mobility exercises and daily check-ins after a hip surgery.",
    conditions: ["Post-hip surgery recovery"],
    medications: ["Paracetamol, as needed"],
    planId: "essential",
    assignedNurseId: NURSE_ADAEZE_ID,
    consent: seedConsent({ name: "Tunde Adeyemi", relationship: "Son" }, "Bola", 3, daysFromNow(0, 8, 2)),
    nextBillingDate: daysFromNow(9),
    paymentStatus: "active",
  },
  {
    id: ELDER_GRACE_ID,
    name: "Grace Nwosu",
    age: 81,
    city: "Ilorin",
    address: "5 Unity Road, Ilorin, Kwara State",
    relationship: "Grandmother",
    careNeeds: "Daily vitals check and company; family lives in Lagos.",
    conditions: ["Type 2 diabetes"],
    medications: ["Metformin 500mg, twice daily"],
    planId: "standard",
    assignedNurseId: NURSE_ADAEZE_ID,
    careStatus: "green",
    careStatusMessage: firstVisitMessage(graceFirstVisitAt),
    consent: seedConsent({ name: "Chika Nwosu", relationship: "Grandson" }, "Grace", 2),
    nextBillingDate: daysFromNow(22),
    paymentStatus: "active",
  },
  {
    id: ELDER_IBRAHIM_ID,
    name: "Ibrahim Suleiman",
    age: 70,
    city: "Ilorin",
    address: "9 Post Office Road, Ilorin, Kwara State",
    relationship: "Father",
    careNeeds: "Reminders to take medication on schedule.",
    conditions: ["Hypertension", "Mild arthritis"],
    medications: ["Lisinopril 20mg, once daily"],
    planId: "essential",
    assignedNurseId: NURSE_ADAEZE_ID,
    careStatus: "green",
    careStatusMessage: firstVisitMessage(ibrahimFirstVisitAt),
    consent: seedConsent({ name: "Yusuf Suleiman", relationship: "Son" }, "Ibrahim", 32, daysFromNow(-28, 16, 32)),
    nextBillingDate: daysFromNow(4),
    paymentStatus: "active",
  },
  {
    id: ELDER_ADUNNI_ID,
    name: "Adunni Lawal",
    age: 77,
    city: "Ilorin",
    address: "17 Ibrahim Taiwo Road, Ilorin, Kwara State",
    relationship: "Aunt",
    careNeeds: "Blood pressure checks while her doctor adjusts her treatment.",
    conditions: ["Long-standing hypertension"],
    medications: ["Amlodipine 10mg, once daily", "Losartan 50mg, once daily"],
    planId: "essential",
    assignedNurseId: NURSE_ADAEZE_ID,
    consent: seedConsent({ name: "Grace Okafor", relationship: "Niece" }, "Adunni", 30, daysFromNow(-28, 11, 32)),
    circle: { relationship: "Niece" },
    nextBillingDate: daysFromNow(12),
    paymentStatus: "active",
  },
  {
    id: "elder-funmi",
    name: "Funmilayo Bello",
    age: 76,
    city: "Ilorin",
    address: "31 Taiwo Road, Ilorin, Kwara State",
    relationship: "Mother",
    careNeeds: "New client awaiting nurse assignment; needs help with mobility.",
    conditions: ["Osteoarthritis"],
    medications: ["Ibuprofen 400mg, as needed"],
    planId: "essential",
    assignedNurseId: "",
    careStatus: "green",
    careStatusMessage: "Awaiting first visit.",
    consent: seedConsent({ name: "Bisi Bello", relationship: "Daughter" }, "Funmilayo", 1),
    nextBillingDate: daysFromNow(30),
    paymentStatus: "active",
  },
];

// Joseph Okafor's six-visit arc: normal, normal, normal, normal, flagged, resolved.
const buildJosephVisits = (): VisitRecord[] => [
  {
    id: "visit-joseph-1",
    elderId: ELDER_JOSEPH_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(-40),
    status: "complete",
    checkInAt: daysFromNow(-40, 9, 2),
    checkOutAt: daysFromNow(-40, 9, 34),
    gpsConfirmed: true,
    gpsAddress: "14 Fate Road, Ilorin, Kwara State",
    vitals: { bloodPressure: "128/82", pulse: 74, temperature: 36.6, weight: 78 },
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Walking independently, no difficulty.",
    wellbeingNote: "In good spirits, mentioned enjoying visits from a neighbour.",
    nurseNotes: "No concerns. Continue current medication schedule.",
  },
  {
    id: "visit-joseph-2",
    elderId: ELDER_JOSEPH_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(-33),
    status: "complete",
    checkInAt: daysFromNow(-33, 9, 0),
    checkOutAt: daysFromNow(-33, 9, 31),
    gpsConfirmed: true,
    gpsAddress: "14 Fate Road, Ilorin, Kwara State",
    vitals: { bloodPressure: "130/83", pulse: 76, temperature: 36.7, weight: 78 },
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Walking independently, no difficulty.",
    wellbeingNote: "Reported sleeping well.",
    nurseNotes: "No concerns.",
  },
  {
    id: "visit-joseph-3",
    elderId: ELDER_JOSEPH_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(-26),
    status: "complete",
    checkInAt: daysFromNow(-26, 9, 5),
    checkOutAt: daysFromNow(-26, 9, 36),
    gpsConfirmed: true,
    gpsAddress: "14 Fate Road, Ilorin, Kwara State",
    vitals: { bloodPressure: "129/82", pulse: 75, temperature: 36.6, weight: 77 },
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Walking independently, no difficulty.",
    wellbeingNote: "Cheerful, no complaints.",
    nurseNotes: "No concerns.",
  },
  {
    id: "visit-joseph-4",
    elderId: ELDER_JOSEPH_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(-19),
    status: "complete",
    checkInAt: daysFromNow(-19, 9, 1),
    checkOutAt: daysFromNow(-19, 9, 33),
    gpsConfirmed: true,
    gpsAddress: "14 Fate Road, Ilorin, Kwara State",
    vitals: { bloodPressure: "132/84", pulse: 77, temperature: 36.7, weight: 78 },
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Walking independently, no difficulty.",
    wellbeingNote: "In good spirits.",
    nurseNotes: "Slightly elevated systolic. Nothing concerning yet, will continue to monitor.",
  },
  {
    id: "visit-joseph-5",
    elderId: ELDER_JOSEPH_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(-12),
    status: "complete",
    checkInAt: daysFromNow(-12, 9, 3),
    checkOutAt: daysFromNow(-12, 9, 40),
    gpsConfirmed: true,
    gpsAddress: "14 Fate Road, Ilorin, Kwara State",
    vitals: { bloodPressure: "148/92", pulse: 88, temperature: 36.8, weight: 78 },
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Reported brief dizziness on standing.",
    wellbeingNote: "Felt lightheaded earlier in the day, resting now.",
    nurseNotes:
      "Blood pressure and pulse elevated versus baseline; patient reported dizziness on standing. Advised rest and fluids, family notified, will recheck at next visit.",
    flagReason: "Elevated blood pressure (148/92) with reported dizziness.",
  },
  {
    id: "visit-joseph-6",
    elderId: ELDER_JOSEPH_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(-5),
    status: "complete",
    checkInAt: daysFromNow(-5, 9, 2),
    checkOutAt: daysFromNow(-5, 9, 35),
    gpsConfirmed: true,
    gpsAddress: "14 Fate Road, Ilorin, Kwara State",
    vitals: { bloodPressure: "134/86", pulse: 78, temperature: 36.6, weight: 78 },
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "No dizziness reported, walking independently.",
    wellbeingNote: "Feeling much better, no further lightheadedness.",
    nurseNotes:
      "Follow-up on last visit's elevated reading: blood pressure trending back toward baseline. No further dizziness reported. Continue monitoring at next visit.",
  },
  {
    id: "visit-joseph-next",
    elderId: ELDER_JOSEPH_ID,
    nurseId: NURSE_ADAEZE_ID,
    // Today, after Bola's completed visit: Joseph is the nurse's next call, so
    // the flagged reading from visit 5 is what she walks in knowing about.
    scheduledAt: daysFromNow(0, 9, 30),
    status: "scheduled",
    gpsConfirmed: false,
  },
];

// Ibrahim Suleiman: four steady weekly visits, well controlled on treatment. His
// usual (about 117/75) is the case a fixed 140/90 limit would never catch: a
// reading of 138/86 passes the textbook line but is far above HIS normal.
const buildIbrahimVisits = (): VisitRecord[] => {
  const history: Array<[number, string, number, string]> = [
    // days ago, blood pressure, pulse, nurse's note
    [-28, "116/74", 70, "First visit. Well controlled on lisinopril. Reminder routine agreed."],
    [-21, "118/76", 71, "No concerns. Taking medication each morning."],
    [-14, "115/74", 69, "No concerns."],
    [-7, "117/75", 70, "No concerns. Continue current medication schedule."],
  ];
  return history.map(([days, bloodPressure, pulse, nurseNotes], i) => ({
    id: `visit-ibrahim-${i + 1}`,
    elderId: ELDER_IBRAHIM_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(days, 16, 30),
    status: "complete" as const,
    checkInAt: daysFromNow(days, 16, 32),
    checkOutAt: daysFromNow(days, 17, 3),
    gpsConfirmed: true,
    gpsAddress: "9 Post Office Road, Ilorin, Kwara State",
    vitals: { bloodPressure, pulse, temperature: 36.6, weight: 72 },
    medicationAdherence: "taken_as_scheduled" as const,
    mobilityNote: "Walking independently. Mild stiffness in the knees in the morning.",
    wellbeingNote: "In good spirits.",
    nurseNotes,
  }));
};

// Adunni Lawal: the reverse of Ibrahim. Her usual (about 147/92) is itself above
// the 140/90 line. A reading near her usual is "normal for her", but the fixed
// limit still flags it every time: a personal baseline never talks the check
// out of a high reading. All four earlier visits are flagged for that reason.
const buildAdunniVisits = (): VisitRecord[] => {
  const history: Array<[number, string, number, string]> = [
    [-28, "146/92", 76, "First visit. Blood pressure above the limit. Her doctor is aware and reviewing her treatment."],
    [-21, "148/93", 77, "Above the limit again. Losartan added by her doctor this week."],
    [-14, "145/91", 75, "Still above the limit. Taking both medicines each morning."],
    [-7, "147/92", 76, "Still above the limit. Doctor's review booked for next month."],
  ];
  return history.map(([days, bloodPressure, pulse, nurseNotes], i) => ({
    id: `visit-adunni-${i + 1}`,
    elderId: ELDER_ADUNNI_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(days, 11, 30),
    status: "complete" as const,
    checkInAt: daysFromNow(days, 11, 32),
    checkOutAt: daysFromNow(days, 12, 4),
    gpsConfirmed: true,
    gpsAddress: "17 Ibrahim Taiwo Road, Ilorin, Kwara State",
    vitals: { bloodPressure, pulse, temperature: 36.7, weight: 70 },
    medicationAdherence: "taken_as_scheduled" as const,
    mobilityNote: "Walking independently.",
    wellbeingNote: "Feels well. No headaches or dizziness.",
    nurseNotes,
  }));
};

// Today's visits across the rest of Nurse Adaeze's client list.
const buildTodayVisits = (): VisitRecord[] => [
  {
    id: "visit-bola-today",
    elderId: "elder-bola",
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(0, 8, 0),
    status: "complete",
    checkInAt: daysFromNow(0, 8, 2),
    checkOutAt: daysFromNow(0, 8, 30),
    gpsConfirmed: true,
    gpsAddress: "22 Sango Road, Ilorin, Kwara State",
    vitals: { bloodPressure: "118/76", pulse: 70, temperature: 36.5, weight: 65 },
    medicationAdherence: "taken_as_scheduled",
    mobilityNote: "Walking with a cane, steady.",
    wellbeingNote: "In good spirits.",
    nurseNotes: "Hip recovery progressing well.",
  },
  {
    id: "visit-adunni-today",
    elderId: ELDER_ADUNNI_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(0, 11, 30),
    status: "scheduled",
    gpsConfirmed: false,
  },
  {
    id: "visit-grace-today",
    elderId: ELDER_GRACE_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(0, 13, 0),
    status: "scheduled",
    gpsConfirmed: false,
  },
  {
    id: "visit-ibrahim-today",
    elderId: ELDER_IBRAHIM_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(0, 16, 30),
    status: "scheduled",
    gpsConfirmed: false,
  },
];

const FAMILY_ACCOUNT: FamilyAccount = {
  id: "family-grace-okafor",
  name: "Grace Okafor",
  phone: "+2348031234567",
  relationship: "Daughter",
  planId: "essential",
  elderIds: [ELDER_JOSEPH_ID, ELDER_ADUNNI_ID],
  sponsor: {
    name: "Emeka Okafor",
    relationship: "Son",
    city: "London, United Kingdom",
  },
};

const buildAssignmentRequests = (): AssignmentRequest[] => [
  {
    id: "assignment-funmi",
    elderId: "elder-funmi",
    nurseId: NURSE_ADAEZE_ID,
    requestedAt: daysFromNow(0, 7, 0),
    status: "pending",
  },
];

/** Fresh, independent copy of the seed, with dates relative to today. */
export function createSeedState(): DemoState {
  const josephRecords = buildJosephVisits();
  const ibrahimRecords = buildIbrahimVisits();
  const todayRecords = buildTodayVisits();
  const graceFirst = todayRecords.find((v) => v.elderId === ELDER_GRACE_ID);
  const ibrahimFirst = todayRecords.find((v) => v.elderId === ELDER_IBRAHIM_ID);
  if (!graceFirst || !ibrahimFirst) {
    throw new Error("Seed invariant: status copy must reference visits that exist");
  }

  // Flags and statuses are not typed in: the Care Check derives them from the
  // visit records, so the family and nurse screens always agree with the data.
  const visits = applyCareChecks([...josephRecords, ...ibrahimRecords, ...buildAdunniVisits(), ...todayRecords]);

  const josephFlags = visits
    .filter((v) => v.elderId === ELDER_JOSEPH_ID && v.status === "complete")
    .map((v) => v.flagged);
  if (josephFlags.join() !== [false, false, false, false, true, false].join()) {
    throw new Error(
      `Seed invariant: Joseph's arc must be normal x4, flagged, resolved. The Care Check rules gave [${josephFlags}]. Change the rules in lib/care-check.ts, not the seed vitals.`,
    );
  }

  const ibrahimFlags = visits.filter((v) => v.elderId === ELDER_IBRAHIM_ID && v.status === "complete").map((v) => v.flagged);
  if (ibrahimFlags.length !== 4 || ibrahimFlags.some(Boolean)) {
    throw new Error(
      `Seed invariant: Ibrahim's four earlier visits must all be normal, so his usual is steady. The Care Check gave [${ibrahimFlags}].`,
    );
  }

  // Every earlier visit is caught by the fixed limit, and none as "higher than her usual".
  const adunni = visits.filter((v) => v.elderId === ELDER_ADUNNI_ID && v.status === "complete");
  const adunniRules = adunni.map((v) => v.careCheck?.findings.map((f) => f.ruleId) ?? []);
  if (adunni.length !== 4 || adunniRules.some((r) => !r.includes("BP_HIGH") || r.includes("BP_RISE"))) {
    throw new Error(
      `Seed invariant: Adunni's four earlier visits must each be over the fixed limit and close to her usual. The Care Check gave [${adunniRules.map((r) => r.join("+")).join(", ")}].`,
    );
  }

  const nurses = NURSES;
  const elders: Elder[] = buildElders({
    graceFirstVisitAt: graceFirst.scheduledAt,
    ibrahimFirstVisitAt: ibrahimFirst.scheduledAt,
  }).map((seed) => {
    const mine = visits.filter((v) => v.elderId === seed.id);
    const derived = deriveElderStatus(mine, nurses.find((n) => n.id === seed.assignedNurseId));
    return {
      ...seed,
      careStatus: derived?.status ?? seed.careStatus ?? "green",
      careStatusMessage: derived?.message ?? seed.careStatusMessage ?? "",
    };
  });
  if (elders.find((e) => e.id === ELDER_JOSEPH_ID)?.careStatus !== "yellow") {
    throw new Error("Seed invariant: Joseph is still being monitored after his flagged visit.");
  }

  return structuredClone({
    familyAccount: FAMILY_ACCOUNT,
    elders,
    nurses,
    visits,
    plans: PLANS,
    assignmentRequests: buildAssignmentRequests(),
    onboarding: {},
    nurseOnboarding: {},
    visitWorkflows: {},
  });
}
