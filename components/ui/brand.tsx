import Link from "next/link";

/** The CareCircle wordmark with its mark: an open circle of care around a point. */
export function Brand({ suffix, href = "/" }: { suffix?: string; href?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-2.5 text-navy" aria-label={`CareCircle${suffix ? ` ${suffix}` : ""}, home`}>
      <svg aria-hidden viewBox="0 0 32 32" className="size-7 shrink-0">
        <circle cx="16" cy="16" r="12" fill="none" stroke="var(--color-teal-deep)" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="62 14" transform="rotate(-50 16 16)" />
        <circle cx="16" cy="16" r="4.2" fill="var(--color-navy)" />
      </svg>
      <span className="text-[19px] font-semibold tracking-tight">CareCircle</span>
      {suffix && (
        <span className="rounded-full bg-bg px-2 py-0.5 text-label font-semibold text-ink shadow-card">{suffix}</span>
      )}
    </Link>
  );
}
