import { FieldError } from "@/components/ui/field";

interface ConsentBlockProps {
  who: string;
  sharing: boolean;
  onSharing: (value: boolean) => void;
  personalised: boolean;
  onPersonalised: (value: boolean) => void;
  error?: string;
}

/**
 * The consent step on "Who are we caring for?". One required agreement and one
 * optional choice, both unticked to start. The elder's own yes comes later, in
 * person, from the nurse.
 */
export function ConsentBlock({ who, sharing, onSharing, personalised, onPersonalised, error }: ConsentBlockProps) {
  return (
    <section aria-labelledby="consent-heading" className="space-y-4 rounded-2xl border-2 border-navy bg-surface p-5">
      <div>
        <h2 id="consent-heading" className="text-h2 font-semibold">
          Before we continue
        </h2>
        <p className="mt-1 text-navy">
          At each visit the nurse records {who}&apos;s blood pressure, pulse, temperature, weight and medicines. Only their
          nurse and your care circle can see it.
        </p>
      </div>

      <label
        className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 text-navy ${
          sharing ? "border-teal bg-teal-tint" : error ? "border-coral" : "border-muted hover:border-navy"
        }`}
      >
        <input
          type="checkbox"
          checked={sharing}
          onChange={(e) => onSharing(e.target.checked)}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? "consent-error" : undefined}
          className="mt-1 size-5 shrink-0 accent-teal"
        />
        <span>
          <span className="font-semibold">Share {who}&apos;s readings with their nurse and our care circle.</span>{" "}
          <span className="text-small">
            I&apos;m acting for {who} with their knowledge. Their nurse will also ask them in person.
          </span>
        </span>
      </label>
      {error && <FieldError id="consent-error">{error}</FieldError>}

      <label
        className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border p-3 text-navy ${
          personalised ? "border-teal bg-teal-tint" : "border-muted hover:border-navy"
        }`}
      >
        <input
          type="checkbox"
          checked={personalised}
          onChange={(e) => onPersonalised(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-teal"
        />
        <span>
          <span className="font-semibold">
            Optional: compare {who}&apos;s readings with their own earlier visits.
          </span>{" "}
          <span className="text-small">
            This helps us spot when a reading is unusual for {who}. If you leave it off, we only use general limits. You can
            change this any time.
          </span>
        </span>
      </label>
    </section>
  );
}
