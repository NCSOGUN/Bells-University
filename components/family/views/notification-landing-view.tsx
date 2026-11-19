"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDemo } from "@/lib/demo-context";
import { takeDeliveredRecord } from "@/lib/push-client";
import { routes } from "@/lib/routes";
import { applyVisitUpdate } from "@/lib/visit-update";
import { PageSkeleton } from "@/components/ui/skeleton";

/**
 * Where a tapped visit notification lands, for a moment only. The record the
 * nurse submitted arrived inside the notification; it goes onto this phone's
 * records, then the family goes straight to that visit.
 */
export function NotificationLandingView() {
  const { hydrated, update } = useDemo();
  const router = useRouter();
  const updateId = useSearchParams().get("u");

  useEffect(() => {
    // Wait for saved demo state, or it would overwrite the record on load.
    if (!hydrated) return;
    let live = true;
    void (updateId ? takeDeliveredRecord(updateId) : Promise.resolve(null)).then((u) => {
      if (!live) return;
      if (u) update((prev) => applyVisitUpdate(prev, u));
      // Without the record (opened twice, or it didn't fit), the dashboard still has the latest status.
      router.replace(u ? routes.familyVisit(u.visit.id) : routes.familyDashboard);
    });
    return () => {
      live = false;
    };
  }, [hydrated, updateId, update, router]);

  return <PageSkeleton />;
}
