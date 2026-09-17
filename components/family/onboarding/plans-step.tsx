"use client";

import { Check } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { formatNaira, formatVisitsPerWeek } from "@/lib/format";
import { patchOnboarding } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { findPlan } from "@/lib/selectors";
import { Button, ButtonLink } from "@/components/ui/button";
import { OnboardingShell } from "./onboarding-shell";

export function PlansStep() {
  return (
    <OnboardingShell
      step="plan"
      back={{ href: routes.home, label: "Home" }}
      title="Choose a care plan"
      description="Every plan includes a verified nurse and an update after each visit. You can change plans later."
    >
      <PlanPicker />
    </OnboardingShell>
  );
}

function PlanPicker() {
  const { state, update } = useDemo();
  const selected = state.onboarding.planId ? findPlan(state, state.onboarding.planId) : undefined;

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="sr-only">Care plans</legend>
        <div className="space-y-3">
          {state.plans.map((plan) => {
            const checked = plan.id === selected?.id;
            return (
              <label
                key={plan.id}
                className={`relative block cursor-pointer rounded-2xl border-2 p-5 transition-[background-color,border-color] duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal ${
                  checked ? "border-teal bg-teal-tint" : "border-line bg-surface hover:border-teal-light"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value={plan.id}
                  checked={checked}
                  onChange={() => update((prev) => patchOnboarding(prev, { planId: plan.id }))}
                  className="sr-only"
                />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-h2 font-semibold text-navy">{plan.name}</p>
                    <p className="mt-0.5 font-medium text-navy">{formatVisitsPerWeek(plan.visitsPerWeek)}</p>
                  </div>
                  <div className="flex items-start gap-3">
                    <p className="text-right">
                      <span className="block font-display text-h2 font-semibold text-navy tabular-nums">
                        {formatNaira(plan.priceNGN)}
                      </span>
                      <span className="text-small">a month</span>
                    </p>
                    <span
                      aria-hidden
                      className={`mt-1 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 ${
                        checked ? "border-teal bg-teal text-navy" : "border-muted bg-surface text-transparent"
                      }`}
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                  </div>
                </div>
                <ul className="mt-3 space-y-1 text-small">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-navy" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </label>
            );
          })}
        </div>
      </fieldset>

      {selected ? (
        <ButtonLink href={routes.familySignup} className="w-full">
          Continue with {selected.name}
        </ButtonLink>
      ) : (
        <div>
          <Button disabled className="w-full" aria-describedby="plan-required">
            Continue
          </Button>
          <p id="plan-required" className="mt-2 text-center text-small">
            Choose a plan to continue.
          </p>
        </div>
      )}
    </div>
  );
}
