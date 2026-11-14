"use client";
// FR-08 timeline, FR-17 advisory, FR-24 previous value. Facts are grouped by what they are, newest first inside each group.
import Link from "next/link";
import { useRecord } from "@/components/RecordContext";
import { FactRow } from "@/components/FactRow";
import { Card, EmptyState, ErrorBox, Eyebrow, LinkButton, Notice, PageHeader, Skeleton, Tag } from "@/components/ui";
import type { AdvisoriesResponse, TimelineResponse } from "@/lib/api-types";
import { describeError, getJson } from "@/lib/client-api";
import { useLoad } from "@/lib/use-load";

const GROUPS: { kind: string; title: string }[] = [
  { kind: "allergy", title: "Allergies" },
  { kind: "medication", title: "Medicines" },
  { kind: "lab", title: "Results" },
  { kind: "diagnosis", title: "Diagnoses" },
  { kind: "referral", title: "Referrals" },
];

export default function TimelinePage() {
  const { record } = useRecord();
  const id = record!.id;
  const timeline = useLoad(() => getJson<TimelineResponse>(`/api/records/${id}/facts`), [id]);
  const advisories = useLoad(() => getJson<AdvisoriesResponse>(`/api/records/${id}/advisories`), [id]);

  if (timeline.loading && !timeline.data) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    );
  }
  if (timeline.error) return <ErrorBox>{describeError(timeline.error)}</ErrorBox>;
  const facts = timeline.data?.facts ?? [];
  const docs = timeline.data?.documents ?? [];
  const unverified = facts.filter((f) => f.state === "unverified").length;
  const known = new Set(GROUPS.map((g) => g.kind));
  const groups = [...GROUPS, ...(facts.some((f) => !known.has(f.kind)) ? [{ kind: "__other", title: "Other" }] : [])];

  return (
    <>
      <PageHeader
        title="Your history"
        sub="Everything Itan has read or you have added, with where each item came from."
        aside={<LinkButton href="/app/capture" variant="primary">Add a document</LinkButton>}
      />

      {timeline.data?.ai_notice ? (
        <div className="mb-4">
          <Notice tone="warn">{timeline.data.ai_notice}</Notice>
        </div>
      ) : null}

      {unverified > 0 ? (
        <div className="mb-4">
          <Notice tone="accent" role="status" title={`${unverified} ${unverified === 1 ? "item needs" : "items need"} your check`}>
            Open the document, compare each item with the original, then confirm or correct it.
          </Notice>
        </div>
      ) : null}

      {(advisories.data?.advisories ?? []).length > 0 ? (
        <section aria-label="Medicine and allergy check" className="mb-6 grid gap-2">
          <Eyebrow>Worth checking with a doctor or pharmacist</Eyebrow>
          {advisories.data!.advisories.map((a) => (
            <Notice key={`${a.allergy_fact_id}-${a.medicine_fact_id}`}>{a.message}</Notice>
          ))}
        </section>
      ) : null}

      {facts.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          action={<LinkButton href="/app/capture" variant="primary">Photograph your first document</LinkButton>}
        >
          Take a photo of a lab result, a prescription or a referral letter. Itan will read it and you will check what it found.
        </EmptyState>
      ) : (
        <div className="grid gap-6">
          {groups.map((g) => {
            const items = facts.filter((f) => (g.kind === "__other" ? !known.has(f.kind) : f.kind === g.kind));
            if (!items.length) return null;
            return (
              <section key={g.kind} aria-labelledby={`g-${g.kind}`}>
                <h2 id={`g-${g.kind}`} className="mb-1 flex items-center gap-2">
                  <Eyebrow>{g.title}</Eyebrow>
                  <Tag>{items.length}</Tag>
                </h2>
                <Card className="px-4">
                  {items.map((f) => (
                    <FactRow key={f.id} fact={f} audience="patient" imageHref={f.document_id ? `/api/documents/${f.document_id}/image` : undefined}>
                      <div className="flex flex-wrap gap-2">
                        {f.state === "unverified" && f.document_id ? (
                          <LinkButton href={`/app/documents/${f.document_id}`} variant="primary">Check against the document</LinkButton>
                        ) : null}
                        <LinkButton href={`/app/facts/${f.id}`} variant="secondary">
                          {f.origin === "provider_entered" ? "Details or dispute" : f.kind === "lab" ? "Explain" : "Details"}
                        </LinkButton>
                      </div>
                    </FactRow>
                  ))}
                </Card>
              </section>
            );
          })}
        </div>
      )}

      {docs.length > 0 ? (
        <section className="mt-8" aria-labelledby="docs">
          <h2 id="docs" className="mb-2">
            <Eyebrow>Documents</Eyebrow>
          </h2>
          <Card className="divide-y divide-line">
            {docs.map((d) => (
              <Link key={d.id} href={`/app/documents/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-bg">
                <span className="font-medium">
                  {d.doc_type?.replace(/_/g, " ") ?? "Document"}
                  {d.facility_as_printed ? <span className="font-normal text-muted"> · {d.facility_as_printed}</span> : null}
                </span>
                <Tag tone={d.status === "extracted" ? "ok" : d.status === "failed" ? "bad" : "warn"}>
                  {d.status === "extracted" ? "Read" : d.status === "failed" ? "Could not be read" : d.status === "extracting" ? "Being read" : "Not read yet"}
                </Tag>
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
