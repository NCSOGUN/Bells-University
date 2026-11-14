"use client";
// FR-14, FR-19, FR-20: build a referral packet from facts that already exist, preview exactly what the doctor will see, share it.
// Itan never writes the reason or urgency (hard rule 7): they come from a hospital's message or a letter the patient confirmed.
import { useState } from "react";
import { FactRow } from "@/components/FactRow";
import { PacketView } from "@/components/PacketView";
import { useRecord } from "@/components/RecordContext";
import { ShareResult } from "@/components/ShareResult";
import { Button, Card, EmptyState, ErrorBox, Eyebrow, Field, inputCls, LinkButton, Notice, PageHeader, Skeleton } from "@/components/ui";
import type {
  CreateReferralResponse,
  CreateShareResponse,
  FacilitiesResponse,
  ReferralPreviewResponse,
  RevokeResponse,
  TimelineResponse,
} from "@/lib/api-types";
import { describeError, getJson, postJson } from "@/lib/client-api";
import { useLoad } from "@/lib/use-load";

const EXPIRIES = [
  { minutes: 1440, label: "1 day" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "7 days" },
];

export default function ReferralPage() {
  const { record } = useRecord();
  const id = record!.id;
  const timeline = useLoad(() => getJson<TimelineResponse>(`/api/records/${id}/facts`), [id]);
  const facilities = useLoad(() => getJson<FacilitiesResponse>("/api/facilities"), []);
  const [sourceId, setSourceId] = useState("");
  const [facilityId, setFacilityId] = useState("");
  const [preview, setPreview] = useState<ReferralPreviewResponse | null>(null);
  const [referralId, setReferralId] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(4320);
  const [share, setShare] = useState<CreateShareResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sources = (timeline.data?.facts ?? []).filter((f) => f.kind === "referral");

  async function build() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { record_id: id };
      if (sourceId) body.source_fact_id = sourceId;
      if (facilityId) body.destination_facility_id = facilityId;
      const r = await postJson<CreateReferralResponse>("/api/referrals", body);
      setReferralId(r.referral_id);
      setPreview(await getJson<ReferralPreviewResponse>(`/api/referrals/${r.referral_id}`));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function createShare() {
    if (!referralId) return;
    setBusy(true);
    setError(null);
    try {
      setShare(await postJson<CreateShareResponse>("/api/shares", { record_id: id, purpose: "referral", referral_id: referralId, expires_in_minutes: minutes }));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(shareId: string) {
    try {
      await postJson<RevokeResponse>(`/api/shares/${shareId}/revoke`);
      setShare(null);
    } catch (e) {
      setError(describeError(e));
    }
  }

  async function refreshPreview() {
    if (referralId) setPreview(await getJson<ReferralPreviewResponse>(`/api/referrals/${referralId}`));
  }

  if (share) {
    return (
      <>
        <PageHeader title="Referral code" sub="Give this to the receiving doctor. They can acknowledge it from their screen." />
        <ShareResult share={share} onRevoke={(sid) => void revoke(sid)} onDone={() => { setShare(null); void refreshPreview(); }} />
      </>
    );
  }

  if (preview) {
    return (
      <>
        <PageHeader title="What the doctor will see" sub="Check it before you share. Missing items are shown as missing, never left out." />
        {preview.ai_notice ? (
          <div className="mb-4">
            <Notice tone="warn">{preview.ai_notice}</Notice>
          </div>
        ) : null}
        {preview.packet ? (
          <PacketView packet={preview.packet} audience="patient" imageHref={(d) => `/api/documents/${d}/image`} />
        ) : (
          <ErrorBox>This referral could not be built. Go back and try again.</ErrorBox>
        )}

        {preview.acknowledgements.length > 0 ? (
          <section className="mt-6" aria-labelledby="ack">
            <h2 id="ack" className="mb-2">
              <Eyebrow>Acknowledged</Eyebrow>
            </h2>
            <Card className="divide-y divide-line">
              {preview.acknowledgements.map((a, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="font-medium">{a.label}</p>
                  <p className="text-sm text-muted">
                    {a.viewer_name} · {new Date(a.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
              <p className="px-4 py-3 text-sm text-muted">{preview.disclaimer}</p>
            </Card>
          </section>
        ) : null}

        <Card className="mt-6 grid gap-4 p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">How long the receiving doctor can open it</legend>
            <div className="flex flex-wrap gap-2">
              {EXPIRIES.map((d) => (
                <label key={d.minutes} className={`inline-flex min-h-11 cursor-pointer items-center rounded-md border px-4 text-[15px] ${minutes === d.minutes ? "border-accent bg-accent-soft font-medium text-accent-ink" : "border-line bg-surface"}`}>
                  <input type="radio" name="exp" className="sr-only" checked={minutes === d.minutes} onChange={() => setMinutes(d.minutes)} />
                  {d.label}
                </label>
              ))}
            </div>
          </fieldset>
          {error ? <ErrorBox>{error}</ErrorBox> : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => void createShare()} disabled={busy}>
              Share this referral
            </Button>
            <Button variant="quiet" onClick={() => setPreview(null)}>
              Back
            </Button>
          </div>
        </Card>
      </>
    );
  }

  if (timeline.loading && !timeline.data) return <Skeleton className="h-40" />;

  return (
    <>
      <PageHeader title="Referral" sub="Send the receiving doctor a complete picture: results, medicines, allergies, and the reason as the referring clinician wrote it." />
      <Card className="grid gap-5 p-5">
        <div>
          <p className="text-sm font-medium">Where does the reason for referral come from?</p>
          {sources.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                title="No referral letter or hospital message yet"
                action={<LinkButton href="/app/capture" variant="primary">Photograph the referral letter</LinkButton>}
              >
                Itan does not write the reason or urgency. You can still build a packet, and those fields will say &ldquo;Not stated by the referring clinician&rdquo;.
              </EmptyState>
            </div>
          ) : (
            <div className="mt-2 grid gap-2">
              <label className="flex items-start gap-3 rounded-md border border-line p-3">
                <input type="radio" name="src" className="mt-1 h-5 w-5 accent-accent" checked={sourceId === ""} onChange={() => setSourceId("")} />
                <span className="text-[15px]">No source: leave reason and urgency as not stated</span>
              </label>
              {sources.map((f) => (
                <label key={f.id} className={`flex items-start gap-3 rounded-md border p-3 ${sourceId === f.id ? "border-accent bg-accent-soft/40" : "border-line"}`}>
                  <input type="radio" name="src" className="mt-1 h-5 w-5 accent-accent" checked={sourceId === f.id} onChange={() => setSourceId(f.id)} />
                  <span className="min-w-0 flex-1">
                    <FactRow fact={f} audience="patient" />
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <Field label="Referred to">
          <select className={inputCls} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="">Not chosen yet</option>
            {(facilities.data?.facilities ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} · {f.city}
              </option>
            ))}
          </select>
        </Field>

        {error ? <ErrorBox>{error}</ErrorBox> : null}
        <div>
          <Button onClick={() => void build()} disabled={busy}>
            Preview the packet
          </Button>
        </div>
      </Card>
    </>
  );
}
