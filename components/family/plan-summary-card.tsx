import { Check } from "lucide-react";
import type { Plan, Sponsor } from "@/lib/mock-data";
import { formatNaira } from "@/lib/format";
import { Card } from "@/components/ui/card";

interface PlanSummaryCardProps {
  plan: Plan | undefined;
  sponsor?: Sponsor;
}

export function PlanSummaryCard({ plan, sponsor }: PlanSummaryCardProps) {
  if (!plan) {
    return (
      <Card title="Plan and billing">
        <p>No plan has been chosen yet. Your plan and monthly cost will appear here.</p>
      </Card>
    );
  }

  return (
    <Card title="Plan and billing">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-h2 font-semibold text-navy">{plan.name} plan</p>
        <p className="text-navy">
          <span className="font-semibold tabular-nums">{formatNaira(plan.priceNGN)}</span>{" "}
          <span className="text-small">per month</span>
        </p>
      </div>
      <p className="mt-1 text-small">
        {plan.visitsPerWeek}
        {sponsor && ` · Paid by ${sponsor.name}, ${sponsor.relationship.toLowerCase()}`}
      </p>
      <ul className="mt-4 space-y-2 border-t border-line pt-4">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-small">
            <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
            {feature}
          </li>
        ))}
      </ul>
    </Card>
  );
}
