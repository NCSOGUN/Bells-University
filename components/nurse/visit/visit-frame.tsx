"use client";

import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { formatTime } from "@/lib/format";
import { DEMO_NURSE_ID, type DemoState, type Elder, type Nurse, type Visit } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { findElder, findNurse } from "@/lib/selectors";
import { visitForFlow, type VisitWorkflow } from "@/lib/visit-flow";
import { RecordNotFound } from "@/components/ui/record-not-found";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";

const STEPS = ["Check in", "Checklist", "Check out"] as const;
export type VisitStep = (typeof STEPS)[number];

export interface VisitContext {
  state: DemoState;
  visit: Visit;
  elder: Elder;
  nurse?: Nurse;
  workflow?: VisitWorkflow;
}

interface VisitFrameProps {
  visitId: string;
  step: VisitStep;
  /** The checklist uses the full width: form on the left, Care Check on the right. */
  wide?: boolean;
  children: (ctx: VisitContext) => ReactNode;
}

/**
 * Resolves the route's visit id to the existing seeded Visit (and its elder
 * and nurse) for N9–N11. Anything else gets a clear dead-end-free message.
 */
export function VisitFrame({ visitId, step, wide = false, children }: VisitFrameProps) {
  const { state, hydrated } = useDemo();
  if (!hydrated) return <PageSkeleton />;

  const access = visitForFlow(state, visitId, DEMO_NURSE_ID);
  const elder = access.ok ? findElder(state, access.visit.elderId) : undefined;
  if (!access.ok || !elder) {
    const notToday = !access.ok && access.reason === "not_today";
    return (
      <RecordNotFound
        title={notToday ? "This visit isn't today" : "We couldn't find this visit"}
        message={
          notToday
            ? "Visits can only be started on the day they're booked."
            : "The link may be out of date, or this visit isn't on your schedule."
        }
        fallback={{ href: routes.nurseDashboard, label: "Go to today's visits" }}
      />
    );
  }

  const { visit } = access;
  const current = STEPS.indexOf(step);

  return (
    <div className={`mx-auto space-y-8 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
      <div className="-mt-2 flex flex-wrap items-center justify-between gap-2">
        <TextLink href={routes.nurseDashboard} direction="back">
          Today&apos;s visits
        </TextLink>
        <ol aria-label="Visit steps" className="flex items-center gap-1 text-small">
          {STEPS.map((s, i) => (
            <li
              key={s}
              aria-current={i === current ? "step" : undefined}
              className={`rounded-full px-3 py-1 font-semibold ${
                i === current ? "bg-navy text-white" : i < current ? "bg-teal-tint text-navy" : "bg-surface text-ink shadow-card"
              }`}
            >
              {s}
            </li>
          ))}
        </ol>
      </div>

      <header>
        <p className="text-small">Visit booked for {formatTime(visit.scheduledAt)} today</p>
        <h1 className="mt-1 text-h1 sm:text-display">{elder.name}</h1>
        <p className="mt-1 flex items-start gap-1.5 text-navy">
          <MapPin aria-hidden className="mt-1 size-4 shrink-0" />
          {elder.address}
        </p>
      </header>

      {children({
        state,
        visit,
        elder,
        nurse: findNurse(state, visit.nurseId),
        workflow: state.visitWorkflows[visit.id],
      })}
    </div>
  );
}
