"use client";
// FR-09 explanation (fixed text, no AI), FR-15 privacy tag, FR-27 dispute a hospital-sent fact.
// Show every sentence and notice exactly as the API sends it, and add no wording about what a result means (NFR-19).
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { FactRow, type FactLike } from "@/components/FactRow";
import { useRecord } from "@/components/RecordContext";
import { Button, Card, ErrorBox, Eyebrow, Field, inputCls, Notice, PageHeader, Skeleton } from "@/components/ui";
import type { ExplanationResponse, FactResponse, TimelineResponse } from "@/lib/api-types";
import { ApiFailure, deleteJson, describeError, getJson, postJson } from "@/lib/client-api";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@/lib/category-labels";
import { useLoad } from "@/lib/use-load";

export default function FactPage() {
  const { id } = useParams<{ id: string }>();
  const { record } = useRecord();
  const timeline = useLoad(() => getJson<TimelineResponse>(`/api/records/${record!.id}/facts`), [record?.id]);
  const fact = (timeline.data?.facts.find((f) => f.id === id) ?? null) as FactLike | null;
  const explain = useLoad<ExplanationResponse | null>(
    async () => {
      if (!fact || fact.kind !== "lab") return null;
      try {
        return await getJson<ExplanationResponse>(`/api/facts/${id}/explanation`);
      } catch (e) {
        if (e instanceof ApiFailure && e.code === "not_explainable") return null;
        throw e;
      }
    },
    [fact?.id, fact?.state, fact?.value_as_printed],
  );

  if (timeline.loading && !timeline.data) return <Skeleton className="h-48" />;
  if (timeline.error) return <ErrorBox>{describeError(timeline.error)}</ErrorBox>;
  if (!fact) {
    return (
      <>
        <ErrorBox>That item was not found in this record.</ErrorBox>
        <p className="mt-3">
          <Link className="font-medium text-accent-ink underline underline-offset-2" href="/app">
            Back to your history
          </Link>
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={fact.label_as_printed} sub="What this item says, where it came from, and what you can do with it." />
      <Card className="px-4">
        <FactRow fact={fact} audience="patient" imageHref={fact.document_id ? `/api/documents/${fact.document_id}/image` : undefined} />
      </Card>

      {fact.kind === "lab" ? (
        <section className="mt-6" aria-labelledby="ex">
          <h2 id="ex" className="mb-2">
            <Eyebrow>Explanation</Eyebrow>
          </h2>
          {explain.loading && !explain.data ? (
            <Skeleton className="h-24" />
          ) : explain.error ? (
            <ErrorBox>{describeError(explain.error)}</ErrorBox>
          ) : explain.data ? (
            <Card className="grid gap-3 p-5">
              {explain.data.sentences.map((s, i) => (
                <p key={i} className={i === 0 ? "text-[17px]" : "text-muted"}>
                  {s}
                </p>
              ))}
              {explain.data.questions.length > 0 ? (
                <div>
                  <p className="text-sm font-medium">Questions you can ask your doctor</p>
                  <ul className="mt-1 list-disc pl-5 text-muted">
                    {explain.data.questions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="grid gap-2">
                {explain.data.notices.map((n) => (
                  <Notice key={n} tone="warn">
                    {n}
                  </Notice>
                ))}
              </div>
            </Card>
          ) : null}
        </section>
      ) : null}

      <section className="mt-6" aria-labelledby="priv">
        <h2 id="priv" className="mb-2">
          <Eyebrow>Privacy</Eyebrow>
        </h2>
        <CategoryControl fact={fact} onChanged={() => void timeline.reload()} />
      </section>

      {fact.origin === "provider_entered" ? (
        <section className="mt-6" aria-labelledby="dis">
          <h2 id="dis" className="mb-2">
            <Eyebrow>Think this is wrong?</Eyebrow>
          </h2>
          <DisputeControl fact={fact} onChanged={() => void timeline.reload()} />
        </section>
      ) : null}
    </>
  );
}

function CategoryControl({ fact, onChanged }: { fact: FactLike; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(value: string) {
    setBusy(true);
    setError(null);
    try {
      await postJson<FactResponse>(`/api/facts/${fact.id}/category`, { sensitive_category: value || null });
      onChanged();
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-3 p-5">
      <Field label="Mark as sensitive" hint="When you share your record you can hide a whole category from the doctor.">
        <select className={inputCls} value={fact.sensitive_category ?? ""} disabled={busy} onChange={(e) => void set(e.target.value)}>
          <option value="">Not marked</option>
          {CATEGORY_KEYS.map((k) => (
            <option key={k} value={k}>
              {CATEGORY_LABELS[k]}
            </option>
          ))}
        </select>
      </Field>
      <Notice tone="neutral">
        Hiding a category does not hide the photo of the page it is printed on. If a sensitive item is on a document, hide the whole document when you share.
      </Notice>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
    </Card>
  );
}

function DisputeControl({ fact, onChanged }: { fact: FactLike; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dispute(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postJson<FactResponse>(`/api/facts/${fact.id}/dispute`, { note: note.trim() });
      setNote("");
      onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    setBusy(true);
    setError(null);
    try {
      await deleteJson<FactResponse>(`/api/facts/${fact.id}/dispute`);
      onChanged();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-3 p-5">
      <p className="text-muted">The hospital&rsquo;s result stays exactly as it was sent. You cannot edit it, but you can add a note that says you dispute it. Doctors will see both.</p>
      {fact.state === "disputed" ? (
        <div>
          <Button variant="secondary" disabled={busy} onClick={() => void withdraw()}>
            Withdraw my dispute
          </Button>
        </div>
      ) : (
        <form onSubmit={dispute} className="grid gap-3">
          <Field label="Your note (up to 500 characters)">
            <textarea className={`${inputCls} py-2`} rows={3} required maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div>
            <Button type="submit" disabled={busy || note.trim().length === 0}>
              Dispute this result
            </Button>
          </div>
        </form>
      )}
      {error ? <ErrorBox>{error}</ErrorBox> : null}
    </Card>
  );
}
