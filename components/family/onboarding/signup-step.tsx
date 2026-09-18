"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText } from "lucide-react";
import { useDemo } from "@/lib/demo-context";
import {
  OTP_LENGTH,
  formatPhone,
  normalisePhone,
  otpSecondsLeft,
  patchOnboarding,
  type AccountDraft,
  type CodeChannel,
} from "@/lib/onboarding";
import { routes } from "@/lib/routes";
import { useTimers } from "@/lib/use-timers";
import { Button } from "@/components/ui/button";
import { Field, FieldError, INPUT_CLASSES } from "@/components/ui/field";
import { OtpInput } from "@/components/ui/otp-input";
import { WhatsAppMark } from "@/components/ui/whatsapp-mark";
import { OnboardingShell } from "./onboarding-shell";

// §4.3: sending a code takes a moment, like the real SMS gateway would.
const SEND_MS = 800;

export function SignupStep() {
  const { state } = useDemo();
  const account = state.onboarding.account;
  const awaitingCode = Boolean(account?.codeSentAt && !account.verifiedAt);

  return (
    <OnboardingShell
      step="account"
      back={{ href: routes.familyPlans, label: "Plans" }}
      title={awaitingCode ? "Enter your code" : "Your details"}
      description={
        awaitingCode
          ? undefined
          : "We'll text you a code to confirm your number. No password needed."
      }
    >
      {awaitingCode && account ? <CodeForm account={account} /> : <DetailsForm account={account} />}
    </OnboardingShell>
  );
}

function DetailsForm({ account }: { account?: AccountDraft }) {
  const { update } = useDemo();
  const { after, cancelAll } = useTimers();
  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState(account ? formatPhone(account.phone) : "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [sending, setSending] = useState(false);

  const sendNow = () => {
    const normalised = normalisePhone(phone);
    if (!normalised) return;
    cancelAll();
    update((prev) =>
      patchOnboarding(prev, {
        account: { name: name.trim(), phone: normalised, codeSentAt: new Date().toISOString(), codeChannel: "sms" },
      }),
    );
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalised = normalisePhone(phone);
    const next = {
      name: name.trim() ? undefined : "Enter your name.",
      phone: normalised ? undefined : "Enter a phone number, like 0803 123 4567 or +44 7700 900123.",
    };
    setErrors(next);
    if (next.name || next.phone || !normalised) {
      const form = event.currentTarget;
      // Errors render on the next paint; move focus to the first one then.
      requestAnimationFrame(() =>
        form.querySelector<HTMLInputElement>("[aria-invalid='true']")?.focus(),
      );
      return;
    }

    setSending(true);
    after(SEND_MS, () =>
      update((prev) =>
        patchOnboarding(prev, {
          account: {
            name: name.trim(),
            phone: normalised,
            codeSentAt: new Date().toISOString(),
            codeChannel: "sms",
          },
        }),
      ),
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <Field label="Your name" error={errors.name}>
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
      <Field
        label="Phone number"
        hint="Nigerian or international. We'll send your code here."
        error={errors.phone}
      >
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
      <Button type="submit" loading={sending} loadingText="Sending code…" className="w-full">
        Send code
      </Button>
      {sending && (
        <p className="text-center">
          <button
            type="button"
            onClick={sendNow}
            className="inline-flex min-h-11 items-center px-2 text-small font-semibold text-navy underline decoration-teal decoration-2 underline-offset-4"
          >
            Skip
          </button>
        </p>
      )}
    </form>
  );
}

const CHANNEL_COPY: Record<CodeChannel, string> = {
  sms: "by text message",
  whatsapp: "on WhatsApp",
};

function CodeForm({ account }: { account: AccountDraft }) {
  const { update } = useDemo();
  const router = useRouter();
  const { after } = useTimers();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [resending, setResending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = otpSecondsLeft(account.codeSentAt, now);
  const expired = secondsLeft === 0;

  useEffect(() => {
    if (expired) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expired, account.codeSentAt]);

  const verify = (event: FormEvent) => {
    event.preventDefault();
    if (code.length < OTP_LENGTH) {
      setError(`Enter all ${OTP_LENGTH} digits of the code.`);
      return;
    }
    // Demo: any six digits are accepted.
    update((prev) =>
      patchOnboarding(prev, { account: { ...account, verifiedAt: new Date().toISOString() } }),
    );
    router.push(routes.familyRelative);
  };

  const resendOnWhatsApp = () => {
    setResending(true);
    after(SEND_MS, () => {
      const sentAt = new Date().toISOString();
      update((prev) =>
        patchOnboarding(prev, { account: { ...account, codeSentAt: sentAt, codeChannel: "whatsapp" } }),
      );
      setNow(Date.now());
      setCode("");
      setError(undefined);
      setResending(false);
    });
  };

  const changeNumber = () =>
    update((prev) =>
      patchOnboarding(prev, { account: { name: account.name, phone: account.phone } }),
    );

  const channel = account.codeChannel ?? "sms";
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <form onSubmit={verify} noValidate className="space-y-5">
      <p role="status" className="flex items-start gap-2 rounded-xl bg-teal-tint p-3 text-navy">
        {channel === "whatsapp" ? (
          <WhatsAppMark className="mt-0.5 size-5" />
        ) : (
          <MessageSquareText aria-hidden className="mt-0.5 size-5 shrink-0" />
        )}
        <span>
          Code sent {CHANNEL_COPY[channel]} to <strong className="whitespace-nowrap">{formatPhone(account.phone)}</strong>
        </span>
      </p>

      <div>
        <p id="otp-label" className="font-semibold text-navy">
          {OTP_LENGTH}-digit code
        </p>
        <p id="otp-hint" className="mt-0.5 text-small">
          For this demo, any {OTP_LENGTH} digits will work.
        </p>
        <div className="mt-3">
          <OtpInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(undefined);
            }}
            length={OTP_LENGTH}
            label={`${OTP_LENGTH}-digit code`}
            invalid={Boolean(error)}
            describedBy={error ? "otp-hint otp-error" : "otp-hint"}
            disabled={expired}
          />
        </div>
        {error && <FieldError id="otp-error">{error}</FieldError>}
      </div>

      {expired ? (
        <div className="space-y-3">
          <p role="status" className="text-navy">Your code has expired. Text messages can be slow, so we can send it on WhatsApp instead.</p>
          <Button onClick={resendOnWhatsApp} loading={resending} loadingText="Sending on WhatsApp…" className="w-full">
            {!resending && <WhatsAppMark className="size-5" />}
            Send OTP via WhatsApp
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Button type="submit" className="w-full">
            Verify and continue
          </Button>
          <p className="text-center text-small" aria-live="off">
            Code expires in{" "}
            <span className="font-semibold tabular-nums text-navy" data-testid="otp-countdown">
              {minutes}:{seconds}
            </span>
          </p>
        </div>
      )}

      <div className="text-center">
        <Button variant="ghost" onClick={changeNumber} className="min-h-11 px-2">
          Change number
        </Button>
      </div>
    </form>
  );
}
