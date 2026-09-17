import type { Metadata } from "next";
import { NurseSignupStep } from "@/components/nurse/join/signup-step";

export const metadata: Metadata = { title: "Apply to join · CareCircle NG" };

export default function NurseSignupPage() {
  return <NurseSignupStep />;
}
