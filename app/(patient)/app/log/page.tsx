"use client";
// FR-13, NFR-23: who has looked at the record, and who tried and was refused. Show each entry's own `label`.
import { useRecord } from "@/components/RecordContext";
import { Card, EmptyState, ErrorBox, PageHeader, Skeleton, Tag } from "@/components/ui";
import type { AccessLogResponse } from "@/lib/api-types";
import { describeError, getJson } from "@/lib/client-api";
import { useLoad } from "@/lib/use-load";

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function LogPage() {
  const { record } = useRecord();
  const id = record!.id;
  const log = useLoad(() => getJson<AccessLogResponse>(`/api/records/${id}/access-log?limit=100`), [id]);

  if (log.loading && !log.data) return <Skeleton className="h-48" />;
  if (log.error) return <ErrorBox>{describeError(log.error)}</ErrorBox>;
  const entries = log.data?.entries ?? [];

  return (
    <>
      <PageHeader title="Who has seen your record" sub="Every time a doctor opens a code, views a photo, or a hospital sends something. Refused attempts are listed too." />
      {entries.length === 0 ? (
        <EmptyState title="No activity yet">When you share a code or link a hospital, what happens appears here.</EmptyState>
      ) : (
        <Card className="divide-y divide-line">
          {entries.map((e) => (
            <div key={e.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{e.label}</p>
                <p className="text-sm text-muted">{when(e.at)}</p>
              </div>
              <Tag tone={e.outcome === "refused" ? "bad" : "neutral"}>{e.outcome === "refused" ? "Refused" : "Allowed"}</Tag>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
