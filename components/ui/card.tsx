import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

export function Card({ title, description, id, className = "", children }: CardProps) {
  const headingId = id && title ? `${id}-title` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={`rounded-2xl bg-surface p-6 shadow-card ${className}`}
    >
      {title && (
        <header className="mb-4">
          <h2 id={headingId} className="text-h2 font-semibold tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-1 text-small">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
