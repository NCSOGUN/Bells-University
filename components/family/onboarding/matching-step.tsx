"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { firstName, nurseShortName } from "@/lib/format";
import { matchedNurseFor, patchOnboarding } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { ButtonLink } from "@/components/ui/button";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { NurseCard } from "../nurse-card";
import { OnboardingShell } from "./onboarding-shell";

// §4.3: three staged messages, ~800ms each, instead of one 2.5s spinner.
const STAGE_MS = 800;

export function MatchingStep() {
  const { state } = useDemo();
  const relativeName = state.onboarding.relative ? firstName(state.onboarding.relative.name) : undefined;
  const matched = Boolean(state.onboarding.matchedNurseId);

  return (
    <OnboardingShell
      step="nurse"
      back={{ href: routes.familyRelative, label: "Your relative" }}
      title={
        matched
          ? `We've found a nurse${relativeName ? ` for ${relativeName}` : ""}`
          : `Finding a nurse${relativeName ? ` for ${relativeName}` : ""}`
      }
    >
      <Matching />
    </OnboardingShell>
  );
}

function Matching() {
  const { state, update } = useDemo();
  const nurse = matchedNurseFor(state);
  // A returning visitor who already saw the match skips straight to it.
  const [stage, setStage] = useState(() => (state.onboarding.matchedNurseId ? 3 : 0));

  const stages = [
    `Checking nurses available in ${nurse?.city ?? "your area"}…`,
    "Confirming NMCN licence status…",
    "Matching on care needs and travel time…",
  ];
  const done = stage >= stages.length;

  useEffect(() => {
    if (done || !nurse) return;
    const id = window.setTimeout(() => setStage((s) => s + 1), STAGE_MS);
    return () => window.clearTimeout(id);
  }, [stage, done, nurse]);

  // Record the match by id only, the nurse stays the seeded record.
  const matchedId = state.onboarding.matchedNurseId;
  useEffect(() => {
    if (done && nurse && matchedId !== nurse.id) {
      update((prev) => patchOnboarding(prev, { matchedNurseId: nurse.id }));
    }
  }, [done, nurse, matchedId, update]);

  if (!nurse) {
    return (
      <RecordNotFound
        title="No nurse available right now"
        message="We couldn't find a nurse for this area. Please try again shortly."
        fallback={{ href: routes.familyRelative, label: "Check your relative's details" }}
      />
    );
  }

  if (!done) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <ol aria-label="Matching progress" className="space-y-4">
          {stages.map((label, i) => {
            const status = i < stage ? "done" : i === stage ? "active" : "waiting";
            return (
              <li
                key={label}
                aria-current={status === "active" ? "step" : undefined}
                className={`flex items-center gap-3 transition-opacity duration-150 ${
                  status === "waiting" ? "opacity-40" : ""
                }`}
              >
                <span
                  aria-hidden
                  className={`grid size-8 shrink-0 place-items-center rounded-full border-2 ${
                    status === "done" ? "border-teal bg-teal text-navy" : "border-line text-navy"
                  }`}
                >
                  {status === "done" && <Check className="size-4" strokeWidth={3} />}
                  {status === "active" && <Loader2 className="size-4 motion-safe:animate-spin" />}
                </span>
                <span className={status === "active" ? "font-semibold text-navy" : "text-navy"}>{label}</span>
              </li>
            );
          })}
        </ol>
        <p role="status" className="sr-only">
          {stages[stage]}
        </p>
        <div className="mt-5 border-t border-line pt-3 text-right">
          <button
            type="button"
            onClick={() => setStage(stages.length)}
            className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-navy underline decoration-teal decoration-2 underline-offset-4"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border-2 border-teal bg-teal-tint p-1 motion-safe:animate-reveal">
        <NurseCard nurse={nurse} title="Your matched nurse" />
      </div>
      <p role="status" className="text-navy">
        {nurseShortName(nurse.name)}&apos;s licence has been checked by our team, and{" "}
        {nurse.specializations.length > 0
          ? `their experience covers ${nurse.specializations.join(" and ").toLowerCase()}.`
          : "they're ready to start."}
      </p>
      <ButtonLink href={routes.familyPayment} className="w-full">
        Continue to payment
      </ButtonLink>
    </div>
  );
}
