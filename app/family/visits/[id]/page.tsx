import type { Metadata } from "next";
import { VisitDetailView } from "@/components/family/views/visit-detail-view";

export const metadata: Metadata = { title: "Visit record · CareCircle NG" };

export default async function VisitDetailPage({ params }: PageProps<"/family/visits/[id]">) {
  const { id } = await params;
  return <VisitDetailView visitId={id} />;
}
