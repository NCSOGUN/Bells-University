import { useId, type ReactNode } from "react";

export const INPUT_CLASSES =
  "block min-h-12 w-full rounded-xl border border-muted bg-surface px-4 text-body text-navy placeholder:text-muted transition-colors duration-150 focus-visible:border-teal aria-invalid:border-coral";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  /** Receives the ids to wire onto the control. */
  children: (control: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Label above, hint and error below, all linked to the control. */
export function Field({ label, hint, error, className = "", children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={className}>
      <label htmlFor={id} className="block font-semibold text-navy">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="mt-0.5 text-small">
          {hint}
        </p>
      )}
      <div className="mt-2">{children({ id, describedBy, invalid: Boolean(error) })}</div>
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-2 border-l-4 border-coral pl-2 text-small font-medium text-navy">
      {children}
    </p>
  );
}
