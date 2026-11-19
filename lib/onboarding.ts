import type { DemoState, Elder, Nurse } from "./mock-data";

// The F1–F7 front door. What a visitor types here is kept as a draft so the
// flow feels real and survives a refresh, but it never becomes an Elder,
// Nurse or Visit: every step resolves back into the seeded family account.

/** Cities offered on F4. Only those in SERVICE_CITIES continue to matching. */
export const REQUEST_CITIES = [
  "Lagos",
  "Ilorin",
  "Abuja",
  "Ibadan",
  "Port Harcourt",
  "Kano",
  "Enugu",
  "Benin City",
] as const;

export type RequestCity = (typeof REQUEST_CITIES)[number];

/** Where nurses are available today, the same cities an Elder record can have. */
export const SERVICE_CITIES: readonly Elder["city"][] = ["Lagos", "Ilorin"];

export function isServiceCity(city: string): city is Elder["city"] {
  return (SERVICE_CITIES as readonly string[]).includes(city);
}

export type CodeChannel = "sms" | "whatsapp";

export interface AccountDraft {
  name: string;
  /** Normalised, e.g. "+2348031234567". */
  phone: string;
  codeSentAt?: string;
  codeChannel?: CodeChannel;
  verifiedAt?: string;
}

export interface RelativeDraft {
  name: string;
  age: number;
  city: RequestCity;
  careNeeds: string;
  /** The family member's agreement to share readings, and their optional choice. */
  consent?: { personalisedCheck: boolean; agreedAt: string };
}

export interface PaymentDraft {
  planId: string;
  amountNGN: number;
  reference: string;
  paidAt: string;
}

export interface OnboardingDraft {
  planId?: string;
  account?: AccountDraft;
  relative?: RelativeDraft;
  /** Id of an existing Nurse record, never a copy of one. */
  matchedNurseId?: string;
  payment?: PaymentDraft;
}

export function patchOnboarding(state: DemoState, patch: Partial<OnboardingDraft>): DemoState {
  return { ...state, onboarding: { ...state.onboarding, ...patch } };
}

/** Start over: forget the draft, leave every seeded record alone. */
export function clearOnboarding(state: DemoState): DemoState {
  return { ...state, onboarding: {} };
}

/**
 * Matching always lands on the nurse already caring for the family account's
 * relative, so the dashboard that follows shows the same person.
 */
export function matchedNurseFor(state: DemoState): Nurse | undefined {
  const elder = state.elders.find((e) => e.id === state.familyAccount.elderIds[0]);
  return elder && state.nurses.find((n) => n.id === elder.assignedNurseId);
}

export const OTP_LENGTH = 6;
export const OTP_WINDOW_SECONDS = 60;

/** Seconds left before the code lapses, given when it was sent. */
export function otpSecondsLeft(sentAt: string | undefined, now: number): number {
  if (!sentAt) return 0;
  const elapsed = Math.floor((now - new Date(sentAt).getTime()) / 1000);
  return Math.max(0, OTP_WINDOW_SECONDS - elapsed);
}

/**
 * Accepts Nigerian numbers ("0803 123 4567", "+234 803…") and international
 * ones for family abroad. Returns "+<digits>", or null if it can't be a number.
 */
export function normalisePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (/^0\d{10}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234\d{10}$/.test(digits)) return `+${digits}`;
  if (trimmed.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** "+234 803 123 4567" for Nigerian numbers; other numbers as entered. */
export function formatPhone(phone: string): string {
  const match = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+234 ${match[1]} ${match[2]} ${match[3]}` : phone;
}
