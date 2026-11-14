"use client";
// The patient app shell: session guard, record switcher, navigation, and the upload-queue runner (FR-16).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { RecordProvider, useRecord } from "@/components/RecordContext";
import { Button, ErrorBox, Eyebrow, Field, inputCls, Skeleton, Tag } from "@/components/ui";
import { ApiFailure, describeError, postJson } from "@/lib/client-api";
import { supabase } from "@/lib/supabase-browser";
import { listQueue, onQueueChange, processQueue } from "@/lib/upload-queue";

const NAV = [
  { href: "/app", label: "Timeline" },
  { href: "/app/capture", label: "Add a document" },
  { href: "/app/share", label: "Share" },
  { href: "/app/referral", label: "Referral" },
  { href: "/app/log", label: "Access log" },
  { href: "/app/hospitals", label: "Hospitals" },
  { href: "/app/security", label: "Security" },
];

function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { records, record, selectRecord, loading, error, reload } = useRecord();
  const [waiting, setWaiting] = useState(0);

  // Upload queue: run on open, whenever the browser comes back online, and whenever the queue changes.
  useEffect(() => {
    const refresh = () => void listQueue().then((q) => setWaiting(q.length));
    refresh();
    void processQueue();
    const online = () => void processQueue();
    window.addEventListener("online", online);
    const off = onQueueChange(refresh);
    return () => {
      window.removeEventListener("online", online);
      off();
    };
  }, []);

  // A 401 from /api/records means the session is gone.
  useEffect(() => {
    if (error instanceof ApiFailure && error.status === 401) router.replace("/sign-in");
  }, [error, router]);

  async function signOut() {
    await supabase().auth.signOut();
    router.replace("/sign-in");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header data-app-chrome className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/app" className="font-display text-2xl font-semibold tracking-tight">
              Itan
            </Link>
            {records.length > 1 ? (
              <label className="flex items-center gap-2 text-sm text-muted">
                <span className="sr-only md:not-sr-only">Record</span>
                <select
                  className="min-h-11 rounded-md border border-line bg-surface px-2 text-[15px] text-ink"
                  value={record?.id ?? ""}
                  onChange={(e) => selectRecord(e.target.value)}
                  aria-label="Choose a record"
                >
                  {records.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.display_name}
                      {r.held_by_caregiver ? " (held for them)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : record ? (
              <span className="text-[15px] text-muted">{record.display_name}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {waiting > 0 ? (
              <Link href="/app/capture">
                <Tag tone="warn">{waiting} waiting to send</Tag>
              </Link>
            ) : null}
            <Button variant="quiet" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
        <nav data-app-chrome aria-label="Main" className="mx-auto w-full max-w-4xl overflow-x-auto px-2">
          <ul className="flex min-w-max gap-1 pb-2">
            {NAV.map((n) => {
              const active = n.href === "/app" ? path === "/app" : path.startsWith(n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center rounded-md px-3 text-[15px] font-medium ${active ? "bg-accent-soft text-accent-ink" : "text-muted hover:bg-sunk hover:text-ink"}`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
        {loading && !record ? (
          <div className="grid gap-3">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : error && !(error instanceof ApiFailure && error.status === 401) ? (
          <div className="grid gap-3">
            <ErrorBox>{describeError(error)}</ErrorBox>
            <div>
              <Button variant="secondary" onClick={() => void reload()}>
                Try again
              </Button>
            </div>
          </div>
        ) : !record ? (
          <CreateRecord onDone={reload} />
        ) : (
          // Keyed by record so a screen never shows the previous record's data while the new one loads.
          <Fragment key={record.id}>{children}</Fragment>
        )}
      </main>

      <footer data-app-chrome className="border-t border-line bg-surface">
        <p className="mx-auto w-full max-w-4xl px-4 py-3 text-sm text-muted">Prototype. Made-up data only. Itan is not a diagnosis tool and is not cleared for real patients.</p>
      </footer>
    </div>
  );
}

function CreateRecord({ onDone }: { onDone: () => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson("/api/records", { display_name: name.trim(), birth_year: year ? Number(year) : null, is_self: true });
      await onDone();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Eyebrow>First step</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Create your record</h1>
      <p className="mt-2 text-muted">This is the history you will build from your own papers. Use a made-up name for the demo.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <Field label="Name on the record">
          <input className={inputCls} required minLength={2} maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Year of birth (optional)">
          <input className={inputCls} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={year} onChange={(e) => setYear(e.target.value)} />
        </Field>
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <Button type="submit" disabled={busy}>
          Create record
        </Button>
      </form>
    </div>
  );
}

export default function PatientLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase().auth.getSession();
      if (!data.session) router.replace("/sign-in");
      else setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-10">
        <Skeleton className="h-10 w-40" />
      </div>
    );
  }
  return (
    <RecordProvider>
      <Shell>{children}</Shell>
    </RecordProvider>
  );
}
