"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, LogIn, LogOut, MapPin, MapPinOff } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import {
  familyTermFor,
  formatLongDate,
  formatShortDate,
  formatTime,
  minutesBetween,
  nurseShortName,
} from "@/lib/format";
import type { Nurse, Visit } from "@/lib/mock-data";
import {
  completedVisits,
  findElder,
  findNurse,
  findVisit,
  followedUpVisit,
  followUpVisit,
  isFamilyElder,
  visitNumber,
  visitsForElder,
} from "@/lib/selectors";
import { routes } from "@/lib/routes";
import { ADHERENCE_LABEL } from "@/lib/vitals";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { CareCheckNote } from "../care-check-note";
import { VisitOutcomeChip } from "../visit-outcome";
import { VitalsGrid } from "../vitals-grid";

export function VisitDetailView({ visitId }: { visitId: string }) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <PageSkeleton />;

  const found = findVisit(state, visitId);
  const visit = found && isFamilyElder(state, found.elderId) ? found : undefined;
  const elder = visit && findElder(state, visit.elderId);
  if (!visit || !elder) {
    return (
      <RecordNotFound
        title="We couldn't find this visit"
        message="The link may be out of date, or this visit isn't part of your care circle."
        fallback={{ href: routes.familyDashboard, label: "Go to your dashboard" }}
      />
    );
  }

  const familyTerm = familyTermFor(elder.relationship, elder.name);
  const nurse = findNurse(state, visit.nurseId);
  const completed = completedVisits(visitsForElder(state, elder.id));
  const number = visitNumber(completed, visit.id);
  const title = number ? `Visit ${number}` : "Upcoming visit";

  return (
    <article className="space-y-6">
      <TextLink href={routes.familyDashboard} direction="back" className="-mt-2">
        Back to dashboard
      </TextLink>
      <header>
        <p className="text-small">
          {familyTerm}&apos;s visit record · {elder.name}
        </p>
        <h1 className="mt-1 text-display font-bold">{title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-navy">
            {formatLongDate(visit.scheduledAt)} · {formatTime(visit.scheduledAt)}
          </p>
          <VisitOutcomeChip completed={completed} visit={visit} />
        </div>
      </header>

      {visit.flagged && <FlagPanel visit={visit} nurse={nurse} recheck={followUpVisit(completed, visit.id)} />}
      <FollowUpNote visit={visit} completed={completed} />

      {visit.status === "complete" ? (
        <>
          <ProvenanceCard visit={visit} nurse={nurse} />
          {visit.vitals && (
            <Card title="Readings">
              <VitalsGrid vitals={visit.vitals} flagged={visit.flagged} />
            </Card>
          )}
          <CareCheckNote visit={visit} nurse={nurse} />
          <ObservationsCard visit={visit} />
          {visit.nurseNotes && (
            <Card title="Notes from the nurse">
              <blockquote className="text-navy">&ldquo;{visit.nurseNotes}&rdquo;</blockquote>
              {nurse && (
                <p className="mt-3 text-small">
                  {nurse.name}
                  {visit.checkOutAt && `, ${formatShortDate(visit.checkOutAt)} at ${formatTime(visit.checkOutAt)}`}
                </p>
              )}
            </Card>
          )}
        </>
      ) : (
        <Card title="This visit hasn't happened yet">
          <div className="flex items-start gap-3">
            <CalendarClock aria-hidden className="mt-1 size-5 shrink-0 text-navy" />
            <p>
              {nurse ? nurse.name : "A nurse"} is booked to visit {familyTerm} on{" "}
              {formatLongDate(visit.scheduledAt)} at {formatTime(visit.scheduledAt)}. Readings and
              notes will appear here once the visit is complete.
            </p>
          </div>
        </Card>
      )}
    </article>
  );
}

function FlagPanel({ visit, nurse, recheck }: { visit: Visit; nurse?: Nurse; recheck?: Visit }) {
  return (
    <section
      aria-labelledby="flag-heading"
      className="rounded-2xl border-2 border-coral bg-coral/10 p-5 sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-coral">
          <AlertTriangle aria-hidden className="size-5 text-navy" />
        </span>
        <div>
          <h2 id="flag-heading" className="text-h2 font-semibold">
            Flagged for follow-up
          </h2>
          {visit.flagReason && <p className="mt-1 font-medium text-navy">{visit.flagReason}</p>}
          <p className="mt-2 text-small text-navy">
            {nurse ? `${nurseShortName(nurse.name)} flagged this reading` : "This reading was flagged"}
            {visit.checkOutAt && ` at ${formatTime(visit.checkOutAt)}`}.{" "}
            {recheck?.vitals
              ? `It was rechecked on ${formatShortDate(recheck.scheduledAt)}: ${recheck.vitals.bloodPressure} mmHg.`
              : "It will be rechecked at the next visit."}
          </p>
        </div>
      </div>
    </section>
  );
}

function FollowUpNote({ visit, completed }: { visit: Visit; completed: Visit[] }) {
  const flagged = followedUpVisit(completed, visit.id);
  if (!flagged?.vitals) return null;
  return (
    <div className="rounded-2xl border border-teal/40 bg-teal-tint p-4">
      <p className="text-navy">
        This visit rechecked the higher reading of {flagged.vitals.bloodPressure} mmHg from{" "}
        {formatShortDate(flagged.scheduledAt)}.
      </p>
    </div>
  );
}

function ProvenanceCard({ visit, nurse }: { visit: Visit; nurse?: Nurse }) {
  const duration =
    visit.checkInAt && visit.checkOutAt ? minutesBetween(visit.checkInAt, visit.checkOutAt) : undefined;

  return (
    <Card title="Who visited and when">
      {nurse && (
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name={nurse.name} initials={nurse.initials} />
          <div>
            <p className="font-semibold text-navy">{nurse.name}</p>
            <p className="text-small">Licence {nurse.licenceId}</p>
          </div>
          {nurse.verified && <VerifiedBadge />}
        </div>
      )}
      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <Fact icon={<LogIn aria-hidden className="size-5 text-navy" />} label="Arrived">
          {visit.checkInAt ? formatTime(visit.checkInAt) : "Not recorded"}
        </Fact>
        <Fact icon={<LogOut aria-hidden className="size-5 text-navy" />} label="Left">
          {visit.checkOutAt ? formatTime(visit.checkOutAt) : "Not recorded"}
          {duration !== undefined && (
            <span className="block text-small font-normal">{duration} minute visit</span>
          )}
        </Fact>
        <Fact
          icon={
            visit.gpsConfirmed ? (
              <MapPin aria-hidden className="size-5 text-navy" />
            ) : (
              <MapPinOff aria-hidden className="size-5 text-navy" />
            )
          }
          label="Location"
        >
          {visit.gpsConfirmed ? "Confirmed by GPS" : "Location not recorded"}
          {visit.gpsAddress && <span className="block text-small font-normal">{visit.gpsAddress}</span>}
        </Fact>
      </dl>
    </Card>
  );
}

function ObservationsCard({ visit }: { visit: Visit }) {
  const rows = [
    {
      label: "Medication",
      value: visit.medicationAdherence && ADHERENCE_LABEL[visit.medicationAdherence],
    },
    { label: "Moving around", value: visit.mobilityNote },
    { label: "How they're feeling", value: visit.wellbeingNote },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));

  if (rows.length === 0) return null;

  return (
    <Card title="How the visit went">
      <dl className="divide-y divide-line">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[12rem_1fr]">
            <dt className="text-small font-semibold">{row.label}</dt>
            <dd className="text-navy">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <dt className="text-small">{label}</dt>
        <dd className="font-semibold text-navy">{children}</dd>
      </div>
    </div>
  );
}
