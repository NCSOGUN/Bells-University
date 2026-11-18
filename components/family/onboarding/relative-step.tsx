"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MapPinOff, Mic } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import { firstName } from "@/lib/format";
import {
  REQUEST_CITIES,
  SERVICE_CITIES,
  formatPhone,
  isServiceCity,
  patchOnboarding,
  type RelativeDraft,
  type RequestCity,
} from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { useTimers } from "@/lib/use-timers";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, INPUT_CLASSES } from "@/components/ui/field";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";
import { ConsentBlock } from "./consent-block";
import { OnboardingShell } from "./onboarding-shell";

// §4.3: a beat while we "check" the area, rather than an instant swap.
const AREA_CHECK_MS = 400;

const MIN_AGE = 18;
const MAX_AGE = 120;

export function RelativeStep() {
  const { state } = useDemo();
  const relative = state.onboarding.relative;
  const [editing, setEditing] = useState(false);
  const waitlisted = Boolean(relative && !isServiceCity(relative.city) && !editing);

  return (
    <OnboardingShell
      step="relative"
      back={{ href: routes.familySignup, label: "Your details" }}
      title={waitlisted && relative ? `We're not in ${relative.city} yet` : "Who are we caring for?"}
      description={
        waitlisted ? undefined : "Tell us about your relative in your own words. There are no wrong answers."
      }
    >
      {waitlisted && relative ? (
        <Waitlist relative={relative} onChangeCity={() => setEditing(true)} />
      ) : (
        <RelativeForm relative={relative} onSaved={() => setEditing(false)} />
      )}
    </OnboardingShell>
  );
}

type Errors = Partial<Record<"name" | "age" | "city" | "careNeeds" | "consent", string>>;

function RelativeForm({ relative, onSaved }: { relative?: RelativeDraft; onSaved: () => void }) {
  const { update } = useDemo();
  const router = useRouter();
  const { after } = useTimers();
  const [checking, setChecking] = useState(false);
  const [name, setName] = useState(relative?.name ?? "");
  const [age, setAge] = useState(relative ? String(relative.age) : "");
  const [city, setCity] = useState<RequestCity | "">(relative?.city ?? "");
  const [careNeeds, setCareNeeds] = useState(relative?.careNeeds ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [voiceNoteAsked, setVoiceNoteAsked] = useState(false);
  const [sharing, setSharing] = useState(Boolean(relative?.consent));
  const [personalised, setPersonalised] = useState(relative?.consent?.personalisedCheck ?? false);

  const who = name.trim() ? firstName(name.trim()) : "Mama";

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ageNumber = Number(age);
    const next: Errors = {
      name: name.trim() ? undefined : "Enter their name.",
      age:
        Number.isInteger(ageNumber) && ageNumber >= MIN_AGE && ageNumber <= MAX_AGE
          ? undefined
          : `Enter their age in years, between ${MIN_AGE} and ${MAX_AGE}.`,
      city: city ? undefined : "Choose the city they live in.",
      careNeeds: careNeeds.trim() ? undefined : `Tell us a little about what ${who} needs help with.`,
      consent: sharing ? undefined : `We can only share updates with ${who}'s nurse if you agree. Tick the box to continue.`,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !city) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }

    // A draft for this visit only, it never becomes an Elder record.
    setChecking(true);
    after(AREA_CHECK_MS, () => {
      update((prev) =>
        patchOnboarding(prev, {
          relative: {
            name: name.trim(),
            age: ageNumber,
            city,
            careNeeds: careNeeds.trim(),
            consent: { personalisedCheck: personalised, agreedAt: new Date().toISOString() },
          },
        }),
      );
      onSaved();
      if (isServiceCity(city)) router.push(routes.familyMatching);
      else setChecking(false);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Their name" error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={INPUT_CLASSES}
          />
        )}
      </Field>

      <div className="grid gap-5 sm:grid-cols-[8rem_1fr]">
        <Field label="Age" error={errors.age}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              type="number"
              inputMode="numeric"
              min={MIN_AGE}
              max={MAX_AGE}
              value={age}
              onChange={(e) => setAge(e.target.value)}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={INPUT_CLASSES}
            />
          )}
        </Field>
        <Field
          label="City"
          hint={`Nurses are available in ${SERVICE_CITIES.join(" and ")} today.`}
          error={errors.city}
        >
          {({ id, describedBy, invalid }) => (
            <select
              id={id}
              value={city}
              onChange={(e) => setCity(e.target.value as RequestCity)}
              aria-invalid={invalid}
              aria-describedby={describedBy}
              className={`${INPUT_CLASSES} appearance-auto`}
            >
              <option value="" disabled>
                Choose a city
              </option>
              {REQUEST_CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      <Field
        label={`What does ${who} need help with?`}
        hint="Medication, getting around, company, a health condition, or whatever matters most."
        error={errors.careNeeds}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            id={id}
            value={careNeeds}
            onChange={(e) => setCareNeeds(e.target.value)}
            rows={5}
            placeholder={`Tell us what ${who} needs help with today…`}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={`${INPUT_CLASSES} py-3`}
          />
        )}
      </Field>

      <div className="rounded-xl border border-dashed border-line bg-surface p-3">
        <button
          type="button"
          onClick={() => setVoiceNoteAsked(true)}
          aria-describedby="voice-note-status"
          className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-muted px-4 text-left font-semibold text-navy transition-colors duration-150 hover:border-navy"
        >
          <Mic aria-hidden className="size-4" />
          Record a voice note
          <span className="ml-auto shrink-0 rounded-full bg-bg px-2 py-0.5 text-label font-semibold text-ink">Coming soon</span>
        </button>
        <p id="voice-note-status" role="status" className="mt-2 text-small">
          {voiceNoteAsked
            ? "Voice notes aren't ready yet. For now, please type a few words above. Short is fine."
            : "Soon you'll be able to say it instead of typing it."}
        </p>
      </div>

      <ConsentBlock
        who={who}
        sharing={sharing}
        onSharing={(v) => {
          setSharing(v);
          if (v) setErrors((e) => ({ ...e, consent: undefined }));
        }}
        personalised={personalised}
        onPersonalised={setPersonalised}
        error={errors.consent}
      />

      <Button type="submit" loading={checking} loadingText={`Checking nurses near ${city || "them"}…`} className="w-full">
        Continue
      </Button>
    </form>
  );
}

function Waitlist({ relative, onChangeCity }: { relative: RelativeDraft; onChangeCity: () => void }) {
  const { state } = useDemo();
  const phone = state.onboarding.account?.phone;

  return (
    <div className="space-y-6">
      <section aria-labelledby="waitlist-heading" className="rounded-2xl border-2 border-amber bg-amber/10 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber">
            <MapPinOff aria-hidden className="size-5 text-navy" />
          </span>
          <div>
            <h2 id="waitlist-heading" className="text-h2 font-semibold">
              You&apos;re on the waitlist for {relative.city}
            </h2>
            <p className="mt-2 text-navy">
              CareCircle nurses currently visit families in {SERVICE_CITIES.join(" and ")}. We&apos;ve kept{" "}
              {firstName(relative.name)}&apos;s details, so you won&apos;t need to fill this in again.
            </p>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-h2 font-semibold">What happens next</h2>
        <p className="mt-2 flex items-start gap-2">
          <WhatsAppMark className="mt-0.5 size-5" />
          <span>
            We&apos;ll message you on WhatsApp
            {phone && (
              <>
                {" "}
                at <strong className="whitespace-nowrap text-navy">{formatPhone(phone)}</strong>
              </>
            )}{" "}
            as soon as verified nurses are available in {relative.city}. There&apos;s nothing to pay until then.
          </span>
        </p>
      </div>

      <div className="space-y-3">
        <ButtonLink href={routes.home} className="w-full">
          Back to home
        </ButtonLink>
        <Button variant="secondary" onClick={onChangeCity} className="w-full">
          They live somewhere else: change city
        </Button>
      </div>
    </div>
  );
}
