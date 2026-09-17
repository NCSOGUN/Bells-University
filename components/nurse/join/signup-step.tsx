"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useDemo } from "@/lib/demo-context";
import {
  NURSE_CITIES,
  isValidLicenceFormat,
  normaliseLicence,
  patchNurseOnboarding,
  type NurseCity,
} from "@/lib/nurse-onboarding";
import { formatPhone, normalisePhone } from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASSES } from "@/components/ui/field";
import { JoinShell } from "./join-shell";

type Errors = Partial<Record<"name" | "phone" | "licenceId" | "city", string>>;

export function NurseSignupStep() {
  return (
    <JoinShell
      step="Your details"
      back={{ href: routes.nurseLanding, label: "About joining" }}
      title="Apply to join CareCircle"
      description="We check every licence before a nurse can take a visit."
    >
      <SignupForm />
    </JoinShell>
  );
}

function SignupForm() {
  const { state, update } = useDemo();
  const router = useRouter();
  const saved = state.nurseOnboarding.applicant;
  const [name, setName] = useState(saved?.name ?? "");
  const [phone, setPhone] = useState(saved ? formatPhone(saved.phone) : "");
  const [licenceId, setLicenceId] = useState(saved?.licenceId ?? "");
  const [city, setCity] = useState<NurseCity | "">(saved?.city ?? "");
  const [errors, setErrors] = useState<Errors>({});

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalisedPhone = normalisePhone(phone);
    const next: Errors = {
      name: name.trim() ? undefined : "Enter your full name as it appears on your licence.",
      phone: normalisedPhone ? undefined : "Enter a phone number, like 0803 123 4567.",
      licenceId: isValidLicenceFormat(licenceId)
        ? undefined
        : "Enter your licence number in the format NMCN/RN/482910.",
      city: city ? undefined : "Choose the city you work in.",
    };
    setErrors(next);
    if (Object.values(next).some(Boolean) || !normalisedPhone || !city) {
      const form = event.currentTarget;
      requestAnimationFrame(() => form.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      return;
    }

    // An application draft only — never a Nurse record.
    update((prev) =>
      patchNurseOnboarding(prev, {
        applicant: { name: name.trim(), phone: normalisedPhone, licenceId: normaliseLicence(licenceId), city },
        status: "pending_verification",
      }),
    );
    router.push(routes.nurseDocuments);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Full name" error={errors.name}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={INPUT_CLASSES}
          />
        )}
      </Field>
      <Field label="Phone number" error={errors.phone}>
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="0803 123 4567"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={INPUT_CLASSES}
          />
        )}
      </Field>
      <Field
        label="NMCN licence number"
        hint="As printed on your practising licence, e.g. NMCN/RN/482910."
        error={errors.licenceId}
      >
        {({ id, describedBy, invalid }) => (
          <input
            id={id}
            value={licenceId}
            onChange={(e) => setLicenceId(e.target.value)}
            onBlur={() => licenceId && setLicenceId(normaliseLicence(licenceId))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="NMCN/RN/000000"
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={`${INPUT_CLASSES} uppercase`}
          />
        )}
      </Field>
      <Field label="City" hint={`We're welcoming nurses in ${NURSE_CITIES.join(" and ")}.`} error={errors.city}>
        {({ id, describedBy, invalid }) => (
          <select
            id={id}
            value={city}
            onChange={(e) => setCity(e.target.value as NurseCity)}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            className={`${INPUT_CLASSES} appearance-auto`}
          >
            <option value="" disabled>
              Choose a city
            </option>
            {NURSE_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </Field>
      <p className="text-small">
        We only check the format here. Your licence is verified by our team in the next steps.
      </p>
      <Button type="submit" className="w-full">
        Continue to documents
      </Button>
    </form>
  );
}
