import type { Metadata } from "next";
import { ChecklistStep } from "@/components/nurse/visit/checklist-step";

export const metadata: Metadata = { title: "Visit checklist · CareCircle NG" };

export default async function ChecklistPage({ params }: PageProps<"/nurse/visit/[id]/checklist">) {
  const { id } = await params;
  return <ChecklistStep visitId={id} />;
}
