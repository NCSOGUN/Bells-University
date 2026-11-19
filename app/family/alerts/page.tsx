import type { Metadata } from "next";
import { AlertsView } from "@/components/family/views/alerts-view";

export const metadata: Metadata = { title: "Visit updates on this phone · CareCircle NG" };

export default function FamilyAlertsPage() {
  return <AlertsView />;
}
