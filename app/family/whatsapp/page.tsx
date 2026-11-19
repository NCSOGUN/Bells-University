import type { Metadata } from "next";
import { WhatsAppView } from "@/components/family/views/whatsapp-view";

export const metadata: Metadata = { title: "WhatsApp updates · CareCircle NG" };

export default function FamilyWhatsAppPage() {
  return <WhatsAppView />;
}
