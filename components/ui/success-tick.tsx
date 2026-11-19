import { Check } from "lucide-react";

/** §4.3: one scale-in tick with a slight overshoot. */
export function SuccessTick({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`grid size-14 shrink-0 place-items-center rounded-full bg-teal text-navy motion-safe:animate-tick-in ${className}`}
    >
      <Check className="size-7" strokeWidth={3} />
    </span>
  );
}
