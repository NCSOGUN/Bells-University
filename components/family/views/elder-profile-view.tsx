"use client";

import { MapPin } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { useFirstLoad } from "@/lib/use-first-load";
import { familyTermFor } from "@/lib/format";
import { completedVisits, findElder, findNurse, isFamilyElder, visitsForElder } from "@/lib/selectors";
import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { PageSkeleton } from "@/components/ui/skeleton";
import { BpTrendChart } from "@/components/care/bp-trend-chart";
import { HealthFacts } from "@/components/care/health-facts";
import { CareStatusNote } from "../care-status";
import { NurseCard } from "../nurse-card";
import { VitalsTable } from "../vitals-table";

export function ElderProfileView({ elderId }: { elderId: string }) {
  const { state, hydrated } = useDemo();
  const loaded = useFirstLoad(`family-elder-${elderId}`);
  if (!hydrated || !loaded) return <PageSkeleton />;

  const elder = isFamilyElder(state, elderId) ? findElder(state, elderId) : undefined;
  if (!elder) {
    return (
      <RecordNotFound
        title="We couldn't find this profile"
        message="The link may be out of date, or this person isn't part of your care circle."
        fallback={{ href: routes.familyDashboard, label: "Go to your dashboard" }}
      />
    );
  }

  const familyTerm = familyTermFor(elder.relationship, elder.name);
  const nurse = findNurse(state, elder.assignedNurseId);
  const completed = completedVisits(visitsForElder(state, elder.id));

  return (
    <div className="space-y-6">
      <TextLink href={routes.familyDashboard} direction="back" className="-mt-2">
        Back to dashboard
      </TextLink>
      <header>
        <p className="text-small">{familyTerm}&apos;s profile</p>
        <h1 className="mt-1 text-display font-bold">{elder.name}</h1>
        <p className="mt-2 text-navy">
          {elder.age} years old · {elder.relationship} · {elder.city}
        </p>
        <p className="mt-1 flex items-start gap-2 text-small">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
          {elder.address}
        </p>
      </header>

      <CareStatusNote status={elder.careStatus} message={elder.careStatusMessage} />

      <Card title="About them">
        <HealthFacts careNeeds={elder.careNeeds} conditions={elder.conditions} medications={elder.medications} />
      </Card>

      {nurse && <NurseCard nurse={nurse} title={`${familyTerm}'s nurse`} />}

      <Card
        title="Blood pressure over time"
        description={`From all ${completed.length} visits, oldest to newest`}
      >
        <BpTrendChart completed={completed} />
      </Card>

      <Card
        title="Every reading"
        description="Recorded by the nurse at each visit. Choose a visit to see the full record."
      >
        <VitalsTable completed={completed} nurses={state.nurses} />
      </Card>
    </div>
  );
}
