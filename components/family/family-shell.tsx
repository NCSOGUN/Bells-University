"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDemo } from "@/lib/demo-context";
import { initialsOf } from "@/lib/format";
import { routes } from "@/lib/routes";
import { Brand } from "@/components/ui/brand";

/** Signed-in family pages get section tabs; the sign-up steps get a quiet header. */
const SIGNED_IN = ["/family/dashboard", "/family/elder", "/family/visits", "/family/whatsapp", "/family/privacy"];

export function FamilyShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useDemo();
  const signedIn = SIGNED_IN.some((p) => pathname.startsWith(p));
  const elderId = state.familyAccount.elderIds[0] ?? "";

  const tabs = [
    { href: routes.familyDashboard, label: "Overview", active: pathname === routes.familyDashboard },
    {
      href: routes.familyElder(elderId),
      label: "Health record",
      active: pathname.startsWith("/family/elder") || pathname.startsWith("/family/visits"),
    },
    { href: routes.familyWhatsApp, label: "Updates", active: pathname === routes.familyWhatsApp },
    { href: routes.familyPrivacy, label: "Privacy", active: pathname === routes.familyPrivacy },
  ];

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-8">
          <Brand />
          {signedIn && (
            <nav aria-label="Family" className="hidden md:block">
              <ul className="flex items-center gap-1 rounded-full bg-bg p-1">
                {tabs.map((t) => (
                  <li key={t.label}>
                    <Link
                      href={t.href}
                      aria-current={t.active ? "page" : undefined}
                      className={`inline-flex min-h-10 items-center rounded-full px-4 text-small font-semibold transition-colors duration-150 ${
                        t.active ? "bg-surface text-navy shadow-card" : "text-ink hover:text-navy"
                      }`}
                    >
                      {t.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          {signedIn ? (
            <div className="flex items-center gap-3">
              <span className="hidden text-right text-small leading-tight lg:block">
                <span className="block font-semibold text-navy">{state.familyAccount.name}</span>
                <span className="block text-label text-ink">Family account</span>
              </span>
              <span aria-hidden className="grid size-10 place-items-center rounded-full bg-navy text-small font-semibold text-white">
                {initialsOf(state.familyAccount.name)}
              </span>
            </div>
          ) : (
            <Link href={routes.familyPrivacy} className="inline-flex min-h-11 items-center text-small font-semibold text-ink hover:text-navy">
              Privacy and consent
            </Link>
          )}
        </div>
        {signedIn && (
          <nav aria-label="Family sections" className="border-t border-line md:hidden">
            <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
              {tabs.map((t) => (
                <li key={t.label}>
                  <Link
                    href={t.href}
                    aria-current={t.active ? "page" : undefined}
                    className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-full px-3 text-small font-semibold ${
                      t.active ? "bg-navy text-white" : "text-ink"
                    }`}
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      {/* Bottom padding keeps content clear of the fixed demo control. */}
      <main id="main-content" className="mx-auto max-w-6xl px-4 pt-8 pb-28 sm:px-8 sm:pt-12">
        {children}
      </main>
    </div>
  );
}
