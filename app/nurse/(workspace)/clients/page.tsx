import type { Metadata } from "next";
import { ClientListView } from "@/components/nurse/views/client-list-view";

export const metadata: Metadata = { title: "Clients · CareCircle NG" };

export default function ClientListPage() {
  return <ClientListView />;
}
