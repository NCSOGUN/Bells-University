"use client";
// FR-19: "Received, service offered here" or "Received, service not offered here". Never a statement that a bed is available.
// Plain fetch only (no Supabase, no client-api): the clinician page stays light (NFR-11).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, ErrorBox, Eyebrow, Notice } from "@/components/ui";

type Status = "service_offered" | "service_not_offered";

export function AckButtons({ labels, disclaimer, current }: { labels: Record<string, string>; disclaimer: string; current: { label: string } | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ label: string } | null>(current);

  async function ack(status: Status) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/view/ack", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }), credentials: "same-origin" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { label: string };
      setDone({ label: body.label });
      router.refresh();
    } catch {
      setError("This access is no longer valid, or the acknowledgement could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="grid gap-3 p-5">
      <Eyebrow>Acknowledge this referral</Eyebrow>
      {done ? (
        <Notice tone="ok" role="status" title={done.label}>
          The patient can see this.
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => void ack("service_offered")} disabled={busy}>
          {labels.service_offered}
        </Button>
        <Button variant="secondary" onClick={() => void ack("service_not_offered")} disabled={busy}>
          {labels.service_not_offered}
        </Button>
      </div>
      <p className="text-sm text-muted">{disclaimer}</p>
      <p className="text-sm text-muted">Simulated in this version: no real hospital is connected.</p>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
    </Card>
  );
}
