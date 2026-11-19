"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/lib/demo-context";
import { clearOnboarding } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { StepShell } from "@/components/ui/step-shell";

export const ONBOARDING_STEPS = [
  { key: "account", label: "Your details" },
  { key: "relative", label: "Your relative" },
  { key: "plan", label: "Plan" },
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

/** Frame for F2–F6. */
export function OnboardingShell({ step, back, title, description, children }: OnboardingShellProps) {
  const { update } = useDemo();
  const router = useRouter();

  const startOver = () => {
    // Only the visitor's draft is cleared; the seeded family stays as it is.
    update(clearOnboarding);
    router.push(routes.home);
  };

  return (
    <StepShell
      steps={ONBOARDING_STEPS.map((s) => s.label)}
      current={ONBOARDING_STEPS.findIndex((s) => s.key === step)}
      progressLabel="Sign-up progress"
      back={back}
      onStartOver={startOver}
      title={title}
      description={description}
    >
      {children}
    </StepShell>
  );
}
