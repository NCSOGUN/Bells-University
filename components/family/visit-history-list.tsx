import type { Nurse, Visit } from "@/lib/mock-data";
import { formatShortDate, formatTime, nurseShortName } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { VisitOutcomeChip } from "./visit-outcome";

interface VisitHistoryListProps {
  /** Completed visits, oldest first. */
  completed: Visit[];
  nurses: Nurse[];
  familyTerm: string;
}

export function VisitHistoryList({ completed, nurses, familyTerm }: VisitHistoryListProps) {
  if (completed.length === 0) {
    return (
      <Card title="Visit history">
        <p>
          Each visit will be listed here with the readings taken and a note from the nurse, starting
          with {familyTerm}&apos;s first visit.
        </p>
      </Card>
    );
  }

  const newestFirst = completed.map((visit, i) => ({ visit, number: i + 1 })).reverse();

  return (
    <Card title="Visit history" description={`${completed.length} visits so far, newest first`}>
      <ol className="space-y-3">
        {newestFirst.map(({ visit, number }) => {
          const nurse = nurses.find((n) => n.id === visit.nurseId);
          const time = visit.checkInAt ?? visit.scheduledAt;
          return (
            <li
              key={visit.id}
              className={`rounded-xl border p-4 ${
                visit.flagged ? "border-l-4 border-coral bg-coral/5" : "border-line"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-navy">
                  Visit {number} · {formatShortDate(visit.scheduledAt)}
                </p>
                <VisitOutcomeChip completed={completed} visit={visit} />
              </div>
              <p className="mt-1 text-small">
                {formatTime(time)}
                {nurse && ` with ${nurseShortName(nurse.name)}`}
                {visit.vitals && ` · Blood pressure ${visit.vitals.bloodPressure} mmHg`}
              </p>
              {visit.flagged && visit.flagReason && (
                <p className="mt-2 text-small font-medium text-navy">{visit.flagReason}</p>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
