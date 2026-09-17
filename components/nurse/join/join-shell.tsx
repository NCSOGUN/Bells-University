"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/lib/demo-context";
import { clearNurseOnboarding } from "@/lib/nurse-onboarding";
import { routes } from "@/lib/routes";
import { StepShell } from "@/components/ui/step-shell";

const STEPS = ["Your details", "Documents", "Verification", "Profile"] as const;

interface JoinShellProps {
  step: (typeof STEPS)[number];
  back: { href: string; label: string };
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Frame for N2–N5. */
export function JoinShell({ step, back, title, description, children }: JoinShellProps) {
  const { update } = useDemo();
  const router = useRouter();

  const startOver = () => {
    // Clears the application draft only; Nurse Adaeze's records are untouched.
    update(clearNurseOnboarding);
    router.push(routes.nurseLanding);
  };

  return (
    <StepShell
      steps={STEPS}
      current={STEPS.indexOf(step)}
      progressLabel="Application progress"
      back={back}
      onStartOver={startOver}
      title={title}
      description={description}
    >
      {children}
    </StepShell>
  );
}
