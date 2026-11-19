interface HealthFactsProps {
  /** The family's own words about what help is needed. */
  careNeeds: string;
  needsLabel?: string;
  conditions: string[];
  medications: string[];
}

/** What a person needs, what they live with and what they take, in one readable row. */
export function HealthFacts({ careNeeds, needsLabel = "Needs help with", conditions, medications }: HealthFactsProps) {
  const label = "text-label font-semibold text-ink";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
      <div>
        <h3 className={label}>{needsLabel}</h3>
        <p className="mt-2 text-navy">{careNeeds}</p>
      </div>
      <div>
        <h3 className={label}>Conditions</h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {conditions.map((c) => (
            <li key={c} className="rounded-full bg-teal-tint px-3 py-1 text-small font-medium text-navy">
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className={label}>Medication</h3>
        <ul className="mt-2 space-y-1 text-navy">
          {medications.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
