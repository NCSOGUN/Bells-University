import { MESSAGE_STATUS_LABEL } from "@/lib/care-status";
import type { CareStatus } from "@/lib/mock-data";
import { Chip, type ChipTone } from "@/components/ui/chip";

const TONE: Record<CareStatus, ChipTone> = { green: "teal", yellow: "amber", red: "coral" };

interface CareStatusChipProps {
  status: CareStatus;
  /** Defaults to the short message label, e.g. "On track". */
  label?: string;
  className?: string;
}

/**
 * A care status inside a message or update: an 8px colour dot plus a named
 * state, never the dot alone (§4.4). Shared by F1's example and F11.
 */
export function CareStatusChip({ status, label, className = "bg-surface" }: CareStatusChipProps) {
  return (
    <Chip tone={TONE[status]} className={className}>
      <span className="sr-only">Status: </span>
      {label ?? MESSAGE_STATUS_LABEL[status]}
    </Chip>
  );
}
