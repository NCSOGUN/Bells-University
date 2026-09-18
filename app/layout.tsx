import type { Metadata, Viewport } from "next";
import { DemoNavigator } from "@/components/demo/demo-navigator";
import { DemoProvider } from "@/lib/demo-context";
import { PageTransition } from "@/components/ui/page-transition";
import { fraunces, inter } from "./fonts";
import "./globals.css";

const description =
  "Clickable demo of CareCircle: verified home nurses for elderly parents in Nigeria, with updates for family wherever they are.";

export const metadata: Metadata = {
  metadataBase: new URL("https://carecircle-demo.vercel.app"),
  title: "CareCircle NG demo",
  description,
  openGraph: {
    title: "CareCircle NG",
    description,
    type: "website",
    locale: "en_NG",
    images: [{ url: "/images/hero-nurse-visit.jpg", width: 716, height: 626, alt: "A nurse with an older woman at home" }],
  },
  twitter: { card: "summary_large_image", title: "CareCircle NG", description },
};

export const viewport: Viewport = { themeColor: "#0a2e45" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="min-h-dvh">
        <DemoProvider>
          {/* First stop for a keyboard user on every screen. */}
          <a
            href="#main-content"
            className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-3 focus-visible:left-3 focus-visible:z-50 focus-visible:inline-flex focus-visible:min-h-11 focus-visible:items-center focus-visible:rounded-xl focus-visible:bg-navy focus-visible:px-4 focus-visible:font-semibold focus-visible:text-white"
          >
            Skip to content
          </a>
          <PageTransition>{children}</PageTransition>
          <DemoNavigator />
        </DemoProvider>
      </body>
    </html>
  );
}
