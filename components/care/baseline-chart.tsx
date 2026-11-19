import { THRESHOLDS, type Baseline, type Reading } from "@/lib/care-check";

// Hand-built on purpose (spec: no chart library), in the same style as
// BpTrendChart. Shows the top number from the last few visits, the band the
// rules treat as "their usual", the fixed 140 line, and today's reading, so the
// nurse can see why today was or wasn't flagged. Every number comes from
// THRESHOLDS, so the picture can never disagree with the rules.
const HEIGHT = 240;
const PAD_TOP = 28;
const PAD_BOTTOM = 36;
const X_START = 13; // %, clears the axis labels
const X_HISTORY_END = 72; // %
const X_TODAY = 90; // %
const MAX_VISITS_SHOWN = 6;

interface BaselineChartProps {
  /** Earlier completed readings, oldest first. */
  history: Reading[];
  baseline: Baseline;
  today: { systolic: number; diastolic: number };
  /** First name, for the caption. */
  who: string;
}

export function BaselineChart({ history, baseline, today, who }: BaselineChartProps) {
  const T = THRESHOLDS;
  const shown = history.slice(-MAX_VISITS_SHOWN);
  const flagLine = baseline.systolic + T.bpRiseFromUsual.systolic; // at or above: flagged
  const lowLine = baseline.systolic - T.bpDropFromUsual.systolic; // at or below: flagged
  const fixedLine = T.bpHigh.systolic;

  const ds = today.systolic - baseline.systolic;
  const dd = today.diastolic - baseline.diastolic;
  const outsideUsual =
    ds >= T.bpRiseFromUsual.systolic || dd >= T.bpRiseFromUsual.diastolic || -ds >= T.bpDropFromUsual.systolic;
  const overFixedLimit = today.systolic >= fixedLine || today.diastolic >= T.bpHigh.diastolic;
  // Today's dot is a warning colour if either check flags it: inside a high usual is not "fine".
  const flaggedToday = outsideUsual || overFixedLimit;

  // Keep the vertical scale tight so a few mmHg stay visible. The lower edge of
  // the band only sets the scale when today's reading is down near it.
  const nearLow = today.systolic < baseline.systolic - 8;
  const values = [...shown.map((r) => r.systolic), today.systolic, flagLine, fixedLine, ...(nearLow ? [lowLine] : [])];
  const min = Math.floor((Math.min(...values) - 6) / 10) * 10;
  const max = Math.ceil((Math.max(...values) + 8) / 10) * 10;
  const bandBottom = Math.max(lowLine, min);
  const y = (v: number) => PAD_TOP + ((max - v) / (max - min)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  const x = (i: number) => X_START + (shown.length <= 1 ? 0 : (i / (shown.length - 1)) * (X_HISTORY_END - X_START));

  const ticks = [...new Set([...(lowLine >= min ? [lowLine] : []), flagLine, fixedLine])].sort((a, b) => b - a);

  const summary = outsideUsual
    ? `Today's top number, ${today.systolic}, is outside ${who}'s usual range of ${lowLine + 1} to ${flagLine - 1}.`
    : `Today's top number, ${today.systolic}, is inside ${who}'s usual range of ${lowLine + 1} to ${flagLine - 1}.`;

  return (
    <figure className="rounded-xl bg-bg p-3">
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-small">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-3 w-5 rounded-sm bg-teal-tint ring-1 ring-teal" /> {who}&apos;s usual range
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-5 border-t-2 border-dashed border-ink" /> Fixed limit ({fixedLine})
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className={`size-3 rounded-full ${flaggedToday ? "bg-coral" : "bg-teal"}`} /> Today
        </span>
      </div>

      <svg role="img" aria-labelledby="baseline-title baseline-desc" width="100%" height={HEIGHT} className="block overflow-visible">
        <title id="baseline-title">{`Today's top blood pressure number against ${who}'s usual range`}</title>
        <desc id="baseline-desc">{`${summary} The fixed limit is ${fixedLine}${overFixedLimit ? ", and today's reading is at or above it" : ""}.`}</desc>

        {/* The band the rules treat as "usual": inside it nothing is flagged on the top number. */}
        <rect x="0" width="100%" y={y(flagLine)} height={Math.max(0, y(bandBottom) - y(flagLine))} className="fill-teal-tint" />
        <line x1="0" x2="100%" y1={y(flagLine)} y2={y(flagLine)} className="stroke-teal" strokeWidth={1.5} />
        {lowLine >= min && (
          <line x1="0" x2="100%" y1={y(lowLine)} y2={y(lowLine)} className="stroke-teal" strokeWidth={1.5} />
        )}

        {/* The fixed, textbook line that ignores who the person is. */}
        <line
          x1="0"
          x2="100%"
          y1={y(fixedLine)}
          y2={y(fixedLine)}
          className="stroke-ink"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />

        {ticks.map((t) => (
          <text key={t} x="0" y={y(t) - 4} className="fill-ink text-[11px] tabular-nums">
            {t}
          </text>
        ))}

        {shown.slice(1).map((r, i) => (
          <line
            key={r.recordedAt}
            x1={`${x(i)}%`}
            x2={`${x(i + 1)}%`}
            y1={y(shown[i].systolic)}
            y2={y(r.systolic)}
            className="stroke-navy"
            strokeWidth={2.5}
          />
        ))}
        {shown.length > 0 && (
          <line
            x1={`${x(shown.length - 1)}%`}
            x2={`${X_TODAY}%`}
            y1={y(shown[shown.length - 1].systolic)}
            y2={y(today.systolic)}
            className="stroke-ink"
            strokeWidth={2}
            strokeDasharray="3 4"
          />
        )}

        {shown.map((r, i) => (
          <svg key={r.recordedAt} x={`${x(i)}%`} y={0} overflow="visible">
            <circle cy={y(r.systolic)} r={4.5} className="fill-navy stroke-surface" strokeWidth={2} />
            <text y={y(r.systolic) + 18} textAnchor="middle" className="fill-ink text-[11px] tabular-nums max-sm:hidden">
              {r.systolic}
            </text>
          </svg>
        ))}

        <svg x={`${X_TODAY}%`} y={0} overflow="visible">
          <circle
            cy={y(today.systolic)}
            r={8}
            className={flaggedToday ? "fill-coral stroke-surface" : "fill-teal stroke-surface"}
            strokeWidth={2}
          />
          <text y={y(today.systolic) - 16} textAnchor="middle" className="fill-navy text-[12px] font-bold tabular-nums">
            {today.systolic}
          </text>
        </svg>

        <text x={`${(X_START + X_HISTORY_END) / 2}%`} y={HEIGHT - 10} textAnchor="middle" className="fill-ink text-[11px]">
          Last {shown.length} visits, top number
        </text>
        <text x={`${X_TODAY}%`} y={HEIGHT - 10} textAnchor="middle" className="fill-ink text-[11px]">
          Today
        </text>
      </svg>

      <figcaption className="mt-2 text-small text-navy">
        {outsideUsual ? (
          <>
            Today&apos;s {today.systolic}/{today.diastolic} is{" "}
            {ds >= 0 ? `${ds} above` : `${-ds} below`} {who}&apos;s usual {baseline.systolic}/{baseline.diastolic}.{" "}
            {overFixedLimit
              ? `It is also at or above the fixed ${fixedLine}/${T.bpHigh.diastolic} limit.`
              : `It is under the fixed ${fixedLine}/${T.bpHigh.diastolic} limit, so a fixed limit alone would not have flagged it.`}
          </>
        ) : (
          <>
            Today&apos;s {today.systolic}/{today.diastolic} is within {who}&apos;s usual range, around {baseline.systolic}/
            {baseline.diastolic}.
            {overFixedLimit &&
              ` It is still at or above the fixed ${fixedLine}/${T.bpHigh.diastolic} limit, so it is flagged: being normal for ${who} doesn't make it safe.`}
          </>
        )}
      </figcaption>
    </figure>
  );
}
