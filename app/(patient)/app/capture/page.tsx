"use client";
// FR-02 capture, FR-16 offline queue, NFR-03 consent gate, NFR-09 small uploads.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ConsentCard } from "@/components/ConsentCard";
import { useRecord } from "@/components/RecordContext";
import { Button, Card, EmptyState, ErrorBox, Eyebrow, LinkButton, Notice, PageHeader, Spinner, Tag } from "@/components/ui";
import type { ConsentResponse } from "@/lib/api-types";
import { describeError, getJson } from "@/lib/client-api";
import { CaptureError, prepareCapture } from "@/lib/image-compress";
import { enqueue, listQueue, onQueueChange, processQueue, removeFromQueue, type QueueItem } from "@/lib/upload-queue";
import { useLoad } from "@/lib/use-load";

export default function CapturePage() {
  const router = useRouter();
  const { record } = useRecord();
  const consent = useLoad(() => getJson<ConsentResponse>("/api/consent"), []);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refresh = () => void listQueue().then(setQueue);
    refresh();
    return onQueueChange(refresh);
  }, []);

  async function onPick(file: File | undefined) {
    if (!file || !record) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await prepareCapture(file);
      const name = blob.type === "application/pdf" ? file.name || "document.pdf" : "capture.jpg";
      await enqueue(record.id, blob, name);
      // Saved on the device first. Now try to send; if the connection is down it simply stays queued.
      const created = await processQueue();
      if (created.length > 0) router.push(`/app/documents/${created[0]}`);
    } catch (e) {
      setError(e instanceof CaptureError ? e.message : describeError(e));
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function retry() {
    setBusy(true);
    const created = await processQueue();
    setBusy(false);
    if (created.length > 0) router.push(`/app/documents/${created[0]}`);
  }

  if (consent.loading && !consent.data) return <Spinner>Loading</Spinner>;
  if (consent.error) return <ErrorBox>{describeError(consent.error)}</ErrorBox>;
  if (!consent.data?.ai_consent_at) return <ConsentCard onAccepted={() => void consent.reload()} />;

  return (
    <>
      <PageHeader title="Add a document" sub="Lab results, prescriptions and referral letters. One page at a time works best." />

      <Card className="p-5">
        <Eyebrow>Take a clear photo</Eyebrow>
        <ul className="mt-2 grid gap-1 text-[15px] text-muted">
          <li>Lay the paper flat in good light.</li>
          <li>Keep the whole page in the picture.</li>
          <li>Printed documents work best. Handwriting is not supported yet.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => cameraRef.current?.click()} disabled={busy}>
            {busy ? <Spinner>Preparing</Spinner> : "Take a photo"}
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
            Choose a photo or PDF
          </Button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onPick(e.target.files?.[0])} />
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,application/pdf" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => void onPick(e.target.files?.[0])} />
        </div>
        <p className="mt-4 text-sm text-muted">Photos are made smaller and location data is removed on your phone before anything is sent.</p>
        {error ? (
          <div className="mt-4">
            <ErrorBox>{error}</ErrorBox>
          </div>
        ) : null}
      </Card>

      <section className="mt-6" aria-labelledby="q">
        <h2 id="q" className="mb-2">
          <Eyebrow>Waiting to send</Eyebrow>
        </h2>
        {queue.length === 0 ? (
          <p className="text-[15px] text-muted">Nothing is waiting. Photos are saved on this phone first, so a dropped connection never loses one.</p>
        ) : (
          <>
            <Notice tone="warn" role="status" title={`${queue.length} ${queue.length === 1 ? "page" : "pages"} saved on this phone`}>
              They will send by themselves when you are back online.
            </Notice>
            <Card className="mt-3 divide-y divide-line">
              {queue.map((q) => (
                <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="printed truncate text-[15px]">
                      {q.name} · {Math.max(1, Math.round(q.blob.size / 1024))} KB
                    </p>
                    <p className="text-sm text-muted">{q.error ?? (q.status === "uploading" ? "Sending" : "Queued")}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag tone={q.status === "failed" ? "bad" : "warn"}>{q.status === "failed" ? "Not sent" : q.status === "uploading" ? "Sending" : "Queued"}</Tag>
                    <Button variant="quiet" onClick={() => void removeFromQueue(q.id)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void retry()} disabled={busy}>
                Retry now
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="mt-8">
        <EmptyState title="No paper to hand?">You can type a fact in by hand instead. It is marked as added by you.</EmptyState>
        <div className="mt-3 flex justify-center">
          <LinkButton href="/app/facts/new">Add a fact by hand</LinkButton>
        </div>
      </section>
    </>
  );
}
