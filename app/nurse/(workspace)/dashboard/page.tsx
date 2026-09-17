import type { Metadata } from "next";
import { NurseDashboardView } from "@/components/nurse/views/nurse-dashboard-view";

export const metadata: Metadata = { title: "Today · CareCircle NG" };

export default function NurseDashboardPage() {
  return <NurseDashboardView />;
}
