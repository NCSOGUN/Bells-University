"use client";

import { MapPin } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { formatShortDate, planFrequency } from "@/lib/format";
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
import { HealthFacts } from "@/components/care/health-facts";
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

  // Same elder and visit records the family screens read, nothing nurse-specific.
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
                {plan.name} · {planFrequency(plan)}
              </Chip>
            )}
            <Chip>
              {completed.length} {completed.length === 1 ? "visit" : "visits"} recorded
            </Chip>
          </div>
        </div>
      </header>

      <ContinuityBriefing elder={elder} completed={completed} next={next} nurses={state.nurses} />

      <Card title="Care plan and health">
        <p className="mb-5 text-navy">
          {plan ? (
            <>
              <span className="font-semibold">
                {plan.name} · {planFrequency(plan)}
              </span>
              <span className="text-ink"> · {plan.features.join(", ")}</span>
            </>
          ) : (
            "No plan on file. Check with the coordinator before the visit."
          )}
        </p>
        <HealthFacts
          careNeeds={elder.careNeeds}
          needsLabel="What the family asked for"
          conditions={elder.conditions}
          medications={elder.medications}
        />
      </Card>

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
