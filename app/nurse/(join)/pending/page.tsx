import type { Metadata } from "next";
import { NursePendingStep } from "@/components/nurse/join/pending-step";

export const metadata: Metadata = { title: "Your application · CareCircle NG" };

export default function NursePendingPage() {
  return <NursePendingStep />;
}
