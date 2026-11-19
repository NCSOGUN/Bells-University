import type { Metadata } from "next";
import { PlansStep } from "@/components/family/onboarding/plans-step";

export const metadata: Metadata = { title: "Choose a plan · CareCircle NG" };

export default function PlansPage() {
  return <PlansStep />;
}
