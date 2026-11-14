// Small, flat, hook-free building blocks. Safe in server and client components.
// Look: hairline borders, small radius, no gradients or shadows. Colour is for origin and state only (NFR-19).
import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad" | "sim";

const toneCls: Record<Tone, string> = {
  neutral: "bg-sunk text-ink",
  accent: "bg-accent-soft text-accent-ink",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  sim: "bg-sim-soft text-sim",
};

/** A short word badge. The WORD carries the meaning; colour only backs it up (NFR-07). */
export function Tag({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium leading-5 ${toneCls[tone]}`}>{children}</span>;
}

const btnBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-[15px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants = {
  primary: "bg-accent text-white hover:bg-accent-ink",
  secondary: "border border-line bg-surface text-ink hover:border-accent",
  quiet: "text-accent-ink hover:bg-accent-soft",
  danger: "border border-bad bg-surface text-bad hover:bg-bad-soft",
} as const;
export type Variant = keyof typeof variants;

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type="button" className={`${btnBase} ${variants[variant]} ${className}`} {...p} />;
}

export function LinkButton({ variant = "secondary", className = "", ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${btnBase} ${variants[variant]} ${className}`} {...p} />;
}

export function Card({ children, className = "", as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={`rounded-lg border border-line bg-surface ${className}`}>{children}</Tag>;
}

/** Mono, uppercase, small: used for section labels so the page has a quiet structure. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[12px] font-medium uppercase tracking-[0.08em] text-muted">{children}</p>;
}

export function PageHeader({ title, sub, aside }: { title: string; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight text-balance">{title}</h1>
        {sub ? <p className="mt-1 max-w-prose text-muted">{sub}</p> : null}
      </div>
      {aside}
    </header>
  );
}

const noticeCls: Record<Tone, string> = {
  neutral: "border-line bg-surface",
  accent: "border-accent bg-accent-soft",
  ok: "border-ok bg-ok-soft",
  warn: "border-warn bg-warn-soft",
  bad: "border-bad bg-bad-soft",
  sim: "border-sim bg-sim-soft",
};

/** A left-ruled note. Used for the required notices, which are shown exactly as the server sends them. */
export function Notice({ tone = "neutral", title, children, role }: { tone?: Tone; title?: string; children: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role} className={`rounded-md border-l-4 px-4 py-3 text-[15px] ${noticeCls[tone]}`}>
      {title ? <p className="mb-0.5 font-medium">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

export const ErrorBox = ({ children }: { children: ReactNode }) => (
  <Notice tone="bad" role="alert">
    {children}
  </Notice>
);

export function Spinner({ children }: { children?: ReactNode }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted">
      <span aria-hidden className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      <span>{children ?? "Loading"}</span>
    </span>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-sunk ${className}`} />;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-lg font-semibold">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-prose text-muted">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export const inputCls =
  "block min-h-11 w-full rounded-md border border-line bg-surface px-3 text-[16px] text-ink placeholder:text-muted focus:border-accent";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-muted">{hint}</span> : null}
    </label>
  );
}
