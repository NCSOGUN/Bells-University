import type { ReactNode } from "react";
import { AlertTriangle, ArrowRight, ClipboardList, RotateCcw } from "lucide-react";
import {
  formatCountdown,
  formatShortDate,
  formatTime,
  nurseShortName,
} from "@/lib/format";
import type { Elder, Nurse, Visit } from "@/lib/mock-data";
import { followUpVisit, latestFlaggedVisit, visitNumber } from "@/lib/selectors";
import { parseBloodPressure } from "@/lib/vitals";
import { CareStatusChip } from "./care-status-chip";

interface ContinuityBriefingProps {
  elder: Elder;
  /** Completed visits, oldest first. */
  completed: Visit[];
  next?: Visit;
  nurses: Nurse[];
}

/**
 * What the nurse should walk in knowing: the last flag, what the follow-up
 * found, and what to check this time. Everything is derived from the visits.
 */
export function ContinuityBriefing({ elder, completed, next, nurses }: ContinuityBriefingProps) {
  const flagged = latestFlaggedVisit(completed);
  const recheck = flagged && followUpVisit(completed, flagged.id);
  const last = completed.at(-1);
  const nurseName = (visit: Visit) => {
    const nurse = nurses.find((n) => n.id === visit.nurseId);
    return nurse ? nurseShortName(nurse.name) : "The nurse";
  };

  return (
    <section
      aria-labelledby="briefing-heading"
      className="overflow-hidden rounded-3xl bg-surface shadow-float"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-navy px-5 py-4 sm:px-6">
        <h2 id="briefing-heading" className="text-h2 font-semibold text-white">
          Before your next visit
        </h2>
        {next && (
          <p className="text-small font-medium text-white">
            {formatShortDate(next.scheduledAt)}, {formatTime(next.scheduledAt)} ·{" "}
            {formatCountdown(next.scheduledAt)}
          </p>
        )}
      </header>

      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-2">
          <CareStatusChip status={elder.careStatus} />
          <p className="min-w-0 flex-1 basis-60 font-medium text-navy">{elder.careStatusMessage}</p>
        </div>

        {!last ? (
          <Step icon={ClipboardList} tone="current" title="First visit">
            <p>No visits recorded yet. The family asked for: {elder.careNeeds}</p>
          </Step>
        ) : (
          <ol className="grid gap-3 md:grid-cols-3" aria-label="Carried forward from earlier visits">
            {flagged ? (
              <>
                <li>
                  <Step
                    icon={AlertTriangle}
                    tone="flagged"
                    title={`Flagged · visit ${visitNumber(completed, flagged.id)}, ${formatShortDate(flagged.scheduledAt)}`}
                  >
                    <Reading visit={flagged} />
                    {flagged.flagReason && <p className="font-medium text-navy">{flagged.flagReason}</p>}
                    {flagged.nurseNotes && <Note by={nurseName(flagged)}>{flagged.nurseNotes}</Note>}
                  </Step>
                </li>
                <li>
                  {recheck ? (
                    <Step
                      icon={RotateCcw}
                      tone="followUp"
                      title={`Followed up · visit ${visitNumber(completed, recheck.id)}, ${formatShortDate(recheck.scheduledAt)}`}
                    >
                      <Reading visit={recheck} />
                      <BpComparison flagged={flagged} recheck={recheck} completed={completed} />
                      {recheck.nurseNotes && <Note by={nurseName(recheck)}>{recheck.nurseNotes}</Note>}
                    </Step>
                  ) : (
                    <Step icon={RotateCcw} tone="current" title="Not rechecked yet">
                      <p>This flag hasn&apos;t been followed up. Recheck it at this visit.</p>
                    </Step>
                  )}
                </li>
              </>
            ) : (
              <li className="md:col-span-2">
                <Step
                  icon={ClipboardList}
                  tone="followUp"
                  title={`Last visit · ${formatShortDate(last.scheduledAt)}`}
                >
                  <Reading visit={last} />
                  {last.nurseNotes && <Note by={nurseName(last)}>{last.nurseNotes}</Note>}
                </Step>
              </li>
            )}
            <li>
              <Step icon={ArrowRight} tone="current" title="At this visit">
                <ul className="list-disc space-y-1 pl-5">
                  {flagged?.vitals && (
                    <li>
                      Recheck blood pressure against {flagged.vitals.bloodPressure} mmHg (flagged)
                      {recheck?.vitals && ` and ${recheck.vitals.bloodPressure} mmHg (follow-up)`}
                    </li>
                  )}
                  {elder.medications.map((m) => (
                    <li key={m}>Confirm {m}</li>
                  ))}
                  {last.mobilityNote && <li>Last time: {last.mobilityNote}</li>}
                  {last.wellbeingNote && <li>Last time: {last.wellbeingNote}</li>}
                </ul>
              </Step>
            </li>
          </ol>
        )}
      </div>
    </section>
  );
}

type StepTone = "flagged" | "followUp" | "current";

const STEP_STYLES: Record<StepTone, { box: string; icon: string }> = {
  flagged: { box: "border-coral bg-coral/10", icon: "bg-coral text-navy" },
  followUp: { box: "border-teal bg-teal-tint", icon: "bg-teal text-navy" },
  current: { box: "border-navy bg-surface", icon: "bg-navy text-white" },
};

function Step({
  icon: Icon,
  tone,
  title,
  children,
}: {
  icon: typeof AlertTriangle;
  tone: StepTone;
  title: string;
  children: ReactNode;
}) {
  const styles = STEP_STYLES[tone];
  return (
    <div className={`h-full rounded-2xl border-2 p-4 ${styles.box}`}>
      <h3 className="flex items-center gap-2 font-sans text-small font-semibold text-navy">
        <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full ${styles.icon}`}>
          <Icon className="size-4" strokeWidth={2.5} />
        </span>
        {title}
      </h3>
      <div className="mt-3 space-y-2 text-small">{children}</div>
    </div>
  );
}

function Reading({ visit }: { visit: Visit }) {
  if (!visit.vitals) return null;
  return (
    <p className="text-navy">
      <span className="font-display text-h1 font-bold tabular-nums">{visit.vitals.bloodPressure}</span>{" "}
      <span className="text-small">mmHg · pulse {visit.vitals.pulse} bpm</span>
    </p>
  );
}

function Note({ by, children }: { by: string; children: ReactNode }) {
  return (
    <blockquote className="border-l-2 border-navy/30 pl-3">
      <p className="text-navy">&ldquo;{children}&rdquo;</p>
      <footer className="mt-1">{by}</footer>
    </blockquote>
  );
}

/** "Down 14/6 mmHg · still above the usual 128/82–132/84" */
function BpComparison({ flagged, recheck, completed }: { flagged: Visit; recheck: Visit; completed: Visit[] }) {
  const before = flagged.vitals && parseBloodPressure(flagged.vitals.bloodPressure);
  const after = recheck.vitals && parseBloodPressure(recheck.vitals.bloodPressure);
  if (!before || !after) return null;

  const usual = completed
    .slice(0, completed.indexOf(flagged))
    .filter((v) => !v.flagged)
    .flatMap(({ vitals }) => {
      const bp = vitals && parseBloodPressure(vitals.bloodPressure);
      return vitals && bp ? [{ ...bp, label: vitals.bloodPressure }] : [];
    })
    .sort((a, b) => a.systolic - b.systolic);

  const dSys = before.systolic - after.systolic;
  const dDia = before.diastolic - after.diastolic;
  const change =
    dSys === 0 && dDia === 0
      ? "No change"
      : dSys >= 0
        ? `Down ${dSys}/${dDia} mmHg`
        : `Up ${-dSys}/${-dDia} mmHg`;

  let versusUsual = "";
  if (usual.length > 0) {
    const low = usual[0];
    const high = usual[usual.length - 1];
    versusUsual =
      after.systolic > high.systolic || after.diastolic > high.diastolic
        ? `still above the usual ${low.label}–${high.label}`
        : `back within the usual ${low.label}–${high.label}`;
  }

  return (
    <p className="font-medium text-navy">
      {change} since the flag{versusUsual && ` · ${versusUsual}`}
    </p>
  );
}
