"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { clearOnboarding } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { TextLink } from "@/components/ui/text-link";

export const ONBOARDING_STEPS = [
  { key: "plan", label: "Plan" },
  { key: "account", label: "Your details" },
  { key: "relative", label: "Your relative" },
  { key: "nurse", label: "Nurse" },
  { key: "payment", label: "Payment" },
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]["key"];

interface OnboardingShellProps {
  step: OnboardingStep;
  back: { href: string; label: string };
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Frame for F2–F6: where you are, how to go back, and a way to start again. */
export function OnboardingShell({ step, back, title, description, children }: OnboardingShellProps) {
  const { hydrated, update } = useDemo();
  const router = useRouter();
  const index = ONBOARDING_STEPS.findIndex((s) => s.key === step);

  const startOver = () => {
    // Only the visitor's draft is cleared; the seeded family stays as it is.
    update(clearOnboarding);
    router.push(routes.home);
  };

  return (
    <div className="mx-auto max-w-xl">
      <div className="-mt-2 flex items-center justify-between gap-3">
        <TextLink href={back.href} direction="back">
          {back.label}
        </TextLink>
        <button
          type="button"
          onClick={startOver}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-small font-semibold text-navy transition-colors duration-150 hover:bg-surface"
        >
          <RotateCcw aria-hidden className="size-4" />
          Start over
        </button>
      </div>

      <nav aria-label="Sign-up progress" className="mt-4">
        <p className="text-small font-medium text-navy">
          Step {index + 1} of {ONBOARDING_STEPS.length}: {ONBOARDING_STEPS[index].label}
        </p>
        <ol className="mt-2 grid grid-cols-5 gap-1.5">
          {ONBOARDING_STEPS.map((s, i) => (
            <li key={s.key} aria-current={i === index ? "step" : undefined}>
              <span
                aria-hidden
                className={`block h-1.5 rounded-full transition-colors duration-150 ${
                  i < index ? "bg-teal" : i === index ? "bg-navy" : "bg-line"
                }`}
              />
              <span className="sr-only">
                {s.label}
                {i < index ? " (done)" : i === index ? " (current)" : ""}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <header className="mt-6">
        <h1 className="text-h1 font-bold sm:text-display">{title}</h1>
        {description && <p className="mt-2">{description}</p>}
      </header>

      <div className="mt-6">
        {hydrated ? (
          children
        ) : (
          <div role="status" aria-label="Loading" className="space-y-3">
            <div className="h-24 rounded-2xl bg-line/70" />
            <div className="h-24 rounded-2xl bg-line/70" />
            <div className="h-12 rounded-xl bg-line/70" />
          </div>
        )}
      </div>
    </div>
  );
}
