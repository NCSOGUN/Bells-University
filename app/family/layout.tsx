import { FamilyShell } from "@/components/family/family-shell";

export default function FamilyLayout({ children }: LayoutProps<"/family">) {
  return <FamilyShell>{children}</FamilyShell>;
}
