"use client";
// FR-10, FR-11, FR-15: show a doctor your record with a code that expires. Nothing is shared by default.
// The code is returned ONCE by the API and lives only in this component's state: never stored, logged or put in a URL query.
import { useState } from "react";
import { useRecord } from "@/components/RecordContext";
import { StepUp } from "@/components/StepUp";
import { Button, Card, EmptyState, ErrorBox, Eyebrow, Notice, PageHeader, Skeleton, Tag } from "@/components/ui";
import type { CreateShareBody, CreateShareResponse, RevokeResponse, SharesResponse, TimelineResponse } from "@/lib/api-types";
import { ApiFailure, describeError, getJson, postJson } from "@/lib/client-api";
import { CATEGORY_KEYS, CATEGORY_LABELS } from "@/lib/category-labels";
import { useLoad } from "@/lib/use-load";

const DURATIONS = [
  { minutes: 15, label: "15 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 240, label: "4 hours" },
  { minutes: 1440, label: "24 hours" },
];

const qrSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function SharePage() {
  const { record } = useRecord();
  const id = record!.id;
  const shares = useLoad(() => getJson<SharesResponse>(`/api/records/${id}/shares`), [id]);
  const timeline = useLoad(() => getJson<TimelineResponse>(`/api/records/${id}/facts`), [id]);
  const [minutes, setMinutes] = useState(60);
  const [hiddenCats, setHiddenCats] = useState<string[]>([]);
  const [hiddenDocs, setHiddenDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needStepUp, setNeedStepUp] = useState(false);
  const [created, setCreated] = useState<CreateShareResponse | null>(null);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function create() {
    setBusy(true);
    setError(null);
    setNeedStepUp(false);
    try {
      const body: CreateShareBody = { record_id: id, purpose: "general", expires_in_minutes: minutes };
      if (hiddenCats.length) body.hidden_categories = hiddenCats as NonNullable<CreateShareBody["hidden_categories"]>;
      if (hiddenDocs.length) body.hidden_document_ids = hiddenDocs;
      setCreated(await postJson<CreateShareResponse>("/api/shares", body));
      void shares.reload();
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "mfa_required") setNeedStepUp(true);
      else setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(shareId: string) {
    setError(null);
    try {
      await postJson<RevokeResponse>(`/api/shares/${shareId}/revoke`);
      if (created?.share_id === shareId) setCreated(null);
      await shares.reload();
    } catch (e) {
      setError(describeError(e));
    }
  }

  if (created) {
    return (
      <>
        <PageHeader title="Show this to the doctor" sub="It works until it expires or you end it." />
        <Card className="grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc(created.qr_svg)} alt="QR code for the doctor to scan" className="h-44 w-44 rounded-md border border-line bg-white p-2" />
          <div className="min-w-0">
            <Eyebrow>Code</Eyebrow>
            <p className="printed mt-1 text-5xl font-medium tracking-[0.12em]" aria-label={`Code ${created.code.split("").join(" ")}`}>
              {created.code}
            </p>
            <p className="mt-3 text-muted">
              Ends <span className="font-medium text-ink">{when(created.expires_at)}</span>
            </p>
          </div>
        </Card>

        <div className="mt-4 grid gap-3">
          <Notice tone="accent" title="For the doctor">
            Point your phone camera at the QR code. Or open <span className="printed">{typeof window !== "undefined" ? window.location.host : ""}/c</span> on any phone or computer
            and type the code. You will be asked for your name and practice number.
          </Notice>
          <Notice tone="warn">This code is shown once. If you lose it, make a new one.</Notice>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="danger" onClick={() => void revoke(created.share_id)}>
            End access now
          </Button>
          <Button variant="secondary" onClick={() => setCreated(null)}>
            Done
          </Button>
        </div>
      </>
    );
  }

  const docs = timeline.data?.documents ?? [];
  const list = shares.data?.shares ?? [];

  return (
    <>
      <PageHeader title="Share with a doctor" sub="Nothing is shared unless you share it. You choose how long, and what stays hidden." />

      <Card className="grid gap-6 p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">How long</legend>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <label key={d.minutes} className={`inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-[15px] ${minutes === d.minutes ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-line bg-surface"}`}>
                <input type="radio" name="dur" className="sr-only" checked={minutes === d.minutes} onChange={() => setMinutes(d.minutes)} />
                {d.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1 text-sm font-medium">Hide these kinds of item</legend>
          <p className="mb-2 text-sm text-muted">Hidden items are removed before the doctor&rsquo;s page is built. The doctor is told that some items are hidden.</p>
          <div className="grid gap-1 sm:grid-cols-2">
            {CATEGORY_KEYS.map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-3 text-[15px]">
                <input type="checkbox" className="h-5 w-5 accent-accent" checked={hiddenCats.includes(k)} onChange={() => toggle(hiddenCats, setHiddenCats, k)} />
                {CATEGORY_LABELS[k]}
              </label>
            ))}
          </div>
        </fieldset>

        {docs.length > 0 ? (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Hide whole documents</legend>
            <p className="mb-2 text-sm text-muted">Use this if a sensitive item is printed on a document. Hiding only a category does not hide the photo of its page.</p>
            <div className="grid gap-1">
              {docs.map((d) => (
                <label key={d.id} className="flex min-h-11 items-center gap-3 text-[15px]">
                  <input type="checkbox" className="h-5 w-5 accent-accent" checked={hiddenDocs.includes(d.id)} onChange={() => toggle(hiddenDocs, setHiddenDocs, d.id)} />
                  <span>
                    {d.doc_type?.replace(/_/g, " ") ?? "Document"}
                    {d.facility_as_printed ? <span className="text-muted"> · {d.facility_as_printed}</span> : null}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {needStepUp ? <StepUp onVerified={() => void create()} /> : null}
        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div>
          <Button onClick={() => void create()} disabled={busy}>
            Create a code
          </Button>
        </div>
      </Card>

      <section className="mt-8" aria-labelledby="mine">
        <h2 id="mine" className="mb-2">
          <Eyebrow>Your codes</Eyebrow>
        </h2>
        {shares.loading && !shares.data ? (
          <Skeleton className="h-20" />
        ) : list.length === 0 ? (
          <EmptyState title="No codes yet">When you create one it appears here, so you can end it early.</EmptyState>
        ) : (
          <Card className="divide-y divide-line">
            {list.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {s.purpose === "referral" ? "Referral code" : "General code"} <span className="font-normal text-muted">· made {when(s.created_at)}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {s.status === "valid" ? `Ends ${when(s.expires_at)}` : s.status === "revoked" ? "Ended by you" : "Expired"} · opened {s.viewer_count} {s.viewer_count === 1 ? "time" : "times"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={s.status === "valid" ? "ok" : "neutral"}>{s.status === "valid" ? "Active" : s.status === "revoked" ? "Ended" : "Expired"}</Tag>
                  {s.status === "valid" ? (
                    <Button variant="danger" onClick={() => void revoke(s.id)}>
                      End access now
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
