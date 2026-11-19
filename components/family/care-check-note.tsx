import { ChevronDown } from "lucide-react";
import { NURSE_CARE_STATUS_LABEL } from "@/lib/care-status";
import { formatTime, nurseShortName } from "@/lib/format";
import type { Nurse, Visit } from "@/lib/mock-data";
import { routes } from "@/lib/routes";
import { Card } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";

/** What the family sees about how a visit's readings were checked, and who decided. */
export function CareCheckNote({ visit, nurse }: { visit: Visit; nurse?: Nurse }) {
  const check = visit.careCheck;
  if (!check) return null;
  const { decision } = check;
  const who = nurse ? nurseShortName(nurse.name) : "The nurse";
  const reasons = check.findings.filter((f) => f.severity !== "info");

  return (
    <Card title="How these readings were checked">
      <p>
        We compared this visit&apos;s readings with {check.baseline ? "their usual and " : ""}with general limits.{" "}
        {reasons.length === 0 ? "Nothing stood out." : "Here is what stood out:"}
      </p>
      {reasons.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-navy">
          {reasons.map((f) => (
            <li key={f.ruleId}>{f.reason}</li>
          ))}
        </ul>
      )}
      <p className="mt-3 font-medium text-navy">
        {who} reviewed this at {formatTime(decision.decidedAt)} and recorded it as{" "}
        {NURSE_CARE_STATUS_LABEL[decision.finalStatus].toLowerCase()}.
        {decision.outcome === "adjusted" && decision.reason && ` Their note: ${decision.reason}`}
      </p>
      <p className="mt-2 text-small">
        The check is rule-based decision support, not a diagnosis, and a nurse always has the final say. If you are worried,
        call us or your doctor.
      </p>
    </Card>
  );
}

/** Dashboard explainer: how we keep watch, with no numbers that could drift from the rules. */
export function HowWeKeepWatch() {
  return (
    <details className="group rounded-2xl bg-surface shadow-card">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-6 py-3 text-h2 font-semibold tracking-tight [&::-webkit-details-marker]:hidden">
        How we keep watch
        <ChevronDown aria-hidden className="size-5 text-ink transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-6">
        <ul className="list-disc space-y-1 pl-5">
          <li>The nurse records blood pressure, pulse, temperature and medication at every visit.</li>
          <li>We compare each reading with your relative&apos;s own earlier visits, not only a textbook number.</li>
          <li>The nurse decides what it means. The check supports them and never replaces medical advice.</li>
        </ul>
        <TextLink href={routes.familyPrivacy} className="mt-1">
          Privacy and consent
        </TextLink>
      </div>
    </details>
  );
}
