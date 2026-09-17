import type { Metadata } from "next";
import { StartVisitStep } from "@/components/nurse/visit/start-step";

export const metadata: Metadata = { title: "Start visit — CareCircle NG" };

export default async function StartVisitPage({ params }: PageProps<"/nurse/visit/[id]/start">) {
  const { id } = await params;
  return <StartVisitStep visitId={id} />;
}
