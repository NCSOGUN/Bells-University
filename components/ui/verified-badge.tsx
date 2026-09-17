import { ShieldCheck } from "lucide-react";

/** The only place the `verified` colour is used (UX Addendum). */
export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-verified px-2.5 py-1 text-label font-semibold text-white">
      <ShieldCheck aria-hidden className="size-3.5" />
      NMCN verified
    </span>
  );
}
