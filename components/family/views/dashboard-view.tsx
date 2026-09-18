"use client";

import { ArrowDown } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { useFirstLoad } from "@/lib/use-first-load";
import { familyTermFor, firstName, formatRelativeDay, formatTime, nurseShortName } from "@/lib/format";
import {
  completedVisits,
  findElder,
  findNurse,
  findPlan,
  followedUpVisit,
  nextScheduledVisit,
  visitsForElder,
} from "@/lib/selectors";
import { routes } from "@/lib/routes";
import { PrimaryButtonLink } from "@/components/ui/button-link";
import { Card } from "@/components/ui/card";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";
import { TextLink } from "@/components/ui/text-link";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { PageSkeleton } from "@/components/ui/skeleton";
import { CareStatusPanel } from "../care-status";
import { FamilyAvatars, FamilyCircleCard } from "../family-circle-card";
import { LatestReadingsCard } from "../latest-readings-card";
import { NextVisitCard } from "../next-visit-card";
import { NurseCard } from "../nurse-card";
import { PlanSummaryCard } from "../plan-summary-card";
import { VisitHistoryList } from "../visit-history-list";

export function DashboardView() {
  const { state, hydrated } = useDemo();
  const loaded = useFirstLoad("family-dashboard");
  if (!hydrated || !loaded) return <PageSkeleton />;

  const account = state.familyAccount;
  const elder = findElder(state, account.elderIds[0]);
  if (!elder) {
    return (
      <RecordNotFound
        title="No one added yet"
        message="Once you add a relative, their care updates will appear here."
      />
    );
  }

  const familyTerm = familyTermFor(elder.relationship, elder.name);
  const nurse = findNurse(state, elder.assignedNurseId);
  const visits = visitsForElder(state, elder.id);
  const completed = completedVisits(visits);
  const latest = completed.at(-1);
  const latestNurse = latest && findNurse(state, latest.nurseId);
  const nextVisit = nextScheduledVisit(visits);

  const checkedAt = latest?.checkOutAt ?? latest?.checkInAt;
  const checkedLine =
    checkedAt &&
    `Last checked ${formatRelativeDay(checkedAt)} at ${formatTime(checkedAt)}` +
      (latestNurse ? ` by ${nurseShortName(latestNurse.name)}` : "");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-small">
            Hello, {firstName(account.name)} · {familyTerm}&apos;s care
          </p>
          <h1 className="text-h2 font-semibold">{elder.name}</h1>
          <TextLink href={routes.familyElder(elder.id)} className="text-small">
            View {familyTerm}&apos;s profile and readings
          </TextLink>
        </div>
        <FamilyAvatars account={account} />
      </div>

      <CareStatusPanel
        status={elder.careStatus}
        message={elder.careStatusMessage}
        familyTerm={familyTerm}
        checkedLine={checkedLine}
        action={
          latest?.vitals && (
            <PrimaryButtonLink href="#latest-readings" className="w-full sm:w-auto">
              See the latest readings
              <ArrowDown aria-hidden className="size-4" />
            </PrimaryButtonLink>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-6">
          <NextVisitCard
            visit={nextVisit}
            nurse={nextVisit && findNurse(state, nextVisit.nurseId)}
            elder={elder}
            familyTerm={familyTerm}
          />
          <LatestReadingsCard
            visit={latest}
            nurse={latestNurse}
            followedUp={latest && followedUpVisit(completed, latest.id)}
            familyTerm={familyTerm}
          />
          <VisitHistoryList completed={completed} nurses={state.nurses} familyTerm={familyTerm} />
        </div>
        <div className="space-y-6">
          {nurse && <NurseCard nurse={nurse} title={`${familyTerm}'s nurse`} />}
          <FamilyCircleCard account={account} familyTerm={familyTerm} />
          <Card title="Updates on WhatsApp">
            <p className="flex items-start gap-2">
              <WhatsAppMark className="mt-0.5 size-5" />
              After every visit we message you the readings and the nurse&apos;s note.
            </p>
            <TextLink href={routes.familyWhatsApp} className="mt-1">
              See the update as the family received it
            </TextLink>
          </Card>
          <PlanSummaryCard
            plan={findPlan(state, elder.planId)}
            nextBillingDate={elder.nextBillingDate}
            paymentStatus={elder.paymentStatus}
            sponsor={account.sponsor}
          />
        </div>
      </div>
    </div>
  );
}
