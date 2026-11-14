"use client";
// FR-28: optional two-step sign-in with an authenticator app (TOTP) through Supabase Auth. No SMS.
// Once enrolled, creating a share or linking a hospital needs a fresh code (the server answers 403 mfa_required).
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorBox, Eyebrow, Field, inputCls, Notice, PageHeader, Skeleton, Spinner, Tag } from "@/components/ui";
import { supabase } from "@/lib/supabase-browser";
import { useLoad } from "@/lib/use-load";

interface Enrol {
  factorId: string;
  qr: string;
  secret: string;
}

export default function SecurityPage() {
  const status = useLoad(async () => {
    const { data, error } = await supabase().auth.mfa.listFactors();
    if (error) throw error;
    return { enrolled: (data?.totp ?? []).length > 0, factorId: data?.totp?.[0]?.id ?? null };
  }, []);
  const [enrol, setEnrol] = useState<Enrol | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const { data, error: err } = await supabase().auth.mfa.enroll({ factorType: "totp", friendlyName: "Itan authenticator" });
      if (err || !data) throw err;
      setEnrol({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError("Two-step sign-in could not be started. It may not be switched on for this project yet.");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    if (!enrol) return;
    setBusy(true);
    setError(null);
    try {
      const { data: ch, error: cErr } = await supabase().auth.mfa.challenge({ factorId: enrol.factorId });
      if (cErr || !ch) throw cErr;
      const { error: vErr } = await supabase().auth.mfa.verify({ factorId: enrol.factorId, challengeId: ch.id, code: code.replace(/\s/g, "") });
      if (vErr) throw vErr;
      setEnrol(null);
      setCode("");
      await status.reload();
    } catch {
      setError("That code did not work. Codes change every 30 seconds: wait for a new one and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!status.data?.factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase().auth.mfa.unenroll({ factorId: status.data.factorId });
      if (err) throw err;
      await status.reload();
    } catch {
      setError("Two-step sign-in could not be turned off. Verify with your code first, then try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Security" sub="Protect your record even if your password is stolen." />
      {status.loading && !status.data ? (
        <Skeleton className="h-32" />
      ) : (
        <Card className="grid gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Eyebrow>Two-step sign-in</Eyebrow>
              <p className="mt-1 text-muted">After your password, Itan asks for a 6-digit code from an authenticator app on your phone.</p>
            </div>
            <Tag tone={status.data?.enrolled ? "ok" : "neutral"}>{status.data?.enrolled ? "On" : "Off"}</Tag>
          </div>

          {status.data?.enrolled && !enrol ? (
            <>
              <Notice tone="accent">With two-step sign-in on, creating a share code or linking a hospital asks for a fresh code.</Notice>
              <div>
                <Button variant="danger" onClick={() => void turnOff()} disabled={busy}>
                  Turn off
                </Button>
              </div>
            </>
          ) : null}

          {!status.data?.enrolled && !enrol ? (
            <div>
              <Button onClick={() => void start()} disabled={busy}>
                {busy ? <Spinner>Starting</Spinner> : "Turn on two-step sign-in"}
              </Button>
            </div>
          ) : null}

          {enrol ? (
            <form onSubmit={verify} className="grid gap-4">
              <div>
                <p className="font-medium">1. Scan with your authenticator app</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrol.qr} alt="QR code to add Itan to your authenticator app" className="mt-2 h-44 w-44 rounded-md border border-line bg-white p-2" />
                <p className="mt-2 text-sm text-muted">
                  Cannot scan? Type this setup key into the app: <span className="printed break-all text-ink">{enrol.secret}</span>
                </p>
              </div>
              <Field label="2. Type the 6-digit code to finish">
                <input className={`${inputCls} printed max-w-48 text-xl tracking-[0.3em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={7} required value={code} onChange={(e) => setCode(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy}>
                  Verify and turn on
                </Button>
                <Button variant="quiet" onClick={() => setEnrol(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : null}
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <p className="text-sm text-muted">If you lose your phone there is no recovery in this prototype version; the team can reset it for the demo account.</p>
        </Card>
      )}
    </>
  );
}
