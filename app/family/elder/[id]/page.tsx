import type { Metadata } from "next";
import { ElderProfileView } from "@/components/family/views/elder-profile-view";

export const metadata: Metadata = { title: "Profile · CareCircle NG" };

export default async function ElderProfilePage({ params }: PageProps<"/family/elder/[id]">) {
  const { id } = await params;
  return <ElderProfileView elderId={id} />;
}
