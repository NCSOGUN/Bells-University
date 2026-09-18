import type { ReactNode } from "react";

/** §4.3: a value that just changed flashes once, briefly, and nothing else moves. */
export function Highlight({
  value,
  className = "",
  children,
}: {
  /** Re-keys the element so the flash replays when this changes. */
  value: string | number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span key={String(value)} className={`rounded motion-safe:animate-highlight ${className}`}>
      {children}
    </span>
  );
}
