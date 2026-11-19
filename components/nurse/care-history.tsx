import { CalendarClock, ChevronDown, MapPin, MapPinOff } from "lucide-react";
import {
  formatCountdown,
  formatShortDate,
  formatTime,
  nurseShortName,
} from "@/lib/format";
import type { Nurse, Visit } from "@/lib/mock-data";
import { followedUpVisit, followUpVisit, visitNumber } from "@/lib/selectors";
import { ADHERENCE_LABEL } from "@/lib/vitals";
import { Chip } from "@/components/ui/chip";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { VitalsInline } from "./vitals-inline";

interface CareHistoryProps {
  /** Completed visits, oldest first. */
  completed: Visit[];
  next?: Visit;
  nurses: Nurse[];
}

/** Every visit in order, ending at the next one, the record the nurse carries forward. */
export function CareHistory({ completed, next, nurses }: CareHistoryProps) {
  const nurseFor = (visit: Visit) => nurses.find((n) => n.id === visit.nurseId);

  const items: TimelineItem[] = completed.map((visit): TimelineItem => {
    const number = visitNumber(completed, visit.id);
    const followed = followedUpVisit(completed, visit.id);
    const recheck = followUpVisit(completed, visit.id);
    const nurse = nurseFor(visit);
    const notable = visit.flagged || Boolean(followed);

    if (!notable) {
      return {
        id: visit.id,
        tone: "done",
        content: (
          <details className="group" aria-label={`Visit ${number}, ${formatShortDate(visit.scheduledAt)}`}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span className="font-semibold text-navy">
                Visit {number} · {formatShortDate(visit.scheduledAt)}
              </span>
              {visit.vitals && <span className="text-small tabular-nums">BP {visit.vitals.bloodPressure}</span>}
              <Chip>Routine</Chip>
              <ChevronDown aria-hidden className="ml-auto size-4 text-ink transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="pb-2">
              <p className="text-small">
                {nurse ? nurseShortName(nurse.name) : "Nurse not recorded"}
                {visit.checkInAt && visit.checkOutAt && ` · ${formatTime(visit.checkInAt)}–${formatTime(visit.checkOutAt)}`}
                {` · ${visit.gpsConfirmed ? "GPS confirmed" : "Location not recorded"}`}
              </p>
              {visit.vitals && (
                <div className="mt-3">
                  <VitalsInline vitals={visit.vitals} flagged={false} />
                </div>
              )}
              {visit.nurseNotes && (
                <blockquote className="mt-3 text-navy">&ldquo;{visit.nurseNotes}&rdquo;</blockquote>
              )}
              <Observations visit={visit} open />
            </div>
          </details>
        ),
      };
    }

    return {
      id: visit.id,
      tone: visit.flagged ? "flagged" : followed ? "followUp" : "done",
      content: (
        <article
          aria-label={`Visit ${number}, ${formatShortDate(visit.scheduledAt)}`}
          className={
            visit.flagged
              ? "rounded-2xl border-2 border-coral bg-coral/5 p-4"
              : followed
                ? "rounded-2xl border-2 border-teal bg-teal-tint/60 p-4"
                : "pt-1"
          }
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-sans text-body font-semibold text-navy">
              Visit {number} · {formatShortDate(visit.scheduledAt)}
            </h3>
            {visit.flagged ? (
              <Chip tone="coral" className="bg-surface">
                Flagged
              </Chip>
            ) : followed ? (
              <Chip tone="teal" className="bg-surface">
                Follow-up to visit {visitNumber(completed, followed.id)}
              </Chip>
            ) : (
              <Chip>Routine</Chip>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-small">
            <span>
              {nurse ? nurseShortName(nurse.name) : "Nurse not recorded"}
              {visit.checkInAt &&
                visit.checkOutAt &&
                ` · ${formatTime(visit.checkInAt)}–${formatTime(visit.checkOutAt)}`}
            </span>
            <span className="inline-flex items-center gap-1">
              {visit.gpsConfirmed ? (
                <MapPin aria-hidden className="size-3.5 text-navy" />
              ) : (
                <MapPinOff aria-hidden className="size-3.5 text-navy" />
              )}
              {visit.gpsConfirmed ? "GPS confirmed" : "Location not recorded"}
            </span>
          </p>

          {visit.flagged && visit.flagReason && (
            <p className="mt-3 font-medium text-navy">
              <span className="sr-only">Flag reason: </span>
              {visit.flagReason}
            </p>
          )}
          {visit.flagged && recheck && (
            <p className="mt-1 text-small">
              Rechecked at visit {visitNumber(completed, recheck.id)} on {formatShortDate(recheck.scheduledAt)}.
            </p>
          )}
          {followed?.vitals && (
            <p className="mt-3 text-small font-medium text-navy">
              Rechecked the {followed.vitals.bloodPressure} mmHg reading flagged on{" "}
              {formatShortDate(followed.scheduledAt)}.
            </p>
          )}

          {visit.vitals && (
            <div className="mt-3">
              <VitalsInline vitals={visit.vitals} flagged={visit.flagged} />
            </div>
          )}

          {visit.nurseNotes && (
            <blockquote className="mt-3 text-navy">
              &ldquo;{visit.nurseNotes}&rdquo;
            </blockquote>
          )}

          <Observations visit={visit} open={notable} />
        </article>
      ),
    };
  });

  if (next) {
    const nurse = nurseFor(next);
    items.push({
      id: next.id,
      tone: "current",
      icon: CalendarClock,
      content: (
        <article aria-label="Next visit" className="rounded-2xl border-2 border-navy p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-sans text-body font-semibold text-navy">
              Next visit · {formatShortDate(next.scheduledAt)}, {formatTime(next.scheduledAt)}
            </h3>
            <Chip tone="teal">Scheduled {formatCountdown(next.scheduledAt)}</Chip>
          </div>
          <p className="mt-1 text-small">
            {nurse ? `Booked with ${nurseShortName(nurse.name)}.` : "Nurse to be confirmed."} Readings and notes
            from this visit will be added here.
          </p>
        </article>
      ),
    });
  }

  if (items.length === 0) {
    return <p>No visits yet. Each visit&apos;s readings and notes will be recorded here.</p>;
  }

  return <Timeline items={items} label="Visit history, oldest first" />;
}

function Observations({ visit, open }: { visit: Visit; open: boolean }) {
  const rows = [
    { label: "Medication", value: visit.medicationAdherence && ADHERENCE_LABEL[visit.medicationAdherence] },
    { label: "Moving around", value: visit.mobilityNote },
    { label: "Wellbeing", value: visit.wellbeingNote },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  if (rows.length === 0) return null;

  const list = (
    <dl className="mt-2 grid gap-x-4 gap-y-1 text-small sm:grid-cols-[8rem_1fr]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="font-semibold text-navy">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );

  if (open) return <div className="mt-2">{list}</div>;

  return (
    <details className="mt-1">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-small font-semibold text-navy text-teal-deep decoration-2 underline-offset-4 hover:underline">
        Medication, mobility and wellbeing
      </summary>
      {list}
    </details>
  );
}
