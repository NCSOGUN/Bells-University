import type { ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/ui/brand";

/** N1–N5: someone applying to join, so no dashboard navigation yet. */
export default function NurseJoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-8">
          <Brand suffix="For nurses" />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-small font-semibold text-navy hover:bg-bg"
          >
            For families
          </Link>
        </div>
      </header>
      {/* Bottom padding keeps content clear of the fixed "Reset demo" control. */}
      <main id="main-content" className="mx-auto max-w-6xl px-4 pt-8 pb-28 sm:px-8 sm:pt-12">{children}</main>
    </div>
  );
}
