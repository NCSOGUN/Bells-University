import type { Visit } from "@/lib/mock-data";
import { formatDayMonthParts, formatShortDate } from "@/lib/format";
import { followedUpVisit, followUpVisit } from "@/lib/selectors";
import { parseBloodPressure } from "@/lib/vitals";

// Hand-built on purpose (spec: no chart library). X positions are percentages
// and Y positions are pixels, so the chart stretches to any width while text
// stays a readable, fixed size on phones.
const HEIGHT = 280;
const PAD_TOP = 64;
const PAD_BOTTOM = 48;
const X_START = 14; // % — clears the gridline labels
const X_END = 90; // %

interface Point {
  visit: Visit;
  systolic: number;
  diastolic: number;
  flagged: boolean;
  followUp: boolean;
}

interface BpTrendChartProps {
  /** Completed visits, oldest first. */
  completed: Visit[];
}

export function BpTrendChart({ completed }: BpTrendChartProps) {
  const points: Point[] = completed.flatMap((visit) => {
    const bp = visit.vitals && parseBloodPressure(visit.vitals.bloodPressure);
    if (!bp) return [];
    return [
      {
        visit,
        ...bp,
        flagged: visit.flagged,
        followUp: Boolean(followedUpVisit(completed, visit.id)),
      },
    ];
  });

  if (points.length < 2) {
    return (
      <p>A blood pressure trend will appear here once there are readings from two or more visits.</p>
    );
  }

  const min = Math.floor((Math.min(...points.map((p) => p.diastolic)) - 10) / 10) * 10;
  const max = Math.ceil((Math.max(...points.map((p) => p.systolic)) + 5) / 10) * 10;
  const ticks = Array.from({ length: Math.floor((max - min) / 20) + 1 }, (_, i) => min + i * 20);

  const x = (i: number) => X_START + (i / (points.length - 1)) * (X_END - X_START);
  const y = (value: number) => PAD_TOP + ((max - value) / (max - min)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const highest = points.reduce((a, b) => (b.systolic > a.systolic ? b : a));
  const latest = points[points.length - 1];
  const recheck = followUpVisit(completed, highest.visit.id);
  const summary =
    `Blood pressure across ${points.length} visits, from ${points[0].visit.vitals?.bloodPressure} ` +
    `to ${latest.visit.vitals?.bloodPressure} mmHg. Highest: ${highest.visit.vitals?.bloodPressure} ` +
    `on ${formatShortDate(highest.visit.scheduledAt)}${highest.flagged ? ", flagged" : ""}.`;

  return (
    <figure>
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-small">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 bg-navy" /> Top number (systolic)
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 border-t-2 border-dashed border-teal" /> Bottom
          number (diastolic)
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="size-3 rounded-full bg-coral" /> Flagged reading
        </span>
      </div>

      <svg
        role="img"
        aria-labelledby="bp-chart-title bp-chart-desc"
        width="100%"
        height={HEIGHT}
        className="block overflow-visible"
      >
        <title id="bp-chart-title">Blood pressure trend</title>
        <desc id="bp-chart-desc">{summary}</desc>

        {ticks.map((tick) => (
          <g key={tick}>
            <line x1="0" x2="100%" y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={1} />
            <text x="0" y={y(tick) - 5} className="fill-ink text-[11px]">
              {tick}
            </text>
          </g>
        ))}

        {points.slice(1).map((p, i) => (
          <g key={p.visit.id}>
            <line
              x1={`${x(i)}%`}
              x2={`${x(i + 1)}%`}
              y1={y(points[i].systolic)}
              y2={y(p.systolic)}
              className="stroke-navy"
              strokeWidth={2.5}
            />
            <line
              x1={`${x(i)}%`}
              x2={`${x(i + 1)}%`}
              y1={y(points[i].diastolic)}
              y2={y(p.diastolic)}
              className="stroke-teal"
              strokeWidth={2.5}
              strokeDasharray="6 4"
            />
          </g>
        ))}

        {points.map((p, i) => {
          const [day, month] = formatDayMonthParts(p.visit.scheduledAt);
          const top = y(p.systolic);
          // Phones only have room to label the readings that tell the story;
          // every value is also in the table below.
          const keyPoint = p.flagged || p.followUp || i === 0 || i === points.length - 1;
          const pillY = p.flagged ? top - 48 : top + 14;
          return (
            // Nested <svg> moves the origin to the point, so children can be offset in px.
            <svg key={p.visit.id} x={`${x(i)}%`} y={0} overflow="visible">
              <circle
                cy={top}
                r={p.flagged ? 7 : 4.5}
                className={p.flagged ? "fill-coral stroke-surface" : "fill-navy stroke-surface"}
                strokeWidth={2}
              />
              <circle
                cy={y(p.diastolic)}
                r={p.flagged ? 7 : 4.5}
                className={p.flagged ? "fill-coral stroke-surface" : "fill-teal stroke-surface"}
                strokeWidth={2}
              />
              <text
                y={top - 14}
                textAnchor="middle"
                className={`fill-navy text-[11px] tabular-nums ${p.flagged ? "font-bold" : "font-medium"} ${
                  keyPoint ? "" : "max-sm:hidden"
                }`}
              >
                {p.systolic}/{p.diastolic}
              </text>
              {(p.flagged || p.followUp) && (
                <g>
                  <rect
                    x={p.flagged ? -30 : -40}
                    y={pillY}
                    width={p.flagged ? 60 : 80}
                    height={20}
                    rx={10}
                    className={p.flagged ? "fill-coral/15 stroke-coral" : "fill-teal-tint stroke-teal"}
                  />
                  <text y={pillY + 14} textAnchor="middle" className="fill-navy text-[11px] font-semibold">
                    {p.flagged ? "Flagged" : "Followed up"}
                  </text>
                </g>
              )}
              <text y={HEIGHT - 26} textAnchor="middle" className="fill-ink text-[11px]">
                {day}
              </text>
              <text y={HEIGHT - 12} textAnchor="middle" className="fill-ink text-[11px]">
                {month}
              </text>
            </svg>
          );
        })}
      </svg>

      <figcaption className="mt-3 text-small">
        Readings in mmHg from each visit.{" "}
        {highest.flagged && (
          <>
            The highest, {highest.visit.vitals?.bloodPressure} on{" "}
            {formatShortDate(highest.visit.scheduledAt)}, was flagged
            {recheck?.vitals
              ? ` and rechecked on ${formatShortDate(recheck.scheduledAt)} at ${recheck.vitals.bloodPressure}.`
              : "."}
          </>
        )}
      </figcaption>
    </figure>
  );
}
