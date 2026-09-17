import type { Metadata } from "next";
import { MatchingStep } from "@/components/family/onboarding/matching-step";

export const metadata: Metadata = { title: "Your nurse · CareCircle NG" };

export default function MatchingPage() {
  return <MatchingStep />;
}
