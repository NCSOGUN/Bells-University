import type { Metadata } from "next";
import { PrivacyView } from "@/components/family/views/privacy-view";

export const metadata: Metadata = { title: "Privacy and consent · CareCircle NG" };

export default function FamilyPrivacyPage() {
  return <PrivacyView />;
}
