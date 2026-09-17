import type { DemoState } from "./mock-data";

// The N1–N5 front door. Like the family flow, what an applicant types is a
// draft only: finishing it opens the seeded Nurse Adaeze's dashboard and
// never creates or edits a Nurse record.

export const NURSE_CITIES = ["Lagos", "Ilorin"] as const;
export type NurseCity = (typeof NURSE_CITIES)[number];

/** "NMCN/RN/482910": council, register (RN, RM, RPN…), then the number. */
const LICENCE_PATTERN = /^NMCN\/[A-Z]{2,4}\/\d{5,7}$/;

export function normaliseLicence(input: string): string {
  return input.trim().toUpperCase().replace(/\s*\/\s*/g, "/");
}

export function isValidLicenceFormat(input: string): boolean {
  return LICENCE_PATTERN.test(normaliseLicence(input));
}

export const NURSE_DOCUMENTS = [
  { key: "licence", label: "NMCN licence", noun: "NMCN licence", hint: "A photo or scan of your current practising licence" },
  { key: "governmentId", label: "Government ID", noun: "government ID", hint: "NIN slip, passport or driver's licence" },
  { key: "proofOfAddress", label: "Proof of address", noun: "proof of address", hint: "A utility bill or bank statement from the last 3 months" },
] as const;

export type NurseDocumentKey = (typeof NURSE_DOCUMENTS)[number]["key"];

export type ApplicationStatus = "pending_verification" | "in_review" | "approved" | "needs_resubmission";

export const RESUBMISSION = {
  document: "proofOfAddress" as NurseDocumentKey,
  reason:
    "Your proof of address is older than three months. Please upload a utility bill or bank statement dated in the last three months.",
};

export const NURSE_SPECIALIZATIONS = [
  "Geriatric care",
  "Post-operative care",
  "Wound care",
  "Diabetes care",
  "Hypertension care",
  "Mobility support",
  "Palliative care",
] as const;

export const TRAVEL_LIMITS = [15, 30, 45] as const;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const DAY_PARTS = ["Morning", "Afternoon", "Evening"] as const;
export type Weekday = (typeof WEEKDAYS)[number];
export type DayPart = (typeof DAY_PARTS)[number];
/** "Mon-Morning" */
export type AvailabilitySlot = `${Weekday}-${DayPart}`;

export interface NurseProfileDraft {
  specializations: string[];
  area: string;
  maxTravelMinutes: (typeof TRAVEL_LIMITS)[number];
  availability: AvailabilitySlot[];
}

export interface NurseOnboardingDraft {
  applicant?: { name: string; phone: string; licenceId: string; city: NurseCity };
  status?: ApplicationStatus;
  /** When the (simulated) reviewer last changed the status. */
  reviewedAt?: string;
  uploaded?: NurseDocumentKey[];
  profile?: NurseProfileDraft;
  completedAt?: string;
}

export function patchNurseOnboarding(state: DemoState, patch: Partial<NurseOnboardingDraft>): DemoState {
  return { ...state, nurseOnboarding: { ...state.nurseOnboarding, ...patch } };
}

export function clearNurseOnboarding(state: DemoState): DemoState {
  return { ...state, nurseOnboarding: {} };
}

/** Sending documents back: the flagged one must be uploaded again. */
export function requestResubmission(state: DemoState): DemoState {
  return patchNurseOnboarding(state, {
    status: "needs_resubmission",
    reviewedAt: new Date().toISOString(),
    uploaded: (state.nurseOnboarding.uploaded ?? []).filter((d) => d !== RESUBMISSION.document),
  });
}
