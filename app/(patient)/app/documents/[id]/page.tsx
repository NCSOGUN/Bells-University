"use client";
// FR-03 to FR-07: read a document, then check every fact against the original. The AI types; the patient, with the paper
// in hand, checks. Nothing is ever auto-confirmed (hard rule 2).
import { useParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FactRow, type FactLike } from "@/components/FactRow";
import { SourceCrop } from "@/components/SourceCrop";
import { Button, Card, EmptyState, ErrorBox, Field, inputCls, LinkButton, Notice, PageHeader, Skeleton, Spinner } from "@/components/ui";
import type { CorrectFactBody, DocumentResponse, ExtractResponse, FactResponse, RemoveFactResponse } from "@/lib/api-types";
import { ApiFailure, describeError, getJson, postJson } from "@/lib/client-api";
import { useLoad } from "@/lib/use-load";

export default function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const doc = useLoad(() => getJson<DocumentResponse>(`/api/documents/${id}`), [id]);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const started = useRef(false);
  const status = doc.data?.status;

  async function read() {
    setReading(true);
    setReadError(null);
    try {
      await postJson<ExtractResponse>(`/api/documents/${id}/extract`);
    } catch (e) {
      // Another call is already reading it: fall through to polling. Anything else is shown.
      if (!(e instanceof ApiFailure && e.code === "extraction_in_progress")) setReadError(describeError(e));
    } finally {
      await doc.reload();
      setReading(false);
    }
  }

  // Start reading by itself the first time the document is "uploaded" (consent was checked on the capture screen).
  useEffect(() => {
    if (status === "uploaded" && !started.current) {
      started.current = true;
      void read();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Reading can take up to ~40 s (docs/limitations.md). Poll if the connection dropped or another tab is reading.
  const busy = reading || status === "extracting";
  useEffect(() => {
    if (status !== "extracting" || reading) return;
    const poll = setInterval(() => void doc.reload(), 3000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, reading]);

  if (doc.loading && !doc.data) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (doc.error) return <ErrorBox>{describeError(doc.error)}</ErrorBox>;
  const d = doc.data!;
  const isPdf = d.mime === "application/pdf";
  const facts = d.facts as FactLike[];
  const pending = facts.filter((f) => f.state === "unverified").length;
  const imageUrl = `/api/documents/${id}/image`;

  return (
    <>
      <PageHeader
        title={d.doc_type ? d.doc_type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : "Document"}
        sub={[d.facility_as_printed, d.document_date_as_printed].filter(Boolean).join(" · ") || undefined}
        aside={
          <a className="text-[15px] font-medium text-accent-ink underline underline-offset-2" href={imageUrl} target="_blank" rel="noopener noreferrer">
            Open the original
          </a>
        }
      />

      {busy ? (
        <Card className="p-5">
          <Spinner>
            Reading your document… <Elapsed /> s
          </Spinner>
          <p className="mt-2 text-[15px] text-muted">This usually takes under 15 seconds and can take up to 40. You can leave this page and come back: it keeps going.</p>
        </Card>
      ) : null}

      {!busy && (status === "failed" || readError) ? (
        <div className="grid gap-3">
          <ErrorBox>{readError ?? "Itan could not read this document. Try again or add the facts by hand."}</ErrorBox>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void read()}>Try again</Button>
            <LinkButton href="/app/facts/new" variant="secondary">
              Add the facts by hand
            </LinkButton>
          </div>
        </div>
      ) : null}

      {!busy && status === "extracted" ? (
        <>
          <div className="mb-4 grid gap-3">
            {d.ai_notice ? <Notice tone="warn">{d.ai_notice}</Notice> : null}
            {pending > 0 ? (
              <Notice tone="accent" role="status" title={`${pending} ${pending === 1 ? "item" : "items"} to check`}>
                Compare each item with the original. Confirm it if it matches, correct it if it does not.
              </Notice>
            ) : facts.length > 0 ? (
              <Notice tone="ok" role="status">
                Every item on this document has been checked.
              </Notice>
            ) : null}
          </div>

          {facts.length === 0 ? (
            <EmptyState title="Nothing readable was found" action={<LinkButton href="/app/facts/new" variant="primary">Add a fact by hand</LinkButton>}>
              The page may be blurred, cut off or not a medical document. Try a clearer photo, or type what you need.
            </EmptyState>
          ) : (
            <Card className="px-4">
              {facts.map((f) => (
                <FactRow key={f.id} fact={f} audience="patient">
                  {f.has_image ? <SourceCrop imageUrl={imageUrl} box={f.source_box} quote={f.source_quote} isPdf={isPdf} /> : null}
                  <FactControls fact={f} onChanged={() => void doc.reload()} />
                </FactRow>
              ))}
            </Card>
          )}
          <div className="mt-4">
            <LinkButton href="/app/facts/new" variant="quiet">
              Something missing? Add a fact by hand
            </LinkButton>
          </div>
        </>
      ) : null}
    </>
  );
}

/** Counts up while mounted; it is only mounted while a document is being read, so it restarts at 0 each time. */
function Elapsed() {
  const [s, setS] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{s}</>;
}

/** Confirm, correct or remove one AI-read or patient-added fact. Hospital-sent facts never get these controls. */
function FactControls({ fact, onChanged }: { fact: FactLike; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  if (fact.origin === "provider_entered") return null;

  return (
    <div className="grid gap-2">
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {fact.state === "unverified" && !fact.unreadable ? (
            <Button disabled={busy} onClick={() => void run(() => postJson<FactResponse>(`/api/facts/${fact.id}/confirm`))}>
              {fact.check_carefully ? "Confirm after checking" : "This matches"}
            </Button>
          ) : null}
          <Button variant="secondary" disabled={busy} onClick={() => setEditing(true)}>
            {fact.unreadable ? "Type the value" : "Correct"}
          </Button>
          <Button variant="quiet" disabled={busy} onClick={() => void run(() => postJson<RemoveFactResponse>(`/api/facts/${fact.id}/remove`))}>
            Not on the document
          </Button>
        </div>
      ) : (
        <CorrectForm fact={fact} busy={busy} onCancel={() => setEditing(false)} onSave={(body) => void run(() => postJson<FactResponse>(`/api/facts/${fact.id}/correct`, body))} />
      )}
      {error ? <ErrorBox>{error}</ErrorBox> : null}
    </div>
  );
}

function CorrectForm({ fact, busy, onSave, onCancel }: { fact: FactLike; busy: boolean; onSave: (b: CorrectFactBody) => void; onCancel: () => void }) {
  const [label, setLabel] = useState(fact.label_as_printed);
  const [value, setValue] = useState(fact.value_as_printed ?? "");
  const [unit, setUnit] = useState(fact.unit_as_printed ?? "");
  const [range, setRange] = useState(fact.range_as_printed ?? "");

  function submit(e: FormEvent) {
    e.preventDefault();
    const body: CorrectFactBody = {};
    if (label !== fact.label_as_printed) body.label_as_printed = label;
    if (value !== (fact.value_as_printed ?? "")) body.value_as_printed = value;
    if (unit !== (fact.unit_as_printed ?? "")) body.unit_as_printed = unit;
    if (range !== (fact.range_as_printed ?? "")) body.range_as_printed = range;
    if (Object.keys(body).length === 0) return onCancel();
    onSave(body);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md bg-bg p-3">
      <p className="text-sm text-muted">Type exactly what the paper says. Itan keeps your original reading in the history.</p>
      <Field label="Name">
        <input className={inputCls} required value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Value">
          <input className={`${inputCls} printed`} value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="Unit">
          <input className={`${inputCls} printed`} value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Printed range">
          <input className={`${inputCls} printed`} value={range} onChange={(e) => setRange(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          Save and confirm
        </Button>
        <Button variant="quiet" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
