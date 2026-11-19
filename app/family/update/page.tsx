import { Suspense } from "react";
import type { Metadata } from "next";
import { NotificationLandingView } from "@/components/family/views/notification-landing-view";
import { PageSkeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Visit update · CareCircle NG" };

export default function FamilyUpdatePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificationLandingView />
    </Suspense>
  );
}
