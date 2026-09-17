import type { Nurse, Visit, Vitals } from "@/lib/mock-data";
import { formatShortDate, formatTime, nurseShortName } from "@/lib/format";
import { presentVitalFields } from "@/lib/vitals";
import { VisitOutcomeChip } from "./visit-outcome";

interface VitalsTableProps {
  /** Completed visits, oldest first. */
  completed: Visit[];
  nurses: Nurse[];
}

export function VitalsTable({ completed, nurses }: VitalsTableProps) {
  const withVitals = completed.filter((v): v is Visit & { vitals: Vitals } => Boolean(v.vitals));
  if (withVitals.length === 0) {
    return <p>Readings from each visit will be listed here.</p>;
  }
  const fields = presentVitalFields(withVitals.map((v) => v.vitals));

  return (
    // Scrolls inside its own box on phones so the page never scrolls sideways.
    <div
      className="-mx-5 overflow-x-auto sm:mx-0"
      role="region"
      aria-label="Readings from every visit"
      tabIndex={0}
    >
      <table className="w-full min-w-[640px] border-collapse text-left text-small">
        <thead>
          <tr className="border-b border-line text-navy">
            <th scope="col" className="px-5 py-3 font-semibold sm:pl-0">
              Visit
            </th>
            {fields.map((f) => (
              <th key={f.key} scope="col" className="px-3 py-3 font-semibold">
                {f.label} <span className="font-normal">({f.unit})</span>
              </th>
            ))}
            <th scope="col" className="px-3 py-3 font-semibold">
              Recorded by
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Outcome
            </th>
          </tr>
        </thead>
        <tbody>
          {withVitals.map((visit) => {
            const nurse = nurses.find((n) => n.id === visit.nurseId);
            return (
              <tr
                key={visit.id}
                className={`border-b border-line ${visit.flagged ? "bg-coral/10" : ""}`}
              >
                <th
                  scope="row"
                  className={`whitespace-nowrap px-5 py-3 font-semibold text-navy sm:pl-3 ${
                    visit.flagged ? "border-l-4 border-coral" : "border-l-4 border-transparent"
                  }`}
                >
                  {completed.indexOf(visit) + 1} · {formatShortDate(visit.scheduledAt)}
                </th>
                {fields.map((f) => (
                  <td
                    key={f.key}
                    className={`px-3 py-3 tabular-nums ${
                      visit.flagged && f.key === "bloodPressure" ? "font-bold text-navy" : ""
                    }`}
                  >
                    {f.format(visit.vitals) ?? "—"}
                  </td>
                ))}
                <td className="whitespace-nowrap px-3 py-3">
                  {nurse ? nurseShortName(nurse.name) : "—"}
                  {visit.checkOutAt && <span className="block">{formatTime(visit.checkOutAt)}</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <VisitOutcomeChip completed={completed} visit={visit} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
