import type { ReactNode } from "react";

interface ButtonLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
}

/** The screen's single primary action (§4.5). Navy text keeps contrast on teal. */
export function PrimaryButtonLink({ href, children, className = "" }: ButtonLinkProps) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal px-5 font-semibold text-navy transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-teal-light ${className}`}
    >
      {children}
    </a>
  );
}
