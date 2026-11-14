import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const plexSans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin"], weight: ["400", "500", "600"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const space = Space_Grotesk({ variable: "--font-space", subsets: ["latin"], weight: ["500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Itan", template: "%s · Itan" },
  description: "A patient-held medical record. Prototype: made-up data only.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6f8a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable} ${space.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
