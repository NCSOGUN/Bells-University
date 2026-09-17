import { NURSE_CARE_STATUS_LABEL } from "@/lib/care-status";
import type { CareStatus } from "@/lib/mock-data";
import { Chip, type ChipTone } from "@/components/ui/chip";

const TONE: Record<CareStatus, ChipTone> = { green: "teal", yellow: "amber", red: "coral" };

/** Named care state with its colour dot, never the dot alone. */
export function CareStatusChip({ status, className }: { status: CareStatus; className?: string }) {
  return (
    <Chip tone={TONE[status]} className={className}>
      <span className="sr-only">Care status: </span>
      {NURSE_CARE_STATUS_LABEL[status]}
    </Chip>
  );
}
