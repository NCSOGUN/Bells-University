import type { ReactNode } from "react";
import { NurseShell } from "@/components/nurse/nurse-shell";

export default function NurseWorkspaceLayout({ children }: { children: ReactNode }) {
  return <NurseShell>{children}</NurseShell>;
}
