import { CalendarDays, Check } from "lucide-react";
import type { PaymentStatus, Plan, Sponsor } from "@/lib/mock-data";
import { formatCountdown, formatLongDate, formatNaira, formatVisitsPerWeek } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Chip, type ChipTone } from "@/components/ui/chip";

const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: ChipTone }> = {
  active: { label: "Active", tone: "teal" },
  past_due: { label: "Payment overdue", tone: "coral" },
};

interface PlanSummaryCardProps {
  plan: Plan | undefined;
  nextBillingDate: string;
  paymentStatus: PaymentStatus;
  sponsor?: Sponsor;
}

export function PlanSummaryCard({ plan, nextBillingDate, paymentStatus, sponsor }: PlanSummaryCardProps) {
  if (!plan) {
    return (
      <Card title="Plan and billing">
        <p>No plan has been chosen yet. Your plan and monthly cost will appear here.</p>
      </Card>
    );
  }

  const status = PAYMENT_STATUS[paymentStatus];

  return (
    <Card title="Plan and billing">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-h2 font-semibold text-navy">
          {plan.name} · {formatVisitsPerWeek(plan.visitsPerWeek)}
        </p>
        <Chip tone={status.tone}>{status.label}</Chip>
      </div>
      <p className="mt-1 text-navy">
        <span className="font-semibold tabular-nums">{formatNaira(plan.priceNGN)}</span>{" "}
        <span className="text-small">per month</span>
        {sponsor && (
          <span className="text-small">
            {" "}
            · Paid by {sponsor.name}, {sponsor.relationship.toLowerCase()}
          </span>
        )}
      </p>

      <div className="mt-4 flex items-start gap-3 rounded-xl bg-bg p-3">
        <CalendarDays aria-hidden className="mt-0.5 size-5 shrink-0 text-navy" />
        <div>
          <p className="text-small">Next payment</p>
          <p className="font-semibold text-navy">
            {formatLongDate(nextBillingDate)}{" "}
            <span className="text-small font-normal">({formatCountdown(nextBillingDate)})</span>
          </p>
        </div>
      </div>

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
