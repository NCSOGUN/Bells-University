"use client";
// FR-28: when an account has two-step sign-in, sensitive actions (creating a share code, linking a hospital) need a session
// that has passed the authenticator code. The server answers 403 mfa_required; this asks for the code and then the caller retries.
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorBox, Field, inputCls, Spinner } from "@/components/ui";
import { supabase } from "@/lib/supabase-browser";

export function StepUp({ onVerified }: { onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { data: f } = await supabase().auth.mfa.listFactors();
      const factor = f?.totp?.[0];
      if (!factor) throw new Error("no factor");
      const { data: ch, error: cErr } = await supabase().auth.mfa.challenge({ factorId: factor.id });
      if (cErr || !ch) throw cErr;
      const { error: vErr } = await supabase().auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code: code.replace(/\s/g, "") });
      if (vErr) throw vErr;
      setCode("");
      onVerified();
    } catch {
      setError("That code did not work. Codes change every 30 seconds: wait for a new one and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="grid gap-3">
        <p className="font-medium">Confirm it is you</p>
        <p className="text-muted">Your account uses two-step sign-in. Type the current 6-digit code from your authenticator app.</p>
        <Field label="6-digit code">
          <input
            className={`${inputCls} printed max-w-48 text-xl tracking-[0.3em]`}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div>
          <Button type="submit" disabled={busy}>
            {busy ? <Spinner>Checking</Spinner> : "Verify"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
