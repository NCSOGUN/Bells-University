import type { ReactNode } from "react";
import Link from "next/link";

/** N1–N5: someone applying to join, so no dashboard navigation yet. */
export default function NurseJoinLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="font-display text-h2 font-bold text-navy">
            Care<span className="text-teal">Circle</span>
            <span className="ml-2 align-middle font-sans text-label font-semibold text-ink">For nurses</span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl px-3 text-small font-semibold text-navy hover:bg-bg"
          >
            For families
          </Link>
        </div>
      </header>
      {/* Bottom padding keeps content clear of the fixed "Reset demo" control. */}
      <main className="mx-auto max-w-5xl px-4 pt-6 pb-24 sm:px-6 sm:pt-10">{children}</main>
    </div>
  );
}
