"use client";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ErrorBox, Eyebrow, Field, inputCls, Notice, Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase-browser";

type Step = "password" | "code";

export default function SignInPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function afterPassword() {
    // Two-step sign-in (FR-28): if the account has a verified authenticator, the session is not complete until the code is checked.
    const { data } = await supabase().auth.mfa.getAuthenticatorAssuranceLevel();
    if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
      const { data: f } = await supabase().auth.mfa.listFactors();
      const factor = f?.totp?.[0];
      if (factor) {
        setFactorId(factor.id);
        setStep("code");
        return;
      }
    }
    router.replace("/app");
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "up") {
        const { data, error: err } = await supabase().auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        if (!data.session) {
          setInfo("Check your email to finish creating your account, then sign in.");
          setMode("in");
          return;
        }
        router.replace("/app");
        return;
      }
      const { error: err } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
      if (err) throw err;
      await afterPassword();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : mode === "up"
            ? "We could not create that account. Check the email and use at least 8 characters."
            : "That email or password did not work.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ch, error: cErr } = await supabase().auth.mfa.challenge({ factorId });
      if (cErr || !ch) throw cErr;
      const { error: vErr } = await supabase().auth.mfa.verify({ factorId, challengeId: ch.id, code: totp.replace(/\s/g, "") });
      if (vErr) throw vErr;
      router.replace("/app");
    } catch {
      setError("That code did not work. Codes change every 30 seconds: wait for a new one and try again.");
      setTotp("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Eyebrow>Itan</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{step === "code" ? "Enter your 6-digit code" : mode === "in" ? "Sign in" : "Create your account"}</h1>

      {step === "password" ? (
        <>
          <p className="mt-2 text-muted">{mode === "in" ? "Use the email and password for your record." : "Use at least 8 characters for the password."}</p>
          <form onSubmit={submitPassword} className="mt-6 grid gap-4">
            <Field label="Email">
              <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password">
              <input
                className={inputCls}
                type="password"
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {info ? <Notice tone="accent" role="status">{info}</Notice> : null}
            {error ? <ErrorBox>{error}</ErrorBox> : null}
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner>Please wait</Spinner> : mode === "in" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 text-[15px] text-muted">
            {mode === "in" ? "New to Itan? " : "Already have an account? "}
            <button
              type="button"
              className="font-medium text-accent-ink underline underline-offset-2"
              onClick={() => {
                setMode(mode === "in" ? "up" : "in");
                setError(null);
                setInfo(null);
              }}
            >
              {mode === "in" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-muted">Open your authenticator app and type the current code for Itan.</p>
          <form onSubmit={submitCode} className="mt-6 grid gap-4">
            <Field label="6-digit code">
              <input
                className={`${inputCls} printed text-2xl tracking-[0.3em]`}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                required
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
              />
            </Field>
            {error ? <ErrorBox>{error}</ErrorBox> : null}
            <Button type="submit" disabled={busy}>
              {busy ? <Spinner>Checking</Spinner> : "Verify and continue"}
            </Button>
          </form>
        </>
      )}
    </main>
  );
}
