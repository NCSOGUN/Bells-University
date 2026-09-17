"use client";

import { MapPin } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { formatShortDate, formatVisitsPerWeek } from "@/lib/format";
import { DEMO_NURSE_ID } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import {
  completedVisits,
  findElder,
  findPlan,
  isNurseClient,
  nextScheduledVisit,
  visitsForElder,
} from "@/lib/selectors";
import { BpTrendChart } from "@/components/care/bp-trend-chart";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { CareHistory } from "../care-history";
import { CareStatusChip } from "../care-status-chip";
import { ContinuityBriefing } from "../continuity-briefing";

export function ClientDetailView({ elderId }: { elderId: string }) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <PageSkeleton />;

  // Same elder and visit records the family screens read — nothing nurse-specific.
  const elder = isNurseClient(state, DEMO_NURSE_ID, elderId) ? findElder(state, elderId) : undefined;
  if (!elder) {
    return (
      <RecordNotFound
        title="We couldn't find this client"
        message="The link may be out of date, or this person isn't on your client list."
        fallback={{ href: routes.nurseClients, label: "Go to your clients" }}
      />
    );
  }

  const plan = findPlan(state, elder.planId);
  const visits = visitsForElder(state, elder.id);
  const completed = completedVisits(visits);
  const next = nextScheduledVisit(visits);
  const first = completed[0];

  return (
    <div className="space-y-6">
      <TextLink href={routes.nurseClients} direction="back" className="-mt-2">
        Back to clients
      </TextLink>

      <header className="flex items-start gap-4">
        <Avatar name={elder.name} size="lg" className="max-sm:hidden" />
        <div className="min-w-0">
          <p className="text-small">Client record</p>
          <h1 className="mt-1 text-display font-bold">{elder.name}</h1>
          <p className="mt-2 text-navy">
            {elder.age} years old · {elder.city}
            {first && ` · Visits since ${formatShortDate(first.scheduledAt)}`}
          </p>
          <p className="mt-1 flex items-start gap-1.5 text-small">
            <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
            {elder.address}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <CareStatusChip status={elder.careStatus} />
            {plan && (
              <Chip>
                {plan.name} · {formatVisitsPerWeek(plan.visitsPerWeek)}
              </Chip>
            )}
            <Chip>
              {completed.length} {completed.length === 1 ? "visit" : "visits"} recorded
            </Chip>
          </div>
        </div>
      </header>

      <ContinuityBriefing elder={elder} completed={completed} next={next} nurses={state.nurses} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Care plan">
          {plan ? (
            <>
              <p className="font-semibold text-navy">
                {plan.name} · {formatVisitsPerWeek(plan.visitsPerWeek)}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>No plan on file. Check with the coordinator before the visit.</p>
          )}
          <h3 className="mt-5 font-sans text-label font-semibold">What the family asked for</h3>
          <blockquote className="mt-2 border-l-4 border-teal-light pl-4 text-navy">{elder.careNeeds}</blockquote>
        </Card>

        <Card title="Conditions and medication">
          <h3 className="font-sans text-label font-semibold">Conditions</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {elder.conditions.map((c) => (
              <li key={c} className="rounded-full bg-teal-tint px-3 py-1 text-small font-medium text-navy">
                {c}
              </li>
            ))}
          </ul>
          <h3 className="mt-5 font-sans text-label font-semibold">Medication</h3>
          <ul className="mt-2 space-y-2">
            {elder.medications.map((m) => (
              <li key={m} className="rounded-xl border border-line bg-bg px-3 py-2 text-navy">
                {m}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title="Blood pressure trend"
        description={
          completed.length > 0
            ? `All ${completed.length} ${completed.length === 1 ? "visit" : "visits"}, oldest to newest`
            : undefined
        }
      >
        <BpTrendChart completed={completed} />
      </Card>

      <Card
        title="Visit history"
        description="Every visit with its readings and notes, oldest first, leading to the next one."
      >
        <CareHistory completed={completed} next={next} nurses={state.nurses} />
      </Card>
    </div>
  );
}
