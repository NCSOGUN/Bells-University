import type { Vitals } from "@/lib/mock-data";
import { VITAL_FIELDS } from "@/lib/vitals";

interface VitalsGridProps {
  vitals: Vitals;
  /** Draw the blood pressure tile with the risk treatment. */
  flagged?: boolean;
}

export function VitalsGrid({ vitals, flagged = false }: VitalsGridProps) {
  const fields = VITAL_FIELDS.filter((f) => f.format(vitals) !== undefined);

  return (
    <dl className="grid grid-cols-2 gap-3">
      {fields.map((field) => {
        const highlight = flagged && field.key === "bloodPressure";
        return (
          <div
            key={field.key}
            className={`rounded-xl border p-3 ${highlight ? "border-coral bg-coral/10" : "border-line bg-bg"}`}
          >
            <dt className="text-small">{field.label}</dt>
            <dd className="mt-1 text-navy">
              <span className="font-display text-h2 font-semibold tabular-nums">
                {field.format(vitals)}
              </span>{" "}
              <span className="text-small">{field.unit}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
