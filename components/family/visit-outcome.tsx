import type { Visit } from "@/lib/mock-data";
import { followedUpVisit } from "@/lib/selectors";
import { Chip, type ChipTone } from "@/components/ui/chip";

interface Outcome {
  label: string;
  tone: ChipTone;
}

/** Family-facing outcome of a visit, in words, given the elder's completed visits. */
export function visitOutcome(completed: Visit[], visit: Visit): Outcome {
  if (visit.status === "scheduled") return { label: "Upcoming", tone: "teal" };
  if (visit.status === "in_progress") return { label: "Nurse is there now", tone: "teal" };
  if (visit.flagged) return { label: "Higher reading flagged", tone: "coral" };
  if (followedUpVisit(completed, visit.id)) return { label: "Followed up", tone: "teal" };
  return { label: "Visit complete", tone: "neutral" };
}

export function VisitOutcomeChip({ completed, visit }: { completed: Visit[]; visit: Visit }) {
  const { label, tone } = visitOutcome(completed, visit);
  return <Chip tone={tone}>{label}</Chip>;
}
