import type { Metadata } from "next";
import { DashboardView } from "@/components/family/views/dashboard-view";

export const metadata: Metadata = { title: "Family dashboard — CareCircle NG" };

export default function FamilyDashboardPage() {
  return <DashboardView />;
}
