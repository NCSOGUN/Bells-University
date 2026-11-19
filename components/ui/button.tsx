import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "ghost";

// Primary is the screen's one filled action. White on the deep teal passes 4.5:1.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-teal-deep text-white hover:bg-teal-deeper disabled:bg-line disabled:text-ink",
  secondary: "bg-surface text-navy shadow-card hover:bg-bg disabled:text-muted",
  ghost: "text-teal-deep underline decoration-transparent underline-offset-4 hover:decoration-teal-deep",
};

const BASE =
  "inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-6 font-semibold transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100";

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
