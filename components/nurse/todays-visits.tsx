import Link from "next/link";
import { MapPin, UserPlus } from "lucide-react";
import { formatTime, formatVisitsPerWeek } from "@/lib/format";
import type { Elder, Plan } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import type { TodayVisit, TodayVisitState } from "@/lib/selectors";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { TextLink } from "@/components/ui/text-link";
import { Timeline, type TimelineItem, type TimelineTone } from "@/components/ui/timeline";
import { CareStatusChip } from "./care-status-chip";

const STATE_COPY: Record<TodayVisitState, { label: string; chip: ChipTone; tone: TimelineTone }> = {
  complete: { label: "Complete", chip: "neutral", tone: "done" },
  in_progress: { label: "In progress", chip: "teal", tone: "current" },
  next: { label: "Next", chip: "teal", tone: "current" },
  upcoming: { label: "Upcoming", chip: "neutral", tone: "upcoming" },
};

interface TodaysVisitsProps {
  visits: TodayVisit[];
  elders: Elder[];
  plans: Plan[];
  /** Clients accepted today, who join the day's work without a visit booked yet. */
  newClients: Elder[];
  /** Briefly highlight an item that has just been added. */
  highlightId?: string;
}

export function TodaysVisits({ visits, elders, plans, newClients, highlightId }: TodaysVisitsProps) {
  const done = visits.filter((v) => v.state === "complete").length;
  const items: TimelineItem[] = [
    ...visits.flatMap(({ visit, state }) => {
      const elder = elders.find((e) => e.id === visit.elderId);
      if (!elder) return [];
      const copy = STATE_COPY[state];
      const plan = plans.find((p) => p.id === elder.planId);
      const upNext = state === "next" || state === "in_progress";

      return [
        {
          id: visit.id,
          tone: copy.tone,
          content: (
            <article
              aria-label={`${copy.label}: ${elder.name} at ${formatTime(visit.scheduledAt)}`}
              className={upNext ? "rounded-2xl border-2 border-teal bg-teal-tint/60 p-4" : "pt-1"}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold tabular-nums text-navy">{formatTime(visit.scheduledAt)}</p>
                <Chip tone={copy.chip} className={upNext ? "bg-surface" : ""}>
                  {copy.label}
                </Chip>
              </div>
              <h3 className="mt-1 text-h2 font-semibold">
                <Link
                  href={routes.nurseClient(elder.id)}
                  className="underline decoration-teal decoration-2 underline-offset-4 hover:decoration-navy"
                >
                  {elder.name}
                </Link>
              </h3>

              {state === "complete" ? (
                <>
                  <p className="mt-1 text-small">
                    {visit.checkInAt && `Checked in ${formatTime(visit.checkInAt)}`}
                    {visit.checkOutAt && `, out ${formatTime(visit.checkOutAt)}`}
                    {visit.gpsConfirmed ? " · GPS confirmed" : " · no GPS fix"}
                    {visit.vitals && ` · BP ${visit.vitals.bloodPressure} mmHg`}
                  </p>
                  <TextLink href={routes.nurseVisitComplete(visit.id)} className="text-small">
                    Visit summary
                  </TextLink>
                </>
              ) : (
                <div className="mt-2 space-y-2">
                  <p className="flex items-start gap-1.5 text-small">
                    <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
                    {elder.address}
                  </p>
                  <p className="text-small">
                    {elder.conditions.join(", ")}
                    {plan && ` · ${plan.name}, ${formatVisitsPerWeek(plan.visitsPerWeek)}`}
                  </p>
                  {(upNext || elder.careStatus !== "green") && (
                    <div className="flex flex-wrap items-start gap-2">
                      <CareStatusChip status={elder.careStatus} className="bg-surface" />
                      <p className="min-w-0 flex-1 basis-48 text-small text-navy">{elder.careStatusMessage}</p>
                    </div>
                  )}
                  {upNext && (
                    <div className="flex flex-col gap-1 pt-1 sm:flex-row sm:items-center sm:gap-4">
                      {state === "in_progress" ? (
                        <ButtonLink href={routes.nurseVisitChecklist(visit.id)}>Continue visit</ButtonLink>
                      ) : (
                        <ButtonLink href={routes.nurseVisitStart(visit.id)}>Start visit</ButtonLink>
                      )}
                      <TextLink href={routes.nurseClient(elder.id)}>Review client record</TextLink>
                    </div>
                  )}
                </div>
              )}
            </article>
          ),
        },
      ];
    }),
    ...newClients.map((elder) => ({
      id: `new-${elder.id}`,
      tone: "upcoming" as const,
      icon: UserPlus,
      className: elder.id === highlightId ? "motion-safe:animate-highlight rounded-2xl" : "",
      content: (
        <article aria-label={`New client: ${elder.name}`} className="pt-1">
          <Chip tone="teal">New client</Chip>
          <h3 className="mt-1 text-h2 font-semibold">
            <Link
              href={routes.nurseClient(elder.id)}
              className="underline decoration-teal decoration-2 underline-offset-4 hover:decoration-navy"
            >
              {elder.name}
            </Link>
          </h3>
          <p className="mt-1 text-small">
            Accepted today. The coordinator will book the first visit with the family.
          </p>
        </article>
      ),
    })),
  ];

  return (
    <Card
      title="Today's visits"
      description={
        visits.length === 0
          ? undefined
          : `${visits.length} ${visits.length === 1 ? "visit" : "visits"} · ${done} complete, ${
              visits.length - done
            } to go`
      }
    >
      {items.length === 0 ? (
        <p>No visits booked for today. New bookings will appear here.</p>
      ) : (
        <Timeline items={items} label="Today's visits in order" />
      )}
    </Card>
  );
}
