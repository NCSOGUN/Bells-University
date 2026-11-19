import { FieldError } from "@/components/ui/field";

interface ConsentBlockProps {
  who: string;
  sharing: boolean;
  onSharing: (value: boolean) => void;
  error?: string;
}

/**
 * The consent step on "Who are we caring for?": a single agreement that says
 * plainly what is recorded, who sees it and how it is used. The elder's own
 * yes comes later, in person, from the nurse.
 */
export function ConsentBlock({ who, sharing, onSharing, error }: ConsentBlockProps) {
  return (
    <section aria-labelledby="consent-heading" className="space-y-4 rounded-2xl bg-surface shadow-float p-5">
      <div>
        <h2 id="consent-heading" className="text-h2 font-semibold">
          Before we continue
        </h2>
        <p className="mt-1 text-navy">
          At each visit the nurse records {who}&apos;s blood pressure, pulse, temperature, weight and medicines. Only their
          nurse and your care circle can see it. Share only what you&apos;re comfortable with here: the nurse will go through
          medical details with {who} in person.
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
          <span className="font-semibold">
            Share {who}&apos;s readings with their nurse and our care circle, and compare each reading with {who}&apos;s own
            earlier visits to spot changes.
          </span>{" "}
          <span className="text-small">
            I&apos;m acting for {who} with their knowledge, and their nurse will ask them in person too. You can change this
            any time under Privacy and consent.
          </span>
        </span>
      </label>
      {error && <FieldError id="consent-error">{error}</FieldError>}
    </section>
  );
}
