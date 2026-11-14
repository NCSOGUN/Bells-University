"use client";
// FR-25, NFR-23: link a hospital so it can SEND results into your record. A link is write-only: the hospital cannot read anything.
// Every hospital in this version is SIMULATED; no real hospital is connected.
import { useState } from "react";
import { useRecord } from "@/components/RecordContext";
import { StepUp } from "@/components/StepUp";
import { Button, Card, EmptyState, ErrorBox, Eyebrow, Notice, PageHeader, Skeleton, Tag } from "@/components/ui";
import type { CreateLinkResponse, HospitalsResponse, LinksResponse, RevokeResponse } from "@/lib/api-types";
import { ApiFailure, describeError, getJson, postJson } from "@/lib/client-api";
import { useLoad } from "@/lib/use-load";

const qrSrc = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never");

export default function HospitalsPage() {
  const { record } = useRecord();
  const id = record!.id;
  const hospitals = useLoad(() => getJson<HospitalsResponse>("/api/hospitals"), []);
  const links = useLoad(() => getJson<LinksResponse>(`/api/records/${id}/links`), [id]);
  const [created, setCreated] = useState<CreateLinkResponse | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [needStepUp, setNeedStepUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link(hospitalId: string) {
    setError(null);
    setNeedStepUp(false);
    setPending(hospitalId);
    try {
      setCreated(await postJson<CreateLinkResponse>("/api/links", { record_id: id, hospital_id: hospitalId }));
      await links.reload();
    } catch (e) {
      if (e instanceof ApiFailure && e.code === "mfa_required") setNeedStepUp(true);
      else setError(describeError(e));
    }
  }

  async function revoke(linkId: string) {
    setError(null);
    try {
      await postJson<RevokeResponse>(`/api/links/${linkId}/revoke`);
      if (created?.link_id === linkId) setCreated(null);
      await links.reload();
    } catch (e) {
      setError(describeError(e));
    }
  }

  const list = links.data?.links ?? [];
  const activeIds = new Set(list.filter((l) => l.status === "active").map((l) => l.hospital.id));

  return (
    <>
      <PageHeader title="Hospitals" sub="Let a hospital send your results straight into your record. It can send. It cannot read anything." />
      <div className="mb-4">
        <Notice tone="sim">No real hospital is connected in this version. Every hospital here is a simulation for the demo.</Notice>
      </div>

      {created ? (
        <Card className="mb-6 grid gap-4 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc(created.qr_svg)} alt="QR code of the link reference" className="h-36 w-36 rounded-md border border-line bg-white p-2" />
          <div className="min-w-0">
            <Eyebrow>Give this to the records officer at {created.hospital.name}</Eyebrow>
            <p className="printed mt-1 break-all text-2xl font-medium">{created.link_ref}</p>
            <p className="mt-2 text-sm text-muted">They store it against your hospital number. You can unlink at any time and their next delivery is refused.</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => setCreated(null)}>
                Done
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {needStepUp ? (
        <div className="mb-4">
          <StepUp onVerified={() => pending && void link(pending)} />
        </div>
      ) : null}
      {error ? (
        <div className="mb-4">
          <ErrorBox>{error}</ErrorBox>
        </div>
      ) : null}

      <section aria-labelledby="avail">
        <h2 id="avail" className="mb-2">
          <Eyebrow>Hospitals you can link</Eyebrow>
        </h2>
        {hospitals.loading && !hospitals.data ? (
          <Skeleton className="h-20" />
        ) : (
          <Card className="divide-y divide-line">
            {(hospitals.data?.hospitals ?? []).map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="font-medium">{h.name}</span>
                {activeIds.has(h.id) ? (
                  <Tag tone="ok">Linked</Tag>
                ) : (
                  <Button variant="secondary" onClick={() => void link(h.id)}>
                    Link this hospital
                  </Button>
                )}
              </div>
            ))}
          </Card>
        )}
      </section>

      <section className="mt-8" aria-labelledby="links">
        <h2 id="links" className="mb-2">
          <Eyebrow>Your links</Eyebrow>
        </h2>
        {links.loading && !links.data ? (
          <Skeleton className="h-20" />
        ) : list.length === 0 ? (
          <EmptyState title="No hospitals linked">Link one above to let it send results into your record.</EmptyState>
        ) : (
          <Card className="divide-y divide-line">
            {list.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">{l.hospital.name}</p>
                  <p className="printed text-sm text-muted">{l.link_ref}</p>
                  <p className="text-sm text-muted">
                    {l.deliveries_accepted} accepted · {l.deliveries_refused} refused · last delivery {when(l.last_delivery_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={l.status === "active" ? "ok" : "neutral"}>{l.status === "active" ? "Active" : "Unlinked"}</Tag>
                  {l.status === "active" ? (
                    <Button variant="danger" onClick={() => void revoke(l.id)}>
                      Unlink
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
