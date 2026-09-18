import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

// Primary is the screen's one teal action (§4.5); navy text keeps contrast on teal.
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-teal text-navy hover:-translate-y-px hover:bg-teal-light disabled:translate-y-0 disabled:bg-line disabled:text-ink",
  secondary: "border border-line bg-surface text-navy hover:border-navy disabled:text-muted",
  ghost: "text-navy underline decoration-teal decoration-2 underline-offset-4 hover:decoration-navy",
};

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-semibold transition-[background-color,border-color,transform] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:active:translate-y-0";

export function buttonClasses(variant: ButtonVariant = "primary", className = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Shows a spinner and `loadingText` while an action is in flight. */
  loading?: boolean;
  loadingText?: string;
}

export function Button({
  variant = "primary",
  loading = false,
  loadingText,
  className,
  children,
  type = "button",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, className)}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

interface ButtonLinkProps {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ href, variant = "primary", className, children }: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, className)}>
      {children}
    </Link>
  );
}
