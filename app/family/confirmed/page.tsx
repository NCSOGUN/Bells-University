import type { Metadata } from "next";
import { ConfirmedStep } from "@/components/family/onboarding/confirmed-step";

export const metadata: Metadata = { title: "You're all set — CareCircle NG" };

export default function ConfirmedPage() {
  return <ConfirmedStep />;
}
