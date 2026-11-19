"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { useFirstLoad } from "@/lib/use-first-load";
import { formatVisitWhen, planFrequency } from "@/lib/format";
import { DEMO_NURSE_ID } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { completedVisits, findPlan, nurseClients, visitsForElder } from "@/lib/selectors";
import { Avatar } from "@/components/ui/avatar";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TextLink } from "@/components/ui/text-link";
import { CareStatusChip } from "../care-status-chip";

export function ClientListView() {
  const { state, hydrated } = useDemo();
  const loaded = useFirstLoad("nurse-clients");
  if (!hydrated || !loaded) return <PageSkeleton />;

  const clients = nurseClients(state, DEMO_NURSE_ID);

  return (
    <div className="space-y-6">
      <TextLink href={routes.nurseDashboard} direction="back" className="-mt-2">
        Back to today
      </TextLink>
      <header>
        <h1 className="text-display font-bold">Your clients</h1>
        <p className="mt-1">
          {clients.length} {clients.length === 1 ? "person" : "people"} in your care. Choose one to see
          their full record before a visit.
        </p>
      </header>

      {clients.length === 0 ? (
        <p className="rounded-2xl bg-surface shadow-card p-6">
          You don&apos;t have any clients yet. Accepted assignment requests will appear here.
        </p>
      ) : (
        <ul className="space-y-3">
          {clients.map((elder) => {
            const plan = findPlan(state, elder.planId);
            const last = completedVisits(visitsForElder(state, elder.id)).at(-1);
            return (
              <li key={elder.id}>
                <Link
                  href={routes.nurseClient(elder.id)}
                  className="flex items-center gap-3 rounded-2xl bg-surface shadow-card p-4 transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-teal sm:gap-4 sm:p-5"
                >
                  <Avatar name={elder.name} tone="teal" className="max-sm:hidden" />
                  <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_8rem] sm:items-center">
                    <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:col-span-1 sm:block">
                      <p className="font-display text-h2 font-semibold text-navy">
                        {elder.name}
                        <span className="font-sans text-body font-normal text-ink">, {elder.age}</span>
                      </p>
                      <CareStatusChip status={elder.careStatus} className="sm:hidden" />
                    </div>
                    <dl className="contents text-small">
                      <div>
                        <dt className="font-semibold text-navy">Plan</dt>
                        <dd>{plan ? `${plan.name}, ${planFrequency(plan)}` : "No plan"}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-navy">Last visit</dt>
                        <dd>{last ? formatVisitWhen(last.scheduledAt) : "No visits yet"}</dd>
                      </div>
                      <div className="text-right max-sm:hidden">
                        <dt className="sr-only">Care status</dt>
                        <dd>
                          <CareStatusChip status={elder.careStatus} />
                        </dd>
                      </div>
                    </dl>
                  </div>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-navy" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
