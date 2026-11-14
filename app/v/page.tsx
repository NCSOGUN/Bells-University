// FR-12, FR-17, FR-24: the one-screen summary. Server-rendered and read-only; the share is re-checked on every load.
// Colour never grades a value. Items hidden by the patient are simply absent, and the page says that some are hidden.
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FactRow } from "@/components/FactRow";
import { NoLongerValid } from "@/components/NoLongerValid";
import { Card, Eyebrow, LinkButton, Notice, Tag } from "@/components/ui";
import { findAdvisories } from "@/lib/advisory/rules";
import { loadRules } from "@/lib/advisory/queries";
import { getViewerSummary } from "@/lib/share/service";
import { loadViewer } from "@/lib/viewer-page";

export const metadata: Metadata = { title: "Shared record" };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default async function ViewerPage() {
  const ctx = await loadViewer();
  if (!ctx.ok) return <NoLongerValid />;
  if (ctx.purpose === "referral") redirect("/v/referral");

  const summary = await getViewerSummary(ctx);
  if (!summary) return <NoLongerValid />;

  const { sections } = summary;
  // Advisory from the facts THIS viewer can see, so a hidden allergy never leaks (same rule as the referral packet).
  const advisories = findAdvisories([...sections.allergies, ...sections.medicines], await loadRules());
  const image = (id: string) => `/v/facts/${id}/image`;
  const block = (title: string, items: typeof sections.recent_results, empty: string) => (
    <section aria-labelledby={`s-${title}`}>
      <h2 id={`s-${title}`} className="mb-1 flex items-center gap-2">
        <Eyebrow>{title}</Eyebrow>
        <Tag>{items.length}</Tag>
      </h2>
      {items.length === 0 ? (
        <p className="text-[15px] text-muted">{empty}</p>
      ) : (
        <Card className="px-4">
          {items.map((f) => (
            <FactRow key={f.id} fact={f} audience="clinician" imageHref={image(f.id)} />
          ))}
        </Card>
      )}
    </section>
  );

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-semibold leading-tight tracking-tight">{summary.record.display_name}</h1>
          <p className="text-muted">
            {summary.record.birth_year ? `Born ${summary.record.birth_year} · ` : ""}
            {summary.record.held_by_caregiver ? "Held for them by a caregiver · " : ""}
            Shared by the patient, open until {when(summary.expires_at)}
          </p>
        </div>
        <LinkButton href="/c" variant="quiet">
          Open another code
        </LinkButton>
      </header>

      <div className="grid gap-2">
        <Notice tone="warn">{summary.ai_notice}</Notice>
        {summary.partial_notice ? <Notice>{summary.partial_notice}</Notice> : null}
        <Notice>{summary.recorded_notice}</Notice>
      </div>

      {advisories.length > 0 ? (
        <section aria-label="Allergy and medicine check" className="grid gap-2">
          <Eyebrow>Check with the patient</Eyebrow>
          {advisories.map((a) => (
            <Notice key={`${a.allergy_fact_id}-${a.medicine_fact_id}`}>{a.message}</Notice>
          ))}
        </section>
      ) : null}

      {block("Allergies", sections.allergies as typeof sections.recent_results, "None recorded in this record")}
      {block("Medicines", sections.medicines as typeof sections.recent_results, "None recorded in this record")}
      {block("Recent results", sections.recent_results, "None recorded in this record")}
      {sections.diagnoses.length > 0 ? block("Diagnoses", sections.diagnoses as typeof sections.recent_results, "") : null}
    </div>
  );
}
