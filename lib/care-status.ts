import type { CareStatus } from "./mock-data";

// Family-facing wording for each care status (§4.5: plain language, never
// colour alone). Nurse/admin screens use their own vocabulary.
export const CARE_STATUS_COPY: Record<
  CareStatus,
  { label: string; headline: (familyTerm: string) => string }
> = {
  green: {
    label: "All is well",
    headline: (who) => `${who} is doing well`,
  },
  yellow: {
    label: "Keeping a close eye",
    headline: (who) => `${who} is okay, with one reading to watch`,
  },
  red: {
    label: "Needs attention",
    headline: (who) => `${who} needs attention today`,
  },
};

// Nurse-facing names for the same states (§4.4: named states, not colours).
export const NURSE_CARE_STATUS_LABEL: Record<CareStatus, string> = {
  green: "Stable",
  yellow: "Monitoring",
  red: "Needs attention today",
};
