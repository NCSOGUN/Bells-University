import type { Metadata } from "next";
import { EarningsView } from "@/components/nurse/views/earnings-view";

export const metadata: Metadata = { title: "Earnings — CareCircle NG" };

export default function NurseEarningsPage() {
  return <EarningsView />;
}
