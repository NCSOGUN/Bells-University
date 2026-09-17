"use client";

import { useState } from "react";
import { Globe, Lock } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { formatLongDate, formatNaira, formatVisitsPerWeek } from "@/lib/format";
import {
  CROSS_BORDER_FEE,
  INDICATIVE_NGN_PER,
  crossBorderFeeNGN,
  formatForeign,
  toForeign,
  type ForeignCurrency,
} from "@/lib/fx";
import { patchOnboarding } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { findPlan } from "@/lib/selectors";
import { useTimers } from "@/lib/use-timers";
import { Button, ButtonLink } from "@/components/ui/button";
import { SuccessTick } from "@/components/ui/success-tick";
import { OnboardingShell } from "./onboarding-shell";

// §4.3: the simulated round trip to Paystack.
const PAYSTACK_MS = 1800;

export function PaymentStep() {
  const { state } = useDemo();
  const paid = Boolean(state.onboarding.payment);
  return (
    <OnboardingShell
      step="payment"
      back={{ href: routes.familyMatching, label: "Your nurse" }}
      title={paid ? "Payment received" : "Pay for your plan"}
    >
      <Checkout />
    </OnboardingShell>
  );
}

function Checkout() {
  const { state, update } = useDemo();
  const { after, cancelAll } = useTimers();
  const [abroad, setAbroad] = useState(false);
  const [currency, setCurrency] = useState<ForeignCurrency>("GBP");
  const [paying, setPaying] = useState(false);

  // Falls back to the account's plan if someone lands here directly.
  const plan = findPlan(state, state.onboarding.planId ?? state.familyAccount.planId);
  const payment = state.onboarding.payment;

  if (payment) return <Receipt />;
  if (!plan) {
    return (
      <p>
        Choose a plan first.{" "}
        <ButtonLink href={routes.familyPlans} variant="ghost" className="px-0">
          See plans
        </ButtonLink>
      </p>
    );
  }

  const fee = abroad ? crossBorderFeeNGN(plan.priceNGN) : 0;
  const total = plan.priceNGN + fee;

  const complete = () => {
    cancelAll();
    update((prev) =>
      patchOnboarding(prev, {
        payment: {
          planId: plan.id,
          amountNGN: total,
          reference: `CC-${Date.now().toString(36).toUpperCase()}`,
          paidAt: new Date().toISOString(),
        },
      }),
    );
  };

  const pay = () => {
    setPaying(true);
    after(PAYSTACK_MS, complete);
  };

  return (
    <div className="space-y-5">
      <section aria-labelledby="order-heading" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="order-heading" className="text-h2 font-semibold">
          {plan.name} plan
        </h2>
        <p className="mt-0.5">{formatVisitsPerWeek(plan.visitsPerWeek)}, billed monthly</p>

        <dl className="mt-4 space-y-2 border-t border-line pt-4">
          <div className="flex justify-between gap-4">
            <dt>Plan</dt>
            <dd className="tabular-nums text-navy">{formatNaira(plan.priceNGN)}</dd>
          </div>
          {abroad && (
            <div className="flex justify-between gap-4">
              <dt>
                Estimated card fee from abroad
                <span className="block text-small">
                  {CROSS_BORDER_FEE.percent}% + {formatNaira(CROSS_BORDER_FEE.flatNGN)}
                </span>
              </dt>
              <dd className="tabular-nums text-navy">{formatNaira(fee)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t border-line pt-2">
            <dt className="font-semibold text-navy">Total today</dt>
            <dd className="font-display text-h2 font-semibold tabular-nums text-navy" data-testid="total-ngn">
              {formatNaira(total)}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-label="Paying from abroad" className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-4">
          <span id="abroad-label" className="flex items-center gap-2 font-semibold text-navy">
            <Globe aria-hidden className="size-5" />
            Paying from abroad?
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={abroad}
            aria-labelledby="abroad-label"
            onClick={() => setAbroad((v) => !v)}
            disabled={paying}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border-2 transition-colors duration-150 ${
              abroad ? "border-teal bg-teal" : "border-line bg-bg"
            }`}
          >
            <span
              aria-hidden
              className={`inline-block size-6 rounded-full bg-surface shadow transition-transform duration-150 ${
                abroad ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {abroad ? (
          <div className="mt-4 space-y-3">
            <div role="radiogroup" aria-label="Your currency" className="inline-flex rounded-xl border border-line p-1">
              {(Object.keys(INDICATIVE_NGN_PER) as ForeignCurrency[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={currency === c}
                  onClick={() => setCurrency(c)}
                  className={`min-h-11 rounded-lg px-4 font-semibold text-navy transition-colors duration-150 ${
                    currency === c ? "bg-teal-tint" : ""
                  }`}
                >
                  {c === "GBP" ? "£ Pounds" : "$ Dollars"}
                </button>
              ))}
            </div>
            <p aria-live="polite" className="text-navy">
              About{" "}
              <strong className="font-display text-h2 font-semibold tabular-nums" data-testid="total-foreign">
                {formatForeign(toForeign(total, currency), currency)}
              </strong>{" "}
              a month, including the estimated card fee.
            </p>
            <p className="text-small">
              Indicative rate of {formatNaira(INDICATIVE_NGN_PER[currency])} to{" "}
              {formatForeign(1, currency).replace(/\.00$/, "")}, not a live rate. Your bank sets the final amount.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-small">
            Turn this on to see roughly what you&apos;ll pay in pounds or dollars, including card fees.
          </p>
        )}
      </section>

      <div className="space-y-2">
        <Button onClick={pay} loading={paying} loadingText="Contacting Paystack…" className="w-full">
          Pay with Paystack
        </Button>
        {paying ? (
          <p className="text-center">
            <button
              type="button"
              onClick={complete}
              className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-navy underline decoration-teal decoration-2 underline-offset-4"
            >
              Skip
            </button>
          </p>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-center text-small">
            <Lock aria-hidden className="size-3.5" />
            Card, bank transfer or USSD on Paystack&apos;s secure page. This demo takes no payment.
          </p>
        )}
      </div>
    </div>
  );
}

function Receipt() {
  const { state } = useDemo();
  const payment = state.onboarding.payment;
  const plan = payment && findPlan(state, payment.planId);
  if (!payment || !plan) return null;

  return (
    <div className="space-y-6">
      <div role="status" className="rounded-2xl border-2 border-teal bg-teal-tint p-5">
        <div className="flex items-center gap-4">
          <SuccessTick />
          <div>
            <p className="font-display text-h2 font-semibold text-navy">
              {formatNaira(payment.amountNGN)} paid
            </p>
            <p className="text-navy">
              {plan.name} plan, {formatVisitsPerWeek(plan.visitsPerWeek)}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid gap-2 border-t border-teal/40 pt-3 text-small sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-navy">Reference</dt>
            <dd className="tabular-nums">{payment.reference}</dd>
          </div>
          <div>
            <dt className="font-semibold text-navy">Paid</dt>
            <dd>{formatLongDate(payment.paidAt)}</dd>
          </div>
        </dl>
      </div>
      <ButtonLink href={routes.familyConfirmed} className="w-full">
        Continue
      </ButtonLink>
    </div>
  );
}
