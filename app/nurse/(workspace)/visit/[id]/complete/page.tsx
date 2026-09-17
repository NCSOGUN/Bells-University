import type { Metadata } from "next";
import { CompleteVisitStep } from "@/components/nurse/visit/complete-step";

export const metadata: Metadata = { title: "Visit complete — CareCircle NG" };

export default async function CompleteVisitPage({ params }: PageProps<"/nurse/visit/[id]/complete">) {
  const { id } = await params;
  return <CompleteVisitStep visitId={id} />;
}
