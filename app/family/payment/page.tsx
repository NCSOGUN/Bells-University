import type { Metadata } from "next";
import { PaymentStep } from "@/components/family/onboarding/payment-step";

export const metadata: Metadata = { title: "Payment · CareCircle NG" };

export default function PaymentPage() {
  return <PaymentStep />;
}
