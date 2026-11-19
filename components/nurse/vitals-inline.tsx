import type { Vitals } from "@/lib/mock-data";
import { VITAL_FIELDS } from "@/lib/vitals";

interface VitalsInlineProps {
  vitals: Vitals;
  /** Give blood pressure the risk treatment. */
  flagged?: boolean;
}

/** A visit's readings on one wrapping line, each with its unit. */
export function VitalsInline({ vitals, flagged = false }: VitalsInlineProps) {
  const fields = VITAL_FIELDS.filter((f) => f.format(vitals) !== undefined);
  return (
    <dl className="flex flex-wrap gap-2">
      {fields.map((field) => {
        const highlight = flagged && field.key === "bloodPressure";
        return (
          <div
            key={field.key}
            className={`rounded-lg border px-2.5 py-1.5 ${
              highlight ? "border-coral bg-coral/10" : "border-line bg-bg"
            }`}
          >
            <dt className="text-label font-semibold text-ink">{field.label}</dt>
            <dd className={`tabular-nums text-navy ${highlight ? "font-bold" : "font-semibold"}`}>
              {field.format(vitals)} <span className="text-small font-normal text-ink">{field.unit}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
