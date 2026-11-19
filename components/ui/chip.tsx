import type { ReactNode } from "react";

export type ChipTone = "neutral" | "teal" | "amber" | "coral";

// Text is always navy for contrast; the tone lives in the fill, border and dot.
const TONE_STYLES: Record<ChipTone, { chip: string; dot: string }> = {
  neutral: { chip: "border-line bg-bg", dot: "bg-muted" },
  teal: { chip: "border-teal/50 bg-teal-tint", dot: "bg-teal" },
  amber: { chip: "border-amber bg-amber/15", dot: "bg-amber" },
  coral: { chip: "border-coral bg-coral/10", dot: "bg-coral" },
};

interface ChipProps {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}

export function Chip({ tone = "neutral", children, className = "" }: ChipProps) {
  const styles = TONE_STYLES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-label font-semibold text-navy ${styles.chip} ${className}`}
    >
      <span aria-hidden className={`size-2 shrink-0 rounded-full ${styles.dot}`} />
      {children}
    </span>
  );
}
