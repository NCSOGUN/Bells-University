import type { ReactNode } from "react";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/** The screen's single primary action. White on the deep teal passes 4.5:1. */
export function PrimaryButtonLink({ href, children, className = "" }: ButtonLinkProps) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-teal-deep px-6 font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-teal-deeper active:scale-[0.98] ${className}`}
    >
      {children}
    </a>
  );
}
