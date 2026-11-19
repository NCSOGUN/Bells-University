import type { Metadata } from "next";
import { SignupStep } from "@/components/family/onboarding/signup-step";

export const metadata: Metadata = { title: "Your details · CareCircle NG" };

export default function SignupPage() {
  return <SignupStep />;
}
