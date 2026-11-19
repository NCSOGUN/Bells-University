import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Eye, type LucideIcon } from "lucide-react";
import { CARE_STATUS_COPY } from "@/lib/care-status";
import type { CareStatus } from "@/lib/mock-data";
import { Chip, type ChipTone } from "@/components/ui/chip";

const STATUS_STYLES: Record<
  CareStatus,
  { panel: string; iconWrap: string; icon: LucideIcon; tone: ChipTone }
> = {
  green: { panel: "border-teal", iconWrap: "bg-teal-tint text-teal-deep", icon: CheckCircle2, tone: "teal" },
  yellow: { panel: "border-amber", iconWrap: "bg-amber/15 text-navy", icon: Eye, tone: "amber" },
  red: { panel: "border-coral", iconWrap: "bg-coral/15 text-navy", icon: AlertTriangle, tone: "coral" },
};

interface CareStatusPanelProps {
  status: CareStatus;
  message: string;
  familyTerm: string;
  /** "Last checked today at 9:35 am by Nurse Adaeze" */
  checkedLine?: string;
  action?: ReactNode;
}

/** The dashboard's one bold moment: answers "is Dad okay?" in a sentence. */
export function CareStatusPanel({ status, message, familyTerm, checkedLine, action }: CareStatusPanelProps) {
  const styles = STATUS_STYLES[status];
  const copy = CARE_STATUS_COPY[status];
  const Icon = styles.icon;

  return (
    <section
      aria-labelledby="care-status-heading"
      className={`rounded-3xl border-t-4 bg-surface p-6 shadow-card sm:p-10 ${styles.panel}`}
    >
      <div className="flex items-start gap-4">
        <span className={`grid size-12 shrink-0 place-items-center rounded-full sm:size-14 ${styles.iconWrap}`}>
          <Icon aria-hidden className="size-6 sm:size-7" />
        </span>
        <div className="min-w-0">
          <p className="text-small font-medium text-ink">Is {familyTerm} okay?</p>
          <h2 id="care-status-heading" className="mt-1 text-h1 font-bold tracking-tight sm:text-display">
            {copy.headline(familyTerm)}
          </h2>
        </div>
      </div>

      <div className="mt-5 space-y-3 sm:pl-18">
        <Chip tone={styles.tone}>{copy.label}</Chip>
        <p className="max-w-3xl text-h2 font-normal text-navy">{message}</p>
        {checkedLine && <p className="text-small text-ink">{checkedLine}</p>}
        {action && <div className="pt-2">{action}</div>}
      </div>
    </section>
  );
}

/** Quiet version for secondary screens. */
export function CareStatusNote({ status, message }: { status: CareStatus; message: string }) {
  const styles = STATUS_STYLES[status];
  return (
    <div className={`rounded-2xl border-l-4 bg-surface p-4 shadow-card ${styles.panel}`}>
      <Chip tone={styles.tone} className="bg-surface">
        {CARE_STATUS_COPY[status].label}
      </Chip>
      <p className="mt-2 text-navy">{message}</p>
    </div>
  );
}
