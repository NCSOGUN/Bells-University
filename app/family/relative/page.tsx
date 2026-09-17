import type { Metadata } from "next";
import { RelativeStep } from "@/components/family/onboarding/relative-step";

export const metadata: Metadata = { title: "Your relative — CareCircle NG" };

export default function RelativePage() {
  return <RelativeStep />;
}
