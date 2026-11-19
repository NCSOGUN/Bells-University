import type { Nurse, Visit } from "@/lib/mock-data";
import { formatRelativeDay, formatShortDate, formatTime, nurseShortName } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { VitalsGrid } from "./vitals-grid";

interface LatestReadingsCardProps {
  visit: Visit | undefined;
  nurse: Nurse | undefined;
  /** The flagged visit this reading followed up on, if any. */
  followedUp?: Visit;
  familyTerm: string;
}

export function LatestReadingsCard({ visit, nurse, followedUp, familyTerm }: LatestReadingsCardProps) {
  if (!visit?.vitals) {
    return (
      <Card id="latest-readings" title="Latest readings" className="scroll-mt-6">
        <p>
          {familyTerm}&apos;s blood pressure, pulse, temperature and weight will appear here after
          the first visit.
        </p>
      </Card>
    );
  }

  const recordedAt = visit.checkOutAt ?? visit.scheduledAt;
  const by = nurse ? ` by ${nurseShortName(nurse.name)}` : "";

  return (
    <Card
      id="latest-readings"
      title="Latest readings"
      description={`Recorded ${formatRelativeDay(recordedAt)} at ${formatTime(recordedAt)}${by}`}
      className="scroll-mt-6"
    >
      {followedUp?.vitals && (
        <div className="mb-4 space-y-2 rounded-xl bg-teal-tint p-3">
          <Chip tone="teal" className="bg-surface">
            Followed up
          </Chip>
          <p className="text-small text-navy">
            This visit rechecked the higher reading of {followedUp.vitals.bloodPressure} mmHg from{" "}
            {formatShortDate(followedUp.scheduledAt)}.
          </p>
        </div>
      )}
      <VitalsGrid vitals={visit.vitals} flagged={visit.flagged} />
    </Card>
  );
}
