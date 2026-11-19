"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users, Wallet } from "lucide-react";
import { acceptAssignment, declineAssignment } from "@/lib/assignments";
import { useDemo } from "@/lib/demo-context";
import { useFirstLoad } from "@/lib/use-first-load";
import { firstName, formatLongDate, formatNaira } from "@/lib/format";
import { DEMO_NURSE_ID, EARNINGS_PER_VISIT_NGN } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import {
  assignmentsForNurse,
  findElder,
  findNurse,
  findPlan,
  nurseClients,
  nurseEarnings,
  todaysVisits,
} from "@/lib/selectors";
import { Highlight } from "@/components/ui/highlight";
import { PageSkeleton } from "@/components/ui/skeleton";
import { AssignmentRequests, type AssignmentView } from "../assignment-requests";
import { TodaysVisits } from "../todays-visits";

// §4.3: accepting is optimistic, the client moves into today's work at once,
// and the confirmation lands shortly after. Declining confirms on the same beat.
const CONFIRM_MS = 600;

export function NurseDashboardView() {
  const { state, hydrated, update } = useDemo();
  const [recent, setRecent] = useState<{ id: string; confirmed: boolean }>();
  const loaded = useFirstLoad("nurse-dashboard");

  useEffect(() => {
    if (!recent || recent.confirmed) return;
    const timer = setTimeout(() => setRecent({ ...recent, confirmed: true }), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [recent]);

  if (!hydrated || !loaded) return <PageSkeleton />;

  const nurse = findNurse(state, DEMO_NURSE_ID);
  const visits = todaysVisits(state, DEMO_NURSE_ID);
  const clients = nurseClients(state, DEMO_NURSE_ID);
  const earnings = nurseEarnings(state, DEMO_NURSE_ID);

  const assignments: AssignmentView[] = assignmentsForNurse(state, DEMO_NURSE_ID).flatMap((request) => {
    const elder = findElder(state, request.elderId);
    return elder ? [{ request, elder, plan: findPlan(state, elder.planId) }] : [];
  });
  const newClients = assignments
    .filter((a) => a.request.status === "accepted" && a.elder.assignedNurseId === DEMO_NURSE_ID)
    .map((a) => a.elder);
  const recentElderId = assignments.find((a) => a.request.id === recent?.id)?.elder.id;

  const accept = (requestId: string) => {
    update((prev) => acceptAssignment(prev, requestId));
    setRecent({ id: requestId, confirmed: false });
  };
  const decline = (requestId: string, reason: string) => {
    update((prev) => declineAssignment(prev, requestId, reason));
    setRecent({ id: requestId, confirmed: false });
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="text-small">{formatLongDate(new Date().toISOString())}</p>
        <h1 className="mt-1 text-display font-bold">Hello, {nurse ? firstName(nurse.name) : "there"}</h1>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TodaysVisits
          visits={visits}
          elders={state.elders}
          plans={state.plans}
          newClients={newClients}
          highlightId={recentElderId}
        />

        <div className="space-y-6">
          <AssignmentRequests assignments={assignments} recent={recent} onAccept={accept} onDecline={decline} />

          <section aria-label="Your work so far" className="grid grid-cols-2 gap-3">
            <Link
              href={routes.nurseEarnings}
              className="rounded-2xl bg-surface shadow-card p-4 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-teal"
            >
              <p className="flex items-center gap-1.5 text-small">
                <Wallet aria-hidden className="size-4 text-navy" />
                Earned to date
              </p>
              <p className="mt-1 font-display text-h2 font-semibold tabular-nums text-navy">
                <Highlight value={earnings.amount}>{formatNaira(earnings.amount)}</Highlight>
              </p>
              <p className="text-small">
                {earnings.visits} visits × {formatNaira(EARNINGS_PER_VISIT_NGN)}
              </p>
              <p className="mt-1 inline-flex items-center gap-0.5 text-small font-semibold text-navy text-teal-deep decoration-2 underline-offset-4 hover:underline">
                See earnings
                <ChevronRight aria-hidden className="size-4" />
              </p>
            </Link>
            <Link
              href={routes.nurseClients}
              className="rounded-2xl bg-surface shadow-card p-4 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-teal"
            >
              <p className="flex items-center gap-1.5 text-small">
                <Users aria-hidden className="size-4 text-navy" />
                Your clients
              </p>
              <p className="mt-1 font-display text-h2 font-semibold tabular-nums text-navy">
                <Highlight value={clients.length}>{clients.length}</Highlight>
              </p>
              <p className="inline-flex items-center gap-0.5 text-small font-semibold text-navy text-teal-deep decoration-2 underline-offset-4 hover:underline">
                View all clients
                <ChevronRight aria-hidden className="size-4" />
              </p>
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
