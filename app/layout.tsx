import type { Metadata } from "next";
import { DemoNavigator } from "@/components/demo/demo-navigator";
import { DemoProvider } from "@/lib/demo-context";
import { PageTransition } from "@/components/ui/page-transition";
import { fraunces, inter } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareCircle NG demo",
  description:
    "Clickable demo of CareCircle: verified home nurses for elderly parents in Nigeria, with updates for family wherever they are.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        <DemoProvider>
          <PageTransition>{children}</PageTransition>
          <DemoNavigator />
        </DemoProvider>
      </body>
    </html>
  );
}
