// One fact, shown the same way to the patient and the clinician (NFR-07, NFR-16, NFR-19).
// Rules from docs/HANDOVER-DEV-A.md section 3:
//  - every fact shows its ORIGIN and STATE in words;
//  - hospital-sent facts have no edit or remove control (the parent passes only a dispute action);
//  - no colour, severity, "normal", "high", "low", "better" or "worse" on a value: the value is shown as printed.
import type { ReactNode } from "react";
import type { FactDTO, PreviousValue } from "@/lib/api-types";
import { Tag } from "@/components/ui";

export type FactLike = FactDTO & { previous?: PreviousValue | null };

/** "2026-05-14" -> "14 May 2026". Falls back to the text as printed when there is no readable date. */
export function formatDate(iso: string | null, asPrinted?: string | null): string | null {
  if (iso) {
    const d = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  }
  return asPrinted ?? null;
}

export function OriginTag({ fact, audience }: { fact: Pick<FactDTO, "origin">; audience: "patient" | "clinician" }) {
  if (fact.origin === "ai_read") return <Tag tone="accent">Read by AI</Tag>;
  if (fact.origin === "provider_entered") return <Tag tone="sim">Sent by hospital</Tag>;
  return <Tag tone="neutral">{audience === "patient" ? "Added by you" : "Added by patient"}</Tag>;
}

export function StateTag({ state }: { state: FactDTO["state"] }) {
  if (state === "unverified") return <Tag tone="warn">Unverified</Tag>;
  if (state === "disputed") return <Tag tone="bad">Disputed</Tag>;
  return <Tag tone="ok">Confirmed</Tag>;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);

export function FactRow({
  fact,
  audience,
  children,
  imageHref,
}: {
  fact: FactLike;
  audience: "patient" | "clinician";
  /** Actions slot (confirm, correct, dispute, ...). */
  children?: ReactNode;
  /** Where "View source" goes, when the fact has an image. */
  imageHref?: string;
}) {
  const date = formatDate(fact.fact_date, fact.fact_date_as_printed);
  const prevDate = fact.previous ? formatDate(fact.previous.fact_date) : null;
  const value = [fact.value_as_printed, fact.unit_as_printed].filter(Boolean).join(" ");
  const reason = fact.kind === "referral" ? str(fact.extra.reason_as_written) : null;
  const urgency = fact.kind === "referral" ? str(fact.extra.urgency_as_written) : null;

  return (
    <article className="grid gap-2 border-b border-line py-4 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <OriginTag fact={fact} audience={audience} />
        <StateTag state={fact.state} />
        {fact.check_carefully ? <Tag tone="warn">{audience === "patient" ? "Check against your document" : "Check against the document"}</Tag> : null}
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="min-w-0 text-[17px] font-semibold leading-snug">{fact.label_as_printed}</h3>
        {fact.unreadable ? (
          <p className="text-[15px] font-medium text-muted">Could not be read</p>
        ) : value ? (
          <p className="printed text-xl font-medium">{value}</p>
        ) : null}
      </div>

      <dl className="grid gap-x-6 gap-y-0.5 text-[15px] text-muted sm:grid-cols-2">
        {fact.range_as_printed && !fact.unreadable ? (
          <div className="flex gap-2">
            <dt>Printed range</dt>
            <dd className="printed text-ink">{fact.range_as_printed}</dd>
          </div>
        ) : null}
        {fact.previous && !fact.unreadable ? (
          <div className="flex gap-2">
            <dt>Previous</dt>
            <dd className="printed text-ink">
              {[fact.previous.value_as_printed, fact.previous.unit_as_printed].filter(Boolean).join(" ")}
              {prevDate ? <span className="font-sans text-muted"> · {prevDate}</span> : null}
            </dd>
          </div>
        ) : null}
        {date ? (
          <div className="flex gap-2">
            <dt>Date</dt>
            <dd className="text-ink">{date}</dd>
          </div>
        ) : null}
        {fact.facility_name ? (
          <div className="flex gap-2">
            <dt>{fact.origin === "provider_entered" ? "Sent by" : "From"}</dt>
            <dd className="text-ink">{fact.facility_name}</dd>
          </div>
        ) : null}
        {reason ? (
          <div className="flex gap-2 sm:col-span-2">
            <dt>Reason, as written</dt>
            <dd className="text-ink">{reason}</dd>
          </div>
        ) : null}
        {urgency ? (
          <div className="flex gap-2 sm:col-span-2">
            <dt>Urgency, as written</dt>
            <dd className="text-ink">{urgency}</dd>
          </div>
        ) : null}
      </dl>

      {fact.has_image && imageHref ? (
        <p>
          <a className="text-[15px] font-medium text-accent-ink underline underline-offset-2" href={imageHref} target="_blank" rel="noopener noreferrer">
            View source
          </a>
        </p>
      ) : null}
      {children}
    </article>
  );
}
