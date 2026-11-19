"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";

const LINKS = [
  { href: routes.nurseDashboard, label: "Today", matches: (path: string) => path === routes.nurseDashboard },
  { href: routes.nurseClients, label: "Clients", matches: (path: string) => path.startsWith(routes.nurseClients) },
  { href: routes.nurseEarnings, label: "Earnings", matches: (path: string) => path === routes.nurseEarnings },
];

export function NurseNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Nurse">
      <ul className="flex gap-1">
        {LINKS.map((link) => {
          const active = link.matches(pathname);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-xl px-2.5 text-small font-semibold text-navy transition-colors duration-150 sm:px-3 sm:text-body ${
                  active ? "bg-teal-tint" : "hover:bg-bg"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
