"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { routes } from "@/lib/routes";

const LINKS = [
  { href: routes.nurseDashboard, label: "Today", matches: (path: string) => path === routes.nurseDashboard },
  { href: routes.nurseClients, label: "Clients", matches: (path: string) => path.startsWith(routes.nurseClients) },
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
                className={`inline-flex min-h-11 items-center rounded-xl px-3 font-semibold text-navy transition-colors duration-150 ${
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
