"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import {
  DAY_PARTS,
  NURSE_SPECIALIZATIONS,
  TRAVEL_LIMITS,
  WEEKDAYS,
  patchNurseOnboarding,
  type AvailabilitySlot,
  type NurseProfileDraft,
} from "@/lib/nurse-onboarding";
import { routes } from "@/lib/routes";
import { findNurse } from "@/lib/selectors";
import { DEMO_NURSE_ID } from "@/lib/mock-data";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, FieldError, INPUT_CLASSES } from "@/components/ui/field";
import { JoinShell } from "./join-shell";

export function NurseProfileStep() {
  const { state } = useDemo();
  const approved = state.nurseOnboarding.status === "approved";
  return (
    <JoinShell
      step="Profile"
      back={{ href: routes.nursePending, label: "Your application" }}
      title="Set up your profile"
      description="This decides which clients we match you with."
    >
      {approved ? (
        <ProfileForm />
      ) : (
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          <p className="text-navy">Your profile opens once your documents have been approved.</p>
          <ButtonLink href={routes.nursePending} className="w-full">
            Check your application
          </ButtonLink>
        </div>
      )}
    </JoinShell>
  );
}

type Errors = Partial<Record<"specializations" | "area" | "availability", string>>;

function ProfileForm() {
  const { state, update } = useDemo();
  const router = useRouter();
  const saved = state.nurseOnboarding.profile;
  const city = state.nurseOnboarding.applicant?.city;
  const [specializations, setSpecializations] = useState<string[]>(saved?.specializations ?? []);
  const [area, setArea] = useState(saved?.area ?? "");
  const [maxTravel, setMaxTravel] = useState<NurseProfileDraft["maxTravelMinutes"]>(saved?.maxTravelMinutes ?? 30);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>(saved?.availability ?? []);
  const [errors, setErrors] = useState<Errors>({});
  // The demo's working dashboard belongs to the seeded nurse; say so up front.
  const demoNurse = findNurse(state, DEMO_NURSE_ID);

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: Errors = {
      specializations: specializations.length ? undefined : "Choose at least one kind of care.",
      area: area.trim() ? undefined : "Tell us which areas you can reach.",
      availability: availability.length ? undefined : "Choose at least one time you can work.",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[data-invalid='true']")?.focus());
      return;
    }
    update((prev) =>
      patchNurseOnboarding(prev, {
        profile: { specializations, area: area.trim(), maxTravelMinutes: maxTravel, availability },
        completedAt: new Date().toISOString(),
      }),
    );
    router.push(routes.nurseDashboard);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <fieldset
        tabIndex={-1}
        data-invalid={Boolean(errors.specializations)}
        aria-describedby={errors.specializations ? "spec-error" : undefined}
      >
        <legend className="font-semibold text-navy">Kinds of care you provide</legend>
        <p className="text-small">Choose all that apply.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {NURSE_SPECIALIZATIONS.map((s) => {
            const checked = specializations.includes(s);
            return (
              <label
                key={s}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-small font-semibold text-navy transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal ${
                  checked ? "border-teal bg-teal-tint" : "border-muted bg-surface hover:border-navy"
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => setSpecializations((list) => toggle(list, s))}
                  className="sr-only"
                />
                {checked && <Check aria-hidden className="size-4" strokeWidth={3} />}
                {s}
              </label>
            );
          })}
        </div>
        {errors.specializations && <FieldError id="spec-error">{errors.specializations}</FieldError>}
      </fieldset>

      <Field
        label={`Areas you can reach${city ? ` in ${city}` : ""}`}
        hint="Neighbourhoods or landmarks, e.g. Tanke, Fate, GRA."
        error={errors.area}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            data-invalid={invalid}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={INPUT_CLASSES}
          />
        )}
      </Field>

      <fieldset>
        <legend className="font-semibold text-navy">Longest trip to a client</legend>
        <div className="mt-2 inline-flex flex-wrap gap-2">
          {TRAVEL_LIMITS.map((m) => (
            <label
              key={m}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 font-semibold text-navy transition-colors duration-150 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-teal ${
                maxTravel === m ? "border-teal bg-teal-tint" : "border-muted bg-surface hover:border-navy"
              }`}
            >
              <input
                type="radio"
                name="max-travel"
                checked={maxTravel === m}
                onChange={() => setMaxTravel(m)}
                className="sr-only"
              />
              {m} min
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset
        tabIndex={-1}
        data-invalid={Boolean(errors.availability)}
        aria-describedby={errors.availability ? "avail-error" : undefined}
      >
        <legend className="font-semibold text-navy">When you&apos;re free each week</legend>
        <p className="text-small">Tap the times you can usually take visits.</p>
        <div className="mt-3 overflow-x-auto" role="region" aria-label="Weekly availability" tabIndex={0}>
          <table className="w-full min-w-[20rem] border-separate border-spacing-1 text-small">
            <thead>
              <tr>
                <th scope="col" className="sr-only">
                  Time of day
                </th>
                {WEEKDAYS.map((d) => (
                  <th key={d} scope="col" className="font-semibold text-navy">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_PARTS.map((part) => (
                <tr key={part}>
                  <th scope="row" className="pr-1 text-left font-semibold whitespace-nowrap text-navy">
                    {part}
                  </th>
                  {WEEKDAYS.map((day) => {
                    const slot: AvailabilitySlot = `${day}-${part}`;
                    const on = availability.includes(slot);
                    return (
                      <td key={slot} className="p-0">
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${day} ${part.toLowerCase()}`}
                          onClick={() => setAvailability((list) => toggle(list, slot))}
                          className={`grid h-11 w-full min-w-9 place-items-center rounded-lg border transition-colors duration-150 ${
                            on ? "border-teal bg-teal text-navy" : "border-muted bg-surface text-transparent hover:border-navy"
                          }`}
                        >
                          <Check aria-hidden className="size-4" strokeWidth={3} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.availability && <FieldError id="avail-error">{errors.availability}</FieldError>}
      </fieldset>

      <div className="space-y-2">
        <Button type="submit" className="w-full">
          Finish and go to your dashboard
        </Button>
        {demoNurse && (
          <p className="text-center text-small">
            In this demo, your dashboard opens as {demoNurse.name}, a few weeks in, so you can see a working day.
          </p>
        )}
      </div>
    </form>
  );
}
