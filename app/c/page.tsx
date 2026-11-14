"use client";
// FR-10, FR-12: the clinician types or scans a code. No account, no install. The code arrives in the URL FRAGMENT
// (/c#CODE), so it never reaches a server log; it is sent only in the POST body. Plain fetch (no Supabase) keeps this page light.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ErrorBox, Eyebrow, Field, inputCls, Notice, Spinner } from "@/components/ui";

export default function ClinicianCodePage() {
  const codeRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [practice, setPractice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Read the code from the fragment, then remove it from the address bar.
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && codeRef.current) {
      codeRef.current.value = decodeURIComponent(hash);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/view/open", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: codeRef.current?.value ?? "", name: name.trim(), practice_no: practice.trim() }),
        credentials: "same-origin",
      });
      if (res.ok) {
        const body = (await res.json()) as { next: string };
        window.location.assign(body.next);
        return;
      }
      if (res.status === 429) setError("Too many attempts. Please wait a few minutes and try again.");
      else if (res.status === 400) setError("Please check your name and practice number, then try again.");
      else setError("This code did not work.");
    } catch {
      setError("No connection. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <Eyebrow>Itan · clinician</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Open a shared record</h1>
      <p className="mt-2 text-muted">Type the code the patient is showing you. You do not need an account.</p>

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field label="Code from the patient">
          <input
            ref={codeRef}
            className={`${inputCls} printed text-2xl uppercase tracking-[0.15em]`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            required
            maxLength={40}
          />
        </Field>
        <Field label="Your name">
          <input className={inputCls} autoComplete="name" required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Practice number">
          <input className={inputCls} required minLength={2} maxLength={40} value={practice} onChange={(e) => setPractice(e.target.value)} />
        </Field>
        <Notice>Your name and practice number are recorded and shown to the patient. They are not verified.</Notice>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <Button type="submit" disabled={busy}>
          {busy ? <Spinner>Opening</Spinner> : "Open record"}
        </Button>
      </form>
    </main>
  );
}
