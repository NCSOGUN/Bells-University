import type { Metadata } from "next";
import { PhoneView } from "@/components/phone/phone-view";

export const metadata: Metadata = { title: "Family phone · CareCircle" };

export default function PhonePage() {
  return <PhoneView />;
}
