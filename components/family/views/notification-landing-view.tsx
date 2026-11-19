"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemo } from "@/lib/demo-context";
import { takeDeliveredRecord } from "@/lib/push-client";
import { routes } from "@/lib/routes";
import { applyVisitUpdate, type VisitUpdate } from "@/lib/visit-update";
import { CareStatusChip } from "@/components/care/care-status-chip";
import { SignInPrompt } from "@/components/phone/sign-in-prompt";
import { PageSkeleton } from "@/components/ui/skeleton";

/**
 * Where a tapped visit notification lands. The record the nurse submitted
 * arrived inside the notification; it goes onto this phone's records now, and
 * the family signs in before seeing any of it.
 */
export function NotificationLandingView() {
  const { state, hydrated, update } = useDemo();
  const router = useRouter();
  const updateId = useSearchParams().get("u");
  const [record, setRecord] = useState<VisitUpdate | null | undefined>(updateId ? undefined : null);

  useEffect(() => {
    // Wait for saved demo state, or it would overwrite the record on load.
    if (!hydrated || !updateId) return;
    let live = true;
    void takeDeliveredRecord(updateId).then((u) => {
      if (!live) return;
      if (u) update((prev) => applyVisitUpdate(prev, u));
      setRecord(u);
    });
    return () => {
      live = false;
    };
  }, [hydrated, updateId, update]);

  if (!hydrated || record === undefined) return <PageSkeleton />;

  // Without the record (opened twice, or it didn't fit), the dashboard still has the latest status.
  const next = record ? routes.familyVisit(record.visit.id) : routes.familyDashboard;

  return (
    <div className="mx-auto max-w-md space-y-6">
      {record && (
        <section aria-label="From your notification" className="rounded-2xl bg-surface p-4 shadow-card">
          <p className="text-label font-semibold text-ink">From your notification</p>
          <p className="mt-1 font-semibold text-navy">{record.title}</p>
          <div className="mt-2">
            <CareStatusChip status={record.status} />
          </div>
        </section>
      )}
      <SignInPrompt
        accountName={state.familyAccount.name}
        phone={state.familyAccount.phone}
        onSignedIn={() => router.replace(next)}
      />
    </div>
  );
}
