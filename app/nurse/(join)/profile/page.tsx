import type { Metadata } from "next";
import { NurseProfileStep } from "@/components/nurse/join/profile-step";

export const metadata: Metadata = { title: "Your profile · CareCircle NG" };

export default function NurseProfilePage() {
  return <NurseProfileStep />;
}
