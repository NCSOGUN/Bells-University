import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Visit } from "@/lib/mock-data";
import { formatShortDate } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { VisitOutcomeChip } from "./visit-outcome";

interface VisitHistoryListProps {
  /** Completed visits, oldest first. */
  completed: Visit[];
  /** Show only the newest few, with a link to the rest. */
  limit?: number;
  /** Where "all visits" goes when some are hidden. */
  moreHref?: string;
  familyTerm: string;
}

export function VisitHistoryList({ completed, limit, moreHref, familyTerm }: VisitHistoryListProps) {
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
  const shown = limit ? newestFirst.slice(0, limit) : newestFirst;
  const hidden = newestFirst.length - shown.length;

  return (
    <Card title="Recent visits">
      <ol className="-mt-1 divide-y divide-line">
        {shown.map(({ visit, number }) => (
          <li key={visit.id}>
            <Link
              href={routes.familyVisit(visit.id)}
              className="group -mx-2 flex min-h-14 items-center gap-3 rounded-xl px-2 py-3 transition-colors duration-150 hover:bg-bg"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold whitespace-nowrap text-navy">
                  {formatShortDate(visit.scheduledAt)}
                  {visit.vitals && (
                    <span className="ml-2 font-normal tabular-nums">
                      {visit.vitals.bloodPressure} <span className="text-small">mmHg</span>
                    </span>
                  )}
                </p>
                {/* On a phone the outcome sits under the reading instead of squeezing beside it. */}
                <span className="mt-1.5 inline-flex sm:hidden">
                  <VisitOutcomeChip completed={completed} visit={visit} />
                </span>
                {visit.flagged && visit.flagReason && <p className="mt-1.5 text-small text-navy">{visit.flagReason}</p>}
              </div>
              <span className="hidden text-label text-ink sm:inline">Visit {number}</span>
              <span className="hidden sm:inline-flex">
                <VisitOutcomeChip completed={completed} visit={visit} />
              </span>
              <ChevronRight aria-hidden className="size-5 shrink-0 text-ink transition-transform duration-150 group-hover:translate-x-0.5" />
            </Link>
          </li>
        ))}
      </ol>
      {hidden > 0 && moreHref && (
        <TextLink href={moreHref} className="mt-2">
          All {completed.length} visits
        </TextLink>
      )}
    </Card>
  );
}
