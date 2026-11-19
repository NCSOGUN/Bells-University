"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * §4.3: every route change fades up over 200ms, in one direction, everywhere.
 * Re-keyed on the path so the animation replays on each navigation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="motion-safe:animate-reveal">
      {children}
    </div>
  );
}
