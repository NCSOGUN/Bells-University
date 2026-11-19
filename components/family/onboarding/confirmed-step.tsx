"use client";

import { Bell, ClipboardCheck, DoorOpen } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { firstName, formatNaira, planFrequency, nurseShortName } from "@/lib/format";
import { formatPhone, matchedNurseFor } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { findElder, findPlan } from "@/lib/selectors";
import { ButtonLink } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { SuccessTick } from "@/components/ui/success-tick";
import { VerifiedBadge } from "@/components/ui/verified-badge";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";

const WHATSAPP_UPDATES = [
  { icon: DoorOpen, text: "When the nurse arrives, with GPS confirmation" },
  { icon: ClipboardCheck, text: "After every visit: readings, medication and a note from the nurse" },
  { icon: Bell, text: "Straight away if a reading needs attention" },
];

export function ConfirmedStep() {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <PageSkeleton />;

  const { onboarding } = state;
  const plan = findPlan(state, onboarding.payment?.planId ?? onboarding.planId ?? state.familyAccount.planId);
  const nurse = matchedNurseFor(state);
  const who = onboarding.relative ? firstName(onboarding.relative.name) : "your relative";
  // The dashboard that follows is the seeded family's; say so rather than pretend.
  const demoElder = findElder(state, state.familyAccount.elderIds[0]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-start gap-4">
        <SuccessTick />
        <div>
          <h1 className="text-h1 font-bold sm:text-display">Care for {who} is booked</h1>
          <p className="mt-2">
            {nurse
              ? `${nurseShortName(nurse.name)} will call you before the first visit to agree a time.`
              : "Your nurse will call you before the first visit to agree a time."}
          </p>
        </div>
      </header>

      <dl className="divide-y divide-line rounded-2xl bg-surface shadow-card">
        {plan && (
          <div className="flex justify-between gap-4 p-4">
            <dt>Plan</dt>
            <dd className="text-right font-semibold text-navy">
              {plan.name}, {planFrequency(plan)}
            </dd>
          </div>
        )}
        {nurse && (
          <div className="flex flex-wrap items-center justify-between gap-2 p-4">
            <dt>Nurse</dt>
            <dd className="flex flex-wrap items-center justify-end gap-2 font-semibold text-navy">
              {nurse.name}
              {nurse.verified && <VerifiedBadge />}
            </dd>
          </div>
        )}
        {onboarding.payment && (
          <div className="flex justify-between gap-4 p-4">
            <dt>Paid</dt>
            <dd className="text-right font-semibold tabular-nums text-navy">
              {formatNaira(onboarding.payment.amountNGN)}
              <span className="block text-small font-normal">Ref {onboarding.payment.reference}</span>
            </dd>
          </div>
        )}
      </dl>

      <section aria-labelledby="whatsapp-heading" className="rounded-2xl border-2 border-teal bg-surface p-5">
        <h2 id="whatsapp-heading" className="flex items-center gap-2 text-h2 font-semibold">
          <WhatsAppMark className="size-7" />
          Updates come to you on WhatsApp
        </h2>
        <p className="mt-2">
          {onboarding.account
            ? <>We&apos;ll message <strong className="whitespace-nowrap text-navy">{formatPhone(onboarding.account.phone)}</strong>:</>
            : "We'll message you:"}
        </p>
        <ul className="mt-3 space-y-3">
          {WHATSAPP_UPDATES.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-navy">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-teal-tint">
                <Icon aria-hidden className="size-4" />
              </span>
              <span className="pt-1">{text}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-small">
          No WhatsApp signal? Everything is on your dashboard too.
        </p>
      </section>

      <div className="space-y-2">
        <ButtonLink href={routes.familyDashboard} className="w-full">
          Go to your dashboard
        </ButtonLink>
        {demoElder && (
          <p className="text-center text-small">
            In this demo, the dashboard shows {demoElder.name}&apos;s care, a few weeks in, so you can see
            what families see.
          </p>
        )}
      </div>
    </div>
  );
}
