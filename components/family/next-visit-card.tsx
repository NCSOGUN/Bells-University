import { CalendarClock, MapPin } from "lucide-react";
import type { Elder, Nurse, Visit } from "@/lib/mock-data";
import { formatCountdown, formatLongDate, formatTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { TextLink } from "@/components/ui/text-link";

interface NextVisitCardProps {
  visit: Visit | undefined;
  nurse: Nurse | undefined;
  elder: Elder;
  familyTerm: string;
}

export function NextVisitCard({ visit, nurse, elder, familyTerm }: NextVisitCardProps) {
  if (!visit) {
    return (
      <Card title="Next visit">
        <p>
          There&apos;s no visit booked for {familyTerm} yet. As soon as one is arranged it will show
          here with the date, time and nurse.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Next visit">
      <div className="flex items-start gap-3">
        <CalendarClock aria-hidden className="mt-1 size-5 shrink-0 text-navy" />
        <div>
          <p className="font-display text-h2 font-semibold text-navy">
            {formatLongDate(visit.scheduledAt)}
          </p>
          <p className="mt-1">
            {formatTime(visit.scheduledAt)} · {formatCountdown(visit.scheduledAt)}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-navy" />
        <p>
          {nurse ? `${nurse.name} will visit ` : "A nurse will visit "}
          {familyTerm} at {elder.address}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <Chip tone="teal">Visit booked</Chip>
        <TextLink href={routes.familyVisit(visit.id)}>See visit details</TextLink>
      </div>
    </Card>
  );
}
