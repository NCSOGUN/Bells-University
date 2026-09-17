import type { Metadata } from "next";
import { ClientDetailView } from "@/components/nurse/views/client-detail-view";

export const metadata: Metadata = { title: "Client record · CareCircle NG" };

export default async function ClientDetailPage({ params }: PageProps<"/nurse/clients/[id]">) {
  const { id } = await params;
  return <ClientDetailView elderId={id} />;
}
