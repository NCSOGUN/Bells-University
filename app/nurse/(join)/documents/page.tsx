import type { Metadata } from "next";
import { NurseDocumentsStep } from "@/components/nurse/join/documents-step";

export const metadata: Metadata = { title: "Your documents — CareCircle NG" };

export default function NurseDocumentsPage() {
  return <NurseDocumentsStep />;
}
