import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface TextLinkProps {
  href: string;
  children: ReactNode;
  /** "back" puts an arrow before the text, "forward" a chevron after it. */
  direction?: "back" | "forward";
  className?: string;
}

/** Secondary navigation: navy text with a teal underline, 44px tall for touch. */
export function TextLink({ href, children, direction = "forward", className = "" }: TextLinkProps) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-1 font-semibold text-teal-deep decoration-2 underline-offset-4 transition-colors duration-150 hover:underline ${className}`}
    >
      {direction === "back" && <ArrowLeft aria-hidden className="size-4 shrink-0" />}
      {children}
      {direction === "forward" && <ChevronRight aria-hidden className="size-4 shrink-0" />}
    </Link>
  );
}
