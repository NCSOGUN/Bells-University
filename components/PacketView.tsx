// The referral packet, shown the same way to the patient (preview) and the clinician (/v/referral). Hook-free.
// A missing field is shown as MISSING, never hidden, using the server's fixed wording (docs/api.md, POST /api/referrals).
import type { Packet, PacketField } from "@/lib/api-types";
import { Card, Eyebrow, Notice, Tag } from "@/components/ui";
import { FactRow } from "@/components/FactRow";

function Field({ label, field }: { label: string; field: PacketField<string> }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-[15px] text-muted">{label}</dt>
      <dd>
        {field.status === "present" ? (
          <>
            <span className="font-medium">{field.value}</span>
            {field.urgency_code ? <span className="printed ml-2 text-sm text-muted">({field.urgency_code})</span> : null}
            {field.source ? <span className="block text-sm text-muted">{field.source}</span> : null}
            {field.note ? <span className="block text-sm text-muted">{field.note}</span> : null}
          </>
        ) : (
          <span className="inline-flex items-center gap-2">
            <Tag tone="warn">Missing</Tag>
            <span className="text-[15px]">{field.note}</span>
          </span>
        )}
      </dd>
    </div>
  );
}

export function PacketView({ packet, audience, imageHref }: { packet: Packet; audience: "patient" | "clinician"; imageHref?: (documentId: string) => string }) {
  const list = (f: PacketField<unknown[]>) => (f.status === "present" ? (f.value as Parameters<typeof FactRow>[0]["fact"][]) : []);
  const section = (title: string, f: PacketField<unknown[]>) => {
    const items = list(f);
    return (
      <section>
        <h3 className="mb-1">
          <Eyebrow>{title}</Eyebrow>
        </h3>
        {items.length === 0 ? (
          <p className="inline-flex items-center gap-2">
            <Tag tone="warn">Missing</Tag>
            <span className="text-[15px]">{f.note}</span>
          </p>
        ) : (
          <Card className="px-4">
            {items.map((fact) => (
              <FactRow key={fact.id} fact={fact} audience={audience} imageHref={fact.document_id && imageHref ? imageHref(fact.document_id) : undefined} />
            ))}
          </Card>
        )}
      </section>
    );
  };

  return (
    <div className="grid gap-6">
      <Card className="p-5">
        <dl className="grid gap-3">
          <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <dt className="text-[15px] text-muted">Patient</dt>
            <dd className="font-medium">
              {packet.patient.display_name}
              {packet.patient.birth_year ? <span className="font-normal text-muted"> · born {packet.patient.birth_year}</span> : null}
            </dd>
          </div>
          {packet.destination ? (
            <div className="grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-[15px] text-muted">Referred to</dt>
              <dd className="font-medium">{packet.destination}</dd>
            </div>
          ) : null}
          <Field label="Reason, as written" field={packet.reason_for_referral} />
          <Field label="Urgency, as written" field={packet.urgency} />
          <Field label="Referring clinician" field={packet.referring_clinician} />
          <Field label="Date" field={packet.date} />
        </dl>
      </Card>

      {packet.advisories.length > 0 ? (
        <div className="grid gap-2">
          {packet.advisories.map((a) => (
            <Notice key={`${a.allergy_fact_id}-${a.medicine_fact_id}`}>{a.message}</Notice>
          ))}
        </div>
      ) : null}

      {section("Allergies", packet.allergies)}
      {section("Medicines", packet.medicines)}
      {section("Results", packet.results)}
    </div>
  );
}
