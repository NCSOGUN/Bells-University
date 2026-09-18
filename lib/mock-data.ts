// Single source of truth for demo data. Nothing here talks to a backend , 
// see DEMO-SPEC.md §5. Every screen reads from the state this file seeds.

import type { NurseOnboardingDraft } from "./nurse-onboarding";
import type { OnboardingDraft } from "./onboarding";
import type { VisitWorkflow } from "./visit-flow";

export type CareStatus = "green" | "yellow" | "red";

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
  flagged: boolean; // drives Yellow/Red status
  flagReason?: string;
}

export interface Plan {
  id: string;
  name: string;
  priceNGN: number;
  visitsPerWeek: number; // display text is always derived from this, never typed
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
}

export const PLANS: Plan[] = [
  {
    id: "essential",
    name: "Essential",
    priceNGN: 40000,
    visitsPerWeek: 1,
    features: ["Basic health checks", "Medication reminders"],
  },
  {
    id: "standard",
    name: "Standard",
    priceNGN: 77000,
    visitsPerWeek: 2,
    features: ["Full vitals & medication management", "24/7 emergency contact"],
  },
  {
    id: "live-in",
    name: "Live-In",
    priceNGN: 150000,
    visitsPerWeek: 7,
    features: ["Daily/live-in nurse", "Real-time dashboard", "Virtual doctor consults"],
  },
];

const NURSE_ADAEZE_ID = "nurse-adaeze";

/** The nurse the demo's nurse screens are signed in as. */
export const DEMO_NURSE_ID = NURSE_ADAEZE_ID;

// Per-visit pay behind the deck's earning maths (spec §7, N1):
// 4 clients × 4 visits a month = ₦80,000.
export const EARNINGS_PER_VISIT_NGN = 80_000 / (4 * 4);

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

export const DEMO_TIME_ZONE = "Africa/Lagos";

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

interface StatusDates {
  josephFlaggedVisitAt: string;
  graceFirstVisitAt: string;
  ibrahimFirstVisitAt: string;
}

// Status copy that mentions a visit is built from that visit's date, so it
// always matches the records it describes.
const buildElders = ({ josephFlaggedVisitAt, graceFirstVisitAt, ibrahimFirstVisitAt }: StatusDates): Elder[] => [
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
    careStatus: "yellow",
    careStatusMessage: `Blood pressure was higher than usual on ${weekdayOf(josephFlaggedVisitAt)}. Nurse Adaeze is checking again this visit.`,
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
    careStatus: "green",
    careStatusMessage: "Recovering well. Everything looked normal at the last visit.",
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
    nextBillingDate: daysFromNow(4),
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
    nextBillingDate: daysFromNow(30),
    paymentStatus: "active",
  },
];

// Joseph Okafor's six-visit arc: normal, normal, normal, normal, flagged, resolved.
const buildJosephVisits = (): Visit[] => [
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
    flagged: false,
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
    flagged: false,
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
    flagged: false,
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
    flagged: false,
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
    flagged: true,
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
    flagged: false,
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
    flagged: false,
  },
];

// Today's visits across the rest of Nurse Adaeze's client list.
const buildTodayVisits = (): Visit[] => [
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
    flagged: false,
  },
  {
    id: "visit-grace-today",
    elderId: ELDER_GRACE_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(0, 13, 0),
    status: "scheduled",
    gpsConfirmed: false,
    flagged: false,
  },
  {
    id: "visit-ibrahim-today",
    elderId: ELDER_IBRAHIM_ID,
    nurseId: NURSE_ADAEZE_ID,
    scheduledAt: daysFromNow(0, 16, 30),
    status: "scheduled",
    gpsConfirmed: false,
    flagged: false,
  },
];

const FAMILY_ACCOUNT: FamilyAccount = {
  id: "family-grace-okafor",
  name: "Grace Okafor",
  phone: "+2348031234567",
  relationship: "Daughter",
  planId: "essential",
  elderIds: [ELDER_JOSEPH_ID],
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
  const josephVisits = buildJosephVisits();
  const todayVisits = buildTodayVisits();
  const flagged = josephVisits.find((v) => v.flagged);
  const graceFirst = todayVisits.find((v) => v.elderId === ELDER_GRACE_ID);
  const ibrahimFirst = todayVisits.find((v) => v.elderId === ELDER_IBRAHIM_ID);
  if (!flagged || !graceFirst || !ibrahimFirst) {
    throw new Error("Seed invariant: status copy must reference visits that exist");
  }

  return structuredClone({
    familyAccount: FAMILY_ACCOUNT,
    elders: buildElders({
      josephFlaggedVisitAt: flagged.scheduledAt,
      graceFirstVisitAt: graceFirst.scheduledAt,
      ibrahimFirstVisitAt: ibrahimFirst.scheduledAt,
    }),
    nurses: NURSES,
    visits: [...josephVisits, ...todayVisits],
    plans: PLANS,
    assignmentRequests: buildAssignmentRequests(),
    onboarding: {},
    nurseOnboarding: {},
    visitWorkflows: {},
  });
}
