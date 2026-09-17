"use client";

import type { LucideIcon } from "lucide-react";
import { BadgeCheck, FileWarning, FlaskConical, Hourglass } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { firstName, formatRelativeDay, formatTime } from "@/lib/format";
import {
  RESUBMISSION,
  patchNurseOnboarding,
  requestResubmission,
  type ApplicationStatus,
} from "@/lib/nurse-onboarding";
import type { DemoState } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { ButtonLink } from "@/components/ui/button";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { JoinShell } from "./join-shell";

type ReviewState = Exclude<ApplicationStatus, "pending_verification">;

const STATES: Record<ReviewState, { label: string; tone: ChipTone; icon: LucideIcon; panel: string }> = {
  in_review: { label: "In review", tone: "amber", icon: Hourglass, panel: "border-amber bg-amber/10" },
  approved: { label: "Approved", tone: "teal", icon: BadgeCheck, panel: "border-teal bg-teal-tint" },
  needs_resubmission: { label: "Needs resubmission", tone: "coral", icon: FileWarning, panel: "border-coral bg-coral/10" },
};

export function NursePendingStep() {
  return (
    <JoinShell
      step="Verification"
      back={{ href: routes.nurseDocuments, label: "Documents" }}
      title="Your application"
    >
      <Pending />
    </JoinShell>
  );
}

function Pending() {
  const { state, update } = useDemo();
  const { applicant, reviewedAt } = state.nurseOnboarding;
  const status: ReviewState =
    state.nurseOnboarding.status && state.nurseOnboarding.status !== "pending_verification"
      ? state.nurseOnboarding.status
      : "in_review";
  const view = STATES[status];
  const Icon = view.icon;
  const name = applicant ? firstName(applicant.name) : undefined;

  const setStatus = (next: ReviewState) =>
    update((prev: DemoState) =>
      next === "needs_resubmission"
        ? requestResubmission(prev)
        : patchNurseOnboarding(prev, {
            status: next,
            reviewedAt: next === "approved" ? new Date().toISOString() : undefined,
          }),
    );

  return (
    <div className="space-y-6">
      <section aria-labelledby="status-heading" aria-live="polite" className={`rounded-3xl border-2 p-5 sm:p-6 ${view.panel}`}>
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface text-navy">
            <Icon aria-hidden className="size-6" />
          </span>
          <div className="min-w-0">
            <Chip tone={view.tone} className="bg-surface">
              {view.label}
            </Chip>
            {status === "in_review" && (
              <>
                <h2 id="status-heading" className="mt-2 text-h2 font-semibold">
                  We&apos;re checking your documents{name ? `, ${name}` : ""}
                </h2>
                <p className="mt-2 text-navy">
                  A member of our verification team confirms your NMCN licence
                  {applicant && <> <strong className="whitespace-nowrap">{applicant.licenceId}</strong></>}, your ID and
                  your address. We&apos;ll text you when it&apos;s done.
                </p>
              </>
            )}
            {status === "approved" && (
              <>
                <h2 id="status-heading" className="mt-2 text-h2 font-semibold">
                  You&apos;re approved{name ? `, ${name}` : ""}
                </h2>
                <p className="mt-2 text-navy">
                  Your licence and documents have been checked. Set up your profile so we can match you with
                  clients.
                </p>
              </>
            )}
            {status === "needs_resubmission" && (
              <>
                <h2 id="status-heading" className="mt-2 text-h2 font-semibold">
                  One document needs to be sent again
                </h2>
                <p className="mt-2 font-medium text-navy">
                  <span className="sr-only">Reason: </span>
                  {RESUBMISSION.reason}
                </p>
              </>
            )}
            {reviewedAt && status !== "in_review" && (
              <p className="mt-3 text-small">
                Reviewed by the CareCircle verification team, {formatRelativeDay(reviewedAt)} at{" "}
                {formatTime(reviewedAt)}
              </p>
            )}
          </div>
        </div>
      </section>

      {status === "approved" && (
        <ButtonLink href={routes.nurseProfile} className="w-full">
          Set up your profile
        </ButtonLink>
      )}
      {status === "needs_resubmission" && (
        <ButtonLink href={routes.nurseDocuments} className="w-full">
          Upload proof of address again
        </ButtonLink>
      )}

      <section
        aria-labelledby="demo-controls-heading"
        className="rounded-2xl border-2 border-dashed border-muted bg-bg p-4"
      >
        <h2 id="demo-controls-heading" className="flex items-center gap-2 font-sans text-small font-semibold text-navy">
          <FlaskConical aria-hidden className="size-4" />
          Demo controls — application status
        </h2>
        <p className="mt-1 text-small">
          Not part of the nurse&apos;s app. In the real service, only the verification team can change this.
        </p>
        <div role="group" aria-label="Simulate the reviewer's decision" className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(STATES) as ReviewState[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => setStatus(key)}
              className={`min-h-11 rounded-xl border px-3 text-small font-semibold text-navy transition-colors duration-150 ${
                status === key ? "border-navy bg-surface" : "border-line hover:border-navy"
              }`}
            >
              {STATES[key].label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
