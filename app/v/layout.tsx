// Clinician pages: server-rendered, light, no client framework needed to read them (NFR-11: first screen under 300 KB).
import type { ReactNode } from "react";

export default function ViewerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header data-app-chrome className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <span className="font-display text-2xl font-semibold tracking-tight">Itan</span>
          <span className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Shared record · read only</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer data-app-chrome className="border-t border-line bg-surface">
        <p className="mx-auto w-full max-w-3xl px-4 py-3 text-sm text-muted">Prototype. Made-up data only. Not a diagnosis tool and not cleared for real patients.</p>
      </footer>
    </div>
  );
}
