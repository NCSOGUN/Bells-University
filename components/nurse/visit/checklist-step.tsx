"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, FlaskConical, MapPin, MapPinOff, Save } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { formatTime } from "@/lib/format";
import { routes } from "@/lib/routes";
import { completedVisits, visitsForElder } from "@/lib/selectors";
import {
  saveReportDraft,
  setOffline,
  validateReport,
  type ReportErrors,
  type VisitReportDraft,
} from "@/lib/visit-flow";
import { ADHERENCE_LABEL } from "@/lib/vitals";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldError, INPUT_CLASSES } from "@/components/ui/field";
import { VisitFrame, type VisitContext } from "./visit-frame";

export function ChecklistStep({ visitId }: { visitId: string }) {
  return (
    <VisitFrame visitId={visitId} step="Checklist">
      {(ctx) => <Checklist {...ctx} />}
    </VisitFrame>
  );
}

function Checklist({ state, visit, elder, workflow }: VisitContext) {
  const { update } = useDemo();
  const router = useRouter();
  const [errors, setErrors] = useState<ReportErrors>({});

  if (visit.status === "scheduled") {
    return (
      <Card title="Check in first">
        <p>Confirm your location and start the visit before filling in the checklist.</p>
        <ButtonLink href={routes.nurseVisitStart(visit.id)} className="mt-4 w-full">
          Go to check-in
        </ButtonLink>
      </Card>
    );
  }
  if (visit.status === "complete" || !workflow) {
    return (
      <Card title="This visit is complete">
        <p>The report has been submitted.</p>
        <ButtonLink href={routes.nurseVisitComplete(visit.id)} className="mt-4 w-full">
          See the visit summary
        </ButtonLink>
      </Card>
    );
  }

  const { report, offline, savedAt, checkInGps } = workflow;
  const previous = completedVisits(visitsForElder(state, elder.id)).at(-1);

  // Every change is written to demo state (and localStorage) straight away.
  const set = (patch: Partial<VisitReportDraft>) => {
    update((prev) => saveReportDraft(prev, visit.id, patch));
    setErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch) as (keyof VisitReportDraft)[]) delete next[key];
      if ("systolic" in patch || "diastolic" in patch) delete next.bloodPressure;
      return next;
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (offline) return;
    const found = validateReport(report);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid='true'], [data-invalid='true']")?.focus());
      return;
    }
    router.push(routes.nurseVisitComplete(visit.id));
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-line bg-surface px-4 py-3 text-small">
        <p className="flex items-center gap-1.5 text-navy">
          {checkInGps === "confirmed" ? (
            <MapPin aria-hidden className="size-4" />
          ) : (
            <MapPinOff aria-hidden className="size-4" />
          )}
          Checked in {visit.checkInAt ? `at ${formatTime(visit.checkInAt)}` : ""}
          {checkInGps === "confirmed" ? " · GPS confirmed" : " · no GPS signal, recorded"}
        </p>
        <p className="flex items-center gap-1.5 text-navy">
          <Save aria-hidden className="size-4" />
          {savedAt ? (
            // Re-keyed on each save so the brief highlight replays (§4.3).
            <span key={savedAt} aria-hidden className="rounded px-1 motion-safe:animate-highlight" data-testid="draft-status">
              Draft saved at {formatTime(savedAt)}
            </span>
          ) : (
            <span data-testid="draft-status">Your answers save as you type</span>
          )}
          {/* Only announces when the saved time changes, not on every keystroke. */}
          <span role="status" className="sr-only">
            {savedAt ? `Draft saved at ${formatTime(savedAt)}` : ""}
          </span>
        </p>
      </div>

      {offline && (
        <p role="status" className="flex items-start gap-3 rounded-2xl border-2 border-amber bg-amber/10 p-4 font-semibold text-navy">
          <CloudOff aria-hidden className="mt-0.5 size-5 shrink-0" />
          Offline Mode — Data cached safely. Automatic upload active on exit.
        </p>
      )}

      <form onSubmit={submit} noValidate className="space-y-6">
        <Section title="Vital signs">
          <fieldset aria-describedby={errors.bloodPressure ? "bp-error" : "bp-hint"}>
            <legend className="font-semibold text-navy">Blood pressure</legend>
            <p id="bp-hint" className="text-small">
              In mmHg.
              {previous?.vitals && ` Last visit: ${previous.vitals.bloodPressure}.`}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <UnitInput
                label="Systolic (top number)"
                value={report.systolic}
                onChange={(v) => set({ systolic: v })}
                invalid={Boolean(errors.bloodPressure)}
                placeholder="128"
              />
              <span aria-hidden className="text-h2 text-navy">
                /
              </span>
              <UnitInput
                label="Diastolic (bottom number)"
                value={report.diastolic}
                onChange={(v) => set({ diastolic: v })}
                invalid={Boolean(errors.bloodPressure)}
                placeholder="82"
                unit="mmHg"
              />
            </div>
            {errors.bloodPressure && <FieldError id="bp-error">{errors.bloodPressure}</FieldError>}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Pulse" error={errors.pulse}>
              {({ id, describedBy, invalid }) => (
                <UnitInput id={id} value={report.pulse} onChange={(v) => set({ pulse: v })} unit="bpm" invalid={invalid} describedBy={describedBy} />
              )}
            </Field>
            <Field label="Temperature" error={errors.temperature}>
              {({ id, describedBy, invalid }) => (
                <UnitInput id={id} value={report.temperature} onChange={(v) => set({ temperature: v })} unit="°C" decimal invalid={invalid} describedBy={describedBy} />
              )}
            </Field>
            <Field label="Weight" error={errors.weight}>
              {({ id, describedBy, invalid }) => (
                <UnitInput id={id} value={report.weight} onChange={(v) => set({ weight: v })} unit="kg" decimal invalid={invalid} describedBy={describedBy} />
              )}
            </Field>
          </div>
        </Section>

        <Section title="Medication">
          <fieldset aria-describedby={errors.medicationAdherence ? "med-error" : undefined}>
            <legend className="font-semibold text-navy">Were today&apos;s medicines taken?</legend>
            <p className="text-small">{elder.medications.join("; ")}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(Object.keys(ADHERENCE_LABEL) as (keyof typeof ADHERENCE_LABEL)[]).map((key) => (
                <label
                  key={key}
                  className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 text-navy transition-colors duration-150 ${
                    report.medicationAdherence === key ? "border-teal bg-teal-tint" : "border-muted bg-surface hover:border-navy"
                  }`}
                >
                  <input
                    type="radio"
                    name="adherence"
                    checked={report.medicationAdherence === key}
                    onChange={() => set({ medicationAdherence: key })}
                    data-invalid={Boolean(errors.medicationAdherence) || undefined}
                    className="size-4 accent-teal"
                  />
                  {ADHERENCE_LABEL[key]}
                </label>
              ))}
            </div>
            {errors.medicationAdherence && <FieldError id="med-error">{errors.medicationAdherence}</FieldError>}
          </fieldset>
        </Section>

        <Section title="How they are">
          <NoteField label="Moving around" hint="Walking, balance, any falls or dizziness." value={report.mobilityNote} onChange={(v) => set({ mobilityNote: v })} />
          <NoteField label="Wellbeing" hint="Mood, sleep, appetite, anything they told you." value={report.wellbeingNote} onChange={(v) => set({ wellbeingNote: v })} />
          <NoteField
            label="Notes for the next visit"
            hint="What the next nurse, and the family, should know."
            value={report.nurseNotes}
            onChange={(v) => set({ nurseNotes: v })}
            rows={4}
          />
        </Section>

        <div className="space-y-2">
          <Button type="submit" disabled={offline} className="w-full" aria-describedby={offline ? "offline-submit" : undefined}>
            Check out &amp; submit report
          </Button>
          {offline && (
            <p id="offline-submit" className="text-center text-small text-navy">
              Your report is saved on this phone. It will send when you&apos;re back online.
            </p>
          )}
        </div>
      </form>

      <div className="rounded-2xl border-2 border-dashed border-muted bg-bg p-4">
        <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3">
          <span>
            <span className="flex items-center gap-2 text-small font-semibold text-navy">
              <FlaskConical aria-hidden className="size-4" />
              Demo control — simulate losing signal
            </span>
            <span className="block text-small">Keep typing while offline: nothing you enter is lost.</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={offline}
            onChange={(e) => update((prev) => setOffline(prev, visit.id, e.target.checked))}
            className="size-6 shrink-0 accent-teal"
          />
        </label>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-5 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-h2 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

interface UnitInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  decimal?: boolean;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
}

function UnitInput({ id, label, value, onChange, unit, decimal, invalid, describedBy, placeholder }: UnitInputProps) {
  return (
    <div className="relative flex-1">
      <input
        id={id}
        aria-label={label}
        type="text"
        inputMode={decimal ? "decimal" : "numeric"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(decimal ? /[^\d.]/g : /\D/g, ""))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${INPUT_CLASSES} tabular-nums ${unit ? "pr-16" : ""}`}
      />
      {unit && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-small text-ink">
          {unit}
        </span>
      )}
    </div>
  );
}

function NoteField({
  label,
  hint,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label} hint={hint}>
      {({ id, describedBy }) => (
        <textarea
          id={id}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={describedBy}
          className={`${INPUT_CLASSES} py-3`}
        />
      )}
    </Field>
  );
}
