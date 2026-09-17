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
