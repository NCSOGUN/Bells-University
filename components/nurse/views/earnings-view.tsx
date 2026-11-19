"use client";

import { useDemo } from "@/lib/demo-context";
import { earningsByMonth, type PayoutStatus } from "@/lib/earnings";
import { formatNaira, formatShortDate } from "@/lib/format";
import {
  DEMO_NURSE_ID,
  EARNINGS_PER_VISIT_NGN,
  TRANSPORT_ALLOWANCE_NGN,
  VISIT_FEE_NGN,
  type Elder,
  type Visit,
} from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Highlight } from "@/components/ui/highlight";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { EarningsExamples } from "../earnings-examples";

const PAYOUT: Record<PayoutStatus, { label: string; tone: ChipTone; note: string }> = {
  due: { label: "Payout due", tone: "amber", note: "Paid to your bank account at the end of the month." },
  paid: { label: "Paid", tone: "teal", note: "Paid to your bank account." },
};

export function EarningsView() {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <PageSkeleton />;

  const [current, ...past] = earningsByMonth(state, DEMO_NURSE_ID);
  const total = [current, ...past].reduce((sum, p) => sum + p.amount, 0);
  const totalVisits = [current, ...past].reduce((sum, p) => sum + p.visits.length, 0);

  return (
    <div className="space-y-6">
      <TextLink href={routes.nurseDashboard} direction="back" className="-mt-2">
        Back to today
      </TextLink>
      <header>
        <h1 className="text-display font-bold">Earnings</h1>
        <p className="mt-1">
          {formatNaira(EARNINGS_PER_VISIT_NGN)} for every completed visit ({formatNaira(VISIT_FEE_NGN)} plus{" "}
          {formatNaira(TRANSPORT_ALLOWANCE_NGN)} transport). {formatNaira(total)} earned from{" "}
          {totalVisits} {totalVisits === 1 ? "visit" : "visits"} so far.
        </p>
      </header>

      <section
        aria-labelledby="current-period"
        className="rounded-3xl border-2 border-teal bg-teal-tint p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="current-period" className="text-h2 font-semibold">
            This period · {current.label}
          </h2>
          <Chip tone={PAYOUT[current.payout].tone} className="bg-surface">
            {PAYOUT[current.payout].label}
          </Chip>
        </div>
        <p className="mt-3 font-display text-[40px] leading-[44px] font-bold tabular-nums text-navy">
          <Highlight value={current.amount}>{formatNaira(current.amount)}</Highlight>
        </p>
        <p className="mt-1 text-navy">
          {current.visits.length} completed {current.visits.length === 1 ? "visit" : "visits"} ×{" "}
          {formatNaira(EARNINGS_PER_VISIT_NGN)}. {PAYOUT[current.payout].note}
        </p>
        <VisitList visits={current.visits} elders={state.elders} />
      </section>

      {past.length > 0 && (
        <Card title="Earlier periods">
          <ul className="divide-y divide-line">
            {past.map((p) => (
              <li key={p.key} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-navy">{p.label}</p>
                  <Chip tone={PAYOUT[p.payout].tone}>{PAYOUT[p.payout].label}</Chip>
                </div>
                <p className="mt-0.5 text-small">
                  {p.visits.length} {p.visits.length === 1 ? "visit" : "visits"} ·{" "}
                  <span className="font-semibold tabular-nums text-navy">{formatNaira(p.amount)}</span>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <EarningsExamples />
    </div>
  );
}

function VisitList({ visits, elders }: { visits: Visit[]; elders: Elder[] }) {
  if (visits.length === 0) {
    return <p className="mt-4 text-small">Completed visits this month will be listed here.</p>;
  }
  return (
    <ul className="mt-4 divide-y divide-teal/30 rounded-2xl bg-surface px-4">
      {visits.map((visit) => {
        const elder = elders.find((e) => e.id === visit.elderId);
        return (
          <li key={visit.id} className="flex items-center justify-between gap-3 py-3 text-small">
            <span>
              <span className="font-semibold text-navy">{elder?.name ?? "Client"}</span>
              <span className="block">{formatShortDate(visit.scheduledAt)}</span>
            </span>
            <span className="font-semibold tabular-nums text-navy">{formatNaira(EARNINGS_PER_VISIT_NGN)}</span>
          </li>
        );
      })}
    </ul>
  );
}
