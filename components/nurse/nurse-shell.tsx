"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ShieldCheck, Users, Wallet } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { initialsOf } from "@/lib/format";
import { DEMO_NURSE_ID } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { Brand } from "@/components/ui/brand";
import { NurseNav } from "./nurse-nav";

const LINKS = [
  { href: routes.nurseDashboard, label: "Today", icon: CalendarCheck, matches: (p: string) => p === routes.nurseDashboard || p.startsWith("/nurse/visit") },
  { href: routes.nurseClients, label: "Clients", icon: Users, matches: (p: string) => p.startsWith(routes.nurseClients) },
  { href: routes.nurseEarnings, label: "Earnings", icon: Wallet, matches: (p: string) => p === routes.nurseEarnings },
];

/** The nurse's workspace: a fixed sidebar on desktop, a compact top bar on small screens. */
export function NurseShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state } = useDemo();
  const nurse = state.nurses.find((n) => n.id === DEMO_NURSE_ID);

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-6 pt-5 pb-6">
          <Brand suffix="Nurse" href={routes.nurseDashboard} />
        </div>
        <nav aria-label="Nurse" className="flex-1 px-3">
          <ul className="space-y-1">
            {LINKS.map(({ href, label, icon: Icon, matches }) => {
              const active = matches(pathname);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors duration-150 ${
                      active ? "bg-teal-tint text-navy" : "text-ink hover:bg-bg hover:text-navy"
                    }`}
                  >
                    <Icon aria-hidden className={`size-5 ${active ? "text-teal-deep" : ""}`} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        {nurse && (
          <div className="m-3 flex items-center gap-3 rounded-2xl bg-bg p-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-navy text-small font-semibold text-white">
              {initialsOf(nurse.name)}
            </span>
            <span className="min-w-0 text-small leading-tight">
              <span className="block truncate font-semibold text-navy">{nurse.name}</span>
              <span className="mt-0.5 flex items-center gap-1 text-label text-ink">
                <ShieldCheck aria-hidden className="size-3.5 text-verified" />
                NMCN verified · {nurse.city}
              </span>
            </span>
          </div>
        )}
      </aside>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <Brand suffix="Nurse" href={routes.nurseDashboard} />
          <NurseNav />
        </div>
      </header>

      {/* Bottom padding keeps content clear of the fixed demo control. */}
      <main id="main-content" className="px-4 pt-8 pb-28 sm:px-8 sm:pt-10 lg:pl-[calc(16rem+3rem)] lg:pr-12">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
